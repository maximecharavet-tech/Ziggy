/**
 * The recipes: how each of Ziggy's sounds is built from the engine's
 * primitives. Times are in seconds from the start of the sound, frequencies in
 * Hz; the voice scales both (pitch option, per-play variation). Levels here are
 * only the balance inside a sound: `gains.ts` sets each sound's loudness.
 *
 * House rules: nothing harsh, nothing scary, nothing mocking. Every attack is
 * a few milliseconds long, "wrong" and "bonk" stay round and funny, and the
 * robot voices are synthesised vowels, never a recorded or imitated person.
 */
import type { SoundName } from './catalog';
import { bell, brass, fm, glitter, mallet, noise, tone, vox, whistle, type Voice } from './engine';
import { midi } from './math';

export type Recipe = (v: Voice) => void;

const C5 = midi(72), E5 = midi(76), G5 = midi(79), A5 = midi(81), B5 = midi(83);
const C6 = midi(84), E6 = midi(88), G6 = midi(91), A6 = midi(93), C7 = midi(96);

export const RECIPES: Record<SoundName, Recipe> = {
  /* ── the original seven ── */

  tap(v) {
    // A soft wooden "tok": a sine dropping a fifth in 30 ms, a felt click on top.
    tone(v, { f: 1050, to: 700, glide: 0.03, dur: 0.08, a: 0.0035, peak: 0.5 });
    tone(v, { f: 2100, to: 1500, glide: 0.02, dur: 0.03, a: 0.003, peak: 0.06 });
    noise(v, { dur: 0.014, a: 0.003, peak: 0.05, filter: { type: 'bandpass', f: 3200, q: 1.2 } });
  },

  correct(v) {
    // "Pling-plong!": two marimba notes up a fifth, a pinch of glitter on top.
    mallet(v, { f: E5, dur: 0.24, peak: 0.42 });
    mallet(v, { f: B5, at: 0.075, dur: 0.36, peak: 0.48 });
    bell(v, { f: E6 * 2, at: 0.12, dur: 0.22, peak: 0.07 });
  },

  wrong(v) {
    // A round, friendly "boo-bip?" that lifts at the end, like "on réessaie ?".
    const filter = { type: 'lowpass' as const, f: 1300, q: 0.6 };
    tone(v, { type: 'triangle', f: 415, to: 349, glide: 0.14, dur: 0.17, a: 0.014, d: 0.05, s: 0.7, r: 0.05, peak: 0.42, filter });
    tone(v, {
      type: 'triangle', at: 0.15, dur: 0.26, a: 0.016, d: 0.05, s: 0.75, r: 0.08, peak: 0.4, filter,
      pts: [[0, 330], [0.11, 330], [0.22, 392]], vib: { rate: 7, depth: 16, delay: 0.06 },
    });
  },

  star(v) {
    // "Ting-ting-tiiing": three bells up an A-major arpeggio, a shimmer behind.
    bell(v, { f: A5, dur: 0.26, peak: 0.3, pan: -0.15 });
    bell(v, { f: E6, at: 0.06, dur: 0.3, peak: 0.3 });
    bell(v, { f: A6, at: 0.12, dur: 0.6, peak: 0.3, pan: 0.15 });
    noise(v, { at: 0.1, dur: 0.45, a: 0.06, peak: 0.02, filter: { type: 'highpass', f: 6500 } });
  },

  win(v) {
    // Toy-trumpet fanfare C-E-G-C', the last note held with a smile of vibrato.
    [C5, E5, G5].forEach((f, i) => brass(v, { f, at: i * 0.11, dur: 0.13, peak: 0.34 }));
    brass(v, { f: C6, at: 0.33, dur: 0.6, peak: 0.38, vib: { rate: 6, depth: 18, delay: 0.14 } });
    bell(v, { f: C7, at: 0.33, dur: 0.55, peak: 0.08 });
    glitter(v, { at: 0.45, dur: 0.35, count: 5, lo: 2500, hi: 5500, peak: 0.05 });
  },

  reward(v) {
    // The reward ceremony: a quick rising sweep, a struck bell (inharmonic partials), glitter on top.
    [midi(67), C5, E5, G5].forEach((f, i) => tone(v, { type: 'triangle', f, at: i * 0.06, dur: 0.1, a: 0.004, peak: 0.16 }));
    const strike = 0.27;
    const partials: [number, number, number][] = [[1, 1.7, 0.4], [2.01, 1.25, 0.16], [2.78, 0.95, 0.1], [4.17, 0.65, 0.07], [5.44, 0.45, 0.04]];
    for (const [ratio, dur, peak] of partials) tone(v, { f: C5 * ratio, at: strike, dur, a: 0.004, peak });
    noise(v, { at: strike, dur: 0.05, a: 0.003, peak: 0.04, filter: { type: 'bandpass', f: 2600, q: 1.5 } });
    bell(v, { f: G6, at: 0.6, dur: 0.2, peak: 0.1, pan: -0.2 });
    bell(v, { f: C7, at: 0.68, dur: 0.4, peak: 0.1, pan: 0.2 });
    glitter(v, { at: 0.62, dur: 0.7, count: 7, lo: 2500, hi: 6000, peak: 0.05 });
  },

  pop(v) {
    // Ziggy's hello: a mouth-pop "blop", then a cute "pip!".
    tone(v, { f: 260, to: 1000, glide: 0.045, dur: 0.1, a: 0.005, peak: 0.5 });
    tone(v, { type: 'triangle', f: 1320, to: 1480, glide: 0.06, at: 0.075, dur: 0.11, a: 0.004, peak: 0.24 });
  },

  /* ── the funny ones ── */

  boing(v) {
    // Door-stop spring: jumps up, wobbles fast, settles and fades. "Boiiinnng".
    tone(v, { f: 90, to: 60, dur: 0.06, a: 0.003, peak: 0.25 }); // the little "b" thump
    fm(v, {
      pts: [[0, 150], [0.045, 430], [0.6, 320]], dur: 0.62, a: 0.004, peak: 0.42,
      ratio: 1, index: 1.1, indexTo: 0.15, indexTime: 0.4,
      vib: { rate: 13, depth: 110, depthTo: 12 },
      filter: { type: 'lowpass', f: 3200, to: 1100, q: 3 },
    });
  },

  squeak(v) {
    // Rubber duck: a nasal squeal that rises, then dips, through a narrow rubbery resonance.
    tone(v, {
      type: 'sawtooth', pts: [[0, 950], [0.07, 1500], [0.21, 1150]], dur: 0.22, a: 0.012, d: 0.05, s: 0.7, r: 0.06, peak: 0.5,
      vib: { rate: 28, depth: 35 }, filter: [{ type: 'bandpass', f: 2200, q: 3.5 }, { type: 'lowpass', f: 4500 }],
    });
    noise(v, { dur: 0.2, a: 0.02, peak: 0.03, filter: { type: 'bandpass', f: 2600, q: 3 } });
  },

  whoosh(v) {
    // A swish of air sweeping left to right.
    noise(v, { dur: 0.42, a: 0.16, d: 0.05, s: 0.8, r: 0.2, peak: 0.6, pan: -0.55, panTo: 0.55, filter: { type: 'bandpass', pts: [[0, 350], [0.2, 2200], [0.42, 650]], q: 1.4 } });
    noise(v, { dur: 0.36, a: 0.14, peak: 0.2, filter: { type: 'lowpass', f: 600 } });
  },

  sparkle(v) {
    // Magic glitter: a cloud of tiny bells on a high pentatonic, left and right.
    glitter(v, { dur: 0.55, count: 10, lo: 2000, hi: 6500, peak: 0.2 });
    noise(v, { dur: 0.55, a: 0.06, peak: 0.02, filter: { type: 'highpass', f: 7000 } });
  },

  bubble(v) {
    // "Bloop": a bubble's pitch shoots up as it pops, a smaller one follows.
    tone(v, { f: 380, to: 1250, glide: 0.07, dur: 0.12, a: 0.004, peak: 0.5 });
    tone(v, { f: 620, to: 1900, glide: 0.05, at: 0.075, dur: 0.085, a: 0.003, peak: 0.2 });
  },

  giggle(v) {
    // A little robot "hee-hee-hee": five "ee" chirps, each bending up then down, lower and slower.
    const steps: [number, number][] = [[0, 640], [0.085, 610], [0.175, 575], [0.27, 545], [0.375, 515]];
    steps.forEach(([when, f], i) => {
      noise(v, { at: when, dur: 0.02, a: 0.003, peak: 0.04, filter: { type: 'bandpass', f: 2600, q: 2 } }); // the "h"
      vox(v, {
        type: 'square', at: when + 0.01, dur: 0.07 + i * 0.008, a: 0.006, d: 0.02, s: 0.8, r: 0.025, peak: 0.55 - i * 0.05,
        pts: [[0, f * 0.92], [0.025, f * 1.1], [0.07, f * 0.94]],
        formants: [[0, 350, 2350, 3100], [0.07, 380, 2250, 3000]],
        levels: [0.8, 1, 0.35],
        filter: { type: 'lowpass', f: 5000 },
      });
    });
  },

  slideUp(v) {
    whistle(v, 480, 1500, 0.46);
  },

  slideDown(v) {
    whistle(v, 1450, 460, 0.5);
  },

  drumroll(v) {
    // A soft toy-snare roll that swells, then one round "tom!" to land it.
    const hits = 18;
    for (let i = 0; i < hits; i++) {
      const when = i * 0.032 + (v.rng() - 0.5) * 0.004;
      const level = (0.25 + 0.75 * (i / hits) ** 1.6) * (i % 2 ? 0.85 : 1);
      const pan = i % 2 ? 0.15 : -0.15;
      noise(v, { at: when, dur: 0.055, a: 0.002, peak: 0.24 * level, pan, filter: [{ type: 'bandpass', f: 1800, q: 0.9 }, { type: 'lowpass', f: 5000 }] });
      tone(v, { f: 250, to: 190, at: when, dur: 0.05, a: 0.002, peak: 0.1 * level, pan });
    }
    const land = hits * 0.032 + 0.01;
    tone(v, { f: 190, to: 120, at: land, dur: 0.24, a: 0.003, peak: 0.42 });
    noise(v, { at: land, dur: 0.12, a: 0.002, peak: 0.16, filter: { type: 'bandpass', f: 900, q: 0.8 } });
    noise(v, { at: land, dur: 0.3, a: 0.004, peak: 0.03, filter: { type: 'highpass', f: 6000 } });
  },

  tada(v) {
    // "Ta-daaa!": a quick brass pick-up chord, then a big round chord that blooms, a soft cymbal shimmer.
    [midi(67), midi(71), midi(74)].forEach((f) => brass(v, { f, dur: 0.12, peak: 0.17 }));
    const big = 0.16;
    [C5, E5, G5, C6].forEach((f, i) => brass(v, { f, at: big, dur: 0.85, peak: 0.17, pan: (i - 1.5) * 0.15, vib: { rate: 5.5, depth: 12, delay: 0.3 } }));
    noise(v, { at: big, dur: 0.9, a: 0.006, peak: 0.05, filter: [{ type: 'highpass', f: 5000 }, { type: 'peaking', f: 8000, q: 1, gain: 4 }] });
    bell(v, { f: C7, at: big, dur: 0.5, peak: 0.06 });
  },

  honk(v) {
    // Soft clown bulb horn: a reedy note that squeezes up a tone, through a rubbery horn.
    const pts = [[0, 300], [0.05, 345], [0.24, 335]] as const;
    const filter = [{ type: 'peaking' as const, f: 1000, q: 2.5, gain: 9 }, { type: 'peaking' as const, f: 2200, q: 3, gain: 5 }, { type: 'lowpass' as const, f: 2400, q: 0.7 }];
    tone(v, { type: 'sawtooth', pts: [...pts], dur: 0.27, a: 0.02, d: 0.05, s: 0.8, r: 0.07, peak: 0.25, filter });
    tone(v, { type: 'square', pts: [...pts], detune: 10, dur: 0.27, a: 0.02, d: 0.05, s: 0.8, r: 0.07, peak: 0.12, filter });
  },

  plop(v) {
    // Something soft landing in its spot: a quick falling "plp" with a felt thud.
    tone(v, { f: 620, to: 170, glide: 0.06, dur: 0.13, a: 0.005, peak: 0.5 });
    tone(v, { f: 130, to: 90, dur: 0.1, a: 0.004, peak: 0.22 });
    noise(v, { dur: 0.03, a: 0.002, peak: 0.06, filter: { type: 'lowpass', f: 1200 } });
  },

  magic(v) {
    // Wand chime: a quick harp glissando up a pentatonic, then a shimmering bell chord.
    const run = [C6, midi(86), E6, G6, A6, C7, midi(98), midi(100)];
    run.forEach((f, i) => bell(v, { f, at: i * 0.04, dur: 0.35, peak: 0.13, pan: -0.6 + (1.2 * i) / (run.length - 1) }));
    [G6, C7, midi(100)].forEach((f, i) => bell(v, { f, at: 0.36 + i * 0.015, dur: 0.95, peak: 0.1, pan: (i - 1) * 0.3 }));
    tone(v, { f: C6, at: 0.36, dur: 0.9, a: 0.05, peak: 0.05, trem: { rate: 7, depth: 0.4 } });
    noise(v, { at: 0.3, dur: 0.8, a: 0.1, peak: 0.02, filter: { type: 'highpass', f: 6500 } });
  },

  hover(v) {
    // A barely-there tick for a pointer gliding over a button.
    tone(v, { f: 1900, to: 1700, dur: 0.032, a: 0.004, peak: 0.3 });
  },

  unlock(v) {
    // "Click-clack, ding-ding!": a little lock, then a happy chime.
    noise(v, { dur: 0.016, a: 0.0015, peak: 0.16, filter: { type: 'bandpass', f: 2900, q: 3 } });
    tone(v, { f: 1800, to: 1500, dur: 0.022, a: 0.0015, peak: 0.08 });
    noise(v, { at: 0.055, dur: 0.02, a: 0.0015, peak: 0.14, filter: { type: 'bandpass', f: 2000, q: 3 } });
    tone(v, { f: 1300, to: 1100, at: 0.055, dur: 0.025, a: 0.0015, peak: 0.08 });
    mallet(v, { f: G5, at: 0.13, dur: 0.3, peak: 0.36 });
    mallet(v, { f: C6, at: 0.21, dur: 0.45, peak: 0.4 });
    bell(v, { f: C7, at: 0.23, dur: 0.3, peak: 0.06 });
  },

  bonk(v) {
    // Cartoon "bonk" on a hollow coconut: woody, falls in pitch, then a tiny bouncy "pwip". Funny, not painful.
    fm(v, { f: 520, to: 300, glide: 0.08, dur: 0.18, a: 0.004, peak: 0.42, ratio: 1.41, index: 1.8, indexTo: 0.1, indexTime: 0.06 });
    tone(v, { f: 210, to: 150, dur: 0.2, a: 0.005, peak: 0.28 });
    tone(v, { f: 520, to: 820, at: 0.11, dur: 0.12, a: 0.008, peak: 0.07 });
  },

  pageIn(v) {
    // A light paper swoosh for a new page: airy and quick.
    noise(v, { dur: 0.27, a: 0.11, peak: 0.42, pan: -0.3, panTo: 0.3, filter: { type: 'bandpass', pts: [[0, 900], [0.24, 3600]], q: 1.1 } });
    tone(v, { f: 700, to: 1400, dur: 0.22, a: 0.08, peak: 0.025 });
  },

  confetti(v) {
    // Party popper: a soft "pok!", a tiny rising "fwee", then paper bits fluttering down.
    noise(v, { dur: 0.06, a: 0.007, peak: 0.2, filter: { type: 'bandpass', f: 1300, q: 1.2 } });
    tone(v, { f: 180, to: 90, dur: 0.09, a: 0.007, peak: 0.2 });
    tone(v, { f: 900, to: 2200, at: 0.02, dur: 0.13, a: 0.01, peak: 0.05 });
    for (let i = 0; i < 26; i++) {
      const when = 0.06 + 0.75 * (i / 26) ** 1.4 + v.rng() * 0.02;
      noise(v, {
        at: when, dur: 0.012 + v.rng() * 0.012, a: 0.0015, peak: 0.1 * (1 - (0.7 * i) / 26), pan: v.rng() * 1.6 - 0.8,
        filter: { type: 'bandpass', f: 3000 + v.rng() * 4000, q: 2.5 },
      });
    }
    glitter(v, { at: 0.1, dur: 0.45, count: 4, lo: 2500, hi: 5000, peak: 0.06 });
  },

  snore(v) {
    // Tiny cartoon snore: a soft purring "khrrr" in, then a little whistle out, "fyoo".
    tone(v, { type: 'sawtooth', f: 82, to: 92, dur: 0.75, a: 0.32, d: 0.1, s: 0.8, r: 0.18, peak: 0.36, trem: { rate: 26, depth: 0.45 }, filter: { type: 'lowpass', f: 520, q: 2 } });
    noise(v, { dur: 0.75, a: 0.32, d: 0.1, s: 0.8, r: 0.18, peak: 0.1, trem: { rate: 26, depth: 0.4 }, filter: { type: 'lowpass', f: 900 } });
    tone(v, { at: 0.88, pts: [[0, 1050], [0.18, 1320], [0.5, 980]], dur: 0.5, a: 0.06, d: 0.05, s: 0.8, r: 0.15, peak: 0.07, vib: { rate: 5, depth: 10 } });
    noise(v, { at: 0.86, dur: 0.5, a: 0.08, d: 0.05, s: 0.7, r: 0.18, peak: 0.07, filter: { type: 'bandpass', f: 1500, q: 1.5 } });
  },

  yay(v) {
    // Robot "yaaay!": a vowel sliding "ee → ah → ee" while the pitch jumps up happily.
    vox(v, {
      type: 'sawtooth', dur: 0.48, a: 0.02, d: 0.06, s: 0.9, r: 0.09, peak: 0.6,
      pts: [[0, 420], [0.08, 620], [0.32, 700], [0.46, 560]],
      formants: [[0, 300, 2300, 3000], [0.1, 760, 1250, 2600], [0.34, 720, 1300, 2600], [0.46, 330, 2200, 3000]],
      levels: [1, 0.7, 0.25],
      vib: { rate: 7, depth: 30, delay: 0.15 },
    });
    // A brighter square an octave up: the "robot" in the voice.
    vox(v, {
      type: 'square', dur: 0.48, a: 0.02, d: 0.06, s: 0.9, r: 0.09, peak: 0.12,
      pts: [[0, 840], [0.08, 1240], [0.32, 1400], [0.46, 1120]],
      formants: [[0, 300, 2300, 3000], [0.1, 760, 1250, 2600], [0.46, 330, 2200, 3000]],
    });
    bell(v, { f: E6 * 2, at: 0.3, dur: 0.3, peak: 0.05 });
  },
};
