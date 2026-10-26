/**
 * Le Bac à sable magique — the simulation core.
 *
 * A "falling sand" cellular automaton on a small grid (typically 200×120
 * cells): every cell holds one element, and each step every cell looks at its
 * neighbours and moves or reacts. Pure TypeScript with typed arrays and a
 * seeded random generator: no DOM, so it runs (and is tested) in Node, and the
 * same seed + the same gestures always give the same world.
 *
 * Reactions a child can discover are reported as `events` after each step
 * (seed + water → plant, heat + ice → water, steam at the top → cloud…).
 */

/* ── Elements ─────────────────────────────────────────────────────────── */

export const EMPTY = 0;
export const SAND = 1;
export const WATER = 2;
export const STONE = 3;
export const SEED = 4;
export const PLANT = 5;
export const FLOWER = 6;
export const ICE = 7;
export const HEAT = 8;
export const STEAM = 9;
export const SNOW = 10;
export const CLOUD = 11;
export const BUBBLE = 12;
export const ELEMENT_COUNT = 13;

/** Plant flags stored in `b`: the growing tip carries the growth budget in its low 6 bits. */
export const TIP = 0x80;
export const LEAF = 0x40;
const BUDGET = 0x3f;

/** Flower part stored in `b`. */
export const PETAL = 0;
export const CENTER = 1;

/* ── Reactions (the discoveries) ──────────────────────────────────────── */

export const REACTIONS = ['sprout', 'melt_ice', 'melt_snow', 'evaporate', 'condense', 'rain', 'bloom', 'sink', 'bubble', 'wind'] as const;
export type Reaction = (typeof REACTIONS)[number];
const REACTION_INDEX = Object.fromEntries(REACTIONS.map((r, i) => [r, i])) as Record<Reaction, number>;

export interface SimEvent {
  kind: Reaction;
  x: number;
  y: number;
}

/** How full a brush stroke is for each element (pouring sand looks grainy, a wall is solid). */
const DENSITY: Record<number, number> = {
  [SAND]: 0.5,
  [WATER]: 0.55,
  [SEED]: 0.05,
  [SNOW]: 0.3,
  [CLOUD]: 0.75,
  [BUBBLE]: 0.18,
  [STEAM]: 0.45,
};

const isGas = (t: number) => t === STEAM || t === CLOUD || t === BUBBLE;
/** What blocks the light from the sky for a plant. Water, ice, leaves and clouds let it through. */
const isOpaque = (t: number) => t === SAND || t === STONE || t === SEED || t === SNOW;
/** What the wind can push. */
const isLoose = (t: number) => t === SAND || t === SEED || t === SNOW || t === WATER || t === STEAM || t === CLOUD || t === BUBBLE;

export class Sandbox {
  readonly w: number;
  readonly h: number;
  /** Element of each cell. */
  readonly type: Uint8Array;
  /** Per-element state: water held by a plant, age of steam/bubbles, rain left in a cloud, flower colour. */
  readonly a: Uint8Array;
  /** Per-element flags: plant tip/leaf + growth budget, flower part. */
  readonly b: Uint8Array;
  /** Height above the root for plants and flowers (used to sway them when drawn). */
  readonly c: Uint8Array;
  /** Random colour variation, fixed when the cell is born. */
  readonly shade: Uint8Array;
  /** Generation stamp: a cell already moved this step is not moved again. */
  private readonly clock: Uint8Array;
  private gen = 1;
  private rng: number;
  tick = 0;
  /** Every reaction that ever happened in this sandbox, by kind. */
  readonly counts: Record<Reaction, number>;
  /** Reactions of the last step (at most one event per kind per step). */
  events: SimEvent[] = [];
  private readonly fired = new Uint8Array(REACTIONS.length);

  constructor(w: number, h: number, seed = 1) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.type = new Uint8Array(n);
    this.a = new Uint8Array(n);
    this.b = new Uint8Array(n);
    this.c = new Uint8Array(n);
    this.shade = new Uint8Array(n);
    this.clock = new Uint8Array(n);
    this.rng = seed >>> 0 || 0x9e3779b9;
    this.counts = Object.fromEntries(REACTIONS.map((r) => [r, 0])) as Record<Reaction, number>;
  }

  /* ── Random numbers (xorshift32: tiny, fast and reproducible) ── */

  /** A random 32-bit unsigned integer. */
  rand(): number {
    let x = this.rng;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.rng = x >>> 0;
    return this.rng;
  }

  /** True once in `n` times. */
  chance(n: number): boolean {
    return this.rand() % n === 0;
  }

  /** A random float in [0, 1). */
  random(): number {
    return this.rand() / 4294967296;
  }

  /* ── Cells ── */

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): number {
    return this.inside(x, y) ? this.type[y * this.w + x] : STONE;
  }

  /** Puts a fresh element in a cell, with its colour variation and starting state. */
  set(x: number, y: number, t: number): void {
    if (!this.inside(x, y)) return;
    this.spawn(y * this.w + x, t);
  }

  private spawn(i: number, t: number): void {
    this.type[i] = t;
    this.shade[i] = this.rand() & 255;
    this.b[i] = 0;
    this.c[i] = 0;
    this.a[i] = t === CLOUD ? 5 + (this.rand() % 6) : t === FLOWER ? this.rand() % 5 : 0;
    this.clock[i] = this.gen;
  }

  /** Empties the whole sandbox (the discoveries counters are kept). */
  clear(): void {
    this.type.fill(0);
    this.a.fill(0);
    this.b.fill(0);
    this.c.fill(0);
  }

  /**
   * Runs the world for a while without reporting anything: a freshly built
   * scene settles (sand slides, water finds its level) before the child plays.
   */
  settle(steps: number): void {
    const saved = { ...this.counts };
    for (let s = 0; s < steps; s++) this.step();
    Object.assign(this.counts, saved);
    this.events = [];
  }

  /** Number of cells holding this element. */
  count(t: number): number {
    let n = 0;
    for (let i = 0; i < this.type.length; i++) if (this.type[i] === t) n++;
    return n;
  }

  /** A short fingerprint of the whole world, for determinism checks. */
  hash(): number {
    let h = 2166136261;
    for (let i = 0; i < this.type.length; i++) {
      h ^= this.type[i] | (this.a[i] << 8) | (this.b[i] << 16);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* ── Brushes ── */

  /**
   * Paints a disc of `t` (EMPTY erases). Elements only fill empty cells (or
   * go into water and steam), so a child never destroys what they built by
   * drawing over it; loose elements are sprinkled rather than packed, so they
   * pour like the real thing.
   */
  paint(cx: number, cy: number, r: number, t: number): void {
    const density = DENSITY[t] ?? 1;
    const r2 = r * r + r * 0.8;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(this.h - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(this.w - 1, Math.ceil(cx + r)); x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
        const i = y * this.w + x;
        if (t === EMPTY) {
          this.type[i] = EMPTY;
          this.a[i] = this.b[i] = this.c[i] = 0;
        } else if (t !== WATER && (this.type[i] === WATER || this.type[i] === STEAM) && this.random() < Math.min(1, density * 0.6)) {
          // Into water: seeds, ice, bubbles, a sun lamp… take the place of the water.
          this.spawn(i, t);
        } else if (this.type[i] === EMPTY && (density >= 1 || this.random() < density)) {
          this.spawn(i, t);
        }
      }
    }
  }

  /** Paints along a segment, so a fast finger leaves no gaps. */
  paintLine(x0: number, y0: number, x1: number, y1: number, r: number, t: number): void {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / Math.max(1, r * 0.75)));
    for (let s = 0; s <= steps; s++) this.paint(x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps, r, t);
  }

  /** The wind tool: loose elements in the disc are blown one cell towards `dir` (sand is lifted a little). */
  wind(cx: number, cy: number, r: number, dir: -1 | 1): void {
    const r2 = r * r + r;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + r));
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(this.h - 1, Math.ceil(cy + r)); y++) {
      // Walk against the wind so a grain is only pushed once.
      for (let k = 0; k <= x1 - x0; k++) {
        const x = dir > 0 ? x1 - k : x0 + k;
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
        const i = y * this.w + x;
        const t = this.type[i];
        if (!isLoose(t) || this.chance(3)) continue;
        const nx = x + dir;
        if (nx < 0 || nx >= this.w) continue;
        const lift = (t === SAND || t === SNOW || t === SEED) && y > 0 && this.chance(3) ? -1 : 0;
        const j = (y + lift) * this.w + nx;
        if (this.type[j] !== EMPTY) continue;
        this.swap(i, j);
        if (t === SAND || t === SNOW) this.emit('wind', nx, y + lift);
      }
    }
  }

  /* ── The step ── */

  /** Advances the world by one tick. */
  step(): void {
    this.events = [];
    this.fired.fill(0);
    this.tick++;
    this.gen = this.gen === 255 ? 1 : this.gen + 1;
    if (this.gen === 1) this.clock.fill(0);
    const { w, h, type, clock } = this;
    for (let y = h - 1; y >= 0; y--) {
      const ltr = (this.rand() & 1) === 0;
      for (let k = 0; k < w; k++) {
        const x = ltr ? k : w - 1 - k;
        const i = y * w + x;
        const t = type[i];
        if (t === EMPTY || t === STONE || t === ICE || t === FLOWER || clock[i] === this.gen) continue;
        switch (t) {
          case SAND:
            this.fall(x, y, i, 2, true);
            break;
          case SEED:
            if (!this.sprout(x, y, i)) this.fall(x, y, i, 4, false);
            break;
          case SNOW:
            this.snow(x, y, i);
            break;
          case WATER:
            this.water(x, y, i);
            break;
          case STEAM:
            this.steam(x, y, i);
            break;
          case CLOUD:
            this.cloud(x, y, i);
            break;
          case BUBBLE:
            this.bubble(x, y, i);
            break;
          case HEAT:
            this.heat(x, y);
            break;
          case PLANT:
            this.plant(x, y, i);
            break;
        }
      }
    }
  }

  private emit(kind: Reaction, x: number, y: number): void {
    const k = REACTION_INDEX[kind];
    this.counts[kind]++;
    if (this.fired[k]) return;
    this.fired[k] = 1;
    this.events.push({ kind, x, y });
  }

  private swap(i: number, j: number): void {
    const { type, a, b, c, shade, clock } = this;
    const t = type[i];
    type[i] = type[j];
    type[j] = t;
    let v = a[i];
    a[i] = a[j];
    a[j] = v;
    v = b[i];
    b[i] = b[j];
    b[j] = v;
    v = c[i];
    c[i] = c[j];
    c[j] = v;
    v = shade[i];
    shade[i] = shade[j];
    shade[j] = v;
    clock[i] = clock[j] = this.gen;
  }

  /** Sand and seeds: fall, slide down slopes, and sink through water (once in `sinkEvery` ticks). */
  private fall(x: number, y: number, i: number, sinkEvery: number, isSand: boolean): void {
    if (y >= this.h - 1) return;
    const { w, type } = this;
    const j = i + w;
    const tb = type[j];
    if (tb === EMPTY || isGas(tb)) return this.swap(i, j);
    if (tb === WATER) {
      if (this.chance(sinkEvery)) {
        this.swap(i, j);
        if (isSand) this.emit('sink', x, y + 1);
      }
      return;
    }
    const d = this.rand() & 1 ? 1 : -1;
    for (let s = 0; s < 2; s++) {
      const dx = s === 0 ? d : -d;
      const nx = x + dx;
      if (nx < 0 || nx >= w) continue;
      const k = j + dx;
      const tk = type[k];
      if (tk === EMPTY || isGas(tk)) return this.swap(i, k);
      if (tk === WATER && this.chance(sinkEvery + 1)) {
        this.swap(i, k);
        if (isSand) this.emit('sink', nx, y + 1);
        return;
      }
    }
  }

  /** A seed touching water drinks it and becomes the first cell of a plant. */
  private sprout(x: number, y: number, i: number): boolean {
    const { w, h, type } = this;
    const near = [y > 0 ? i - w : -1, y < h - 1 ? i + w : -1, x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1];
    for (const n of near) {
      if (n < 0 || type[n] !== WATER) continue;
      // The water below becomes the root; water on the side is simply drunk.
      if (n === i + w) {
        type[n] = PLANT;
        this.a[n] = 6;
        this.b[n] = 0;
        this.c[n] = 0;
        this.shade[n] = this.rand() & 255;
        this.clock[n] = this.gen;
      } else type[n] = EMPTY;
      type[i] = PLANT;
      this.b[i] = TIP | (10 + (this.rand() % 14));
      this.a[i] = 14;
      this.c[i] = 1;
      this.clock[i] = this.gen;
      this.emit('sprout', x, y);
      return true;
    }
    return false;
  }

  /** Snow: drifts down slowly, piles up in steeper heaps than sand, melts quietly in water. */
  private snow(x: number, y: number, i: number): void {
    if (y >= this.h - 1 || !this.chance(2)) return;
    const { w, type } = this;
    const j = i + w;
    const tb = type[j];
    if (tb === WATER) {
      if (this.chance(240)) this.spawn(i, WATER);
      return;
    }
    const drift = this.chance(3) ? (this.rand() & 1 ? 1 : -1) : 0;
    if (drift && x + drift >= 0 && x + drift < w) {
      const k = j + drift;
      if (type[k] === EMPTY || isGas(type[k])) return this.swap(i, k);
    }
    if (tb === EMPTY || isGas(tb)) return this.swap(i, j);
    if (this.chance(3)) {
      const d = this.rand() & 1 ? 1 : -1;
      if (x + d >= 0 && x + d < w && type[j + d] === EMPTY) this.swap(i, j + d);
    }
  }

  /** Water: falls, slides, then spreads sideways to find its level. */
  private water(x: number, y: number, i: number): void {
    const { w, h, type } = this;
    if (y < h - 1) {
      const j = i + w;
      const tb = type[j];
      if (tb === EMPTY || tb === STEAM || tb === CLOUD) return this.swap(i, j);
      const d = this.rand() & 1 ? 1 : -1;
      for (let s = 0; s < 2; s++) {
        const dx = s === 0 ? d : -d;
        const nx = x + dx;
        if (nx < 0 || nx >= w) continue;
        const tk = type[j + dx];
        if (tk === EMPTY || tk === STEAM) return this.swap(i, j + dx);
      }
    }
    const d = this.rand() & 1 ? 1 : -1;
    for (let s = 0; s < 2; s++) {
      const dir = s === 0 ? d : -d;
      let target = -1;
      for (let step = 1; step <= 3; step++) {
        const nx = x + dir * step;
        if (nx < 0 || nx >= w || type[i + dir * step] !== EMPTY) break;
        target = i + dir * step;
      }
      if (target >= 0) return this.swap(i, target);
    }
  }

  /** Steam: rises and wobbles; up high it cools and gathers into a cloud. */
  private steam(x: number, y: number, i: number): void {
    const { w, type, a } = this;
    if (a[i] < 255) a[i]++;
    const top = y <= 1;
    const above = y > 0 ? type[i - w] : STONE;
    if (above === CLOUD) {
      // Joins the cloud above: one more raindrop in it.
      if (a[i - w] < 40) a[i - w] += 2;
      type[i] = EMPTY;
      this.emit('condense', x, y - 1);
      return;
    }
    if (top || (a[i] > 170 && above !== EMPTY && above !== WATER)) {
      type[i] = CLOUD;
      a[i] = 3;
      this.emit('condense', x, y);
      return;
    }
    if (!this.chance(5)) {
      const j = i - w;
      if (above === EMPTY || above === WATER) {
        // Steam curls as it rises: it often drifts sideways.
        const wobble = this.chance(2) ? (this.rand() & 1 ? 1 : -1) : 0;
        const nx = x + wobble;
        if (wobble && nx >= 0 && nx < w && type[j + wobble] === EMPTY) return this.swap(i, j + wobble);
        if (wobble && nx >= 0 && nx < w && type[i + wobble] === EMPTY && this.chance(2)) return this.swap(i, i + wobble);
        return this.swap(i, j);
      }
      const d = this.rand() & 1 ? 1 : -1;
      for (let s = 0; s < 2; s++) {
        const nx = x + (s === 0 ? d : -d);
        if (nx < 0 || nx >= w) continue;
        if (type[j + nx - x] === EMPTY) return this.swap(i, j + nx - x);
        if (type[i + nx - x] === EMPTY && this.chance(2)) return this.swap(i, i + nx - x);
      }
    }
  }

  /** Cloud: floats still, lets its raindrops fall one by one, and fades away once empty. */
  private cloud(x: number, y: number, i: number): void {
    const { w, h, type, a } = this;
    if (a[i] > 0) {
      if (y < h - 1 && type[i + w] === EMPTY && this.chance(70)) {
        this.spawn(i + w, WATER);
        a[i]--;
        this.emit('rain', x, y + 1);
      }
    } else if (this.b[i] === 0 && this.chance(260)) {
      type[i] = EMPTY; // a spent cloud fades away (scene clouds, flagged in b, stay)
    }
  }

  /** Bubble: air is lighter than water, so it rises through it; in the open air it floats a bit and pops. */
  private bubble(x: number, y: number, i: number): void {
    const { w, type, a } = this;
    if (a[i] < 255) a[i]++;
    if (y === 0) {
      type[i] = EMPTY;
      return;
    }
    const j = i - w;
    const above = type[j];
    if (above === WATER) {
      const wobble = this.chance(3) ? (this.rand() & 1 ? 1 : -1) : 0;
      const nx = x + wobble;
      const k = wobble && nx >= 0 && nx < w && type[j + wobble] === WATER ? j + wobble : j;
      this.swap(i, k);
      a[k] = 0;
      this.emit('bubble', x, y - 1);
      return;
    }
    const inWater = (y < this.h - 1 && type[i + w] === WATER) || (x > 0 && type[i - 1] === WATER) || (x < w - 1 && type[i + 1] === WATER);
    if (!inWater && (a[i] > 80 || this.chance(40))) {
      type[i] = EMPTY; // pop!
      return;
    }
    if (above === EMPTY && this.chance(2)) return this.swap(i, j);
    const d = this.rand() & 1 ? 1 : -1;
    if (x + d >= 0 && x + d < w && (type[j + d] === EMPTY || type[j + d] === WATER)) this.swap(i, j + d);
  }

  /** The warm sun lamp: warms a couple of cells around it each tick. Never burns anything. */
  private heat(x: number, y: number): void {
    const { w, type } = this;
    for (let n = 0; n < 2; n++) {
      const tx = x + (this.rand() % 7) - 3;
      const ty = y + (this.rand() % 7) - 3;
      if (!this.inside(tx, ty)) continue;
      const j = ty * w + tx;
      const t = type[j];
      if (t === ICE && this.chance(5)) {
        this.spawn(j, WATER);
        this.emit('melt_ice', tx, ty);
      } else if (t === SNOW && this.chance(2)) {
        this.spawn(j, WATER);
        this.emit('melt_snow', tx, ty);
      } else if (t === WATER && this.chance(5)) {
        this.spawn(j, STEAM);
        this.emit('evaporate', tx, ty);
      }
    }
  }

  /** Is there light here: open sky above, or a sun lamp close by? */
  lit(x: number, y: number): boolean {
    const { w, type } = this;
    let open = true;
    for (let yy = y - 1; yy >= 0; yy--) {
      if (isOpaque(type[yy * w + x])) {
        open = false;
        break;
      }
    }
    if (open) return true;
    for (let yy = Math.max(0, y - 6); yy <= Math.min(this.h - 1, y + 6); yy++)
      for (let xx = Math.max(0, x - 6); xx <= Math.min(w - 1, x + 6); xx++) if (type[yy * w + xx] === HEAT) return true;
    return false;
  }

  /**
   * Plant: cells touching water drink it and share it along the stem. The tip
   * climbs while it has water and growth left, sprouts leaves and sometimes a
   * branch; once grown, with light and water, it blooms into a flower.
   */
  private plant(x: number, y: number, i: number): void {
    const { w, h, type, a, b, c } = this;
    // Drink from one random neighbour, and pass water up the stem (never down: sap rises).
    const r = this.rand() & 3;
    let n = r === 0 ? (y > 0 ? i - w : -1) : r === 1 ? (y < h - 1 ? i + w : -1) : r === 2 ? (x > 0 ? i - 1 : -1) : x < w - 1 ? i + 1 : -1;
    if (n >= 0 && type[n] === WATER) {
      if (a[i] < 24 && this.chance(4)) {
        type[n] = EMPTY;
        a[i] += 6;
      }
    } else if (y > 0 && r !== 1) {
      if (r === 0 && type[n] !== PLANT) {
        // The stem may go on diagonally.
        const d = this.rand() & 1 ? 1 : -1;
        n = x + d >= 0 && x + d < w ? i - w + d : -1;
      }
      if (n >= 0 && type[n] === PLANT && a[n] + 1 < a[i] && !(b[n] & LEAF)) {
        a[i]--;
        a[n]++;
      }
    }
    if (!(b[i] & TIP)) return;
    const budget = b[i] & BUDGET;
    if (budget > 0) {
      if (a[i] < 2 || !this.chance(14) || y === 0) return;
      const d = this.rand() & 1 ? 1 : -1;
      const options = this.chance(4) ? [i - w + d, i - w, i - w - d] : [i - w, i - w + d, i - w - d];
      for (const j of options) {
        const jx = j - (y - 1) * w;
        if (jx < 0 || jx >= w || (type[j] !== EMPTY && type[j] !== WATER)) continue;
        // The tip moves up and carries its water with it.
        type[j] = PLANT;
        this.shade[j] = this.rand() & 255;
        a[j] = a[i] - 1;
        a[i] = 0;
        b[j] = TIP | (budget - 1);
        c[j] = Math.min(255, c[i] + 1);
        this.clock[j] = this.gen;
        b[i] = 0;
        // A leaf, now and then, on either side of the stem.
        if (this.chance(3)) {
          const lx = x + (this.rand() & 1 ? 1 : -1);
          if (lx >= 0 && lx < w && type[i - x + lx] === EMPTY) {
            const l = i - x + lx;
            type[l] = PLANT;
            this.shade[l] = this.rand() & 255;
            a[l] = 0;
            b[l] = LEAF;
            c[l] = c[i];
            this.clock[l] = this.gen;
          }
        }
        // Sometimes a branch, which will carry its own flower.
        if (budget > 7 && this.chance(7)) {
          const bx = x + (this.rand() & 1 ? 1 : -1);
          const bj = i - w - x + bx;
          if (bx >= 0 && bx < w && type[bj] === EMPTY) {
            type[bj] = PLANT;
            this.shade[bj] = this.rand() & 255;
            a[bj] = a[j] >> 1;
            a[j] -= a[bj];
            b[bj] = TIP | (budget >> 1);
            c[bj] = c[j];
            this.clock[bj] = this.gen;
          }
        }
        return;
      }
      // Nowhere to grow: the tip is done growing.
      b[i] = TIP;
      return;
    }
    if (a[i] >= 2 && this.chance(16) && this.lit(x, y)) this.bloom(x, y, i);
  }

  private bloom(x: number, y: number, i: number): void {
    const { w, type, a, b, c } = this;
    const hue = this.rand() % 5;
    const height = c[i];
    type[i] = FLOWER;
    a[i] = hue;
    b[i] = CENTER;
    const petals: [number, number][] = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dx, dy] of petals) {
      const px = x + dx;
      const py = y + dy;
      if (!this.inside(px, py)) continue;
      const j = py * w + px;
      if (type[j] !== EMPTY) continue;
      type[j] = FLOWER;
      this.shade[j] = this.rand() & 255;
      a[j] = hue;
      b[j] = PETAL;
      c[j] = height;
      this.clock[j] = this.gen;
    }
    this.emit('bloom', x, y);
  }
}
