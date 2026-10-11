'use client';

/**
 * Sleep sound engine — Hyper Engine's Frequencies Web Audio graph, kept for
 * live listening, plus a soft music box, ducking under Ziggy's voice and a
 * long fade for the sleep timer.
 *
 *   binaural  : L = carrier − beat/2, R = carrier + beat/2 (headphones)
 *   pure      : one sine
 *   noise bed : rain / ocean / pink / brown, different seeds per ear
 */
import { binauralPair, musicBoxPhrase, timeline, type Settings } from './catalog';
import { noise } from './noise';

export interface SleepSession {
  /** Lower the whole bed while Ziggy speaks (0–1 of its level). */
  duck: (on: boolean) => void;
  setVolume: (v: number) => void;
  /** Fade everything out over `seconds`, then stop. */
  fadeOut: (seconds: number) => void;
  stop: () => void;
}

const FADE_IN = 4;

export function startSleepSound(ctx: AudioContext, s: Settings, opts: { musicBox: boolean; volume: number }): SleepSession {
  const t0 = ctx.currentTime;
  const end = t0 + s.minutes * 60;
  const out = ctx.createGain(); // user volume
  out.gain.value = opts.volume;
  const ducker = ctx.createGain(); // voice ducking
  const master = ctx.createGain(); // fades
  master.gain.setValueAtTime(0, t0);
  master.gain.linearRampToValueAtTime(1, t0 + FADE_IN);

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.ratio.value = 12;
  master.connect(ducker);
  ducker.connect(out);
  out.connect(limiter);
  limiter.connect(ctx.destination);

  const sources: AudioScheduledSourceNode[] = [];

  // Tones (very quiet for children).
  if (s.toneLevel > 0) {
    const merger = ctx.createChannelMerger(2);
    const tone = ctx.createGain();
    tone.gain.value = 0.35 * s.toneLevel;
    merger.connect(tone);
    tone.connect(master);
    const pts = timeline(s);
    const sides: (-1 | 0 | 1)[] = s.mode === 'binaural' ? [-1, 1] : [0];
    for (const side of sides) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      const f = (c: number, b: number) => (s.mode === 'binaural' ? binauralPair(c, b)[side < 0 ? 0 : 1] : c);
      o.frequency.setValueAtTime(f(pts[0].carrier, pts[0].beat), t0);
      for (const p of pts.slice(1)) o.frequency.linearRampToValueAtTime(f(p.carrier, p.beat), t0 + p.t);
      if (side <= 0) o.connect(merger, 0, 0);
      if (side >= 0) o.connect(merger, 0, 1);
      sources.push(o);
    }
  }

  // Noise bed.
  if (s.noise !== 'none' && s.noiseLevel > 0) {
    const len = ctx.sampleRate * 20;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    buf.copyToChannel(noise(s.noise, len, ctx.sampleRate, 11) as Float32Array<ArrayBuffer>, 0);
    buf.copyToChannel(noise(s.noise, len, ctx.sampleRate, 29) as Float32Array<ArrayBuffer>, 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0.5 * s.noiseLevel;
    src.connect(g);
    g.connect(master);
    sources.push(src);
  }

  // Music box: soft triangle notes with a slow echo, scheduled ahead.
  let boxTimer: number | null = null;
  if (opts.musicBox) {
    const box = ctx.createGain();
    box.gain.value = 0.12;
    const echo = ctx.createDelay(2);
    echo.delayTime.value = 0.45;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.35;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 2200;
    box.connect(lowpass);
    lowpass.connect(master);
    lowpass.connect(echo);
    echo.connect(feedback);
    feedback.connect(echo);
    echo.connect(master);
    let seed = Math.floor(Math.random() * 1e6);
    let next = t0 + 1.5;
    const schedule = () => {
      if (ctx.state === 'closed') return;
      while (next < ctx.currentTime + 12 && next < end) {
        const phrase = musicBoxPhrase(seed++, 8);
        for (const n of phrase) {
          const at = next + n.at;
          const o = ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.value = n.note;
          const env = ctx.createGain();
          env.gain.setValueAtTime(0, at);
          env.gain.linearRampToValueAtTime(1, at + 0.01);
          env.gain.exponentialRampToValueAtTime(0.001, at + 2.4);
          o.connect(env);
          env.connect(box);
          o.start(at);
          o.stop(at + 2.5);
        }
        next += phrase[phrase.length - 1].at + 4 + Math.random() * 3; // breathe between phrases
      }
      boxTimer = window.setTimeout(schedule, 4000);
    };
    schedule();
  }

  for (const n of sources) {
    n.start(t0);
    n.stop(end + 0.05);
  }

  const stopAll = (at: number) => {
    for (const n of sources) {
      try {
        n.stop(at);
      } catch {
        /* already stopped */
      }
    }
    if (boxTimer) window.clearTimeout(boxTimer);
    boxTimer = null;
  };

  return {
    duck: (on) => ducker.gain.setTargetAtTime(on ? 0.45 : 1, ctx.currentTime, 0.4),
    setVolume: (v) => out.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.1),
    fadeOut: (seconds) => {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + seconds);
      stopAll(now + seconds + 0.1);
    },
    stop: () => {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + 1.2);
      stopAll(now + 1.3);
    },
  };
}
