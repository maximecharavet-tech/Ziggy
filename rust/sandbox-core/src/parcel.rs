//! Ziggy's lost parcel, the tractor beam of his saucer, and the surprises.
//!
//! The parcel is a real object of the world: it falls on its parachute, lands
//! on the cells, floats, rolls down slopes. It never opens by a tap: it opens
//! through what the child does to it (water it, warm it, snow on it, bury it,
//! tickle it with bubbles, blow on it, let it float where gravity is low), and
//! which surprise comes out depends on that. It can never be lost.

use crate::gen::*;
use crate::sim::*;
use crate::table::*;

pub const P_NONE: u8 = 0;
pub const P_FALLING: u8 = 1;
pub const P_LANDED: u8 = 2;
pub const P_OPEN: u8 = 3;

/// Exposure needed before the parcel opens (about a second and a half of it).
pub const OPEN_AT: u16 = 90;

pub const EXPOSURES: usize = 7;
pub const X_WATER: usize = 0;
pub const X_WARM: usize = 1;
pub const X_COLD: usize = 2;
pub const X_BURIED: usize = 3;
pub const X_BUBBLE: usize = 4;
pub const X_WIND: usize = 5;
pub const X_LOWG: usize = 6;

#[derive(Clone, Copy, Default)]
pub struct Parcel {
    pub state: u8,
    /// Position of its base, in 1/16 of a cell.
    pub x: i32,
    pub y: i32,
    pub vx: i32,
    pub vy: i32,
    pub exposure: [u16; EXPOSURES],
    /// Which exposure opened it (index + 1), once open.
    pub opened: u8,
    /// Ticks since it landed, opened or was last bumped (for the squash and the pop).
    pub age: u16,
    pub(crate) stuck: u16,
}

impl World {
    /// Ziggy drops his parcel from the saucer. If one is already out, nothing happens (returns false).
    pub fn drop_parcel(&mut self, cx: i32, cy: i32) -> bool {
        if self.parcel.state == P_FALLING || self.parcel.state == P_LANDED {
            return false;
        }
        let cx = cx.clamp(6, self.w as i32 - 7);
        let cy = cy.clamp(6, self.h as i32 - 8);
        self.parcel = Parcel { state: P_FALLING, x: cx * 16 + 8, y: cy * 16, ..Parcel::default() };
        true
    }

    fn parcel_firm(&self, x: i32, y: i32) -> bool {
        if !self.inside(x, y) {
            return true;
        }
        let t = sp(self.cells[y as usize * self.w + x as usize]);
        t != EMPTY && self.phase[t as usize] == P_BLOCK && !matches!(t, PLANT | FLOWER | KELP | CORAL | FROST | POLLEN | PLANKTON | RING | COMET | ASH | SNOW | STARDUST)
    }

    pub(crate) fn step_parcel(&mut self) {
        let mut p = self.parcel;
        if p.state == P_NONE {
            return;
        }
        p.age = p.age.saturating_add(1);
        if p.state == P_OPEN {
            if p.age > 150 {
                p.state = P_NONE;
            }
            self.parcel = p;
            return;
        }
        let (w, h) = (self.w as i32, self.h as i32);
        // Never lost: outside the world, it comes back in.
        p.x = p.x.clamp(4 * 16, (w - 5) * 16);
        if p.y < 5 * 16 {
            p.y = 5 * 16;
            p.vy = p.vy.max(0);
        }
        if p.y > (h - 2) * 16 {
            p.y = (h - 2) * 16;
            p.vy = 0;
        }
        let (cx, cy) = (p.x >> 4, p.y >> 4);
        let sea = self.params.medium == SEA;
        let here = self.get(cx, cy);
        let liquid_here = self.phase[here as usize] == P_LIQUID || (sea && here == EMPTY);
        let support = self.parcel_firm(cx, cy + 1);

        // What is happening to it?
        let (mut wet, mut cold, mut bubbles, mut warm, mut over) = (0, 0, 0, 0, 0);
        for dy in -5..=1 {
            for dx in -3..=3 {
                if !self.inside(cx + dx, cy + dy) {
                    continue;
                }
                let t = self.get(cx + dx, cy + dy);
                match t {
                    WATER | DYED | SALTWATER if dy <= 0 => wet += 1,
                    SNOW | ICE | DRYICE | FROST if dy <= 0 => cold += 1,
                    BUBBLE => bubbles += 1,
                    HEAT | LAVA | STAR => warm += 1,
                    _ => {}
                }
                if dy <= -1 && dx.abs() <= 2 && self.parcel_firm(cx + dx, cy + dy) && !matches!(t, STONE | BASALT | GLASS | DOME | PIPE | ICE) {
                    over += 1;
                }
            }
        }
        if self.thermal_on > 0 && self.temp_at(cx, (cy - 1).max(0)) > (self.ambient >> 5) + 24 {
            warm += 2;
        }
        let low_gravity = self.params.radial || self.grav < 110;
        let airborne = p.state == P_FALLING && !liquid_here;
        let adds = [wet >= 2, warm >= 1, cold >= 2, over >= 9, bubbles >= 1, false, low_gravity && airborne && !sea && self.tick % 3 == 0];
        for (k, &on) in adds.iter().enumerate() {
            if on {
                p.exposure[k] = p.exposure[k].saturating_add(if k == X_BUBBLE { 6 } else { 1 });
            }
        }
        for k in 0..EXPOSURES {
            if p.exposure[k] >= OPEN_AT {
                p.state = P_OPEN;
                p.opened = k as u8 + 1;
                p.age = 0;
                self.parcel = p;
                self.emit(R_GIFT_WATER + k as u8, cx, cy - 2);
                self.effect(FX_STAR, cx, cy - 2, 0xffd447);
                return;
            }
        }

        // Stuck inside something solid for a while (not just buried in loose dust): it pops out on top.
        if self.parcel_firm(cx, cy) && matches!(here, STONE | BASALT | GLASS | DOME | PIPE | ICE | GEYSER | GRAVITY) {
            p.stuck += 1;
            if p.stuck > 20 {
                let mut ny = cy;
                while ny > 6 && self.parcel_firm(cx, ny) {
                    ny -= 1;
                }
                p.y = ny * 16 + 15;
                p.stuck = 0;
                p.age = 0;
                self.effect(FX_SHIELD, cx, ny - 2, 0);
            }
            self.parcel = p;
            return;
        }
        p.stuck = 0;

        if self.params.radial {
            // In space it circles the nearest little planet, or just floats.
            let i = cy as usize * self.w + cx as usize;
            let d = self.gdir[i];
            if d != NOG {
                let gd = self.gdist[i] as i32;
                let turn = if gd > 22 { 1 } else if gd < 16 { 3 } else { 2 };
                let dir = ((d + turn) & 7) as usize;
                if self.tick & 1 == 0 && !self.parcel_firm(cx + DX[dir] * 2, cy + DY[dir] * 2) {
                    p.x += DX[dir] * 5;
                    p.y += DY[dir] * 5;
                }
            } else {
                p.x += p.vx;
                p.y += p.vy / 2;
                p.vx = p.vx * 31 / 32;
                p.vy = p.vy * 31 / 32;
            }
            p.state = P_FALLING;
            self.parcel = p;
            return;
        }
        if liquid_here {
            // It floats: bobs up through water until its top is in the air (or stays mid-water in the sea).
            let target_up = !sea || cy > h / 2;
            p.vy = if target_up { (p.vy - 1).max(-5) } else { (p.vy + 1).min(2) };
            if self.parcel_firm(cx, cy - 3) {
                p.vy = p.vy.max(0);
            }
            p.y += p.vy;
            p.vx = p.vx * 15 / 16;
            p.x += p.vx;
            p.state = P_FALLING;
            self.parcel = p;
            return;
        }
        if !support {
            // Falling on its parachute (very slowly where gravity is low).
            let limit = (self.grav as i32 * 7 / 255).max(1);
            p.vy = (p.vy + 1).min(limit);
            if self.phase[self.get(cx, cy + 1) as usize] == P_LIQUID && p.vy > 2 {
                p.vy = 2;
            }
            p.y += p.vy;
            p.vx = p.vx * 31 / 32;
            let nx = p.x + p.vx;
            if !self.parcel_firm((nx >> 4) + p.vx.signum() * 2, cy - 1) {
                p.x = nx;
            } else {
                p.vx = -p.vx / 2;
            }
            if p.state != P_FALLING {
                p.state = P_FALLING;
            }
            self.parcel = p;
            return;
        }
        if p.state == P_FALLING {
            p.state = P_LANDED;
            p.age = 0;
            p.vy = 0;
            p.y = (p.y & !15) + 15;
        }
        // On a slope it rolls down.
        if p.vx == 0 {
            for dir in [-1, 1] {
                if !self.parcel_firm(cx + dir * 2, cy) && !self.parcel_firm(cx + dir * 2, cy + 1) && !self.parcel_firm(cx + dir * 3, cy + 2) && self.parcel_firm(cx - dir * 2, cy + 1) {
                    p.vx = dir * 4;
                }
            }
        }
        if p.vx != 0 {
            let nx = p.x + p.vx;
            if self.parcel_firm((nx >> 4) + p.vx.signum() * 2, cy) {
                p.vx = 0;
            } else {
                p.x = nx;
                p.vx -= p.vx.signum() * (self.tick & 1) as i32;
            }
        }
        self.parcel = p;
    }

    /// The wind tool reached the parcel: it slides along and counts as "left in the wind".
    pub(crate) fn blow_parcel(&mut self, cx: f32, cy: f32, r: f32, dir: i32) {
        let p = &mut self.parcel;
        if p.state != P_FALLING && p.state != P_LANDED {
            return;
        }
        let (dx, dy) = ((p.x >> 4) as f32 - cx, (p.y >> 4) as f32 - 2.0 - cy);
        if dx * dx + dy * dy <= (r + 4.0) * (r + 4.0) {
            p.vx = (p.vx + dir * 2).clamp(-10, 10);
            p.exposure[X_WIND] = p.exposure[X_WIND].saturating_add(3);
        }
    }

    /// The tractor beam: loose cells, critters and the parcel inside the beam's
    /// disc are carried from (x0, y0) to (x1, y1); what lies under it is drawn up.
    pub fn beam(&mut self, x0: f32, y0: f32, x1: f32, y1: f32, r: f32) {
        if !(x0.is_finite() && y0.is_finite() && x1.is_finite() && y1.is_finite() && r.is_finite()) {
            return;
        }
        let r = r.clamp(2.0, 14.0) as i32;
        let (bx, by) = (x0.clamp(0.0, self.w as f32 - 1.0) as i32, y0.clamp(0.0, self.h as f32 - 1.0) as i32);
        let dx = ((x1 - x0).round() as i32).clamp(-3, 3);
        let dy = ((y1 - y0).round() as i32).clamp(-3, 3);
        let w = self.w;
        let movable = |world: &World, c: u32| {
            let t = sp(c);
            let k = ELEMENTS[t as usize].kind;
            c != 0 && c & FIXED == 0 && (k == K_POWDER || k == K_LIQUID || ELEMENTS[t as usize].flags & F_LOOSE != 0 || matches!(t, COCONUT | SHELL | METEORITE | LAVA | PLANKTON)) && world.phase[t as usize] != P_GAS
        };
        // Carry what is in the disc (walk against the motion so each cell moves once).
        if dx != 0 || dy != 0 {
            for ky in 0..=2 * r {
                let y = if dy > 0 { by + r - ky } else { by - r + ky };
                for kx in 0..=2 * r {
                    let x = if dx > 0 { bx + r - kx } else { bx - r + kx };
                    let (ox, oy) = (x - bx, y - by);
                    if ox * ox + oy * oy > r * r || !self.inside(x, y) || !self.inside(x + dx, y + dy) {
                        continue;
                    }
                    let i = y as usize * w + x as usize;
                    let j = (y + dy) as usize * w + (x + dx) as usize;
                    if movable(self, self.cells[i]) && self.cells[j] == 0 {
                        self.swap(i, j);
                        self.aux[j] = 0;
                    }
                }
            }
        }
        // Draw up what lies under the beam, and hold what is inside against gravity.
        for x in bx - r + 1..bx + r {
            for y in (by - r).max(1)..(by + r + 26).min(self.h as i32) {
                if !self.inside(x, y) {
                    continue;
                }
                let i = y as usize * w + x as usize;
                let inside_disc = (x - bx) * (x - bx) + (y - by) * (y - by) <= r * r;
                if movable(self, self.cells[i]) {
                    if !inside_disc && self.cells[i - w] == 0 && self.rand() & 1 == 0 {
                        self.swap(i, i - w);
                    } else {
                        self.clock[i] = self.gen.wrapping_add(1).max(1);
                        self.keep(i);
                    }
                }
            }
        }
        let grab = (r + 5) * 16;
        for k in 0..self.critters.len() {
            let c = &mut self.critters[k];
            if (c.x - bx * 16).abs() < grab && (c.y - by * 16 - 48).abs() < grab + 64 {
                c.x += (bx * 16 - c.x) / 6 + dx * 16;
                c.y += ((by + 2) * 16 - c.y) / 6 + dy * 16;
                c.vy = 0;
                c.mood = 90;
                c.state = crate::critters::C_AIR;
            }
        }
        let p = &mut self.parcel;
        if (p.state == P_FALLING || p.state == P_LANDED) && (p.x - bx * 16).abs() < grab && (p.y - by * 16 - 48).abs() < grab + 64 {
            p.x += (bx * 16 - p.x) / 6 + dx * 16;
            p.y += ((by + 2) * 16 - p.y) / 6 + dy * 16;
            p.vy = 0;
            p.state = P_FALLING;
        }
    }

    /// Places a surprise from the parcel in the world. `kind` 0-7: the signature toy of that world; 8: a pocket star; 9: a rainbow seed.
    pub fn place_gift(&mut self, kind: u32, cx: i32, cy: i32) {
        let cx = cx.clamp(10, self.w as i32 - 11);
        let mut g = cy.clamp(12, self.h as i32 - 4);
        if !self.params.radial && self.params.medium != SEA {
            while g < self.h as i32 - 2 && !self.parcel_firm(cx, g + 1) {
                g += 1;
            }
        }
        let put = |world: &mut World, x: i32, y: i32, t: u8| {
            if world.inside(x, y) && world.get(x, y) == EMPTY {
                world.set(x, y, t);
            }
        };
        match kind {
            0 => {
                // A giant sunflower.
                self.grown_plant(cx, g + 1, 16, 1, V_GIANT);
                for (dx, dy) in [(-1, -1), (1, -1), (-2, 0), (2, 0), (0, -2), (-1, 1), (1, 1)] {
                    let y = g - 15 + dy;
                    if self.get(cx + dx, y) == EMPTY && self.inside(cx + dx, y) {
                        self.set(cx + dx, y, FLOWER);
                        self.set_state(cx + dx, y, 1, PETAL, true);
                    }
                }
            }
            1 => {
                // An echo crystal: a cluster already full of light.
                for (dx, hgt) in [(-2, 3), (-1, 5), (0, 8), (1, 6), (2, 3)] {
                    for k in 0..hgt {
                        put(self, cx + dx, g - k, CRYSTAL);
                        self.set_state(cx + dx, g - k, 255, 0, false);
                    }
                }
            }
            2 => {
                // A sandcastle, straight out of the mould.
                for dx in -6..=6i32 {
                    let tower = dx.abs() >= 5 || dx.abs() <= 1;
                    let top = if tower { 8 } else { 4 };
                    for k in 0..top {
                        put(self, cx + dx, g - k, WETSAND);
                    }
                    if tower && dx % 2 == 0 {
                        put(self, cx + dx, g - top, WETSAND);
                    }
                }
            }
            3 => {
                // A friendly mini volcano with a spoonful of warm jam.
                for dx in -6..=6i32 {
                    for k in 0..(7 - dx.abs()).min(5) {
                        put(self, cx + dx, g - k, if dx.abs() <= 1 && k >= 3 { LAVA } else { BASALT });
                        if dx.abs() <= 1 && k >= 3 {
                            self.set_state(cx + dx, g - k, 255, 1, false);
                        }
                    }
                }
            }
            4 => {
                // A pearl lantern.
                for (dx, dy) in [(-2, 0), (2, 0), (-2, -1), (2, -1), (-2, -2), (2, -2), (-1, -3), (0, -3), (1, -3), (-1, 1), (0, 1), (1, 1)] {
                    put(self, cx + dx, g + dy - 1, GLASS);
                }
                for (dx, dy) in [(0, 0), (-1, 0), (1, 0), (0, -1)] {
                    put(self, cx + dx, g + dy - 1, PEARL);
                }
            }
            5 => {
                // A ring to throw around the little planet.
                if let Some(&(sx, sy, _)) = self.sources.first() {
                    for k in 0..40 {
                        let a = k * 1024 / 40;
                        let (x, y) = (sx + crate::scenes::isin(a + 256) * 18 / 1024, sy + crate::scenes::isin(a) * 18 / 1024);
                        put(self, x, y, RING);
                        self.set_state(x, y, 18, 1, false);
                    }
                }
            }
            6 => {
                // A flag pole: the child draws the flag.
                for k in 0..12 {
                    put(self, cx, g - k, PIPE);
                }
                for (dx, dy) in [(1, -11), (2, -11), (3, -11), (1, -10), (2, -10), (3, -10), (4, -10), (1, -9), (2, -9), (3, -9)] {
                    put(self, cx + dx, g + dy, GLASS);
                }
            }
            7 => {
                // A tiny greenhouse kit: a dome over a bed of earth.
                let r = 8;
                for y in -r..=0i32 {
                    for x in -r..=r {
                        let d2 = x * x + y * y;
                        if d2 <= r * r + r && d2 >= (r - 1) * (r - 1) {
                            put(self, cx + x, g + y, DOME);
                        }
                    }
                }
                for dx in -r + 2..=r - 2 {
                    put(self, cx + dx, g, SOIL);
                }
            }
            8 => {
                for (dx, dy) in [(0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)] {
                    put(self, cx + dx, (cy + dy).max(1), STAR);
                }
            }
            _ => {
                put(self, cx, (cy - 1).max(1), SEED);
                let y = (cy - 1).max(1);
                if self.get(cx, y) == SEED {
                    self.set_state(cx, y, 0, 1, false);
                }
            }
        }
        self.effect(FX_STAR, cx, g - 4, 0xffd447);
        self.wake_all();
    }
}
