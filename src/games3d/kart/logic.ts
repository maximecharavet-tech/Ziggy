/**
 * Ziggy Kart des lettres — the pure logic (no three.js, no DOM).
 *
 * Ziggy drives a little kart on a rainbow road; arches carry letters and the
 * child picks a lane to drive under the right one, building the word shown
 * in a picture (and read aloud). The words follow the language (separate
 * French and English lists).
 *
 * - little (4–6): the FIRST letter of a picture word (capitals, 3 wide lanes).
 * - middle (6–8): short words spelled letter by letter.
 * - big (8–12): longer words with tricky sounds (ou, on, ch, gn, sh, ee…):
 *   the missing sounds are gates, next to look-alike "trickster" gates.
 *
 * A wrong gate is never a failure: the kart does a funny corkscrew and the
 * same gate comes back, a little easier (it sparkles, then the others fade).
 */
import { rng } from '../kit/rng';

export type Band = 'little' | 'middle' | 'big';
export type Locale = 'fr' | 'en';
export type Mode = 'first' | 'spell' | 'sounds';
export type KartSkill = 'letters' | 'reading' | 'vocabulary';
export type Text = { fr: string; en: string };

/** The 3D objects a word can bring into the kart (built in `props.ts`). */
export const PROPS = [
  'cat', 'dog', 'bear', 'lion', 'rabbit', 'pig', 'cow', 'sheep', 'duck', 'chick', 'bird', 'penguin',
  'fish', 'dolphin', 'whale', 'frog', 'turtle', 'snail', 'bee', 'butterfly',
  'apple', 'banana', 'orange', 'cake', 'pumpkin', 'mushroom', 'egg',
  'tree', 'flower', 'sun', 'moon', 'star', 'cloud', 'house', 'mountain', 'hat', 'ball',
  'boat', 'rocket', 'plane', 'bus', 'bike', 'train', 'robot',
] as const;
export type PropId = (typeof PROPS)[number];

/** A word of the lists: `w` is how it is written (lowercase, with accents), `u` its sound units for big kids. */
interface Entry {
  w: string;
  emoji: string;
  prop: PropId;
  /** Sound units, `|`-separated (big band only): "M|OU|T|ON". */
  u?: string;
}

const e = (w: string, emoji: string, prop: PropId, u?: string): Entry => ({ w, emoji, prop, u });

/* ───────────────────────── Word lists ───────────────────────── */

/** Little ones: picture words with a clear first letter. */
const LITTLE: Record<Locale, Entry[]> = {
  fr: [
    e('chat', '🐱', 'cat'),
    e('lune', '🌙', 'moon'),
    e('soleil', '☀️', 'sun'),
    e('pomme', '🍎', 'apple'),
    e('bateau', '⛵', 'boat'),
    e('fusée', '🚀', 'rocket'),
    e('vache', '🐮', 'cow'),
    e('tortue', '🐢', 'turtle'),
    e('maison', '🏠', 'house'),
    e('robot', '🤖', 'robot'),
    e('avion', '✈️', 'plane'),
    e('nuage', '☁️', 'cloud'),
    e('gâteau', '🎂', 'cake'),
    e('dauphin', '🐬', 'dolphin'),
    e('lapin', '🐰', 'rabbit'),
    e('canard', '🦆', 'duck'),
    e('escargot', '🐌', 'snail'),
    e('banane', '🍌', 'banana'),
    e('train', '🚂', 'train'),
    e('poisson', '🐟', 'fish'),
  ],
  en: [
    e('cat', '🐱', 'cat'),
    e('moon', '🌙', 'moon'),
    e('sun', '☀️', 'sun'),
    e('apple', '🍎', 'apple'),
    e('boat', '⛵', 'boat'),
    e('rocket', '🚀', 'rocket'),
    e('cow', '🐮', 'cow'),
    e('turtle', '🐢', 'turtle'),
    e('house', '🏠', 'house'),
    e('plane', '✈️', 'plane'),
    e('dog', '🐶', 'dog'),
    e('fish', '🐟', 'fish'),
    e('lion', '🦁', 'lion'),
    e('bear', '🐻', 'bear'),
    e('duck', '🦆', 'duck'),
    e('tree', '🌳', 'tree'),
    e('whale', '🐳', 'whale'),
    e('pig', '🐷', 'pig'),
    e('egg', '🥚', 'egg'),
    e('frog', '🐸', 'frog'),
    e('rabbit', '🐰', 'rabbit'),
  ],
};

/** Middle: short words spelled letter by letter (picked by length and level). */
const MIDDLE: Record<Locale, Entry[]> = {
  fr: [
    e('chat', '🐱', 'cat'),
    e('lune', '🌙', 'moon'),
    e('vélo', '🚲', 'bike'),
    e('bus', '🚌', 'bus'),
    e('rose', '🌹', 'flower'),
    e('ours', '🐻', 'bear'),
    e('lion', '🦁', 'lion'),
    e('pomme', '🍎', 'apple'),
    e('fusée', '🚀', 'rocket'),
    e('vache', '🐮', 'cow'),
    e('lapin', '🐰', 'rabbit'),
    e('arbre', '🌳', 'tree'),
    e('nuage', '☁️', 'cloud'),
    e('avion', '✈️', 'plane'),
    e('robot', '🤖', 'robot'),
    e('train', '🚂', 'train'),
    e('tortue', '🐢', 'turtle'),
    e('canard', '🦆', 'duck'),
    e('soleil', '☀️', 'sun'),
    e('étoile', '⭐', 'star'),
    e('ballon', '⚽', 'ball'),
    e('banane', '🍌', 'banana'),
    e('maison', '🏠', 'house'),
  ],
  en: [
    e('cat', '🐱', 'cat'),
    e('sun', '☀️', 'sun'),
    e('bus', '🚌', 'bus'),
    e('dog', '🐶', 'dog'),
    e('pig', '🐷', 'pig'),
    e('bee', '🐝', 'bee'),
    e('egg', '🥚', 'egg'),
    e('fish', '🐟', 'fish'),
    e('moon', '🌙', 'moon'),
    e('bike', '🚲', 'bike'),
    e('frog', '🐸', 'frog'),
    e('duck', '🦆', 'duck'),
    e('star', '⭐', 'star'),
    e('cake', '🎂', 'cake'),
    e('tree', '🌳', 'tree'),
    e('lion', '🦁', 'lion'),
    e('bear', '🐻', 'bear'),
    e('boat', '⛵', 'boat'),
    e('apple', '🍎', 'apple'),
    e('house', '🏠', 'house'),
    e('train', '🚂', 'train'),
    e('whale', '🐳', 'whale'),
    e('plane', '✈️', 'plane'),
    e('robot', '🤖', 'robot'),
    e('sheep', '🐑', 'sheep'),
    e('chick', '🐤', 'chick'),
    e('rocket', '🚀', 'rocket'),
    e('turtle', '🐢', 'turtle'),
    e('rabbit', '🐰', 'rabbit'),
    e('orange', '🍊', 'orange'),
    e('flower', '🌸', 'flower'),
    e('banana', '🍌', 'banana'),
  ],
};

/** Big: longer words cut into sound units; the tricky units become gates. */
const BIG: Record<Locale, Entry[]> = {
  fr: [
    e('mouton', '🐑', 'sheep', 'M|OU|T|ON'),
    e('champignon', '🍄', 'mushroom', 'CH|AM|P|I|GN|ON'),
    e('papillon', '🦋', 'butterfly', 'P|A|P|ILL|ON'),
    e('grenouille', '🐸', 'frog', 'G|R|E|N|OU|ILL|E'),
    e('bateau', '⛵', 'boat', 'B|A|T|EAU'),
    e('oiseau', '🐦', 'bird', 'OI|S|EAU'),
    e('montagne', '⛰️', 'mountain', 'M|ON|T|A|GN|E'),
    e('dauphin', '🐬', 'dolphin', 'D|AU|PH|IN'),
    e('poussin', '🐤', 'chick', 'P|OU|SS|IN'),
    e('chapeau', '🎩', 'hat', 'CH|A|P|EAU'),
    e('pingouin', '🐧', 'penguin', 'P|IN|G|OU|IN'),
    e('citrouille', '🎃', 'pumpkin', 'C|I|T|R|OU|ILL|E'),
    e('cochon', '🐷', 'pig', 'C|O|CH|ON'),
    e('baleine', '🐳', 'whale', 'B|A|L|EI|N|E'),
    e('orange', '🍊', 'orange', 'O|R|AN|G|E'),
    e('lapin', '🐰', 'rabbit', 'L|A|P|IN'),
    e('étoile', '⭐', 'star', 'É|T|OI|L|E'),
    e('gâteau', '🎂', 'cake', 'G|Â|T|EAU'),
  ],
  en: [
    e('sheep', '🐑', 'sheep', 'SH|EE|P'),
    e('chick', '🐤', 'chick', 'CH|I|CK'),
    e('train', '🚂', 'train', 'T|R|AI|N'),
    e('snail', '🐌', 'snail', 'S|N|AI|L'),
    e('boat', '⛵', 'boat', 'B|OA|T'),
    e('dolphin', '🐬', 'dolphin', 'D|O|L|PH|I|N'),
    e('mushroom', '🍄', 'mushroom', 'M|U|SH|R|OO|M'),
    e('butterfly', '🦋', 'butterfly', 'B|U|TT|ER|F|L|Y'),
    e('whale', '🐳', 'whale', 'WH|A|L|E'),
    e('flower', '🌸', 'flower', 'F|L|OW|ER'),
    e('star', '⭐', 'star', 'S|T|AR'),
    e('bird', '🐦', 'bird', 'B|IR|D'),
    e('mountain', '⛰️', 'mountain', 'M|OU|N|T|AI|N'),
    e('rocket', '🚀', 'rocket', 'R|O|CK|E|T'),
    e('cloud', '☁️', 'cloud', 'C|L|OU|D'),
    e('house', '🏠', 'house', 'H|OU|S|E'),
    e('penguin', '🐧', 'penguin', 'P|E|N|G|U|I|N'),
    e('moon', '🌙', 'moon', 'M|OO|N'),
  ],
};

/** Every list, for the tests and the prop check. */
export const WORD_LISTS = { little: LITTLE, middle: MIDDLE, big: BIG } as const;

/* ───────────────────────── Letters & look-alikes ───────────────────────── */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
/** Easy, common capitals for the little ones' wrong gates. */
const COMMON = 'ABCDEFGLMNOPRSTUV'.split('');
const ACCENT_BASE: Record<string, string> = { É: 'E', È: 'E', Ê: 'E', Ë: 'E', À: 'A', Â: 'A', Î: 'I', Ï: 'I', Ô: 'O', Û: 'U', Ù: 'U', Ü: 'U', Ç: 'C' };
/** The letter without its accent (É → E). */
export const baseLetter = (l: string) => ACCENT_BASE[l] ?? l;

/** Capitals that look alike (a harder wrong gate). */
const LOOK_ALIKE = [['B', 'D', 'P', 'R'], ['M', 'N', 'W'], ['C', 'G', 'O', 'Q'], ['E', 'F'], ['I', 'J', 'L', 'T'], ['U', 'V', 'Y'], ['S', 'Z']];
/** Letters that sound alike (big kids' trickster gates). */
const SOUND_ALIKE = [['B', 'P'], ['D', 'T'], ['F', 'V'], ['S', 'Z', 'C'], ['G', 'J'], ['K', 'C', 'Q'], ['M', 'N'], ['I', 'Y'], ['É', 'È', 'E'], ['A', 'Â'], ['L', 'R'], ['O', 'U']];

/** Trickster units for the tricky sounds (they sound or look a lot like the right one). */
const TRICKSTERS: Record<Locale, Record<string, string[]>> = {
  fr: {
    OU: ['O', 'U', 'ON', 'AU'],
    ON: ['AN', 'OM', 'OU', 'EN'],
    AN: ['EN', 'ON', 'AM'],
    AM: ['AN', 'EM', 'OM'],
    IN: ['UN', 'AN', 'IM', 'EN'],
    OI: ['OU', 'AI', 'IO'],
    AU: ['EAU', 'O', 'OU'],
    EAU: ['AU', 'O', 'EU'],
    EI: ['AI', 'É', 'E'],
    CH: ['SH', 'C', 'K'],
    GN: ['NI', 'NG', 'N'],
    PH: ['F', 'P', 'FF'],
    ILL: ['IL', 'Y', 'LL'],
    SS: ['S', 'C', 'Z'],
    É: ['E', 'È', 'Ê'],
    Â: ['A', 'À', 'O'],
  },
  en: {
    SH: ['CH', 'S', 'TH'],
    CH: ['SH', 'C', 'K'],
    EE: ['EA', 'E', 'I'],
    OO: ['O', 'U', 'OU'],
    OA: ['O', 'OW', 'AO'],
    OW: ['OU', 'O', 'AW'],
    OU: ['OW', 'O', 'U'],
    AI: ['AY', 'A', 'EI'],
    AR: ['ER', 'OR', 'A'],
    ER: ['UR', 'IR', 'AR'],
    IR: ['ER', 'UR', 'EER'],
    PH: ['F', 'FF', 'P'],
    CK: ['K', 'C', 'CC'],
    WH: ['W', 'H', 'V'],
    TT: ['T', 'D', 'TH'],
  },
};

/** Is this sound unit a tricky one (several letters, or an accent)? */
export const isTricky = (unit: string) => Array.from(unit).length > 1 || baseLetter(unit) !== unit;

/* ───────────────────────── The run ───────────────────────── */

export interface Step {
  /** Index of the unit this gate writes. */
  slot: number;
  answer: string;
  /** One per lane: left, middle, right. */
  options: [string, string, string];
}

export interface KartWord {
  id: string;
  /** Lowercase spelling, for the voice ("vélo"). */
  w: string;
  /** Capitals, for the screen ("VÉLO"). */
  word: string;
  emoji: string;
  prop: PropId;
  /** Letters (little, middle) or sound units (big). */
  units: string[];
  /** Units shown from the start (the others are won at the gates). */
  given: boolean[];
  /** Show the hidden units as pale "ghost" letters to copy. */
  ghost: boolean;
  steps: Step[];
}

export interface Pacing {
  /** Kart speed (units / second). */
  speed: number;
  /** Distance between the lanes (wider for the little ones). */
  laneGap: number;
  /** Seconds before the first gate of a word (time to hear it). */
  firstGap: number;
  /** Seconds between two gates of the same word. */
  stepGap: number;
  /** Seconds before a gate comes back after a corkscrew. */
  retryGap: number;
}

export interface KartRun {
  band: Band;
  level: number;
  locale: Locale;
  mode: Mode;
  skill: KartSkill;
  words: KartWord[];
  pacing: Pacing;
}

export const MODE_BY_BAND: Record<Band, Mode> = { little: 'first', middle: 'spell', big: 'sounds' };
export const SKILL_BY_BAND: Record<Band, KartSkill> = { little: 'letters', middle: 'reading', big: 'vocabulary' };

/** 4 to 6 words a race. */
export function wordsPerRun(band: Band, level: number): number {
  if (band === 'little') return level <= 1 ? 5 : 6;
  return level <= 2 ? 4 : 5;
}

/** Calm speeds, a bit faster with age and level; never a race against the clock. */
export function pacing(band: Band, level: number): Pacing {
  const lv = Math.max(1, Math.min(5, level)) - 1;
  if (band === 'little') return { speed: 8 + lv * 0.5, laneGap: 3.6, firstGap: 9.5, stepGap: 6, retryGap: 7.5 };
  if (band === 'middle') return { speed: 9.5 + lv * 0.5, laneGap: 3.0, firstGap: 6.5, stepGap: 4.8, retryGap: 5.5 };
  return { speed: 10.5 + lv * 0.5, laneGap: 3.0, firstGap: 6.5, stepGap: 5, retryGap: 5.5 };
}

const upper = (w: string, locale: Locale) => w.toLocaleUpperCase(locale === 'fr' ? 'fr-FR' : 'en-US');

export function unitsOf(entry: { w: string; u?: string }, locale: Locale): string[] {
  return entry.u ? entry.u.split('|') : Array.from(upper(entry.w, locale));
}

function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pick = <T>(arr: T[], r: () => number): T => arr[Math.floor(r() * arr.length)];

/** Two wrong gates for a single letter. */
function letterTricksters(answer: string, band: Band, level: number, word: string[], r: () => number): string[] {
  const base = baseLetter(answer);
  const bad = new Set([answer, base]);
  const ok = (l: string) => !bad.has(l) && !bad.has(baseLetter(l));
  const out: string[] = [];
  // Harder levels: one look-alike (little/middle) or sound-alike (big) trickster.
  const hard = (band === 'little' && level >= 2) || (band === 'middle' && level >= 3) || band === 'big';
  if (hard) {
    const groups = band === 'big' ? SOUND_ALIKE : LOOK_ALIKE;
    const near = groups.filter((g) => g.includes(answer) || g.includes(base)).flat().filter(ok);
    if (near.length) out.push(pick(near, r));
  }
  // Easy levels avoid the letters of the word itself, so a gate is never "right later".
  const avoid = new Set(band === 'big' || (band === 'middle' && level >= 3) ? [] : word.map(baseLetter));
  while (out.length < 2) {
    let pool = (band === 'little' ? COMMON : ALPHABET).filter((l) => ok(l) && !avoid.has(l) && !out.includes(l));
    if (!pool.length) pool = ALPHABET.filter((l) => ok(l) && !out.includes(l));
    out.push(pick(pool, r));
  }
  return out;
}

/** Two wrong gates for a sound unit (big kids). */
function unitTricksters(unit: string, locale: Locale, word: string[], r: () => number): string[] {
  const table = TRICKSTERS[locale][unit];
  if (!table) return letterTricksters(unit, 'big', 3, word, r);
  return shuffle(table.filter((t) => t !== unit), r).slice(0, 2);
}

/** Put the answer in a lane, avoiding the same lane three times in a row. */
function placeOptions(answer: string, wrong: string[], r: () => number, prevLanes: number[]): [string, string, string] {
  let lane = Math.floor(r() * 3);
  if (prevLanes.length >= 2 && prevLanes.at(-1) === lane && prevLanes.at(-2) === lane) lane = (lane + 1 + Math.floor(r() * 2)) % 3;
  const others = shuffle(wrong.slice(0, 2), r);
  const opts = [...others];
  opts.splice(lane, 0, answer);
  return opts as [string, string, string];
}

/** Which units of a big word become gates: the tricky sounds first, then a consonant. */
function soundSlots(units: string[], level: number, r: () => number): number[] {
  const max = level <= 2 ? 2 : level === 3 ? 3 : 4;
  const tricky = units.map((u, i) => (isTricky(u) ? i : -1)).filter((i) => i >= 0);
  let slots = shuffle(tricky, r).slice(0, max);
  const singles = shuffle(
    units.map((u, i) => (!isTricky(u) && !'AEIOUY'.includes(u) ? i : -1)).filter((i) => i >= 0),
    r
  );
  const want = Math.min(Math.max(2, level >= 3 ? max : 2), units.length - 1);
  while (slots.length < want && singles.length) slots.push(singles.shift()!);
  slots = [...new Set(slots)].sort((a, b) => a - b);
  return slots;
}

function middlePool(list: Entry[], level: number): Entry[] {
  const len = (x: Entry) => Array.from(x.w).length;
  const f = level <= 1 ? (x: Entry) => len(x) <= 4 : level === 2 ? (x: Entry) => len(x) <= 5 : level === 3 ? (x: Entry) => len(x) >= 4 && len(x) <= 5 : (x: Entry) => len(x) >= 5;
  return list.filter(f);
}

export function planRun(seed: number, band: Band, level: number, locale: Locale): KartRun {
  const r = rng(seed * 13 + 5);
  const lv = Math.max(1, Math.min(5, Math.round(level)));
  const mode = MODE_BY_BAND[band];
  const n = wordsPerRun(band, lv);
  const list = band === 'little' ? LITTLE[locale] : band === 'middle' ? middlePool(MIDDLE[locale], lv) : BIG[locale];
  // Distinct words; for the little ones, distinct first letters too.
  const chosen: Entry[] = [];
  const firsts = new Set<string>();
  for (const x of shuffle(list, r)) {
    if (chosen.length >= n) break;
    const first = baseLetter(unitsOf(x, locale)[0]);
    if (band === 'little' && firsts.has(first)) continue;
    firsts.add(first);
    chosen.push(x);
  }
  const lanes: number[] = [];
  const words: KartWord[] = chosen.map((x, wi) => {
    const units = unitsOf(x, locale);
    const slots = mode === 'first' ? [0] : mode === 'spell' ? units.map((_, i) => i) : soundSlots(units, lv, r);
    const steps: Step[] = slots.map((slot) => {
      const answer = units[slot];
      const wrong = mode === 'sounds' && isTricky(answer) ? unitTricksters(answer, locale, units, r) : letterTricksters(answer, band, lv, units, r);
      const options = placeOptions(answer, wrong, r, lanes);
      lanes.push(options.indexOf(answer));
      return { slot, answer, options };
    });
    return {
      id: `${wi}-${x.w}`,
      w: x.w,
      word: upper(x.w, locale),
      emoji: x.emoji,
      prop: x.prop,
      units,
      given: units.map((_, i) => !slots.includes(i)),
      ghost: (band === 'little' && lv <= 1) || (band === 'middle' && lv <= 2),
      steps,
    };
  });
  return { band, level: lv, locale, mode, skill: SKILL_BY_BAND[band], words, pacing: pacing(band, lv) };
}

/** Did the kart drive under the right gate? */
export function checkGate(step: Step, lane: number): boolean {
  return step.options[lane] === step.answer;
}

/** The same gate again after a corkscrew: same letters, new lanes. */
export function reshuffle(step: Step, seed: number): Step {
  const r = rng(seed * 31 + 7);
  const prev = step.options.indexOf(step.answer);
  const wrong = step.options.filter((o) => o !== step.answer);
  let lane = Math.floor(r() * 3);
  if (lane === prev) lane = (lane + 1 + Math.floor(r() * 2)) % 3;
  const opts = shuffle(wrong, r);
  opts.splice(lane, 0, step.answer);
  return { ...step, options: opts as [string, string, string] };
}

/** What a word looks like now: a unit, or null for a blank still to win. */
export function wordSlots(word: KartWord, stepsDone: number): (string | null)[] {
  const won = new Set(word.steps.slice(0, stepsDone).map((s) => s.slot));
  return word.units.map((u, i) => (word.given[i] || won.has(i) ? u : null));
}

/** Stars come from first-try gates; corkscrews only count as gentle mistakes. */
export function scoreRun(gates: { tries: number }[]): { correct: number; mistakes: number; total: number } {
  return {
    correct: gates.filter((g) => g.tries <= 1).length,
    mistakes: gates.reduce((s, g) => s + Math.max(0, g.tries - 1), 0),
    total: gates.length,
  };
}

/* ───────────────────────── What Ziggy says ───────────────────────── */

const LANES: Text[] = [
  { fr: 'À gauche', en: 'Left' },
  { fr: 'Au milieu', en: 'Middle' },
  { fr: 'À droite', en: 'Right' },
];
export const laneName = (i: number, locale: Locale) => LANES[i][locale];

/** The word's instruction, read aloud when it appears. */
export function questionLines(word: KartWord, mode: Mode, locale: Locale): string[] {
  const w = word.w;
  if (mode === 'first')
    return locale === 'fr' ? [`Le mot ${w} !`, `Par quelle lettre commence ${w} ?`] : [`The word ${w}!`, `What letter does ${w} start with?`];
  if (mode === 'spell') return locale === 'fr' ? [`Épelle le mot ${w} avec Ziggy !`] : [`Spell the word ${w} with Ziggy!`];
  return locale === 'fr' ? [`Complète le mot ${w} !`, 'Trouve les sons qui manquent.'] : [`Finish the word ${w}!`, 'Find the missing sounds.'];
}

/** The three gates, read lane by lane (for children who can't read yet). */
export function optionLines(options: string[], locale: Locale): string[] {
  return options.map((o, i) => `${laneName(i, locale)} : ${o}.`).map((l) => (locale === 'fr' ? l : l.replace(' :', ':')));
}

const OOPS: Text[] = [
  { fr: 'Oups, une lettre farceuse !', en: 'Oops, a trickster letter!' },
  { fr: 'Tire-bouchon ! Cette lettre nous a fait une blague !', en: 'Corkscrew! That letter played a joke on us!' },
  { fr: 'Hihi, une lettre farceuse ! On la retrouve au prochain tour.', en: 'Hee hee, a trickster letter! The right one comes back next.' },
];
export const oopsLine = (n: number, locale: Locale) => OOPS[Math.abs(n) % OOPS.length][locale];

/** A gentle hint after a corkscrew: the right gate sparkles (1), then says its letter (2). */
export function hintLine(word: KartWord, step: Step, mode: Mode, hint: 1 | 2, locale: Locale): string {
  const w = word.w;
  const a = step.answer;
  if (hint === 1) {
    if (mode === 'first') return locale === 'fr' ? `Écoute bien : ${w}… La bonne porte brille !` : `Listen: ${w}… The right gate is sparkling!`;
    if (mode === 'spell') return locale === 'fr' ? `On écrit ${w}. La bonne porte brille !` : `We’re spelling ${w}. The right gate is sparkling!`;
    return locale === 'fr' ? `Écoute le son dans ${w}. La bonne porte brille !` : `Listen to the sound in ${w}. The right gate is sparkling!`;
  }
  if (mode === 'first') return locale === 'fr' ? `${w} commence par ${a}. Passe sous le ${a} !` : `${w} starts with ${a}. Drive under the ${a}!`;
  if (mode === 'spell') return locale === 'fr' ? `La lettre qui suit, c’est ${a} !` : `The next letter is ${a}!`;
  return locale === 'fr' ? `Ici, on écrit ${a} !` : `Here we write ${a}!`;
}

const CHEERS: Text[] = [
  { fr: 'Super !', en: 'Super!' },
  { fr: 'Bravo !', en: 'Well done!' },
  { fr: 'Génial !', en: 'Awesome!' },
  { fr: 'Wouhou !', en: 'Woo-hoo!' },
  { fr: 'Top !', en: 'Great!' },
];
export const cheerLine = (n: number, locale: Locale) => CHEERS[Math.abs(n) % CHEERS.length][locale];

/** The word is complete: rainbow turbo! */
export function wordDoneLine(word: KartWord, mode: Mode, locale: Locale): string {
  const w = word.w;
  if (mode === 'first') return locale === 'fr' ? `Bravo ! ${w} commence par ${word.units[0]} !` : `Yay! ${w} starts with ${word.units[0]}!`;
  if (mode === 'spell') return locale === 'fr' ? `Bravo ! Tu as écrit ${w} !` : `Yay! You spelled ${w}!`;
  return locale === 'fr' ? `Super ! Le mot ${w} est complet !` : `Super! The word ${w} is complete!`;
}

export function finishLine(count: number, mode: Mode, locale: Locale): string {
  if (mode === 'first')
    return locale === 'fr' ? `Ligne d’arrivée ! Tu as trouvé ${count} premières lettres avec Ziggy !` : `Finish line! You found ${count} first letters with Ziggy!`;
  return locale === 'fr' ? `Ligne d’arrivée ! Tu as écrit ${count} mots avec Ziggy !` : `Finish line! You wrote ${count} words with Ziggy!`;
}

/** Little speech bubbles in the scene (never read aloud). */
export const BUBBLES = {
  jump: { fr: 'Wiii !', en: 'Wheee!' },
  cow: { fr: 'Meuh ! Coucou !', en: 'Moo! Hello!' },
  bubbles: { fr: 'Hihi, des bulles !', en: 'Hee hee, bubbles!' },
  oops: { fr: 'Oups !', en: 'Oops!' },
  turbo: { fr: 'Turbo !', en: 'Turbo!' },
  yay: { fr: 'Youpi !', en: 'Yippee!' },
} satisfies Record<string, Text>;
