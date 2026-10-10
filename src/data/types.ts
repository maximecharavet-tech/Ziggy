/**
 * Ziggy World content contracts: worlds, quests, characters, companions.
 */
import type { L } from '@/lib/i18n-text';
import type { LearningSkill } from '@/lib/learning/skills';
import type { ArcadeGameId } from '@/lib/arcade/types';

export const COMPANION_IDS = ['dragon', 'unicorn', 'fox', 'panda', 'robot', 'owl', 'cat', 'dolphin'] as const;
export type CompanionId = (typeof COMPANION_IDS)[number];

export interface CharacterDefinition {
  id: string;
  name: L;
  emoji: string;
  role: L;
}

export interface QuestDefinition {
  id: string;
  title: L;
  /** One short sentence, as told by a character of the world. */
  intro: L;
  gameId: ArcadeGameId;
  skill: LearningSkill;
  /** Chapter of the world's story (1–3); quests of a chapter unlock the next. */
  chapter: 1 | 2 | 3;
  /** What completing it does in the world: opens a place, meets someone, finds something. */
  outcome: { kind: 'place' | 'character' | 'item'; id: string; label: L; emoji: string };
  reward: { xp: number; stars: number };
}

export interface WorldDefinition {
  id: string;
  /** Position on the map, in %. */
  map: { x: number; y: number };
  name: L;
  description: L;
  icon: string;
  colors: { from: string; to: string; accent: string; ink: string };
  /** Emoji scenery floating in the world's background. */
  background: string[];
  characters: CharacterDefinition[];
  companions: CompanionId[];
  learningSkills: LearningSkill[];
  availableGames: ArcadeGameId[];
  /** Exactly 6 quests: 2 per chapter. */
  quests: QuestDefinition[];
  /** Total stars needed across Ziggy World to unlock it (0 = open from the start). */
  unlockStars: number;
}

export type CompanionMood = 'IDLE' | 'HAPPY' | 'THINKING' | 'EXCITED' | 'SAD' | 'CELEBRATE';

export interface CompanionProfile {
  id: CompanionId;
  name: L;
  emoji: string;
  color: string;
  personality: L;
  /** One line per reaction, in the companion's voice (several, picked at random). */
  reactions: Record<'success' | 'failure' | 'hint' | 'levelUp' | 'questComplete', L[]>;
  /** How the companion is unlocked: from the start, or by stars. */
  unlockStars: number;
}
