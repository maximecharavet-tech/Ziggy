//! Colour temperature of the room light.
//!
//! Two classic colour-constancy estimates of the illuminant, in linear light:
//! - **grey world**: the scene averages to grey, so the mean colour is the
//!   colour of the light;
//! - **white patch** (max-RGB, robust variant): the brightest surfaces are
//!   white-ish, so the mean of the brightest 3 % (not clipped) is the light.
//!
//! Each estimate is normalised to unit sum and the two are averaged (grey world
//! is fooled by one big coloured wall, white patch by a coloured lamp shade;
//! together they are steadier). The illuminant's CIE xy chromaticity gives a
//! correlated colour temperature with McCamy's formula
//! ([`crate::color::cct_kelvin`]). Nearly black and clipped pixels are ignored.

use super::ColorTemp;
use crate::color::{cct_kelvin, luma8, srgb_lut};
use crate::image::RgbaImage;

/// Below this CCT the light is "warm" (tungsten 2 700 K, halogen 3 000 K,
/// "warm white" LED 3 000–4 000 K, golden-hour window light).
pub const WARM_BELOW_K: f32 = 4_800.0;
/// Above this CCT the light is "cool" (overcast daylight, shade, blue hour).
/// Neutral daylight and sRGB white are about 6 500 K.
pub const COOL_ABOVE_K: f32 = 7_600.0;
/// Share of the brightest valid pixels used by the white-patch estimate.
const WHITE_PATCH_SHARE: f32 = 0.03;

/// Kelvin estimate of the illuminant of an RGBA image.
pub fn estimate_kelvin(img: &RgbaImage) -> f32 {
    let lut = srgb_lut();
    // Valid pixels: not nearly black, no clipped channel.
    let mut valid: Vec<(f32, [f32; 3])> = Vec::with_capacity(img.w * img.h);
    for p in img.data.chunks_exact(4) {
        let y = luma8(p[0], p[1], p[2]);
        if !(0.06..=0.97).contains(&y) || p[0] == 255 || p[1] == 255 || p[2] == 255 {
            continue;
        }
        valid.push((y, [lut[p[0] as usize], lut[p[1] as usize], lut[p[2] as usize]]));
    }
    if valid.len() < 16 {
        return 6_500.0;
    }
    let norm = |c: [f64; 3]| {
        let s = (c[0] + c[1] + c[2]).max(1e-9);
        [c[0] / s, c[1] / s, c[2] / s]
    };
    let mut gw = [0.0f64; 3];
    for (_, c) in &valid {
        for k in 0..3 {
            gw[k] += c[k] as f64;
        }
    }
    let gw = norm(gw);

    let n_top = ((valid.len() as f32 * WHITE_PATCH_SHARE).ceil() as usize).clamp(1, valid.len());
    let k = valid.len() - n_top;
    valid.select_nth_unstable_by(k, |a, b| a.0.total_cmp(&b.0));
    let mut wp = [0.0f64; 3];
    for (_, c) in &valid[k..] {
        for ch in 0..3 {
            wp[ch] += c[ch] as f64;
        }
    }
    let wp = norm(wp);
    let ill = [(gw[0] + wp[0]) / 2.0, (gw[1] + wp[1]) / 2.0, (gw[2] + wp[2]) / 2.0];
    cct_kelvin(ill[0] as f32, ill[1] as f32, ill[2] as f32)
}

/// Warm / neutral / cool class of a kelvin estimate.
pub fn classify(kelvin: f32) -> ColorTemp {
    if kelvin < WARM_BELOW_K {
        ColorTemp::Warm
    } else if kelvin > COOL_ABOVE_K {
        ColorTemp::Cool
    } else {
        ColorTemp::Neutral
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classes() {
        assert_eq!(classify(2700.0), ColorTemp::Warm);
        assert_eq!(classify(6500.0), ColorTemp::Neutral);
        assert_eq!(classify(9000.0), ColorTemp::Cool);
    }

    #[test]
    fn grey_image_is_d65() {
        let mut img = RgbaImage::new(8, 8);
        img.data.chunks_exact_mut(4).enumerate().for_each(|(i, p)| {
            let v = 60 + (i as u8 % 5) * 30;
            p.copy_from_slice(&[v, v, v, 255]);
        });
        let k = estimate_kelvin(&img);
        assert!((k - 6504.0).abs() < 20.0, "{k}");
    }

    #[test]
    fn too_few_valid_pixels_is_neutral() {
        let img = RgbaImage::new(3, 3); // all black
        assert_eq!(estimate_kelvin(&img), 6500.0);
    }
}
