import { describe, expect, it } from 'vitest';
import { alphaToRGBA, boxBlur, coverage, keepMainBlobs, maskBox, minFilter, ovalMask, quickMatte, refineMask } from './matte';

/** A w×h mask with a filled rectangle of confidence `v`. */
function rectMask(w: number, h: number, r: { x: number; y: number; w: number; h: number }, v = 1, base = 0) {
  const m = new Float32Array(w * h).fill(base);
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) m[y * w + x] = v;
  return m;
}

describe('refineMask', () => {
  it('keeps the inside opaque, the far outside clear, and feathers the edge', () => {
    const w = 24;
    const h = 24;
    const a = refineMask(rectMask(w, h, { x: 6, y: 6, w: 12, h: 12 }), w, h);
    expect(a[12 * w + 12]).toBeCloseTo(1, 5);
    expect(a[1 * w + 1]).toBe(0);
    // Edge pixels are in between (feathered), and the alpha never goes outside 0..1.
    const edge = a[12 * w + 6];
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(1);
    for (const v of a) expect(v >= 0 && v <= 1).toBe(true);
  });

  it('erodes: the matte is a little smaller than the raw mask (no halo)', () => {
    const w = 30;
    const h = 30;
    const raw = rectMask(w, h, { x: 5, y: 5, w: 20, h: 20 });
    const a = refineMask(raw, w, h, { feather: 0 });
    expect(a[15 * w + 5]).toBe(0); // the outermost column is gone
    expect(a[15 * w + 6]).toBe(1);
    expect(coverage(a)).toBeLessThan(coverage(raw));
  });

  it('drops a small stray speck but keeps the child', () => {
    const w = 40;
    const h = 40;
    const m = rectMask(w, h, { x: 10, y: 10, w: 20, h: 25 });
    m[2 * w + 2] = 0.9;
    m[2 * w + 3] = 0.9;
    const a = refineMask(m, w, h);
    expect(a[2 * w + 2]).toBe(0);
    expect(a[20 * w + 20]).toBeCloseTo(1, 5);
  });

  it('turns low confidence into clear background, not a grey veil', () => {
    const w = 10;
    const h = 10;
    const a = refineMask(new Float32Array(w * h).fill(0.2), w, h);
    expect(coverage(a)).toBe(0);
  });

  it('rejects a mask of the wrong size', () => {
    expect(() => refineMask(new Float32Array(10), 4, 4)).toThrow();
  });
});

describe('helpers', () => {
  it('keepMainBlobs keeps two big blobs (two children) and their soft edges', () => {
    const w = 30;
    const h = 10;
    const m = rectMask(w, h, { x: 2, y: 2, w: 8, h: 6 });
    for (let y = 2; y < 8; y++) for (let x = 18; x < 27; x++) m[y * w + x] = 1;
    m[5 * w + 1] = 0.4; // soft edge next to a kept blob
    const k = keepMainBlobs(m, w, h);
    expect(k[5 * w + 4]).toBe(1);
    expect(k[5 * w + 20]).toBe(1);
    expect(k[5 * w + 1]).toBeCloseTo(0.4);
  });

  it('boxBlur preserves a constant image and the total mass of a dot (away from edges)', () => {
    const c = boxBlur(new Float32Array(25).fill(0.5), 5, 5, 1);
    for (const v of c) expect(v).toBeCloseTo(0.5);
    const d = new Float32Array(81);
    d[40] = 9;
    const b = boxBlur(d, 9, 9, 1);
    expect(b.reduce((s, v) => s + v, 0)).toBeCloseTo(9);
    expect(b[40]).toBeCloseTo(1);
  });

  it('minFilter erodes by the radius', () => {
    const m = rectMask(9, 9, { x: 2, y: 2, w: 5, h: 5 });
    const e = minFilter(m, 9, 9, 1);
    expect(e[2 * 9 + 2]).toBe(0);
    expect(e[3 * 9 + 3]).toBe(1);
  });

  it('maskBox finds the person and tells a bust from a whole body', () => {
    const bust = maskBox(rectMask(20, 20, { x: 4, y: 6, w: 10, h: 14 }), 20, 20)!;
    expect(bust).toMatchObject({ x: 4, y: 6, w: 10, h: 14, touchesBottom: true });
    const body = maskBox(rectMask(20, 20, { x: 4, y: 2, w: 10, h: 12 }), 20, 20)!;
    expect(body.touchesBottom).toBe(false);
    expect(maskBox(new Float32Array(16), 4, 4)).toBeNull();
  });

  it('ovalMask is opaque in the middle and clear in the corners', () => {
    const o = ovalMask(40, 50);
    expect(o[26 * 40 + 20]).toBe(1);
    expect(o[0]).toBe(0);
  });

  it('quickMatte and alphaToRGBA', () => {
    const q = quickMatte(new Float32Array([0, 0.55, 1]));
    expect(q[0]).toBe(0);
    expect(q[1]).toBeCloseTo(0.5);
    expect(q[2]).toBe(1);
    expect(Array.from(alphaToRGBA(new Float32Array([0, 1])))).toEqual([255, 255, 255, 0, 255, 255, 255, 255]);
  });
});
