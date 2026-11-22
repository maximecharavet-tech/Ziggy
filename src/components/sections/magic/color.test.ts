import { describe, expect, it } from 'vitest';
import { contrast, deepFor, inkFor } from './color';
import { GAMES } from '@/lib/games';
import { AGENTS } from '@/lib/agents';

describe('magic colours', () => {
  it('measures contrast like WCAG', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrast('#22C55E', '#ffffff')).toBeLessThan(3);
  });

  it('keeps a tint that is already dark enough', () => {
    expect(deepFor('#6d3fd6')).toBe('#6d3fd6');
  });

  it('gives every game and agent colour a pill and a text ink that pass AA', () => {
    for (const { color } of [...GAMES, ...AGENTS]) {
      expect(contrast(deepFor(color), '#ffffff')).toBeGreaterThanOrEqual(4.5);
      expect(contrast(inkFor(color), '#ffffff')).toBeGreaterThanOrEqual(4.5);
    }
  });
});
