//! Global alignment of the generated picture on the original photo.
//!
//! Image-edit models often shift or slightly re-crop the picture. Comparing
//! without alignment would reject good results, so the verifier first finds
//! the zoom `s` and translation `d` that best map the generated image onto the
//! original (`aligned(x) = generated(c + s·(x + d − c))`, `c` the centre).
//!
//! **Phase correlation** (Kuglin & Hines 1975): with `F`, `G` the Fourier
//! transforms of the two (Hann-windowed, mean-removed) luminance images, the
//! inverse transform of the normalised cross-power spectrum
//! `F·conj(G) / |F·conj(G)|` is a sharp peak at the translation between them;
//! a parabola through the peak and its neighbours gives sub-pixel precision.
//! The peak height (0–1) says how much of the two images agree. Zoom is found
//! by trying a few scales ([`SCALES`]) and keeping the strongest peak (scale 1
//! wins unless another is clearly better).
//!
//! The FFT is a plain iterative radix-2 Cooley-Tukey on power-of-two sizes
//! (the working images are at most 256 px), so no dependency is needed.

use crate::image::Plane;
use std::f32::consts::PI;

/// Zooms tried, in order of preference.
pub const SCALES: [f32; 5] = [1.0, 0.96, 1.04, 0.92, 1.08];
/// Another scale must beat scale 1's peak by this factor to win.
const SCALE_MARGIN: f32 = 1.15;

/// In-place complex FFT of length `re.len()` (a power of two). `inverse`
/// computes the unnormalised inverse.
pub fn fft(re: &mut [f32], im: &mut [f32], inverse: bool) {
    let n = re.len();
    debug_assert!(n.is_power_of_two() && im.len() == n);
    // Bit reversal.
    let mut j = 0;
    for i in 1..n {
        let mut bit = n >> 1;
        while j & bit != 0 {
            j ^= bit;
            bit >>= 1;
        }
        j |= bit;
        if i < j {
            re.swap(i, j);
            im.swap(i, j);
        }
    }
    let sign = if inverse { 1.0 } else { -1.0 };
    let mut len = 2;
    while len <= n {
        let ang = sign * 2.0 * PI / len as f32;
        let (wr, wi) = (ang.cos(), ang.sin());
        for start in (0..n).step_by(len) {
            let (mut cr, mut ci) = (1.0f32, 0.0f32);
            for k in 0..len / 2 {
                let (a, b) = (start + k, start + k + len / 2);
                let tr = re[b] * cr - im[b] * ci;
                let ti = re[b] * ci + im[b] * cr;
                re[b] = re[a] - tr;
                im[b] = im[a] - ti;
                re[a] += tr;
                im[a] += ti;
                let ncr = cr * wr - ci * wi;
                ci = cr * wi + ci * wr;
                cr = ncr;
            }
        }
        len <<= 1;
    }
}

/// 2-D FFT of an `n × n` row-major complex image.
pub fn fft2(re: &mut [f32], im: &mut [f32], n: usize, inverse: bool) {
    for r in 0..n {
        fft(&mut re[r * n..(r + 1) * n], &mut im[r * n..(r + 1) * n], inverse);
    }
    let (mut cr, mut ci) = (vec![0.0f32; n], vec![0.0f32; n]);
    for c in 0..n {
        for r in 0..n {
            cr[r] = re[r * n + c];
            ci[r] = im[r * n + c];
        }
        fft(&mut cr, &mut ci, inverse);
        for r in 0..n {
            re[r * n + c] = cr[r];
            im[r * n + c] = ci[r];
        }
    }
}

/// The alignment found.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Alignment {
    /// Translation in pixels of the working images.
    pub dx: f32,
    pub dy: f32,
    pub scale: f32,
    /// Phase-correlation peak, 0 (no agreement) – 1 (identical).
    pub peak: f32,
}

impl Alignment {
    pub const IDENTITY: Alignment = Alignment { dx: 0.0, dy: 0.0, scale: 1.0, peak: 1.0 };
}

/// Windowed, mean-removed spectrum of a plane padded to `n × n`.
fn spectrum(p: &Plane, n: usize) -> (Vec<f32>, Vec<f32>) {
    let mean = p.mean();
    let mut re = vec![0.0f32; n * n];
    let im = vec![0.0f32; n * n];
    let hann = |i: usize, len: usize| 0.5 - 0.5 * (2.0 * PI * (i as f32 + 0.5) / len as f32).cos();
    let wx: Vec<f32> = (0..p.w).map(|x| hann(x, p.w)).collect();
    for y in 0..p.h {
        let wy = hann(y, p.h);
        for x in 0..p.w {
            re[y * n + x] = (p.get(x, y) - mean) * wx[x] * wy;
        }
    }
    let mut im = im;
    fft2(&mut re, &mut im, n, false);
    (re, im)
}

/// Translation `(dx, dy, peak)` such that `moving(x + d) ≈ reference(x)`.
fn correlate(fr: &(Vec<f32>, Vec<f32>), moving: &Plane, n: usize) -> (f32, f32, f32) {
    let (gr, gi) = spectrum(moving, n);
    let (mut re, mut im) = (vec![0.0f32; n * n], vec![0.0f32; n * n]);
    for i in 0..n * n {
        // F · conj(G)
        let r = fr.0[i] * gr[i] + fr.1[i] * gi[i];
        let m = fr.1[i] * gr[i] - fr.0[i] * gi[i];
        let mag = (r * r + m * m).sqrt();
        if mag > 1e-12 {
            re[i] = r / mag;
            im[i] = m / mag;
        }
    }
    fft2(&mut re, &mut im, n, true);
    let norm = (n * n) as f32;
    let (mut best, mut bi) = (f32::MIN, 0usize);
    for (i, &v) in re.iter().enumerate() {
        if v > best {
            best = v;
            bi = i;
        }
    }
    let (px, py) = (bi % n, bi / n);
    let at = |x: usize, y: usize| re[(y % n) * n + (x % n)];
    let sub = |m: f32, c: f32, p: f32| {
        let d = m - 2.0 * c + p;
        if d.abs() < 1e-12 {
            0.0
        } else {
            (0.5 * (m - p) / d).clamp(-0.5, 0.5)
        }
    };
    let fx = px as f32 + sub(at(px + n - 1, py), at(px, py), at(px + 1, py));
    let fy = py as f32 + sub(at(px, py + n - 1), at(px, py), at(px, py + 1));
    // Peak at p ⇔ moving is reference shifted by −p (cyclic).
    let wrap = |v: f32| if v > n as f32 / 2.0 { v - n as f32 } else { v };
    (-wrap(fx), -wrap(fy), best / norm)
}

/// Bilinear sample with a validity flag (outside the image → invalid).
#[inline]
pub fn sample_bilinear(p: &Plane, x: f32, y: f32) -> Option<f32> {
    if x < -0.5 || y < -0.5 || x > p.w as f32 - 0.5 || y > p.h as f32 - 0.5 {
        return None;
    }
    let x = x.clamp(0.0, (p.w - 1) as f32);
    let y = y.clamp(0.0, (p.h - 1) as f32);
    let (x0, y0) = (x.floor() as usize, y.floor() as usize);
    let (x1, y1) = ((x0 + 1).min(p.w - 1), (y0 + 1).min(p.h - 1));
    let (fx, fy) = (x - x0 as f32, y - y0 as f32);
    let top = p.get(x0, y0) * (1.0 - fx) + p.get(x1, y0) * fx;
    let bot = p.get(x0, y1) * (1.0 - fx) + p.get(x1, y1) * fx;
    Some(top * (1.0 - fy) + bot * fy)
}

/// Source coordinates in the moving image of output pixel `(x, y)`.
#[inline]
pub fn map_point(a: &Alignment, w: usize, h: usize, x: f32, y: f32) -> (f32, f32) {
    let (cx, cy) = ((w as f32 - 1.0) / 2.0, (h as f32 - 1.0) / 2.0);
    (cx + a.scale * (x + a.dx - cx), cy + a.scale * (y + a.dy - cy))
}

/// Resamples `moving` with zoom `s` about the centre (no translation).
fn zoom(moving: &Plane, s: f32) -> Plane {
    let a = Alignment { dx: 0.0, dy: 0.0, scale: s, peak: 0.0 };
    let mean = moving.mean();
    Plane::from_fn(moving.w, moving.h, |x, y| {
        let (sx, sy) = map_point(&a, moving.w, moving.h, x as f32, y as f32);
        sample_bilinear(moving, sx, sy).unwrap_or(mean)
    })
}

/// Finds the zoom and translation mapping `moving` onto `reference` (planes
/// of the same size, at most 512 px).
pub fn estimate(reference: &Plane, moving: &Plane) -> Alignment {
    debug_assert_eq!((reference.w, reference.h), (moving.w, moving.h));
    let n = reference.w.max(reference.h).next_power_of_two();
    let fr = spectrum(reference, n);
    let mut best: Option<Alignment> = None;
    for (k, &s) in SCALES.iter().enumerate() {
        let m = if s == 1.0 { moving.clone() } else { zoom(moving, s) };
        let (dx, dy, peak) = correlate(&fr, &m, n);
        // A translation of the zoomed image, expressed in the moving image.
        let cand = Alignment { dx, dy, scale: s, peak };
        best = match best {
            None => Some(cand),
            Some(b) => {
                let margin = if b.scale == 1.0 { SCALE_MARGIN } else { 1.0 };
                if cand.peak > b.peak * margin {
                    Some(cand)
                } else {
                    Some(b)
                }
            }
        };
        // Strong agreement at scale 1: no need to try zooms.
        if k == 0 && peak > 0.3 {
            break;
        }
    }
    best.unwrap_or(Alignment::IDENTITY)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scene(w: usize, h: usize, ox: f32, oy: f32) -> Plane {
        Plane::from_fn(w, h, |x, y| {
            let (x, y) = (x as f32 - ox, y as f32 - oy);
            let blob = |cx: f32, cy: f32, r: f32| (-((x - cx).powi(2) + (y - cy).powi(2)) / (2.0 * r * r)).exp();
            0.2 + 0.5 * blob(60.0, 40.0, 9.0)
                + 0.4 * blob(150.0, 90.0, 14.0)
                + 0.3 * blob(100.0, 120.0, 6.0)
                + if (x as i32 / 23 + y as i32 / 17) % 2 == 0 { 0.1 } else { 0.0 }
        })
    }

    #[test]
    fn fft_round_trip_and_impulse() {
        let mut re: Vec<f32> = (0..16).map(|i| (i as f32 * 0.7).sin()).collect();
        let orig = re.clone();
        let mut im = vec![0.0; 16];
        fft(&mut re, &mut im, false);
        fft(&mut re, &mut im, true);
        for (a, b) in re.iter().zip(&orig) {
            assert!((a / 16.0 - b).abs() < 1e-5);
        }
        let mut re = vec![0.0f32; 8];
        re[0] = 1.0;
        let mut im = vec![0.0f32; 8];
        fft(&mut re, &mut im, false);
        assert!(re.iter().all(|v| (v - 1.0).abs() < 1e-6) && im.iter().all(|v| v.abs() < 1e-6));
    }

    #[test]
    fn identical_images_align_at_identity() {
        let a = scene(200, 150, 0.0, 0.0);
        let al = estimate(&a, &a);
        assert!(al.dx.abs() < 0.05 && al.dy.abs() < 0.05 && al.scale == 1.0, "{al:?}");
        assert!(al.peak > 0.9, "{al:?}");
    }

    #[test]
    fn recovers_a_translation() {
        let a = scene(200, 150, 0.0, 0.0);
        // The generated picture shows the scene moved right by 7 and up by 4.
        let b = scene(200, 150, 7.0, -4.0);
        let al = estimate(&a, &b);
        assert!((al.dx - 7.0).abs() < 0.6 && (al.dy + 4.0).abs() < 0.6, "{al:?}");
        // Check the convention: aligned(x) = moving(map(x)) ≈ reference(x).
        let (sx, sy) = map_point(&al, 200, 150, 60.0, 40.0);
        assert!((sx - 67.0).abs() < 0.6 && (sy - 36.0).abs() < 0.6);
    }

    #[test]
    fn recovers_a_zoom() {
        let a = scene(200, 150, 0.0, 0.0);
        // Generated = reference zoomed in by 4 % about the centre.
        let al0 = Alignment { dx: 0.0, dy: 0.0, scale: 1.0 / 1.04, peak: 0.0 };
        let b = Plane::from_fn(200, 150, |x, y| {
            let (sx, sy) = map_point(&al0, 200, 150, x as f32, y as f32);
            sample_bilinear(&a, sx, sy).unwrap_or(0.2)
        });
        let al = estimate(&a, &b);
        assert_eq!(al.scale, 1.04, "{al:?}");
        assert!(al.dx.abs() < 1.0 && al.dy.abs() < 1.0, "{al:?}");
    }
}
