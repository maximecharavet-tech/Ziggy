import { describe, expect, it } from 'vitest';
import {
  buildPairDeck,
  cleanSequence,
  digTilesFor,
  helpMove,
  hexToRgb,
  isOrderCorrect,
  isSolvable,
  isSolved,
  mixHex,
  moveTile,
  orderCorrectPositions,
  readableOn,
  runnerLanes,
  sameMultiset,
  shuffle,
  shuffleBoard,
  shuffleNotIdentity,
  slideMistakes,
  solvedBoard,
  spellLetters,
  stepTrail,
  swap,
} from './logic';
import { ARCADE_UI, ui } from './ui-text';

/** Small deterministic RNG (mulberry32). */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('ui text', () => {
  it('has French and English for every key', () => {
    for (const [key, text] of Object.entries(ARCADE_UI)) {
      expect(text.fr, key).toBeTruthy();
      expect(text.en, key).toBeTruthy();
    }
  });
  it('picks the locale and falls back to English', () => {
    expect(ui('almost', 'fr')).toBe('Presque !');
    expect(ui('almost', 'en')).toBe('Almost!');
    expect(ui('almost', 'de')).toBe('Almost!');
    expect(ui('missing-key', 'fr')).toBe('missing-key');
  });
});

describe('shuffle helpers', () => {
  it('keeps every element', () => {
    const out = shuffle([1, 2, 3, 4, 5], seeded(1));
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it('never returns the original order when another exists', () => {
    for (let s = 0; s < 50; s++) {
      expect(shuffleNotIdentity(['a', 'b', 'c'], seeded(s))).not.toEqual(['a', 'b', 'c']);
    }
    expect(shuffleNotIdentity(['a', 'a'], seeded(3))).toEqual(['a', 'a']);
  });
});

describe('colour mixing', () => {
  it('parses hex', () => {
    expect(hexToRgb('#FF8000')).toEqual([255, 128, 0]);
    expect(hexToRgb('#f00')).toEqual([255, 0, 0]);
  });
  it('averages RGB', () => {
    expect(mixHex(['#FF0000', '#0000FF'])).toBe('#800080');
    expect(mixHex(['#FFFFFF'])).toBe('#FFFFFF');
    expect(mixHex([])).toBeNull();
  });
  it('compares recipes as multisets', () => {
    expect(sameMultiset(['red', 'yellow'], ['yellow', 'red'])).toBe(true);
    expect(sameMultiset(['red', 'red', 'blue'], ['red', 'blue', 'blue'])).toBe(false);
    expect(sameMultiset(['red'], ['red', 'red'])).toBe(false);
  });
  it('chooses readable text', () => {
    expect(readableOn('#FFFFFF')).toBe('#1A1A2E');
    expect(readableOn('#1A1A2E')).toBe('#FFFFFF');
  });
});

describe('order checking', () => {
  const steps = ['wake', 'wash', 'eat'];
  it('detects the right order', () => {
    expect(isOrderCorrect(['wake', 'wash', 'eat'], steps)).toBe(true);
    expect(isOrderCorrect(['wash', 'wake', 'eat'], steps)).toBe(false);
  });
  it('marks positions already right', () => {
    expect(orderCorrectPositions(['wash', 'wake', 'eat'], steps)).toEqual([false, false, true]);
  });
  it('swaps safely', () => {
    expect(swap([1, 2, 3], 0, 2)).toEqual([3, 2, 1]);
    expect(swap([1, 2, 3], 0, 9)).toEqual([1, 2, 3]);
  });
});

describe('spell, pairs, dig, melody, runner', () => {
  it('spells letters without spaces, case-insensitively', () => {
    expect(spellLetters('Ice cream')).toEqual(['I', 'C', 'E', 'C', 'R', 'E', 'A', 'M']);
  });
  it('builds a deck with two cards per pair', () => {
    const deck = buildPairDeck(
      [
        ['🐶', 'dog'],
        ['🐱', 'cat'],
      ],
      seeded(2),
    );
    expect(deck).toHaveLength(4);
    expect(new Set(deck.map((c) => c.id)).size).toBe(4);
    expect(deck.filter((c) => c.pairId === 0).map((c) => c.text).sort()).toEqual(['dog', '🐶'].sort());
  });
  it('uncovers more sand for right answers and all of it over a perfect run', () => {
    expect(digTilesFor(true, 16, 5)).toBe(4);
    expect(digTilesFor(false, 16, 5)).toBe(1);
    expect(digTilesFor(true, 16, 5) * 5).toBeGreaterThanOrEqual(16);
  });
  it('clamps melody notes to the 5 pads', () => {
    expect(cleanSequence([0, 4, 5, -1, 2.2])).toEqual([0, 4, 0, 4, 2]);
  });
  it('fits runner questions into lanes, keeping the answer', () => {
    expect(runnerLanes(['a', 'b', 'c'], 2)).toEqual({ options: ['a', 'b', 'c'], answer: 2 });
    const many = runnerLanes(['a', 'b', 'c', 'd', 'e'], 4);
    expect(many.options).toHaveLength(4);
    expect(many.options[many.answer]).toBe('e');
  });
});

describe('slide puzzle', () => {
  it('starts solved and only moves tiles next to the hole', () => {
    const b = solvedBoard(3);
    expect(isSolved(b)).toBe(true);
    expect(moveTile(b, 3, 0)).toBeNull();
    const moved = moveTile(b, 3, 7)!;
    expect(moved[8]).toBe(8);
    expect(moved[7]).toBe(0);
  });

  it('always shuffles into a solvable, unsolved board', () => {
    for (const size of [3, 4] as const) {
      for (let s = 0; s < 40; s++) {
        const { board } = shuffleBoard(size, size === 3 ? 24 : 40, seeded(s + size * 100));
        expect(isSolvable(board, size)).toBe(true);
        expect(isSolved(board)).toBe(false);
        expect([...board].sort((a, b) => a - b)).toEqual(solvedBoard(size).sort((a, b) => a - b));
      }
    }
  });

  it('detects unsolvable boards', () => {
    const b = solvedBoard(3);
    [b[0], b[1]] = [b[1], b[0]];
    expect(isSolvable(b, 3)).toBe(false);
    const c = solvedBoard(4);
    [c[0], c[1]] = [c[1], c[0]];
    expect(isSolvable(c, 4)).toBe(false);
  });

  it('help walks back to the solution, even after the child wanders', () => {
    const rng = seeded(7);
    let { board, trail } = shuffleBoard(4, 40, rng);
    // A few child moves first.
    for (let k = 0; k < 15; k++) {
      const hole = board.indexOf(0);
      const opts = [hole - 4, hole + 4, hole - 1, hole + 1].filter((i) => moveTile(board, 4, i));
      const pick = opts[Math.floor(rng() * opts.length)];
      board = moveTile(board, 4, pick)!;
      trail = stepTrail(trail, pick);
    }
    let guard = 0;
    while (!isSolved(board) && guard++ < 500) {
      const m = helpMove(trail)!;
      board = moveTile(board, 4, m)!;
      expect(board).not.toBeNull();
      trail = stepTrail(trail, m);
    }
    expect(isSolved(board)).toBe(true);
    expect(helpMove(trail)).toBeNull();
  });

  it('counts only generous extra moves as mistakes', () => {
    expect(slideMistakes(10, 3)).toBe(0);
    expect(slideMistakes(48, 3)).toBe(0);
    expect(slideMistakes(48 + 18, 3)).toBe(2);
    expect(slideMistakes(10_000, 4)).toBe(5);
  });
});
