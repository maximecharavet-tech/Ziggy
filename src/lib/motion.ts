/**
 * Motion tokens, shared by every animated piece of the site (the same rules as
 * the other Hyper™ AI Engine sites).
 *
 * - Interface feedback stays under 300 ms; only transform and opacity animate.
 * - Hover effects only on devices with a real pointer.
 * - Ziggy himself is allowed a little more bounce: he is a toy, the UI is not.
 */

export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;

export const DUR = {
  press: 0.16,
  tooltip: 0.18,
  dropdown: 0.22,
  reveal: 0.28,
  panel: 0.3,
} as const;

export const SPRING = { type: 'spring', duration: 0.5, bounce: 0.2 } as const;
/** For the mascot and rewards only. */
export const SPRING_PLAYFUL = { type: 'spring', duration: 0.6, bounce: 0.35 } as const;

export const STAGGER = 0.055;

/** True when the device has a fine pointer that can hover. */
export function pointerFine(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}
