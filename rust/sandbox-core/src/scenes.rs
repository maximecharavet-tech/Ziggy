//! A ready-made scene for each world, to start from something pretty. Scenes
//! adapt to the grid (landscape on a computer, portrait on a phone) and are
//! built to be calm: nothing reacts until the child adds something, so every
//! discovery is really theirs. Integer maths only (same scene natively and in wasm).

use crate::critters::Critter;
use crate::gen::*;
use crate::sim::*;
use crate::table::*;

/// Sine of an angle in 1/1024 of a turn, times 1024 (parabola approximation: smooth enough for hills).
pub fn isin(a: i32) -> i32 {
    let a = a.rem_euclid(1024);
    let (x, sign) = if a < 512 { (a, 1) } else { (a - 512, -1) };
    // 4x(512 - x) / 512² peaks at 1 for x = 256.
    sign * (4 * x * (512 - x)) / 256
}

/// The fronds of a grown palm, around the top of its trunk.
const PALM_CROWN: [(i32, i32); 32] = [
    (-1, 0),
    (1, 0),
    (-2, 0),
    (2, 0),
    (-3, 0),
    (3, 0),
    (-4, 1),
    (4, 1),
    (-5, 1),
    (5, 1),
    (-6, 2),
    (6, 2),
    (-7, 3),
    (7, 3),
    (-1, -1),
    (1, -1),
    (0, -1),
    (-2, -1),
    (2, -1),
    (-3, -1),
    (3, -1),
    (-1, -2),
    (1, -2),
    (0, -2),
    (-2, 1),
    (2, 1),
    (-3, 1),
    (3, 1),
    (-4, 2),
    (4, 2),
    (-5, 3),
    (5, 3),
];

impl World {
    fn fill(&mut self, x: i32, y: i32, t: u8) {
        self.set(x, y, t);
    }

    fn rect(&mut self, x0: i32, y0: i32, x1: i32, y1: i32, t: u8) {
        for y in y0..=y1 {
            for x in x0..=x1 {
                self.set(x, y, t);
            }
        }
    }

    fn disc(&mut self, cx: i32, cy: i32, r: i32, t: u8) {
        for y in -r..=r {
            for x in -r..=r {
                if x * x + y * y <= r * r + r {
                    self.set(cx + x, cy + y, t);
                }
            }
        }
    }

    /// Top of the ground in column x (first non-empty cell), or h.
    fn surface(&self, x: i32) -> i32 {
        for y in 0..self.h as i32 {
            if self.get(x, y) != EMPTY {
                return y;
            }
        }
        self.h as i32
    }

    fn fix(&mut self, x: i32, y: i32, a: u8, b: u8) {
        self.set_state(x, y, a, b, true);
    }

    /// A grown plant with leaves and a flower on top. Part of the scenery: it does not grow any more.
    pub fn grown_plant(&mut self, x: i32, ground: i32, height: i32, hue: u8, variant: u8) {
        let mut top = ground;
        for k in 0..height {
            let y = ground - 1 - k;
            if !self.inside(x, y) || self.get(x, y) != EMPTY {
                break;
            }
            self.set(x, y, PLANT);
            self.fix(x, y, 0, 0);
            let i = y as usize * self.w + x as usize;
            self.aux[i] = k as u8;
            self.cells[i] = (self.cells[i] & 0x1fff_ffff) | ((variant as u32) << 29);
            top = y;
            if (variant == V_PLAIN || variant == V_GIANT) && k > 1 && k < height - 2 && k % 2 == 1 {
                let lx = x + if k % 4 == 1 { 1 } else { -1 };
                if self.get(lx, y) == EMPTY && self.inside(lx, y) {
                    self.set(lx, y, PLANT);
                    self.fix(lx, y, 0, LEAF);
                    self.aux[y as usize * self.w + lx as usize] = k as u8;
                }
            }
        }
        if top == ground {
            return;
        }
        let h = (ground - top) as u8;
        if variant == V_PALM {
            for (dx, dy) in PALM_CROWN {
                if self.get(x + dx, top + dy) == EMPTY && self.inside(x + dx, top + dy) {
                    self.set(x + dx, top + dy, PLANT);
                    self.fix(x + dx, top + dy, 0, LEAF);
                    let i = (top + dy) as usize * self.w + (x + dx) as usize;
                    self.aux[i] = h;
                    self.cells[i] = (self.cells[i] & 0x1fff_ffff) | ((V_PALM as u32) << 29);
                }
            }
            return;
        }
        self.set(x, top, FLOWER);
        self.fix(x, top, hue % 5, CENTER);
        self.aux[top as usize * self.w + x as usize] = h;
        for (dx, dy) in [(-1, 0), (1, 0), (0, -1)] {
            let (px, py) = (x + dx, top + dy);
            if !self.inside(px, py) || self.get(px, py) != EMPTY {
                continue;
            }
            self.set(px, py, FLOWER);
            self.fix(px, py, hue % 5, PETAL);
            self.aux[py as usize * self.w + px as usize] = h;
        }
    }

    /// Fluffy clouds at (per-mille of width, per-mille of height, half-width in cells).
    /// Empty of rain and part of the scene: they only rain once fed with steam.
    fn scene_clouds(&mut self, clouds: &[(i32, i32, i32)]) {
        let (w, h) = (self.w as i32, self.h as i32);
        for &(cx, cy, rx0) in clouds {
            let rx = rx0.min(w * 12 / 100).max(6);
            let ry = 4 + rx / 5;
            for y in -ry..=ry {
                for x in -rx..=rx {
                    // A flat bottom and a bumpy top.
                    let bump = if y < 0 { isin(x * 768 / rx) * 36 / 100 } else { 0 };
                    if (x * x * 1024) / (rx * rx) + (y * y * 1024) / (ry * ry) > 1024 + bump {
                        continue;
                    }
                    let (gx, gy) = (w * cx / 1000 + x, h * cy / 1000 + y);
                    if self.inside(gx, gy) {
                        self.set(gx, gy, CLOUD);
                        self.fix(gx, gy, 0, 0);
                    }
                }
            }
        }
    }

    fn resident(&mut self, x: i32) {
        self.critters.clear();
        let x = x.clamp(4, self.w as i32 - 5);
        let y = if self.params.medium == SEA || self.params.radial { self.h as i32 / 3 } else { self.surface(x) - 1 };
        self.critters.push(Critter::new(self.world, x, y.max(4)));
    }

    /// Builds the starting scene of this world and lets it settle.
    pub fn load_scene(&mut self) {
        self.clear();
        match self.world {
            GARDEN => self.garden(),
            MOUNTAIN => self.mountain(),
            ISLANDS => self.islands(),
            VOLCANO => self.volcano(),
            UNDERSEA => self.undersea(),
            SPACE => self.space(),
            MOON => self.moon(),
            _ => self.mars(),
        }
        if self.params.radial {
            self.rebuild_gravity();
        }
        self.settle(150);
        self.wake_all();
    }

    fn garden(&mut self) {
        let (w, h) = (self.w as i32, self.h as i32);
        let tall = h > w;
        let base = h * if tall { 62 } else { 78 } / 100;
        let ground = |x: i32| base + isin(x * 7) * h / 28 / 1024 + isin(x * 21 + 200) * 2 / 1024;
        // Earth, with a sand pit on the left and bedrock underneath.
        let pit0 = w * 4 / 100;
        let pit1 = w * if tall { 30 } else { 20 } / 100;
        for x in 0..w {
            let g = ground(x);
            let pit = x >= pit0 && x <= pit1;
            for y in g..h {
                let sandy = pit && y < g + 5 + isin((x - pit0) * 512 / (pit1 - pit0).max(1)) * 5 / 1024;
                self.fill(
                    x,
                    y,
                    if y > h - 3 {
                        STONE
                    } else if sandy {
                        SAND
                    } else {
                        SOIL
                    },
                );
            }
        }
        // A little pond in a stone basin.
        let pw = (w * 22 / 100).max(18);
        let px = w * 58 / 100;
        let pd = (h * 9 / 100).max(7);
        let mut level = h;
        for k in -1..=pw {
            level = level.min(ground(px + k));
        }
        level += 1;
        for k in -2..pw + 2 {
            let x = px + k;
            let edge = k.min(pw - 1 - k);
            let bottom = level + pd.min(2 + edge).max(0);
            for y in 0..level {
                if self.get(x, y) != EMPTY {
                    self.fill(x, y, EMPTY);
                }
            }
            for y in level..=(bottom + 2).min(h - 1) {
                self.fill(x, y, if k < 0 || k >= pw || y >= bottom { STONE } else { WATER });
            }
        }
        // Flowers here and there (away from the water, so nothing reacts by itself).
        for (n, f) in [30, 38, 46, 88, 95].iter().enumerate() {
            let x = w * f / 100;
            if x >= px - 4 && x <= px + pw + 4 {
                continue;
            }
            let g = self.surface(x);
            self.grown_plant(x, g, h * (12 + (n as i32 * 37) % 9) / 100, n as u8, V_PLAIN);
        }
        self.scene_clouds(&[(200, 130, 18), (720, 90, 22)]);
        // A stone wall to build on.
        let wx = w * 26 / 100 + if tall { 8 } else { 0 };
        let g = ground(wx);
        self.rect(wx, g - h / 10, wx + 2, g, STONE);
        self.resident(w * 46 / 100);
    }

    fn mountain(&mut self) {
        let (w, h) = (self.w as i32, self.h as i32);
        let tall = h > w;
        // A sandy valley floor on bedrock.
        let valley = h * if tall { 80 } else { 86 } / 100;
        for x in 0..w {
            let g = valley + isin(x * 11) * 3 / 2048;
            for y in g..h {
                self.fill(x, y, if y > h - 4 { STONE } else { SOIL });
            }
        }
        // Two rocky peaks with thick snow caps. Slopes stay under 45°, so the snow stays on.
        let peaks = [
            (w * if tall { 32 } else { 27 } / 100, h * if tall { 44 } else { 22 } / 100),
            (w * if tall { 66 } else { 53 } / 100, h * if tall { 60 } else { 55 } / 100),
        ];
        let snow_line = h * if tall { 66 } else { 58 } / 100;
        for x in 0..w {
            let mut top = h;
            for (px, pt) in peaks {
                top = top.min(pt + (x - px).abs() + isin(x * 21) / 2048);
            }
            if top >= valley {
                continue;
            }
            let thick = if top < snow_line { 3 + (snow_line - top) * 10 / snow_line } else { 0 };
            for y in top..valley + 2 {
                self.fill(x, y, if y < top + thick { SNOW } else { STONE });
            }
        }
        // A frozen lake in a stone basin, at the foot of the mountains.
        let lx = w * 84 / 100;
        let lw = w - lx - 2;
        for k in -2..lw + 2 {
            let x = lx + k;
            let edge = k.min(lw - 1 - k);
            let bottom = valley + 4.min(1 + edge).max(0);
            for y in valley - 1..=(bottom + 2).min(h - 1) {
                self.fill(x, y, if k < 0 || k >= lw || y > bottom { STONE } else { ICE });
            }
        }
        // Crystals in the rock face and pebbles at its foot.
        let cx = peaks[0].0 - (valley - peaks[0].1) + 6;
        for k in 0..5 {
            let x = (cx + k * 2).clamp(1, w - 2);
            let g = self.surface(x);
            for y in g - 2 - (k % 3)..g {
                self.fill(x, y, CRYSTAL);
                self.set_state(x, y, 0, 0, false);
            }
        }
        for k in 0..6 {
            let x = (w * 48 / 100 + k * 3 + (k % 2)).clamp(1, w - 2);
            let g = self.surface(x);
            self.fill(x, g - 1, PEBBLE);
        }
        // A few hardy flowers in the valley (not on snow or ice).
        let mut planted = 0;
        let mut last = -w;
        for x in 2..w - 2 {
            if planted >= 4 {
                break;
            }
            let g = self.surface(x);
            if self.get(x, g) != SOIL || x - last < w * 12 / 100 || self.get(x, g - 1) != EMPTY {
                continue;
            }
            self.grown_plant(x, g, h * 8 / 100, planted * 2 + 1, V_PLAIN);
            last = x;
            planted += 1;
        }
        self.scene_clouds(&[(560, 110, 18)]);
        self.resident(w * 50 / 100);
    }

    fn islands(&mut self) {
        let (w, h) = (self.w as i32, self.h as i32);
        let tall = h > w;
        let sea = h * if tall { 60 } else { 62 } / 100;
        let depth = h * if tall { 24 } else { 20 } / 100;
        let steep = if tall { 5 } else { 3 };
        for x in 0..w {
            let floor = sea + depth + isin(x * 14) * 2 / 1024;
            for y in sea..h {
                self.fill(
                    x,
                    y,
                    if y >= floor {
                        if y > h - 4 {
                            STONE
                        } else {
                            SAND
                        }
                    } else {
                        WATER
                    },
                );
            }
        }
        let isles = [(w * 26 / 100, w * 13 / 100), (w * 74 / 100, w * 10 / 100)];
        for (n, &(ix, ir)) in isles.iter().enumerate() {
            // A rock under the sea (rock can be steep) carrying a rounded sandy hill (sand can't).
            let reach = ir + depth / steep + 1;
            for x in ix - reach..=ix + reach {
                let dx = (x - ix).abs();
                let rock = if dx <= ir + 1 { sea } else { sea + (dx - ir - 1) * steep };
                let mut y = rock;
                while y < h && self.get(x, y) != SAND {
                    self.fill(x, y, STONE);
                    y += 1;
                }
                if dx >= ir {
                    continue;
                }
                let top = sea - (ir * ir - dx * dx) * (h * 8 / 100).min(ir * 4 / 10) / (ir * ir);
                for y in top..sea {
                    self.fill(x, y, if y >= sea - 1 && dx > ir - 3 { WETSAND } else { SAND });
                }
            }
            let px = ix + if n == 0 { -ir / 3 } else { ir / 4 };
            let g = self.surface(px);
            self.grown_plant(px, g, h * if n == 0 { 15 } else { 11 } / 100, 0, V_PALM);
            let fx = ix + if n == 0 { ir / 2 } else { -ir / 2 };
            let g = self.surface(fx);
            self.grown_plant(fx, g, h * 7 / 100, n as u8 * 2 + 1, V_PLAIN);
            let sx = ix + if n == 0 { ir / 5 } else { -ir / 6 };
            let g = self.surface(sx);
            self.fill(sx, g - 1, SHELL);
        }
        self.scene_clouds(&[(180, 110, 15), (620, 70, 20)]);
        self.resident(isles[0].0 + 3);
    }

    fn volcano(&mut self) {
        let (w, h) = (self.w as i32, self.h as i32);
        let tall = h > w;
        let base = h * if tall { 82 } else { 84 } / 100;
        for x in 0..w {
            let g = base + isin(x * 9 + 100) * 2 / 1024;
            for y in g..h {
                self.fill(x, y, if y > h - 3 { STONE } else { BASALT });
            }
        }
        // The cone, with a bowl of warm lava at the top.
        let vx = w * if tall { 50 } else { 60 } / 100;
        let top = h * if tall { 50 } else { 38 } / 100;
        let half = (base - top) * 105 / 100;
        let bowl = (w * 7 / 100).max(8);
        for x in vx - half..=vx + half {
            let dx = (x - vx).abs();
            let y0 = top + (dx - bowl).max(0) * 95 / 100 + isin(x * 40) / 1024;
            for y in y0..base + 2 {
                self.fill(x, y, BASALT);
            }
            if dx < bowl - 1 {
                let d = (bowl - 1 - dx).min(6);
                // The crater is open to the sky: the jam sits two cells below its rim.
                for y in top - 2..top + 2 {
                    self.fill(x, y, EMPTY);
                }
                for y in top + 2..=top + 1 + d {
                    self.fill(x, y, LAVA);
                    self.set_state(x, y, 255, 1, false);
                }
            }
        }
        // A rain pool in a stone basin, well away from the warmth.
        let pw = (w * 14 / 100).max(12);
        let px = if tall { 3 } else { w * 6 / 100 };
        for k in -2..pw + 2 {
            let x = px + k;
            let edge = k.min(pw - 1 - k);
            let bottom = base + 5.min(1 + edge).max(0);
            for y in base - 1..=(bottom + 2).min(h - 1) {
                self.fill(x, y, if k < 0 || k >= pw || y > bottom { STONE } else { WATER });
            }
        }
        // A patch of hot rock, dry for now: pour water on it and see.
        let gx = if tall { w * 80 / 100 } else { w * 30 / 100 };
        let g = self.surface(gx);
        self.rect(gx - 3, g, gx + 3, g + 1, GEYSER);
        self.rect(gx - 5, g - 2, gx - 4, g, STONE);
        self.rect(gx + 4, g - 2, gx + 5, g, STONE);
        // Soft ash on the far slope.
        for k in 0..(w * 9 / 100) {
            let x = (w * 86 / 100 + k).min(w - 2);
            let g = self.surface(x);
            if self.get(x, g) == BASALT {
                self.fill(x, g - 1, ASH);
                if k % 3 != 0 {
                    self.fill(x, g - 2, ASH);
                }
            }
        }
        self.resident(vx);
    }

    /// A coral fan: a short trunk that splits into branches curving up.
    fn coral_fan(&mut self, x: i32, ground: i32, tall: i32, hue: u8) {
        let put = |world: &mut World, cx: i32, cy: i32| {
            if world.inside(cx, cy) && world.get(cx, cy) == EMPTY {
                world.set(cx, cy, CORAL);
                world.set_state(cx, cy, 0, hue, true);
            }
        };
        for k in 0..tall / 3 {
            put(self, x, ground - 1 - k);
            put(self, x + 1, ground - 1 - k);
        }
        let fork = ground - tall / 3;
        for (dir, len) in [(-1, tall * 2 / 3), (1, tall * 3 / 4), (0, tall * 2 / 3)] {
            for k in 0..len {
                let bx = x + dir * (k * 2 / 3).min(tall / 2) + if dir == 0 { (k / 4) % 2 } else { 0 };
                put(self, bx, fork - k);
                if k > 2 && k % 3 == 0 {
                    put(self, bx - 1, fork - k - 1);
                    put(self, bx + 1, fork - k - 1);
                }
            }
        }
    }

    fn undersea(&mut self) {
        let (w, h) = (self.w as i32, self.h as i32);
        let tall = h > w;
        let base = h * if tall { 74 } else { 80 } / 100;
        let floor = |x: i32| base + isin(x * 6 + 300) * h / 30 / 1024 + isin(x * 19) * 2 / 1024;
        for x in 0..w {
            for y in floor(x)..h {
                self.fill(x, y, if y > h - 3 { STONE } else { SAND });
            }
        }
        // A rock arch and a few boulders.
        let ax = w * if tall { 30 } else { 22 } / 100;
        let ar = (w * 9 / 100).max(10);
        let ay = floor(ax);
        for y in -ar..=2 {
            for x in -ar..=ar {
                let d2 = x * x + y * y * 2;
                if d2 <= ar * ar && d2 >= (ar - 4) * (ar - 4) {
                    self.fill(ax + x, ay + y, STONE);
                }
            }
        }
        self.disc(w * 82 / 100, floor(w * 82 / 100), 5, STONE);
        self.disc(w * 60 / 100, floor(w * 60 / 100) + 2, 3, STONE);
        // Coral fans on the sand, kelp forests and shells: all asleep until the child plays.
        for (n, f) in [76, 83, 89, 57, 63].iter().enumerate() {
            let x = w * f / 100;
            let g = self.surface(x);
            let tall = h * (9 + (n as i32 * 5) % 6) / 100;
            self.coral_fan(x, g, tall, n as u8 % 5);
        }
        for (n, f) in [6, 9, 13, 42, 46, 49, 95].iter().enumerate() {
            let x = w * f / 100;
            let g = self.surface(x);
            let tall = h * (18 + (n as i32 * 7) % 14) / 100;
            for k in 0..tall {
                let y = g - 1 - k;
                let kx = x + if (k / 7) % 2 == 1 { 1 } else { 0 };
                self.fill(kx, y, KELP);
                self.fix(kx, y, 0, 0);
                self.aux[y as usize * self.w + kx as usize] = k.min(255) as u8;
                if k > 3 && k % 4 == 2 {
                    let lx = kx + if k % 8 == 2 { 1 } else { -1 };
                    if self.get(lx, y) == EMPTY {
                        self.fill(lx, y, KELP);
                        self.fix(lx, y, 0, 0);
                        self.aux[y as usize * self.w + lx as usize] = k.min(255) as u8;
                    }
                }
            }
        }
        for f in [36, 52, 70] {
            let x = w * f / 100;
            let g = self.surface(x);
            self.fill(x, g - 1, SHELL);
        }
        self.resident(w / 2);
    }

    fn space(&mut self) {
        let (w, h) = (self.w as i32, self.h as i32);
        // A little rocky planet with a gravity heart, and a baby moon.
        let (px, py) = (w * 50 / 100, h * 54 / 100);
        self.disc(px, py, (w.min(h) * 7 / 100).max(8), STONE);
        self.disc(px, py, 3, GRAVITY);
        let (mx, my) = if h > w { (w * 28 / 100, h * 18 / 100) } else { (w * 14 / 100, h * 26 / 100) };
        self.disc(mx, my, 4, STONE);
        self.disc(mx, my, 1, GRAVITY);
        // A few lonely space pebbles floating far from any pull.
        for (fx, fy, r) in [(6, 8, 2), (93, 10, 1), (90, 88, 2), (8, 90, 1), (60, 6, 1)] {
            let (x, y) = (w * fx / 100, h * fy / 100);
            self.disc(x, y, r, if r > 1 { STONE } else { METEORITE });
        }
        self.resident(w * 76 / 100);
    }

    fn moon(&mut self) {
        let (w, h) = (self.w as i32, self.h as i32);
        let tall = h > w;
        let base = h * if tall { 60 } else { 74 } / 100;
        let craters = [(w * 22 / 100, w * 9 / 100), (w * 63 / 100, w * 13 / 100), (w * 90 / 100, w * 5 / 100)];
        for x in 0..w {
            let mut g = base + isin(x * 5 + 150) * h / 40 / 1024;
            for (cx, cr) in craters {
                let dx = (x - cx).abs();
                if dx < cr {
                    g += (cr * cr - dx * dx) * (cr / 2).min(h / 14) / (cr * cr);
                } else if dx < cr + 3 {
                    g -= 2 - (dx - cr) / 2;
                }
            }
            for y in g..h {
                self.fill(x, y, if y > g + h / 9 { STONE } else { MOONDUST });
            }
        }
        // Ice hiding in the shade of a rock ledge, at the bottom of the big crater.
        let (cx, _) = craters[1];
        let g = self.surface(cx - 6);
        self.rect(cx - 12, g - 6, cx - 2, g - 5, STONE);
        self.rect(cx - 12, g - 5, cx - 11, g - 1, STONE);
        self.rect(cx - 10, g - 2, cx - 5, g - 1, ICE);
        for (n, f) in [10, 40, 78, 52].iter().enumerate() {
            let x = w * f / 100;
            let g = self.surface(x);
            let r = 1 + (n as i32 % 2);
            for dy in 0..=r {
                for dx in -r + dy / 2..=r - dy / 2 {
                    self.fill(x + dx, g - 1 - dy, METEORITE);
                }
            }
        }
        self.resident(w * 36 / 100);
    }

    fn mars(&mut self) {
        let (w, h) = (self.w as i32, self.h as i32);
        let tall = h > w;
        let base = h * if tall { 64 } else { 80 } / 100;
        for x in 0..w {
            let g = base + isin(x * 8) * h / 36 / 1024 + isin(x * 23 + 400) * 2 / 1024;
            for y in g..h {
                self.fill(x, y, if y > g + h / 10 { STONE } else { REDDUST });
            }
        }
        // A flat-topped mesa with a cap of dry ice.
        let mx = w * if tall { 22 } else { 18 } / 100;
        let mw = (w * 9 / 100).max(9);
        let mt = base - h * 16 / 100;
        for x in mx - mw..=mx + mw {
            let inset = ((x - mx).abs() - mw + 4).max(0) * 3;
            for y in mt + inset..h - 1 {
                self.fill(x, y, STONE);
            }
        }
        self.rect(mx - mw + 3, mt - 2, mx + mw - 3, mt - 1, DRYICE);
        // A glass dome with dry soil inside: the first garden on Mars is up to the child.
        let dx = w * if tall { 64 } else { 62 } / 100;
        let dr = (w * 11 / 100).max(13).min(h / 5);
        let dg = self.surface(dx).max(self.surface(dx - dr)).max(self.surface(dx + dr));
        for x in dx - dr..=dx + dr {
            for y in dg - 1..dg + 3 {
                self.fill(x, y, if y < dg + 1 { EMPTY } else { STONE });
            }
            for y in 0..dg - 1 {
                if self.get(x, y) == REDDUST {
                    self.fill(x, y, EMPTY);
                }
            }
        }
        for y in -dr..=0 {
            for x in -dr..=dr {
                let d2 = x * x + y * y;
                if d2 <= dr * dr + dr && d2 >= (dr - 1) * (dr - 1) {
                    self.fill(dx + x, dg + y, DOME);
                }
            }
        }
        self.rect(dx - dr + 2, dg - 1, dx + dr - 2, dg, SOIL);
        for f in [40, 46, 88, 93] {
            let x = w * f / 100;
            let g = self.surface(x);
            self.fill(x, g - 1, PEBBLE);
        }
        self.resident(w * 84 / 100);
    }
}
