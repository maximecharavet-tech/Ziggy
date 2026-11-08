import { describe, expect, it } from 'vitest';
import { applyAdjust, boothOutput, christmasYear, clampAdjust, coverTransform, fitInSlot, mapRect, NO_ADJUST, pinchAdjust, sanitizeSlot, ZOOM_MAX } from './layout';

const frame = { w: 800, h: 1000 };
const slot = { x: 420, y: 300, w: 300, h: 500 };

describe('fitInSlot', () => {
  it('stands a whole body in the slot, feet on its bottom edge, centred', () => {
    const r = fitInSlot({ w: 100, h: 300, touchesBottom: false }, slot, frame);
    expect(r.y + r.h).toBeCloseTo(800);
    expect(r.h).toBeCloseTo(500);
    expect(r.x + r.w / 2).toBeCloseTo(570);
    expect(r.w / r.h).toBeCloseTo(100 / 300); // aspect kept
  });

  it('fits a wide whole body by its width', () => {
    const r = fitInSlot({ w: 400, h: 200, touchesBottom: false }, slot, frame);
    expect(r.w).toBeLessThanOrEqual(300);
    expect(r.y + r.h).toBeCloseTo(800);
  });

  it('puts a bust on the bottom edge of the photo (its cut hidden), head near the slot top', () => {
    const r = fitInSlot({ w: 300, h: 300, touchesBottom: true }, slot, frame);
    expect(r.y + r.h).toBeCloseTo(1000);
    expect(r.y).toBeGreaterThanOrEqual(300 - 1);
    expect(r.w).toBeLessThanOrEqual(300 * 1.6 + 1e-6);
  });

  it('keeps the cut-out inside the photo horizontally', () => {
    const r = fitInSlot({ w: 200, h: 200, touchesBottom: true }, { x: 700, y: 300, w: 100, h: 400 }, frame);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(800 + 1e-6);
  });

  it('survives an empty person or slot', () => {
    expect(fitInSlot({ w: 0, h: 0, touchesBottom: false }, slot, frame).w).toBe(0);
  });
});

describe('adjust', () => {
  const base = { x: 100, y: 200, w: 200, h: 400 };
  it('zooms around the bottom centre', () => {
    const r = applyAdjust(base, { dx: 0, dy: 0, zoom: 2 });
    expect(r.w).toBe(400);
    expect(r.y + r.h).toBe(600);
    expect(r.x + r.w / 2).toBe(200);
  });
  it('moves', () => {
    expect(applyAdjust(base, { dx: 10, dy: -20, zoom: 1 })).toEqual({ x: 110, y: 180, w: 200, h: 400 });
  });
  it('clamps zoom and keeps the child at least partly visible', () => {
    const a = clampAdjust({ dx: 99999, dy: -99999, zoom: 99 }, base, frame);
    expect(a.zoom).toBe(ZOOM_MAX);
    const r = applyAdjust(base, a);
    expect(r.x).toBeLessThan(frame.w);
    expect(r.y + r.h).toBeGreaterThan(0);
    expect(clampAdjust({ dx: NaN, dy: 0, zoom: NaN }, base, frame)).toEqual(NO_ADJUST);
  });
  it('pinch: spreading fingers zooms in, moving the midpoint moves', () => {
    const a = pinchAdjust(NO_ADJUST, 100, 150, { x: 0, y: 0 }, { x: 10, y: 5 });
    expect(a.zoom).toBeCloseTo(1.5);
    expect(a.dx).toBe(10);
    expect(a.dy).toBe(5);
  });
});

describe('backdrop mapping', () => {
  it('cover-maps a wide canvas into the 4:5 photo and the slot with it', () => {
    const t = coverTransform({ w: 1000, h: 500 }, frame);
    expect(t.scale).toBe(2);
    expect(t.oy).toBe(0);
    expect(t.ox).toBe(-600);
    expect(mapRect({ x: 500, y: 0, w: 100, h: 100 }, t)).toEqual({ x: 400, y: 0, w: 200, h: 200 });
  });
  it('sanitizes a missing or out-of-canvas slot', () => {
    expect(sanitizeSlot(null, frame).w).toBeGreaterThan(0);
    expect(sanitizeSlot({ x: -100, y: 0, w: 300, h: 400 }, frame)).toEqual({ x: 0, y: 0, w: 200, h: 400 });
    expect(sanitizeSlot({ x: 5000, y: 0, w: 10, h: 10 }, frame).x).toBe(400);
  });
});

describe('boothOutput (watermark by tier)', () => {
  it('free: medium size, watermark, no video', () => {
    expect(boothOutput(null)).toEqual({ width: 800, height: 1000, watermark: true, video: false });
    expect(boothOutput(undefined).watermark).toBe(true);
  });
  it('any pass: HD, no watermark, video', () => {
    for (const t of ['essentiel', 'magique'] as const) expect(boothOutput(t)).toEqual({ width: 1600, height: 2000, watermark: false, video: true });
  });
  it('christmasYear: January belongs to the previous Christmas', () => {
    expect(christmasYear(new Date(2026, 11, 24))).toBe(2026);
    expect(christmasYear(new Date(2027, 0, 5))).toBe(2026);
  });
});
