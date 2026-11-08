//! Verification of a generated picture against the parent's photo.
//!
//! Two questions: *is it still the parent's room?* and *are the requested
//! elves there (and only them)?* Everything runs on copies whose long side is
//! [`VERIFY_SIDE`] pixels (the generated picture is resized to the photo's
//! aspect), in about 50 ms in WebAssembly.
//!
//! ## 1. Alignment
//! Edit models shift or re-crop slightly; [`crate::align`] finds the zoom and
//! translation by phase correlation and the generated picture is resampled
//! onto the photo. A shift above [`MAX_SHIFT`] of the frame, a zoom, or an
//! aspect change above [`MAX_ASPECT_CHANGE`] is reported as
//! `framing_changed` (the retry prompt then insists on the exact framing).
//!
//! ## 2. Mask of the edited areas
//! The elves (and the prank's props) are *meant* to change the picture. The
//! picture is cut into 16 px cells, each cell gets a change score
//! (`1 − SSIM + ΔE76 / 50`), and the [`IGNORE_FRACTION`] most changed cells,
//! the optional caller-supplied rectangles (stages, dilated by 20 %) and the
//! pixels the alignment could not fill are masked out of the room metrics.
//!
//! ## 3. Room metrics (outside the mask)
//! - **Structure** — the contrast·structure term of SSIM (Wang et al. 2004),
//!   `cs = (2σxy + C2) / (σx² + σy² + C2)`, with 11×11 Gaussian windows
//!   (σ = 1.5) on luma pre-blurred with σ ≈ 1 (the model re-renders fine
//!   texture). The luminance term is left out on purpose: edit models
//!   re-expose the whole picture, which is not a changed room. Full SSIM is
//!   reported too.
//! - **GMSD** (Xue et al. 2014): the standard deviation of the gradient
//!   magnitude similarity `(2·m1·m2 + T) / (m1² + m2² + T)`; insensitive to
//!   global tone shifts, very sensitive to moved or redrawn edges.
//! - **Colour drift**: mean CIEDE2000 between the two pictures at 64 px (room
//!   repainted or re-lit).
//! - **Changed area**: share of the frame (outside the mask, at 64 px) whose
//!   colour moved by more than ΔE00 = 20.
//! - **Edge correlation**: Pearson correlation of the Sobel magnitudes
//!   (reported, not used in the decision).
//!
//! The room passes when `cs ≥ CS_PASS` and `GMSD ≤ GMSD_PASS`; it fails when
//! `cs < CS_REJECT` or `GMSD > GMSD_REJECT`; in between it passes only if the
//! colour drift is ≤ [`DRIFT_OK`] and the changed area ≤ [`CHANGED_GREY_MAX`].
//! A drift above [`DRIFT_REJECT`] is `room_recolored`, a changed area above
//! [`CHANGED_MAX`] is `room_changed` whatever the structure says.
//!
//! ## 4. Elves
//! The light of each picture is estimated (shades of grey, p = 6) and every
//! elf's signature colours are **Bradford-adapted** to it
//! ([`crate::analysis::temperature`]). A pixel matches a colour family when
//! its chroma is at least [`ELF_MIN_CHROMA`] and its CIEDE2000 distance to one
//! of the adapted colours is at most [`ELF_DE_MAX`] with `kL = 2`.
//! **Why CIEDE2000 and not ΔE76**: the signature colours are saturated
//! (violet, green, red, mustard), exactly where ΔE76 is least uniform (it
//! overstates chroma differences of saturated colours and understates hue
//! shifts in blue-violet), so one ΔE76 radius cannot fit all of them. The
//! textile weighting `kL = 2` tolerates the lightness changes of shading and
//! folds in felt.
//!
//! A *new* pixel matches in the generated picture and, at the same place in
//! the photo, either did not match or had a clearly different colour (ΔE00 >
//! [`NEW_DE`]): the room's own green plant does not count, but a hazelnut elf
//! standing on a wooden table does. New
//! pixels are grouped in 8-connected patches (patches below [`MIN_PATCH`] of
//! the frame are noise). An elf is present when its primary patches cover at
//! least [`ELF_MIN_PRIMARY`] of the frame and, when it has one, an accent patch
//! (hat, scarf) of at least [`ELF_MIN_ACCENT`] lies within [`ELF_NEAR`] of the
//! frame height of a primary patch.
//!
//! Each signature pixel is given to the closest family only, across all the
//! elves (a mustard scarf is not also a hazelnut cape), with [`DECOYS`] (the
//! felt skin tones) competing too: under a warm lamp a pink-beige face drifts
//! towards hazelnut and must not count as Noisette.
//!
//! `extra_elves` (heuristic, only for elves with distinctive colours, i.e. not
//! Noisette's common brown): an elf that was not requested passes the same
//! test with twice the primary area, or a requested elf's primary colour forms
//! [`EXTRA_CLUSTERS`] or more separate large clusters.
//!
//! All thresholds are **starting points** tuned on synthetic tests; calibrate
//! them on 30–50 real outputs labelled by a human (each cut at the 5th
//! percentile of the accepted ones).

use serde::{Deserialize, Serialize};

use crate::align::{self, map_point, Alignment};
use crate::analysis::temperature::{bradford_adapt, illuminant};
use crate::bible::{bible, signature};
use crate::color::{delta_e2000, delta_e76, luma8, srgb8_to_lab, srgb_lut, Lab};
use crate::filters::{blur5, gaussian, prewitt_magnitude, sobel};
use crate::image::{r4, EngineError, Plane, Result, RgbaImage, RgbaView};
use crate::resize::{box_reduce, fit_within, resize_hq};

/// Long side of the comparison copies, in pixels.
pub const VERIFY_SIDE: usize = 256;
/// Side of the cells of the edit mask, in pixels.
pub const CELL: usize = 16;
/// Share of the most changed cells left out of the room metrics.
pub const IGNORE_FRACTION: f32 = 0.20;
/// Structure term: pass at or above.
pub const CS_PASS: f32 = 0.80;
/// Structure term: reject below.
pub const CS_REJECT: f32 = 0.65;
/// GMSD: pass at or below.
pub const GMSD_PASS: f32 = 0.10;
/// GMSD: reject above.
pub const GMSD_REJECT: f32 = 0.15;
/// Mean ΔE00 colour drift that is fine (≈ a slight re-exposure).
pub const DRIFT_OK: f32 = 5.0;
/// Mean ΔE00 colour drift that means the room was recoloured or re-lit.
pub const DRIFT_REJECT: f32 = 10.0;
/// ΔE00 above which a pixel counts as changed.
pub const CHANGED_DE: f32 = 20.0;
/// Changed area (share of the frame, outside the mask) that always fails.
pub const CHANGED_MAX: f32 = 0.06;
/// Changed area allowed when the structure is in the grey zone.
pub const CHANGED_GREY_MAX: f32 = 0.03;
/// Largest accepted shift, as a share of the frame width / height.
pub const MAX_SHIFT: f32 = 0.03;
/// Largest accepted change of aspect ratio (|ln(ratio)|).
pub const MAX_ASPECT_CHANGE: f32 = 0.2;
/// CIEDE2000 radius (kL = 2) of a signature colour family.
pub const ELF_DE_MAX: f32 = 14.0;
/// Pixels less chromatic than this never match (greys, whites, blacks).
pub const ELF_MIN_CHROMA: f32 = 10.0;
/// Primary colour area for an elf to be present (share of the frame; an elf
/// 25 cm tall in a room photo covers 1–6 %, its tunic a third of that).
pub const ELF_MIN_PRIMARY: f32 = 0.0015;
/// Accent colour area required next to the primary one.
pub const ELF_MIN_ACCENT: f32 = 0.0005;
/// Colours shared by all the elves that are no one's signature (felt skin:
/// faces, ears, rosy cheeks), used as decoys in the colour assignment.
pub const DECOYS: [&str; 3] = ["#ebc8af", "#e0b49b", "#f0b4a0"];
/// ΔE00 change at a pixel that makes a signature-coloured pixel "new" even
/// when the photo already had a similar colour there.
pub const NEW_DE: f32 = 10.0;
/// Smallest patch kept (share of the frame).
pub const MIN_PATCH: f32 = 0.0002;
/// Largest distance between primary and accent patches (share of height).
pub const ELF_NEAR: f32 = 0.3;
/// Separate large primary clusters of one elf that suggest extra elves.
pub const EXTRA_CLUSTERS: usize = 3;
/// Generated picture is too dark below this mean luma…
pub const DARK_ABS: f32 = 0.10;
/// …when it is also darker than this share of the photo's mean luma.
pub const DARK_REL: f32 = 0.6;
/// Below this luma standard deviation the picture is blank.
pub const BLANK_STD: f32 = 0.015;

/// A normalised rectangle (0–1).
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
pub struct Rect {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

/// What to verify: the requested elves (1–3 bible ids) and optional areas
/// where they were asked to be (e.g. the analysis stages).
#[derive(Clone, Debug, PartialEq, Default)]
pub struct VerifyRequest {
    pub elves: Vec<String>,
    pub mask: Vec<Rect>,
}

impl VerifyRequest {
    /// Parses `["pepin", …]` or `{"elves": [...], "mask": [{x,y,w,h}, …]}`.
    pub fn from_json(s: &str) -> Result<VerifyRequest> {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum In {
            List(Vec<String>),
            Obj {
                elves: Vec<String>,
                #[serde(default)]
                mask: Vec<Rect>,
            },
        }
        let v: In = serde_json::from_str(s).map_err(|e| EngineError::BadInput(format!("elves_json: {e}")))?;
        let (elves, mask) = match v {
            In::List(e) => (e, Vec::new()),
            In::Obj { elves, mask } => (elves, mask),
        };
        let mask = mask
            .into_iter()
            .take(8)
            .filter(|r| [r.x, r.y, r.w, r.h].iter().all(|v| v.is_finite()))
            .map(|r| {
                let x = r.x.clamp(0.0, 1.0);
                let y = r.y.clamp(0.0, 1.0);
                Rect { x, y, w: r.w.clamp(0.0, 1.0 - x), h: r.h.clamp(0.0, 1.0 - y) }
            })
            .collect();
        let req = VerifyRequest { elves, mask };
        req.validate()?;
        Ok(req)
    }

    fn validate(&self) -> Result<()> {
        if self.elves.is_empty() || self.elves.len() > 3 {
            return Err(EngineError::BadInput(format!("1–3 elves expected, got {}", self.elves.len())));
        }
        for (i, id) in self.elves.iter().enumerate() {
            if bible().elf(id).is_none() {
                return Err(EngineError::BadInput(format!("unknown elf id {id:?}")));
            }
            if self.elves[..i].contains(id) {
                return Err(EngineError::BadInput(format!("elf {id:?} listed twice")));
            }
        }
        Ok(())
    }
}

/// Room metrics.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct RoomCheck {
    pub ok: bool,
    /// Mean SSIM contrast·structure term outside the mask (1 = identical).
    pub structure: f32,
    /// Mean full SSIM outside the mask.
    pub ssim: f32,
    /// Gradient magnitude similarity deviation (0 = identical).
    pub gmsd: f32,
    /// Mean CIEDE2000 colour drift outside the mask.
    pub drift: f32,
    /// Share of the frame outside the mask whose colour moved by ΔE00 > 20.
    pub changed: f32,
    /// Pearson correlation of the edge maps outside the mask.
    pub edge_corr: f32,
    /// Share of the frame left out of these metrics.
    pub masked: f32,
}

/// The alignment found (shift as a share of the frame).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct AlignCheck {
    pub dx: f32,
    pub dy: f32,
    pub scale: f32,
    pub peak: f32,
}

/// One requested elf.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct ElfCheck {
    pub id: String,
    pub present: bool,
    /// New primary-colour area (share of the frame).
    pub primary: f32,
    /// New accent-colour area near a primary patch (share of the frame).
    pub accent: f32,
    /// Separate large primary clusters.
    pub clusters: u32,
}

/// The result of [`verify`].
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Verification {
    pub ok: bool,
    /// 0–1 overall quality, to pick the best of several attempts.
    pub score: f32,
    /// Machine-readable failure reasons, in a fixed order:
    /// `framing_changed`, `room_changed`, `room_recolored`,
    /// `elf_missing:<id>`…, `extra_elves`, `too_dark`, `blank`.
    pub reasons: Vec<String>,
    pub room: RoomCheck,
    pub align: AlignCheck,
    pub elves: Vec<ElfCheck>,
    pub extra_elves: bool,
    /// Mean luma (0–1) of the generated picture and of the photo.
    pub brightness_generated: f32,
    pub brightness_original: f32,
}

fn luma_plane(img: &RgbaImage) -> Plane {
    Plane { data: img.data.chunks_exact(4).map(|p| luma8(p[0], p[1], p[2])).collect(), w: img.w, h: img.h }
}

/// Resamples `g` with the alignment; pixels that fall outside are taken from
/// `fill` and flagged invalid.
fn warp(g: &RgbaImage, fill: &RgbaImage, a: &Alignment) -> (RgbaImage, Vec<bool>) {
    let (w, h) = (g.w, g.h);
    if a.dx == 0.0 && a.dy == 0.0 && a.scale == 1.0 {
        return (g.clone(), vec![true; w * h]);
    }
    let mut out = RgbaImage::new(w, h);
    let mut valid = vec![false; w * h];
    for y in 0..h {
        for x in 0..w {
            let (sx, sy) = map_point(a, w, h, x as f32, y as f32);
            let i = (y * w + x) * 4;
            if sx < -0.5 || sy < -0.5 || sx > w as f32 - 0.5 || sy > h as f32 - 0.5 {
                out.data[i..i + 4].copy_from_slice(&fill.data[i..i + 4]);
                continue;
            }
            valid[y * w + x] = true;
            let sx = sx.clamp(0.0, (w - 1) as f32);
            let sy = sy.clamp(0.0, (h - 1) as f32);
            let (x0, y0) = (sx.floor() as usize, sy.floor() as usize);
            let (x1, y1) = ((x0 + 1).min(w - 1), (y0 + 1).min(h - 1));
            let (fx, fy) = (sx - x0 as f32, sy - y0 as f32);
            for c in 0..4 {
                let p = |xx: usize, yy: usize| g.data[(yy * w + xx) * 4 + c] as f32;
                let v = (p(x0, y0) * (1.0 - fx) + p(x1, y0) * fx) * (1.0 - fy)
                    + (p(x0, y1) * (1.0 - fx) + p(x1, y1) * fx) * fy;
                out.data[i + c] = (v + 0.5).clamp(0.0, 255.0) as u8;
            }
        }
    }
    (out, valid)
}

/// Per-pixel SSIM and its contrast·structure term (luma in 0–255).
fn ssim_maps(x: &Plane, y: &Plane) -> (Plane, Plane) {
    const C1: f32 = (0.01 * 255.0) * (0.01 * 255.0);
    const C2: f32 = (0.03 * 255.0) * (0.03 * 255.0);
    let (w, h) = (x.w, x.h);
    let prod = |a: &Plane, b: &Plane| Plane { data: a.data.iter().zip(&b.data).map(|(p, q)| p * q).collect(), w, h };
    let mx = gaussian(x, 1.5);
    let my = gaussian(y, 1.5);
    let sxx = gaussian(&prod(x, x), 1.5);
    let syy = gaussian(&prod(y, y), 1.5);
    let sxy = gaussian(&prod(x, y), 1.5);
    let mut ssim = Plane::new(w, h);
    let mut cs = Plane::new(w, h);
    for i in 0..w * h {
        let (ux, uy) = (mx.data[i], my.data[i]);
        let vx = (sxx.data[i] - ux * ux).max(0.0);
        let vy = (syy.data[i] - uy * uy).max(0.0);
        let cxy = sxy.data[i] - ux * uy;
        let c = (2.0 * cxy + C2) / (vx + vy + C2);
        let l = (2.0 * ux * uy + C1) / (ux * ux + uy * uy + C1);
        cs.data[i] = c;
        ssim.data[i] = l * c;
    }
    (ssim, cs)
}

/// An 8-connected patch.
#[derive(Clone, Copy, Debug)]
struct Patch {
    area: usize,
    cx: f32,
    cy: f32,
    bbox: [usize; 4],
}

fn patches(mask: &[bool], w: usize, h: usize, min_area: usize) -> Vec<Patch> {
    let mut seen = vec![false; w * h];
    let mut out = Vec::new();
    let mut stack = Vec::new();
    for start in 0..w * h {
        if !mask[start] || seen[start] {
            continue;
        }
        seen[start] = true;
        stack.push(start);
        let (mut area, mut sx, mut sy) = (0usize, 0.0f64, 0.0f64);
        let mut bbox = [w, h, 0, 0];
        while let Some(i) = stack.pop() {
            let (x, y) = (i % w, i / w);
            area += 1;
            sx += x as f64;
            sy += y as f64;
            bbox = [bbox[0].min(x), bbox[1].min(y), bbox[2].max(x + 1), bbox[3].max(y + 1)];
            for dy in -1isize..=1 {
                for dx in -1isize..=1 {
                    let (nx, ny) = (x as isize + dx, y as isize + dy);
                    if nx < 0 || ny < 0 || nx >= w as isize || ny >= h as isize {
                        continue;
                    }
                    let j = ny as usize * w + nx as usize;
                    if mask[j] && !seen[j] {
                        seen[j] = true;
                        stack.push(j);
                    }
                }
            }
        }
        if area >= min_area {
            out.push(Patch { area, cx: (sx / area as f64) as f32, cy: (sy / area as f64) as f32, bbox });
        }
    }
    out
}

/// Groups patches whose bounding boxes are within `gap` pixels and returns
/// the group areas.
fn cluster_areas(ps: &[Patch], gap: usize) -> Vec<usize> {
    let n = ps.len();
    let mut parent: Vec<usize> = (0..n).collect();
    fn find(p: &mut [usize], i: usize) -> usize {
        let mut i = i;
        while p[i] != i {
            p[i] = p[p[i]];
            i = p[i];
        }
        i
    }
    for i in 0..n {
        for j in i + 1..n {
            let (a, b) = (ps[i].bbox, ps[j].bbox);
            let gx = a[0].saturating_sub(b[2]).max(b[0].saturating_sub(a[2]));
            let gy = a[1].saturating_sub(b[3]).max(b[1].saturating_sub(a[3]));
            if gx <= gap && gy <= gap {
                let (ri, rj) = (find(&mut parent, i), find(&mut parent, j));
                parent[ri] = rj;
            }
        }
    }
    let mut areas = vec![0usize; n];
    for (i, p) in ps.iter().enumerate() {
        let r = find(&mut parent, i);
        areas[r] += p.area;
    }
    areas.into_iter().filter(|&a| a > 0).collect()
}

/// Distance of `p` to the closest colour of a family, if within the radius.
#[inline]
fn family_distance(p: Lab, family: &[Lab]) -> Option<f32> {
    if p.chroma() < ELF_MIN_CHROMA {
        return None;
    }
    family
        .iter()
        .filter(|&&s| delta_e76(p, s) < 3.5 * ELF_DE_MAX)
        .map(|&s| delta_e2000(p, s, 2.0, 1.0, 1.0))
        .filter(|&d| d <= ELF_DE_MAX)
        .min_by(|a, b| a.total_cmp(b))
}

struct ElfEval {
    primary: f32,
    accent: f32,
    clusters: usize,
    primary_ok: bool,
    accent_ok: bool,
}

/// Evaluates every elf of the bible (requested or not).
///
/// Each pixel whose colour falls in one or more signature families is given
/// to the **closest** family only (a mustard scarf must not also count as a
/// hazelnut cape). It is *new* if, at the same place, the photo did not match
/// that family or had a clearly different colour (ΔE00 > [`NEW_DE`]).
fn eval_elves(
    lab_g: &[Lab],
    lab_o: &[Lab],
    valid: &[bool],
    ills: ([f32; 3], [f32; 3]),
    w: usize,
    h: usize,
) -> Vec<ElfEval> {
    let lut = srgb_lut();
    let adapt = |cols: &[[u8; 3]], ill: [f32; 3]| -> Vec<Lab> {
        cols.iter().map(|c| bradford_adapt([lut[c[0] as usize], lut[c[1] as usize], lut[c[2] as usize]], ill)).collect()
    };
    let sigs: Vec<_> = bible().elves.iter().map(signature).collect();
    // Families: (elf index, is_accent, colours adapted to the generation, to the photo).
    let mut fams: Vec<(usize, bool, Vec<Lab>, Vec<Lab>)> = Vec::new();
    for (e, sig) in sigs.iter().enumerate() {
        fams.push((e, false, adapt(&sig.primary, ills.0), adapt(&sig.primary, ills.1)));
        fams.push((e, true, adapt(&sig.accent, ills.0), adapt(&sig.accent, ills.1)));
    }
    // Decoys: colours of every elf that belong to no signature (the
    // pink-beige felt faces and ears). Under a warm lamp they drift towards
    // hazelnut; a pixel closer to a decoy is nobody's.
    let decoy_elf = usize::MAX;
    for d in DECOYS {
        let c = [crate::color::parse_hex(d).expect("decoy hex")];
        fams.push((decoy_elf, false, adapt(&c, ills.0), adapt(&c, ills.1)));
    }
    let n = w * h;
    let mut masks = vec![vec![false; n]; fams.len()];
    for i in 0..n {
        if !valid[i] {
            continue;
        }
        let best = fams
            .iter()
            .enumerate()
            .filter_map(|(f, fam)| family_distance(lab_g[i], &fam.2).map(|d| (f, d)))
            .min_by(|a, b| a.1.total_cmp(&b.1));
        if let Some((f, _)) = best.filter(|b| fams[b.0].0 != decoy_elf) {
            let was = family_distance(lab_o[i], &fams[f].3).is_some();
            if !was || delta_e2000(lab_g[i], lab_o[i], 1.0, 1.0, 1.0) > NEW_DE {
                masks[f][i] = true;
            }
        }
    }
    let nf = n as f32;
    let min_patch = ((MIN_PATCH * nf).ceil() as usize).max(2);
    let gap = ((0.03 * ((w * w + h * h) as f32).sqrt()).round() as usize).max(1);
    let big = (ELF_MIN_PRIMARY * nf).ceil() as usize;
    let near = ELF_NEAR * h as f32;
    sigs.iter()
        .enumerate()
        .map(|(e, sig)| {
            let fam = |accent: bool| fams.iter().position(|f| f.0 == e && f.1 == accent).expect("family");
            let prim = patches(&masks[fam(false)], w, h, min_patch);
            let acc = patches(&masks[fam(true)], w, h, min_patch);
            let primary = prim.iter().map(|p| p.area).sum::<usize>() as f32 / nf;
            let accent = acc
                .iter()
                .filter(|a| prim.iter().any(|p| ((a.cx - p.cx).powi(2) + (a.cy - p.cy).powi(2)).sqrt() <= near))
                .map(|a| a.area)
                .sum::<usize>() as f32
                / nf;
            let clusters = cluster_areas(&prim, gap).into_iter().filter(|&a| a >= big).count();
            ElfEval {
                primary,
                accent,
                clusters,
                primary_ok: primary >= ELF_MIN_PRIMARY,
                accent_ok: !sig.needs_accent || accent >= ELF_MIN_ACCENT,
            }
        })
        .collect()
}

/// Verifies `generated` against `original` for the elves in `req`.
pub fn verify(generated: RgbaView<'_>, original: RgbaView<'_>, req: &VerifyRequest) -> Result<Verification> {
    req.validate()?;
    let (w, h) = fit_within(original.w, original.h, VERIFY_SIDE);
    let o = resize_hq(original, w, h);
    let g0 = resize_hq(generated, w, h);
    let n = w * h;

    // 1. Alignment.
    let aspect = ((generated.w as f32 / generated.h as f32) / (original.w as f32 / original.h as f32)).ln().abs();
    let yo = luma_plane(&o);
    let al =
        if w >= 16 && h >= 16 { align::estimate(&blur5(&yo), &blur5(&luma_plane(&g0))) } else { Alignment::IDENTITY };
    let (g, valid) = warp(&g0, &o, &al);
    let shift = (al.dx.abs() / w as f32).max(al.dy.abs() / h as f32);
    let framing_changed = aspect > MAX_ASPECT_CHANGE || shift > MAX_SHIFT || al.scale != 1.0;

    // Planes.
    let yg = luma_plane(&g);
    let to255 = |p: &Plane| Plane { data: p.data.iter().map(|v| v * 255.0).collect(), w, h };
    let (bo, bg) = (to255(&blur5(&yo)), to255(&blur5(&yg)));
    let (ssim, cs) = ssim_maps(&bo, &bg);
    let lab_o: Vec<Lab> = o.data.chunks_exact(4).map(|p| srgb8_to_lab(p[0], p[1], p[2])).collect();
    let lab_g: Vec<Lab> = g.data.chunks_exact(4).map(|p| srgb8_to_lab(p[0], p[1], p[2])).collect();

    // 2. Mask.
    let (cw, ch) = (w.div_ceil(CELL), h.div_ceil(CELL));
    let mut change = vec![(0.0f32, 0usize); cw * ch];
    for y in 0..h {
        for x in 0..w {
            let i = y * w + x;
            let c = &mut change[(y / CELL) * cw + x / CELL];
            c.0 += 1.0 - ssim.data[i] + delta_e76(lab_o[i], lab_g[i]) / 50.0;
            c.1 += 1;
        }
    }
    let mut order: Vec<usize> = (0..cw * ch).collect();
    order.sort_by(|&a, &b| {
        let (ca, cb) = (change[a].0 / change[a].1 as f32, change[b].0 / change[b].1 as f32);
        cb.total_cmp(&ca).then(a.cmp(&b))
    });
    let mut cell_masked = vec![false; cw * ch];
    // Never all the cells (a tiny picture is a single cell).
    let n_ignore = ((IGNORE_FRACTION * (cw * ch) as f32).ceil() as usize).min(cw * ch - 1);
    for &c in order.iter().take(n_ignore) {
        cell_masked[c] = true;
    }
    for r in &req.mask {
        // Dilate by 20 %.
        let (dx, dy) = (r.w * 0.1, r.h * 0.1);
        let x0 = (((r.x - dx).max(0.0) * w as f32) as usize / CELL).min(cw);
        let y0 = (((r.y - dy).max(0.0) * h as f32) as usize / CELL).min(ch);
        let x1 = ((((r.x + r.w + dx).min(1.0) * w as f32).ceil() as usize).div_ceil(CELL)).min(cw);
        let y1 = ((((r.y + r.h + dy).min(1.0) * h as f32).ceil() as usize).div_ceil(CELL)).min(ch);
        for cy in y0..y1 {
            for cx in x0..x1 {
                cell_masked[cy * cw + cx] = true;
            }
        }
    }
    let mut masked: Vec<bool> =
        (0..n).map(|i| !valid[i] || cell_masked[(i / w / CELL) * cw + (i % w) / CELL]).collect();
    if masked.iter().all(|m| *m) {
        // The caller's rectangles cover everything: judge the whole picture.
        masked = valid.iter().map(|v| !v).collect();
        if masked.iter().all(|m| *m) {
            masked = vec![false; n];
        }
    }
    let kept = masked.iter().filter(|m| !**m).count().max(1);

    // 3. Room metrics.
    let mean_kept =
        |p: &Plane| p.data.iter().zip(&masked).filter(|(_, m)| !**m).map(|(v, _)| *v as f64).sum::<f64>() / kept as f64;
    let structure = mean_kept(&cs) as f32;
    let ssim_mean = mean_kept(&ssim) as f32;
    let (mo, mg) = (prewitt_magnitude(&bo), prewitt_magnitude(&bg));
    const T: f32 = 170.0;
    let gms = Plane {
        data: mo.data.iter().zip(&mg.data).map(|(a, b)| (2.0 * a * b + T) / (a * a + b * b + T)).collect(),
        w,
        h,
    };
    let gms_mean = mean_kept(&gms);
    let gmsd =
        (gms.data.iter().zip(&masked).filter(|(_, m)| !**m).map(|(v, _)| (*v as f64 - gms_mean).powi(2)).sum::<f64>()
            / kept as f64)
            .sqrt() as f32;
    let edge_corr = {
        let (ox, oy) = sobel(&bo);
        let (gx, gy) = sobel(&bg);
        let (mut so, mut sg, mut soo, mut sgg, mut sog) = (0.0f64, 0.0f64, 0.0f64, 0.0f64, 0.0f64);
        for (i, _) in masked.iter().enumerate().filter(|(_, m)| !**m) {
            let a = (ox.data[i].powi(2) + oy.data[i].powi(2)).sqrt() as f64;
            let b = (gx.data[i].powi(2) + gy.data[i].powi(2)).sqrt() as f64;
            so += a;
            sg += b;
            soo += a * a;
            sgg += b * b;
            sog += a * b;
        }
        let k = kept as f64;
        let cov = sog / k - (so / k) * (sg / k);
        let den = ((soo / k - (so / k).powi(2)) * (sgg / k - (sg / k).powi(2))).sqrt();
        if den > 1e-9 {
            (cov / den) as f32
        } else if cov.abs() < 1e-9 && (soo - sgg).abs() < 1e-6 {
            1.0
        } else {
            0.0
        }
    };
    // Colour drift and changed area at ¼ resolution (cells of 16 px = 4 px there).
    let (o4, g4) = (box_reduce(o.view(), 4), box_reduce(g.view(), 4));
    let (w4, h4) = (o4.w, o4.h);
    let (mut drift_sum, mut drift_n, mut changed_n) = (0.0f64, 0usize, 0usize);
    for y in 0..h4 {
        for x in 0..w4 {
            // Masked if any source pixel is masked.
            let any_masked =
                (y * 4..((y + 1) * 4).min(h)).any(|sy| (x * 4..((x + 1) * 4).min(w)).any(|sx| masked[sy * w + sx]));
            if any_masked {
                continue;
            }
            let i = (y * w4 + x) * 4;
            let (a, b) = (&o4.data[i..i + 3], &g4.data[i..i + 3]);
            let d = delta_e2000(srgb8_to_lab(a[0], a[1], a[2]), srgb8_to_lab(b[0], b[1], b[2]), 1.0, 1.0, 1.0);
            drift_sum += d as f64;
            drift_n += 1;
            if d > CHANGED_DE {
                changed_n += 1;
            }
        }
    }
    let drift = if drift_n > 0 { (drift_sum / drift_n as f64) as f32 } else { 0.0 };
    let changed = changed_n as f32 / (w4 * h4) as f32;

    let structure_pass = structure >= CS_PASS && gmsd <= GMSD_PASS;
    let structure_fail = structure < CS_REJECT || gmsd > GMSD_REJECT;
    let room_changed = structure_fail
        || changed > CHANGED_MAX
        || (!structure_pass && (drift > DRIFT_OK || changed > CHANGED_GREY_MAX));
    let room_recolored = drift > DRIFT_REJECT;

    // 4. Elves.
    let ill_g = illuminant(&g);
    let ill_o = illuminant(&o);
    let evals = eval_elves(&lab_g, &lab_o, &valid, (ill_g, ill_o), w, h);
    let mut elves = Vec::new();
    let mut extra = false;
    for (e, ev) in bible().elves.iter().zip(evals) {
        let countable = signature(e).detect_unexpected;
        if let Some(pos) = req.elves.iter().position(|x| x == &e.id) {
            if countable && ev.clusters >= EXTRA_CLUSTERS {
                extra = true;
            }
            elves.push((
                pos,
                ElfCheck {
                    id: e.id.clone(),
                    present: ev.primary_ok && ev.accent_ok,
                    primary: r4(ev.primary),
                    accent: r4(ev.accent),
                    clusters: ev.clusters as u32,
                },
            ));
        } else if countable && ev.primary >= 2.0 * ELF_MIN_PRIMARY && ev.accent_ok {
            extra = true;
        }
    }
    elves.sort_by_key(|e| e.0);
    let elves: Vec<ElfCheck> = elves.into_iter().map(|e| e.1).collect();

    // Exposure.
    let bright_g = {
        let (s, k) = yg
            .data
            .iter()
            .zip(&valid)
            .filter(|(_, v)| **v)
            .fold((0.0f64, 0usize), |a, (y, _)| (a.0 + *y as f64, a.1 + 1));
        (s / k.max(1) as f64) as f32
    };
    let bright_o = yo.mean();
    let too_dark = bright_g < DARK_ABS && bright_g < DARK_REL * bright_o;
    let blank = yg.std() < BLANK_STD;

    let mut reasons = Vec::new();
    if framing_changed {
        reasons.push("framing_changed".to_string());
    }
    if room_changed {
        reasons.push("room_changed".to_string());
    }
    if room_recolored {
        reasons.push("room_recolored".to_string());
    }
    for e in &elves {
        if !e.present {
            reasons.push(format!("elf_missing:{}", e.id));
        }
    }
    if extra {
        reasons.push("extra_elves".to_string());
    }
    if too_dark {
        reasons.push("too_dark".to_string());
    }
    if blank {
        reasons.push("blank".to_string());
    }

    let room_ok = !room_changed && !room_recolored;
    let room_score = ((structure - 0.5) / 0.4).clamp(0.0, 1.0) * (1.0 - (drift - DRIFT_OK) / 10.0).clamp(0.0, 1.0);
    let elf_score = elves
        .iter()
        .map(|e| {
            let needs_accent = signature(bible().elf(&e.id).expect("validated")).needs_accent;
            0.7 * (e.primary / ELF_MIN_PRIMARY).min(1.0)
                + 0.3 * if needs_accent { (e.accent / ELF_MIN_ACCENT).min(1.0) } else { 1.0 }
        })
        .sum::<f32>()
        / elves.len().max(1) as f32;
    let mut score = 0.5 * room_score + 0.5 * elf_score;
    if extra {
        score -= 0.15;
    }
    if framing_changed {
        score -= 0.2;
    }
    if too_dark || blank {
        score -= 0.3;
    }

    Ok(Verification {
        ok: reasons.is_empty(),
        score: r4(score.clamp(0.0, 1.0)),
        reasons,
        room: RoomCheck {
            ok: room_ok,
            structure: r4(structure),
            ssim: r4(ssim_mean),
            gmsd: r4(gmsd),
            drift: r4(drift),
            changed: r4(changed),
            edge_corr: r4(edge_corr),
            masked: r4(1.0 - kept as f32 / n as f32),
        },
        align: AlignCheck { dx: r4(al.dx / w as f32), dy: r4(al.dy / h as f32), scale: al.scale, peak: r4(al.peak) },
        elves,
        extra_elves: extra,
        brightness_generated: r4(bright_g),
        brightness_original: r4(bright_o),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_parsing() {
        let r = VerifyRequest::from_json(r#"["pepin","noisette"]"#).unwrap();
        assert_eq!(r.elves, ["pepin", "noisette"]);
        let r = VerifyRequest::from_json(r#"{"elves":["grelotte"],"mask":[{"x":0.1,"y":0.5,"w":2,"h":0.3}]}"#).unwrap();
        assert_eq!(r.mask[0].w, 0.9);
        assert!(VerifyRequest::from_json(r#"[]"#).is_err());
        assert!(VerifyRequest::from_json(r#"["pepin","pepin"]"#).is_err());
        assert!(VerifyRequest::from_json(r#"["santa"]"#).is_err());
        assert!(VerifyRequest::from_json(r#"["a","b","c","d"]"#).is_err());
        assert!(VerifyRequest::from_json("nope").is_err());
    }

    #[test]
    fn patches_and_clusters() {
        let (w, h) = (20, 10);
        let mut m = vec![false; w * h];
        for (x, y) in [(1, 1), (2, 2), (3, 3), (15, 5), (16, 5), (10, 9)] {
            m[y * w + x] = true;
        }
        let ps = patches(&m, w, h, 2);
        assert_eq!(ps.len(), 2); // the diagonal (8-connected) and the pair; the single pixel is noise
        assert_eq!(ps[0].area, 3);
        assert_eq!(cluster_areas(&ps, 1).len(), 2);
        assert_eq!(cluster_areas(&ps, 20), vec![5]);
    }
}
