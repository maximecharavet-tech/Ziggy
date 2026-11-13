//! The software renderer: turns the grid into a picture, entirely on the CPU.
//!
//! The world is drawn at 2× or 3× the grid as a lit relief: every cell gets a
//! height (piles and rocks stand up, liquids lie low), the slopes of that
//! height field catch a light from the top left, tall things cast soft
//! shadows, liquids are see-through with a bright surface, and whatever
//! glows spills light around through a small blurred buffer. Behind it all, a
//! painted backdrop per world in two layers that slide a little (parallax).

use crate::backdrop;
use crate::gen::*;
use crate::sim::*;
use crate::table::*;

pub const MAX_SCALE: usize = 3;
const MAX_PARTICLES: usize = 512;
const MAX_FACES: usize = 5;

/// Render flags.
pub const REDUCED_MOTION: u32 = 1;

#[derive(Clone, Copy)]
pub struct Particle {
    pub kind: u8,
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub life: f32,
    pub span: f32,
    pub rgb: u32,
}

#[derive(Clone, Copy)]
struct Face {
    x: i32,
    y: i32,
    species: u8,
    age: u32,
    seed: u32,
}

pub struct Renderer {
    pub scale: usize,
    pub high: bool,
    pub fw: usize,
    pub fh: usize,
    pub frame: Vec<u32>,
    sky: Vec<u32>,
    near: Vec<u32>,
    near_span: Vec<(u16, u16)>,
    baked: (u8, usize, bool, usize, usize),
    height: Vec<u8>,
    corner: Vec<u16>,
    ldepth: Vec<u8>,
    glow: Vec<u16>,
    glow_tmp: Vec<u16>,
    pub particles: Vec<Particle>,
    faces: Vec<Face>,
    pal: Vec<[u8; 3]>,
    sin: [i8; 256],
    prng: u32,
    last_ms: f64,
    frames: u32,
    /// Where the finger is, in cells (faces look at it, the backdrop leans away from it).
    pub pointer: (f32, f32),
    cam: f32,
}

#[inline]
fn pack(r: u32, g: u32, b: u32) -> u32 {
    0xff00_0000 | (b << 16) | (g << 8) | r
}

#[inline]
fn rgb_of(hex: u32) -> [u8; 3] {
    [(hex >> 16) as u8, (hex >> 8) as u8, hex as u8]
}

#[inline]
fn mix(a: [u8; 3], b: [u8; 3], t: u32) -> [u8; 3] {
    // t: 0..=256
    [
        ((a[0] as u32 * (256 - t) + b[0] as u32 * t) >> 8) as u8,
        ((a[1] as u32 * (256 - t) + b[1] as u32 * t) >> 8) as u8,
        ((a[2] as u32 * (256 - t) + b[2] as u32 * t) >> 8) as u8,
    ]
}

/// Lights a colour: `l` > 0 brightens (towards white a little), `l` < 0 darkens.
#[inline]
fn light(c: [u8; 3], l: i32) -> u32 {
    let m = (256 + l * 2).max(40) as u32;
    let add = if l > 24 { (l - 24) as u32 } else { 0 };
    let r = ((c[0] as u32 * m) >> 8) + add;
    let g = ((c[1] as u32 * m) >> 8) + add;
    let b = ((c[2] as u32 * m) >> 8) + add;
    pack(r.min(255), g.min(255), b.min(255))
}

#[inline]
fn blend(dst: u32, src: u32, a: u32) -> u32 {
    // a: 0..=256
    let rb = (((dst & 0x00ff_00ff) * (256 - a) + (src & 0x00ff_00ff) * a) >> 8) & 0x00ff_00ff;
    let g = (((dst & 0x0000_ff00) * (256 - a) + (src & 0x0000_ff00) * a) >> 8) & 0x0000_ff00;
    0xff00_0000 | rb | g
}

#[inline]
fn add_rgb(dst: u32, r: u32, g: u32, b: u32) -> u32 {
    let nr = ((dst & 255) + r).min(255);
    let ng = (((dst >> 8) & 255) + g).min(255);
    let nb = (((dst >> 16) & 255) + b).min(255);
    pack(nr, ng, nb)
}

#[inline]
fn darken(dst: u32, k: u32) -> u32 {
    // k: 0..=256, the part of the light that stays
    let rb = (((dst & 0x00ff_00ff) * k) >> 8) & 0x00ff_00ff;
    let g = (((dst & 0x0000_ff00) * k) >> 8) & 0x0000_ff00;
    0xff00_0000 | rb | g
}

const FLOWER_HUES: [u32; 11] = [0xff7eb6, 0xffd447, 0xff8a5c, 0xb48cff, 0xffffff, 0x8b3ff0, 0x2f7fe0, 0x35c26a, 0xff8a24, 0xe0348a, 0x8a5a34];
const INK_HUES: [u32; 5] = [0x8b3ff0, 0x2f6fe8, 0x25b868, 0xff8a24, 0xe0348a];
const CORAL_HUES: [u32; 5] = [0xff7f9a, 0xffa25c, 0xc98cff, 0xff5c8a, 0xffd86b];
const GAS_HUES: [u32; 3] = [0xff7ad0, 0x7aa8ff, 0xb48cff];

/// How tall each drawing style stands in the relief.
const STYLE_HEIGHT: [u8; 22] = [0, 170, 64, 235, 36, 96, 56, 128, 150, 205, 225, 150, 225, 84, 104, 165, 225, 210, 185, 172, 205, 235];

impl Renderer {
    pub fn new(w: usize, h: usize) -> Renderer {
        let mut sin = [0i8; 256];
        for (k, s) in sin.iter_mut().enumerate() {
            *s = ((k as f32 / 256.0 * std::f32::consts::TAU).sin() * 127.0) as i8;
        }
        let mut pal = vec![[0u8; 3]; 64 * 16];
        for (s, e) in ELEMENTS.iter().enumerate() {
            for k in 0..16 {
                pal[s * 16 + k] = mix(rgb_of(e.rgb), rgb_of(e.rgb2), (k as u32 * 256) / 15);
            }
        }
        let n = w * h * MAX_SCALE * MAX_SCALE;
        let (gw, gh) = (w.div_ceil(2) + 1, h.div_ceil(2) + 1);
        Renderer {
            scale: 2,
            high: false,
            fw: w * 2,
            fh: h * 2,
            frame: vec![0xff00_0000; n],
            sky: vec![0xff00_0000; n],
            near: vec![0; n],
            near_span: vec![(0, 0); h * MAX_SCALE],
            baked: (255, 0, false, 0, 0),
            height: vec![0; w * h],
            corner: vec![0; (w + 1) * (h + 1)],
            ldepth: vec![0; w],
            glow: vec![0; gw * gh * 3],
            glow_tmp: vec![0; gw * gh * 3],
            particles: Vec::with_capacity(MAX_PARTICLES),
            faces: Vec::with_capacity(MAX_FACES),
            pal,
            sin,
            prng: 0x1234_5679,
            last_ms: 0.0,
            frames: 0,
            pointer: (-1.0, -1.0),
            cam: 0.0,
        }
    }

    /// 1 (rescue), 2 (low tier) or 3 (high tier) frame pixels per cell; `high` adds refraction, caustics and a wider glow.
    pub fn set_quality(&mut self, scale: usize, high: bool) {
        self.scale = scale.clamp(1, MAX_SCALE);
        self.high = high;
    }

    fn rnd(&mut self) -> u32 {
        let mut x = self.prng;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.prng = x;
        x
    }

    fn frand(&mut self) -> f32 {
        (self.rnd() & 0xffff) as f32 / 65536.0
    }

    /// A burst of sparkles at a cell (a discovery, a tap).
    pub fn burst(&mut self, x: f32, y: f32, rgb: u32, n: u32) {
        for k in 0..n {
            if self.particles.len() >= MAX_PARTICLES {
                break;
            }
            let a = k as f32 / n.max(1) as f32 * std::f32::consts::TAU + self.frand() * 0.5;
            let v = 0.25 + self.frand() * 0.7;
            let col = match k % 3 {
                0 => 0xffffff,
                1 => 0xfff3a3,
                _ => rgb,
            };
            let life = 0.7 + self.frand() * 0.6;
            self.particles.push(Particle { kind: FX_SPARK, x, y, vx: a.cos() * v, vy: a.sin() * v - 0.2, life, span: life, rgb: col });
        }
    }

    fn spawn_fx(&mut self, kind: u8, x: f32, y: f32, arg: u32) {
        match kind {
            FX_SPARK => self.burst(x, y, arg, 7),
            FX_STAR => self.burst(x, y, arg, 14),
            FX_PUFF | FX_SPLASH | FX_SWIRL => {
                for k in 0..6 {
                    if self.particles.len() >= MAX_PARTICLES {
                        break;
                    }
                    let a = self.frand() * std::f32::consts::PI;
                    let v = 0.15 + self.frand() * 0.4;
                    let (vx, vy) = if kind == FX_SWIRL { ((k as f32 - 2.5) * 0.12, -0.5 - self.frand() * 0.4) } else { (a.cos() * v, -a.sin() * v * if kind == FX_SPLASH { 1.6 } else { 0.6 }) };
                    let life = 0.5 + self.frand() * 0.5;
                    self.particles.push(Particle { kind, x, y, vx, vy, life, span: life, rgb: arg });
                }
            }
            FX_TRAIL => {
                if self.particles.len() < MAX_PARTICLES {
                    let d = ((arg.max(1) - 1) & 7) as usize;
                    let (jx, jy) = (self.frand() - 0.5, self.frand() - 0.5);
                    self.particles.push(Particle { kind, x, y, vx: DX[d] as f32 * 0.35 + jx * 0.15, vy: DY[d] as f32 * 0.35 + jy * 0.15, life: 0.9, span: 0.9, rgb: 0xbfe9ff });
                }
            }
            _ => {
                if self.particles.len() < MAX_PARTICLES {
                    let life = if kind == FX_SHIELD { 1.0 } else { 1.8 };
                    self.particles.push(Particle { kind, x, y, vx: 0.0, vy: if kind == FX_SHIELD { 0.0 } else { -0.12 }, life, span: life, rgb: arg });
                }
            }
        }
    }

    /// Draws the world into `frame` (RGBA bytes, `fw` × `fh`).
    pub fn render(&mut self, world: &mut World, t_ms: f64, flags: u32) {
        let calm = flags & REDUCED_MOTION != 0;
        let (w, h, s) = (world.w, world.h, self.scale);
        self.fw = w * s;
        self.fh = h * s;
        let (fw, fh) = (self.fw, self.fh);
        let key = (world.world, s, world.night, w, h);
        if self.baked != key {
            self.baked = key;
            backdrop::bake(world.world, world.night, fw, fh, &mut self.sky, &mut self.near, &mut self.near_span);
        }
        let dt = if self.last_ms == 0.0 { 0.016 } else { ((t_ms - self.last_ms) / 1000.0).clamp(0.0, 0.1) as f32 };
        self.last_ms = t_ms;
        self.frames = self.frames.wrapping_add(1);
        // Under reduced motion, time stands still for everything that shimmers or sways.
        let time = if calm { 0u32 } else { (t_ms / 16.0) as u32 };

        self.height_field(world, time);

        // Backdrop: the far layer as it is, the near layer sliding a little against the finger.
        let n = fw * fh;
        self.frame[..n].copy_from_slice(&self.sky[..n]);
        let target = if calm || self.pointer.0 < 0.0 { 0.0 } else { (0.5 - self.pointer.0 / w as f32) * 5.0 * s as f32 };
        self.cam += (target - self.cam) * (dt * 3.0).min(1.0);
        let sway = if calm { 0 } else { (self.sin[((time / 6) & 255) as usize] as i32 * s as i32) / 90 };
        let ox = self.cam.round() as i32 + sway;
        for py in 0..fh {
            let (x0, x1) = self.near_span[py];
            if x1 <= x0 {
                continue;
            }
            let row = py * fw;
            let a0 = (x0 as i32 + ox).clamp(0, fw as i32) as usize;
            let a1 = (x1 as i32 + ox).clamp(0, fw as i32) as usize;
            for px in a0..a1 {
                let src = self.near[row + (px as i32 - ox) as usize];
                let a = src >> 24;
                if a != 0 {
                    self.frame[row + px] = blend(self.frame[row + px], src, a + (a >> 7));
                }
            }
        }
        if world.rainbow > 0 {
            self.rainbow(world);
        }

        self.cells(world, time, calm);
        self.glow_pass(w, h);
        if self.frames % 16 == 1 {
            self.find_faces(world);
        }
        self.draw_faces(world, time, calm);
        self.draw_critters(world, time, calm);

        // Effects asked for by the simulation, then the particles.
        let fx: Vec<(u8, u16, u16, u32)> = world.fx.drain(..).collect();
        if !calm {
            for (kind, x, y, arg) in fx {
                self.spawn_fx(kind, x as f32, y as f32, arg);
            }
            self.draw_particles(dt, world.params.medium);
        } else {
            self.particles.clear();
        }
    }

    /// Heights: each style has its own, rising gently from the open air (rounded piles), and corner sums for the slopes.
    fn height_field(&mut self, world: &World, time: u32) {
        let (w, h) = (world.w, world.h);
        const STEP: u16 = 62;
        // Forward pass: from the left and from above.
        for y in 0..h {
            let row = y * w;
            for x in 0..w {
                let c = world.cells[row + x];
                if c == 0 {
                    self.height[row + x] = 0;
                    continue;
                }
                let e = &ELEMENTS[sp(c) as usize];
                let mut base = STYLE_HEIGHT[e.style as usize] as u16;
                if e.style == S_LIQUID || e.style == S_LAVA {
                    base = (base as i32 + (self.sin[((x as u32 * 23 + time * 3) & 255) as usize] as i32 >> 4)) as u16;
                } else if e.style == S_GRAIN || e.style == S_PEBBLE || e.style == S_ROCK {
                    base += (shade(c) & 15) as u16;
                }
                let l = if x > 0 { self.height[row + x - 1] as u16 } else { base };
                let u = if y > 0 { self.height[row - w + x] as u16 } else { base };
                self.height[row + x] = base.min(l.min(u) + STEP).min(255) as u8;
            }
        }
        // Backward pass: from the right and from below.
        for y in (0..h).rev() {
            let row = y * w;
            for x in (0..w).rev() {
                let v = self.height[row + x] as u16;
                if v == 0 {
                    continue;
                }
                let r = if x + 1 < w { self.height[row + x + 1] as u16 } else { v };
                let d = if y + 1 < h { self.height[row + w + x] as u16 } else { v };
                self.height[row + x] = v.min(r.min(d) + STEP) as u8;
            }
        }
        let cw = w + 1;
        for y in 0..=h {
            for x in 0..=w {
                let mut sum = 0u16;
                if y > 0 {
                    if x > 0 {
                        sum += self.height[(y - 1) * w + x - 1] as u16;
                    }
                    if x < w {
                        sum += self.height[(y - 1) * w + x] as u16;
                    }
                }
                if y < h {
                    if x > 0 {
                        sum += self.height[y * w + x - 1] as u16;
                    }
                    if x < w {
                        sum += self.height[y * w + x] as u16;
                    }
                }
                self.corner[y * cw + x] = sum;
            }
        }
    }

    /// The colour of a cell before lighting, and how much it glows (0-255).
    #[inline]
    fn colour(&self, world: &World, c: u32, i: usize, time: u32) -> ([u8; 3], u32) {
        let s = sp(c);
        let sh = shade(c);
        let base = self.pal[s as usize * 16 + (sh & 15) as usize];
        match s {
            PLANT => {
                let variant = sh >> 5;
                let leaf = cb(c) & LEAF != 0;
                let col = match variant {
                    V_CACTUS => mix([0x3f, 0xa8, 0x6a], [0x2c, 0x86, 0x58], (sh as u32 & 15) * 16),
                    V_REED => mix([0x9a, 0xb8, 0x4a], [0x74, 0x96, 0x3a], (sh as u32 & 15) * 16),
                    V_PALM if !leaf => mix([0x9a, 0x6a, 0x3c], [0x7a, 0x50, 0x2c], (sh as u32 & 15) * 16),
                    V_GIANT => mix([0x3c, 0xc8, 0x70], [0x1f, 0x9a, 0x58], (sh as u32 & 15) * 16),
                    _ => base,
                };
                (if leaf { mix(col, [0x9a, 0xe8, 0x6a], 90) } else { col }, 0)
            }
            FLOWER => {
                let hue = FLOWER_HUES[(ca(c) as usize).min(10)];
                if cb(c) == CENTER && ca(c) != 10 {
                    ([0xff, 0xd9, 0x3d], 0)
                } else {
                    (mix(rgb_of(hue), [255, 255, 255], (sh as u32 & 7) * 8), 0)
                }
            }
            INK | DYED => {
                let hue = rgb_of(INK_HUES[(ca(c) % 5) as usize]);
                (if s == DYED { mix(hue, [0x5a, 0xb0, 0xf5], 80) } else { hue }, 0)
            }
            CLOUD => {
                let rain = ca(c).min(30) as u32;
                let col = mix(base, [0x8f, 0x9c, 0xc0], rain * 5);
                (if cb(c) & 2 != 0 { mix(col, [0x70, 0x70, 0x80], 140) } else { col }, 0)
            }
            LAVA => {
                let heat = ca(c) as u32;
                let flick = (self.sin[((i as u32 * 37 + time * 5) & 255) as usize] as i32 + 127) as u32 / 4;
                let hot = mix([0xff, 0x7a, 0x1a], [0xff, 0xe0, 0x58], (flick + (sh as u32 & 15) * 6).min(256));
                (mix([0x6a, 0x24, 0x28], hot, heat.min(255)), 60 + heat * 3 / 4)
            }
            HEAT => {
                let pulse = (self.sin[((time * 4 + i as u32 * 11) & 255) as usize] as i32 + 127) as u32 / 5;
                (mix(base, [255, 250, 220], pulse), 230)
            }
            STAR => ([255, 250, 215], 255),
            CRYSTAL => {
                let lit = ca(c) as u32;
                let hue = rgb_of(FLOWER_HUES[((i + (time / 8) as usize) % 4) + 5]);
                (mix(base, hue, lit / 2), 30 + lit * 2 / 3)
            }
            CORAL => (mix(rgb_of(CORAL_HUES[(cb(c) % 5) as usize]), [255, 255, 255], (sh as u32 & 15) * 5), if ca(c) > 0 { 30 } else { 0 }),
            PLANKTON => {
                let lit = ca(c) as u32;
                (mix(base, [0xc8, 0xff, 0xff], lit), 30 + lit * 7 / 8)
            }
            GAS => (rgb_of(GAS_HUES[(ca(c) % 3) as usize]), 50),
            BASALT => {
                if cb(c) == 1 && (sh as u32 * 7 + time / 6) % 23 == 0 {
                    ([0xd8, 0xd0, 0xff], 40)
                } else {
                    (base, 0)
                }
            }
            STARDUST | RING | PEARL | COMET | POLLEN | FROST => {
                let tw = (self.sin[((sh as u32 * 13 + time * 3) & 255) as usize] as i32 + 127) as u32;
                (mix(base, [255, 255, 255], tw / 3), if s == COMET { 200 } else { 30 + tw / 5 })
            }
            GEYSER => (base, 25),
            GRAVITY => {
                let pulse = (self.sin[((time * 3) & 255) as usize] as i32 + 127) as u32;
                (mix(base, [0xd8, 0xc8, 0xff], pulse / 3), 120 + pulse / 3)
            }
            PIPE => {
                let load = ca(c);
                if load != 0 {
                    (mix(base, self.pal[load as usize * 16 + 4], 150), 0)
                } else {
                    (base, 0)
                }
            }
            ICE => (if cb(c) == 1 { mix(base, [255, 255, 255], 90) } else { base }, 0),
            _ => {
                let _ = world;
                (base, 0)
            }
        }
    }

    fn cells(&mut self, world: &World, time: u32, calm: bool) {
        let (w, h, s) = (world.w, world.h, self.scale);
        let fw = self.fw;
        let cw = w + 1;
        let d = (2 * s) as i32;
        let sea = world.params.medium == SEA;
        let night = if world.night { -34 } else { 0 };
        let (gw, gh) = (w.div_ceil(2) + 1, h.div_ceil(2) + 1);
        self.glow[..gw * gh * 3].fill(0);
        self.ldepth[..w].fill(0);
        let gen = world.gen;
        for y in 0..h {
            let row = y * w;
            for x in 0..w {
                let i = row + x;
                let c = world.cells[i];
                let hh = self.height[i] as i32;
                // Soft shadow: is something up-left taller than me?
                let mut shadow = 0i32;
                if x >= 3 && y >= 3 {
                    let a = self.height[i - w - 1] as i32 - 46;
                    let b = self.height[i - 2 * w - 2] as i32 - 92;
                    let e = self.height[i - 3 * w - 3] as i32 - 138;
                    shadow = (a.max(b).max(e) - hh).clamp(0, 120);
                }
                if c == 0 {
                    self.ldepth[x] = 0;
                    if shadow > 0 {
                        let k = (256 - shadow * 2 / 3) as u32;
                        for sy in 0..s {
                            let base = (y * s + sy) * fw + x * s;
                            for px in &mut self.frame[base..base + s] {
                                *px = darken(*px, k);
                            }
                        }
                    }
                    // Round the inner corners of liquids and soft things.
                    if x > 0 && y > 0 && x + 1 < w && y + 1 < h {
                        let (u, dn, l, r) = (world.cells[i - w], world.cells[i + w], world.cells[i - 1], world.cells[i + 1]);
                        if (u | dn) != 0 && (l | r) != 0 {
                            self.fill_corners(world, i, x, y, u, dn, l, r, time);
                        }
                    }
                    continue;
                }
                let sp_ = sp(c);
                let e = &ELEMENTS[sp_ as usize];
                let style = e.style;
                let (rgb, mut glow) = self.colour(world, c, i, time);
                let liquid = style == S_LIQUID;
                let see_through = liquid || style == S_GAS || style == S_GLASS || style == S_BUBBLE || style == S_ICE || style == S_CLOUD;
                let up = if y > 0 { world.cells[i - w] } else { 1 };
                let open_up = up == 0;
                // Depth of liquid above this cell (for the tint), and of anything (for the buried look).
                let depth = if liquid {
                    let dp = self.ldepth[x].saturating_add(1);
                    self.ldepth[x] = dp;
                    dp as i32
                } else {
                    let dp = self.ldepth[x];
                    self.ldepth[x] = 0;
                    dp as i32
                };
                let mut l0 = night - shadow / 2;
                if world.clock[i] == gen && !calm {
                    l0 += 10; // cells on the move catch the light
                }
                if !liquid && depth > 0 {
                    // Under water: tinted by the depth, with dancing light on the floor.
                    l0 -= depth.min(16) * 2;
                    if self.high && !calm {
                        l0 += self.sin[((x as u32 * 29 + y as u32 * 13 + time * 2) & 255) as usize] as i32 >> 4;
                    }
                }
                if glow > 0 {
                    if !calm && (style == S_LAMP || style == S_STAR) {
                        glow = glow * (220 + (self.sin[((time * 5) & 255) as usize] as i32 >> 2) as u32) / 256;
                    }
                    let g = rgb_of(if e.glow != 0 { e.glow } else { e.rgb });
                    let gi = ((y / 2) * gw + x / 2) * 3;
                    let src = if style == S_LAVA || sp_ == CRYSTAL || sp_ == CORAL || sp_ == GAS { rgb } else { g };
                    self.glow[gi] += (src[0] as u32 * glow / 256) as u16;
                    self.glow[gi + 1] += (src[1] as u32 * glow / 256) as u16;
                    self.glow[gi + 2] += (src[2] as u32 * glow / 256) as u16;
                    l0 = l0.max(-10);
                }
                let k = y * cw + x;
                let (c00, c10, c01, c11) = (self.corner[k] as i32, self.corner[k + 1] as i32, self.corner[k + cw] as i32, self.corner[k + cw + 1] as i32);
                let (gxt, gxb, gyl, gyr) = (c10 - c00, c11 - c01, c01 - c00, c11 - c10);
                let flat = (gxt | gxb | gyl | gyr) == 0;
                // Plants sway by a sub-pixel or two.
                let mut off = 0i32;
                if !calm && (style == S_PLANT || style == S_FLOWER || style == S_CORAL) {
                    let hgt = world.aux[i].min(40) as i32;
                    let amp = if sp_ == KELP || sea { 3 } else { 2 };
                    off = (self.sin[((time * 2 + y as u32 * 5) & 255) as usize] as i32 * hgt * amp * s as i32) / (127 * 40 * 2);
                }
                let px0 = ((x * s) as i32 + off).clamp(0, (fw - s) as i32) as usize;
                let round = style != S_GRAIN && style != S_ROCK && style != S_WET && style != S_PIPE && style != S_GLASS;
                let (open_l, open_r, open_d) = (x == 0 || world.cells[i - 1] == 0, x + 1 >= w || world.cells[i + 1] == 0, y + 1 < h && world.cells[i + w] == 0);
                let lonely = open_up && open_l && open_r && open_d;
                let alpha = if see_through {
                    let a = e.alpha as u32;
                    if liquid {
                        (a + depth.min(20) as u32 * 4).min(236)
                    } else {
                        a
                    }
                } else {
                    256
                };
                let grainy = style == S_GRAIN || style == S_SNOW || style == S_PEBBLE || style == S_WET;
                let sh = shade(c) as usize;
                for sy in 0..s {
                    let frow = (y * s + sy) * fw;
                    let wv = (2 * sy + 1) as i32;
                    for sx in 0..s {
                        if round && !lonely && s > 1 {
                            let top = sy == 0;
                            let bottom = sy == s - 1;
                            let left = sx == 0;
                            let right = sx == s - 1;
                            if (top && left && open_up && open_l) || (top && right && open_up && open_r) || (bottom && left && open_d && open_l) || (bottom && right && open_d && open_r) {
                                continue;
                            }
                        }
                        let mut l = l0;
                        if !flat {
                            let wu = (2 * sx + 1) as i32;
                            let gx = (gxt * (d - wv) + gxb * wv) / d;
                            let gy = (gyl * (d - wu) + gyr * wu) / d;
                            l += ((gx * 5 + gy * 7) >> 5).clamp(-64, 64);
                        }
                        if grainy && (sh >> 4) & 3 == sy * 2 + sx {
                            l += 9; // one brighter speck per grain
                        }
                        let idx = frow + px0 + sx;
                        let mut px = light(rgb, l);
                        if alpha < 256 {
                            let mut a = alpha;
                            let mut dst = self.frame[idx];
                            if liquid {
                                if self.high && !calm {
                                    // Refraction: what lies behind the water wobbles.
                                    let o = self.sin[(((y * s + sy) as u32 * 9 + time * 3) & 255) as usize] as i32 >> 6;
                                    let sxp = (idx as i32 + o).clamp(frow as i32, (frow + fw - 1) as i32) as usize;
                                    dst = self.sky[sxp];
                                }
                                if open_up && sy == 0 {
                                    // The bright line of the surface, with glints that travel.
                                    let glint = !calm && ((x * s + sx) as u32 * 3 + time / 2) % 37 < 3;
                                    px = if glint { 0xffff_ffff } else { add_rgb(px, 70, 70, 60) };
                                    a = 215;
                                } else if open_d && !open_up && !sea {
                                    px = add_rgb(px, 40, 40, 40); // falling water foams
                                }
                            } else if style == S_GLASS {
                                let edge = (open_up && sy == 0) || (open_l && sx == 0) || (open_r && sx == s - 1) || (open_d && sy == s - 1);
                                let streak = (x * s + sx + y * s + sy) % (7 * s) < s;
                                a = if edge { 200 } else if streak { 120 } else { a };
                            } else if style == S_BUBBLE {
                                a = if sx == 0 && sy == 0 { 235 } else { a };
                            }
                            px = blend(dst, px, a);
                        }
                        self.frame[idx] = px;
                    }
                }
            }
        }
    }

    /// An empty cell squeezed in the corner of a liquid, a cloud or a petal: fill that corner so blobs look round.
    #[allow(clippy::too_many_arguments)]
    fn fill_corners(&mut self, world: &World, i: usize, x: usize, y: usize, u: u32, dn: u32, l: u32, r: u32, time: u32) {
        let s = self.scale;
        if s < 2 {
            return;
        }
        let soft = |c: u32| {
            let st = ELEMENTS[sp(c) as usize].style;
            c != 0 && (st == S_LIQUID || st == S_LAVA || st == S_CLOUD || st == S_GAS || st == S_FLOWER || st == S_SNOW)
        };
        let fw = self.fw;
        let w = world.w;
        for (a, b, sx, sy, ai) in [(u, l, 0, 0, i - w), (u, r, s - 1, 0, i - w), (dn, l, 0, s - 1, i + w), (dn, r, s - 1, s - 1, i + w)] {
            if soft(a) && soft(b) && sp(a) == sp(b) {
                let (rgb, _) = self.colour(world, a, ai, time);
                let idx = (y * s + sy) * fw + x * s + sx;
                let alpha = (ELEMENTS[sp(a) as usize].alpha as u32).min(256);
                self.frame[idx] = blend(self.frame[idx], light(rgb, if world.night { -34 } else { 0 }), alpha);
            }
        }
    }

    /// Whatever glows spills light around: blur the small glow buffer and add it over the picture.
    fn glow_pass(&mut self, w: usize, h: usize) {
        let (gw, gh) = (w.div_ceil(2) + 1, h.div_ceil(2) + 1);
        let n = gw * gh * 3;
        if self.glow[..n].iter().all(|&v| v == 0) {
            return;
        }
        let passes = if self.high { 2 } else { 1 };
        for _ in 0..passes {
            // Horizontal then vertical 1-2-1 blur.
            for y in 0..gh {
                for x in 0..gw {
                    let k = (y * gw + x) * 3;
                    let l = if x > 0 { k - 3 } else { k };
                    let r = if x + 1 < gw { k + 3 } else { k };
                    for ch in 0..3 {
                        self.glow_tmp[k + ch] = (self.glow[l + ch] + 2 * self.glow[k + ch] + self.glow[r + ch]) / 4;
                    }
                }
            }
            for y in 0..gh {
                for x in 0..gw {
                    let k = (y * gw + x) * 3;
                    let u = if y > 0 { k - gw * 3 } else { k };
                    let d = if y + 1 < gh { k + gw * 3 } else { k };
                    for ch in 0..3 {
                        self.glow[k + ch] = (self.glow_tmp[u + ch] + 2 * self.glow_tmp[k + ch] + self.glow_tmp[d + ch]) / 4;
                    }
                }
            }
        }
        // Each glow cell covers 2×2 cells; interpolate between glow cells for a smooth halo.
        let s = self.scale;
        let nb = 2 * s;
        let (fw, fh) = (self.fw, self.fh);
        let gain = if self.high { 150 } else { 135 };
        for gy in 0..gh - 1 {
            for gx in 0..gw - 1 {
                let k = (gy * gw + gx) * 3;
                let (k10, k01, k11) = (k + 3, k + gw * 3, k + gw * 3 + 3);
                let any = self.glow[k] | self.glow[k + 1] | self.glow[k + 2] | self.glow[k10] | self.glow[k10 + 1] | self.glow[k10 + 2] | self.glow[k01] | self.glow[k01 + 1] | self.glow[k01 + 2] | self.glow[k11] | self.glow[k11 + 1] | self.glow[k11 + 2];
                if any < 6 {
                    continue;
                }
                // Glow cell centres sit one cell (s pixels) in.
                let (bx, by) = (gx * nb + s, gy * nb + s);
                for py in 0..nb {
                    let fy = by + py;
                    if fy >= fh {
                        break;
                    }
                    let (wy1, wy0) = (py as u32, (nb - py) as u32);
                    let mut left = [0u32; 3];
                    let mut right = [0u32; 3];
                    for ch in 0..3 {
                        left[ch] = self.glow[k + ch] as u32 * wy0 + self.glow[k01 + ch] as u32 * wy1;
                        right[ch] = self.glow[k10 + ch] as u32 * wy0 + self.glow[k11 + ch] as u32 * wy1;
                    }
                    let row = fy * fw;
                    for px in 0..nb {
                        let fx = bx + px;
                        if fx >= fw {
                            break;
                        }
                        let (wx1, wx0) = (px as u32, (nb - px) as u32);
                        let div = (nb * nb) as u32 * 256;
                        let r = (left[0] * wx0 + right[0] * wx1) * gain / div;
                        let g = (left[1] * wx0 + right[1] * wx1) * gain / div;
                        let b = (left[2] * wx0 + right[2] * wx1) * gain / div;
                        if r | g | b != 0 {
                            self.frame[row + fx] = add_rgb(self.frame[row + fx], r, g, b);
                        }
                    }
                }
            }
        }
    }

    fn rainbow(&mut self, world: &World) {
        let (fw, fh, s) = (self.fw as i32, self.fh as i32, self.scale as i32);
        let fade = (world.rainbow.min(200) as u32).min((1500 - world.rainbow.min(1500)) as u32 * 2 + 30).min(200);
        let (cx, cy) = (fw / 2, fh * 62 / 100);
        let r_out = (fw.min(fh * 2) * 42 / 100).max(20);
        let band = (2 * s).max(2);
        const COLS: [u32; 6] = [0xff5a5a, 0xffa040, 0xffe45a, 0x5ad27a, 0x5aa8ff, 0xa87aff];
        let r_in = r_out - band * 6;
        for py in (cy - r_out).max(0)..cy.min(fh) {
            let dy = py - cy;
            for px in (cx - r_out).max(0)..(cx + r_out).min(fw) {
                let dx = px - cx;
                let d2 = dx * dx + dy * dy;
                if d2 >= r_out * r_out || d2 < r_in * r_in {
                    continue;
                }
                let dist = isqrt(d2 as u32) as i32;
                let k = ((r_out - dist) / band).clamp(0, 5) as usize;
                let c = COLS[k];
                let idx = (py * fw + px) as usize;
                let low = ((cy - py) * 4 / s).clamp(0, 64) as u32;
                self.frame[idx] = blend(self.frame[idx], pack(c >> 16, (c >> 8) & 255, c & 255), fade * low / 110);
            }
        }
    }

    /* ── Faces on big blobs ── */

    fn face_species(world: &World, t: u8) -> bool {
        matches!(t, LAVA | CLOUD | WATER | SNOW | ICE) || (t == STONE && world.params.radial)
    }

    fn solid_block(world: &World, x: i32, y: i32, t: u8) -> bool {
        for (dx, dy) in [(0, 0), (-4, -2), (4, -2), (-4, 2), (4, 2), (-3, 0), (3, 0), (0, -3), (0, 2)] {
            if world.get(x + dx, y + dy) != t || !world.inside(x + dx, y + dy) {
                return false;
            }
        }
        true
    }

    fn find_faces(&mut self, world: &World) {
        self.faces.retain(|f| Self::solid_block(world, f.x, f.y, f.species));
        if self.faces.len() >= MAX_FACES {
            return;
        }
        for _ in 0..24 {
            let x = 6 + (self.rnd() % (world.w as u32 - 12)) as i32;
            let y = 5 + (self.rnd() % (world.h as u32 - 10)) as i32;
            let t = world.get(x, y);
            if !Self::face_species(world, t) || !Self::solid_block(world, x, y, t) {
                continue;
            }
            // Prefer the top of the blob: climb while the block stays whole.
            let mut fy = y;
            while fy > 5 && Self::solid_block(world, x, fy - 1, t) {
                fy -= 1;
            }
            if self.faces.iter().any(|f| (f.x - x).abs() < 34 && (f.y - fy).abs() < 26) {
                continue;
            }
            let seed = self.rnd();
            self.faces.push(Face { x, y: fy + 1, species: t, age: 0, seed });
            if self.faces.len() >= MAX_FACES {
                break;
            }
        }
    }

    fn draw_faces(&mut self, world: &World, time: u32, calm: bool) {
        let s = self.scale as f32;
        for k in 0..self.faces.len() {
            self.faces[k].age += 1;
            let f = self.faces[k];
            // Always happy; surprised for a moment when it has just appeared.
            let surprised = f.age < 70;
            let blink = !calm && (time + f.seed % 400) % 230 < 7;
            let bob = if calm { 0.0 } else { self.sin[((time * 2 + f.seed) & 255) as usize] as f32 / 127.0 * 0.4 };
            let (cx, cy) = ((f.x as f32 + 0.5) * s, (f.y as f32 + 0.5 + bob) * s);
            let dark = if f.species == LAVA { 0x5a1a10 } else { 0x2a2848 };
            self.face(cx, cy, s * 1.15, dark, surprised, blink, world.night);
        }
    }

    /// Two eyes and a smile (or a round "oh!"), `u` pixels per unit.
    #[allow(clippy::too_many_arguments)]
    fn face(&mut self, cx: f32, cy: f32, u: f32, dark: u32, surprised: bool, blink: bool, _night: bool) {
        let look = if self.pointer.0 >= 0.0 {
            let (dx, dy) = (self.pointer.0 * self.scale as f32 - cx, self.pointer.1 * self.scale as f32 - cy);
            let d = (dx * dx + dy * dy).sqrt().max(1.0);
            (dx / d * 0.45 * u, dy / d * 0.45 * u)
        } else {
            (0.0, 0.0)
        };
        for side in [-1.0f32, 1.0] {
            let ex = cx + side * 2.3 * u;
            if blink {
                self.fill_rect(ex - 1.1 * u, cy - 0.15 * u, ex + 1.1 * u, cy + 0.25 * u, dark, 255);
            } else {
                self.disc(ex, cy, 1.25 * u, 0xffffff, 255);
                self.disc(ex + look.0, cy + look.1, 0.68 * u, dark, 255);
                self.disc(ex + look.0 - 0.25 * u, cy + look.1 - 0.25 * u, 0.24 * u, 0xffffff, 255);
            }
        }
        if surprised {
            self.disc(cx, cy + 2.3 * u, 0.75 * u, dark, 255);
        } else {
            // A smile: the lower half of a ring.
            let (r_out, r_in) = (1.5 * u, 0.95 * u);
            let my = cy + 1.5 * u;
            let (x0, x1, y0, y1) = ((cx - r_out) as i32, (cx + r_out) as i32 + 1, my as i32, (my + r_out) as i32 + 1);
            for py in y0..y1 {
                for px in x0..x1 {
                    let (dx, dy) = (px as f32 + 0.5 - cx, py as f32 + 0.5 - my);
                    let d2 = dx * dx + dy * dy;
                    if dy >= 0.0 && d2 <= r_out * r_out && d2 >= r_in * r_in {
                        self.plot(px, py, dark, 255);
                    }
                }
            }
        }
    }

    /* ── Small drawing tools (frame pixels) ── */

    #[inline]
    fn plot(&mut self, x: i32, y: i32, rgb: u32, a: u32) {
        if x < 0 || y < 0 || x >= self.fw as i32 || y >= self.fh as i32 {
            return;
        }
        let idx = y as usize * self.fw + x as usize;
        let src = pack(rgb >> 16, (rgb >> 8) & 255, rgb & 255);
        self.frame[idx] = if a >= 255 { src } else { blend(self.frame[idx], src, a) };
    }

    fn disc(&mut self, cx: f32, cy: f32, r: f32, rgb: u32, a: u32) {
        self.ellipse(cx, cy, r, r, rgb, a);
    }

    fn ellipse(&mut self, cx: f32, cy: f32, rx: f32, ry: f32, rgb: u32, a: u32) {
        if rx <= 0.0 || ry <= 0.0 {
            return;
        }
        let (x0, x1, y0, y1) = ((cx - rx).floor() as i32, (cx + rx).ceil() as i32, (cy - ry).floor() as i32, (cy + ry).ceil() as i32);
        for py in y0..=y1 {
            for px in x0..=x1 {
                let (dx, dy) = ((px as f32 + 0.5 - cx) / rx, (py as f32 + 0.5 - cy) / ry);
                let d2 = dx * dx + dy * dy;
                if d2 <= 1.0 {
                    // One soft pixel on the rim.
                    let edge = ((1.0 - d2) * rx.min(ry) * 1.2).min(1.0);
                    self.plot(px, py, rgb, (a as f32 * edge) as u32);
                }
            }
        }
    }

    fn fill_rect(&mut self, x0: f32, y0: f32, x1: f32, y1: f32, rgb: u32, a: u32) {
        for py in y0.round() as i32..y1.round() as i32 {
            for px in x0.round() as i32..x1.round() as i32 {
                self.plot(px, py, rgb, a);
            }
        }
    }

    fn glow_disc(&mut self, cx: f32, cy: f32, r: f32, rgb: u32, strength: f32) {
        let (x0, x1, y0, y1) = ((cx - r) as i32, (cx + r) as i32 + 1, (cy - r) as i32, (cy + r) as i32 + 1);
        let (cr, cg, cb_) = ((rgb >> 16) as f32, ((rgb >> 8) & 255) as f32, (rgb & 255) as f32);
        for py in y0.max(0)..y1.min(self.fh as i32) {
            for px in x0.max(0)..x1.min(self.fw as i32) {
                let (dx, dy) = (px as f32 + 0.5 - cx, py as f32 + 0.5 - cy);
                let d = 1.0 - (dx * dx + dy * dy) / (r * r);
                if d > 0.0 {
                    let k = d * d * strength;
                    let idx = py as usize * self.fw + px as usize;
                    self.frame[idx] = add_rgb(self.frame[idx], (cr * k) as u32, (cg * k) as u32, (cb_ * k) as u32);
                }
            }
        }
    }

    /// A tiny 5×5 picture (hearts, notes, "?", "z"), each lit bit drawn as a square of `u` pixels.
    fn glyph(&mut self, cx: f32, cy: f32, rows: [u8; 5], u: f32, rgb: u32, a: u32) {
        for (ry, bits) in rows.iter().enumerate() {
            for rx in 0..5 {
                if bits & (0x10 >> rx) != 0 {
                    let (x0, y0) = (cx + (rx as f32 - 2.5) * u, cy + (ry as f32 - 2.5) * u);
                    self.fill_rect(x0, y0, x0 + u, y0 + u, rgb, a);
                }
            }
        }
    }

    fn draw_particles(&mut self, dt: f32, medium: u8) {
        let s = self.scale as f32;
        let gravity = match medium {
            SEA => -0.3,
            VACUUM => 0.25,
            _ => 1.4,
        };
        let mut k = 0;
        while k < self.particles.len() {
            let mut p = self.particles[k];
            p.life -= dt;
            if p.life <= 0.0 {
                self.particles.swap_remove(k);
                continue;
            }
            let step = dt * 60.0;
            p.x += p.vx * step;
            p.y += p.vy * step;
            let f = p.life / p.span;
            let (px, py) = ((p.x + 0.5) * s, (p.y + 0.5) * s);
            let a = (f * 1.6).min(1.0);
            match p.kind {
                FX_SPARK | FX_STAR => {
                    p.vy += gravity * 0.012 * step;
                    // A four-pointed star that shrinks as it fades, with a touch of glow.
                    let r = (0.5 + f) * s * 0.9;
                    self.glow_disc(px, py, r * 2.2, p.rgb, 0.35 * a);
                    self.fill_rect(px - r, py - s * 0.22, px + r, py + s * 0.22, p.rgb, (a * 255.0) as u32);
                    self.fill_rect(px - s * 0.22, py - r, px + s * 0.22, py + r, p.rgb, (a * 255.0) as u32);
                }
                FX_PUFF | FX_SWIRL => {
                    p.vx *= 0.97;
                    if p.kind == FX_SWIRL {
                        p.vx += (p.life * 9.0).sin() * 0.05;
                    }
                    self.disc(px, py, (1.2 + (1.0 - f) * 1.8) * s, p.rgb, (a * 110.0) as u32);
                }
                FX_SPLASH => {
                    p.vy += 0.03 * step;
                    // Droplets stretch along their flight.
                    let speed = (p.vx * p.vx + p.vy * p.vy).sqrt().min(1.0);
                    self.ellipse(px, py, s * (0.45 + 0.1 * speed), s * (0.45 + 0.5 * speed), p.rgb, (a * 220.0) as u32);
                }
                FX_TRAIL => self.glow_disc(px, py, (0.6 + f * 1.6) * s, p.rgb, 0.5 * a),
                FX_HEART => self.glyph(px, py, [0b01010, 0b11111, 0b11111, 0b01110, 0b00100], s * (0.5 + 0.2 * (1.0 - f)), 0xff5a8a, (a * 255.0) as u32),
                FX_NOTE => self.glyph(px + (p.life * 6.0).sin() * s, py, [0b00110, 0b00101, 0b00100, 0b01100, 0b01100], s * 0.55, 0x3a2a70, (a * 255.0) as u32),
                FX_ZZZ => self.glyph(px + (1.0 - f) * 3.0 * s, py, [0b11110, 0b00010, 0b00100, 0b01000, 0b11110], s * (0.35 + 0.35 * (1.0 - f)), 0xffffff, (a * 230.0) as u32),
                FX_BIP => {
                    // A little speech bubble: "?" (or a happy "!" when the rover found a pebble).
                    let pop = (1.0 - f) * 6.0;
                    let grow = pop.min(1.0) * (1.0 + 0.25 * (pop * 3.0).sin() * (-pop).exp());
                    self.disc(px, py, 2.6 * s * grow, 0xffffff, (a * 240.0) as u32);
                    let rows = if p.rgb == 1 { [0b00100, 0b00100, 0b00100, 0b00000, 0b00100] } else { [0b01110, 0b00010, 0b00100, 0b00000, 0b00100] };
                    self.glyph(px, py, rows, s * 0.6 * grow, 0x3a2a70, (a * 255.0) as u32);
                }
                FX_SHIELD => {
                    let r = (3.5 + (1.0 - f) * 2.5) * s;
                    let (x0, x1, y0, y1) = ((px - r) as i32, (px + r) as i32 + 1, (py - r) as i32, (py + r) as i32 + 1);
                    for qy in y0..y1 {
                        for qx in x0..x1 {
                            let (dx, dy) = (qx as f32 + 0.5 - px, qy as f32 + 0.5 - py);
                            let d = (dx * dx + dy * dy).sqrt();
                            if d <= r && d >= r - s * 0.6 {
                                self.plot(qx, qy, 0xbff2ff, (a * 200.0) as u32);
                            }
                        }
                    }
                }
                _ => {}
            }
            self.particles[k] = p;
            k += 1;
        }
    }

    /* ── Critters ── */

    fn draw_critters(&mut self, world: &World, time: u32, calm: bool) {
        let s = self.scale as f32;
        for c in world.critters.iter() {
            let (fx, fy) = (c.x as f32 / 16.0 * s, (c.y as f32 / 16.0 + 1.0) * s);
            // Squash and stretch: a soft landing bounce, a stretch in the air, a breathing idle.
            let b = c.bounce as f32;
            let land = if calm { 0.0 } else { (-(b / 5.0)).exp() * (b / 2.2).cos() * 0.28 };
            let breathe = if calm { 0.0 } else { self.sin[((time * 3 + c.x as u32) & 255) as usize] as f32 / 127.0 * 0.04 };
            let air = if !calm && c.state == crate::critters::C_AIR { (c.vy.abs() as f32 / 14.0).min(1.0) * 0.18 } else { 0.0 };
            let sy = 1.0 - land + breathe + air;
            let sx = 1.0 + land - breathe - air * 0.7;
            let step = if !calm && c.state == crate::critters::C_WALK { self.sin[((c.x * 14) & 255) as usize] as f32 / 127.0 } else { 0.0 };
            let blink = !calm && (time + c.x as u32 / 16 * 7) % 190 < 6;
            let d = c.dir as f32;
            let u = s; // one cell
            let happy = c.mood > 0;
            let ink = 0x2a2848;
            let mut eyes: [(f32, f32, f32); 2] = [(0.0, 0.0, 0.0); 2];
            match c.kind {
                GARDEN => {
                    // Snail: a spiral shell on a soft body, eyes on stalks.
                    self.ellipse(fx, fy - 1.1 * u * sy, 4.2 * u * sx, 1.2 * u * sy, 0xf2c79a, 255);
                    self.disc(fx - d * 0.9 * u, fy - 3.4 * u * sy, 2.7 * u, 0xe07a4a, 255);
                    self.disc(fx - d * 0.9 * u, fy - 3.4 * u * sy, 1.7 * u, 0xf4a26a, 255);
                    self.disc(fx - d * 0.7 * u, fy - 3.3 * u * sy, 0.8 * u, 0xe07a4a, 255);
                    for k in [0.0f32, 1.0] {
                        let ex = fx + d * (2.6 + k * 1.3) * u * sx;
                        let ey = fy - (3.6 + step * 0.2) * u * sy;
                        self.fill_rect(ex - 0.2 * u, ey, ex + 0.2 * u, fy - 1.6 * u * sy, 0xf2c79a, 255);
                        eyes[k as usize] = (ex, ey, 0.75);
                    }
                }
                MOUNTAIN => {
                    // Marmot: a round brown ball with tiny ears and two big teeth.
                    let cy = fy - 3.0 * u * sy;
                    self.disc(fx - 1.6 * u, cy - 2.5 * u * sy, 0.9 * u, 0x8a5a34, 255);
                    self.disc(fx + 1.6 * u, cy - 2.5 * u * sy, 0.9 * u, 0x8a5a34, 255);
                    self.ellipse(fx, cy, 3.2 * u * sx, 3.0 * u * sy, 0xa9713f, 255);
                    self.ellipse(fx + d * 0.6 * u, cy + 0.9 * u, 1.9 * u, 1.6 * u * sy, 0xe8c9a0, 255);
                    self.fill_rect(fx + d * 0.6 * u - 0.55 * u, cy + 0.9 * u, fx + d * 0.6 * u + 0.55 * u, cy + 1.9 * u, 0xffffff, 255);
                    self.disc(fx + d * 0.6 * u, cy + 0.3 * u, 0.42 * u, ink, 255);
                    eyes = [(fx + d * 0.6 * u - 1.2 * u, cy - 0.8 * u, 0.7), (fx + d * 0.6 * u + 1.2 * u, cy - 0.8 * u, 0.7)];
                }
                ISLANDS => {
                    // Crab: a wide red shell, two claws that wave, and whatever fell on it as a hat.
                    let cy = fy - 1.8 * u * sy;
                    let wave = if happy { step.abs() + 0.6 } else { step * 0.4 };
                    for side in [-1.0f32, 1.0] {
                        self.disc(fx + side * 4.0 * u * sx, cy - (1.4 + wave * side.max(0.0) + wave * (-side).max(0.0) * 0.6) * u, 1.25 * u, 0xff6a4a, 255);
                        self.fill_rect(fx + side * 2.2 * u - 0.3 * u, fy - 0.9 * u, fx + side * 2.2 * u + 0.3 * u, fy, 0xe04a34, 255);
                    }
                    self.ellipse(fx, cy, 3.4 * u * sx, 1.9 * u * sy, 0xff6a4a, 255);
                    self.ellipse(fx, cy + 0.5 * u, 2.6 * u * sx, 1.0 * u * sy, 0xff8a6a, 255);
                    if c.hat != 0 {
                        let hat = ELEMENTS[c.hat as usize].rgb;
                        self.ellipse(fx, cy - 2.6 * u * sy, 2.6 * u, 0.5 * u, hat, 255);
                        self.ellipse(fx, cy - 3.4 * u * sy, 1.5 * u, 1.1 * u, hat, 255);
                    }
                    eyes = [(fx - 1.1 * u, cy - 1.9 * u * sy, 0.7), (fx + 1.1 * u, cy - 1.9 * u * sy, 0.7)];
                }
                VOLCANO => {
                    // Bloup: a glowing drop of warm jam.
                    let cy = fy - 2.6 * u * sy;
                    self.glow_disc(fx, cy, 7.0 * u, 0xff7a20, 0.35);
                    self.ellipse(fx, cy, 3.1 * u * sx, 2.7 * u * sy, 0xff8a24, 255);
                    self.disc(fx, cy - 2.6 * u * sy, 1.1 * u, 0xff8a24, 255);
                    self.ellipse(fx - 0.9 * u, cy - 1.0 * u, 1.2 * u, 0.8 * u, 0xffd84a, 200);
                    eyes = [(fx - 1.2 * u + d * 0.3 * u, cy - 0.2 * u, 0.75), (fx + 1.2 * u + d * 0.3 * u, cy - 0.2 * u, 0.75)];
                }
                UNDERSEA => {
                    // Pufferfish: round, spiky when puffed up, with a wiggling tail.
                    let puff = if happy { 1.45 } else { 1.0 };
                    let cy = fy - 3.0 * u;
                    let r = 2.6 * u * puff;
                    if happy {
                        for k in 0..10 {
                            let a = k as f32 / 10.0 * std::f32::consts::TAU;
                            self.disc(fx + a.cos() * (r + 0.5 * u), cy + a.sin() * (r + 0.5 * u), 0.5 * u, 0xe8a030, 255);
                        }
                    }
                    self.ellipse(fx - d * (r + 0.6 * u), cy + step * 0.5 * u, 1.0 * u, 1.3 * u, 0xf2b040, 255);
                    self.ellipse(fx, cy, r * sx, r * sy, 0xffd24a, 255);
                    self.ellipse(fx, cy + 0.9 * u * puff, r * 0.7, r * 0.45, 0xfff3c4, 255);
                    self.disc(fx + d * 1.2 * u, cy + 1.2 * u * puff, 0.45 * u, 0xff7a8a, 255);
                    eyes = [(fx + d * 0.9 * u - 0.95 * u, cy - 0.5 * u, 0.7), (fx + d * 0.9 * u + 0.95 * u, cy - 0.5 * u, 0.7)];
                }
                SPACE => {
                    // A tiny alien in a saucer.
                    let cy = fy - 2.6 * u + step * 0.2 * u;
                    self.glow_disc(fx, cy + 1.6 * u, 4.5 * u, 0x7affc8, 0.3);
                    self.ellipse(fx, cy - 1.0 * u, 2.2 * u, 2.2 * u * sy, 0xbff2ff, 150);
                    self.ellipse(fx, cy - 0.8 * u, 1.5 * u, 1.5 * u, 0x6ad86a, 255);
                    self.ellipse(fx, cy + 0.9 * u, 4.6 * u * sx, 1.3 * u, 0xb9bcd6, 255);
                    self.ellipse(fx, cy + 0.6 * u, 4.0 * u * sx, 0.6 * u, 0xe4e6f6, 255);
                    for k in [-1.0f32, 0.0, 1.0] {
                        let lit = (time / 12 + (k as i32 + 1) as u32) % 3 == 0;
                        self.disc(fx + k * 2.4 * u, cy + 1.4 * u, 0.45 * u, if lit { 0xffe45a } else { 0xff7a8a }, 255);
                    }
                    eyes = [(fx - 0.65 * u, cy - 1.0 * u, 0.5), (fx + 0.65 * u, cy - 1.0 * u, 0.5)];
                }
                MOON => {
                    // Moon bunny: all ears.
                    let cy = fy - 2.4 * u * sy;
                    let flop = if c.state == crate::critters::C_AIR { -0.5 } else { 0.0 };
                    for side in [-1.0f32, 1.0] {
                        self.ellipse(fx + side * (0.9 + flop * side * 0.4) * u, cy - 3.6 * u * sy, 0.7 * u, 2.3 * u * sy, 0xffffff, 255);
                        self.ellipse(fx + side * (0.9 + flop * side * 0.4) * u, cy - 3.6 * u * sy, 0.3 * u, 1.6 * u * sy, 0xffc0d0, 255);
                    }
                    self.ellipse(fx, cy, 2.7 * u * sx, 2.4 * u * sy, 0xffffff, 255);
                    self.disc(fx - d * 2.5 * u, cy + 1.0 * u, 0.9 * u, 0xf0f0ff, 255);
                    self.disc(fx + d * 0.5 * u, cy + 0.6 * u, 0.35 * u, 0xff8aa8, 255);
                    eyes = [(fx + d * 0.5 * u - 1.0 * u, cy - 0.5 * u, 0.6), (fx + d * 0.5 * u + 1.0 * u, cy - 0.5 * u, 0.6)];
                }
                _ => {
                    // Rover: a box on three wheels with googly eyes on a mast.
                    let cy = fy - 2.2 * u;
                    for k in [-1.0f32, 0.0, 1.0] {
                        self.disc(fx + k * 2.4 * u, fy - 0.9 * u, 1.0 * u, 0x3a3848, 255);
                        self.disc(fx + k * 2.4 * u, fy - 0.9 * u, 0.4 * u, 0xb9bcd6, 255);
                    }
                    self.fill_rect(fx - 3.2 * u * sx, cy - 1.0 * u * sy, fx + 3.2 * u * sx, cy + 0.9 * u, 0xe9edf5, 255);
                    self.fill_rect(fx - 3.2 * u * sx, cy + 0.3 * u, fx + 3.2 * u * sx, cy + 0.9 * u, 0xffb340, 255);
                    for p in 0..c.count.min(3) {
                        self.disc(fx - d * (2.0 - p as f32 * 1.3) * u, cy - 1.5 * u, 0.6 * u, 0x8a827a, 255);
                    }
                    let mx = fx + d * 1.8 * u;
                    self.fill_rect(mx - 0.25 * u, cy - 3.4 * u * sy, mx + 0.25 * u, cy - 1.0 * u, 0x9a9cb0, 255);
                    self.fill_rect(mx - 1.7 * u, cy - 4.6 * u * sy, mx + 1.7 * u, cy - 3.2 * u * sy, 0xe9edf5, 255);
                    eyes = [(mx - 0.8 * u, cy - 3.9 * u * sy, 0.62), (mx + 0.8 * u, cy - 3.9 * u * sy, 0.62)];
                }
            }
            for (ex, ey, r) in eyes {
                if blink {
                    self.fill_rect(ex - r * u, ey - 0.12 * u, ex + r * u, ey + 0.2 * u, ink, 255);
                } else {
                    self.disc(ex, ey, r * u, 0xffffff, 255);
                    self.disc(ex + d * 0.22 * u, ey + 0.05 * u, r * 0.55 * u, ink, 255);
                    self.disc(ex + d * 0.22 * u - 0.15 * u, ey - 0.15 * u, r * 0.2 * u, 0xffffff, 255);
                }
            }
            if c.shield > 0 && !calm {
                let a = (c.shield as u32 * 3).min(150);
                self.ellipse(fx, fy - 3.0 * u, 5.4 * u, 5.0 * u, 0xbff2ff, a / 3);
            }
        }
    }
}
