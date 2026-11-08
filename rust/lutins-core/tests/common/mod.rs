//! Synthetic test scenes (deterministic, no files).
#![allow(dead_code)]

use lutins_core::color::{linear_to_srgb, srgb_to_linear};
use lutins_core::rng::Rng;
use lutins_core::RgbaImage;

pub fn solid(w: usize, h: usize, c: [u8; 3]) -> RgbaImage {
    let mut img = RgbaImage::new(w, h);
    for p in img.data.chunks_exact_mut(4) {
        p.copy_from_slice(&[c[0], c[1], c[2], 255]);
    }
    img
}

pub fn fill_rect(img: &mut RgbaImage, x0: usize, y0: usize, x1: usize, y1: usize, c: [u8; 3]) {
    for y in y0..y1.min(img.h) {
        for x in x0..x1.min(img.w) {
            img.set(x, y, [c[0], c[1], c[2], 255]);
        }
    }
}

/// Adds deterministic Gaussian-ish noise of standard deviation `sigma` (0–255).
pub fn noise(img: &mut RgbaImage, sigma: f32, seed: u64) {
    let mut r = Rng::new(seed);
    for p in img.data.chunks_exact_mut(4) {
        // Sum of 4 uniforms ≈ normal.
        let n = (r.f32() + r.f32() + r.f32() + r.f32() - 2.0) * sigma * 1.732;
        for c in p.iter_mut().take(3) {
            *c = (*c as f32 + n).round().clamp(0.0, 255.0) as u8;
        }
    }
}

/// Multiplies every pixel by `cast` in linear light (a coloured light).
pub fn cast(img: &mut RgbaImage, cast: [f32; 3]) {
    for p in img.data.chunks_exact_mut(4) {
        for c in 0..3 {
            let lin = srgb_to_linear(p[c] as f32 / 255.0) * cast[c];
            p[c] = (linear_to_srgb(lin) * 255.0 + 0.5) as u8;
        }
    }
}

/// Gamma-like re-exposure, as edit models do.
pub fn reexpose(img: &mut RgbaImage, gain: f32, gamma: f32) {
    for p in img.data.chunks_exact_mut(4) {
        for c in p.iter_mut().take(3) {
            *c = (((*c as f32 / 255.0).powf(gamma) * gain).clamp(0.0, 1.0) * 255.0 + 0.5) as u8;
        }
    }
}

/// 3×3 box blur.
pub fn blur3(img: &RgbaImage) -> RgbaImage {
    let mut out = img.clone();
    for y in 0..img.h {
        for x in 0..img.w {
            for c in 0..3 {
                let mut s = 0u32;
                let mut n = 0u32;
                for dy in -1i32..=1 {
                    for dx in -1i32..=1 {
                        let (xx, yy) = (x as i32 + dx, y as i32 + dy);
                        if xx >= 0 && yy >= 0 && (xx as usize) < img.w && (yy as usize) < img.h {
                            s += img.data[(yy as usize * img.w + xx as usize) * 4 + c] as u32;
                            n += 1;
                        }
                    }
                }
                out.data[(y * img.w + x) * 4 + c] = ((s + n / 2) / n) as u8;
            }
        }
    }
    out
}

/// Shifts the content by (dx, dy) pixels, replicating the borders.
pub fn shift(img: &RgbaImage, dx: i32, dy: i32) -> RgbaImage {
    let mut out = img.clone();
    for y in 0..img.h {
        for x in 0..img.w {
            let sx = (x as i32 - dx).clamp(0, img.w as i32 - 1) as usize;
            let sy = (y as i32 - dy).clamp(0, img.h as i32 - 1) as usize;
            let i = (sy * img.w + sx) * 4;
            let p = [img.data[i], img.data[i + 1], img.data[i + 2], 255];
            out.set(x, y, p);
        }
    }
    out
}

/// A living-room-like scene: a wall with picture frames and a shelf, a
/// table top in the lower part with a mug and a book, textured floor strip.
pub fn room(w: usize, h: usize) -> RgbaImage {
    let mut img = RgbaImage::new(w, h);
    let table_y = h * 55 / 100;
    for y in 0..h {
        for x in 0..w {
            let c = if y < table_y {
                // Wall: soft cream with a gentle vertical gradient.
                let v = 0.82 - 0.1 * y as f32 / h as f32;
                [(230.0 * v) as u8, (220.0 * v) as u8, (200.0 * v) as u8]
            } else if y < h * 88 / 100 {
                // Table top: light wood with fine grain.
                let grain = (((x as f32 * 0.21 + y as f32 * 0.03).sin() * 0.5 + 0.5) * 10.0) as u8;
                [190 + grain, 150 + grain / 2, 105]
            } else {
                // Table front.
                [120, 88, 60]
            };
            img.set(x, y, [c[0], c[1], c[2], 255]);
        }
    }
    // Picture frames on the wall.
    fill_rect(&mut img, w * 10 / 100, h * 10 / 100, w * 28 / 100, h * 38 / 100, [60, 50, 45]);
    fill_rect(&mut img, w * 12 / 100, h * 13 / 100, w * 26 / 100, h * 35 / 100, [90, 130, 170]);
    fill_rect(&mut img, w * 62 / 100, h * 8 / 100, w * 86 / 100, h * 30 / 100, [50, 45, 40]);
    fill_rect(&mut img, w * 64 / 100, h * 11 / 100, w * 84 / 100, h * 27 / 100, [200, 120, 80]);
    // A lamp shade.
    fill_rect(&mut img, w * 40 / 100, h * 20 / 100, w * 50 / 100, h * 34 / 100, [240, 230, 190]);
    fill_rect(&mut img, w * 44 / 100, h * 34 / 100, w * 46 / 100, h * 55 / 100, [70, 60, 50]);
    // Mug and book on the right of the table.
    fill_rect(&mut img, w * 72 / 100, h * 48 / 100, w * 78 / 100, h * 62 / 100, [230, 230, 235]);
    fill_rect(&mut img, w * 82 / 100, h * 58 / 100, w * 96 / 100, h * 66 / 100, [40, 70, 140]);
    img
}

/// A completely different picture (an outdoor-ish scene).
pub fn other_scene(w: usize, h: usize) -> RgbaImage {
    let mut img = RgbaImage::new(w, h);
    for y in 0..h {
        for x in 0..w {
            let c = if y < h * 40 / 100 {
                [120, 170, 230]
            } else {
                let v = ((x as f32 * 0.07).sin() * (y as f32 * 0.11).cos() * 30.0) as i32;
                [(70 + v).clamp(0, 255) as u8, (140 + v).clamp(0, 255) as u8, 60]
            };
            img.set(x, y, [c[0], c[1], c[2], 255]);
        }
    }
    fill_rect(&mut img, w * 20 / 100, h * 15 / 100, w * 35 / 100, h * 70 / 100, [110, 80, 50]);
    fill_rect(&mut img, w * 55 / 100, h * 50 / 100, w * 90 / 100, h * 75 / 100, [200, 60, 60]);
    img
}

fn shade(c: [u8; 3], k: f32) -> [u8; 3] {
    [(c[0] as f32 * k).min(255.0) as u8, (c[1] as f32 * k).min(255.0) as u8, (c[2] as f32 * k).min(255.0) as u8]
}

/// Paints a felt-elf-like figure: a body ellipse in `body`, a hat triangle in
/// `hat`, a skin face, with left-to-right shading (0.75–1.05). `cx, base_y`:
/// bottom centre; `hgt`: total height in pixels.
pub fn paint_elf(img: &mut RgbaImage, cx: f32, base_y: f32, hgt: f32, body: [u8; 3], hat: [u8; 3]) {
    let bw = hgt * 0.42;
    let body_h = hgt * 0.5;
    let face_r = hgt * 0.14;
    for y in 0..img.h {
        for x in 0..img.w {
            let (fx, fy) = (x as f32 + 0.5, y as f32 + 0.5);
            let k = 0.75 + 0.3 * ((fx - (cx - bw)) / (2.0 * bw)).clamp(0.0, 1.0);
            // Body ellipse.
            let (ex, ey) = ((fx - cx) / (bw / 2.0), (fy - (base_y - body_h / 2.0)) / (body_h / 2.0));
            if ex * ex + ey * ey <= 1.0 {
                img.set(x, y, [shade(body, k)[0], shade(body, k)[1], shade(body, k)[2], 255]);
                continue;
            }
            // Face.
            let (dx, dy) = (fx - cx, fy - (base_y - body_h - face_r * 0.8));
            if dx * dx + dy * dy <= face_r * face_r {
                img.set(x, y, [235, 200, 175, 255]);
                continue;
            }
            // Hat: triangle above the face.
            let hat_base = base_y - body_h - face_r * 1.4;
            let hat_top = base_y - hgt;
            if fy >= hat_top && fy <= hat_base {
                let half = (fy - hat_top) / (hat_base - hat_top) * face_r * 1.3;
                if (fx - cx).abs() <= half {
                    let s = shade(hat, k);
                    img.set(x, y, [s[0], s[1], s[2], 255]);
                }
            }
        }
    }
}

pub const PEPIN: ([u8; 3], [u8; 3]) = ([58, 157, 79], [224, 49, 49]);
pub const GRELOTTE: ([u8; 3], [u8; 3]) = ([121, 80, 242], [252, 196, 25]);
pub const NOISETTE: ([u8; 3], [u8; 3]) = ([160, 97, 43], [130, 80, 35]);

/// The room with the three elves on the table, left part.
pub fn room_with_elves(w: usize, h: usize, which: &[&str]) -> RgbaImage {
    let mut img = room(w, h);
    let hgt = h as f32 * 0.22;
    let base = h as f32 * 0.8;
    for (i, id) in which.iter().enumerate() {
        let cx = w as f32 * (0.14 + 0.13 * i as f32);
        let (body, hat) = match *id {
            "pepin" => PEPIN,
            "grelotte" => GRELOTTE,
            _ => NOISETTE,
        };
        let size = if *id == "noisette" { hgt * 0.6 } else { hgt };
        paint_elf(&mut img, cx, base, size, body, hat);
    }
    img
}
