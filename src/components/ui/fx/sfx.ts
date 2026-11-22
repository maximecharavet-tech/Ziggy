/**
 * The effects' doorway to Ziggy's sounds (`@/lib/sound`, owned by the sound
 * design). Effects never start a sound before the visitor has interacted
 * (browsers would refuse anyway), respect the mute switch (playSound does),
 * and each sound has a small per-name rate limit so a burst of taps never
 * becomes a wall of noise.
 */
import { playSound, type SoundName } from '@/lib/sound';
import { createRateLimit, type RateLimit } from './rate-limit';
import { hasUserGesture, now } from './env';

/** Any sound of the catalogue (`src/lib/sfx/catalog.ts`). */
export type FxSound = SoundName;

export interface FxSoundOptions {
  /** 0–1, relative to the sound's normal level (counter ticks are quiet). */
  volume?: number;
  /** Plays even before a gesture (only for sounds that follow a gesture by construction). */
  force?: boolean;
}

const limits = new Map<FxSound, RateLimit>();
/** Ui sounds may repeat quickly; the long, funny ones may not. */
const GAPS: Partial<Record<FxSound, number>> = {
  tap: 45,
  hover: 90,
  pop: 60,
  sparkle: 120,
  boing: 160,
  giggle: 700,
  snore: 6000,
  tada: 900,
  confetti: 700,
  pageIn: 400,
  yay: 900,
  drumroll: 1500,
};

function limitFor(name: FxSound): RateLimit {
  let l = limits.get(name);
  if (!l) {
    l = createRateLimit({ perSecond: 12, minGapMs: GAPS[name] ?? 100 });
    limits.set(name, l);
  }
  return l;
}

/** Plays one of Ziggy's sounds for an effect. Returns whether it was allowed. */
export function fxSound(name: FxSound | false | null | undefined, opts: FxSoundOptions = {}): boolean {
  if (!name) return false;
  if (!opts.force && !hasUserGesture()) return false;
  if (!limitFor(name).take(now())) return false;
  try {
    const volume = opts.volume === undefined ? undefined : Math.min(1, Math.max(0, opts.volume));
    playSound(name, volume === undefined ? undefined : { volume });
    return true;
  } catch {
    return false;
  }
}
