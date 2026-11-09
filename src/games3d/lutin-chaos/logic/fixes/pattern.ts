/**
 * pattern: finish the garland. little: ABAB, 1 blank · middle: ABC or AABB,
 * 1–2 blanks · big: growing pattern (AB ABB ABBB) or a number rule, 2 blanks.
 * Themes: colours (baubles, tiles), notes (high / low, music room), shapes, numbers.
 */
import { int, pick, sample, shuffle } from '../rand';
import { FIX_TEXT, HINT } from '../texts';
import { BRIGHT, SHAPES } from '../vocab';
import { defineFix, isStrArr, type BasePuzzle } from './define';

export type PatternTheme = 'colors' | 'shapes' | 'notes' | 'numbers';

export interface PatternPuzzle extends BasePuzzle {
  fix: 'pattern';
  theme: PatternTheme;
  rule: 'ABAB' | 'ABC' | 'AABB' | 'growing' | 'plus';
  /** The garland with `null` in the gaps. */
  sequence: (string | null)[];
  blanks: number[];
  choices: string[];
  solution: string[];
}

const NOTES = ['high', 'mid', 'low'];

function tokens(theme: PatternTheme, n: number, rng: () => number): string[] {
  if (theme === 'shapes') return sample(rng, SHAPES.map((s) => s.id), n);
  if (theme === 'notes') return sample(rng, NOTES, n);
  return sample(rng, BRIGHT, n);
}

export const patternFix = defineFix<PatternPuzzle, string[]>({
  id: 'pattern',
  label: { fr: 'Suites et motifs', en: 'Patterns' },
  icon: '🎄',
  goal: 'patterns',
  params: { theme: { type: 'string', values: ['colors', 'shapes', 'notes', 'numbers'] } },
  make(ctx) {
    const { band, rng } = ctx;
    const theme = (typeof ctx.params.theme === 'string' ? ctx.params.theme : 'colors') as PatternTheme;
    let rule: PatternPuzzle['rule'];
    let full: string[];
    let nBlanks: number;
    let pool: string[];

    if (band === 'little') {
      rule = 'ABAB';
      const [a, b] = tokens(theme === 'numbers' ? 'colors' : theme, 2, rng);
      full = [a, b, a, b, a, b];
      nBlanks = 1;
      pool = [a, b];
    } else if (band === 'middle') {
      if (theme === 'notes' || rng() < 0.5) {
        rule = 'AABB';
        const [a, b] = tokens(theme === 'numbers' ? 'colors' : theme, 2, rng);
        full = [a, a, b, b, a, a, b, b];
      } else {
        rule = 'ABC';
        const [a, b, c] = tokens(theme === 'numbers' ? 'colors' : theme, 3, rng);
        full = [a, b, c, a, b, c, a, b, c];
      }
      nBlanks = int(rng, 1, 2);
      pool = [...new Set(full)];
    } else if (theme === 'numbers' || rng() < 0.4) {
      rule = 'plus';
      const step = int(rng, 2, 9);
      const start = int(rng, 1, 20);
      full = Array.from({ length: 6 }, (_, i) => String(start + step * i));
      nBlanks = 2;
      pool = [...full.slice(-2), String(start + step * 6), String(start + step * 5 - 1)];
    } else {
      rule = 'growing';
      const [a, b] = tokens(theme, 2, rng);
      full = [a, b, a, b, b, a, b, b, b];
      nBlanks = 2;
      pool = [a, b];
    }

    const blanks = Array.from({ length: nBlanks }, (_, i) => full.length - nBlanks + i);
    const solution = blanks.map((i) => full[i]);
    const visTheme: PatternTheme = theme === 'numbers' ? 'colors' : theme;
    const others = rule === 'plus' ? [] : tokens(visTheme, visTheme === 'notes' ? 3 : 5, rng).filter((t) => !pool.includes(t));
    const k = band === 'little' ? 2 : band === 'middle' ? 3 : 4;
    const choices = shuffle(rng, [...new Set([...pool, ...others])].slice(0, Math.max(k, pool.length)));
    for (const s of solution) if (!choices.includes(s)) choices.push(s);
    const sequence = full.map((t, i) => (blanks.includes(i) ? null : t));
    return {
      fix: 'pattern',
      band,
      prompt: nBlanks === 1 ? FIX_TEXT.patternNext : FIX_TEXT.patternGaps,
      seconds: band === 'little' ? 10 : band === 'middle' ? 13 + nBlanks : 17,
      goal: 'patterns',
      skill: theme === 'notes' ? 'music' : rule === 'plus' ? 'addition' : 'sequencing',
      theme: rule === 'plus' ? 'numbers' : visTheme,
      rule,
      sequence,
      blanks,
      choices,
      solution,
    };
  },
  solve: (p) => p.solution,
  isAnswer: isStrArr,
  check(p, a) {
    const off = p.blanks.filter((_, i) => a[i] !== p.solution[i]);
    if (off.length === 0) return { ok: true };
    return { ok: false, hints: [HINT.almost, HINT.lookAt], focus: off.map((i) => `blank-${i}`) };
  },
  wrong(p, rng) {
    return p.solution.map((s) => pick(rng, p.choices.filter((c) => c !== s).length ? p.choices.filter((c) => c !== s) : [s + 'x']));
  },
});
