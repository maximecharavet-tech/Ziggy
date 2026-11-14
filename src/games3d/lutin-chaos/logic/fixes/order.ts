/**
 * order: line things up. little: 3 by size (or numbers 1–5) · middle: 4 by
 * number ≤ 20, alphabet or size · big: 5 — days of the week, skip counting,
 * ordinals, alphabet, numbers ≤ 100.
 */
import { int, pick, sample, shuffle } from '../rand';
import { DAYS, FIX_TEXT, HINT, ORDINALS, SIZE_WORDS, fill } from '../texts';
import type { L } from '../types';
import { defineFix, est, isStrArr, itemOf, type BasePuzzle } from './define';

export type OrderBy = 'size' | 'number' | 'alphabet' | 'days' | 'ordinal' | 'skip';

export interface OrderItem {
  id: string;
  label: L;
  value: number;
}

export interface OrderPuzzle extends BasePuzzle {
  fix: 'order';
  by: OrderBy;
  item: string;
  items: OrderItem[];
  solution: string[];
}

const LETTERS = 'ABCDEFGHIJKLMNOPRSTUVZ'.split('');

export const orderFix = defineFix<OrderPuzzle, string[]>({
  id: 'order',
  label: { fr: 'Ranger dans l’ordre', en: 'Put in order' },
  icon: '📚',
  goal: 'patterns',
  params: { by: { type: 'string', values: ['size', 'number', 'alphabet', 'days', 'ordinal', 'skip'] }, item: { type: 'string' } },
  make(ctx) {
    const { band, rng } = ctx;
    const item = itemOf(ctx, 'book');
    const asked = (typeof ctx.params.by === 'string' ? ctx.params.by : 'size') as OrderBy;
    const n = band === 'little' ? 3 : band === 'middle' ? 4 : 5;
    // little ones can't read: words become sizes, numbers stay small
    let by: OrderBy = asked;
    if (band === 'little') by = asked === 'number' || asked === 'skip' || asked === 'ordinal' ? 'number' : 'size';
    if (band === 'middle' && (asked === 'days' || asked === 'ordinal' || asked === 'skip')) by = asked === 'days' ? 'alphabet' : 'number';

    let values: number[];
    let labels: L[];
    let prompt: L = FIX_TEXT.orderSize;
    if (by === 'size') {
      const sizes = sample(rng, [0, 1, 2, 3, 4, 5], n).sort((a, b) => a - b);
      values = sizes;
      labels = sizes.map((s) => SIZE_WORDS[s]);
    } else if (by === 'number') {
      const max = band === 'little' ? 5 : band === 'middle' ? 20 : 100;
      values = sample(rng, Array.from({ length: max }, (_, i) => i + 1), n).sort((a, b) => a - b);
      labels = values.map((v) => ({ fr: String(v), en: String(v) }));
      prompt = FIX_TEXT.orderNumber;
    } else if (by === 'alphabet') {
      const start = int(rng, 0, LETTERS.length - n * 2);
      const pool = LETTERS.slice(start, start + n * 2);
      values = sample(rng, pool.map((_, i) => i), n).sort((a, b) => a - b);
      labels = values.map((v) => ({ fr: pool[v], en: pool[v] }));
      prompt = FIX_TEXT.orderAlphabet;
    } else if (by === 'days') {
      values = sample(rng, [0, 1, 2, 3, 4, 5, 6], n).sort((a, b) => a - b);
      labels = values.map((v) => DAYS[v]);
      prompt = FIX_TEXT.orderDays;
    } else if (by === 'ordinal') {
      values = [0, 1, 2, 3, 4].slice(0, n);
      labels = values.map((v) => ORDINALS[v]);
      prompt = FIX_TEXT.orderNumber;
    } else {
      const step = pick(rng, [2, 5, 10]);
      const start = step * int(rng, 0, 3);
      values = Array.from({ length: n }, (_, i) => start + step * (i + 1));
      labels = values.map((v) => ({ fr: String(v), en: String(v) }));
      prompt = fill(FIX_TEXT.orderSkip, { step });
    }
    const ordered = values.map((value, i) => ({ id: `o${i}`, label: labels[i], value }));
    // never start already in order
    let items = shuffle(rng, ordered);
    if (items.every((x, i) => x.id === ordered[i].id)) items = [...items.slice(1), items[0]];
    return {
      fix: 'order',
      band,
      prompt,
      seconds: est(band === 'big' ? 9 : 6, band === 'big' ? 1.6 : 1.5, n),
      goal: by === 'size' ? 'spatial' : 'patterns',
      skill: by === 'skip' ? 'multiplication' : by === 'number' ? 'counting' : by === 'alphabet' ? 'letters' : 'sequencing',
      by,
      item,
      items,
      solution: ordered.map((x) => x.id),
    };
  },
  solve: (p) => p.solution,
  isAnswer: isStrArr,
  check(p, a) {
    const i = p.solution.findIndex((id, k) => a[k] !== id);
    if (i === -1 && a.length === p.solution.length) return { ok: true };
    const at = i === -1 ? a.length : i;
    return { ok: false, hints: [HINT.almost, HINT.lookAt], focus: [p.solution[at]] };
  },
  wrong: (p) => [...p.solution].reverse(),
});
