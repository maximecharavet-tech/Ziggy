import { describe, expect, it } from 'vitest';
import { CHALLENGES, MELODY, ROWS, TUNES, decode, emptySong, encode, hasStairs, noteCount, resize, surprise, toggle, tuneToSong } from './song';

describe('La Fabrique à chansons', () => {
  it('toggles notes immutably', () => {
    const a = emptySong(8);
    const b = toggle(a, 2, 3);
    expect(a.grid[2][3]).toBe(false);
    expect(b.grid[2][3]).toBe(true);
    expect(noteCount(toggle(b, 2, 3))).toBe(0);
  });

  it('shares songs as a short code, round trip', () => {
    for (let seed = 0; seed < 30; seed++) {
      const s = surprise(seed, seed % 2 ? 16 : 8, 'flute');
      const code = encode(s);
      expect(code.length).toBeLessThan(60);
      expect(decode(code)).toEqual(s);
    }
  });

  it('rejects broken or hostile codes', () => {
    expect(decode('')).toBeNull();
    expect(decode('8.100.0.zz')).toBeNull();
    expect(decode(`9.100.0.${'0.'.repeat(ROWS - 1)}0`)).toBeNull();
    expect(decode(`8.999.0.${'0.'.repeat(ROWS - 1)}0`)).toBeNull();
    expect(decode(`8.100.0.<script>.${'0.'.repeat(ROWS - 2)}0`)).toBeNull();
  });

  it('resizes 8 → 16 by repeating, and back', () => {
    const s = toggle(emptySong(8), 0, 1);
    const l = resize(s, 16);
    expect(l.grid[0][1]).toBe(true);
    expect(l.grid[0][9]).toBe(true);
    expect(resize(l, 8).grid[0]).toEqual(s.grid[0]);
  });

  it('loads the nursery tunes', () => {
    for (const t of TUNES) {
      const s = tuneToSong(t);
      expect(noteCount(s)).toBeGreaterThan(8);
      // At most one melody note per step: a single voice.
      for (let step = 0; step < 16; step++) expect(s.grid.slice(0, MELODY.length).filter((r) => r[step]).length).toBeLessThanOrEqual(1);
    }
  });

  it('detects the challenges', () => {
    let s = emptySong(8);
    for (let k = 0; k < 5; k++) s = toggle(s, 5 - k, k); // bear → bird: going up
    expect(hasStairs(s)).toBe(true);
    const repeat = resize(toggle(toggle(emptySong(8), 1, 0), 3, 2), 16);
    const r2 = toggle(toggle(repeat, 4, 4), 4, 12);
    expect(CHALLENGES.find((c) => c.id === 'repeat')!.check(r2)).toBe(true);
    let d = emptySong(8);
    for (const k of [0, 2, 4, 6]) d = toggle(d, MELODY.length + 2, k);
    expect(CHALLENGES.find((c) => c.id === 'four_drums')!.check(d)).toBe(true);
  });
});
