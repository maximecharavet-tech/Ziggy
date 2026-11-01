//! `ziggy-voice lab`: render one utterance with several voice recipes and
//! print their measurements side by side (how the v2 recipe was chosen).

use crate::analysis::{formant_scale, measure, Metrics};
use crate::kokoro::{encode, Blend, Kokoro, PitchCtl, SR};
use crate::world::{transform, WorldCfg};
use anyhow::{Context, Result};
use std::path::Path;
use std::process::Command;

pub fn read_wav(path: &Path) -> Result<(Vec<f32>, u32)> {
    let mut r = hound::WavReader::open(path).with_context(|| format!("open {}", path.display()))?;
    let spec = r.spec();
    let ch = spec.channels as usize;
    let data: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Float => r.samples::<f32>().map(|s| s.unwrap()).collect(),
        hound::SampleFormat::Int => {
            let scale = 1.0 / (1u64 << (spec.bits_per_sample - 1)) as f32;
            r.samples::<i32>().map(|s| s.unwrap() as f32 * scale).collect()
        }
    };
    let mono = if ch == 1 { data } else { data.chunks(ch).map(|c| c.iter().sum::<f32>() / ch as f32).collect() };
    Ok((mono, spec.sample_rate))
}

pub fn write_wav(path: &Path, x: &[f32], sr: u32) -> Result<()> {
    let spec =
        hound::WavSpec { channels: 1, sample_rate: sr, bits_per_sample: 32, sample_format: hound::SampleFormat::Float };
    let mut w = hound::WavWriter::create(path, spec)?;
    for &s in x {
        w.write_sample(s)?;
    }
    w.finalize()?;
    Ok(())
}

/// Decode any audio file to mono f32 at `sr` with ffmpeg.
pub fn decode(path: &Path, sr: u32) -> Result<Vec<f32>> {
    let out = Command::new("ffmpeg")
        .args(["-hide_banner", "-nostdin", "-loglevel", "error", "-i"])
        .arg(path)
        .args(["-ac", "1", "-ar", &sr.to_string(), "-f", "f32le", "-"])
        .output()?;
    if !out.status.success() {
        anyhow::bail!("ffmpeg decode {}: {}", path.display(), String::from_utf8_lossy(&out.stderr));
    }
    Ok(out.stdout.chunks_exact(4).map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]])).collect())
}

/// The v1 effect chain (rubberband ×1.30, formants ×1.12, comb, ring
/// modulator, EQ) — only to measure what v2 replaces.
pub fn v1_effect(x: &[f32], dir: &Path) -> Result<Vec<f32>> {
    let src = dir.join("v1-in.wav");
    let dst = dir.join("v1-out.wav");
    write_wav(&src, x, SR)?;
    let graph = "aresample=24000,asetrate=26880,aresample=24000,\
        rubberband=pitch=1.16071:tempo=0.89286:formant=preserved:pitchq=quality:transients=smooth:window=standard,\
        highpass=f=90,equalizer=f=220:t=q:w=0.9:g=2,highshelf=f=6000:g=-3,lowpass=f=10000,\
        aecho=in_gain=1.0:out_gain=0.86:delays=4.0:decays=0.20,\
        asplit=2[dry][rm];[rm]aeval=exprs=val(0)*sin(2*PI*42*t):c=same[ring];[dry][ring]amix=inputs=2:weights=1 0.12:normalize=0";
    let st = Command::new("ffmpeg")
        .args(["-hide_banner", "-nostdin", "-loglevel", "error", "-y", "-i"])
        .arg(&src)
        .args(["-filter_complex", graph, "-ar", "24000", "-ac", "1", "-c:a", "pcm_f32le"])
        .arg(&dst)
        .status()?;
    anyhow::ensure!(st.success(), "ffmpeg v1 chain failed");
    let (mut y, _) = read_wav(&dst)?;
    y.resize(x.len(), 0.0);
    Ok(y)
}

pub fn header() -> String {
    format!(
        "{:<26} {:>6} {:>6} {:>5} {:>6} {:>6} {:>6} {:>6} {:>6} {:>6} {:>6} {:>6}",
        "recipe", "f0med", "f0p95", "rngST", "jitt%", "hnrLo", "hnrHi", "flat", "rough", "ripple", "fmt×", "centr"
    )
}

pub fn row(name: &str, m: &Metrics, fmt: f64) -> String {
    format!(
        "{:<26} {:>6.0} {:>6.0} {:>5.1} {:>6.2} {:>6.1} {:>6.1} {:>6.3} {:>6.1} {:>6.1} {:>6.3} {:>6.0}",
        name,
        m.f0_median,
        m.f0_p95,
        m.range_st,
        m.jitter_pct,
        m.hnr_low_db,
        m.hnr_high_db,
        m.flatness,
        m.roughness_db,
        m.ripple_db,
        fmt,
        m.centroid_hz
    )
}

pub struct Candidate {
    pub name: String,
    pub blend: Blend,
    pub speed: f32,
    pub pitch: PitchCtl,
    pub world: Option<WorldCfg>,
    /// Feed WORLD the pitch curve Kokoro rendered (else Harvest).
    pub model_f0: bool,
    pub v1: bool,
    /// Formant shift as an STFT filter (no WORLD resynthesis).
    pub filter_only: bool,
}

/// Render every candidate for `ps`; return (name, audio).
pub fn render(k: &Kokoro, ps: &str, cands: &[Candidate], out: &Path) -> Result<Vec<(String, Vec<f32>)>> {
    let (ids, _, kept) = encode(ps);
    let mut res = Vec::new();
    let mut reference: Option<(Vec<f32>, Vec<f64>)> = None;
    let mut dist_rows = Vec::new();
    for c in cands {
        let style = k.style(&c.blend, ids.len())?;
        let take = k.synth(&ids, &style, c.speed, c.pitch)?;
        let mut y = take.audio.clone();
        if c.v1 {
            y = v1_effect(&y, out)?;
        }
        if let Some(w) = &c.world {
            let hint = c.model_f0.then_some((&take.f0[..], crate::kokoro::F0_HOP));
            y = if c.filter_only {
                crate::world::formant_filter(&y, SR, w.formant, w.warp_top, hint)
            } else {
                transform(&y, SR, w, hint)
            };
        }
        write_wav(&out.join(format!("{}.wav", c.name)), &y, SR)?;
        match &reference {
            None => reference = Some((y.clone(), take.edges.clone())),
            Some((r, e)) if *e == take.edges && r.len() == y.len() => {
                let d = crate::analysis::phoneme_distortion(r, &y, SR, &kept, &take.edges);
                dist_rows.push(format!(
                    "{:<26} {}",
                    c.name,
                    d.iter().map(|(k, v, _)| format!("{k}={v:.2}")).collect::<Vec<_>>().join(" ")
                ));
            }
            _ => {}
        }
        res.push((c.name.clone(), y));
    }
    if !dist_rows.is_empty() {
        println!("spectral-shape distance to the first recipe per phoneme class (dB, same durations):");
        for r in dist_rows {
            println!("{r}");
        }
    }
    Ok(res)
}

pub fn report(results: &[(String, Vec<f32>)], reference: usize) {
    println!("{}", header());
    for (name, y) in results {
        let m = measure(y, SR);
        let f = formant_scale(&results[reference].1, y, SR);
        println!("{}", row(name, &m, f));
    }
}

fn cand(name: &str, blend: Blend, speed: f32, pitch: PitchCtl, world: Option<WorldCfg>, model_f0: bool) -> Candidate {
    Candidate { name: name.into(), blend, speed, pitch, world, model_f0, v1: false, filter_only: false }
}

/// Pitch / formant methods for one base voice.
pub fn method_set(voice: &str, speed: f32) -> Vec<Candidate> {
    let b = || Blend::single(voice);
    let p0 = PitchCtl::default();
    let reference = if voice.starts_with('f') { 200.0 } else { 190.0 };
    let pn = |s: f32, g: f32| PitchCtl { scale: s, gamma: g, reference };
    let w = |s: f64, g: f64, f: f64| Some(WorldCfg { f0_scale: s, f0_gamma: g, formant: f, ..Default::default() });
    let mut v = vec![
        cand("raw", b(), speed, p0, None, false),
        Candidate { v1: true, ..cand("v1-rubberband", b(), speed, p0, None, false) },
        cand("world-identity-harvest", b(), speed, p0, w(1.0, 1.0, 1.0), false),
        cand("world-identity-modelf0", b(), speed, p0, w(1.0, 1.0, 1.0), true),
        cand("world-f1.18-g1.1-fm1.09", b(), speed, p0, w(1.18, 1.1, 1.09), true),
        cand("neural-f1.18-g1.12", b(), speed, pn(1.18, 1.12), None, false),
        cand("neural+world-fm1.06", b(), speed, pn(1.18, 1.12), w(1.0, 1.0, 1.06), true),
        cand("neural+world-fm1.09", b(), speed, pn(1.18, 1.12), w(1.0, 1.0, 1.09), true),
        cand("neural+world-fm1.12", b(), speed, pn(1.18, 1.12), w(1.0, 1.0, 1.12), true),
        Candidate {
            filter_only: true,
            ..cand("neural+filter-fm1.06", b(), speed, pn(1.18, 1.12), w(1.0, 1.0, 1.06), true)
        },
        Candidate {
            filter_only: true,
            ..cand("neural+filter-fm1.09", b(), speed, pn(1.18, 1.12), w(1.0, 1.0, 1.09), true)
        },
        Candidate {
            filter_only: true,
            ..cand("neural+filter-fm1.12", b(), speed, pn(1.18, 1.12), w(1.0, 1.0, 1.12), true)
        },
    ];
    v.retain(|_| true);
    v
}

/// Timbre (decoder half) blends: `base` mixed with each of `others`.
pub fn blend_set(base: &str, others: &[&str], amount: f32, speed: f32) -> Vec<Candidate> {
    let p0 = PitchCtl::default();
    let mut v = vec![cand("raw", Blend::single(base), speed, p0, None, false)];
    for o in others {
        let mut b = Blend::single(base);
        b.timbre = vec![(base.to_string(), 1.0 - amount), (o.to_string(), amount)];
        v.push(cand(&format!("t:{o}@{amount}"), b, speed, p0, None, false));
    }
    v
}

/// Whole voices (both halves), or a full blend `a:0.7+b:0.3`, side by side.
pub fn voice_set(voices: &[&str], speed: f32) -> Result<Vec<Candidate>> {
    let p0 = PitchCtl::default();
    let mut v = Vec::new();
    for spec in voices {
        let mix = Blend::parse_mix(spec)?;
        let b = Blend { timbre: mix.clone(), prosody: mix };
        v.push(cand(spec, b, speed, p0, None, false));
    }
    Ok(v)
}

/// In-network pitch sweep (where does the decoder start to suffer?).
pub fn pitch_set(voice: &str, speed: f32) -> Vec<Candidate> {
    let reference = if voice.starts_with('f') { 200.0 } else { 190.0 };
    let mut v = vec![cand("raw", Blend::single(voice), speed, PitchCtl::default(), None, false)];
    for (s, g) in
        [(1.1, 1.15), (1.19, 1.15), (1.25, 1.2), (1.32, 1.22), (1.4, 1.25), (1.5, 1.25), (1.19, 1.4), (0.9, 1.1)]
    {
        v.push(cand(
            &format!("f0x{s}-g{g}"),
            Blend::single(voice),
            speed,
            PitchCtl { scale: s, gamma: g, reference },
            None,
            false,
        ));
    }
    v
}

/// v3 controls probe: identity round trip, speed of the planning pass, and
/// what energy offsets and pitch overrides do.
pub fn probe(k: &Kokoro, ps: &str, voice: &str, speed: f32, out: &Path) -> Result<()> {
    use crate::kokoro::Controls;
    let (ids, _, _) = encode(ps);
    let style = k.style(&Blend::single(voice), ids.len())?;
    let t = std::time::Instant::now();
    let a = k.synth(&ids, &style, speed, PitchCtl::default())?;
    let t_full = t.elapsed();
    let t = std::time::Instant::now();
    let p = k.predict(&ids, &style, speed, &[])?;
    let t_pred = t.elapsed();
    println!("full synthesis {t_full:?}, planning pass {t_pred:?}");
    let frames: Vec<f32> = p.durations.iter().map(|&d| d as f32).collect();
    let same = Controls { dur_frames: frames.clone(), f0: p.f0.clone(), n: p.n.clone(), ..Default::default() };
    let b = k.synth_with(&ids, &style, speed, PitchCtl::default(), &same)?;
    let diff = a.audio.iter().zip(&b.audio).map(|(x, y)| (x - y).abs()).fold(0f32, f32::max);
    println!(
        "identity round trip: len {} vs {}, max |diff| {diff:.2e}, durations equal {}",
        a.audio.len(),
        b.audio.len(),
        a.durations == b.durations
    );
    let n_stats = |v: &[f32]| {
        let mut s = v.to_vec();
        s.sort_by(|x, y| x.partial_cmp(y).unwrap());
        (s[0], s[s.len() / 2], s[s.len() - 1])
    };
    println!(
        "n_pred min/median/max {:?}  f0 voiced frames {}",
        n_stats(&p.n),
        p.f0.iter().filter(|&&f| f > 10.0).count()
    );
    let rms = |x: &[f32]| 10.0 * (x.iter().map(|v| (*v as f64).powi(2)).sum::<f64>() / x.len() as f64).log10();
    for d in [-1.5f32, -1.0, -0.5, 0.5, 1.0] {
        let ctl = Controls { dur_frames: frames.clone(), n: p.n.iter().map(|v| v + d).collect(), ..Default::default() };
        let y = k.synth_with(&ids, &style, speed, PitchCtl::default(), &ctl)?;
        let m = crate::analysis::measure(&y.audio, SR);
        println!(
            "N {d:+.1}: level {:+.2} dB  hnrLo {:.1} hnrHi {:.1} flat {:.3}",
            rms(&y.audio) - rms(&a.audio),
            m.hnr_low_db,
            m.hnr_high_db,
            m.flatness
        );
        write_wav(&out.join(format!("n{d:+.1}.wav")), &y.audio, SR)?;
    }
    // pitch override: the model's curve +3 semitones on voiced frames
    let up: Vec<f32> = p.f0.iter().map(|&f| if f > 10.0 { f * 2f32.powf(3.0 / 12.0) } else { f }).collect();
    let ctl = Controls { dur_frames: frames.clone(), f0: up, ..Default::default() };
    let y = k.synth_with(&ids, &style, speed, PitchCtl::default(), &ctl)?;
    let ma = crate::analysis::measure(&a.audio, SR);
    let my = crate::analysis::measure(&y.audio, SR);
    println!(
        "F0 override +3 st: median {:.0} → {:.0} Hz (×{:.3}); jitter {:.2} → {:.2}",
        ma.f0_median,
        my.f0_median,
        my.f0_median / ma.f0_median,
        ma.jitter_pct,
        my.jitter_pct
    );
    // durations ×1.3 on every token
    let ctl = Controls { dur_scale: vec![1.3; ids.len() + 2], ..Default::default() };
    let q = k.predict(&ids, &style, speed, &ctl.dur_scale)?;
    let sum = |d: &[i64]| d.iter().sum::<i64>();
    println!("dur_scale 1.3: frames {} → {}", sum(&p.durations), sum(&q.durations));
    write_wav(&out.join("ref.wav"), &a.audio, SR)?;
    Ok(())
}

/// Colour drift: the same words with the style rows of utterances of
/// different lengths, timbre length-indexed (v2) or fixed (v3). Returns the
/// spread (dB) of the long-term spectral shape across renders.
pub fn drift(
    k: &Kokoro,
    ps: &str,
    blend: &Blend,
    speed: f32,
    rows: &[usize],
    fixed: Option<usize>,
) -> Result<(f64, f64)> {
    let (ids, _, _) = encode(ps);
    let mut shapes: Vec<Vec<f64>> = Vec::new();
    let mut medians: Vec<f64> = Vec::new();
    for &r in rows {
        let style = match fixed {
            Some(t) => k.style_fixed_timbre(blend, r, t)?,
            None => k.style(blend, r)?,
        };
        let take = match fixed {
            // v3 also draws every utterance around the role's reference pitch
            Some(_) => {
                let p = k.predict(&ids, &style, speed, &[])?;
                let mut v: Vec<f32> = p.f0.iter().copied().filter(|&f| f > 10.0).collect();
                v.sort_by(|a, b| a.partial_cmp(b).unwrap());
                let med = v.get(v.len() / 2).copied().unwrap_or(200.0);
                let f0: Vec<f32> = p.f0.iter().map(|&f| if f > 10.0 { f * 200.0 / med } else { f }).collect();
                let ctl = crate::kokoro::Controls {
                    dur_frames: p.durations.iter().map(|&d| d as f32).collect(),
                    f0,
                    ..Default::default()
                };
                k.synth_with(&ids, &style, speed, PitchCtl::default(), &ctl)?
            }
            None => k.synth(&ids, &style, speed, PitchCtl::default())?,
        };
        let mut v: Vec<f64> = take.f0.iter().filter(|&&f| f > 10.0).map(|&f| f as f64).collect();
        v.sort_by(|a, b| a.partial_cmp(b).unwrap());
        medians.push(12.0 * (v.get(v.len() / 2).copied().unwrap_or(200.0) / 200.0).log2());
        let frames = crate::analysis::mel_frames(&take.audio, SR);
        // long-term shape over frames with energy (mel_frames removes each frame's level)
        let n = frames.len().max(1) as f64;
        let mut avg = vec![0.0; frames.first().map_or(0, |f| f.len())];
        for f in &frames {
            for (a, v) in avg.iter_mut().zip(f) {
                *a += v / n;
            }
        }
        shapes.push(avg);
    }
    let bands = shapes[0].len();
    let mean: Vec<f64> = (0..bands).map(|b| shapes.iter().map(|s| s[b]).sum::<f64>() / shapes.len() as f64).collect();
    let spread = shapes
        .iter()
        .map(|s| (s.iter().zip(&mean).map(|(a, m)| (a - m).powi(2)).sum::<f64>() / bands as f64).sqrt())
        .sum::<f64>()
        / shapes.len() as f64;
    let mm = medians.iter().sum::<f64>() / medians.len() as f64;
    let pitch_sd = (medians.iter().map(|m| (m - mm).powi(2)).sum::<f64>() / medians.len() as f64).sqrt();
    Ok((spread, pitch_sd))
}
