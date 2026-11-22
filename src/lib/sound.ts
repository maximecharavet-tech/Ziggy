/**
 * Ziggy's sound effects.
 *
 * Synthesised with the Web Audio API rather than shipped as files (see
 * `src/lib/sfx/`): nothing to download, no licence, crisp at any volume. This
 * module is the site's door to them:
 *
 * - `playSound(name, opts?)`: the original names (tap, correct, wrong, star,
 *   win, reward, pop) plus the funny ones (boing, squeak, whoosh…).
 * - The global mute (`MUTE_KEY`, `setMuted`) silences everything, at once.
 * - "Sons doux" (`setSoftSounds`) makes every effect quieter and rounder.
 * - The AudioContext is created only after a real user gesture, and nothing
 *   plays before one: no sound on page load.
 * - Effects dip while Ziggy reads aloud (src/lib/voice.ts), so his words stay clear.
 */
import { isSoundName, SOUND_NAMES, type SoundName } from './sfx/catalog';
import { SfxPlayer, type PlayOptions } from './sfx/player';

export { SOUND_NAMES, type SoundName, type PlayOptions };

export const MUTE_KEY = 'ziggy:muted';
export const MUTE_EVENT = 'ziggy:muted';
export const SOFT_KEY = 'ziggy:soft-sounds';
export const SOFT_EVENT = 'ziggy:soft-sounds';

function isBrowser() {
  return typeof window !== 'undefined';
}

function readFlag(key: string): boolean {
  if (!isBrowser()) return false;
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string, on: boolean, event: string) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, on ? '1' : '0');
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(event, { detail: on }));
}

export function isMuted(): boolean {
  return readFlag(MUTE_KEY);
}

export function setMuted(muted: boolean): void {
  if (muted) live?.player.stopAll();
  writeFlag(MUTE_KEY, muted, MUTE_EVENT);
}

/** "Sons doux / soft sounds": every effect quieter and rounder. */
export function isSoftSounds(): boolean {
  return readFlag(SOFT_KEY);
}

export function setSoftSounds(soft: boolean): void {
  live?.player.bus.setLevel(1, soft);
  writeFlag(SOFT_KEY, soft, SOFT_EVENT);
}

/* ── user gesture: browsers refuse to start audio before one, and so do we ── */

let gestured = false;
if (isBrowser()) {
  const mark = () => {
    gestured = true;
  };
  for (const type of ['pointerdown', 'keydown', 'touchstart']) {
    window.addEventListener(type, mark, { capture: true, passive: true, once: true });
  }
}

function hasGesture(): boolean {
  if (gestured) return true;
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return activation?.hasBeenActive === true;
}

/* ── the live context, made on the first sound after a gesture ── */

let live: { ctx: AudioContext; player: SfxPlayer } | null = null;

function getLive(): typeof live {
  if (live) {
    // Safari and Chrome park the context until a gesture resumes it.
    if (live.ctx.state !== 'running') void live.ctx.resume().catch(() => {});
    return live;
  }
  try {
    type WithWebkit = typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (window as WithWebkit).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    const player = new SfxPlayer(ctx);
    player.bus.setLevel(1, isSoftSounds());
    live = { ctx, player };
    duckUnderVoice(player);
    return live;
  } catch {
    return null;
  }
}

/**
 * Effects dip while Ziggy speaks. voice.ts imports this module, so it is
 * loaded lazily here (a static import would be circular).
 */
function duckUnderVoice(player: SfxPlayer) {
  void import('./voice')
    .then(({ voiceStore }) => {
      const sync = () => player.bus.setDucked(Boolean(voiceStore.get().speakingId));
      voiceStore.subscribe(sync);
      sync();
    })
    .catch(() => {});
}

/**
 * Play one of Ziggy's sounds. Options: `pitch` (semitones), `volume` (0–1),
 * `pan` (−1…1), `variation` (default true: each play is a hair different).
 * Silent when muted, before any user gesture, or when a mix limit skips it.
 */
export function playSound(name: SoundName, opts?: PlayOptions): void {
  if (!isBrowser() || isMuted() || !isSoundName(name) || !hasGesture()) return;
  // Hover ticks only where there is a real hovering pointer.
  if (name === 'hover' && window.matchMedia?.('(hover: none)').matches) return;
  const audio = getLive();
  if (!audio) return;
  audio.player.play(name, opts, audio.ctx.currentTime + 0.005);
}
