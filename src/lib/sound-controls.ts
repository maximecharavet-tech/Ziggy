/**
 * What the sound controls do (SoundToggle.tsx, SoftSoundsSwitch.tsx):
 * - a tap on the sound button mutes / unmutes, at once (as it always did);
 * - a long press on it (≥ LONG_PRESS_MS) switches "sons doux / soft sounds";
 * - soft sounds also have their own labelled switch (mobile menu, and right
 *   after the button for keyboard and screen-reader users).
 * Every change is heard as well as seen: a tiny "pop" at the new level, so a
 * child who can't read knows what happened. Nothing plays while muted.
 */
import { isMuted, isSoftSounds, playSound, setMuted, setSoftSounds } from './sound';

export const LONG_PRESS_MS = 500;

/** Mute ↔ unmute. Returns the new muted state. */
export function toggleMute(): boolean {
  const muted = !isMuted();
  setMuted(muted);
  if (!muted) playSound('pop', { variation: false });
  return muted;
}

/** Soft ↔ normal sounds (the mute is left as it is). Returns the new soft state. */
export function toggleSoft(): boolean {
  const soft = !isSoftSounds();
  setSoftSounds(soft);
  if (!isMuted()) playSound('pop', { variation: false });
  return soft;
}

/**
 * Tells a tap from a long press. The component calls `start` on pointer down,
 * `cancel` on pointer up / leave, and asks `takeLong()` in its click handler:
 * true once right after a long press, so that click does not also mute.
 */
export function createPressTimer(onLong: () => void, ms = LONG_PRESS_MS, now: () => number = Date.now) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firedAt = -Infinity;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return {
    start() {
      cancel();
      firedAt = -Infinity;
      timer = setTimeout(() => {
        timer = null;
        firedAt = now();
        onLong();
      }, ms);
    },
    cancel,
    takeLong(): boolean {
      // A long press released outside the button sends no click: forget it soon after.
      const recent = now() - firedAt < 1500;
      firedAt = -Infinity;
      return recent;
    },
  };
}
