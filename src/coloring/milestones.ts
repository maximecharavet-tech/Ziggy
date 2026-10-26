import type { L } from '@/lib/i18n-text';

/**
 * Ziggy cheers at a few moments, never too often: after some actions, when
 * half the page is coloured and when every zone is.
 */
export const ACTION_STEPS = [4, 12, 25, 45, 80];

export const CHEERS: L[] = [
  { fr: 'Quelles jolies couleurs !', en: 'What pretty colours!' },
  { fr: 'Waouh, c’est magnifique !', en: 'Wow, it’s beautiful!' },
  { fr: 'Tu es un vrai artiste !', en: 'You are a real artist!' },
  { fr: 'J’adore ce que tu fais !', en: 'I love what you’re doing!' },
  { fr: 'Encore un peu de magie ?', en: 'A little more magic?' },
];
export const HALF: L = { fr: 'Déjà la moitié ! Continue comme ça !', en: 'Halfway there! Keep going!' };
export const DONE: L = { fr: 'Bravo ! Tout est colorié ! Fais-le prendre vie en 3D !', en: 'Well done! Everything is coloured! Bring it to life in 3D!' };

/** Almost every zone (tiny sparkles may stay white). */
export const DONE_AT = 0.95;

export type Cheer = { kind: 'action' | 'half' | 'done'; text: L };

/**
 * The cheer for this change, if any.
 * `actions` = total actions so far; `ratio` = share of zones coloured (0–1).
 */
export function cheerFor(prev: { actions: number; ratio: number }, next: { actions: number; ratio: number }): Cheer | null {
  if (prev.ratio < DONE_AT && next.ratio >= DONE_AT) return { kind: 'done', text: DONE };
  if (prev.ratio < 0.5 && next.ratio >= 0.5) return { kind: 'half', text: HALF };
  const i = ACTION_STEPS.findIndex((s) => prev.actions < s && next.actions >= s);
  if (i >= 0) return { kind: 'action', text: CHEERS[i % CHEERS.length] };
  return null;
}

/** Share of a page's zones that have a colour. */
export function filledRatio(regionIds: string[], fills: Record<string, string>): number {
  if (!regionIds.length) return 0;
  return regionIds.filter((id) => Boolean(fills[id])).length / regionIds.length;
}
