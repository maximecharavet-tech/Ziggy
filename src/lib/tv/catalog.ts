import type { ArcadeGameId } from '@/lib/arcade/types';

/**
 * Ziggy World games that play well with a TV remote (arrows + OK), checked
 * one by one with the keyboard only:
 * - choice (alphabet_quest, number_island, little_scientist, geography_explorer,
 *   dragon_academy) and dig (dino_dig): answers are big buttons, ← → ↑ ↓ pick, OK answers;
 * - pairs (memory_magic, space_memory): a grid of cards, OK flips;
 * - melody (music_garden): five pads in a row, OK plays;
 * - sort (eco_world, animal_rescue): OK on a bin drops the item into it.
 * Not on TV: runner (real-time lanes; it does steer with ← →, but the
 * arches need a quick reader), order (moving cards), spell (many letters),
 * mix and slide (fine but fiddly), and the Créer apps (pointer drawing).
 */
export const TV_GAMES: ArcadeGameId[] = [
  'alphabet_quest',
  'number_island',
  'memory_magic',
  'little_scientist',
  'music_garden',
  'geography_explorer',
  'dino_dig',
  'eco_world',
  'dragon_academy',
];
