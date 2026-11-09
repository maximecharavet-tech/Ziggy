/**
 * The workshop's felt-and-wood palette (warm, cosy, never neon) and the
 * colour / pattern codes shared by machines, toys and the HUD.
 * Every paint has a pattern too (colour-blind safe, design doc B4/B5).
 */
import type { Color, Material, Pattern } from '../logic';

export const FELT = {
  cream: '#fff1dc',
  creamShade: '#f3dcbc',
  peach: '#ffd9b8',
  wood: '#c98b55',
  woodLight: '#e2b27a',
  woodDark: '#8a5530',
  woodDeep: '#6a3d22',
  red: '#e2453c',
  redDark: '#b23229',
  green: '#4f9a4a',
  greenDark: '#3a7a39',
  lavender: '#a98bd6',
  lavenderDark: '#7d63b0',
  hazel: '#b07a45',
  hazelDark: '#8a5a30',
  gold: '#f2c14e',
  goldDark: '#c9952a',
  navy: '#3b4a7a',
  mint: '#7fcfb5',
  pink: '#ff8fb5',
  sky: '#8fc8ff',
  snow: '#f6f8ff',
  ink: '#3a2a20',
  steel: '#9aa6b2',
  white: '#ffffff',
} as const;

/** The six paints + brown (mixer only). */
export const PAINT_HEX: Record<Color, string> = {
  red: '#e5403a',
  yellow: '#ffd23f',
  blue: '#3d7de0',
  green: '#47b25a',
  purple: '#8e5bd6',
  orange: '#ff8a2b',
  brown: '#8a5a33',
};

/** Raw materials before any paint. */
export const MATERIAL_HEX: Record<Material, string> = {
  wood: '#dba76c',
  felt: '#f4e9db',
  metal: '#b9c3cc',
  yarn: '#f3a9bf',
};

/** Wrapping paper colour per pattern (the pattern itself is drawn in white). */
export const WRAP_HEX: Record<Pattern, string> = {
  stripes: '#e2453c',
  dots: '#3d7de0',
  stars: '#4a3f9a',
  snowflakes: '#2f9e9a',
  hearts: '#ff6fa5',
};

/** Pattern codes read by the toy shader (patterns.ts): paints 1–7 (subtle), papers 11–15 (bold). */
export const PAINT_PATTERN: Record<Color, number> = { red: 1, yellow: 2, blue: 3, green: 4, purple: 5, orange: 6, brown: 7 };
export const WRAP_PATTERN: Record<Pattern, number> = { stripes: 11, dots: 12, stars: 13, snowflakes: 14, hearts: 15 };

/** Crew colours (the elf on duty). */
export const CREW_HEX: Record<string, string> = { pepin: FELT.green, grelotte: FELT.lavender, noisette: FELT.hazel, ziggy: FELT.red };

/** Icons used on the machines' signs and in the HUD. */
export const MATERIAL_ICON: Record<Material, string> = { wood: '🪵', felt: '🧣', metal: '🥫', yarn: '🧶' };
export const STICKER_ICON: Record<string, string> = { star: '⭐', heart: '❤️', moon: '🌙', snowflake: '❄️' };
export const PATTERN_ICON: Record<Pattern, string> = { stripes: '〰️', dots: '⚪', stars: '✨', snowflakes: '❄️', hearts: '💗' };
export const SHAPE_ICON: Record<string, string> = { cube: '🟫', ball: '⚪', cylinder: '🥫', cone: '🔺', star: '⭐', wheel: '🛞' };
