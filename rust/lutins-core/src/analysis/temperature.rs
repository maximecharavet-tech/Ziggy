//! Colour of the room light: illuminant estimate, colour temperature and
//! chromatic adaptation.
//!
//! **Shades of grey** (Finlayson & Trezzi 2004): the illuminant is the
//! Minkowski p-mean of the linear RGB values, `e_c = (mean(c^p))^(1/p)`. `p = 1`
//! is grey world (Buchsbaum 1980), `p = ∞` is white patch (max-RGB); `p = 6`
//! was the best value in their tests and is steadier than both (grey world is
//! fooled by one big coloured wall, white patch by one coloured lamp shade).
//! Nearly black and clipped pixels are ignored.
//!
//! The illuminant's CIE xy chromaticity gives a correlated colour temperature
//! with McCamy's formula ([`crate::color::cct_kelvin`]). The same estimate is
//! used by the verifier to adapt the elves' signature colours to the light of
//! the generated picture with the **Bradford** transform ([`bradford_adapt`]):
//! under a warm lamp, lavender turns greyish and green turns olive, and an
//! unadapted colour check would miss the elves.

use super::ColorTemp;
use crate::color::{linear_to_lab, linear_to_xyz, luma8, srgb_lut, Lab};
use crate::image::RgbaImage;

/// Below this CCT the light is "warm" (tungsten 2 700 K, halogen 3 000 K,
/// "warm white" LED 3 000–4 000 K, golden-hour window light).
pub const WARM_BELOW_K: f32 = 4_800.0;
/// Above this CCT the light is "cool" (overcast daylight, shade, blue hour).
/// Neutral daylight and sRGB white are about 6 500 K.
pub const COOL_ABOVE_K: f32 = 7_600.0;
/// Minkowski norm of the shades-of-grey estimate.
pub const SOG_P: i32 = 6;

/// Linear-RGB illuminant estimate (shades of grey, p = 6), normalised so the
/// channels sum to 3 (neutral light = `[1, 1, 1]`).
pub fn illuminant(img: &RgbaImage) -> [f32; 3] {
    let lut = srgb_lut();
    let mut acc = [0.0f64; 3];
    let mut n = 0usize;
    for p in img.data.chunks_exact(4) {
        let y = luma8(p[0], p[1], p[2]);
        if !(0.04..=0.98).contains(&y) || p[0] == 255 || p[1] == 255 || p[2] == 255 {
            continue;
        }
        for c in 0..3 {
            acc[c] += (lut[p[c] as usize] as f64).powi(SOG_P);
        }
        n += 1;
    }
    if n < 16 {
        return [1.0, 1.0, 1.0];
    }
    let e: Vec<f64> = acc.iter().map(|&a| (a / n as f64).powf(1.0 / SOG_P as f64)).collect();
    let s = (e[0] + e[1] + e[2]).max(1e-12);
    [(3.0 * e[0] / s) as f32, (3.0 * e[1] / s) as f32, (3.0 * e[2] / s) as f32]
}

/// Kelvin estimate of the illuminant of an RGBA image.
pub fn estimate_kelvin(img: &RgbaImage) -> f32 {
    let [r, g, b] = illuminant(img);
    crate::color::cct_kelvin(r, g, b)
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

const BRADFORD: [[f32; 3]; 3] = [[0.8951, 0.2664, -0.1614], [-0.7502, 1.7135, 0.0367], [0.0389, -0.0685, 1.0296]];
const BRADFORD_INV: [[f32; 3]; 3] =
    [[0.986_993, -0.147_054, 0.159_963], [0.432_305, 0.518_360, 0.049_291], [-0.008_529, 0.040_043, 0.968_487]];

fn mul(m: &[[f32; 3]; 3], v: [f32; 3]) -> [f32; 3] {
    [
        m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
        m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
        m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
    ]
}

/// Bradford chromatic adaptation of a linear-sRGB colour seen under D65 to
/// how it looks under the linear-RGB illuminant `ill` (as returned by
/// [`illuminant`]), returned in CIELAB relative to D65 (the reference white of
/// every Lab value the engine computes from pixels).
pub fn bradford_adapt(rgb_linear: [f32; 3], ill: [f32; 3]) -> Lab {
    let w_src = linear_to_xyz(1.0, 1.0, 1.0);
    let mut w_dst = linear_to_xyz(ill[0], ill[1], ill[2]);
    // Keep the luminance: adaptation changes the colour of the light only.
    let k = w_src[1] / w_dst[1].max(1e-6);
    w_dst.iter_mut().for_each(|v| *v *= k);
    let cs = mul(&BRADFORD, w_src);
    let cd = mul(&BRADFORD, w_dst);
    let xyz = linear_to_xyz(rgb_linear[0], rgb_linear[1], rgb_linear[2]);
    let mut cone = mul(&BRADFORD, xyz);
    for i in 0..3 {
        cone[i] *= cd[i] / cs[i].max(1e-6);
    }
    let [x, y, z] = mul(&BRADFORD_INV, cone);
    // Back to linear sRGB (so the shared Lab conversion applies).
    let r = 3.240_454_2 * x - 1.537_138_5 * y - 0.498_531_4 * z;
    let g = -0.969_266 * x + 1.876_010_8 * y + 0.041_556 * z;
    let b = 0.055_643_4 * x - 0.204_025_9 * y + 1.057_225_2 * z;
    linear_to_lab(r.max(0.0), g.max(0.0), b.max(0.0))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::color::{delta_e2000, srgb8_to_lab};

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
        let ill = illuminant(&img);
        assert!(ill.iter().all(|c| (c - 1.0).abs() < 1e-4), "{ill:?}");
        let k = estimate_kelvin(&img);
        assert!((k - 6504.0).abs() < 20.0, "{k}");
    }

    #[test]
    fn too_few_valid_pixels_is_neutral() {
        let img = RgbaImage::new(3, 3); // all black
        assert_eq!(illuminant(&img), [1.0, 1.0, 1.0]);
    }

    #[test]
    fn bradford_identity_and_warm_shift() {
        let lut = srgb_lut();
        let green = [lut[58], lut[157], lut[79]];
        let same = bradford_adapt(green, [1.0, 1.0, 1.0]);
        assert!(delta_e2000(same, srgb8_to_lab(58, 157, 79), 1.0, 1.0, 1.0) < 0.3);
        // Under warm light the colour moves towards yellow/red (b* and a* up).
        let warm = bradford_adapt(green, [1.35, 1.0, 0.65]);
        assert!(warm.b > same.b + 5.0 && warm.a > same.a, "{warm:?} vs {same:?}");
    }
}
