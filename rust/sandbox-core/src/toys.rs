//! Three surprises of Ziggy's parcel that live on in the world:
//!
//! - the **music snow-globe** (the parcel was frozen): everything that falls
//!   near it plays its note, on a gentle beat, like a music box;
//! - the **treasure map** (the parcel was buried): an X glows on the ground
//!   somewhere else in the world; digging there reveals a glowing fossil, shell
//!   or meteorite (and a sticker);
//! - the **aurora kite** (the parcel was left in the wind): a kite on a string
//!   that the child steers, painting the sky with an aurora ribbon.
//!
//! All three are deterministic (world random generator only), are never lost
//! (they come back inside the world, pop out when buried, survive "start
//! again"), and are part of the save bytes.

use crate::gen::*;
use crate::sim::*;
use crate::table::*;

/// A note at most every this many ticks (a music-box beat, never a cacophony).
pub const NOTE_EVERY: u32 = 6;
/// How far the snow-globe hears things fall, in cells.
pub const GLOBE_EARS: i32 = 26;
/// Points of the aurora ribbon behind the kite (one every two ticks).
pub const TRAIL: usize = 96;

pub const T_FOSSIL: u8 = 0;
pub const T_SHELL: u8 = 1;
pub const T_METEORITE: u8 = 2;

#[derive(Clone, Copy, Default, Debug)]
pub struct Globe {
    /// Base of the globe, in cells.
    pub x: i32,
    pub y: i32,
    /// Ticks of the little hop after a note (for the drawing).
    pub pulse: u8,
    /// The last note's pentatonic degree (0-7), for the drawing.
    pub degree: u8,
    pub notes: u32,
}

#[derive(Clone, Copy, Debug)]
pub struct Kite {
    /// Position in 1/16 of a cell, and speed.
    pub x: i32,
    pub y: i32,
    pub vx: i32,
    pub vy: i32,
    /// Where its string is tied (cells).
    pub ax: i32,
    pub ay: i32,
    /// Ribbon points (cells × 4), newest at `head - 1`.
    pub trail: [(i16, i16); TRAIL],
    pub head: usize,
    pub len: usize,
    /// Where the finger asks it to go this tick (cells), if anywhere.
    pub steer: Option<(i32, i32)>,
}

#[derive(Clone, Copy, Default, Debug)]
pub struct Treasure {
    pub x: i32,
    pub y: i32,
    /// T_FOSSIL, T_SHELL or T_METEORITE.
    pub kind: u8,
    pub found: bool,
    /// Ticks since it was found (the glowing reveal), saturating.
    pub age: u16,
}

#[derive(Clone, Default)]
pub struct Toys {
    pub globe: Option<Globe>,
    pub kite: Option<Kite>,
    pub treasure: Option<Treasure>,
    /// Notes since the last `take_notes`: element | degree << 6 | x << 9 | y << 18.
    pub notes: Vec<u32>,
}

impl Toys {
    pub fn new() -> Toys {
        Toys { notes: Vec::with_capacity(16), ..Default::default() }
    }
    pub fn any(&self) -> bool {
        self.globe.is_some() || self.kite.is_some() || self.treasure.is_some()
    }
}

/// The treasure of each world: fossils in rock and earth, shells by the sea, meteorites in the sky worlds.
pub fn treasure_kind(world: u8) -> u8 {
    match world {
        ISLANDS | UNDERSEA => T_SHELL,
        SPACE | MOON | MARS => T_METEORITE,
        _ => T_FOSSIL,
    }
}

impl World {
    /* ── Placing them ── */

    /// Puts the music snow-globe on the ground under (cx, cy) (moves it if there is one already).
    pub fn place_globe(&mut self, cx: i32, cy: i32) {
        let x = cx.clamp(6, self.w as i32 - 7);
        let mut y = cy.clamp(8, self.h as i32 - 2);
        if !self.params.radial && self.params.medium != SEA {
            while y < self.h as i32 - 2 && !self.parcel_firm(x, y + 1) {
                y += 1;
            }
        }
        let g = self.toys.globe.unwrap_or_default();
        self.toys.globe = Some(Globe { x, y, pulse: 12, ..g });
        self.effect(FX_STAR, x, y - 4, 0xbfe9ff);
    }

    /// Launches the aurora kite from (cx, cy): its string is tied there, it rises into the sky.
    pub fn place_kite(&mut self, cx: i32, cy: i32) {
        let ax = cx.clamp(4, self.w as i32 - 5);
        let ay = cy.clamp(4, self.h as i32 - 2);
        let top = self.sky_ceiling();
        let ky = (ay - 24).clamp(4, top);
        let p = (ax as i16 * 4, ky as i16 * 4);
        self.toys.kite = Some(Kite {
            x: ax * 16,
            y: ky * 16,
            vx: 0,
            vy: -8,
            ax,
            ay,
            trail: [p; TRAIL],
            head: 0,
            len: 0,
            steer: None,
        });
        self.effect(FX_STAR, ax, ky, 0xa78bfa);
    }

    /// The wind tool reached the kite: it is pushed along (and dances up a little).
    pub(crate) fn blow_kite(&mut self, cx: f32, cy: f32, r: f32, dir: i32) {
        if let Some(k) = self.toys.kite.as_mut() {
            let (dx, dy) = ((k.x >> 4) as f32 - cx, (k.y >> 4) as f32 - cy);
            if dx * dx + dy * dy <= (r + 8.0) * (r + 8.0) {
                k.vx = (k.vx + dir.signum() * 5).clamp(-24, 24);
                k.vy = (k.vy - 1).clamp(-24, 24);
            }
        }
    }

    /// The finger steers the kite towards (x, y) during the next tick.
    pub fn steer_kite(&mut self, x: f32, y: f32) {
        if !(x.is_finite() && y.is_finite()) {
            return;
        }
        if let Some(k) = self.toys.kite.as_mut() {
            k.steer = Some((x.clamp(0.0, 400.0) as i32, y.clamp(0.0, 400.0) as i32));
        }
    }

    /// Hides a treasure at (x, y) (negative y: under the ground of column x), or picks a spot by itself (negative x): under the ground,
    /// away from (avoid_x), preferring loose earth that small fingers can dig.
    pub fn bury_treasure(&mut self, x: i32, y: i32, avoid_x: i32) {
        let kind = treasure_kind(self.world);
        if x >= 0 {
            let x = x.clamp(2, self.w as i32 - 3);
            // A negative y: four cells under the ground of that column (a map kept in the other orientation).
            let y = if y < 0 {
                let mut top = 4;
                while top < self.h as i32 - 3 && !self.parcel_firm(x, top) {
                    top += 1;
                }
                top + 4
            } else {
                y
            };
            let y = y.clamp(2, self.h as i32 - 2);
            self.toys.treasure = Some(Treasure { x, y, kind, found: false, age: 0 });
            return;
        }
        let (w, h) = (self.w as i32, self.h as i32);
        let mut spot = None;
        for attempt in 0..64 {
            let x = 10 + (self.rand() % (w as u32 - 20).max(1)) as i32;
            if attempt < 40 && (x - avoid_x).abs() < w / 5 {
                continue;
            }
            let mut top = 4;
            while top < h - 3 && !self.parcel_firm(x, top) {
                top += 1;
            }
            let ty = top + 4;
            if top >= h - 3 || ty >= h - 1 || !self.parcel_firm(x, ty) || !self.parcel_firm(x, top + 2) {
                continue;
            }
            let loose = ELEMENTS[self.get(x, ty) as usize].kind == K_POWDER;
            if attempt < 48 && !loose {
                continue;
            }
            spot = Some((x, ty));
            break;
        }
        // An empty world: the treasure waits on the floor, under where the parcel was.
        let (x, y) = spot.unwrap_or((avoid_x.clamp(2, w - 3), h - 2));
        self.toys.treasure = Some(Treasure { x, y, kind, found: false, age: 0 });
    }

    /// The highest row the kite flies down to (it stays in the sky, above the ground).
    fn sky_ceiling(&self) -> i32 {
        if self.params.radial {
            self.h as i32 - 6
        } else {
            self.h as i32 * 55 / 100
        }
    }

    /// The parcel opened: frozen → the snow-globe, buried → the treasure map, wind → the kite.
    pub(crate) fn open_toy(&mut self, exposure: usize, cx: i32, cy: i32) {
        use crate::parcel::{X_BURIED, X_COLD, X_WIND};
        match exposure {
            X_COLD => self.place_globe(cx, cy),
            X_BURIED => self.bury_treasure(-1, 0, cx),
            X_WIND => self.place_kite(cx, cy),
            _ => {}
        }
    }

    /* ── Every tick ── */

    pub(crate) fn step_toys(&mut self) {
        if self.toys.globe.is_some() {
            self.step_globe();
        }
        if self.toys.kite.is_some() {
            self.step_kite();
        }
        if self.toys.treasure.is_some() {
            self.step_treasure();
        }
    }

    fn step_globe(&mut self) {
        let Some(mut g) = self.toys.globe else { return };
        g.pulse = g.pulse.saturating_sub(1);
        let (w, h) = (self.w as i32, self.h as i32);
        g.x = g.x.clamp(6, w - 7);
        g.y = g.y.clamp(8, h - 2);
        if self.tick % 4 == 0 {
            // It sits on the ground: falls gently when the ground goes, climbs out when buried.
            if self.parcel_firm(g.x, g.y - 2) && g.y > 8 {
                g.y -= 1;
            } else if !self.params.radial && self.params.medium != SEA && g.y < h - 2 && !self.parcel_firm(g.x, g.y + 1)
            {
                g.y += 1;
            }
        }
        if self.tick % NOTE_EVERY == 0 {
            // What fell near it this tick? The most common thing plays its note.
            let mut per = [0u16; ELEMENT_COUNT];
            let mut sx = [0i32; ELEMENT_COUNT];
            let cy = g.y - 3;
            for y in (cy - GLOBE_EARS).max(0)..(cy + GLOBE_EARS).min(h) {
                for x in (g.x - GLOBE_EARS).max(0)..(g.x + GLOBE_EARS).min(w) {
                    let i = y as usize * self.w + x as usize;
                    let c = self.cells[i];
                    if c == 0 || self.clock[i] != self.gen {
                        continue;
                    }
                    let t = sp(c);
                    if self.phase[t as usize] == P_GAS {
                        continue;
                    }
                    per[t as usize] += 1;
                    sx[t as usize] += x;
                }
            }
            let mut best = 0usize;
            for t in 1..ELEMENT_COUNT {
                if per[t] > per[best] {
                    best = t;
                }
            }
            if per[best] > 0 {
                let x = sx[best] / per[best] as i32;
                // Left is low, right is high: a pentatonic scale across the globe's ears.
                let degree = ((x - (g.x - GLOBE_EARS)) * 8 / (2 * GLOBE_EARS)).clamp(0, 7) as u8;
                g.degree = degree;
                g.pulse = 12;
                g.notes = g.notes.wrapping_add(1);
                if self.toys.notes.len() < self.toys.notes.capacity() && !self.quiet {
                    self.toys.notes.push(
                        best as u32
                            | (degree as u32) << 6
                            | (x.clamp(0, 511) as u32) << 9
                            | (cy.clamp(0, 511) as u32) << 18,
                    );
                }
                self.effect(FX_NOTE, g.x + degree as i32 - 4, g.y - 9, 0);
            }
        }
        self.toys.globe = Some(g);
    }

    fn step_kite(&mut self) {
        let Some(mut k) = self.toys.kite else { return };
        let w = self.w as i32;
        let ceiling = self.sky_ceiling();
        let steered = k.steer.is_some();
        if let Some((sx, sy)) = k.steer.take() {
            // Towards the finger, with a little lag (a kite, not a cursor), nearly critically damped.
            let (tx, ty) = (sx.clamp(3, w - 4) * 16, sy.clamp(3, ceiling) * 16);
            k.vx = (k.vx + ((tx - k.x) / 16).clamp(-10, 10)) / 2;
            k.vy = (k.vy + ((ty - k.y) / 16).clamp(-10, 10)) / 2;
        } else {
            // A gentle breeze: it loops lazily, tugged back above its string.
            let a = (self.tick as i32 * 5) & 1023;
            k.vx += crate::scenes::isin(a) / 512;
            k.vy += crate::scenes::isin(a * 2 + 256) / 640;
            let home_x = k.ax * 16;
            let home_y = ((k.ay - 30).clamp(6, ceiling)) * 16;
            k.vx += ((home_x - k.x) / 256).clamp(-1, 1);
            k.vy += ((home_y - k.y) / 256).clamp(-1, 1);
        }
        if !steered {
            k.vx = k.vx * 15 / 16;
            k.vy = k.vy * 15 / 16;
        }
        k.vx = k.vx.clamp(-24, 24);
        k.vy = k.vy.clamp(-24, 24);
        k.x += k.vx;
        k.y += k.vy;
        // Never lost: it stays in the sky of this world, and climbs out of anything solid.
        if k.x < 3 * 16 || k.x > (w - 4) * 16 {
            k.vx = -k.vx / 2;
            k.x = k.x.clamp(3 * 16, (w - 4) * 16);
        }
        if k.y < 3 * 16 || k.y > ceiling * 16 {
            k.vy = -k.vy / 2;
            k.y = k.y.clamp(3 * 16, ceiling * 16);
        }
        let mut lifts = 0;
        while self.parcel_firm(k.x >> 4, k.y >> 4) && k.y > 3 * 16 && lifts < 8 {
            k.y -= 16;
            k.vy = k.vy.min(0);
            lifts += 1;
        }
        if self.tick & 1 == 0 {
            k.trail[k.head] = (((k.x >> 2) as i16), ((k.y >> 2) as i16));
            k.head = (k.head + 1) % TRAIL;
            k.len = (k.len + 1).min(TRAIL);
        }
        self.toys.kite = Some(k);
    }

    fn step_treasure(&mut self) {
        let Some(mut t) = self.toys.treasure else { return };
        if t.found {
            if t.age == 0 {
                self.place_keepsake(&t);
            }
            t.age = t.age.saturating_add(1);
            self.toys.treasure = if t.age > 240 { None } else { Some(t) };
            return;
        }
        // Dug up: the spot is open (the eraser, the beam, a river carried the earth away).
        if !self.parcel_firm(t.x, t.y) && !self.parcel_firm(t.x, t.y - 1) {
            self.reveal_treasure(&mut t);
        }
        self.toys.treasure = Some(t);
    }

    /// The eraser went over the spot.
    pub(crate) fn dig_at(&mut self, cx: f32, cy: f32, r: f32) {
        let Some(mut t) = self.toys.treasure else { return };
        if t.found {
            return;
        }
        let (dx, dy) = (t.x as f32 - cx, t.y as f32 - cy);
        if dx * dx + dy * dy <= (r + 1.5) * (r + 1.5) {
            self.reveal_treasure(&mut t);
            self.toys.treasure = Some(t);
        }
    }

    fn reveal_treasure(&mut self, t: &mut Treasure) {
        t.found = true;
        t.age = 0;
        self.emit(R_GIFT_TREASURE, t.x, t.y);
        self.effect(FX_STAR, t.x, t.y - 2, 0xffd447);
        self.effect(FX_SPARK, t.x, t.y, 0xfff2a0);
    }

    /// The tick after it was found (when the digging finger has passed).
    fn place_keepsake(&mut self, t: &Treasure) {
        // The keepsake stays in the world, in the hole that was dug (or on the ground above it),
        // only in empty cells: it never takes the place of the child's build.
        let x = t.x;
        let mut y = t.y;
        while y > 1 && self.get(x, y) != EMPTY {
            y -= 1;
        }
        let put = |world: &mut World, x: i32, y: i32, e: u8| {
            if world.inside(x, y) && world.get(x, y) == EMPTY {
                world.set(x, y, e);
            }
        };
        match t.kind {
            T_SHELL => {
                put(self, x, y, SHELL);
                put(self, x + 1, y, SHELL);
            }
            T_METEORITE => {
                for (dx, dy) in [(0, 0), (1, 0), (0, -1), (1, -1)] {
                    put(self, x + dx, y + dy, METEORITE);
                }
            }
            _ => {
                for (dx, dy) in [(0, 0), (-1, 0), (1, 0), (0, -1)] {
                    if self.inside(x + dx, y + dy) && self.get(x + dx, y + dy) == EMPTY {
                        self.set(x + dx, y + dy, CRYSTAL);
                        self.set_state(x + dx, y + dy, 255, 0, false);
                    }
                }
            }
        }
        self.wake_all();
    }

    /// Notes since the last call were read: forget them.
    pub fn take_notes(&mut self) {
        self.toys.notes.clear();
    }

    /// What floats in the sky in a box of cells: bit 0 a cloud (or fog), bit 1 steam (a geyser's mist).
    pub fn probe_sky(&self, x0: i32, y0: i32, x1: i32, y1: i32) -> u32 {
        let (mut cloud, mut steam) = (0, 0);
        let (w, h) = (self.w as i32, self.h as i32);
        for y in y0.clamp(0, h)..y1.clamp(0, h) {
            for x in x0.clamp(0, w)..x1.clamp(0, w) {
                match self.get(x, y) {
                    CLOUD | FOG => cloud += 1,
                    STEAM => steam += 1,
                    _ => {}
                }
            }
        }
        (cloud >= 3) as u32 | ((steam >= 2) as u32) << 1
    }

    /// Mixes the toys into the world's fingerprint (only when there are some: older hashes stay valid).
    pub(crate) fn hash_toys(&self, mix: &mut impl FnMut(u32)) {
        if let Some(g) = self.toys.globe {
            mix(0x6c0b | (g.x as u32) << 16);
            mix(g.y as u32 | g.notes << 12);
        }
        if let Some(k) = self.toys.kite {
            mix(0x417e);
            mix(k.x as u32);
            mix(k.y as u32);
        }
        if let Some(t) = self.toys.treasure {
            mix(0x7e5a | (t.found as u32) << 16);
            mix(t.x as u32 | (t.y as u32) << 12 | (t.kind as u32) << 24);
        }
    }

    /// Appends the toys to a save (version 2 of the format).
    pub(crate) fn save_toys(&self, out: &mut Vec<u8>) {
        let mut flags = 0u8;
        if self.toys.globe.is_some() {
            flags |= 1;
        }
        if self.toys.kite.is_some() {
            flags |= 2;
        }
        if self.toys.treasure.is_some_and(|t| !t.found) {
            flags |= 4;
        }
        out.push(flags);
        if let Some(g) = self.toys.globe {
            out.extend_from_slice(&(g.x as u16).to_le_bytes());
            out.extend_from_slice(&(g.y as u16).to_le_bytes());
        }
        if let Some(k) = self.toys.kite {
            for v in [k.x >> 4, k.y >> 4, k.ax, k.ay] {
                out.extend_from_slice(&(v.clamp(0, 65535) as u16).to_le_bytes());
            }
        }
        if let Some(t) = self.toys.treasure.filter(|t| !t.found) {
            out.extend_from_slice(&(t.x as u16).to_le_bytes());
            out.extend_from_slice(&(t.y as u16).to_le_bytes());
        }
    }

    /// Reads what `save_toys` wrote; None if the bytes are cut short.
    pub(crate) fn read_toys(&self, mut u16s: impl FnMut() -> Option<u16>, flags: u8) -> Option<Toys> {
        let mut toys = Toys::new();
        let (w, h) = (self.w as i32, self.h as i32);
        if flags & 1 != 0 {
            let (x, y) = (u16s()? as i32, u16s()? as i32);
            toys.globe = Some(Globe { x: x.clamp(6, w - 7), y: y.clamp(8, h - 2), ..Default::default() });
        }
        if flags & 2 != 0 {
            let (x, y, ax, ay) = (u16s()? as i32, u16s()? as i32, u16s()? as i32, u16s()? as i32);
            let (x, y) = (x.clamp(3, w - 4), y.clamp(3, h - 2));
            toys.kite = Some(Kite {
                x: x * 16,
                y: y * 16,
                vx: 0,
                vy: 0,
                ax: ax.clamp(4, w - 5),
                ay: ay.clamp(4, h - 2),
                trail: [((x * 4) as i16, (y * 4) as i16); TRAIL],
                head: 0,
                len: 0,
                steer: None,
            });
        }
        if flags & 4 != 0 {
            let (x, y) = (u16s()? as i32, u16s()? as i32);
            toys.treasure = Some(Treasure {
                x: x.clamp(2, w - 3),
                y: y.clamp(2, h - 2),
                kind: treasure_kind(self.world),
                found: false,
                age: 0,
            });
        }
        Some(toys)
    }
}
