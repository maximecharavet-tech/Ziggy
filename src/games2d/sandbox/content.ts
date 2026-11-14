/**
 * Words and pictures of the sandbox: the eight worlds, the tools a child
 * picks, the discoveries of the notebook (each with a one-sentence science
 * truth, read aloud) and the optional little challenges. French and English
 * written by hand. Element and reaction ids come from the engine's data file
 * (./wasm/ids.ts, generated): they are stored on children's devices.
 */
import type { L } from '@/lib/i18n-text';
import { EL, REACTIONS, type ElementKey, type Reaction } from './wasm/ids';

export { EL, REACTIONS, type ElementKey, type Reaction };

/* ── Worlds ───────────────────────────────────────────────────────────── */

export const WORLDS = ['garden', 'mountain', 'islands', 'volcano', 'undersea', 'space', 'moon', 'mars'] as const;
export type WorldId = (typeof WORLDS)[number];
export const worldIndex = (w: WorldId) => WORLDS.indexOf(w);

export interface WorldInfo {
  id: WorldId;
  emoji: string;
  name: L;
  /** The resident, read on the world card. */
  critter: L;
  critterEmoji: string;
  /** One line on the card, read aloud when the world opens. */
  hello: L;
  /** Card gradient. */
  colors: [string, string];
  /** The six big tools for the little ones. */
  big: ToolId[];
}

export const WORLD_INFO: Record<WorldId, WorldInfo> = {
  garden: {
    id: 'garden',
    emoji: '🌷',
    name: { fr: 'Jardin', en: 'Garden' },
    critter: { fr: 'Escargot', en: 'Snail' },
    critterEmoji: '🐌',
    hello: { fr: 'Bienvenue au jardin ! L’escargot adore les flaques.', en: 'Welcome to the garden! The snail loves puddles.' },
    colors: ['#8fd16a', '#4aa7f5'],
    big: ['water', 'seed', 'sand', 'heat', 'soil', 'ink'],
  },
  mountain: {
    id: 'mountain',
    emoji: '🏔️',
    name: { fr: 'Montagne', en: 'Mountain' },
    critter: { fr: 'Marmotte', en: 'Marmot' },
    critterEmoji: '🦫',
    hello: { fr: 'La montagne ! La marmotte siffle quand elle est contente.', en: 'The mountain! The marmot whistles when she is happy.' },
    colors: ['#b8b4f0', '#f2c4dc'],
    big: ['snow', 'water', 'heat', 'crystal', 'pebble', 'fog'],
  },
  islands: {
    id: 'islands',
    emoji: '🏝️',
    name: { fr: 'Îles', en: 'Islands' },
    critter: { fr: 'Crabe', en: 'Crab' },
    critterEmoji: '🦀',
    hello: { fr: 'Les îles ! Le crabe porte comme chapeau tout ce qui lui tombe dessus.', en: 'The islands! The crab wears whatever falls on it as a hat.' },
    colors: ['#38b8e8', '#ffd98a'],
    big: ['sand', 'water', 'salt', 'coconut', 'shell', 'heat'],
  },
  volcano: {
    id: 'volcano',
    emoji: '🌋',
    name: { fr: 'Volcan', en: 'Volcano' },
    critter: { fr: 'Bloup', en: 'Bloup' },
    critterEmoji: '🟠',
    hello: { fr: 'Le volcan ! Ici la lave est une confiture tiède. Bloup adore y faire la sieste.', en: 'The volcano! Here lava is warm jam. Bloup loves napping in it.' },
    colors: ['#6a2448', '#ff8a24'],
    big: ['lava', 'water', 'sand', 'bubble', 'snow', 'seed'],
  },
  undersea: {
    id: 'undersea',
    emoji: '🐠',
    name: { fr: 'Fond de la mer', en: 'Undersea' },
    critter: { fr: 'Poisson-globe', en: 'Pufferfish' },
    critterEmoji: '🐡',
    hello: { fr: 'Sous la mer ! Le poisson-globe se gonfle quand les bulles le chatouillent.', en: 'Under the sea! The pufferfish puffs up when bubbles tickle it.' },
    colors: ['#1c9fc0', '#1a2f78'],
    big: ['plankton', 'bubble', 'sand', 'coral', 'kelp', 'shell'],
  },
  space: {
    id: 'space',
    emoji: '🪐',
    name: { fr: 'Espace', en: 'Space' },
    critter: { fr: 'Petit extraterrestre', en: 'Little alien' },
    critterEmoji: '👽',
    hello: { fr: 'L’espace ! Ici il n’y a pas de bas : tout tombe vers les boules de gravité.', en: 'Space! There is no down here: everything falls towards the gravity balls.' },
    colors: ['#2a0f4a', '#c94fd0'],
    big: ['stardust', 'gas', 'gravity', 'water', 'comet', 'ice'],
  },
  moon: {
    id: 'moon',
    emoji: '🌙',
    name: { fr: 'Lune', en: 'Moon' },
    critter: { fr: 'Lapin de lune', en: 'Moon bunny' },
    critterEmoji: '🐰',
    hello: { fr: 'La Lune ! Tout tombe tout doucement, et le lapin fait des bonds immenses.', en: 'The Moon! Everything falls very slowly, and the bunny makes enormous hops.' },
    colors: ['#1a2038', '#cfd2dc'],
    big: ['moondust', 'meteorite', 'water', 'bubble', 'stone', 'heat'],
  },
  mars: {
    id: 'mars',
    emoji: '🔴',
    name: { fr: 'Mars', en: 'Mars' },
    critter: { fr: 'Petit robot', en: 'Little rover' },
    critterEmoji: '🤖',
    hello: { fr: 'Mars ! Le petit robot dit « bip ? » et collectionne les cailloux.', en: 'Mars! The little rover says “bip?” and collects pebbles.' },
    colors: ['#d8a060', '#b0583a'],
    big: ['reddust', 'dryice', 'dome', 'seed', 'water', 'soil'],
  },
};

/* ── Tools ────────────────────────────────────────────────────────────── */

export type ToolCategory = 'earth' | 'water' | 'life' | 'warm' | 'sky' | 'build' | 'magic';

export const CATEGORY_INFO: Record<ToolCategory, { emoji: string; name: L }> = {
  earth: { emoji: '🏖️', name: { fr: 'Terre et sable', en: 'Earth and sand' } },
  water: { emoji: '💧', name: { fr: 'Eau et froid', en: 'Water and cold' } },
  life: { emoji: '🌱', name: { fr: 'Vivant', en: 'Living things' } },
  warm: { emoji: '☀️', name: { fr: 'Chaleur', en: 'Warmth' } },
  sky: { emoji: '✨', name: { fr: 'Ciel et étoiles', en: 'Sky and stars' } },
  build: { emoji: '🧱', name: { fr: 'Construire', en: 'Build' } },
  magic: { emoji: '🪄', name: { fr: 'Outils magiques', en: 'Magic tools' } },
};

export type ToolId = ElementKey | 'eraser' | 'windLeft' | 'windRight' | 'critter' | 'beam' | 'rainbowSeed' | 'baby' | 'pocketStar' | 'toy';

export interface Tool {
  id: ToolId;
  emoji: string;
  name: L;
  /** What the child hears when picking it. */
  say: L;
  category: ToolCategory;
  /** Element painted (0 for the eraser). */
  element?: number;
  wind?: -1 | 1;
  color: string;
}

const T = (
  id: ToolId,
  category: ToolCategory,
  emoji: string,
  color: string,
  fr: string,
  en: string,
  sayFr: string,
  sayEn: string,
  extra: Partial<Tool> = {},
): Tool => ({ id, category, emoji, color, name: { fr, en }, say: { fr: sayFr, en: sayEn }, element: id in EL ? EL[id as ElementKey] : undefined, ...extra });

export const TOOLS: Tool[] = [
  // The twelve tools of the first sandbox, same words.
  T('sand', 'earth', '🏖️', '#f2c26b', 'Sable', 'Sand', 'Du sable ! Il coule et fait des tas.', 'Sand! It pours and makes piles.'),
  T('water', 'water', '💧', '#4aa7f5', 'Eau', 'Water', 'De l’eau ! Elle coule partout.', 'Water! It flows everywhere.'),
  T('stone', 'build', '🪨', '#8f8ba8', 'Pierre', 'Stone', 'De la pierre, pour construire des murs.', 'Stone, to build walls.'),
  T('seed', 'life', '🌰', '#a86d45', 'Graine', 'Seed', 'Des graines. Que va-t-il se passer ?', 'Seeds. What will happen?'),
  T('ice', 'water', '🧊', '#8fdcf7', 'Glace', 'Ice', 'De la glace, toute froide.', 'Ice, very cold.'),
  T('snow', 'water', '❄️', '#cfe3f7', 'Neige', 'Snow', 'De la neige qui tombe doucement.', 'Snow falling gently.'),
  T('heat', 'warm', '☀️', '#ffb340', 'Chaleur', 'Warmth', 'Une lampe soleil, qui réchauffe tout autour.', 'A sun lamp that warms everything around it.'),
  T('cloud', 'water', '☁️', '#c9d6ee', 'Nuage', 'Cloud', 'Un nuage. Regarde bien dessous !', 'A cloud. Watch underneath!'),
  T('bubble', 'water', '🫧', '#9fdcf5', 'Bulles', 'Bubbles', 'Des bulles d’air. Essaie dans l’eau !', 'Air bubbles. Try them in water!'),
  T('windLeft', 'magic', '🌬️', '#a5b4fc', 'Vent ←', 'Wind ←', 'Le vent souffle vers la gauche.', 'The wind blows to the left.', { wind: -1 }),
  T('windRight', 'magic', '🌬️', '#a5b4fc', 'Vent →', 'Wind →', 'Le vent souffle vers la droite.', 'The wind blows to the right.', { wind: 1 }),
  T('eraser', 'magic', '🧽', '#f9a8d4', 'Gomme', 'Eraser', 'La gomme, pour effacer.', 'The eraser, to rub things out.', { element: 0 }),
  // New elements.
  T('soil', 'earth', '🟫', '#8a5a38', 'Terre', 'Soil', 'De la terre, une éponge pour l’eau.', 'Soil, a sponge for water.'),
  T('mud', 'earth', '🟤', '#6a4630', 'Boue', 'Mud', 'De la boue toute molle.', 'Soft, squishy mud.'),
  T('pollen', 'life', '🌼', '#ffe066', 'Pollen', 'Pollen', 'Du pollen, la poudre dorée des fleurs.', 'Pollen, the golden dust of flowers.'),
  T('ink', 'water', '🎨', '#8b3ff0', 'Couleur', 'Colour', 'De la couleur. Verse-la dans l’eau !', 'Colour. Pour it into water!'),
  T('crystal', 'build', '💎', '#c9a9ff', 'Cristal', 'Crystal', 'Un cristal qui grandit et attrape la lumière.', 'A crystal that grows and catches the light.'),
  T('fog', 'water', '🌫️', '#dfe6f0', 'Brouillard', 'Fog', 'Du brouillard qui flotte tout bas.', 'Fog that floats down low.'),
  T('pebble', 'earth', '🥔', '#a59d95', 'Galets', 'Pebbles', 'Des galets tout ronds qui roulent.', 'Round pebbles that roll.'),
  T('wetsand', 'earth', '🏰', '#cfa860', 'Sable mouillé', 'Wet sand', 'Du sable mouillé, parfait pour les châteaux.', 'Wet sand, perfect for castles.'),
  T('salt', 'earth', '🧂', '#ffffff', 'Sel', 'Salt', 'Du sel. Que fait-il dans l’eau ?', 'Salt. What does it do in water?'),
  T('coconut', 'life', '🥥', '#8a5530', 'Noix de coco', 'Coconut', 'Une noix de coco qui flotte.', 'A coconut that floats.'),
  T('lava', 'warm', '🔥', '#ff8a24', 'Lave', 'Lava', 'De la lave, une confiture chaude et lente.', 'Lava, a slow warm jam.'),
  T('ash', 'earth', '🌑', '#a5a3b0', 'Cendre', 'Ash', 'De la cendre, légère comme une plume.', 'Ash, light as a feather.'),
  T('geyser', 'warm', '⛲', '#c2603f', 'Roche chaude', 'Hot rock', 'Une roche chaude. Mets de l’eau dessus !', 'A hot rock. Put water on it!'),
  T('glass', 'build', '🪟', '#d4f2ff', 'Verre', 'Glass', 'Du verre transparent pour construire.', 'Clear glass to build with.'),
  T('coral', 'life', '🪸', '#ff7f9a', 'Corail', 'Coral', 'Du corail qui pousse vers la lumière.', 'Coral that grows towards the light.'),
  T('kelp', 'life', '🌿', '#3fa860', 'Algue', 'Kelp', 'Une algue qui grandit dans l’eau.', 'Kelp that grows in water.'),
  T('plankton', 'life', '🦠', '#6fdfe8', 'Plancton', 'Plankton', 'Du plancton. Remue-le avec le doigt !', 'Plankton. Stir it with your finger!'),
  T('shell', 'life', '🐚', '#ffe6d2', 'Coquillage', 'Shell', 'Un coquillage. Un grain de sable dedans ?', 'A shell. A grain of sand inside?'),
  T('stardust', 'sky', '✨', '#ffe9a8', 'Poussière d’étoile', 'Stardust', 'De la poussière d’étoile qui scintille.', 'Twinkling stardust.'),
  T('gas', 'sky', '🌌', '#ff8ad8', 'Gaz de nébuleuse', 'Nebula gas', 'Du gaz coloré de nébuleuse.', 'Colourful nebula gas.'),
  T('gravity', 'sky', '🔮', '#8a6cff', 'Boule de gravité', 'Gravity ball', 'Une boule de gravité : tout tombe vers elle.', 'A gravity ball: everything falls towards it.'),
  T('comet', 'sky', '☄️', '#cfeeff', 'Comète', 'Comet', 'Une comète, une boule de glace qui voyage.', 'A comet, a travelling ball of ice.'),
  T('moondust', 'earth', '🌕', '#cfd2dc', 'Poussière de Lune', 'Moon dust', 'De la poussière de Lune qui garde les traces.', 'Moon dust that keeps every print.'),
  T('meteorite', 'sky', '🌠', '#75687a', 'Caillou de l’espace', 'Space pebble', 'Un caillou de l’espace. Lâche-le de haut !', 'A space pebble. Drop it from high up!'),
  T('reddust', 'earth', '🟠', '#de7640', 'Poussière rouge', 'Red dust', 'De la poussière rouge de Mars.', 'Red dust from Mars.'),
  T('dryice', 'water', '🧊', '#eef6ff', 'Glace sèche', 'Dry ice', 'De la glace sèche, très très froide.', 'Dry ice, very very cold.'),
  T('dome', 'build', '🫙', '#b4f2dc', 'Dôme', 'Dome', 'Un dôme de verre qui garde la chaleur.', 'A glass dome that keeps the warmth in.'),
  T('pipe', 'build', '🚰', '#f5a93c', 'Tuyau', 'Pipe', 'Un tuyau : il emmène l’eau ailleurs.', 'A pipe: it carries water somewhere else.'),
  // Magic tools.
  T('critter', 'magic', '🐾', '#ffd447', 'Ami', 'Friend', 'Un petit ami de ce monde.', 'A little friend from this world.'),
  T('beam', 'magic', '🛸', '#7affc8', 'Rayon de Ziggy', 'Ziggy’s beam', 'Le rayon de la soucoupe soulève et déplace.', 'The saucer’s beam lifts and moves things.'),
  T('rainbowSeed', 'magic', '🌈', '#ff7eb6', 'Graine arc-en-ciel', 'Rainbow seed', 'Une graine arc-en-ciel, cadeau du colis.', 'A rainbow seed, a gift from the parcel.'),
  T('baby', 'magic', '🐣', '#ffd447', 'Bébé', 'Baby', 'Un bébé qui suit ton doigt.', 'A baby that follows your finger.'),
  T('pocketStar', 'magic', '⭐', '#fff2a0', 'Étoile de poche', 'Pocket star', 'Une petite étoile à poser où tu veux.', 'A tiny star to put wherever you like.'),
  T('toy', 'magic', '🎁', '#ffb340', 'Jouet du colis', 'Parcel toy', 'Le jouet trouvé dans le colis.', 'The toy found in the parcel.'),
];

export const toolById = (id: ToolId): Tool => TOOLS.find((t) => t.id === id) ?? TOOLS[0];

/** Tools only available after Ziggy's parcel gave them. */
export const GIFT_TOOLS: Partial<Record<ToolId, Reaction>> = { rainbowSeed: 'gift_water', baby: 'gift_warm', pocketStar: 'gift_lowg' };

/** The tools of the drawer for a world: its own first, then the rest, by category. */
export function drawerTools(world: WorldId): Tool[] {
  const big = new Set(WORLD_INFO[world].big);
  const own = new Set<ToolId>(OWN[world]);
  return [...TOOLS].sort((a, b) => Number(own.has(b.id) || big.has(b.id)) - Number(own.has(a.id) || big.has(a.id)));
}

const OWN: Record<WorldId, ToolId[]> = {
  garden: ['soil', 'pollen', 'ink', 'cloud'],
  mountain: ['ice', 'crystal', 'fog', 'pebble'],
  islands: ['wetsand', 'salt', 'coconut', 'shell'],
  volcano: ['lava', 'ash', 'geyser', 'glass'],
  undersea: ['coral', 'kelp', 'plankton', 'shell'],
  space: ['stardust', 'gas', 'gravity', 'comet'],
  moon: ['moondust', 'meteorite'],
  mars: ['reddust', 'dryice', 'dome', 'pipe'],
};

/* ── Discoveries ──────────────────────────────────────────────────────── */

export interface Discovery {
  id: Reaction;
  /** The world it belongs to in the notebook. */
  world: WorldId;
  /** The illustrated equation, e.g. ['🌰', '💧'] → '🌱'. */
  inputs: string[];
  output: string;
  title: L;
  /** One sentence of science, read aloud. */
  science: L;
  /** A nudge shown on the locked card. */
  hint: L;
  color: string;
  /** A surprise from Ziggy's parcel (a sticker in the album). */
  gift?: boolean;
}

const D = (id: Reaction, world: WorldId, inputs: string[], output: string, color: string, title: L, science: L, hint: L, gift = false): Discovery => ({ id, world, inputs, output, color, title, science, hint, gift });

export const DISCOVERIES: Discovery[] = [
  // The ten discoveries of the first sandbox (same words).
  D('sprout', 'garden', ['🌰', '💧'], '🌱', '#5cbf5a', { fr: 'La graine germe !', en: 'The seed sprouts!' }, { fr: 'Une graine qui boit de l’eau se réveille : une petite plante en sort et pousse vers le haut.', en: 'A seed that drinks water wakes up: a little plant comes out and grows upwards.' }, { fr: 'Une graine a soif…', en: 'A seed is thirsty…' }),
  D('bloom', 'garden', ['🌱', '☀️', '💧'], '🌸', '#ff7eb6', { fr: 'Une fleur s’ouvre !', en: 'A flower opens!' }, { fr: 'Avec de la lumière et de l’eau, la plante a assez d’énergie pour faire une fleur.', en: 'With light and water, the plant has enough energy to make a flower.' }, { fr: 'Une plante aime la lumière et l’eau…', en: 'A plant loves light and water…' }),
  D('melt_ice', 'mountain', ['🧊', '☀️'], '💧', '#5fc3f0', { fr: 'La glace fond !', en: 'The ice melts!' }, { fr: 'La chaleur fait fondre la glace : l’eau solide redevient liquide.', en: 'Warmth melts ice: solid water turns back into liquid.' }, { fr: 'Que faire avec de la glace ?', en: 'What can you do with ice?' }),
  D('melt_snow', 'mountain', ['❄️', '☀️'], '💧', '#9ec9f2', { fr: 'La neige fond !', en: 'The snow melts!' }, { fr: 'La neige, ce sont de minuscules cristaux de glace : avec la chaleur, ils fondent en eau.', en: 'Snow is made of tiny ice crystals: when warmed, they melt into water.' }, { fr: 'La neige n’aime pas avoir chaud…', en: 'Snow doesn’t like being warm…' }),
  D('evaporate', 'garden', ['💧', '☀️'], '♨️', '#f59e8b', { fr: 'L’eau s’évapore !', en: 'The water evaporates!' }, { fr: 'Quand on chauffe de l’eau, elle devient de la vapeur : un gaz léger qui s’envole.', en: 'When water is heated it turns into steam: a light gas that floats away.' }, { fr: 'Et si on réchauffait de l’eau ?', en: 'What if you warmed some water?' }),
  D('condense', 'garden', ['♨️', '⬆️'], '☁️', '#94a3d8', { fr: 'Un nuage se forme !', en: 'A cloud forms!' }, { fr: 'En montant, la vapeur se refroidit et se change en gouttelettes : c’est un nuage.', en: 'As steam rises it cools down into tiny droplets: that is a cloud.' }, { fr: 'Où va la vapeur ?', en: 'Where does steam go?' }),
  D('rain', 'garden', ['☁️', '💧'], '🌧️', '#5b8def', { fr: 'Il pleut !', en: 'It’s raining!' }, { fr: 'Les gouttelettes du nuage s’assemblent, deviennent lourdes et tombent : c’est la pluie.', en: 'The droplets in a cloud join together, get heavy and fall: that is rain.' }, { fr: 'Un nuage cache quelque chose…', en: 'A cloud is hiding something…' }),
  D('sink', 'islands', ['🏖️', '💧'], '⬇️', '#e0a94f', { fr: 'Le sable coule !', en: 'Sand sinks!' }, { fr: 'Le sable est plus lourd que l’eau : il traverse l’eau et se pose au fond.', en: 'Sand is heavier than water: it goes through the water and settles at the bottom.' }, { fr: 'Le sable flotte-t-il ?', en: 'Does sand float?' }),
  D('bubble', 'undersea', ['🫧', '💧'], '⬆️', '#4fc9c0', { fr: 'Les bulles remontent !', en: 'Bubbles rise!' }, { fr: 'L’air est bien plus léger que l’eau : les bulles remontent jusqu’à la surface.', en: 'Air is much lighter than water: bubbles rise up to the surface.' }, { fr: 'Des bulles… sous l’eau ?', en: 'Bubbles… under water?' }),
  D('wind', 'islands', ['🌬️', '🏖️'], '🏜️', '#a78bfa', { fr: 'Le vent pousse le sable !', en: 'The wind pushes the sand!' }, { fr: 'Le vent soulève et pousse les grains légers : c’est ainsi que naissent les dunes.', en: 'Wind lifts and pushes light grains: that is how dunes are born.' }, { fr: 'Souffle sur un tas…', en: 'Blow on a pile…' }),

  // Garden.
  D('mud', 'garden', ['🟫', '💧'], '🟤', '#8a5a38', { fr: 'De la boue !', en: 'Mud!' }, { fr: 'La terre garde l’eau comme une éponge : elle devient de la boue.', en: 'Soil holds water like a sponge: it turns into mud.' }, { fr: 'De la terre qui boit…', en: 'Soil that drinks…' }),
  D('rainbow', 'garden', ['🌧️', '☀️'], '🌈', '#ff7eb6', { fr: 'Un arc-en-ciel !', en: 'A rainbow!' }, { fr: 'Les gouttes de pluie séparent la lumière du soleil en toutes ses couleurs.', en: 'Raindrops split sunlight into all its colours.' }, { fr: 'De la pluie au soleil…', en: 'Rain in the sunshine…' }),
  D('pollinate', 'garden', ['🌸', '🌬️'], '🌰', '#ffe066', { fr: 'Le pollen voyage !', en: 'Pollen travels!' }, { fr: 'Le pollen d’une fleur qui arrive sur une autre fleur fait une nouvelle graine.', en: 'Pollen from one flower that reaches another flower makes a new seed.' }, { fr: 'Du vent sur les fleurs…', en: 'Wind on the flowers…' }),
  D('cactus', 'garden', ['🌰', '🏖️', '💧'], '🌵', '#3fa86a', { fr: 'Un cactus !', en: 'A cactus!' }, { fr: 'Sur le sable sec, les plantes deviennent des cactus qui gardent l’eau en eux.', en: 'On dry sand, plants become cacti that store water inside.' }, { fr: 'Une graine dans le sable…', en: 'A seed in the sand…' }),
  D('reed', 'garden', ['🌰', '🟤'], '🎋', '#9ab84a', { fr: 'Un roseau !', en: 'A reed!' }, { fr: 'Dans la boue pousse le roseau, une plante qui aime avoir les pieds mouillés.', en: 'Reeds grow in mud: plants that like wet feet.' }, { fr: 'Une graine dans la boue…', en: 'A seed in the mud…' }),
  D('tint', 'garden', ['🎨', '💧'], '🌊', '#8b3ff0', { fr: 'L’eau se colore !', en: 'The water changes colour!' }, { fr: 'Les liquides se mélangent tout seuls : la couleur se répand dans l’eau.', en: 'Liquids mix by themselves: the colour spreads through the water.' }, { fr: 'De la couleur dans l’eau…', en: 'Colour in the water…' }),
  D('recolor', 'garden', ['🌸', '🎨'], '🌺', '#e0348a', { fr: 'La fleur change de couleur !', en: 'The flower changes colour!' }, { fr: 'La tige boit l’eau jusqu’en haut : la couleur monte jusqu’aux pétales.', en: 'The stem drinks water all the way up: the colour climbs to the petals.' }, { fr: 'Une plante boit de l’eau colorée…', en: 'A plant drinks coloured water…' }),
  D('shimmer', 'garden', ['🫧', '☀️'], '🌈', '#ff9ad8', { fr: 'La bulle brille !', en: 'The bubble shimmers!' }, { fr: 'La peau très fine d’une bulle sépare la lumière en couleurs, puis… pop !', en: 'The very thin skin of a bubble splits light into colours, then… pop!' }, { fr: 'Une bulle près du soleil…', en: 'A bubble near the sun…' }),

  // Mountain.
  D('avalanche', 'mountain', ['❄️', '⛰️'], '🏂', '#cfe3f7', { fr: 'Une petite avalanche !', en: 'A little snow slide!' }, { fr: 'Un tas trop pointu ne tient pas : il glisse jusqu’à une pente plus douce.', en: 'A pile that is too steep cannot stay: it slides down to a gentler slope.' }, { fr: 'Un très haut tas de neige…', en: 'A very tall pile of snow…' }),
  D('icicle', 'mountain', ['💧', '🧊'], '🧊', '#a9e3fa', { fr: 'Une stalactite de glace !', en: 'An icicle!' }, { fr: 'L’eau qui coule sur la glace gèle couche après couche.', en: 'Water running over ice freezes layer by layer.' }, { fr: 'De l’eau qui coule sur la glace…', en: 'Water dripping over ice…' }),
  D('crack', 'mountain', ['💧', '🪨', '❄️'], '🥔', '#a59d95', { fr: 'La glace casse la pierre !', en: 'Ice splits the rock!' }, { fr: 'En gelant, l’eau prend plus de place : elle fend la roche en galets.', en: 'Freezing water takes more room: it splits rock into pebbles.' }, { fr: 'De l’eau dans une fente, puis du froid…', en: 'Water in a crack, then cold…' }),
  D('grind', 'mountain', ['🥔', '🌊'], '🏖️', '#e0b060', { fr: 'Le galet devient sable !', en: 'The pebble becomes sand!' }, { fr: 'La rivière roule et use les galets jusqu’à en faire du sable.', en: 'Rivers roll and wear pebbles down into sand.' }, { fr: 'Des galets dans une rivière…', en: 'Pebbles in a river…' }),
  D('prism', 'mountain', ['💎', '☀️'], '🌈', '#c9a9ff', { fr: 'Le cristal fait un arc-en-ciel !', en: 'The crystal makes a rainbow!' }, { fr: 'Un cristal plie la lumière et la sépare en couleurs.', en: 'A crystal bends light and splits it into colours.' }, { fr: 'Un cristal et de la lumière…', en: 'A crystal and some light…' }),
  D('frost', 'mountain', ['🌫️', '🌱'], '❄️', '#d6ecff', { fr: 'Du givre !', en: 'Frost!' }, { fr: 'Le brouillard froid gèle directement sur les plantes : c’est le givre.', en: 'Cold fog freezes straight onto plants: that is frost.' }, { fr: 'Du brouillard sur une plante, au froid…', en: 'Fog on a plant, in the cold…' }),
  D('erode', 'mountain', ['🌊', '🏖️'], '🏞️', '#4aa7f5', { fr: 'La rivière creuse !', en: 'The river carves!' }, { fr: 'L’eau qui coule emporte le sable : c’est ainsi que se creusent les vallées.', en: 'Flowing water carries sand away: that is how valleys are carved.' }, { fr: 'Un ruisseau sur du sable…', en: 'A stream over sand…' }),
  D('drift', 'mountain', ['🌬️', '❄️'], '🌨️', '#cfe3f7', { fr: 'Le vent pousse la neige !', en: 'The wind pushes the snow!' }, { fr: 'Le vent déplace les choses légères comme la neige.', en: 'Wind moves light things like snow.' }, { fr: 'Souffle sur la neige…', en: 'Blow on the snow…' }),
  D('crystal_grow', 'mountain', ['💎', '💧'], '💎', '#b48cff', { fr: 'Le cristal grandit !', en: 'The crystal grows!' }, { fr: 'Un cristal grandit couche après couche avec ce qui est dissous dans l’eau.', en: 'A crystal grows layer by layer from what is dissolved in water.' }, { fr: 'Un cristal dans l’eau…', en: 'A crystal in water…' }),

  // Islands.
  D('castle', 'islands', ['🏖️', '💧'], '🏰', '#cfa860', { fr: 'Du sable à château !', en: 'Castle sand!' }, { fr: 'Un peu d’eau colle les grains entre eux : le sable tient debout.', en: 'A little water glues the grains together: the sand stands up.' }, { fr: 'Du sable et juste un peu d’eau…', en: 'Sand and just a little water…' }),
  D('dissolve', 'islands', ['🧂', '💧'], '🌊', '#3fc0c8', { fr: 'Le sel disparaît !', en: 'The salt disappears!' }, { fr: 'Le sel se dissout dans l’eau : on ne le voit plus, mais l’eau devient salée.', en: 'Salt dissolves in water: you can’t see it any more, but the water turns salty.' }, { fr: 'Du sel dans l’eau…', en: 'Salt in water…' }),
  D('salt_crust', 'islands', ['🌊', '☀️'], '🧂', '#ffffff', { fr: 'Le sel revient !', en: 'The salt comes back!' }, { fr: 'Seule l’eau s’évapore : le sel reste et fait une croûte blanche.', en: 'Only the water evaporates: the salt stays behind as a white crust.' }, { fr: 'Chauffe de l’eau salée…', en: 'Warm some salty water…' }),
  D('salt_melt', 'islands', ['🧂', '🧊'], '💧', '#8fdcf7', { fr: 'Le sel fait fondre la glace !', en: 'Salt melts the ice!' }, { fr: 'Le sel empêche l’eau de geler : la glace fond même sans chaleur.', en: 'Salt stops water from freezing: ice melts even without warmth.' }, { fr: 'Du sel sur la glace…', en: 'Salt on ice…' }),
  D('palm', 'islands', ['🥥', '🌊', '🏖️'], '🌴', '#3fa860', { fr: 'Un palmier !', en: 'A palm tree!' }, { fr: 'Les noix de coco voyagent sur la mer et poussent là où elles s’échouent.', en: 'Coconuts travel by sea and grow where they wash ashore.' }, { fr: 'Une noix de coco dans la mer…', en: 'A coconut in the sea…' }),
  D('waves', 'islands', ['🌬️', '🌊'], '🌊', '#2f7fe0', { fr: 'Des vagues !', en: 'Waves!' }, { fr: 'Le vent pousse la surface de l’eau et fait des vagues.', en: 'Wind pushes the surface of the water into waves.' }, { fr: 'Souffle sur la mer…', en: 'Blow on the sea…' }),
  D('float', 'islands', ['🥥', '💧'], '⬆️', '#8a5530', { fr: 'Ça flotte !', en: 'It floats!' }, { fr: 'Ce qui est plus léger que l’eau remonte et flotte à la surface.', en: 'Things lighter than water rise and float on the surface.' }, { fr: 'Qu’est-ce qui flotte ?', en: 'What floats?' }),
  D('shell_sand', 'islands', ['🐚', '🌊'], '🏖️', '#ffe6d2', { fr: 'Du sable de coquillages !', en: 'Shell sand!' }, { fr: 'Les vagues usent les coquillages : une partie du sable des plages vient d’eux.', en: 'Waves wear shells down: part of beach sand comes from them.' }, { fr: 'Des vagues sur un coquillage…', en: 'Waves on a shell…' }),

  // Volcano.
  D('melt_rock', 'volcano', ['🪨', '☀️☀️'], '🔥', '#ff8a24', { fr: 'La pierre fond !', en: 'The rock melts!' }, { fr: 'Très très chaude, la roche fond et devient de la lave.', en: 'When very, very hot, rock melts into lava.' }, { fr: 'Beaucoup de chaleur sur une pierre…', en: 'Lots of warmth on a stone…' }),
  D('new_rock', 'volcano', ['🔥', '💧'], '🪨', '#453e52', { fr: 'Une île est née !', en: 'An island is born!' }, { fr: 'La lave refroidie par l’eau devient de la roche : c’est ainsi que naissent les îles.', en: 'Lava cooled by water turns to rock: that is how islands are born.' }, { fr: 'De la lave et de l’eau…', en: 'Lava and water…' }),
  D('glass', 'volcano', ['🔥', '🏖️'], '🪟', '#d4f2ff', { fr: 'Du verre !', en: 'Glass!' }, { fr: 'Le verre, c’est du sable fondu par une très grande chaleur.', en: 'Glass is sand melted by very great heat.' }, { fr: 'De la lave sur du sable…', en: 'Lava on sand…' }),
  D('pumice', 'volcano', ['🔥', '🫧'], '🪨', '#c2bab0', { fr: 'Une pierre qui flotte !', en: 'A stone that floats!' }, { fr: 'La pierre ponce est pleine de petites bulles d’air : elle flotte sur l’eau.', en: 'Pumice is full of tiny air bubbles: it floats on water.' }, { fr: 'Des bulles dans la lave…', en: 'Bubbles in lava…' }),
  D('plume', 'volcano', ['🔥', '❄️'], '♨️', '#f4f7ff', { fr: 'Pschiit, de la vapeur !', en: 'Whoosh, steam!' }, { fr: 'La chaleur change la neige deux fois : en eau, puis en vapeur.', en: 'Heat changes snow twice: into water, then into steam.' }, { fr: 'De la lave sur la neige…', en: 'Lava on snow…' }),
  D('cool_rock', 'volcano', ['🔥', '⏳'], '🪨', '#d8d0ff', { fr: 'La lave s’endort !', en: 'The lava goes to sleep!' }, { fr: 'Laissée tranquille, la lave refroidit doucement en roche qui scintille.', en: 'Left alone, lava slowly cools into sparkly rock.' }, { fr: 'Laisse la lave tranquille…', en: 'Leave the lava alone…' }),
  D('giant', 'volcano', ['🌰', '🌑', '💧'], '🌳', '#3cc870', { fr: 'Une plante géante !', en: 'A giant plant!' }, { fr: 'La cendre des volcans rend la terre très riche : les plantes y deviennent géantes.', en: 'Volcanic ash makes soil very rich: plants grow huge in it.' }, { fr: 'Une graine dans la cendre…', en: 'A seed in the ash…' }),
  D('geyser', 'volcano', ['💧', '⛲'], '⛲', '#bfe4ff', { fr: 'Un geyser !', en: 'A geyser!' }, { fr: 'L’eau chauffée sous terre pousse de la vapeur qui fait jaillir l’eau.', en: 'Water heated underground makes steam that shoots the water up.' }, { fr: 'De l’eau sur une roche chaude…', en: 'Water on a hot rock…' }),
  D('ash_rain', 'volcano', ['🌑', '☁️'], '🌧️', '#84828f', { fr: 'Une pluie grise !', en: 'Grey rain!' }, { fr: 'Les gouttelettes s’accrochent à la cendre : la pluie lave le ciel.', en: 'Droplets gather on the ash: the rain washes the sky.' }, { fr: 'De la cendre dans un nuage…', en: 'Ash in a cloud…' }),

  // Undersea.
  D('coral_grow', 'undersea', ['🪸', '☀️'], '🪸', '#ff7f9a', { fr: 'Le corail pousse !', en: 'The coral grows!' }, { fr: 'Le corail abrite de minuscules algues qui aiment la lumière du soleil.', en: 'Coral hosts tiny algae that love sunlight.' }, { fr: 'Du corail sous la lumière…', en: 'Coral in the light…' }),
  D('glow', 'undersea', ['🦠', '👆'], '💙', '#30e0ff', { fr: 'Le plancton s’allume !', en: 'The plankton lights up!' }, { fr: 'Certains planctons font de la lumière bleue quand on les remue.', en: 'Some plankton make blue light when they are stirred.' }, { fr: 'Remue le plancton…', en: 'Stir the plankton…' }),
  D('pearl', 'undersea', ['🐚', '🏖️'], '⚪', '#fff6fb', { fr: 'Une perle !', en: 'A pearl!' }, { fr: 'L’huître enrobe un grain de sable, couche après couche : une perle naît.', en: 'An oyster coats a grain of sand layer by layer: a pearl is born.' }, { fr: 'Un grain de sable dans un coquillage…', en: 'A grain of sand in a shell…' }),
  D('kelp_bubbles', 'undersea', ['🌿', '☀️'], '🫧', '#3fa860', { fr: 'L’algue fait des bulles !', en: 'The kelp makes bubbles!' }, { fr: 'Les plantes de la mer fabriquent de l’oxygène avec la lumière.', en: 'Sea plants make oxygen from light.' }, { fr: 'Une grande algue au soleil…', en: 'A tall kelp in the light…' }),
  D('vent', 'undersea', ['🔥', '🌊'], '🪸', '#ffa25c', { fr: 'Une source chaude !', en: 'A warm vent!' }, { fr: 'Autour des sources chaudes du fond de la mer, la vie foisonne.', en: 'Life thrives around the warm vents on the sea floor.' }, { fr: 'De la lave sous la mer…', en: 'Lava under the sea…' }),
  D('convection', 'undersea', ['🎨', '☀️'], '⬆️', '#ff8a24', { fr: 'L’eau chaude monte !', en: 'Warm water rises!' }, { fr: 'L’eau chaude est plus légère que l’eau froide : elle monte.', en: 'Warm water is lighter than cold water: it rises.' }, { fr: 'De la couleur au-dessus d’une lampe…', en: 'Colour above a lamp…' }),
  D('bubble_grow', 'undersea', ['🫧', '⬆️'], '🫧', '#9fdcf5', { fr: 'La bulle grossit !', en: 'The bubble grows!' }, { fr: 'Près de la surface, l’eau appuie moins fort : la bulle grossit.', en: 'Near the surface the water presses less: the bubble grows.' }, { fr: 'Une bulle qui monte de très bas…', en: 'A bubble rising from deep down…' }),

  // Space.
  D('planet', 'space', ['✨', '🔮'], '🪐', '#ffe9a8', { fr: 'Une planète se forme !', en: 'A planet forms!' }, { fr: 'La gravité rassemble la poussière : c’est ainsi que naissent les planètes.', en: 'Gravity gathers dust together: that is how planets are born.' }, { fr: 'De la poussière près d’une boule de gravité…', en: 'Dust near a gravity ball…' }),
  D('star', 'space', ['🌌', '🤏'], '⭐', '#ffd04a', { fr: 'Une étoile s’allume !', en: 'A star lights up!' }, { fr: 'Les étoiles sont du gaz serré si fort qu’il se met à briller.', en: 'Stars are gas squeezed so tightly that it starts to shine.' }, { fr: 'Beaucoup de gaz tout serré…', en: 'Lots of gas squeezed together…' }),
  D('orbit', 'space', ['✨', '➡️'], '💫', '#ffe2a0', { fr: 'En orbite !', en: 'In orbit!' }, { fr: 'Être en orbite, c’est tomber autour d’une planète sans jamais la toucher.', en: 'Being in orbit is falling around a planet without ever touching it.' }, { fr: 'Lance de la poussière sur le côté…', en: 'Throw dust sideways…' }),
  D('comet_tail', 'space', ['☄️', '⭐'], '☄️', '#60c8ff', { fr: 'La queue de la comète !', en: 'The comet’s tail!' }, { fr: 'La lumière de l’étoile souffle la queue de la comète loin d’elle.', en: 'Starlight blows the comet’s tail away from the star.' }, { fr: 'Une comète près d’une étoile…', en: 'A comet near a star…' }),
  D('water_ball', 'space', ['💧', '🚀'], '🔵', '#3b9cf2', { fr: 'Une boule d’eau !', en: 'A ball of water!' }, { fr: 'Sans gravité, les gouttes d’eau deviennent des boules toutes rondes.', en: 'Without gravity, drops of water become round balls.' }, { fr: 'De l’eau loin de toute gravité…', en: 'Water far from any gravity…' }),
  D('moon_birth', 'space', ['☄️', '🪐'], '🌙', '#ffffff', { fr: 'Une lune est née !', en: 'A moon is born!' }, { fr: 'Notre Lune est née d’une collision avec la Terre, il y a très longtemps.', en: 'Our Moon was born from a collision with the Earth, a very long time ago.' }, { fr: 'Une comète vers une planète…', en: 'A comet towards a planet…' }),
  D('habitable', 'space', ['🧊', '⭐'], '🌊', '#3fc0c8', { fr: 'Un océan dans l’espace !', en: 'An ocean in space!' }, { fr: 'Ni trop chaud, ni trop froid : à la bonne distance d’une étoile, la glace devient océan.', en: 'Not too hot, not too cold: at the right distance from a star, ice becomes an ocean.' }, { fr: 'De la glace près d’une étoile…', en: 'Ice near a star…' }),

  // Moon.
  D('crater', 'moon', ['🌠', '🌕'], '🕳️', '#cfd2dc', { fr: 'Un cratère !', en: 'A crater!' }, { fr: 'Sur la Lune, pas de vent ni de pluie : les cratères restent pour toujours.', en: 'On the Moon there is no wind or rain: craters stay forever.' }, { fr: 'Lâche un caillou de haut…', en: 'Drop a pebble from high up…' }),
  D('slow_fall', 'moon', ['🌕', '⬇️'], '🐇', '#a6aab8', { fr: 'Ça rebondit tout doucement !', en: 'A slow, high bounce!' }, { fr: 'La gravité de la Lune est six fois plus faible : tout tombe lentement.', en: 'The Moon’s gravity is six times weaker: everything falls slowly.' }, { fr: 'Lâche de la poussière de haut…', en: 'Drop some dust from high up…' }),
  D('moon_ice', 'moon', ['💧', '🌑'], '🧊', '#a9e3fa', { fr: 'De la glace à l’ombre !', en: 'Ice in the shade!' }, { fr: 'Sur la Lune, l’eau disparaît au soleil mais gèle cachée dans l’ombre.', en: 'On the Moon water vanishes in sunlight but freezes hidden in the shade.' }, { fr: 'De l’eau à l’ombre…', en: 'Water in the shade…' }),
  D('silent_pop', 'moon', ['🫧', '🌙'], '🤫', '#dff6ff', { fr: 'Un pop tout silencieux !', en: 'A silent pop!' }, { fr: 'Sans air, le son ne voyage pas : la bulle éclate sans bruit.', en: 'Without air, sound cannot travel: the bubble pops without a sound.' }, { fr: 'Une bulle sur la Lune…', en: 'A bubble on the Moon…' }),

  // Mars.
  D('sublimate', 'mars', ['🧊', '☀️'], '🌫️', '#eef6ff', { fr: 'De la glace en brouillard !', en: 'Ice into fog!' }, { fr: 'La glace sèche saute l’étape liquide : elle devient tout de suite du brouillard.', en: 'Dry ice skips the liquid stage: it turns straight into fog.' }, { fr: 'Réchauffe la glace sèche…', en: 'Warm the dry ice…' }),
  D('hover', 'mars', ['🥔', '🌫️'], '🛸', '#a59d95', { fr: 'Le galet flotte !', en: 'The pebble hovers!' }, { fr: 'Le brouillard lourd de la glace sèche fait un coussin où flottent les petits cailloux.', en: 'Heavy dry-ice fog makes a cushion that little pebbles float on.' }, { fr: 'Un galet sur du brouillard…', en: 'A pebble on fog…' }),
  D('dust_devil', 'mars', ['🌬️', '🟠'], '🌪️', '#e08a50', { fr: 'Un tourbillon de poussière !', en: 'A dust devil!' }, { fr: 'Sur Mars, le vent fait danser la poussière rouge en petits tourbillons.', en: 'On Mars, the wind makes the red dust dance in little whirls.' }, { fr: 'Souffle sur la poussière rouge…', en: 'Blow on the red dust…' }),
  D('mars_garden', 'mars', ['🫙', '🌰', '💧'], '🌱', '#5cbf5a', { fr: 'Le premier jardin sur Mars !', en: 'The first garden on Mars!' }, { fr: 'Les plantes ont besoin d’air, d’eau et de chaleur : le dôme leur donne tout ça.', en: 'Plants need air, water and warmth: the dome gives them all three.' }, { fr: 'Une graine… sous un dôme ?', en: 'A seed… under a dome?' }),

  // Ziggy's parcel: what came out depends on what the child did to it.
  D('gift_water', 'garden', ['📦', '💧'], '🌈', '#ff7eb6', { fr: 'Le colis a aimé l’eau !', en: 'The parcel loved the water!' }, { fr: 'Arrosé, le colis a germé : une graine arc-en-ciel ! L’eau réveille les graines.', en: 'Watered, the parcel sprouted: a rainbow seed! Water wakes seeds up.' }, { fr: 'Et si on arrosait le colis ?', en: 'What if you watered the parcel?' }, true),
  D('gift_warm', 'volcano', ['📦', '☀️'], '🐣', '#ffd447', { fr: 'Le colis a eu chaud !', en: 'The parcel got warm!' }, { fr: 'Au chaud, un œuf a éclos : un bébé ! Les œufs ont besoin de chaleur pour éclore.', en: 'Kept warm, an egg hatched: a baby! Eggs need warmth to hatch.' }, { fr: 'Et si on réchauffait le colis ?', en: 'What if you warmed the parcel?' }, true),
  D('gift_cold', 'mountain', ['📦', '❄️'], '🔮', '#a9e3fa', { fr: 'Le colis a gelé !', en: 'The parcel froze!' }, { fr: 'Le colis est devenu une boule à neige musicale : chaque chute fait une note.', en: 'The parcel became a music snow globe: everything that falls plays a note.' }, { fr: 'Et si on mettait de la neige dessus ?', en: 'What if you put snow on it?' }, true),
  D('gift_buried', 'islands', ['📦', '🏖️'], '🗺️', '#cfa860', { fr: 'Le colis était enterré !', en: 'The parcel was buried!' }, { fr: 'Une carte au trésor ! Les archéologues trouvent des trésors en creusant.', en: 'A treasure map! Archaeologists find treasures by digging.' }, { fr: 'Et si on enterrait le colis ?', en: 'What if you buried the parcel?' }, true),
  D('gift_bubble', 'undersea', ['📦', '🫧'], '🍾', '#4fc9c0', { fr: 'Le colis a pris un bain de bulles !', en: 'The parcel had a bubble bath!' }, { fr: 'Une bouteille à la mer avec une carte postale d’un autre monde !', en: 'A message in a bottle with a postcard from another world!' }, { fr: 'Et si on chatouillait le colis avec des bulles ?', en: 'What if bubbles tickled the parcel?' }, true),
  D('gift_wind', 'islands', ['📦', '🌬️'], '🪁', '#a78bfa', { fr: 'Le colis s’est envolé !', en: 'The parcel flew away!' }, { fr: 'Le vent l’a déplié en cerf-volant : le vent pousse ce qui est léger et large.', en: 'The wind unfolded it into a kite: wind pushes light, wide things.' }, { fr: 'Et si on soufflait sur le colis ?', en: 'What if you blew on the parcel?' }, true),
  D('gift_lowg', 'space', ['📦', '🚀'], '⭐', '#fff2a0', { fr: 'Le colis a flotté !', en: 'The parcel floated!' }, { fr: 'Sans gravité, il s’est ouvert : une étoile de poche ! Les étoiles brillent de leur propre lumière.', en: 'With no gravity it opened: a pocket star! Stars shine with their own light.' }, { fr: 'Et si le colis flottait dans l’espace ?', en: 'What if the parcel floated in space?' }, true),
  D('gift_garden', 'garden', ['📦', '🌷'], '🌻', '#ffd447', { fr: 'Un tournesol géant !', en: 'A giant sunflower!' }, { fr: 'Les tournesols se tournent vers la lumière.', en: 'Sunflowers turn towards the light.' }, { fr: 'Un colis ouvert au jardin…', en: 'A parcel opened in the garden…' }, true),
  D('gift_mountain', 'mountain', ['📦', '🏔️'], '💎', '#c9a9ff', { fr: 'Un cristal à écho !', en: 'An echo crystal!' }, { fr: 'Dans les montagnes, le son rebondit sur la roche : c’est l’écho.', en: 'In the mountains, sound bounces off the rock: that is an echo.' }, { fr: 'Un colis ouvert à la montagne…', en: 'A parcel opened in the mountains…' }, true),
  D('gift_islands', 'islands', ['📦', '🏝️'], '🏰', '#cfa860', { fr: 'Un moule à château !', en: 'A sandcastle mould!' }, { fr: 'Le sable mouillé garde la forme du moule.', en: 'Wet sand keeps the shape of the mould.' }, { fr: 'Un colis ouvert sur les îles…', en: 'A parcel opened on the islands…' }, true),
  D('gift_volcano', 'volcano', ['📦', '🌋'], '🌋', '#ff8a24', { fr: 'Un mini volcan !', en: 'A mini volcano!' }, { fr: 'Un petit volcan rigolo, avec une cuillère de lave toute tiède.', en: 'A funny little volcano with a spoonful of warm lava.' }, { fr: 'Un colis ouvert au volcan…', en: 'A parcel opened at the volcano…' }, true),
  D('gift_undersea', 'undersea', ['📦', '🐠'], '🏮', '#fff6fb', { fr: 'Une lanterne de perles !', en: 'A pearl lantern!' }, { fr: 'Au fond de la mer il fait sombre : la lumière n’arrive pas jusqu’en bas.', en: 'It is dark deep in the sea: light does not reach all the way down.' }, { fr: 'Un colis ouvert sous la mer…', en: 'A parcel opened under the sea…' }, true),
  D('gift_space', 'space', ['📦', '🪐'], '💫', '#ffe2a0', { fr: 'Des anneaux de planète !', en: 'Planet rings!' }, { fr: 'Les anneaux de Saturne sont faits de milliards de petits morceaux de glace.', en: 'Saturn’s rings are made of billions of little pieces of ice.' }, { fr: 'Un colis ouvert dans l’espace…', en: 'A parcel opened in space…' }, true),
  D('gift_moon', 'moon', ['📦', '🌙'], '🚩', '#ff7a8a', { fr: 'Un drapeau à dessiner !', en: 'A flag to draw!' }, { fr: 'Sur la Lune, rien n’efface les traces : ton drapeau restera.', en: 'On the Moon nothing wipes prints away: your flag will stay.' }, { fr: 'Un colis ouvert sur la Lune…', en: 'A parcel opened on the Moon…' }, true),
  D('gift_mars', 'mars', ['📦', '🔴'], '🏡', '#b4f2dc', { fr: 'Une mini serre !', en: 'A tiny greenhouse!' }, { fr: 'Une serre garde la chaleur du soleil pour les plantes.', en: 'A greenhouse keeps the sun’s warmth for the plants.' }, { fr: 'Un colis ouvert sur Mars…', en: 'A parcel opened on Mars…' }, true),
];

export const discoveryById = (id: Reaction): Discovery | undefined => DISCOVERIES.find((d) => d.id === id);

/** The parcel's surprise that each world gives the first time a parcel opens there. */
export const SIGNATURE_GIFT: Record<WorldId, Reaction> = {
  garden: 'gift_garden',
  mountain: 'gift_mountain',
  islands: 'gift_islands',
  volcano: 'gift_volcano',
  undersea: 'gift_undersea',
  space: 'gift_space',
  moon: 'gift_moon',
  mars: 'gift_mars',
};

/** How the parcel was opened, in the engine's order of exposures. */
export const OPENINGS: Reaction[] = ['gift_water', 'gift_warm', 'gift_cold', 'gift_buried', 'gift_bubble', 'gift_wind', 'gift_lowg'];

/* ── Challenges and invitations ───────────────────────────────────────── */

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

/** "Et si… ?" — gentle, ignorable ideas from the resident: the hint of a discovery not made yet. */
export function invitation(world: WorldId, found: Partial<Record<Reaction, number>>): Discovery | null {
  return DISCOVERIES.find((d) => d.world === world && !d.gift && !found[d.id]) ?? null;
}

export const BRUSHES = [
  { id: 'S', radius: 1.6, dot: 8, name: { fr: 'Petit pinceau', en: 'Small brush' } },
  { id: 'M', radius: 3.5, dot: 14, name: { fr: 'Pinceau moyen', en: 'Medium brush' } },
  { id: 'L', radius: 7, dot: 20, name: { fr: 'Gros pinceau', en: 'Big brush' } },
] as const;
export type BrushId = (typeof BRUSHES)[number]['id'];

/** A pitch family per element, for the sounds of the sandbox (Hz of the base note). */
export function elementPitch(element: number): number {
  const families: Partial<Record<ElementKey, number>> = { water: 523, ice: 1047, snow: 880, crystal: 1319, sand: 330, stone: 196, lava: 147, bubble: 784, stardust: 1568, cloud: 440, seed: 392, gas: 659, geyser: 110 };
  const key = (Object.keys(EL) as ElementKey[]).find((k) => EL[k] === element);
  return (key && families[key]) ?? 262 + (element % 12) * 22;
}
