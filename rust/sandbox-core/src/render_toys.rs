//! Drawing the parcel's living surprises: the music snow-globe, the aurora
//! kite with its ribbon, and the treasure's glowing X (then the treasure
//! itself rising out of the ground). Software only, like the rest.

use crate::render::{add_rgb, Renderer};
use crate::sim::World;
use crate::toys::{TRAIL, T_FOSSIL, T_METEORITE, T_SHELL};

/// Aurora colours along the ribbon (green, teal, violet, pink): light, added at night.
const AURORA: [u32; 4] = [0x7affb0, 0x6fe8ff, 0xb48cff, 0xff8ad8];
/// The same hues, deeper, painted by day: the pale ones vanish against a bright sky.
const AURORA_DAY: [u32; 4] = [0x22c27a, 0x1aa8d4, 0x8458ea, 0xe24c9e];

/// A colour darkened to `k` (0..1) of itself.
fn shade_rgb(c: u32, k: f32) -> u32 {
    lerp_rgb(0, c, k)
}

fn lerp_rgb(a: u32, b: u32, t: f32) -> u32 {
    let ch = |s: u32| {
        let (x, y) = (((a >> s) & 255) as f32, ((b >> s) & 255) as f32);
        ((x + (y - x) * t) as u32).min(255) << s
    };
    ch(16) | ch(8) | ch(0)
}

impl Renderer {
    pub(crate) fn draw_toys(&mut self, world: &World, time: u32, calm: bool) {
        if world.toys.treasure.is_some() {
            self.draw_treasure(world, time, calm);
        }
        if world.toys.globe.is_some() {
            self.draw_globe(world, time, calm);
        }
        if world.toys.kite.is_some() {
            self.draw_kite(world, time, calm);
        }
    }

    fn draw_globe(&mut self, world: &World, time: u32, calm: bool) {
        let Some(g) = world.toys.globe else { return };
        // Drawn larger than its footprint, so a child sees it well.
        let cell = self.scale as f32;
        let u = cell * 1.6;
        let hop = if calm { 0.0 } else { (g.pulse as f32 / 12.0 * std::f32::consts::PI).sin() * 1.2 };
        let (cx, base) = ((g.x as f32 + 0.5) * cell, (g.y as f32 + 1.0) * cell - hop * u);
        let r = 4.6 * u;
        let cy = base - 2.0 * u - r;
        // A soft halo in the colour of the last note.
        if g.pulse > 0 {
            let col =
                [0xffd447, 0xff8ad8, 0x8ab4ff, 0x7affc8, 0xffb340, 0xb48cff, 0x6fe8ff, 0xffffff][g.degree as usize & 7];
            self.glow_disc(cx, cy, r * 2.0, col, 0.35 * g.pulse as f32 / 12.0);
        }
        // Inside the glass: a pale winter sky, a snowy hill and a little pine.
        self.disc(cx, cy, r, 0xcfefff, 120);
        self.ellipse(cx, cy + r * 0.62, r * 0.86, r * 0.42, 0xffffff, 235);
        for k in 0..3 {
            let w = (3 - k) as f32 * 0.55 * u;
            let y = cy - 0.8 * u + k as f32 * 1.1 * u;
            self.fill_rect(cx + 0.9 * u - w, y, cx + 0.9 * u + w, y + 1.2 * u, 0x2f9a5a, 255);
        }
        self.fill_rect(cx + 0.65 * u, cy + 2.5 * u, cx + 1.15 * u, cy + 3.1 * u, 0x8a5a38, 255);
        // Snowflakes swirling (they settle still under reduced motion).
        for k in 0..9u32 {
            let a = (k * 29 + time / 2 + g.notes * 7) & 255;
            let fx = self.sin_of(a + k * 40) as f32 / 127.0;
            let fy = self.sin_of(a * 2 + 64) as f32 / 127.0;
            let (x, y) = (cx + fx * r * 0.7, cy + fy * r * 0.55 - 0.4 * u);
            self.disc(x, y, 0.32 * u, 0xffffff, 230);
        }
        // The glass: rim light and a bright glint.
        let (x0, x1, y0, y1) = ((cx - r) as i32, (cx + r) as i32 + 1, (cy - r) as i32, (cy + r) as i32 + 1);
        for py in y0..y1 {
            for px in x0..x1 {
                let (dx, dy) = (px as f32 + 0.5 - cx, py as f32 + 0.5 - cy);
                let d = (dx * dx + dy * dy).sqrt();
                if d <= r && d >= r - 0.7 * u {
                    self.plot(px, py, 0xffffff, 200);
                }
            }
        }
        self.ellipse(cx - r * 0.45, cy - r * 0.5, r * 0.22, r * 0.12, 0xffffff, 220);
        // The wooden base with a golden band.
        self.fill_rect(cx - 4.2 * u, base - 2.4 * u, cx + 4.2 * u, base, 0x9a6438, 255);
        self.fill_rect(cx - 4.2 * u, base - 2.4 * u, cx + 4.2 * u, base - 1.8 * u, 0xc98a52, 255);
        self.fill_rect(cx - 4.2 * u, base - 1.2 * u, cx + 4.2 * u, base - 0.8 * u, 0xffd447, 255);
    }

    fn draw_kite(&mut self, world: &World, time: u32, calm: bool) {
        let Some(k) = world.toys.kite else { return };
        let u = self.scale as f32;
        let q = u / 4.0;
        let night = world.night || world.params.medium == crate::table::VACUUM;
        // The aurora ribbon: hanging curtains of light along the path, newest brightest.
        for n in 0..k.len {
            let idx = (k.head + TRAIL - k.len + n) % TRAIL;
            let (tx, ty) = k.trail[idx];
            let f = (n + 1) as f32 / k.len.max(1) as f32;
            let phase = (n as f32 * 0.08 + time as f32 * 0.01) % 4.0;
            let pal = if night { &AURORA } else { &AURORA_DAY };
            let c0 = pal[phase as usize % 4];
            let c1 = pal[(phase as usize + 1) % 4];
            let col = lerp_rgb(c0, c1, phase.fract());
            let (x, y) = (tx as f32 * q + u * 0.5, ty as f32 * q + u * 0.5);
            let wave = if calm { 0.0 } else { self.sin_of(n as u32 * 9 + time) as f32 / 127.0 };
            let len = (5.0 + 2.5 * wave) * u * (0.4 + 0.6 * f);
            let a = if night { 0.6 * f } else { 0.8 * f };
            let half = (1.0 * u).max(1.0);
            let top = y - u;
            for py in top as i32..(y + len) as i32 {
                let t = (py as f32 - top) / (len + u);
                // By day the curtain stays fuller for longer before it fades (still soft at its foot).
                let fade = if night { 1.0 - t } else { (1.0 - t) * (1.0 - t * 0.35) };
                let k_a = (a * fade * 255.0) as u32;
                if k_a == 0 {
                    continue;
                }
                // By day a thin deeper hem along the top edge outlines the ribbon against the sky.
                let hem = !night && (py as f32) < top + (0.45 * u).max(1.0);
                let c = if hem { shade_rgb(col, 0.72) } else { col };
                for px in (x - half) as i32..(x + half) as i32 {
                    // Light added at night (a real aurora), painted over the bright day sky.
                    if night {
                        self.add_px(px, py, c, k_a);
                    } else {
                        self.plot(px, py, c, k_a);
                    }
                }
            }
        }
        let (kx, ky) = ((k.x as f32 / 16.0 + 0.5) * u, (k.y as f32 / 16.0 + 0.5) * u);
        // The string, sagging a little, down to its peg.
        let (ax, ay) = ((k.ax as f32 + 0.5) * u, (k.ay as f32 + 0.5) * u);
        let (mx, my) = ((kx + ax) / 2.0, (ky + ay) / 2.0 + 4.0 * u);
        for s in 0..48 {
            let t = s as f32 / 47.0;
            let (x, y) = (
                (1.0 - t) * (1.0 - t) * kx + 2.0 * (1.0 - t) * t * mx + t * t * ax,
                (1.0 - t) * (1.0 - t) * (ky + 2.5 * u) + 2.0 * (1.0 - t) * t * my + t * t * ay,
            );
            self.disc(x, y, (0.35 * u).max(0.6), if night { 0xd8d0f0 } else { 0x5a4a7a }, 190);
        }
        self.fill_rect(ax - 0.5 * u, ay - 1.5 * u, ax + 0.5 * u, ay + 0.5 * u, 0x8a5a38, 255);
        // The kite: a diamond in four colours, leaning with its speed, with a happy face.
        let lean = (k.vx as f32 / 24.0).clamp(-1.0, 1.0) * 0.5;
        let u = u * 1.5;
        let (hw, hh) = (3.2 * u, 4.4 * u);
        self.glow_disc(kx, ky, 7.0 * u, 0xb48cff, 0.25);
        for py in (ky - hh) as i32..=(ky + hh) as i32 {
            let dy = py as f32 + 0.5 - ky;
            let span = hw * (1.0 - dy.abs() / hh);
            let shift = dy * lean;
            for px in (kx + shift - span) as i32..=(kx + shift + span) as i32 {
                let left = (px as f32 + 0.5) < kx + shift;
                let col = match (dy < 0.0, left) {
                    (true, true) => 0xff7eb6,
                    (true, false) => 0xffd447,
                    (false, true) => 0x8ab4ff,
                    (false, false) => 0xb48cff,
                };
                self.plot(px, py, col, 255);
            }
        }
        for s in 0..16 {
            let t = s as f32 / 15.0 * 2.0 - 1.0;
            self.plot((kx + t * hh * lean) as i32, (ky + t * hh) as i32, 0x6a3a20, 200);
            self.plot((kx + t * hw) as i32, ky as i32, 0x6a3a20, 200);
        }
        self.disc(kx - 0.9 * u, ky - 1.1 * u, 0.45 * u, 0x2a1a40, 255);
        self.disc(kx + 0.9 * u, ky - 1.1 * u, 0.45 * u, 0x2a1a40, 255);
        self.ellipse(kx, ky + 0.9 * u, 0.9 * u, 0.4 * u, 0xff5a8a, 255);
        // Little bows on its tail.
        for b in 1..4 {
            let t = b as f32 / 4.0;
            let (x, y) = (kx + (ax - kx) * t * 0.25, ky + hh + t * 6.0 * u);
            self.ellipse(x - 0.7 * u, y, 0.6 * u, 0.4 * u, AURORA[b % 4], 255);
            self.ellipse(x + 0.7 * u, y, 0.6 * u, 0.4 * u, AURORA[b % 4], 255);
        }
    }

    fn draw_treasure(&mut self, world: &World, time: u32, calm: bool) {
        let Some(t) = world.toys.treasure else { return };
        let cell = self.scale as f32;
        let u = cell * 1.4;
        if !t.found {
            // The X sits on top of the ground above the treasure, wherever the ground is now.
            let mut sy = t.y;
            while sy > 1 && world.parcel_firm(t.x, sy - 1) {
                sy -= 1;
            }
            let (cx, cy) = ((t.x as f32 + 0.5) * cell, sy as f32 * cell - 1.6 * u);
            let beat = if calm { 0.6 } else { 0.5 + 0.5 * (self.sin_of(time * 3) as f32 / 127.0) };
            self.glow_disc(cx, cy, 6.0 * u, 0xffd447, 0.25 + 0.3 * beat);
            let arm = 2.2 * u;
            for (w, col) in [(0.9 * u, 0x7a3a10u32), (0.55 * u, 0xffd447)] {
                for s in 0..=24 {
                    let f = s as f32 / 24.0 * 2.0 - 1.0;
                    self.disc(cx + f * arm, cy + f * arm, w, col, 255);
                    self.disc(cx + f * arm, cy - f * arm, w, col, 255);
                }
            }
            return;
        }
        // Found: it rises out of the ground, glowing, then settles as a keepsake.
        let age = t.age as f32;
        let rise = if calm { 9.0 } else { (age / 50.0).min(1.0) * 9.0 };
        let fade = if age > 180.0 { 1.0 - (age - 180.0) / 60.0 } else { 1.0 };
        let (cx, cy) = ((t.x as f32 + 0.5) * cell, (t.y as f32 - rise) * cell);
        let pop = if calm { 1.0 } else { 1.0 + (age / 5.0).sin() * (-age / 30.0).exp() * 0.4 };
        let r = 3.4 * u * pop;
        self.glow_disc(cx, cy, r * 3.0, 0xfff2a0, 0.5 * fade);
        let a = (255.0 * fade) as u32;
        match t.kind {
            T_SHELL => {
                // A scallop: a fan with ribs.
                self.ellipse(cx, cy, r, r * 0.85, 0xffc6d6, a);
                for k in -3..=3 {
                    let ang = k as f32 * 0.32;
                    for s in 0..10 {
                        let d = s as f32 / 10.0 * r;
                        self.plot((cx + ang.sin() * d) as i32, (cy + r * 0.6 - ang.cos() * d) as i32, 0xe0809a, a);
                    }
                }
                self.fill_rect(cx - 0.8 * u, cy + r * 0.6, cx + 0.8 * u, cy + r * 0.9, 0xe0809a, a);
            }
            T_METEORITE => {
                self.disc(cx, cy, r, 0x6a6278, a);
                self.disc(cx - r * 0.3, cy - r * 0.2, r * 0.3, 0x4c4658, a);
                self.disc(cx + r * 0.35, cy + r * 0.3, r * 0.22, 0x4c4658, a);
                self.ellipse(cx - r * 0.4, cy - r * 0.5, r * 0.25, r * 0.12, 0xfff2c0, a);
            }
            _ => {
                debug_assert_eq!(t.kind, T_FOSSIL);
                // An ammonite: a curled shell of stone.
                self.disc(cx, cy, r, 0xe8d6b0, a);
                for s in 0..60 {
                    let ang = s as f32 * 0.21;
                    let d = r * (1.0 - s as f32 / 66.0);
                    self.plot((cx + ang.cos() * d) as i32, (cy + ang.sin() * d) as i32, 0x9a7a50, a);
                }
            }
        }
    }

    /// Adds light to one pixel (for the aurora).
    #[inline]
    fn add_px(&mut self, x: i32, y: i32, rgb: u32, a: u32) {
        if x < 0 || y < 0 || x >= self.fw as i32 || y >= self.fh as i32 {
            return;
        }
        let idx = y as usize * self.fw + x as usize;
        let (r, g, b) = (((rgb >> 16) * a) >> 8, (((rgb >> 8) & 255) * a) >> 8, ((rgb & 255) * a) >> 8);
        self.frame[idx] = add_rgb(self.frame[idx], r, g, b);
    }
}
