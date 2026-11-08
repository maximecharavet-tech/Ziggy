//! The "security camera" look: a prank picture shown as if a night-vision
//! (green) or CCTV (grey) camera had caught the elves.
//!
//! Each frame is a pure function of `(picture, t, seed, style)`, like the
//! magic card ([`crate::card`]). No text is drawn here: the camera name, the
//! blinking REC dot and the timestamp are drawn by TypeScript on top.
//!
//! - **Optics**: a "cover" fit of the picture, a slight barrel (fish-eye)
//!   distortion normalised so the corners stay the corners (the centre is
//!   magnified), and a slow digital zoom (smoothstep over `duration`) toward
//!   the focus area (the elves, found by [`focus_elves`] when not given).
//!   The distortion map is precomputed once (offsets from the frame centre),
//!   so a frame costs one affine transform and one bilinear sample of a
//!   precomputed luma plane per pixel.
//! - **Sensor**: auto-gain (the picture's mean luma is brought to a fixed
//!   level), a gamma lift for the night look, a soft 1-2-1 blur, and grain
//!   from a 512² noise tile shifted by a hash of `(seed, frame index)` (the
//!   frame index is `t × grain_fps`, so grain is deterministic per frame).
//! - **Screen**: scanlines, a faint rolling hum bar, rare interference events
//!   (a bright torn band of rows shifted sideways, decided per 1.3 s slot by
//!   a hash of the seed), a radial vignette, and a 256-entry colour table
//!   (green phosphor or cool grey).
//!
//! [`CctvRenderer`] keeps everything that does not depend on `t`;
//! [`render_cctv_frame`] is the one-shot form.

use serde::Deserialize;

use crate::bible::{bible, signature};
use crate::color::{delta_e76, srgb8_to_lab, Lab};
use crate::image::{EngineError, Result, RgbaView};
use crate::resize::{fit_within, resize_hq};
use crate::rng::{mix64, Rng};
use crate::verify::Rect;

/// Colour of the picture.
#[derive(Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum CctvLook {
    /// Green night-vision phosphor.
    #[default]
    Night,
    /// Cool grey CCTV.
    Grey,
}

/// CCTV style; every field is optional (defaults in brackets).
#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(default)]
pub struct CctvStyle {
    /// Output size [same as the picture], 16–2048.
    pub out_w: Option<u32>,
    pub out_h: Option<u32>,
    /// `"night"` or `"grey"` [night].
    pub look: CctvLook,
    /// Seconds for the digital zoom to reach its maximum [7], 0.5–120.
    pub duration: f32,
    /// Extra zoom at the end [0.18], 0–0.6.
    pub zoom: f32,
    /// Where to zoom (normalised rectangle of the picture) [found by `focus_elves`, else the centre].
    pub focus: Option<Rect>,
    /// Look for the elves when `focus` is not given [true].
    pub auto_focus: bool,
    /// Barrel distortion [0.12], 0–0.4.
    pub barrel: f32,
    /// Scanline darkness [0.22], 0–1.
    pub scanlines: f32,
    /// Grain strength [0.35], 0–1.
    pub noise: f32,
    /// Vignette strength [0.55], 0–1.
    pub vignette: f32,
    /// How often interference lines happen [0.5], 0–1.
    pub interference: f32,
    /// Extra gain after the auto-gain [1], 0.3–3.
    pub gain: f32,
    /// Grain frames per second [15], 1–60.
    pub grain_fps: f32,
}

impl Default for CctvStyle {
    fn default() -> Self {
        CctvStyle {
            out_w: None,
            out_h: None,
            look: CctvLook::Night,
            duration: 7.0,
            zoom: 0.18,
            focus: None,
            auto_focus: true,
            barrel: 0.12,
            scanlines: 0.22,
            noise: 0.35,
            vignette: 0.55,
            interference: 0.5,
            gain: 1.0,
            grain_fps: 15.0,
        }
    }
}

fn fin(v: f32, d: f32) -> f32 {
    if v.is_finite() {
        v
    } else {
        d
    }
}

impl CctvStyle {
    /// Parses (empty string = defaults) and clamps every field.
    pub fn from_json(s: &str) -> Result<CctvStyle> {
        let s = s.trim();
        let st: CctvStyle = if s.is_empty() {
            CctvStyle::default()
        } else {
            serde_json::from_str(s).map_err(|e| EngineError::BadInput(format!("style_json: {e}")))?
        };
        Ok(st.clamped())
    }

    /// The same style with every field in its range (non-finite → default).
    pub fn clamped(mut self) -> CctvStyle {
        let d = CctvStyle::default();
        self.out_w = self.out_w.map(|v| v.clamp(16, 2048));
        self.out_h = self.out_h.map(|v| v.clamp(16, 2048));
        self.duration = fin(self.duration, d.duration).clamp(0.5, 120.0);
        self.zoom = fin(self.zoom, d.zoom).clamp(0.0, 0.6);
        self.barrel = fin(self.barrel, d.barrel).clamp(0.0, 0.4);
        self.scanlines = fin(self.scanlines, d.scanlines).clamp(0.0, 1.0);
        self.noise = fin(self.noise, d.noise).clamp(0.0, 1.0);
        self.vignette = fin(self.vignette, d.vignette).clamp(0.0, 1.0);
        self.interference = fin(self.interference, d.interference).clamp(0.0, 1.0);
        self.gain = fin(self.gain, d.gain).clamp(0.3, 3.0);
        self.grain_fps = fin(self.grain_fps, d.grain_fps).clamp(1.0, 60.0);
        self.focus = self.focus.and_then(clamp_rect);
        self
    }
}

/// A rectangle inside the unit square, or `None` if it has no finite area.
fn clamp_rect(r: Rect) -> Option<Rect> {
    if ![r.x, r.y, r.w, r.h].iter().all(|v| v.is_finite()) {
        return None;
    }
    let x0 = r.x.min(r.x + r.w).clamp(0.0, 1.0);
    let x1 = r.x.max(r.x + r.w).clamp(0.0, 1.0);
    let y0 = r.y.min(r.y + r.h).clamp(0.0, 1.0);
    let y1 = r.y.max(r.y + r.h).clamp(0.0, 1.0);
    if x1 - x0 < 1e-4 || y1 - y0 < 1e-4 {
        return None;
    }
    Some(Rect { x: x0, y: y0, w: x1 - x0, h: y1 - y0 })
}

/// Long side of the copy searched by [`focus_elves`].
pub const FOCUS_SIDE: usize = 96;
/// Side of the searched window, share of the picture.
pub const FOCUS_WINDOW: f32 = 0.42;

/// Where the elves probably are: the window (a [`FOCUS_WINDOW`] share of each
/// side) holding the most pixels close to an elf's signature colours (a fast
/// ΔE76 test on a 96 px copy). `None` when too few pixels match.
pub fn focus_elves(src: RgbaView<'_>) -> Option<Rect> {
    let (w, h) = fit_within(src.w, src.h, FOCUS_SIDE);
    let img = resize_hq(src, w, h);
    let mut sig: Vec<(Lab, f32)> = Vec::new();
    for e in &bible().elves {
        let s = signature(e);
        sig.extend(s.primary.iter().map(|c| (srgb8_to_lab(c[0], c[1], c[2]), 1.0)));
        // Hats and scarves are rarer in homes than greens and browns.
        sig.extend(s.accent.iter().map(|c| (srgb8_to_lab(c[0], c[1], c[2]), 1.5)));
    }
    // Summed-area table of the match weights.
    let mut sat = vec![0.0f32; (w + 1) * (h + 1)];
    let mut total = 0.0;
    for y in 0..h {
        let mut row = 0.0;
        for x in 0..w {
            let i = (y * w + x) * 4;
            let lab = srgb8_to_lab(img.data[i], img.data[i + 1], img.data[i + 2]);
            let mut v = 0.0;
            if lab.chroma() >= 14.0 {
                if let Some(&(_, k)) = sig.iter().find(|(s, _)| delta_e76(lab, *s) < 16.0) {
                    v = k;
                }
            }
            total += v;
            row += v;
            sat[(y + 1) * (w + 1) + x + 1] = sat[y * (w + 1) + x + 1] + row;
        }
    }
    if total < 0.004 * (w * h) as f32 {
        return None;
    }
    let ww = ((w as f32 * FOCUS_WINDOW).round() as usize).clamp(1, w);
    let wh = ((h as f32 * FOCUS_WINDOW).round() as usize).clamp(1, h);
    let at = |x: usize, y: usize| sat[y * (w + 1) + x];
    let mut best = (f32::MIN, 0usize, 0usize);
    for y in 0..=h - wh {
        for x in 0..=w - ww {
            let s = at(x + ww, y + wh) - at(x, y + wh) - at(x + ww, y) + at(x, y);
            if s > best.0 {
                best = (s, x, y);
            }
        }
    }
    Some(Rect {
        x: best.1 as f32 / w as f32,
        y: best.2 as f32 / h as f32,
        w: ww as f32 / w as f32,
        h: wh as f32 / h as f32,
    })
}

const TILE: usize = 512;
/// Interference slot length, seconds.
const SLOT: f32 = 1.3;

/// Renders frames of the security-camera look for one picture.
pub struct CctvRenderer {
    /// Display-ready luma (auto-gain, gamma, soft blur), padded to ≥ 2 px.
    luma: Vec<u8>,
    bw: usize,
    bh: usize,
    ow: usize,
    oh: usize,
    style: CctvStyle,
    seed: u64,
    /// Vignette per pixel (0–256).
    vig: Vec<u16>,
    /// Scanline factor per row (0–256).
    scan: Vec<u16>,
    /// Per-frame row gain (0–512) and sideways shift (output px).
    rowmul: Vec<u32>,
    rowshift: Vec<f32>,
    lut: [[u8; 4]; 256],
    noise: Vec<i8>,
    /// Base pixels per output pixel at zoom 1.
    step: f32,
    /// Zoom target centre, base pixels.
    focus: (f32, f32),
    frame: Vec<u8>,
}

fn smoothstep(x: f32) -> f32 {
    let x = x.clamp(0.0, 1.0);
    x * x * (3.0 - 2.0 * x)
}

fn unit(h: u64, shift: u32) -> f32 {
    ((h >> shift) & 0xffff) as f32 / 65535.0
}

fn colour_table(look: CctvLook) -> [[u8; 4]; 256] {
    let mut lut = [[0u8, 0, 0, 255]; 256];
    for (i, e) in lut.iter_mut().enumerate() {
        let v = i as f32 / 255.0;
        let rgb = match look {
            CctvLook::Night => {
                // Black-green → phosphor green → pale mint highlights.
                let (a, b, k) = if v < 0.72 {
                    ([4.0, 14.0, 6.0], [70.0, 220.0, 96.0], v / 0.72)
                } else {
                    ([70.0, 220.0, 96.0], [214.0, 255.0, 214.0], (v - 0.72) / 0.28)
                };
                [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
            }
            CctvLook::Grey => {
                // Lifted blacks, soft whites, a hint of blue.
                let s = v * v * (3.0 - 2.0 * v) * 0.35 + v * 0.65;
                [16.0 + s * 214.0, 18.0 + s * 218.0, 22.0 + s * 222.0]
            }
        };
        *e = [rgb[0].round() as u8, rgb[1].round() as u8, rgb[2].round() as u8, 255];
    }
    lut
}

impl CctvRenderer {
    pub fn new(base: RgbaView<'_>, seed: u32, style: CctvStyle) -> CctvRenderer {
        let style = style.clamped();
        let (bw, bh) = (base.w.max(2), base.h.max(2));
        let ow = style.out_w.map(|v| v as usize).unwrap_or(base.w).clamp(16, 2048);
        let oh = style.out_h.map(|v| v as usize).unwrap_or(base.h).clamp(16, 2048);

        // Luma plane (padded), auto-gain to a fixed mean, gamma, 1-2-1 blur.
        let mut raw = vec![0f32; bw * bh];
        let mut sum = 0.0f64;
        for y in 0..bh {
            for x in 0..bw {
                let p = base.px(x.min(base.w - 1), y.min(base.h - 1));
                let l = (0.299 * p[0] as f32 + 0.587 * p[1] as f32 + 0.114 * p[2] as f32) / 255.0;
                raw[y * bw + x] = l;
                sum += l as f64;
            }
        }
        let mean = ((sum / (bw * bh) as f64) as f32).max(0.02);
        let (target, gamma) = match style.look {
            CctvLook::Night => (0.40, 0.8),
            CctvLook::Grey => (0.45, 1.0),
        };
        let g = (target / mean).clamp(0.6, 6.0) * style.gain;
        let tone: Vec<f32> = (0..256).map(|i| ((i as f32 / 255.0 * g).min(1.0)).powf(gamma) * 255.0).collect();
        let quant: Vec<u8> = raw.iter().map(|&l| tone[(l * 255.0).round().clamp(0.0, 255.0) as usize] as u8).collect();
        let mut tmp = vec![0u8; bw * bh];
        for y in 0..bh {
            for x in 0..bw {
                let (l, r) = (x.saturating_sub(1), (x + 1).min(bw - 1));
                let row = &quant[y * bw..(y + 1) * bw];
                tmp[y * bw + x] = ((row[l] as u32 + 2 * row[x] as u32 + row[r] as u32 + 2) / 4) as u8;
            }
        }
        let mut luma = vec![0u8; bw * bh];
        for y in 0..bh {
            let (u, d) = (y.saturating_sub(1), (y + 1).min(bh - 1));
            for x in 0..bw {
                luma[y * bw + x] =
                    ((tmp[u * bw + x] as u32 + 2 * tmp[y * bw + x] as u32 + tmp[d * bw + x] as u32 + 2) / 4) as u8;
            }
        }

        // Vignette.
        let (hw, hh) = (ow as f32 / 2.0, oh as f32 / 2.0);
        let r2max = hw * hw + hh * hh;
        let kv = 0.6 * style.vignette;
        let mut vig = Vec::with_capacity(ow * oh);
        for y in 0..oh {
            let dy = y as f32 + 0.5 - hh;
            for x in 0..ow {
                let dx = x as f32 + 0.5 - hw;
                let r2 = (dx * dx + dy * dy) / r2max;
                let v = (1.0 - kv * r2).max(0.0);
                // Rounded dark lens corners.
                let corner = 1.0 - 0.6 * style.vignette * smoothstep((r2 - 0.78) / 0.22);
                vig.push(((v * v * corner) * 256.0).round().clamp(0.0, 256.0) as u16);
            }
        }
        let period = ((oh as f32 / 300.0).round() as usize).max(2);
        let scan = (0..oh)
            .map(|y| if y % period == period - 1 { ((1.0 - 0.55 * style.scanlines) * 256.0) as u16 } else { 256 })
            .collect();

        // Grain tile: roughly Gaussian (sum of three uniforms), rare bright specks.
        let seed64 = mix64(seed as u64 ^ 0x6363_7476_6c75_7469);
        let mut rng = Rng::new(seed64 ^ 0x5eed);
        let noise = (0..TILE * TILE)
            .map(|_| {
                if rng.f32() < 0.0004 {
                    return 127;
                }
                let s = rng.f32() + rng.f32() + rng.f32() - 1.5; // σ ≈ 0.5
                (s * 84.0).clamp(-127.0, 127.0) as i8
            })
            .collect();

        let step = 1.0 / (ow as f32 / bw as f32).max(oh as f32 / bh as f32);
        let rect = style.focus.or_else(|| if style.auto_focus { focus_elves(base) } else { None }).unwrap_or(Rect {
            x: 0.3,
            y: 0.35,
            w: 0.4,
            h: 0.4,
        });
        let focus = ((rect.x + rect.w / 2.0) * base.w as f32, (rect.y + rect.h / 2.0) * base.h as f32);

        CctvRenderer {
            luma,
            bw,
            bh,
            ow,
            oh,
            seed: seed64,
            vig,
            scan,
            rowmul: vec![256; oh],
            rowshift: vec![0.0; oh],
            lut: colour_table(style.look),
            noise,
            step,
            focus,
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

    /// The zoom target, normalised to the picture (for tests and overlays).
    pub fn focus(&self) -> (f32, f32) {
        (self.focus.0 / self.bw as f32, self.focus.1 / self.bh as f32)
    }

    /// The last rendered frame (RGBA8, `width × height`).
    pub fn frame(&self) -> &[u8] {
        &self.frame
    }

    /// Per-row gain and shift for the frame at `t`.
    fn rows(&mut self, t: f32) {
        let oh = self.oh as f32;
        let scale = oh / 900.0;
        // Hum bar rolling down every 6.5 s.
        let phase = (t / 6.5 + unit(self.seed, 8)).rem_euclid(1.0);
        let bar_y = phase * oh * 1.4 - 0.2 * oh;
        let bar_w = 0.06 * oh;
        // Interference event in this slot?
        let slot = (t / SLOT).floor();
        let h = mix64(self.seed ^ (slot as i64 as u64).wrapping_mul(0x9e37_79b9_7f4a_7c15));
        let event = if unit(h, 0) < self.style.interference * 0.55 {
            let start = slot * SLOT + unit(h, 16) * (SLOT - 0.35);
            let dur = 0.12 + 0.2 * unit(h, 32);
            (t >= start && t < start + dur).then(|| {
                let yc = unit(h, 40) * oh;
                let half = (4.0 + 12.0 * unit(h, 48)) * scale.max(0.2);
                let amp = (8.0 + 18.0 * unit(h, 24)) * scale.max(0.2);
                (yc, half, amp)
            })
        } else {
            None
        };
        for (y, (m, s)) in self.rowmul.iter_mut().zip(self.rowshift.iter_mut()).enumerate() {
            let yf = y as f32 + 0.5;
            let d = (yf - bar_y) / bar_w;
            let mut gain = 1.0 + 0.06 * (-d * d).exp();
            let mut shift = 0.0;
            if let Some((yc, half, amp)) = event {
                let a = (1.0 - (yf - yc).abs() / (half * 3.0)).max(0.0);
                if a > 0.0 {
                    shift = a * amp * if ((yf * 0.7 + t * 40.0).sin()) >= 0.0 { 1.0 } else { -1.0 };
                    if (yf - yc).abs() < half {
                        gain += 0.35 * a;
                    }
                }
            }
            *m = ((gain * self.scan[y] as f32).round() as u32).min(512);
            *s = shift;
        }
    }

    /// Renders the frame at time `t` (seconds) into the internal buffer.
    pub fn render(&mut self, t: f32) -> &[u8] {
        let t = if t.is_finite() { t.clamp(-1.0e6, 1.0e6) } else { 0.0 };
        self.rows(t);
        let (bw, bh, ow) = (self.bw, self.bh, self.ow);
        let st = &self.style;

        // Zoom and view centre (kept inside the picture).
        let p = smoothstep(t / st.duration);
        let s = self.step / (1.0 + st.zoom * p);
        let (vw, vh) = (ow as f32 * s, self.oh as f32 * s);
        let (mid_x, mid_y) = (bw as f32 / 2.0, bh as f32 / 2.0);
        let clampc = |c: f32, half: f32, n: f32| if half * 2.0 >= n { n / 2.0 } else { c.clamp(half, n - half) };
        let cx = clampc(mid_x + (self.focus.0 - mid_x) * p, vw / 2.0, bw as f32) - 0.5;
        let cy = clampc(mid_y + (self.focus.1 - mid_y) * p, vh / 2.0, bh as f32) - 0.5;
        // Grain offset for this frame.
        let fi = (t * st.grain_fps).floor() as i64 as u64;
        let hn = mix64(self.seed ^ fi.wrapping_mul(0xd1b5_4a32_d192_ed03));
        let (ox, oy) = ((hn & 0x1ff) as usize, ((hn >> 9) & 0x1ff) as usize);
        let amp = (st.noise * 0.9 * 256.0) as i32;

        let luma = &self.luma;
        let lut = &self.lut;
        let noise = &self.noise;
        // Barrel: offset · f, f = a(row) + b·dx² (corners stay corners).
        let (hw, hh) = (ow as f32 / 2.0, self.oh as f32 / 2.0);
        let inv = 1.0 / ((hw * hw + hh * hh) * (1.0 + st.barrel));
        let b = st.barrel * inv;
        // 16.16 fixed point source coordinates, clamped so the 2×2 block stays
        // inside. The mapping is smooth: it is computed exactly every SEG
        // pixels and linearly in between (error ≪ 0.01 px).
        const SEG: usize = 8;
        let (xmax, ymax) = (((bw - 2) << 16) as i32 + 0xffff, ((bh - 2) << 16) as i32 + 0xffff);
        let fx = 65536.0f32;
        for (y, row) in self.frame.chunks_exact_mut(ow * 4).enumerate() {
            let dy = y as f32 + 0.5 - hh;
            let a = 1.0 / (1.0 + st.barrel) + b * dy * dy;
            let gain = self.rowmul[y];
            let (x0, ks, y0, dys) = ((cx + self.rowshift[y]) * fx, s * fx, cy * fx, dy * s * fx);
            let exact = |dx: f32| {
                let f = a + b * dx * dx;
                ((x0 + dx * f * ks) as i32, (y0 + dys * f) as i32)
            };
            let nrow = &noise[((y + oy) & (TILE - 1)) * TILE..][..TILE];
            let vrow = &self.vig[y * ow..(y + 1) * ow];
            let mut start = exact(0.5 - hw);
            let mut x = 0;
            while x < ow {
                let n = SEG.min(ow - x);
                let end = exact(x as f32 + n as f32 + 0.5 - hw);
                let (stx, sty) = ((end.0 - start.0) / n as i32, (end.1 - start.1) / n as i32);
                let (mut sx, mut sy) = start;
                let px = row[x * 4..(x + n) * 4].chunks_exact_mut(4).zip(&vrow[x..x + n]);
                for (k, (px, &v)) in px.enumerate() {
                    let (cxp, cyp) = (sx.clamp(0, xmax), sy.clamp(0, ymax));
                    sx += stx;
                    sy += sty;
                    let (wx, wy) = (((cxp >> 8) & 255) as u32, ((cyp >> 8) & 255) as u32);
                    let j = (cyp >> 16) as usize * bw + (cxp >> 16) as usize;
                    let q = &luma[j..j + bw + 2];
                    let top = q[0] as u32 * (256 - wx) + q[1] as u32 * wx;
                    let bot = q[bw] as u32 * (256 - wx) + q[bw + 1] as u32 * wx;
                    let l = (top * (256 - wy) + bot * wy) >> 16; // 0–255
                    let l = (((l * v as u32) >> 8) * gain) >> 8;
                    let nz = (nrow[(x + k + ox) & (TILE - 1)] as i32 * amp) >> 8;
                    px.copy_from_slice(&lut[(l as i32 + nz).clamp(0, 255) as usize]);
                }
                start = end;
                x += n;
            }
        }
        &self.frame
    }
}

/// One-shot render of the frame at `t` (seconds).
pub fn render_cctv_frame(base: RgbaView<'_>, t: f32, seed: u32, style: CctvStyle) -> Vec<u8> {
    let mut r = CctvRenderer::new(base, seed, style);
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

    fn flat(w: usize, h: usize, c: [u8; 3]) -> RgbaImage {
        let mut img = RgbaImage::new(w, h);
        img.data.chunks_exact_mut(4).for_each(|p| p.copy_from_slice(&[c[0], c[1], c[2], 255]));
        img
    }

    /// No grain, scanlines, interference, vignette or barrel: only the optics and colour.
    fn clean() -> CctvStyle {
        CctvStyle {
            noise: 0.0,
            scanlines: 0.0,
            interference: 0.0,
            vignette: 0.0,
            barrel: 0.0,
            auto_focus: false,
            ..CctvStyle::default()
        }
    }

    fn luma_at(f: &[u8], w: usize, x: usize, y: usize) -> u32 {
        let i = (y * w + x) * 4;
        (f[i] as u32 + f[i + 1] as u32 + f[i + 2] as u32) / 3
    }

    #[test]
    fn style_defaults_and_clamps() {
        assert_eq!(CctvStyle::from_json("").unwrap(), CctvStyle::default());
        let s = CctvStyle::from_json(
            r#"{"zoom": 9, "noise": -3, "out_w": 1, "duration": 0, "look": "grey", "grain_fps": 1e39,
                "focus": {"x": 5, "y": -1, "w": -2, "h": 0.5}}"#,
        )
        .unwrap();
        assert_eq!((s.zoom, s.noise, s.out_w, s.duration, s.look), (0.6, 0.0, Some(16), 0.5, CctvLook::Grey));
        assert_eq!(s.grain_fps, 15.0, "non-finite → default");
        // x 5 → clamped to 1, w −2 → [3, 5] → [1, 1]: no area → dropped.
        assert_eq!(s.focus, None);
        let s = CctvStyle::from_json(r#"{"focus": {"x": 0.8, "y": 0.9, "w": 0.5, "h": 0.5}}"#).unwrap();
        let f = s.focus.unwrap();
        assert!((f.w - 0.2).abs() < 1e-6 && (f.h - 0.1).abs() < 1e-6, "{f:?}");
        assert!(CctvStyle::from_json("{bad").is_err());
        assert!(CctvStyle::from_json(r#"{"look": "thermal"}"#).is_err());
    }

    #[test]
    fn deterministic_per_frame_and_time_varying() {
        let img = photo(200, 160);
        let st = CctvStyle { out_w: Some(144), out_h: Some(180), ..CctvStyle::default() };
        let a = render_cctv_frame(img.view(), 1.25, 7, st.clone());
        assert_eq!(a.len(), 144 * 180 * 4);
        assert_eq!(a, render_cctv_frame(img.view(), 1.25, 7, st.clone()), "same t, same frame");
        assert_ne!(a, render_cctv_frame(img.view(), 1.5, 7, st.clone()), "grain and zoom move");
        assert_ne!(a, render_cctv_frame(img.view(), 1.25, 8, st.clone()), "the seed moves the grain");
        // The stateful renderer gives the same pixels, in any order.
        let mut r = CctvRenderer::new(img.view(), 7, st);
        r.render(5.0);
        assert_eq!(r.render(1.25), &a[..]);
        assert!(a.chunks(4).all(|p| p[3] == 255));
    }

    #[test]
    fn grain_is_constant_within_a_grain_frame() {
        // Zoom 0, no hum bar change is visible at this scale: two times in the
        // same grain frame (15 fps) give the same picture except the hum bar.
        let img = flat(64, 64, [128, 128, 128]);
        let st = CctvStyle { zoom: 0.0, interference: 0.0, ..CctvStyle::default() };
        let a = render_cctv_frame(img.view(), 2.001, 3, st.clone());
        let b = render_cctv_frame(img.view(), 2.002, 3, st.clone());
        let diff = a.iter().zip(&b).filter(|(x, y)| (**x as i32 - **y as i32).abs() > 2).count();
        assert_eq!(diff, 0);
        let c = render_cctv_frame(img.view(), 2.2, 3, st);
        assert!(a.iter().zip(&c).filter(|(x, y)| x != y).count() > 1000, "next grain frame differs");
    }

    #[test]
    fn night_is_green_and_grey_is_neutral() {
        let img = photo(120, 100);
        let f = render_cctv_frame(img.view(), 3.0, 1, CctvStyle::default());
        assert!(f.chunks(4).all(|p| p[1] >= p[0] && p[1] >= p[2]), "green phosphor");
        let mean_g = f.chunks(4).map(|p| p[1] as f32).sum::<f32>() / (120.0 * 100.0);
        assert!(mean_g > 60.0, "auto-gain keeps it visible: {mean_g}");
        let f = render_cctv_frame(img.view(), 3.0, 1, CctvStyle { look: CctvLook::Grey, ..CctvStyle::default() });
        assert!(f.chunks(4).all(|p| p[0] <= p[1] && p[1] <= p[2] && p[2] - p[0] <= 16), "cool neutral grey");
    }

    #[test]
    fn auto_gain_lifts_a_dark_room() {
        let dark = flat(80, 80, [12, 10, 9]);
        let f = render_cctv_frame(dark.view(), 0.0, 1, clean());
        let g = f[(40 * 80 + 40) * 4 + 1];
        assert!(g > 80, "{g}");
    }

    #[test]
    fn zoom_moves_toward_the_focus() {
        // A bright square in the top-left quadrant, focus on it.
        let mut img = flat(200, 200, [40, 40, 40]);
        for y in 30..70 {
            for x in 30..70 {
                img.set(x, y, [240, 240, 240, 255]);
            }
        }
        let st =
            CctvStyle { zoom: 0.6, duration: 4.0, focus: Some(Rect { x: 0.15, y: 0.15, w: 0.2, h: 0.2 }), ..clean() };
        let stats = |f: &[u8]| {
            let (mut n, mut sx, mut sy) = (0.0, 0.0, 0.0);
            for y in 0..200 {
                for x in 0..200 {
                    if luma_at(f, 200, x, y) > 150 {
                        n += 1.0;
                        sx += x as f32;
                        sy += y as f32;
                    }
                }
            }
            (n, ((sx / n - 100.0).powi(2) + (sy / n - 100.0).powi(2)).sqrt())
        };
        let (n0, d0) = stats(&render_cctv_frame(img.view(), 0.0, 1, st.clone()));
        let (n1, d1) = stats(&render_cctv_frame(img.view(), 4.0, 1, st.clone()));
        assert!(n1 > n0 * 2.0, "the square grows: {n0} → {n1}");
        assert!(d1 < d0, "and moves toward the centre: {d0} → {d1}");
        // Past the duration the view stops (only the faint hum bar still rolls).
        let (a, b) = (render_cctv_frame(img.view(), 4.0, 1, st.clone()), render_cctv_frame(img.view(), 9.0, 1, st));
        assert_eq!(a.iter().zip(&b).filter(|(x, y)| (**x as i32 - **y as i32).abs() > 40).count(), 0);
    }

    #[test]
    fn vignette_darkens_corners_and_barrel_magnifies_the_centre() {
        let img = flat(100, 100, [150, 150, 150]);
        let st = CctvStyle { vignette: 1.0, ..clean() };
        let f = render_cctv_frame(img.view(), 0.0, 1, st);
        assert!(luma_at(&f, 100, 0, 0) * 2 < luma_at(&f, 100, 50, 50), "{} {}", f[0], f[(50 * 100 + 50) * 4]);
        // Barrel: a centred 20 px square looks bigger, corners stay corners.
        let mut sq = flat(100, 100, [20, 20, 20]);
        for y in 40..60 {
            for x in 40..60 {
                sq.set(x, y, [230, 230, 230, 255]);
            }
        }
        let count = |f: &[u8]| (0..100 * 100).filter(|&i| luma_at(f, 100, i % 100, i / 100) > 120).count();
        let plain = count(&render_cctv_frame(sq.view(), 0.0, 1, CctvStyle { zoom: 0.0, ..clean() }));
        let fish = count(&render_cctv_frame(sq.view(), 0.0, 1, CctvStyle { zoom: 0.0, barrel: 0.4, ..clean() }));
        assert!(fish as f32 > plain as f32 * 1.4, "{plain} → {fish}");
    }

    #[test]
    fn interference_tears_some_rows_sometimes() {
        let img = photo(160, 120);
        let on = CctvStyle { interference: 1.0, noise: 0.0, zoom: 0.0, ..CctvStyle::default() };
        let off = CctvStyle { interference: 0.0, ..on.clone() };
        let mut r_on = CctvRenderer::new(img.view(), 11, on);
        let mut r_off = CctvRenderer::new(img.view(), 11, off);
        let mut torn = 0;
        for k in 0..400 {
            let t = k as f32 * 0.05;
            if r_on.render(t) != r_off.render(t) {
                torn += 1;
            }
        }
        // ≈ 55 % of the 1.3 s slots have a 0.12–0.32 s event: some frames, not most.
        assert!((5..200).contains(&torn), "{torn}");
    }

    #[test]
    fn odd_inputs_do_not_panic() {
        let tiny = photo(1, 1);
        let f = render_cctv_frame(tiny.view(), f32::NAN, 3, CctvStyle::default());
        assert_eq!(f.len(), 16 * 16 * 4);
        let f =
            render_cctv_frame(tiny.view(), f32::INFINITY, 3, CctvStyle { out_w: Some(4000), ..CctvStyle::default() });
        assert_eq!(f.len(), 2048 * 16 * 4, "out_w clamped, out_h from the picture then clamped to 16");
        let img = photo(300, 40);
        for t in [-5.0, 0.0, 1e9, -1e9] {
            let f = render_cctv_frame(
                img.view(),
                t,
                0,
                CctvStyle { out_w: Some(50), out_h: Some(300), ..CctvStyle::default() },
            );
            assert_eq!(f.len(), 50 * 300 * 4);
        }
        let mut r = CctvRenderer::new(img.view(), 1, CctvStyle::default());
        let (fx, fy) = r.focus();
        assert!(fx.is_finite() && fy.is_finite() && (0.0..=1.0).contains(&fx) && (0.0..=1.0).contains(&fy));
        r.render(2.0);
    }

    #[test]
    fn focus_finds_the_elf_colours() {
        // A grey room with a moss-green tunic and a red hat at the bottom right.
        let mut img = flat(300, 200, [150, 146, 140]);
        for y in 130..180 {
            for x in 220..260 {
                img.set(x, y, [47, 138, 67, 255]);
            }
        }
        for y in 110..130 {
            for x in 228..252 {
                img.set(x, y, [201, 42, 42, 255]);
            }
        }
        let r = focus_elves(img.view()).expect("found");
        let (cx, cy) = (240.0 / 300.0, 145.0 / 200.0);
        assert!(r.x <= cx && cx <= r.x + r.w && r.y <= cy && cy <= r.y + r.h, "{r:?}");
        assert!(r.w > 0.3 && r.w < 0.5);
        assert_eq!(focus_elves(flat(300, 200, [150, 146, 140]).view()), None);
        // The renderer uses it when no focus is given.
        let rr = CctvRenderer::new(img.view(), 1, CctvStyle::default());
        assert!(rr.focus().0 > 0.6 && rr.focus().1 > 0.5, "{:?}", rr.focus());
    }

    #[test]
    #[ignore = "timing, run with --ignored --nocapture"]
    fn timing_720x900() {
        let img = photo(1024, 1280);
        let mut r =
            CctvRenderer::new(img.view(), 1, CctvStyle { out_w: Some(720), out_h: Some(900), ..CctvStyle::default() });
        let t0 = std::time::Instant::now();
        for k in 0..60 {
            r.render(k as f32 / 24.0);
        }
        println!("cctv 720×900: {:.2} ms/frame", t0.elapsed().as_secs_f64() * 1000.0 / 60.0);
        let t0 = std::time::Instant::now();
        for k in 0..60u32 {
            for (i, px) in r.frame.chunks_exact_mut(4).enumerate() {
                px.copy_from_slice(&r.lut[(i as u32 + k) as usize & 255]);
            }
        }
        println!("baseline fill: {:.2} ms/frame {}", t0.elapsed().as_secs_f64() * 1000.0 / 60.0, r.frame[7]);
        let mut c = crate::card::CardRenderer::new(img.view(), 1, crate::card::CardStyle { out_w: Some(720), out_h: Some(900), ..Default::default() });
        let t0 = std::time::Instant::now();
        for k in 0..60 {
            c.render(k as f32 / 24.0);
        }
        println!("card: {:.2} ms/frame", t0.elapsed().as_secs_f64() * 1000.0 / 60.0);
    }
}
