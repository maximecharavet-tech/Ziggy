'use client';

import { isMuted } from '@/lib/sound';

/**
 * Little code-built sounds of Les Lutins Farceurs (Web Audio, no files): the
 * wheel's ratchet tick, sleigh bells, a found-it twinkle and a cheerful fanfare.
 * Silent when the site is muted; the context is made on the first tap.
 */

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined' || isMuted()) return null;
  try {
    type W = typeof window & { webkitAudioContext?: typeof AudioContext };
    const C = window.AudioContext ?? (window as W).webkitAudioContext;
    if (!C) return null;
    ctx ??= new C();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(a: AudioContext, f: number, at: number, dur: number, gain: number, type: OscillatorType = 'sine') {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(a.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

/** A bell: a few inharmonic partials that ring out. */
function bell(a: AudioContext, f: number, at: number, dur = 0.9, gain = 0.12) {
  [1, 2.01, 2.76, 4.07].forEach((m, i) => tone(a, f * m, at, dur / (1 + i * 0.6), gain / (1 + i * 1.4)));
}

export const sfx = {
  /** The wheel's peg passing the pointer. */
  tick(speed = 1) {
    const a = ac();
    if (!a) return;
    const t = a.currentTime;
    tone(a, 1900 + Math.min(1, speed) * 500, t, 0.03, 0.06, 'square');
    tone(a, 380, t, 0.04, 0.05, 'triangle');
  },
  /** Sleigh bells: the wheel lands, a letter arrives. */
  jingle() {
    const a = ac();
    if (!a) return;
    const t = a.currentTime;
    for (let i = 0; i < 7; i++) bell(a, 2093 + ((i * 337) % 600), t + i * 0.055 + (i % 2) * 0.02, 0.35, 0.05);
    bell(a, 1047, t + 0.38, 1.2, 0.12);
    bell(a, 1568, t + 0.5, 1.0, 0.08);
  },
  /** An elf is found. */
  found(i = 0) {
    const a = ac();
    if (!a) return;
    const t = a.currentTime;
    const base = [784, 880, 988][i % 3];
    tone(a, base, t, 0.12, 0.14, 'triangle');
    tone(a, base * 1.5, t + 0.08, 0.16, 0.12, 'triangle');
    bell(a, base * 2, t + 0.16, 0.7, 0.07);
  },
  /** A soft "boing": a playful miss, never harsh. */
  boing() {
    const a = ac();
    if (!a) return;
    const t = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(300, t + 0.18);
    o.frequency.exponentialRampToValueAtTime(420, t + 0.3);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + 0.36);
  },
  /** The celebration at the end of the game. */
  fanfare() {
    const a = ac();
    if (!a) return;
    const t = a.currentTime;
    [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(a, f, t + i * 0.11, i === 5 ? 0.6 : 0.14, 0.12, 'triangle'));
    bell(a, 2093, t + 0.6, 1.1, 0.06);
  },
};
