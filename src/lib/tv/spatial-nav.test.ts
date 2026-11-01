import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { BOUNDARY_UP, DIR_CODE, WRAP_X, isAhead, nextFocus, priority, type Box, type Dir } from './spatial-nav';
import * as wasm from './wasm/ziggy_tv_nav.js';

const box = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
/** 300 × 200 tiles, 40 px apart. */
const tile = (col: number, row: number) => box(col * 340, row * 260, 300, 200);

describe('direction scoring', () => {
  it('only counts elements past the edge being left', () => {
    const a = tile(0, 0);
    expect(priority(a, tile(1, 0), 'right')).not.toBeNull();
    expect(priority(a, tile(1, 0), 'left')).toBeNull();
    expect(priority(a, tile(0, 1), 'down')).not.toBeNull();
    expect(priority(a, tile(0, 1), 'up')).toBeNull();
    expect(priority(a, box(150, 0, 300, 200), 'right')).toBeNull();
  });

  it('forgives the 6 % bigger focused element overlapping a close neighbour', () => {
    expect(isAhead(box(-9, -6, 318, 212), box(307, 0, 300, 200), 'right')).toBe(true);
  });

  it('prefers the next in the row to a diagonal just below', () => {
    const from = tile(0, 0);
    expect(priority(from, box(340, 20, 300, 200), 'right')!).toBeLessThan(priority(from, box(320, 230, 300, 200), 'right')!);
  });

  it('among diagonals, prefers the least sideways', () => {
    const from = box(0, 0, 100, 100);
    expect(priority(from, box(300, 130, 100, 100), 'right')!).toBeLessThan(priority(from, box(150, 400, 100, 100), 'right')!);
  });

  it('scores like Norigin: (5 × main + other + 1), ÷ 5 in the same row', () => {
    // Same row, 40 px gap, 20 px lower: (5×40 + 20 + 1) / 5.
    expect(priority(tile(0, 0), box(340, 20, 300, 200), 'right')).toBeCloseTo(44.2);
    // Diagonal: sideways 30 px is the main distance, 20 px along the move: 5×30 + 20 + 1.
    expect(priority(tile(0, 0), box(320, 230, 300, 200), 'right')).toBeCloseTo(171);
  });
});

describe('nextFocus', () => {
  it('walks a plain grid', () => {
    const rects = Array.from({ length: 6 }, (_, i) => tile(i % 3, Math.floor(i / 3)));
    const groups = new Array(6).fill(0);
    const go = (from: number, dir: Dir) => nextFocus(rects, groups, from, dir);
    expect(go(0, 'right')).toBe(1);
    expect(go(2, 'right')).toBe(-1);
    expect(go(1, 'down')).toBe(4);
    expect(go(4, 'up')).toBe(1);
    expect(go(5, 'left')).toBe(4);
  });

  /** A button, a row of stories scrolled sideways, a row of games. */
  function home() {
    const rects: Box[] = [box(100, 100, 300, 80)];
    const groups = [0];
    for (let i = 0; i < 6; i++) {
      rects.push(box(100 + i * 380 - 760, 300, 350, 220));
      groups.push(1);
    }
    for (let i = 0; i < 4; i++) {
      rects.push(box(100 + i * 380, 600, 350, 220));
      groups.push(2);
    }
    return { rects, groups };
  }

  it('moves inside a row first, then between rows', () => {
    const { rects, groups } = home();
    expect(nextFocus(rects, groups, 3, 'right')).toBe(4);
    expect(nextFocus(rects, groups, 3, 'down')).toBe(7);
    expect(nextFocus(rects, groups, 5, 'down')).toBe(9);
    expect(nextFocus(rects, groups, 8, 'up')).toBe(4);
    expect(nextFocus(rects, groups, 4, 'up')).toBe(0);
    expect(groups[nextFocus(rects, groups, 0, 'down')]).toBe(1);
  });

  it('restores the last focused tile of a row', () => {
    const { rects, groups } = home();
    expect(nextFocus(rects, groups, 8, 'up', [0, 0, 0], [-1, 6, -1])).toBe(6);
    expect(nextFocus(rects, groups, 8, 'up', [0, 0, 0], [-1, 9, -1])).toBe(4);
  });

  it('wraps around inside rows, stops at boundaries', () => {
    const { rects, groups } = home();
    expect(nextFocus(rects, groups, 10, 'right', [0, WRAP_X, WRAP_X])).toBe(7);
    expect(nextFocus(rects, groups, 7, 'left', [0, WRAP_X, WRAP_X])).toBe(10);
    expect(nextFocus(rects, groups, 10, 'right', [0, 0, 0])).toBe(-1);
    expect(nextFocus(rects, groups, 8, 'up', [0, 0, BOUNDARY_UP])).toBe(-1);
  });

  it('is harmless with bad input', () => {
    expect(nextFocus([], [], 0, 'up')).toBe(-1);
    expect(nextFocus([box(0, 0, 1, 1)], [0, 0], 0, 'up')).toBe(-1);
    expect(nextFocus([box(0, 0, 1, 1)], [0], 5, 'up')).toBe(-1);
  });
});

describe('the Rust/WebAssembly engine gives the same answers', () => {
  beforeAll(() => {
    wasm.initSync({ module: readFileSync(fileURLToPath(new URL('./wasm/ziggy_tv_nav_bg.wasm', import.meta.url))) });
  });

  /** Deterministic pseudo-random layouts (mulberry32). */
  function rng(seed: number) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it('on scores', () => {
    const r = rng(7);
    const dirs: Dir[] = ['up', 'right', 'down', 'left'];
    for (let n = 0; n < 2000; n++) {
      const a = box(r() * 1800, r() * 1000, 20 + r() * 400, 20 + r() * 300);
      const b = box(r() * 1800, r() * 1000, 20 + r() * 400, 20 + r() * 300);
      const dir = dirs[n % 4];
      const ts = priority(a, b, dir) ?? -1;
      const rs = wasm.priority(new Float64Array([a.x, a.y, a.w, a.h]), new Float64Array([b.x, b.y, b.w, b.h]), DIR_CODE[dir]);
      expect(rs).toBeCloseTo(ts, 9);
    }
  });

  it('on whole layouts with rows, wrapping, boundaries and memory', () => {
    const r = rng(42);
    const dirs: Dir[] = ['up', 'right', 'down', 'left'];
    for (let layout = 0; layout < 300; layout++) {
      const count = 2 + Math.floor(r() * 24);
      const rects: Box[] = [];
      const groups: number[] = [];
      for (let i = 0; i < count; i++) {
        // Half the layouts are tidy rows of tiles, half are scattered.
        const tidy = layout % 2 === 0;
        const row = Math.floor(r() * 4);
        rects.push(tidy ? box((i % 6) * 320 - 300, row * 280, 290, 200) : box(r() * 1900 - 100, r() * 1100, 30 + r() * 350, 30 + r() * 250));
        groups.push(r() < 0.3 ? 0 : row + 1);
      }
      const flags = [0, WRAP_X, r() < 0.5 ? BOUNDARY_UP : 0, WRAP_X | BOUNDARY_UP, 0];
      const memory = [-1, ...[0, 0, 0, 0].map(() => (r() < 0.4 ? Math.floor(r() * count) : -1))];
      const flat = new Float64Array(rects.flatMap((b) => [b.x, b.y, b.w, b.h]));
      for (let cur = 0; cur < count; cur++) {
        for (const dir of dirs) {
          const ts = nextFocus(rects, groups, cur, dir, flags, memory);
          const rs = wasm.nextFocus(flat, Uint32Array.from(groups), cur, DIR_CODE[dir], Uint8Array.from(flags), Int32Array.from(memory));
          expect(rs, `layout ${layout}, from ${cur} ${dir}`).toBe(ts);
        }
      }
    }
  });
});
