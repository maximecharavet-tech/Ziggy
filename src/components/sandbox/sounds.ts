/**
 * Soft sounds of the sandbox, made in code (WebAudio, no file): a little note
 * in the element's pitch family when the child pours, a three-note motif per
 * discovery, and the notes of the snow-globe surprise. Quiet, never sudden,
 * throttled, and silent whenever the site is muted.
 */
import { isMuted } from '@/lib/sound';
import { elementPitch } from '@/games2d/sandbox/content';

let ctx: AudioContext | null = null;
let last = 0;

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || isMuted()) return null;
  try {
    type WithWebkit = typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (window as WithWebkit).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(a: AudioContext, freq: number, start: number, dur: number, gain: number, type: OscillatorType = 'sine') {
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(a.destination);
  osc.start(start);
  osc.stop(start + dur + 0.03);
}

/** A soft note for the element being poured (at most a few per second). */
export function pourNote(element: number, minGapMs = 140): void {
  const now = performance.now();
  if (now - last < minGapMs) return;
  const a = audio();
  if (!a) return;
  last = now;
  const base = elementPitch(element);
  const step = [1, 1.125, 1.25, 1.5, 1.667][Math.floor(now / 97) % 5];
  tone(a, base * step, a.currentTime, 0.22, 0.035, element === 0 ? 'triangle' : 'sine');
}

/** The three-note motif of a discovery. */
export function discoveryMotif(seed: number): void {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const root = [523, 587, 659, 698, 784][seed % 5];
  [1, 1.25, 1.5].forEach((m, k) => tone(a, root * m, t + k * 0.11, 0.35, 0.06, 'triangle'));
}

/** Ziggy's saucer hums by (a gentle wobbling whistle). */
export function saucerHum(): void {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(660, t);
  osc.frequency.linearRampToValueAtTime(880, t + 0.25);
  osc.frequency.linearRampToValueAtTime(620, t + 0.6);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.04, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + 0.75);
}
