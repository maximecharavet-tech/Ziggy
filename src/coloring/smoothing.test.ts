import { describe, expect, it } from 'vitest';
import { StrokeCapture, hashString, pointCount, seeded, segPoint, segments, speedFactor, strokeLength } from './smoothing';

const capture = (pts: [number, number, number][], base = 10) => {
  const c = new StrokeCapture(base);
  for (const [x, y, t] of pts) c.add(x, y, t);
  return c;
};

describe('stroke capture', () => {
  it('skips points that are too close (finger jitter)', () => {
    const c = capture([
      [0, 0, 0],
      [0.3, 0.2, 5],
      [0.6, 0.1, 10],
      [20, 0, 20],
    ]);
    expect(c.count).toBe(2);
  });

  it('ignores non-finite coordinates', () => {
    const c = new StrokeCapture(8);
    expect(c.add(Number.NaN, 2, 0)).toBe(false);
    expect(c.count).toBe(0);
  });

  it('fast strokes are thinner than slow ones, within bounds', () => {
    expect(speedFactor(0)).toBeGreaterThan(speedFactor(5));
    for (const s of [0, 0.5, 2, 10, 1000, -3, Number.NaN]) {
      expect(speedFactor(s)).toBeGreaterThanOrEqual(0.55);
      expect(speedFactor(s)).toBeLessThanOrEqual(1.18);
    }
    const slow = capture(Array.from({ length: 20 }, (_, i) => [i * 4, 0, i * 40] as [number, number, number]));
    const fast = capture(Array.from({ length: 20 }, (_, i) => [i * 4, 0, i * 1] as [number, number, number]));
    const lastW = (c: StrokeCapture) => c.pts[c.pts.length - 1];
    expect(lastW(slow)).toBeGreaterThan(lastW(fast));
  });

  it('width changes smoothly (no jumps)', () => {
    const c = capture([
      [0, 0, 0],
      [5, 0, 100],
      [200, 0, 101],
      [400, 0, 102],
    ]);
    const widths = [2, 5, 8, 11].map((i) => c.pts[i]);
    for (let i = 1; i < widths.length; i++) expect(Math.abs(widths[i] - widths[i - 1])).toBeLessThan(10 * 0.35 + 0.1);
  });
});

describe('quadratic smoothing', () => {
  const pts = capture([
    [0, 0, 0],
    [30, 10, 16],
    [60, 40, 32],
    [80, 90, 48],
    [120, 100, 64],
  ]).pts;

  it('one segment per point, continuous from first to last point', () => {
    const segs = segments(pts);
    expect(segs.length).toBe(pointCount(pts) - 1);
    expect([segs[0].x0, segs[0].y0]).toEqual([0, 0]);
    const last = segs[segs.length - 1];
    expect([last.x1, last.y1]).toEqual([120, 100]);
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].x0).toBeCloseTo(segs[i - 1].x1, 6);
      expect(segs[i].y0).toBeCloseTo(segs[i - 1].y1, 6);
    }
  });

  it('is tangent-continuous at the joins (no corners)', () => {
    const segs = segments(pts);
    for (let i = 1; i < segs.length - 1; i++) {
      const a = segs[i - 1];
      const b = segs[i];
      const inDir = Math.atan2(a.y1 - a.cy, a.x1 - a.cx);
      const outDir = Math.atan2(b.cy - b.y0, b.cx - b.x0);
      expect(Math.abs(inDir - outDir)).toBeLessThan(1e-6);
    }
  });

  it('cumulative distance grows along the stroke', () => {
    const segs = segments(pts);
    for (let i = 1; i < segs.length; i++) expect(segs[i].dist).toBeGreaterThan(segs[i - 1].dist);
    expect(strokeLength(pts)).toBeGreaterThan(Math.hypot(120, 100));
  });

  it('handles a single tap and two points', () => {
    expect(segments([5, 5, 4])).toHaveLength(1);
    expect(segments([0, 0, 4, 10, 0, 4])).toHaveLength(1);
    expect(segments([])).toHaveLength(0);
  });

  it('segPoint interpolates between ends', () => {
    const s = segments(pts)[1];
    expect(segPoint(s, 0)).toEqual({ x: s.x0, y: s.y0 });
    expect(segPoint(s, 1).x).toBeCloseTo(s.x1);
  });
});

describe('deterministic randomness (glitter)', () => {
  it('same seed gives the same sequence', () => {
    const a = seeded(hashString('stroke-1'));
    const b = seeded(hashString('stroke-1'));
    const xs = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});
