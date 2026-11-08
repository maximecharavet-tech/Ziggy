//! Direction of the main light.
//!
//! The luminance of a matte surface is reflectance × illumination, so inside
//! one smooth surface (a wall, a table top, a floor) the gradient of
//! `ln(Y′)` is the gradient of the illumination only: the reflectance cancels.
//! We therefore:
//! 1. lightly blur Y′ (σ ≈ 1) to remove noise;
//! 2. mark edge pixels (Sobel magnitude above a soft threshold) and compute the
//!    local edge density around each pixel (box filter);
//! 3. take the log-luminance gradient over ±[`SPAN`] pixels only where that
//!    neighbourhood holds no edge at all (so boundaries between objects, which
//!    are reflectance changes, never count), also skipping nearly black and
//!    clipped pixels;
//! 4. average the gradients of those pixels and express them as the change of
//!    `ln(Y′)` across the whole frame: `h` (positive when the left is
//!    brighter), `v` (top brighter) and `f`, the inward radial component
//!    (centre brighter than the edges, the signature of light from the camera
//!    side).
//!
//! The largest of `|h|`, `v` and `f · FRONT_WEIGHT` wins if it exceeds
//! [`DIFFUSE_BELOW`]; otherwise the light is "diffuse". Light from below is
//! reported as diffuse (it is rare indoors and "from below" would make a spooky
//! prompt). The front component is down-weighted because lens vignetting also
//! makes the centre brighter.

use super::LightDir;
use crate::filters::{box_blur, magnitude, sobel};
use crate::image::Plane;

/// Half-distance (pixels on the working copy) of the log-luminance difference.
pub const SPAN: usize = 3;
/// Below this log-change across the frame (≈ 25 % brightness change) the light
/// counts as diffuse.
pub const DIFFUSE_BELOW: f32 = 0.22;
/// Log-change across the frame that maps to `strength = 1` (≈ ×2.7).
pub const STRONG_AT: f32 = 1.0;
/// Weight of the centre-brighter component (vignetting also produces it).
pub const FRONT_WEIGHT: f32 = 0.7;
/// Sobel magnitude where a pixel starts / fully counts as an edge (Y′ units;
/// a unit step edge has magnitude 0.5 on each side, smooth shading < 0.02).
const EDGE_LO: f32 = 0.02;
const EDGE_HI: f32 = 0.06;
/// Fewer usable pixels than this share → no judgement (diffuse).
const MIN_COVERAGE: f32 = 0.04;

/// The light estimate.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Light {
    pub dir: LightDir,
    pub strength: f32,
    /// Horizontal, vertical and radial log-changes (for tests and debugging).
    pub h: f32,
    pub v: f32,
    pub f: f32,
}

/// Estimates the light direction from a Y′ plane (0–1).
pub fn estimate(luma: &Plane) -> Light {
    let (w, h) = (luma.w, luma.h);
    let diffuse = Light { dir: LightDir::Diffuse, strength: 0.0, h: 0.0, v: 0.0, f: 0.0 };
    if w < 4 * SPAN + 4 || h < 4 * SPAN + 4 {
        return diffuse;
    }
    let yb = box_blur(&box_blur(luma, 1), 1);
    let (gx, gy) = sobel(&yb);
    let mag = magnitude(&gx, &gy);
    let edge = Plane {
        data: mag.data.iter().map(|&m| ((m - EDGE_LO) / (EDGE_HI - EDGE_LO)).clamp(0.0, 1.0)).collect(),
        w,
        h,
    };
    // Any edge within SPAN + 3 pixels disqualifies the sample.
    let density = box_blur(&edge, SPAN + 3);
    let ln: Vec<f32> = yb.data.iter().map(|&v| (v.max(1e-3)).ln()).collect();

    let (cx, cy) = (w as f32 / 2.0, h as f32 / 2.0);
    let half_diag = (cx * cx + cy * cy).sqrt();
    let (mut sw, mut sx, mut sy, mut sr) = (0.0f64, 0.0f64, 0.0f64, 0.0f64);
    let mut n = 0usize;
    for y in SPAN..h - SPAN {
        for x in SPAN..w - SPAN {
            n += 1;
            let i = y * w + x;
            let v = yb.data[i];
            if !(0.03..=0.97).contains(&v) {
                continue;
            }
            let wgt = (1.0 - density.data[i] / 0.02).clamp(0.0, 1.0);
            if wgt <= 0.0 {
                continue;
            }
            let lx = (ln[i + SPAN] - ln[i - SPAN]) / (2 * SPAN) as f32;
            let ly = (ln[i + SPAN * w] - ln[i - SPAN * w]) / (2 * SPAN) as f32;
            let (rx, ry) = (x as f32 + 0.5 - cx, y as f32 + 0.5 - cy);
            let rl = (rx * rx + ry * ry).sqrt().max(1.0);
            let wgt = wgt as f64;
            sw += wgt;
            sx += wgt * lx as f64;
            sy += wgt * ly as f64;
            sr += wgt * ((lx * rx + ly * ry) / rl) as f64;
        }
    }
    if n == 0 || (sw as f32) < MIN_COVERAGE * n as f32 {
        return diffuse;
    }
    let hc = -(sx / sw) as f32 * w as f32;
    let vc = -(sy / sw) as f32 * h as f32;
    let fc = -(sr / sw) as f32 * half_diag;

    let mut best = (LightDir::Diffuse, 0.0f32);
    let cands = [
        (if hc > 0.0 { LightDir::Left } else { LightDir::Right }, hc.abs()),
        (LightDir::Top, vc.max(0.0)),
        (LightDir::Front, fc.max(0.0) * FRONT_WEIGHT),
    ];
    for c in cands {
        if c.1 > best.1 {
            best = c;
        }
    }
    let dir = if best.1 < DIFFUSE_BELOW { LightDir::Diffuse } else { best.0 };
    Light { dir, strength: (best.1 / STRONG_AT).clamp(0.0, 1.0), h: hc, v: vc, f: fc }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn horizontal_gradients() {
        let left = Plane::from_fn(200, 140, |x, _| 0.85 - 0.6 * x as f32 / 199.0);
        let l = estimate(&left);
        assert_eq!(l.dir, LightDir::Left, "{l:?}");
        assert!(l.strength > 0.9);
        let right = Plane::from_fn(200, 140, |x, _| 0.25 + 0.6 * x as f32 / 199.0);
        assert_eq!(estimate(&right).dir, LightDir::Right);
    }

    #[test]
    fn top_and_front_and_flat() {
        let top = Plane::from_fn(200, 140, |_, y| 0.8 - 0.5 * y as f32 / 139.0);
        assert_eq!(estimate(&top).dir, LightDir::Top);
        let front = Plane::from_fn(200, 140, |x, y| {
            let (dx, dy) = (x as f32 - 100.0, y as f32 - 70.0);
            0.9 * (-(dx * dx + dy * dy) / (2.0 * 70.0f32.powi(2))).exp() + 0.05
        });
        assert_eq!(estimate(&front).dir, LightDir::Front);
        let flat = Plane::from_fn(200, 140, |_, _| 0.5);
        assert_eq!(estimate(&flat).dir, LightDir::Diffuse);
        // Light from below is reported as diffuse.
        let below = Plane::from_fn(200, 140, |_, y| 0.3 + 0.5 * y as f32 / 139.0);
        assert_eq!(estimate(&below).dir, LightDir::Diffuse);
    }

    #[test]
    fn object_boundaries_are_not_light() {
        // Two flat regions (dark left wall, bright right panel): a reflectance
        // change, not a light gradient.
        let p = Plane::from_fn(200, 140, |x, _| if x < 100 { 0.2 } else { 0.8 });
        assert_eq!(estimate(&p).dir, LightDir::Diffuse);
        // Busy texture everywhere: no smooth area to judge.
        let busy = Plane::from_fn(200, 140, |x, y| if (x / 2 + y / 2) % 2 == 0 { 0.2 } else { 0.8 });
        assert_eq!(estimate(&busy).dir, LightDir::Diffuse);
    }

    #[test]
    fn shading_survives_objects() {
        // Left-lit wall with dark picture frames on it.
        let p = Plane::from_fn(240, 160, |x, y| {
            let base = 0.9 - 0.55 * x as f32 / 239.0;
            let in_frame = |x0: usize, y0: usize| x >= x0 && x < x0 + 30 && y >= y0 && y < y0 + 40;
            if in_frame(40, 30) || in_frame(150, 80) {
                base * 0.3
            } else {
                base
            }
        });
        assert_eq!(estimate(&p).dir, LightDir::Left);
    }
}
