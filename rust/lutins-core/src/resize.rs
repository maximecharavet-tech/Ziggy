//! High-quality image resampling.
//!
//! Separable convolution with an antialiased kernel, the method of Pillow and
//! of every serious image library: for a scale factor `s = src / dst > 1` the
//! kernel is stretched by `s` (its support grows from 3 to `3s` source pixels
//! for Lanczos-3), so every source pixel contributes and nothing aliases. The
//! weights of each output pixel are computed once per axis and normalised to 1.
//!
//! Large reductions first run an exact integer box reduction (each output pixel
//! the mean of a `k × k` block) so the Lanczos pass works on three to six
//! times the target size: the same idea as Pillow's `reducing_gap`, it makes a
//! 12 MP → 256 px downscale several times faster. The margin of 3 matters: the
//! box filter leaks a little energy near its Nyquist frequency, and a Lanczos
//! pass shrinking by ≥ 3 removes that leak (a gap of 2 left visible moiré on a
//! 1-px checkerboard in the tests).
//!
//! The arithmetic is `f32` with an 8-bit intermediate between the passes and
//! happens on the gamma-encoded values (like browsers and Pillow). Alpha is
//! filtered like the other channels (photos are opaque).

use crate::image::{RgbaImage, RgbaView};

/// Reconstruction filter.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Filter {
    /// Nearest-area average (support 0.5).
    Box,
    /// Bilinear tent (support 1).
    Triangle,
    /// Catmull-Rom cubic (Keys a = −0.5, support 2): sharp, little ringing;
    /// used for enlargements.
    CatmullRom,
    /// Lanczos windowed sinc, 3 lobes (support 3): the reference for
    /// reductions.
    Lanczos3,
}

impl Filter {
    fn support(self) -> f32 {
        match self {
            Filter::Box => 0.5,
            Filter::Triangle => 1.0,
            Filter::CatmullRom => 2.0,
            Filter::Lanczos3 => 3.0,
        }
    }

    fn eval(self, x: f32) -> f32 {
        let x = x.abs();
        match self {
            Filter::Box => {
                if x <= 0.5 {
                    1.0
                } else {
                    0.0
                }
            }
            Filter::Triangle => (1.0 - x).max(0.0),
            Filter::CatmullRom => {
                const A: f32 = -0.5;
                if x < 1.0 {
                    ((A + 2.0) * x - (A + 3.0)) * x * x + 1.0
                } else if x < 2.0 {
                    (((x - 5.0) * x + 8.0) * x - 4.0) * A
                } else {
                    0.0
                }
            }
            Filter::Lanczos3 => {
                if x < 3.0 {
                    sinc(x) * sinc(x / 3.0)
                } else {
                    0.0
                }
            }
        }
    }
}

#[inline]
fn sinc(x: f32) -> f32 {
    if x.abs() < 1e-6 {
        1.0
    } else {
        let px = std::f32::consts::PI * x;
        px.sin() / px
    }
}

/// Per-axis filter weights: output `i` reads `len[i]` source samples from
/// `start[i]`, with weights `w[i * taps ..]`.
struct Weights {
    start: Vec<usize>,
    len: Vec<usize>,
    taps: usize,
    w: Vec<f32>,
}

fn weights(src: usize, dst: usize, filter: Filter) -> Weights {
    let scale = src as f32 / dst as f32;
    let fscale = scale.max(1.0);
    let support = filter.support() * fscale;
    let taps = (support * 2.0).ceil() as usize + 2;
    let mut start = Vec::with_capacity(dst);
    let mut len = Vec::with_capacity(dst);
    let mut w = vec![0.0f32; dst * taps];
    for i in 0..dst {
        let center = (i as f32 + 0.5) * scale;
        let lo = ((center - support).floor().max(0.0)) as usize;
        let hi = ((center + support).ceil() as usize).min(src);
        let n = (hi - lo).min(taps);
        let row = &mut w[i * taps..i * taps + n];
        let mut sum = 0.0;
        for (k, wk) in row.iter_mut().enumerate() {
            let x = (lo + k) as f32 + 0.5 - center;
            *wk = filter.eval(x / fscale);
            sum += *wk;
        }
        if sum.abs() > 1e-8 {
            row.iter_mut().for_each(|v| *v /= sum);
        } else {
            // Degenerate (cannot happen with these kernels): nearest sample.
            row.iter_mut().for_each(|v| *v = 0.0);
            row[((center as usize).saturating_sub(lo)).min(n - 1)] = 1.0;
        }
        start.push(lo);
        len.push(n);
    }
    Weights { start, len, taps, w }
}

#[inline]
fn clamp8(v: f32) -> u8 {
    (v + 0.5).clamp(0.0, 255.0) as u8
}

/// Horizontal pass: `src` (sw × h) → (dw × h).
fn pass_h(src: &[u8], sw: usize, h: usize, dw: usize, filter: Filter) -> Vec<u8> {
    let wt = weights(sw, dw, filter);
    let mut out = vec![0u8; dw * h * 4];
    for y in 0..h {
        let srow = &src[y * sw * 4..(y + 1) * sw * 4];
        let orow = &mut out[y * dw * 4..(y + 1) * dw * 4];
        for x in 0..dw {
            let (s, n) = (wt.start[x], wt.len[x]);
            let ws = &wt.w[x * wt.taps..x * wt.taps + n];
            let (mut r, mut g, mut b, mut a) = (0.0f32, 0.0f32, 0.0f32, 0.0f32);
            for (p, &wk) in srow[s * 4..(s + n) * 4].chunks_exact(4).zip(ws) {
                r += wk * p[0] as f32;
                g += wk * p[1] as f32;
                b += wk * p[2] as f32;
                a += wk * p[3] as f32;
            }
            orow[x * 4] = clamp8(r);
            orow[x * 4 + 1] = clamp8(g);
            orow[x * 4 + 2] = clamp8(b);
            orow[x * 4 + 3] = clamp8(a);
        }
    }
    out
}

/// Vertical pass: `src` (w × sh) → (w × dh), accumulating whole rows (cache
/// friendly).
fn pass_v(src: &[u8], w: usize, sh: usize, dh: usize, filter: Filter) -> Vec<u8> {
    let wt = weights(sh, dh, filter);
    let rowlen = w * 4;
    let mut out = vec![0u8; dh * rowlen];
    let mut acc = vec![0.0f32; rowlen];
    for y in 0..dh {
        acc.iter_mut().for_each(|v| *v = 0.0);
        let (s, n) = (wt.start[y], wt.len[y]);
        for k in 0..n {
            let wk = wt.w[y * wt.taps + k];
            let srow = &src[(s + k) * rowlen..(s + k + 1) * rowlen];
            for (a, &p) in acc.iter_mut().zip(srow) {
                *a += wk * p as f32;
            }
        }
        for (o, &a) in out[y * rowlen..(y + 1) * rowlen].iter_mut().zip(acc.iter()) {
            *o = clamp8(a);
        }
    }
    out
}

/// Resizes with `filter` to exactly `dw × dh` (any aspect change allowed).
pub fn resize(src: RgbaView<'_>, dw: usize, dh: usize, filter: Filter) -> RgbaImage {
    let (dw, dh) = (dw.max(1), dh.max(1));
    if dw == src.w && dh == src.h {
        return RgbaImage { data: src.data.to_vec(), w: dw, h: dh };
    }
    // Run the pass that shrinks the most first: smaller intermediate, less work.
    let shrink_x = src.w as f32 / dw as f32;
    let shrink_y = src.h as f32 / dh as f32;
    let data = if shrink_x >= shrink_y {
        let tmp = pass_h(src.data, src.w, src.h, dw, filter);
        pass_v(&tmp, dw, src.h, dh, filter)
    } else {
        let tmp = pass_v(src.data, src.w, src.h, dh, filter);
        pass_h(&tmp, src.w, dh, dw, filter)
    };
    RgbaImage { data, w: dw, h: dh }
}

/// Exact `k × k` box reduction (the last partial block averages what exists).
pub fn box_reduce(src: RgbaView<'_>, k: usize) -> RgbaImage {
    let k = k.max(1);
    let dw = src.w.div_ceil(k);
    let dh = src.h.div_ceil(k);
    let mut out = RgbaImage::new(dw, dh);
    let mut sums = vec![0u32; dw * 4];
    let mut counts = vec![0u32; dw];
    for oy in 0..dh {
        sums.iter_mut().for_each(|v| *v = 0);
        counts.iter_mut().for_each(|v| *v = 0);
        for y in oy * k..((oy + 1) * k).min(src.h) {
            let row = &src.data[y * src.w * 4..(y + 1) * src.w * 4];
            for x in 0..src.w {
                let ox = x / k;
                let p = &row[x * 4..x * 4 + 4];
                let s = &mut sums[ox * 4..ox * 4 + 4];
                s[0] += p[0] as u32;
                s[1] += p[1] as u32;
                s[2] += p[2] as u32;
                s[3] += p[3] as u32;
                counts[ox] += 1;
            }
        }
        let orow = &mut out.data[oy * dw * 4..(oy + 1) * dw * 4];
        for ox in 0..dw {
            let c = counts[ox].max(1);
            for ch in 0..4 {
                orow[ox * 4 + ch] = ((sums[ox * 4 + ch] + c / 2) / c) as u8;
            }
        }
    }
    out
}

/// The best general-purpose resize: Lanczos-3 for reductions (after an exact
/// box pre-reduction when the factor is 6 or more), Catmull-Rom for
/// enlargements.
pub fn resize_hq(src: RgbaView<'_>, dw: usize, dh: usize) -> RgbaImage {
    let (dw, dh) = (dw.max(1), dh.max(1));
    let factor = (src.w as f32 / dw as f32).min(src.h as f32 / dh as f32);
    if factor <= 1.0 {
        return resize(src, dw, dh, Filter::CatmullRom);
    }
    let k = (factor / 3.0).floor() as usize;
    if k >= 2 {
        let pre = box_reduce(src, k);
        return resize(pre.view(), dw, dh, Filter::Lanczos3);
    }
    resize(src, dw, dh, Filter::Lanczos3)
}

/// The size that fits in `max_side × max_side`, keeping the aspect ratio and
/// never enlarging.
pub fn fit_within(w: usize, h: usize, max_side: usize) -> (usize, usize) {
    let max_side = max_side.max(1);
    let long = w.max(h);
    if long <= max_side {
        return (w, h);
    }
    let s = max_side as f64 / long as f64;
    (((w as f64 * s).round() as usize).max(1), ((h as f64 * s).round() as usize).max(1))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn img(w: usize, h: usize, f: impl Fn(usize, usize) -> [u8; 4]) -> RgbaImage {
        let mut im = RgbaImage::new(w, h);
        for y in 0..h {
            for x in 0..w {
                im.set(x, y, f(x, y));
            }
        }
        im
    }

    #[test]
    fn flat_colour_stays_flat_for_every_filter() {
        let src = img(37, 23, |_, _| [200, 100, 50, 255]);
        for f in [Filter::Box, Filter::Triangle, Filter::CatmullRom, Filter::Lanczos3] {
            for (dw, dh) in [(10, 7), (80, 40), (37, 5)] {
                let out = resize(src.view(), dw, dh, f);
                assert_eq!((out.w, out.h), (dw, dh));
                assert!(out.data.chunks(4).all(|p| p == [200, 100, 50, 255]), "{f:?} {dw}x{dh}");
            }
        }
    }

    #[test]
    fn downscale_averages_fine_detail_without_aliasing() {
        // 1-px checkerboard → mid grey (an unfiltered sampler gives black or white).
        let src = img(256, 256, |x, y| if (x + y) % 2 == 0 { [255; 4] } else { [0, 0, 0, 255] });
        let out = resize_hq(src.view(), 37, 37);
        for p in out.data.chunks(4) {
            assert!((p[0] as i32 - 128).abs() <= 3, "{}", p[0]);
        }
    }

    #[test]
    fn box_reduce_exact() {
        let src = img(5, 3, |x, _| [(x * 50) as u8, 0, 0, 255]);
        let out = box_reduce(src.view(), 2);
        assert_eq!((out.w, out.h), (3, 2));
        assert_eq!(out.data[0], 25); // mean of 0, 50
        assert_eq!(out.data[8], 200); // partial block: x = 4 only
    }

    #[test]
    fn gradient_is_preserved() {
        let src = img(400, 10, |x, _| [(x * 255 / 399) as u8, 0, 0, 255]);
        let out = resize_hq(src.view(), 100, 10);
        let row: Vec<u8> = out.data.chunks(4).take(100).map(|p| p[0]).collect();
        assert!(row.windows(2).all(|w| w[1] >= w[0]), "monotonic");
        assert!((row[50] as i32 - 128).abs() <= 3, "{}", row[50]);
    }

    #[test]
    fn fit_within_keeps_aspect() {
        assert_eq!(fit_within(4000, 3000, 1536), (1536, 1152));
        assert_eq!(fit_within(300, 200, 1536), (300, 200));
        assert_eq!(fit_within(10_000, 1, 256), (256, 1));
    }
}
