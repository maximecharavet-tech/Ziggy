import { describe, expect, it } from 'vitest';
import {
  BUBBLES,
  MODE_BY_BAND,
  PROPS,
  SKILL_BY_BAND,
  WORD_LISTS,
  baseLetter,
  checkGate,
  cheerLine,
  finishLine,
  hintLine,
  isTricky,
  oopsLine,
  optionLines,
  pacing,
  planRun,
  questionLines,
  reshuffle,
  scoreRun,
  unitsOf,
  wordDoneLine,
  wordSlots,
  wordsPerRun,
  type Band,
  type Locale,
} from './logic';
import { LEARNING_SKILLS } from '@/lib/learning/skills';
import { classify } from '@/lib/safety/policy';

const BANDS: Band[] = ['little', 'middle', 'big'];
const LOCALES: Locale[] = ['fr', 'en'];
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 3);

describe('Kart des lettres — word lists', () => {
  it('every word is spelled by its units, with a known 3D object and a picture', () => {
    for (const band of BANDS)
      for (const locale of LOCALES)
        for (const x of WORD_LISTS[band][locale]) {
          const units = unitsOf(x, locale);
          expect(units.join(''), x.w).toBe(x.w.toLocaleUpperCase(locale));
          expect(PROPS).toContain(x.prop);
          expect(x.emoji.length).toBeGreaterThan(0);
          if (band === 'big') expect(units.some(isTricky), x.w).toBe(x.w === 'penguin' ? false : true);
        }
  });

  it('French and English lists are separate (the word follows the language)', () => {
    for (const band of BANDS) {
      expect(WORD_LISTS[band].fr.length).toBeGreaterThanOrEqual(12);
      expect(WORD_LISTS[band].en.length).toBeGreaterThanOrEqual(12);
      expect(WORD_LISTS[band].fr.some((x) => /[éèêâ]/.test(x.w))).toBe(true);
    }
  });
});

describe('Kart des lettres — a race', () => {
  it('has 4 to 6 distinct words, each gate with 3 different options and the answer once', () => {
    for (const band of BANDS)
      for (const locale of LOCALES)
        for (let level = 1; level <= 5; level++)
          for (const seed of SEEDS) {
            const run = planRun(seed, band, level, locale);
            expect(run.words.length).toBe(wordsPerRun(band, run.level));
            expect(run.words.length).toBeGreaterThanOrEqual(4);
            expect(run.words.length).toBeLessThanOrEqual(6);
            expect(new Set(run.words.map((w) => w.w)).size).toBe(run.words.length);
            expect(run.mode).toBe(MODE_BY_BAND[band]);
            for (const w of run.words) {
              expect(w.steps.length).toBeGreaterThan(0);
              for (const s of w.steps) {
                expect(new Set(s.options).size).toBe(3);
                expect(s.options.filter((o) => o === s.answer)).toHaveLength(1);
                expect(s.answer).toBe(w.units[s.slot]);
                expect(w.given[s.slot]).toBe(false);
                expect(checkGate(s, s.options.indexOf(s.answer))).toBe(true);
                expect(s.options.filter((_, i) => checkGate(s, i))).toHaveLength(1);
                // A wrong gate is never the same letter with or without its accent (except the big kids' accent gates).
                if (band !== 'big') for (const o of s.options) if (o !== s.answer) expect(baseLetter(o)).not.toBe(baseLetter(s.answer));
              }
              // Gates go left to right through the word.
              const slots = w.steps.map((s) => s.slot);
              expect([...slots].sort((a, b) => a - b)).toEqual(slots);
            }
          }
  }, 60000);

  it('follows the age: first letter (little), whole word (middle), tricky sounds (big)', () => {
    for (const locale of LOCALES)
      for (const seed of SEEDS) {
        const little = planRun(seed, 'little', 1, locale);
        for (const w of little.words) {
          expect(w.steps).toHaveLength(1);
          expect(w.steps[0].slot).toBe(0);
          expect(w.steps[0].answer).toMatch(/^[A-Z]$/);
          for (const o of w.steps[0].options) expect(o).toMatch(/^[A-Z]$/);
        }
        // Little ones: never twice the same first letter in a race.
        expect(new Set(little.words.map((w) => baseLetter(w.units[0]))).size).toBe(little.words.length);

        const m1 = planRun(seed, 'middle', 1, locale);
        for (const w of m1.words) {
          expect(Array.from(w.w).length).toBeLessThanOrEqual(4);
          expect(w.steps).toHaveLength(w.units.length);
          expect(w.ghost).toBe(true);
          // Easy spelling: the wrong gates are letters that are not in the word at all.
          for (const s of w.steps) for (const o of s.options) if (o !== s.answer) expect(w.units.map(baseLetter)).not.toContain(baseLetter(o));
        }
        const m4 = planRun(seed, 'middle', 4, locale);
        for (const w of m4.words) {
          expect(Array.from(w.w).length).toBeGreaterThanOrEqual(5);
          expect(w.ghost).toBe(false);
        }

        for (const level of [1, 2, 3, 4, 5]) {
          const big = planRun(seed, 'big', level, locale);
          for (const w of big.words) {
            expect(w.steps.length).toBeGreaterThanOrEqual(2);
            expect(w.steps.length).toBeLessThanOrEqual(level <= 2 ? 2 : 4);
            // Some letters stay given, so the word can be read.
            expect(w.given.some(Boolean)).toBe(true);
          }
          if (level <= 2) expect(big.words.flatMap((w) => w.steps).some((s) => isTricky(s.answer))).toBe(true);
        }
      }
  }, 60000);

  it('is calmer and wider for the little ones, and only a bit faster with level', () => {
    expect(pacing('little', 1).speed).toBeLessThan(pacing('middle', 1).speed);
    expect(pacing('middle', 1).speed).toBeLessThan(pacing('big', 1).speed);
    expect(pacing('little', 1).laneGap).toBeGreaterThan(pacing('big', 1).laneGap);
    expect(pacing('little', 1).firstGap).toBeGreaterThan(pacing('big', 1).firstGap);
    for (const b of BANDS) {
      expect(pacing(b, 4).speed).toBeGreaterThan(pacing(b, 1).speed);
      expect(pacing(b, 5).speed).toBeLessThan(14);
      // Always several seconds to choose a lane.
      expect(pacing(b, 5).stepGap).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('is the same race for the same seed', () => {
    expect(planRun(42, 'middle', 2, 'fr')).toEqual(planRun(42, 'middle', 2, 'fr'));
    expect(planRun(42, 'middle', 2, 'fr')).not.toEqual(planRun(43, 'middle', 2, 'fr'));
  });

  it('uses real learning skills', () => {
    for (const b of BANDS) expect(LEARNING_SKILLS).toContain(SKILL_BY_BAND[b]);
    expect(new Set(Object.values(SKILL_BY_BAND))).toEqual(new Set(['letters', 'reading', 'vocabulary']));
  });
});

describe('Kart des lettres — corkscrews and the word', () => {
  it('a gate that comes back keeps its letters, in new lanes', () => {
    const run = planRun(7, 'middle', 2, 'fr');
    for (const w of run.words)
      for (const s of w.steps)
        for (let k = 0; k < 6; k++) {
          const again = reshuffle(s, k);
          expect(again.answer).toBe(s.answer);
          expect([...again.options].sort()).toEqual([...s.options].sort());
          expect(again.options.indexOf(s.answer)).not.toBe(s.options.indexOf(s.answer));
        }
  });

  it('fills the word gate after gate', () => {
    const run = planRun(11, 'big', 3, 'fr');
    const w = run.words[0];
    const before = wordSlots(w, 0);
    expect(before.filter((x) => x === null)).toHaveLength(w.steps.length);
    expect(wordSlots(w, w.steps.length).join('')).toBe(w.word);
  });

  it('counts first tries as right and corkscrews as gentle mistakes', () => {
    expect(scoreRun([{ tries: 1 }, { tries: 2 }, { tries: 1 }, { tries: 3 }])).toEqual({ correct: 2, mistakes: 3, total: 4 });
  });
});

describe('Kart des lettres — what Ziggy says', () => {
  it('every line exists in French and English, is kind and safe', () => {
    const lines: string[] = [];
    for (const band of BANDS)
      for (const locale of LOCALES)
        for (const seed of SEEDS.slice(0, 6)) {
          const run = planRun(seed, band, 3, locale);
          for (const w of run.words) {
            lines.push(...questionLines(w, run.mode, locale), wordDoneLine(w, run.mode, locale));
            for (const s of w.steps) lines.push(...optionLines(s.options, locale), hintLine(w, s, run.mode, 1, locale), hintLine(w, s, run.mode, 2, locale));
          }
          lines.push(finishLine(run.words.length, run.mode, locale));
          for (let i = 0; i < 5; i++) lines.push(oopsLine(i, locale), cheerLine(i, locale));
        }
    for (const b of Object.values(BUBBLES)) lines.push(b.fr, b.en);
    for (const line of lines) {
      expect(line.trim().length).toBeGreaterThan(1);
      expect(classify(line), line).toBeNull();
      expect(line).not.toMatch(/perdu|raté|échec|faux|triste|lost|fail|wrong|sad|hurry|vite/i);
    }
  });

  it('the voice says words in lowercase (no spelled-out capitals) and reads the lanes in order', () => {
    const run = planRun(3, 'little', 1, 'fr');
    const q = questionLines(run.words[0], 'first', 'fr');
    expect(q.join(' ')).toContain(run.words[0].w);
    const o = optionLines(['C', 'M', 'L'], 'fr');
    expect(o).toEqual(['À gauche : C.', 'Au milieu : M.', 'À droite : L.']);
    expect(optionLines(['C', 'M', 'L'], 'en')[0]).toBe('Left: C.');
  });
});
