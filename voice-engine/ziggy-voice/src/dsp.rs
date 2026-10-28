//! Small DSP toolbox for the mastering chain: RBJ biquads, a one-pole
//! smoother, FFT convolution, a deterministic noise source.

use realfft::RealFftPlanner;
use std::f64::consts::PI;

/// A biquad in transposed direct form II (RBJ "Audio EQ Cookbook").
#[derive(Clone, Copy, Debug)]
pub struct Biquad {
    b0: f64,
    b1: f64,
    b2: f64,
    a1: f64,
    a2: f64,
    z1: f64,
    z2: f64,
}

#[derive(Clone, Copy, Debug)]
pub enum Kind {
    LowPass,
    HighPass,
    BandPass,
    Peak(f64),
    LowShelf(f64),
    HighShelf(f64),
}

impl Biquad {
    pub fn new(kind: Kind, sr: f64, f0: f64, q: f64) -> Self {
        let w0 = 2.0 * PI * f0 / sr;
        let (s, c) = (w0.sin(), w0.cos());
        let alpha = s / (2.0 * q);
        let (b0, b1, b2, a0, a1, a2) = match kind {
            Kind::LowPass => ((1.0 - c) / 2.0, 1.0 - c, (1.0 - c) / 2.0, 1.0 + alpha, -2.0 * c, 1.0 - alpha),
            Kind::HighPass => ((1.0 + c) / 2.0, -(1.0 + c), (1.0 + c) / 2.0, 1.0 + alpha, -2.0 * c, 1.0 - alpha),
            Kind::BandPass => (alpha, 0.0, -alpha, 1.0 + alpha, -2.0 * c, 1.0 - alpha),
            Kind::Peak(db) => {
                let a = 10f64.powf(db / 40.0);
                (1.0 + alpha * a, -2.0 * c, 1.0 - alpha * a, 1.0 + alpha / a, -2.0 * c, 1.0 - alpha / a)
            }
            Kind::LowShelf(db) | Kind::HighShelf(db) => {
                let a = 10f64.powf(db / 40.0);
                let al = s / 2.0 * 2f64.sqrt(); // shelf slope S = 1
                let k = 2.0 * a.sqrt() * al;
                if matches!(kind, Kind::LowShelf(_)) {
                    (
                        a * ((a + 1.0) - (a - 1.0) * c + k),
                        2.0 * a * ((a - 1.0) - (a + 1.0) * c),
                        a * ((a + 1.0) - (a - 1.0) * c - k),
                        (a + 1.0) + (a - 1.0) * c + k,
                        -2.0 * ((a - 1.0) + (a + 1.0) * c),
                        (a + 1.0) + (a - 1.0) * c - k,
                    )
                } else {
                    (
                        a * ((a + 1.0) + (a - 1.0) * c + k),
                        -2.0 * a * ((a - 1.0) + (a + 1.0) * c),
                        a * ((a + 1.0) + (a - 1.0) * c - k),
                        (a + 1.0) - (a - 1.0) * c + k,
                        2.0 * ((a - 1.0) - (a + 1.0) * c),
                        (a + 1.0) - (a - 1.0) * c - k,
                    )
                }
            }
        };
        Self { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0, z1: 0.0, z2: 0.0 }
    }

    #[inline]
    pub fn run(&mut self, x: f64) -> f64 {
        let y = self.b0 * x + self.z1;
        self.z1 = self.b1 * x - self.a1 * y + self.z2;
        self.z2 = self.b2 * x - self.a2 * y;
        y
    }

    pub fn process(&mut self, x: &mut [f64]) {
        for v in x.iter_mut() {
            *v = self.run(*v);
        }
    }

    /// |H(f)| in dB.
    pub fn response_db(&self, sr: f64, f: f64) -> f64 {
        let w = 2.0 * PI * f / sr;
        let (c1, s1, c2, s2) = (w.cos(), w.sin(), (2.0 * w).cos(), (2.0 * w).sin());
        let nr = self.b0 + self.b1 * c1 + self.b2 * c2;
        let ni = -(self.b1 * s1 + self.b2 * s2);
        let dr = 1.0 + self.a1 * c1 + self.a2 * c2;
        let di = -(self.a1 * s1 + self.a2 * s2);
        10.0 * ((nr * nr + ni * ni) / (dr * dr + di * di)).log10()
    }
}

/// 4th-order Butterworth high-pass (two biquads).
pub fn highpass4(x: &mut [f64], sr: f64, f0: f64) {
    for q in [0.541_196_1, 1.306_563] {
        Biquad::new(Kind::HighPass, sr, f0, q).process(x);
    }
}

/// One-pole coefficient for a time constant in ms.
pub fn coef(ms: f64, sr: f64) -> f64 {
    (-1.0 / (ms * 0.001 * sr)).exp()
}

/// Full linear convolution by FFT (`ir` is short compared to `x`).
pub fn convolve(x: &[f64], ir: &[f64]) -> Vec<f64> {
    let n = (x.len() + ir.len()).next_power_of_two();
    let mut planner = RealFftPlanner::<f64>::new();
    let fwd = planner.plan_fft_forward(n);
    let inv = planner.plan_fft_inverse(n);
    let mut a = x.to_vec();
    a.resize(n, 0.0);
    let mut b = ir.to_vec();
    b.resize(n, 0.0);
    let mut fa = fwd.make_output_vec();
    let mut fb = fwd.make_output_vec();
    fwd.process(&mut a, &mut fa).unwrap();
    fwd.process(&mut b, &mut fb).unwrap();
    for (p, q) in fa.iter_mut().zip(&fb) {
        *p *= q;
    }
    let mut out = inv.make_output_vec();
    inv.process(&mut fa, &mut out).unwrap();
    out.truncate(x.len() + ir.len() - 1);
    for v in out.iter_mut() {
        *v /= n as f64;
    }
    out
}

/// xorshift64*: reproducible noise (the same room every run).
pub struct Noise(u64);
impl Noise {
    pub fn new(seed: u64) -> Self {
        Self(seed.max(1))
    }
    /// Uniform in [-1, 1).
    pub fn sample(&mut self) -> f64 {
        self.0 ^= self.0 >> 12;
        self.0 ^= self.0 << 25;
        self.0 ^= self.0 >> 27;
        let v = self.0.wrapping_mul(0x2545_f491_4f6c_dd1d);
        (v >> 11) as f64 / (1u64 << 52) as f64 - 1.0
    }
}

pub fn db_to_lin(db: f64) -> f64 {
    10f64.powf(db / 20.0)
}

pub fn lin_to_db(v: f64) -> f64 {
    20.0 * v.max(1e-12).log10()
}

/// Raised-cosine fades at both ends.
pub fn fade(x: &mut [f64], n_in: usize, n_out: usize) {
    let len = x.len();
    for (i, v) in x.iter_mut().enumerate().take(n_in.min(len)) {
        *v *= 0.5 - 0.5 * (PI * i as f64 / n_in as f64).cos();
    }
    for (i, v) in x.iter_mut().rev().enumerate().take(n_out.min(len)) {
        *v *= 0.5 - 0.5 * (PI * i as f64 / n_out as f64).cos();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rbj_responses() {
        let sr = 24_000.0;
        let lp = Biquad::new(Kind::LowPass, sr, 1000.0, std::f64::consts::FRAC_1_SQRT_2);
        assert!((lp.response_db(sr, 1000.0) + 3.01).abs() < 0.1);
        assert!(lp.response_db(sr, 100.0).abs() < 0.1);
        assert!(lp.response_db(sr, 8000.0) < -30.0);
        let hp = Biquad::new(Kind::HighPass, sr, 70.0, std::f64::consts::FRAC_1_SQRT_2);
        assert!((hp.response_db(sr, 70.0) + 3.01).abs() < 0.1);
        assert!(hp.response_db(sr, 1000.0).abs() < 0.05);
        let pk = Biquad::new(Kind::Peak(1.5), sr, 220.0, 0.8);
        assert!((pk.response_db(sr, 220.0) - 1.5).abs() < 0.05);
        assert!(pk.response_db(sr, 5000.0).abs() < 0.1);
        let hs = Biquad::new(Kind::HighShelf(-2.0), sr, 6500.0, 0.707);
        assert!((hs.response_db(sr, 11_500.0) + 2.0).abs() < 0.2);
        assert!(hs.response_db(sr, 500.0).abs() < 0.05);
        let ls = Biquad::new(Kind::LowShelf(3.0), sr, 200.0, 0.707);
        assert!((ls.response_db(sr, 30.0) - 3.0).abs() < 0.2);
    }

    #[test]
    fn biquad_filters_a_tone() {
        let sr = 24_000.0;
        let mut x: Vec<f64> = (0..24_000).map(|i| (2.0 * PI * 40.0 * i as f64 / sr).sin()).collect();
        highpass4(&mut x, sr, 70.0);
        let rms = (x[12_000..].iter().map(|v| v * v).sum::<f64>() / 12_000.0).sqrt();
        assert!(lin_to_db(rms * 2f64.sqrt()) < -15.0, "40 Hz rumble is removed");
    }

    #[test]
    fn convolution_matches_direct() {
        let x = [1.0, 2.0, 3.0];
        let h = [0.5, -1.0];
        let y = convolve(&x, &h);
        let want = [0.5, 0.0, -0.5, -3.0];
        for (a, b) in y.iter().zip(want) {
            assert!((a - b).abs() < 1e-9);
        }
    }

    #[test]
    fn noise_is_reproducible_and_bounded() {
        let mut a = Noise::new(7);
        let mut b = Noise::new(7);
        for _ in 0..1000 {
            let v = a.sample();
            assert_eq!(v, b.sample());
            assert!((-1.0..1.0).contains(&v));
        }
    }
}
