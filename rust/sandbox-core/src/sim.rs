//! The simulation core: a "falling sand" cellular automaton.
//!
//! Every cell is one packed `u32` (element, two state bytes, a colour shade).
//! Each tick, the cells of the chunks that are awake look at their neighbours
//! and move or react. Integer-only and seeded: the same seed and the same
//! gestures always give the same world, natively and in WebAssembly.

use crate::critters::Critter;
use crate::gen::*;
use crate::table::*;

/// The eight neighbours, clockwise from north.
pub const DX: [i32; 8] = [0, 1, 1, 1, 0, -1, -1, -1];
pub const DY: [i32; 8] = [-1, -1, 0, 1, 1, 1, 0, -1];
pub const DOWN: u8 = 4;
/// No gravity here (deep space).
pub const NOG: u8 = 8;

/// Cell flag: part of the starting scene, it stays as it is (a scene cloud does not fade, a scene plant does not grow).
pub const FIXED: u32 = 0x40;

/// Plant flags stored in `b`: the growing tip carries the growth budget in its low 6 bits.
pub const TIP: u8 = 0x80;
pub const LEAF: u8 = 0x40;
pub const BUDGET: u8 = 0x3f;
/// Flower part stored in `b`.
pub const PETAL: u8 = 0;
pub const CENTER: u8 = 1;
/// Plant variants, stored in the top 3 bits of the shade.
pub const V_PLAIN: u8 = 0;
pub const V_CACTUS: u8 = 1;
pub const V_REED: u8 = 2;
pub const V_GIANT: u8 = 3;
pub const V_PALM: u8 = 4;

/// Chunks are 32×32 cells; a chunk with nothing going on sleeps.
pub const CHUNK: usize = 32;
const AWAKE: u8 = 2;

/// Little effects the renderer plays (they never change the simulation).
pub const FX_SPARK: u8 = 0;
pub const FX_PUFF: u8 = 1;
pub const FX_HEART: u8 = 2;
pub const FX_NOTE: u8 = 3;
pub const FX_STAR: u8 = 4;
pub const FX_SPLASH: u8 = 5;
pub const FX_BIP: u8 = 6;
pub const FX_ZZZ: u8 = 7;
pub const FX_SHIELD: u8 = 8;
pub const FX_SWIRL: u8 = 9;
pub const FX_TRAIL: u8 = 10;

#[inline]
pub fn sp(c: u32) -> u8 {
    (c & 0x3f) as u8
}
#[inline]
pub fn ca(c: u32) -> u8 {
    (c >> 8) as u8
}
#[inline]
pub fn cb(c: u32) -> u8 {
    (c >> 16) as u8
}
#[inline]
pub fn shade(c: u32) -> u8 {
    (c >> 24) as u8
}
#[inline]
pub fn with_a(c: u32, a: u8) -> u32 {
    (c & !0xff00) | ((a as u32) << 8)
}
#[inline]
pub fn with_b(c: u32, b: u8) -> u32 {
    (c & !0x00ff_0000) | ((b as u32) << 16)
}
#[inline]
pub fn mk(s: u8, a: u8, b: u8, sh: u8) -> u32 {
    s as u32 | ((a as u32) << 8) | ((b as u32) << 16) | ((sh as u32) << 24)
}

/// How a cell stands in the way: 0 blocks, 1 gas (things fall through), 2 liquid.
pub const P_BLOCK: u8 = 0;
pub const P_GAS: u8 = 1;
pub const P_LIQUID: u8 = 2;

pub struct World {
    pub w: usize,
    pub h: usize,
    pub world: u8,
    pub params: &'static Params,
    pub cells: Vec<u32>,
    /// Plant height above its root (for the sway), fall counter of powders, drift direction in space.
    pub aux: Vec<u8>,
    pub(crate) clock: Vec<u8>,
    pub(crate) gen: u8,
    pub tick: u32,
    pub(crate) rng: u32,
    /// Every reaction that ever happened in this world, by kind (exact).
    pub counts: [u32; REACTION_COUNT],
    /// Reactions since the last `take_events`: kind | x << 7 | y << 16, at most one per kind per tick.
    pub events: Vec<u32>,
    fired: [bool; REACTION_COUNT],
    quiet: bool,
    // Dirty chunks.
    pub cw: usize,
    pub ch: usize,
    pub(crate) active: Vec<u8>,
    run: Vec<bool>,
    // Temperature, at half resolution, in 1/32 of a degree.
    pub tw: usize,
    pub th: usize,
    pub temp: Vec<i16>,
    pub ambient: i16,
    pub(crate) thermal_on: u8,
    /// Slider for the big kids: -70..70 added to the world's everyday temperature.
    pub temp_offset: i8,
    /// Slider for the big kids: gravity in percent of the world's own (20..200).
    pub gravity_pct: u8,
    pub(crate) grav: u32,
    pub night: bool,
    // Radial gravity (space).
    pub gdir: Vec<u8>,
    pub gdist: Vec<u8>,
    pub(crate) grav_dirty: bool,
    pub sources: Vec<(i32, i32, i32)>,
    pub stars: Vec<(i32, i32)>,
    stars_next: Vec<(i32, i32)>,
    pub(crate) phase: [u8; 64],
    visit: [bool; 64],
    thermal: [bool; 64],
    reactive: [bool; 64],
    lut: Vec<u16>,
    pub critters: Vec<Critter>,
    pub(crate) crng: u32,
    pub fx: Vec<(u8, u16, u16, u32)>,
    /// Ticks of rainbow left in the sky, and raindrops since the last one.
    pub rainbow: u16,
    pub(crate) raindrops: u16,
}

impl World {
    pub fn new(w: usize, h: usize, seed: u32, world: u8) -> World {
        let w = w.clamp(8, 320);
        let h = h.clamp(8, 320);
        let world = if world < WORLD_COUNT { world } else { GARDEN };
        let params = &WORLDS[world as usize];
        let n = w * h;
        let cw = w.div_ceil(CHUNK);
        let ch = h.div_ceil(CHUNK);
        let tw = w.div_ceil(2);
        let th = h.div_ceil(2);
        let mut phase = [P_BLOCK; 64];
        let mut visit = [false; 64];
        let mut thermal = [false; 64];
        let mut reactive = [false; 64];
        for (k, e) in ELEMENTS.iter().enumerate() {
            phase[k] = match e.kind {
                K_GAS => P_GAS,
                K_LIQUID => P_LIQUID,
                _ => P_BLOCK,
            };
            visit[k] = e.kind != K_SOLID;
            thermal[k] = e.hot_at != 0 || e.cold_at != 0;
        }
        for s in [STEAM, CLOUD, BUBBLE, GAS] {
            phase[s as usize] = P_GAS;
        }
        phase[LAVA as usize] = P_LIQUID;
        visit[EMPTY as usize] = false;
        let mut lut = vec![0u16; 64 * 64];
        for (k, r) in RULES.iter().enumerate() {
            lut[((r.a as usize) << 6) | r.b as usize] = k as u16 + 1;
            reactive[r.a as usize] = true;
            visit[r.a as usize] = true;
        }
        let ambient = (params.ambient as i16) << 5;
        let mut world = World {
            w,
            h,
            world,
            params,
            cells: vec![0; n],
            aux: vec![0; n],
            clock: vec![0; n],
            gen: 1,
            tick: 0,
            rng: if seed == 0 { 0x9e37_79b9 } else { seed },
            counts: [0; REACTION_COUNT],
            events: Vec::with_capacity(REACTION_COUNT * 4),
            fired: [false; REACTION_COUNT],
            quiet: false,
            cw,
            ch,
            active: vec![AWAKE; cw * ch],
            run: vec![true; cw * ch],
            tw,
            th,
            temp: vec![ambient; tw * th],
            ambient,
            thermal_on: 0,
            temp_offset: 0,
            gravity_pct: 100,
            grav: params.gravity as u32,
            night: false,
            gdir: if params.radial { vec![NOG; n] } else { Vec::new() },
            gdist: if params.radial { vec![255; n] } else { Vec::new() },
            grav_dirty: params.radial,
            sources: Vec::with_capacity(8),
            stars: Vec::with_capacity(8),
            stars_next: Vec::with_capacity(8),
            phase,
            visit,
            thermal,
            reactive,
            lut,
            critters: Vec::with_capacity(crate::critters::MAX_CRITTERS),
            crng: seed ^ 0x5bd1_e995 | 1,
            fx: Vec::with_capacity(96),
            rainbow: 0,
            raindrops: 0,
        };
        world.set_gravity(100);
        world
    }

    /* ── Random numbers (xorshift32: tiny, fast and reproducible) ── */

    #[inline]
    pub fn rand(&mut self) -> u32 {
        let mut x = self.rng;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.rng = x;
        x
    }

    /// True once in `n` times.
    #[inline]
    pub fn chance(&mut self, n: u32) -> bool {
        self.rand() % n == 0
    }

    /// +1 or -1.
    #[inline]
    pub(crate) fn side(&mut self) -> i32 {
        if self.rand() & 1 == 0 {
            1
        } else {
            -1
        }
    }

    /* ── Cells ── */

    #[inline]
    pub fn inside(&self, x: i32, y: i32) -> bool {
        x >= 0 && y >= 0 && (x as usize) < self.w && (y as usize) < self.h
    }

    /// The element at a cell; outside the world is stone.
    #[inline]
    pub fn get(&self, x: i32, y: i32) -> u8 {
        if self.inside(x, y) {
            sp(self.cells[y as usize * self.w + x as usize])
        } else {
            STONE
        }
    }

    /// The neighbour of (x, y) in direction `d`, if it is inside the world.
    #[inline]
    pub(crate) fn nb(&self, x: i32, y: i32, d: u8) -> Option<usize> {
        let nx = x + DX[(d & 7) as usize];
        let ny = y + DY[(d & 7) as usize];
        if self.inside(nx, ny) {
            Some(ny as usize * self.w + nx as usize)
        } else {
            None
        }
    }

    /// Puts a fresh element in a cell, with its colour variation and starting state.
    pub fn set(&mut self, x: i32, y: i32, t: u8) {
        if self.inside(x, y) && (t as usize) < ELEMENT_COUNT {
            self.spawn(y as usize * self.w + x as usize, t);
        }
    }

    /// Changes the state bytes of a cell (scenes and tests).
    pub fn set_state(&mut self, x: i32, y: i32, a: u8, b: u8, fixed: bool) {
        if !self.inside(x, y) {
            return;
        }
        let i = y as usize * self.w + x as usize;
        let c = with_b(with_a(self.cells[i], a), b);
        self.cells[i] = if fixed { c | FIXED } else { c & !FIXED };
    }

    pub(crate) fn spawn(&mut self, i: usize, t: u8) {
        let t = if self.params.medium == SEA {
            match t {
                WATER | SALTWATER | DYED => EMPTY,
                STEAM => BUBBLE,
                _ => t,
            }
        } else {
            t
        };
        let old = sp(self.cells[i]);
        if t == GRAVITY || old == GRAVITY {
            self.grav_dirty = true;
        }
        if t == EMPTY {
            self.cells[i] = 0;
            self.aux[i] = 0;
            self.wake(i);
            return;
        }
        let r = self.rand();
        let k = (r >> 8) & 0xffff;
        let (a, b) = match t {
            CLOUD => (5 + (k % 6) as u8, 0),
            FLOWER => ((k % 5) as u8, 0),
            LAVA => (255, 0),
            CRYSTAL => (0, 2 + (k % 3) as u8),
            CORAL => (8 + (k % 7) as u8, ((k >> 4) % 5) as u8),
            KELP => (10 + (k % 14) as u8, 0),
            GAS => ((k % 3) as u8, 0),
            INK | DYED => ((k % 5) as u8, 0),
            _ => (0, 0),
        };
        self.cells[i] = mk(t, a, b, r as u8);
        self.aux[i] = 0;
        self.clock[i] = self.gen;
        self.wake(i);
    }

    /// Empties the whole world (the reaction counters are kept; the critters stay).
    pub fn clear(&mut self) {
        self.cells.fill(0);
        self.aux.fill(0);
        self.temp.fill(self.ambient);
        self.active.fill(AWAKE);
        self.grav_dirty = self.params.radial;
        self.stars.clear();
        self.rainbow = 0;
        self.raindrops = 0;
    }

    /// Number of cells holding this element.
    pub fn count(&self, t: u8) -> u32 {
        self.cells.iter().filter(|&&c| sp(c) == t).count() as u32
    }

    /// A fingerprint of the whole state (cells, state bytes, random generator, temperature, critters).
    pub fn hash(&self) -> u32 {
        let mut h: u32 = 2_166_136_261;
        let mut mix = |v: u32| {
            h ^= v;
            h = h.wrapping_mul(16_777_619);
        };
        for (&c, &a) in self.cells.iter().zip(self.aux.iter()) {
            mix(c);
            mix(a as u32);
        }
        for &t in &self.temp {
            mix(t as u16 as u32);
        }
        mix(self.rng);
        mix(self.tick);
        mix(self.crng);
        for c in &self.critters {
            mix(c.x as u32);
            mix(c.y as u32);
            mix(c.state as u32 | (c.timer as u32) << 8);
        }
        h
    }

    /* ── Chunks ── */

    /// Keeps the chunk of this cell awake (something may still happen here).
    #[inline]
    pub(crate) fn keep(&mut self, i: usize) {
        let x = i % self.w;
        let y = i / self.w;
        self.active[(y / CHUNK) * self.cw + x / CHUNK] = AWAKE;
    }

    /// A cell changed: wakes its chunk, and the neighbouring chunks when it sits on a border.
    #[inline]
    pub(crate) fn wake(&mut self, i: usize) {
        let x = i % self.w;
        let y = i / self.w;
        let x0 = x.saturating_sub(1) / CHUNK;
        let x1 = (x + 1).min(self.w - 1) / CHUNK;
        let y0 = y.saturating_sub(1) / CHUNK;
        let y1 = (y + 1).min(self.h - 1) / CHUNK;
        self.active[y0 * self.cw + x0] = AWAKE;
        if x1 != x0 {
            self.active[y0 * self.cw + x1] = AWAKE;
        }
        if y1 != y0 {
            self.active[y1 * self.cw + x0] = AWAKE;
            if x1 != x0 {
                self.active[y1 * self.cw + x1] = AWAKE;
            }
        }
    }

    pub fn wake_all(&mut self) {
        self.active.fill(AWAKE);
    }

    /// How many chunks are awake (for the benchmark and the tests).
    pub fn awake_chunks(&self) -> u32 {
        self.active.iter().filter(|&&a| a > 0).count() as u32
    }

    /* ── Events ── */

    pub(crate) fn emit(&mut self, kind: u8, x: i32, y: i32) {
        if self.quiet {
            return;
        }
        let k = kind as usize;
        self.counts[k] = self.counts[k].saturating_add(1);
        if self.fired[k] {
            return;
        }
        self.fired[k] = true;
        if self.events.len() < self.events.capacity() {
            self.events.push(kind as u32 | ((x.clamp(0, 511) as u32) << 7) | ((y.clamp(0, 511) as u32) << 16));
        }
    }

    pub(crate) fn effect(&mut self, kind: u8, x: i32, y: i32, arg: u32) {
        if !self.quiet && self.fx.len() < self.fx.capacity() {
            self.fx.push((kind, x.clamp(0, 65535) as u16, y.clamp(0, 65535) as u16, arg));
        }
    }

    /// Forgets the reported events (the page calls it once it has read them).
    pub fn take_events(&mut self) {
        self.events.clear();
    }

    /* ── Moving cells ── */

    #[inline]
    pub(crate) fn swap(&mut self, i: usize, j: usize) {
        self.cells.swap(i, j);
        self.aux.swap(i, j);
        self.clock[i] = self.gen;
        self.clock[j] = self.gen;
        self.wake(i);
        self.wake(j);
    }

    /// Replaces a cell, keeping nothing of the old one.
    #[inline]
    pub(crate) fn put(&mut self, i: usize, c: u32) {
        if sp(self.cells[i]) == GRAVITY || sp(c) == GRAVITY {
            self.grav_dirty = true;
        }
        self.cells[i] = c;
        self.clock[i] = self.gen;
        self.wake(i);
    }

    #[inline]
    pub(crate) fn kill(&mut self, i: usize) {
        self.cells[i] = 0;
        self.aux[i] = 0;
        self.wake(i);
    }

    /// The direction things fall at this cell.
    #[inline]
    pub(crate) fn gravity_at(&self, i: usize) -> u8 {
        if self.params.radial {
            self.gdir[i]
        } else {
            DOWN
        }
    }

    /// Can a body of density `d` move into a cell holding `t`? 0 no, 1 freely, 2 slowly (sinking through a liquid).
    #[inline]
    pub(crate) fn pass(&self, d: u8, t: u8) -> u8 {
        if t == EMPTY {
            return if self.params.medium == SEA {
                if d > 50 {
                    2
                } else {
                    0
                }
            } else {
                1
            };
        }
        match self.phase[t as usize] {
            P_GAS => 1,
            P_LIQUID => {
                if d > ELEMENTS[t as usize].density {
                    2
                } else {
                    0
                }
            }
            _ => 0,
        }
    }

    /// Is this cell water for the reactions? (In the undersea world, empty cells are water.)
    #[inline]
    pub(crate) fn wet(&self, t: u8) -> bool {
        t == WATER || t == DYED || (t == EMPTY && self.params.medium == SEA)
    }

    /* ── The step ── */

    /// Advances the world by one tick.
    pub fn step(&mut self) {
        self.fired = [false; REACTION_COUNT];
        if self.fx.len() >= self.fx.capacity() {
            self.fx.clear();
        }
        self.tick = self.tick.wrapping_add(1);
        self.gen = if self.gen == 255 { 1 } else { self.gen + 1 };
        if self.gen == 1 {
            self.clock.fill(0);
        }
        if self.rainbow > 0 {
            self.rainbow -= 1;
        }
        if self.params.radial && self.grav_dirty && self.tick % 8 == 1 {
            self.rebuild_gravity();
        }
        // Which chunks run this tick; each one sleeps after two quiet ticks.
        let mut any = false;
        for k in 0..self.active.len() {
            let on = self.active[k] > 0;
            self.run[k] = on;
            if on {
                self.active[k] -= 1;
                any = true;
            }
        }
        self.stars_next.clear();
        if any {
            // Four scan orders in turn (left/right × up/down), so nothing leans to one side.
            let ltr = self.tick & 1 == 0;
            let up = self.tick & 2 == 0;
            let (w, h) = (self.w, self.h);
            for row in 0..h {
                let y = if up { h - 1 - row } else { row };
                let cy = y / CHUNK;
                for cc in 0..self.cw {
                    let cx = if ltr { cc } else { self.cw - 1 - cc };
                    if !self.run[cy * self.cw + cx] {
                        continue;
                    }
                    let x0 = cx * CHUNK;
                    let x1 = (x0 + CHUNK).min(w);
                    for k in 0..(x1 - x0) {
                        let x = if ltr { x0 + k } else { x1 - 1 - k };
                        let i = y * w + x;
                        let c = self.cells[i];
                        if c == 0 {
                            continue;
                        }
                        let s = sp(c);
                        if self.clock[i] == self.gen {
                            continue;
                        }
                        if c & FIXED != 0 && s != CLOUD {
                            continue;
                        }
                        let hot = self.thermal_on > 0 && self.thermal[s as usize];
                        if !self.visit[s as usize] && !hot {
                            continue;
                        }
                        self.update(x as i32, y as i32, i, s, hot);
                    }
                }
            }
        }
        std::mem::swap(&mut self.stars, &mut self.stars_next);
        if self.thermal_on > 0 {
            self.diffuse();
        }
        self.step_critters();
    }

    /// Runs the world for a while without reporting anything: a freshly built
    /// scene settles (sand slides, water finds its level) before the child plays.
    pub fn settle(&mut self, steps: u32) {
        let saved = self.counts;
        self.quiet = true;
        for _ in 0..steps {
            self.step();
        }
        self.quiet = false;
        self.counts = saved;
        self.events.clear();
        self.fx.clear();
        self.rainbow = 0;
        self.raindrops = 0;
    }

    fn update(&mut self, x: i32, y: i32, i: usize, s: u8, hot: bool) {
        if hot && self.phase_change(x, y, i, s) {
            return;
        }
        if self.reactive[s as usize] && self.react(x, y, i, s) {
            return;
        }
        match s {
            SAND => self.sand(x, y, i),
            WATER => self.water(x, y, i),
            SEED => {
                if !self.sprout(x, y, i) {
                    self.powder(x, y, i, s);
                }
            }
            PLANT => self.plant(x, y, i),
            HEAT => self.heat(x, y, i),
            STEAM => self.steam(x, y, i),
            SNOW => self.snow(x, y, i),
            CLOUD => self.cloud(x, y, i),
            BUBBLE => self.bubble(x, y, i),
            POLLEN => self.pollen(x, y, i),
            INK => self.ink(x, y, i),
            DYED => self.dyed(x, y, i),
            CRYSTAL => self.crystal(x, y, i),
            FOG => self.fog(x, y, i),
            PEBBLE => self.pebble(x, y, i),
            COCONUT => self.coconut(x, y, i),
            LAVA => self.lava(x, y, i),
            ASH => self.ash(x, y, i),
            GEYSER => self.geyser(x, y, i),
            CORAL => self.coral(x, y, i),
            KELP => self.kelp(x, y, i),
            PLANKTON => self.plankton(x, y, i),
            SHELL => {
                self.powder(x, y, i, s);
            }
            STARDUST => self.stardust(x, y, i),
            GAS => self.nebula(x, y, i),
            STAR => self.star(x, y, i),
            COMET => self.comet(x, y, i),
            METEORITE => self.meteorite(x, y, i),
            PIPE => self.pipe(x, y, i),
            RING => self.ring(x, y, i),
            _ => match ELEMENTS[s as usize].kind {
                K_POWDER => {
                    self.powder(x, y, i, s);
                }
                K_LIQUID => {
                    self.liquid(x, y, i, s);
                }
                K_GAS => self.gas(x, y, i, s),
                _ => {}
            },
        }
    }

    /// Too warm or too cold for this element: it changes state. Returns true when the cell changed.
    fn phase_change(&mut self, x: i32, y: i32, i: usize, s: u8) -> bool {
        let e = &ELEMENTS[s as usize];
        let t = self.temp[(y as usize / 2) * self.tw + x as usize / 2] >> 5;
        let (to, ev) = if e.hot_at != 0 && t >= e.hot_at as i16 {
            (e.hot_to, e.hot_ev)
        } else if e.cold_at != 0 && t <= e.cold_at as i16 {
            (e.cold_to, e.cold_ev)
        } else {
            return false;
        };
        self.keep(i);
        if !self.chance(10) {
            return false;
        }
        let mut ev = ev;
        if s == ICE && self.world == SPACE {
            ev = R_HABITABLE;
        }
        if s == SALTWATER {
            // Only the water leaves: the salt stays behind.
            if let Some(j) = self.nb(x, y, 0) {
                if self.cells[j] == 0 {
                    self.spawn(j, STEAM);
                }
            }
        }
        self.spawn(i, to);
        if ev != NONE {
            self.emit(ev, x, y);
        }
        true
    }

    /// Pair reactions from the table. Returns true when this cell changed.
    fn react(&mut self, x: i32, y: i32, i: usize, s: u8) -> bool {
        let start = self.rand() & 3;
        for k in 0..4u32 {
            let d = (((start + k) & 3) * 2) as u8;
            let Some(j) = self.nb(x, y, d) else { continue };
            let o = self.cells[j];
            let mut t = sp(o);
            if t == EMPTY {
                if self.params.medium != SEA {
                    continue;
                }
                t = WATER;
            }
            let r = self.lut[((s as usize) << 6) | t as usize];
            if r == 0 {
                continue;
            }
            self.keep(i);
            let rule = &RULES[r as usize - 1];
            if self.rand() % 1000 >= rule.chance as u32 {
                continue;
            }
            let hue = ca(if s == INK || s == DYED { self.cells[i] } else { o });
            if rule.out_b != NONE {
                self.spawn(j, rule.out_b);
                if rule.hue && sp(self.cells[j]) != EMPTY {
                    self.cells[j] = with_a(self.cells[j], hue);
                }
            }
            if rule.event != NONE {
                self.emit(rule.event, x, y);
            }
            if rule.out_a != NONE {
                self.spawn(i, rule.out_a);
                if rule.hue {
                    self.cells[i] = with_a(self.cells[i], hue);
                }
                return true;
            }
        }
        false
    }

    /* ── Generic movement ── */

    /// A powder: falls, slips down slopes, sinks through lighter liquids, floats on heavier ones.
    /// Returns true when it moved.
    pub(crate) fn powder(&mut self, x: i32, y: i32, i: usize, s: u8) -> bool {
        let e = &ELEMENTS[s as usize];
        if e.life > 0 {
            self.keep(i);
            if self.tick & 3 == 0 {
                let a = ca(self.cells[i]);
                if a >= e.life {
                    self.kill(i);
                    return true;
                }
                self.cells[i] = with_a(self.cells[i], a + 1);
            }
        }
        let d = self.gravity_at(i);
        if d == NOG {
            return self.drift(x, y, i);
        }
        let dens = e.density;
        let fall = self.aux[i];
        if !self.params.radial && fall > 200 {
            // A bounce on the Moon: up a few cells, then down again.
            self.keep(i);
            if let Some(j) = self.nb(x, y, 0) {
                if self.cells[j] == 0 {
                    self.aux[i] = if fall == 201 { 1 } else { fall - 1 };
                    self.swap(i, j);
                    return true;
                }
            }
            self.aux[i] = 0;
            return false;
        }
        let mut target = None;
        let mut slow = false;
        let mut diag = false;
        if let Some(j) = self.nb(x, y, d) {
            let p = self.pass(dens, sp(self.cells[j]));
            if p != 0 {
                target = Some(j);
                slow = p == 2;
            }
        }
        if target.is_none() {
            if dens < 50 {
                // Lighter than water: it bobs up to the surface.
                if let Some(j) = self.nb(x, y, d ^ 4) {
                    let t = sp(self.cells[j]);
                    let heavier = if t == EMPTY {
                        self.params.medium == SEA
                    } else {
                        self.phase[t as usize] == P_LIQUID && ELEMENTS[t as usize].density > dens
                    };
                    if heavier {
                        self.keep(i);
                        if self.chance(2) {
                            self.swap(i, j);
                            self.emit(R_FLOAT, x, y - 1);
                            return true;
                        }
                        return false;
                    }
                }
            }
            let landing = s == MOONDUST && fall > 0;
            if e.slide > 0 || landing {
                let first = if self.rand() & 1 == 0 { 1 } else { 7 };
                for k in [first, 8 - first] {
                    if let Some(j) = self.nb(x, y, (d + k) & 7) {
                        let p = self.pass(dens, sp(self.cells[j]));
                        if p != 0 {
                            target = Some(j);
                            slow = p == 2;
                            diag = true;
                            break;
                        }
                    }
                }
                if target.is_some() && !landing && e.slide < 255 && (self.rand() & 255) >= e.slide as u32 {
                    self.keep(i);
                    return false;
                }
            }
        }
        let Some(mut j) = target else {
            if !self.params.radial && fall > 0 {
                if self.world == MOON && (12..=200).contains(&fall) {
                    // Low gravity: a slow fall, then a high bounce.
                    self.aux[i] = 204;
                    self.keep(i);
                    self.emit(R_SLOW_FALL, x, y);
                    self.effect(FX_PUFF, x, y, 0xd0d4e0);
                } else {
                    self.aux[i] = 0;
                }
            }
            return false;
        };
        let rate = (e.rate as u32 * self.grav) >> 8;
        if rate < 250 && (self.rand() & 255) >= rate {
            self.keep(i);
            return false;
        }
        if slow && !self.chance(2) {
            self.keep(i);
            return false;
        }
        if e.flags & F_FLUTTER != 0 && !diag && self.params.medium == AIR && self.chance(3) {
            // Light flakes flutter sideways as they fall.
            let k = if self.rand() & 1 == 0 { 1 } else { 7 };
            if let Some(f) = self.nb(x, y, (d + k) & 7) {
                if self.cells[f] == 0 {
                    j = f;
                }
            }
        }
        let through = sp(self.cells[j]);
        if !self.params.radial {
            self.aux[i] = if fall < 100 { fall + 1 } else { fall };
        }
        self.swap(i, j);
        if s == SAND && slow && through != LAVA {
            self.emit(R_SINK, (j % self.w) as i32, (j / self.w) as i32);
        }
        true
    }

    /// In deep space, a pushed grain keeps drifting straight on until it bumps into something.
    pub(crate) fn drift(&mut self, x: i32, y: i32, i: usize) -> bool {
        let v = self.aux[i];
        if v == 0 || v > 8 {
            return false;
        }
        self.keep(i);
        if self.tick & 1 == 0 {
            return false;
        }
        match self.nb(x, y, v - 1) {
            Some(j) if self.cells[j] == 0 => {
                self.swap(i, j);
                true
            }
            _ => {
                self.aux[i] = 0;
                false
            }
        }
    }

    /// A liquid: falls, slips, then spreads sideways to find its level. Returns true when it moved.
    pub(crate) fn liquid(&mut self, x: i32, y: i32, i: usize, s: u8) -> bool {
        let e = &ELEMENTS[s as usize];
        let d = self.gravity_at(i);
        if d == NOG {
            return self.blob(x, y, i, s);
        }
        let sea = self.params.medium == SEA;
        let dens = e.density;
        let mut target = None;
        let mut sideways = 0u8;
        if let Some(j) = self.nb(x, y, d) {
            let t = sp(self.cells[j]);
            if t == EMPTY {
                if !sea || dens > 50 {
                    target = Some(j);
                }
            } else if t == STEAM || t == CLOUD || t == FOG || t == GAS {
                target = Some(j);
            } else if self.phase[t as usize] == P_LIQUID && ELEMENTS[t as usize].density < dens && self.rand() & 1 == 0 {
                target = Some(j);
            }
        }
        if target.is_none() {
            let first = if self.rand() & 1 == 0 { 1 } else { 7 };
            for k in [first, 8 - first] {
                if let Some(j) = self.nb(x, y, (d + k) & 7) {
                    let t = sp(self.cells[j]);
                    if (t == EMPTY && (!sea || dens > 50)) || t == STEAM || t == FOG {
                        target = Some(j);
                        break;
                    }
                }
            }
        }
        if target.is_none() {
            let first = if self.rand() & 1 == 0 { 2 } else { 6 };
            'sides: for k in [first, 8 - first] {
                let dir = (d + k) & 7;
                let (mut cx, mut cy) = (x, y);
                let mut far = None;
                for _ in 0..e.spread {
                    cx += DX[dir as usize];
                    cy += DY[dir as usize];
                    if !self.inside(cx, cy) {
                        break;
                    }
                    let j = cy as usize * self.w + cx as usize;
                    if self.cells[j] != 0 {
                        break;
                    }
                    far = Some(j);
                }
                if far.is_some() {
                    target = far;
                    sideways = dir;
                    break 'sides;
                }
            }
            if target.is_some() && sea && dens <= 50 {
                target = None;
            }
        }
        let Some(j) = target else { return false };
        let rate = (e.rate as u32 * self.grav.max(128)) >> 8;
        if rate < 250 && (self.rand() & 255) >= rate {
            self.keep(i);
            return false;
        }
        self.swap(i, j);
        if s == WATER && sideways != 0 && !self.params.radial && self.chance(10) {
            // A stream carries the sand of its bed along: that is how valleys are carved.
            let (jx, jy) = ((j % self.w) as i32, (j / self.w) as i32);
            if self.get(jx, jy + 1) == SAND {
                let nx = jx + DX[sideways as usize];
                let below = (jy + 1) as usize * self.w + jx as usize;
                if self.inside(nx, jy + 1) && self.cells[below] & FIXED == 0 {
                    let next = (jy + 1) as usize * self.w + nx as usize;
                    let t = sp(self.cells[next]);
                    if t == EMPTY || t == WATER {
                        self.swap(below, next);
                        self.emit(R_ERODE, jx, jy + 1);
                    }
                }
            }
        }
        true
    }

    /// With no gravity, a liquid pulls itself together into a wobbly ball.
    fn blob(&mut self, x: i32, y: i32, i: usize, s: u8) -> bool {
        if self.drift(x, y, i) {
            return true;
        }
        let mut near = 0;
        for d in 0..8u8 {
            if let Some(j) = self.nb(x, y, d) {
                if sp(self.cells[j]) == s {
                    near += 1;
                }
            }
        }
        if near >= 6 {
            if self.chance(48) {
                self.emit(R_WATER_BALL, x, y);
            }
            return false;
        }
        if near >= 4 && !self.chance(4) {
            return false;
        }
        // Look a little further for more of the same, and step towards it.
        let (mut sx, mut sy, mut n) = (0i32, 0i32, 0i32);
        for dy in -4..=4i32 {
            for dx in -4..=4i32 {
                if self.inside(x + dx, y + dy) && sp(self.cells[(y + dy) as usize * self.w + (x + dx) as usize]) == s {
                    sx += dx;
                    sy += dy;
                    n += 1;
                }
            }
        }
        if n <= 1 + near {
            return false;
        }
        self.keep(i);
        if self.chance(2) {
            return false;
        }
        let (tx, ty) = (x + sx.signum(), y + sy.signum());
        if (tx, ty) != (x, y) && self.inside(tx, ty) {
            let j = ty as usize * self.w + tx as usize;
            if self.cells[j] == 0 {
                self.swap(i, j);
                return true;
            }
        }
        false
    }

    /// A gas: drifts upwards and wobbles; a hovering gas (fog) just wanders. Some gases fade with time.
    pub(crate) fn gas(&mut self, x: i32, y: i32, i: usize, s: u8) {
        let e = &ELEMENTS[s as usize];
        self.keep(i);
        if e.life > 0 && self.tick & 3 == 0 {
            let a = ca(self.cells[i]);
            if a >= e.life {
                self.kill(i);
                return;
            }
            self.cells[i] = with_a(self.cells[i], a + 1);
        }
        if (self.rand() & 255) >= e.rate as u32 {
            return;
        }
        let d = if e.flags & F_HOVER != 0 {
            // Fog hangs low: it wanders, and sinks a little more often than it rises.
            let r = self.rand() % 10;
            if r < 8 {
                r as u8
            } else {
                DOWN
            }
        } else {
            let up = self.gravity_at(i) ^ 4;
            if up > 8 {
                (self.rand() & 7) as u8
            } else {
                match self.rand() % 4 {
                    0 => (up + 1) & 7,
                    1 => (up + 7) & 7,
                    _ => up,
                }
            }
        };
        if let Some(j) = self.nb(x, y, d) {
            if self.cells[j] == 0 {
                self.swap(i, j);
            }
        }
    }

    /* ── Temperature ── */

    /// Warms (or cools) the air around a cell, up to `cap` degrees.
    pub(crate) fn warm(&mut self, x: i32, y: i32, amount: i16, cap: u8) {
        let k = (y as usize / 2) * self.tw + x as usize / 2;
        let cap = (cap as i16) << 5;
        if self.temp[k] < cap {
            self.temp[k] = (self.temp[k] + (amount << 5)).min(cap);
        }
        self.thermal_on = 200;
    }

    /// The temperature at a cell, 0-255.
    #[inline]
    pub fn temp_at(&self, x: i32, y: i32) -> i16 {
        self.temp[(y as usize / 2) * self.tw + x as usize / 2] >> 5
    }

    /// Warmth spreads to the neighbours and slowly returns to the everyday temperature (half of the rows per tick).
    fn diffuse(&mut self) {
        let (tw, th) = (self.tw, self.th);
        let amb = self.ambient;
        let mut alive = false;
        let mut ty = (self.tick & 1) as usize;
        while ty < th {
            for tx in 0..tw {
                let k = ty * tw + tx;
                let t = self.temp[k] as i32;
                let l = if tx > 0 { self.temp[k - 1] as i32 } else { t };
                let r = if tx + 1 < tw { self.temp[k + 1] as i32 } else { t };
                let u = if ty > 0 { self.temp[k - tw] as i32 } else { t };
                let d = if ty + 1 < th { self.temp[k + tw] as i32 } else { t };
                let nt = t + ((l + r + u + d - 4 * t) >> 3) + ((amb as i32 - t) >> 5);
                self.temp[k] = nt as i16;
                if (nt - amb as i32).abs() > (10 << 5) {
                    alive = true;
                    let cx = (tx * 2) / CHUNK;
                    let cy = (ty * 2) / CHUNK;
                    self.active[cy * self.cw + cx] = AWAKE;
                }
            }
            ty += 2;
        }
        if !alive {
            self.thermal_on -= 1;
            if self.thermal_on == 0 {
                self.temp.fill(amb);
            }
        }
    }

    /// The temperature slider (big kids): shifts the everyday temperature of the world.
    pub fn set_temp_offset(&mut self, offset: i32) {
        let o = offset.clamp(-70, 70);
        self.temp_offset = o as i8;
        self.ambient = ((self.params.ambient as i32 + o).clamp(0, 255) as i16) << 5;
        self.thermal_on = 200;
        self.wake_all();
    }

    /// The gravity slider (big kids): percent of the world's own gravity.
    pub fn set_gravity(&mut self, pct: u32) {
        let p = pct.clamp(20, 200);
        self.gravity_pct = p as u8;
        self.grav = (self.params.gravity as u32 * p / 100).clamp(20, 255);
        self.wake_all();
    }

    pub fn set_night(&mut self, night: bool) {
        self.night = night;
        self.wake_all();
    }

    /* ── Radial gravity (space) ── */

    /// Finds the gravity balls and points every cell near one towards it.
    pub(crate) fn rebuild_gravity(&mut self) {
        self.grav_dirty = false;
        self.sources.clear();
        let mut sums: Vec<(i64, i64, i64)> = Vec::with_capacity(8);
        for y in 0..self.h {
            for x in 0..self.w {
                if sp(self.cells[y * self.w + x]) != GRAVITY {
                    continue;
                }
                let (fx, fy) = (x as i64, y as i64);
                let mut found = false;
                for s in sums.iter_mut() {
                    let (cx, cy) = (s.0 / s.2, s.1 / s.2);
                    if (cx - fx).abs() <= 14 && (cy - fy).abs() <= 14 {
                        s.0 += fx;
                        s.1 += fy;
                        s.2 += 1;
                        found = true;
                        break;
                    }
                }
                if !found && sums.len() < 8 {
                    sums.push((fx, fy, 1));
                }
            }
        }
        for s in &sums {
            self.sources.push(((s.0 / s.2) as i32, (s.1 / s.2) as i32, s.2 as i32));
        }
        for y in 0..self.h as i32 {
            for x in 0..self.w as i32 {
                let i = y as usize * self.w + x as usize;
                let mut best = i32::MAX;
                let mut dir = NOG;
                for &(sx, sy, mass) in &self.sources {
                    let (dx, dy) = (sx - x, sy - y);
                    let d2 = dx * dx + dy * dy;
                    let reach = 44 + mass.min(60) / 2;
                    if d2 < best && d2 <= reach * reach {
                        best = d2;
                        dir = octant(dx, dy);
                    }
                }
                self.gdir[i] = dir;
                self.gdist[i] = if dir == NOG { 255 } else { isqrt(best as u32).min(254) as u8 };
            }
        }
        self.wake_all();
    }
}

/// The compass direction (0-7, clockwise from north) closest to a vector.
pub fn octant(dx: i32, dy: i32) -> u8 {
    if dx == 0 && dy == 0 {
        return DOWN;
    }
    let (ax, ay) = (dx.abs(), dy.abs());
    // tan(22.5°) ≈ 0.414 ≈ 53/128
    let diagonal = ax * 128 > ay * 53 && ay * 128 > ax * 53;
    if diagonal {
        match (dx > 0, dy > 0) {
            (true, false) => 1,
            (true, true) => 3,
            (false, true) => 5,
            (false, false) => 7,
        }
    } else if ax > ay {
        if dx > 0 {
            2
        } else {
            6
        }
    } else if dy > 0 {
        4
    } else {
        0
    }
}

pub fn isqrt(n: u32) -> u32 {
    if n < 2 {
        return n;
    }
    let mut x = n;
    let mut y = x.div_ceil(2);
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}
