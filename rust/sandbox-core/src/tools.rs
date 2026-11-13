//! What the child's finger does: brushes, the wind, and the save bytes of a creation.

use crate::gen::*;
use crate::sim::*;
use crate::table::*;

impl World {
    /// Paints a disc of `t` (EMPTY erases). Elements only fill empty cells, or
    /// take the place of a liquid or a gas, so a child never destroys what they
    /// built by drawing over it; loose elements are sprinkled rather than
    /// packed, so they pour like the real thing.
    pub fn paint(&mut self, cx: f32, cy: f32, r: f32, t: u8, variant: u8) {
        if !cx.is_finite() || !cy.is_finite() || !r.is_finite() || t as usize >= ELEMENT_COUNT {
            return;
        }
        let r = r.clamp(0.3, 16.0);
        let (cx, cy) = (cx.clamp(-64.0, 400.0), cy.clamp(-64.0, 400.0));
        let sea = self.params.medium == SEA;
        if sea && matches!(t, WATER | SALTWATER | DYED | STEAM) {
            return;
        }
        let pct = ELEMENTS[t as usize].paint as u32;
        let r2 = r * r + r * 0.8;
        let y0 = ((cy - r).floor() as i32).max(0);
        let y1 = ((cy + r).ceil() as i32).min(self.h as i32 - 1);
        let x0 = ((cx - r).floor() as i32).max(0);
        let x1 = ((cx + r).ceil() as i32).min(self.w as i32 - 1);
        for y in y0..=y1 {
            for x in x0..=x1 {
                let (dx, dy) = (x as f32 - cx, y as f32 - cy);
                if dx * dx + dy * dy > r2 {
                    continue;
                }
                let i = y as usize * self.w + x as usize;
                let cur = sp(self.cells[i]);
                if t == EMPTY {
                    if cur != EMPTY {
                        self.spawn(i, EMPTY);
                    }
                    continue;
                }
                if cur == t {
                    continue;
                }
                let fluid = cur != EMPTY && cur != CLOUD && cur != LAVA && self.phase[cur as usize] != P_BLOCK;
                let ok = if cur == EMPTY {
                    pct >= 100 || self.rand() % 100 < pct
                } else if fluid {
                    // Into water: seeds, ice, a wall… take the place of the water.
                    pct >= 100 || self.rand() % 100 < pct * 6 / 10
                } else {
                    false
                };
                if !ok {
                    continue;
                }
                self.spawn(i, t);
                match t {
                    INK => self.cells[i] = with_a(self.cells[i], variant % 5),
                    CLOUD if variant != 0 => self.cells[i] = with_a(self.cells[i], 14),
                    COMET => self.aux[i] = if (1..=8).contains(&variant) { variant } else { 3 },
                    _ => {}
                }
            }
        }
        if sea {
            self.stir(cx as i32, cy as i32, r as i32 + 3);
        }
    }

    /// Paints along a segment, so a fast finger leaves no gaps.
    #[allow(clippy::too_many_arguments)]
    pub fn paint_line(&mut self, x0: f32, y0: f32, x1: f32, y1: f32, r: f32, t: u8, variant: u8) {
        if !(x0.is_finite() && y0.is_finite() && x1.is_finite() && y1.is_finite() && r.is_finite()) {
            return;
        }
        let (x0, y0, x1, y1) = (x0.clamp(-64.0, 400.0), y0.clamp(-64.0, 400.0), x1.clamp(-64.0, 400.0), y1.clamp(-64.0, 400.0));
        let (dx, dy) = (x1 - x0, y1 - y0);
        let dist = (dx * dx + dy * dy).sqrt();
        let steps = ((dist / (r * 0.75).max(1.0)).ceil() as i32).clamp(1, 600);
        for s in 0..=steps {
            let f = s as f32 / steps as f32;
            self.paint(x0 + dx * f, y0 + dy * f, r, t, variant);
        }
    }

    /// The wind (and the sea current): loose things in the disc are blown one cell towards `dir`.
    pub fn wind(&mut self, cx: f32, cy: f32, r: f32, dir: i32) {
        if !cx.is_finite() || !cy.is_finite() || !r.is_finite() {
            return;
        }
        let dir = if dir < 0 { -1 } else { 1 };
        let r = r.clamp(0.5, 18.0);
        let (cx, cy) = (cx.clamp(-64.0, 400.0), cy.clamp(-64.0, 400.0));
        let r2 = r * r + r;
        let x0 = ((cx - r).floor() as i32).max(0);
        let x1 = ((cx + r).ceil() as i32).min(self.w as i32 - 1);
        let y0 = ((cy - r).floor() as i32).max(0);
        let y1 = ((cy + r).ceil() as i32).min(self.h as i32 - 1);
        let w = self.w;
        let space = self.params.radial;
        for y in y0..=y1 {
            // Walk against the wind so a grain is only pushed once.
            for k in 0..=(x1 - x0).max(0) {
                let x = if dir > 0 { x1 - k } else { x0 + k };
                let (dx, dy) = (x as f32 - cx, y as f32 - cy);
                if dx * dx + dy * dy > r2 {
                    continue;
                }
                let i = y as usize * w + x as usize;
                let c = self.cells[i];
                let t = sp(c);
                if t == EMPTY {
                    continue;
                }
                if t == FLOWER && cb(c) == CENTER && ca(c) != 10 && self.chance(12) {
                    // The wind shakes the pollen out of the flower.
                    for (px, py) in [(x + dir, y - 1), (x, y - 2), (x + dir * 2, y)] {
                        if self.get(px, py) == EMPTY && self.inside(px, py) {
                            self.spawn(py as usize * w + px as usize, POLLEN);
                            break;
                        }
                    }
                    continue;
                }
                if t == SHELL && self.chance(30) {
                    // Waves roll and wear shells down into pale sand.
                    self.spawn(i, SAND);
                    self.emit(R_SHELL_SAND, x, y);
                    continue;
                }
                if ELEMENTS[t as usize].flags & F_LOOSE == 0 || c & FIXED != 0 || self.chance(3) {
                    continue;
                }
                let nx = x + dir;
                if nx < 0 || nx >= w as i32 {
                    continue;
                }
                let kind = ELEMENTS[t as usize].kind;
                let grain = kind == K_POWDER || t == SNOW || t == STARDUST;
                let surface = self.get(x, y - 1) == EMPTY;
                let wave = self.phase[t as usize] == P_LIQUID && surface;
                let lift = if y > 0 && ((grain && self.chance(if t == REDDUST { 2 } else { 3 })) || (wave && self.chance(3))) { -1 } else { 0 };
                let j = (y + lift) as usize * w + nx as usize;
                if self.cells[j] != 0 {
                    continue;
                }
                self.swap(i, j);
                if space {
                    self.aux[j] = if dir > 0 { 3 } else { 7 };
                }
                match t {
                    SAND | MOONDUST | SOIL | SALT | ASH => self.emit(R_WIND, nx, y + lift),
                    SNOW => self.emit(R_DRIFT, nx, y + lift),
                    REDDUST => {
                        self.emit(R_DUST_DEVIL, nx, y + lift);
                        if self.chance(5) {
                            self.effect(FX_SWIRL, nx, y, 0xe08a50);
                        }
                    }
                    WATER | SALTWATER | DYED if wave && lift != 0 => self.emit(R_WAVES, nx, y + lift),
                    _ => {}
                }
            }
        }
        self.stir(cx as i32, cy as i32, r as i32 + 2);
    }

    /* ── Save and restore a creation ── */

    /// Serialises the world into `out` (cleared first). Layout: header, critters, five packed byte planes, checksum.
    pub fn save(&self, out: &mut Vec<u8>) {
        out.clear();
        out.extend_from_slice(b"ZSB2");
        out.push(1);
        out.push(self.world);
        out.extend_from_slice(&(self.w as u16).to_le_bytes());
        out.extend_from_slice(&(self.h as u16).to_le_bytes());
        out.extend_from_slice(&self.tick.to_le_bytes());
        out.extend_from_slice(&self.rng.to_le_bytes());
        out.extend_from_slice(&self.crng.to_le_bytes());
        out.push(self.night as u8);
        out.push(self.temp_offset as u8);
        out.push(self.gravity_pct);
        out.push(self.critters.len() as u8);
        for c in &self.critters {
            out.push(c.kind);
            out.extend_from_slice(&c.x.to_le_bytes());
            out.extend_from_slice(&c.y.to_le_bytes());
            out.push(c.count);
            out.push(c.hat);
        }
        for plane in 0..5 {
            let bytes: Vec<u8> = match plane {
                4 => self.aux.clone(),
                p => self.cells.iter().map(|&c| (c >> (8 * p)) as u8).collect(),
            };
            let start = out.len();
            out.extend_from_slice(&[0; 4]);
            pack(&bytes, out);
            let len = (out.len() - start - 4) as u32;
            out[start..start + 4].copy_from_slice(&len.to_le_bytes());
        }
        let sum = fnv(out);
        out.extend_from_slice(&sum.to_le_bytes());
    }

    /// Restores a world saved by `save`. Anything that is not a valid save of
    /// this very world (same world, same size) is refused and changes nothing.
    pub fn load(&mut self, data: &[u8]) -> bool {
        let n = self.w * self.h;
        if data.len() < 30 || &data[0..4] != b"ZSB2" || data[4] != 1 {
            return false;
        }
        let (body, tail) = data.split_at(data.len() - 4);
        if fnv(body) != u32::from_le_bytes([tail[0], tail[1], tail[2], tail[3]]) {
            return false;
        }
        let mut r = Reader { data: body, at: 5 };
        let (Some(world), Some(w), Some(h)) = (r.u8(), r.u16(), r.u16()) else { return false };
        if world != self.world || w as usize != self.w || h as usize != self.h {
            return false;
        }
        let (Some(tick), Some(rng), Some(crng), Some(night), Some(toff), Some(grav), Some(nc)) = (r.u32(), r.u32(), r.u32(), r.u8(), r.u8(), r.u8(), r.u8())
        else {
            return false;
        };
        let mut critters = Vec::with_capacity(crate::critters::MAX_CRITTERS);
        for _ in 0..nc {
            let (Some(kind), Some(x), Some(y), Some(count), Some(hat)) = (r.u8(), r.u32(), r.u32(), r.u8(), r.u8()) else { return false };
            if critters.len() < crate::critters::MAX_CRITTERS {
                let mut c = crate::critters::Critter::new(kind % WORLD_COUNT, 0, 0);
                c.x = (x as i32).clamp(0, (self.w as i32 - 1) * 16);
                c.y = (y as i32).clamp(0, (self.h as i32 - 1) * 16);
                c.count = count;
                c.hat = if (hat as usize) < ELEMENT_COUNT { hat } else { 0 };
                critters.push(c);
            }
        }
        let mut planes: Vec<Vec<u8>> = Vec::with_capacity(5);
        for _ in 0..5 {
            let Some(len) = r.u32() else { return false };
            let Some(chunk) = r.bytes(len as usize) else { return false };
            let Some(bytes) = unpack(chunk, n) else { return false };
            planes.push(bytes);
        }
        self.clear();
        for i in 0..n {
            let s = planes[0][i];
            if (s & 0x3f) as usize >= ELEMENT_COUNT || s & 0x3f == 0 {
                continue;
            }
            self.cells[i] = (s & 0x7f) as u32 | (planes[1][i] as u32) << 8 | (planes[2][i] as u32) << 16 | (planes[3][i] as u32) << 24;
            self.aux[i] = planes[4][i];
        }
        self.tick = tick;
        self.rng = if rng == 0 { 0x9e37_79b9 } else { rng };
        self.crng = crng | 1;
        self.critters = critters;
        self.set_night(night != 0);
        self.set_gravity(grav as u32);
        self.set_temp_offset(toff as i8 as i32);
        self.events.clear();
        self.fx.clear();
        self.clock.fill(0);
        self.gen = 1;
        self.grav_dirty = self.params.radial;
        if self.params.radial {
            self.rebuild_gravity();
        }
        self.wake_all();
        true
    }
}

struct Reader<'a> {
    data: &'a [u8],
    at: usize,
}

impl<'a> Reader<'a> {
    fn bytes(&mut self, n: usize) -> Option<&'a [u8]> {
        let end = self.at.checked_add(n)?;
        let s = self.data.get(self.at..end)?;
        self.at = end;
        Some(s)
    }
    fn u8(&mut self) -> Option<u8> {
        self.bytes(1).map(|b| b[0])
    }
    fn u16(&mut self) -> Option<u16> {
        self.bytes(2).map(|b| u16::from_le_bytes([b[0], b[1]]))
    }
    fn u32(&mut self) -> Option<u32> {
        self.bytes(4).map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
    }
}

fn fnv(data: &[u8]) -> u32 {
    let mut h: u32 = 2_166_136_261;
    for &b in data {
        h ^= b as u32;
        h = h.wrapping_mul(16_777_619);
    }
    h
}

/// PackBits: a control byte below 128 announces that many + 1 literal bytes; 128 and above repeats the next byte (control - 126) times.
fn pack(src: &[u8], out: &mut Vec<u8>) {
    let mut i = 0;
    while i < src.len() {
        let mut run = 1;
        while i + run < src.len() && src[i + run] == src[i] && run < 129 {
            run += 1;
        }
        if run >= 2 {
            out.push((run + 126) as u8);
            out.push(src[i]);
            i += run;
            continue;
        }
        let start = i;
        i += 1;
        while i < src.len() && i - start < 128 && !(i + 1 < src.len() && src[i + 1] == src[i]) {
            i += 1;
        }
        out.push((i - start - 1) as u8);
        out.extend_from_slice(&src[start..i]);
    }
}

fn unpack(src: &[u8], n: usize) -> Option<Vec<u8>> {
    let mut out = Vec::with_capacity(n);
    let mut i = 0;
    while i < src.len() {
        let c = src[i] as usize;
        i += 1;
        if c < 128 {
            let lit = src.get(i..i + c + 1)?;
            if out.len() + lit.len() > n {
                return None;
            }
            out.extend_from_slice(lit);
            i += c + 1;
        } else {
            let v = *src.get(i)?;
            i += 1;
            let run = c - 126;
            if out.len() + run > n {
                return None;
            }
            out.resize(out.len() + run, v);
        }
    }
    if out.len() == n {
        Some(out)
    } else {
        None
    }
}
