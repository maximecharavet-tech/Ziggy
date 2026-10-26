import { describe, expect, it } from 'vitest';
import { BUBBLE, CLOUD, EMPTY, FLOWER, HEAT, ICE, PLANT, REACTIONS, SAND, SEED, SNOW, STEAM, STONE, TIP, WATER, Sandbox, type Reaction } from './sim';
import { SCENES, loadScene } from './scenes';
import { renderGlow, renderPixels, glowSize } from './render';
import { CHALLENGES, DISCOVERIES } from './content';

/** Steps until `kind` is reported (or `max` steps), returns the step count or -1. */
function until(sim: Sandbox, kind: Reaction, max = 4000): number {
  for (let s = 1; s <= max; s++) {
    sim.step();
    if (sim.events.some((e) => e.kind === kind)) return s;
  }
  return -1;
}

/** A sandbox with a stone floor. */
function box(w = 40, h = 30, seed = 7) {
  const sim = new Sandbox(w, h, seed);
  for (let x = 0; x < w; x++) sim.set(x, h - 1, STONE);
  return sim;
}

const lowestY = (sim: Sandbox, t: number) => {
  for (let y = sim.h - 1; y >= 0; y--) for (let x = 0; x < sim.w; x++) if (sim.get(x, y) === t) return y;
  return -1;
};

describe('Sandbox: movement', () => {
  it('sand falls and piles up, never through stone', () => {
    const sim = box();
    sim.set(20, 2, SAND);
    for (let s = 0; s < 60; s++) sim.step();
    expect(sim.get(20, sim.h - 2)).toBe(SAND);
    expect(sim.count(SAND)).toBe(1);
    // A column of sand spreads into a heap.
    for (let y = 0; y < 15; y++) sim.set(10, y, SAND);
    for (let s = 0; s < 200; s++) sim.step();
    let wide = 0;
    for (let x = 0; x < sim.w; x++) if (sim.get(x, sim.h - 2) === SAND) wide++;
    expect(wide).toBeGreaterThan(4);
    expect(sim.count(SAND)).toBe(16);
  });

  it('water spreads flat along the floor', () => {
    const sim = box(60, 20);
    for (let y = 0; y < 10; y++) for (let x = 28; x < 32; x++) sim.set(x, y, WATER);
    for (let s = 0; s < 400; s++) sim.step();
    expect(sim.count(WATER)).toBe(40);
    // 40 drops on a 60-wide floor: at most one layer high.
    for (let x = 0; x < sim.w; x++) expect(sim.get(x, sim.h - 3)).not.toBe(WATER);
    let covered = 0;
    for (let x = 0; x < sim.w; x++) if (sim.get(x, sim.h - 2) === WATER) covered++;
    expect(covered).toBe(40);
  });

  it('sand sinks through water and says so', () => {
    const sim = box();
    for (let y = 20; y < sim.h - 1; y++) for (let x = 15; x < 25; x++) sim.set(x, y, WATER);
    for (let x = 0; x < sim.w; x++) for (let y = 20; y < sim.h - 1; y++) if (x === 14 || x === 25) sim.set(x, y, STONE);
    sim.set(20, 5, SAND);
    expect(until(sim, 'sink', 300)).toBeGreaterThan(0);
    for (let s = 0; s < 200; s++) sim.step();
    expect(lowestY(sim, SAND)).toBe(sim.h - 2);
  });

  it('steam rises to the top and becomes a cloud', () => {
    const sim = box();
    sim.set(20, 25, STEAM);
    expect(until(sim, 'condense', 600)).toBeGreaterThan(0);
    expect(sim.count(STEAM)).toBe(0);
    expect(sim.count(CLOUD)).toBe(1);
    expect(lowestY(sim, CLOUD)).toBeLessThanOrEqual(1);
  });

  it('a cloud rains, then fades away', () => {
    const sim = box();
    sim.set(20, 2, CLOUD);
    expect(until(sim, 'rain', 1000)).toBeGreaterThan(0);
    for (let s = 0; s < 6000 && sim.count(CLOUD); s++) sim.step();
    expect(sim.count(CLOUD)).toBe(0);
    expect(sim.count(WATER)).toBeGreaterThanOrEqual(5);
  });

  it('bubbles rise through water and pop in the air', () => {
    const sim = box();
    for (let y = 10; y < sim.h - 1; y++) for (let x = 0; x < sim.w; x++) sim.set(x, y, WATER);
    sim.set(20, sim.h - 2, EMPTY);
    sim.set(20, sim.h - 2, BUBBLE);
    expect(until(sim, 'bubble', 50)).toBeGreaterThan(0);
    for (let s = 0; s < 400; s++) sim.step();
    expect(sim.count(BUBBLE)).toBe(0);
  });

  it('snow falls slowly and piles up', () => {
    const sim = box();
    sim.set(20, 0, SNOW);
    for (let s = 0; s < 20; s++) sim.step();
    expect(lowestY(sim, SNOW)).toBeLessThan(sim.h - 2); // slower than sand
    for (let s = 0; s < 300; s++) sim.step();
    expect(lowestY(sim, SNOW)).toBe(sim.h - 2);
  });

  it('the wind blows sand sideways', () => {
    const sim = box();
    for (let x = 18; x < 22; x++) sim.set(x, sim.h - 2, SAND);
    for (let s = 0; s < 30; s++) {
      sim.wind(20, sim.h - 2, 6, 1);
      sim.step();
    }
    let right = 0;
    for (let x = 22; x < sim.w; x++) for (let y = 0; y < sim.h; y++) if (sim.get(x, y) === SAND) right++;
    expect(right).toBeGreaterThan(0);
    expect(sim.counts.wind).toBeGreaterThan(0);
    expect(sim.count(SAND)).toBe(4);
  });

  it('painting fills only empty cells and the eraser clears', () => {
    const sim = box();
    sim.paint(20, 10, 3, STONE);
    expect(sim.count(STONE)).toBeGreaterThan(sim.w + 20);
    sim.paint(20, 10, 3, SAND);
    expect(sim.count(SAND)).toBe(0);
    sim.paint(20, 10, 3, EMPTY);
    expect(sim.count(STONE)).toBe(sim.w);
    // Things can be dropped into water (but water never replaces anything).
    for (let x = 0; x < 10; x++) sim.set(x, 20, WATER);
    for (let s = 0; s < 40; s++) sim.paint(5, 20, 1, ICE);
    expect(sim.get(5, 20)).toBe(ICE);
    sim.paint(20, 20, 3, STONE);
    sim.paint(20, 20, 3, WATER);
    expect(sim.get(20, 20)).toBe(STONE);
    sim.paintLine(2, 2, 30, 2, 1, STONE);
    for (let x = 2; x <= 30; x++) expect(sim.get(x, 2)).toBe(STONE);
  });
});

describe('Sandbox: reactions (the discoveries)', () => {
  it('seed + water → plant, which grows', () => {
    const sim = box();
    for (let x = 10; x < 30; x++) sim.set(x, sim.h - 2, WATER);
    sim.set(20, 10, SEED);
    expect(until(sim, 'sprout', 200)).toBeGreaterThan(0);
    for (let s = 0; s < 600; s++) sim.step();
    expect(sim.count(PLANT) + sim.count(FLOWER)).toBeGreaterThan(5);
    expect(sim.count(SEED)).toBe(0);
  });

  it('plant + light + water → flower', () => {
    const sim = box();
    for (let y = sim.h - 4; y < sim.h - 1; y++) for (let x = 0; x < sim.w; x++) sim.set(x, y, WATER);
    sim.set(10, 5, SEED);
    sim.set(30, 5, SEED);
    expect(until(sim, 'bloom', 4000)).toBeGreaterThan(0);
    expect(sim.count(FLOWER)).toBeGreaterThan(0);
  });

  it('no flower in the dark, until a sun lamp shines', () => {
    const sim = box();
    for (let x = 0; x < sim.w; x++) sim.set(x, 2, STONE); // a roof
    for (let y = sim.h - 4; y < sim.h - 1; y++) for (let x = 0; x < sim.w; x++) sim.set(x, y, WATER);
    sim.set(20, 20, SEED);
    expect(until(sim, 'bloom', 2500)).toBe(-1);
    expect(sim.count(PLANT)).toBeGreaterThan(3);
    // Light the tips with a sun lamp right next to them.
    let lamps = 0;
    for (let i = 0; i < sim.w * sim.h; i++) {
      if (sim.type[i] !== PLANT || !(sim.b[i] & TIP)) continue;
      const x = i % sim.w;
      const y = (i / sim.w) | 0;
      const lx = x + 2 < sim.w ? x + 2 : x - 2;
      if (sim.get(lx, y) === EMPTY) {
        sim.set(lx, y, HEAT);
        lamps++;
      }
    }
    expect(lamps).toBeGreaterThan(0);
    expect(until(sim, 'bloom', 3000)).toBeGreaterThan(0);
  });

  it('ice + warmth → water', () => {
    const sim = box();
    for (let x = 18; x < 23; x++) sim.set(x, 20, ICE);
    sim.set(20, 23, HEAT);
    expect(until(sim, 'melt_ice', 500)).toBeGreaterThan(0);
    expect(sim.count(ICE)).toBeLessThan(5);
  });

  it('snow + warmth → water', () => {
    const sim = box();
    sim.set(20, 27, HEAT);
    for (let x = 18; x < 23; x++) sim.set(x, 26, SNOW);
    expect(until(sim, 'melt_snow', 500)).toBeGreaterThan(0);
  });

  it('water + warmth → steam, and the whole water cycle follows', () => {
    const sim = box();
    for (let x = 15; x < 25; x++) sim.set(x, sim.h - 2, WATER);
    sim.set(20, sim.h - 3, HEAT);
    expect(until(sim, 'evaporate', 500)).toBeGreaterThan(0);
    expect(until(sim, 'condense', 3000)).toBeGreaterThan(0);
    expect(until(sim, 'rain', 3000)).toBeGreaterThan(0);
  });

  it('reports each reaction once per step, and counts them all', () => {
    const sim = box();
    for (let x = 0; x < sim.w; x++) sim.set(x, 10, ICE);
    for (let x = 1; x < sim.w; x += 4) sim.set(x, 11, HEAT);
    let total = 0;
    for (let s = 0; s < 100; s++) {
      sim.step();
      expect(sim.events.filter((e) => e.kind === 'melt_ice').length).toBeLessThanOrEqual(1);
      total += sim.events.length;
    }
    expect(sim.counts.melt_ice).toBeGreaterThan(1);
    expect(total).toBeGreaterThan(0);
  });

  it('every reaction has a notebook card, and the challenges point at real reactions', () => {
    expect(DISCOVERIES.map((d) => d.id).sort()).toEqual([...REACTIONS].sort());
    for (const c of CHALLENGES) expect(REACTIONS).toContain(c.reaction);
  });
});

describe('Sandbox: determinism, scenes and speed', () => {
  const play = (seed: number) => {
    const sim = new Sandbox(120, 80, seed);
    loadScene(sim, 'jardin');
    for (let s = 0; s < 300; s++) {
      if (s < 120) sim.paint(30 + (s % 40), 5, 3, s % 3 === 0 ? SEED : s % 3 === 1 ? WATER : SAND);
      if (s === 150) sim.paint(60, 40, 4, HEAT);
      sim.step();
    }
    return sim;
  };

  it('the same seed and the same gestures give the same world', () => {
    expect(play(42).hash()).toBe(play(42).hash());
    expect(play(42).counts).toEqual(play(42).counts);
    expect(play(42).hash()).not.toBe(play(43).hash());
  });

  it('scenes are pretty and calm: they react to nothing by themselves', () => {
    for (const id of SCENES) {
      for (const [w, h] of [
        [200, 120],
        [120, 200],
      ]) {
        const sim = new Sandbox(w, h, 3);
        loadScene(sim, id);
        expect(sim.count(EMPTY)).toBeLessThan(w * h * 0.85);
        expect(sim.count(FLOWER)).toBeGreaterThan(0);
        for (let s = 0; s < 400; s++) {
          sim.step();
          expect(sim.events).toEqual([]);
        }
      }
    }
  });

  it('renders every element to pixels and glow without throwing', () => {
    const sim = new Sandbox(64, 40, 5);
    loadScene(sim, 'iles');
    [SAND, WATER, SEED, ICE, HEAT, SNOW, CLOUD, BUBBLE, STEAM].forEach((t, k) => sim.paint(5 + k * 6, 8, 2, t));
    const px = new Uint32Array(sim.w * sim.h);
    renderPixels(sim, px, 1234);
    expect(px.some((v) => v !== 0)).toBe(true);
    const { gw, gh } = glowSize(sim);
    const glow = new Uint32Array(gw * gh);
    renderGlow(sim, glow, 1234);
    expect(glow.some((v) => v !== 0)).toBe(true);
  });

  it('a busy 200×120 world steps within a few milliseconds', () => {
    const sim = new Sandbox(200, 120, 11);
    loadScene(sim, 'jardin');
    for (let x = 5; x < 195; x += 10) {
      sim.paint(x, 10, 4, x % 20 ? WATER : SAND);
      sim.paint(x, 30, 3, x % 30 ? SNOW : SEED);
    }
    sim.paint(100, 60, 5, HEAT);
    for (let s = 0; s < 30; s++) sim.step(); // warm up the JIT
    const px = new Uint32Array(sim.w * sim.h);
    for (let s = 0; s < 30; s++) renderPixels(sim, px, s * 16);
    const n = 200;
    const t0 = performance.now();
    for (let s = 0; s < n; s++) {
      sim.step();
      if (s % 2 === 0) sim.paint(100, 5, 4, WATER);
    }
    const step = (performance.now() - t0) / n;
    const t1 = performance.now();
    for (let s = 0; s < 100; s++) renderPixels(sim, px, s * 16);
    const draw = (performance.now() - t1) / 100;
    expect(step).toBeLessThan(4);
    expect(draw).toBeLessThan(4);
  });
});
