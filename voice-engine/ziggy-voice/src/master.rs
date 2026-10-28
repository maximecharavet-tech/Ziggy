//! Mastering, all in Rust: the "produced audiobook" polish.
//!
//! high-pass 70 Hz → warmth (+1.5 dB at 220 Hz) → soft highs (−2 dB shelf at
//! 6.5 kHz, low-pass 11 kHz) → de-esser (STFT dynamic EQ on 4.5–12 kHz) →
//! 2:1 soft-knee compressor → a very small cosy room (synthetic IR, ~0.2 s,
//! a few % wet, no echo) → EBU R128 loudness (−18 LUFS) → true-peak limiter
//! (−1.5 dBTP, look-ahead, measured with ebur128's 4× oversampling) → 20 ms
//! fades.

use crate::analysis::loudness;
use crate::dsp::{coef, convolve, db_to_lin, fade, highpass4, lin_to_db, Biquad, Kind, Noise};
use crate::recipe::Master as M;
use realfft::RealFftPlanner;

#[derive(Clone, Debug, Default, serde::Serialize)]
pub struct Report {
    pub lufs: f64,
    pub true_peak_db: f64,
    pub deess_max_db: f64,
    pub comp_max_db: f64,
    pub limiter_max_db: f64,
    /// Share of the time the limiter takes more than 1 dB (%).
    pub limited_pct: f64,
}

pub fn eq(x: &mut [f64], sr: f64) {
    highpass4(x, sr, M::HIGHPASS_HZ);
    Biquad::new(Kind::Peak(M::WARMTH_DB), sr, M::WARMTH_HZ, 0.8).process(x);
    Biquad::new(Kind::HighShelf(M::SOFT_HIGHS_DB), sr, M::SOFT_HIGHS_HZ, 0.707).process(x);
    for q in [0.541_196_1, 1.306_563] {
        Biquad::new(Kind::LowPass, sr, M::LOWPASS_HZ, q).process(x);
    }
}

/// De-esser as a dynamic EQ in the STFT domain (linear phase, no smearing).
/// Only "hot" sibilants are touched: frames where the 5–10 kHz band holds
/// most of the energy **and** comes within `DEESS_THRESHOLD_DB` of the loud
/// speech level (p90 of the frame levels) get their 4.5–12 kHz bins lowered,
/// 0.6 dB per dB above the threshold, smoothed in time.
pub fn deess(x: &[f64], sr: f64) -> (Vec<f64>, f64) {
    let n = 512;
    let hop = 128;
    let win: Vec<f64> = (0..n).map(|i| 0.5 - 0.5 * (2.0 * std::f64::consts::PI * i as f64 / n as f64).cos()).collect();
    let mut planner = RealFftPlanner::<f64>::new();
    let fwd = planner.plan_fft_forward(n);
    let inv = planner.plan_fft_inverse(n);
    let bins = n / 2 + 1;
    let bin_hz = sr / n as f64;
    let pad = n;
    let len = x.len();
    let frame = |start: usize, buf: &mut Vec<f64>| {
        for i in 0..n {
            let k = start + i;
            buf[i] = if k >= pad && k - pad < len { x[k - pad] * win[i] } else { 0.0 };
        }
    };
    // pass 1: band energies
    let mut buf = vec![0.0; n];
    let mut spec = fwd.make_output_vec();
    let mut levels: Vec<(f64, f64)> = Vec::new(); // (sibilant band dB, full band dB)
    let mut start = 0;
    while start < len + pad {
        frame(start, &mut buf);
        fwd.process(&mut buf, &mut spec).unwrap();
        let (mut es, mut et) = (0.0, 0.0);
        for (b, c) in spec.iter().enumerate() {
            let f = b as f64 * bin_hz;
            let p = c.norm_sqr();
            if (100.0..10_000.0).contains(&f) {
                et += p;
            }
            if (M::DEESS_LO_HZ..M::DEESS_HI_HZ).contains(&f) {
                es += p;
            }
        }
        levels.push((10.0 * (es + 1e-20).log10(), 10.0 * (et + 1e-20).log10()));
        start += hop;
    }
    let mut speech: Vec<f64> = levels.iter().map(|l| l.1).filter(|&l| l > -60.0).collect();
    speech.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let loud = speech.get(speech.len() * 9 / 10).copied().unwrap_or(0.0);
    // per-bin attenuation shape: 0 below 4.5 kHz, 1 above 5.5 kHz
    let shape: Vec<f64> = (0..bins).map(|b| ((b as f64 * bin_hz - 4500.0) / 1000.0).clamp(0.0, 1.0)).collect();
    let att = (-(hop as f64) / (0.002 * sr)).exp();
    let rel = (-(hop as f64) / (0.060 * sr)).exp();
    let mut out = vec![0.0; len + 2 * pad + n];
    let mut norm = vec![0.0; len + 2 * pad + n];
    let mut red_db = 0.0f64;
    let mut max_red: f64 = 0.0;
    let (mut frames, mut active) = (0usize, 0usize);
    // pass 2: dynamic EQ
    for (fi, &(es_db, et_db)) in levels.iter().enumerate() {
        let start = fi * hop;
        frame(start, &mut buf);
        fwd.process(&mut buf, &mut spec).unwrap();
        let dominant = es_db - et_db > -6.0;
        let target =
            if dominant { ((es_db - loud - M::DEESS_THRESHOLD_DB) * 0.6).clamp(0.0, M::DEESS_MAX_DB) } else { 0.0 };
        red_db =
            if target > red_db { att * red_db + (1.0 - att) * target } else { rel * red_db + (1.0 - rel) * target };
        max_red = max_red.max(red_db);
        if et_db > -60.0 {
            frames += 1;
            if red_db > 2.0 {
                active += 1;
            }
        }
        if red_db > 0.01 {
            for (b, c) in spec.iter_mut().enumerate() {
                *c *= db_to_lin(-red_db * shape[b]);
            }
        }
        spec[0].im = 0.0;
        spec[bins - 1].im = 0.0;
        inv.process(&mut spec, &mut buf).unwrap();
        for i in 0..n {
            out[start + i] += buf[i] / n as f64 * win[i];
            norm[start + i] += win[i] * win[i];
        }
    }
    let y = (0..len).map(|i| out[i + pad] / norm[i + pad].max(1e-9)).collect();
    if std::env::var_os("ZV_DEBUG").is_some() {
        eprintln!(
            "de-esser: > 2 dB on {:.1} % of frames, max {max_red:.1} dB",
            100.0 * active as f64 / frames.max(1) as f64
        );
    }
    (y, max_red)
}

/// 2:1 soft-knee compressor on a 10 ms RMS detector.
pub fn compress(x: &mut [f64], sr: f64) -> f64 {
    let rms_c = coef(10.0, sr);
    let (at, rl) = (coef(M::COMP_ATTACK_MS, sr), coef(M::COMP_RELEASE_MS, sr));
    let (t, r, w) = (M::COMP_THRESHOLD_DB, M::COMP_RATIO, M::COMP_KNEE_DB);
    let mut ms = 0.0;
    let mut gr = 0.0f64; // dB of reduction
    let mut max_gr: f64 = 0.0;
    for v in x.iter_mut() {
        ms = rms_c * ms + (1.0 - rms_c) * *v * *v;
        let level = 10.0 * ms.max(1e-20).log10();
        let over = level - t;
        let target = if 2.0 * over < -w {
            0.0
        } else if 2.0 * over.abs() <= w {
            (1.0 / r - 1.0) * (over + w / 2.0).powi(2) / (2.0 * w)
        } else {
            (1.0 / r - 1.0) * over
        };
        let target = -target; // positive reduction
        gr = if target > gr { at * gr + (1.0 - at) * target } else { rl * gr + (1.0 - rl) * target };
        max_gr = max_gr.max(gr);
        *v *= db_to_lin(-gr);
    }
    max_gr
}

/// The cosy room: a few early reflections and a short, dark, decaying
/// diffuse tail (RT60 ≈ 0.22 s), unit energy. Deterministic.
pub fn room_ir(sr: f64) -> Vec<f64> {
    let len = (0.35 * sr) as usize;
    let mut ir = vec![0.0; len];
    let pre = (M::ROOM_PREDELAY_MS * 0.001 * sr) as usize;
    let mut noise = Noise::new(0x5a1c_c0de);
    let decay = 6.91 / (M::ROOM_RT60 * sr);
    for (i, v) in ir.iter_mut().enumerate().skip(pre) {
        let t = (i - pre) as f64;
        let onset = (t / (0.004 * sr)).min(1.0); // smooth build-up, no slap
        *v = noise.sample() * (-decay * t).exp() * onset;
    }
    for (ms, g) in [(9.0, 0.5), (13.0, -0.38), (19.0, 0.3), (24.0, -0.22), (31.0, 0.15)] {
        let k = (ms * 0.001 * sr) as usize;
        ir[k] += g * 3.0;
    }
    // darker reflections: one-pole low-pass at ~3.5 kHz, twice
    let a = (-2.0 * std::f64::consts::PI * 3500.0 / sr).exp();
    for _ in 0..2 {
        let mut z = 0.0;
        for v in ir.iter_mut() {
            z = (1.0 - a) * *v + a * z;
            *v = z;
        }
    }
    let e = ir.iter().map(|v| v * v).sum::<f64>().sqrt();
    ir.iter().map(|v| v / e).collect()
}

pub fn room(x: &[f64], sr: f64) -> Vec<f64> {
    let wet = convolve(x, &room_ir(sr));
    x.iter().zip(&wet).map(|(d, w)| d + M::ROOM_WET * w).collect()
}

/// Look-ahead peak limiter: never above `ceiling` (linear), smooth release.
pub fn limit(x: &[f64], ceiling: f64, sr: f64) -> (Vec<f64>, f64) {
    let (y, red, _) = limit_stats(x, ceiling, sr);
    (y, red)
}

/// The limiter, also returning the share of samples reduced by > 1 dB.
pub fn limit_stats(x: &[f64], ceiling: f64, sr: f64) -> (Vec<f64>, f64, f64) {
    let n = x.len();
    let l = (0.003 * sr) as usize;
    let need: Vec<f64> = x.iter().map(|v| (ceiling / v.abs().max(1e-12)).min(1.0)).collect();
    // centred minimum over 2l+1 then a moving average over 2l+1: every
    // averaged value is ≤ the need at the centre, so peaks never exceed.
    let minf: Vec<f64> = sliding_min(&need, l);
    let mut avg = vec![1.0; n];
    let mut acc = 0.0;
    let w = 2 * l + 1;
    // outside the signal: the edge value (each is ≤ the need at the edge)
    let get = |i: isize| minf[i.clamp(0, n as isize - 1) as usize];
    for i in -(l as isize)..=(l as isize) {
        acc += get(i);
    }
    for (i, a) in avg.iter_mut().enumerate() {
        *a = acc / w as f64;
        acc += get(i as isize + l as isize + 1) - get(i as isize - l as isize);
    }
    let rel = coef(60.0, sr);
    let mut g = 1.0f64;
    let mut max_red: f64 = 0.0;
    let mut y = Vec::with_capacity(n);
    let mut over = 0usize;
    let one_db = db_to_lin(-1.0);
    for i in 0..n {
        g = if avg[i] < g { avg[i] } else { (rel * g + (1.0 - rel) * avg[i]).min(avg[i]) };
        max_red = max_red.max(-lin_to_db(g));
        if g < one_db {
            over += 1;
        }
        y.push(x[i] * g);
    }
    (y, max_red, 100.0 * over as f64 / n.max(1) as f64)
}

fn sliding_min(v: &[f64], l: usize) -> Vec<f64> {
    // monotonic deque over the window [i-l, i+l]
    let n = v.len();
    let mut out = vec![1.0; n];
    let mut dq: std::collections::VecDeque<usize> = std::collections::VecDeque::new();
    let mut next = 0usize;
    for (i, o) in out.iter_mut().enumerate() {
        let hi = (i + l).min(n - 1);
        while next <= hi {
            while dq.back().is_some_and(|&b| v[b] >= v[next]) {
                dq.pop_back();
            }
            dq.push_back(next);
            next += 1;
        }
        while dq.front().is_some_and(|&f| f + l < i) {
            dq.pop_front();
        }
        *o = v[*dq.front().unwrap()];
    }
    out
}

/// The whole chain. `x` is mono at `sr`; returns the mastered audio.
pub fn master(x: &[f32], sr: u32) -> (Vec<f32>, Report) {
    master_to(x, sr, M::TRUE_PEAK_DB)
}

/// The chain with a given true-peak ceiling (the MP3 encoder can add a few
/// tenths of a dB: the generator re-masters lower when the decoded file
/// would go over `Master::TRUE_PEAK_DB`).
pub fn master_to(x: &[f32], sr: u32, true_peak_db: f64) -> (Vec<f32>, Report) {
    let srf = sr as f64;
    let mut y: Vec<f64> = x.iter().map(|&v| v as f64).collect();
    let mut rep = Report::default();
    eq(&mut y, srf);
    // bring the take near −20 LUFS so the dynamics thresholds mean the same
    // thing for every segment
    let pre = -20.0 - lufs64(&y, sr);
    if pre.is_finite() {
        let g = db_to_lin(pre.clamp(-30.0, 30.0));
        y.iter_mut().for_each(|v| *v *= g);
    }
    let (d, red) = deess(&y, srf);
    rep.deess_max_db = red;
    y = d;
    rep.comp_max_db = compress(&mut y, srf);
    y = room(&y, srf);
    y.truncate(x.len());
    // loudness, then true-peak limiting (iterate: the limiter barely moves
    // the integrated loudness, the ceiling adapts to the true peak)
    let mut gain_db = M::LUFS - lufs64(&y, sr);
    let mut ceiling_db = true_peak_db - 0.5;
    let mut out = y.clone();
    for _ in 0..8 {
        let g = db_to_lin(gain_db);
        let scaled: Vec<f64> = y.iter().map(|v| v * g).collect();
        let (mut f, red, pct) = limit_stats(&scaled, db_to_lin(ceiling_db), srf);
        rep.limited_pct = pct;
        fade(&mut f, (M::FADE_MS * 0.001 * srf) as usize, (M::FADE_MS * 0.001 * srf) as usize);
        let f32s: Vec<f32> = f.iter().map(|&v| v as f32).collect();
        let (lufs, tp) = loudness(&f32s, sr);
        rep.limiter_max_db = red;
        rep.lufs = lufs;
        rep.true_peak_db = tp;
        out = f;
        let tp_ok = tp <= true_peak_db;
        let lufs_ok = (lufs - M::LUFS).abs() <= 0.15;
        if tp_ok && lufs_ok {
            break;
        }
        if !tp_ok {
            ceiling_db -= tp - true_peak_db + 0.05;
        }
        if !lufs_ok {
            gain_db += M::LUFS - lufs;
        }
    }
    (out.iter().map(|&v| v as f32).collect(), rep)
}

fn lufs64(y: &[f64], sr: u32) -> f64 {
    let f: Vec<f32> = y.iter().map(|&v| v as f32).collect();
    loudness(&f, sr).0
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Speech-like test signal: a buzzy vowel with syllabic amplitude
    /// modulation and a few loud bursts.
    fn speechy(sr: u32, secs: f64) -> Vec<f32> {
        let n = (sr as f64 * secs) as usize;
        let mut noise = Noise::new(3);
        (0..n)
            .map(|i| {
                let t = i as f64 / sr as f64;
                let syl = (0.5 + 0.5 * (2.0 * std::f64::consts::PI * 4.0 * t).sin()).powi(2);
                let mut v = 0.0;
                for h in 1..20 {
                    v += (2.0 * std::f64::consts::PI * 230.0 * h as f64 * t).sin() / h as f64;
                }
                let burst = if (t * 3.0).fract() < 0.02 { 3.0 } else { 1.0 };
                ((v * 0.08 + noise.sample() * 0.01) * syl * burst) as f32
            })
            .collect()
    }

    #[test]
    fn loudness_target_and_true_peak() {
        let sr = 24_000;
        for scale in [0.05f32, 1.0, 4.0] {
            let x: Vec<f32> = speechy(sr, 6.0).iter().map(|v| v * scale).collect();
            let (y, rep) = master(&x, sr);
            assert_eq!(y.len(), x.len());
            assert!((rep.lufs - M::LUFS).abs() < 0.5, "lufs {}", rep.lufs);
            assert!(rep.true_peak_db <= M::TRUE_PEAK_DB + 0.05, "tp {}", rep.true_peak_db);
            assert!(y.iter().all(|v| v.abs() < 1.0));
            // fades: silent ends
            assert!(y[0].abs() < 1e-6 && y[y.len() - 1].abs() < 1e-6);
        }
    }

    #[test]
    fn limiter_never_exceeds_ceiling() {
        let sr = 24_000.0;
        let x: Vec<f64> =
            (0..48_000).map(|i| if i % 5000 == 0 { 1.5 } else { 0.3 * (i as f64 * 0.05).sin() }).collect();
        let (y, red) = limit(&x, 0.7, sr);
        assert!(y.iter().all(|v| v.abs() <= 0.7 + 1e-12));
        assert!(red > 6.0);
    }

    #[test]
    fn room_is_subtle_and_short() {
        let ir = room_ir(24_000.0);
        let e: f64 = ir.iter().map(|v| v * v).sum();
        assert!((e - 1.0).abs() < 1e-9);
        // 95 % of the energy in the first 150 ms: no echo tail
        let early: f64 = ir[..3600].iter().map(|v| v * v).sum();
        assert!(early > 0.95, "{early}");
        const { assert!(M::ROOM_WET < 0.1) };
    }

    #[test]
    fn deesser_tames_hiss_only() {
        let sr = 24_000.0;
        let mut noise = Noise::new(9);
        // a hissy "s": 6–9 kHz noise, then a vowel
        let mut x: Vec<f64> = (0..12_000).map(|_| noise.sample() * 0.3).collect();
        let mut bp = Biquad::new(Kind::BandPass, sr, 7500.0, 1.0);
        bp.process(&mut x);
        let vowel: Vec<f64> =
            (0..12_000).map(|i| 0.3 * (2.0 * std::f64::consts::PI * 300.0 * i as f64 / sr).sin()).collect();
        x.extend(vowel.iter());
        let (y, red) = deess(&x, sr);
        assert!(red > 2.0);
        let e = |s: &[f64]| s.iter().map(|v| v * v).sum::<f64>();
        assert!(e(&y[2000..10_000]) < 0.8 * e(&x[2000..10_000]), "sibilant lowered");
        let r = e(&y[15_000..22_000]) / e(&x[15_000..22_000]);
        assert!((r - 1.0).abs() < 0.05, "vowel untouched {r}");
    }

    #[test]
    fn compressor_ratio() {
        let sr = 24_000.0;
        // a steady tone 12 dB over the threshold → ~6 dB of reduction at 2:1
        let amp = db_to_lin(M::COMP_THRESHOLD_DB + 12.0) * 2f64.sqrt();
        let mut x: Vec<f64> = (0..48_000).map(|i| amp * (i as f64 * 0.1).sin()).collect();
        let red = compress(&mut x, sr);
        assert!((red - 6.0).abs() < 0.6, "{red}");
    }
}
