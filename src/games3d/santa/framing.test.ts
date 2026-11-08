import { describe, expect, it } from 'vitest';
import { damp, fitDistance, followTalk, ndcRect, slotBox, wideness } from './framing';
import { fbm3, noise3 } from './noise';

describe('fitDistance', () => {
  it('fits the height on a wide screen and the width on a tall one', () => {
    const fov = 40;
    const t = Math.tan((fov * Math.PI) / 360);
    // Wide: a 2×2 box is limited by its height.
    expect(fitDistance(2, 2, fov, 16 / 9)).toBeCloseTo(1 / t, 6);
    // Portrait: the same box is limited by its width.
    const d = fitDistance(2, 2, fov, 390 / 844);
    expect(d).toBeCloseTo(1 / (t * (390 / 844)), 6);
    expect(d).toBeGreaterThan(1 / t);
  });

  it('never divides by zero', () => {
    expect(Number.isFinite(fitDistance(1, 1, 40, 0))).toBe(true);
  });
});

describe('wideness', () => {
  it('is 0 in portrait, 1 on wide screens, smooth in between', () => {
    expect(wideness(0.46)).toBe(0);
    expect(wideness(16 / 9)).toBe(1);
    const mid = wideness(1.05);
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
    expect(wideness(1.2)).toBeGreaterThan(wideness(1.0));
  });
});

describe('ndcRect', () => {
  it('maps normalised coordinates to top-left pixel rectangles', () => {
    const r = ndcRect(
      [
        { x: 0, y: -1 },
        { x: 0.5, y: -1 },
        { x: 0, y: 0 },
        { x: 0.5, y: 0 },
      ],
      1000,
      800
    );
    expect(r).toEqual({ x: 500, y: 400, w: 250, h: 400 });
  });

  it('clamps to the canvas and handles empty input', () => {
    expect(ndcRect([{ x: -2, y: 2 }, { x: 2, y: -2 }], 100, 50)).toEqual({ x: 0, y: 0, w: 100, h: 50 });
    expect(ndcRect([], 100, 50)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});

describe('slotBox', () => {
  it('stands next to Santa on the asked side, feet on the floor', () => {
    expect(slotBox(-0.5, 1, 0.5, 1.2, 1.75)).toEqual({ x0: 0, x1: 1.2, y0: 0, y1: 1.75 });
    const left = slotBox(0.6, -1, 0.5, 1.2, 1.75);
    expect(left.x1).toBeCloseTo(0.1);
    expect(left.x0).toBeCloseTo(-1.1);
    expect(left.y0).toBe(0);
  });
});

describe('talk smoothing', () => {
  it('opens fast, closes a bit slower, stays in 0..1', () => {
    let m = 0;
    for (let i = 0; i < 6; i++) m = followTalk(m, 1, 1 / 60);
    const opened = m;
    expect(opened).toBeGreaterThan(0.85);
    let c = 1;
    for (let i = 0; i < 6; i++) c = followTalk(c, 0, 1 / 60);
    expect(1 - c).toBeLessThan(opened);
    expect(followTalk(0.5, 7, 1)).toBeLessThanOrEqual(1);
    expect(followTalk(0.5, Number.NaN, 1)).toBeGreaterThanOrEqual(0);
    expect(damp(10, 0)).toBe(0);
  });
});

describe('noise', () => {
  it('is deterministic and bounded', () => {
    expect(noise3(1.3, 2.7, 0.4, 5)).toBe(noise3(1.3, 2.7, 0.4, 5));
    for (let i = 0; i < 200; i++) {
      const n = noise3(i * 0.37, i * 0.11, i * 0.73, 2);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
      expect(Math.abs(fbm3(i * 0.2, 1, 2))).toBeLessThanOrEqual(0.5);
    }
  });
});
