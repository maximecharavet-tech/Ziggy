//! Ziggy's child voice with the WORLD vocoder (M. Morise, modified-BSD,
//! through `rsworld`, MIT): analysis → modification → resynthesis.
//!
//! * pitch: the curve Kokoro itself rendered (exact, no octave errors) refined
//!   by StoneMask, or Harvest when no curve is given;
//! * spectral envelope (CheapTrick): warped along the frequency axis by
//!   `formant` (> 1 = a smaller vocal tract, formants move up);
//! * aperiodicity (D4C): kept as analysed (breath and noise stay natural);
//! * F0 can also be scaled / widened here (`f0_scale`, `f0_gamma`).
//!
//! The frame grid is fixed (5 ms) and the output has the input's length, so
//! the word and viseme timings are untouched.

use rsworld_sys::{CheapTrickOption, D4COption, HarvestOption};

pub const FRAME_MS: f64 = 5.0;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct WorldCfg {
    pub f0_scale: f64,
    /// Melody widening around the median (log domain); 1 = unchanged.
    pub f0_gamma: f64,
    /// Spectral envelope warp factor (1 = unchanged).
    pub formant: f64,
    /// Lower the warp above this frequency back toward 1 (keeps the top
    /// octave natural instead of stretching noise): Hz.
    pub warp_top: f64,
}

impl Default for WorldCfg {
    fn default() -> Self {
        Self { f0_scale: 1.0, f0_gamma: 1.0, formant: 1.0, warp_top: 9000.0 }
    }
}

pub struct Analysis {
    pub f0: Vec<f64>,
    pub tpos: Vec<f64>,
    pub sp: Vec<Vec<f64>>,
    pub ap: Vec<Vec<f64>>,
    pub fft_size: usize,
}

/// Resample Kokoro's pitch curve (one value per `hop` samples, ≤ 10 Hz =
/// unvoiced) onto WORLD's 5 ms grid.
pub fn f0_from_model(curve: &[f32], hop: usize, sr: u32, n_frames: usize) -> Vec<f64> {
    let hop_s = hop as f64 / sr as f64;
    (0..n_frames)
        .map(|k| {
            let t = k as f64 * FRAME_MS / 1000.0;
            // the curve value i covers [i·hop, (i+1)·hop): centre at (i+0.5)·hop
            let x = t / hop_s - 0.5;
            let i = x.floor().max(0.0) as usize;
            let j = (i + 1).min(curve.len().saturating_sub(1));
            if curve.is_empty() {
                return 0.0;
            }
            let i = i.min(curve.len() - 1);
            let (a, b) = (curve[i] as f64, curve[j] as f64);
            let voiced = |v: f64| v > 10.0;
            match (voiced(a), voiced(b)) {
                (true, true) => {
                    let w = (x - x.floor()).clamp(0.0, 1.0);
                    a + (b - a) * w
                }
                (true, false) if x - x.floor() < 0.5 => a,
                (false, true) if x - x.floor() >= 0.5 => b,
                _ => 0.0,
            }
        })
        .collect()
}

/// WORLD's default CheapTrick floor (also what `rsworld::d4c` uses).
pub const CT_F0_FLOOR: f64 = 71.0;

/// `GetFFTSizeForCheapTrick` (rsworld binds it as `void`, so the size the C
/// function returns would be lost: compute it here, same formula).
pub fn cheaptrick_fft_size(sr: u32) -> i32 {
    2f64.powi(1 + (3.0 * sr as f64 / CT_F0_FLOOR + 1.0).log2() as i32) as i32
}

pub fn analyse(x: &[f64], sr: u32, f0_hint: Option<(&[f32], usize)>) -> Analysis {
    analyse_with(x, sr, f0_hint, true)
}

/// `with_ap = false` skips D4C (the envelope filter does not need it).
pub fn analyse_with(x: &[f64], sr: u32, f0_hint: Option<(&[f32], usize)>, with_ap: bool) -> Analysis {
    let fs = sr as i32;
    let n_frames = (x.len() as f64 / (sr as f64 * FRAME_MS / 1000.0)) as usize + 1;
    let tpos: Vec<f64> = (0..n_frames).map(|k| k as f64 * FRAME_MS / 1000.0).collect();
    let xv = x.to_vec();
    let f0 = match f0_hint {
        Some((curve, hop)) => {
            let raw = f0_from_model(curve, hop, sr, n_frames);
            let refined = rsworld::stonemask(&xv, fs, &tpos, &raw);
            // StoneMask can drift on very weak frames: keep it within ±6 %.
            raw.iter().zip(refined).map(|(&r, f)| if r > 0.0 && (f / r - 1.0).abs() < 0.06 { f } else { r }).collect()
        }
        None => {
            let mut f = harvest(&xv, sr);
            f.resize(n_frames, 0.0);
            f
        }
    };
    let mut ct = CheapTrickOption { q1: -0.15, f0_floor: CT_F0_FLOOR, fft_size: cheaptrick_fft_size(sr) };
    let sp = rsworld::cheaptrick(&xv, fs, &tpos, &f0, &mut ct);
    let fft_size = ct.fft_size as usize;
    let d4c = D4COption { threshold: 0.85 };
    let mut ap = if with_ap { rsworld::d4c(&xv, fs, &tpos, &f0, &d4c) } else { Vec::new() };
    let mut sp = sp;
    sanitize(&mut sp, &mut ap, &f0);
    Analysis { f0, tpos, sp, ap, fft_size }
}

/// Harvest (80–700 Hz, 5 ms). The WORLD version bundled by rsworld reads two
/// uninitialised candidate rows at the edges (fixed upstream later): any
/// value outside the search range is garbage and becomes "unvoiced".
pub fn harvest(x: &[f64], sr: u32) -> Vec<f64> {
    let opt = HarvestOption { f0_floor: 80.0, f0_ceil: 700.0, frame_period: FRAME_MS };
    let (_, f) = rsworld::harvest(&x.to_vec(), sr as i32, &opt);
    f.into_iter()
        .map(|v| if v.is_finite() && (opt.f0_floor * 0.9..=opt.f0_ceil * 1.1).contains(&v) { v } else { 0.0 })
        .collect()
}

/// D4C can return NaN on perfectly periodic (synthetic) frames: such a frame
/// is treated as fully periodic; values are kept in WORLD's safe range.
fn sanitize(sp: &mut [Vec<f64>], ap: &mut [Vec<f64>], f0: &[f64]) {
    for (frame, &f) in ap.iter_mut().zip(f0) {
        for v in frame.iter_mut() {
            *v = if v.is_finite() {
                v.clamp(0.001, 0.999_999_999_999)
            } else if f > 0.0 {
                0.001
            } else {
                0.999_999_999_999
            };
        }
    }
    for frame in sp.iter_mut() {
        for v in frame.iter_mut() {
            if !v.is_finite() || *v <= 0.0 {
                *v = 1e-16;
            }
        }
    }
}

/// Median of the voiced F0 values.
pub fn median_f0(f0: &[f64]) -> Option<f64> {
    let mut v: Vec<f64> = f0.iter().copied().filter(|&x| x > 0.0).collect();
    if v.is_empty() {
        return None;
    }
    v.sort_by(|a, b| a.partial_cmp(b).unwrap());
    Some(v[v.len() / 2])
}

/// Frequency warp of one envelope: out(f) = in(f / a(f)), with a(f) = formant
/// up to `top`, easing back to 1 at Nyquist (no stretched-out top band).
pub fn warp_envelope(env: &[f64], sr: u32, formant: f64, top: f64) -> Vec<f64> {
    if (formant - 1.0).abs() < 1e-6 {
        return env.to_vec();
    }
    let n = env.len();
    let nyq = sr as f64 / 2.0;
    let bin_hz = nyq / (n - 1) as f64;
    // work in the log domain so the interpolation follows the formant shapes
    let log: Vec<f64> = env.iter().map(|&v| v.max(1e-30).ln()).collect();
    (0..n)
        .map(|k| {
            let f = k as f64 * bin_hz;
            let a = if f <= top {
                formant
            } else {
                let u = ((f - top) / (nyq - top)).clamp(0.0, 1.0);
                formant + (1.0 - formant) * u * u * (3.0 - 2.0 * u)
            };
            let src = (f / a) / bin_hz;
            let i = src.floor() as usize;
            let w = src - i as f64;
            let v = if i + 1 < n { log[i] * (1.0 - w) + log[i + 1] * w } else { log[n - 1] };
            v.exp()
        })
        .collect()
}

/// The whole transform. `x` is mono at `sr`.
pub fn transform(x: &[f32], sr: u32, cfg: &WorldCfg, f0_hint: Option<(&[f32], usize)>) -> Vec<f32> {
    let xd: Vec<f64> = x.iter().map(|&v| v as f64).collect();
    let mut a = analyse(&xd, sr, f0_hint);
    if let Some(med) = median_f0(&a.f0) {
        let lm = med.ln();
        for f in a.f0.iter_mut().filter(|f| **f > 0.0) {
            *f = cfg.f0_scale * (lm + cfg.f0_gamma * (f.ln() - lm)).exp();
        }
    }
    if (cfg.formant - 1.0).abs() > 1e-6 {
        for env in a.sp.iter_mut() {
            *env = warp_envelope(env, sr, cfg.formant, cfg.warp_top);
        }
    }
    let y = rsworld::synthesis(&a.f0, &a.sp, &a.ap, FRAME_MS, sr as i32);
    let mut out: Vec<f32> = y.into_iter().map(|v| v as f32).collect();
    out.resize(x.len(), 0.0);
    out
}

/// Formant shift without resynthesis: WORLD's CheapTrick envelope gives, at
/// every 5 ms, how the spectrum should change (warped / original); that
/// smooth gain is applied to the neural audio in the STFT domain. The
/// excitation (harmonics, breath, noise, phases) of the original is kept,
/// so no vocoder buzz is added.
pub fn formant_filter(x: &[f32], sr: u32, formant: f64, warp_top: f64, f0_hint: Option<(&[f32], usize)>) -> Vec<f32> {
    if (formant - 1.0).abs() < 1e-6 || x.is_empty() {
        return x.to_vec();
    }
    let xd: Vec<f64> = x.iter().map(|&v| v as f64).collect();
    let a = analyse_with(&xd, sr, f0_hint, false);
    let nfft = a.fft_size; // 1024 at 24 kHz: same bins as the envelope
    let hop = nfft / 4;
    let bins = nfft / 2 + 1;
    let win: Vec<f64> =
        (0..nfft).map(|i| 0.5 - 0.5 * (2.0 * std::f64::consts::PI * i as f64 / nfft as f64).cos()).collect();
    let gains: Vec<Vec<f64>> =
        a.sp.iter()
            .map(|env| {
                let w = warp_envelope(env, sr, formant, warp_top);
                w.iter().zip(env).map(|(n, o)| (n / o).sqrt().clamp(0.25, 4.0)).collect()
            })
            .collect();
    let mut planner = realfft::RealFftPlanner::<f64>::new();
    let fwd = planner.plan_fft_forward(nfft);
    let inv = planner.plan_fft_inverse(nfft);
    let pad = nfft / 2;
    let n = xd.len();
    let mut out = vec![0.0; n + 2 * pad + nfft];
    let mut norm = vec![0.0; n + 2 * pad + nfft];
    let mut buf = vec![0.0; nfft];
    let mut spec = fwd.make_output_vec();
    let mut start = 0usize; // in padded coordinates
    while start < n + pad {
        for i in 0..nfft {
            let k = start + i;
            buf[i] = if k >= pad && k - pad < n { xd[k - pad] * win[i] } else { 0.0 };
        }
        fwd.process(&mut buf, &mut spec).unwrap();
        let centre = (start + nfft / 2) as f64 - pad as f64;
        let fi = ((centre / sr as f64) * 1000.0 / FRAME_MS).round().clamp(0.0, (gains.len() - 1) as f64) as usize;
        for (b, c) in spec.iter_mut().enumerate().take(bins) {
            *c *= gains[fi][b];
        }
        spec[0].im = 0.0;
        spec[bins - 1].im = 0.0;
        inv.process(&mut spec, &mut buf).unwrap();
        for i in 0..nfft {
            out[start + i] += buf[i] / nfft as f64 * win[i];
            norm[start + i] += win[i] * win[i];
        }
        start += hop;
    }
    (0..n).map(|i| (out[i + pad] / norm[i + pad].max(1e-9)) as f32).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A buzzy vowel-like test tone: harmonics of `f0` under a fixed envelope.
    fn vowel(f0: f64, sr: u32, secs: f64) -> Vec<f32> {
        let n = (sr as f64 * secs) as usize;
        (0..n)
            .map(|i| {
                let t = i as f64 / sr as f64;
                let mut v = 0.0;
                let mut h = 1.0;
                while h * f0 < 5000.0 {
                    let f = h * f0;
                    let amp = (-(f - 700.0).powi(2) / (2.0 * 250.0f64.powi(2))).exp()
                        + 0.6 * (-(f - 1800.0).powi(2) / (2.0 * 300.0f64.powi(2))).exp()
                        + 0.05;
                    v += amp * (2.0 * std::f64::consts::PI * f * t).sin();
                    h += 1.0;
                }
                (v * 0.1) as f32
            })
            .collect()
    }

    fn rms(x: &[f32]) -> f64 {
        (x.iter().map(|&v| (v as f64).powi(2)).sum::<f64>() / x.len() as f64).sqrt()
    }

    #[test]
    fn round_trip_keeps_length_level_and_pitch() {
        let sr = 24_000;
        let x = vowel(220.0, sr, 0.8);
        let y = transform(&x, sr, &WorldCfg::default(), None);
        assert_eq!(y.len(), x.len());
        let (rx, ry) = (rms(&x[2400..16800]), rms(&y[2400..16800]));
        assert!((ry / rx - 1.0).abs() < 0.35, "level {rx} → {ry}");
        let yd: Vec<f64> = y.iter().map(|&v| v as f64).collect();
        let a = analyse(&yd, sr, None);
        let med = median_f0(&a.f0).unwrap();
        assert!((med / 220.0 - 1.0).abs() < 0.03, "f0 {med}");
    }

    #[test]
    fn pitch_scale_moves_f0() {
        let sr = 24_000;
        let x = vowel(200.0, sr, 0.8);
        let y = transform(&x, sr, &WorldCfg { f0_scale: 1.2, ..Default::default() }, None);
        let yd: Vec<f64> = y.iter().map(|&v| v as f64).collect();
        let med = median_f0(&analyse(&yd, sr, None).f0).unwrap();
        assert!((med / 240.0 - 1.0).abs() < 0.03, "f0 {med}");
    }

    #[test]
    fn warp_moves_a_peak_up() {
        let sr = 24_000;
        let n = 513;
        let bin = 12_000.0 / 512.0;
        let env: Vec<f64> = (0..n).map(|k| 1e-4 + (-((k as f64 * bin - 1000.0) / 150.0).powi(2)).exp()).collect();
        let w = warp_envelope(&env, sr, 1.1, 9000.0);
        let peak =
            |e: &[f64]| e.iter().enumerate().max_by(|a, b| a.1.partial_cmp(b.1).unwrap()).unwrap().0 as f64 * bin;
        assert!((peak(&w) / 1100.0 - 1.0).abs() < 0.03, "{}", peak(&w));
    }

    #[test]
    fn formant_filter_identity_and_length() {
        let sr = 24_000;
        let x = vowel(210.0, sr, 0.6);
        let y = formant_filter(&x, sr, 1.0, 9000.0, None);
        assert_eq!(x, y);
        let z = formant_filter(&x, sr, 1.08, 9000.0, None);
        assert_eq!(z.len(), x.len());
        // same pitch, energy in the same ballpark
        let r = rms(&z[2400..12000]) / rms(&x[2400..12000]);
        assert!((0.5..2.0).contains(&r), "{r}");
    }

    #[test]
    fn fft_size_like_world() {
        assert_eq!(cheaptrick_fft_size(24_000), 1024);
        assert_eq!(cheaptrick_fft_size(48_000), 2048);
    }

    #[test]
    fn model_f0_resampling() {
        // 100 values at 12.5 ms → 5 ms frames; unvoiced stays 0
        let mut c = vec![200.0f32; 100];
        for v in c.iter_mut().take(10) {
            *v = 0.5;
        }
        let f = f0_from_model(&c, 300, 24_000, 250);
        assert_eq!(f[0], 0.0);
        assert!((f[100] - 200.0).abs() < 1e-6);
    }
}
