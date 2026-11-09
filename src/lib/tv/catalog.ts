import type { ArcadeGameId } from '@/lib/arcade/types';

/**
 * Ziggy World games on the TV home: the ones that play best with a remote
 * (arrows + OK). Dig and melody arcade games were removed; remaining TV-friendly
 * mechanics: choice, sort, pairs.
 */
export const TV_GAMES: ArcadeGameId[] = [
  'alphabet_quest',
  'number_island',
  'memory_magic',
  'little_scientist',
  'geography_explorer',
  'eco_world',
  'dragon_academy',
];
