//! Photo preparation before upload: high-quality downscale and an optional
//! *mild* automatic white balance and levels.
//!
//! - **Downscale**: [`crate::resize::resize_hq`] (exact box pre-reduction +
//!   Lanczos-3), never enlarging.
//! - **White balance** (only with `auto_fix`): the shades-of-grey illuminant
//!   ([`crate::analysis::temperature::illuminant`]) gives per-channel gains in
//!   linear light; only [`WB_STRENGTH`] of the correction is applied and each
//!   gain is clamped to [`WB_MIN`, `WB_MAX`], so a cosy lamp-lit room stays
//!   warm (the prompt matches that light on purpose) while a strong cast from
//!   a cheap bulb or a blue screen is tempered.
//! - **Levels**: the 0.5 % and 99.5 % luma percentiles become the black and
//!   white points, again only partly ([`LEVELS_STRENGTH`]) and only within
//!   small limits, to lift a hazy or dull phone photo without clipping.
//!
//! Both corrections are folded into one 256-entry table per channel, so the
//! pass over the pixels is a lookup.

use crate::analysis::temperature::illuminant;
use crate::color::{linear_to_srgb, luma8, srgb_lut};
use crate::image::{RgbaImage, RgbaView};
use crate::resize::{fit_within, resize_hq};

/// Share of the white-balance correction applied (in log space).
pub const WB_STRENGTH: f32 = 0.5;
/// Gain limits of the white balance.
pub const WB_MIN: f32 = 0.85;
pub const WB_MAX: f32 = 1.18;
/// Share of the levels stretch applied.
pub const LEVELS_STRENGTH: f32 = 0.5;
/// The black point never moves above this (encoded 0–1)…
pub const MAX_BLACK: f32 = 0.08;
/// …and the white point never below this.
pub const MIN_WHITE: f32 = 0.85;

/// Downscales to fit in `max_side` and optionally applies the mild
/// auto white balance + levels.
pub fn prepare_photo(src: RgbaView<'_>, max_side: usize, auto_fix: bool) -> RgbaImage {
    let (w, h) = fit_within(src.w, src.h, max_side.max(16));
    let mut img = resize_hq(src, w, h);
    if auto_fix {
        let luts = correction_luts(&img);
        for p in img.data.chunks_exact_mut(4) {
            p[0] = luts[0][p[0] as usize];
            p[1] = luts[1][p[1] as usize];
            p[2] = luts[2][p[2] as usize];
        }
    }
    img
}

/// The per-channel tables of the correction measured on `img`.
pub fn correction_luts(img: &RgbaImage) -> [[u8; 256]; 3] {
    // Measure on a small copy (fast, and noise-free).
    let (sw, sh) = fit_within(img.w, img.h, 128);
    let small = resize_hq(img.view(), sw, sh);
    let ill = illuminant(&small);
    let gains: Vec<f32> =
        ill.iter().map(|&e| (WB_STRENGTH * (1.0 / e.max(1e-3)).ln()).exp().clamp(WB_MIN, WB_MAX)).collect();
    // Keep the luminance of mid-grey unchanged.
    let norm = 0.2126 * gains[0] + 0.7152 * gains[1] + 0.0722 * gains[2];
    let gains: Vec<f32> = gains.iter().map(|g| g / norm).collect();

    let mut lumas: Vec<f32> = small.data.chunks_exact(4).map(|p| luma8(p[0], p[1], p[2])).collect();
    lumas.sort_by(|a, b| a.total_cmp(b));
    let q = |f: f32| lumas[((lumas.len() - 1) as f32 * f).round() as usize];
    let (lo, hi) = (q(0.005), q(0.995));
    let black = (lo.min(MAX_BLACK)) * LEVELS_STRENGTH;
    let white = 1.0 - (1.0 - hi).min(1.0 - MIN_WHITE) * LEVELS_STRENGTH;

    let lut = srgb_lut();
    let mut out = [[0u8; 256]; 3];
    for (c, table) in out.iter_mut().enumerate() {
        for (v, o) in table.iter_mut().enumerate() {
            let enc = linear_to_srgb(lut[v] * gains[c]);
            let lev = ((enc - black) / (white - black).max(0.1)).clamp(0.0, 1.0);
            *o = (lev * 255.0 + 0.5) as u8;
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn photo(w: usize, h: usize, cast: [f32; 3]) -> RgbaImage {
        let mut img = RgbaImage::new(w, h);
        for y in 0..h {
            for x in 0..w {
                let v = 0.15 + 0.7 * ((x * 13 + y * 7) % 97) as f32 / 96.0;
                let lin = crate::color::srgb_to_linear(v);
                let px = |c: usize| (linear_to_srgb(lin * cast[c]) * 255.0 + 0.5) as u8;
                img.set(x, y, [px(0), px(1), px(2), 255]);
            }
        }
        img
    }

    #[test]
    fn downscales_without_enlarging() {
        let img = photo(300, 200, [1.0, 1.0, 1.0]);
        let out = prepare_photo(img.view(), 150, false);
        assert_eq!((out.w, out.h), (150, 100));
        let out = prepare_photo(img.view(), 1536, false);
        assert_eq!((out.w, out.h), (300, 200));
        assert_eq!(out.data, img.data);
    }

    #[test]
    fn auto_fix_tempers_a_cast_but_keeps_some_warmth() {
        let warm = photo(120, 80, [1.0, 0.75, 0.5]);
        let mean =
            |im: &RgbaImage, c: usize| im.data.chunks(4).map(|p| p[c] as f32).sum::<f32>() / (im.w * im.h) as f32;
        let fixed = prepare_photo(warm.view(), 1536, true);
        let ratio_before = mean(&warm, 0) / mean(&warm, 2);
        let ratio_after = mean(&fixed, 0) / mean(&fixed, 2);
        assert!(ratio_after < ratio_before * 0.9, "{ratio_before} → {ratio_after}");
        assert!(ratio_after > 1.05, "still warm: {ratio_after}");
    }

    #[test]
    fn neutral_photo_is_nearly_unchanged() {
        let img = photo(120, 80, [1.0, 1.0, 1.0]);
        let fixed = prepare_photo(img.view(), 1536, true);
        let max_diff = img.data.iter().zip(&fixed.data).map(|(a, b)| (*a as i32 - *b as i32).abs()).max().unwrap();
        assert!(max_diff <= 30, "{max_diff}");
        // Grey stays grey.
        assert!(fixed.data.chunks(4).all(|p| (p[0] as i32 - p[2] as i32).abs() <= 2));
    }
}
