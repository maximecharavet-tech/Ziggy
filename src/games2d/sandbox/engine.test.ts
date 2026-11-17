import { beforeAll, describe, expect, it } from 'vitest';
import { createSandbox, loadSandboxEngine } from './engine';
import { EL } from './wasm/ids';

beforeAll(async () => {
  await loadSandboxEngine();
});

describe('sandbox engine (WebAssembly in Node)', () => {
  it('reaches the same hash as the native build (rust/sandbox-core/tests/behaviour.rs)', () => {
    const s = createSandbox(200, 120, 42, 3);
    s.raw.load_scene();
    const kinds = [EL.sand, EL.water, EL.lava, EL.seed];
    for (let k = 0; k < 300; k++) {
      if (k % 7 === 0) s.raw.paint_line(20 + (k % 60), 10, 40, 30, 3, kinds[Math.floor(k / 7) % 4], 0);
      if (k % 50 === 0) s.raw.wind(100, 60, 8, 1);
      s.raw.step(1);
    }
    expect(s.raw.hash()).toBe(2500734713);
    s.free();
  });

  it('reports reactions with their place, and exact counts', () => {
    const s = createSandbox(60, 40, 7, 0);
    for (let x = 0; x < 60; x++) s.raw.set(x, 39, EL.stone);
    for (let x = 20; x < 30; x++) s.raw.set(x, 38, EL.ice);
    s.raw.set(31, 37, EL.heat);
    const seen = new Set<string>();
    for (let k = 0; k < 2000 && !seen.has('melt_ice'); k++) {
      s.raw.step(1);
      for (const e of s.takeEvents()) {
        seen.add(e.kind);
        expect(e.x).toBeGreaterThanOrEqual(0);
        expect(e.y).toBeLessThan(40);
      }
    }
    expect(seen.has('melt_ice')).toBe(true);
    expect(s.counts()[1]).toBeGreaterThan(0);
    s.free();
  });

  it('saves and restores a creation, and refuses foreign bytes', () => {
    const a = createSandbox(192, 320, 1, 6);
    a.raw.load_scene();
    a.raw.paint_line(20, 20, 150, 40, 4, EL.moondust, 0);
    for (let k = 0; k < 30; k++) a.raw.step(1);
    const bytes = a.save();
    const b = createSandbox(192, 320, 99, 6);
    expect(b.load(bytes)).toBe(true);
    // Two worlds restored from the same bytes go on exactly alike.
    expect(a.load(bytes)).toBe(true);
    for (let k = 0; k < 30; k++) {
      a.raw.step(1);
      b.raw.step(1);
    }
    expect(b.raw.hash()).toBe(a.raw.hash());
    const c = createSandbox(192, 320, 1, 7);
    expect(c.load(bytes)).toBe(false);
    expect(c.load(new Uint8Array([1, 2, 3]))).toBe(false);
    for (const s of [a, b, c]) s.free();
  });

  it('passes the parcel toys to the page: snow-globe notes, the treasure, the kite', () => {
    const s = createSandbox(320, 192, 5, 0);
    s.raw.load_scene();
    s.raw.place_globe(160, 40);
    const gx = s.raw.globe_x();
    const notes = [];
    for (let k = 0; k < 120; k++) {
      s.raw.paint_line(gx - 6, 20, gx - 4, 20, 2, EL.sand, 0);
      s.raw.step(1);
      notes.push(...s.takeNotes());
    }
    expect(notes.length).toBeGreaterThan(3);
    expect(notes.every((n) => n.element === EL.sand && n.degree >= 0 && n.degree <= 7)).toBe(true);
    expect(s.takeNotes()).toEqual([]);
    // A kept map: the treasure goes back under the ground of that column.
    s.raw.set_treasure(250, -1);
    expect(s.raw.toys() & 4).toBe(4);
    expect(s.raw.treasure_x()).toBe(250);
    let top = 0;
    while (s.raw.get(250, top) === EL.empty) top++;
    expect(s.raw.treasure_y()).toBeGreaterThan(top);
    s.raw.place_kite(60, 150);
    for (let k = 0; k < 200; k++) {
      s.raw.steer_kite(100, 30);
      s.raw.step(1);
    }
    expect(Math.abs(s.raw.kite_x() - 100)).toBeLessThan(3);
    expect(Math.abs(s.raw.kite_y() - 30)).toBeLessThan(3);
    s.free();
  });

  it('draws every world at both tiers without throwing', () => {
    for (let w = 0; w < 8; w++) {
      const s = createSandbox(320, 192, 3, w);
      s.raw.load_scene();
      for (const scale of [2, 3]) {
        s.raw.set_quality(scale, scale === 3);
        const img = s.render(500, false);
        expect(img.width).toBe(320 * scale);
        expect(img.data.length).toBe(img.width * img.height * 4);
      }
      s.free();
    }
  });
});
