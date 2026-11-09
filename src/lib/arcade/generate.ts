/**
 * Ziggy Arcade — local, deterministic content generators.
 *
 * Same (game, difficulty, locale, seed) → same content, thanks to a seeded
 * PRNG (mulberry32). Content is sized by the game's `rounds[difficulty-1]` and
 * gets harder with difficulty. French when locale is 'fr', English otherwise.
 */
import { tr, type L } from '@/lib/i18n-text';
import { getGame } from './registry';
import type { ArcadeGameId, ChoiceItem, Difficulty, GameContent } from './types';

/* ───────────────────────── PRNG ───────────────────────── */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

class Rng {
  private readonly next: () => number;
  constructor(seed: number) {
    this.next = mulberry32(seed);
  }
  float(): number {
    return this.next();
  }
  /** Integer in [min, max], both included. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  shuffle<T>(arr: readonly T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  sample<T>(arr: readonly T[], n: number): T[] {
    return this.shuffle(arr).slice(0, n);
  }
}

/* ───────────────────────── Helpers ───────────────────────── */

type Ctx = { rng: Rng; d: Difficulty; n: number; locale: string; t: (l: L) => string; fr: boolean };

/** Options per question at each difficulty (choice games). */
const CHOICE_OPTIONS = [2, 3, 3, 4, 4] as const;
/** Lanes per question at each difficulty (runner games). */
const RUNNER_OPTIONS = [2, 2, 3, 3, 3] as const;

function makeChoice(
  rng: Rng,
  prompt: string,
  correct: string,
  wrongs: readonly string[],
  count: number,
  visual?: string,
  explain?: string,
): ChoiceItem {
  const pool = Array.from(new Set(wrongs.filter((w) => w !== correct)));
  const chosen = rng.sample(pool, count - 1);
  if (chosen.length < count - 1) throw new Error(`Not enough options for "${prompt}"`);
  const options = rng.shuffle([correct, ...chosen]);
  const item: ChoiceItem = { prompt, options, answer: options.indexOf(correct) };
  if (visual) item.visual = visual;
  if (explain) item.explain = explain;
  return item;
}

/** Plausible wrong numbers close to the right one (never negative). */
function numberWrongs(rng: Rng, correct: number, spread = 3): string[] {
  const set = new Set<number>();
  for (let delta = 1; delta <= spread; delta++) {
    set.add(correct + delta);
    if (correct - delta >= 0) set.add(correct - delta);
  }
  set.add(correct + 10);
  if (correct >= 10) set.add(correct - 10);
  set.delete(correct);
  return rng.shuffle(Array.from(set)).map(String);
}

/** Builds `n` items with distinct prompt/visual/answer, retrying the maker. */
function uniqueItems(n: number, make: (i: number) => ChoiceItem): ChoiceItem[] {
  const items: ChoiceItem[] = [];
  const seen = new Set<string>();
  let attempts = 0;
  while (items.length < n) {
    if (++attempts > n * 200) throw new Error('Could not build enough distinct items');
    const item = make(items.length);
    const key = `${item.prompt}|${item.visual ?? ''}|${item.options[item.answer]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
}

/* ───────────────────────── Fact banks ───────────────────────── */

interface Fact {
  level: 1 | 2 | 3;
  visual: string;
  q: L;
  a: L;
  w: L[];
  e?: L;
}

/** Facts up to the difficulty's level, the hardest allowed ones first. */
function factPool(facts: Fact[], d: Difficulty, rng: Rng): Fact[] {
  const maxLevel = ([1, 2, 2, 3, 3] as const)[d - 1];
  const pool = rng.shuffle(facts.filter((f) => f.level <= maxLevel));
  return [...pool.filter((f) => f.level === maxLevel), ...pool.filter((f) => f.level !== maxLevel)];
}

function factItem(ctx: Ctx, f: Fact, count: number): ChoiceItem {
  return makeChoice(
    ctx.rng,
    ctx.t(f.q),
    ctx.t(f.a),
    f.w.map(ctx.t),
    Math.min(count, f.w.length + 1),
    f.visual,
    f.e ? ctx.t(f.e) : undefined,
  );
}

const SCIENCE_FACTS: Fact[] = [
  {
    level: 1,
    visual: '🌱',
    q: { fr: 'De quoi une plante a-t-elle besoin pour pousser ?', en: 'What does a plant need to grow?' },
    a: { fr: 'D’eau et de lumière', en: 'Water and light' },
    w: [
      { fr: 'De chocolat', en: 'Chocolate' },
      { fr: 'De jouets', en: 'Toys' },
      { fr: 'De bruit', en: 'Noise' },
    ],
    e: { fr: 'Les plantes boivent l’eau et se nourrissent de lumière.', en: 'Plants drink water and feed on light.' },
  },
  {
    level: 1,
    visual: '🧊',
    q: { fr: 'Que fait un glaçon au soleil ?', en: 'What does an ice cube do in the sun?' },
    a: { fr: 'Il fond', en: 'It melts' },
    w: [
      { fr: 'Il grandit', en: 'It grows' },
      { fr: 'Il chante', en: 'It sings' },
      { fr: 'Il devient bleu', en: 'It turns blue' },
    ],
    e: { fr: 'La chaleur transforme la glace en eau.', en: 'Heat turns ice into water.' },
  },
  {
    level: 1,
    visual: '🐛',
    q: { fr: 'Une chenille devient…', en: 'A caterpillar becomes a…' },
    a: { fr: 'Un papillon', en: 'Butterfly' },
    w: [
      { fr: 'Un oiseau', en: 'Bird' },
      { fr: 'Un poisson', en: 'Fish' },
      { fr: 'Un escargot', en: 'Snail' },
    ],
    e: { fr: 'Elle se cache dans un cocon puis devient papillon.', en: 'It hides in a chrysalis, then becomes a butterfly.' },
  },
  {
    level: 1,
    visual: '🐸',
    q: { fr: 'Un têtard grandit et devient…', en: 'A tadpole grows into a…' },
    a: { fr: 'Une grenouille', en: 'Frog' },
    w: [
      { fr: 'Un canard', en: 'Duck' },
      { fr: 'Une tortue', en: 'Turtle' },
      { fr: 'Un lapin', en: 'Rabbit' },
    ],
  },
  {
    level: 1,
    visual: '👀',
    q: { fr: 'Avec nos yeux, nous pouvons…', en: 'With our eyes, we can…' },
    a: { fr: 'Voir', en: 'See' },
    w: [
      { fr: 'Sentir les odeurs', en: 'Smell' },
      { fr: 'Goûter', en: 'Taste' },
      { fr: 'Entendre', en: 'Hear' },
    ],
  },
  {
    level: 1,
    visual: '🐝',
    q: { fr: 'Quel insecte fabrique le miel ?', en: 'Which insect makes honey?' },
    a: { fr: 'L’abeille', en: 'The bee' },
    w: [
      { fr: 'La fourmi', en: 'The ant' },
      { fr: 'La coccinelle', en: 'The ladybird' },
      { fr: 'La mouche', en: 'The fly' },
    ],
    e: { fr: 'Les abeilles font le miel avec le nectar des fleurs.', en: 'Bees make honey from flower nectar.' },
  },
  {
    level: 1,
    visual: '🌙',
    q: { fr: 'Quand voit-on le plus souvent la Lune ?', en: 'When do we most often see the Moon?' },
    a: { fr: 'La nuit', en: 'At night' },
    w: [
      { fr: 'Jamais', en: 'Never' },
      { fr: 'Seulement le dimanche', en: 'Only on Sundays' },
      { fr: 'Seulement à midi', en: 'Only at lunchtime' },
    ],
  },
  {
    level: 2,
    visual: '🌡️',
    q: { fr: 'À quelle température l’eau bout-elle ?', en: 'At what temperature does water boil?' },
    a: { fr: '100 °C', en: '100 °C' },
    w: [
      { fr: '10 °C', en: '10 °C' },
      { fr: '0 °C', en: '0 °C' },
      { fr: '50 °C', en: '50 °C' },
    ],
    e: { fr: 'À 0 °C l’eau gèle, à 100 °C elle bout.', en: 'Water freezes at 0 °C and boils at 100 °C.' },
  },
  {
    level: 2,
    visual: '🧲',
    q: { fr: 'Qu’est-ce qu’un aimant attire ?', en: 'What does a magnet pull?' },
    a: { fr: 'Le fer', en: 'Iron' },
    w: [
      { fr: 'Le bois', en: 'Wood' },
      { fr: 'Le papier', en: 'Paper' },
      { fr: 'Le verre', en: 'Glass' },
    ],
  },
  {
    level: 2,
    visual: '🌈',
    q: { fr: 'De quoi a-t-on besoin pour voir un arc-en-ciel ?', en: 'What do we need to see a rainbow?' },
    a: { fr: 'Du soleil et de la pluie', en: 'Sunshine and rain' },
    w: [
      { fr: 'De la neige et la nuit', en: 'Snow and night' },
      { fr: 'Du vent seulement', en: 'Only wind' },
      { fr: 'Du sable', en: 'Sand' },
    ],
    e: { fr: 'La lumière du soleil se sépare en couleurs dans les gouttes.', en: 'Sunlight splits into colours inside raindrops.' },
  },
  {
    level: 2,
    visual: '🕷️',
    q: { fr: 'Combien de pattes a une araignée ?', en: 'How many legs does a spider have?' },
    a: { fr: '8', en: '8' },
    w: [
      { fr: '6', en: '6' },
      { fr: '4', en: '4' },
      { fr: '10', en: '10' },
    ],
    e: { fr: 'Les insectes ont 6 pattes, les araignées 8.', en: 'Insects have 6 legs, spiders have 8.' },
  },
  {
    level: 2,
    visual: '🐋',
    q: { fr: 'Comment respire une baleine ?', en: 'How does a whale breathe?' },
    a: { fr: 'Elle respire l’air par son évent', en: 'It breathes air through its blowhole' },
    w: [
      { fr: 'Avec des branchies', en: 'With gills' },
      { fr: 'Elle ne respire jamais', en: 'It never breathes' },
      { fr: 'Par ses nageoires', en: 'Through its fins' },
    ],
    e: { fr: 'La baleine est un mammifère : elle remonte respirer.', en: 'A whale is a mammal: it swims up to breathe.' },
  },
  {
    level: 2,
    visual: '❤️',
    q: { fr: 'À quoi sert le cœur ?', en: 'What does the heart do?' },
    a: { fr: 'Il fait circuler le sang', en: 'It pumps blood' },
    w: [
      { fr: 'Il nous fait voir', en: 'It helps us see' },
      { fr: 'Il fait pousser les cheveux', en: 'It makes hair grow' },
      { fr: 'Il nous fait entendre', en: 'It helps us hear' },
    ],
  },
  {
    level: 2,
    visual: '🌳',
    q: { fr: 'Quel gaz les arbres nous donnent-ils pour respirer ?', en: 'Which gas do trees give us to breathe?' },
    a: { fr: 'L’oxygène', en: 'Oxygen' },
    w: [
      { fr: 'La fumée', en: 'Smoke' },
      { fr: 'Le sel', en: 'Salt' },
      { fr: 'Le sucre', en: 'Sugar' },
    ],
  },
  {
    level: 3,
    visual: '🌍',
    q: { fr: 'Combien de temps met la Terre pour tourner autour du Soleil ?', en: 'How long does Earth take to go around the Sun?' },
    a: { fr: 'Un an', en: 'One year' },
    w: [
      { fr: 'Un jour', en: 'One day' },
      { fr: 'Une semaine', en: 'One week' },
      { fr: 'Une heure', en: 'One hour' },
    ],
  },
  {
    level: 3,
    visual: '💧',
    q: { fr: 'Quand la vapeur d’eau refroidit dans le ciel, elle forme…', en: 'When water vapour cools in the sky, it makes…' },
    a: { fr: 'Des nuages', en: 'Clouds' },
    w: [
      { fr: 'Des cailloux', en: 'Pebbles' },
      { fr: 'Du sable', en: 'Sand' },
      { fr: 'Des étoiles', en: 'Stars' },
    ],
    e: { fr: 'C’est le cycle de l’eau !', en: 'That is the water cycle!' },
  },
  {
    level: 3,
    visual: '🦇',
    q: { fr: 'Comment les chauves-souris s’orientent-elles dans le noir ?', en: 'How do bats find their way in the dark?' },
    a: { fr: 'Grâce à l’écho des sons', en: 'With sound echoes' },
    w: [
      { fr: 'Avec une lampe', en: 'With a torch' },
      { fr: 'Avec une carte', en: 'With a map' },
      { fr: 'Avec des lunettes', en: 'With glasses' },
    ],
  },
  {
    level: 3,
    visual: '💎',
    q: { fr: 'Quelle est la matière naturelle la plus dure ?', en: 'What is the hardest natural material?' },
    a: { fr: 'Le diamant', en: 'Diamond' },
    w: [
      { fr: 'La craie', en: 'Chalk' },
      { fr: 'Le bois', en: 'Wood' },
      { fr: 'L’argile', en: 'Clay' },
    ],
  },
  {
    level: 3,
    visual: '🍃',
    q: { fr: 'Les plantes fabriquent leur nourriture grâce…', en: 'Plants make their food using…' },
    a: { fr: 'À la lumière du soleil', en: 'Sunlight' },
    w: [
      { fr: 'À la musique', en: 'Music' },
      { fr: 'Au clair de lune', en: 'Moonlight' },
      { fr: 'Au vent', en: 'Wind' },
    ],
    e: { fr: 'C’est la photosynthèse.', en: 'It is called photosynthesis.' },
  },
  {
    level: 3,
    visual: '🐧',
    q: { fr: 'Le manchot est un oiseau qui…', en: 'A penguin is a bird that…' },
    a: { fr: 'Nage mais ne vole pas', en: 'Swims but cannot fly' },
    w: [
      { fr: 'Vole très haut', en: 'Flies very high' },
      { fr: 'Vit dans le désert', en: 'Lives in the desert' },
      { fr: 'A quatre pattes', en: 'Has four legs' },
    ],
  },
  {
    level: 3,
    visual: '⚡',
    q: { fr: 'Quelle matière laisse passer l’électricité ?', en: 'Which material lets electricity through?' },
    a: { fr: 'Le métal', en: 'Metal' },
    w: [
      { fr: 'Le caoutchouc', en: 'Rubber' },
      { fr: 'Le bois', en: 'Wood' },
      { fr: 'Le plastique', en: 'Plastic' },
    ],
  },
];

const SPACE_FACTS: Fact[] = [
  {
    level: 1,
    visual: '☀️',
    q: { fr: 'Le Soleil est…', en: 'The Sun is a…' },
    a: { fr: 'Une étoile', en: 'Star' },
    w: [
      { fr: 'Une planète', en: 'Planet' },
      { fr: 'Une lune', en: 'Moon' },
    ],
  },
  {
    level: 1,
    visual: '🌍',
    q: { fr: 'Sur quelle planète vivons-nous ?', en: 'Which planet do we live on?' },
    a: { fr: 'La Terre', en: 'Earth' },
    w: [
      { fr: 'Mars', en: 'Mars' },
      { fr: 'Jupiter', en: 'Jupiter' },
    ],
  },
  {
    level: 1,
    visual: '🌙',
    q: { fr: 'Qui tourne autour de la Terre ?', en: 'What goes around the Earth?' },
    a: { fr: 'La Lune', en: 'The Moon' },
    w: [
      { fr: 'Le Soleil', en: 'The Sun' },
      { fr: 'Saturne', en: 'Saturn' },
    ],
  },
  {
    level: 1,
    visual: '🧑‍🚀',
    q: { fr: 'Qui voyage dans l’espace ?', en: 'Who travels to space?' },
    a: { fr: 'Un astronaute', en: 'An astronaut' },
    w: [
      { fr: 'Un boulanger', en: 'A baker' },
      { fr: 'Un jardinier', en: 'A gardener' },
    ],
  },
  {
    level: 1,
    visual: '🔭',
    q: { fr: 'Avec quoi regarde-t-on les étoiles de près ?', en: 'What do we use to look closely at stars?' },
    a: { fr: 'Un télescope', en: 'A telescope' },
    w: [
      { fr: 'Une cuillère', en: 'A spoon' },
      { fr: 'Un parapluie', en: 'An umbrella' },
    ],
  },
  {
    level: 2,
    visual: '🔴',
    q: { fr: 'Quelle planète appelle-t-on la planète rouge ?', en: 'Which planet is called the red planet?' },
    a: { fr: 'Mars', en: 'Mars' },
    w: [
      { fr: 'Vénus', en: 'Venus' },
      { fr: 'Neptune', en: 'Neptune' },
    ],
  },
  {
    level: 2,
    visual: '🪐',
    q: { fr: 'Quelle planète a de grands anneaux ?', en: 'Which planet has big rings?' },
    a: { fr: 'Saturne', en: 'Saturn' },
    w: [
      { fr: 'Mercure', en: 'Mercury' },
      { fr: 'La Terre', en: 'Earth' },
    ],
  },
  {
    level: 2,
    visual: '🌌',
    q: { fr: 'Combien de planètes dans notre système solaire ?', en: 'How many planets are in our solar system?' },
    a: { fr: '8', en: '8' },
    w: [
      { fr: '5', en: '5' },
      { fr: '12', en: '12' },
    ],
  },
  {
    level: 2,
    visual: '✨',
    q: { fr: 'Des étoiles qui forment un dessin, c’est…', en: 'Stars that make a picture are a…' },
    a: { fr: 'Une constellation', en: 'Constellation' },
    w: [
      { fr: 'Une comète', en: 'Comet' },
      { fr: 'Un cratère', en: 'Crater' },
    ],
  },
  {
    level: 2,
    visual: '🌕',
    q: { fr: 'Les trous ronds sur la Lune s’appellent…', en: 'The round holes on the Moon are called…' },
    a: { fr: 'Des cratères', en: 'Craters' },
    w: [
      { fr: 'Des lacs', en: 'Lakes' },
      { fr: 'Des tunnels', en: 'Tunnels' },
    ],
  },
  {
    level: 3,
    visual: '🪐',
    q: { fr: 'Quelle est la plus grande planète ?', en: 'Which is the biggest planet?' },
    a: { fr: 'Jupiter', en: 'Jupiter' },
    w: [
      { fr: 'Mars', en: 'Mars' },
      { fr: 'Mercure', en: 'Mercury' },
    ],
  },
  {
    level: 3,
    visual: '☀️',
    q: { fr: 'Quelle planète est la plus proche du Soleil ?', en: 'Which planet is closest to the Sun?' },
    a: { fr: 'Mercure', en: 'Mercury' },
    w: [
      { fr: 'Neptune', en: 'Neptune' },
      { fr: 'La Terre', en: 'Earth' },
    ],
  },
  {
    level: 3,
    visual: '☄️',
    q: { fr: 'La queue d’une comète est faite…', en: 'A comet’s tail is made of…' },
    a: { fr: 'De glace et de poussière', en: 'Ice and dust' },
    w: [
      { fr: 'De plumes', en: 'Feathers' },
      { fr: 'De papier', en: 'Paper' },
    ],
  },
  {
    level: 3,
    visual: '🌎',
    q: { fr: 'Combien de temps met la Terre pour faire un tour sur elle-même ?', en: 'How long does Earth take to spin around once?' },
    a: { fr: 'Un jour', en: 'One day' },
    w: [
      { fr: 'Un an', en: 'One year' },
      { fr: 'Une minute', en: 'One minute' },
    ],
  },
  {
    level: 3,
    visual: '🍎',
    q: { fr: 'Quelle force fait tomber les objets vers le sol ?', en: 'Which force makes things fall to the ground?' },
    a: { fr: 'La gravité', en: 'Gravity' },
    w: [
      { fr: 'Le vent', en: 'Wind' },
      { fr: 'Les nuages', en: 'Clouds' },
    ],
  },
];

/* ───────────────────────── Word banks ───────────────────────── */

type Word = { word: string; hint: string };

const SPELL_WORDS: Record<'fr' | 'en', Word[]> = {
  fr: [
    { word: 'LIT', hint: '🛏️' },
    { word: 'BUS', hint: '🚌' },
    { word: 'OIE', hint: '🪿' },
    { word: 'NEZ', hint: '👃' },
    { word: 'BOL', hint: '🥣' },
    { word: 'MER', hint: '🌊' },
    { word: 'VER', hint: '🪱' },
    { word: 'RIZ', hint: '🍚' },
    { word: 'SAC', hint: '🎒' },
    { word: 'COQ', hint: '🐓' },
    { word: 'CHAT', hint: '🐱' },
    { word: 'LOUP', hint: '🐺' },
    { word: 'OURS', hint: '🐻' },
    { word: 'LUNE', hint: '🌙' },
    { word: 'PAIN', hint: '🍞' },
    { word: 'LION', hint: '🦁' },
    { word: 'ROSE', hint: '🌹' },
    { word: 'LAIT', hint: '🥛' },
    { word: 'KIWI', hint: '🥝' },
    { word: 'TAXI', hint: '🚕' },
    { word: 'POMME', hint: '🍎' },
    { word: 'VACHE', hint: '🐮' },
    { word: 'TIGRE', hint: '🐯' },
    { word: 'PANDA', hint: '🐼' },
    { word: 'PIZZA', hint: '🍕' },
    { word: 'ROBOT', hint: '🤖' },
    { word: 'TRAIN', hint: '🚂' },
    { word: 'POULE', hint: '🐔' },
    { word: 'SINGE', hint: '🐒' },
    { word: 'LAPIN', hint: '🐰' },
    { word: 'ARBRE', hint: '🌳' },
    { word: 'FLEUR', hint: '🌸' },
    { word: 'NUAGE', hint: '☁️' },
    { word: 'LIVRE', hint: '📖' },
    { word: 'CANARD', hint: '🦆' },
    { word: 'BATEAU', hint: '⛵' },
    { word: 'CITRON', hint: '🍋' },
    { word: 'MOUTON', hint: '🐑' },
    { word: 'CHEVAL', hint: '🐴' },
    { word: 'TORTUE', hint: '🐢' },
    { word: 'BANANE', hint: '🍌' },
    { word: 'CERISE', hint: '🍒' },
    { word: 'SOLEIL', hint: '☀️' },
    { word: 'DRAGON', hint: '🐉' },
    { word: 'MAISON', hint: '🏠' },
    { word: 'GIRAFE', hint: '🦒' },
    { word: 'FRAISE', hint: '🍓' },
    { word: 'VOLCAN', hint: '🌋' },
    { word: 'CAROTTE', hint: '🥕' },
    { word: 'GUITARE', hint: '🎸' },
    { word: 'BALEINE', hint: '🐋' },
    { word: 'LICORNE', hint: '🦄' },
    { word: 'DAUPHIN', hint: '🐬' },
    { word: 'POUSSIN', hint: '🐥' },
    { word: 'PINGOUIN', hint: '🐧' },
    { word: 'ESCARGOT', hint: '🐌' },
    { word: 'PAPILLON', hint: '🦋' },
    { word: 'TROMPETTE', hint: '🎺' },
    { word: 'CITROUILLE', hint: '🎃' },
    { word: 'CHAMPIGNON', hint: '🍄' },
  ],
  en: [
    { word: 'CAT', hint: '🐱' },
    { word: 'DOG', hint: '🐶' },
    { word: 'SUN', hint: '☀️' },
    { word: 'BEE', hint: '🐝' },
    { word: 'COW', hint: '🐮' },
    { word: 'PIG', hint: '🐷' },
    { word: 'OWL', hint: '🦉' },
    { word: 'FOX', hint: '🦊' },
    { word: 'HAT', hint: '🎩' },
    { word: 'BUS', hint: '🚌' },
    { word: 'EGG', hint: '🥚' },
    { word: 'KEY', hint: '🔑' },
    { word: 'FISH', hint: '🐟' },
    { word: 'STAR', hint: '⭐' },
    { word: 'MOON', hint: '🌙' },
    { word: 'FROG', hint: '🐸' },
    { word: 'BEAR', hint: '🐻' },
    { word: 'LION', hint: '🦁' },
    { word: 'CAKE', hint: '🍰' },
    { word: 'TREE', hint: '🌳' },
    { word: 'BOOK', hint: '📖' },
    { word: 'KITE', hint: '🪁' },
    { word: 'DUCK', hint: '🦆' },
    { word: 'MILK', hint: '🥛' },
    { word: 'APPLE', hint: '🍎' },
    { word: 'HOUSE', hint: '🏠' },
    { word: 'HORSE', hint: '🐴' },
    { word: 'MOUSE', hint: '🐭' },
    { word: 'TIGER', hint: '🐯' },
    { word: 'PIZZA', hint: '🍕' },
    { word: 'ROBOT', hint: '🤖' },
    { word: 'SNAIL', hint: '🐌' },
    { word: 'TRAIN', hint: '🚂' },
    { word: 'SHEEP', hint: '🐑' },
    { word: 'CLOUD', hint: '☁️' },
    { word: 'WHALE', hint: '🐋' },
    { word: 'ZEBRA', hint: '🦓' },
    { word: 'PANDA', hint: '🐼' },
    { word: 'LEMON', hint: '🍋' },
    { word: 'CASTLE', hint: '🏰' },
    { word: 'ROCKET', hint: '🚀' },
    { word: 'RABBIT', hint: '🐰' },
    { word: 'TURTLE', hint: '🐢' },
    { word: 'FLOWER', hint: '🌸' },
    { word: 'BANANA', hint: '🍌' },
    { word: 'CARROT', hint: '🥕' },
    { word: 'DRAGON', hint: '🐉' },
    { word: 'PLANET', hint: '🪐' },
    { word: 'MONKEY', hint: '🐒' },
    { word: 'GUITAR', hint: '🎸' },
    { word: 'PARROT', hint: '🦜' },
    { word: 'CHERRY', hint: '🍒' },
    { word: 'PENGUIN', hint: '🐧' },
    { word: 'UNICORN', hint: '🦄' },
    { word: 'DOLPHIN', hint: '🐬' },
    { word: 'GIRAFFE', hint: '🦒' },
    { word: 'RAINBOW', hint: '🌈' },
    { word: 'OCTOPUS', hint: '🐙' },
    { word: 'VOLCANO', hint: '🌋' },
    { word: 'PUMPKIN', hint: '🎃' },
    { word: 'ELEPHANT', hint: '🐘' },
    { word: 'DINOSAUR', hint: '🦕' },
    { word: 'BUTTERFLY', hint: '🦋' },
  ],
};

/** Word length range at each difficulty. */
const SPELL_LENGTHS: [number, number][] = [
  [3, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 10],
];

function wordsFor(locale: string): Word[] {
  return SPELL_WORDS[locale === 'fr' ? 'fr' : 'en'];
}

/** Picture words by first letter, for the alphabet quest. */
const ALPHABET_WORDS: Record<'fr' | 'en', { word: string; emoji: string }[]> = {
  fr: [
    { word: 'abeille', emoji: '🐝' },
    { word: 'ananas', emoji: '🍍' },
    { word: 'ballon', emoji: '🎈' },
    { word: 'banane', emoji: '🍌' },
    { word: 'bateau', emoji: '⛵' },
    { word: 'chat', emoji: '🐱' },
    { word: 'cheval', emoji: '🐴' },
    { word: 'citron', emoji: '🍋' },
    { word: 'dauphin', emoji: '🐬' },
    { word: 'dragon', emoji: '🐉' },
    { word: 'escargot', emoji: '🐌' },
    { word: 'fraise', emoji: '🍓' },
    { word: 'fleur', emoji: '🌸' },
    { word: 'girafe', emoji: '🦒' },
    { word: 'gâteau', emoji: '🎂' },
    { word: 'hibou', emoji: '🦉' },
    { word: 'hérisson', emoji: '🦔' },
    { word: 'iguane', emoji: '🦎' },
    { word: 'jus', emoji: '🧃' },
    { word: 'kiwi', emoji: '🥝' },
    { word: 'koala', emoji: '🐨' },
    { word: 'lion', emoji: '🦁' },
    { word: 'lune', emoji: '🌙' },
    { word: 'lapin', emoji: '🐰' },
    { word: 'maison', emoji: '🏠' },
    { word: 'mouton', emoji: '🐑' },
    { word: 'nuage', emoji: '☁️' },
    { word: 'nid', emoji: '🪺' },
    { word: 'ours', emoji: '🐻' },
    { word: 'orange', emoji: '🍊' },
    { word: 'pomme', emoji: '🍎' },
    { word: 'poisson', emoji: '🐟' },
    { word: 'quilles', emoji: '🎳' },
    { word: 'robot', emoji: '🤖' },
    { word: 'renard', emoji: '🦊' },
    { word: 'soleil', emoji: '☀️' },
    { word: 'singe', emoji: '🐒' },
    { word: 'tortue', emoji: '🐢' },
    { word: 'tigre', emoji: '🐯' },
    { word: 'usine', emoji: '🏭' },
    { word: 'vache', emoji: '🐮' },
    { word: 'vélo', emoji: '🚲' },
    { word: 'wagon', emoji: '🚃' },
    { word: 'zèbre', emoji: '🦓' },
  ],
  en: [
    { word: 'apple', emoji: '🍎' },
    { word: 'ant', emoji: '🐜' },
    { word: 'ball', emoji: '⚽' },
    { word: 'bee', emoji: '🐝' },
    { word: 'banana', emoji: '🍌' },
    { word: 'cat', emoji: '🐱' },
    { word: 'car', emoji: '🚗' },
    { word: 'cake', emoji: '🍰' },
    { word: 'dog', emoji: '🐶' },
    { word: 'duck', emoji: '🦆' },
    { word: 'egg', emoji: '🥚' },
    { word: 'elephant', emoji: '🐘' },
    { word: 'fish', emoji: '🐟' },
    { word: 'frog', emoji: '🐸' },
    { word: 'grapes', emoji: '🍇' },
    { word: 'goat', emoji: '🐐' },
    { word: 'hat', emoji: '🎩' },
    { word: 'horse', emoji: '🐴' },
    { word: 'igloo', emoji: '🛖' },
    { word: 'juice', emoji: '🧃' },
    { word: 'jellyfish', emoji: '🪼' },
    { word: 'kite', emoji: '🪁' },
    { word: 'key', emoji: '🔑' },
    { word: 'lion', emoji: '🦁' },
    { word: 'lemon', emoji: '🍋' },
    { word: 'moon', emoji: '🌙' },
    { word: 'mouse', emoji: '🐭' },
    { word: 'nest', emoji: '🪺' },
    { word: 'nose', emoji: '👃' },
    { word: 'owl', emoji: '🦉' },
    { word: 'orange', emoji: '🍊' },
    { word: 'pig', emoji: '🐷' },
    { word: 'pizza', emoji: '🍕' },
    { word: 'rabbit', emoji: '🐰' },
    { word: 'rainbow', emoji: '🌈' },
    { word: 'sun', emoji: '☀️' },
    { word: 'star', emoji: '⭐' },
    { word: 'tree', emoji: '🌳' },
    { word: 'tiger', emoji: '🐯' },
    { word: 'umbrella', emoji: '☂️' },
    { word: 'unicorn', emoji: '🦄' },
    { word: 'violin', emoji: '🎻' },
    { word: 'volcano', emoji: '🌋' },
    { word: 'whale', emoji: '🐋' },
    { word: 'watermelon', emoji: '🍉' },
    { word: 'yo-yo', emoji: '🪀' },
    { word: 'zebra', emoji: '🦓' },
  ],
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function firstLetter(word: string): string {
  return word.normalize('NFD').charAt(0).toUpperCase();
}

/* ───────────────────────── Geography ───────────────────────── */

type Continent = 'europe' | 'africa' | 'asia' | 'north_america' | 'south_america' | 'oceania';

const CONTINENTS: Record<Continent, L> = {
  europe: { fr: 'Europe', en: 'Europe' },
  africa: { fr: 'Afrique', en: 'Africa' },
  asia: { fr: 'Asie', en: 'Asia' },
  north_america: { fr: 'Amérique du Nord', en: 'North America' },
  south_america: { fr: 'Amérique du Sud', en: 'South America' },
  oceania: { fr: 'Océanie', en: 'Oceania' },
};

interface Country {
  flag: string;
  name: L;
  capital: L;
  continent: Continent;
  famous?: boolean;
}

const COUNTRIES: Country[] = [
  { flag: '🇫🇷', name: { fr: 'France', en: 'France' }, capital: { fr: 'Paris', en: 'Paris' }, continent: 'europe', famous: true },
  { flag: '🇮🇹', name: { fr: 'Italie', en: 'Italy' }, capital: { fr: 'Rome', en: 'Rome' }, continent: 'europe', famous: true },
  { flag: '🇪🇸', name: { fr: 'Espagne', en: 'Spain' }, capital: { fr: 'Madrid', en: 'Madrid' }, continent: 'europe', famous: true },
  { flag: '🇩🇪', name: { fr: 'Allemagne', en: 'Germany' }, capital: { fr: 'Berlin', en: 'Berlin' }, continent: 'europe', famous: true },
  { flag: '🇬🇧', name: { fr: 'Royaume-Uni', en: 'United Kingdom' }, capital: { fr: 'Londres', en: 'London' }, continent: 'europe', famous: true },
  { flag: '🇵🇹', name: { fr: 'Portugal', en: 'Portugal' }, capital: { fr: 'Lisbonne', en: 'Lisbon' }, continent: 'europe' },
  { flag: '🇬🇷', name: { fr: 'Grèce', en: 'Greece' }, capital: { fr: 'Athènes', en: 'Athens' }, continent: 'europe' },
  { flag: '🇧🇪', name: { fr: 'Belgique', en: 'Belgium' }, capital: { fr: 'Bruxelles', en: 'Brussels' }, continent: 'europe' },
  { flag: '🇨🇭', name: { fr: 'Suisse', en: 'Switzerland' }, capital: { fr: 'Berne', en: 'Bern' }, continent: 'europe' },
  { flag: '🇯🇵', name: { fr: 'Japon', en: 'Japan' }, capital: { fr: 'Tokyo', en: 'Tokyo' }, continent: 'asia', famous: true },
  { flag: '🇨🇳', name: { fr: 'Chine', en: 'China' }, capital: { fr: 'Pékin', en: 'Beijing' }, continent: 'asia', famous: true },
  { flag: '🇮🇳', name: { fr: 'Inde', en: 'India' }, capital: { fr: 'New Delhi', en: 'New Delhi' }, continent: 'asia' },
  { flag: '🇰🇷', name: { fr: 'Corée du Sud', en: 'South Korea' }, capital: { fr: 'Séoul', en: 'Seoul' }, continent: 'asia' },
  { flag: '🇨🇦', name: { fr: 'Canada', en: 'Canada' }, capital: { fr: 'Ottawa', en: 'Ottawa' }, continent: 'north_america', famous: true },
  { flag: '🇺🇸', name: { fr: 'États-Unis', en: 'United States' }, capital: { fr: 'Washington', en: 'Washington' }, continent: 'north_america', famous: true },
  { flag: '🇲🇽', name: { fr: 'Mexique', en: 'Mexico' }, capital: { fr: 'Mexico', en: 'Mexico City' }, continent: 'north_america' },
  { flag: '🇧🇷', name: { fr: 'Brésil', en: 'Brazil' }, capital: { fr: 'Brasília', en: 'Brasília' }, continent: 'south_america', famous: true },
  { flag: '🇦🇷', name: { fr: 'Argentine', en: 'Argentina' }, capital: { fr: 'Buenos Aires', en: 'Buenos Aires' }, continent: 'south_america' },
  { flag: '🇵🇪', name: { fr: 'Pérou', en: 'Peru' }, capital: { fr: 'Lima', en: 'Lima' }, continent: 'south_america' },
  { flag: '🇪🇬', name: { fr: 'Égypte', en: 'Egypt' }, capital: { fr: 'Le Caire', en: 'Cairo' }, continent: 'africa' },
  { flag: '🇰🇪', name: { fr: 'Kenya', en: 'Kenya' }, capital: { fr: 'Nairobi', en: 'Nairobi' }, continent: 'africa' },
  { flag: '🇲🇦', name: { fr: 'Maroc', en: 'Morocco' }, capital: { fr: 'Rabat', en: 'Rabat' }, continent: 'africa' },
  { flag: '🇸🇳', name: { fr: 'Sénégal', en: 'Senegal' }, capital: { fr: 'Dakar', en: 'Dakar' }, continent: 'africa' },
  { flag: '🇦🇺', name: { fr: 'Australie', en: 'Australia' }, capital: { fr: 'Canberra', en: 'Canberra' }, continent: 'oceania', famous: true },
  { flag: '🇳🇿', name: { fr: 'Nouvelle-Zélande', en: 'New Zealand' }, capital: { fr: 'Wellington', en: 'Wellington' }, continent: 'oceania' },
];

/* ───────────────────────── Order banks ───────────────────────── */

interface StepSet {
  prompt: L;
  steps: L[];
}

const RECIPE_SETS: StepSet[] = [
  {
    prompt: { fr: 'Prépare une salade de fruits', en: 'Make a fruit salad' },
    steps: [
      { fr: '🧼 Se laver les mains', en: '🧼 Wash your hands' },
      { fr: '🍎 Laver les fruits', en: '🍎 Wash the fruit' },
      { fr: '🍌 Éplucher la banane', en: '🍌 Peel the banana' },
      { fr: '🥝 Couper les fruits avec un adulte', en: '🥝 Cut the fruit with a grown-up' },
      { fr: '🥣 Tout mélanger dans un bol', en: '🥣 Mix everything in a bowl' },
      { fr: '😋 Servir et se régaler', en: '😋 Serve and enjoy' },
    ],
  },
  {
    prompt: { fr: 'Prépare des crêpes', en: 'Make pancakes' },
    steps: [
      { fr: '🥣 Mettre la farine dans un saladier', en: '🥣 Put flour in a bowl' },
      { fr: '🥚 Ajouter les œufs', en: '🥚 Add the eggs' },
      { fr: '🥛 Verser le lait', en: '🥛 Pour in the milk' },
      { fr: '🥄 Mélanger sans grumeaux', en: '🥄 Whisk until smooth' },
      { fr: '🍳 Faire cuire avec un adulte', en: '🍳 Cook with a grown-up' },
      { fr: '🍯 Ajouter un peu de miel', en: '🍯 Add a little honey' },
    ],
  },
  {
    prompt: { fr: 'Prépare un sandwich', en: 'Make a sandwich' },
    steps: [
      { fr: '🍞 Prendre deux tranches de pain', en: '🍞 Take two slices of bread' },
      { fr: '🧈 Étaler un peu de beurre', en: '🧈 Spread a little butter' },
      { fr: '🧀 Ajouter le fromage', en: '🧀 Add the cheese' },
      { fr: '🥒 Poser des rondelles de concombre', en: '🥒 Add cucumber slices' },
      { fr: '🥪 Refermer avec la deuxième tranche', en: '🥪 Close with the second slice' },
      { fr: '🍽️ Couper en deux et partager', en: '🍽️ Cut in two and share' },
    ],
  },
  {
    prompt: { fr: 'Prépare un smoothie', en: 'Make a smoothie' },
    steps: [
      { fr: '🍓 Laver les fraises', en: '🍓 Wash the strawberries' },
      { fr: '🍌 Éplucher la banane', en: '🍌 Peel the banana' },
      { fr: '🫐 Mettre les fruits dans le mixeur', en: '🫐 Put the fruit in the blender' },
      { fr: '🥛 Ajouter du yaourt', en: '🥛 Add some yoghurt' },
      { fr: '🌀 Mixer avec un adulte', en: '🌀 Blend with a grown-up' },
      { fr: '🥤 Verser dans un verre', en: '🥤 Pour into a glass' },
    ],
  },
  {
    prompt: { fr: 'Prépare une soupe de légumes', en: 'Make a vegetable soup' },
    steps: [
      { fr: '🥕 Laver les légumes', en: '🥕 Wash the vegetables' },
      { fr: '🔪 Les couper avec un adulte', en: '🔪 Cut them with a grown-up' },
      { fr: '🍲 Les mettre dans une casserole', en: '🍲 Put them in a pot' },
      { fr: '💧 Ajouter de l’eau', en: '💧 Add some water' },
      { fr: '♨️ Faire cuire jusqu’à ce que ce soit tendre', en: '♨️ Cook until soft' },
      { fr: '🥣 Servir dans des bols', en: '🥣 Serve in bowls' },
    ],
  },
  {
    prompt: { fr: 'Prépare une pizza', en: 'Make a pizza' },
    steps: [
      { fr: '🫓 Étaler la pâte', en: '🫓 Roll out the dough' },
      { fr: '🍅 Étaler la sauce tomate', en: '🍅 Spread the tomato sauce' },
      { fr: '🧀 Parsemer de fromage', en: '🧀 Sprinkle the cheese' },
      { fr: '🍄 Ajouter les garnitures', en: '🍄 Add your toppings' },
      { fr: '🔥 Faire cuire au four avec un adulte', en: '🔥 Bake with a grown-up' },
      { fr: '🍕 Couper et partager', en: '🍕 Slice and share' },
    ],
  },
];

/* ───────────────────────── Sort banks ───────────────────────── */

interface SortBank {
  bins: { id: string; label: L; emoji: string }[];
  items: { label: L; emoji: string; bin: string }[];
  /** Number of bins at each difficulty. */
  binCount: [number, number, number, number, number];
}

const ECO_BANK: SortBank = {
  binCount: [2, 3, 4, 4, 4],
  bins: [
    { id: 'paper', label: { fr: 'Papier et carton', en: 'Paper and cardboard' }, emoji: '📦' },
    { id: 'packaging', label: { fr: 'Emballages', en: 'Plastic and cans' }, emoji: '🧴' },
    { id: 'glass', label: { fr: 'Verre', en: 'Glass' }, emoji: '🫙' },
    { id: 'compost', label: { fr: 'Compost', en: 'Compost' }, emoji: '🍂' },
  ],
  items: [
    { label: { fr: 'Journal', en: 'Newspaper' }, emoji: '📰', bin: 'paper' },
    { label: { fr: 'Boîte en carton', en: 'Cardboard box' }, emoji: '📦', bin: 'paper' },
    { label: { fr: 'Enveloppe', en: 'Envelope' }, emoji: '✉️', bin: 'paper' },
    { label: { fr: 'Vieux cahier', en: 'Old notebook' }, emoji: '📒', bin: 'paper' },
    { label: { fr: 'Rouleau en carton', en: 'Cardboard tube' }, emoji: '🧻', bin: 'paper' },
    { label: { fr: 'Feuille de papier', en: 'Sheet of paper' }, emoji: '🗒️', bin: 'paper' },
    { label: { fr: 'Flacon de shampoing', en: 'Shampoo bottle' }, emoji: '🧴', bin: 'packaging' },
    { label: { fr: 'Boîte de conserve', en: 'Tin can' }, emoji: '🥫', bin: 'packaging' },
    { label: { fr: 'Brique de jus', en: 'Juice carton' }, emoji: '🧃', bin: 'packaging' },
    { label: { fr: 'Gobelet en plastique', en: 'Plastic cup' }, emoji: '🥤', bin: 'packaging' },
    { label: { fr: 'Barquette en plastique', en: 'Plastic tub' }, emoji: '🥡', bin: 'packaging' },
    { label: { fr: 'Bocal en verre', en: 'Glass jar' }, emoji: '🫙', bin: 'glass' },
    { label: { fr: 'Pot de miel en verre', en: 'Glass honey jar' }, emoji: '🍯', bin: 'glass' },
    { label: { fr: 'Bouteille en verre', en: 'Glass bottle' }, emoji: '🍶', bin: 'glass' },
    { label: { fr: 'Pot de yaourt en verre', en: 'Glass yoghurt pot' }, emoji: '🥛', bin: 'glass' },
    { label: { fr: 'Peau de banane', en: 'Banana peel' }, emoji: '🍌', bin: 'compost' },
    { label: { fr: 'Trognon de pomme', en: 'Apple core' }, emoji: '🍎', bin: 'compost' },
    { label: { fr: 'Coquille d’œuf', en: 'Eggshell' }, emoji: '🥚', bin: 'compost' },
    { label: { fr: 'Feuilles mortes', en: 'Dry leaves' }, emoji: '🍂', bin: 'compost' },
    { label: { fr: 'Épluchures de carotte', en: 'Carrot peelings' }, emoji: '🥕', bin: 'compost' },
    { label: { fr: 'Marc de café', en: 'Coffee grounds' }, emoji: '☕', bin: 'compost' },
  ],
};

const ANIMAL_BANK: SortBank = {
  binCount: [2, 3, 3, 4, 5],
  bins: [
    { id: 'ocean', label: { fr: 'Océan', en: 'Ocean' }, emoji: '🌊' },
    { id: 'forest', label: { fr: 'Forêt', en: 'Forest' }, emoji: '🌳' },
    { id: 'savanna', label: { fr: 'Savane', en: 'Savanna' }, emoji: '🌾' },
    { id: 'polar', label: { fr: 'Banquise', en: 'Polar ice' }, emoji: '❄️' },
    { id: 'farm', label: { fr: 'Ferme', en: 'Farm' }, emoji: '🚜' },
  ],
  items: [
    { label: { fr: 'Dauphin', en: 'Dolphin' }, emoji: '🐬', bin: 'ocean' },
    { label: { fr: 'Pieuvre', en: 'Octopus' }, emoji: '🐙', bin: 'ocean' },
    { label: { fr: 'Baleine', en: 'Whale' }, emoji: '🐋', bin: 'ocean' },
    { label: { fr: 'Requin', en: 'Shark' }, emoji: '🦈', bin: 'ocean' },
    { label: { fr: 'Tortue de mer', en: 'Sea turtle' }, emoji: '🐢', bin: 'ocean' },
    { label: { fr: 'Crabe', en: 'Crab' }, emoji: '🦀', bin: 'ocean' },
    { label: { fr: 'Renard', en: 'Fox' }, emoji: '🦊', bin: 'forest' },
    { label: { fr: 'Hibou', en: 'Owl' }, emoji: '🦉', bin: 'forest' },
    { label: { fr: 'Écureuil', en: 'Squirrel' }, emoji: '🐿️', bin: 'forest' },
    { label: { fr: 'Hérisson', en: 'Hedgehog' }, emoji: '🦔', bin: 'forest' },
    { label: { fr: 'Cerf', en: 'Deer' }, emoji: '🦌', bin: 'forest' },
    { label: { fr: 'Ours brun', en: 'Brown bear' }, emoji: '🐻', bin: 'forest' },
    { label: { fr: 'Lion', en: 'Lion' }, emoji: '🦁', bin: 'savanna' },
    { label: { fr: 'Girafe', en: 'Giraffe' }, emoji: '🦒', bin: 'savanna' },
    { label: { fr: 'Zèbre', en: 'Zebra' }, emoji: '🦓', bin: 'savanna' },
    { label: { fr: 'Éléphant', en: 'Elephant' }, emoji: '🐘', bin: 'savanna' },
    { label: { fr: 'Rhinocéros', en: 'Rhino' }, emoji: '🦏', bin: 'savanna' },
    { label: { fr: 'Hippopotame', en: 'Hippo' }, emoji: '🦛', bin: 'savanna' },
    { label: { fr: 'Manchot', en: 'Penguin' }, emoji: '🐧', bin: 'polar' },
    { label: { fr: 'Ours polaire', en: 'Polar bear' }, emoji: '🐻‍❄️', bin: 'polar' },
    { label: { fr: 'Phoque', en: 'Seal' }, emoji: '🦭', bin: 'polar' },
    { label: { fr: 'Loup arctique', en: 'Arctic wolf' }, emoji: '🐺', bin: 'polar' },
    { label: { fr: 'Béluga', en: 'Beluga' }, emoji: '🐳', bin: 'polar' },
    { label: { fr: 'Vache', en: 'Cow' }, emoji: '🐄', bin: 'farm' },
    { label: { fr: 'Cochon', en: 'Pig' }, emoji: '🐖', bin: 'farm' },
    { label: { fr: 'Mouton', en: 'Sheep' }, emoji: '🐑', bin: 'farm' },
    { label: { fr: 'Coq', en: 'Rooster' }, emoji: '🐓', bin: 'farm' },
    { label: { fr: 'Chèvre', en: 'Goat' }, emoji: '🐐', bin: 'farm' },
    { label: { fr: 'Cheval', en: 'Horse' }, emoji: '🐴', bin: 'farm' },
  ],
};

/* ───────────────────────── Colour mixing ───────────────────────── */

const PALETTE: { id: string; name: L; hex: string }[] = [
  { id: 'red', name: { fr: 'Rouge', en: 'Red' }, hex: '#E53935' },
  { id: 'yellow', name: { fr: 'Jaune', en: 'Yellow' }, hex: '#FDD835' },
  { id: 'blue', name: { fr: 'Bleu', en: 'Blue' }, hex: '#1E88E5' },
  { id: 'white', name: { fr: 'Blanc', en: 'White' }, hex: '#FFFFFF' },
  { id: 'black', name: { fr: 'Noir', en: 'Black' }, hex: '#212121' },
];

interface MixTarget {
  name: L;
  hex: string;
  recipe: string[];
}

const MIX_TARGETS: MixTarget[] = [
  { name: { fr: 'Orange', en: 'Orange' }, hex: '#FB8C00', recipe: ['red', 'yellow'] },
  { name: { fr: 'Vert', en: 'Green' }, hex: '#43A047', recipe: ['yellow', 'blue'] },
  { name: { fr: 'Violet', en: 'Purple' }, hex: '#8E24AA', recipe: ['red', 'blue'] },
  { name: { fr: 'Rose', en: 'Pink' }, hex: '#F48FB1', recipe: ['red', 'white'] },
  { name: { fr: 'Bleu ciel', en: 'Sky blue' }, hex: '#90CAF9', recipe: ['blue', 'white'] },
  { name: { fr: 'Jaune pâle', en: 'Pale yellow' }, hex: '#FFF59D', recipe: ['yellow', 'white'] },
  { name: { fr: 'Gris', en: 'Grey' }, hex: '#9E9E9E', recipe: ['white', 'black'] },
  { name: { fr: 'Rouge foncé', en: 'Dark red' }, hex: '#8E1B1B', recipe: ['red', 'black'] },
  { name: { fr: 'Bleu marine', en: 'Navy blue' }, hex: '#1A237E', recipe: ['blue', 'black'] },
  { name: { fr: 'Marron', en: 'Brown' }, hex: '#795548', recipe: ['red', 'yellow', 'blue'] },
  { name: { fr: 'Pêche', en: 'Peach' }, hex: '#FFCCBC', recipe: ['red', 'yellow', 'white'] },
  { name: { fr: 'Lavande', en: 'Lavender' }, hex: '#CE93D8', recipe: ['red', 'blue', 'white'] },
  { name: { fr: 'Vert menthe', en: 'Mint green' }, hex: '#A5D6A7', recipe: ['yellow', 'blue', 'white'] },
  { name: { fr: 'Vert sapin', en: 'Pine green' }, hex: '#1B5E20', recipe: ['yellow', 'blue', 'black'] },
];

/** Palette colours available at each difficulty. */
const MIX_PALETTES: string[][] = [
  ['red', 'yellow', 'blue'],
  ['red', 'yellow', 'blue', 'white'],
  ['red', 'yellow', 'blue', 'white', 'black'],
  ['red', 'yellow', 'blue', 'white', 'black'],
  ['red', 'yellow', 'blue', 'white', 'black'],
];
/** Minimum number of three-colour recipes at each difficulty. */
const MIX_THREE_COLOURS = [0, 0, 0, 3, 4];

/* ───────────────────────── Pairs banks ───────────────────────── */

const MEMORY_EMOJIS = ['🦄', '🐸', '🍓', '🌈', '🐙', '🎈', '🍩', '🌻', '🐢', '🦋', '🍉', '🐝'];
const SLIDE_PICTURES = ['🏰', '🐉', '🦄', '🚀', '🌈', '🐠', '🦁', '🌻', '🐼', '🎠'];

/* ───────────────────────── Generators ───────────────────────── */



function genSpaceMission(ctx: Ctx): ChoiceItem[] {
  const { rng, d, n, t } = ctx;
  const count = RUNNER_OPTIONS[d - 1];
  const facts = factPool(SPACE_FACTS, d, rng);
  let f = 0;
  return uniqueItems(n, (i) => {
    if (i % 2 === 0 && f < facts.length) return factItem(ctx, facts[f++], count);
    if (d === 1) {
      const k = rng.int(1, 6);
      return makeChoice(
        rng,
        t({ fr: 'Combien d’étoiles vois-tu ?', en: 'How many stars can you see?' }),
        String(k),
        numberWrongs(rng, k, 2).filter((x) => x !== '0'),
        count,
        '⭐'.repeat(k),
      );
    }
    const max = [10, 10, 20, 50, 100][d - 1];
    const plus = rng.float() < 0.5;
    const a = plus ? rng.int(1, max - 1) : rng.int(2, max);
    const b = plus ? rng.int(1, max - a) : rng.int(1, a);
    const c = plus ? a + b : a - b;
    const prompt = plus
      ? t({ fr: `${a} étoiles + ${b} étoiles = ?`, en: `${a} stars + ${b} stars = ?` })
      : t({ fr: `${a} fusées − ${b} qui décollent = ?`, en: `${a} rockets − ${b} take off = ?` });
    return makeChoice(rng, prompt, String(c), numberWrongs(rng, c), count, plus ? '⭐' : '🚀', `${a} ${plus ? '+' : '−'} ${b} = ${c}`);
  });
}

function genAlphabet(ctx: Ctx): ChoiceItem[] {
  const { rng, d, n, t, fr } = ctx;
  const count = CHOICE_OPTIONS[d - 1];
  const bank = ALPHABET_WORDS[fr ? 'fr' : 'en'];
  const letters = Array.from(new Set(bank.map((w) => firstLetter(w.word))));
  const kinds: ('startsWith' | 'firstLetter' | 'after' | 'before')[] =
    d === 1 ? ['startsWith'] : d <= 3 ? ['startsWith', 'firstLetter'] : d === 4 ? ['startsWith', 'firstLetter', 'after'] : ['startsWith', 'firstLetter', 'after', 'before'];
  return uniqueItems(n, () => {
    const kind = rng.pick(kinds);
    if (kind === 'startsWith') {
      const letter = rng.pick(letters);
      const right = rng.pick(bank.filter((w) => firstLetter(w.word) === letter));
      const wrongs = bank.filter((w) => firstLetter(w.word) !== letter);
      const usedLetters = new Set<string>([letter]);
      const distinct = rng.shuffle(wrongs).filter((w) => {
        const l = firstLetter(w.word);
        if (usedLetters.has(l)) return false;
        usedLetters.add(l);
        return true;
      });
      return makeChoice(
        rng,
        t({ fr: `Quel mot commence par ${letter} ?`, en: `Which word starts with ${letter}?` }),
        `${right.emoji} ${right.word}`,
        distinct.map((w) => `${w.emoji} ${w.word}`),
        count,
        letter,
        t({ fr: `${right.word} commence par ${letter} !`, en: `${right.word} starts with ${letter}!` }),
      );
    }
    if (kind === 'firstLetter') {
      const w = rng.pick(bank);
      const letter = firstLetter(w.word);
      return makeChoice(
        rng,
        t({ fr: 'Par quelle lettre commence le nom de cette image ?', en: 'Which letter does this picture’s name start with?' }),
        letter,
        ALPHABET.filter((l) => l !== letter),
        count,
        w.emoji,
        t({ fr: `${w.word} commence par ${letter}.`, en: `${w.word} starts with ${letter}.` }),
      );
    }
    const after = kind === 'after';
    const idx = after ? rng.int(0, 24) : rng.int(1, 25);
    const letter = ALPHABET[idx];
    const right = ALPHABET[after ? idx + 1 : idx - 1];
    const near = ALPHABET.filter((l, i) => l !== right && l !== letter && Math.abs(i - idx) <= 4);
    return makeChoice(
      rng,
      after
        ? t({ fr: `Quelle lettre vient après ${letter} ?`, en: `Which letter comes after ${letter}?` })
        : t({ fr: `Quelle lettre vient avant ${letter} ?`, en: `Which letter comes before ${letter}?` }),
      right,
      near,
      count,
      after ? `${letter} → ?` : `? → ${letter}`,
    );
  });
}

function genScientist(ctx: Ctx): ChoiceItem[] {
  const count = CHOICE_OPTIONS[ctx.d - 1];
  const facts = factPool(SCIENCE_FACTS, ctx.d, ctx.rng);
  return facts.slice(0, ctx.n).map((f) => factItem(ctx, f, count));
}

function genNumberIsland(ctx: Ctx): ChoiceItem[] {
  const { rng, d, n, t } = ctx;
  const count = CHOICE_OPTIONS[d - 1];
  const kinds: ('count' | 'compare' | 'add' | 'sub' | 'next' | 'missing')[] = [
    ['count', 'compare'],
    ['count', 'compare', 'add'],
    ['count', 'compare', 'add', 'sub', 'next'],
    ['compare', 'add', 'sub', 'next'],
    ['compare', 'add', 'sub', 'next', 'missing'],
  ][d - 1] as ('count' | 'compare' | 'add' | 'sub' | 'next' | 'missing')[];
  const max = [10, 20, 50, 100, 1000][d - 1];
  const sumMax = [5, 10, 20, 50, 100][d - 1];
  const things = ['🐚', '🥥', '🐠', '⭐', '🦀', '🌴'];
  return uniqueItems(n, () => {
    const kind = rng.pick(kinds);
    switch (kind) {
      case 'count': {
        const k = rng.int([1, 3, 5][Math.min(d, 3) - 1], [5, 10, 12][Math.min(d, 3) - 1]);
        const thing = rng.pick(things);
        return makeChoice(
          rng,
          t({ fr: 'Combien en vois-tu ?', en: 'How many can you see?' }),
          String(k),
          numberWrongs(rng, k, 2).filter((x) => x !== '0'),
          count,
          thing.repeat(k),
        );
      }
      case 'compare': {
        const nums = new Set<number>();
        while (nums.size < count) nums.add(rng.int(0, max));
        const arr = Array.from(nums);
        const best = Math.max(...arr);
        return makeChoice(
          rng,
          count === 2
            ? t({ fr: 'Quel nombre est le plus grand ?', en: 'Which number is bigger?' })
            : t({ fr: 'Quel nombre est le plus grand de tous ?', en: 'Which number is the biggest?' }),
          String(best),
          arr.filter((x) => x !== best).map(String),
          count,
          '⚖️',
        );
      }
      case 'add': {
        const a = rng.int(1, sumMax - 1);
        const b = rng.int(1, sumMax - a);
        return makeChoice(rng, `${a} + ${b} = ?`, String(a + b), numberWrongs(rng, a + b), count, '🏝️', `${a} + ${b} = ${a + b}`);
      }
      case 'sub': {
        const a = rng.int(3, sumMax);
        const b = rng.int(1, a - 1);
        return makeChoice(rng, `${a} − ${b} = ?`, String(a - b), numberWrongs(rng, a - b), count, '🥥', `${a} − ${b} = ${a - b}`);
      }
      case 'next': {
        const before = rng.float() < 0.4 && d >= 4;
        const k = rng.int(d >= 4 ? 10 : 1, Math.min(max, 200) - 1);
        const right = before ? k - 1 : k + 1;
        return makeChoice(
          rng,
          before
            ? t({ fr: `Quel nombre vient juste avant ${k} ?`, en: `Which number comes just before ${k}?` })
            : t({ fr: `Quel nombre vient juste après ${k} ?`, en: `Which number comes just after ${k}?` }),
          String(right),
          numberWrongs(rng, right, 2).filter((x) => x !== String(k)),
          count,
          '🔢',
        );
      }
      case 'missing': {
        const a = rng.int(5, 60);
        const b = rng.int(3, 39);
        return makeChoice(rng, `${a} + ? = ${a + b}`, String(b), numberWrongs(rng, b), count, '❓', `${a} + ${b} = ${a + b}`);
      }
    }
  });
}

const PATTERN_EMOJIS = ['🔴', '🔵', '🟡', '🟢', '⭐', '🌙', '💎', '🍀', '🐉', '🔶'];

function genDragon(ctx: Ctx): ChoiceItem[] {
  const { rng, d, n, t } = ctx;
  const count = CHOICE_OPTIONS[d - 1];
  const prompt = t({ fr: 'Qu’est-ce qui vient ensuite ?', en: 'What comes next?' });
  const emojiPattern = (motif: number[], length: number): ChoiceItem => {
    const symbols = rng.sample(PATTERN_EMOJIS, Math.max(...motif) + 1);
    const seq = Array.from({ length: length + 1 }, (_, i) => symbols[motif[i % motif.length]]);
    const right = seq[length];
    return makeChoice(rng, prompt, right, [...symbols, ...PATTERN_EMOJIS], count, `${seq.slice(0, length).join(' ')} ?`);
  };
  const numberSeq = (terms: number[]): ChoiceItem => {
    const right = terms[terms.length - 1];
    const shown = terms.slice(0, -1);
    const step = shown[shown.length - 1] - shown[shown.length - 2];
    return makeChoice(
      rng,
      prompt,
      String(right),
      numberWrongs(rng, right, 3),
      count,
      `${shown.join(', ')}, ?`,
      t({ fr: `La suite avance de ${step} en ${step}… jusqu’à ${right} !`, en: `It goes up by ${step} each time… to ${right}!` }),
    );
  };
  const arithmetic = (start: number, step: number, len: number) => Array.from({ length: len + 1 }, (_, i) => start + i * step);
  return uniqueItems(n, () => {
    const r = rng.float();
    if (d === 1) {
      return r < 0.6 ? emojiPattern([0, 1], rng.int(4, 5)) : numberSeq(arithmetic(rng.int(1, 5), 1, 3));
    }
    if (d === 2) {
      if (r < 0.4) return emojiPattern(rng.pick([[0, 1, 2], [0, 0, 1], [0, 1, 1]]), rng.int(5, 7));
      return numberSeq(arithmetic(rng.int(0, 10), rng.pick([1, 2]), 4));
    }
    if (d === 3) {
      if (r < 0.3) return emojiPattern(rng.pick([[0, 1, 2], [0, 1, 1], [0, 0, 1, 1]]), rng.int(6, 8));
      return numberSeq(arithmetic(rng.int(0, 20), rng.pick([2, 3, 5, 10]), 4));
    }
    if (d === 4) {
      if (r < 0.25) return emojiPattern(rng.pick([[0, 0, 1, 1], [0, 1, 2, 1], [0, 1, 2, 3]]), rng.int(7, 9));
      if (r < 0.6) {
        const step = rng.int(2, 10);
        const len = 4;
        const start = step * len + rng.int(0, 30);
        const terms = arithmetic(start, -step, len);
        const right = terms[len];
        return makeChoice(
          rng,
          prompt,
          String(right),
          numberWrongs(rng, right, 3),
          count,
          `${terms.slice(0, len).join(', ')}, ?`,
          t({ fr: `La suite descend de ${step} à chaque fois.`, en: `It goes down by ${step} each time.` }),
        );
      }
      return numberSeq(arithmetic(rng.int(1, 30), rng.int(3, 12), 4));
    }
    // d === 5: doubling and growing gaps
    if (r < 0.4) {
      const start = rng.int(1, 4);
      const terms = Array.from({ length: 5 }, (_, i) => start * 2 ** i);
      const right = terms[4];
      return makeChoice(
        rng,
        prompt,
        String(right),
        numberWrongs(rng, right, 4),
        count,
        `${terms.slice(0, 4).join(', ')}, ?`,
        t({ fr: 'Chaque nombre est le double du précédent.', en: 'Each number is double the one before.' }),
      );
    }
    if (r < 0.75) {
      const start = rng.int(1, 10);
      const terms = [start];
      for (let i = 1; i <= 5; i++) terms.push(terms[i - 1] + i);
      const right = terms[5];
      return makeChoice(
        rng,
        prompt,
        String(right),
        numberWrongs(rng, right, 3),
        count,
        `${terms.slice(0, 5).join(', ')}, ?`,
        t({ fr: 'L’écart grandit de 1 à chaque fois.', en: 'The gap grows by 1 each time.' }),
      );
    }
    return numberSeq(arithmetic(rng.int(10, 60), rng.int(6, 15), 5));
  });
}

function genGeography(ctx: Ctx): ChoiceItem[] {
  const { rng, d, n, t } = ctx;
  const count = CHOICE_OPTIONS[d - 1];
  const pool = d <= 2 ? COUNTRIES.filter((c) => c.famous) : COUNTRIES;
  const kinds: ('flagToCountry' | 'countryToFlag' | 'continent' | 'capital')[] =
    d === 1 ? ['flagToCountry', 'countryToFlag'] : d === 2 ? ['flagToCountry', 'countryToFlag', 'continent'] : ['flagToCountry', 'countryToFlag', 'continent', 'capital'];
  return uniqueItems(n, () => {
    const kind = rng.pick(kinds);
    const c = rng.pick(pool);
    const others = pool.filter((o) => o !== c);
    const name = t(c.name);
    switch (kind) {
      case 'flagToCountry':
        return makeChoice(
          rng,
          t({ fr: 'À quel pays est ce drapeau ?', en: 'Which country has this flag?' }),
          name,
          others.map((o) => t(o.name)),
          count,
          c.flag,
          t({ fr: `C’est le drapeau du pays : ${name}.`, en: `This is the flag of ${name}.` }),
        );
      case 'countryToFlag':
        return makeChoice(
          rng,
          t({ fr: `Quel est le drapeau de ce pays : ${name} ?`, en: `Which flag belongs to ${name}?` }),
          c.flag,
          others.map((o) => o.flag),
          count,
          '🗺️',
        );
      case 'continent': {
        const right = t(CONTINENTS[c.continent]);
        return makeChoice(
          rng,
          t({ fr: `Sur quel continent se trouve ce pays : ${name} ?`, en: `Which continent is ${name} in?` }),
          right,
          (Object.keys(CONTINENTS) as Continent[]).filter((k) => k !== c.continent).map((k) => t(CONTINENTS[k])),
          count,
          c.flag,
          t({ fr: `${name} se trouve en ${right}.`, en: `${name} is in ${right}.` }),
        );
      }
      case 'capital': {
        const right = t(c.capital);
        return makeChoice(
          rng,
          t({ fr: `Quelle est la capitale de ce pays : ${name} ?`, en: `What is the capital of ${name}?` }),
          right,
          others.map((o) => t(o.capital)),
          count,
          c.flag,
          t({ fr: `La capitale est ${right}.`, en: `The capital is ${right}.` }),
        );
      }
    }
  });
}



function genMemoryMagic(ctx: Ctx): [string, string][] {
  const { rng, d, n, locale } = ctx;
  if (d <= 2) return rng.sample(MEMORY_EMOJIS, n).map((e) => [e, e]);
  const words = rng.shuffle(wordsFor(locale).filter((w) => w.word.length <= 6));
  const capital = (w: string) => w.charAt(0) + w.slice(1).toLowerCase();
  const wordPairs = (k: number): [string, string][] => words.slice(0, k).map((w) => [w.hint, capital(w.word)]);
  if (d === 3) return wordPairs(n);
  const numbers = rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9], Math.floor(n / 2));
  const numberPairs: [string, string][] = numbers.map((k) => [String(k), '●'.repeat(k)]);
  return rng.shuffle([...numberPairs, ...wordPairs(n - numberPairs.length)]);
}



function genOrder(ctx: Ctx, bank: StepSet[]): { prompt: string; steps: string[] }[] {
  const { rng, d, n, t } = ctx;
  const stepCount = [3, 4, 5, 5, 6][d - 1];
  return rng.sample(bank, n).map((set) => {
    const middle = set.steps.slice(1, -1).map((_, i) => i + 1);
    const keep = new Set([0, set.steps.length - 1, ...rng.sample(middle, stepCount - 2)]);
    const steps = set.steps.filter((_, i) => keep.has(i)).map(t);
    return { prompt: t(set.prompt), steps };
  });
}

function genSort(ctx: Ctx, bank: SortBank): Extract<GameContent, { kind: 'sort' }> {
  const { rng, d, n, t } = ctx;
  const bins = rng.sample(bank.bins, bank.binCount[d - 1]);
  const perBin = bins.map((b) => rng.shuffle(bank.items.filter((it) => it.bin === b.id)));
  const items: { label: string; emoji: string; bin: string }[] = [];
  for (let round = 0; items.length < n; round++) {
    let added = false;
    for (const list of perBin) {
      if (items.length >= n) break;
      const it = list[round];
      if (!it) continue;
      items.push({ label: t(it.label), emoji: it.emoji, bin: it.bin });
      added = true;
    }
    if (!added) throw new Error('Not enough sort items');
  }
  return {
    kind: 'sort',
    bins: bins.map((b) => ({ id: b.id, label: t(b.label), emoji: b.emoji })),
    items: rng.shuffle(items),
  };
}

function genSpell(ctx: Ctx): Word[] {
  const { rng, d, n, locale } = ctx;
  const [min, max] = SPELL_LENGTHS[d - 1];
  return rng.sample(
    wordsFor(locale).filter((w) => w.word.length >= min && w.word.length <= max),
    n,
  );
}

function genMix(ctx: Ctx): Extract<GameContent, { kind: 'mix' }> {
  const { rng, d, n, t } = ctx;
  const paletteIds = MIX_PALETTES[d - 1];
  const allowed = MIX_TARGETS.filter((m) => m.recipe.every((c) => paletteIds.includes(c)));
  const three = rng.shuffle(allowed.filter((m) => m.recipe.length === 3));
  const minThree = MIX_THREE_COLOURS[d - 1];
  const first = three.slice(0, minThree);
  const rest = rng.shuffle(allowed.filter((m) => !first.includes(m)));
  const chosen = rng.shuffle([...first, ...rest.slice(0, n - first.length)]);
  return {
    kind: 'mix',
    targets: chosen.map((m) => ({ name: t(m.name), hex: m.hex, recipe: rng.shuffle(m.recipe) })),
    palette: PALETTE.filter((p) => paletteIds.includes(p.id)).map((p) => ({ id: p.id, name: t(p.name), hex: p.hex })),
  };
}



/* ───────────────────────── Entry point ───────────────────────── */

export function generateContent(gameId: ArcadeGameId, difficulty: Difficulty, locale: string, seed: number): GameContent {
  const game = getGame(gameId);
  const d = Math.min(5, Math.max(1, Math.round(difficulty))) as Difficulty;
  const ctx: Ctx = {
    rng: new Rng(hashString(`${gameId}:${d}:${seed}`)),
    d,
    n: game.rounds[d - 1],
    locale,
    t: (l: L) => tr(l, locale),
    fr: locale === 'fr',
  };
  switch (gameId) {
    case 'space_mission':
      return { kind: 'runner', items: genSpaceMission(ctx) };
    case 'alphabet_quest':
      return { kind: 'choice', items: genAlphabet(ctx) };
    case 'little_scientist':
      return { kind: 'choice', items: genScientist(ctx) };
    case 'number_island':
      return { kind: 'choice', items: genNumberIsland(ctx) };
    case 'geography_explorer':
      return { kind: 'choice', items: genGeography(ctx) };
    case 'dragon_academy':
      return { kind: 'choice', items: genDragon(ctx) };
    case 'memory_magic':
      return { kind: 'pairs', pairs: genMemoryMagic(ctx) };
    case 'color_lab':
      return genMix(ctx);
    case 'word_forest':
      return { kind: 'spell', words: genSpell(ctx) };
    case 'puzzle_castle':
      return { kind: 'slide', size: d >= 4 ? 4 : 3, picture: ctx.rng.pick(SLIDE_PICTURES) };
    case 'little_chef':
      return { kind: 'order', sets: genOrder(ctx, RECIPE_SETS) };
    case 'eco_world':
      return genSort(ctx, ECO_BANK);
    case 'animal_rescue':
      return genSort(ctx, ANIMAL_BANK);
  }
}
