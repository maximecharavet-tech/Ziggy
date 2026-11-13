/**
 * The audience of Ziggy, in one place: metadata, FAQ, home badge, manifest,
 * prompts. The translated messages (messages/*.json) spell the numbers out,
 * so `src/lib/ages.test.ts` fails when they drift away from these values.
 */
export const AGE_MIN = 4;
export const AGE_MAX = 12;

/** "4-12" (or with another separator, e.g. " à "). */
export function ageRange(separator = '-'): string {
  return `${AGE_MIN}${separator}${AGE_MAX}`;
}

/** L'appli du Père Noël starts earlier, always with a parent next to the child. */
export const SANTA_AGE_MIN = 3;
