import type { ArcadeGameId } from '@/lib/arcade/types';
import { darken, lighten, mix } from './color';

/** The little things floating in each game's sky: they tell the theme before a word is read. */
export const GAME_MOTIFS: Record<ArcadeGameId, string[]> = {
  math_runner: ['➕', '⭐', '🔢', '👟', '✖️', '🏁'],
  alphabet_quest: ['🅰️', '✏️', '📚', '🔤', '⭐', '🖍️'],
  memory_magic: ['🃏', '✨', '🔮', '⭐', '🎩', '💫'],
  color_lab: ['🧪', '🎨', '💧', '🌈', '✨', '🖌️'],
  little_scientist: ['🔬', '🧬', '🌱', '⚗️', '🔭', '💡'],
  word_forest: ['🌲', '🍄', '🦉', '🍃', '🌳', '🐿️'],
  number_island: ['🏝️', '🐚', '🌊', '🐠', '⛵', '🦀'],
  space_mission: ['🪐', '⭐', '☄️', '🌙', '🛸', '✨'],
  dino_dig: ['🦕', '🦴', '🌋', '🌿', '🥚', '🦖'],
  music_garden: ['🎵', '🌷', '🎶', '🌻', '🐝', '🦋'],
  puzzle_castle: ['🧩', '🏰', '⭐', '🗝️', '🎈', '👑'],
  robot_factory: ['⚙️', '🤖', '🔩', '💡', '🔧', '🔋'],
  eco_world: ['♻️', '🌍', '🌳', '💧', '🌼', '🐝'],
  animal_rescue: ['🐾', '🐶', '🐱', '🐰', '🦴', '💛'],
  little_chef: ['🧁', '🍓', '🥕', '🍪', '🥄', '🍋'],
  geography_explorer: ['🧭', '🗺️', '🌍', '⛰️', '🎈', '🏝️'],
  story_builder_game: ['📖', '🪄', '✨', '🐉', '🏰', '🌙'],
  art_studio: ['🎨', '🖌️', '🖍️', '🌈', '✏️', '⭐'],
  space_memory: ['🌌', '🪐', '⭐', '🌙', '☄️', '✨'],
  dragon_academy: ['🐉', '🔥', '🏰', '📜', '⭐', '🪄'],
};

/** Games that happen at night (starry sky, glowing track). */
export const NIGHT_GAMES: ReadonlySet<ArcadeGameId> = new Set<ArcadeGameId>(['space_mission', 'space_memory']);

export interface ScenePalette {
  skyTop: string;
  skyBottom: string;
  sun: string;
  far: string;
  mid: string;
  near: string;
  ground: string;
  groundDeep: string;
  accent: string;
  night: boolean;
}

/**
 * A soft monochrome landscape in the accent's own pastel tints (sky, three
 * rows of hills, ground) — every game gets its own world, all in one style.
 * `from`/`to` (a world's colours) tint the sky when given.
 */
export function scenePalette(accent: string, opts: { night?: boolean; from?: string; to?: string } = {}): ScenePalette {
  if (opts.night) {
    return {
      skyTop: mix(darken(accent, 0.72), '#0B1038', 0.45),
      skyBottom: mix(darken(accent, 0.35), '#3B2A7A', 0.4),
      sun: lighten(accent, 0.5),
      far: mix(darken(accent, 0.45), '#2B2368', 0.4),
      mid: mix(darken(accent, 0.55), '#211A55', 0.4),
      near: mix(darken(accent, 0.62), '#1A1446', 0.4),
      ground: mix(darken(accent, 0.66), '#171240', 0.45),
      groundDeep: '#120E33',
      accent,
      night: true,
    };
  }
  const from = opts.from ?? lighten(accent, 0.78);
  const to = opts.to ?? lighten(accent, 0.55);
  return {
    skyTop: mix(mix(to, '#8FD3FF', 0.45), accent, 0.08),
    skyBottom: mix(from, '#FFF8EC', 0.45),
    sun: '#FFE9A8',
    far: mix(lighten(accent, 0.66), '#DFF3FF', 0.25),
    mid: lighten(accent, 0.46),
    near: lighten(accent, 0.28),
    ground: lighten(accent, 0.6),
    groundDeep: lighten(accent, 0.74),
    accent,
    night: false,
  };
}
