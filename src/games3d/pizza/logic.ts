/**
 * La Pizzeria de Ziggy — pure logic (no three.js, no DOM).
 *
 * Ziggy runs a pizza truck on the village square. Five animal customers come
 * one after the other with an order; the child tops the pizza, Ziggy bakes
 * it, serves it, and the customer eats it with a funny reaction.
 *
 * Everything the game decides lives here, so it can be tested:
 *  - the plan of a game (customers, orders, questions), seeded and adapted to
 *    the age band and the skill level;
 *  - the checks (is the pizza right? the change? the sum?);
 *  - every French and English sentence (orders, hints, praise).
 *
 * Child-safety rules enforced here: there is no failure. A wrong pizza gets a
 * gentle hint ("Gina wants 3 mushrooms, there are 2: one more!") and the
 * child tries again; no timer, no lives, no score that goes down.
 */
import type { LearningSkill } from '@/lib/learning/skills';
import { tr, type L } from '@/lib/i18n-text';
import { rng } from '../kit/rng';

export type Band = 'little' | 'middle' | 'big';
export const CUSTOMERS_PER_GAME = 5;

/* ───────────────────────── Toppings ───────────────────────── */

export const TOPPINGS = ['tomato', 'mushroom', 'olive', 'pepper', 'pineapple', 'cheese', 'basil'] as const;
export type ToppingId = (typeof TOPPINGS)[number];

export interface ToppingInfo {
  emoji: string;
  /** One piece: "champignon" / "mushroom". */
  one: L;
  /** Several pieces: "champignons" / "mushrooms". */
  many: L;
  /** A title on its own: "Champignons" / "Mushrooms". */
  label: L;
  /** With its article, in a sentence: "des champignons" / "mushrooms". */
  some: L;
  /** After a negation (French): "de champignons". */
  none: L;
  /** Colour adjective: French singular and plural, English. */
  color: { fr: [string, string]; en: string };
  /** For the HUD (chips, pie icons). */
  hex: string;
  /** A little word about the food, said when the customer eats. */
  fact: L;
}

export const TOPPING_INFO: Record<ToppingId, ToppingInfo> = {
  tomato: {
    emoji: '🍅',
    one: { fr: 'tomate', en: 'tomato' },
    many: { fr: 'tomates', en: 'tomatoes' },
    label: { fr: 'Tomates', en: 'Tomatoes' },
    some: { fr: 'des tomates', en: 'tomatoes' },
    none: { fr: 'de tomates', en: 'tomatoes' },
    color: { fr: ['rouge', 'rouges'], en: 'red' },
    hex: '#e5392f',
    fact: { fr: 'La tomate est un fruit plein de vitamines !', en: 'A tomato is a fruit, full of vitamins!' },
  },
  mushroom: {
    emoji: '🍄',
    one: { fr: 'champignon', en: 'mushroom' },
    many: { fr: 'champignons', en: 'mushrooms' },
    label: { fr: 'Champignons', en: 'Mushrooms' },
    some: { fr: 'des champignons', en: 'mushrooms' },
    none: { fr: 'de champignons', en: 'mushrooms' },
    color: { fr: ['marron', 'marron'], en: 'brown' },
    hex: '#c99a6b',
    fact: { fr: 'Les champignons poussent dans les bois, à l’ombre et au frais.', en: 'Mushrooms grow in the woods, where it is cool and shady.' },
  },
  olive: {
    emoji: '🫒',
    one: { fr: 'olive', en: 'olive' },
    many: { fr: 'olives', en: 'olives' },
    label: { fr: 'Olives', en: 'Olives' },
    some: { fr: 'des olives', en: 'olives' },
    none: { fr: 'd’olives', en: 'olives' },
    color: { fr: ['noire', 'noires'], en: 'black' },
    hex: '#3a3140',
    fact: { fr: 'Les olives poussent sur des arbres : les oliviers.', en: 'Olives grow on trees called olive trees.' },
  },
  pepper: {
    emoji: '🫑',
    one: { fr: 'poivron', en: 'pepper' },
    many: { fr: 'poivrons', en: 'peppers' },
    label: { fr: 'Poivrons', en: 'Peppers' },
    some: { fr: 'des poivrons', en: 'peppers' },
    none: { fr: 'de poivrons', en: 'peppers' },
    color: { fr: ['vert', 'verts'], en: 'green' },
    hex: '#3fae3f',
    fact: { fr: 'Un poivron peut être vert, jaune ou rouge !', en: 'A pepper can be green, yellow or red!' },
  },
  pineapple: {
    emoji: '🍍',
    one: { fr: 'morceau d’ananas', en: 'pineapple chunk' },
    many: { fr: 'morceaux d’ananas', en: 'pineapple chunks' },
    label: { fr: 'Ananas', en: 'Pineapple' },
    some: { fr: 'de l’ananas', en: 'pineapple' },
    none: { fr: 'd’ananas', en: 'pineapple' },
    color: { fr: ['jaune', 'jaunes'], en: 'yellow' },
    hex: '#ffd23f',
    fact: { fr: 'L’ananas pousse au milieu d’une plante aux feuilles piquantes.', en: 'A pineapple grows in the middle of a spiky-leaved plant.' },
  },
  cheese: {
    emoji: '🧀',
    one: { fr: 'morceau de fromage', en: 'piece of cheese' },
    many: { fr: 'morceaux de fromage', en: 'pieces of cheese' },
    label: { fr: 'Fromage', en: 'Cheese' },
    some: { fr: 'du fromage', en: 'cheese' },
    none: { fr: 'de fromage', en: 'cheese' },
    color: { fr: ['blanc', 'blancs'], en: 'white' },
    hex: '#fff3d6',
    fact: { fr: 'Le fromage est fait avec du lait.', en: 'Cheese is made from milk.' },
  },
  basil: {
    emoji: '🌿',
    one: { fr: 'feuille de basilic', en: 'basil leaf' },
    many: { fr: 'feuilles de basilic', en: 'basil leaves' },
    label: { fr: 'Basilic', en: 'Basil' },
    some: { fr: 'du basilic', en: 'basil' },
    none: { fr: 'de basilic', en: 'basil' },
    color: { fr: ['verte', 'vertes'], en: 'green' },
    hex: '#2f9e44',
    fact: { fr: 'Le basilic est une herbe qui sent très bon.', en: 'Basil is a herb that smells lovely.' },
  },
};

/** "3 champignons", "1 tomate rouge" / "3 mushrooms", "1 red tomato". */
export function countPhrase(t: ToppingId, n: number, locale: string, withColor = false): string {
  const info = TOPPING_INFO[t];
  if (locale === 'fr') {
    const noun = n > 1 ? info.many.fr : info.one.fr;
    return withColor ? `${n} ${noun} ${info.color.fr[n > 1 ? 1 : 0]}` : `${n} ${noun}`;
  }
  const noun = n > 1 ? info.many.en : info.one.en;
  return withColor ? `${n} ${info.color.en} ${noun}` : `${n} ${noun}`;
}

/* ───────────────────────── Customers ───────────────────────── */

export const CUSTOMERS = ['giraffe', 'bear', 'rabbit', 'elephant', 'penguin'] as const;
export type CustomerId = (typeof CUSTOMERS)[number];

export const CUSTOMER_INFO: Record<CustomerId, { emoji: string; name: L; hello: L; yum: L }> = {
  giraffe: {
    emoji: '🦒',
    name: { fr: 'Gina la girafe', en: 'Gina the Giraffe' },
    hello: { fr: 'Coucou Ziggy ! Je te parle de tout là-haut !', en: 'Hi Ziggy! I’m talking to you from way up here!' },
    yum: { fr: 'Miam ! Je mange par le toit, c’est plus pratique !', en: 'Yum! I eat through the roof, it’s much easier!' },
  },
  bear: {
    emoji: '🐻',
    name: { fr: 'Bruno l’ours', en: 'Bruno the Bear' },
    hello: { fr: 'Bonjour Ziggy ! J’ai une faim d’ours !', en: 'Hello Ziggy! I’m as hungry as a bear!' },
    yum: { fr: 'Gloup ! En une seule bouchée ! Délicieux !', en: 'Gulp! In one single bite! Delicious!' },
  },
  rabbit: {
    emoji: '🐰',
    name: { fr: 'Lili la lapine', en: 'Lili the Rabbit' },
    hello: { fr: 'Bonjour ! Je monte sur ma caisse pour bien te voir !', en: 'Hello! I’ll hop on my crate to see you better!' },
    yum: { fr: 'Cronch cronch cronch ! Trop bon !', en: 'Crunch crunch crunch! So good!' },
  },
  elephant: {
    emoji: '🐘',
    name: { fr: 'Elio l’éléphant', en: 'Elio the Elephant' },
    hello: { fr: 'Pouet pouet ! Bonjour Ziggy !', en: 'Toot toot! Hello Ziggy!' },
    yum: { fr: 'Slurrrp ! Je l’aspire avec ma trompe !', en: 'Slurrrp! I suck it up with my trunk!' },
  },
  penguin: {
    emoji: '🐧',
    name: { fr: 'Pablo le pingouin', en: 'Pablo the Penguin' },
    hello: { fr: 'Salut Ziggy ! J’arrive en glissant !', en: 'Hi Ziggy! Here I come, sliding!' },
    yum: { fr: 'Ouh, c’est chaud ! Mais c’est délicieux !', en: 'Ooh, it’s hot! But it’s delicious!' },
  },
};

/* ───────────────────────── Orders ───────────────────────── */

export interface CountItem {
  topping: ToppingId;
  n: number;
}
export interface PartItem {
  topping: ToppingId;
  num: number;
  den: number;
}

export type Order =
  | {
      kind: 'count';
      items: CountItem[];
      /** Say the colours too ("3 tomates rouges"). */
      colors: boolean;
      /** Missing addend: "5 toppings in all: 2 olives and mushrooms for the rest". */
      total: number | null;
      hidden: ToppingId | null;
    }
  | {
      kind: 'parts';
      /** The pizza is cut into this many equal slices. */
      parts: number;
      items: PartItem[];
    };

/** Middle band, while the pizza bakes: "2 olives and 3 mushrooms: how many toppings?" */
export interface SumQuestion {
  answer: number;
  options: number[];
}

/** Big band: the customer pays with a note, the child gives the change back. */
export interface Payment {
  price: number;
  paid: number;
  change: number;
}

export interface Round {
  index: number;
  customer: CustomerId;
  order: Order;
  /** The topping buttons shown (the order's toppings and a few others). */
  choices: ToppingId[];
  ask: SumQuestion | null;
  pay: Payment | null;
  skill: LearningSkill;
  /** Little ones: the pizza goes to the oven by itself once it is right. */
  autoFinish: boolean;
  /** Bruno first asks for a candy pizza (Ziggy says "oops" and offers real food). */
  candy: boolean;
  /** A hungry pigeon pinches an olive during this round. */
  pigeon: boolean;
}

/** Coins and notes the child can give back. */
export const COINS = [1, 2, 5] as const;

function shuffle<T>(arr: readonly T[], r: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const between = (lo: number, hi: number, r: () => number) => lo + Math.floor(r() * (hi - lo + 1));
const pickOne = <T>(arr: readonly T[], r: () => number): T => arr[Math.floor(r() * arr.length)];

/** Three different answers around the right one (never below 1). */
export function threeOptions(answer: number, r: () => number): number[] {
  const set = new Set([answer]);
  let guard = 0;
  while (set.size < 3 && guard++ < 50) {
    const d = 1 + Math.floor(r() * 2);
    const v = r() < 0.5 ? answer - d : answer + d;
    if (v >= 1) set.add(v);
  }
  for (let v = answer + 1; set.size < 3; v++) set.add(v);
  return shuffle([...set], r);
}

/** `count` distinct toppings, `first` (if given) leading. */
function toppingsFor(count: number, r: () => number, first?: ToppingId): ToppingId[] {
  const rest = shuffle(
    TOPPINGS.filter((t) => t !== first),
    r
  );
  // Two greens in one order are hard to tell apart: avoid pepper + basil together.
  const out: ToppingId[] = first ? [first] : [];
  for (const t of rest) {
    if (out.length >= count) break;
    if (out.some((o) => TOPPING_INFO[o].color.en === TOPPING_INFO[t].color.en)) continue;
    out.push(t);
  }
  return out;
}

/** The buttons: the order's toppings plus distractors of other colours, shuffled. */
function choicesFor(order: ToppingId[], size: number, r: () => number): ToppingId[] {
  const out = [...order];
  for (const t of shuffle(TOPPINGS, r)) {
    if (out.length >= size) break;
    if (out.includes(t)) continue;
    if (out.some((o) => TOPPING_INFO[o].color.en === TOPPING_INFO[t].color.en)) continue;
    out.push(t);
  }
  for (const t of TOPPINGS) if (out.length < size && !out.includes(t)) out.push(t);
  return shuffle(out, r);
}

type Frac = [number, number];
const QUARTER_SINGLE: Frac[] = [
  [1, 4],
  [1, 2],
  [3, 4],
];
const QUARTER_PAIRS: [Frac, Frac][] = [
  [
    [1, 2],
    [1, 4],
  ],
  [
    [1, 4],
    [1, 4],
  ],
  [
    [1, 4],
    [3, 4],
  ],
  [
    [1, 2],
    [1, 2],
  ],
  [
    [1, 4],
    [1, 2],
  ],
];
const EIGHTH_SINGLE: Frac[] = [
  [3, 8],
  [5, 8],
  [3, 4],
];
const EIGHTH_PAIRS: [Frac, Frac][] = [
  [
    [3, 8],
    [1, 2],
  ],
  [
    [1, 8],
    [5, 8],
  ],
  [
    [3, 8],
    [3, 8],
  ],
  [
    [5, 8],
    [1, 4],
  ],
  [
    [1, 8],
    [3, 4],
  ],
  [
    [1, 4],
    [3, 8],
  ],
];

function planRound(r: () => number, band: Band, lv: number, index: number, customer: CustomerId, olives: boolean): Round {
  const base = { index, customer, candy: customer === 'bear', pigeon: olives };
  if (band === 'little') {
    const two = lv >= 2 ? index === 1 || index === 3 : index === 3;
    const tops = toppingsFor(two ? 2 : 1, r, olives ? 'olive' : undefined);
    const items: CountItem[] = two
      ? tops.map((topping, i) => ({ topping, n: between(i === 0 && olives ? 2 : 1, lv >= 2 ? 3 : 2, r) }))
      : [{ topping: tops[0], n: lv >= 2 ? between(3, 6, r) : between(olives ? 2 : 1, 4, r) }];
    const order: Order = { kind: 'count', items, colors: index === 2 || index === 4, total: null, hidden: null };
    return { ...base, order, choices: choicesFor(tops, 4, r), ask: null, pay: null, skill: 'counting', autoFinish: true };
  }
  if (band === 'middle') {
    if (index === 1 || index === 4) {
      const tops = toppingsFor(2, r, olives ? 'olive' : undefined);
      const order: Order = { kind: 'parts', parts: lv >= 4 ? 4 : 2, items: tops.map((topping) => ({ topping, num: 1, den: 2 })) };
      return { ...base, order, choices: choicesFor(tops, 5, r), ask: null, pay: null, skill: 'shapes', autoFinish: false };
    }
    const max = lv >= 2 ? 5 : 4;
    const tops = toppingsFor(2, r, olives ? 'olive' : undefined);
    const items: CountItem[] = tops.map((topping, i) => ({ topping, n: between(i === 0 && olives ? 2 : 1, max, r) }));
    const sum = items[0].n + items[1].n;
    const missing = lv >= 3 && index === 2;
    const order: Order = { kind: 'count', items, colors: false, total: missing ? sum : null, hidden: missing ? items[1].topping : null };
    return {
      ...base,
      order,
      choices: choicesFor(tops, 5, r),
      ask: missing ? null : { answer: sum, options: threeOptions(sum, r) },
      pay: null,
      skill: 'addition',
      autoFinish: false,
    };
  }
  // big: fractions of a pizza cut into 4 or 8 slices, and change to give back.
  const parts = lv >= 3 ? 8 : 4;
  const eighths = lv >= 5;
  const two = lv >= 2 ? index > 0 : index >= 3;
  const fracs: Frac[] = two ? [...pickOne(eighths ? EIGHTH_PAIRS : QUARTER_PAIRS, r)] : [pickOne(eighths ? EIGHTH_SINGLE : QUARTER_SINGLE, r)];
  const tops = toppingsFor(fracs.length, r, olives ? 'olive' : undefined);
  const order: Order = { kind: 'parts', parts, items: tops.map((topping, i) => ({ topping, num: fracs[i][0], den: fracs[i][1] })) };
  let pay: Payment | null = null;
  if (index === 1 || index === 3 || index === 4) {
    const paid = lv >= 3 ? 20 : 10;
    const price = lv >= 3 ? between(11, 18, r) : between(3, 9, r);
    pay = { price, paid, change: paid - price };
  }
  return { ...base, order, choices: choicesFor(tops, 6, r), ask: null, pay, skill: pay ? 'subtraction' : 'shapes', autoFinish: false };
}

/**
 * The five customers of a game, decided locally and deterministically
 * (same seed → same game), adapted to the age band and the skill level.
 */
export function planGame(seed: number, band: Band, level = 1): Round[] {
  const r = rng((seed * 13 + 5) >>> 0);
  const lv = Math.max(1, Math.min(5, Math.floor(level)));
  const customers = shuffle(CUSTOMERS, r);
  // One round (2nd to 4th customer) has olives: that's when the pigeon comes.
  const olivesAt = 1 + Math.floor(r() * 3);
  return customers.map((c, i) => planRound(r, band, lv, i, c, i === olivesAt));
}

/** The skill trained most in a game (for the level read at the start). */
export function guessSkill(band: Band): LearningSkill {
  return band === 'little' ? 'counting' : band === 'middle' ? 'addition' : 'shapes';
}

/* ───────────────────────── The pizza and the checks ───────────────────────── */

export interface PizzaState {
  /** Count orders: pieces of each topping. */
  counts: Partial<Record<ToppingId, number>>;
  /** Parts orders: the topping on each slice (null = plain). */
  parts: (ToppingId | null)[];
}

export const emptyPizza = (order: Order): PizzaState => ({ counts: {}, parts: order.kind === 'parts' ? Array.from({ length: order.parts }, () => null) : [] });

/** Slices a fraction needs on this pizza (3/4 of 8 slices → 6). */
export const partsFor = (it: PartItem, parts: number) => (it.num * parts) / it.den;

export function addPiece(p: PizzaState, t: ToppingId, d = 1): PizzaState {
  return { ...p, counts: { ...p.counts, [t]: Math.max(0, (p.counts[t] ?? 0) + d) } };
}

/** Tap a slice: put the topping on it, or take it off if it is already there. */
export function toggleSlice(p: PizzaState, i: number, t: ToppingId): PizzaState {
  if (i < 0 || i >= p.parts.length) return p;
  const parts = [...p.parts];
  parts[i] = parts[i] === t ? null : t;
  return { ...p, parts };
}

export type Issue =
  | { kind: 'wrong'; topping: ToppingId }
  | { kind: 'tooMany'; topping: ToppingId; have: number; want: number }
  | { kind: 'tooFew'; topping: ToppingId; have: number; want: number };

/** What each topping of the order needs (pieces, or slices). */
export function wanted(order: Order): Map<ToppingId, number> {
  if (order.kind === 'count') return new Map(order.items.map((it) => [it.topping, it.n]));
  return new Map(order.items.map((it) => [it.topping, partsFor(it, order.parts)]));
}

export function have(order: Order, p: PizzaState, t: ToppingId): number {
  return order.kind === 'count' ? (p.counts[t] ?? 0) : p.parts.filter((x) => x === t).length;
}

/** null = the pizza is exactly what the customer asked for. */
export function checkPizza(order: Order, p: PizzaState): Issue | null {
  const want = wanted(order);
  for (const t of TOPPINGS) if (!want.has(t) && have(order, p, t) > 0) return { kind: 'wrong', topping: t };
  for (const [t, w] of want) {
    const h = have(order, p, t);
    if (h > w) return { kind: 'tooMany', topping: t, have: h, want: w };
  }
  for (const [t, w] of want) {
    const h = have(order, p, t);
    if (h < w) return { kind: 'tooFew', topping: t, have: h, want: w };
  }
  return null;
}

export const checkSum = (q: SumQuestion, n: number) => n === q.answer;

export const coinsTotal = (coins: number[]) => coins.reduce((a, b) => a + b, 0);
export function checkChange(pay: Payment, coins: number[]): 'ok' | 'less' | 'more' {
  const s = coinsTotal(coins);
  return s === pay.change ? 'ok' : s < pay.change ? 'less' : 'more';
}

/** A pizza that answers the order (tests, and the demo). */
export function solve(order: Order): PizzaState {
  let p = emptyPizza(order);
  if (order.kind === 'count') for (const it of order.items) p = addPiece(p, it.topping, it.n);
  else {
    let i = 0;
    for (const it of order.items) for (let k = 0; k < partsFor(it, order.parts); k++) p = toggleSlice(p, i++, it.topping);
  }
  return p;
}

/** Steps of a round for the learning engine: the pizza, and the sum or the change. */
export const stepsOf = (r: Round) => 1 + (r.ask ? 1 : 0) + (r.pay ? 1 : 0);

/* ───────────────────────── Words ───────────────────────── */

const euro = (n: number, locale: string) => (locale === 'fr' ? `${n} €` : `€${n}`);
export { euro };

function list(parts: string[], locale: string): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} ${locale === 'fr' ? 'et' : 'and'} ${parts[parts.length - 1]}`;
}

const FRAC_WORDS: Record<string, L> = {
  '1/2': { fr: 'la moitié', en: 'half' },
  '1/4': { fr: 'un quart', en: 'a quarter' },
  '3/4': { fr: 'trois quarts', en: 'three quarters' },
  '1/8': { fr: 'un huitième', en: 'one eighth' },
  '3/8': { fr: 'trois huitièmes', en: 'three eighths' },
  '5/8': { fr: 'cinq huitièmes', en: 'five eighths' },
  '7/8': { fr: 'sept huitièmes', en: 'seven eighths' },
};
export const fracWord = (num: number, den: number, locale: string) => tr(FRAC_WORDS[`${num}/${den}`] ?? { fr: `${num}/${den}`, en: `${num}/${den}` }, locale);

const GLYPH: Record<string, string> = { '1/2': '½', '1/4': '¼', '3/4': '¾', '1/8': '⅛', '3/8': '⅜', '5/8': '⅝', '7/8': '⅞' };
export const fracGlyph = (num: number, den: number) => GLYPH[`${num}/${den}`] ?? `${num}/${den}`;

export const customerName = (c: CustomerId, locale: string) => tr(CUSTOMER_INFO[c].name, locale);

/** What the customer asks for, as they say it. */
export function orderText(round: Round, locale: string): string {
  const fr = locale === 'fr';
  const o = round.order;
  if (o.kind === 'count') {
    if (o.total !== null && o.hidden) {
      const known = o.items.find((it) => it.topping !== o.hidden) ?? o.items[0];
      const rest = tr(TOPPING_INFO[o.hidden].some, locale);
      return fr
        ? `Je voudrais ${o.total} garnitures en tout : ${countPhrase(known.topping, known.n, locale)}, et ${rest} pour faire ${o.total} !`
        : `I’d like ${o.total} toppings in all: ${countPhrase(known.topping, known.n, locale)}, and ${rest} to make ${o.total}!`;
    }
    const what = list(
      o.items.map((it) => countPhrase(it.topping, it.n, locale, o.colors)),
      locale
    );
    return fr ? `Je voudrais ${what}, s’il te plaît !` : `I’d like ${what}, please!`;
  }
  if (o.items.length === 2 && o.items.every((it) => it.num * 2 === it.den)) {
    const [a, b] = o.items.map((it) => tr(TOPPING_INFO[it.topping].some, locale));
    return fr ? `Je voudrais ${a} sur une moitié, et ${b} sur l’autre moitié !` : `I’d like ${a} on one half, and ${b} on the other half!`;
  }
  const what = o.items.map((it, i) => {
    const some = tr(TOPPING_INFO[it.topping].some, locale);
    const frac = fracWord(it.num, it.den, locale);
    if (fr) return `${some} sur ${frac}${i === 0 ? ' de la pizza' : ''}`;
    return `${some} on ${frac}${i === 0 ? ' of the pizza' : ''}`;
  });
  return fr ? `Je voudrais ${list(what, locale)} !` : `I’d like ${list(what, locale)}!`;
}

/** How to do it (read aloud after the order). */
export function instructionText(round: Round, locale: string): string {
  const fr = locale === 'fr';
  const o = round.order;
  if (o.kind === 'parts')
    return fr
      ? `La pizza a ${o.parts} parts. Choisis une garniture, puis touche les parts. Ensuite : « Au four ! ».`
      : `The pizza has ${o.parts} slices. Pick a topping, then tap the slices. Then: “Bake it!”.`;
  if (round.autoFinish) return fr ? 'Touche les garnitures en bas, ou touche la pizza !' : 'Tap the toppings below, or tap the pizza!';
  return fr ? 'Ajoute les garnitures, puis touche « Au four ! ».' : 'Add the toppings, then tap “Bake it!”.';
}

/** Middle band, while it bakes. */
export function askText(round: Round, locale: string): string {
  const o = round.order;
  if (o.kind !== 'count' || o.items.length < 2) return '';
  const [a, b] = o.items.map((it) => countPhrase(it.topping, it.n, locale));
  return locale === 'fr' ? `Pendant que ça cuit : ${a} et ${b}, ça fait combien de garnitures en tout ?` : `While it bakes: ${a} and ${b}, how many toppings in all?`;
}

/** Big band, at the till. */
export function payText(round: Round, locale: string): string {
  const p = round.pay;
  if (!p) return '';
  const name = customerName(round.customer, locale);
  return locale === 'fr'
    ? `La pizza coûte ${euro(p.price, locale)}. ${name} te donne ${euro(p.paid, locale)}. Combien rends-tu ?`
    : `The pizza costs ${euro(p.price, locale)}. ${name} gives you ${euro(p.paid, locale)}. How much change do you give back?`;
}

export function helloText(round: Round, locale: string): string {
  return tr(CUSTOMER_INFO[round.customer].hello, locale);
}

export const CANDY_ORDER: L = {
  fr: 'Je voudrais une pizza aux bonbons, avec plein de sucettes !',
  en: 'I’d like a candy pizza, with lots of lollipops!',
};
export const CANDY_OOPS: L = {
  fr: 'Oups ! Des bonbons sur une pizza, ça colle partout ! Je te propose de vrais ingrédients.',
  en: 'Oops! Candy on a pizza gets sticky everywhere! Let me suggest real ingredients.',
};

export function pigeonText(round: Round, locale: string): string {
  const fr = locale === 'fr';
  if (round.order.kind === 'count') return fr ? 'Oh ! Un pigeon gourmand a chipé une olive ! Il en faut une autre.' : 'Oh! A hungry pigeon pinched an olive! We need another one.';
  return fr ? 'Oh ! Un pigeon a chipé une olive… Ziggy en remet une, pas de souci !' : 'Oh! A pigeon pinched an olive… Ziggy puts another one, no problem!';
}

/** The gentle hint after a pizza that isn't quite right. */
export function hintText(round: Round, issue: Issue, locale: string): string {
  const fr = locale === 'fr';
  const o = round.order;
  const info = TOPPING_INFO[issue.topping];
  const name = customerName(round.customer, locale);
  if (issue.kind === 'wrong')
    return fr ? `Oh ! ${name} n’a pas demandé ${info.none.fr}. Ziggy les enlève !` : `Oh! ${name} didn’t ask for ${info.some.en}. Ziggy takes them off!`;
  const { have: h, want: w } = issue;
  if (o.kind === 'parts') {
    const it = o.items.find((x) => x.topping === issue.topping)!;
    const frac = fracWord(it.num, it.den, locale);
    return fr
      ? `${tr(info.label, locale)} sur ${frac} : ça fait ${w} part${w > 1 ? 's' : ''} sur ${o.parts}. Là, il y en a ${h}.`
      : `${tr(info.label, locale)} on ${frac}: that’s ${w} slice${w > 1 ? 's' : ''} out of ${o.parts}. Right now there ${h === 1 ? 'is' : 'are'} ${h}.`;
  }
  if (o.total !== null && o.hidden === issue.topping) {
    const known = o.items.find((it) => it.topping !== o.hidden) ?? o.items[0];
    const steps = Array.from({ length: Math.max(0, o.total - known.n) }, (_, i) => known.n + i + 1).join(', ');
    return fr
      ? `Il faut ${o.total} garnitures en tout. Tu as ${countPhrase(known.topping, known.n, locale)} : compte ${steps}… jusqu’à ${o.total} !`
      : `We need ${o.total} toppings in all. You have ${countPhrase(known.topping, known.n, locale)}: count ${steps}… up to ${o.total}!`;
  }
  if (issue.kind === 'tooMany')
    return fr
      ? `${name} veut ${countPhrase(issue.topping, w, locale)}, et il y en a ${h}. Enlève-en ${h - w} avec ↩.`
      : `${name} wants ${countPhrase(issue.topping, w, locale)}, and there are ${h}. Take ${h - w} off with ↩.`;
  return fr
    ? `${name} veut ${countPhrase(issue.topping, w, locale)}. Pour l’instant, il y en a ${h}. Encore ${w - h} !`
    : `${name} wants ${countPhrase(issue.topping, w, locale)}. Right now there ${h === 1 ? 'is' : 'are'} ${h}. ${w - h} more!`;
}

/** Little ones: one too many → Ziggy gobbles it up (no undo needed). */
export function gobbleText(round: Round, t: ToppingId, locale: string): string {
  const it = round.order.kind === 'count' ? round.order.items.find((x) => x.topping === t) : undefined;
  const w = it?.n ?? 0;
  const name = customerName(round.customer, locale);
  return locale === 'fr'
    ? `Un de trop ! Ziggy le croque : miam ! ${name} en veut ${w}.`
    : `One too many! Ziggy gobbles it up: yum! ${name} wants ${w}.`;
}

export function askHint(round: Round, locale: string): string {
  const o = round.order;
  if (o.kind !== 'count') return '';
  const [a, b] = o.items.map((it) => it.n);
  return locale === 'fr' ? `Compte toutes les garnitures : ${a} + ${b}. Essaie encore !` : `Count all the toppings: ${a} + ${b}. Try again!`;
}

export function payHint(round: Round, coins: number[], locale: string): string {
  const p = round.pay;
  if (!p) return '';
  const s = coinsTotal(coins);
  const fr = locale === 'fr';
  if (s > p.change)
    return fr
      ? `Oups, c’est un peu trop : tu rends ${euro(s, locale)}. Compte de ${p.price} jusqu’à ${p.paid} !`
      : `Oops, that’s a bit too much: you give ${euro(s, locale)}. Count from ${p.price} up to ${p.paid}!`;
  return fr
    ? `Tu rends ${euro(s, locale)} pour l’instant. Compte à partir du prix : ${p.price}… jusqu’à ${p.paid} !`
    : `You give ${euro(s, locale)} so far. Count on from the price: ${p.price}… up to ${p.paid}!`;
}

export const PRAISE: L[] = [
  { fr: 'Bravo ! C’est exactement ça !', en: 'Well done! That’s exactly it!' },
  { fr: 'Parfait, chef !', en: 'Perfect, chef!' },
  { fr: 'Super ! Quelle belle pizza !', en: 'Super! What a lovely pizza!' },
  { fr: 'Génial ! Au four !', en: 'Brilliant! Into the oven!' },
  { fr: 'Oui ! Tu es un vrai pizzaïolo !', en: 'Yes! You’re a real pizza chef!' },
];
export const praiseFor = (i: number, locale: string) => tr(PRAISE[Math.abs(Math.floor(i)) % PRAISE.length], locale);

export const PICK_FIRST: L = { fr: 'Choisis d’abord une garniture en bas !', en: 'First pick a topping below!' };

export const FINALE: L = {
  fr: 'Bravo, la pizzeria a régalé tout le village !',
  en: 'Well done, the pizzeria fed the whole village!',
};
