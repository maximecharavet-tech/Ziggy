//! Small image filters on `f32` planes and summed-area tables.
//!
//! All kernels replicate the border pixel (no dark frame around the image).

use crate::image::Plane;

/// Separable box blur of radius `r` (window `2r + 1`) in O(1) per pixel with
/// running sums. Two passes approximate a Gaussian of σ ≈ r·0.8.
pub fn box_blur(p: &Plane, r: usize) -> Plane {
    if r == 0 {
        return p.clone();
    }
    let (w, h) = (p.w, p.h);
    let win = (2 * r + 1) as f32;
    let mut tmp = Plane::new(w, h);
    // Horizontal.
    for y in 0..h {
        let row = &p.data[y * w..(y + 1) * w];
        let at = |x: isize| row[x.clamp(0, w as isize - 1) as usize];
        let mut s: f32 = (-(r as isize)..=r as isize).map(at).sum();
        for x in 0..w {
            tmp.data[y * w + x] = s / win;
            s += at(x as isize + r as isize + 1) - at(x as isize - r as isize);
        }
    }
    // Vertical.
    let mut out = Plane::new(w, h);
    for x in 0..w {
        let at = |y: isize| tmp.data[y.clamp(0, h as isize - 1) as usize * w + x];
        let mut s: f32 = (-(r as isize)..=r as isize).map(at).sum();
        for y in 0..h {
            out.data[y * w + x] = s / win;
            s += at(y as isize + r as isize + 1) - at(y as isize - r as isize);
        }
    }
    out
}

/// Binomial 5-tap blur `[1 4 6 4 1] / 16` (≈ Gaussian σ = 1).
pub fn blur5(p: &Plane) -> Plane {
    const K: [f32; 5] = [1.0 / 16.0, 4.0 / 16.0, 6.0 / 16.0, 4.0 / 16.0, 1.0 / 16.0];
    let (w, h) = (p.w, p.h);
    let mut tmp = Plane::new(w, h);
    for y in 0..h {
        for x in 0..w {
            let mut s = 0.0;
            for (k, kv) in K.iter().enumerate() {
                s += kv * p.get_clamped(x as isize + k as isize - 2, y as isize);
            }
            tmp.data[y * w + x] = s;
        }
    }
    let mut out = Plane::new(w, h);
    for y in 0..h {
        for x in 0..w {
            let mut s = 0.0;
            for (k, kv) in K.iter().enumerate() {
                s += kv * tmp.get_clamped(x as isize, y as isize + k as isize - 2);
            }
            out.data[y * w + x] = s;
        }
    }
    out
}

/// Sobel gradients `(gx, gy)`, divided by 4 so that a unit step edge has a
/// magnitude of 1. `gx > 0`: brighter to the right; `gy > 0`: brighter below.
pub fn sobel(p: &Plane) -> (Plane, Plane) {
    let (w, h) = (p.w, p.h);
    let mut gx = Plane::new(w, h);
    let mut gy = Plane::new(w, h);
    for y in 0..h as isize {
        for x in 0..w as isize {
            let v = |dx: isize, dy: isize| p.get_clamped(x + dx, y + dy);
            let sx = (v(1, -1) + 2.0 * v(1, 0) + v(1, 1)) - (v(-1, -1) + 2.0 * v(-1, 0) + v(-1, 1));
            let sy = (v(-1, 1) + 2.0 * v(0, 1) + v(1, 1)) - (v(-1, -1) + 2.0 * v(0, -1) + v(1, -1));
            let i = y as usize * w + x as usize;
            gx.data[i] = sx / 4.0;
            gy.data[i] = sy / 4.0;
        }
    }
    (gx, gy)
}

/// Gradient magnitude of a Sobel pair.
pub fn magnitude(gx: &Plane, gy: &Plane) -> Plane {
    Plane {
        data: gx.data.iter().zip(&gy.data).map(|(a, b)| (a * a + b * b).sqrt()).collect(),
        w: gx.w,
        h: gx.h,
    }
}

/// Variance of the 4-neighbour Laplacian over the interior pixels: the
/// classic focus measure (Pech-Pacheco et al. 2000). Sharp images have strong
/// second derivatives, so a high variance; blur flattens them. The plane is
/// expected in 0–255 units.
pub fn laplacian_variance(p: &Plane) -> f32 {
    if p.w < 3 || p.h < 3 {
        return 0.0;
    }
    let (mut s, mut s2, mut n) = (0.0f64, 0.0f64, 0.0f64);
    for y in 1..p.h - 1 {
        for x in 1..p.w - 1 {
            let l = (p.get(x - 1, y) + p.get(x + 1, y) + p.get(x, y - 1) + p.get(x, y + 1) - 4.0 * p.get(x, y)) as f64;
            s += l;
            s2 += l * l;
            n += 1.0;
        }
    }
    let m = s / n;
    (s2 / n - m * m).max(0.0) as f32
}

/// Summed-area table (integral image): the sum over any rectangle in four
/// lookups, so sliding-window statistics cost O(1) per window.
#[derive(Clone, Debug)]
pub struct Integral {
    w: usize,
    h: usize,
    /// `(w + 1) × (h + 1)`, row 0 and column 0 are zero.
    t: Vec<f64>,
}

impl Integral {
    pub fn new(p: &Plane) -> Self {
        let (w, h) = (p.w, p.h);
        let mut t = vec![0.0f64; (w + 1) * (h + 1)];
        for y in 0..h {
            let mut row = 0.0f64;
            for x in 0..w {
                row += p.data[y * w + x] as f64;
                t[(y + 1) * (w + 1) + x + 1] = t[y * (w + 1) + x + 1] + row;
            }
        }
        Integral { w, h, t }
    }

    /// Sum over `[x0, x1) × [y0, y1)` (clamped to the image).
    pub fn sum(&self, x0: usize, y0: usize, x1: usize, y1: usize) -> f64 {
        let (x1, y1) = (x1.min(self.w), y1.min(self.h));
        if x0 >= x1 || y0 >= y1 {
            return 0.0;
        }
        let s = self.w + 1;
        self.t[y1 * s + x1] - self.t[y0 * s + x1] - self.t[y1 * s + x0] + self.t[y0 * s + x0]
    }

    /// Mean over `[x0, x1) × [y0, y1)`.
    pub fn mean(&self, x0: usize, y0: usize, x1: usize, y1: usize) -> f64 {
        let (x1c, y1c) = (x1.min(self.w), y1.min(self.h));
        let n = (x1c.saturating_sub(x0) * y1c.saturating_sub(y0)) as f64;
        if n == 0.0 {
            0.0
        } else {
            self.sum(x0, y0, x1, y1) / n
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn box_blur_preserves_mean_and_flattens() {
        let p = Plane::from_fn(30, 20, |x, y| ((x * 7 + y * 13) % 5) as f32);
        let b = box_blur(&p, 3);
        assert!((b.mean() - p.mean()).abs() < 0.15);
        assert!(b.std() < p.std() * 0.5);
        let flat = Plane::from_fn(9, 9, |_, _| 0.7);
        assert!(box_blur(&flat, 4).data.iter().all(|v| (v - 0.7).abs() < 1e-5));
        assert!(blur5(&flat).data.iter().all(|v| (v - 0.7).abs() < 1e-5));
    }

    #[test]
    fn sobel_unit_step() {
        let p = Plane::from_fn(10, 10, |x, _| if x >= 5 { 1.0 } else { 0.0 });
        let (gx, gy) = sobel(&p);
        assert!((gx.get(4, 5) - 0.5).abs() < 1e-6 && (gx.get(5, 5) - 0.5).abs() < 1e-6);
        assert!(gy.data.iter().all(|v| v.abs() < 1e-6));
        let ramp = Plane::from_fn(10, 10, |x, _| x as f32);
        let (gx, _) = sobel(&ramp);
        assert!((gx.get(5, 5) - 2.0).abs() < 1e-5); // (x+1) − (x−1) = 2
    }

    #[test]
    fn laplacian_variance_detects_blur() {
        let sharp = Plane::from_fn(64, 64, |x, y| if (x / 4 + y / 4) % 2 == 0 { 255.0 } else { 0.0 });
        let soft = box_blur(&box_blur(&sharp, 2), 2);
        assert!(laplacian_variance(&sharp) > 10.0 * laplacian_variance(&soft));
    }

    #[test]
    fn integral_sums() {
        let p = Plane::from_fn(5, 4, |x, y| (x + 10 * y) as f32);
        let ii = Integral::new(&p);
        let mut brute = 0.0;
        for y in 1..3 {
            for x in 2..5 {
                brute += p.get(x, y) as f64;
            }
        }
        assert_eq!(ii.sum(2, 1, 5, 3), brute);
        assert_eq!(ii.sum(0, 0, 99, 99), p.data.iter().map(|&v| v as f64).sum::<f64>());
        assert_eq!(ii.mean(3, 3, 3, 4), 0.0);
    }
}
