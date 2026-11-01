/**
 * Words and pictures of the sandbox: the tools a child picks, the
 * discoveries of the notebook (with a one-sentence science explanation) and
 * the optional little challenges. French and English written by hand.
 */
import type { L } from '@/lib/i18n-text';
import { BUBBLE, CLOUD, EMPTY, HEAT, ICE, SAND, SEED, SNOW, STONE, WATER, type Reaction } from './sim';

export type ToolId = 'sand' | 'water' | 'stone' | 'seed' | 'ice' | 'snow' | 'heat' | 'cloud' | 'bubble' | 'eraser' | 'windLeft' | 'windRight';

export interface Tool {
  id: ToolId;
  emoji: string;
  name: L;
  /** What the child hears when picking it. */
  say: L;
  /** Element painted (EMPTY for the eraser); undefined for the wind. */
  element?: number;
  wind?: -1 | 1;
  /** Button colour. */
  color: string;
}

export const TOOLS: Tool[] = [
  { id: 'sand', emoji: '🏖️', element: SAND, color: '#f2c26b', name: { fr: 'Sable', en: 'Sand' }, say: { fr: 'Du sable ! Il coule et fait des tas.', en: 'Sand! It pours and makes piles.' } },
  { id: 'water', emoji: '💧', element: WATER, color: '#4aa7f5', name: { fr: 'Eau', en: 'Water' }, say: { fr: 'De l’eau ! Elle coule partout.', en: 'Water! It flows everywhere.' } },
  { id: 'stone', emoji: '🪨', element: STONE, color: '#8f8ba8', name: { fr: 'Pierre', en: 'Stone' }, say: { fr: 'De la pierre, pour construire des murs.', en: 'Stone, to build walls.' } },
  { id: 'seed', emoji: '🌰', element: SEED, color: '#a86d45', name: { fr: 'Graine', en: 'Seed' }, say: { fr: 'Des graines. Que va-t-il se passer ?', en: 'Seeds. What will happen?' } },
  { id: 'ice', emoji: '🧊', element: ICE, color: '#8fdcf7', name: { fr: 'Glace', en: 'Ice' }, say: { fr: 'De la glace, toute froide.', en: 'Ice, very cold.' } },
  { id: 'snow', emoji: '❄️', element: SNOW, color: '#cfe3f7', name: { fr: 'Neige', en: 'Snow' }, say: { fr: 'De la neige qui tombe doucement.', en: 'Snow falling gently.' } },
  { id: 'heat', emoji: '☀️', element: HEAT, color: '#ffb340', name: { fr: 'Chaleur', en: 'Warmth' }, say: { fr: 'Une lampe soleil, qui réchauffe tout autour.', en: 'A sun lamp that warms everything around it.' } },
  { id: 'cloud', emoji: '☁️', element: CLOUD, color: '#c9d6ee', name: { fr: 'Nuage', en: 'Cloud' }, say: { fr: 'Un nuage. Regarde bien dessous !', en: 'A cloud. Watch underneath!' } },
  { id: 'bubble', emoji: '🫧', element: BUBBLE, color: '#9fdcf5', name: { fr: 'Bulles', en: 'Bubbles' }, say: { fr: 'Des bulles d’air. Essaie dans l’eau !', en: 'Air bubbles. Try them in water!' } },
  { id: 'windLeft', emoji: '🌬️', wind: -1, color: '#a5b4fc', name: { fr: 'Vent ←', en: 'Wind ←' }, say: { fr: 'Le vent souffle vers la gauche.', en: 'The wind blows to the left.' } },
  { id: 'windRight', emoji: '🌬️', wind: 1, color: '#a5b4fc', name: { fr: 'Vent →', en: 'Wind →' }, say: { fr: 'Le vent souffle vers la droite.', en: 'The wind blows to the right.' } },
  { id: 'eraser', emoji: '🧽', element: EMPTY, color: '#f9a8d4', name: { fr: 'Gomme', en: 'Eraser' }, say: { fr: 'La gomme, pour effacer.', en: 'The eraser, to rub things out.' } },
];

export const toolById = (id: ToolId): Tool => TOOLS.find((t) => t.id === id) ?? TOOLS[0];

export interface Discovery {
  id: Reaction;
  /** The illustrated equation, e.g. ['🌰', '💧'] → '🌱'. */
  inputs: string[];
  output: string;
  title: L;
  /** One sentence of science, read aloud. */
  science: L;
  /** A nudge shown on the locked card. */
  hint: L;
  color: string;
}

export const DISCOVERIES: Discovery[] = [
  {
    id: 'sprout',
    inputs: ['🌰', '💧'],
    output: '🌱',
    color: '#5cbf5a',
    title: { fr: 'La graine germe !', en: 'The seed sprouts!' },
    science: { fr: 'Une graine qui boit de l’eau se réveille : une petite plante en sort et pousse vers le haut.', en: 'A seed that drinks water wakes up: a little plant comes out and grows upwards.' },
    hint: { fr: 'Une graine a soif…', en: 'A seed is thirsty…' },
  },
  {
    id: 'bloom',
    inputs: ['🌱', '☀️', '💧'],
    output: '🌸',
    color: '#ff7eb6',
    title: { fr: 'Une fleur s’ouvre !', en: 'A flower opens!' },
    science: { fr: 'Avec de la lumière et de l’eau, la plante a assez d’énergie pour faire une fleur.', en: 'With light and water, the plant has enough energy to make a flower.' },
    hint: { fr: 'Une plante aime la lumière et l’eau…', en: 'A plant loves light and water…' },
  },
  {
    id: 'melt_ice',
    inputs: ['🧊', '☀️'],
    output: '💧',
    color: '#5fc3f0',
    title: { fr: 'La glace fond !', en: 'The ice melts!' },
    science: { fr: 'La chaleur fait fondre la glace : l’eau solide redevient liquide.', en: 'Warmth melts ice: solid water turns back into liquid.' },
    hint: { fr: 'Que faire avec de la glace ?', en: 'What can you do with ice?' },
  },
  {
    id: 'melt_snow',
    inputs: ['❄️', '☀️'],
    output: '💧',
    color: '#9ec9f2',
    title: { fr: 'La neige fond !', en: 'The snow melts!' },
    science: { fr: 'La neige, ce sont de minuscules cristaux de glace : avec la chaleur, ils fondent en eau.', en: 'Snow is made of tiny ice crystals: when warmed, they melt into water.' },
    hint: { fr: 'La neige n’aime pas avoir chaud…', en: 'Snow doesn’t like being warm…' },
  },
  {
    id: 'evaporate',
    inputs: ['💧', '☀️'],
    output: '♨️',
    color: '#f59e8b',
    title: { fr: 'L’eau s’évapore !', en: 'The water evaporates!' },
    science: { fr: 'Quand on chauffe de l’eau, elle devient de la vapeur : un gaz léger qui s’envole.', en: 'When water is heated it turns into steam: a light gas that floats away.' },
    hint: { fr: 'Et si on réchauffait de l’eau ?', en: 'What if you warmed some water?' },
  },
  {
    id: 'condense',
    inputs: ['♨️', '⬆️'],
    output: '☁️',
    color: '#94a3d8',
    title: { fr: 'Un nuage se forme !', en: 'A cloud forms!' },
    science: { fr: 'En montant, la vapeur se refroidit et se change en gouttelettes : c’est un nuage.', en: 'As steam rises it cools down into tiny droplets: that is a cloud.' },
    hint: { fr: 'Où va la vapeur ?', en: 'Where does steam go?' },
  },
  {
    id: 'rain',
    inputs: ['☁️', '💧'],
    output: '🌧️',
    color: '#5b8def',
    title: { fr: 'Il pleut !', en: 'It’s raining!' },
    science: { fr: 'Les gouttelettes du nuage s’assemblent, deviennent lourdes et tombent : c’est la pluie.', en: 'The droplets in a cloud join together, get heavy and fall: that is rain.' },
    hint: { fr: 'Un nuage cache quelque chose…', en: 'A cloud is hiding something…' },
  },
  {
    id: 'sink',
    inputs: ['🏖️', '💧'],
    output: '⬇️',
    color: '#e0a94f',
    title: { fr: 'Le sable coule !', en: 'Sand sinks!' },
    science: { fr: 'Le sable est plus lourd que l’eau : il traverse l’eau et se pose au fond.', en: 'Sand is heavier than water: it goes through the water and settles at the bottom.' },
    hint: { fr: 'Le sable flotte-t-il ?', en: 'Does sand float?' },
  },
  {
    id: 'bubble',
    inputs: ['🫧', '💧'],
    output: '⬆️',
    color: '#4fc9c0',
    title: { fr: 'Les bulles remontent !', en: 'Bubbles rise!' },
    science: { fr: 'L’air est bien plus léger que l’eau : les bulles remontent jusqu’à la surface.', en: 'Air is much lighter than water: bubbles rise up to the surface.' },
    hint: { fr: 'Des bulles… sous l’eau ?', en: 'Bubbles… under water?' },
  },
  {
    id: 'wind',
    inputs: ['🌬️', '🏖️'],
    output: '🏜️',
    color: '#a78bfa',
    title: { fr: 'Le vent pousse le sable !', en: 'The wind pushes the sand!' },
    science: { fr: 'Le vent soulève et pousse les grains légers : c’est ainsi que naissent les dunes.', en: 'Wind lifts and pushes light grains: that is how dunes are born.' },
    hint: { fr: 'Souffle sur un tas…', en: 'Blow on a pile…' },
  },
];

export const discoveryById = (id: Reaction): Discovery | undefined => DISCOVERIES.find((d) => d.id === id);

export type ChallengeId = 'flowers' | 'melt' | 'cloud' | 'rain';

export interface Challenge {
  id: ChallengeId;
  emoji: string;
  title: L;
  /** Done when this reaction has happened `target` times. */
  reaction: Reaction;
  target: number;
}

export const CHALLENGES: Challenge[] = [
  { id: 'flowers', emoji: '🌸', reaction: 'bloom', target: 3, title: { fr: 'Fais pousser 3 fleurs', en: 'Grow 3 flowers' } },
  { id: 'melt', emoji: '🧊', reaction: 'melt_ice', target: 1, title: { fr: 'Transforme la glace en eau', en: 'Turn ice into water' } },
  { id: 'cloud', emoji: '☁️', reaction: 'condense', target: 1, title: { fr: 'Fabrique un nuage', en: 'Make a cloud' } },
  { id: 'rain', emoji: '🌧️', reaction: 'rain', target: 1, title: { fr: 'Fais pleuvoir', en: 'Make it rain' } },
];

export const SCENE_INFO = {
  jardin: { emoji: '🌷', name: { fr: 'Jardin', en: 'Garden' } },
  montagne: { emoji: '🏔️', name: { fr: 'Montagne enneigée', en: 'Snowy mountain' } },
  iles: { emoji: '🏝️', name: { fr: 'Îles', en: 'Islands' } },
} satisfies Record<string, { emoji: string; name: L }>;

export const BRUSHES = [
  { id: 'S', radius: 1.2, dot: 8, name: { fr: 'Petit pinceau', en: 'Small brush' } },
  { id: 'M', radius: 3, dot: 14, name: { fr: 'Pinceau moyen', en: 'Medium brush' } },
  { id: 'L', radius: 6, dot: 20, name: { fr: 'Gros pinceau', en: 'Big brush' } },
] as const;
export type BrushId = (typeof BRUSHES)[number]['id'];
