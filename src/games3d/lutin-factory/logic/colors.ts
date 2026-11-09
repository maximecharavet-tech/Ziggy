/**
 * Colour mixing (the mixer machine), as children learn it with paint:
 * every colour is made of primaries (red, yellow, blue); mixing two paints
 * joins their primaries. Two primaries make a secondary (red + yellow =
 * orange), and when all three primaries meet you get brown.
 */
import { COLORS, type Color } from './types';

type Primary = 'red' | 'yellow' | 'blue';

const PRIMARIES_OF: Record<Color, readonly Primary[]> = {
  red: ['red'],
  yellow: ['yellow'],
  blue: ['blue'],
  orange: ['red', 'yellow'],
  green: ['yellow', 'blue'],
  purple: ['red', 'blue'],
  brown: ['red', 'yellow', 'blue'],
};

function fromPrimaries(set: ReadonlySet<Primary>): Color {
  const r = set.has('red');
  const y = set.has('yellow');
  const b = set.has('blue');
  if (r && y && b) return 'brown';
  if (r && y) return 'orange';
  if (y && b) return 'green';
  if (r && b) return 'purple';
  if (r) return 'red';
  if (y) return 'yellow';
  return 'blue';
}

/** Mix two paints (symmetric, a + a = a). */
export function mixColors(a: Color, b: Color): Color {
  return fromPrimaries(new Set([...PRIMARIES_OF[a], ...PRIMARIES_OF[b]]));
}

export function isColor(v: unknown): v is Color {
  return typeof v === 'string' && (COLORS as readonly string[]).includes(v);
}

/** Primary colours of a paint (for the HUD's "made of" picture). */
export function primariesOf(c: Color): readonly Primary[] {
  return PRIMARIES_OF[c];
}

/** Icons shown with every colour (colour-blind safe, design doc B4/B5). */
export const COLOR_ICON: Record<Color, string> = {
  red: '🍓',
  yellow: '🍋',
  blue: '💧',
  green: '🍃',
  purple: '🍇',
  orange: '🍊',
  brown: '🌰',
};
