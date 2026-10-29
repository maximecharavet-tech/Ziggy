/**
 * Ziggy Paléontologue (Ziggy the Dino Digger) — pure logic: no three.js, no DOM.
 *
 * A game is 2 or 3 dinosaurs. For each one the child brushes the bones out
 * of the sand, rebuilds the skeleton on its stand, then the dinosaur wakes
 * up, does something funny with Ziggy, and Ziggy asks one little question.
 * Everything right or wrong is decided here; the 3D scene only animates.
 *
 * Child-safety rules enforced here: never a failure (a wrong bone wiggles
 * and goes back with a gentle hint, then the child simply tries again), no
 * timer, and every fact is true. Numbers are rounded on purpose ("about
 * 12 m"): lengths and ages are the usual textbook values.
 */
import { rng } from '../kit/rng';
import { tr, type L } from '@/lib/i18n-text';
import type { LearningSkill } from '@/lib/learning/skills';

export const GAME_ID = 'dino';

export type Band = 'little' | 'middle' | 'big';
export type DinoSkill = Extract<LearningSkill, 'animals' | 'shapes' | 'science' | 'counting'>;
export const DINO_SKILLS: readonly DinoSkill[] = ['animals', 'shapes', 'science', 'counting'];

/* ───────────────────────── Dinosaurs ───────────────────────── */

export const DINOS = ['trex', 'triceratops', 'diplodocus', 'stegosaurus'] as const;
export type DinoId = (typeof DINOS)[number];

/** The pieces of a skeleton, in the order they go on the stand (body first). */
export const PIECES = ['ribs', 'legs', 'frontLegs', 'arms', 'neck', 'head', 'plates', 'tail'] as const;
export type PieceId = (typeof PIECES)[number];

export type Diet = 'plants' | 'meat';
export type FunMoment = 'cookie' | 'sneeze' | 'hide' | 'music';

export interface DinoInfo {
  /** Without article; French names are lower-case nouns ("le tricératops"). */
  name: L;
  diet: Diet;
  /** Usual length of a grown-up, in metres (rounded). */
  lengthM: number;
  /** When it lived, in millions of years ago (rounded). */
  ageMy: number;
  era: 'jurassic' | 'cretaceous';
  pieces: readonly PieceId[];
  /** Size of each piece in the 3D model (its longest side, model units): for "biggest / smallest". */
  sizes: Partial<Record<PieceId, number>>;
  fun: FunMoment;
  /** A true little fact, said when the dinosaur wakes up. */
  fact: L;
}

export const DINO_INFO: Record<DinoId, DinoInfo> = {
  trex: {
    name: { fr: 'T-Rex', en: 'T-Rex' },
    diet: 'meat',
    lengthM: 12,
    ageMy: 68,
    era: 'cretaceous',
    pieces: ['ribs', 'legs', 'arms', 'neck', 'head', 'tail'],
    sizes: { tail: 3.5, ribs: 2.9, legs: 2.55, head: 2.15, neck: 1.6, arms: 0.75 },
    fun: 'cookie',
    fact: { fr: 'Le T-Rex avait de tout petits bras, avec seulement deux doigts à chaque main !', en: 'The T-Rex had tiny arms, with only two fingers on each hand!' },
  },
  triceratops: {
    name: { fr: 'tricératops', en: 'Triceratops' },
    diet: 'plants',
    lengthM: 9,
    ageMy: 68,
    era: 'cretaceous',
    pieces: ['ribs', 'legs', 'frontLegs', 'head', 'tail'],
    sizes: { ribs: 2.8, head: 2.55, tail: 2.3, legs: 1.75, frontLegs: 1.5 },
    fun: 'hide',
    fact: { fr: 'Tricératops veut dire « tête à trois cornes » : deux grandes au-dessus des yeux et une petite sur le nez.', en: 'Triceratops means “three-horned face”: two big horns above the eyes and a small one on the nose.' },
  },
  diplodocus: {
    name: { fr: 'diplodocus', en: 'Diplodocus' },
    diet: 'plants',
    lengthM: 25,
    ageMy: 152,
    era: 'jurassic',
    pieces: ['ribs', 'legs', 'frontLegs', 'neck', 'head', 'tail'],
    sizes: { tail: 6.6, neck: 3.9, ribs: 3.5, legs: 2.75, frontLegs: 2.5, head: 1.0 },
    fun: 'sneeze',
    fact: { fr: 'Le diplodocus était très long : environ 25 mètres, autant que deux bus !', en: 'The Diplodocus was very long: about 25 metres, as long as two buses!' },
  },
  stegosaurus: {
    name: { fr: 'stégosaure', en: 'Stegosaurus' },
    diet: 'plants',
    lengthM: 7,
    ageMy: 150,
    era: 'jurassic',
    pieces: ['ribs', 'legs', 'frontLegs', 'plates', 'head', 'tail'],
    sizes: { plates: 2.9, tail: 2.85, ribs: 2.85, legs: 1.85, head: 1.65, frontLegs: 1.45 },
    fun: 'music',
    fact: { fr: 'Le stégosaure avait de grandes plaques sur le dos et quatre piques au bout de la queue.', en: 'The Stegosaurus had big plates on its back and four spikes at the end of its tail.' },
  },
};

export interface PieceInfo {
  name: L;
  /** What the piece looks like (the hint after a wrong bone). */
  looks: L;
}

export const PIECE_INFO: Record<PieceId, PieceInfo> = {
  ribs: { name: { fr: 'les côtes', en: 'the ribs' }, looks: { fr: 'des os courbés, comme une cage', en: 'curved bones, like a cage' } },
  legs: { name: { fr: 'les pattes arrière', en: 'the back legs' }, looks: { fr: 'de grands os solides avec des orteils', en: 'big strong bones with toes' } },
  frontLegs: { name: { fr: 'les pattes avant', en: 'the front legs' }, looks: { fr: 'des os solides, plus petits que ceux de derrière', en: 'strong bones, smaller than the back ones' } },
  arms: { name: { fr: 'les petits bras', en: 'the tiny arms' }, looks: { fr: 'deux tout petits bras avec deux doigts', en: 'two tiny arms with two fingers' } },
  neck: { name: { fr: 'le cou', en: 'the neck' }, looks: { fr: 'une file d’os qui relie la tête au corps', en: 'a line of bones joining the head to the body' } },
  head: { name: { fr: 'la tête', en: 'the head' }, looks: { fr: 'le crâne, avec le trou de l’œil', en: 'the skull, with the eye hole' } },
  plates: { name: { fr: 'les plaques du dos', en: 'the back plates' }, looks: { fr: 'de grands os plats et pointus', en: 'big flat pointy bones' } },
  tail: { name: { fr: 'la queue', en: 'the tail' }, looks: { fr: 'des os qui deviennent de plus en plus petits', en: 'bones that get smaller and smaller' } },
};

export const DINO_NAME = (d: DinoId, locale: string) => tr(DINO_INFO[d].name, locale);
/** "le tricératops" / "the Triceratops". */
export const theDino = (d: DinoId, locale: string) => (locale === 'fr' ? `le ${DINO_INFO[d].name.fr}` : `the ${DINO_INFO[d].name.en}`);
/** Capitalised name for labels ("Tricératops"). */
export const dinoLabel = (d: DinoId, locale: string) => {
  const n = DINO_NAME(d, locale);
  return n.charAt(0).toUpperCase() + n.slice(1);
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ───────────────────────── Questions ───────────────────────── */

export type Choice =
  | { kind: 'number'; n: number }
  | { kind: 'dino'; dino: DinoId }
  | { kind: 'piece'; dino: DinoId; piece: PieceId; toScale: boolean }
  | { kind: 'emoji'; emoji: string; label: L }
  | { kind: 'text'; label: L };

export type QuestionKind = 'count' | 'preset' | 'size' | 'name' | 'diet' | 'feature' | 'time' | 'birds' | 'sameTime' | 'compare' | 'sum' | 'timegap';

export interface Question {
  kind: QuestionKind;
  skill: DinoSkill;
  text: L;
  choices: Choice[];
  /** Index of the right choice. */
  answer: number;
  /** Gentle help after a wrong answer (never gives the answer away). */
  hint: L;
  /** Said after the right answer: a true little fact. */
  explain: L;
}

export const choiceKey = (c: Choice): string =>
  c.kind === 'number' ? `n${c.n}` : c.kind === 'dino' ? `d-${c.dino}` : c.kind === 'piece' ? `p-${c.dino}-${c.piece}` : c.kind === 'emoji' ? `e-${c.emoji}` : `t-${c.label.en}`;

const NUM_WORDS: Record<'fr' | 'en', string[]> = {
  fr: ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'],
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
};
export const countWord = (n: number, locale: string) => NUM_WORDS[locale === 'fr' ? 'fr' : 'en'][n] ?? String(n);

/** The choice in words: read aloud to children who can't read yet, and the button's label. */
export function choiceLabel(c: Choice, locale: string): string {
  switch (c.kind) {
    case 'number':
      return String(c.n);
    case 'dino':
      return dinoLabel(c.dino, locale);
    case 'piece':
      return cap(tr(PIECE_INFO[c.piece].name, locale));
    case 'emoji':
    case 'text':
      return tr(c.label, locale);
  }
}

export const checkAnswer = (q: Question, index: number) => index === q.answer;

/* ───────────────────────── Plan of a game ───────────────────────── */

export interface Placement {
  piece: PieceId;
  /** Quarter turns the bone arrives with (0 = already the right way). */
  turns: 0 | 1 | 2 | 3;
}

export interface RoundPlan {
  dino: DinoId;
  /** The skill this round trains most (sent to the learning engine). */
  skill: DinoSkill;
  /** Bones hidden in the sand: the ones the child finds and places. */
  buried: PieceId[];
  /** Bones already on the stand (found by Ziggy yesterday). */
  preset: PieceId[];
  placements: Placement[];
  /** How many bones are offered at once when choosing. */
  options: number;
  /** After the dig (little and middle ones). */
  digQuestion: Question | null;
  /** After the dinosaur woke up. */
  quiz: Question;
  fun: FunMoment;
  /** Hide-and-seek: number of palm trees and the one it hides behind. */
  hide: { palms: number; spot: number } | null;
}

export interface GamePlan {
  band: Band;
  level: number;
  rounds: RoundPlan[];
}

export const roundsFor = (band: Band) => (band === 'little' ? 2 : 3);

function shuffle<T>(arr: readonly T[], r: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const pick = <T>(arr: readonly T[], r: () => number): T => arr[Math.floor(r() * arr.length)];
const clampLevel = (level: number) => Math.max(1, Math.min(5, Math.floor(level) || 1));

/** How many bones are buried for this age and level. */
export function bonesFor(band: Band, level: number): number {
  const lv = clampLevel(level);
  if (band === 'little') return lv >= 2 ? 4 : 3;
  if (band === 'middle') return lv >= 3 ? 5 : 4;
  return lv >= 3 ? 6 : 5;
}

/** Each round trains one skill; the round's questions are chosen to match it. */
const ROUND_SKILLS: Record<Band, DinoSkill[]> = {
  little: ['counting', 'shapes'],
  middle: ['animals', 'shapes', 'counting'],
  big: ['science', 'shapes', 'science'],
};

/** The most recognisable bones are always buried; the others may wait on the stand. */
const ALWAYS: PieceId[] = ['head', 'tail', 'legs'];

function chooseBuried(dino: DinoId, n: number, r: () => number): PieceId[] {
  const all = DINO_INFO[dino].pieces;
  const first = ALWAYS.filter((p) => all.includes(p));
  const rest = shuffle(
    all.filter((p) => !first.includes(p)),
    r
  );
  const chosen = [...first, ...rest].slice(0, Math.min(n, all.length));
  return PIECES.filter((p) => chosen.includes(p));
}

function numberChoices(answer: number, r: () => number, spread: number, min = 1, count = 3): { choices: Choice[]; answer: number } {
  const set = new Set([answer]);
  let guard = 0;
  while (set.size < count && guard++ < 200) {
    const d = 1 + Math.floor(r() * spread);
    const v = r() < 0.5 ? answer - d : answer + d;
    if (v >= min) set.add(v);
  }
  const nums = [...set].sort((a, b) => a - b);
  return { choices: nums.map((n) => ({ kind: 'number', n })), answer: nums.indexOf(answer) };
}

function withChoices(base: Omit<Question, 'choices' | 'answer'>, right: Choice, wrong: Choice[], r: () => number): Question {
  const all = shuffle([right, ...wrong], r);
  return { ...base, choices: all, answer: all.findIndex((c) => choiceKey(c) === choiceKey(right)) };
}

function otherDinos(d: DinoId, n: number, r: () => number): DinoId[] {
  return shuffle(
    DINOS.filter((x) => x !== d),
    r
  ).slice(0, n);
}

/* ── Question builders (one per kind) ── */

export function countQuestion(n: number, band: Band, r: () => number): Question {
  const { choices, answer } = numberChoices(n, r, band === 'little' ? 1 : 2, 1, 3);
  return {
    kind: 'count',
    skill: 'counting',
    text: { fr: 'Combien d’os as-tu trouvés ?', en: 'How many bones did you find?' },
    choices,
    answer,
    hint: { fr: 'Compte les os un par un avec ton doigt : un, deux, trois…', en: 'Count the bones one by one with your finger: one, two, three…' },
    explain: { fr: `Oui ! ${cap(countWord(n, 'fr'))} os !`, en: `Yes! ${cap(countWord(n, 'en'))} bones!` },
  };
}

/** Middle ones, higher levels: the bones already on the stand (a little subtraction). */
export function presetQuestion(total: number, found: number, r: () => number): Question {
  const n = total - found;
  const { choices, answer } = numberChoices(n, r, 2, 1, 3);
  return {
    kind: 'preset',
    skill: 'counting',
    text: {
      fr: `Ce squelette a ${total} os en tout. Tu en as trouvé ${found}. Combien étaient déjà sur le support ?`,
      en: `This skeleton has ${total} bones in all. You found ${found}. How many were already on the stand?`,
    },
    choices,
    answer,
    hint: { fr: `Pars de ${found} et compte jusqu’à ${total}.`, en: `Start at ${found} and count up to ${total}.` },
    explain: { fr: `Oui ! ${total} − ${found} = ${n}.`, en: `Yes! ${total} − ${found} = ${n}.` },
  };
}

/** Biggest or smallest bone, among 3 clearly different ones (pictures drawn to scale). */
export function sizeQuestion(dino: DinoId, pool: readonly PieceId[], r: () => number, mode?: 'biggest' | 'smallest'): Question | null {
  const sizes = DINO_INFO[dino].sizes;
  const sorted = [...pool].filter((p) => sizes[p] !== undefined).sort((a, b) => sizes[b]! - sizes[a]!);
  // Keep pieces that differ clearly (25 % or more) from the previous one kept.
  const distinct: PieceId[] = [];
  for (const p of sorted) if (!distinct.length || sizes[distinct[distinct.length - 1]]! >= sizes[p]! * 1.25) distinct.push(p);
  if (distinct.length < 2) return null;
  const want = mode ?? (r() < 0.5 ? 'biggest' : 'smallest');
  const three = distinct.length > 3 ? shuffle(distinct, r).slice(0, 3) : distinct;
  three.sort((a, b) => sizes[b]! - sizes[a]!);
  const right = want === 'biggest' ? three[0] : three[three.length - 1];
  const wrong = three.filter((p) => p !== right);
  const name = (l: string) => tr(PIECE_INFO[right].name, l);
  return withChoices(
    {
      kind: 'size',
      skill: 'shapes',
      text: want === 'biggest' ? { fr: 'Quel est le plus grand os ?', en: 'Which bone is the biggest?' } : { fr: 'Quel est le plus petit os ?', en: 'Which bone is the smallest?' },
      hint:
        want === 'biggest'
          ? { fr: 'Compare-les bien : lequel prend le plus de place ?', en: 'Compare them: which one takes up the most room?' }
          : { fr: 'Compare-les bien : lequel prend le moins de place ?', en: 'Compare them: which one takes up the least room?' },
      explain:
        want === 'biggest'
          ? { fr: `Oui ! ${cap(name('fr'))} : c’est le plus grand !`, en: `Yes! ${cap(name('en'))}: the biggest one!` }
          : { fr: `Oui ! ${cap(name('fr'))} : c’est le plus petit !`, en: `Yes! ${cap(name('en'))}: the smallest one!` },
    },
    { kind: 'piece', dino, piece: right, toScale: true },
    wrong.map((p) => ({ kind: 'piece', dino, piece: p, toScale: true })),
    r
  );
}

export function nameQuestion(dino: DinoId, r: () => number): Question {
  return withChoices(
    {
      kind: 'name',
      skill: 'animals',
      text: { fr: `Où est ${theDino(dino, 'fr')} ?`, en: `Where is ${theDino(dino, 'en')}?` },
      hint: { fr: 'C’est celui que tu viens de reconstruire, qui danse avec Ziggy !', en: 'It’s the one you just rebuilt, dancing with Ziggy!' },
      explain: DINO_INFO[dino].fact,
    },
    { kind: 'dino', dino },
    otherDinos(dino, 2, r).map((d) => ({ kind: 'dino', dino: d })),
    r
  );
}

const PLANTS: Choice = { kind: 'emoji', emoji: '🌿', label: { fr: 'Des plantes', en: 'Plants' } };
const MEAT: Choice = { kind: 'emoji', emoji: '🍖', label: { fr: 'De la viande', en: 'Meat' } };
const PLANTS_WORD: Choice = { kind: 'emoji', emoji: '🌿', label: { fr: 'Herbivore (des plantes)', en: 'Herbivore (plants)' } };
const MEAT_WORD: Choice = { kind: 'emoji', emoji: '🍖', label: { fr: 'Carnivore (de la viande)', en: 'Carnivore (meat)' } };

export function dietQuestion(dino: DinoId, band: Band, r: () => number): Question {
  const meat = DINO_INFO[dino].diet === 'meat';
  const words = band !== 'little';
  const [p, m] = words ? [PLANTS_WORD, MEAT_WORD] : [PLANTS, MEAT];
  const the = (l: string) => theDino(dino, l);
  return withChoices(
    {
      kind: 'diet',
      skill: 'animals',
      text: words ? { fr: `${cap(the('fr'))} était-il herbivore ou carnivore ?`, en: `Was ${the('en')} a herbivore or a carnivore?` } : { fr: `Que mangeait ${the('fr')} ?`, en: `What did ${the('en')} eat?` },
      hint: meat
        ? { fr: 'Regarde ses grandes dents pointues : elles coupaient la viande.', en: 'Look at its big pointy teeth: they were made for cutting meat.' }
        : { fr: 'Regarde sa bouche : elle était faite pour arracher les feuilles.', en: 'Look at its mouth: it was made for pulling off leaves.' },
      explain: meat
        ? { fr: `${cap(the('fr'))} était carnivore : il mangeait de la viande.`, en: `${cap(the('en'))} was a carnivore: it ate meat.` }
        : { fr: `${cap(the('fr'))} était herbivore : il mangeait des plantes, comme des fougères.`, en: `${cap(the('en'))} was a herbivore: it ate plants, like ferns.` },
    },
    meat ? m : p,
    [meat ? p : m],
    r
  );
}

/** A feature to look at (and count) on the dinosaur that just woke up. All true. */
export function featureQuestion(dino: DinoId, r: () => number): Question {
  if (dino === 'diplodocus')
    return withChoices(
      {
        kind: 'feature',
        skill: 'animals',
        text: { fr: 'Quel dinosaure a un très, très long cou ?', en: 'Which dinosaur has a very, very long neck?' },
        hint: { fr: 'Cherche le cou le plus long, qui monte haut vers les arbres.', en: 'Look for the longest neck, reaching up high to the trees.' },
        explain: { fr: 'Le diplodocus ! Son cou et sa queue étaient très longs.', en: 'The Diplodocus! Its neck and its tail were very long.' },
      },
      { kind: 'dino', dino },
      otherDinos(dino, 2, r).map((d) => ({ kind: 'dino', dino: d })),
      r
    );
  const spec = {
    trex: {
      n: 2,
      nums: [1, 2, 3],
      text: { fr: 'Combien de doigts le T-Rex avait-il à chaque main ?', en: 'How many fingers did the T-Rex have on each hand?' },
      hint: { fr: 'Regarde ses tout petits bras, et compte les doigts.', en: 'Look at its tiny arms and count the fingers.' },
      explain: { fr: 'Deux doigts seulement, au bout de tout petits bras !', en: 'Only two fingers, at the end of tiny arms!' },
    },
    triceratops: {
      n: 3,
      nums: [1, 2, 3],
      text: { fr: 'Combien de cornes a le tricératops ?', en: 'How many horns does the Triceratops have?' },
      hint: { fr: 'Compte les cornes au-dessus des yeux, puis sur le nez.', en: 'Count the horns above the eyes, then on the nose.' },
      explain: { fr: 'Trois cornes ! Tricératops veut dire « tête à trois cornes ».', en: 'Three horns! Triceratops means “three-horned face”.' },
    },
    stegosaurus: {
      n: 4,
      nums: [2, 4, 6],
      text: { fr: 'Combien de piques le stégosaure a-t-il au bout de la queue ?', en: 'How many spikes does the Stegosaurus have at the end of its tail?' },
      hint: { fr: 'Regarde le bout de sa queue et compte les piques.', en: 'Look at the end of its tail and count the spikes.' },
      explain: { fr: 'Quatre piques ! Et de grandes plaques sur le dos.', en: 'Four spikes! And big plates on its back.' },
    },
  }[dino];
  return sortNumbers(
    withChoices(
      { kind: 'feature', skill: 'animals', text: spec.text, hint: spec.hint, explain: spec.explain },
      { kind: 'number', n: spec.n },
      spec.nums.filter((x) => x !== spec.n).map((n) => ({ kind: 'number', n })),
      r
    )
  );
}

/** Number choices read best from small to big. */
function sortNumbers(q: Question): Question {
  if (!q.choices.every((c) => c.kind === 'number')) return q;
  const right = q.choices[q.answer];
  const choices = [...q.choices].sort((a, b) => (a as { n: number }).n - (b as { n: number }).n);
  return { ...q, choices, answer: choices.indexOf(right) };
}

export function timeQuestion(r: () => number): Question {
  return withChoices(
    {
      kind: 'time',
      skill: 'science',
      text: { fr: 'Les grands dinosaures, comme le T-Rex, ont disparu il y a environ…', en: 'Big dinosaurs like the T-Rex died out about…' },
      hint: { fr: 'C’était il y a très, très, très longtemps : bien avant les premiers humains !', en: 'It was a very, very, very long time ago: long before the first humans!' },
      explain: { fr: 'Il y a environ 66 millions d’années ! Les humains sont arrivés bien plus tard.', en: 'About 66 million years ago! Humans came much, much later.' },
    },
    { kind: 'text', label: { fr: '66 millions d’années', en: '66 million years ago' } },
    [
      { kind: 'text', label: { fr: '6 000 ans', en: '6,000 years ago' } },
      { kind: 'text', label: { fr: '600 ans', en: '600 years ago' } },
    ],
    r
  );
}

export function birdsQuestion(r: () => number): Question {
  return withChoices(
    {
      kind: 'birds',
      skill: 'science',
      text: { fr: 'Quels animaux d’aujourd’hui descendent des dinosaures ?', en: 'Which animals of today come from dinosaurs?' },
      hint: { fr: 'Ils ont des plumes, des pattes avec des griffes… et ils pondent des œufs !', en: 'They have feathers and clawed feet… and they lay eggs!' },
      explain: { fr: 'Les oiseaux ! Le moineau et la poule sont de lointains cousins du T-Rex.', en: 'Birds! Sparrows and chickens are distant cousins of the T-Rex.' },
    },
    { kind: 'emoji', emoji: '🐦', label: { fr: 'Les oiseaux', en: 'Birds' } },
    [
      { kind: 'emoji', emoji: '🐟', label: { fr: 'Les poissons', en: 'Fish' } },
      { kind: 'emoji', emoji: '🐰', label: { fr: 'Les lapins', en: 'Rabbits' } },
    ],
    r
  );
}

/** Who lived at the same time: Jurassic (Diplodocus, Stegosaurus) or Cretaceous (T-Rex, Triceratops). */
export function sameTimeQuestion(dino: DinoId, r: () => number): Question {
  const info = DINO_INFO[dino];
  const mate = DINOS.find((d) => d !== dino && DINO_INFO[d].era === info.era)!;
  const others = DINOS.filter((d) => DINO_INFO[d].era !== info.era);
  const the = (l: string) => theDino(dino, l);
  return withChoices(
    {
      kind: 'sameTime',
      skill: 'science',
      text: { fr: `Quel dinosaure vivait à la même époque que ${the('fr')} ?`, en: `Which dinosaur lived at the same time as ${the('en')}?` },
      hint: {
        fr: `${cap(the('fr'))} vivait il y a environ ${info.ageMy} millions d’années. Qui vivait aussi à ce moment-là ?`,
        en: `${cap(the('en'))} lived about ${info.ageMy} million years ago. Who else lived then?`,
      },
      explain: {
        fr: `${cap(theDino(mate, 'fr'))} ! Ils vivaient tous les deux il y a environ ${info.era === 'jurassic' ? 150 : 68} millions d’années.`,
        en: `${cap(theDino(mate, 'en'))}! They both lived about ${info.era === 'jurassic' ? 150 : 68} million years ago.`,
      },
    },
    { kind: 'dino', dino: mate },
    others.map((d) => ({ kind: 'dino', dino: d })),
    r
  );
}

/** How many metres longer: a subtraction with true lengths. */
export function compareQuestion(dino: DinoId, r: () => number): Question {
  const other = pick(
    DINOS.filter((d) => d !== dino && DINO_INFO[d].lengthM !== DINO_INFO[dino].lengthM),
    r
  );
  const [long, short] = DINO_INFO[dino].lengthM > DINO_INFO[other].lengthM ? [dino, other] : [other, dino];
  const a = DINO_INFO[long].lengthM;
  const b = DINO_INFO[short].lengthM;
  const n = a - b;
  const wrong = new Set<number>();
  for (const w of [a + b, n + 1, n - 1, n + 2]) if (w !== n && w > 0 && wrong.size < 2) wrong.add(w);
  const L = (l: string) => theDino(long, l);
  const S = (l: string) => theDino(short, l);
  return sortNumbers(
    withChoices(
      {
        kind: 'compare',
        skill: 'science',
        text: {
          fr: `${cap(L('fr'))} mesurait environ ${a} m et ${S('fr')} environ ${b} m. Combien de mètres de plus pour ${L('fr')} ?`,
          en: `${cap(L('en'))} was about ${a} m long and ${S('en')} about ${b} m. How many metres longer was ${L('en')}?`,
        },
        hint: { fr: `C’est une soustraction : ${a} − ${b}.`, en: `It’s a subtraction: ${a} − ${b}.` },
        explain: { fr: `Oui ! ${a} − ${b} = ${n} mètres de plus.`, en: `Yes! ${a} − ${b} = ${n} metres longer.` },
      },
      { kind: 'number', n },
      [...wrong].map((w) => ({ kind: 'number', n: w })),
      r
    )
  );
}

/** Nose to tail, one after the other: an addition with true lengths. */
export function sumQuestion(dino: DinoId, r: () => number): Question {
  const other = pick(
    DINOS.filter((d) => d !== dino),
    r
  );
  const a = DINO_INFO[dino].lengthM;
  const b = DINO_INFO[other].lengthM;
  const n = a + b;
  const wrong = new Set<number>();
  for (const w of [Math.abs(a - b), n + 1, n - 1, n + 10]) if (w !== n && w > 0 && wrong.size < 2) wrong.add(w);
  return sortNumbers(
    withChoices(
      {
        kind: 'sum',
        skill: 'science',
        text: {
          fr: `${cap(theDino(dino, 'fr'))} (environ ${a} m) et ${theDino(other, 'fr')} (environ ${b} m) se mettent à la queue leu leu. Combien de mètres en tout ?`,
          en: `${cap(theDino(dino, 'en'))} (about ${a} m) and ${theDino(other, 'en')} (about ${b} m) line up nose to tail. How many metres in all?`,
        },
        hint: { fr: `C’est une addition : ${a} + ${b}.`, en: `It’s an addition: ${a} + ${b}.` },
        explain: { fr: `Oui ! ${a} + ${b} = ${n} mètres.`, en: `Yes! ${a} + ${b} = ${n} metres.` },
      },
      { kind: 'number', n },
      [...wrong].map((w) => ({ kind: 'number', n: w })),
      r
    )
  );
}

/** Millions of years between a Jurassic and a Cretaceous dinosaur (true rounded ages). */
export function timegapQuestion(dino: DinoId, r: () => number): Question {
  const info = DINO_INFO[dino];
  const other = pick(
    DINOS.filter((d) => DINO_INFO[d].era !== info.era),
    r
  );
  const [early, late] = info.era === 'jurassic' ? [dino, other] : [other, dino];
  const a = DINO_INFO[early].ageMy;
  const b = DINO_INFO[late].ageMy;
  const n = a - b;
  const wrong = new Set<number>();
  for (const w of [a + b, n + 10, n - 10]) if (w !== n && w > 0 && wrong.size < 2) wrong.add(w);
  return sortNumbers(
    withChoices(
      {
        kind: 'timegap',
        skill: 'science',
        text: {
          fr: `${cap(theDino(early, 'fr'))} vivait il y a environ ${a} millions d’années, ${theDino(late, 'fr')} il y a environ ${b} millions d’années. Combien de millions d’années les séparent ?`,
          en: `${cap(theDino(early, 'en'))} lived about ${a} million years ago, ${theDino(late, 'en')} about ${b} million years ago. How many million years apart are they?`,
        },
        hint: { fr: `C’est une soustraction : ${a} − ${b}.`, en: `It’s a subtraction: ${a} − ${b}.` },
        explain: {
          fr: `${n} millions d’années ! ${cap(theDino(late, 'fr'))} a vécu plus près de nous que ${early === 'stegosaurus' ? 'du stégosaure' : 'du diplodocus'}.`,
          en: `${n} million years! ${cap(theDino(late, 'en'))} lived closer to our time than to ${theDino(early, 'en')}.`,
        },
      },
      { kind: 'number', n },
      [...wrong].map((w) => ({ kind: 'number', n: w })),
      r
    )
  );
}

/* ── The quiz after the dinosaur wakes up ── */

function quizFor(band: Band, level: number, dino: DinoId, roundIndex: number, used: Set<QuestionKind>, r: () => number): Question {
  const lv = clampLevel(level);
  let pool: QuestionKind[];
  if (band === 'little') pool = ['name', 'diet'];
  else if (band === 'middle') pool = lv >= 3 ? ['feature', 'diet', 'birds'] : ['feature', 'diet', 'name'];
  else pool = roundIndex === 1 ? (lv >= 3 ? ['sum', 'compare'] : ['compare', 'sum']) : lv >= 3 ? ['timegap', 'sameTime', 'birds', 'time'] : ['time', 'birds', 'sameTime', 'diet'];
  const fresh = pool.filter((k) => !used.has(k));
  const kind = fresh.length ? (roundIndex === 0 || band === 'big' ? fresh[0] : pick(fresh, r)) : pick(pool, r);
  used.add(kind);
  switch (kind) {
    case 'name':
      return nameQuestion(dino, r);
    case 'diet':
      return dietQuestion(dino, band, r);
    case 'feature':
      return featureQuestion(dino, r);
    case 'birds':
      return birdsQuestion(r);
    case 'time':
      return timeQuestion(r);
    case 'sameTime':
      return sameTimeQuestion(dino, r);
    case 'compare':
      return compareQuestion(dino, r);
    case 'sum':
      return sumQuestion(dino, r);
    default:
      return timegapQuestion(dino, r);
  }
}

function turnsFor(band: Band, level: number, skill: DinoSkill, placements: PieceId[], r: () => number): Placement[] {
  const lv = clampLevel(level);
  let n = 0;
  let quarter = false;
  if (band === 'big') {
    n = (lv >= 3 ? 3 : 2) + (skill === 'shapes' ? 1 : 0);
    quarter = lv >= 3 || skill === 'shapes';
  } else if (band === 'middle' && lv >= 3 && skill === 'shapes') n = 1;
  const which = new Set(shuffle(placements, r).slice(0, Math.min(n, placements.length)));
  return placements.map((piece) => {
    if (!which.has(piece)) return { piece, turns: 0 };
    const turns = (quarter ? pick([1, 2, 3] as const, r) : 2) as Placement['turns'];
    return { piece, turns };
  });
}

/**
 * The whole game, decided locally and deterministically (same seed → same
 * game), for an age band and a level (1–5, from the learning engine).
 */
export function planGame(seed: number, band: Band, level = 1): GamePlan {
  const r = rng((seed * 2654435761) >>> 0);
  const lv = clampLevel(level);
  const n = roundsFor(band);
  const dinos = shuffle(DINOS, r).slice(0, n);
  const used = new Set<QuestionKind>();
  const rounds = dinos.map((dino, i): RoundPlan => {
    const skill = ROUND_SKILLS[band][i % ROUND_SKILLS[band].length];
    const buried = chooseBuried(dino, bonesFor(band, lv), r);
    const preset = DINO_INFO[dino].pieces.filter((p) => !buried.includes(p));
    const placements = turnsFor(band, lv, skill, buried, r);
    let digQuestion: Question | null = null;
    if (band !== 'big') {
      if (skill === 'counting') digQuestion = band === 'middle' && lv >= 3 ? presetQuestion(DINO_INFO[dino].pieces.length, buried.length, r) : countQuestion(buried.length, band, r);
      else if (skill === 'shapes') digQuestion = sizeQuestion(dino, buried, r) ?? countQuestion(buried.length, band, r);
    }
    const quiz = quizFor(band, lv, dino, i, used, r);
    const fun = DINO_INFO[dino].fun;
    const palms = band === 'little' ? 2 : 3;
    return {
      dino,
      skill,
      buried,
      preset,
      placements,
      options: band === 'little' ? 3 : band === 'middle' ? (lv >= 3 ? 4 : 3) : 4,
      digQuestion,
      quiz,
      fun,
      hide: fun === 'hide' ? { palms, spot: Math.floor(r() * palms) } : null,
    };
  });
  return { band, level: lv, rounds };
}

/* ───────────────────────── Rebuilding ───────────────────────── */

/**
 * The bones offered for placement `step`: the right one plus others still on
 * the tarp, at most `round.options`. Stable for the same step (the buttons
 * don't jump around after a wrong try).
 */
export function boneChoices(round: RoundPlan, step: number, seed = 0): PieceId[] {
  const right = round.placements[step]?.piece;
  if (!right) return [];
  const left = round.placements.slice(step + 1).map((p) => p.piece);
  const r = rng((seed * 31 + step * 7919 + DINOS.indexOf(round.dino) * 104729) >>> 0);
  const others = shuffle(left, r).slice(0, Math.max(0, round.options - 1));
  return shuffle([right, ...others], r);
}

export const checkPiece = (round: RoundPlan, step: number, piece: PieceId) => round.placements[step]?.piece === piece;

/** Quarter turns still needed (0 = the right way round). */
export const turnsLeft = (turns: number) => (((4 - (turns % 4)) % 4) + 4) % 4;
export const checkTurns = (turns: number) => turnsLeft(turns) === 0;

/** Gentle help after a wrong bone: what the right one looks like (+ its size for little ones). */
export function pieceHint(round: RoundPlan, step: number, band: Band, locale: string): string {
  const right = round.placements[step]?.piece;
  if (!right) return '';
  const info = PIECE_INFO[right];
  const fr = locale === 'fr';
  let text = fr ? `Il faut ${info.name.fr} : ${info.looks.fr}.` : `This spot needs ${info.name.en}: ${info.looks.en}.`;
  if (band === 'little') {
    const sizes = DINO_INFO[round.dino].sizes;
    const left = round.placements.slice(step).map((p) => p.piece);
    if (left.length >= 2) {
      const s = sizes[right] ?? 0;
      // Only when it is clearly the biggest (or smallest) one: a near tie would confuse.
      const others = left.filter((p) => p !== right).map((p) => sizes[p] ?? 0);
      if (others.every((o) => o * 1.15 <= s)) text += fr ? ' C’est le plus grand os qui reste !' : ' It’s the biggest bone left!';
      else if (others.every((o) => o >= s * 1.15)) text += fr ? ' C’est le plus petit os qui reste !' : ' It’s the smallest bone left!';
    }
  }
  return text;
}

/** After "put it down" the wrong way round. The 2nd time, say how many quarter turns. */
export function turnHint(turns: number, tries: number, locale: string): string {
  const n = turnsLeft(turns);
  const fr = locale === 'fr';
  if (tries < 2) return fr ? 'Pas encore dans le bon sens ! Compare avec l’ombre bleue et tourne-le encore.' : 'Not the right way yet! Compare with the blue shadow and turn it again.';
  return fr ? `Encore ${n} quart${n > 1 ? 's' : ''} de tour avec ↻ !` : `${n} more quarter turn${n > 1 ? 's' : ''} with ↻!`;
}

/* ───────────────────────── Words ───────────────────────── */

export function digText(band: Band, locale: string): string {
  const fr = locale === 'fr';
  if (band === 'big') return fr ? 'Des os sont cachés dans le sable ! Frotte le sable (ou appuie sur « Gratter ») pour les dégager.' : 'Bones are hidden in the sand! Rub the sand (or press “Brush”) to uncover them.';
  return fr ? 'Des os sont cachés dans le sable ! Frotte le sable avec ton doigt, ou appuie sur « Gratter ».' : 'Bones are hidden in the sand! Rub the sand with your finger, or press “Brush”.';
}

export const digDoneText = (locale: string) => (locale === 'fr' ? 'Tous les os sont sortis du sable !' : 'All the bones are out of the sand!');

export function buildText(locale: string): string {
  return locale === 'fr' ? 'Quel os va à l’endroit qui brille ?' : 'Which bone goes in the shining spot?';
}

export function turnText(locale: string): string {
  return locale === 'fr' ? 'Bon os ! Tourne-le dans le même sens que l’ombre, puis pose-le.' : 'Right bone! Turn it to match the shadow, then put it in place.';
}

export const skeletonDoneText = (locale: string) => (locale === 'fr' ? 'Le squelette est complet ! Regarde bien…' : 'The skeleton is complete! Watch closely…');

export function awakeText(dino: DinoId, locale: string): string {
  return locale === 'fr' ? `${cap(theDino(dino, 'fr'))} se réveille ! Il cligne des yeux… et fait un tout petit rugissement.` : `${cap(theDino(dino, 'en'))} wakes up! It blinks… and gives a tiny little roar.`;
}

export function funText(fun: FunMoment, locale: string): string {
  const fr = locale === 'fr';
  switch (fun) {
    case 'cookie':
      return fr ? 'Le T-Rex veut le cookie… mais ses bras sont trop petits ! Ziggy va l’aider.' : 'The T-Rex wants the cookie… but its arms are too short! Ziggy helps out.';
    case 'sneeze':
      return fr ? 'Un papillon chatouille le nez du diplodocus… A… a… atchoum ! Ziggy s’envole !' : 'A butterfly tickles the Diplodocus’s nose… Ah… ah… achoo! Ziggy flies away!';
    case 'hide':
      return fr ? 'Le tricératops joue à cache-cache ! Derrière quel palmier se cache-t-il ?' : 'The Triceratops is playing hide-and-seek! Which palm tree is it hiding behind?';
    case 'music':
      return fr ? 'Ziggy joue de la musique sur les plaques du stégosaure !' : 'Ziggy plays music on the Stegosaurus’s plates!';
  }
}

export const hideWrongText = (locale: string) => (locale === 'fr' ? 'Pas ici ! Regarde bien : quelque chose dépasse d’un palmier…' : 'Not here! Look closely: something is sticking out from a palm tree…');
export const hideFoundText = (locale: string) => (locale === 'fr' ? 'Coucou ! Tu l’as trouvé !' : 'Peekaboo! You found it!');

export function roundDoneText(dino: DinoId, last: boolean, locale: string): string {
  const fr = locale === 'fr';
  if (last) return fr ? `Bravo ! ${cap(theDino(dino, 'fr'))} rejoint ton musée. Allons voir !` : `Well done! ${cap(theDino(dino, 'en'))} joins your museum. Let’s go and see!`;
  return fr ? `Bravo ! ${cap(theDino(dino, 'fr'))} part au musée. Au suivant !` : `Well done! ${cap(theDino(dino, 'en'))} is off to the museum. Next one!`;
}

export const museumText = (locale: string) =>
  locale === 'fr' ? 'Voici ton musée des dinosaures ! Tout le monde sourit… clic, la photo !' : 'Here is your dinosaur museum! Everybody smile… click, photo time!';

export const PRAISE: L[] = [
  { fr: 'Clac ! Parfait !', en: 'Click! Perfect!' },
  { fr: 'Bravo, bien vu !', en: 'Well spotted!' },
  { fr: 'Super, il est à sa place !', en: 'Great, it fits!' },
  { fr: 'Génial, quelle paléontologue !', en: 'Brilliant, what a palaeontologist!' },
];
export const praiseFor = (n: number, locale: string) => tr(PRAISE[Math.abs(Math.floor(n)) % PRAISE.length], locale);

/** Stats of a round for the learning engine: every graded step (bones, turns, questions). */
export interface RoundStats {
  correct: number;
  mistakes: number;
  total: number;
}

export function roundTotal(round: RoundPlan): number {
  return round.placements.length + round.placements.filter((p) => p.turns).length + (round.digQuestion ? 1 : 0) + 1;
}
