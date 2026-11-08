//! Stage finder: free, flat, well-lit areas where small elves can stand.
//!
//! Maps computed once on the working copy (≤ 256 px), each turned into a
//! summed-area table ([`Integral`]) so that any window's mean costs four
//! lookups:
//! - **edges**: Sobel magnitude of a lightly blurred Y′ combined with the
//!   chroma (a*, b*) gradients, soft-thresholded to 0–1 — objects and clutter
//!   have edges, empty table tops, floors and shelves do not;
//! - **saliency**: frequency-tuned saliency (Achanta et al., CVPR 2009),
//!   `‖Lab_blurred − mean Lab‖`, normalised by its 95th percentile — what
//!   stands out from the rest of the picture is an object, not a free surface;
//! - **horizontal edges**: edge pixels whose gradient is mostly vertical
//!   (`|gy| > 2|gx|`), i.e. lines like the front or back edge of a table, a
//!   shelf board, the line where a wall meets a surface;
//! - **luma** Y′.
//!
//! Then every window of 7 shapes (from 20 % × 16 % to 48 % × 22 % of the
//! frame), slid with a stride of 1⁄48 of the width, is scored
//! (weights sum to 1):
//! - `0.34 × flat`: 1 − edge density / [`EDGE_DENSITY_MAX`], taking the
//!   busiest of the window's four quadrants (a mug in one corner counts);
//! - `0.08 × calm`: 1 − mean saliency;
//! - `0.16 × lit`: mean Y′ relative to the image's 90th percentile (so night
//!   photos still get stages), with blown-out areas (windows, lamps) halved;
//! - `0.22 × low`: preference for the lower two thirds, where surfaces are
//!   (walls are flat and lit too, but elves cannot stand on them);
//! - `0.12 × shelf`: share of the window's width (widened by half on each
//!   side, so only long lines count) under which a horizontal edge runs in a
//!   band just above the window (a table or shelf top);
//! - `0.08 × size`: bigger is better, up to 12 % of the frame;
//! - minus a penalty for each image border the window touches (top 0.12,
//!   others 0.06): elves cut by the frame look wrong.
//!
//! Windows with an edge density above twice the maximum or nearly no light are
//! dropped. Finally a greedy non-maximum suppression keeps the best windows
//! that overlap the already kept ones by less than 30 % of the smaller area,
//! up to [`MAX_STAGES`], with a score of at least [`MIN_STAGE_SCORE`].

use super::{smoothstep, Stage, StagePos, Work};
use crate::filters::{blur5, box_blur, magnitude, sobel, Integral};
use crate::image::{r4, Plane};

/// At most this many stages are returned.
pub const MAX_STAGES: usize = 4;
/// Stages scoring less are not returned.
pub const MIN_STAGE_SCORE: f32 = 0.5;
/// Edge density (share of edge pixels) at which a window stops being "flat".
pub const EDGE_DENSITY_MAX: f32 = 0.22;
/// Share of the window width a horizontal edge must span to set `below_edge`.
pub const BELOW_EDGE_SPAN: f32 = 0.5;

/// Window shapes as (width, height) fractions of the frame.
const SHAPES: [(f32, f32); 7] =
    [(0.20, 0.16), (0.26, 0.18), (0.30, 0.24), (0.36, 0.20), (0.40, 0.28), (0.22, 0.24), (0.48, 0.22)];
/// Soft edge threshold on the gradient magnitude (Y′ units).
const EDGE_LO: f32 = 0.03;
const EDGE_HI: f32 = 0.08;

struct Maps {
    edges: Integral,
    sal: Integral,
    hedge: Integral,
    luma: Integral,
    p90: f32,
}

fn maps(work: &Work) -> Maps {
    let (w, h) = (work.luma.w, work.luma.h);
    let yb = blur5(&work.luma);
    let (gx, gy) = sobel(&yb);
    let mag_y = magnitude(&gx, &gy);
    // Chroma gradients (a*, b* scaled to roughly Y′ units).
    let a = Plane { data: work.lab.iter().map(|c| c.a / 100.0).collect(), w, h };
    let b = Plane { data: work.lab.iter().map(|c| c.b / 100.0).collect(), w, h };
    let (ax, ay) = sobel(&blur5(&a));
    let (bx, by) = sobel(&blur5(&b));
    let mag_c = Plane {
        data: (0..w * h)
            .map(|i| (ax.data[i].powi(2) + ay.data[i].powi(2) + bx.data[i].powi(2) + by.data[i].powi(2)).sqrt())
            .collect(),
        w,
        h,
    };
    let soft = |m: f32| ((m - EDGE_LO) / (EDGE_HI - EDGE_LO)).clamp(0.0, 1.0);
    let edges = Plane { data: (0..w * h).map(|i| soft(mag_y.data[i].max(0.8 * mag_c.data[i]))).collect(), w, h };
    let hedge = Plane {
        data: (0..w * h)
            .map(|i| {
                let (x, y) = (gx.data[i].abs(), gy.data[i].abs());
                if y > 2.0 * x {
                    soft(y)
                } else {
                    0.0
                }
            })
            .collect(),
        w,
        h,
    };
    // Frequency-tuned saliency.
    let n = (w * h) as f32;
    let mean = work.lab.iter().fold([0.0f32; 3], |m, c| [m[0] + c.l / n, m[1] + c.a / n, m[2] + c.b / n]);
    let l = Plane { data: work.lab.iter().map(|c| c.l).collect(), w, h };
    let (lb, ab, bb) = (box_blur(&box_blur(&l, 1), 1), box_blur(&box_blur(&a, 1), 1), box_blur(&box_blur(&b, 1), 1));
    let mut sal = Plane {
        data: (0..w * h)
            .map(|i| {
                ((lb.data[i] - mean[0]).powi(2)
                    + (ab.data[i] * 100.0 - mean[1]).powi(2)
                    + (bb.data[i] * 100.0 - mean[2]).powi(2))
                .sqrt()
            })
            .collect(),
        w,
        h,
    };
    let s95 = sal.quantile(0.95).max(1.0);
    sal.data.iter_mut().for_each(|v| *v = (*v / s95).min(1.0));
    Maps {
        edges: Integral::new(&edges),
        sal: Integral::new(&sal),
        hedge: Integral::new(&hedge),
        luma: Integral::new(&work.luma),
        p90: work.luma.quantile(0.9),
    }
}

/// Finds up to [`MAX_STAGES`] stages, best first.
pub fn find_stages(work: &Work) -> Vec<Stage> {
    let (w, h) = (work.luma.w, work.luma.h);
    if w < 16 || h < 16 {
        return Vec::new();
    }
    let m = maps(work);
    let (wf, hf) = (w as f32, h as f32);
    let stride = (w / 48).max(1);
    let border = (0.015 * wf.max(hf)).ceil() as usize;
    let mut cands: Vec<(f32, [usize; 4], bool)> = Vec::new();
    for &(fw, fh) in &SHAPES {
        let (ww, wh) = (((fw * wf).round() as usize).max(4), ((fh * hf).round() as usize).max(4));
        if ww >= w || wh >= h {
            continue;
        }
        let mut y0 = 0;
        while y0 + wh <= h {
            let mut x0 = 0;
            while x0 + ww <= w {
                let (x1, y1) = (x0 + ww, y0 + wh);
                if let Some((s, below)) = score(&m, [x0, y0, x1, y1], w, h, border) {
                    cands.push((s, [x0, y0, x1, y1], below));
                }
                x0 += stride;
            }
            y0 += stride;
        }
    }
    // Deterministic order: score, then position.
    cands.sort_by(|a, b| b.0.total_cmp(&a.0).then(a.1.cmp(&b.1)));
    let mut kept: Vec<(f32, [usize; 4], bool)> = Vec::new();
    for c in cands {
        if c.0 < MIN_STAGE_SCORE || kept.len() >= MAX_STAGES {
            break;
        }
        if kept.iter().all(|k| overlap(&k.1, &c.1) < 0.3) {
            kept.push(c);
        }
    }
    kept.into_iter()
        .map(|(s, r, below)| {
            let (x, y) = (r[0] as f32 / wf, r[1] as f32 / hf);
            let (sw, sh) = ((r[2] - r[0]) as f32 / wf, (r[3] - r[1]) as f32 / hf);
            Stage {
                x: r4(x),
                y: r4(y),
                w: r4(sw),
                h: r4(sh),
                score: r4(s),
                label: StagePos::of(x + sw / 2.0, y + sh / 2.0),
                below_edge: below,
            }
        })
        .collect()
}

/// Intersection over the smaller area.
fn overlap(a: &[usize; 4], b: &[usize; 4]) -> f32 {
    let ix = a[2].min(b[2]).saturating_sub(a[0].max(b[0]));
    let iy = a[3].min(b[3]).saturating_sub(a[1].max(b[1]));
    let area = |r: &[usize; 4]| ((r[2] - r[0]) * (r[3] - r[1])) as f32;
    (ix * iy) as f32 / area(a).min(area(b)).max(1.0)
}

fn score(m: &Maps, r: [usize; 4], w: usize, h: usize, border: usize) -> Option<(f32, bool)> {
    let [x0, y0, x1, y1] = r;
    // Edge density of the busiest quadrant: a small object in one corner of a
    // big window must not be averaged away.
    let (xm, ym) = ((x0 + x1) / 2, (y0 + y1) / 2);
    let density = [(x0, y0, xm, ym), (xm, y0, x1, ym), (x0, ym, xm, y1), (xm, ym, x1, y1)]
        .iter()
        .map(|&(a, b, c, d)| m.edges.mean(a, b, c, d) as f32)
        .fold(0.0f32, f32::max);
    if density > 2.0 * EDGE_DENSITY_MAX {
        return None;
    }
    let y_mean = m.luma.mean(x0, y0, x1, y1) as f32;
    let rel = y_mean / m.p90.max(0.05);
    let mut lit = smoothstep(0.25, 0.65, rel);
    if y_mean < 0.04 {
        lit = 0.0;
    }
    if y_mean > 0.96 {
        lit *= 0.5;
    }
    if lit < 0.1 {
        return None;
    }
    let flat = 1.0 - (density / EDGE_DENSITY_MAX).min(1.0);
    let calm = 1.0 - m.sal.mean(x0, y0, x1, y1) as f32;
    let cy = (y0 + y1) as f32 / 2.0 / h as f32;
    let low = smoothstep(0.30, 0.70, cy);
    // Horizontal edge in a band just above the window (and a sliver inside),
    // measured over the window's width widened by half on each side: a table
    // or shelf edge is a long line, the bottom of a mug is not.
    let band = ((0.06 * h as f32).ceil() as usize).max(3);
    let (b0, b1) = (y0.saturating_sub(band), (y0 + 2).min(h));
    let half = (x1 - x0) / 2;
    let hmean = m.hedge.mean(x0.saturating_sub(half), b0, (x1 + half).min(w), b1) as f32;
    // A 2-px line across the whole width gives hmean ≈ 2 / band_rows.
    let span = (hmean * (b1 - b0) as f32 / 2.0).clamp(0.0, 1.0);
    let shelf = if y0 > 0 { span } else { 0.0 };
    let below = shelf >= BELOW_EDGE_SPAN;
    let area = ((x1 - x0) * (y1 - y0)) as f32 / (w * h) as f32;
    let size = smoothstep(0.02, 0.12, area);
    let mut penalty = 0.0;
    if x0 < border {
        penalty += 0.06;
    }
    if x1 + border > w {
        penalty += 0.06;
    }
    if y1 + border > h {
        penalty += 0.06;
    }
    if y0 < border {
        penalty += 0.12;
    }
    let s = 0.34 * flat + 0.08 * calm + 0.16 * lit + 0.22 * low + 0.12 * shelf + 0.08 * size - penalty;
    Some((s.clamp(0.0, 1.0), below))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn overlap_ratio() {
        assert_eq!(overlap(&[0, 0, 10, 10], &[20, 20, 30, 30]), 0.0);
        assert_eq!(overlap(&[0, 0, 10, 10], &[0, 0, 5, 5]), 1.0);
        assert!((overlap(&[0, 0, 10, 10], &[5, 0, 15, 10]) - 0.5).abs() < 1e-6);
    }
}
