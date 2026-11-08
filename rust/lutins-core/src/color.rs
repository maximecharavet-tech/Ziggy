//! Colour science: sRGB ↔ linear light ↔ CIE XYZ (D65) ↔ CIELAB, the CIEDE2000
//! colour difference, hex strings and a correlated-colour-temperature estimate.
//!
//! Everything is `f32` (plenty for 8-bit images) and uses the IEC 61966-2-1
//! sRGB transfer curve and the D65 white point.

use std::sync::OnceLock;

/// D65 reference white in XYZ (Y = 1).
const WHITE: [f32; 3] = [0.950_47, 1.0, 1.088_83];

/// sRGB 8-bit → linear light, as a 256-entry table (built once).
pub fn srgb_lut() -> &'static [f32; 256] {
    static LUT: OnceLock<[f32; 256]> = OnceLock::new();
    LUT.get_or_init(|| {
        let mut t = [0.0f32; 256];
        for (i, v) in t.iter_mut().enumerate() {
            *v = srgb_to_linear(i as f32 / 255.0);
        }
        t
    })
}

/// sRGB transfer curve, encoded (0–1) → linear (0–1).
#[inline]
pub fn srgb_to_linear(c: f32) -> f32 {
    if c <= 0.040_45 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    }
}

/// Inverse sRGB transfer curve, linear (0–1) → encoded (0–1).
#[inline]
pub fn linear_to_srgb(c: f32) -> f32 {
    let c = c.clamp(0.0, 1.0);
    if c <= 0.003_130_8 {
        c * 12.92
    } else {
        1.055 * c.powf(1.0 / 2.4) - 0.055
    }
}

/// Gamma-encoded Rec. 709 luma (Y′) of an 8-bit pixel, 0–1. This is the
/// "brightness as a viewer perceives it" used for brightness, contrast and the
/// luminance planes of the analysis.
#[inline]
pub fn luma8(r: u8, g: u8, b: u8) -> f32 {
    (0.2126 * r as f32 + 0.7152 * g as f32 + 0.0722 * b as f32) / 255.0
}

/// Linear sRGB → CIE XYZ (D65).
#[inline]
pub fn linear_to_xyz(r: f32, g: f32, b: f32) -> [f32; 3] {
    [
        0.412_456_4 * r + 0.357_576_1 * g + 0.180_437_5 * b,
        0.212_672_9 * r + 0.715_152_2 * g + 0.072_175 * b,
        0.019_333_9 * r + 0.119_192 * g + 0.950_304_1 * b,
    ]
}

/// CIELAB colour (L* 0–100, a*, b* roughly −128…127).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Lab {
    pub l: f32,
    pub a: f32,
    pub b: f32,
}

impl Lab {
    pub const fn new(l: f32, a: f32, b: f32) -> Lab {
        Lab { l, a, b }
    }

    /// Chroma C*ab.
    #[inline]
    pub fn chroma(&self) -> f32 {
        (self.a * self.a + self.b * self.b).sqrt()
    }
}

#[inline]
fn lab_f(t: f32) -> f32 {
    const D: f32 = 6.0 / 29.0;
    if t > D * D * D {
        t.cbrt()
    } else {
        t / (3.0 * D * D) + 4.0 / 29.0
    }
}

#[inline]
fn lab_f_inv(t: f32) -> f32 {
    const D: f32 = 6.0 / 29.0;
    if t > D {
        t * t * t
    } else {
        3.0 * D * D * (t - 4.0 / 29.0)
    }
}

/// Linear sRGB → CIELAB.
#[inline]
pub fn linear_to_lab(r: f32, g: f32, b: f32) -> Lab {
    let [x, y, z] = linear_to_xyz(r, g, b);
    let fx = lab_f(x / WHITE[0]);
    let fy = lab_f(y / WHITE[1]);
    let fz = lab_f(z / WHITE[2]);
    Lab { l: 116.0 * fy - 16.0, a: 500.0 * (fx - fy), b: 200.0 * (fy - fz) }
}

/// 8-bit sRGB → CIELAB.
#[inline]
pub fn srgb8_to_lab(r: u8, g: u8, b: u8) -> Lab {
    let lut = srgb_lut();
    linear_to_lab(lut[r as usize], lut[g as usize], lut[b as usize])
}

/// CIELAB → 8-bit sRGB (out-of-gamut values are clipped).
pub fn lab_to_srgb8(lab: Lab) -> [u8; 3] {
    let fy = (lab.l + 16.0) / 116.0;
    let fx = fy + lab.a / 500.0;
    let fz = fy - lab.b / 200.0;
    let x = lab_f_inv(fx) * WHITE[0];
    let y = lab_f_inv(fy) * WHITE[1];
    let z = lab_f_inv(fz) * WHITE[2];
    let r = 3.240_454_2 * x - 1.537_138_5 * y - 0.498_531_4 * z;
    let g = -0.969_266 * x + 1.876_010_8 * y + 0.041_556 * z;
    let b = 0.055_643_4 * x - 0.204_025_9 * y + 1.057_225_2 * z;
    [to8(linear_to_srgb(r)), to8(linear_to_srgb(g)), to8(linear_to_srgb(b))]
}

#[inline]
pub fn to8(c: f32) -> u8 {
    (c * 255.0 + 0.5).clamp(0.0, 255.0) as u8
}

/// CIE76 colour difference (Euclidean distance in Lab).
#[inline]
pub fn delta_e76(p: Lab, q: Lab) -> f32 {
    ((p.l - q.l).powi(2) + (p.a - q.a).powi(2) + (p.b - q.b).powi(2)).sqrt()
}

/// CIEDE2000 colour difference with parametric weights `kl`, `kc`, `kh`
/// (1, 1, 1 for graphics; textiles use `kl = 2`, which tolerates lightness
/// changes from shading and folds).
///
/// Implementation follows Sharma, Wu & Dalal (2005), "The CIEDE2000
/// Color-Difference Formula: Implementation Notes", including their test data
/// (see the unit tests).
pub fn delta_e2000(p: Lab, q: Lab, kl: f32, kc: f32, kh: f32) -> f32 {
    use std::f32::consts::PI;
    let deg = PI / 180.0;
    let c1 = p.chroma();
    let c2 = q.chroma();
    let cbar = 0.5 * (c1 + c2);
    let cbar7 = cbar.powi(7);
    let g = 0.5 * (1.0 - (cbar7 / (cbar7 + 25f32.powi(7))).sqrt());
    let a1 = (1.0 + g) * p.a;
    let a2 = (1.0 + g) * q.a;
    let c1p = (a1 * a1 + p.b * p.b).sqrt();
    let c2p = (a2 * a2 + q.b * q.b).sqrt();
    let hue = |b: f32, a: f32| {
        if a == 0.0 && b == 0.0 {
            0.0
        } else {
            let h = b.atan2(a) / deg;
            if h < 0.0 {
                h + 360.0
            } else {
                h
            }
        }
    };
    let h1p = hue(p.b, a1);
    let h2p = hue(q.b, a2);

    let dlp = q.l - p.l;
    let dcp = c2p - c1p;
    let dhp = if c1p * c2p == 0.0 {
        0.0
    } else {
        let d = h2p - h1p;
        if d > 180.0 {
            d - 360.0
        } else if d < -180.0 {
            d + 360.0
        } else {
            d
        }
    };
    let dhp_big = 2.0 * (c1p * c2p).sqrt() * (dhp * deg / 2.0).sin();

    let lbarp = 0.5 * (p.l + q.l);
    let cbarp = 0.5 * (c1p + c2p);
    let hbarp = if c1p * c2p == 0.0 {
        h1p + h2p
    } else if (h1p - h2p).abs() <= 180.0 {
        0.5 * (h1p + h2p)
    } else if h1p + h2p < 360.0 {
        0.5 * (h1p + h2p + 360.0)
    } else {
        0.5 * (h1p + h2p - 360.0)
    };
    let t = 1.0 - 0.17 * ((hbarp - 30.0) * deg).cos()
        + 0.24 * ((2.0 * hbarp) * deg).cos()
        + 0.32 * ((3.0 * hbarp + 6.0) * deg).cos()
        - 0.20 * ((4.0 * hbarp - 63.0) * deg).cos();
    let dtheta = 30.0 * (-((hbarp - 275.0) / 25.0).powi(2)).exp();
    let cbarp7 = cbarp.powi(7);
    let rc = 2.0 * (cbarp7 / (cbarp7 + 25f32.powi(7))).sqrt();
    let l50 = (lbarp - 50.0).powi(2);
    let sl = 1.0 + 0.015 * l50 / (20.0 + l50).sqrt();
    let sc = 1.0 + 0.045 * cbarp;
    let sh = 1.0 + 0.015 * cbarp * t;
    let rt = -(2.0 * dtheta * deg).sin() * rc;
    let fl = dlp / (kl * sl);
    let fc = dcp / (kc * sc);
    let fh = dhp_big / (kh * sh);
    (fl * fl + fc * fc + fh * fh + rt * fc * fh).max(0.0).sqrt()
}

/// `#rrggbb` (lower case).
pub fn hex(rgb: [u8; 3]) -> String {
    format!("#{:02x}{:02x}{:02x}", rgb[0], rgb[1], rgb[2])
}

/// Parses `#rrggbb` (or `rrggbb`); anything else is `None`.
pub fn parse_hex(s: &str) -> Option<[u8; 3]> {
    let s = s.strip_prefix('#').unwrap_or(s);
    if s.len() != 6 || !s.bytes().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    let v = u32::from_str_radix(s, 16).ok()?;
    Some([(v >> 16) as u8, (v >> 8) as u8, v as u8])
}

/// Correlated colour temperature (kelvin) of a linear-sRGB illuminant
/// estimate, with McCamy's (1992) cubic approximation on the CIE 1931 xy
/// chromaticity: `n = (x − 0.3320) / (0.1858 − y)`,
/// `CCT = 449 n³ + 3525 n² + 6823.3 n + 5520.33`. Accurate to a few kelvin
/// near the Planckian locus between 2 000 K and 12 500 K; the result is
/// clamped to 1 500–15 000 K. Neutral sRGB white gives ≈ 6 500 K (D65).
pub fn cct_kelvin(r: f32, g: f32, b: f32) -> f32 {
    let [x, y, z] = linear_to_xyz(r.max(1e-6), g.max(1e-6), b.max(1e-6));
    let s = x + y + z;
    let (cx, cy) = (x / s, y / s);
    let denom = 0.1858 - cy;
    if denom.abs() < 1e-6 {
        return 15_000.0;
    }
    let n = (cx - 0.3320) / denom;
    let cct = 449.0 * n * n * n + 3525.0 * n * n + 6823.3 * n + 5520.33;
    if cct.is_finite() {
        cct.clamp(1_500.0, 15_000.0)
    } else {
        6_500.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transfer_curve_round_trips() {
        for i in 0..=255u8 {
            let lin = srgb_lut()[i as usize];
            assert_eq!(to8(linear_to_srgb(lin)), i);
        }
    }

    #[test]
    fn lab_known_values() {
        let w = srgb8_to_lab(255, 255, 255);
        assert!((w.l - 100.0).abs() < 0.01 && w.a.abs() < 0.01 && w.b.abs() < 0.01, "{w:?}");
        let r = srgb8_to_lab(255, 0, 0);
        // Reference: L 53.24, a 80.09, b 67.20.
        assert!((r.l - 53.24).abs() < 0.05 && (r.a - 80.09).abs() < 0.1 && (r.b - 67.20).abs() < 0.1, "{r:?}");
        let k = srgb8_to_lab(0, 0, 0);
        assert!(k.l.abs() < 1e-4);
    }

    #[test]
    fn lab_round_trips() {
        for &(r, g, b) in &[(58u8, 157u8, 79u8), (121, 80, 242), (160, 97, 43), (10, 10, 10), (250, 240, 230)] {
            assert_eq!(lab_to_srgb8(srgb8_to_lab(r, g, b)), [r, g, b]);
        }
    }

    /// Sharma, Wu & Dalal (2005), Table 1 (a selection of their 34 pairs).
    #[test]
    fn ciede2000_matches_sharma_test_data() {
        let cases = [
            ((50.0, 2.6772, -79.7751), (50.0, 0.0, -82.7485), 2.0425),
            ((50.0, 3.1571, -77.2803), (50.0, 0.0, -82.7485), 2.8615),
            ((50.0, 0.0, 0.0), (50.0, -1.0, 2.0), 2.3669),
            ((50.0, -1.0, 2.0), (50.0, 0.0, 0.0), 2.3669),
            ((50.0, 2.49, -0.001), (50.0, -2.49, 0.0011), 7.2195),
            ((50.0, 2.5, 0.0), (73.0, 25.0, -18.0), 27.1492),
            ((50.0, 2.5, 0.0), (58.0, 24.0, 15.0), 19.4535),
            ((60.2574, -34.0099, 36.2677), (60.4626, -34.1751, 39.4387), 1.2644),
            ((63.0109, -31.0961, -5.8663), (62.8187, -29.7946, -4.0864), 1.2630),
            ((2.0776, 0.0795, -1.1350), (0.9033, -0.0636, -0.5514), 0.9082),
        ];
        for ((l1, a1, b1), (l2, a2, b2), want) in cases {
            let d = delta_e2000(Lab::new(l1, a1, b1), Lab::new(l2, a2, b2), 1.0, 1.0, 1.0);
            assert!((d - want).abs() < 2e-3, "ΔE00 {d} != {want}");
        }
    }

    #[test]
    fn textile_weight_tolerates_lightness() {
        let a = Lab::new(50.0, 40.0, 30.0);
        let b = Lab::new(65.0, 40.0, 30.0);
        assert!(delta_e2000(a, b, 2.0, 1.0, 1.0) < delta_e2000(a, b, 1.0, 1.0, 1.0) * 0.6);
    }

    #[test]
    fn hex_round_trips() {
        assert_eq!(parse_hex("#3a9d4f"), Some([0x3a, 0x9d, 0x4f]));
        assert_eq!(parse_hex("E03131"), Some([0xe0, 0x31, 0x31]));
        assert_eq!(parse_hex("#3a9d4"), None);
        assert_eq!(parse_hex("#zz9d4f"), None);
        assert_eq!(hex([1, 2, 255]), "#0102ff");
    }

    #[test]
    fn cct_estimates() {
        let d65 = cct_kelvin(1.0, 1.0, 1.0);
        assert!((d65 - 6504.0).abs() < 15.0, "{d65}");
        // CIE illuminant A (2 856 K) in linear sRGB.
        let warm = cct_kelvin(1.0, 0.448, 0.126);
        assert!((warm - 2856.0).abs() < 60.0, "{warm}");
        let cool = cct_kelvin(0.62, 0.8, 1.0);
        assert!(cool > 8500.0, "{cool}");
    }
}
