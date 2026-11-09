/**
 * Words, colours and shapes the rooms and puzzles use. Every word has its
 * picture (emoji placeholder until the code-built icon exists), French with
 * article and plural, and English. Colours always carry an icon AND a pattern
 * (colour-blind safe, design doc A4/A5).
 */
import type { L } from './types';

export type WordCat = 'clothes' | 'kitchen' | 'food' | 'toy' | 'music' | 'tool' | 'bath' | 'deco' | 'nature' | 'house';

export interface Word {
  id: string;
  emoji: string;
  /** French singular, plural and singular with its definite article. */
  fr: string;
  frPl: string;
  frDef: string;
  en: string;
  enPl: string;
  cat: WordCat;
}

const w = (id: string, emoji: string, cat: WordCat, fr: string, frPl: string, frDef: string, en: string, enPl = `${en}s`): Word => ({
  id,
  emoji,
  cat,
  fr,
  frPl,
  frDef,
  en,
  enPl,
});

export const WORDS: Word[] = [
  // clothes
  w('sock', '🧦', 'clothes', 'chaussette', 'chaussettes', 'la chaussette', 'sock'),
  w('boot', '🥾', 'clothes', 'botte', 'bottes', 'la botte', 'boot'),
  w('scarf', '🧣', 'clothes', 'écharpe', 'écharpes', 'l’écharpe', 'scarf', 'scarves'),
  w('coat', '🧥', 'clothes', 'manteau', 'manteaux', 'le manteau', 'coat'),
  w('glove', '🧤', 'clothes', 'gant', 'gants', 'le gant', 'glove'),
  w('mitten', '🧤', 'clothes', 'moufle', 'moufles', 'la moufle', 'mitten'),
  w('bonnet', '🎩', 'clothes', 'bonnet', 'bonnets', 'le bonnet', 'woolly hat'),
  w('pyjamas', '👕', 'clothes', 'pyjama', 'pyjamas', 'le pyjama', 'pyjama top'),
  w('slipper', '🥿', 'clothes', 'chausson', 'chaussons', 'le chausson', 'slipper'),
  // kitchen
  w('spoon', '🥄', 'kitchen', 'cuillère', 'cuillères', 'la cuillère', 'spoon'),
  w('fork', '🍴', 'kitchen', 'fourchette', 'fourchettes', 'la fourchette', 'fork'),
  w('whisk', '🥣', 'kitchen', 'fouet', 'fouets', 'le fouet', 'whisk', 'whisks'),
  w('cup', '☕', 'kitchen', 'tasse', 'tasses', 'la tasse', 'cup'),
  w('plate', '🍽️', 'kitchen', 'assiette', 'assiettes', 'l’assiette', 'plate'),
  w('glass', '🥛', 'kitchen', 'verre', 'verres', 'le verre', 'glass', 'glasses'),
  w('napkin', '🧻', 'kitchen', 'serviette', 'serviettes', 'la serviette', 'napkin'),
  w('kettle', '🫖', 'kitchen', 'bouilloire', 'bouilloires', 'la bouilloire', 'kettle'),
  w('rolling-pin', '🪵', 'kitchen', 'rouleau', 'rouleaux', 'le rouleau à pâtisserie', 'rolling pin'),
  w('pot', '🍲', 'kitchen', 'casserole', 'casseroles', 'la casserole', 'saucepan'),
  // food
  w('cookie', '🍪', 'food', 'biscuit', 'biscuits', 'le biscuit', 'cookie'),
  w('apple', '🍎', 'food', 'pomme', 'pommes', 'la pomme', 'apple'),
  w('banana', '🍌', 'food', 'banane', 'bananes', 'la banane', 'banana'),
  w('carrot', '🥕', 'food', 'carotte', 'carottes', 'la carotte', 'carrot'),
  w('pear', '🍐', 'food', 'poire', 'poires', 'la poire', 'pear'),
  w('orange-fruit', '🍊', 'food', 'orange', 'oranges', 'l’orange', 'orange'),
  w('cake', '🎂', 'food', 'gâteau', 'gâteaux', 'le gâteau', 'cake'),
  // toys
  w('ball', '⚽', 'toy', 'ballon', 'ballons', 'le ballon', 'ball'),
  w('teddy', '🧸', 'toy', 'doudou', 'doudous', 'le doudou', 'teddy', 'teddies'),
  w('block', '🧱', 'toy', 'cube', 'cubes', 'le cube', 'block'),
  w('puzzle', '🧩', 'toy', 'pièce de puzzle', 'pièces de puzzle', 'la pièce de puzzle', 'puzzle piece'),
  w('car', '🚗', 'toy', 'petite voiture', 'petites voitures', 'la petite voiture', 'toy car'),
  w('train', '🚂', 'toy', 'petit train', 'petits trains', 'le petit train', 'toy train'),
  w('marble', '🔵', 'toy', 'bille', 'billes', 'la bille', 'marble'),
  w('duck', '🦆', 'toy', 'canard', 'canards', 'le canard', 'rubber duck'),
  w('robot', '🤖', 'toy', 'robot', 'robots', 'le robot', 'robot'),
  w('kite', '🪁', 'toy', 'cerf-volant', 'cerfs-volants', 'le cerf-volant', 'kite'),
  w('rocking-horse', '🐴', 'toy', 'cheval à bascule', 'chevaux à bascule', 'le cheval à bascule', 'rocking horse'),
  w('sled', '🛷', 'toy', 'luge', 'luges', 'la luge', 'sled'),
  // music
  w('drum', '🥁', 'music', 'tambour', 'tambours', 'le tambour', 'drum'),
  w('bell', '🔔', 'music', 'clochette', 'clochettes', 'la clochette', 'bell'),
  w('trumpet', '🎺', 'music', 'trompette', 'trompettes', 'la trompette', 'trumpet'),
  w('xylophone-bar', '🎵', 'music', 'lame de xylophone', 'lames de xylophone', 'la lame de xylophone', 'xylophone bar'),
  w('maraca', '🪇', 'music', 'maracas', 'maracas', 'la maracas', 'maraca'),
  w('guitar', '🎸', 'music', 'guitare', 'guitares', 'la guitare', 'guitar'),
  // tools (toy-sized, workshop)
  w('hammer', '🔨', 'tool', 'marteau', 'marteaux', 'le marteau', 'hammer'),
  w('wrench', '🔧', 'tool', 'clé plate', 'clés plates', 'la clé plate', 'spanner'),
  w('screwdriver', '🪛', 'tool', 'tournevis', 'tournevis', 'le tournevis', 'screwdriver'),
  w('bolt', '🔩', 'tool', 'boulon', 'boulons', 'le boulon', 'bolt'),
  w('wheel', '🛞', 'tool', 'roue', 'roues', 'la roue', 'wheel'),
  w('brush', '🖌️', 'tool', 'pinceau', 'pinceaux', 'le pinceau', 'paintbrush', 'paintbrushes'),
  // bath
  w('toothbrush', '🪥', 'bath', 'brosse à dents', 'brosses à dents', 'la brosse à dents', 'toothbrush', 'toothbrushes'),
  w('soap', '🧼', 'bath', 'savon', 'savons', 'le savon', 'soap bar'),
  w('towel', '🛁', 'bath', 'serviette de bain', 'serviettes de bain', 'la serviette de bain', 'towel'),
  w('sponge', '🧽', 'bath', 'éponge', 'éponges', 'l’éponge', 'sponge'),
  w('comb', '🪮', 'bath', 'peigne', 'peignes', 'le peigne', 'comb'),
  // deco
  w('bauble', '🔴', 'deco', 'boule', 'boules', 'la boule', 'bauble'),
  w('star', '⭐', 'deco', 'étoile', 'étoiles', 'l’étoile', 'star'),
  w('garland', '🎊', 'deco', 'guirlande', 'guirlandes', 'la guirlande', 'garland'),
  w('candle', '🕯️', 'deco', 'bougie', 'bougies', 'la bougie', 'candle'),
  w('gift', '🎁', 'deco', 'cadeau', 'cadeaux', 'le cadeau', 'present'),
  w('stocking', '🧦', 'deco', 'chaussette de Noël', 'chaussettes de Noël', 'la chaussette de Noël', 'Christmas stocking'),
  w('sign', '🪧', 'deco', 'panneau', 'panneaux', 'le panneau', 'sign'),
  w('frame', '🖼️', 'deco', 'cadre', 'cadres', 'le cadre', 'picture frame'),
  // house
  w('book', '📕', 'house', 'livre', 'livres', 'le livre', 'book'),
  w('umbrella', '☂️', 'house', 'parapluie', 'parapluies', 'le parapluie', 'umbrella'),
  w('lamp', '💡', 'house', 'lampe', 'lampes', 'la lampe', 'lamp'),
  w('pillow', '🛏️', 'house', 'oreiller', 'oreillers', 'l’oreiller', 'pillow'),
  w('cushion', '🛋️', 'house', 'coussin', 'coussins', 'le coussin', 'cushion'),
  w('box', '📦', 'house', 'carton', 'cartons', 'le carton', 'box', 'boxes'),
  w('clock', '🕰️', 'house', 'horloge', 'horloges', 'l’horloge', 'clock'),
  w('key', '🗝️', 'house', 'clé', 'clés', 'la clé', 'key'),
  w('flowerpot', '🪴', 'house', 'pot de fleurs', 'pots de fleurs', 'le pot de fleurs', 'flowerpot'),
  w('jar', '🫙', 'house', 'bocal', 'bocaux', 'le bocal', 'jar'),
  w('map', '🗺️', 'house', 'carte', 'cartes', 'la carte', 'map'),
  w('basket', '🧺', 'house', 'panier', 'paniers', 'le panier', 'basket'),
  // nature
  w('snowball', '⚪', 'nature', 'boule de neige', 'boules de neige', 'la boule de neige', 'snowball'),
  w('snowman', '⛄', 'nature', 'bonhomme de neige', 'bonshommes de neige', 'le bonhomme de neige', 'snowman', 'snowmen'),
  w('pinecone', '🌰', 'nature', 'pomme de pin', 'pommes de pin', 'la pomme de pin', 'pine cone'),
  w('leaf', '🍃', 'nature', 'feuille', 'feuilles', 'la feuille', 'leaf', 'leaves'),
  w('flower', '🌼', 'nature', 'fleur', 'fleurs', 'la fleur', 'flower'),
];

const BY_ID = new Map(WORDS.map((x) => [x.id, x]));
export const wordById = (id: string): Word | undefined => BY_ID.get(id);
export function word(id: string): Word {
  const x = BY_ID.get(id);
  if (!x) throw new Error(`unknown word "${id}"`);
  return x;
}
export const wordsInCat = (cat: WordCat) => WORDS.filter((x) => x.cat === cat);

export const one = (x: Word): L => ({ fr: x.fr, en: x.en });
export const many = (x: Word): L => ({ fr: x.frPl, en: x.enPl });
export const the = (x: Word): L => ({ fr: x.frDef, en: `the ${x.en}` });

export interface ColorDef {
  id: string;
  hex: string;
  /** Colour-blind safe twin cues. */
  icon: string;
  pattern: 'dots' | 'stripes' | 'zigzag' | 'stars' | 'checks' | 'waves' | 'plain' | 'hearts';
  name: L;
}

export const COLORS: ColorDef[] = [
  { id: 'red', hex: '#e2453c', icon: '🍓', pattern: 'dots', name: { fr: 'rouge', en: 'red' } },
  { id: 'yellow', hex: '#ffcc33', icon: '🍋', pattern: 'stripes', name: { fr: 'jaune', en: 'yellow' } },
  { id: 'blue', hex: '#3f7fe0', icon: '💧', pattern: 'waves', name: { fr: 'bleu', en: 'blue' } },
  { id: 'green', hex: '#3a9d4f', icon: '🍃', pattern: 'zigzag', name: { fr: 'vert', en: 'green' } },
  { id: 'purple', hex: '#7950f2', icon: '🍇', pattern: 'stars', name: { fr: 'violet', en: 'purple' } },
  { id: 'orange', hex: '#f08c00', icon: '🍊', pattern: 'checks', name: { fr: 'orange', en: 'orange' } },
  { id: 'white', hex: '#f2f6ff', icon: '❄️', pattern: 'plain', name: { fr: 'blanc', en: 'white' } },
  { id: 'brown', hex: '#a0612b', icon: '🌰', pattern: 'hearts', name: { fr: 'marron', en: 'brown' } },
];
/** The six bright colours used by puzzles and the recolour prank. */
export const BRIGHT = ['red', 'yellow', 'blue', 'green', 'purple', 'orange'] as const;
export const colorById = (id: string) => COLORS.find((c) => c.id === id);
export const isColor = (id: unknown) => COLORS.some((c) => c.id === id);

export interface ShapeDef {
  id: string;
  icon: string;
  name: L;
}
export const SHAPES: ShapeDef[] = [
  { id: 'circle', icon: '●', name: { fr: 'rond', en: 'circle' } },
  { id: 'square', icon: '■', name: { fr: 'carré', en: 'square' } },
  { id: 'triangle', icon: '▲', name: { fr: 'triangle', en: 'triangle' } },
  { id: 'star', icon: '★', name: { fr: 'étoile', en: 'star' } },
  { id: 'heart', icon: '♥', name: { fr: 'cœur', en: 'heart' } },
];
