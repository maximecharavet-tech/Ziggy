/**
 * Fun procedural robot voices for picking a game (Web Audio only — no files).
 * Respects ziggy:muted via isMuted() and unlocks AudioContext on first gesture.
 *
 * Inspired by classic chip / R2-style chirps (techniques only; original synth here).
 */

import { isMuted } from '@/lib/sound';

type RobotKind =
  | 'bleep'
  | 'bloop'
  | 'chirp'
  | 'boing'
  | 'beepBoop'
  | 'servo'
  | 'giggle'
  | 'wah'
  | 'ringMod'
  | 'arpeggio'
  | 'squeak'
  | 'fanfare';

const BANK: RobotKind[] = [
  'bleep',
  'bloop',
  'chirp',
  'boing',
  'beepBoop',
  'servo',
  'giggle',
  'wah',
  'ringMod',
  'arpeggio',
  'squeak',
  'fanfare',
];

let ctx: AudioContext | null = null;
let lastKind: RobotKind | null = null;
let lastTickAt = 0;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    type W = typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (window as W).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function env(g: GainNode, t0: number, peak: number, attack: number, release: number) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);
}

function tone(
  a: AudioContext,
  opts: {
    freq: number;
    t0: number;
    dur: number;
    type?: OscillatorType;
    peak?: number;
    slideTo?: number;
    detune?: number;
  },
) {
  const osc = a.createOscillator();
  const g = a.createGain();
  const peak = opts.peak ?? 0.12;
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.freq, opts.t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), opts.t0 + opts.dur);
  if (opts.detune) osc.detune.setValueAtTime(opts.detune, opts.t0);
  env(g, opts.t0, peak, 0.01, Math.max(0.04, opts.dur - 0.01));
  osc.connect(g).connect(a.destination);
  osc.start(opts.t0);
  osc.stop(opts.t0 + opts.dur + 0.03);
}

function noiseBlip(a: AudioContext, t0: number, dur: number, peak: number) {
  const n = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, n, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = a.createBufferSource();
  const g = a.createGain();
  const f = a.createBiquadFilter();
  src.buffer = buf;
  f.type = 'bandpass';
  f.frequency.setValueAtTime(1800 + Math.random() * 1200, t0);
  f.Q.value = 4;
  env(g, t0, peak, 0.005, dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

function pickKind(): RobotKind {
  let k = BANK[Math.floor(Math.random() * BANK.length)]!;
  let guard = 0;
  while (k === lastKind && guard++ < 8) k = BANK[Math.floor(Math.random() * BANK.length)]!;
  lastKind = k;
  return k;
}

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function playKind(a: AudioContext, kind: RobotKind, rate: number) {
  const t0 = a.currentTime + 0.01;
  const p = (x: number) => x * rate;

  switch (kind) {
    case 'bleep':
      tone(a, { freq: p(rand(700, 1100)), t0, dur: 0.08, type: 'square', peak: 0.1 });
      tone(a, { freq: p(rand(900, 1400)), t0: t0 + 0.07, dur: 0.1, type: 'square', peak: 0.09 });
      break;
    case 'bloop':
      tone(a, { freq: p(rand(280, 420)), t0, dur: 0.18, type: 'sine', peak: 0.14, slideTo: p(rand(160, 240)) });
      break;
    case 'chirp': {
      let t = t0;
      for (let i = 0; i < 5; i++) {
        const f = p(rand(600, 1600));
        tone(a, { freq: f, t0: t, dur: 0.05, type: 'triangle', peak: 0.08, slideTo: f * rand(1.2, 1.7) });
        t += rand(0.045, 0.08);
      }
      break;
    }
    case 'boing':
      tone(a, { freq: p(180), t0, dur: 0.35, type: 'sine', peak: 0.16, slideTo: p(520) });
      tone(a, { freq: p(360), t0: t0 + 0.02, dur: 0.28, type: 'triangle', peak: 0.06, slideTo: p(700) });
      break;
    case 'beepBoop':
      tone(a, { freq: p(660), t0, dur: 0.1, type: 'square', peak: 0.1 });
      tone(a, { freq: p(440), t0: t0 + 0.12, dur: 0.14, type: 'square', peak: 0.11 });
      tone(a, { freq: p(880), t0: t0 + 0.28, dur: 0.1, type: 'square', peak: 0.09 });
      break;
    case 'servo':
      tone(a, { freq: p(120), t0, dur: 0.4, type: 'sawtooth', peak: 0.05, slideTo: p(90) });
      noiseBlip(a, t0, 0.12, 0.04);
      tone(a, { freq: p(200), t0: t0 + 0.15, dur: 0.25, type: 'sawtooth', peak: 0.045, slideTo: p(280) });
      break;
    case 'giggle': {
      let t = t0;
      for (let i = 0; i < 6; i++) {
        tone(a, { freq: p(rand(500, 900) + i * 40), t0: t, dur: 0.045, type: 'triangle', peak: 0.07 });
        t += 0.055;
      }
      break;
    }
    case 'wah':
      tone(a, { freq: p(220), t0, dur: 0.35, type: 'sawtooth', peak: 0.08, slideTo: p(480) });
      tone(a, { freq: p(440), t0: t0 + 0.05, dur: 0.3, type: 'sine', peak: 0.05, slideTo: p(200) });
      break;
    case 'ringMod': {
      const car = a.createOscillator();
      const mod = a.createOscillator();
      const g = a.createGain();
      const mG = a.createGain();
      car.type = 'sine';
      mod.type = 'sine';
      car.frequency.setValueAtTime(p(rand(300, 500)), t0);
      mod.frequency.setValueAtTime(p(rand(40, 90)), t0);
      mG.gain.value = p(rand(120, 280));
      mod.connect(mG).connect(car.frequency);
      env(g, t0, 0.1, 0.02, 0.28);
      car.connect(g).connect(a.destination);
      car.start(t0);
      mod.start(t0);
      car.stop(t0 + 0.35);
      mod.stop(t0 + 0.35);
      break;
    }
    case 'arpeggio': {
      const base = p(rand(300, 400));
      [1, 5 / 4, 3 / 2, 2, 3 / 2].forEach((m, i) => {
        tone(a, { freq: base * m, t0: t0 + i * 0.07, dur: 0.09, type: 'triangle', peak: 0.09 });
      });
      break;
    }
    case 'squeak':
      tone(a, { freq: p(1400), t0, dur: 0.12, type: 'square', peak: 0.07, slideTo: p(2200) });
      tone(a, { freq: p(1800), t0: t0 + 0.08, dur: 0.1, type: 'triangle', peak: 0.05, slideTo: p(900) });
      break;
    case 'fanfare':
      [523, 659, 784, 1047].forEach((f, i) => {
        tone(a, { freq: p(f * rand(0.98, 1.04)), t0: t0 + i * 0.08, dur: 0.12 + i * 0.02, type: 'triangle', peak: 0.1 });
      });
      break;
  }
}

/** Soft tick when the slider moves to another card. */
export function playRobotTick(): void {
  if (isMuted()) return;
  const a = audio();
  if (!a) return;
  const now = performance.now();
  if (now - lastTickAt < 90) return;
  lastTickAt = now;
  tone(a, { freq: rand(780, 920), t0: a.currentTime, dur: 0.04, type: 'sine', peak: 0.045 });
}

/** Random fun robot voice when the child picks a game (never same kind twice in a row). */
export function playRobotSelect(): void {
  if (isMuted()) return;
  const a = audio();
  if (!a) return;
  const kind = pickKind();
  const rate = rand(0.88, 1.18);
  playKind(a, kind, rate);
}

export const ROBOT_VOICE_NAMES: RobotKind[] = [...BANK];
