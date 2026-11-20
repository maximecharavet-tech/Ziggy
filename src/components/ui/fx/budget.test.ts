import { describe, expect, it } from 'vitest';
import { allowedParticles, CAPS, LOW_POWER_SHARE, stagePixelRatio } from './budget';

describe('particle budget', () => {
  it('gives nothing under reduced motion', () => {
    expect(allowedParticles(80, { lowPower: false, reducedMotion: true, alive: 0 })).toBe(0);
  });

  it('caps one effect and the whole stage', () => {
    expect(allowedParticles(10_000, { lowPower: false, reducedMotion: false, alive: 0 })).toBe(CAPS.normal.perEffect);
    expect(allowedParticles(100, { lowPower: false, reducedMotion: false, alive: CAPS.normal.global - 30 })).toBe(30);
    expect(allowedParticles(100, { lowPower: false, reducedMotion: false, alive: CAPS.normal.global + 5 })).toBe(0);
  });

  it('halves the request on a weak device and uses the lower caps', () => {
    expect(allowedParticles(80, { lowPower: true, reducedMotion: false, alive: 0 })).toBe(Math.round(80 * LOW_POWER_SHARE));
    expect(allowedParticles(10_000, { lowPower: true, reducedMotion: false, alive: 0 })).toBe(CAPS.low.perEffect);
    expect(CAPS.low.global).toBeLessThan(CAPS.normal.global);
  });

  it('ignores nonsense requests', () => {
    expect(allowedParticles(-5, { lowPower: false, reducedMotion: false, alive: 0 })).toBe(0);
    expect(allowedParticles(Number.NaN, { lowPower: false, reducedMotion: false, alive: 0 })).toBe(0);
  });

  it('keeps the canvas resolution cheap', () => {
    expect(stagePixelRatio(3, false)).toBe(1.5);
    expect(stagePixelRatio(3, true)).toBe(1);
    expect(stagePixelRatio(1, false)).toBe(1);
    expect(stagePixelRatio(Number.NaN, false)).toBe(1);
  });
});
