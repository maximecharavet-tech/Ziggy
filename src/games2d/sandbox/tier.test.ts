import { describe, expect, it } from 'vitest';
import { createTierGovernor, type Tier } from './tier';

/** Feeds `frames` frames of `ms` each; returns every tier change. */
function feed(g: ReturnType<typeof createTierGovernor>, ms: number | ((k: number) => number), frames: number): Tier[] {
  const out: Tier[] = [];
  for (let k = 0; k < frames; k++) {
    const t = g.push(typeof ms === 'number' ? ms : ms(k));
    if (t) out.push(t);
  }
  return out;
}

/** A slow scene on the current tier until it steps down once. */
function slowUntilDrop(g: ReturnType<typeof createTierGovernor>, ms = 9.5) {
  const from = g.tier;
  for (let k = 0; k < 1000 && g.tier === from; k++) g.push(ms);
}

describe('adaptive sandbox quality', () => {
  it('stays on the high tier while the frames fit the 8 ms budget', () => {
    const g = createTierGovernor('high');
    expect(feed(g, (k) => 5 + (k % 5) * 0.5, 2000)).toEqual([]);
    expect(g.tier).toBe('high');
  });

  it('drops one tier once the median stays above 8 ms for a short window, not for a lone spike', () => {
    const g = createTierGovernor('high');
    // A slow frame now and then (a GC, a tab switch) is ignored.
    expect(feed(g, (k) => (k % 9 === 0 ? 40 : 6), 600)).toEqual([]);
    // Busy scene: ~9 ms per frame. Drops after the window fills and three checks agree (< 1.5 s at 60 Hz).
    const changes: Tier[] = [];
    let at = -1;
    for (let k = 0; k < 300 && at < 0; k++) {
      const t = g.push(9.2);
      if (t) {
        changes.push(t);
        at = k;
      }
    }
    expect(changes).toEqual(['low']);
    expect(at).toBeGreaterThan(30);
    expect(at).toBeLessThan(90);
    expect(g.median).toBeGreaterThan(8);
  });

  it('keeps going down to the rescue tier if needed, and never below', () => {
    const g = createTierGovernor('high');
    expect(feed(g, 20, 1000)).toEqual(['low', 'rescue']);
    expect(g.tier).toBe('rescue');
  });

  it('comes back up with hysteresis: only when well under budget for a while, never above the start', () => {
    const g = createTierGovernor('high');
    slowUntilDrop(g);
    expect(g.tier).toBe('low');
    // 6 ms on the low tier is under budget but not "well under" (< 4.4 ms): it stays low.
    expect(feed(g, 6, 3000)).toEqual([]);
    // A calm scene: 3 ms. It climbs back after a long quiet stretch (> 3 s), not at once.
    let at = -1;
    for (let k = 0; k < 2000 && at < 0; k++) if (g.push(3)) at = k;
    expect(g.tier).toBe('high');
    expect(at).toBeGreaterThan(180);
    // A low-tier device never climbs to the high tier.
    const small = createTierGovernor('low');
    expect(feed(small, 2, 3000)).toEqual([]);
    expect(small.tier).toBe('low');
  });

  it('does not flicker: a climb that has to be undone makes the next climb wait twice as long', () => {
    const g = createTierGovernor('high');
    slowUntilDrop(g);
    const waits: number[] = [];
    for (let round = 0; round < 3; round++) {
      // Quiet on the low tier until it climbs…
      let k = 0;
      while (g.tier === 'low' && k < 20000) {
        g.push(3);
        k++;
      }
      waits.push(k);
      // …then the high tier is too slow again: down it goes.
      slowUntilDrop(g);
      expect(g.tier).toBe('low');
    }
    // (The 45 frames that refill the median window are not part of the doubled wait.)
    expect(waits[1] - 45).toBeGreaterThanOrEqual((waits[0] - 45) * 2 - 15);
    expect(waits[2] - 45).toBeGreaterThanOrEqual((waits[1] - 45) * 2 - 15);
  });

  it('starts where it was before the world was rebuilt, never above the device tier', () => {
    expect(createTierGovernor('high', { at: 'low' }).tier).toBe('low');
    expect(createTierGovernor('low', { at: 'high' }).tier).toBe('low');
  });

  it('ignores nonsense measurements', () => {
    const g = createTierGovernor('low');
    expect(feed(g, Number.NaN, 500)).toEqual([]);
    expect(feed(g, -1, 500)).toEqual([]);
    expect(g.tier).toBe('low');
  });
});
