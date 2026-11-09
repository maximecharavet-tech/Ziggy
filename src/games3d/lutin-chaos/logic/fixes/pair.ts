/**
 * pair: socks, gloves, boots back in pairs; or each thing with its shadow.
 * little: 2–3 pairs by colour · middle: 3 pairs, one left + one right ·
 * big: 4 pairs, same colour AND same pattern (colours repeat).
 */
import { int, pick, sample, shuffle, type Rng } from '../rand';
import { FIX_TEXT, HINT, fill } from '../texts';
import { BRIGHT, colorById, many, word, WORDS } from '../vocab';
import { defineFix, est, itemOf, type BasePuzzle } from './define';

export interface PairItem {
  id: string;
  /** Items with the same key belong together. */
  key: string;
  word: string;
  color: string;
  pattern: string;
  side: 'left' | 'right' | null;
  /** `shadow` mode: this one is the dark silhouette. */
  shadow: boolean;
}

export interface PairPuzzle extends BasePuzzle {
  fix: 'pair';
  mode: 'match' | 'left-right' | 'two-criteria' | 'shadow';
  items: PairItem[];
  solution: [string, string][];
}

const PATTERNS = ['dots', 'stripes', 'zigzag', 'stars'];

export const pairFix = defineFix<PairPuzzle, [string, string][]>({
  id: 'pair',
  label: { fr: 'Faire les paires', en: 'Make pairs' },
  icon: '🧦',
  goal: 'logic',
  params: { item: { type: 'string' }, mode: { type: 'string', values: ['match', 'left-right', 'shadow'] } },
  make(ctx) {
    const { band, rng } = ctx;
    const item = itemOf(ctx, 'sock');
    const asked = ctx.params.mode === 'shadow' ? 'shadow' : ctx.params.mode === 'left-right' ? 'left-right' : 'match';
    const nPairs = band === 'little' ? int(rng, 2, 3) : band === 'middle' ? 3 : 4;
    const items: PairItem[] = [];
    let mode: PairPuzzle['mode'];

    if (asked === 'shadow') {
      mode = 'shadow';
      const seenEmoji = new Set<string>();
      const pool = WORDS.filter((x) => (x.cat === word(item).cat || x.cat === 'toy') && !seenEmoji.has(x.emoji) && seenEmoji.add(x.emoji));
      const words = sample(rng, pool, nPairs);
      words.forEach((wd, i) => {
        const color = pick(rng, BRIGHT);
        items.push({ id: `p${i}a`, key: wd.id, word: wd.id, color, pattern: 'plain', side: null, shadow: false });
        items.push({ id: `p${i}b`, key: wd.id, word: wd.id, color: 'shadow', pattern: 'plain', side: null, shadow: true });
      });
    } else if (band === 'big') {
      mode = 'two-criteria';
      // 2 colours × 2 patterns: colours repeat, so the pattern matters too
      const colors = sample(rng, BRIGHT, 2);
      const pats = sample(rng, PATTERNS, 2);
      let i = 0;
      for (const c of colors)
        for (const pt of pats) {
          const key = `${c}-${pt}`;
          items.push({ id: `p${i}a`, key, word: item, color: c, pattern: pt, side: asked === 'left-right' ? 'left' : null, shadow: false });
          items.push({ id: `p${i}b`, key, word: item, color: c, pattern: pt, side: asked === 'left-right' ? 'right' : null, shadow: false });
          i++;
        }
    } else {
      mode = band === 'middle' ? 'left-right' : 'match';
      const colors = sample(rng, BRIGHT, nPairs);
      colors.forEach((c, i) => {
        const pattern = colorById(c)!.pattern;
        items.push({ id: `p${i}a`, key: c, word: item, color: c, pattern, side: mode === 'left-right' ? 'left' : null, shadow: false });
        items.push({ id: `p${i}b`, key: c, word: item, color: c, pattern, side: mode === 'left-right' ? 'right' : null, shadow: false });
      });
    }
    const solution = Array.from({ length: items.length / 2 }, (_, i) => [items[2 * i].id, items[2 * i + 1].id] as [string, string]);
    const prompt =
      mode === 'shadow' ? FIX_TEXT.pairShadow : mode === 'left-right' ? FIX_TEXT.pairLeftRight : mode === 'two-criteria' ? FIX_TEXT.pairTwoCriteria : fill(FIX_TEXT.pairMatch, { items: many(word(item)) });
    return {
      fix: 'pair',
      band,
      prompt,
      seconds: est(8, band === 'big' ? 1.4 : band === 'middle' ? 1.4 : 1.2, items.length),
      goal: mode === 'left-right' || mode === 'shadow' ? 'spatial' : 'logic',
      skill: mode === 'shadow' ? 'shapes' : mode === 'match' ? 'colors' : 'logic',
      mode,
      items: shuffle(rng, items),
      solution,
    };
  },
  solve: (p) => p.solution,
  isAnswer: (a): a is [string, string][] => Array.isArray(a) && a.every((x) => Array.isArray(x) && x.length === 2 && x.every((y) => typeof y === 'string')),
  check(p, a) {
    const byId = new Map(p.items.map((i) => [i.id, i]));
    const seen = new Set<string>();
    const bad: string[] = [];
    for (const [x, y] of a) {
      const ix = byId.get(x);
      const iy = byId.get(y);
      if (!ix || !iy || x === y || seen.has(x) || seen.has(y)) {
        bad.push(x);
        continue;
      }
      seen.add(x);
      seen.add(y);
      const sameKey = ix.key === iy.key;
      const sidesOk = ix.side === null || ix.side !== iy.side;
      const shadowOk = p.mode !== 'shadow' || ix.shadow !== iy.shadow;
      if (!sameKey || !sidesOk || !shadowOk) bad.push(x, y);
    }
    if (bad.length === 0 && seen.size === p.items.length) return { ok: true };
    const focus = bad.length ? bad.slice(0, 2) : p.items.filter((i) => !seen.has(i.id)).map((i) => i.id).slice(0, 1);
    return { ok: false, hints: [HINT.lookAt, HINT.together], focus };
  },
  wrong(p: PairPuzzle, rng: Rng) {
    const s = p.solution.map((x) => [...x] as [string, string]);
    if (s.length >= 2) {
      const i = int(rng, 0, s.length - 2);
      [s[i][1], s[i + 1][1]] = [s[i + 1][1], s[i][1]];
    } else s.pop();
    return s;
  },
});
