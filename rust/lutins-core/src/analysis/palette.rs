//! Dominant colours: weighted k-means in CIELAB.
//!
//! 1. Every pixel goes into a 15-bit colour histogram (5 bits per sRGB
//!    channel); each non-empty bin keeps its pixel count and its mean Lab
//!    colour. A photo has a few thousand bins instead of tens of thousands of
//!    pixels, and the result does not depend on pixel order.
//! 2. Deterministic seeding (a greedy k-means++): the heaviest bin first, then
//!    repeatedly the bin with the largest `weight × distance²` to its nearest
//!    centre. No random numbers: the same photo always gives the same palette.
//! 3. Lloyd iterations on the weighted bins (Euclidean distance in Lab, i.e.
//!    ΔE76, which is what k-means minimises) until the centres move less than
//!    0.05 ΔE or after 40 rounds. An emptied cluster is re-seeded at the bin
//!    farthest from its centre.
//! 4. Clusters sorted by share; centres converted back to sRGB hex.

use super::PaletteEntry;
use crate::color::{hex, lab_to_srgb8, srgb8_to_lab, Lab};
use crate::image::{r4, RgbaImage};

const MAX_ITERS: usize = 40;
const CONVERGED: f32 = 0.05;

#[inline]
fn d2(p: Lab, q: Lab) -> f32 {
    (p.l - q.l).powi(2) + (p.a - q.a).powi(2) + (p.b - q.b).powi(2)
}

/// The `k` dominant colours of an image, by decreasing share.
pub fn dominant_colors(img: &RgbaImage, k: usize) -> Vec<PaletteEntry> {
    // 1. Histogram.
    let mut count = vec![0u32; 1 << 15];
    let mut sum = vec![[0.0f32; 3]; 1 << 15];
    for p in img.data.chunks_exact(4) {
        let key = ((p[0] as usize >> 3) << 10) | ((p[1] as usize >> 3) << 5) | (p[2] as usize >> 3);
        let lab = srgb8_to_lab(p[0], p[1], p[2]);
        count[key] += 1;
        sum[key][0] += lab.l;
        sum[key][1] += lab.a;
        sum[key][2] += lab.b;
    }
    let mut pts: Vec<(Lab, f32)> = Vec::new();
    for key in 0..count.len() {
        let c = count[key];
        if c > 0 {
            let n = c as f32;
            pts.push((Lab::new(sum[key][0] / n, sum[key][1] / n, sum[key][2] / n), n));
        }
    }
    if pts.is_empty() || k == 0 {
        return Vec::new();
    }
    let total: f32 = pts.iter().map(|p| p.1).sum();
    let k = k.min(pts.len());

    // 2. Greedy k-means++ seeding.
    let mut centres: Vec<Lab> = Vec::with_capacity(k);
    let heaviest = pts.iter().enumerate().max_by(|a, b| a.1 .1.total_cmp(&b.1 .1).then(b.0.cmp(&a.0))).unwrap().0;
    centres.push(pts[heaviest].0);
    let mut nearest: Vec<f32> = pts.iter().map(|p| d2(p.0, centres[0])).collect();
    while centres.len() < k {
        let (best, _) = pts
            .iter()
            .zip(&nearest)
            .enumerate()
            .map(|(i, (p, &d))| (i, p.1 * d))
            .fold((0usize, -1.0f32), |acc, x| if x.1 > acc.1 { x } else { acc });
        let c = pts[best].0;
        centres.push(c);
        for (n, p) in nearest.iter_mut().zip(&pts) {
            *n = n.min(d2(p.0, c));
        }
    }

    // 3. Lloyd iterations.
    let mut assign = vec![0usize; pts.len()];
    let mut weights = vec![0.0f32; k];
    for _ in 0..MAX_ITERS {
        for (a, p) in assign.iter_mut().zip(&pts) {
            let mut best = (0usize, f32::INFINITY);
            for (j, c) in centres.iter().enumerate() {
                let d = d2(p.0, *c);
                if d < best.1 {
                    best = (j, d);
                }
            }
            *a = best.0;
        }
        let mut acc = vec![[0.0f64; 3]; k];
        weights.iter_mut().for_each(|w| *w = 0.0);
        for (&a, p) in assign.iter().zip(&pts) {
            acc[a][0] += (p.0.l * p.1) as f64;
            acc[a][1] += (p.0.a * p.1) as f64;
            acc[a][2] += (p.0.b * p.1) as f64;
            weights[a] += p.1;
        }
        let mut moved = 0.0f32;
        for j in 0..k {
            let new = if weights[j] > 0.0 {
                let w = weights[j] as f64;
                Lab::new((acc[j][0] / w) as f32, (acc[j][1] / w) as f32, (acc[j][2] / w) as f32)
            } else {
                // Re-seed an empty cluster at the worst-fitted bin.
                let far = pts
                    .iter()
                    .zip(&assign)
                    .enumerate()
                    .map(|(i, (p, &a))| (i, p.1 * d2(p.0, centres[a])))
                    .fold((0usize, -1.0f32), |acc, x| if x.1 > acc.1 { x } else { acc })
                    .0;
                pts[far].0
            };
            moved = moved.max(d2(new, centres[j]).sqrt());
            centres[j] = new;
        }
        if moved < CONVERGED {
            break;
        }
    }

    // 4. Output.
    let mut out: Vec<(Lab, f32)> = centres.into_iter().zip(weights).filter(|c| c.1 > 0.0).collect();
    out.sort_by(|a, b| b.1.total_cmp(&a.1));
    out.into_iter().map(|(c, w)| PaletteEntry { hex: hex(lab_to_srgb8(c)), share: r4(w / total) }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::color::parse_hex;

    fn stripes(cols: &[([u8; 3], usize)]) -> RgbaImage {
        let w: usize = cols.iter().map(|c| c.1).sum();
        let mut img = RgbaImage::new(w, 20);
        for y in 0..20 {
            let mut x = 0;
            for &(c, n) in cols {
                for _ in 0..n {
                    // Small noise so bins are not trivially single.
                    let j = ((x * 7 + y * 3) % 5) as u8;
                    img.set(x, y, [c[0].saturating_add(j), c[1].saturating_add(j), c[2].saturating_add(j), 255]);
                    x += 1;
                }
            }
        }
        img
    }

    #[test]
    fn finds_the_stripes_with_their_shares() {
        let img = stripes(&[([200, 40, 40], 50), ([40, 160, 60], 30), ([30, 30, 200], 20)]);
        let pal = dominant_colors(&img, 5);
        assert!(pal.len() >= 3);
        let shares: f32 = pal.iter().map(|p| p.share).sum();
        assert!((shares - 1.0).abs() < 1e-3);
        let near = |hexs: &str, want: [u8; 3]| {
            let c = parse_hex(hexs).unwrap();
            (0..3).all(|i| (c[i] as i32 - want[i] as i32).abs() < 12)
        };
        // The top three clusters account for the three stripes.
        let top3: f32 = pal.iter().take(3).map(|p| p.share).sum::<f32>();
        assert!(top3 > 0.6);
        assert!(pal.iter().any(|p| near(&p.hex, [202, 42, 42])), "{pal:?}");
        assert!(pal.iter().any(|p| near(&p.hex, [42, 162, 62])), "{pal:?}");
        assert!(pal.iter().any(|p| near(&p.hex, [32, 32, 202])), "{pal:?}");
        // The red stripe (half of the image) dominates once similar clusters are merged.
        let red: f32 = pal.iter().filter(|p| near(&p.hex, [202, 42, 42])).map(|p| p.share).sum();
        assert!(red > 0.3, "{pal:?}");
    }

    #[test]
    fn deterministic_and_small_inputs() {
        let img = stripes(&[([10, 20, 30], 3), ([250, 250, 250], 4)]);
        assert_eq!(dominant_colors(&img, 5), dominant_colors(&img, 5));
        let one = stripes(&[([128, 128, 128], 1)]);
        let pal = dominant_colors(&one, 5);
        assert!(!pal.is_empty() && pal.len() <= 5);
    }
}
