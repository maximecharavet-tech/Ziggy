/**
 * count-back: put N things back (socks out of the fridge). Also covers
 * "too many" (`mode: extra`, 5 plates for 3 guests) and fair sharing
 * (`mode: share`: share fairly / halves / quarters, room 11).
 * little ≤ 5 · middle ≤ 20 with + / − · big groups and × (or ½ ¼).
 */
import { int, pick } from '../rand';
import { FIX_TEXT, HINT, fill } from '../texts';
import type { L } from '../types';
import { many, word } from '../vocab';
import { defineFix, est, isNum, itemOf, numberChoices, type BasePuzzle } from './define';

export type CountMode = 'back' | 'left' | 'add' | 'groups' | 'extra' | 'share-fair' | 'half' | 'quarter';

export interface CountBackPuzzle extends BasePuzzle {
  fix: 'count-back';
  item: string;
  mode: CountMode;
  /** The numbers shown / spoken (total, done, a, b, groups, size, need, plates). */
  numbers: Record<string, number>;
  choices: number[];
  solution: number;
}

export const countBack = defineFix<CountBackPuzzle, number>({
  id: 'count-back',
  label: { fr: 'Compter et ranger', en: 'Count and put back' },
  icon: '🔢',
  goal: 'counting',
  params: {
    item: { type: 'string' },
    target: { type: 'string' },
    mode: { type: 'string', values: ['back', 'extra', 'share'] },
  },
  make(ctx) {
    const { band, rng } = ctx;
    const item = itemOf(ctx, 'sock');
    const items = many(word(item));
    const targetSlot = typeof ctx.params.target === 'string' ? ctx.params.target : undefined;
    const target: L = (targetSlot && ctx.slotLabel?.(targetSlot)) || { fr: 'à leur place', en: 'where they belong' };
    const kind = ctx.params.mode === 'extra' ? 'extra' : ctx.params.mode === 'share' ? 'share' : 'back';
    // the prank's own number when it fits the band (multiply: extra copies; move: how many moved)
    const prankN = (() => {
      const ch = ctx.prank?.changes ?? [];
      const c = ch.find((x) => x.field === 'count');
      if (c && typeof c.to === 'number' && typeof c.from === 'number') return c.to - c.from;
      const moved = new Set(ch.filter((x) => x.field === 'slot').map((x) => x.prop)).size;
      return moved || undefined;
    })();

    let mode: CountMode;
    let numbers: Record<string, number>;
    let solution: number;
    let prompt: L;
    let max: number;

    if (kind === 'share') {
      if (band === 'little') {
        const each = int(rng, 1, 2);
        numbers = { plates: 2, total: each * 2 };
        mode = 'share-fair';
        solution = each;
        prompt = fill(FIX_TEXT.shareFair, { ...numbers, items });
        max = 5;
      } else if (band === 'middle') {
        const half = int(rng, 3, 10);
        numbers = { total: half * 2 };
        mode = 'half';
        solution = half;
        prompt = fill(FIX_TEXT.shareHalf, { ...numbers, items });
        max = 20;
      } else {
        const q = int(rng, 2, 10);
        numbers = { total: q * 4 };
        mode = 'quarter';
        solution = q;
        prompt = fill(FIX_TEXT.shareQuarter, { ...numbers, items });
        max = 40;
      }
    } else if (kind === 'extra') {
      const cap = band === 'little' ? 5 : band === 'middle' ? 20 : 30;
      const need = band === 'little' ? int(rng, 2, 3) : band === 'middle' ? int(rng, 6, 14) : int(rng, 12, 24);
      const extra = prankN && need + prankN <= cap ? prankN : int(rng, 1, Math.min(band === 'little' ? 2 : 6, cap - need));
      numbers = { total: need + extra, need };
      mode = 'extra';
      solution = extra;
      prompt = fill(FIX_TEXT.countExtra, { ...numbers, items });
      max = cap;
    } else if (band === 'little') {
      const n = prankN && prankN >= 2 && prankN <= 5 ? prankN : int(rng, 2, 5);
      numbers = { total: n };
      mode = 'back';
      solution = n;
      prompt = fill(FIX_TEXT.countBack, { items, target });
      max = 5;
    } else if (band === 'middle') {
      if (rng() < 0.5) {
        const total = int(rng, 8, 20);
        const done = int(rng, 2, total - 3);
        numbers = { total, done };
        mode = 'left';
        solution = total - done;
        prompt = fill(FIX_TEXT.countLeft, { ...numbers, items });
      } else {
        const a = int(rng, 3, 12);
        const b = int(rng, 3, 20 - a);
        numbers = { a, b };
        mode = 'add';
        solution = a + b;
        prompt = fill(FIX_TEXT.countTwoPlaces, { ...numbers, items });
      }
      max = 20;
    } else {
      const groups = int(rng, 2, 5);
      const size = pick(rng, [2, 3, 4, 5, 6]);
      numbers = { groups, size };
      mode = 'groups';
      solution = groups * size;
      prompt = fill(FIX_TEXT.countGroups, { ...numbers, items });
      max = 30;
    }

    const k = band === 'little' ? 3 : 4;
    const choices = numberChoices(rng, solution, k, Math.max(0, mode === 'back' ? 1 : 0), max + 3);
    const seconds = band === 'little' ? est(8, 1, numbers.total ?? 3) : band === 'middle' ? 14 : 16;
    const goal = mode === 'share-fair' || mode === 'half' || mode === 'quarter' ? 'fractions' : 'counting';
    const skill = mode === 'add' ? 'addition' : mode === 'left' ? 'subtraction' : mode === 'groups' || mode === 'quarter' || mode === 'half' ? 'multiplication' : 'counting';
    return { fix: 'count-back', band, prompt, seconds, goal, skill, item, mode, numbers, choices, solution };
  },
  solve: (p) => p.solution,
  isAnswer: isNum,
  check(p, a) {
    if (a === p.solution) return { ok: true };
    return { ok: false, hints: [a < p.solution ? HINT.more : HINT.less, HINT.countTogether], focus: ['count'] };
  },
  wrong: (p) => p.choices.find((c) => c !== p.solution) ?? p.solution + 1,
});
