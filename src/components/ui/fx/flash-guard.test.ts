import { describe, expect, it } from 'vitest';
import { createFlashGuard, isSaturatedRed, MAX_FLASHES_PER_SECOND, safeFlashColor } from './flash-guard';

describe('flash guard (WCAG 2.3.1: at most 3 flashes in any second)', () => {
  it('never allows more than 3 flashes in any 1 s window, whatever the request rate', () => {
    const guard = createFlashGuard();
    const allowed: number[] = [];
    // Someone mashing a button 60 times a second for 5 s.
    for (let t = 0; t < 5000; t += 1000 / 60) if (guard.tryFlash(t)) allowed.push(t);
    for (const start of allowed) {
      const inWindow = allowed.filter((t) => t >= start && t < start + 1000).length;
      expect(inWindow).toBeLessThanOrEqual(MAX_FLASHES_PER_SECOND);
    }
    expect(allowed.length).toBeGreaterThan(5); // it still lets celebrations through
  });

  it('spaces flashes apart', () => {
    const guard = createFlashGuard();
    expect(guard.tryFlash(0)).toBe(true);
    expect(guard.tryFlash(100)).toBe(false);
    expect(guard.tryFlash(340)).toBe(true);
    expect(guard.recent(400)).toBe(2);
    expect(guard.recent(1500)).toBe(0);
  });

  it('spots saturated red and swaps it for a soft yellow', () => {
    expect(isSaturatedRed('#FF0000')).toBe(true);
    expect(isSaturatedRed('#E11D48')).toBe(true);
    expect(isSaturatedRed('#FBBF24')).toBe(false);
    expect(isSaturatedRed('#7FC85C')).toBe(false);
    expect(isSaturatedRed('#FFE4E6')).toBe(false); // a pale pink is fine
    expect(isSaturatedRed('not a colour')).toBe(false);
    expect(safeFlashColor('#FF0000')).toBe('#FFE58A');
    expect(safeFlashColor('#5FB6EA')).toBe('#5FB6EA');
  });
});
