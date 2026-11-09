import { describe, expect, it } from 'vitest';
import { checkAnswer, FIX_IDS, FIXES, makePuzzle, validateFixParams, type FixId } from './fixes';
import { CHIRAL_SHAPES, mirrorCells, sameUpToRotation } from './fixes/rotate';
import { oddCandidates } from './fixes/sort';
import { walk } from './fixes/path';
import { makeRng } from './rand';
import { puzzleWithinCaps } from './rooms';
import { BANDS } from './types';

/** Params a room might pass, per fix (several variants each). */
const VARIANTS: Record<FixId, Record<string, unknown>[]> = {
  'count-back': [{ item: 'sock' }, { item: 'plate', mode: 'extra' }, { item: 'cookie', mode: 'share' }],
  sort: [{ by: 'color' }, { by: 'shape' }, { by: 'size' }, { by: 'category' }],
  pair: [{ item: 'sock' }, { item: 'boot', mode: 'left-right' }, { item: 'frame', mode: 'shadow' }],
  order: [{ by: 'size' }, { by: 'number' }, { by: 'alphabet' }, { by: 'days' }, { by: 'ordinal' }, { by: 'skip' }],
  pattern: [{ theme: 'colors' }, { theme: 'notes' }, { theme: 'shapes' }, { theme: 'numbers' }],
  place: [{ item: 'teddy', anchor: 'pillow' }, { item: 'star', anchor: 'sign' }],
  path: [{}],
  rotate: [{ item: 'cup' }],
  'name-it': [{ item: 'whisk', words: ['whisk', 'spoon', 'pot'] }, {}],
  clock: [{}],
};

const SEEDS = 150;

describe('fix mechanic plug-ins', () => {
  it('all ten mechanics are registered', () => {
    expect([...FIX_IDS].sort()).toEqual(['clock', 'count-back', 'name-it', 'order', 'pair', 'path', 'pattern', 'place', 'rotate', 'sort']);
  });

  for (const fix of FIX_IDS) {
    describe(fix, () => {
      for (const band of BANDS) {
        it(`${band}: solvable 10–20 s puzzles within the band caps, across seeds`, () => {
          for (const params of VARIANTS[fix]) {
            expect(validateFixParams(fix, params)).toEqual([]);
            for (let seed = 0; seed < SEEDS; seed++) {
              const p = makePuzzle(fix, { band, rng: makeRng(seed), params, roomWords: ['whisk', 'spoon', 'cup', 'plate'] });
              const tag = `${fix}/${band}/${JSON.stringify(params)}/seed ${seed}`;
              expect(p.fix).toBe(fix);
              expect(p.band).toBe(band);
              expect(p.prompt.fr.trim() && p.prompt.en.trim(), tag).toBeTruthy();
              expect(p.prompt.fr).not.toMatch(/\{\w+\}/);
              expect(p.prompt.en).not.toMatch(/\{\w+\}/);
              expect(p.seconds, tag).toBeGreaterThanOrEqual(10);
              expect(p.seconds, tag).toBeLessThanOrEqual(20);
              expect(puzzleWithinCaps(p), tag).toBe(true);
              const sol = FIXES[fix].solve(p);
              expect(checkAnswer(p, sol, 1), tag).toMatchObject({ solved: true });
              const wrong = FIXES[fix].wrong(p, makeRng(seed + 1));
              expect(checkAnswer(p, wrong, 1).solved, `${tag} wrong=${JSON.stringify(wrong)}`).toBe(false);
              // the puzzle is plain JSON (saved / sent to the HUD)
              expect(JSON.parse(JSON.stringify(p))).toEqual(p);
            }
          }
        });
      }

      it('a wrong answer gives help that grows, the elf takes the blame, level 3 shows the answer', () => {
        const p = makePuzzle(fix, { band: 'middle', rng: makeRng(4), params: VARIANTS[fix][0] });
        const wrong = FIXES[fix].wrong(p, makeRng(9));
        const levels = [1, 2, 3, 7].map((t) => checkAnswer(p, wrong, t));
        for (const c of levels) {
          if (c.solved) throw new Error('wrong answer accepted');
          expect(c.hint.fr && c.hint.en).toBeTruthy();
          expect(c.blame.fr && c.blame.en).toBeTruthy();
          expect(Object.keys(c)).not.toContain('failed');
        }
        expect(levels.map((c) => !c.solved && c.level)).toEqual([1, 2, 3, 3]);
        const l3 = levels[2];
        expect(!l3.solved && l3.reveal).toEqual(FIXES[fix].solve(p));
        // garbage from the UI never throws, it just gets a hint
        for (const junk of [undefined, null, 42, 'x', {}, [], [['a']]]) expect(checkAnswer(p, junk, 1).solved).toBe(false);
      });
    });
  }

  it('count-back stays ≤ 5 for little ones and uses the prank’s own count when it fits', () => {
    for (let seed = 0; seed < 100; seed++) {
      const p = makePuzzle('count-back', {
        band: 'little',
        rng: makeRng(seed),
        params: { item: 'sock' },
        prank: { id: 'x', type: 'move-into', culprit: 'pepin', changes: ['a', 'b', 'c', 'd'].map((id) => ({ prop: id, field: 'slot' as const, from: 'drawer', to: 'fridge' })) },
      });
      if (p.fix !== 'count-back') throw new Error();
      expect(p.solution).toBe(4);
      expect(p.choices).toContain(4);
      expect(p.choices.length).toBe(3);
    }
  });

  it('odd-one-out has exactly one odd item; mirror options never equal the shape', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const by of ['color', 'shape', 'size', 'category']) {
        const p = makePuzzle('sort', { band: 'big', rng: makeRng(seed), params: { by } });
        if (p.fix !== 'sort') throw new Error();
        expect(oddCandidates(p.items)).toEqual([p.solution]);
      }
    }
    for (const s of CHIRAL_SHAPES) expect(sameUpToRotation(s, mirrorCells(s))).toBe(false);
  });

  it('path steps never leave the grid', () => {
    for (const band of BANDS)
      for (let seed = 0; seed < 200; seed++) {
        const p = makePuzzle('path', { band, rng: makeRng(seed), params: {} });
        if (p.fix !== 'path') throw new Error();
        expect(walk(p.size, p.start, p.steps)).not.toBeNull();
      }
  });

  it('name-it big kids get the word in the other language', () => {
    const p = makePuzzle('name-it', { band: 'big', rng: makeRng(2), params: { item: 'whisk' } });
    if (p.fix !== 'name-it') throw new Error();
    expect(p.secondLanguage).toBe(true);
    expect(p.prompt.fr).toContain('whisk');
    expect(p.prompt.en).toContain('fouet');
  });

  it('unknown params are reported', () => {
    expect(validateFixParams('sort', { by: 'smell' }).length).toBe(1);
    expect(validateFixParams('path', { foo: 1 }).length).toBe(1);
    expect(validateFixParams('nope', {}).length).toBe(1);
  });
});
