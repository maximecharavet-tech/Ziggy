/**
 * Le Facteur des Planètes — pure logic (no three.js, no DOM).
 *
 * Ziggy, postman of space, delivers parcels to the (imaginary) inhabitants of
 * the solar system. Every delivery is a riddle whose answer is a planet (or
 * the Moon). Everything said here is true and checked against NASA figures;
 * the inhabitants are make-believe, and the end screen says so.
 *
 * Child-safety rules, enforced here:
 *  - No failure: a wrong planet is "not the right address", a gentle hint and
 *    a new try; after two tries the right planet shines.
 *  - No timer, no score loss, nobody is ever sad.
 */
import type { L } from '@/lib/i18n-text';
import { tr } from '@/lib/i18n-text';
import { rng } from '../kit/rng';

export type Band = 'little' | 'middle' | 'big';
export type PlanetesSkill = 'astronomy' | 'science' | 'counting';
export const SKILLS: PlanetesSkill[] = ['astronomy', 'science', 'counting'];

/** Deliveries in one game. */
export const DELIVERIES = 5;
/** After this many wrong addresses, the right planet shines. */
export const REVEAL_AFTER = 2;

export const BODIES = ['mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'] as const;
export type BodyId = (typeof BODIES)[number];
/** The eight planets, from the Sun outwards. */
export const PLANETS: BodyId[] = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

export type GiftId = 'sunglasses' | 'fan' | 'plant' | 'ball' | 'bucket' | 'pizza' | 'hoop' | 'pillow' | 'hat' | 'sock';

export interface BodyInfo {
  /** On a button: "Terre", "Lune". */
  label: L;
  /** In a sentence: "la Terre", "Mars" / "Earth", "the Moon". */
  the: L;
  /** 1..8 from the Sun; the Moon goes with the Earth (null). */
  order: number | null;
  /** Mean diameter, km (NASA). */
  diameterKm: number;
  /** Time to go once around the Sun, in Earth days (the Moon: around the Earth). */
  yearDays: number;
  kind: 'rocky' | 'gas' | 'ice' | 'moon';
  /** A short, true description used in hints and "wrong address" lines. */
  look: L;
  /** Main colour (HUD). */
  color: string;
  /** The (imaginary) inhabitant who gets the parcel. */
  alien: string;
  gift: GiftId;
  /** True facts, said after the delivery (by age). */
  facts: Record<Band, L[]>;
}

export const BODY: Record<BodyId, BodyInfo> = {
  mercury: {
    label: { fr: 'Mercure', en: 'Mercury' },
    the: { fr: 'Mercure', en: 'Mercury' },
    order: 1,
    diameterKm: 4879,
    yearDays: 88,
    kind: 'rocky',
    look: { fr: 'la petite planète grise, tout près du Soleil', en: 'the little grey planet, right next to the Sun' },
    color: '#a8a29c',
    alien: 'Zip',
    gift: 'sunglasses',
    facts: {
      little: [{ fr: 'Mercure est tout près du Soleil : le jour, il y fait très, très chaud !', en: 'Mercury is right next to the Sun: in the daytime it is very, very hot!' }],
      middle: [
        { fr: 'Mercure est la planète la plus proche du Soleil, et la plus petite des huit.', en: 'Mercury is the planet closest to the Sun, and the smallest of the eight.' },
        { fr: 'Mercure n’a presque pas d’air : le jour il fait brûlant, la nuit il fait glacé.', en: 'Mercury has almost no air: the days are scorching and the nights are freezing.' },
      ],
      big: [
        { fr: 'Mercure fait le tour du Soleil en seulement 88 jours : c’est la plus rapide !', en: 'Mercury goes around the Sun in just 88 days: it is the fastest planet!' },
        { fr: 'Sans air pour garder la chaleur, Mercure passe d’environ 430 °C le jour à −180 °C la nuit.', en: 'With no air to keep the heat, Mercury goes from about 430 °C by day to −180 °C at night.' },
      ],
    },
  },
  venus: {
    label: { fr: 'Vénus', en: 'Venus' },
    the: { fr: 'Vénus', en: 'Venus' },
    order: 2,
    diameterKm: 12104,
    yearDays: 225,
    kind: 'rocky',
    look: { fr: 'la planète cachée sous des nuages jaunes', en: 'the planet hidden under yellow clouds' },
    color: '#e8c77d',
    alien: 'Vava',
    gift: 'fan',
    facts: {
      little: [{ fr: 'Vénus est cachée sous des nuages jaunes. C’est la planète la plus chaude !', en: 'Venus hides under yellow clouds. It is the hottest planet!' }],
      middle: [
        { fr: 'Vénus est la planète la plus chaude : ses épais nuages gardent la chaleur, comme une couverture.', en: 'Venus is the hottest planet: its thick clouds keep the heat in, like a blanket.' },
        { fr: 'Vénus brille très fort dans le ciel du soir : on l’appelle l’étoile du Berger, mais c’est une planète !', en: 'Venus shines very brightly in the evening sky: people call it the evening star, but it is a planet!' },
      ],
      big: [
        { fr: 'Vénus tourne si lentement qu’un tour sur elle-même dure plus longtemps qu’un tour du Soleil !', en: 'Venus spins so slowly that one turn on itself takes longer than one trip around the Sun!' },
        { fr: 'Vénus est plus chaude que Mercure, alors qu’elle est plus loin du Soleil : environ 465 °C !', en: 'Venus is hotter than Mercury even though it is farther from the Sun: about 465 °C!' },
      ],
    },
  },
  earth: {
    label: { fr: 'Terre', en: 'Earth' },
    the: { fr: 'la Terre', en: 'Earth' },
    order: 3,
    diameterKm: 12742,
    yearDays: 365,
    kind: 'rocky',
    look: { fr: 'notre planète bleue et verte', en: 'our blue and green planet' },
    color: '#3b8fe0',
    alien: 'Momo',
    gift: 'plant',
    facts: {
      little: [
        { fr: 'La Terre tourne sur elle-même : quand c’est le jour d’un côté, c’est la nuit de l’autre !', en: 'The Earth spins: when it is daytime on one side, it is night on the other!' },
        { fr: 'La Terre, c’est notre maison : il y a de l’eau, de l’air et plein de vie !', en: 'The Earth is our home: there is water, air and lots of life!' },
      ],
      middle: [
        { fr: 'La Terre est la seule planète où l’on connaît la vie. Les océans couvrent presque toute sa surface.', en: 'Earth is the only planet where we know there is life. Oceans cover most of it.' },
        { fr: 'La Terre fait un tour sur elle-même en un jour, et le tour du Soleil en un an.', en: 'The Earth spins once a day, and goes around the Sun once a year.' },
      ],
      big: [
        { fr: 'La Terre fait le tour du Soleil en 365 jours et 6 heures : c’est pour ça qu’il y a des années bissextiles !', en: 'The Earth goes around the Sun in 365 days and 6 hours: that is why we have leap years!' },
        { fr: 'La Terre est la seule planète à n’avoir qu’une seule lune.', en: 'Earth is the only planet with exactly one moon.' },
      ],
    },
  },
  moon: {
    label: { fr: 'Lune', en: 'Moon' },
    the: { fr: 'la Lune', en: 'the Moon' },
    order: null,
    diameterKm: 3474,
    yearDays: 27,
    kind: 'moon',
    look: { fr: 'la petite boule grise qui tourne autour de la Terre', en: 'the little grey ball that goes around the Earth' },
    color: '#cfcfd4',
    alien: 'Pompon',
    gift: 'ball',
    facts: {
      little: [{ fr: 'La Lune tourne autour de la Terre. Là-bas, on est tout léger : on saute très haut !', en: 'The Moon goes around the Earth. Up there you are very light: you can jump really high!' }],
      middle: [
        { fr: 'Sur la Lune, on saute environ 6 fois plus haut que sur Terre !', en: 'On the Moon you can jump about 6 times higher than on Earth!' },
        { fr: 'La Lune ne fait pas de lumière : elle brille parce que le Soleil l’éclaire.', en: 'The Moon makes no light of its own: it shines because the Sun lights it up.' },
      ],
      big: [
        { fr: 'Des astronautes ont marché sur la Lune pour la première fois en 1969.', en: 'Astronauts first walked on the Moon in 1969.' },
        { fr: 'La Lune fait le tour de la Terre en environ 27 jours, et nous montre toujours la même face.', en: 'The Moon goes around the Earth in about 27 days, and always shows us the same side.' },
      ],
    },
  },
  mars: {
    label: { fr: 'Mars', en: 'Mars' },
    the: { fr: 'Mars', en: 'Mars' },
    order: 4,
    diameterKm: 6779,
    yearDays: 687,
    kind: 'rocky',
    look: { fr: 'la planète rouge', en: 'the red planet' },
    color: '#d2693c',
    alien: 'Rubi',
    gift: 'bucket',
    facts: {
      little: [{ fr: 'Mars est rouge parce que son sol est couvert de poussière de rouille !', en: 'Mars is red because its ground is covered in rusty dust!' }],
      middle: [
        { fr: 'Mars est la planète rouge : sa poussière contient de la rouille.', en: 'Mars is the red planet: its dust has rust in it.' },
        { fr: 'Des robots roulent sur Mars pour l’explorer et prendre des photos.', en: 'Robot rovers drive on Mars to explore it and take pictures.' },
      ],
      big: [
        { fr: 'Sur Mars se trouve le plus grand volcan du système solaire : Olympus Mons, environ deux fois et demie plus haut que l’Everest.', en: 'Mars has the biggest volcano in the solar system: Olympus Mons, about two and a half times as tall as Everest.' },
        { fr: 'Mars a deux petites lunes, Phobos et Déimos, et met 687 jours à faire le tour du Soleil.', en: 'Mars has two little moons, Phobos and Deimos, and takes 687 days to go around the Sun.' },
      ],
    },
  },
  jupiter: {
    label: { fr: 'Jupiter', en: 'Jupiter' },
    the: { fr: 'Jupiter', en: 'Jupiter' },
    order: 5,
    diameterKm: 139820,
    yearDays: 4333,
    kind: 'gas',
    look: { fr: 'la plus grosse planète, avec des rayures et une tache rouge', en: 'the biggest planet, with stripes and a red spot' },
    color: '#d9a56b',
    alien: 'Jojo',
    gift: 'pizza',
    facts: {
      little: [{ fr: 'Jupiter est la plus grosse planète : elle a des rayures et une grande tache rouge !', en: 'Jupiter is the biggest planet: it has stripes and a big red spot!' }],
      middle: [
        { fr: 'Jupiter est si grande que plus de mille Terres pourraient tenir dedans !', en: 'Jupiter is so big that more than a thousand Earths could fit inside!' },
        { fr: 'Jupiter n’a pas de sol : c’est une énorme boule de gaz.', en: 'Jupiter has no ground: it is a huge ball of gas.' },
      ],
      big: [
        { fr: 'La grande tache rouge de Jupiter est une tempête plus grande que la Terre, qui souffle depuis plus de 150 ans.', en: 'Jupiter’s Great Red Spot is a storm bigger than the Earth, blowing for more than 150 years.' },
        { fr: 'Jupiter met environ 12 ans à faire le tour du Soleil.', en: 'Jupiter takes about 12 years to go around the Sun.' },
      ],
    },
  },
  saturn: {
    label: { fr: 'Saturne', en: 'Saturn' },
    the: { fr: 'Saturne', en: 'Saturn' },
    order: 6,
    diameterKm: 116460,
    yearDays: 10759,
    kind: 'gas',
    look: { fr: 'la planète aux grands anneaux', en: 'the planet with big rings' },
    color: '#e3c88a',
    alien: 'Sato',
    gift: 'hoop',
    facts: {
      little: [{ fr: 'Saturne a de grands anneaux faits de morceaux de glace !', en: 'Saturn has big rings made of pieces of ice!' }],
      middle: [
        { fr: 'Les anneaux de Saturne sont faits de milliards de morceaux de glace et de roche.', en: 'Saturn’s rings are made of billions of pieces of ice and rock.' },
        { fr: 'Saturne est si légère qu’elle pourrait flotter dans une baignoire géante !', en: 'Saturn is so light that it could float in a giant bathtub!' },
      ],
      big: [
        { fr: 'Saturne est moins dense que l’eau : dans une baignoire assez grande, elle flotterait !', en: 'Saturn is less dense than water: in a big enough bathtub, it would float!' },
        { fr: 'Saturne met environ 29 ans à faire le tour du Soleil.', en: 'Saturn takes about 29 years to go around the Sun.' },
      ],
    },
  },
  uranus: {
    label: { fr: 'Uranus', en: 'Uranus' },
    the: { fr: 'Uranus', en: 'Uranus' },
    order: 7,
    diameterKm: 50724,
    yearDays: 30687,
    kind: 'ice',
    look: { fr: 'la planète bleu-vert couchée sur le côté', en: 'the blue-green planet lying on its side' },
    color: '#8ad6dd',
    alien: 'Roulou',
    gift: 'pillow',
    facts: {
      little: [{ fr: 'Uranus est couchée sur le côté : elle roule autour du Soleil comme une bille !', en: 'Uranus lies on its side: it rolls around the Sun like a marble!' }],
      middle: [
        { fr: 'Uranus est couchée sur le côté : elle roule autour du Soleil comme une bille.', en: 'Uranus lies on its side: it rolls around the Sun like a marble.' },
        { fr: 'Uranus est une planète de gaz et de glace, toute froide.', en: 'Uranus is a cold planet made of gas and ice.' },
      ],
      big: [
        { fr: 'Uranus met 84 ans à faire le tour du Soleil, et elle tourne couchée sur le côté.', en: 'Uranus takes 84 years to go around the Sun, and it spins lying on its side.' },
        { fr: 'Uranus est la première planète découverte avec un télescope, en 1781.', en: 'Uranus was the first planet discovered with a telescope, in 1781.' },
      ],
    },
  },
  neptune: {
    label: { fr: 'Neptune', en: 'Neptune' },
    the: { fr: 'Neptune', en: 'Neptune' },
    order: 8,
    diameterKm: 49244,
    yearDays: 60190,
    kind: 'ice',
    look: { fr: 'la planète bleu foncé, la plus loin du Soleil', en: 'the deep blue planet, the farthest from the Sun' },
    color: '#3f63d9',
    alien: 'Plouf',
    gift: 'hat',
    facts: {
      little: [{ fr: 'Neptune est toute bleue et très loin du Soleil : il y fait très froid !', en: 'Neptune is all blue and very far from the Sun: it is very cold there!' }],
      middle: [
        { fr: 'Neptune est la planète la plus loin du Soleil. Il y fait très, très froid.', en: 'Neptune is the planet farthest from the Sun. It is very, very cold there.' },
        { fr: 'Sur Neptune soufflent les vents les plus forts du système solaire.', en: 'Neptune has the strongest winds in the solar system.' },
      ],
      big: [
        { fr: 'Neptune met environ 165 ans à faire le tour du Soleil !', en: 'Neptune takes about 165 years to go around the Sun!' },
        { fr: 'Sur Neptune, le vent souffle à plus de 2 000 km/h : bien plus vite qu’un avion !', en: 'On Neptune the wind blows at more than 2,000 km/h: much faster than a plane!' },
      ],
    },
  },
};

export const GIFT: Record<GiftId, { emoji: string; name: L; line: L }> = {
  sunglasses: { emoji: '🕶️', name: { fr: 'des lunettes de soleil', en: 'sunglasses' }, line: { fr: 'Des lunettes de soleil ! Parfait, le Soleil est tout près d’ici !', en: 'Sunglasses! Perfect, the Sun is so close here!' } },
  fan: { emoji: '🌀', name: { fr: 'un ventilateur', en: 'a fan' }, line: { fr: 'Un ventilateur ! Super, il fait si chaud sur Vénus !', en: 'A fan! Great, it is so hot on Venus!' } },
  plant: { emoji: '🪴', name: { fr: 'une plante', en: 'a plant' }, line: { fr: 'Une plante ! Je suis en vacances sur la Terre : ici, il y a de l’eau pour la faire pousser !', en: 'A plant! I’m on holiday on Earth: there is water here to help it grow!' } },
  ball: { emoji: '🏐', name: { fr: 'un ballon', en: 'a ball' }, line: { fr: 'Un ballon ! Sur la Lune, il va rebondir super haut !', en: 'A ball! On the Moon it will bounce super high!' } },
  bucket: { emoji: '🪣', name: { fr: 'un seau et une pelle', en: 'a bucket and spade' }, line: { fr: 'Un seau et une pelle ! Je vais faire des châteaux de sable rouge !', en: 'A bucket and spade! I’ll build red sandcastles!' } },
  pizza: { emoji: '🍕', name: { fr: 'une pizza géante', en: 'a giant pizza' }, line: { fr: 'Une pizza géante ! Pour la plus grande planète, il fallait la plus grande pizza !', en: 'A giant pizza! The biggest planet gets the biggest pizza!' } },
  hoop: { emoji: '⭕', name: { fr: 'un cerceau', en: 'a hoop' }, line: { fr: 'Un cerceau ! Comme les anneaux de ma planète !', en: 'A hoop! Just like my planet’s rings!' } },
  pillow: { emoji: '🛏️', name: { fr: 'un oreiller', en: 'a pillow' }, line: { fr: 'Un oreiller ! Pratique : ma planète est couchée sur le côté !', en: 'A pillow! Handy: my planet lies on its side!' } },
  hat: { emoji: '🧶', name: { fr: 'un bonnet tout chaud', en: 'a warm woolly hat' }, line: { fr: 'Un bonnet tout chaud ! Ici, il fait très froid et le vent souffle fort !', en: 'A warm woolly hat! It’s very cold and windy here!' } },
  sock: { emoji: '🧦', name: { fr: 'une chaussette géante', en: 'a giant sock' }, line: { fr: 'Une chaussette géante ?! Hihi… je vais la mettre sur ma tête !', en: 'A giant sock?! Hee hee… I’ll wear it on my head!' } },
};

/* ───────────────────────── Helpers ───────────────────────── */

const ORDINAL: Record<'fr' | 'en', string[]> = {
  fr: ['', 'première', 'deuxième', 'troisième', 'quatrième', 'cinquième', 'sixième', 'septième', 'huitième'],
  en: ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'],
};
const NUMBER: Record<'fr' | 'en', string[]> = {
  fr: ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'],
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
};
export const countWord = (n: number, locale: string) => NUMBER[locale === 'fr' ? 'fr' : 'en'][n] ?? String(n);

/** "la Terre" / "Earth" with a capital at the start of a sentence. */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const pick = <T>(arr: readonly T[], r: () => number): T => arr[Math.floor(r() * arr.length)];
const between = (lo: number, hi: number, r: () => number) => lo + Math.floor(r() * (hi - lo + 1));
const planetAt = (n: number): BodyId => PLANETS[n - 1];

/* ───────────────────────── Riddles ───────────────────────── */

export interface Riddle {
  /** Template id (never twice in one game). */
  id: string;
  skill: PlanetesSkill;
  text: L;
  /** Said after a wrong address. */
  hint: L;
  answer: BodyId;
  /** Shuffled, the answer included, no duplicates. */
  candidates: BodyId[];
  /** Small visual help for pre-readers (numbers, colour dots), never the answer itself. */
  visual?: string;
  /** Show the planets' numbers from the Sun as a hint (counting riddles). */
  numbers?: boolean;
}

export interface Delivery extends Riddle {
  /** Parcels to hand over (counted aloud). */
  parcels: number;
  gift: GiftId;
  /** This inhabitant sneezes stars. */
  sneeze: boolean;
}

interface Ctx {
  r: () => number;
  band: Band;
  level: number;
  /** Answers already used in this game. */
  used: Set<BodyId>;
}

interface Template {
  id: string;
  bands: Band[];
  skill: PlanetesSkill;
  minLevel?: number;
  /** Build the riddle, or null when it cannot (answer already used…). */
  make: (c: Ctx) => Omit<Riddle, 'id' | 'skill' | 'candidates'> & { tricky: BodyId[]; avoid?: BodyId[]; pool?: BodyId[] } | null;
  weight?: number;
}

const candidateCount = (band: Band) => (band === 'big' ? 4 : 3);

/** Answer + tricky distractors first, then random fill; never something in `avoid`. */
function buildCandidates(c: Ctx, answer: BodyId, tricky: BodyId[], avoid: BodyId[] = [], pool: BodyId[] = [...BODIES]): BodyId[] {
  const n = candidateCount(c.band);
  const out: BodyId[] = [answer];
  for (const t of shuffle(tricky, c.r)) if (out.length < n && !out.includes(t) && !avoid.includes(t)) out.push(t);
  for (const t of shuffle(pool, c.r)) if (out.length < n && !out.includes(t) && !avoid.includes(t)) out.push(t);
  return shuffle(out, c.r);
}

/** A fixed-answer riddle. */
function fixed(id: string, bands: Band[], skill: PlanetesSkill, answer: BodyId, text: L, hint: L, tricky: BodyId[], opts: { minLevel?: number; avoid?: BodyId[]; visual?: string; weight?: number; pool?: BodyId[] } = {}): Template {
  return {
    id,
    bands,
    skill,
    minLevel: opts.minLevel,
    weight: opts.weight,
    make: (c) => (c.used.has(answer) ? null : { answer, text, hint, tricky, avoid: opts.avoid, visual: opts.visual, pool: opts.pool }),
  };
}


export const TEMPLATES: Template[] = [
  /* ── Little ones: colours, shapes, the Sun is hot, counting from the Sun ── */
  fixed(
    'rings',
    ['little', 'middle'],
    'astronomy',
    'saturn',
    { fr: 'Ce colis va sur la planète qui a de grands anneaux !', en: 'This parcel goes to the planet with big rings!' },
    { fr: 'Cherche une planète avec un grand cerceau tout autour.', en: 'Look for a planet with a big hoop all around it.' },
    ['jupiter', 'earth', 'mars'],
    { avoid: ['uranus'] }
  ),
  fixed(
    'red',
    ['little', 'middle'],
    'astronomy',
    'mars',
    { fr: 'Ce colis va sur la planète toute rouge !', en: 'This parcel goes to the red planet!' },
    { fr: 'Cherche la petite planète rouge comme une tomate.', en: 'Look for the little planet as red as a tomato.' },
    ['venus', 'earth', 'jupiter'],
    { visual: '🔴' }
  ),
  fixed(
    'home',
    ['little'],
    'astronomy',
    'earth',
    { fr: 'Ce colis va sur la planète bleue et verte : notre maison !', en: 'This parcel goes to the blue and green planet: our home!' },
    { fr: 'Cherche la planète avec de l’eau bleue, des terres vertes et des nuages blancs.', en: 'Look for the planet with blue water, green land and white clouds.' },
    ['mars', 'jupiter', 'venus'],
    { visual: '🔵🟢', avoid: ['neptune', 'uranus'] }
  ),
  fixed(
    'moon-little',
    ['little'],
    'astronomy',
    'moon',
    { fr: 'Ce colis va sur la petite boule grise qui tourne autour de la Terre !', en: 'This parcel goes to the little grey ball that goes around the Earth!' },
    { fr: 'Regarde tout près de la Terre : une petite boule grise lui tourne autour.', en: 'Look right next to the Earth: a little grey ball goes around it.' },
    ['mars', 'jupiter', 'venus'],
    { avoid: ['mercury'], weight: 1.4 }
  ),
  fixed(
    'biggest-little',
    ['little'],
    'astronomy',
    'jupiter',
    { fr: 'Ce colis va sur la plus grosse planète, celle avec des rayures !', en: 'This parcel goes to the biggest planet, the one with stripes!' },
    { fr: 'Cherche la planète la plus grosse de toutes, avec une tache rouge.', en: 'Look for the biggest planet of all, with a red spot.' },
    ['mercury', 'mars', 'earth']
  ),
  fixed(
    'blue',
    ['little'],
    'astronomy',
    'neptune',
    { fr: 'Ce colis va sur la planète toute bleue, tout au bout, très loin du Soleil !', en: 'This parcel goes to the all-blue planet, at the very end, far from the Sun!' },
    { fr: 'Va tout au bout, le plus loin possible du Soleil : la planète bleu foncé.', en: 'Go to the very end, as far as you can from the Sun: the deep blue planet.' },
    ['mars', 'venus', 'jupiter'],
    { visual: '🔵', avoid: ['earth', 'uranus'] }
  ),
  fixed(
    'near-hot',
    ['little'],
    'science',
    'mercury',
    { fr: 'Ce colis va sur la planète la plus près du Soleil. Attention, là-bas il fait très chaud !', en: 'This parcel goes to the planet closest to the Sun. Careful, it’s very hot there!' },
    { fr: 'Le Soleil est très chaud ! Cherche la planète juste à côté de lui.', en: 'The Sun is very hot! Look for the planet right next to it.' },
    ['neptune', 'jupiter', 'saturn'],
    { visual: '☀️🔥' }
  ),
  {
    id: 'count',
    bands: ['little'],
    skill: 'counting',
    make: (c) => {
      const max = c.level >= 2 ? 4 : 3;
      const options = [1, 2, 3, 4].filter((n) => n <= max && !c.used.has(planetAt(n)));
      if (!options.length) return null;
      const n = pick(options, c.r);
      const answer = planetAt(n);
      const tricky = [n - 1, n + 1, n + 2].filter((k) => k >= 1 && k <= 5).map(planetAt);
      return {
        answer,
        text: {
          fr: `Compte les planètes en partant du Soleil : le colis va sur la planète numéro ${n} !`,
          en: `Count the planets starting from the Sun: the parcel goes to planet number ${n}!`,
        },
        hint: {
          fr: `Mets ton doigt sur le Soleil, puis compte les planètes : ${Array.from({ length: n }, (_, i) => countWord(i + 1, 'fr')).join(', ')} !`,
          en: `Put your finger on the Sun, then count the planets: ${Array.from({ length: n }, (_, i) => countWord(i + 1, 'en')).join(', ')}!`,
        },
        tricky,
        avoid: ['moon'],
        visual: `☀️ ➜ ${Array.from({ length: n }, (_, i) => String(i + 1)).join(' ')}`,
        numbers: true,
      };
    },
  },

  /* ── Middle: order from the Sun, the biggest, the hottest, the red planet, the Moon ── */
  {
    id: 'order',
    bands: ['middle'],
    skill: 'counting',
    make: (c) => {
      const max = c.level >= 2 ? 8 : 4;
      const options = PLANETS.map((_, i) => i + 1).filter((n) => n <= max && !c.used.has(planetAt(n)));
      if (!options.length) return null;
      const n = pick(options, c.r);
      const answer = planetAt(n);
      const tricky = [n - 1, n + 1, n - 2, n + 2].filter((k) => k >= 1 && k <= 8).map(planetAt);
      return {
        answer,
        text: { fr: `Ce colis va sur la ${ORDINAL.fr[n]} planète en partant du Soleil.`, en: `This parcel goes to the ${ORDINAL.en[n]} planet from the Sun.` },
        hint: { fr: `Pars du Soleil et compte les planètes une par une, jusqu’à ${n}.`, en: `Start at the Sun and count the planets one by one, up to ${n}.` },
        tricky,
        avoid: ['moon'],
        numbers: true,
      };
    },
  },
  {
    id: 'neighbour',
    bands: ['middle', 'big'],
    skill: 'astronomy',
    minLevel: 2,
    make: (c) => {
      // "Just after X", "just before X", or "between X and Y".
      const kinds = shuffle(['after', 'before', 'between'] as const, c.r);
      for (const kind of kinds) {
        const n = kind === 'after' ? between(2, 8, c.r) : kind === 'before' ? between(1, 7, c.r) : between(2, 7, c.r);
        const answer = planetAt(n);
        if (c.used.has(answer)) continue;
        if (kind === 'after') {
          const x = BODY[planetAt(n - 1)].the;
          return {
            answer,
            text: { fr: `Ce colis va sur la planète juste après ${x.fr}, en s’éloignant du Soleil.`, en: `This parcel goes to the planet just after ${x.en}, going away from the Sun.` },
            hint: { fr: `Trouve ${x.fr}, puis va à la planète suivante, plus loin du Soleil.`, en: `Find ${x.en}, then go to the next planet, farther from the Sun.` },
            tricky: [planetAt(n - 1), ...(n > 2 ? [planetAt(n - 2)] : []), ...(n < 8 ? [planetAt(n + 1)] : [])],
            avoid: ['moon'],
            numbers: true,
          };
        }
        if (kind === 'before') {
          const x = BODY[planetAt(n + 1)].the;
          return {
            answer,
            text: { fr: `Ce colis va sur la planète juste avant ${x.fr}, en partant du Soleil.`, en: `This parcel goes to the planet just before ${x.en}, starting from the Sun.` },
            hint: { fr: `Trouve ${x.fr}, puis recule d’une planète vers le Soleil.`, en: `Find ${x.en}, then go back one planet towards the Sun.` },
            tricky: [planetAt(n + 1), ...(n < 7 ? [planetAt(n + 2)] : []), ...(n > 1 ? [planetAt(n - 1)] : [])],
            avoid: ['moon'],
            numbers: true,
          };
        }
        const a = BODY[planetAt(n - 1)].the;
        const b = BODY[planetAt(n + 1)].the;
        return {
          answer,
          text: { fr: `Ce colis va sur la planète qui se trouve entre ${a.fr} et ${b.fr}.`, en: `This parcel goes to the planet between ${a.en} and ${b.en}.` },
          hint: { fr: `Trouve ${a.fr} et ${b.fr} : la bonne planète est au milieu.`, en: `Find ${a.en} and ${b.en}: the right planet is in the middle.` },
          tricky: [planetAt(n - 1), planetAt(n + 1)],
          avoid: ['moon'],
          numbers: true,
        };
      }
      return null;
    },
  },
  fixed(
    'biggest',
    ['middle'],
    'astronomy',
    'jupiter',
    { fr: 'Ce colis va sur la plus grande planète du système solaire.', en: 'This parcel goes to the biggest planet in the solar system.' },
    { fr: 'Cherche la plus grosse : elle a des rayures et une grande tache rouge.', en: 'Look for the biggest one: it has stripes and a big red spot.' },
    ['saturn', 'neptune', 'uranus']
  ),
  fixed(
    'hottest',
    ['middle'],
    'science',
    'venus',
    { fr: 'Ce colis va sur la planète la plus chaude du système solaire.', en: 'This parcel goes to the hottest planet in the solar system.' },
    { fr: 'Ce n’est pas forcément la plus proche du Soleil ! Cherche celle qui a d’épais nuages jaunes qui gardent la chaleur.', en: 'It isn’t necessarily the closest to the Sun! Look for the one with thick yellow clouds that keep the heat in.' },
    ['mercury', 'mars']
  ),
  fixed(
    'red-middle',
    ['middle'],
    'astronomy',
    'mars',
    { fr: 'Ce colis va sur la planète rouge, la quatrième depuis le Soleil.', en: 'This parcel goes to the red planet, the fourth from the Sun.' },
    { fr: 'Elle est rouge à cause de la poussière de rouille, juste après la Terre.', en: 'It is red because of rusty dust, just after the Earth.' },
    ['jupiter', 'venus', 'mercury']
  ),
  fixed(
    'moon-middle',
    ['middle'],
    'astronomy',
    'moon',
    { fr: 'Ce colis va sur l’astre qui tourne autour de la Terre.', en: 'This parcel goes to the one that goes around the Earth.' },
    { fr: 'Les planètes tournent autour du Soleil… mais qui tourne autour de la Terre ?', en: 'The planets go around the Sun… but what goes around the Earth?' },
    ['mercury', 'mars', 'venus'],
    { weight: 1.4 }
  ),
  fixed(
    'rings-middle',
    ['middle'],
    'astronomy',
    'saturn',
    { fr: 'Ce colis va sur la sixième planète, celle qui a de magnifiques anneaux.', en: 'This parcel goes to the sixth planet, the one with beautiful rings.' },
    { fr: 'Cherche les plus grands anneaux, juste après Jupiter.', en: 'Look for the biggest rings, just after Jupiter.' },
    ['jupiter', 'uranus', 'neptune']
  ),
  fixed(
    'closest',
    ['middle', 'big'],
    'astronomy',
    'mercury',
    { fr: 'Ce colis va sur la planète la plus proche du Soleil.', en: 'This parcel goes to the planet closest to the Sun.' },
    { fr: 'Regarde juste à côté du Soleil : c’est la première planète.', en: 'Look right next to the Sun: it is the first planet.' },
    ['venus', 'mars', 'earth']
  ),
  fixed(
    'farthest',
    ['middle', 'big'],
    'astronomy',
    'neptune',
    { fr: 'Ce colis va sur la planète la plus loin du Soleil.', en: 'This parcel goes to the planet farthest from the Sun.' },
    { fr: 'Va tout au bout : c’est la huitième planète, après Uranus.', en: 'Go all the way to the end: it is the eighth planet, after Uranus.' },
    ['uranus', 'saturn', 'jupiter'],
    { minLevel: 2 }
  ),
  fixed(
    'life',
    ['middle'],
    'science',
    'earth',
    { fr: 'Ce colis va sur la seule planète où l’on connaît la vie, avec de l’eau et de l’air.', en: 'This parcel goes to the only planet where we know there is life, with water and air.' },
    { fr: 'C’est notre planète à nous, bleue et verte, la troisième depuis le Soleil.', en: 'It’s our very own blue and green planet, the third from the Sun.' },
    ['mars', 'venus', 'neptune']
  ),
  fixed(
    'smallest',
    ['middle'],
    'astronomy',
    'mercury',
    { fr: 'Ce colis va sur la plus petite des huit planètes.', en: 'This parcel goes to the smallest of the eight planets.' },
    { fr: 'Cherche la plus petite planète, toute grise, près du Soleil.', en: 'Look for the smallest planet, all grey, near the Sun.' },
    ['mars', 'venus', 'earth'],
    { minLevel: 3, avoid: ['moon'] }
  ),

  /* ── Big: precise facts, comparisons and small sums ── */
  fixed(
    'rings-ice',
    ['big'],
    'science',
    'saturn',
    { fr: 'Ce colis va sur la planète dont les grands anneaux sont faits de glace et de roche.', en: 'This parcel goes to the planet whose big rings are made of ice and rock.' },
    { fr: 'Jupiter, Uranus et Neptune ont des anneaux très fins ; cherche les plus grands et les plus brillants.', en: 'Jupiter, Uranus and Neptune have very thin rings; look for the biggest, brightest ones.' },
    ['jupiter', 'uranus', 'neptune']
  ),
  fixed(
    'moon-jump',
    ['big'],
    'science',
    'moon',
    { fr: 'Ziggy veut sauter environ 6 fois plus haut que sur Terre. Où livre-t-il ce colis ?', en: 'Ziggy wants to jump about 6 times higher than on Earth. Where does he deliver this parcel?' },
    { fr: 'Là-bas, on est 6 fois plus léger que sur Terre. Cherche le petit astre gris qui tourne autour de la Terre.', en: 'There you are 6 times lighter than on Earth. Look for the little grey world that goes around the Earth.' },
    ['mars', 'jupiter', 'mercury'],
    { weight: 1.4 }
  ),
  fixed(
    'hottest-big',
    ['big'],
    'science',
    'venus',
    { fr: 'Ce colis va sur la planète la plus chaude, même si ce n’est pas la plus proche du Soleil.', en: 'This parcel goes to the hottest planet, even though it isn’t the closest to the Sun.' },
    { fr: 'Ses nuages épais gardent la chaleur comme une serre : c’est la deuxième planète.', en: 'Its thick clouds trap the heat like a greenhouse: it is the second planet.' },
    ['mercury', 'mars', 'earth']
  ),
  fixed(
    'day-year',
    ['big'],
    'astronomy',
    'venus',
    { fr: 'Ce colis va sur la planète qui met plus de temps à faire un tour sur elle-même qu’à faire le tour du Soleil !', en: 'This parcel goes to the planet that takes longer to spin once than to go once around the Sun!' },
    { fr: 'Elle tourne très lentement sur elle-même, sous ses épais nuages jaunes : c’est la deuxième planète.', en: 'It spins very slowly, under its thick yellow clouds: it is the second planet.' },
    ['mercury', 'mars', 'jupiter'],
    { minLevel: 3 }
  ),
  fixed(
    'side',
    ['big'],
    'astronomy',
    'uranus',
    { fr: 'Ce colis va sur la planète qui tourne couchée sur le côté.', en: 'This parcel goes to the planet that spins lying on its side.' },
    { fr: 'C’est la septième planète, bleu-vert, entre Saturne et Neptune.', en: 'It’s the seventh planet, blue-green, between Saturn and Neptune.' },
    ['neptune', 'saturn', 'jupiter'],
    { minLevel: 2 }
  ),
  fixed(
    'wind',
    ['big'],
    'science',
    'neptune',
    { fr: 'Ce colis va sur la planète où soufflent les vents les plus forts du système solaire.', en: 'This parcel goes to the planet with the strongest winds in the solar system.' },
    { fr: 'C’est la plus lointaine, toute bleue, la huitième planète.', en: 'It’s the farthest one, all blue, the eighth planet.' },
    ['uranus', 'jupiter', 'saturn'],
    { minLevel: 3 }
  ),
  fixed(
    'storm',
    ['big'],
    'science',
    'jupiter',
    { fr: 'Ce colis va sur la planète qui a une tempête plus grande que la Terre : la grande tache rouge.', en: 'This parcel goes to the planet with a storm bigger than the Earth: the Great Red Spot.' },
    { fr: 'Cherche la plus grande planète, avec ses rayures.', en: 'Look for the biggest planet, with its stripes.' },
    ['saturn', 'neptune', 'mars']
  ),
  fixed(
    'volcano',
    ['big'],
    'science',
    'mars',
    { fr: 'Ce colis va sur la planète du plus grand volcan du système solaire, Olympus Mons.', en: 'This parcel goes to the planet with the biggest volcano in the solar system, Olympus Mons.' },
    { fr: 'C’est la planète rouge, juste après la Terre.', en: 'It’s the red planet, just after the Earth.' },
    ['venus', 'earth', 'mercury'],
    { minLevel: 2 }
  ),
  fixed(
    'two-moons',
    ['big'],
    'astronomy',
    'mars',
    { fr: 'Ce colis va sur la planète qui a deux petites lunes, Phobos et Déimos.', en: 'This parcel goes to the planet with two little moons, Phobos and Deimos.' },
    { fr: 'C’est la quatrième planète, toute rouge.', en: 'It’s the fourth planet, all red.' },
    ['earth', 'venus', 'jupiter'],
    { minLevel: 3 }
  ),
  fixed(
    'one-moon',
    ['big'],
    'astronomy',
    'earth',
    { fr: 'Ce colis va sur la seule planète qui a exactement une lune.', en: 'This parcel goes to the only planet with exactly one moon.' },
    { fr: 'Mercure et Vénus n’ont pas de lune, Mars en a deux… Et notre planète ?', en: 'Mercury and Venus have no moon, Mars has two… And our planet?' },
    ['mars', 'venus', 'mercury'],
    { minLevel: 4, avoid: ['moon'] }
  ),
  fixed(
    'smallest-big',
    ['big'],
    'astronomy',
    'mercury',
    { fr: 'Ce colis va sur la plus petite planète. Attention : la Lune n’est pas une planète !', en: 'This parcel goes to the smallest planet. Careful: the Moon is not a planet!' },
    { fr: 'La Lune tourne autour de la Terre, ce n’est pas une planète. Cherche la plus petite planète, la plus proche du Soleil.', en: 'The Moon goes around the Earth, so it’s not a planet. Look for the smallest planet, the closest to the Sun.' },
    ['moon', 'mars', 'venus'],
    { minLevel: 2 }
  ),
  {
    id: 'year',
    bands: ['big'],
    skill: 'astronomy',
    minLevel: 2,
    make: (c) => {
      const years: { body: BodyId; t: L }[] = [
        { body: 'mercury', t: { fr: 'en seulement 88 jours', en: 'in only 88 days' } },
        { body: 'mars', t: { fr: 'en 687 jours, presque 2 ans', en: 'in 687 days, almost 2 years' } },
        { body: 'jupiter', t: { fr: 'en environ 12 ans', en: 'in about 12 years' } },
        { body: 'saturn', t: { fr: 'en environ 29 ans', en: 'in about 29 years' } },
        { body: 'uranus', t: { fr: 'en 84 ans', en: 'in 84 years' } },
        { body: 'neptune', t: { fr: 'en environ 165 ans', en: 'in about 165 years' } },
      ];
      const options = years.filter((y) => !c.used.has(y.body));
      if (!options.length) return null;
      const y = pick(options, c.r);
      const n = BODY[y.body].order!;
      const near = [n - 1, n + 1, n - 2, n + 2].filter((k) => k >= 1 && k <= 8).map(planetAt);
      return {
        answer: y.body,
        text: { fr: `Ce colis va sur la planète qui fait le tour du Soleil ${y.t.fr}.`, en: `This parcel goes to the planet that goes around the Sun ${y.t.en}.` },
        hint: {
          fr: 'Plus une planète est loin du Soleil, plus son tour est long. La Terre met un an.',
          en: 'The farther a planet is from the Sun, the longer its trip around it. The Earth takes one year.',
        },
        tricky: near,
        avoid: ['moon'],
      };
    },
  },
  {
    id: 'no-ground',
    bands: ['big'],
    skill: 'science',
    make: (c) => {
      const giants = (['jupiter', 'saturn', 'uranus', 'neptune'] as BodyId[]).filter((b) => !c.used.has(b));
      if (!giants.length) return null;
      const answer = pick(giants, c.r);
      return {
        answer,
        text: {
          fr: 'Ce colis va sur une planète sans sol, où la fusée ne peut pas se poser : laquelle ?',
          en: 'This parcel goes to a planet with no ground, where the rocket can’t land: which one?',
        },
        hint: {
          fr: 'Les petites planètes près du Soleil sont en roche. Les géantes, plus loin, sont faites surtout de gaz.',
          en: 'The small planets near the Sun are made of rock. The giants, farther away, are mostly gas.',
        },
        tricky: shuffle(['mercury', 'venus', 'earth', 'mars', 'moon'] as BodyId[], c.r),
        pool: ['mercury', 'venus', 'earth', 'mars', 'moon'],
      };
    },
  },
  {
    id: 'calc',
    bands: ['big'],
    skill: 'counting',
    make: (c) => {
      for (let tries = 0; tries < 40; tries++) {
        const op = c.level <= 2 ? '+' : c.level === 3 ? pick(['+', '−'] as const, c.r) : pick(['+', '−', '×'] as const, c.r);
        let a = 0;
        let b = 0;
        if (op === '+') {
          a = between(1, 6, c.r);
          b = between(1, 8 - a, c.r);
        } else if (op === '−') {
          a = between(3, 10, c.r);
          b = between(Math.max(1, a - 8), a - 1, c.r);
        } else {
          a = between(2, 4, c.r);
          b = between(1, Math.floor(8 / a), c.r);
        }
        const n = op === '+' ? a + b : op === '−' ? a - b : a * b;
        if (n < 1 || n > 8) continue;
        const answer = planetAt(n);
        if (c.used.has(answer)) continue;
        return {
          answer,
          text: { fr: `Ce colis va sur la planète numéro ${a} ${op} ${b}, en comptant depuis le Soleil.`, en: `This parcel goes to planet number ${a} ${op} ${b}, counting from the Sun.` },
          hint: { fr: `Calcule d’abord : ${a} ${op} ${b}. Puis compte les planètes depuis le Soleil.`, en: `First work it out: ${a} ${op} ${b}. Then count the planets from the Sun.` },
          tricky: [n - 1, n + 1, n + 2, n - 2].filter((k) => k >= 1 && k <= 8).map(planetAt),
          avoid: ['moon'],
          numbers: true,
        };
      }
      return null;
    },
  },
  {
    id: 'compare',
    bands: ['big'],
    skill: 'astronomy',
    make: (c) => {
      const kinds = [
        { key: 'far', fr: 'la plus loin du Soleil', en: 'the one farthest from the Sun', val: (b: BodyId) => BODY[b].order!, max: true },
        { key: 'near', fr: 'la plus proche du Soleil', en: 'the one closest to the Sun', val: (b: BodyId) => BODY[b].order!, max: false },
        { key: 'big', fr: 'la plus grande', en: 'the biggest one', val: (b: BodyId) => BODY[b].diameterKm, max: true },
        { key: 'small', fr: 'la plus petite', en: 'the smallest one', val: (b: BodyId) => BODY[b].diameterKm, max: false },
      ];
      for (let tries = 0; tries < 30; tries++) {
        const k = pick(kinds, c.r);
        const set = shuffle(PLANETS, c.r).slice(0, candidateCount(c.band));
        const best = [...set].sort((x, y) => (k.max ? k.val(y) - k.val(x) : k.val(x) - k.val(y)))[0];
        if (c.used.has(best)) continue;
        return {
          answer: best,
          text: { fr: `Parmi ces planètes, le colis va sur ${k.fr}.`, en: `Of these planets, the parcel goes to ${k.en}.` },
          hint:
            k.key === 'far' || k.key === 'near'
              ? { fr: 'Rappelle-toi l’ordre : Mercure, Vénus, Terre, Mars, Jupiter, Saturne, Uranus, Neptune.', en: 'Remember the order: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune.' }
              : { fr: 'Les géantes sont Jupiter, puis Saturne, puis Uranus et Neptune. Les petites sont près du Soleil.', en: 'The giants are Jupiter, then Saturn, then Uranus and Neptune. The small ones are near the Sun.' },
          tricky: set.filter((b) => b !== best),
          pool: set,
        };
      }
      return null;
    },
  },
  {
    id: 'size-between',
    bands: ['big'],
    skill: 'astronomy',
    minLevel: 4,
    make: (c) => {
      const bySize = [...PLANETS].sort((x, y) => BODY[x].diameterKm - BODY[y].diameterKm);
      for (let tries = 0; tries < 30; tries++) {
        // At most 3 planets in the interval, so there are always enough distractors outside it.
        const i = between(0, bySize.length - 3, c.r);
        const j = between(i + 2, Math.min(i + 4, bySize.length - 1), c.r);
        const inside = bySize.slice(i + 1, j);
        const answer = pick(inside, c.r);
        if (c.used.has(answer)) continue;
        const outside = bySize.filter((_, k) => k <= i || k >= j);
        const lo = BODY[bySize[i]].the;
        const hi = BODY[bySize[j]].the;
        // Exactly one candidate is in the interval: the answer, the others come from outside.
        return {
          answer,
          text: { fr: `Ce colis va sur la planète plus grande que ${lo.fr}, mais plus petite que ${hi.fr}.`, en: `This parcel goes to the planet bigger than ${lo.en}, but smaller than ${hi.en}.` },
          hint: {
            fr: 'Range-les de la plus petite à la plus grande : Mercure, Mars, Vénus, Terre, Neptune, Uranus, Saturne, Jupiter.',
            en: 'Line them up from smallest to biggest: Mercury, Mars, Venus, Earth, Neptune, Uranus, Saturn, Jupiter.',
          },
          tricky: shuffle(outside, c.r),
          pool: outside,
          avoid: ['moon'],
        };
      }
      return null;
    },
  },
];

/** Every candidate set must have exactly one valid answer: the checker the scene and tests share. */
export const checkAnswer = (d: Riddle, body: BodyId) => body === d.answer;

function levelFor(levels: Partial<Record<PlanetesSkill, number>>, skill: PlanetesSkill) {
  return Math.max(1, Math.min(5, Math.floor(levels[skill] ?? 1)));
}

/**
 * Plan a game of 5 deliveries, locally and deterministically (same seed, same
 * game): distinct answers and riddles, a mix of skills, adapted to the age band
 * and to the child's level in each skill.
 */
export function planGame(seed: number, band: Band, levels: Partial<Record<PlanetesSkill, number>> = {}): Delivery[] {
  const r = rng((seed * 2654435761) >>> 0 || 1);
  const used = new Set<BodyId>();
  const usedIds = new Set<string>();
  const out: Riddle[] = [];
  const eligible = (t: Template) => t.bands.includes(band) && (t.minLevel ?? 1) <= levelFor(levels, t.skill);
  // One counting riddle and one science riddle when the band has them, the rest astronomy, shuffled.
  const wanted: PlanetesSkill[] = shuffle(['counting', 'science', 'astronomy', 'astronomy', 'astronomy'] as PlanetesSkill[], r);
  for (let i = 0; i < DELIVERIES; i++) {
    const want = wanted[i];
    const pools = [TEMPLATES.filter((t) => eligible(t) && t.skill === want && !usedIds.has(t.id)), TEMPLATES.filter((t) => eligible(t) && !usedIds.has(t.id))];
    let made: Riddle | null = null;
    for (const pool of pools) {
      // Weighted shuffle: the Moon (and its giant jumps) comes up a bit more often.
      const order = [...pool].map((t) => ({ t, k: r() ** (1 / (t.weight ?? 1)) })).sort((a, b) => b.k - a.k);
      for (const { t } of order) {
        const res = t.make({ r, band, level: levelFor(levels, t.skill), used });
        if (!res) continue;
        const { tricky, avoid, pool: from, ...rest } = res;
        made = { ...rest, id: t.id, skill: t.skill, candidates: buildCandidates({ r, band, level: 1, used }, res.answer, tricky, avoid, from) };
        break;
      }
      if (made) break;
    }
    if (!made) break;
    used.add(made.answer);
    usedIds.add(made.id);
    out.push(made);
  }
  // The funny moments: one giant sock, one sneeze, never on the same delivery.
  const sockAt = Math.floor(r() * out.length);
  let sneezeAt = Math.floor(r() * out.length);
  if (sneezeAt === sockAt && out.length > 1) sneezeAt = (sneezeAt + 2) % out.length;
  return out.map((d, i) => ({
    ...d,
    parcels: band === 'little' ? 1 + ((i + Math.floor(r() * 3)) % 3) : band === 'middle' ? 1 + Math.floor(r() * 2) : 1,
    gift: i === sockAt ? 'sock' : BODY[d.answer].gift,
    sneeze: i === sneezeAt,
  }));
}

/* ───────────────────────── Words ───────────────────────── */

export const questionText = (d: Riddle, locale: string) => tr(d.text, locale);

/** The candidates' names, read one by one for children who can't read yet. */
export const candidateWords = (d: Riddle, locale: string) => d.candidates.map((b) => tr(BODY[b].label, locale));

/** After a wrong planet: never a failure, just not the right address, and a hint. */
export function wrongText(d: Riddle, body: BodyId, mistakes: number, locale: string): string {
  const fr = locale === 'fr';
  const here = tr(BODY[body].the, locale);
  const look = tr(BODY[body].look, locale);
  const first = fr ? `Oups ! Ce n’est pas la bonne adresse : ici, c’est ${here}, ${look}.` : `Oops! Wrong address: this is ${here}, ${look}.`;
  const hint = tr(d.hint, locale);
  if (mistakes >= REVEAL_AFTER) return `${first} ${fr ? 'Regarde : la bonne planète brille !' : 'Look: the right planet is shining!'} ${hint}`;
  return `${first} ${fr ? 'Indice :' : 'Hint:'} ${hint}`;
}

/** A tap on a planet that is not one of the choices: just its name (learning, not a mistake). */
export const peekText = (body: BodyId, locale: string) => (locale === 'fr' ? `Ça, c’est ${tr(BODY[body].the, locale)} : ${tr(BODY[body].look, locale)}.` : `That’s ${tr(BODY[body].the, locale)}: ${tr(BODY[body].look, locale)}.`);

export function arriveText(d: Delivery, locale: string): string {
  const fr = locale === 'fr';
  const b = BODY[d.answer];
  const name = tr(b.the, locale);
  if (d.answer === 'saturn')
    return fr ? 'Bonne adresse ! Saturne n’a pas de sol : on livre sur ses anneaux de glace !' : 'Right address! Saturn has no ground: we deliver on its icy rings!';
  if (b.kind === 'gas') return fr ? `Bonne adresse ! Pas de sol sur ${name} : c’est une boule de gaz. ${b.alien} vient chercher son colis sur un nuage !` : `Right address! There’s no ground on ${name}: it’s a ball of gas. ${b.alien} comes to get the parcel on a cloud!`;
  if (b.kind === 'ice') return fr ? `Bonne adresse ! ${cap(name)} est faite de gaz et de glace, sans sol : ${b.alien} attend sur un nuage !` : `Right address! ${cap(name)} is made of gas and ice, with no ground: ${b.alien} waits on a cloud!`;
  if (d.answer === 'moon') return fr ? 'Bonne adresse ! Sur la Lune, on est tout léger : regarde les sauts de Ziggy !' : 'Right address! On the Moon you’re so light: watch Ziggy jump!';
  return fr ? `Bonne adresse ! Atterrissage sur ${name} !` : `Right address! Landing on ${name}!`;
}

/** The inhabitant opens the parcel (and maybe sneezes stars first). */
export function openText(d: Delivery, locale: string): string[] {
  const fr = locale === 'fr';
  const who = BODY[d.answer].alien;
  const lines: string[] = [];
  if (d.sneeze) lines.push(fr ? `${who} : A… A… ATCHOUM ! Hihi, j’éternue des étoiles !` : `${who}: Ah… ah… ACHOO! Hee hee, I sneeze stars!`);
  lines.push(`${who}${fr ? ' :' : ':'} ${tr(GIFT[d.gift].line, locale)}`);
  lines.push(fr ? 'Merci, Ziggy le facteur !' : 'Thank you, Ziggy the postman!');
  return lines;
}

/** A true fact about the planet, for the age band (varies with the seed). */
export function factText(d: Delivery, band: Band, locale: string, seed = 0): string {
  const list = BODY[d.answer].facts[band];
  const f = list[Math.abs(Math.floor(seed)) % list.length];
  return `${locale === 'fr' ? 'Le savais-tu ?' : 'Did you know?'} ${tr(f, locale)}`;
}

/** For the voice: maths signs said as words. */
export function speechText(text: string, locale: string): string {
  const fr = locale === 'fr';
  return text
    .replace(/\s×\s/g, fr ? ' fois ' : ' times ')
    .replace(/\s−\s/g, fr ? ' moins ' : ' minus ')
    .replace(/\s\+\s/g, fr ? ' plus ' : ' plus ');
}

export function parcelWord(n: number, locale: string): string {
  return locale === 'fr' ? `${n} colis` : `${n} parcel${n > 1 ? 's' : ''}`;
}

export function endText(visited: number, locale: string): string {
  return locale === 'fr'
    ? `Tu as livré des colis sur ${visited} astres. Bravo, facteur des planètes !`
    : `You delivered parcels to ${visited} worlds. Well done, planet postman!`;
}

/** French typography: a non-breaking space before ! ? : ; (no lonely "!" on a new line). */
export function nbsp(text: string, locale: string): string {
  return locale === 'fr' ? text.replace(/ ([!?:;»])/g, '\u00a0$1').replace(/« /g, '«\u00a0') : text;
}

export const PRETEND: L = {
  fr: 'Les habitants des planètes sont imaginaires : pour l’instant, on ne connaît la vie que sur la Terre !',
  en: 'The planet inhabitants are make-believe: so far, we only know of life on Earth!',
};

export const PRAISE: L[] = [
  { fr: 'Bravo, facteur des planètes !', en: 'Well done, planet postman!' },
  { fr: 'Colis livré !', en: 'Parcel delivered!' },
  { fr: 'Super livraison !', en: 'Super delivery!' },
  { fr: 'Youpi, bonne adresse !', en: 'Hooray, right address!' },
];
