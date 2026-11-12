/**
 * L’Usine à Créatures de Ziggy — the pure logic (no three.js, no DOM).
 *
 * A creature is a plain recipe of parts (body, head, legs, eyes…). This file
 * knows every part and its words in French and English, mixes surprise
 * creatures, invents silly names, decides how a creature moves and sounds,
 * holds the optional fun challenges (count legs, name wings and fins) and
 * keeps the album (« La Parade ») safe to read back from storage.
 *
 * Nothing here is ever a failure: a challenge not met yet only gives a kind
 * hint, there is no timer, no streak, nothing to unlock.
 */
import type { L } from '@/lib/i18n-text';
import { rng } from '../kit/rng';

export type Band = 'little' | 'middle' | 'big';

/* ───────────────────────── Parts ───────────────────────── */

export const BODIES = ['blob', 'egg', 'bean', 'box', 'drop', 'pear', 'cloud', 'tall', 'barrel', 'bell', 'pillow'] as const;
export const HEADS = ['none', 'ball', 'box', 'bean', 'wide', 'tall', 'drop', 'cone'] as const;
export const LEG_STYLES = ['stubby', 'long', 'tentacle', 'spring', 'wheel', 'paddle'] as const;
export const ARM_STYLES = ['noodle', 'pincer', 'mitten', 'glove', 'fin', 'feather'] as const;
export const WINGS = ['none', 'bird', 'bat', 'butterfly', 'tiny', 'angel', 'fairy', 'leaf', 'rainbow'] as const;
export const TAILS = ['none', 'fish', 'curly', 'pompom', 'dragon', 'lightning', 'plume', 'balloon', 'ribbon'] as const;
export const MOUTHS = ['smile', 'fangs', 'beak', 'tongue', 'oh', 'teeth', 'cat', 'grin', 'moustache', 'gap'] as const;
export const TOPS = ['none', 'horns', 'antennae', 'bunny', 'cat', 'crest', 'eyestalks', 'elf', 'floppy', 'bear', 'unicorn', 'flower'] as const;
export const HATS = ['none', 'top', 'party', 'crown', 'propeller', 'bow', 'wizard', 'chef', 'cap', 'beanie', 'halo', 'captain'] as const;
export const PATTERNS = ['plain', 'dots', 'stripes', 'stars', 'zigzag', 'hearts', 'checks', 'waves'] as const;
export const EYE_SIZES = ['small', 'big'] as const;
export const LEG_COUNTS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;
export const ARM_COUNTS = [0, 2, 4] as const;
export const EYE_COUNTS = [1, 2, 3, 4, 5] as const;
export const SIZES = [1, 2, 3] as const;
export const NOSES = ['none', 'button', 'clown', 'snout', 'carrot', 'heart'] as const;
export const AURAS = ['none', 'sparkles', 'hearts', 'bubbles', 'stars', 'notes'] as const;
export const PETS = ['none', 'ladybug', 'chick', 'cloud', 'snail', 'balloon'] as const;

export type BodyShape = (typeof BODIES)[number];
export type HeadShape = (typeof HEADS)[number];
export type LegStyle = (typeof LEG_STYLES)[number];
export type ArmStyle = (typeof ARM_STYLES)[number];
export type WingKind = (typeof WINGS)[number];
export type TailKind = (typeof TAILS)[number];
export type MouthKind = (typeof MOUTHS)[number];
export type TopKind = (typeof TOPS)[number];
export type HatKind = (typeof HATS)[number];
export type PatternKind = (typeof PATTERNS)[number];
export type EyeSize = (typeof EYE_SIZES)[number];
export type SizeKind = (typeof SIZES)[number];
export type NoseKind = (typeof NOSES)[number];
export type AuraKind = (typeof AURAS)[number];
export type PetKind = (typeof PETS)[number];

export const COLORS = {
  red: { hex: '#ff4d5e', label: { fr: 'rouge', en: 'red' } },
  orange: { hex: '#ff9a2e', label: { fr: 'orange', en: 'orange' } },
  yellow: { hex: '#ffd23f', label: { fr: 'jaune', en: 'yellow' } },
  green: { hex: '#62d34a', label: { fr: 'vert', en: 'green' } },
  teal: { hex: '#1fc8b8', label: { fr: 'turquoise', en: 'turquoise' } },
  blue: { hex: '#3f7bff', label: { fr: 'bleu', en: 'blue' } },
  purple: { hex: '#9b5cf6', label: { fr: 'violet', en: 'purple' } },
  pink: { hex: '#ff6fb5', label: { fr: 'rose', en: 'pink' } },
  brown: { hex: '#b07a4f', label: { fr: 'marron', en: 'brown' } },
  white: { hex: '#f6f2ea', label: { fr: 'blanc', en: 'white' } },
} as const satisfies Record<string, { hex: string; label: L }>;
export type ColorId = keyof typeof COLORS;
/** "une créature verte": French colour words agree with « créature ». */
export const FEMININE: Record<ColorId, string> = { red: 'rouge', orange: 'orange', yellow: 'jaune', green: 'verte', teal: 'turquoise', blue: 'bleue', purple: 'violette', pink: 'rose', brown: 'marron', white: 'blanche' };
export const COLOR_IDS = Object.keys(COLORS) as ColorId[];

export interface Creature {
  /** Saved creatures keep their id; a fresh one gets it when it joins the album. */
  id: string;
  name: string;
  body: BodyShape;
  head: HeadShape;
  legs: number;
  legStyle: LegStyle;
  arms: number;
  armStyle: ArmStyle;
  wings: WingKind;
  tail: TailKind;
  eyes: number;
  eyeSize: EyeSize;
  mouth: MouthKind;
  top: TopKind;
  hat: HatKind;
  pattern: PatternKind;
  color: ColorId;
  accent: ColorId;
  size: SizeKind;
  nose: NoseKind;
  aura: AuraKind;
  pet: PetKind;
}

/** Everything that changes the look (not the id or the name). */
export const LOOK_KEYS = ['body', 'head', 'legs', 'legStyle', 'arms', 'armStyle', 'wings', 'tail', 'eyes', 'eyeSize', 'mouth', 'top', 'hat', 'pattern', 'color', 'accent', 'size', 'nose', 'aura', 'pet'] as const;
export type LookKey = (typeof LOOK_KEYS)[number];

/** The friendly first creature waiting on the turntable. */
export const STARTER: Creature = {
  id: '',
  name: 'Bloupi-Patatou',
  body: 'blob',
  head: 'none',
  legs: 2,
  legStyle: 'stubby',
  arms: 2,
  armStyle: 'noodle',
  wings: 'none',
  tail: 'none',
  eyes: 2,
  eyeSize: 'big',
  mouth: 'smile',
  top: 'antennae',
  hat: 'none',
  pattern: 'plain',
  color: 'teal',
  accent: 'yellow',
  size: 2,
  nose: 'none',
  aura: 'none',
  pet: 'none',
};

/* ───────────────────────── Categories (the HUD tabs) ───────────────────────── */

export type CategoryId = 'color' | 'accent' | 'wingtail' | 'body' | 'head' | 'eyes' | 'mouth' | 'legs' | 'arms' | 'wings' | 'tail' | 'top' | 'hat' | 'pattern' | 'size' | 'nose' | 'aura' | 'pet';

export interface Category {
  id: CategoryId;
  icon: string;
  label: L;
}

export const CATEGORIES: Category[] = [
  { id: 'color', icon: '🎨', label: { fr: 'Couleur', en: 'Colour' } },
  { id: 'accent', icon: '🖌️', label: { fr: 'Détails', en: 'Details' } },
  { id: 'wingtail', icon: '🦋', label: { fr: 'Ailes et queue', en: 'Wings and tail' } },
  { id: 'body', icon: '🥚', label: { fr: 'Corps', en: 'Body' } },
  { id: 'head', icon: '🙂', label: { fr: 'Tête', en: 'Head' } },
  { id: 'eyes', icon: '👀', label: { fr: 'Yeux', en: 'Eyes' } },
  { id: 'mouth', icon: '👄', label: { fr: 'Bouche', en: 'Mouth' } },
  { id: 'legs', icon: '🦵', label: { fr: 'Pattes', en: 'Legs' } },
  { id: 'arms', icon: '💪', label: { fr: 'Bras', en: 'Arms' } },
  { id: 'wings', icon: '🦋', label: { fr: 'Ailes', en: 'Wings' } },
  { id: 'tail', icon: '🐟', label: { fr: 'Queue', en: 'Tail' } },
  { id: 'top', icon: '🦄', label: { fr: 'Cornes & oreilles', en: 'Horns & ears' } },
  { id: 'hat', icon: '🎩', label: { fr: 'Chapeau', en: 'Hat' } },
  { id: 'pattern', icon: '🌈', label: { fr: 'Motif', en: 'Pattern' } },
  { id: 'nose', icon: '👃', label: { fr: 'Nez', en: 'Nose' } },
  { id: 'aura', icon: '✨', label: { fr: 'Magie', en: 'Magic' } },
  { id: 'pet', icon: '🐞', label: { fr: 'Copain', en: 'Buddy' } },
  { id: 'size', icon: '📏', label: { fr: 'Taille', en: 'Size' } },
];

/** One option of a category: what it changes, how it looks in the HUD, its words. */
export interface PartOption {
  key: string;
  icon: string;
  /** Short name under the icon (readers) and for screen readers. */
  label: L;
  /** What Ziggy says when it plops on (vocabulary, read aloud). */
  say: L;
  apply: (c: Creature) => Creature;
  selected: (c: Creature) => boolean;
  /** Second group of the row (a style after the counts). */
  group?: 0 | 1;
}

const opt = <K extends LookKey>(field: K, value: Creature[K], icon: string, label: L, say: L, group: 0 | 1 = 0): PartOption => ({
  key: `${field}:${String(value)}`,
  icon,
  label,
  say,
  group,
  apply: (c) => ({ ...c, [field]: value }),
  selected: (c) => c[field] === value,
});

const NONE: L = { fr: 'Rien', en: 'None' };

const legWord = (n: number): L => ({ fr: n === 0 ? 'Pas de pattes !' : `${n} patte${n > 1 ? 's' : ''} !`, en: n === 0 ? 'No legs!' : `${n} leg${n > 1 ? 's' : ''}!` });
const armWord = (n: number): L => ({ fr: n === 0 ? 'Pas de bras !' : `${n} bras !`, en: n === 0 ? 'No arms!' : `${n} arms!` });
const eyeWord = (n: number): L => ({ fr: n === 1 ? 'Un seul œil !' : `${n} yeux !`, en: n === 1 ? 'Just one eye!' : `${n} eyes!` });

export const OPTIONS: Record<CategoryId, PartOption[]> = {
  color: COLOR_IDS.map((id) => opt('color', id, '●', COLORS[id].label, { fr: `Tout ${COLORS[id].label.fr} !`, en: `All ${COLORS[id].label.en}!` })),
  accent: COLOR_IDS.map((id) => opt('accent', id, '◆', COLORS[id].label, { fr: `Des détails ${detailFr(id)} !`, en: `${cap(COLORS[id].label.en)} details!` })),
  wingtail: [
    {
      key: 'wingtail:none',
      icon: '✖',
      label: NONE,
      say: { fr: 'Ni ailes ni queue !', en: 'No wings, no tail!' },
      apply: (c) => ({ ...c, wings: 'none', tail: 'none' }),
      selected: (c) => c.wings === 'none' && c.tail === 'none',
    },
    { ...opt('wings', 'bird', '🐦', { fr: 'Oiseau', en: 'Bird' }, { fr: 'Des ailes d’oiseau : elle va voler !', en: 'Bird wings: it can fly!' }), key: 'wingtail:bird' },
    { ...opt('wings', 'butterfly', '🦋', { fr: 'Papillon', en: 'Butterfly' }, { fr: 'Des ailes de papillon !', en: 'Butterfly wings!' }), key: 'wingtail:butterfly' },
    { ...opt('tail', 'fish', '🐟', { fr: 'Nageoire', en: 'Fin' }, { fr: 'Une queue de poisson : elle va nager !', en: 'A fish tail: it can swim!' }), key: 'wingtail:fish' },
  ],
  body: [
    opt('body', 'blob', 'blob', { fr: 'Boule', en: 'Ball' }, { fr: 'Un corps tout rond !', en: 'A round body!' }),
    opt('body', 'egg', 'egg', { fr: 'Œuf', en: 'Egg' }, { fr: 'Un corps en œuf !', en: 'An egg body!' }),
    opt('body', 'bean', 'bean', { fr: 'Haricot', en: 'Bean' }, { fr: 'Un corps en haricot !', en: 'A bean body!' }),
    opt('body', 'box', 'box', { fr: 'Cube', en: 'Cube' }, { fr: 'Un corps carré !', en: 'A square body!' }),
    opt('body', 'drop', 'drop', { fr: 'Goutte', en: 'Drop' }, { fr: 'Un corps en goutte !', en: 'A drop-shaped body!' }),
    opt('body', 'pear', 'pear', { fr: 'Poire', en: 'Pear' }, { fr: 'Un corps en poire !', en: 'A pear body!' }),
    opt('body', 'cloud', 'cloud', { fr: 'Nuage', en: 'Cloud' }, { fr: 'Un corps doux comme un nuage !', en: 'A body soft as a cloud!' }),
    opt('body', 'tall', 'tall', { fr: 'Grand', en: 'Tall' }, { fr: 'Un grand corps tout en hauteur !', en: 'A tall, tall body!' }),
    opt('body', 'barrel', 'barrel', { fr: 'Tonneau', en: 'Barrel' }, { fr: 'Un corps en tonneau !', en: 'A barrel body!' }),
    opt('body', 'bell', 'bell', { fr: 'Cloche', en: 'Bell' }, { fr: 'Un corps en cloche !', en: 'A bell body!' }),
    opt('body', 'pillow', 'pillow', { fr: 'Coussin', en: 'Pillow' }, { fr: 'Un corps coussin tout moelleux !', en: 'A squishy pillow body!' }),
  ],
  head: [
    opt('head', 'none', 'none', { fr: 'Pas de tête', en: 'No head' }, { fr: 'Pas de tête : les yeux sur le ventre !', en: 'No head: eyes on the tummy!' }),
    opt('head', 'ball', 'ball', { fr: 'Ronde', en: 'Round' }, { fr: 'Une tête ronde !', en: 'A round head!' }),
    opt('head', 'box', 'box', { fr: 'Carrée', en: 'Square' }, { fr: 'Une tête carrée !', en: 'A square head!' }),
    opt('head', 'bean', 'bean', { fr: 'Allongée', en: 'Wide' }, { fr: 'Une grosse tête allongée !', en: 'A big wide head!' }),
    opt('head', 'wide', 'wide', { fr: 'Large', en: 'Wide' }, { fr: 'Une tête toute large !', en: 'A very wide head!' }),
    opt('head', 'tall', 'tall', { fr: 'Haute', en: 'Tall' }, { fr: 'Une tête toute haute !', en: 'A tall head!' }),
    opt('head', 'drop', 'drop', { fr: 'Goutte', en: 'Drop' }, { fr: 'Une tête en goutte !', en: 'A drop-shaped head!' }),
    opt('head', 'cone', 'cone', { fr: 'Pointue', en: 'Pointy' }, { fr: 'Une tête pointue !', en: 'A pointy head!' }),
  ],
  eyes: [
    ...EYE_COUNTS.map((n) => opt('eyes', n, String(n), { fr: n === 1 ? '1 œil' : `${n} yeux`, en: n === 1 ? '1 eye' : `${n} eyes` }, eyeWord(n))),
    opt('eyeSize', 'small', 'small', { fr: 'Petits', en: 'Small' }, { fr: 'Des petits yeux !', en: 'Little eyes!' }, 1),
    opt('eyeSize', 'big', 'big', { fr: 'Gros', en: 'Big' }, { fr: 'Des gros yeux !', en: 'Big eyes!' }, 1),
  ],
  mouth: [
    opt('mouth', 'smile', '😊', { fr: 'Sourire', en: 'Smile' }, { fr: 'Un grand sourire !', en: 'A big smile!' }),
    opt('mouth', 'fangs', '🧛', { fr: 'Crocs', en: 'Fangs' }, { fr: 'Des petits crocs !', en: 'Little fangs!' }),
    opt('mouth', 'beak', '🐤', { fr: 'Bec', en: 'Beak' }, { fr: 'Un bec, comme un oiseau !', en: 'A beak, like a bird!' }),
    opt('mouth', 'tongue', '😛', { fr: 'Langue', en: 'Tongue' }, { fr: 'Elle tire la langue !', en: 'It sticks its tongue out!' }),
    opt('mouth', 'oh', '😮', { fr: 'Oh !', en: 'Oh!' }, { fr: 'Oh ! Une bouche toute ronde !', en: 'Oh! A round mouth!' }),
    opt('mouth', 'teeth', '🐹', { fr: 'Dents', en: 'Teeth' }, { fr: 'Deux grandes dents !', en: 'Two big teeth!' }),
    opt('mouth', 'cat', '🐱', { fr: 'Moustaches', en: 'Cat mouth' }, { fr: 'Une bouche de chat !', en: 'A cat mouth!' }),
    opt('mouth', 'grin', '😁', { fr: 'Grand rire', en: 'Big grin' }, { fr: 'Un énorme sourire !', en: 'A huge grin!' }),
    opt('mouth', 'moustache', '🥸', { fr: 'Moustache', en: 'Moustache' }, { fr: 'Une moustache de monsieur !', en: 'A fancy moustache!' }),
    opt('mouth', 'gap', '😬', { fr: 'Dent en moins', en: 'Gap tooth' }, { fr: 'Un sourire avec une dent en moins !', en: 'A smile with a gap tooth!' }),
  ],
  legs: [
    ...LEG_COUNTS.map((n) => opt('legs', n, String(n), { fr: n === 1 ? '1 patte' : `${n} pattes`, en: n === 1 ? '1 leg' : `${n} legs` }, legWord(n))),
    opt('legStyle', 'stubby', '🐘', { fr: 'Courtes', en: 'Stubby' }, { fr: 'Des pattes toutes courtes !', en: 'Stubby little legs!' }, 1),
    opt('legStyle', 'long', '🦩', { fr: 'Longues', en: 'Long' }, { fr: 'De longues pattes, comme un flamant !', en: 'Long legs, like a flamingo!' }, 1),
    opt('legStyle', 'tentacle', '🐙', { fr: 'Tentacules', en: 'Tentacles' }, { fr: 'Des tentacules, comme une pieuvre !', en: 'Tentacles, like an octopus!' }, 1),
    opt('legStyle', 'spring', '🌀', { fr: 'Ressorts', en: 'Springs' }, { fr: 'Des pattes à ressort : boing !', en: 'Spring legs: boing!' }, 1),
    opt('legStyle', 'wheel', '🛞', { fr: 'Roues', en: 'Wheels' }, { fr: 'Des roulettes !', en: 'Little wheels!' }, 1),
    opt('legStyle', 'paddle', '🦆', { fr: 'Palmes', en: 'Flippers' }, { fr: 'Des palmes, comme un canard !', en: 'Flippers, like a duck!' }, 1),
  ],
  arms: [
    ...ARM_COUNTS.map((n) => opt('arms', n, String(n), { fr: `${n} bras`, en: `${n} arms` }, armWord(n))),
    opt('armStyle', 'noodle', '🍝', { fr: 'Spaghetti', en: 'Noodle' }, { fr: 'Des bras spaghetti !', en: 'Noodle arms!' }, 1),
    opt('armStyle', 'pincer', '🦀', { fr: 'Pinces', en: 'Pincers' }, { fr: 'Des pinces, comme un crabe !', en: 'Pincers, like a crab!' }, 1),
    opt('armStyle', 'mitten', '🧤', { fr: 'Moufles', en: 'Mittens' }, { fr: 'Des grosses mains toutes douces !', en: 'Big soft mitten hands!' }, 1),
    opt('armStyle', 'glove', '🖐️', { fr: 'Gants', en: 'Gloves' }, { fr: 'Des gants de dessin animé !', en: 'Cartoon gloves!' }, 1),
    opt('armStyle', 'fin', '🐬', { fr: 'Nageoires', en: 'Flippers' }, { fr: 'Des nageoires de dauphin !', en: 'Dolphin flippers!' }, 1),
    opt('armStyle', 'feather', '🪶', { fr: 'Plumes', en: 'Feathers' }, { fr: 'Des bras en plumes !', en: 'Feathery arms!' }, 1),
  ],
  wings: [
    opt('wings', 'none', '✖', NONE, { fr: 'Pas d’ailes !', en: 'No wings!' }),
    opt('wings', 'bird', '🐦', { fr: 'Oiseau', en: 'Bird' }, { fr: 'Des ailes d’oiseau : elle va voler !', en: 'Bird wings: it can fly!' }),
    opt('wings', 'bat', '🦇', { fr: 'Chauve-souris', en: 'Bat' }, { fr: 'Des ailes de chauve-souris !', en: 'Bat wings!' }),
    opt('wings', 'butterfly', '🦋', { fr: 'Papillon', en: 'Butterfly' }, { fr: 'Des ailes de papillon !', en: 'Butterfly wings!' }),
    opt('wings', 'tiny', '🐝', { fr: 'Mini', en: 'Tiny' }, { fr: 'Des toutes petites ailes, comme une abeille !', en: 'Teeny tiny wings, like a bee!' }),
    opt('wings', 'angel', '😇', { fr: 'Ange', en: 'Angel' }, { fr: 'Des ailes d’ange toutes blanches !', en: 'Fluffy angel wings!' }),
    opt('wings', 'fairy', '🧚', { fr: 'Fée', en: 'Fairy' }, { fr: 'Des ailes de fée brillantes !', en: 'Shiny fairy wings!' }),
    opt('wings', 'leaf', '🍃', { fr: 'Feuilles', en: 'Leaves' }, { fr: 'Des ailes en feuilles !', en: 'Leafy wings!' }),
    opt('wings', 'rainbow', '🌈', { fr: 'Arc-en-ciel', en: 'Rainbow' }, { fr: 'Des ailes arc-en-ciel !', en: 'Rainbow wings!' }),
  ],
  tail: [
    opt('tail', 'none', '✖', NONE, { fr: 'Pas de queue !', en: 'No tail!' }),
    opt('tail', 'fish', '🐟', { fr: 'Nageoire', en: 'Fin' }, { fr: 'Une queue de poisson : elle va nager !', en: 'A fish tail: it can swim!' }),
    opt('tail', 'curly', '🐷', { fr: 'Tire-bouchon', en: 'Curly' }, { fr: 'Une queue en tire-bouchon, comme un cochon !', en: 'A curly tail, like a pig!' }),
    opt('tail', 'pompom', '☁️', { fr: 'Pompon', en: 'Pompom' }, { fr: 'Une queue pompon, comme un lapin !', en: 'A pompom tail, like a bunny!' }),
    opt('tail', 'dragon', '🐉', { fr: 'Dragon', en: 'Dragon' }, { fr: 'Une queue de dragon !', en: 'A dragon tail!' }),
    opt('tail', 'lightning', '⚡', { fr: 'Éclair', en: 'Lightning' }, { fr: 'Une queue en éclair !', en: 'A lightning tail!' }),
    opt('tail', 'plume', '🦚', { fr: 'Plumes', en: 'Plume' }, { fr: 'Une queue de plumes de paon !', en: 'A peacock plume tail!' }),
    opt('tail', 'balloon', '🎈', { fr: 'Ballon', en: 'Balloon' }, { fr: 'Un ballon au bout de la queue !', en: 'A balloon on the tail!' }),
    opt('tail', 'ribbon', '🎀', { fr: 'Ruban', en: 'Ribbon' }, { fr: 'Une queue en ruban !', en: 'A ribbon tail!' }),
  ],
  top: [
    opt('top', 'none', '✖', NONE, { fr: 'Rien sur la tête !', en: 'Nothing on top!' }),
    opt('top', 'horns', '🐮', { fr: 'Cornes', en: 'Horns' }, { fr: 'Deux cornes !', en: 'Two horns!' }),
    opt('top', 'antennae', '🐜', { fr: 'Antennes', en: 'Antennae' }, { fr: 'Des antennes, comme une fourmi !', en: 'Antennae, like an ant!' }),
    opt('top', 'bunny', '🐰', { fr: 'Lapin', en: 'Bunny' }, { fr: 'Des oreilles de lapin !', en: 'Bunny ears!' }),
    opt('top', 'cat', '🐱', { fr: 'Chat', en: 'Cat' }, { fr: 'Des oreilles de chat !', en: 'Cat ears!' }),
    opt('top', 'crest', '🦖', { fr: 'Crête', en: 'Spikes' }, { fr: 'Une crête de dinosaure !', en: 'Dinosaur spikes!' }),
    opt('top', 'eyestalks', '🐌', { fr: 'Yeux d’escargot', en: 'Eye stalks' }, { fr: 'Des yeux au bout de tiges, comme un escargot !', en: 'Eyes on stalks, like a snail!' }),
    opt('top', 'elf', '🧝', { fr: 'Elfe', en: 'Elf' }, { fr: 'Des oreilles d’elfe !', en: 'Elf ears!' }),
    opt('top', 'floppy', '🐶', { fr: 'Chien', en: 'Floppy' }, { fr: 'Des oreilles tombantes de chien !', en: 'Floppy dog ears!' }),
    opt('top', 'bear', '🐻', { fr: 'Ours', en: 'Bear' }, { fr: 'Des petites oreilles d’ours !', en: 'Little bear ears!' }),
    opt('top', 'unicorn', '🦄', { fr: 'Licorne', en: 'Unicorn' }, { fr: 'Une corne de licorne !', en: 'A unicorn horn!' }),
    opt('top', 'flower', '🌸', { fr: 'Fleur', en: 'Flower' }, { fr: 'Une fleur sur la tête !', en: 'A flower on top!' }),
  ],
  hat: [
    opt('hat', 'none', '✖', NONE, { fr: 'Pas de chapeau !', en: 'No hat!' }),
    opt('hat', 'top', '🎩', { fr: 'Haut-de-forme', en: 'Top hat' }, { fr: 'Un chapeau haut-de-forme. Très chic !', en: 'A top hat. So fancy!' }),
    opt('hat', 'party', '🥳', { fr: 'Fête', en: 'Party' }, { fr: 'Un chapeau de fête !', en: 'A party hat!' }),
    opt('hat', 'crown', '👑', { fr: 'Couronne', en: 'Crown' }, { fr: 'Une couronne de roi !', en: 'A royal crown!' }),
    opt('hat', 'propeller', '🚁', { fr: 'Hélice', en: 'Propeller' }, { fr: 'Une casquette à hélice !', en: 'A propeller cap!' }),
    opt('hat', 'bow', '🎀', { fr: 'Nœud', en: 'Bow' }, { fr: 'Un joli nœud !', en: 'A pretty bow!' }),
    opt('hat', 'wizard', '🧙', { fr: 'Magicien', en: 'Wizard' }, { fr: 'Un chapeau de magicien !', en: 'A wizard hat!' }),
    opt('hat', 'chef', '👨‍🍳', { fr: 'Cuisinier', en: 'Chef' }, { fr: 'Une toque de cuisinier !', en: 'A chef’s hat!' }),
    opt('hat', 'cap', '🧢', { fr: 'Casquette', en: 'Cap' }, { fr: 'Une casquette !', en: 'A cap!' }),
    opt('hat', 'beanie', '🧶', { fr: 'Bonnet', en: 'Beanie' }, { fr: 'Un bonnet tout chaud !', en: 'A warm beanie!' }),
    opt('hat', 'halo', '😇', { fr: 'Auréole', en: 'Halo' }, { fr: 'Une auréole qui brille !', en: 'A shiny halo!' }),
    opt('hat', 'captain', '⚓', { fr: 'Capitaine', en: 'Captain' }, { fr: 'Un chapeau de capitaine !', en: 'A captain’s hat!' }),
  ],
  pattern: [
    opt('pattern', 'plain', 'plain', { fr: 'Uni', en: 'Plain' }, { fr: 'Tout uni !', en: 'Plain colour!' }),
    opt('pattern', 'dots', 'dots', { fr: 'Pois', en: 'Dots' }, { fr: 'Des pois !', en: 'Polka dots!' }),
    opt('pattern', 'stripes', 'stripes', { fr: 'Rayures', en: 'Stripes' }, { fr: 'Des rayures !', en: 'Stripes!' }),
    opt('pattern', 'stars', 'stars', { fr: 'Étoiles', en: 'Stars' }, { fr: 'Des étoiles !', en: 'Stars!' }),
    opt('pattern', 'zigzag', 'zigzag', { fr: 'Zigzag', en: 'Zigzag' }, { fr: 'Des zigzags !', en: 'Zigzags!' }),
    opt('pattern', 'hearts', 'hearts', { fr: 'Cœurs', en: 'Hearts' }, { fr: 'Des petits cœurs !', en: 'Little hearts!' }),
    opt('pattern', 'checks', 'checks', { fr: 'Carreaux', en: 'Checks' }, { fr: 'Des carreaux !', en: 'Checks!' }),
    opt('pattern', 'waves', 'waves', { fr: 'Vagues', en: 'Waves' }, { fr: 'Des vagues !', en: 'Waves!' }),
  ],
  nose: [
    opt('nose', 'none', '✖', NONE, { fr: 'Pas de nez !', en: 'No nose!' }),
    opt('nose', 'button', '🔘', { fr: 'Bouton', en: 'Button' }, { fr: 'Un petit nez bouton !', en: 'A little button nose!' }),
    opt('nose', 'clown', '🤡', { fr: 'Clown', en: 'Clown' }, { fr: 'Un gros nez rouge de clown !', en: 'A big red clown nose!' }),
    opt('nose', 'snout', '🐽', { fr: 'Groin', en: 'Snout' }, { fr: 'Un groin tout rigolo !', en: 'A funny snout!' }),
    opt('nose', 'carrot', '🥕', { fr: 'Carotte', en: 'Carrot' }, { fr: 'Un nez en carotte, comme un bonhomme de neige !', en: 'A carrot nose, like a snowman!' }),
    opt('nose', 'heart', '💗', { fr: 'Cœur', en: 'Heart' }, { fr: 'Un nez en cœur !', en: 'A heart nose!' }),
  ],
  aura: [
    opt('aura', 'none', '✖', NONE, { fr: 'Pas de magie !', en: 'No magic!' }),
    opt('aura', 'sparkles', '✨', { fr: 'Étincelles', en: 'Sparkles' }, { fr: 'Des étincelles partout !', en: 'Sparkles everywhere!' }),
    opt('aura', 'hearts', '💖', { fr: 'Cœurs', en: 'Hearts' }, { fr: 'Des petits cœurs qui flottent !', en: 'Floating little hearts!' }),
    opt('aura', 'bubbles', '🫧', { fr: 'Bulles', en: 'Bubbles' }, { fr: 'Des bulles de savon !', en: 'Soap bubbles!' }),
    opt('aura', 'stars', '⭐', { fr: 'Étoiles', en: 'Stars' }, { fr: 'Des étoiles qui tournent !', en: 'Spinning stars!' }),
    opt('aura', 'notes', '🎵', { fr: 'Musique', en: 'Music' }, { fr: 'De la musique autour d’elle !', en: 'Music all around it!' }),
  ],
  pet: [
    opt('pet', 'none', '✖', NONE, { fr: 'Pas de copain !', en: 'No buddy!' }),
    opt('pet', 'ladybug', '🐞', { fr: 'Coccinelle', en: 'Ladybug' }, { fr: 'Une coccinelle pour copine !', en: 'A ladybug friend!' }),
    opt('pet', 'chick', '🐥', { fr: 'Poussin', en: 'Chick' }, { fr: 'Un poussin pour copain !', en: 'A chick friend!' }),
    opt('pet', 'cloud', '☁️', { fr: 'Petit nuage', en: 'Little cloud' }, { fr: 'Un petit nuage qui la suit !', en: 'A little cloud follows it!' }),
    opt('pet', 'snail', '🐌', { fr: 'Escargot', en: 'Snail' }, { fr: 'Un escargot tout lent !', en: 'A very slow snail!' }),
    opt('pet', 'balloon', '🎈', { fr: 'Ballon', en: 'Balloon' }, { fr: 'Un ballon qui flotte !', en: 'A floating balloon!' }),
  ],
  size: [
    opt('size', 1, 's1', { fr: 'Petite', en: 'Small' }, { fr: 'Toute petite !', en: 'Teeny tiny!' }),
    opt('size', 2, 's2', { fr: 'Moyenne', en: 'Medium' }, { fr: 'Moyenne !', en: 'Medium!' }),
    opt('size', 3, 's3', { fr: 'Géante', en: 'Giant' }, { fr: 'Géante !', en: 'Giant!' }),
  ],
};

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
/** "des détails jaunes", with the right French plural. */
function detailFr(id: ColorId): string {
  const w = COLORS[id].label.fr;
  return id === 'orange' || id === 'brown' ? w : w.endsWith('s') ? w : `${w}s`;
}

/** Which tab a part belongs to (for the hints: "open the legs"). */
export function categoryOf(key: LookKey): CategoryId {
  if (key === 'legStyle') return 'legs';
  if (key === 'armStyle') return 'arms';
  if (key === 'eyeSize') return 'eyes';
  return key;
}

/* ───────────────────────── What each age sees ───────────────────────── */

/**
 * Depth is revealed with age, never "unlocked": little ones see 6 tabs with a few
 * big pictures, older kids more tabs, more choices and exact counters.
 */
export const BAND_CATEGORIES: Record<Band, CategoryId[]> = {
  little: ['color', 'eyes', 'legs', 'wingtail', 'hat', 'mouth', 'aura'],
  middle: ['color', 'body', 'eyes', 'mouth', 'nose', 'legs', 'arms', 'wings', 'tail', 'top', 'hat', 'aura', 'pet'],
  big: ['color', 'accent', 'body', 'head', 'eyes', 'mouth', 'legs', 'arms', 'wings', 'tail', 'top', 'hat', 'nose', 'pattern', 'aura', 'pet', 'size'],
};

/** "− 6 +" for the exact number of legs or eyes. */
export interface Stepper {
  field: 'legs' | 'eyes';
  min: number;
  max: number;
  icon: string;
}

export interface Drawer {
  stepper?: Stepper;
  options: PartOption[];
}

const keep = (cat: CategoryId, keys: string[]) => keys.map((k) => OPTIONS[cat].find((o) => o.key === k)!);

/** The options shown for a tab at an age (a few at a time; see `drawerPage`). */
export function drawerFor(cat: CategoryId, band: Band): Drawer {
  if (band === 'little') {
    if (cat === 'color') return { options: keep('color', ['color:red', 'color:yellow', 'color:blue', 'color:green', 'color:pink', 'color:purple', 'color:orange', 'color:teal']) };
    if (cat === 'eyes') return { options: keep('eyes', ['eyes:1', 'eyes:2', 'eyes:3', 'eyes:4']) };
    if (cat === 'legs') return { options: keep('legs', ['legs:0', 'legs:1', 'legs:2', 'legs:4', 'legs:6', 'legs:8']) };
    if (cat === 'hat') return { options: keep('hat', ['hat:none', 'hat:top', 'hat:crown', 'hat:propeller', 'hat:party', 'hat:bow']) };
    if (cat === 'mouth') return { options: keep('mouth', ['mouth:smile', 'mouth:tongue', 'mouth:fangs', 'mouth:beak', 'mouth:oh', 'mouth:teeth']) };
    return { options: OPTIONS[cat] };
  }
  if (cat === 'legs') return { stepper: { field: 'legs', min: 0, max: 8, icon: '🦵' }, options: OPTIONS.legs.filter((o) => o.group === 1) };
  if (cat === 'eyes' && band === 'big') return { stepper: { field: 'eyes', min: 1, max: 5, icon: '👁️' }, options: OPTIONS.eyes.filter((o) => o.group === 1) };
  if (cat === 'eyes') return { options: OPTIONS.eyes.filter((o) => o.group !== 1) };
  return { options: OPTIONS[cat] };
}

/** At most `size` tiles: when more remain, the last tile becomes "↻ more" (pages loop). */
export function drawerPage<T>(options: T[], page: number, size: number): { items: T[]; more: boolean; pages: number } {
  if (options.length <= size) return { items: options, more: false, pages: 1 };
  const per = size - 1;
  const pages = Math.ceil(options.length / per);
  const p = ((page % pages) + pages) % pages;
  return { items: options.slice(p * per, p * per + per), more: true, pages };
}

/** The page where the current choice is (so the drawer opens on it). */
export function pageWith(options: PartOption[], c: Creature, size: number): number {
  if (options.length <= size) return 0;
  const i = options.findIndex((o) => o.selected(c));
  return i < 0 ? 0 : Math.floor(i / (size - 1));
}

/** Tiles per drawer: 4 big pictures for little ones (+ "more"), up to 6 later. */
export const DRAWER_SIZE: Record<Band, number> = { little: 5, middle: 6, big: 6 };

/* ───────────────────────── Validation & storage ───────────────────────── */

const isIn = <T extends readonly (string | number)[]>(list: T, v: unknown): v is T[number] => (list as readonly unknown[]).includes(v);

/** A creature read from storage (or anywhere): every field checked, bad ones replaced. */
export function sanitize(x: unknown): Creature | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const pick = <T extends readonly (string | number)[]>(list: T, v: unknown, d: T[number]): T[number] => (isIn(list, v) ? v : d);
  const int = (v: unknown, min: number, max: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : d);
  const name = typeof o.name === 'string' ? cleanName(o.name) : '';
  const c: Creature = {
    id: typeof o.id === 'string' ? o.id.slice(0, 40) : '',
    name: name || STARTER.name,
    body: pick(BODIES, o.body, STARTER.body),
    head: pick(HEADS, o.head, STARTER.head),
    legs: int(o.legs, 0, 8, STARTER.legs),
    legStyle: pick(LEG_STYLES, o.legStyle, STARTER.legStyle),
    arms: pick(ARM_COUNTS, o.arms, STARTER.arms as (typeof ARM_COUNTS)[number]),
    armStyle: pick(ARM_STYLES, o.armStyle, STARTER.armStyle),
    wings: pick(WINGS, o.wings, STARTER.wings),
    tail: pick(TAILS, o.tail, STARTER.tail),
    eyes: int(o.eyes, 1, 5, STARTER.eyes),
    eyeSize: pick(EYE_SIZES, o.eyeSize, STARTER.eyeSize),
    mouth: pick(MOUTHS, o.mouth, STARTER.mouth),
    top: pick(TOPS, o.top, STARTER.top),
    hat: pick(HATS, o.hat, STARTER.hat),
    pattern: pick(PATTERNS, o.pattern, STARTER.pattern),
    color: pick(COLOR_IDS, o.color, STARTER.color),
    accent: pick(COLOR_IDS, o.accent, STARTER.accent),
    size: pick(SIZES, o.size, STARTER.size),
    nose: pick(NOSES, o.nose, STARTER.nose),
    aura: pick(AURAS, o.aura, STARTER.aura),
    pet: pick(PETS, o.pet, STARTER.pet),
  };
  return c;
}

export function cleanName(s: string): string {
  return s
    .replace(/[^\p{L}\p{N} '’-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 28);
}

export function sameLook(a: Creature, b: Creature): boolean {
  return LOOK_KEYS.every((k) => a[k] === b[k]);
}

/** Which parts differ (to make only those plop). */
export function changedKeys(a: Creature, b: Creature): LookKey[] {
  return LOOK_KEYS.filter((k) => a[k] !== b[k]);
}

/* ───────────────────────── Surprise! ───────────────────────── */

const pickOf = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length];

/** The machine mixes everything: silly, but always a whole creature. */
export function randomCreature(seed: number): Creature {
  const r = rng(seed);
  const color = pickOf(r, COLOR_IDS);
  let accent = pickOf(r, COLOR_IDS);
  if (accent === color) accent = COLOR_IDS[(COLOR_IDS.indexOf(color) + 3) % COLOR_IDS.length];
  return {
    id: '',
    name: makeName(Math.floor(r() * 1e9)),
    body: pickOf(r, BODIES),
    head: pickOf(r, ['none', 'ball', 'ball', 'box', 'bean', 'wide', 'tall', 'drop', 'cone'] as const),
    legs: pickOf(r, [0, 1, 2, 2, 3, 4, 4, 5, 6, 8] as const),
    legStyle: pickOf(r, LEG_STYLES),
    arms: pickOf(r, [0, 2, 2, 4] as const),
    armStyle: pickOf(r, ARM_STYLES),
    wings: pickOf(r, ['none', 'none', 'none', ...WINGS.slice(1)] as const),
    tail: pickOf(r, ['none', 'none', ...TAILS.slice(1)] as const),
    eyes: pickOf(r, [1, 2, 2, 3, 3, 4, 5] as const),
    eyeSize: pickOf(r, EYE_SIZES),
    mouth: pickOf(r, MOUTHS),
    top: pickOf(r, TOPS),
    hat: pickOf(r, ['none', 'none', ...HATS.slice(1)] as const),
    pattern: pickOf(r, PATTERNS),
    color,
    accent,
    size: pickOf(r, SIZES),
    nose: pickOf(r, ['none', 'none', ...NOSES.slice(1)] as const),
    aura: pickOf(r, ['none', 'none', 'none', ...AURAS.slice(1)] as const),
    pet: pickOf(r, ['none', 'none', 'none', ...PETS.slice(1)] as const),
  };
}

/* ───────────────────────── Silly names ───────────────────────── */

// Simple consonant-vowel syllables that read the same in French and English
// text-to-speech, chosen so that no rude word can come out (see the test).
const N1 = ['Blou', 'Zou', 'Gri', 'Mo', 'Fla', 'Tou', 'Ki', 'Bou', 'Lu', 'Pla', 'Ri', 'Ga', 'No', 'Zi', 'Fu', 'Ba', 'Glou', 'Wa', 'Pom', 'Tchi', 'Ro', 'Dou', 'Mi', 'Bri'];
const N2 = ['pi', 'li', 'zou', 'bi', 'mo', 'gou', 'tou', 'nou', 'lo', 'fi', 'ta', 'ri', 'bou', 'dou', 'mi', 'ffy', 'go', 'la'];
const M1 = ['Tra', 'Gla', 'Bi', 'Pata', 'Fri', 'Moumou', 'Ziggo', 'Tchou', 'Rata', 'Bidou', 'Plou', 'Kiri', 'Mira', 'Gribou', 'Toto', 'Zabou', 'Choupi', 'Firfi'];
const M2 = ['ca', 'la', 'mi', 'pou', 'fi', 'bou', 'ri', 'zi', 'lou', 'ga', 'no', 'mou'];
const M3 = ['sin', 'tou', 'lette', 'mouche', 'rinette', 'boulette', 'grouille', 'patine', 'rigolo', 'dodo', 'lala', 'tilou', 'line', 'chou', 'bidule', 'zou', 'mollet', 'tatin'];

export const NAME_PARTS = { N1, N2, M1, M2, M3 };

/** "Bloupi-Tracassin": two silly words, the same in every language. */
export function makeName(seed: number): string {
  const r = rng(seed * 7 + 3);
  const a = pickOf(r, N1) + pickOf(r, N2);
  const b = pickOf(r, M1) + pickOf(r, M2) + pickOf(r, M3);
  return `${a}-${b}`;
}

/** Words a generated name must never contain (checked by the tests). */
export const NAME_BLOCKLIST = [
  'caca', 'pipi', 'prout', 'cul', 'con', 'bite', 'pute', 'zob', 'merde', 'nique', 'fesse', 'chie', 'pisse', 'mort', 'tue', 'nul', 'moche', 'bete', 'gros', 'pet', 'pouf', 'pine', 'zizi', 'teub', 'naze', 'boudin', 'nouille', 'crotte', 'vomi', 'bouse', 'kiki', 'lolo', 'gaga', 'zgeg', 'nichon', 'teton', 'foufoune', 'chatte',
  'poop', 'pee', 'fart', 'butt', 'dick', 'ass', 'sex', 'nazi', 'kill', 'dumb', 'stupid', 'idiot', 'fat', 'ugly', 'shit', 'fuck', 'cock', 'tit', 'nig', 'hell', 'damn', 'crap', 'die', 'dead', 'puke', 'gay', 'fag', 'poo', 'bum', 'turd', 'wee', 'piss', 'boob', 'nude', 'snot',
];

/* ───────────────────────── Moves & voice ───────────────────────── */

export type MoveKind = 'walk' | 'pogo' | 'bounce' | 'fly' | 'flutter' | 'swim';

/** What the creature does when it comes to life, in order. */
export function movesOf(c: Creature): MoveKind[] {
  const ground: MoveKind = c.legs === 0 ? 'bounce' : c.legs === 1 ? 'pogo' : 'walk';
  const moves: MoveKind[] = [];
  const canFly = c.wings !== 'none' && c.wings !== 'tiny';
  if (canFly) moves.push('fly');
  if (c.tail === 'fish') moves.push('swim');
  if (!canFly || c.legs > 1 || moves.length < 2) moves.unshift(ground);
  if (c.wings === 'tiny') moves.push('flutter');
  return moves.slice(0, 3);
}

/** What it can do (the words for "it flies AND swims"). */
export function abilities(c: Creature) {
  return { fly: c.wings !== 'none' && c.wings !== 'tiny', swim: c.tail === 'fish', walk: c.legs > 0 };
}

export type VoiceKind = 'squeak' | 'honk' | 'boing' | 'blub' | 'buzz' | 'purr' | 'roar';

export interface Voice {
  kind: VoiceKind;
  /** Base pitch in Hz: tiny creatures squeak high, giants rumble low. */
  pitch: number;
  /** How many little sounds in one "word". */
  syllables: number;
}

/** A funny voice made from its shape and size (always the same for the same creature). */
export function voiceOf(c: Creature): Voice {
  const kind: VoiceKind =
    c.tail === 'fish' ? 'blub' : c.mouth === 'beak' ? 'honk' : c.legs >= 6 || c.wings === 'tiny' ? 'buzz' : c.tail === 'dragon' || c.mouth === 'fangs' ? 'roar' : c.body === 'box' ? 'boing' : c.top === 'cat' || c.body === 'drop' ? 'purr' : 'squeak';
  const base = { squeak: 620, honk: 330, boing: 280, blub: 360, buzz: 240, purr: 150, roar: 170 }[kind];
  const pitch = Math.round(base * (c.size === 1 ? 1.55 : c.size === 3 ? 0.62 : 1) * (1 + (c.eyes - 3) * 0.04));
  return { kind, pitch, syllables: 1 + (c.eyes % 3) + (c.legs > 4 ? 1 : 0) };
}

/** Number of limbs, for the counting challenges and the HUD. */
export function limbs(c: Creature) {
  return c.legs + c.arms;
}

/* ───────────────────────── Challenges (optional) ───────────────────────── */

export type ChallengeSkill = 'vocabulary' | 'counting' | 'addition' | 'colors' | 'logic';

export type Req =
  | { k: 'legs'; n: number }
  | { k: 'arms'; n: number }
  | { k: 'eyes'; n: number }
  | { k: 'wings' }
  | { k: 'wingsIs'; is: WingKind }
  | { k: 'tail'; is: TailKind }
  | { k: 'top'; is: TopKind }
  | { k: 'hat' }
  | { k: 'hatIs'; is: HatKind }
  | { k: 'mouth'; is: MouthKind }
  | { k: 'pattern'; is: PatternKind }
  | { k: 'color'; is: ColorId }
  | { k: 'legStyle'; is: LegStyle }
  | { k: 'limbs'; n: number }
  | { k: 'sumAll'; n: number }
  | { k: 'eyesEqLegs' }
  | { k: 'oddLegs' };

export interface Challenge {
  id: string;
  band: Band;
  skill: ChallengeSkill;
  icon: string;
  text: L;
  reqs: Req[];
}

export const CHALLENGES: Challenge[] = [
  // Little ones (4-6): one or two things to count or to name.
  { id: 'eyes3', band: 'little', skill: 'counting', icon: '👀', text: { fr: 'Fabrique une créature avec 3 yeux !', en: 'Make a creature with 3 eyes!' }, reqs: [{ k: 'eyes', n: 3 }] },
  { id: 'fly', band: 'little', skill: 'vocabulary', icon: '🦋', text: { fr: 'Fabrique une créature qui vole : il lui faut des ailes !', en: 'Make a creature that flies: it needs wings!' }, reqs: [{ k: 'wings' }] },
  { id: 'legs4', band: 'little', skill: 'counting', icon: '🐱', text: { fr: 'Une créature avec 4 pattes, comme un chat !', en: 'A creature with 4 legs, like a cat!' }, reqs: [{ k: 'legs', n: 4 }] },
  { id: 'cyclops', band: 'little', skill: 'counting', icon: '🎩', text: { fr: 'Un monstre rigolo avec 1 seul œil et un chapeau !', en: 'A funny monster with just 1 eye and a hat!' }, reqs: [{ k: 'eyes', n: 1 }, { k: 'hat' }] },
  { id: 'swim', band: 'little', skill: 'vocabulary', icon: '🐟', text: { fr: 'Une créature qui nage : donne-lui une queue de poisson !', en: 'A creature that swims: give it a fish tail!' }, reqs: [{ k: 'tail', is: 'fish' }] },
  { id: 'yellowCrown', band: 'little', skill: 'colors', icon: '👑', text: { fr: 'Une créature jaune avec une couronne !', en: 'A yellow creature with a crown!' }, reqs: [{ k: 'color', is: 'yellow' }, { k: 'hatIs', is: 'crown' }] },
  { id: 'pinkTongue', band: 'little', skill: 'colors', icon: '😛', text: { fr: 'Une créature rose qui tire la langue !', en: 'A pink creature sticking its tongue out!' }, reqs: [{ k: 'color', is: 'pink' }, { k: 'mouth', is: 'tongue' }] },
  { id: 'bluePogo', band: 'little', skill: 'counting', icon: '🦘', text: { fr: 'Une créature bleue avec 1 seule patte, boing !', en: 'A blue creature with just 1 leg, boing!' }, reqs: [{ k: 'color', is: 'blue' }, { k: 'legs', n: 1 }] },
  // Middle (6-8): two or three parts, bigger numbers, new words.
  { id: 'flySwim', band: 'middle', skill: 'vocabulary', icon: '🐟', text: { fr: 'Fabrique une créature qui peut voler ET nager !', en: 'Make a creature that can fly AND swim!' }, reqs: [{ k: 'wings' }, { k: 'tail', is: 'fish' }] },
  { id: 'insect', band: 'middle', skill: 'counting', icon: '🐜', text: { fr: 'Une créature avec 6 pattes, comme un insecte, et des antennes !', en: 'A creature with 6 legs, like an insect, and antennae!' }, reqs: [{ k: 'legs', n: 6 }, { k: 'top', is: 'antennae' }] },
  { id: 'eyes3horns', band: 'middle', skill: 'counting', icon: '🐮', text: { fr: 'Une créature avec 3 yeux et 2 cornes !', en: 'A creature with 3 eyes and 2 horns!' }, reqs: [{ k: 'eyes', n: 3 }, { k: 'top', is: 'horns' }] },
  { id: 'spider', band: 'middle', skill: 'counting', icon: '🕷️', text: { fr: 'Une créature avec 8 pattes, comme une araignée !', en: 'A creature with 8 legs, like a spider!' }, reqs: [{ k: 'legs', n: 8 }] },
  { id: 'dragon', band: 'middle', skill: 'vocabulary', icon: '🐉', text: { fr: 'Un petit dragon : des ailes de chauve-souris et une queue de dragon !', en: 'A little dragon: bat wings and a dragon tail!' }, reqs: [{ k: 'wingsIs', is: 'bat' }, { k: 'tail', is: 'dragon' }] },
  { id: 'crab', band: 'middle', skill: 'vocabulary', icon: '🦀', text: { fr: 'Une créature rouge avec 4 bras, comme un crabe géant !', en: 'A red creature with 4 arms, like a giant crab!' }, reqs: [{ k: 'color', is: 'red' }, { k: 'arms', n: 4 }] },
  { id: 'octopus', band: 'middle', skill: 'vocabulary', icon: '🐙', text: { fr: 'Une pieuvre : 8 tentacules et une queue de poisson pour nager !', en: 'An octopus: 8 tentacles and a fish tail to swim!' }, reqs: [{ k: 'legs', n: 8 }, { k: 'legStyle', is: 'tentacle' }, { k: 'tail', is: 'fish' }] },
  // Big kids (8-12): add up, compare, think.
  { id: 'limbs10', band: 'big', skill: 'addition', icon: '➕', text: { fr: 'Pattes + bras = 10 en tout !', en: 'Legs + arms = 10 in all!' }, reqs: [{ k: 'limbs', n: 10 }] },
  { id: 'sum12', band: 'big', skill: 'addition', icon: '🧮', text: { fr: 'Pattes + bras + yeux = 12 en tout !', en: 'Legs + arms + eyes = 12 in all!' }, reqs: [{ k: 'sumAll', n: 12 }] },
  { id: 'eyesLegs', band: 'big', skill: 'logic', icon: '⚖️', text: { fr: 'Autant d’yeux que de pattes !', en: 'As many eyes as legs!' }, reqs: [{ k: 'eyesEqLegs' }] },
  { id: 'odd5', band: 'big', skill: 'logic', icon: '🔢', text: { fr: 'Un nombre impair de pattes, 5 yeux et des ailes de papillon !', en: 'An odd number of legs, 5 eyes and butterfly wings!' }, reqs: [{ k: 'oddLegs' }, { k: 'eyes', n: 5 }, { k: 'wingsIs', is: 'butterfly' }] },
  { id: 'limbs7', band: 'big', skill: 'addition', icon: '➕', text: { fr: '7 pattes et bras en tout, et une queue de dragon !', en: '7 legs and arms in all, and a dragon tail!' }, reqs: [{ k: 'limbs', n: 7 }, { k: 'tail', is: 'dragon' }] },
];

export function reqMet(r: Req, c: Creature): boolean {
  switch (r.k) {
    case 'legs':
      return c.legs === r.n;
    case 'arms':
      return c.arms === r.n;
    case 'eyes':
      return c.eyes === r.n;
    case 'wings':
      return c.wings !== 'none' && c.wings !== 'tiny';
    case 'wingsIs':
      return c.wings === r.is;
    case 'tail':
      return c.tail === r.is;
    case 'top':
      return c.top === r.is;
    case 'hat':
      return c.hat !== 'none';
    case 'hatIs':
      return c.hat === r.is;
    case 'mouth':
      return c.mouth === r.is;
    case 'pattern':
      return c.pattern === r.is;
    case 'color':
      return c.color === r.is;
    case 'legStyle':
      return c.legStyle === r.is && c.legs > 0;
    case 'limbs':
      return c.legs + c.arms === r.n;
    case 'sumAll':
      return c.legs + c.arms + c.eyes === r.n;
    case 'eyesEqLegs':
      return c.eyes === c.legs;
    case 'oddLegs':
      return c.legs % 2 === 1;
  }
}

export function checkChallenge(ch: Challenge, c: Creature): { ok: boolean; met: boolean[] } {
  const met = ch.reqs.map((r) => reqMet(r, c));
  return { ok: met.every(Boolean), met };
}

/** Can a creature be built for this challenge at all? (Tested for every challenge.) */
export function solveChallenge(ch: Challenge): Creature | null {
  // Brute force over the counted parts, the named parts set straight from the requirements.
  let base: Creature = { ...STARTER };
  for (const r of ch.reqs) {
    if (r.k === 'wings') base = { ...base, wings: 'bird' };
    if (r.k === 'wingsIs') base = { ...base, wings: r.is };
    if (r.k === 'tail') base = { ...base, tail: r.is };
    if (r.k === 'top') base = { ...base, top: r.is };
    if (r.k === 'hat') base = { ...base, hat: 'top' };
    if (r.k === 'hatIs') base = { ...base, hat: r.is };
    if (r.k === 'mouth') base = { ...base, mouth: r.is };
    if (r.k === 'pattern') base = { ...base, pattern: r.is };
    if (r.k === 'color') base = { ...base, color: r.is };
    if (r.k === 'legStyle') base = { ...base, legStyle: r.is };
  }
  for (const legs of LEG_COUNTS)
    for (const arms of ARM_COUNTS)
      for (const eyes of EYE_COUNTS) {
        const c = { ...base, legs, arms, eyes };
        if (checkChallenge(ch, c).ok) return c;
      }
  return null;
}

/** Little pictures for each requirement (the challenge card, for those who can't read yet). */
export function reqChip(r: Req, c: Creature): { icon: string; n?: string; have?: string } {
  switch (r.k) {
    case 'legs':
      return { icon: '🦵', n: String(r.n), have: String(c.legs) };
    case 'arms':
      return { icon: '💪', n: String(r.n), have: String(c.arms) };
    case 'eyes':
      return { icon: '👁️', n: String(r.n), have: String(c.eyes) };
    case 'wings':
      return { icon: '🪶' };
    case 'wingsIs':
      return { icon: OPTIONS.wings.find((o) => o.key === `wings:${r.is}`)!.icon };
    case 'tail':
      return { icon: OPTIONS.tail.find((o) => o.key === `tail:${r.is}`)!.icon };
    case 'top':
      return { icon: OPTIONS.top.find((o) => o.key === `top:${r.is}`)!.icon };
    case 'hat':
      return { icon: '🎩' };
    case 'hatIs':
      return { icon: OPTIONS.hat.find((o) => o.key === `hat:${r.is}`)!.icon };
    case 'mouth':
      return { icon: OPTIONS.mouth.find((o) => o.key === `mouth:${r.is}`)!.icon };
    case 'pattern':
      return { icon: r.is === 'dots' ? '⚬' : r.is === 'stripes' ? '〰️' : r.is === 'stars' ? '⭐' : '◯' };
    case 'color':
      return { icon: '●' };
    case 'legStyle':
      return { icon: OPTIONS.legs.find((o) => o.key === `legStyle:${r.is}`)!.icon };
    case 'limbs':
      return { icon: '🦵+💪', n: `= ${r.n}` };
    case 'sumAll':
      return { icon: '🦵+💪+👁️', n: `= ${r.n}` };
    case 'eyesEqLegs':
      return { icon: '👁️ = 🦵' };
    case 'oddLegs':
      return { icon: '🦵', n: '1·3·5·7' };
  }
}

/** The category to open to fix a requirement (the hint button jumps there). */
export function reqCategory(r: Req): CategoryId {
  switch (r.k) {
    case 'legs':
    case 'legStyle':
    case 'oddLegs':
    case 'limbs':
    case 'sumAll':
    case 'eyesEqLegs':
      return 'legs';
    case 'arms':
      return 'arms';
    case 'eyes':
      return 'eyes';
    case 'wings':
    case 'wingsIs':
      return 'wings';
    case 'tail':
      return 'tail';
    case 'top':
      return 'top';
    case 'hat':
    case 'hatIs':
      return 'hat';
    case 'mouth':
      return 'mouth';
    case 'pattern':
      return 'pattern';
    case 'color':
      return 'color';
  }
}

const num = (n: number, one: L, many: L, locale: string) => `${n} ${n === 1 ? (locale === 'fr' ? one.fr : one.en) : locale === 'fr' ? many.fr : many.en}`;
const LEG: [L, L] = [
  { fr: 'patte', en: 'leg' },
  { fr: 'pattes', en: 'legs' },
];
const ARM: [L, L] = [
  { fr: 'bras', en: 'arm' },
  { fr: 'bras', en: 'arms' },
];
const EYE: [L, L] = [
  { fr: 'œil', en: 'eye' },
  { fr: 'yeux', en: 'eyes' },
];

/** A kind hint for the first thing still missing (never "wrong", always "almost!"). */
export function hintFor(ch: Challenge, c: Creature, locale: string): string {
  const fr = locale === 'fr';
  const i = checkChallenge(ch, c).met.indexOf(false);
  if (i < 0) return fr ? 'Bravo, c’est exactement ça !' : 'Well done, that’s exactly it!';
  const r = ch.reqs[i];
  const label = (cat: CategoryId, key: string) => {
    const o = OPTIONS[cat].find((x) => x.key === key);
    return o ? (fr ? o.label.fr : o.label.en).toLowerCase() : '';
  };
  switch (r.k) {
    case 'legs':
      return fr
        ? `Presque ! Compte ses pattes : elle en a ${c.legs}. Il en faut ${r.n}.`
        : `Almost! Count its legs: it has ${c.legs}. It needs ${r.n}.`;
    case 'arms':
      return fr ? `Presque ! Compte ses bras : elle en a ${c.arms}. Il en faut ${r.n}.` : `Almost! Count its arms: it has ${c.arms}. It needs ${r.n}.`;
    case 'eyes':
      return fr ? `Presque ! Compte ses yeux : elle en a ${c.eyes}. Il en faut ${r.n}.` : `Almost! Count its eyes: it has ${c.eyes}. It needs ${r.n}.`;
    case 'wings':
      return fr ? 'Pour voler, il lui faut de vraies ailes : regarde dans les ailes !' : 'To fly, it needs real wings: look in the wings!';
    case 'wingsIs':
      return fr ? `Il faut des ailes « ${label('wings', `wings:${r.is}`)} ».` : `It needs “${label('wings', `wings:${r.is}`)}” wings.`;
    case 'tail':
      return r.is === 'fish'
        ? fr
          ? 'Pour nager, il faut une queue de poisson, avec une nageoire !'
          : 'To swim, it needs a fish tail, with a fin!'
        : fr
          ? `Il manque la bonne queue : « ${label('tail', `tail:${r.is}`)} ».`
          : `The tail isn’t the right one yet: “${label('tail', `tail:${r.is}`)}”.`;
    case 'top':
      return fr ? `Regarde sur sa tête : il faut « ${label('top', `top:${r.is}`)} ».` : `Look on its head: it needs “${label('top', `top:${r.is}`)}”.`;
    case 'hat':
      return fr ? 'Il lui manque un chapeau !' : 'It still needs a hat!';
    case 'hatIs':
      return fr ? `Il faut le chapeau « ${label('hat', `hat:${r.is}`)} ».` : `It needs the “${label('hat', `hat:${r.is}`)}” hat.`;
    case 'mouth':
      return fr ? `Regarde sa bouche : il faut « ${label('mouth', `mouth:${r.is}`)} ».` : `Look at its mouth: it needs “${label('mouth', `mouth:${r.is}`)}”.`;
    case 'pattern':
      return fr ? `Il faut le motif « ${label('pattern', `pattern:${r.is}`)} ».` : `It needs the “${label('pattern', `pattern:${r.is}`)}” pattern.`;
    case 'color':
      return fr ? `Il faut une créature ${FEMININE[r.is]} !` : `It needs to be ${COLORS[r.is].label.en}!`;
    case 'legStyle':
      return fr ? `Il faut des pattes « ${label('legs', `legStyle:${r.is}`)} ».` : `It needs “${label('legs', `legStyle:${r.is}`)}” legs.`;
    case 'limbs':
      return fr
        ? `Compte : ${num(c.legs, LEG[0], LEG[1], locale)} + ${num(c.arms, ARM[0], ARM[1], locale)} = ${c.legs + c.arms}. Il en faut ${r.n} en tout.`
        : `Count: ${num(c.legs, LEG[0], LEG[1], locale)} + ${num(c.arms, ARM[0], ARM[1], locale)} = ${c.legs + c.arms}. It needs ${r.n} in all.`;
    case 'sumAll':
      return fr
        ? `Compte : ${c.legs} + ${c.arms} + ${c.eyes} = ${c.legs + c.arms + c.eyes}. Il en faut ${r.n} en tout.`
        : `Count: ${c.legs} + ${c.arms} + ${c.eyes} = ${c.legs + c.arms + c.eyes}. It needs ${r.n} in all.`;
    case 'eyesEqLegs':
      return fr
        ? `Elle a ${num(c.eyes, EYE[0], EYE[1], locale)} et ${num(c.legs, LEG[0], LEG[1], locale)} : il faut le même nombre.`
        : `It has ${num(c.eyes, EYE[0], EYE[1], locale)} and ${num(c.legs, LEG[0], LEG[1], locale)}: they must be the same number.`;
    case 'oddLegs':
      return fr ? `${c.legs} est un nombre pair. Essaie 1, 3, 5 ou 7 pattes !` : `${c.legs} is an even number. Try 1, 3, 5 or 7 legs!`;
  }
}

/** The challenges for an age (and a bit above when the child is doing great). */
export function challengesFor(band: Band, level = 1): Challenge[] {
  const order: Band[] = ['little', 'middle', 'big'];
  const i = order.indexOf(band);
  const ok = new Set<Band>([band]);
  if (i > 0) ok.add(order[i - 1]);
  if (level >= 4 && i < 2) ok.add(order[i + 1]);
  return CHALLENGES.filter((c) => ok.has(c.band)).sort((a, b) => (a.band === band ? 0 : 1) - (b.band === band ? 0 : 1));
}

/** Next challenge to offer: one not done yet in this visit, right for the age. */
export function nextChallenge(band: Band, level: number, done: readonly string[], seed: number): Challenge {
  const list = challengesFor(band, level);
  const fresh = list.filter((c) => !done.includes(c.id));
  const own = fresh.filter((c) => c.band === band);
  const pool = own.length ? own : fresh.length ? fresh : list;
  return pool[Math.floor(rng(seed)() * pool.length) % pool.length];
}

/* ───────────────────────── The album (« La Parade ») ───────────────────────── */

export const ALBUM_MAX = 60;
export const ALBUM_KEY = 'ziggy:creatures:v1';
const THUMB_MAX = 60_000;

export interface Saved extends Creature {
  savedAt: number;
  thumb?: string;
}

export function newId(seed: number): string {
  return `c${Math.floor(seed).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Newest first; the oldest ones leave room when the album is full. */
export function addToAlbum(album: Saved[], c: Creature, at: number, thumb?: string): Saved[] {
  const id = c.id || newId(at);
  const entry: Saved = { ...c, id, savedAt: at, ...(thumb && thumb.length <= THUMB_MAX && thumb.startsWith('data:image/') ? { thumb } : {}) };
  return [entry, ...album.filter((s) => s.id !== id)].slice(0, ALBUM_MAX);
}

export function removeFromAlbum(album: Saved[], id: string): Saved[] {
  return album.filter((s) => s.id !== id);
}

export function renameInAlbum(album: Saved[], id: string, name: string): Saved[] {
  const n = cleanName(name);
  if (!n) return album;
  return album.map((s) => (s.id === id ? { ...s, name: n } : s));
}

/** Read the album back: anything broken is dropped, never a crash. */
export function parseAlbum(raw: string | null | undefined): Saved[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: Saved[] = [];
  const seen = new Set<string>();
  for (const x of data) {
    const c = sanitize(x);
    if (!c || !c.id || seen.has(c.id)) continue;
    seen.add(c.id);
    const o = x as Record<string, unknown>;
    const thumb = typeof o.thumb === 'string' && o.thumb.startsWith('data:image/') && o.thumb.length <= THUMB_MAX ? o.thumb : undefined;
    out.push({ ...c, savedAt: typeof o.savedAt === 'number' && Number.isFinite(o.savedAt) ? o.savedAt : 0, ...(thumb ? { thumb } : {}) });
    if (out.length >= ALBUM_MAX) break;
  }
  return out;
}

/* ───────────────────────── Ziggy’s words ───────────────────────── */

export const LINES = {
  hello: [
    { fr: 'Bienvenue dans mon usine à créatures ! Choisis des pièces… ou tire le levier Surprise !', en: 'Welcome to my creature factory! Pick some parts… or pull the Surprise lever!' },
  ],
  surprise: [
    { fr: 'Waouh ! Regarde ce qui sort de la machine !', en: 'Wow! Look what came out of the machine!' },
    { fr: 'Hi hi ! Elle est trop rigolote !', en: 'Hee hee! It’s so funny!' },
    { fr: 'Tadaa ! Une nouvelle créature !', en: 'Ta-da! A brand new creature!' },
    { fr: 'Ha ha ! Je n’en ai jamais vu une comme ça !', en: 'Ha ha! I’ve never seen one like that!' },
  ],
  alive: [
    { fr: 'Elle est vivante ! Waouh !', en: 'It’s alive! Wow!' },
    { fr: 'Coucou, petite créature !', en: 'Hello, little creature!' },
  ],
  walk: [{ fr: 'Elle marche !', en: 'It walks!' }],
  pogo: [{ fr: 'Elle saute sur sa patte, boing boing !', en: 'It hops on its leg, boing boing!' }],
  bounce: [{ fr: 'Pas de pattes ? Elle rebondit !', en: 'No legs? It bounces!' }],
  fly: [{ fr: 'Elle vole !', en: 'It flies!' }],
  flutter: [{ fr: 'Ses petites ailes battent très vite… presque !', en: 'Its tiny wings flap so fast… almost!' }],
  swim: [{ fr: 'Elle nage comme un poisson !', en: 'It swims like a fish!' }],
  sneeze: [
    { fr: 'À tes souhaits !', en: 'Bless you!' },
    { fr: 'Atchoum ! Ha ha, à tes souhaits !', en: 'Achoo! Ha ha, bless you!' },
  ],
  dance: [
    { fr: 'On danse ensemble !', en: 'Let’s dance together!' },
    { fr: 'Elle danse trop bien !', en: 'It dances so well!' },
  ],
  saved: [{ fr: 'rejoint la Parade !', en: 'joins the Parade!' }],
  already: [{ fr: 'Elle est déjà dans la Parade !', en: 'It’s already in the Parade!' }],
  tickle: [
    { fr: 'Hi hi, ça chatouille !', en: 'Hee hee, that tickles!' },
    { fr: 'Elle te dit bonjour !', en: 'It says hello!' },
  ],
  parade: [{ fr: 'Place à la Parade de toutes tes créatures !', en: 'Here comes the Parade of all your creatures!' }],
  challengeWin: [
    { fr: 'Bravo ! C’est exactement la créature demandée !', en: 'Well done! That’s exactly the creature I asked for!' },
    { fr: 'Génial, défi réussi ! Elle est parfaite !', en: 'Brilliant, challenge done! It’s perfect!' },
  ],
} satisfies Record<string, L[]>;

export function line(kind: keyof typeof LINES, i: number): L {
  const list = LINES[kind] as L[];
  return list[((i % list.length) + list.length) % list.length];
}

/** "It walks, it flies AND it swims!" — what the creature can do, for the alive show. */
export function canDoText(c: Creature, locale: string): string {
  const fr = locale === 'fr';
  const a = abilities(c);
  const parts: string[] = [];
  if (a.walk) parts.push(fr ? (c.legs === 1 ? 'elle saute' : 'elle marche') : c.legs === 1 ? 'it hops' : 'it walks');
  if (a.fly) parts.push(fr ? 'elle vole' : 'it flies');
  if (a.swim) parts.push(fr ? 'elle nage' : 'it swims');
  if (!parts.length) parts.push(fr ? 'elle rebondit' : 'it bounces');
  const last = parts.pop()!;
  const s = parts.length ? `${parts.join(', ')} ${fr ? 'et' : 'and'} ${last}` : last;
  return `${s.charAt(0).toUpperCase()}${s.slice(1)} !`.replace(' !', fr ? ' !' : '!');
}

/** A short description to read aloud in the album ("3 eyes, 6 legs, wings"). */
export function describe(c: Creature, locale: string): string {
  const fr = locale === 'fr';
  const bits = [num(c.eyes, EYE[0], EYE[1], locale), num(c.legs, LEG[0], LEG[1], locale)];
  if (c.arms) bits.push(num(c.arms, ARM[0], ARM[1], locale));
  if (c.wings !== 'none') bits.push(fr ? 'des ailes' : 'wings');
  if (c.tail !== 'none') bits.push(fr ? 'une queue' : 'a tail');
  return bits.join(', ');
}
