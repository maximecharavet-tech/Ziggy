//! From a segment plan to finished audio + word times + visemes.

use crate::align::PUNCT_PS;
use crate::g2p_en::EnglishG2P;
use crate::g2p_fr::{FrenchG2P, Phonemized};
use crate::contour::{curves, dur_scale, Layout, Voice};
use crate::intonation::Intonation;
use crate::kokoro::{encode, Controls, Kokoro, PitchCtl, Take, F0_HOP, MAX_TOKENS, SR};
use crate::numbers::spoken;
use crate::prosody::{Piece, SegmentPlan};
use crate::recipe::{Delivery, ONSET_SHIFT, TIMBRE_ROW, VISEME_SHIFT};
use crate::text::speakable;
use crate::visemes::{cues, Shape};
use crate::world::formant_filter;
use anyhow::{bail, Context, Result};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;

pub enum G2p<'a> {
    Fr(FrenchG2P<'a>),
    En(EnglishG2P<'a>),
}

impl G2p<'_> {
    pub fn utterance(&self, toks: &[String]) -> Result<Phonemized> {
        match self {
            G2p::Fr(g) => g.utterance(toks),
            G2p::En(g) => g.utterance(toks),
        }
    }
    pub fn locale(&self) -> &'static str {
        match self {
            G2p::Fr(_) => "fr",
            G2p::En(_) => "en",
        }
    }
}

/// One utterance sent to Kokoro (a piece, or half of a very long one).
pub struct Utterance {
    pub ps: String,
    /// char offset of each token of the piece in `ps` (None = no sound)
    pub starts: Vec<Option<usize>>,
}

pub struct PieceAudio {
    pub audio: Vec<f32>,
    /// start (s, from the piece's first sample) of each token's first phoneme
    pub token_times: Vec<Option<f64>>,
    /// (start s, end s, phoneme)
    pub phones: Vec<(f64, f64, char)>,
    pub phonemes: String,
}

pub struct SegmentAudio {
    pub audio: Vec<f32>,
    pub words: Vec<f64>,
    pub visemes: Vec<(f64, Shape)>,
    pub phonemes: Vec<String>,
}

pub struct Renderer<'a> {
    pub kokoro: &'a Kokoro,
    pub g2p: &'a G2p<'a>,
    pub take_cache: Option<PathBuf>,
}

fn take_key_v3(ids: &[i64], style: &[f32], speed: f32, ctl: &Controls) -> String {
    let mut h = Sha256::new();
    h.update(b"kokoro-ziggy-v3/1");
    for i in ids {
        h.update(i.to_le_bytes());
    }
    for v in style.iter().chain([speed].iter()).chain(&ctl.dur_scale).chain(&ctl.dur_frames).chain(&ctl.f0).chain(&ctl.n) {
        h.update(v.to_le_bytes());
    }
    h.update((ctl.f0.len() as u64).to_le_bytes());
    h.finalize().iter().take(16).map(|b| format!("{b:02x}")).collect()
}

/// Emphasis loudness: a smooth gain over the units' samples (30 ms ramps).
pub fn apply_gains(audio: &mut [f32], edges: &[f64], gains: &[(usize, usize, f32)]) {
    let ramp = 0.03 * SR as f64;
    for &(a, b, db) in gains {
        let (Some(&s0), Some(&s1)) = (edges.get(a), edges.get(b)) else { continue };
        let g = 10f64.powf(db as f64 / 20.0) - 1.0;
        let lo = (s0 - ramp).max(0.0) as usize;
        let hi = ((s1 + ramp) as usize).min(audio.len());
        for (i, x) in audio.iter_mut().enumerate().take(hi).skip(lo) {
            let t = i as f64;
            let w = if t < s0 {
                0.5 - 0.5 * (std::f64::consts::PI * (t - (s0 - ramp)) / ramp).cos()
            } else if t > s1 {
                0.5 + 0.5 * (std::f64::consts::PI * (t - s1) / ramp).cos()
            } else {
                1.0
            };
            *x *= (1.0 + g * w) as f32;
        }
    }
}

fn write_take(path: &PathBuf, t: &Take) -> Result<()> {
    fs::create_dir_all(path.parent().unwrap())?;
    let mut b: Vec<u8> = Vec::with_capacity(t.audio.len() * 4 + 4096);
    for (n, it) in [(t.audio.len(), &t.audio), (t.f0.len(), &t.f0), (t.f0_pred.len(), &t.f0_pred)] {
        b.extend((n as u64).to_le_bytes());
        for v in it {
            b.extend(v.to_le_bytes());
        }
    }
    b.extend((t.edges.len() as u64).to_le_bytes());
    for v in &t.edges {
        b.extend(v.to_le_bytes());
    }
    b.extend((t.durations.len() as u64).to_le_bytes());
    for v in &t.durations {
        b.extend(v.to_le_bytes());
    }
    let tmp = path.with_extension("partial");
    fs::File::create(&tmp)?.write_all(&b)?;
    fs::rename(tmp, path)?;
    Ok(())
}

fn read_take(path: &PathBuf) -> Option<Take> {
    let mut b = Vec::new();
    fs::File::open(path).ok()?.read_to_end(&mut b).ok()?;
    let mut p = 0usize;
    let u64_at = |p: &mut usize| -> Option<usize> {
        let v = u64::from_le_bytes(b.get(*p..*p + 8)?.try_into().ok()?) as usize;
        *p += 8;
        Some(v)
    };
    let f32s = |p: &mut usize, n: usize| -> Option<Vec<f32>> {
        let s = b.get(*p..*p + 4 * n)?;
        *p += 4 * n;
        Some(s.chunks_exact(4).map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect())
    };
    let n = u64_at(&mut p)?;
    let audio = f32s(&mut p, n)?;
    let n = u64_at(&mut p)?;
    let f0 = f32s(&mut p, n)?;
    let n = u64_at(&mut p)?;
    let f0_pred = f32s(&mut p, n)?;
    let n = u64_at(&mut p)?;
    let s = b.get(p..p + 8 * n)?;
    let edges = s.chunks_exact(8).map(|c| f64::from_le_bytes(c.try_into().unwrap())).collect();
    p += 8 * n;
    let n = u64_at(&mut p)?;
    let s = b.get(p..p + 8 * n)?;
    let durations = s.chunks_exact(8).map(|c| i64::from_le_bytes(c.try_into().unwrap())).collect();
    Some(Take { audio, edges, f0, f0_pred, durations })
}

/// Silence trimming like v1: 10 ms RMS windows against −38 dB of the
/// loudest, 20 ms margin before, 60 ms after.
pub fn trim_bounds(audio: &[f32]) -> (usize, usize) {
    let win = (0.01 * SR as f64) as usize;
    let n = audio.len() / win;
    if n == 0 {
        return (0, audio.len());
    }
    let rms: Vec<f64> = (0..n)
        .map(|i| {
            (audio[i * win..(i + 1) * win].iter().map(|&v| (v as f64).powi(2)).sum::<f64>() / win as f64 + 1e-12).sqrt()
        })
        .collect();
    let max = rms.iter().cloned().fold(0.0, f64::max);
    let thr = (max * 10f64.powf(-38.0 / 20.0)).max(1e-4);
    let on: Vec<usize> = (0..n).filter(|&i| rms[i] > thr).collect();
    let (Some(&a), Some(&b)) = (on.first(), on.last()) else { return (0, audio.len()) };
    let lo = (a * win).saturating_sub((0.02 * SR as f64) as usize);
    let hi = ((b + 1) * win + (0.06 * SR as f64) as usize).min(audio.len());
    (lo, hi)
}

impl<'a> Renderer<'a> {
    /// v3: plan (durations), predict, draw the contour, render with it.
    /// Returns the take and the emphasis gains (unit range, dB).
    fn synth_v3(
        &self,
        ids: &[i64],
        layout: &Layout,
        reading: &Intonation,
        toks: &[String],
        d: &Delivery,
    ) -> Result<(Take, Vec<(usize, usize, f32)>)> {
        let french = self.g2p.locale() == "fr";
        let style = self.kokoro.style_fixed_timbre(&d.blend, ids.len(), TIMBRE_ROW)?;
        let ds = dur_scale(layout, reading, toks, french);
        let pred = self.kokoro.predict(ids, &style, d.speed, &ds)?;
        let voice = Voice { french, reference_hz: d.pitch.reference * d.pitch.scale, range: d.range };
        let c = curves(layout, reading, toks, &pred, voice);
        let ctl = Controls {
            dur_frames: pred.durations.iter().map(|&x| x as f32).collect(),
            f0: c.f0,
            n: c.n,
            ..Default::default()
        };
        let key = take_key_v3(ids, &style, d.speed, &ctl);
        let path = self.take_cache.as_ref().map(|c| c.join(&key[..2]).join(format!("{key}.take")));
        if let Some(p) = &path {
            if let Some(t) = read_take(p) {
                return Ok((t, c.gains));
            }
        }
        let t = self.kokoro.synth_with(ids, &style, d.speed, PitchCtl::default(), &ctl)?;
        if t.durations != pred.durations {
            bail!("the rendering pass did not keep the planned durations");
        }
        if let Some(p) = &path {
            write_take(p, &t)?;
        }
        Ok((t, c.gains))
    }

    /// Phonemes of a piece, cut at the comma nearest the middle when it is
    /// too long for the model.
    pub fn utterances(&self, toks: &[String], closing_period: bool) -> Result<Vec<(usize, usize, Utterance)>> {
        let spoken_toks: Vec<String> = toks.iter().map(|t| spoken(t, self.g2p.locale())).collect();
        let ph = self.g2p.utterance(&spoken_toks)?;
        let mut ps = ph.ps.clone();
        if closing_period && !ps.trim_end().ends_with(|c: char| PUNCT_PS.contains(&c)) {
            ps = format!("{}.", ps.trim_end());
        }
        if encode(&ps).0.len() <= MAX_TOKENS - 2 {
            return Ok(vec![(0, toks.len(), Utterance { ps, starts: ph.starts })]);
        }
        let commas: Vec<usize> =
            (0..toks.len().saturating_sub(1)).filter(|&k| toks[k].ends_with([',', ';', ':'])).collect();
        let Some(&cut) = commas.iter().min_by_key(|&&k| (2 * k as i64 - toks.len() as i64).abs()) else {
            bail!("sentence too long and no comma: {}", toks.join(" "));
        };
        let cut = cut + 1;
        let mut a = self.utterances(&toks[..cut], false)?;
        let b = self.utterances(&toks[cut..], closing_period)?;
        a.extend(b.into_iter().map(|(s, e, u)| (s + cut, e + cut, u)));
        Ok(a)
    }

    pub fn render_piece(&self, tokens: &[String], piece: &Piece) -> Result<PieceAudio> {
        let toks = &tokens[piece.start..piece.end];
        let d = &piece.delivery;
        let mut audio: Vec<f32> = Vec::new();
        let mut token_times: Vec<Option<f64>> = vec![None; toks.len()];
        let mut phones = Vec::new();
        let mut phonemes = Vec::new();
        let gain = 10f32.powf(d.gain_db / 20.0);
        let parts = self.utterances(toks, piece.closing_period)?;
        let n_parts = parts.len();
        for (pi, (s, e, u)) in parts.into_iter().enumerate() {
            if !audio.is_empty() {
                audio.extend(std::iter::repeat_n(0.0, (0.18 * SR as f64) as usize));
            }
            let (ids, at, kept) = encode(&u.ps);
            if ids.is_empty() {
                continue;
            }
            let reading = if n_parts == 1 { piece.intonation.clone() } else { piece.intonation.slice(s, e, pi + 1 == n_parts) };
            let layout = Layout::new(&kept, &at, &u.starts);
            let (mut take, gains) = self.synth_v3(&ids, &layout, &reading, &toks[s..e], d)?;
            apply_gains(&mut take.audio, &take.edges, &gains);
            let shaped = formant_filter(&take.audio, SR, d.formant as f64, 9000.0, Some((&take.f0, F0_HOP)));
            let (lo, hi) = trim_bounds(&shaped);
            let off = audio.len() as f64 / SR as f64;
            let sec = |samples: f64| (samples - lo as f64) / SR as f64;
            let len = (hi - lo) as f64 / SR as f64;
            for (k, st) in u.starts.iter().enumerate() {
                if let Some(c) = st {
                    let id = at.get(*c).copied().unwrap_or(ids.len() - 1).min(ids.len() - 1);
                    let t = sec(take.edges[id]).clamp(0.0, (len - 0.05).max(0.0));
                    token_times[s + k] = Some(off + t);
                }
            }
            for (k, &c) in kept.iter().enumerate() {
                let (a, b) = (sec(take.edges[k]), sec(take.edges[k + 1]));
                if b > 0.0 && a < len {
                    phones.push((off + a.max(0.0), off + b.min(len), c));
                }
            }
            let mut seg: Vec<f32> = shaped[lo..hi].iter().map(|v| v * gain).collect();
            // 5 ms fades: trimmed edges never click
            let f = (0.005 * SR as f64) as usize;
            let n = seg.len();
            for i in 0..f.min(n) {
                let w = i as f32 / f as f32;
                seg[i] *= w;
                seg[n - 1 - i] *= w;
            }
            audio.extend(seg);
            phonemes.push(u.ps);
        }
        Ok(PieceAudio { audio, token_times, phones, phonemes: phonemes.join(" ") })
    }

    pub fn render_segment(&self, plan: &SegmentPlan) -> Result<SegmentAudio> {
        let sr = SR as f64;
        let mut audio: Vec<f32> = vec![0.0; (plan.lead as f64 * sr) as usize];
        let n = plan.tokens.len();
        let mut slots: Vec<Option<f64>> = vec![None; n];
        let mut piece_t0: Vec<f64> = vec![0.0; n];
        let mut phones: Vec<(f64, f64, char)> = Vec::new();
        let mut phonemes = Vec::new();
        for p in &plan.pieces {
            let pa = self
                .render_piece(&plan.tokens, p)
                .with_context(|| format!("piece {:?}", &plan.tokens[p.start..p.end]))?;
            let t0 = audio.len() as f64 / sr;
            for (k, t) in pa.token_times.iter().enumerate() {
                slots[p.start + k] = t.map(|t| t0 + t);
                piece_t0[p.start + k] = t0;
            }
            phones.extend(pa.phones.iter().map(|&(a, b, c)| (t0 + a, t0 + b, c)));
            audio.extend(pa.audio);
            audio.extend(std::iter::repeat_n(0.0, (p.pause_after as f64 * sr) as usize));
            phonemes.push(pa.phonemes);
        }
        let dur = audio.len() as f64 / sr;
        let words = word_times(&plan.tokens, &slots, &piece_t0, dur);
        let shifted: Vec<(f64, f64, char)> =
            phones.iter().map(|&(a, b, c)| ((a - VISEME_SHIFT).max(0.0), (b - VISEME_SHIFT).max(0.0), c)).collect();
        let visemes = cues(&shifted, dur, 0.05);
        Ok(SegmentAudio { audio, words, visemes, phonemes })
    }
}

/// Word start times: the phoneme slot moved `ONSET_SHIFT` earlier (never
/// before its piece starts; the first word of a piece starts with its sound),
/// tokens without sound take the next word's time, never decreasing, < dur.
pub fn word_times(tokens: &[String], slots: &[Option<f64>], piece_t0: &[f64], dur: f64) -> Vec<f64> {
    let n = tokens.len();
    let mut shifted: Vec<Option<f64>> = (0..n)
        .map(|k| slots[k].filter(|_| speakable(&tokens[k])).map(|t| (t - ONSET_SHIFT).max(piece_t0[k])))
        .collect();
    let mut seen_piece: Vec<f64> = Vec::new();
    for k in 0..n {
        if let Some(t) = shifted[k] {
            if !seen_piece.iter().any(|&p| (p - piece_t0[k]).abs() < 1e-9) {
                seen_piece.push(piece_t0[k]);
                shifted[k] = Some(t.min(piece_t0[k] + 0.02));
            }
        }
    }
    let mut out = vec![0.0; n];
    let mut next: Option<f64> = None;
    for k in (0..n).rev() {
        if let Some(t) = shifted[k] {
            next = Some(t);
        }
        out[k] = next.unwrap_or(-1.0);
    }
    let mut last = 0.0f64;
    for v in out.iter_mut() {
        if *v < 0.0 {
            *v = last;
        }
        *v = v.max(last);
        last = *v;
    }
    let cap = (dur - 0.01).max(0.0);
    out.iter().map(|&t| ((t.min(cap)) * 1000.0).round() / 1000.0).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn word_times_rules() {
        let toks: Vec<String> = ["«", "Oh", "!", "»", "chuchota", "Lili."].iter().map(|s| s.to_string()).collect();
        let slots = [None, Some(0.30), None, None, Some(1.20), Some(1.55)];
        let t0 = [0.10, 0.10, 0.10, 0.10, 1.00, 1.00];
        let w = word_times(&toks, &slots, &t0, 2.0);
        assert_eq!(w, vec![0.12, 0.12, 1.02, 1.02, 1.02, 1.45]);
        for p in w.windows(2) {
            assert!(p[1] >= p[0]);
        }
        let w = word_times(&toks, &slots, &t0, 1.3);
        assert!(w.iter().all(|&t| t < 1.3));
    }

    #[test]
    fn trimming_keeps_margins() {
        let mut a = vec![0.0f32; 24_000];
        for v in a[6000..12_000].iter_mut() {
            *v = 0.3;
        }
        let (lo, hi) = trim_bounds(&a);
        assert_eq!(lo, 6000 - 480);
        assert_eq!(hi, 12_000 + 1440);
    }

    #[test]
    fn take_cache_round_trip() {
        let t = Take {
            audio: vec![0.1, -0.2],
            edges: vec![0.0, 600.0, 1200.0],
            f0: vec![210.0],
            f0_pred: vec![200.0],
            durations: vec![3, 1, 2],
        };
        let p = std::env::temp_dir().join(format!("zv-take-{}/ab/x.take", std::process::id()));
        write_take(&p, &t).unwrap();
        let r = read_take(&p).unwrap();
        assert_eq!(r.audio, t.audio);
        assert_eq!(r.edges, t.edges);
        assert_eq!(r.f0, t.f0);
        assert_eq!(r.f0_pred, t.f0_pred);
        assert_eq!(r.durations, t.durations);
        fs::remove_dir_all(p.parent().unwrap().parent().unwrap()).unwrap();
    }
}
