/**
 * Ziggy Arcade — the game engine contract.
 *
 * A game is a reliable, reusable MECHANIC (choice, runner, pairs…) fed with
 * CONTENT (questions, words, steps…). Content comes from local deterministic
 * generators, or from the AI as strict JSON validated server-side — never
 * code. Every mechanic reports the same GameResult.
 */
import type { LearningSkill } from '@/lib/learning/skills';
import type { L } from '@/lib/i18n-text';

export const MECHANICS = ['choice', 'runner', 'pairs', 'order', 'sort', 'spell', 'mix', 'dig', 'melody', 'slide'] as const;
export type Mechanic = (typeof MECHANICS)[number];

export const ARCADE_GAME_IDS = [
  'math_runner',
  'alphabet_quest',
  'memory_magic',
  'color_lab',
  'little_scientist',
  'word_forest',
  'number_island',
  'space_mission',
  'dino_dig',
  'music_garden',
  'puzzle_castle',
  'robot_factory',
  'eco_world',
  'animal_rescue',
  'little_chef',
  'geography_explorer',
  'story_builder_game',
  'art_studio',
  'space_memory',
  'dragon_academy',
] as const;
export type ArcadeGameId = (typeof ARCADE_GAME_IDS)[number];

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface GameDefinition {
  id: ArcadeGameId;
  name: L;
  description: L;
  emoji: string;
  color: string;
  mechanic: Mechanic;
  /** Skills trained, the first being the main one. */
  skills: LearningSkill[];
  /** Rounds per session at each difficulty (index 0 = difficulty 1). */
  rounds: [number, number, number, number, number];
  /** Can the AI enrich this game's content (knowledge games), or is local content always better? */
  aiContent: boolean;
}

/* ── Content, one shape per mechanic ── */

/** A question with 2–4 answers; `answer` is the index of the right one. */
export interface ChoiceItem {
  prompt: string;
  /** Emoji or short visual shown big above the prompt. */
  visual?: string;
  options: string[];
  answer: number;
  /** One kind sentence shown after answering. */
  explain?: string;
}

export type GameContent =
  | { kind: 'choice'; items: ChoiceItem[] }
  /** Runner lanes: same shape as choice, 2–3 options become lanes/gates. */
  | { kind: 'runner'; items: ChoiceItem[] }
  /** Pairs to match (memory cards): [a, b] where a and b go together (may be identical). */
  | { kind: 'pairs'; pairs: [string, string][] }
  /** Put steps in the right order; `steps` is given in the correct order. */
  | { kind: 'order'; sets: { prompt: string; steps: string[] }[] }
  /** Drop each item in its bin. */
  | { kind: 'sort'; bins: { id: string; label: string; emoji: string }[]; items: { label: string; emoji: string; bin: string }[] }
  /** Spell a word from shuffled letters; `hint` is an emoji. */
  | { kind: 'spell'; words: { word: string; hint: string }[] }
  /** Mix base colours to reach a target colour. */
  | { kind: 'mix'; targets: { name: string; hex: string; recipe: string[] }[]; palette: { id: string; name: string; hex: string }[] }
  /** Answer to dig tiles and uncover the find. */
  | { kind: 'dig'; items: ChoiceItem[]; find: { emoji: string; name: string } }
  /** Repeat note sequences (indices into a 5-note pentatonic scale). */
  | { kind: 'melody'; sequences: number[][] }
  /** Sliding picture puzzle. */
  | { kind: 'slide'; size: 3 | 4; picture: string };

export interface GameLevel {
  difficulty: Difficulty;
  rounds: number;
}

export interface GameSession {
  id: string;
  gameId: ArcadeGameId;
  worldId: string;
  questId?: string;
  level: GameLevel;
  content: GameContent;
  /** Where the content came from. */
  source: 'local' | 'ai';
  startedAt: number;
}

/** What a mechanic reports when the child finishes. There is no "lost". */
export interface GameResult {
  sessionId: string;
  gameId: ArcadeGameId;
  worldId: string;
  questId?: string;
  difficulty: Difficulty;
  correct: number;
  mistakes: number;
  total: number;
  durationMs: number;
}

export interface GameReward {
  xp: number;
  /** 1 to 3: finishing always earns one. */
  stars: number;
  item?: string;
}

/** What a mechanic component receives. */
export interface MechanicProps {
  content: GameContent;
  color: string;
  locale: string;
  /** Called once, when every round is done. */
  onFinish: (stats: { correct: number; mistakes: number; total: number }) => void;
  /** For the companion: each answer as it happens. */
  onAnswer?: (right: boolean) => void;
}
