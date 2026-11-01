/**
 * Ziggy Détective — the pure logic (no three.js, no DOM).
 *
 * A gentle village mystery is built from the suspects' visible traits (hat,
 * glasses, scarf, size, place around the fountain). The clues are chosen so
 * that every clue clears at least one friend, at least two friends are still
 * on the list before the last clue, and exactly ONE suspect matches them all.
 * Every text exists in French and English.
 */
import { rng } from '../kit/rng';
import type { L } from '@/lib/i18n-text';
import type { LearningSkill } from '@/lib/learning/skills';

export type Band = 'little' | 'middle' | 'big';

export type Species = 'cat' | 'dog' | 'rabbit' | 'fox' | 'pig' | 'owl' | 'bear' | 'mouse' | 'frog' | 'duck' | 'panda' | 'dragon';
export const SPECIES: readonly Species[] = ['cat', 'dog', 'rabbit', 'fox', 'pig', 'owl', 'bear', 'mouse', 'frog', 'duck', 'panda', 'dragon'];

export type Hue = 'red' | 'blue' | 'yellow' | 'green' | 'purple';
export const HUES: readonly Hue[] = ['red', 'blue', 'yellow', 'green', 'purple'];
export type Size = 'big' | 'small';
export type Col = 'left' | 'center' | 'right';
export type Row = 'front' | 'back';

export type MysteryId = 'cake' | 'trumpet' | 'mud' | 'flowers' | 'balloons';
export const MYSTERIES: readonly MysteryId[] = ['cake', 'trumpet', 'mud', 'flowers', 'balloons'];

/** What a wrongly accused friend shows to prove where they were. */
export type AlibiProp = 'pillow' | 'bone' | 'carrot' | 'balls' | 'bubbles' | 'book' | 'honey' | 'cheese' | 'note' | 'ring' | 'bamboo' | 'marshmallow';

export const CASES_PER_GAME = 3;
/** Places around the square where Ziggy can find a clue (see village.ts). */
export const CLUE_SPOTS = 6;

export interface Suspect {
  id: Species;
  hat: Hue | null;
  glasses: boolean;
  scarf: Hue | null;
  size: Size;
  /** Seen from the child: left of, in line with, or right of the fountain. */
  col: Col;
  /** In front of (nearer to the child) or behind the fountain. */
  row: Row;
}

export type Trait =
  | { k: 'hat'; hue: Hue }
  | { k: 'anyHat' }
  | { k: 'scarf'; hue: Hue }
  | { k: 'anyScarf' }
  | { k: 'glasses' }
  | { k: 'size'; size: Size }
  | { k: 'side'; side: 'left' | 'right' }
  | { k: 'row'; row: Row };

/** One statement about the culprit, maybe negated ("does NOT wear glasses"). */
export interface Lit {
  trait: Trait;
  not: boolean;
}

/** A clue: one or two statements joined by "and". */
export interface Clue {
  lits: Lit[];
  /** Where Ziggy finds it (0..CLUE_SPOTS-1). */
  spot: number;
}

export interface Case {
  index: number;
  mystery: MysteryId;
  band: Band;
  level: number;
  skill: LearningSkill;
  suspects: Suspect[];
  culprit: Species;
  clues: Clue[];
}

/* ───────────────────────── Data ───────────────────────── */

export const HUE_HEX: Record<Hue, string> = {
  red: '#e8453c',
  blue: '#3f7fe0',
  yellow: '#ffc928',
  green: '#3fbf6a',
  purple: '#9b6be8',
};

/** Colour words: French agrees with the noun (un chapeau bleu, une écharpe bleue). */
const HUE_WORD: Record<Hue, { m: string; f: string; en: string }> = {
  red: { m: 'rouge', f: 'rouge', en: 'red' },
  blue: { m: 'bleu', f: 'bleue', en: 'blue' },
  yellow: { m: 'jaune', f: 'jaune', en: 'yellow' },
  green: { m: 'vert', f: 'verte', en: 'green' },
  purple: { m: 'violet', f: 'violette', en: 'purple' },
};

export interface SpeciesInfo {
  name: L;
  short: L;
  emoji: string;
  alibi: L;
  alibiProp: AlibiProp;
  /** A friend whose fur already has this colour never wears it (it would not show). */
  avoid?: Hue;
}

export const SPECIES_INFO: Record<Species, SpeciesInfo> = {
  cat: {
    name: { fr: 'Moustache le chat', en: 'Whiskers the Cat' },
    short: { fr: 'Moustache', en: 'Whiskers' },
    emoji: '🐱',
    alibi: { fr: 'Moi ? Je faisais la sieste au soleil ! Regarde mon coussin !', en: 'Me? I was napping in the sun! Look at my cushion!' },
    alibiProp: 'pillow',
  },
  dog: {
    name: { fr: 'Biscuit le chien', en: 'Biscuit the Dog' },
    short: { fr: 'Biscuit', en: 'Biscuit' },
    emoji: '🐶',
    alibi: { fr: 'Wouf ! Moi, je cherchais mon os… et je l’ai trouvé !', en: 'Woof! I was looking for my bone… and I found it!' },
    alibiProp: 'bone',
  },
  rabbit: {
    name: { fr: 'Pompon le lapin', en: 'Pompom the Bunny' },
    short: { fr: 'Pompon', en: 'Pompom' },
    emoji: '🐰',
    alibi: { fr: 'Moi, je plantais des carottes toute la journée !', en: 'I was planting carrots all day long!' },
    alibiProp: 'carrot',
  },
  fox: {
    name: { fr: 'Filou le renard', en: 'Finn the Fox' },
    short: { fr: 'Filou', en: 'Finn' },
    emoji: '🦊',
    alibi: { fr: 'Pas moi ! J’apprenais à jongler, regarde !', en: 'Not me! I was learning to juggle, look!' },
    alibiProp: 'balls',
  },
  pig: {
    name: { fr: 'Rosette la cochonne', en: 'Rosie the Pig' },
    short: { fr: 'Rosette', en: 'Rosie' },
    emoji: '🐷',
    alibi: { fr: 'Moi ? J’étais dans mon bain moussant ! Plein de bulles !', en: 'Me? I was in my bubble bath! So many bubbles!' },
    alibiProp: 'bubbles',
  },
  owl: {
    name: { fr: 'Plume la chouette', en: 'Hoot the Owl' },
    short: { fr: 'Plume', en: 'Hoot' },
    emoji: '🦉',
    alibi: { fr: 'Hou hou ! Je lisais un gros livre à la bibliothèque !', en: 'Hoo hoo! I was reading a big book at the library!' },
    alibiProp: 'book',
  },
  bear: {
    name: { fr: 'Nounours l’ourson', en: 'Teddy the Bear' },
    short: { fr: 'Nounours', en: 'Teddy' },
    emoji: '🐻',
    alibi: { fr: 'Moi ? Je goûtais mon miel… seulement mon miel !', en: 'Me? I was tasting my honey… only my honey!' },
    alibiProp: 'honey',
  },
  mouse: {
    name: { fr: 'Grignote la souris', en: 'Nibbles the Mouse' },
    short: { fr: 'Grignote', en: 'Nibbles' },
    emoji: '🐭',
    alibi: { fr: 'Moi, je rangeais mes petits fromages !', en: 'I was tidying up my little cheeses!' },
    alibiProp: 'cheese',
  },
  frog: {
    name: { fr: 'Gribouille la grenouille', en: 'Hopper the Frog' },
    short: { fr: 'Gribouille', en: 'Hopper' },
    emoji: '🐸',
    alibi: { fr: 'Croâ ! Je chantais à la mare avec mes copines !', en: 'Ribbit! I was singing at the pond with my friends!' },
    alibiProp: 'note',
    avoid: 'green',
  },
  duck: {
    name: { fr: 'Cancan le canard', en: 'Quackers the Duck' },
    short: { fr: 'Cancan', en: 'Quackers' },
    emoji: '🦆',
    alibi: { fr: 'Coin coin ! J’étais à la piscine avec ma bouée !', en: 'Quack quack! I was at the pool with my swim ring!' },
    alibiProp: 'ring',
  },
  panda: {
    name: { fr: 'Bambou le panda', en: 'Bamboo the Panda' },
    short: { fr: 'Bambou', en: 'Bamboo' },
    emoji: '🐼',
    alibi: { fr: 'Moi, je mangeais du bambou… rien que du bambou !', en: 'I was eating bamboo… only bamboo!' },
    alibiProp: 'bamboo',
  },
  dragon: {
    name: { fr: 'Pépin le dragon', en: 'Pip the Dragon' },
    short: { fr: 'Pépin', en: 'Pip' },
    emoji: '🐲',
    alibi: { fr: 'Moi ? Je faisais griller des guimauves !', en: 'Me? I was toasting marshmallows!' },
    alibiProp: 'marshmallow',
    avoid: 'green',
  },
};

export interface MysteryInfo {
  emoji: string;
  title: L;
  intro: L;
  question: L;
  confession: L;
  party: L;
}

export const MYSTERY_INFO: Record<MysteryId, MysteryInfo> = {
  cake: {
    emoji: '🎂',
    title: { fr: 'Le gâteau disparu', en: 'The Missing Cake' },
    intro: { fr: 'Oh ! Le gros gâteau de la fête a disparu ! Il ne reste que des miettes…', en: 'Oh! The big party cake is gone! Only crumbs are left…' },
    question: { fr: 'Qui a mangé le gâteau ?', en: 'Who ate the cake?' },
    confession: { fr: 'Oups… c’est moi ! Il sentait si bon… Mais je vous ai gardé une part à chacun !', en: 'Oops… it was me! It smelled so good… But I saved a slice for everyone!' },
    party: { fr: 'Tout le monde partage le gâteau sur la place. Miam !', en: 'Everyone shares the cake on the square. Yum!' },
  },
  trumpet: {
    emoji: '🎺',
    title: { fr: 'La trompette envolée', en: 'The Vanishing Trumpet' },
    intro: { fr: 'La trompette de la fanfare a disparu ! Et le concert commence bientôt…', en: 'The band’s trumpet is gone! And the concert starts soon…' },
    question: { fr: 'Qui a pris la trompette ?', en: 'Who took the trumpet?' },
    confession: { fr: 'C’est moi… Je voulais m’entraîner en cachette pour vous faire une surprise !', en: 'It was me… I wanted to practise in secret to surprise you!' },
    party: { fr: 'La fanfare joue et tout le monde danse sur la place !', en: 'The band plays and everyone dances on the square!' },
  },
  mud: {
    emoji: '🐾',
    title: { fr: 'Les traces de boue', en: 'The Muddy Prints' },
    intro: { fr: 'Des traces de boue sur le linge tout propre ! Mais à qui sont ces pattes ?', en: 'Muddy prints on the clean laundry! Whose paws are these?' },
    question: { fr: 'Qui a laissé des traces de boue ?', en: 'Who left the muddy prints?' },
    confession: { fr: 'Hihi, c’est moi ! J’ai sauté dans toutes les flaques… Je vais tout relaver !', en: 'Hee hee, it was me! I jumped in every puddle… I’ll wash it all again!' },
    party: { fr: 'Et maintenant, une fête des bulles de savon pour tout le monde !', en: 'And now, a soap-bubble party for everyone!' },
  },
  flowers: {
    emoji: '🌷',
    title: { fr: 'Les tulipes envolées', en: 'The Missing Tulips' },
    intro: { fr: 'Les tulipes du jardin de la mairie ont disparu !', en: 'The tulips from the town hall garden are gone!' },
    question: { fr: 'Qui a cueilli les tulipes ?', en: 'Who picked the tulips?' },
    confession: { fr: 'C’est moi… Je voulais faire un bouquet pour toi, Ziggy ! Surprise !', en: 'It was me… I wanted to make a bouquet for you, Ziggy! Surprise!' },
    party: { fr: 'Tout le monde replante des fleurs : la place est encore plus jolie !', en: 'Everyone plants new flowers: the square is even prettier!' },
  },
  balloons: {
    emoji: '🎈',
    title: { fr: 'Les ballons envolés', en: 'The Lost Balloons' },
    intro: { fr: 'Les ballons de la fête ont disparu du stand !', en: 'The party balloons are gone from the stand!' },
    question: { fr: 'Qui a pris les ballons ?', en: 'Who took the balloons?' },
    confession: { fr: 'C’est moi ! Je voulais décorer la place… mais j’ai failli m’envoler !', en: 'It was me! I wanted to decorate the square… but I nearly floated away!' },
    party: { fr: 'Des ballons pour tout le monde ! Quelle fête !', en: 'Balloons for everyone! What a party!' },
  },
};

/* ───────────────────────── Truth ───────────────────────── */

export function holds(s: Suspect, t: Trait): boolean {
  switch (t.k) {
    case 'hat':
      return s.hat === t.hue;
    case 'anyHat':
      return s.hat !== null;
    case 'scarf':
      return s.scarf === t.hue;
    case 'anyScarf':
      return s.scarf !== null;
    case 'glasses':
      return s.glasses;
    case 'size':
      return s.size === t.size;
    case 'side':
      return s.col === t.side;
    case 'row':
      return s.row === t.row;
  }
}

export const litHolds = (s: Suspect, l: Lit) => holds(s, l.trait) !== l.not;
export const matches = (s: Suspect, c: Clue) => c.lits.every((l) => litHolds(s, l));

/** The suspects still on the list after the first `step` clues. */
export function remainingAt(c: Case, step: number): Suspect[] {
  return c.suspects.filter((s) => c.clues.slice(0, step).every((cl) => matches(s, cl)));
}

/** At clue `step` (not the last one), the friends the child should clear. */
export function toClear(c: Case, step: number): Species[] {
  const clue = c.clues[step];
  return remainingAt(c, step)
    .filter((s) => !matches(s, clue))
    .map((s) => s.id);
}

export type ClearResult = 'cleared' | 'matches' | 'already';

/** The child taps a suspect during an elimination step. */
export function checkClear(c: Case, step: number, id: Species): ClearResult {
  const s = c.suspects.find((x) => x.id === id);
  if (!s || !remainingAt(c, step).includes(s)) return 'already';
  return matches(s, c.clues[step]) ? 'matches' : 'cleared';
}

export const isLastClue = (c: Case, step: number) => step === c.clues.length - 1;

/** The child points at a suspect after the last clue. */
export const checkAccuse = (c: Case, id: Species) => id === c.culprit;

/* ───────────────────────── Generation ───────────────────────── */

type Rand = () => number;
const pick = <T>(r: Rand, a: readonly T[]): T => a[Math.floor(r() * a.length)];
function shuffle<T>(r: Rand, a: readonly T[]): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The six places on the square, as [col, row]. */
export const SLOTS: readonly { col: Col; row: Row }[] = [
  { col: 'left', row: 'front' },
  { col: 'center', row: 'front' },
  { col: 'right', row: 'front' },
  { col: 'left', row: 'back' },
  { col: 'center', row: 'back' },
  { col: 'right', row: 'back' },
];

export function suspectCount(band: Band, level: number): number {
  if (band === 'little') return level <= 1 ? 3 : 4;
  if (band === 'middle') return level <= 2 ? 4 : 5;
  return level <= 2 ? 5 : 6;
}

export function clueCount(band: Band, level: number): number {
  if (band === 'little') return 2;
  if (band === 'middle') return level <= 2 ? 2 : 3;
  return 3;
}

const family = (t: Trait) => (t.k === 'anyHat' ? 'hat' : t.k === 'anyScarf' ? 'scarf' : t.k);
const isPosition = (t: Trait) => t.k === 'side' || t.k === 'row';
/** Size and row have two values: "not big" is just "small", so they are never negated. */
const negatable = (t: Trait) => t.k !== 'size' && t.k !== 'row';

function traitPool(band: Band, suspects: Suspect[]): Trait[] {
  const hats = new Set(suspects.flatMap((s) => (s.hat ? [s.hat] : [])));
  const scarves = new Set(suspects.flatMap((s) => (s.scarf ? [s.scarf] : [])));
  const out: Trait[] = [];
  for (const hue of HUES) if (hats.has(hue)) out.push({ k: 'hat', hue });
  for (const hue of HUES) if (scarves.has(hue)) out.push({ k: 'scarf', hue });
  out.push({ k: 'glasses' }, { k: 'size', size: 'big' }, { k: 'size', size: 'small' });
  if (band !== 'little') {
    out.push({ k: 'anyHat' }, { k: 'anyScarf' });
    out.push({ k: 'side', side: 'left' }, { k: 'side', side: 'right' }, { k: 'row', row: 'front' }, { k: 'row', row: 'back' });
  }
  return out;
}

/** Every clue shape allowed for this age and level. */
function cluePool(band: Band, level: number, suspects: Suspect[]): Lit[][] {
  const traits = traitPool(band, suspects);
  const singles: Lit[] = traits.map((trait) => ({ trait, not: false }));
  // "Not a yellow hat" (no hat counts too) is the trickiest: only from level 3.
  if (band === 'big') for (const trait of traits) if (negatable(trait) && (level >= 3 || (trait.k !== 'hat' && trait.k !== 'scarf'))) singles.push({ trait, not: true });
  const out: Lit[][] = singles.map((l) => [l]);
  const pairs = band === 'big' || (band === 'middle' && level >= 2);
  if (pairs) {
    for (let i = 0; i < singles.length; i++)
      for (let j = i + 1; j < singles.length; j++) {
        const a = singles[i];
        const b = singles[j];
        if (family(a.trait) === family(b.trait)) continue;
        if (a.not && b.not) continue; // one "not" at a time is plenty
        out.push(a.not ? [b, a] : [a, b]);
      }
  }
  return out;
}

function randomSuspects(r: Rand, band: Band, species: Species[], n: number): Suspect[] {
  const hues = band === 'little' ? HUES.slice(0, 4) : HUES;
  const slots = band === 'little' ? (n === 3 ? [0, 1, 2] : [0, 2, 3, 5]) : shuffle(r, [0, 1, 2, 3, 4, 5]).slice(0, n).sort((a, b) => a - b);
  return species.slice(0, n).map((id, i) => {
    const avoid = SPECIES_INFO[id].avoid;
    const choices = hues.filter((h) => h !== avoid);
    return {
      id,
      hat: r() < 0.68 ? pick(r, choices) : null,
      glasses: r() < 0.42,
      scarf: r() < 0.5 ? pick(r, choices) : null,
      size: r() < 0.5 ? 'big' : 'small',
      col: SLOTS[slots[i]].col,
      row: SLOTS[slots[i]].row,
    };
  });
}

interface Needs {
  position: boolean;
  pair: boolean;
  negation: boolean;
}

function needsFor(band: Band, level: number): Needs {
  if (band === 'little') return { position: false, pair: false, negation: false };
  if (band === 'middle') return { position: true, pair: level >= 2, negation: false };
  return { position: false, pair: true, negation: true };
}

const hasPosition = (lits: Lit[]) => lits.some((l) => isPosition(l.trait));
const hasNegation = (lits: Lit[]) => lits.some((l) => l.not);

/**
 * Try to chain clues for this line-up: each clue keeps the culprit and clears
 * at least one friend; the last one leaves the culprit alone.
 */
function chainClues(r: Rand, band: Band, level: number, suspects: Suspect[], culprit: Suspect, count: number): Lit[][] | null {
  const pool = cluePool(band, level, suspects).filter((lits) => lits.every((l) => litHolds(culprit, l)));
  const need = needsFor(band, level);
  let cand = suspects;
  const chosen: Lit[][] = [];
  for (let step = 0; step < count; step++) {
    const last = step === count - 1;
    const options = pool.filter((lits) => {
      if (chosen.some((c) => sameClue(c, lits))) return false;
      const left = cand.filter((s) => lits.every((l) => litHolds(s, l))).length;
      if (left === cand.length) return false;
      if (last ? left !== 1 : left < 2) return false;
      if (lits.length === 2) {
        // A real combination: both halves are needed.
        for (const l of lits) if (cand.filter((s) => litHolds(s, l)).length === left) return false;
      }
      return true;
    });
    if (!options.length) return null;
    // Prefer the shapes this age still needs (positions, "and", "not").
    const missing = (lits: Lit[]) =>
      (need.position && !chosen.some(hasPosition) && hasPosition(lits) ? 1 : 0) +
      (need.pair && !chosen.some((c) => c.length === 2) && lits.length === 2 ? 1 : 0) +
      (need.negation && !chosen.some(hasNegation) && hasNegation(lits) ? 1 : 0);
    const best = Math.max(...options.map(missing));
    const top = best > 0 && r() < 0.85 ? options.filter((o) => missing(o) === best) : options;
    // Little ones: one friend cleared at a time is enough work; prefer gentle clues.
    const gentle = !last && band === 'little' ? top.filter((lits) => cand.length - cand.filter((s) => lits.every((l) => litHolds(s, l))).length <= 2) : top;
    const lits = pick(r, gentle.length ? gentle : top);
    chosen.push(lits);
    cand = cand.filter((s) => lits.every((l) => litHolds(s, l)));
  }
  if (need.position && !chosen.some(hasPosition)) return null;
  if (need.pair && !chosen.some((c) => c.length === 2)) return null;
  if (need.negation && !chosen.some(hasNegation)) return null;
  return chosen;
}

function sameClue(a: Lit[], b: Lit[]): boolean {
  const key = (l: Lit[]) =>
    l
      .map((x) => JSON.stringify(x))
      .sort()
      .join('|');
  return key(a) === key(b);
}

export function skillFor(band: Band, index: number): LearningSkill {
  const order: Record<Band, LearningSkill[]> = {
    little: ['logic', 'vocabulary', 'logic'],
    middle: ['logic', 'reading', 'vocabulary'],
    big: ['logic', 'reading', 'logic'],
  };
  return order[band][index % 3];
}

/** One mystery, decided by the seed, for this age band and level. */
export function planCase(seed: number, band: Band, level: number, index: number, mystery: MysteryId, avoidCulprits: Species[] = []): Case {
  const r = rng(seed * 31 + index * 977 + 5);
  const lv = Math.max(1, Math.min(5, Math.round(level)));
  const n = suspectCount(band, lv);
  const count = clueCount(band, lv);
  for (let attempt = 0; attempt < 600; attempt++) {
    const species = shuffle(r, SPECIES);
    const suspects = randomSuspects(r, band, species, n);
    const pool = suspects.filter((s) => !avoidCulprits.includes(s.id));
    const culprit = pick(r, pool.length ? pool : suspects);
    const chain = chainClues(r, band, lv, suspects, culprit, count);
    if (!chain) continue;
    const spots = shuffle(r, Array.from({ length: CLUE_SPOTS }, (_, i) => i));
    return {
      index,
      mystery,
      band,
      level: lv,
      skill: skillFor(band, index),
      suspects,
      culprit: culprit.id,
      clues: chain.map((lits, i) => ({ lits, spot: spots[i] })),
    };
  }
  // Practically unreachable; a tiny fixed case keeps the game playable whatever happens.
  return fallbackCase(band, lv, index, mystery);
}

function fallbackCase(band: Band, level: number, index: number, mystery: MysteryId): Case {
  const suspects: Suspect[] = [
    { id: 'cat', hat: 'red', glasses: false, scarf: null, size: 'big', col: 'left', row: 'front' },
    { id: 'dog', hat: 'red', glasses: true, scarf: 'blue', size: 'small', col: 'center', row: 'front' },
    { id: 'rabbit', hat: null, glasses: true, scarf: 'blue', size: 'big', col: 'right', row: 'front' },
  ];
  return {
    index,
    mystery,
    band,
    level,
    skill: skillFor(band, index),
    suspects,
    culprit: 'dog',
    clues: [
      { lits: [{ trait: { k: 'hat', hue: 'red' }, not: false }], spot: 0 },
      { lits: [{ trait: { k: 'glasses' }, not: false }], spot: 1 },
    ],
  };
}

/** A whole game: three different mysteries, three different culprits. */
export function planGame(seed: number, band: Band, levels: number | number[]): Case[] {
  const r = rng(seed * 13 + 7);
  const mysteries = shuffle(r, MYSTERIES).slice(0, CASES_PER_GAME);
  const out: Case[] = [];
  for (let i = 0; i < CASES_PER_GAME; i++) {
    const level = Array.isArray(levels) ? (levels[i] ?? levels[0] ?? 1) : levels;
    out.push(planCase(seed, band, level, i, mysteries[i], out.map((c) => c.culprit)));
  }
  return out;
}

/* ───────────────────────── Words ───────────────────────── */

const fr = (locale: string) => locale === 'fr';

/** A statement as a verb phrase: "porte un chapeau rouge" / "wears a red hat". */
export function phrase(l: Lit, locale: string): string {
  const t = l.trait;
  const F = fr(locale);
  switch (t.k) {
    case 'hat':
      return F ? (l.not ? `ne porte pas de chapeau ${HUE_WORD[t.hue].m}` : `porte un chapeau ${HUE_WORD[t.hue].m}`) : l.not ? `does not wear a ${HUE_WORD[t.hue].en} hat` : `wears a ${HUE_WORD[t.hue].en} hat`;
    case 'anyHat':
      return F ? (l.not ? 'ne porte pas de chapeau' : 'porte un chapeau') : l.not ? 'does not wear a hat' : 'wears a hat';
    case 'scarf':
      return F ? (l.not ? `ne porte pas d’écharpe ${HUE_WORD[t.hue].f}` : `porte une écharpe ${HUE_WORD[t.hue].f}`) : l.not ? `does not wear a ${HUE_WORD[t.hue].en} scarf` : `wears a ${HUE_WORD[t.hue].en} scarf`;
    case 'anyScarf':
      return F ? (l.not ? 'ne porte pas d’écharpe' : 'porte une écharpe') : l.not ? 'does not wear a scarf' : 'wears a scarf';
    case 'glasses':
      return F ? (l.not ? 'ne porte pas de lunettes' : 'porte des lunettes') : l.not ? 'does not wear glasses' : 'wears glasses';
    case 'size':
      return F ? (t.size === 'big' ? 'est grand' : 'est petit') : t.size === 'big' ? 'is big' : 'is small';
    case 'side': {
      const where = F ? (t.side === 'left' ? 'à gauche de la fontaine' : 'à droite de la fontaine') : t.side === 'left' ? 'to the left of the fountain' : 'to the right of the fountain';
      return F ? (l.not ? `n’est pas ${where}` : `est ${where}`) : l.not ? `is not ${where}` : `is ${where}`;
    }
    case 'row':
      return F ? (t.row === 'front' ? 'est devant la fontaine' : 'est derrière la fontaine') : t.row === 'front' ? 'is in front of the fountain' : 'is behind the fountain';
  }
}

/** The statement that is true when `l` is false. */
export function opposite(l: Lit): Lit {
  const t = l.trait;
  if (t.k === 'size') return { trait: { k: 'size', size: t.size === 'big' ? 'small' : 'big' }, not: false };
  if (t.k === 'row') return { trait: { k: 'row', row: t.row === 'front' ? 'back' : 'front' }, not: false };
  return { trait: t, not: !l.not };
}

const joinAnd = (parts: string[], locale: string) => parts.join(fr(locale) ? ' et ' : ' and ');

/** "Le coupable porte un chapeau rouge." / "The culprit wears a red hat." */
export function clueText(c: Clue, locale: string): string {
  return `${fr(locale) ? 'Le coupable' : 'The culprit'} ${joinAnd(
    c.lits.map((l) => phrase(l, locale)),
    locale
  )}.`;
}

/** What to do after a clue (not the last one): clear the friends who don't match. */
export function clearPrompt(c: Clue, locale: string): string {
  if (c.lits.length === 1) {
    const opp = phrase(opposite(c.lits[0]), locale);
    return fr(locale) ? `Touche chaque suspect qui ${opp} : ce n’est pas lui !` : `Tap every suspect who ${opp}: it wasn’t them!`;
  }
  return fr(locale) ? 'Touche chaque suspect qui ne va pas avec l’indice : ce n’est pas lui !' : 'Tap every suspect who doesn’t match the clue: it wasn’t them!';
}

/** After the last clue: point at the culprit. */
export function accusePrompt(c: Case, locale: string): string {
  const q = MYSTERY_INFO[c.mystery].question;
  return fr(locale) ? `${q.fr} Touche le coupable !` : `${q.en} Tap the culprit!`;
}

export const shortName = (id: Species, locale: string) => (fr(locale) ? SPECIES_INFO[id].short.fr : SPECIES_INFO[id].short.en);
export const fullName = (id: Species, locale: string) => (fr(locale) ? SPECIES_INFO[id].name.fr : SPECIES_INFO[id].name.en);

/** The child tried to clear a friend who matches: say why, gently. */
export function whyMatch(s: Suspect, c: Clue, locale: string): string {
  const what = joinAnd(
    c.lits.map((l) => phrase(l, locale)),
    locale
  );
  return fr(locale) ? `Regarde bien : ${shortName(s.id, locale)} ${what}. Ça va avec l’indice !` : `Look closely: ${shortName(s.id, locale)} ${what}. That matches the clue!`;
}

/** The child accused a friend who doesn't match: what is different about them. */
export function whyNot(s: Suspect, c: Clue, locale: string): string {
  const miss = c.lits.find((l) => !litHolds(s, l)) ?? c.lits[0];
  const what = phrase(opposite(miss), locale);
  return fr(locale) ? `Mais ${shortName(s.id, locale)} ${what} !` : `But ${shortName(s.id, locale)} ${what}!`;
}

const CLEARED_LINES: L[] = [
  { fr: 'Ouf ! Ce n’est pas moi !', en: 'Phew! Not me!' },
  { fr: 'Merci, détective !', en: 'Thank you, detective!' },
  { fr: 'Je vais boire une limonade !', en: 'I’m off for a lemonade!' },
  { fr: 'Youpi ! Bonne enquête, Ziggy !', en: 'Yay! Good luck, Ziggy!' },
  { fr: 'Hihi, je n’ai rien fait !', en: 'Hee hee, I didn’t do it!' },
];

export const clearedLine = (n: number, locale: string) => {
  const l = CLEARED_LINES[((n % CLEARED_LINES.length) + CLEARED_LINES.length) % CLEARED_LINES.length];
  return fr(locale) ? l.fr : l.en;
};

export function leftLine(n: number, locale: string): string {
  return fr(locale) ? `Bravo ! Il reste ${n} suspects. Cherchons un autre indice !` : `Well done! ${n} suspects left. Let’s find another clue!`;
}

/** A short, spoken-friendly description of a suspect (labels, screen readers). */
export function describe(s: Suspect, locale: string): string {
  const F = fr(locale);
  const parts: string[] = [];
  parts.push(s.hat ? (F ? `chapeau ${HUE_WORD[s.hat].m}` : `${HUE_WORD[s.hat].en} hat`) : F ? 'sans chapeau' : 'no hat');
  if (s.glasses) parts.push(F ? 'lunettes' : 'glasses');
  if (s.scarf) parts.push(F ? `écharpe ${HUE_WORD[s.scarf].f}` : `${HUE_WORD[s.scarf].en} scarf`);
  parts.push(F ? (s.size === 'big' ? 'grand' : 'petit') : s.size === 'big' ? 'big' : 'small');
  return `${fullName(s.id, locale)}${F ? ' : ' : ': '}${parts.join(', ')}`;
}

export function hueWord(h: Hue, locale: string, feminine = false): string {
  return fr(locale) ? (feminine ? HUE_WORD[h].f : HUE_WORD[h].m) : HUE_WORD[h].en;
}
