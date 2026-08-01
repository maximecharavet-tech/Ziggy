/**
 * Ziggy's sound effects.
 *
 * Synthesised with the Web Audio API rather than shipped as files: a handful of
 * oscillator blips cost nothing to download and stay crisp at any volume. The
 * AudioContext is created lazily on the first real gesture, because browsers
 * refuse to start one before the user has interacted with the page.
 */

export const MUTE_KEY = 'ziggy:muted';
export const MUTE_EVENT = 'ziggy:muted';

type Note = { freq: number; start: number; dur: number; gain?: number; type?: OscillatorType };

const VOICES: Record<string, Note[]> = {
  // Soft tick for taps and card flips
  tap: [{ freq: 660, start: 0, dur: 0.07, gain: 0.16, type: 'sine' }],
  // Rising two-note "yes"
  correct: [
    { freq: 660, start: 0, dur: 0.1 },
    { freq: 990, start: 0.08, dur: 0.16 },
  ],
  // Gentle falling tone — never harsh, this is for children
  wrong: [
    { freq: 320, start: 0, dur: 0.12, type: 'triangle' },
    { freq: 240, start: 0.1, dur: 0.16, type: 'triangle' },
  ],
  // Sparkle for a star
  star: [
    { freq: 880, start: 0, dur: 0.08 },
    { freq: 1320, start: 0.06, dur: 0.08 },
    { freq: 1760, start: 0.12, dur: 0.14 },
  ],
  // Little fanfare on a win
  win: [
    { freq: 523, start: 0, dur: 0.13 },
    { freq: 659, start: 0.12, dur: 0.13 },
    { freq: 784, start: 0.24, dur: 0.13 },
    { freq: 1047, start: 0.36, dur: 0.3 },
  ],
  // Ziggy's hello
  pop: [
    { freq: 440, start: 0, dur: 0.09, type: 'triangle' },
    { freq: 880, start: 0.07, dur: 0.13, type: 'triangle' },
  ],
};

export type SoundName = keyof typeof VOICES;

let ctx: AudioContext | null = null;

function isBrowser() {
  return typeof window !== 'undefined';
}

export function isMuted(): boolean {
  if (!isBrowser()) return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(MUTE_EVENT, { detail: muted }));
}

function getContext(): AudioContext | null {
  if (!isBrowser()) return null;
  try {
    type WithWebkit = typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (window as WithWebkit).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    // Safari and Chrome park the context until a gesture resumes it.
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function playSound(name: SoundName): void {
  if (isMuted()) return;
  const audio = getContext();
  const notes = VOICES[name];
  if (!audio || !notes) return;

  const now = audio.currentTime;
  for (const note of notes) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const peak = note.gain ?? 0.2;
    const t0 = now + note.start;

    osc.type = note.type ?? 'sine';
    osc.frequency.setValueAtTime(note.freq, t0);

    // Short fade in and out so nothing clicks.
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.dur);

    osc.connect(gain).connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + note.dur + 0.02);
  }
}
