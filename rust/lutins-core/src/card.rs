//! The "magic card": an animated still rendered on the device when no AI video
//! is available (or while it is coming).
//!
//! Each frame is a pure function of `(photo, t, seed, style)`: the same `t`
//! always gives the same pixels, so the card can be scrubbed, looped or
//! rendered out of order.
//!
//! - **Ken Burns**: a slow zoom (`1 → 1 + zoom → 1`, a cosine so it loops
//!   seamlessly every `duration` seconds) with a pan in a direction picked by
//!   the seed, on a "cover" fit of the photo into the card. Sampling is
//!   bilinear in 16.16 fixed point: per row one vertical weight, per pixel two
//!   SWAR lerps that blend red+blue and green+alpha of packed `u32` pixels at
//!   once.
//! - **Vignette** and **glow pulse**: separable tables `v(x)·v(y)` (darker
//!   corners) and `g(x)·g(y)` (a warm golden glow in the middle that breathes
//!   with a 3.2 s period), applied in 8.8 fixed point.
//! - **Snow**: soft discs in three depth layers (far ones smaller, slower and
//!   fainter), falling with a gentle sideways sway and wrapping around.
//! - **Sparkles**: golden four-pointed stars that twinkle in place and drift
//!   up slowly, blended additively.
//!
//! [`CardRenderer`] precomputes everything that does not depend on `t` and
//! renders into its own buffer (no allocation per frame); [`render_card_frame`]
//! is the one-shot form.

use serde::Deserialize;

use crate::color::parse_hex;
use crate::image::{EngineError, Result, RgbaView};
use crate::rng::{mix64, Rng};

/// Card style; every field is optional (defaults in brackets).
#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(default)]
pub struct CardStyle {
    /// Output size [same as the photo], 16–2048.
    pub out_w: Option<u32>,
    pub out_h: Option<u32>,
    /// Loop length in seconds [12], 2–120.
    pub duration: f32,
    /// Extra zoom at the middle of the loop [0.08], 0–0.3.
    pub zoom: f32,
    /// Pan amount, share of the free margin [0.6], 0–1.
    pub pan: f32,
    /// Number of snowflakes [90], 0–400.
    pub snow: u32,
    /// Number of sparkles [24], 0–200.
    pub sparkles: u32,
    /// Vignette strength [0.35], 0–1.
    pub vignette: f32,
    /// Glow pulse strength [0.5], 0–1.
    pub glow: f32,
    /// Glow colour [`#ffd27a`].
    pub glow_color: String,
}

impl Default for CardStyle {
    fn default() -> Self {
        CardStyle {
            out_w: None,
            out_h: None,
            duration: 12.0,
            zoom: 0.08,
            pan: 0.6,
            snow: 90,
            sparkles: 24,
            vignette: 0.35,
            glow: 0.5,
            glow_color: "#ffd27a".into(),
        }
    }
}

impl CardStyle {
    /// Parses (empty string = defaults) and clamps every field.
    pub fn from_json(s: &str) -> Result<CardStyle> {
        let s = s.trim();
        let mut st: CardStyle = if s.is_empty() {
            CardStyle::default()
        } else {
            serde_json::from_str(s).map_err(|e| EngineError::BadInput(format!("style_json: {e}")))?
        };
        let fin = |v: f32, d: f32| if v.is_finite() { v } else { d };
        st.duration = fin(st.duration, 12.0).clamp(2.0, 120.0);
        st.zoom = fin(st.zoom, 0.08).clamp(0.0, 0.3);
        st.pan = fin(st.pan, 0.6).clamp(0.0, 1.0);
        st.snow = st.snow.min(400);
        st.sparkles = st.sparkles.min(200);
        st.vignette = fin(st.vignette, 0.35).clamp(0.0, 1.0);
        st.glow = fin(st.glow, 0.5).clamp(0.0, 1.0);
        st.out_w = st.out_w.map(|v| v.clamp(16, 2048));
        st.out_h = st.out_h.map(|v| v.clamp(16, 2048));
        Ok(st)
    }
}

#[derive(Clone, Copy, Debug)]
struct Flake {
    x0: f32,
    y0: f32,
    speed: f32,
    radius: f32,
    sway: f32,
    freq: f32,
    phase: f32,
    alpha: f32,
}

#[derive(Clone, Copy, Debug)]
struct Sparkle {
    x0: f32,
    y0: f32,
    size: f32,
    freq: f32,
    phase: f32,
    rise: f32,
    color: [f32; 3],
}

/// Renders frames of a card for one photo.
pub struct CardRenderer {
    base: Vec<u32>,
    bw: usize,
    bh: usize,
    ow: usize,
    oh: usize,
    style: CardStyle,
    /// Unit pan direction.
    pan_dir: (f32, f32),
    /// Vignette tables (8.8 fixed point, 256 = 1).
    vx: Vec<u32>,
    vy: Vec<u32>,
    /// Glow tables (0–256).
    gx: Vec<u32>,
    gy: Vec<u32>,
    glow_rgb: [u32; 3],
    flakes: Vec<Flake>,
    sparkles: Vec<Sparkle>,
    frame: Vec<u8>,
}

/// SWAR lerp of two packed RGBA pixels with weight `w` in 0–256.
#[inline(always)]
fn lerp_px(a: u32, b: u32, w: u32) -> u32 {
    let iw = 256 - w;
    let rb = (((a & 0x00ff_00ff) * iw + (b & 0x00ff_00ff) * w) >> 8) & 0x00ff_00ff;
    let ga = (((a >> 8) & 0x00ff_00ff) * iw + ((b >> 8) & 0x00ff_00ff) * w) & 0xff00_ff00;
    rb | ga
}

impl CardRenderer {
    pub fn new(base: RgbaView<'_>, seed: u32, style: CardStyle) -> CardRenderer {
        let (bw, bh) = (base.w.max(2), base.h.max(2));
        // Pack (and pad 1-px images to 2 px so bilinear always has a neighbour).
        let mut packed = vec![0u32; bw * bh];
        for y in 0..bh {
            for x in 0..bw {
                let p = base.px(x.min(base.w - 1), y.min(base.h - 1));
                packed[y * bw + x] = u32::from_le_bytes(p);
            }
        }
        let ow = style.out_w.map(|v| v as usize).unwrap_or(base.w).clamp(16, 2048);
        let oh = style.out_h.map(|v| v as usize).unwrap_or(base.h).clamp(16, 2048);

        let mut rng = Rng::new(mix64(seed as u64 ^ 0x6c75_7469_6e73));
        let ang = rng.range(0.0, std::f32::consts::TAU);
        let pan_dir = (ang.cos(), ang.sin());

        let k = 0.6 * style.vignette;
        let vig = |n: usize| -> Vec<u32> {
            (0..n)
                .map(|i| {
                    let u = (2.0 * (i as f32 + 0.5) / n as f32 - 1.0).abs();
                    ((1.0 - k * u * u) * 256.0).round() as u32
                })
                .collect()
        };
        let glo = |n: usize| -> Vec<u32> {
            (0..n)
                .map(|i| {
                    let u = 2.0 * (i as f32 + 0.5) / n as f32 - 1.0;
                    ((-u * u / 0.35).exp() * 256.0).round() as u32
                })
                .collect()
        };
        let gc = parse_hex(&style.glow_color).unwrap_or([255, 210, 122]);

        let scale = ow as f32 / 720.0;
        let flakes = (0..style.snow)
            .map(|_| {
                let depth = rng.f32(); // 0 far – 1 near
                Flake {
                    x0: rng.f32(),
                    y0: rng.f32(),
                    speed: 0.025 + 0.07 * depth + rng.range(0.0, 0.01),
                    radius: (1.0 + 2.6 * depth) * scale.max(0.4),
                    sway: rng.range(4.0, 16.0) * scale,
                    freq: rng.range(0.3, 1.1),
                    phase: rng.range(0.0, std::f32::consts::TAU),
                    alpha: 0.45 + 0.5 * depth,
                }
            })
            .collect();
        let golds = [[255.0, 214.0, 120.0], [255.0, 236.0, 170.0], [255.0, 190.0, 90.0]];
        let sparkles = (0..style.sparkles)
            .map(|_| Sparkle {
                x0: rng.f32(),
                y0: rng.f32(),
                size: rng.range(3.0, 9.0) * scale.max(0.4),
                freq: rng.range(1.5, 3.5),
                phase: rng.range(0.0, std::f32::consts::TAU),
                rise: rng.range(0.004, 0.015),
                color: golds[(rng.next_u64() % 3) as usize],
            })
            .collect();

        CardRenderer {
            base: packed,
            bw,
            bh,
            ow,
            oh,
            pan_dir,
            vx: vig(ow),
            vy: vig(oh),
            gx: glo(ow),
            gy: glo(oh),
            glow_rgb: [gc[0] as u32, gc[1] as u32, gc[2] as u32],
            flakes,
            sparkles,
            frame: vec![0u8; ow * oh * 4],
            style,
        }
    }

    pub fn width(&self) -> usize {
        self.ow
    }

    pub fn height(&self) -> usize {
        self.oh
    }

    /// The last rendered frame (RGBA8, `width × height`).
    pub fn frame(&self) -> &[u8] {
        &self.frame
    }

    /// Renders the frame at time `t` (seconds) into the internal buffer.
    pub fn render(&mut self, t: f32) -> &[u8] {
        let t = if t.is_finite() { t } else { 0.0 };
        self.background(t);
        self.snow(t);
        self.sparkle(t);
        &self.frame
    }

    fn background(&mut self, t: f32) {
        use std::f32::consts::TAU;
        let (bw, bh, ow, oh) = (self.bw, self.bh, self.ow, self.oh);
        let st = &self.style;
        let phase = 0.5 - 0.5 * (TAU * t / st.duration).cos();
        let cover = (ow as f32 / bw as f32).max(oh as f32 / bh as f32);
        let s = cover * (1.0 + st.zoom * phase);
        let (vw, vh) = (ow as f32 / s, oh as f32 / s);
        let (slack_x, slack_y) = ((bw as f32 - vw).max(0.0), (bh as f32 - vh).max(0.0));
        let cx = bw as f32 / 2.0 + self.pan_dir.0 * (phase - 0.5) * slack_x * st.pan;
        let cy = bh as f32 / 2.0 + self.pan_dir.1 * (phase - 0.5) * slack_y * st.pan;
        let (left, top) = ((cx - vw / 2.0).clamp(0.0, slack_x), (cy - vh / 2.0).clamp(0.0, slack_y));
        let step = 1.0 / s;
        let fx_max = (((bw - 1) as i64) << 16) - 1;
        let fy_max = (((bh - 1) as i64) << 16) - 1;
        let x_start = ((left + 0.5 * step - 0.5) * 65536.0) as i64;
        let x_step = (step * 65536.0) as i64;

        // Glow: breathing amplitude, and a matching tiny brightness lift.
        let pulse = 0.5 + 0.5 * (TAU * t / 3.2).sin();
        let amp = st.glow * (0.35 + 0.65 * pulse) * 0.22; // ≤ +22 % of the glow colour
        let g = [
            (self.glow_rgb[0] as f32 * amp) as u32,
            (self.glow_rgb[1] as f32 * amp) as u32,
            (self.glow_rgb[2] as f32 * amp) as u32,
        ];
        let lift = (256.0 * (1.0 + 0.04 * st.glow * pulse)) as u32;

        let base = &self.base;
        for (oy, row) in self.frame.chunks_exact_mut(ow * 4).enumerate() {
            let sy = (((top + (oy as f32 + 0.5) * step - 0.5) * 65536.0) as i64).clamp(0, fy_max);
            let iy = (sy >> 16) as usize;
            let wy = ((sy >> 8) & 0xff) as u32;
            let r0 = &base[iy * bw..(iy + 1) * bw];
            let r1 = &base[(iy + 1) * bw..(iy + 2) * bw];
            let rowv = (self.vy[oy] * lift) >> 8;
            let rowg = self.gy[oy];
            let mut fx = x_start;
            for ((px, &vx), &gx) in row.chunks_exact_mut(4).zip(&self.vx).zip(&self.gx) {
                let sx = fx.clamp(0, fx_max);
                fx += x_step;
                let ix = (sx >> 16) as usize;
                let wx = ((sx >> 8) & 0xff) as u32;
                let top_px = lerp_px(r0[ix], r0[ix + 1], wx);
                let bot_px = lerp_px(r1[ix], r1[ix + 1], wx);
                let c = lerp_px(top_px, bot_px, wy);
                let m = (vx * rowv) >> 8;
                let gw = (gx * rowg) >> 8;
                let r = (((c & 0xff) * m) >> 8) + ((gw * g[0]) >> 8);
                let gg = ((((c >> 8) & 0xff) * m) >> 8) + ((gw * g[1]) >> 8);
                let b = ((((c >> 16) & 0xff) * m) >> 8) + ((gw * g[2]) >> 8);
                px[0] = r.min(255) as u8;
                px[1] = gg.min(255) as u8;
                px[2] = b.min(255) as u8;
                px[3] = 255;
            }
        }
    }

    fn snow(&mut self, t: f32) {
        let (ow, oh) = (self.ow as f32, self.oh as f32);
        for f in &self.flakes {
            let margin = f.radius + 2.0;
            let y = (f.y0 + f.speed * t).rem_euclid(1.0) * (oh + 2.0 * margin) - margin;
            let x =
                (f.x0 * ow + f.sway * (f.freq * t + f.phase).sin() + 6.0 * t).rem_euclid(ow + 2.0 * margin) - margin;
            let r = f.radius;
            let (x0, x1) =
                ((x - r - 1.0).floor().max(0.0) as usize, ((x + r + 1.0).ceil().max(0.0) as usize).min(self.ow));
            let (y0, y1) =
                ((y - r - 1.0).floor().max(0.0) as usize, ((y + r + 1.0).ceil().max(0.0) as usize).min(self.oh));
            for py in y0..y1 {
                let dy = py as f32 + 0.5 - y;
                for px in x0..x1 {
                    let dx = px as f32 + 0.5 - x;
                    let d = (dx * dx + dy * dy).sqrt();
                    // Soft disc: full inside r/2, fading to 0 at r + 0.5.
                    let a = f.alpha * (1.0 - ((d - 0.5 * r) / (0.5 * r + 0.5)).clamp(0.0, 1.0));
                    if a <= 0.0 {
                        continue;
                    }
                    let a = (a * 256.0) as u32;
                    let i = (py * self.ow + px) * 4;
                    for c in 0..3 {
                        let v = self.frame[i + c] as u32;
                        self.frame[i + c] = (v + (((255 - v) * a) >> 8)) as u8;
                    }
                }
            }
        }
    }

    fn sparkle(&mut self, t: f32) {
        let (ow, oh) = (self.ow as f32, self.oh as f32);
        for s in &self.sparkles {
            let b = (s.freq * t + s.phase).sin().max(0.0).powi(3);
            if b < 0.02 {
                continue;
            }
            let x = s.x0 * ow;
            let y = (s.y0 - s.rise * t).rem_euclid(1.0) * oh;
            let size = s.size * (0.75 + 0.25 * b);
            let core = 0.35 * size;
            let (x0, x1) = ((x - size - 1.0).max(0.0) as usize, ((x + size + 1.0).max(0.0) as usize).min(self.ow));
            let (y0, y1) = ((y - size - 1.0).max(0.0) as usize, ((y + size + 1.0).max(0.0) as usize).min(self.oh));
            for py in y0..y1 {
                let dy = py as f32 + 0.5 - y;
                for px in x0..x1 {
                    let dx = px as f32 + 0.5 - x;
                    let glow = (-(dx * dx + dy * dy) / (2.0 * core * core)).exp();
                    let arm_h = (-(dy * dy) / 0.8).exp() * (1.0 - dx.abs() / size).max(0.0);
                    let arm_v = (-(dx * dx) / 0.8).exp() * (1.0 - dy.abs() / size).max(0.0);
                    let k = b * (glow + arm_h.max(arm_v)).min(1.0);
                    if k < 0.004 {
                        continue;
                    }
                    let i = (py * self.ow + px) * 4;
                    for c in 0..3 {
                        let v = self.frame[i + c] as f32 + s.color[c] * k;
                        self.frame[i + c] = v.min(255.0) as u8;
                    }
                }
            }
        }
    }
}

/// One-shot render of the frame at `t` (seconds).
pub fn render_card_frame(base: RgbaView<'_>, t: f32, seed: u32, style: CardStyle) -> Vec<u8> {
    let mut r = CardRenderer::new(base, seed, style);
    r.render(t);
    r.frame
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::image::RgbaImage;

    fn photo(w: usize, h: usize) -> RgbaImage {
        let mut img = RgbaImage::new(w, h);
        for y in 0..h {
            for x in 0..w {
                img.set(x, y, [(x * 255 / w) as u8, (y * 255 / h) as u8, 120, 255]);
            }
        }
        img
    }

    #[test]
    fn lerp_px_is_exact_at_the_ends_and_halfway() {
        let (a, b) = (0x10_20_30_40u32, 0xf0_e0_d0_c0u32);
        assert_eq!(lerp_px(a, b, 0), a);
        assert_eq!(lerp_px(a, a, 128), a);
        let m = lerp_px(0x00_00_00_00, 0xfe_fe_fe_fe, 128);
        assert_eq!(m, 0x7f_7f_7f_7f);
    }

    #[test]
    fn style_defaults_and_clamps() {
        assert_eq!(CardStyle::from_json("").unwrap(), CardStyle::default());
        let s = CardStyle::from_json(r#"{"zoom": 9, "snow": 99999, "out_w": 1, "duration": 0}"#).unwrap();
        assert_eq!((s.zoom, s.snow, s.out_w, s.duration), (0.3, 400, Some(16), 2.0));
        assert!(CardStyle::from_json("{bad").is_err());
        assert!(CardStyle::from_json(r#"{"snow": -1}"#).is_err());
    }

    #[test]
    fn deterministic_and_time_varying() {
        let img = photo(160, 200);
        let st = CardStyle { out_w: Some(144), out_h: Some(180), ..CardStyle::default() };
        let a = render_card_frame(img.view(), 1.25, 7, st.clone());
        let b = render_card_frame(img.view(), 1.25, 7, st.clone());
        assert_eq!(a.len(), 144 * 180 * 4);
        assert_eq!(a, b, "same t, same frame");
        let c = render_card_frame(img.view(), 2.5, 7, st.clone());
        assert_ne!(a, c, "time moves things");
        let d = render_card_frame(img.view(), 1.25, 8, st.clone());
        assert_ne!(a, d, "the seed moves particles");
        // The stateful renderer gives the same pixels.
        let mut r = CardRenderer::new(img.view(), 7, st);
        r.render(9.0);
        assert_eq!(r.render(1.25), &a[..]);
    }

    #[test]
    fn loop_is_seamless_for_the_background() {
        let img = photo(120, 90);
        let st = CardStyle { snow: 0, sparkles: 0, glow: 0.0, duration: 4.0, ..CardStyle::default() };
        assert_eq!(render_card_frame(img.view(), 0.0, 1, st.clone()), render_card_frame(img.view(), 4.0, 1, st));
    }

    #[test]
    fn plain_card_reproduces_the_photo_centre() {
        // No effects, no zoom: the centre pixel equals the photo's.
        let img = photo(100, 80);
        let st = CardStyle { snow: 0, sparkles: 0, glow: 0.0, vignette: 0.0, zoom: 0.0, ..CardStyle::default() };
        let f = render_card_frame(img.view(), 3.0, 1, st);
        for (x, y) in [(50, 40), (10, 70), (99, 0)] {
            let i = (y * 100 + x) * 4;
            let p = img.view().px(x, y);
            for c in 0..3 {
                assert!((f[i + c] as i32 - p[c] as i32).abs() <= 1, "({x},{y}) {:?} vs {p:?}", &f[i..i + 4]);
            }
        }
    }

    #[test]
    fn vignette_darkens_corners_and_snow_brightens() {
        let mut flat = RgbaImage::new(100, 100);
        flat.data.chunks_exact_mut(4).for_each(|p| p.copy_from_slice(&[100, 100, 100, 255]));
        let st = CardStyle { snow: 0, sparkles: 0, glow: 0.0, vignette: 1.0, ..CardStyle::default() };
        let f = render_card_frame(flat.view(), 0.0, 1, st);
        assert!(f[0] < 60 && f[(50 * 100 + 50) * 4] >= 98, "{} {}", f[0], f[(50 * 100 + 50) * 4]);
        let st = CardStyle { snow: 400, sparkles: 0, glow: 0.0, vignette: 0.0, ..CardStyle::default() };
        let f = render_card_frame(flat.view(), 2.0, 1, st);
        let mean = f.chunks(4).map(|p| p[0] as f32).sum::<f32>() / 10_000.0;
        assert!(mean > 101.0 && f.chunks(4).all(|p| p[0] >= 100));
    }

    #[test]
    fn tiny_photo_does_not_panic() {
        let img = photo(1, 1);
        let f = render_card_frame(img.view(), 0.5, 3, CardStyle::default());
        assert_eq!(f.len(), 16 * 16 * 4);
    }
}
