import type { ArcadeGameId } from '@/lib/arcade/types';

/**
 * Ziggy World games on the TV home: the ones that play best with a remote
 * (arrows + OK). Checked with the keyboard only on a production build, the
 * focus landing on the board after "Let's go":
 * - choice (alphabet_quest, number_island, little_scientist, geography_explorer,
 *   dragon_academy) and dig (dino_dig): big answer buttons, ← → ↑ ↓ then OK;
 * - sort (eco_world, animal_rescue): OK on an item, ↓ to a bin, OK drops it;
 * - pairs (memory_magic, space_memory): a grid of cards, OK flips;
 * - melody (music_garden): OK on "listen", then the five pads in a row.
 * Also playable but kept off the TV home (slower or fiddlier with a remote):
 * mix (color_lab, art_studio), order (robot_factory, little_chef,
 * story_builder_game: OK picks a card, ↑ ↓ move it), runner (math_runner,
 * space_mission: ← → steer, the region owns those keys), spell (word_forest:
 * many letters), slide (puzzle_castle: the arrows slide the tiles).
 * The Créer apps (drawing, music sequencer, sandbox) need a pointer: not on TV.
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
