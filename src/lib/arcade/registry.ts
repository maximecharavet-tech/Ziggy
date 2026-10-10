/**
 * Ziggy Arcade — the catalogue of the 20 games.
 * Each game is one mechanic (see types.ts) fed with local or AI content.
 */
import type { ArcadeGameId, GameDefinition, Mechanic } from './types';

const ROUNDS: Record<Mechanic, GameDefinition['rounds']> = {
  choice: [5, 6, 7, 8, 10],
  runner: [6, 7, 8, 9, 10],
  pairs: [3, 4, 5, 6, 8],
  order: [2, 3, 3, 4, 4],
  sort: [6, 8, 10, 12, 14],
  spell: [4, 5, 6, 7, 8],
  mix: [3, 4, 5, 6, 6],
  dig: [4, 5, 6, 7, 8],
  melody: [3, 4, 5, 5, 6],
  slide: [1, 1, 1, 1, 1],
};

type GameSpec = Omit<GameDefinition, 'rounds'>;

const SPECS: GameSpec[] = [
  {
    id: 'math_runner',
    name: { fr: 'Course des calculs', en: 'Math Runner' },
    description: {
      fr: 'Cours et passe par la porte du bon résultat !',
      en: 'Run and dash through the gate with the right answer!',
    },
    emoji: '🏃',
    color: '#FF8A65',
    mechanic: 'runner',
    skills: ['addition', 'subtraction', 'multiplication', 'counting'],
    aiContent: false,
  },
  {
    id: 'alphabet_quest',
    name: { fr: 'La quête de l’alphabet', en: 'Alphabet Quest' },
    description: {
      fr: 'Trouve les lettres et les mots qui commencent par elles.',
      en: 'Find letters and the words that start with them.',
    },
    emoji: '🔤',
    color: '#BA68C8',
    mechanic: 'choice',
    skills: ['letters', 'reading', 'vocabulary'],
    aiContent: true,
  },
  {
    id: 'memory_magic',
    name: { fr: 'Mémoire magique', en: 'Memory Magic' },
    description: {
      fr: 'Retourne les cartes et retrouve les paires qui vont ensemble.',
      en: 'Flip the cards and find the pairs that go together.',
    },
    emoji: '🃏',
    color: '#7986CB',
    mechanic: 'pairs',
    skills: ['memory', 'vocabulary', 'counting'],
    aiContent: false,
  },
  {
    id: 'color_lab',
    name: { fr: 'Labo des couleurs', en: 'Colour Lab' },
    description: {
      fr: 'Mélange les couleurs pour créer la bonne teinte.',
      en: 'Mix colours to make the right shade.',
    },
    emoji: '🧪',
    color: '#F06292',
    mechanic: 'mix',
    skills: ['colors', 'science', 'art'],
    aiContent: false,
  },
  {
    id: 'little_scientist',
    name: { fr: 'Petit scientifique', en: 'Little Scientist' },
    description: {
      fr: 'Découvre comment marche le monde avec des questions curieuses.',
      en: 'Discover how the world works with curious questions.',
    },
    emoji: '🔬',
    color: '#4DB6AC',
    mechanic: 'choice',
    skills: ['science', 'animals', 'ecology', 'logic'],
    aiContent: true,
  },
  {
    id: 'word_forest',
    name: { fr: 'La forêt des mots', en: 'Word Forest' },
    description: {
      fr: 'Remets les lettres dans l’ordre pour écrire le mot.',
      en: 'Put the letters in order to spell the word.',
    },
    emoji: '🌲',
    color: '#81C784',
    mechanic: 'spell',
    skills: ['vocabulary', 'letters', 'reading'],
    aiContent: true,
  },
  {
    id: 'number_island',
    name: { fr: 'L’île aux nombres', en: 'Number Island' },
    description: {
      fr: 'Compte, compare et calcule pour explorer l’île.',
      en: 'Count, compare and calculate to explore the island.',
    },
    emoji: '🏝️',
    color: '#4FC3F7',
    mechanic: 'choice',
    skills: ['counting', 'addition', 'subtraction', 'logic'],
    aiContent: false,
  },
  {
    id: 'space_mission',
    name: { fr: 'Mission spatiale', en: 'Space Mission' },
    description: {
      fr: 'Pilote ta fusée vers la bonne réponse parmi les étoiles.',
      en: 'Fly your rocket to the right answer among the stars.',
    },
    emoji: '🚀',
    color: '#5C6BC0',
    mechanic: 'runner',
    skills: ['astronomy', 'addition', 'subtraction', 'counting'],
    aiContent: true,
  },
  {
    id: 'dino_dig',
    name: { fr: 'Fouille des dinos', en: 'Dino Dig' },
    description: {
      fr: 'Réponds pour creuser et découvrir un fossile caché.',
      en: 'Answer to dig and uncover a hidden fossil.',
    },
    emoji: '🦕',
    color: '#A1887F',
    mechanic: 'dig',
    skills: ['science', 'animals', 'counting'],
    aiContent: true,
  },
  {
    id: 'music_garden',
    name: { fr: 'Jardin musical', en: 'Music Garden' },
    description: {
      fr: 'Écoute la mélodie des fleurs et rejoue-la.',
      en: 'Listen to the flowers’ tune and play it back.',
    },
    emoji: '🎵',
    color: '#FFB74D',
    mechanic: 'melody',
    skills: ['music', 'memory', 'sequencing'],
    aiContent: false,
  },
  {
    id: 'puzzle_castle',
    name: { fr: 'Château des puzzles', en: 'Puzzle Castle' },
    description: {
      fr: 'Fais glisser les pièces pour reformer l’image.',
      en: 'Slide the tiles to rebuild the picture.',
    },
    emoji: '🧩',
    color: '#9575CD',
    mechanic: 'slide',
    skills: ['logic', 'shapes'],
    aiContent: false,
  },
  {
    id: 'robot_factory',
    name: { fr: 'Usine à robots', en: 'Robot Factory' },
    description: {
      fr: 'Range les étapes dans l’ordre pour construire des robots.',
      en: 'Put the steps in order to build robots.',
    },
    emoji: '🤖',
    color: '#90A4AE',
    mechanic: 'order',
    skills: ['sequencing', 'logic', 'science'],
    aiContent: false,
  },
  {
    id: 'eco_world',
    name: { fr: 'Planète écolo', en: 'Eco World' },
    description: {
      fr: 'Trie chaque déchet dans la bonne poubelle.',
      en: 'Sort each item into the right bin.',
    },
    emoji: '♻️',
    color: '#66BB6A',
    mechanic: 'sort',
    skills: ['ecology', 'science'],
    aiContent: true,
  },
  {
    id: 'animal_rescue',
    name: { fr: 'Sauvetage des animaux', en: 'Animal Rescue' },
    description: {
      fr: 'Ramène chaque animal dans son habitat.',
      en: 'Bring each animal back to its home.',
    },
    emoji: '🐾',
    color: '#FFD54F',
    mechanic: 'sort',
    skills: ['animals', 'ecology'],
    aiContent: true,
  },
  {
    id: 'little_chef',
    name: { fr: 'Petit chef', en: 'Little Chef' },
    description: {
      fr: 'Suis la recette étape par étape.',
      en: 'Follow the recipe step by step.',
    },
    emoji: '🧑‍🍳',
    color: '#FF8A80',
    mechanic: 'order',
    skills: ['nutrition', 'sequencing', 'reading'],
    aiContent: true,
  },
  {
    id: 'geography_explorer',
    name: { fr: 'Explorateur du monde', en: 'World Explorer' },
    description: {
      fr: 'Pays, drapeaux, capitales : fais le tour du monde !',
      en: 'Countries, flags, capitals: travel around the world!',
    },
    emoji: '🌍',
    color: '#26A69A',
    mechanic: 'choice',
    skills: ['geography', 'vocabulary'],
    aiContent: true,
  },
  {
    id: 'story_builder_game',
    name: { fr: 'Fabrique à histoires', en: 'Story Builder' },
    description: {
      fr: 'Remets les morceaux de l’histoire dans l’ordre.',
      en: 'Put the pieces of the story back in order.',
    },
    emoji: '📖',
    color: '#E57373',
    mechanic: 'order',
    skills: ['reading', 'sequencing', 'vocabulary'],
    aiContent: true,
  },
  {
    id: 'art_studio',
    name: { fr: 'Atelier d’art', en: 'Art Studio' },
    description: {
      fr: 'Prépare les couleurs de ton tableau en les mélangeant.',
      en: 'Prepare your painting’s colours by mixing them.',
    },
    emoji: '🎨',
    color: '#EC407A',
    mechanic: 'mix',
    skills: ['art', 'colors'],
    aiContent: false,
  },
  {
    id: 'space_memory',
    name: { fr: 'Mémoire des étoiles', en: 'Space Memory' },
    description: {
      fr: 'Retrouve les paires de planètes et de constellations.',
      en: 'Match pairs of planets and constellations.',
    },
    emoji: '🌌',
    color: '#7E57C2',
    mechanic: 'pairs',
    skills: ['memory', 'astronomy'],
    aiContent: false,
  },
  {
    id: 'dragon_academy',
    name: { fr: 'Académie des dragons', en: 'Dragon Academy' },
    description: {
      fr: 'Trouve ce qui vient ensuite dans les suites magiques.',
      en: 'Find what comes next in the magic patterns.',
    },
    emoji: '🐉',
    color: '#26C6DA',
    mechanic: 'choice',
    skills: ['logic', 'sequencing', 'counting'],
    aiContent: false,
  },
];

export const ARCADE_GAMES = Object.fromEntries(
  SPECS.map((spec) => [spec.id, { ...spec, rounds: ROUNDS[spec.mechanic] }]),
) as Record<ArcadeGameId, GameDefinition>;

export function getGame(id: ArcadeGameId): GameDefinition {
  return ARCADE_GAMES[id];
}
