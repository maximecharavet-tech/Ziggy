/**
 * sort: put things in the right baskets. little: 1 criterion (2 baskets) ·
 * middle: 2 criteria (4 boxes) · big: odd-one-out with a hidden rule.
 * Colours always come with their icon/pattern (vocab COLORS).
 */
import { int, pick, sample, shuffle, type Rng } from '../rand';
import { FIX_TEXT, HINT } from '../texts';
import type { L } from '../types';
import { BRIGHT, colorById, SHAPES, WORDS, type WordCat } from '../vocab';
import { defineFix, est, isStr, type BasePuzzle } from './define';

export type SortAttr = 'color' | 'shape' | 'size' | 'cat';

export interface SortItem {
  id: string;
  color: string;
  shape: string;
  size: 'small' | 'big';
  /** Word id (category sorting) — drawn as that object. */
  word: string | null;
  cat: WordCat | null;
}

export interface SortBin {
  id: string;
  label: L;
  icon: string;
  rule: Partial<Record<SortAttr, string>>;
}

export interface SortPuzzle extends BasePuzzle {
  fix: 'sort';
  mode: 'bins' | 'odd-one-out';
  items: SortItem[];
  bins: SortBin[];
  /** bins: item id → bin id; odd-one-out: the odd item id. */
  solution: Record<string, string> | string;
}

export type SortAnswer = Record<string, string> | string;

const SIZE_L: Record<'small' | 'big', L> = { small: { fr: 'petit', en: 'small' }, big: { fr: 'grand', en: 'big' } };
const CAT_L: Partial<Record<WordCat, L>> = {
  clothes: { fr: 'vêtements', en: 'clothes' },
  kitchen: { fr: 'cuisine', en: 'kitchen things' },
  food: { fr: 'à manger', en: 'food' },
  toy: { fr: 'jouets', en: 'toys' },
  music: { fr: 'musique', en: 'music' },
  tool: { fr: 'outils', en: 'tools' },
  bath: { fr: 'salle de bain', en: 'bathroom things' },
  deco: { fr: 'décorations', en: 'decorations' },
  house: { fr: 'maison', en: 'house things' },
  nature: { fr: 'nature', en: 'nature' },
};
const SORT_CATS = Object.keys(CAT_L) as WordCat[];

function valueLabel(attr: SortAttr, v: string): { label: L; icon: string } {
  if (attr === 'color') {
    const c = colorById(v)!;
    return { label: c.name, icon: c.icon };
  }
  if (attr === 'shape') {
    const s = SHAPES.find((x) => x.id === v)!;
    return { label: s.name, icon: s.icon };
  }
  if (attr === 'size') return { label: SIZE_L[v as 'small' | 'big'], icon: v === 'small' ? '🔹' : '🔷' };
  return { label: CAT_L[v as WordCat]!, icon: WORDS.find((x) => x.cat === v)!.emoji };
}

const valuesOf = (attr: SortAttr, rng: Rng, n: number): string[] => {
  if (attr === 'color') return sample(rng, BRIGHT, n);
  if (attr === 'shape') return sample(rng, SHAPES.map((s) => s.id), n);
  if (attr === 'size') return sample(rng, ['small', 'big'], n);
  return sample(rng, SORT_CATS, n);
};

function makeItem(i: number, vals: Partial<Record<SortAttr, string>>, rng: Rng, usedWords: Set<string>): SortItem {
  let wordId: string | null = null;
  let cat: WordCat | null = null;
  if (vals.cat) {
    cat = vals.cat as WordCat;
    const pool = WORDS.filter((x) => x.cat === cat && !usedWords.has(x.id));
    wordId = pick(rng, pool).id;
    usedWords.add(wordId);
  }
  return {
    id: `it${i}`,
    color: vals.color ?? 'red',
    shape: vals.shape ?? 'circle',
    size: (vals.size as 'small' | 'big') ?? 'big',
    word: wordId,
    cat,
  };
}

const fits = (it: SortItem, rule: SortBin['rule']) => (Object.keys(rule) as SortAttr[]).every((k) => attrOf(it, k) === rule[k]);
const attrOf = (it: SortItem, a: SortAttr): string => (a === 'cat' ? (it.cat ?? '') : it[a]);

/** Items singled out by a 4-vs-1 split on some attribute (odd-one-out must have exactly one). */
export function oddCandidates(items: SortItem[]): string[] {
  const out = new Set<string>();
  for (const a of ['color', 'shape', 'size', 'cat'] as SortAttr[]) {
    const counts = new Map<string, SortItem[]>();
    for (const it of items) counts.set(attrOf(it, a), [...(counts.get(attrOf(it, a)) ?? []), it]);
    if (counts.size === 2) {
      const groups = [...counts.values()];
      const single = groups.find((g) => g.length === 1);
      if (single && items.length - 1 === groups.find((g) => g !== single)!.length) out.add(single[0].id);
    }
  }
  return [...out];
}

export const sortFix = defineFix<SortPuzzle, SortAnswer>({
  id: 'sort',
  label: { fr: 'Trier', en: 'Sort' },
  icon: '🧺',
  goal: 'sorting',
  params: { by: { type: 'string', values: ['color', 'shape', 'size', 'category'] }, item: { type: 'string' } },
  make(ctx) {
    const { band, rng } = ctx;
    const by: SortAttr = ctx.params.by === 'shape' ? 'shape' : ctx.params.by === 'size' ? 'size' : ctx.params.by === 'category' ? 'cat' : 'color';
    const used = new Set<string>();

    if (band === 'big') {
      // odd-one-out: 4 share the rule value, 1 differs; one other attribute all different, the rest constant
      const [keep, other] = valuesOf(by, rng, 2);
      const distinctAttr: SortAttr = by === 'color' ? 'shape' : 'color';
      const distinct = valuesOf(distinctAttr, rng, 5);
      const oddAt = int(rng, 0, 4);
      const items = distinct.map((d, i) => makeItem(i, { [by]: i === oddAt ? other : keep, [distinctAttr]: d }, rng, used));
      const odd = items[oddAt].id;
      if (oddCandidates(items).join() !== odd) throw new Error('odd-one-out is ambiguous');
      return { fix: 'sort', band, prompt: FIX_TEXT.oddOne, seconds: 15, goal: 'sorting', skill: 'logic', mode: 'odd-one-out', items, bins: [], solution: odd };
    }

    const attrs: SortAttr[] = band === 'little' ? [by] : [by, by === 'shape' || by === 'cat' ? 'color' : 'shape'];
    const values = attrs.map((a) => valuesOf(a, rng, 2));
    const bins: SortBin[] = [];
    if (attrs.length === 1) {
      for (const v of values[0]) {
        const { label, icon } = valueLabel(attrs[0], v);
        bins.push({ id: `bin-${v}`, label, icon, rule: { [attrs[0]]: v } });
      }
    } else {
      for (const v0 of values[0])
        for (const v1 of values[1]) {
          const a = valueLabel(attrs[0], v0);
          const b = valueLabel(attrs[1], v1);
          bins.push({ id: `bin-${v0}-${v1}`, label: { fr: `${a.label.fr} + ${b.label.fr}`, en: `${a.label.en} + ${b.label.en}` }, icon: `${a.icon}${b.icon}`, rule: { [attrs[0]]: v0, [attrs[1]]: v1 } });
        }
    }
    const n = band === 'little' ? int(rng, 4, 5) : 6;
    // every bin gets at least one item, the rest at random
    const binOrder = shuffle(rng, [...bins, ...Array.from({ length: n - bins.length }, () => pick(rng, bins))]);
    const items = binOrder.map((b, i) => {
      const vals: Partial<Record<SortAttr, string>> = { ...b.rule };
      // free attributes vary for fun, but never the sorting ones
      if (!vals.color && rng() < 0.7) vals.color = pick(rng, BRIGHT);
      if (!vals.shape && by !== 'cat') vals.shape = pick(rng, SHAPES.map((s) => s.id));
      return makeItem(i, vals, rng, used);
    });
    const solution: Record<string, string> = {};
    for (const it of items) solution[it.id] = bins.find((b) => fits(it, b.rule))!.id;
    return {
      fix: 'sort',
      band,
      prompt: band === 'little' ? FIX_TEXT.sortOne : FIX_TEXT.sortTwo,
      seconds: est(8, band === 'little' ? 1.5 : 1.8, n),
      goal: 'sorting',
      skill: by === 'color' ? 'colors' : by === 'shape' ? 'shapes' : 'logic',
      mode: 'bins',
      items,
      bins,
      solution,
    };
  },
  solve: (p) => p.solution,
  isAnswer: (a): a is SortAnswer => isStr(a) || (!!a && typeof a === 'object' && !Array.isArray(a) && Object.values(a).every(isStr)),
  check(p, a) {
    if (p.mode === 'odd-one-out') {
      if (a === p.solution) return { ok: true };
      return { ok: false, hints: [HINT.lookAt, HINT.together], focus: typeof a === 'string' ? [a] : [] };
    }
    if (typeof a === 'string') return { ok: false, hints: [HINT.almost], focus: [] };
    const sol = p.solution as Record<string, string>;
    const off = p.items.filter((it) => a[it.id] !== sol[it.id]).map((it) => it.id);
    if (off.length === 0) return { ok: true };
    return { ok: false, hints: [HINT.lookAt, HINT.together], focus: off.slice(0, 1) };
  },
  wrong(p, rng) {
    if (p.mode === 'odd-one-out') return pick(rng, p.items.filter((i) => i.id !== p.solution)).id;
    const sol = { ...(p.solution as Record<string, string>) };
    const it = pick(rng, p.items);
    sol[it.id] = p.bins.find((b) => b.id !== sol[it.id])!.id;
    return sol;
  },
});
