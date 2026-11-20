import { describe, expect, it } from 'vitest';
import {
  boingFrames,
  CELEBRATE_COOLDOWN_MS,
  encourageFrames,
  framesMs,
  JUICE_MS,
  juicePlan,
  popFrames,
  squashStretchFrames,
  wiggleFrames,
  type JuiceKind,
} from './juice';
import { createRateLimit } from './rate-limit';

const num = (s: string, re: RegExp) => Number(re.exec(s)![1]);

describe('juice timing', () => {
  it('interface feedback is short and celebrations stay within 2 s', () => {
    for (const k of ['press', 'hover'] as JuiceKind[]) expect(JUICE_MS[k]).toBeLessThanOrEqual(300);
    for (const k of Object.keys(JUICE_MS) as JuiceKind[]) expect(JUICE_MS[k]).toBeLessThanOrEqual(2000);
  });

  it('every plan plays its sound with the first frame and starts everything inside its duration', () => {
    for (const k of Object.keys(JUICE_MS) as JuiceKind[]) {
      const { steps, duration } = juicePlan(k);
      expect(steps.find((s) => s.do === 'sound')?.at).toBe(0);
      for (const s of steps) expect(s.at).toBeLessThan(duration);
      expect(duration).toBeLessThanOrEqual(2000);
    }
  });

  it('reduced motion keeps the sound and drops every movement and particle', () => {
    for (const k of Object.keys(JUICE_MS) as JuiceKind[]) {
      const { steps } = juicePlan(k, { reduced: true });
      expect(steps.map((s) => s.do)).toEqual(['sound']);
    }
  });

  it('a celebration inside the cooldown is a small sparkle, not another confetti storm', () => {
    const full = juicePlan('celebrate', { cooledDown: true });
    const soon = juicePlan('celebrate', { cooledDown: false });
    expect(full.steps.some((s) => s.do === 'confetti')).toBe(true);
    expect(soon.steps.some((s) => s.do === 'confetti')).toBe(false);
    expect(soon.duration).toBeLessThan(full.duration);
    expect(CELEBRATE_COOLDOWN_MS).toBeGreaterThanOrEqual(1000);
  });

  it('a celebration has at most one flash (the glow ring)', () => {
    const { steps } = juicePlan('celebrate', { cooledDown: true });
    expect(steps.filter((s) => s.do === 'glow')).toHaveLength(1);
  });
});

describe('juice keyframes', () => {
  it('press: squash first, then a springy stretch, ending at rest within its budget', () => {
    const f = squashStretchFrames(0.1);
    const sy = f.map((s) => num(s, /, ([\d.]+)\)/));
    expect(Math.min(...sy)).toBeCloseTo(0.9, 2);
    expect(Math.max(...sy)).toBeGreaterThan(1); // overshoot = stretch
    expect(f[f.length - 1]).toBe('scale(1, 1)');
    expect(framesMs(f, JUICE_MS.press)).toBeLessThanOrEqual(JUICE_MS.press);
  });

  it('pop and encourage come back to rest', () => {
    expect(popFrames().at(-1)).toBe('scale(1)');
    expect(encourageFrames().at(-1)).toBe('translateY(0px)');
    expect(encourageFrames().every((f) => num(f, /translateY\((-?[\d.]+)px\)/) <= 0.5)).toBe(true); // only ever up: a nod, not a drop
  });

  it('the wiggle tilts and swells but never slides sideways (no "no" shake)', () => {
    const f = wiggleFrames(7);
    expect(f.every((s) => !/translateX/.test(s))).toBe(true);
    expect(Math.max(...f.map((s) => Math.abs(num(s, /rotate\((-?[\d.]+)deg\)/))))).toBeLessThanOrEqual(7);
    expect(f.at(-1)).toMatch(/^rotate\(0deg\)/);
  });

  it('boing starts and ends at rest', () => {
    const f = boingFrames();
    expect(f[0]).toBe('translateY(0px) scale(1, 1)');
    expect(f.at(-1)).toBe('translateY(0px) scale(1, 1)');
  });
});

describe('rate limit', () => {
  it('lets at most N through per second', () => {
    const limit = createRateLimit({ perSecond: 10 });
    let n = 0;
    for (let t = 0; t < 1000; t += 5) if (limit.take(t)) n++;
    expect(n).toBe(10);
  });

  it('respects a minimum gap', () => {
    const limit = createRateLimit({ minGapMs: 100 });
    expect(limit.take(0)).toBe(true);
    expect(limit.take(50)).toBe(false);
    expect(limit.take(100)).toBe(true);
  });
});
