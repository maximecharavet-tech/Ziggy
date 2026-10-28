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
