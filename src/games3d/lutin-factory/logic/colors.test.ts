import { describe, expect, it } from 'vitest';
import { COLOR_ICON, mixColors } from './colors';
import { COLORS, PAINTS } from './types';

describe('colour mixing', () => {
  it('follows the paint table children learn', () => {
    const table: [string, string, string][] = [
      ['red', 'yellow', 'orange'],
      ['yellow', 'blue', 'green'],
      ['red', 'blue', 'purple'],
      ['orange', 'blue', 'brown'],
      ['green', 'red', 'brown'],
      ['purple', 'yellow', 'brown'],
      ['red', 'orange', 'orange'],
      ['blue', 'green', 'green'],
      ['red', 'red', 'red'],
      ['brown', 'yellow', 'brown'],
    ];
    for (const [a, b, c] of table) expect(mixColors(a as never, b as never), `${a}+${b}`).toBe(c);
  });

  it('is symmetric and idempotent for every pair', () => {
    for (const a of COLORS) {
      expect(mixColors(a, a)).toBe(a);
      for (const b of COLORS) expect(mixColors(a, b)).toBe(mixColors(b, a));
    }
  });

  it('every painter colour and brown has an icon (colour-blind safe)', () => {
    for (const c of [...PAINTS, 'brown' as const]) expect(COLOR_ICON[c]).toBeTruthy();
  });
});
