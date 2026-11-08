//! Scene analysis of the parent's room photo (runs on the device before upload,
//! and again on the server when the client did not send one).
//!
//! Everything is computed on a high-quality downscaled copy whose long side is
//! at most [`ANALYSIS_SIDE`] pixels (Lanczos-3, see [`crate::resize`]): the
//! measures below are about large structures (light, surfaces, palette), and
//! the small copy makes the whole analysis take a few milliseconds.
//!
//! | field | method |
//! |---|---|
//! | `brightness` | mean gamma-encoded Rec. 709 luma Y′ (0–1) |
//! | `contrast` | RMS contrast: standard deviation of Y′ (0–0.5) |
//! | `color_temp`, `kelvin` | grey-world + white-patch illuminant estimate → McCamy CCT ([`temperature`]) |
//! | `light_dir`, `light_strength` | log-luminance gradients inside smooth regions ([`light`]) |
//! | `palette` | weighted k-means in CIELAB on a colour histogram ([`palette`]) |
//! | `is_dark` | `brightness < DARK_BRIGHTNESS` |
//! | `sharpness`, `blur`, `is_blurry` | variance of the Laplacian ([`crate::filters::laplacian_variance`]) |
//! | `stages` | sliding windows scored on integral images of edges and light ([`stages`]) |

pub mod light;
pub mod palette;
pub mod stages;
pub mod temperature;

use serde::{Deserialize, Serialize};

use crate::color::{luma8, srgb8_to_lab, Lab};
use crate::filters::laplacian_variance;
use crate::image::{r4, Plane, Result, RgbaImage, RgbaView};
use crate::resize::{fit_within, resize_hq};

/// Long side of the working copy, in pixels.
pub const ANALYSIS_SIDE: usize = 256;
/// Below this mean luma the room counts as dark: the prompt then asks for a
/// cosy lamp glow on the elves instead of a flash look (a living room at night
/// lit by one lamp measures about 0.15–0.25).
pub const DARK_BRIGHTNESS: f32 = 0.25;
/// Laplacian variance (0–255 units, on the ≤ 256 px copy) that maps to
/// `blur = 0.5`. Sharp phone photos measure 300–3000 at that size.
pub const BLUR_REF: f32 = 100.0;
/// `is_blurry` when the Laplacian variance is below this value.
pub const BLURRY_VAR: f32 = 50.0;

/// Colour temperature class of the room light.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ColorTemp {
    Warm,
    Neutral,
    Cool,
}

/// Where the main light comes from, as seen in the photo.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum LightDir {
    Left,
    Right,
    Top,
    /// From the camera side (centre brighter than the edges).
    Front,
    /// No clear direction.
    Diffuse,
}

/// Coarse position of a stage in the picture (3 × 3 grid of its centre).
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum StagePos {
    TopLeft,
    Top,
    TopRight,
    Left,
    Centre,
    Right,
    BottomLeft,
    Bottom,
    BottomRight,
}

impl StagePos {
    /// The cell of a point given in normalised coordinates.
    pub fn of(cx: f32, cy: f32) -> StagePos {
        let col = if cx < 1.0 / 3.0 {
            0
        } else if cx > 2.0 / 3.0 {
            2
        } else {
            1
        };
        let row = if cy < 1.0 / 3.0 {
            0
        } else if cy > 2.0 / 3.0 {
            2
        } else {
            1
        };
        [
            [StagePos::TopLeft, StagePos::Top, StagePos::TopRight],
            [StagePos::Left, StagePos::Centre, StagePos::Right],
            [StagePos::BottomLeft, StagePos::Bottom, StagePos::BottomRight],
        ][row][col]
    }
}

/// One dominant colour.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct PaletteEntry {
    /// `#rrggbb`.
    pub hex: String,
    /// Share of the pixels (0–1); the entries sum to 1.
    pub share: f32,
}

/// A free area where small elves can be placed (normalised 0–1 coordinates,
/// origin top-left).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Stage {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
    /// 0–1, higher is better; stages are sorted by score.
    pub score: f32,
    pub label: StagePos,
    /// A strong horizontal edge (table or shelf edge, wall/surface line) runs
    /// right above it: very likely the top of a piece of furniture.
    pub below_edge: bool,
}

/// The result of [`analyze_scene`].
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct SceneAnalysis {
    /// Size of the analysed photo (not of the working copy).
    pub width: u32,
    pub height: u32,
    pub brightness: f32,
    pub contrast: f32,
    pub color_temp: ColorTemp,
    pub kelvin: f32,
    pub light_dir: LightDir,
    /// 0 (no direction) – 1 (strong directional light).
    pub light_strength: f32,
    pub palette: Vec<PaletteEntry>,
    pub is_dark: bool,
    /// Variance of the Laplacian of Y′ (0–255 units) on the working copy.
    pub sharpness: f32,
    /// `BLUR_REF / (BLUR_REF + sharpness)`: 0 sharp – 1 very blurry.
    pub blur: f32,
    pub is_blurry: bool,
    /// Up to 4, best first. Empty when the photo has no usable free area.
    pub stages: Vec<Stage>,
}

/// The working copy and its derived planes.
pub(crate) struct Work {
    pub img: RgbaImage,
    /// Y′ in 0–1.
    pub luma: Plane,
    pub lab: Vec<Lab>,
}

impl Work {
    pub fn new(src: RgbaView<'_>, side: usize) -> Work {
        let (w, h) = fit_within(src.w, src.h, side);
        let img = resize_hq(src, w, h);
        let mut luma = Plane::new(w, h);
        let mut lab = Vec::with_capacity(w * h);
        for (i, p) in img.data.chunks_exact(4).enumerate() {
            luma.data[i] = luma8(p[0], p[1], p[2]);
            lab.push(srgb8_to_lab(p[0], p[1], p[2]));
        }
        Work { img, luma, lab }
    }
}

/// Analyses a room photo (RGBA8, any size up to the limits of
/// [`crate::image`]).
pub fn analyze_scene(src: RgbaView<'_>) -> Result<SceneAnalysis> {
    let work = Work::new(src, ANALYSIS_SIDE);
    let brightness = work.luma.mean();
    let contrast = work.luma.std();
    let kelvin = temperature::estimate_kelvin(&work.img);
    let color_temp = temperature::classify(kelvin);
    let light = light::estimate(&work.luma);
    let palette = palette::dominant_colors(&work.img, 5);
    let luma255 = Plane { data: work.luma.data.iter().map(|v| v * 255.0).collect(), w: work.luma.w, h: work.luma.h };
    let sharpness = laplacian_variance(&luma255);
    let stages = stages::find_stages(&work);
    Ok(SceneAnalysis {
        width: src.w as u32,
        height: src.h as u32,
        brightness: r4(brightness),
        contrast: r4(contrast),
        color_temp,
        kelvin: kelvin.round(),
        light_dir: light.dir,
        light_strength: r4(light.strength),
        palette,
        is_dark: brightness < DARK_BRIGHTNESS,
        sharpness: (sharpness * 10.0).round() / 10.0,
        blur: r4(BLUR_REF / (BLUR_REF + sharpness)),
        is_blurry: sharpness < BLURRY_VAR,
        stages,
    })
}

/// `smoothstep(e0, e1, x)`: 0 below `e0`, 1 above `e1`, smooth in between.
#[inline]
pub(crate) fn smoothstep(e0: f32, e1: f32, x: f32) -> f32 {
    let t = ((x - e0) / (e1 - e0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stage_pos_grid() {
        assert_eq!(StagePos::of(0.1, 0.9), StagePos::BottomLeft);
        assert_eq!(StagePos::of(0.5, 0.5), StagePos::Centre);
        assert_eq!(StagePos::of(0.9, 0.5), StagePos::Right);
        assert_eq!(StagePos::of(0.5, 0.1), StagePos::Top);
    }

    #[test]
    fn enums_serialise_as_documented() {
        assert_eq!(serde_json::to_string(&StagePos::BottomLeft).unwrap(), "\"bottom-left\"");
        assert_eq!(serde_json::to_string(&StagePos::Centre).unwrap(), "\"centre\"");
        assert_eq!(serde_json::to_string(&LightDir::Diffuse).unwrap(), "\"diffuse\"");
        assert_eq!(serde_json::to_string(&ColorTemp::Warm).unwrap(), "\"warm\"");
    }

    #[test]
    fn smoothstep_shape() {
        assert_eq!(smoothstep(0.2, 0.4, 0.1), 0.0);
        assert_eq!(smoothstep(0.2, 0.4, 0.5), 1.0);
        assert!((smoothstep(0.2, 0.4, 0.3) - 0.5).abs() < 1e-6);
    }
}
