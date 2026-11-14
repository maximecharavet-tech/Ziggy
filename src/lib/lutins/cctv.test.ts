import { describe, expect, it } from 'vitest';
import { cctvCameraLabel, cctvLookFor, defaultCctvTime, focusFromSpots, formatCctvTime, hash32 } from './cctv';

describe('security-camera labels', () => {
  it('formats the timestamp per locale', () => {
    const d = new Date(2026, 11, 24, 3, 12, 47);
    expect(formatCctvTime(d, 'fr')).toBe('24/12/2026 03:12:47');
    expect(formatCctvTime(d, 'en')).toBe('2026-12-24 03:12:47');
  });

  it('names the camera in DVR capitals', () => {
    expect(cctvCameraLabel(2, 'Salon')).toBe('CAM 02 · SALON');
    expect(cctvCameraLabel(1, 'entrée  du  sapin')).toBe('CAM 01 · ENTREE DU SAPIN');
    expect(cctvCameraLabel(12, 'Chambre de Léa 🎄')).toBe('CAM 09 · CHAMBRE DE LEA');
    expect(cctvCameraLabel(Number.NaN, '🎄')).toBe('CAM 01');
  });

  it('catches the elves the night before the reveal, between 2 and 4 am, the same every time', () => {
    const e = { id: 'abc123', revealAt: new Date(2026, 11, 24, 6, 0).toISOString(), createdAt: new Date(2026, 11, 23, 21, 0).toISOString() };
    const t = defaultCctvTime(e);
    expect(t.getDate()).toBe(24);
    expect(t.getHours()).toBeGreaterThanOrEqual(2);
    expect(t.getHours()).toBeLessThan(4);
    expect(defaultCctvTime(e).getTime()).toBe(t.getTime());
    // Revealed right away in the evening → still "last night" before that day.
    const now = { ...e, revealAt: new Date(2026, 11, 23, 21, 30).toISOString() };
    expect(defaultCctvTime(now).getDate()).toBe(23);
    expect(defaultCctvTime({ id: 'x', revealAt: 'nope', createdAt: 'nope' }).getTime()).not.toBeNaN();
  });

  it('picks night vision at night', () => {
    expect(cctvLookFor(new Date(2026, 11, 24, 3))).toBe('night');
    expect(cctvLookFor(new Date(2026, 11, 24, 21))).toBe('night');
    expect(cctvLookFor(new Date(2026, 11, 24, 14))).toBe('grey');
  });

  it('aims the zoom at the marked elves', () => {
    expect(focusFromSpots(undefined, 1)).toBeNull();
    expect(focusFromSpots([], 1)).toBeNull();
    const r = focusFromSpots(
      [
        { id: 'pepin', x: 0.6, y: 0.7, r: 0.05 },
        { id: 'noisette', x: 0.8, y: 0.75, r: 0.04 },
      ],
      0.75,
    )!;
    expect(r.x).toBeCloseTo(0.55);
    expect(r.x + r.w).toBeCloseTo(0.84);
    expect(r.y).toBeCloseTo(0.7 - 0.05 * 0.75);
    const edge = focusFromSpots([{ id: 'pepin', x: 0.99, y: 0.01, r: 0.2 }], 1)!;
    expect(edge.x + edge.w).toBeLessThanOrEqual(1);
    expect(edge.y).toBeGreaterThanOrEqual(0);
    expect(hash32('abc')).toBe(hash32('abc'));
  });
});
