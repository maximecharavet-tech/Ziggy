//! Objective measurements (we cannot listen): pitch statistics, artefact
//! indicators and loudness. Used to choose the voice recipe and to check
//! every rendered file.

use crate::world;
use realfft::RealFftPlanner;

#[derive(Clone, Debug, Default, serde::Serialize)]
pub struct Metrics {
    /// Voiced pitch (Harvest): median and 5th/95th percentiles (Hz).
    pub f0_median: f64,
    pub f0_p5: f64,
    pub f0_p95: f64,
    /// Melodic range p5→p95 in semitones.
    pub range_st: f64,
    /// Short-term pitch irregularity: mean |second difference| / f0 on
    /// 5 ms frames (%) — intonation removed, wobble and vocoder jitter left.
    pub jitter_pct: f64,
    /// Harmonic peaks vs. inter-harmonic valleys, 0–4 kHz (dB).
    pub hnr_low_db: f64,
    /// Same 4–8 kHz (too high = buzzy/"metallic" highs, too low = hiss).
    pub hnr_high_db: f64,
    /// Spectral flatness 1–5 kHz on voiced frames (0 = tonal, 1 = noise).
    pub flatness: f64,
    /// Amplitude-modulation depth 30–120 Hz inside voiced speech (rough /
    /// buzzing modulation, e.g. a ring modulator, shows up here) (dB).
    pub roughness_db: f64,
    /// Long-term spectral centroid of voiced frames (Hz).
    pub centroid_hz: f64,
    /// Cepstral ripple: strongest cepstral peak 1–6 ms outside the pitch
    /// period (a comb filter / phasiness shows up as a fixed quefrency) (dB).
    pub ripple_db: f64,
    pub lufs: f64,
    pub true_peak_db: f64,
    pub clipped: usize,
    pub seconds: f64,
}

fn percentile(v: &mut [f64], p: f64) -> f64 {
    if v.is_empty() {
        return 0.0;
    }
    v.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let i = ((v.len() - 1) as f64 * p).round() as usize;
    v[i]
}

fn hann(n: usize) -> Vec<f64> {
    (0..n).map(|i| 0.5 - 0.5 * (2.0 * std::f64::consts::PI * i as f64 / n as f64).cos()).collect()
}

/// Power spectrum of a Hann-windowed frame centred at `c`.
fn frame_power(x: &[f64], c: usize, win: &[f64], nfft: usize, planner: &mut RealFftPlanner<f64>) -> Vec<f64> {
    let n = win.len();
    let mut buf = vec![0.0; nfft];
    let start = c as isize - (n / 2) as isize;
    for i in 0..n {
        let k = start + i as isize;
        if k >= 0 && (k as usize) < x.len() {
            buf[i] = x[k as usize] * win[i];
        }
    }
    let fft = planner.plan_fft_forward(nfft);
    let mut spec = fft.make_output_vec();
    fft.process(&mut buf, &mut spec).unwrap();
    spec.iter().map(|c| c.norm_sqr()).collect()
}

pub fn loudness(x: &[f32], sr: u32) -> (f64, f64) {
    let mut m = ebur128::EbuR128::new(1, sr, ebur128::Mode::I | ebur128::Mode::TRUE_PEAK).unwrap();
    m.add_frames_f32(x).unwrap();
    let lufs = m.loudness_global().unwrap_or(-70.0);
    let tp = m.true_peak(0).unwrap_or(0.0);
    (lufs, 20.0 * tp.max(1e-9).log10())
}

pub fn measure(x: &[f32], sr: u32) -> Metrics {
    let xd: Vec<f64> = x.iter().map(|&v| v as f64).collect();
    let mut m = Metrics { seconds: x.len() as f64 / sr as f64, ..Default::default() };
    let (lufs, tp) = loudness(x, sr);
    m.lufs = lufs;
    m.true_peak_db = tp;
    m.clipped = x.iter().filter(|v| v.abs() >= 0.999).count();
    if x.len() < sr as usize / 4 {
        return m;
    }
    let f0 = world::harvest(&xd, sr);
    let mut voiced: Vec<f64> = f0.iter().copied().filter(|&f| f > 0.0).collect();
    m.f0_median = percentile(&mut voiced, 0.5);
    m.f0_p5 = percentile(&mut voiced, 0.05);
    m.f0_p95 = percentile(&mut voiced, 0.95);
    if m.f0_p5 > 0.0 {
        m.range_st = 12.0 * (m.f0_p95 / m.f0_p5).log2();
    }
    // jitter: second difference inside voiced runs
    let (mut acc, mut cnt) = (0.0, 0usize);
    for t in 1..f0.len().saturating_sub(1) {
        let (a, b, c) = (f0[t - 1], f0[t], f0[t + 1]);
        if a > 0.0 && b > 0.0 && c > 0.0 {
            acc += (b - 0.5 * (a + c)).abs() / b;
            cnt += 1;
        }
    }
    m.jitter_pct = if cnt > 0 { 100.0 * acc / cnt as f64 } else { 0.0 };

    // spectral measures on voiced frames (every 20 ms)
    let mut planner = RealFftPlanner::<f64>::new();
    let win_n = (0.040 * sr as f64) as usize;
    let win = hann(win_n);
    let nfft = 4096;
    let bin = sr as f64 / nfft as f64;
    let (mut hl, mut hh, mut nh) = (0.0, 0.0, 0usize);
    let (mut flat, mut nf) = (0.0, 0usize);
    let mut ltas = vec![0.0; nfft / 2 + 1];
    let mut ripple = 0.0;
    let mut nr = 0usize;
    let hop_frames = (20.0 / world::FRAME_MS) as usize;
    for t in (0..f0.len()).step_by(hop_frames) {
        let f = f0[t];
        if f <= 0.0 {
            continue;
        }
        let c = (t as f64 * world::FRAME_MS / 1000.0 * sr as f64) as usize;
        let p = frame_power(&xd, c, &win, nfft, &mut planner);
        let energy: f64 = p.iter().sum();
        if energy < 1e-7 {
            continue;
        }
        for (a, b) in ltas.iter_mut().zip(&p) {
            *a += b;
        }
        let band_hnr = |lo: f64, hi: f64| -> Option<f64> {
            let mut s = 0.0;
            let mut n = 0;
            let mut h = (lo / f).ceil().max(1.0);
            while h * f + f < hi {
                let k = (h * f / bin).round() as usize;
                let half = (f / 4.0 / bin).max(1.0) as usize;
                let peak = p[k.saturating_sub(half)..=(k + half).min(p.len() - 1)].iter().cloned().fold(0.0, f64::max);
                let v = ((h + 0.5) * f / bin).round() as usize;
                let valley = p[v.saturating_sub(1)..=(v + 1).min(p.len() - 1)].iter().cloned().fold(f64::MAX, f64::min);
                s += 10.0 * ((peak + 1e-20) / (valley + 1e-20)).log10();
                n += 1;
                h += 1.0;
            }
            (n > 0).then(|| s / n as f64)
        };
        if let (Some(a), Some(b)) = (band_hnr(100.0, 4000.0), band_hnr(4000.0, 8000.0)) {
            hl += a;
            hh += b;
            nh += 1;
        }
        let (k1, k2) = ((1000.0 / bin) as usize, (5000.0 / bin) as usize);
        let band = &p[k1..k2];
        let geo = band.iter().map(|v| (v + 1e-20).ln()).sum::<f64>() / band.len() as f64;
        let ari = band.iter().sum::<f64>() / band.len() as f64;
        flat += geo.exp() / (ari + 1e-20);
        nf += 1;
        // cepstrum: peak 1–6 ms away from the pitch period and its multiples
        let logp: Vec<f64> = p.iter().map(|v| (v + 1e-12).ln()).collect();
        let mut lp = logp.clone();
        lp.truncate(nfft / 2 + 1);
        let inv = planner.plan_fft_inverse(nfft);
        let mut spec: Vec<realfft::num_complex::Complex<f64>> =
            lp.iter().map(|&v| realfft::num_complex::Complex::new(v, 0.0)).collect();
        spec[0].im = 0.0;
        spec[nfft / 2].im = 0.0;
        let mut cep = inv.make_output_vec();
        if inv.process(&mut spec, &mut cep).is_ok() {
            let period = sr as f64 / f;
            let mut best: f64 = 0.0;
            let floor: f64 = {
                let mut v: Vec<f64> =
                    cep[(0.001 * sr as f64) as usize..(0.006 * sr as f64) as usize].iter().map(|c| c.abs()).collect();
                percentile(&mut v, 0.5)
            };
            let (q1, q2) = ((0.001 * sr as f64) as usize, (0.006 * sr as f64) as usize);
            for (q, c) in cep.iter().enumerate().take(q2).skip(q1) {
                let ratio = q as f64 / period;
                if (ratio - ratio.round()).abs() * period < 6.0 && ratio.round() >= 1.0 {
                    continue; // the pitch rahmonics are expected
                }
                best = best.max(c.abs());
            }
            ripple += 20.0 * ((best + 1e-12) / (floor + 1e-12)).log10();
            nr += 1;
        }
    }
    if nh > 0 {
        m.hnr_low_db = hl / nh as f64;
        m.hnr_high_db = hh / nh as f64;
    }
    if nf > 0 {
        m.flatness = flat / nf as f64;
    }
    if nr > 0 {
        m.ripple_db = ripple / nr as f64;
    }
    let tot: f64 = ltas.iter().sum();
    if tot > 0.0 {
        m.centroid_hz = ltas.iter().enumerate().map(|(k, v)| k as f64 * bin * v).sum::<f64>() / tot;
    }
    m.roughness_db = roughness(&xd, sr, &f0, &mut planner);
    m
}

/// Roughness: amplitude-modulation depth of the 1–4 kHz band in the 30–120 Hz
/// range (below the pitch, above the syllables), measured only inside fully
/// voiced 128 ms windows, so speaking rate and pauses do not count (dB).
fn roughness(x: &[f64], sr: u32, f0: &[f64], planner: &mut RealFftPlanner<f64>) -> f64 {
    let n = x.len().next_power_of_two();
    let fft = planner.plan_fft_forward(n);
    let mut buf = x.to_vec();
    buf.resize(n, 0.0);
    let mut spec = fft.make_output_vec();
    fft.process(&mut buf, &mut spec).unwrap();
    let bin = sr as f64 / n as f64;
    for (k, c) in spec.iter_mut().enumerate() {
        let f = k as f64 * bin;
        if !(1000.0..=4000.0).contains(&f) {
            *c = realfft::num_complex::Complex::new(0.0, 0.0);
        }
    }
    let inv = planner.plan_fft_inverse(n);
    let mut band = inv.make_output_vec();
    inv.process(&mut spec, &mut band).unwrap();
    // envelope sampled at 1 kHz
    let step = (sr / 1000) as usize;
    let env: Vec<f64> =
        band[..x.len()].chunks(step).map(|c| c.iter().map(|v| v.abs()).sum::<f64>() / c.len() as f64).collect();
    let w = 128usize; // 128 ms
    let hann: Vec<f64> = hann(w);
    let f2 = planner.plan_fft_forward(w);
    let mut depth = 0.0;
    let mut count = 0usize;
    let frames_per_ms = 1.0 / world::FRAME_MS;
    let mut start = 0;
    while start + w <= env.len() {
        let (a, b) = ((start as f64 * frames_per_ms) as usize, ((start + w) as f64 * frames_per_ms) as usize);
        if b <= f0.len() && f0[a..b].iter().all(|&v| v > 0.0) {
            let seg = &env[start..start + w];
            let mean = seg.iter().sum::<f64>() / w as f64;
            if mean > 1e-6 {
                let mut e: Vec<f64> = seg.iter().zip(&hann).map(|(v, h)| (v - mean) * h).collect();
                let mut s2 = f2.make_output_vec();
                f2.process(&mut e, &mut s2).unwrap();
                let p: f64 = s2
                    .iter()
                    .enumerate()
                    .filter(|(k, _)| (30.0..=120.0).contains(&(*k as f64 * 1000.0 / w as f64)))
                    .map(|(_, c)| c.norm_sqr())
                    .sum();
                // normalise by the window's mean level (Hann gain 0.5)
                depth += (2.0 * p.sqrt() / (0.5 * w as f64)) / mean;
                count += 1;
            }
        }
        start += w / 2;
    }
    if count == 0 {
        return -60.0;
    }
    20.0 * (depth / count as f64).max(1e-6).log10()
}

/// The vocal-tract scale between two recordings of the same words: the
/// factor `a` that best maps the long-term log envelope of `reference` onto
/// `x` (env_x(f) ≈ env_ref(f / a)), searched in 0.85–1.35.
pub fn formant_scale(reference: &[f32], x: &[f32], sr: u32) -> f64 {
    let ltas = |s: &[f32]| -> Vec<f64> {
        let d: Vec<f64> = s.iter().map(|&v| v as f64).collect();
        let a = world::analyse(&d, sr, None);
        let n = a.sp[0].len();
        let mut acc = vec![0.0; n];
        let mut cnt = 0;
        for (env, &f) in a.sp.iter().zip(&a.f0) {
            if f > 0.0 {
                for (o, v) in acc.iter_mut().zip(env) {
                    *o += v.max(1e-30).ln();
                }
                cnt += 1;
            }
        }
        acc.iter().map(|v| v / cnt.max(1) as f64).collect()
    };
    let r = ltas(reference);
    let y = ltas(x);
    let n = r.len();
    let bin = sr as f64 / 2.0 / (n - 1) as f64;
    let (k1, k2) = ((300.0 / bin) as usize, (5000.0 / bin) as usize);
    let mut best = (f64::MIN, 1.0);
    let mut a = 0.85;
    while a <= 1.35 {
        let warped: Vec<f64> = (k1..k2)
            .map(|k| {
                let src = k as f64 / a;
                let i = src.floor() as usize;
                let w = src - i as f64;
                r[i] * (1.0 - w) + r[(i + 1).min(n - 1)] * w
            })
            .collect();
        let yy = &y[k1..k2];
        let (mx, my) = (warped.iter().sum::<f64>() / warped.len() as f64, yy.iter().sum::<f64>() / yy.len() as f64);
        let mut num = 0.0;
        let mut dx = 0.0;
        let mut dy = 0.0;
        for (p, q) in warped.iter().zip(yy) {
            num += (p - mx) * (q - my);
            dx += (p - mx).powi(2);
            dy += (q - my).powi(2);
        }
        let corr = num / (dx.sqrt() * dy.sqrt() + 1e-12);
        if corr > best.0 {
            best = (corr, a);
        }
        a += 0.005;
    }
    best.1
}

/// Phoneme classes for the distortion check (French-specific sounds apart).
pub fn phoneme_class(c: char, next: Option<char>) -> &'static str {
    if next == Some('\u{303}') {
        return "nasal-vowel";
    }
    match c {
        'ʁ' => "ʁ",
        'y' | 'ø' | 'œ' => "front-rounded",
        'a' | 'e' | 'i' | 'o' | 'u' | 'ɛ' | 'ɔ' | 'ə' | 'ɑ' | 'æ' | 'ɪ' | 'ʊ' | 'ʌ' | 'ɜ' | 'A' | 'I' | 'O' | 'W'
        | 'Y' | 'ᵻ' => "oral-vowel",
        's' | 'z' | 'ʃ' | 'ʒ' | 'f' | 'v' | 'θ' | 'ð' | 'h' => "fricative",
        'p' | 'b' | 't' | 'd' | 'k' | 'ɡ' | 'ʧ' | 'ʤ' | 'T' => "plosive",
        'm' | 'n' | 'ɲ' | 'ŋ' | 'l' | 'j' | 'w' | 'ɥ' | 'ɹ' => "sonorant",
        _ => "other",
    }
}

/// Log mel spectrogram (40 bands 80–8000 Hz, 10 ms hop, 1024 window), per-frame
/// level removed (shape only).
pub fn mel_frames(x: &[f32], sr: u32) -> Vec<Vec<f64>> {
    let nfft = 1024;
    let hop = (sr / 100) as usize;
    let win = hann(nfft);
    let bins = nfft / 2 + 1;
    let mel = |f: f64| 2595.0 * (1.0 + f / 700.0).log10();
    let imel = |m: f64| 700.0 * (10f64.powf(m / 2595.0) - 1.0);
    let (m0, m1) = (mel(80.0), mel(8000.0));
    let nb = 40;
    let edges: Vec<f64> = (0..nb + 2).map(|i| imel(m0 + (m1 - m0) * i as f64 / (nb + 1) as f64)).collect();
    let bin_hz = sr as f64 / nfft as f64;
    let mut planner = RealFftPlanner::<f64>::new();
    let xd: Vec<f64> = x.iter().map(|&v| v as f64).collect();
    let mut out = Vec::new();
    let mut c = 0;
    while c < xd.len() {
        let p = frame_power(&xd, c, &win, nfft, &mut planner);
        let mut v: Vec<f64> = (0..nb)
            .map(|b| {
                let (lo, mid, hi) = (edges[b], edges[b + 1], edges[b + 2]);
                let mut s = 0.0;
                for (k, pk) in p.iter().enumerate().take(bins) {
                    let f = k as f64 * bin_hz;
                    let w = if f > lo && f <= mid {
                        (f - lo) / (mid - lo)
                    } else if f > mid && f < hi {
                        (hi - f) / (hi - mid)
                    } else {
                        0.0
                    };
                    s += w * pk;
                }
                10.0 * (s + 1e-12).log10()
            })
            .collect();
        let mean = v.iter().sum::<f64>() / nb as f64;
        for x in v.iter_mut() {
            *x -= mean;
        }
        out.push(v);
        c += hop;
    }
    out
}

/// Mean spectral-shape distance (dB) between two renders of the same
/// phonemes with the same durations, per phoneme class.
pub fn phoneme_distortion(
    reference: &[f32],
    x: &[f32],
    sr: u32,
    phones: &[char],
    edges: &[f64],
) -> Vec<(String, f64, usize)> {
    let a = mel_frames(reference, sr);
    let b = mel_frames(x, sr);
    let hop = (sr / 100) as f64;
    let mut acc: std::collections::BTreeMap<String, (f64, usize)> = Default::default();
    for (k, &c) in phones.iter().enumerate() {
        if k + 1 >= edges.len() || c == ' ' || c == 'ˈ' || c == 'ˌ' || c == '\u{303}' {
            continue;
        }
        let class = phoneme_class(c, phones.get(k + 1).copied()).to_string();
        let (s, e) = ((edges[k] / hop) as usize, (edges[k + 1] / hop) as usize);
        for f in s..e.min(a.len()).min(b.len()) {
            let d = (a[f].iter().zip(&b[f]).map(|(p, q)| (p - q).powi(2)).sum::<f64>() / a[f].len() as f64).sqrt();
            let e = acc.entry(class.clone()).or_default();
            e.0 += d;
            e.1 += 1;
        }
    }
    acc.into_iter().map(|(k, (s, n))| (k, s / n.max(1) as f64, n)).collect()
}
