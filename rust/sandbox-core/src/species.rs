//! What each element does beyond falling and flowing: the water cycle, plants,
//! lava, the sea creatures that are really cells (coral, kelp, plankton), and
//! the space toys. Nothing here burns, breaks or hurts: things only change.

use crate::gen::*;
use crate::sim::*;
use crate::table::*;

impl World {
    /// Is there light here: open sky above (by day), or a sun lamp close by?
    pub fn lit(&self, x: i32, y: i32) -> bool {
        if !self.night {
            let mut open = true;
            for yy in (0..y).rev() {
                let t = sp(self.cells[yy as usize * self.w + x as usize]);
                if ELEMENTS[t as usize].flags & F_OPAQUE != 0 {
                    open = false;
                    break;
                }
            }
            if open {
                return true;
            }
        }
        for yy in (y - 6).max(0)..=(y + 6).min(self.h as i32 - 1) {
            for xx in (x - 6).max(0)..=(x + 6).min(self.w as i32 - 1) {
                let t = sp(self.cells[yy as usize * self.w + xx as usize]);
                if t == HEAT || t == STAR {
                    return true;
                }
            }
        }
        false
    }

    /// Is there a glass roof somewhere above (a dome keeps the air and the warmth in)?
    fn sheltered(&self, x: i32, y: i32) -> bool {
        for yy in (y - 70).max(0)..y {
            let t = sp(self.cells[yy as usize * self.w + x as usize]);
            if t == GLASS || t == DOME {
                return true;
            }
        }
        false
    }

    fn fresh_shade(&mut self) -> u8 {
        self.rand() as u8
    }

    /* ── Sand ── */

    pub(crate) fn sand(&mut self, x: i32, y: i32, i: usize) {
        if self.powder(x, y, i, SAND) || self.params.radial {
            return;
        }
        if let Some(j) = self.nb(x, y, DOWN) {
            if sp(self.cells[j]) == SHELL {
                // A grain of sand slips into a shell: the oyster coats it, layer after layer.
                if ca(self.cells[j]) == 0 {
                    self.keep(i);
                    if self.chance(5) {
                        self.cells[j] = with_a(self.cells[j], 1);
                        let sh = self.fresh_shade();
                        self.put(i, mk(PEARL, 0, 0, sh));
                        self.emit(R_PEARL, x, y);
                        self.effect(FX_SPARK, x, y, 0xfff0ff);
                    }
                }
                return;
            }
        }
        if self.params.medium != AIR {
            return;
        }
        // A little water glues the grains together: castle sand.
        let mut water = None;
        let mut air = false;
        for d in [0u8, 2, 6] {
            if let Some(j) = self.nb(x, y, d) {
                let t = sp(self.cells[j]);
                if t == WATER || t == SALTWATER {
                    water = Some(j);
                } else if t == EMPTY {
                    air = true;
                }
            }
        }
        if let (Some(wj), true) = (water, air) {
            self.keep(i);
            if self.chance(8) {
                let sh = shade(self.cells[i]);
                self.put(i, mk(WETSAND, 0, 0, sh));
                if self.chance(2) {
                    self.kill(wj);
                }
                self.emit(R_CASTLE, x, y);
            }
        }
    }

    /* ── Water ── */

    pub(crate) fn water(&mut self, x: i32, y: i32, i: usize) {
        if !self.params.radial {
            let (mut ice, mut stone, mut ice_beside) = (0, 0, false);
            for d in [0u8, 2, 4, 6] {
                if let Some(j) = self.nb(x, y, d) {
                    match sp(self.cells[j]) {
                        ICE => {
                            ice += 1;
                            ice_beside |= d != DOWN;
                        }
                        STONE => stone += 1,
                        _ => {}
                    }
                }
            }
            if ice > 0 && self.temp_at(x, y) < 136 {
                let below = self.get(x, y + 1);
                if below == EMPTY && ice_beside {
                    // A drip running along the ice freezes before it falls: an icicle grows.
                    self.keep(i);
                    if self.chance(4) {
                        let sh = shade(self.cells[i]);
                        self.put(i, mk(ICE, 0, 1, sh));
                        self.emit(R_ICICLE, x, y);
                        return;
                    }
                } else if stone > 0 {
                    // Water freezing in a crack takes more room and splits the rock into pebbles.
                    self.keep(i);
                    if self.chance(50) {
                        let sh = shade(self.cells[i]);
                        self.put(i, mk(ICE, 0, 0, sh));
                        for d in [0u8, 2, 4, 6] {
                            if let Some(j) = self.nb(x, y, d) {
                                if sp(self.cells[j]) == STONE && self.rand() & 1 == 0 {
                                    let sh = self.fresh_shade();
                                    self.put(j, mk(PEBBLE, 0, 0, sh));
                                }
                            }
                        }
                        self.emit(R_CRACK, x, y);
                        self.effect(FX_SPARK, x, y, 0xdff6ff);
                        return;
                    }
                }
            }
            if self.world == MOON {
                // No air on the Moon: in the sunlight water vanishes, in the shade it freezes.
                self.keep(i);
                if self.chance(110) {
                    if self.lit(x, y) {
                        self.kill(i);
                        self.effect(FX_PUFF, x, y, 0xcfe8ff);
                    } else {
                        let sh = shade(self.cells[i]);
                        self.put(i, mk(ICE, 0, 0, sh));
                        self.emit(R_MOON_ICE, x, y);
                    }
                    return;
                }
            }
        }
        self.liquid(x, y, i, WATER);
    }

    /* ── Seeds and plants ── */

    /// A seed touching water drinks it and becomes the first cell of a plant.
    pub(crate) fn sprout(&mut self, x: i32, y: i32, i: usize) -> bool {
        if self.params.medium == SEA || self.params.radial {
            return false;
        }
        let mut source = None;
        for d in [0u8, 4, 6, 2] {
            if let Some(j) = self.nb(x, y, d) {
                let t = sp(self.cells[j]);
                if t == WATER || t == DYED || (t == MUD && d == DOWN) {
                    source = Some((j, d, t));
                    break;
                }
            }
        }
        let Some((n, d, t)) = source else { return false };
        if self.world == MARS && !self.sheltered(x, y) {
            // Too cold and no air out there: the seed keeps sleeping until it has a roof.
            return false;
        }
        // What the seed grows into depends on the ground it landed on.
        let ground = if d == DOWN && t != MUD { self.get(x, y + 2) } else { self.get(x, y + 1) };
        let mut variant = match ground {
            SAND | REDDUST | MOONDUST | WETSAND => V_CACTUS,
            MUD => V_REED,
            ASH => V_GIANT,
            _ => V_PLAIN,
        };
        for dd in 0..8u8 {
            if let Some(j) = self.nb(x, y, dd) {
                if sp(self.cells[j]) == ASH {
                    variant = V_GIANT;
                }
            }
        }
        if cb(self.cells[i]) == 1 {
            variant = V_RAINBOW;
        }
        if t == MUD && variant != V_RAINBOW {
            variant = V_REED;
            let sh = shade(self.cells[n]);
            self.put(n, mk(SOIL, 0, 0, sh));
        } else if d == DOWN {
            // The water below becomes the root; water on the side is simply drunk.
            let sh = self.fresh_shade();
            self.put(n, mk(PLANT, 6, 0, (sh & 31) | (variant << 5)));
            self.aux[n] = 0;
        } else {
            self.kill(n);
        }
        let r = self.rand();
        let (budget, water) = match variant {
            V_CACTUS => (5 + (r % 5) as u8, 40),
            V_REED => (13 + (r % 8) as u8, 40),
            V_GIANT | V_RAINBOW => (30 + (r % 16) as u8, 60),
            _ => (10 + (r % 14) as u8, 14),
        };
        let sh = (shade(self.cells[i]) & 31) | (variant << 5);
        self.put(i, mk(PLANT, water, TIP | budget, sh));
        self.aux[i] = 1;
        self.emit(R_SPROUT, x, y);
        match variant {
            V_CACTUS => self.emit(R_CACTUS, x, y),
            V_REED => self.emit(R_REED, x, y),
            V_GIANT => self.emit(R_GIANT, x, y),
            _ => {}
        }
        if self.world == MARS {
            self.emit(R_MARS_GARDEN, x, y);
        }
        true
    }

    /// Plant: cells touching water drink it and share it along the stem. The tip
    /// climbs while it has water and growth left, sprouts leaves and sometimes a
    /// branch; once grown, with light and water, it blooms into a flower.
    pub(crate) fn plant(&mut self, x: i32, y: i32, i: usize) {
        let w = self.w;
        let c = self.cells[i];
        let (mut a, b) = (ca(c), cb(c));
        let variant = shade(c) >> 5;
        if a > 0 || b & TIP != 0 {
            self.keep(i);
        } else if a < 24 && c & FIXED == 0 {
            // A thirsty root next to water stays awake to drink.
            for d in [4u8, 2, 6] {
                if let Some(j) = self.nb(x, y, d) {
                    let t = sp(self.cells[j]);
                    if t == WATER || t == DYED {
                        self.keep(i);
                        break;
                    }
                }
            }
        }
        // Drink from one random neighbour, and pass water up the stem (never down: sap rises).
        let r = self.rand() & 3;
        let d = [0u8, 4, 6, 2][r as usize];
        let mut n = self.nb(x, y, d);
        let mut nt = n.map(|j| sp(self.cells[j]));
        if r == 1 && nt == Some(EMPTY) && a < 24 {
            // A root reaches down a little for the water that sank away from it.
            for k in 2..=4 {
                let t = self.get(x, y + k);
                if t == WATER || t == DYED {
                    n = Some((y + k) as usize * w + x as usize);
                    nt = Some(t);
                    break;
                }
                if t != EMPTY {
                    break;
                }
            }
        }
        if nt == Some(WATER) || nt == Some(DYED) {
            if a < 24 {
                self.keep(i);
                if self.chance(4) {
                    let j = n.unwrap();
                    if nt == Some(DYED) {
                        self.recolor(x, y, ca(self.cells[j]));
                    }
                    self.kill(j);
                    a += 6;
                    self.cells[i] = with_a(self.cells[i], a);
                }
            }
        } else if y > 0 && r != 1 {
            if r == 0 && nt != Some(PLANT) {
                // The stem may go on diagonally.
                let dd = if self.rand() & 1 == 0 { 1 } else { 7 };
                n = self.nb(x, y, dd);
            }
            if let Some(j) = n {
                let o = self.cells[j];
                if sp(o) == PLANT && o & FIXED == 0 && (ca(o) as u32 + 1) < a as u32 && cb(o) & LEAF == 0 {
                    a -= 1;
                    self.cells[i] = with_a(self.cells[i], a);
                    self.cells[j] = with_a(o, ca(o) + 1);
                    self.keep(j);
                }
            }
        }
        if b & TIP == 0 {
            return;
        }
        let budget = b & BUDGET;
        if budget > 0 {
            if a < 2 || y == 0 || !self.chance(if variant == V_GIANT || variant == V_RAINBOW { 8 } else { 14 }) {
                return;
            }
            let straight = variant == V_CACTUS || variant == V_REED || variant == V_PALM;
            let s = self.side();
            let up = i - w;
            let options: [i64; 3] = if !straight && self.chance(4) {
                [up as i64 + s as i64, up as i64, up as i64 - s as i64]
            } else if straight {
                [up as i64, up as i64, up as i64]
            } else {
                [up as i64, up as i64 + s as i64, up as i64 - s as i64]
            };
            for j in options {
                let jx = j - ((y - 1) as i64) * w as i64;
                if jx < 0 || jx >= w as i64 {
                    continue;
                }
                let j = j as usize;
                let t = sp(self.cells[j]);
                if t != EMPTY && t != WATER {
                    continue;
                }
                // The tip moves up and carries its water with it.
                let height = self.aux[i].saturating_add(1);
                let sh = (self.fresh_shade() & 31) | (variant << 5);
                self.put(j, mk(PLANT, a - 1, TIP | (budget - 1), sh));
                self.aux[j] = height;
                self.cells[i] = with_b(with_a(self.cells[i], 0), 0);
                // A leaf, now and then, on either side of the stem.
                let leafy = match variant {
                    V_CACTUS | V_PALM => false,
                    V_REED => self.chance(6),
                    V_GIANT | V_RAINBOW => self.chance(2),
                    _ => self.chance(3),
                };
                if leafy {
                    let lx = x + self.side();
                    if self.get(lx, y) == EMPTY {
                        let l = y as usize * w + lx as usize;
                        let sh = (self.fresh_shade() & 31) | (variant << 5);
                        self.put(l, mk(PLANT, 0, LEAF, sh));
                        self.aux[l] = self.aux[i];
                    }
                }
                // Sometimes a branch, which will carry its own flower.
                if !straight && budget > 7 && self.chance(7) {
                    let bx = x + self.side();
                    if y > 0 && self.get(bx, y - 1) == EMPTY {
                        let bj = (y - 1) as usize * w + bx as usize;
                        let half = ca(self.cells[j]) >> 1;
                        let sh = (self.fresh_shade() & 31) | (variant << 5);
                        self.put(bj, mk(PLANT, half, TIP | (budget >> 1), sh));
                        self.aux[bj] = height;
                        self.cells[j] = with_a(self.cells[j], ca(self.cells[j]) - half);
                    }
                }
                return;
            }
            // Nowhere to grow: the tip is done growing.
            self.cells[i] = with_b(self.cells[i], TIP);
            return;
        }
        if a >= 2 && self.chance(16) && self.lit(x, y) {
            self.bloom(x, y, i, variant);
        }
    }

    fn bloom(&mut self, x: i32, y: i32, i: usize, variant: u8) {
        let w = self.w;
        let height = self.aux[i];
        if variant == V_PALM {
            // A palm opens a crown of fronds instead of a flower.
            for (dx, dy) in [(-1, 0), (1, 0), (-2, 1), (2, 1), (-1, -1), (1, -1), (-3, 2), (3, 2), (0, -1), (-2, 0), (2, 0)] {
                if self.get(x + dx, y + dy) == EMPTY {
                    let j = (y + dy) as usize * w + (x + dx) as usize;
                    let sh = (self.fresh_shade() & 31) | (V_PALM << 5);
                    self.put(j, mk(PLANT, 0, LEAF, sh));
                    self.aux[j] = height;
                }
            }
            self.cells[i] = with_b(with_a(self.cells[i], 0), 0);
            return;
        }
        let hue = match variant {
            V_REED => 10,
            V_CACTUS => 0,
            _ => (self.rand() % 5) as u8,
        };
        let sh = shade(self.cells[i]);
        self.put(i, mk(FLOWER, hue, CENTER, sh));
        self.aux[i] = height;
        let petals: &[(i32, i32)] = match variant {
            V_REED => &[(0, 1), (0, -1)],
            V_GIANT | V_RAINBOW => &[(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1), (-1, 1), (1, 1), (-2, 0), (2, 0), (0, -2)],
            _ => &[(-1, 0), (1, 0), (0, -1), (0, 1)],
        };
        for &(dx, dy) in petals {
            let (px, py) = (x + dx, y + dy);
            if !self.inside(px, py) {
                continue;
            }
            let j = py as usize * w + px as usize;
            let t = sp(self.cells[j]);
            if t != EMPTY && !(variant == V_REED && t == PLANT) {
                continue;
            }
            let sh = self.fresh_shade();
            let hue = if variant == V_RAINBOW { sh % 10 } else { hue };
            self.put(j, mk(FLOWER, hue, if variant == V_REED { CENTER } else { PETAL }, sh));
            self.aux[j] = height;
        }
        self.emit(R_BLOOM, x, y);
    }

    /// A stem drank coloured water: the flowers above take the colour.
    pub(crate) fn recolor(&mut self, x: i32, y: i32, hue: u8) {
        let mut found = false;
        for yy in (y - 70).max(0)..=y {
            for xx in (x - 8).max(0)..=(x + 8).min(self.w as i32 - 1) {
                let j = yy as usize * self.w + xx as usize;
                let c = self.cells[j];
                if sp(c) == FLOWER && ca(c) != 5 + hue % 5 && ca(c) != 10 {
                    self.cells[j] = with_a(c, 5 + hue % 5);
                    self.wake(j);
                    found = true;
                }
            }
        }
        if found {
            self.emit(R_RECOLOR, x, y);
            self.effect(FX_SPARK, x, y - 4, 0xffffff);
        }
    }

    pub(crate) fn dyed(&mut self, x: i32, y: i32, i: usize) {
        // Coloured water next to a stem of the scene: the stem drinks it too.
        for d in [0u8, 2, 6] {
            if let Some(j) = self.nb(x, y, d) {
                let o = self.cells[j];
                if sp(o) == PLANT && o & FIXED != 0 {
                    self.keep(i);
                    if self.chance(20) {
                        let hue = ca(self.cells[i]);
                        self.kill(i);
                        self.recolor(x, y, hue);
                        return;
                    }
                }
            }
        }
        self.liquid(x, y, i, DYED);
    }

    pub(crate) fn pollen(&mut self, x: i32, y: i32, i: usize) {
        if ca(self.cells[i]) > 20 {
            for d in [0u8, 2, 4, 6] {
                if let Some(j) = self.nb(x, y, d) {
                    if sp(self.cells[j]) == FLOWER {
                        // Pollen that reaches another flower makes a seed.
                        let sh = self.fresh_shade();
                        self.put(i, mk(SEED, 0, 0, sh));
                        self.emit(R_POLLINATE, x, y);
                        self.effect(FX_SPARK, x, y, 0xffe066);
                        return;
                    }
                }
            }
        }
        self.powder(x, y, i, POLLEN);
    }

    /* ── The water cycle ── */

    /// The warm sun lamp: warms a couple of cells around it each tick. Never burns anything.
    pub(crate) fn heat(&mut self, x: i32, y: i32, i: usize) {
        self.keep(i);
        self.warm(x, y, ELEMENTS[HEAT as usize].heat as i16, 255);
        for _ in 0..2 {
            let tx = x + (self.rand() % 7) as i32 - 3;
            let ty = y + (self.rand() % 7) as i32 - 3;
            if !self.inside(tx, ty) {
                continue;
            }
            let j = ty as usize * self.w + tx as usize;
            match sp(self.cells[j]) {
                ICE if self.chance(5) => {
                    self.spawn(j, WATER);
                    self.emit(if self.world == SPACE { R_HABITABLE } else { R_MELT_ICE }, tx, ty);
                }
                SNOW if self.chance(2) => {
                    self.spawn(j, WATER);
                    self.emit(R_MELT_SNOW, tx, ty);
                }
                WATER | DYED if self.chance(5) => {
                    self.spawn(j, STEAM);
                    self.emit(R_EVAPORATE, tx, ty);
                }
                SALTWATER if self.chance(5) => {
                    self.spawn(j, SALT);
                    if self.get(tx, ty - 1) == EMPTY {
                        self.spawn(j - self.w, STEAM);
                    }
                    self.emit(R_SALT_CRUST, tx, ty);
                }
                BUBBLE if self.chance(3) && !self.wet(self.get(tx, ty + 1)) => {
                    // The thin film of a bubble splits the light into colours, then pops.
                    self.kill(j);
                    self.emit(R_SHIMMER, tx, ty);
                    self.effect(FX_SPARK, tx, ty, 0xff9ad8);
                }
                CRYSTAL => {
                    if ca(self.cells[j]) < 80 {
                        self.emit(R_PRISM, tx, ty);
                        self.effect(FX_SPARK, tx, ty, 0xc9a9ff);
                    }
                    self.cells[j] = with_a(self.cells[j], 255);
                    self.wake(j);
                }
                DRYICE if self.chance(3) => {
                    self.spawn(j, FOG);
                    self.emit(R_SUBLIMATE, tx, ty);
                }
                FROST | FOG if self.chance(4) => self.kill(j),
                _ => {}
            }
        }
    }

    /// Steam: rises and wobbles; up high it cools and gathers into a cloud.
    pub(crate) fn steam(&mut self, x: i32, y: i32, i: usize) {
        self.keep(i);
        let w = self.w;
        let mut a = ca(self.cells[i]);
        if a < 255 {
            a += 1;
            self.cells[i] = with_a(self.cells[i], a);
        }
        let above = self.get(x, y - 1);
        if above == CLOUD && y > 0 {
            // Joins the cloud above: one more raindrop in it.
            let j = i - w;
            let ra = ca(self.cells[j]);
            if ra < 40 {
                self.cells[j] = with_a(self.cells[j], ra + 2);
            }
            self.keep(j);
            self.kill(i);
            self.emit(R_CONDENSE, x, y - 1);
            return;
        }
        if y <= 1 || (a > 170 && above != EMPTY && above != WATER) {
            let sh = shade(self.cells[i]);
            self.put(i, mk(CLOUD, 3, 0, sh));
            self.emit(R_CONDENSE, x, y);
            return;
        }
        if self.chance(5) {
            return;
        }
        if above == EMPTY || above == WATER {
            // Steam curls as it rises: it often drifts sideways.
            let wobble = if self.chance(2) { self.side() } else { 0 };
            if wobble != 0 {
                if self.get(x + wobble, y - 1) == EMPTY {
                    return self.swap(i, (y - 1) as usize * w + (x + wobble) as usize);
                }
                if self.get(x + wobble, y) == EMPTY && self.chance(2) {
                    return self.swap(i, y as usize * w + (x + wobble) as usize);
                }
            }
            return self.swap(i, i - w);
        }
        let d = self.side();
        for dx in [d, -d] {
            if self.get(x + dx, y - 1) == EMPTY {
                return self.swap(i, (y - 1) as usize * w + (x + dx) as usize);
            }
            if self.get(x + dx, y) == EMPTY && self.chance(2) {
                return self.swap(i, y as usize * w + (x + dx) as usize);
            }
        }
    }

    /// Cloud: floats still, lets its raindrops fall one by one, and fades away once empty.
    pub(crate) fn cloud(&mut self, x: i32, y: i32, i: usize) {
        let c = self.cells[i];
        let a = ca(c);
        if a > 0 {
            self.keep(i);
            if self.get(x, y + 1) == EMPTY && (y as usize) < self.h - 1 && self.chance(70) {
                self.spawn(i + self.w, WATER);
                self.cells[i] = with_a(c, a - 1);
                self.emit(R_RAIN, x, y + 1);
                if cb(c) & 2 != 0 {
                    self.emit(R_ASH_RAIN, x, y + 1);
                }
                self.raindrops = self.raindrops.saturating_add(1);
                if self.raindrops >= 10 && !self.night && self.rainbow == 0 && self.params.medium == AIR {
                    // Sunlight through the raindrops: a rainbow.
                    self.raindrops = 0;
                    self.rainbow = 1500;
                    self.emit(R_RAINBOW, x, y + 6);
                }
            }
        } else if c & FIXED == 0 {
            self.keep(i);
            if self.chance(260) {
                self.kill(i); // a spent cloud fades away (the clouds of the scene stay)
            }
        }
    }

    /// Bubble: air is lighter than water, so it rises through it; in the open air it floats a bit and pops.
    pub(crate) fn bubble(&mut self, x: i32, y: i32, i: usize) {
        self.keep(i);
        let w = self.w;
        let mut a = ca(self.cells[i]);
        if a < 255 {
            a += 1;
            self.cells[i] = with_a(self.cells[i], a);
        }
        if y == 0 {
            self.kill(i);
            return;
        }
        let sea = self.params.medium == SEA;
        if self.params.medium == VACUUM && a > 3 {
            // No air around to hold it, and no air to carry the sound: a silent pop.
            self.kill(i);
            self.emit(R_SILENT_POP, x, y);
            self.effect(FX_SPARK, x, y, 0xdff6ff);
            return;
        }
        let j = i - w;
        let above = sp(self.cells[j]);
        let liquid = |t: u8| t == WATER || t == DYED || t == SALTWATER || (t == EMPTY && sea);
        if liquid(above) {
            let wobble = if self.chance(3) { self.side() } else { 0 };
            let k = if wobble != 0 && liquid(self.get(x + wobble, y - 1)) && self.inside(x + wobble, y - 1) {
                (y - 1) as usize * w + (x + wobble) as usize
            } else {
                j
            };
            let risen = self.aux[i].saturating_add(1);
            self.swap(i, k);
            self.cells[k] = with_a(self.cells[k], 0);
            self.aux[k] = risen;
            self.emit(R_BUBBLE, x, y - 1);
            if risen >= 22 {
                // Less water pressing on it near the surface: the bubble grows.
                self.aux[k] = 0;
                let (kx, ky) = ((k % w) as i32, (k / w) as i32);
                let s = self.side();
                for dx in [s, -s] {
                    if self.inside(kx + dx, ky) && liquid(self.get(kx + dx, ky)) {
                        let n = ky as usize * w + (kx + dx) as usize;
                        let sh = self.fresh_shade();
                        self.put(n, mk(BUBBLE, 0, 0, sh));
                        self.aux[n] = 6;
                        self.emit(R_BUBBLE_GROW, kx, ky);
                        break;
                    }
                }
            }
            return;
        }
        let in_water = sea || liquid(self.get(x, y + 1)) && (y as usize) < self.h - 1 || self.get(x - 1, y) == WATER || self.get(x + 1, y) == WATER;
        if !in_water && (a > 80 || self.chance(40)) {
            self.kill(i); // pop!
            return;
        }
        if above == EMPTY && self.chance(2) {
            return self.swap(i, j);
        }
        let d = self.side();
        if self.inside(x + d, y - 1) {
            let t = self.get(x + d, y - 1);
            if t == EMPTY || t == WATER {
                self.swap(i, (y - 1) as usize * w + (x + d) as usize);
            }
        }
    }

    /// Snow: drifts down slowly, piles up in heaps, melts quietly in water.
    pub(crate) fn snow(&mut self, x: i32, y: i32, i: usize) {
        if y as usize >= self.h - 1 {
            return;
        }
        let w = self.w;
        let j = i + w;
        let tb = sp(self.cells[j]);
        let open = |t: u8| t == EMPTY || t == STEAM || t == CLOUD || t == BUBBLE || t == FOG;
        let (l, r) = (self.get(x - 1, y + 1), self.get(x + 1, y + 1));
        if !(open(tb) || tb == WATER || l == EMPTY || r == EMPTY) {
            return;
        }
        self.keep(i);
        if (self.rand() & 255) >= (128 * self.grav) >> 8 {
            return;
        }
        if tb == WATER {
            if self.chance(240) {
                self.spawn(i, WATER);
            }
            return;
        }
        let air = self.params.medium == AIR;
        let drift = if air && self.chance(3) { self.side() } else { 0 };
        // A pile that is too steep lets go: a soft little snow slide.
        let steep = !open(tb) && self.get(x, y - 1) == SNOW && self.get(x, y - 2) == SNOW && self.get(x, y - 3) == SNOW;
        if drift != 0 && open(self.get(x + drift, y + 1)) && self.inside(x + drift, y + 1) {
            if steep {
                self.emit(R_AVALANCHE, x, y);
            }
            return self.swap(i, (j as i32 + drift) as usize);
        }
        if open(tb) {
            return self.swap(i, j);
        }
        if self.chance(3) {
            let d = self.side();
            if self.get(x + d, y + 1) == EMPTY {
                if steep {
                    self.emit(R_AVALANCHE, x, y);
                }
                self.swap(i, (j as i32 + d) as usize);
            }
        }
    }

    /* ── Mountain ── */

    pub(crate) fn crystal(&mut self, x: i32, y: i32, i: usize) {
        let c = self.cells[i];
        let (a, budget) = (ca(c), cb(c));
        if a > 0 {
            // The light caught in the crystal fades slowly.
            self.keep(i);
            self.cells[i] = with_a(c, a.saturating_sub(2));
        }
        if budget == 0 {
            return;
        }
        for d in [0u8, 2, 6, 4] {
            if let Some(j) = self.nb(x, y, d) {
                let t = sp(self.cells[j]);
                if t == WATER || t == SALTWATER {
                    // Crystals grow layer by layer from what is dissolved in the water.
                    self.keep(i);
                    if self.chance(40) {
                        let sh = self.fresh_shade();
                        self.put(j, mk(CRYSTAL, 0, budget - 1, sh));
                        self.cells[i] = with_b(self.cells[i], budget - 1);
                        self.emit(R_CRYSTAL_GROW, x, y);
                    }
                    return;
                }
            }
        }
    }

    pub(crate) fn fog(&mut self, x: i32, y: i32, i: usize) {
        if self.temp_at(x, y) < 118 {
            for d in [4u8, 2, 6, 0] {
                if let Some(j) = self.nb(x, y, d) {
                    let t = sp(self.cells[j]);
                    if t == PLANT || t == FLOWER {
                        // Cold fog on a plant turns straight into frost.
                        self.keep(i);
                        if self.chance(6) {
                            let sh = self.fresh_shade();
                            self.put(i, mk(FROST, 0, 0, sh));
                            self.emit(R_FROST, x, y);
                            return;
                        }
                    }
                }
            }
        }
        self.gas(x, y, i, FOG);
    }

    pub(crate) fn pebble(&mut self, x: i32, y: i32, i: usize) {
        // A river rolls and grinds pebbles into sand.
        for d in [0u8, 2, 6] {
            if let Some(j) = self.nb(x, y, d) {
                if sp(self.cells[j]) == WATER && self.clock[j] == self.gen && self.chance(10) {
                    let sh = self.fresh_shade();
                    self.put(i, mk(SAND, 0, 0, sh));
                    self.emit(R_GRIND, x, y);
                    return;
                }
            }
        }
        if self.get(x, y + 1) == FOG {
            // Dry-ice fog is heavy: light pebbles ride on its cushion.
            self.keep(i);
            if !self.chance(14) {
                if self.aux[i] != 99 {
                    self.aux[i] = 99;
                    self.emit(R_HOVER, x, y);
                }
                return;
            }
        }
        self.powder(x, y, i, PEBBLE);
    }

    /* ── Islands ── */

    pub(crate) fn coconut(&mut self, x: i32, y: i32, i: usize) {
        let c = self.cells[i];
        let mut floated = cb(c) != 0;
        if !floated {
            for d in [2u8, 4, 6] {
                if let Some(j) = self.nb(x, y, d) {
                    let t = sp(self.cells[j]);
                    if t == WATER || t == SALTWATER {
                        floated = true;
                        self.cells[i] = with_b(c, 1);
                    }
                }
            }
        }
        if self.powder(x, y, i, COCONUT) {
            return;
        }
        if floated {
            let below = self.get(x, y + 1);
            if below == SAND || below == WETSAND || below == SOIL {
                // Washed up on a beach after its trip on the sea: the coconut sprouts a palm.
                self.keep(i);
                if self.chance(90) {
                    let sh = (self.fresh_shade() & 31) | (V_PALM << 5);
                    self.put(i, mk(PLANT, 40, TIP | (9 + (self.tick % 6) as u8), sh));
                    self.aux[i] = 1;
                    self.emit(R_PALM, x, y);
                }
            }
        }
    }

    /* ── Volcano ── */

    /// Lava: slow, glowing, warm honey. Left alone it cools into sparkly dark rock.
    pub(crate) fn lava(&mut self, x: i32, y: i32, i: usize) {
        self.keep(i);
        let c = self.cells[i];
        let a = ca(c);
        if a > 40 {
            self.warm(x, y, ELEMENTS[LAVA as usize].heat as i16, 196);
        }
        if self.params.medium == SEA {
            for d in [0u8, 2, 6, 4] {
                if let Some(j) = self.nb(x, y, d) {
                    if self.cells[j] == 0 && self.chance(3) {
                        // Under the sea, lava hardens at once: a warm chimney where life settles.
                        let sh = self.fresh_shade();
                        self.put(i, mk(BASALT, 0, 0, sh));
                        self.put(j, mk(BUBBLE, 0, 0, sh));
                        self.emit(R_NEW_ROCK, x, y);
                        let up = sp(self.cells[i - self.w.min(i)]);
                        if y > 1 && (up == EMPTY || (d == 0 && up == BUBBLE)) && self.chance(2) {
                            let k = i - self.w;
                            let r = self.rand();
                            self.put(k, mk(CORAL, 4 + (r % 4) as u8, ((r >> 8) % 5) as u8, (r >> 16) as u8));
                            self.aux[k] = 1;
                            self.emit(R_VENT, x, y - 1);
                        }
                        return;
                    }
                }
            }
        }
        if cb(c) == 0 && self.chance(7) {
            if a < 30 {
                let sh = self.fresh_shade();
                self.put(i, mk(BASALT, 0, 1, sh));
                self.emit(R_COOL_ROCK, x, y);
                return;
            }
            self.cells[i] = with_a(c, a - 1);
        }
        self.liquid(x, y, i, LAVA);
    }

    pub(crate) fn ash(&mut self, x: i32, y: i32, i: usize) {
        for d in [0u8, 4, 2, 6] {
            if let Some(j) = self.nb(x, y, d) {
                let o = self.cells[j];
                if sp(o) == CLOUD {
                    // Ash gives the droplets something to gather on: the cloud turns grey and heavy.
                    self.keep(i);
                    if self.chance(3) {
                        self.cells[j] = with_b(with_a(o, (ca(o) + 3).min(40)), cb(o) | 2);
                        self.wake(j);
                        self.kill(i);
                        return;
                    }
                }
            }
        }
        self.powder(x, y, i, ASH);
    }

    /// Hot rock: water that touches it is pushed out as a fountain, in bursts.
    pub(crate) fn geyser(&mut self, x: i32, y: i32, i: usize) {
        if !self.wet(self.get(x, y - 1)) || self.params.medium == SEA || y < 2 {
            return;
        }
        self.keep(i);
        if (self.tick / 48) % 3 != 0 || self.chance(2) {
            return;
        }
        // Find the top of the water above, and throw that drop high.
        let w = self.w;
        let mut top = y - 1;
        while top > 0 && self.wet(self.get(x, top - 1)) && y - top < 60 {
            top -= 1;
        }
        let height = 8 + (self.rand() % 22) as i32;
        let lean = (self.rand() % 5) as i32 - 2;
        let (tx, ty) = (x + lean, top - height);
        if ty < 1 || !self.inside(tx, ty) || self.cells[ty as usize * w + tx as usize] != 0 {
            return;
        }
        let from = top as usize * w + x as usize;
        let to = ty as usize * w + tx as usize;
        if self.chance(4) {
            self.kill(from);
            self.spawn(to, STEAM);
        } else {
            self.swap(from, to);
        }
        self.emit(R_GEYSER, x, top);
        if self.chance(6) {
            self.effect(FX_SPLASH, x, top, 0xbfe4ff);
        }
    }

    /* ── Undersea ── */

    fn in_water(&self, t: u8) -> bool {
        t == WATER || t == SALTWATER || (t == EMPTY && self.params.medium == SEA)
    }

    /// Coral: with light, its tips branch upwards, cell by cell.
    pub(crate) fn coral(&mut self, x: i32, y: i32, i: usize) {
        let c = self.cells[i];
        let budget = ca(c);
        if budget == 0 {
            return;
        }
        self.keep(i);
        // A fresh piece first sinks to the sea floor.
        if self.aux[i] == 0 {
            if let Some(j) = self.nb(x, y, DOWN) {
                if self.in_water(sp(self.cells[j])) || self.cells[j] == 0 {
                    if self.chance(2) {
                        self.swap(i, j);
                    }
                    return;
                }
            }
            self.aux[i] = 2;
        }
        if y == 0 || !self.chance(18) {
            return;
        }
        if self.aux[i] != 1 && !self.lit(x, y) {
            return;
        }
        let s = self.side();
        let options = if self.chance(3) { [(s, -1), (0, -1), (-s, -1)] } else { [(0, -1), (s, -1), (-s, -1)] };
        for (dx, dy) in options {
            let (nx, ny) = (x + dx, y + dy);
            if !self.inside(nx, ny) || !self.in_water(self.get(nx, ny)) {
                continue;
            }
            let j = ny as usize * self.w + nx as usize;
            let kind = self.aux[i];
            let sh = self.fresh_shade();
            self.put(j, mk(CORAL, budget - 1, cb(c), sh));
            self.aux[j] = kind;
            self.cells[i] = with_a(self.cells[i], 0);
            // Now and then a branch.
            if budget > 4 && self.chance(3) {
                let (bx, by) = (x + if dx == 0 { s } else { -dx }, y - 1);
                if self.inside(bx, by) && self.in_water(self.get(bx, by)) {
                    let bj = by as usize * self.w + bx as usize;
                    let sh = self.fresh_shade();
                    self.put(bj, mk(CORAL, budget / 2, cb(c), sh));
                    self.aux[bj] = kind;
                }
            }
            self.emit(R_CORAL_GROW, nx, ny);
            return;
        }
        self.cells[i] = with_a(self.cells[i], 0);
    }

    /// Kelp: grows straight up through the water; in the light its top makes bubbles of oxygen.
    pub(crate) fn kelp(&mut self, x: i32, y: i32, i: usize) {
        let c = self.cells[i];
        let (budget, top) = (ca(c), cb(c));
        if budget == 0 && top == 0 {
            return;
        }
        self.keep(i);
        if budget > 0 && self.aux[i] == 0 {
            // A fresh piece sinks and takes root.
            if let Some(j) = self.nb(x, y, DOWN) {
                let t = sp(self.cells[j]);
                if self.in_water(t) || t == EMPTY {
                    if self.chance(2) {
                        self.swap(i, j);
                    }
                    return;
                }
            }
            self.aux[i] = 1;
        }
        if top != 0 {
            if y > 0 && self.chance(240) && self.in_water(self.get(x, y - 1)) && self.lit(x, y) {
                let sh = self.fresh_shade();
                self.put(i - self.w, mk(BUBBLE, 0, 0, sh));
                self.emit(R_KELP_BUBBLES, x, y - 1);
            }
            return;
        }
        if !self.chance(9) {
            return;
        }
        if y > 1 && self.in_water(self.get(x, y - 1)) && budget > 1 {
            let j = i - self.w;
            let height = self.aux[i].saturating_add(1);
            let sh = self.fresh_shade();
            self.put(j, mk(KELP, budget - 1, 0, sh));
            self.aux[j] = height;
            self.cells[i] = with_a(self.cells[i], 0);
        } else {
            self.cells[i] = with_b(with_a(self.cells[i], 0), 1);
        }
    }

    /// Plankton: drifts in the water, and lights up blue when something stirs it.
    pub(crate) fn plankton(&mut self, x: i32, y: i32, i: usize) {
        let c = self.cells[i];
        let a = ca(c);
        let mut swimming = self.params.medium == SEA;
        let mut stirred = false;
        for d in [0u8, 2, 4, 6] {
            if let Some(j) = self.nb(x, y, d) {
                let o = self.cells[j];
                let t = sp(o);
                if t == WATER || t == SALTWATER {
                    swimming = true;
                } else if t != EMPTY && t != PLANKTON && self.clock[j] == self.gen {
                    stirred = true;
                }
            }
        }
        if !swimming {
            self.powder(x, y, i, PLANKTON);
            return;
        }
        self.keep(i);
        if stirred {
            if a < 90 {
                self.emit(R_GLOW, x, y);
            }
            self.cells[i] = with_a(c, 255);
        } else if a > 0 {
            self.cells[i] = with_a(c, a.saturating_sub(2));
        }
        if self.chance(7) {
            let d = (self.rand() & 7) as u8;
            if let Some(j) = self.nb(x, y, d) {
                let t = sp(self.cells[j]);
                // Its own drifting must not light the neighbours: move without a time stamp.
                if (t == EMPTY && self.params.medium == SEA) || t == WATER {
                    self.cells.swap(i, j);
                    self.aux.swap(i, j);
                    self.wake(j);
                }
            }
        }
    }

    /// The finger, the wind or a current stirs the plankton around a point.
    pub(crate) fn stir(&mut self, cx: i32, cy: i32, r: i32) {
        for y in (cy - r).max(0)..=(cy + r).min(self.h as i32 - 1) {
            for x in (cx - r).max(0)..=(cx + r).min(self.w as i32 - 1) {
                let i = y as usize * self.w + x as usize;
                let c = self.cells[i];
                if sp(c) == PLANKTON {
                    if ca(c) < 90 {
                        self.emit(R_GLOW, x, y);
                    }
                    self.cells[i] = with_a(c, 255);
                    self.wake(i);
                }
            }
        }
    }

    /// Ink: in a glass of water it tints it; in the sea it hangs as a coloured cloud that warm water carries up.
    pub(crate) fn ink(&mut self, x: i32, y: i32, i: usize) {
        if self.params.medium != SEA {
            self.liquid(x, y, i, INK);
            return;
        }
        self.keep(i);
        if self.temp_at(x, y) > (self.ambient >> 5) + 14 {
            if self.chance(2) {
                if let Some(j) = self.nb(x, y, 0) {
                    if self.cells[j] == 0 {
                        self.swap(i, j);
                        if self.chance(6) {
                            self.emit(R_CONVECTION, x, y - 1);
                        }
                    }
                }
            }
            return;
        }
        if self.chance(5) {
            let r = self.rand() % 12;
            let d = if r < 8 { r as u8 } else { DOWN };
            if let Some(j) = self.nb(x, y, d) {
                if self.cells[j] == 0 {
                    self.swap(i, j);
                }
            }
        }
    }

    /* ── Space ── */

    pub(crate) fn stardust(&mut self, x: i32, y: i32, i: usize) {
        if !self.params.radial {
            self.powder(x, y, i, STARDUST);
            return;
        }
        let d = self.gdir[i];
        let v = self.aux[i];
        if d != NOG && (1..=8).contains(&v) {
            let gd = self.gdist[i];
            let diff = (v - 1 + 8 - d) & 7;
            if (8..=44).contains(&gd) && (diff == 2 || diff == 6) {
                // Thrown sideways fast enough, the dust never lands: it keeps falling around. An orbit!
                let sh = shade(self.cells[i]);
                self.put(i, mk(RING, gd, (diff == 2) as u8, sh));
                self.emit(R_ORBIT, x, y);
                return;
            }
            self.aux[i] = 0;
        }
        if self.powder(x, y, i, STARDUST) || d == NOG {
            return;
        }
        if cb(self.cells[i]) == 0 {
            for dd in 0..8u8 {
                if let Some(j) = self.nb(x, y, dd) {
                    let o = self.cells[j];
                    let t = sp(o);
                    if t == GRAVITY || t == STONE || (t == STARDUST && cb(o) == 1) {
                        // Gravity gathers the dust: a little world is growing.
                        self.cells[i] = with_b(self.cells[i], 1);
                        self.wake(i);
                        self.emit(R_PLANET, x, y);
                        return;
                    }
                }
            }
        }
    }

    /// Orbiting dust: it circles its planet at the distance where it was caught.
    pub(crate) fn ring(&mut self, x: i32, y: i32, i: usize) {
        self.keep(i);
        if !self.params.radial {
            self.powder(x, y, i, RING);
            return;
        }
        if self.tick & 1 == 0 {
            return;
        }
        let d = self.gdir[i];
        if d == NOG {
            return;
        }
        let c = self.cells[i];
        let (want, cw) = (ca(c), cb(c) != 0);
        let gd = self.gdist[i];
        let turn = if gd > want.saturating_add(1) {
            1
        } else if gd + 1 < want {
            3
        } else {
            2
        };
        let dirs = if cw { [(d + turn) & 7, (d + 2) & 7] } else { [(d + 8 - turn) & 7, (d + 6) & 7] };
        for dir in dirs {
            if let Some(j) = self.nb(x, y, dir) {
                if self.cells[j] == 0 {
                    self.swap(i, j);
                    return;
                }
            }
        }
    }

    /// Nebula gas: gravity gathers it; squeezed tightly enough, it lights up as a star.
    pub(crate) fn nebula(&mut self, x: i32, y: i32, i: usize) {
        self.keep(i);
        let mut near = 0;
        for d in 0..8u8 {
            if let Some(j) = self.nb(x, y, d) {
                if sp(self.cells[j]) == GAS {
                    near += 1;
                }
            }
        }
        if near >= 7 && self.chance(50) {
            let sh = self.fresh_shade();
            self.put(i, mk(STAR, 0, 0, sh));
            for d in 0..8u8 {
                if let Some(j) = self.nb(x, y, d) {
                    if d & 1 == 0 {
                        self.put(j, mk(STAR, 0, 0, sh));
                    } else {
                        self.kill(j);
                    }
                }
            }
            self.emit(R_STAR, x, y);
            self.effect(FX_STAR, x, y, 0xfff0a0);
            return;
        }
        let g = self.gravity_at(i);
        if g != NOG && g != DOWN || (self.params.radial && g == DOWN) {
            if self.chance(3) {
                let k = [0u8, 1, 7][(self.rand() % 3) as usize];
                if let Some(j) = self.nb(x, y, (g + k) & 7) {
                    if self.cells[j] == 0 {
                        self.swap(i, j);
                    }
                }
            }
            return;
        }
        if self.chance(8) {
            let d = (self.rand() & 7) as u8;
            if let Some(j) = self.nb(x, y, d) {
                if self.cells[j] == 0 {
                    self.swap(i, j);
                }
            }
        }
    }

    pub(crate) fn star(&mut self, x: i32, y: i32, i: usize) {
        self.keep(i);
        self.warm(x, y, ELEMENTS[STAR as usize].heat as i16, 250);
        if self.stars_next.len() < 8 && !self.stars_next.iter().any(|&(sx, sy)| (sx - x).abs() < 6 && (sy - y).abs() < 6) {
            self.stars_next.push((x, y));
        }
    }

    /// Comet: a ball of ice flying straight on; near a star, its tail streams away from the light.
    pub(crate) fn comet(&mut self, x: i32, y: i32, i: usize) {
        self.keep(i);
        if !self.params.radial {
            self.powder(x, y, i, COMET);
            return;
        }
        let mut v = self.aux[i];
        if !(1..=8).contains(&v) {
            v = 3;
            self.aux[i] = v;
        }
        let mut tail = 0u32;
        for k in 0..self.stars.len() {
            let (sx, sy) = self.stars[k];
            let (dx, dy) = (x - sx, y - sy);
            if dx * dx + dy * dy < 90 * 90 {
                tail = 1 + octant(dx, dy) as u32;
                if self.chance(10) {
                    self.emit(R_COMET_TAIL, x, y);
                }
                break;
            }
        }
        if self.tick & 3 == 0 {
            self.effect(FX_TRAIL, x, y, if tail != 0 { tail } else { 1 + ((v - 1 + 4) & 7) as u32 });
        }
        let dir = v - 1;
        let (mut nx, ny) = (x + DX[dir as usize], y + DY[dir as usize]);
        // Space has no walls: a comet that leaves on one side comes back on the other.
        if nx < 0 {
            nx = self.w as i32 - 1;
        } else if nx >= self.w as i32 {
            nx = 0;
        }
        if ny < 0 || ny >= self.h as i32 {
            self.aux[i] = 1 + ((12 - dir) & 7);
            return;
        }
        let j = ny as usize * self.w + nx as usize;
        let o = self.cells[j];
        if o == 0 {
            self.swap(i, j);
            return;
        }
        let t = sp(o);
        if t == COMET {
            return;
        }
        let sh = shade(self.cells[i]);
        if (t == STARDUST && cb(o) == 1) || t == STONE || t == GRAVITY {
            // A soft bump on a young planet throws a little rock into orbit: a moon is born.
            let gd = self.gdist[i].min(200);
            self.put(i, mk(RING, gd + 5, (self.tick & 1) as u8, sh));
            self.emit(R_MOON_BIRTH, x, y);
            self.effect(FX_STAR, x, y, 0xffffff);
        } else {
            self.put(i, mk(ICE, 0, 0, sh));
            self.aux[i] = 0;
        }
    }

    /* ── Moon and Mars ── */

    /// A space pebble: where it lands on dust, it digs a crater that stays.
    pub(crate) fn meteorite(&mut self, x: i32, y: i32, i: usize) {
        let fall = self.aux[i];
        if self.powder(x, y, i, METEORITE) || self.params.radial {
            return;
        }
        if !(4..=200).contains(&fall) {
            return;
        }
        let dust = |t: u8| matches!(t, MOONDUST | SAND | REDDUST | SOIL | SNOW | ASH);
        if !dust(self.get(x, y + 1)) {
            return;
        }
        self.aux[i] = 0;
        let w = self.w;
        for dx in -3..=3i32 {
            let depth = 3 - dx.abs().max(1) + 1;
            for k in 0..depth {
                let (sx, sy) = (x + dx, y + 1 + k);
                if !self.inside(sx, sy) || !dust(self.get(sx, sy)) {
                    continue;
                }
                let from = sy as usize * w + sx as usize;
                if self.cells[from] & FIXED != 0 {
                    continue;
                }
                // The dust is pushed out to the rim.
                let side = if dx < 0 || (dx == 0 && k & 1 == 0) { -1 } else { 1 };
                let rx = x + side * (4 + (k + dx.abs()) % 3);
                if !self.inside(rx, y) {
                    continue;
                }
                let mut ry = y + 1;
                while ry > 0 && self.get(rx, ry) != EMPTY {
                    ry -= 1;
                }
                if self.get(rx, ry) != EMPTY || y + 1 - ry > 8 {
                    continue;
                }
                let to = ry as usize * w + rx as usize;
                self.swap(from, to);
                self.aux[to] = 0;
            }
        }
        self.emit(R_CRATER, x, y);
        self.effect(FX_PUFF, x, y, 0xd0d4e0);
    }

    /* ── Building blocks ── */

    /// A pipe: it swallows the liquid that touches it and carries it, cell by cell, to its other end.
    pub(crate) fn pipe(&mut self, x: i32, y: i32, i: usize) {
        let c = self.cells[i];
        let load = ca(c);
        if load == 0 {
            let start = self.rand() & 3;
            for k in 0..4u32 {
                let d = (((start + k) & 3) * 2) as u8;
                if d == DOWN {
                    continue; // a pipe drinks from above and from the sides, and pours out below
                }
                if let Some(j) = self.nb(x, y, d) {
                    let o = self.cells[j];
                    let t = sp(o);
                    if self.phase[t as usize] == P_LIQUID && t != LAVA {
                        self.keep(i);
                        if self.chance(2) {
                            self.cells[i] = with_b(with_a(c, t), d + 1);
                            self.aux[i] = ca(o);
                            self.kill(j);
                        }
                        return;
                    }
                }
            }
            return;
        }
        self.keep(i);
        let from = cb(c).wrapping_sub(1);
        let hue = self.aux[i];
        let start = self.rand() & 3;
        // First along the pipe…
        for k in 0..4u32 {
            let d = (((start + k) & 3) * 2) as u8;
            if d == from {
                continue;
            }
            if let Some(j) = self.nb(x, y, d) {
                let o = self.cells[j];
                if sp(o) == PIPE && ca(o) == 0 {
                    self.cells[j] = with_b(with_a(o, load), (d ^ 4) + 1);
                    self.aux[j] = hue;
                    self.clock[j] = self.gen;
                    self.wake(j);
                    self.cells[i] = with_b(with_a(c, 0), 0);
                    return;
                }
            }
        }
        // …then out of its end, downwards if it can.
        for d in [DOWN, 2, 6, 0] {
            if d == from {
                continue;
            }
            if let Some(j) = self.nb(x, y, d) {
                if self.cells[j] == 0 {
                    self.spawn(j, load);
                    if load == INK || load == DYED {
                        self.cells[j] = with_a(self.cells[j], hue);
                    }
                    self.cells[i] = with_b(with_a(c, 0), 0);
                    return;
                }
            }
        }
    }
}
