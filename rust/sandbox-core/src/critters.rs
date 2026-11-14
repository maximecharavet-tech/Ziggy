//! The residents: one funny little animal per world. They walk, hop or swim
//! around the child's creation and can never be hurt: when something falls on
//! one, a bubble shield pops up and it hops out on top.

use crate::gen::*;
use crate::sim::*;
use crate::table::*;

pub const MAX_CRITTERS: usize = 12;

pub const C_IDLE: u8 = 0;
pub const C_WALK: u8 = 1;
pub const C_AIR: u8 = 2;

/// A critter. Positions are in 1/16 of a cell; (x, y) is the spot under its feet.
#[derive(Clone, Copy)]
pub struct Critter {
    /// Which animal: the id of its home world.
    pub kind: u8,
    pub x: i32,
    pub y: i32,
    pub vx: i32,
    pub vy: i32,
    pub dir: i8,
    pub state: u8,
    pub timer: u16,
    /// Ticks of happiness left (a favourite thing is near): the renderer shows it.
    pub mood: u8,
    /// Ticks of bubble shield left.
    pub shield: u8,
    /// The element that last landed on its head (the crab wears it as a hat).
    pub hat: u8,
    /// Pebbles the rover has collected.
    pub count: u8,
    /// Ticks since it last landed or turned (for squash and stretch).
    pub bounce: u8,
    /// A baby hatched from Ziggy's parcel: smaller, and it follows the child's finger.
    pub baby: bool,
}

impl Critter {
    pub fn new(kind: u8, cx: i32, cy: i32) -> Critter {
        Critter {
            kind,
            x: cx * 16 + 8,
            y: cy * 16,
            vx: 0,
            vy: 0,
            dir: 1,
            state: C_IDLE,
            timer: 40,
            mood: 0,
            shield: 0,
            hat: 0,
            count: 0,
            bounce: 0,
            baby: false,
        }
    }
}

impl World {
    fn crand(&mut self) -> u32 {
        let mut x = self.crng;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.crng = x;
        x
    }

    /// Does this cell hold a critter up (or stand in its way)?
    fn firm(&self, x: i32, y: i32) -> bool {
        if !self.inside(x, y) {
            return true;
        }
        let t = sp(self.cells[y as usize * self.w + x as usize]);
        if t == EMPTY
            || matches!(t, PLANT | FLOWER | KELP | CORAL | FROST | POLLEN | PLANKTON | RING | COMET | PIPE | ASH)
        {
            return false;
        }
        self.phase[t as usize] == P_BLOCK
    }

    fn afloat(&self, x: i32, y: i32) -> bool {
        self.inside(x, y) && self.phase[sp(self.cells[y as usize * self.w + x as usize]) as usize] == P_LIQUID
    }

    /// Adds a resident of this world at a cell (the child's stamp). When the world is full, the oldest one moves there.
    pub fn stamp_critter(&mut self, cx: i32, cy: i32) -> u32 {
        let cx = cx.clamp(1, self.w as i32 - 2);
        let cy = cy.clamp(2, self.h as i32 - 2);
        let c = Critter::new(self.world, cx, cy);
        if self.critters.len() >= MAX_CRITTERS {
            self.critters.remove(0);
        }
        self.critters.push(c);
        self.effect(FX_HEART, cx, cy - 4, 0);
        self.critters.len() as u32
    }

    /// The baby that hatches from Ziggy's warmed parcel.
    pub fn hatch_baby(&mut self, cx: i32, cy: i32) {
        self.stamp_critter(cx, cy);
        if let Some(c) = self.critters.last_mut() {
            c.baby = true;
            c.mood = 120;
        }
    }

    pub(crate) fn step_critters(&mut self) {
        for k in 0..self.critters.len() {
            let mut c = self.critters[k];
            self.step_critter(&mut c);
            self.critters[k] = c;
        }
    }

    fn step_critter(&mut self, c: &mut Critter) {
        let (w, h) = (self.w as i32, self.h as i32);
        c.x = c.x.clamp(16, (w - 2) * 16);
        c.y = c.y.clamp(32, (h - 1) * 16);
        let (cx, cy) = (c.x >> 4, c.y >> 4);
        c.mood = c.mood.saturating_sub(1);
        c.shield = c.shield.saturating_sub(1);
        c.bounce = c.bounce.saturating_add(1);
        c.timer = c.timer.saturating_sub(1);
        let swimmer = c.kind == UNDERSEA || c.kind == SPACE;

        // Something landed on it: bubble shield, and a hop out on top. Nobody gets buried.
        if self.firm(cx, cy - 1) {
            let t = self.get(cx, cy - 1);
            if (t as usize) < ELEMENT_COUNT && self.inside(cx, cy - 1) {
                c.hat = t;
            }
            let mut ny = cy - 1;
            while ny > 2 && (self.firm(cx, ny) || self.firm(cx, ny - 1)) {
                ny -= 1;
            }
            c.y = ny * 16 + 15;
            c.vy = -20;
            c.state = C_AIR;
            if c.shield == 0 {
                self.effect(FX_SHIELD, cx, ny - 2, 0);
            }
            c.shield = 90;
            c.bounce = 0;
            return;
        }

        if swimmer {
            // Floats about gently, turning before it touches anything.
            if c.timer == 0 {
                let r = self.crand();
                c.timer = 60 + (r % 160) as u16;
                c.vx = (r >> 8) as i32 % 5 - 2;
                c.vy = (r >> 16) as i32 % 3 - 1;
                if c.vx != 0 {
                    c.dir = c.vx.signum() as i8;
                }
            }
            let (nx, ny) = (c.x + c.vx, c.y + c.vy);
            let (ncx, ncy) = (nx >> 4, ny >> 4);
            if ncx < 4 || ncx > w - 5 || self.firm(ncx + c.vx.signum() * 3, ncy - 2) {
                c.vx = -c.vx;
                c.dir = -c.dir;
            } else {
                c.x = nx;
            }
            if ncy < 10 || ncy > h - 6 || self.firm(ncx, ncy + 2) || self.firm(ncx, ncy - 6) {
                c.vy = if ncy < h / 2 { 1 } else { -1 };
            } else {
                c.y = ny;
            }
            if c.kind == UNDERSEA {
                // Bubbles tickle the pufferfish: it puffs up.
                for dy in -5..=1 {
                    for dx in -4..=4 {
                        if self.get(cx + dx, cy + dy) == BUBBLE {
                            c.mood = 80;
                        }
                    }
                }
            } else if self.crand() % 240 == 0 {
                self.effect(FX_STAR, cx, cy - 6, 0xfff0a0); // the alien hiccups a star
                c.mood = 30;
            }
            return;
        }

        let crab = c.kind == ISLANDS;
        let on_ground = self.firm(cx, cy + 1) || (!crab && self.afloat(cx, cy + 1)) || (!crab && self.afloat(cx, cy));
        if !on_ground {
            // Falling (slowly on the Moon).
            let g = if self.world == MOON { 1 } else { 3 };
            c.vy = (c.vy + g).min(if self.afloat(cx, cy) { 4 } else { 14 });
            let mut ny = c.y + c.vy.max(-15);
            if c.vy < 0 && self.firm(cx, (ny >> 4) - 3) {
                c.vy = 0;
                ny = c.y;
            }
            c.y = ny;
            if c.state == C_AIR {
                let nx = c.x + c.vx;
                if !self.firm((nx >> 4) + c.dir as i32 * 2, (c.y >> 4) - 1) {
                    c.x = nx;
                }
            }
            c.state = C_AIR;
            return;
        }
        if !crab && self.afloat(cx, cy) && !self.firm(cx, cy - 1) {
            c.y -= 4; // bobs up to the surface
        }
        if c.state == C_AIR {
            // Landed.
            c.state = C_IDLE;
            c.timer = 20;
            c.vy = 0;
            c.bounce = 0;
            c.y = (c.y & !15) + 15;
        }
        if c.vy < 0 {
            c.y += c.vy;
            c.state = C_AIR;
            return;
        }
        if c.baby && self.pointer.0 >= 0 && c.state != C_AIR {
            // The baby trots after the finger.
            let gap = self.pointer.0 - cx;
            if gap.abs() > 3 {
                c.dir = gap.signum() as i8;
                c.state = C_WALK;
                c.timer = c.timer.max(10);
            }
        }
        if c.timer == 0 {
            let r = self.crand();
            if c.state == C_IDLE {
                c.state = C_WALK;
                c.timer = 90 + (r % 260) as u16;
                if (r >> 12) & 3 == 0 {
                    c.dir = -c.dir;
                }
            } else {
                c.state = C_IDLE;
                c.timer = 50 + (r % 150) as u16;
                self.emote(c, cx, cy);
            }
        }
        if c.state != C_WALK {
            return;
        }
        let dir = c.dir as i32;
        match c.kind {
            MOON => {
                // The moon bunny only moves by enormous slow hops.
                c.vy = -11 - (self.crand() % 5) as i32;
                c.vx = dir * 3;
                c.state = C_AIR;
                c.y -= 2;
                c.bounce = 0;
                return;
            }
            MOUNTAIN if self.crand() % 90 == 0 => {
                c.vy = -9;
                c.vx = dir * 3;
                c.state = C_AIR;
                c.y -= 2;
                c.bounce = 0;
                return;
            }
            _ => {}
        }
        let speed = match c.kind {
            GARDEN => (self.tick & 1) as i32,
            MARS => 2,
            VOLCANO => 1,
            _ => 2 - (self.tick & 1) as i32,
        };
        let nx = c.x + dir * speed;
        let ncx = nx >> 4;
        if ncx == cx {
            c.x = nx;
            return;
        }
        if ncx < 3 || ncx > w - 4 {
            c.dir = -c.dir;
            c.bounce = 0;
            return;
        }
        if c.kind == MARS {
            // The rover hoards the pebbles it meets.
            let t = self.get(ncx, cy);
            if (t == PEBBLE || t == METEORITE) && c.count < 99 {
                self.kill(cy as usize * self.w + ncx as usize);
                c.count += 1;
                c.mood = 90;
                self.effect(FX_BIP, cx, cy - 8, 1);
            }
        }
        if self.firm(ncx, cy) {
            // A step: climb it if it is low, else turn around.
            let mut up = 1;
            while up <= 3 && self.firm(ncx, cy - up) {
                up += 1;
            }
            if up <= 3 && !self.firm(ncx, cy - up - 1) && !self.firm(cx, cy - up - 1) {
                c.x = nx;
                c.y -= up * 16;
            } else {
                c.dir = -c.dir;
                c.bounce = 0;
            }
            return;
        }
        c.x = nx;
    }

    fn emote(&mut self, c: &mut Critter, cx: i32, cy: i32) {
        let r = self.crand() % 3;
        match c.kind {
            GARDEN => {
                // The snail loves a puddle.
                if self.wet(self.get(cx + c.dir as i32 * 2, cy)) || self.wet(self.get(cx, cy + 1)) {
                    c.mood = 120;
                    self.effect(FX_HEART, cx, cy - 6, 0);
                }
            }
            MOUNTAIN if r == 0 => {
                c.mood = 60;
                self.effect(FX_NOTE, cx, cy - 7, 0); // the marmot whistles
            }
            VOLCANO => {
                if self.get(cx, cy + 1) == LAVA {
                    self.effect(FX_ZZZ, cx, cy - 7, 0); // Bloup naps in its warm bath
                } else if r == 0 {
                    c.mood = 60;
                    self.effect(FX_HEART, cx, cy - 7, 0); // a heart-shaped burp
                }
            }
            MARS if r != 2 => {
                c.mood = 40;
                self.effect(FX_BIP, cx, cy - 8, 0); // "bip?"
            }
            ISLANDS if r == 0 => c.mood = 70, // the crab waves its claws
            _ => {}
        }
    }
}
