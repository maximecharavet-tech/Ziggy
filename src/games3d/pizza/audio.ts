import { isMuted } from '@/lib/sound';
import type { CustomerId } from './logic';

/**
 * The pizzeria's sounds, all synthesised with Web Audio (nothing to
 * download): a soft "plop" for each topping, the oven's crackle, the timer's
 * "ding", munching and slurping, coins, cheerful arpeggios, the animals'
 * little babble, and an original bouncy music-box tune (written for this
 * game). Quiet by default, silent when the site is muted.
 */

const N = (semi: number) => 440 * 2 ** (semi / 12);
// Note names → semitones from A4.
const S: Record<string, number> = { G3: -14, A3: -12, B3: -10, C4: -9, D4: -7, E4: -5, F4: -4, G4: -2, A4: 0, B4: 2, C5: 3, D5: 5, E5: 7, F5: 8, G5: 10, A5: 12, B5: 14, C6: 15 };

// An original tune in 6/8 (eighth notes): [note, eighths].
const TUNE: [string, number][] = [
  ['E5', 1], ['E5', 1], ['G5', 1], ['E5', 1], ['D5', 1], ['C5', 1],
  ['D5', 1], ['E5', 1], ['F5', 1], ['E5', 3],
  ['D5', 1], ['D5', 1], ['F5', 1], ['D5', 1], ['C5', 1], ['B4', 1],
  ['C5', 1], ['D5', 1], ['E5', 1], ['C5', 3],
  ['G5', 1], ['G5', 1], ['A5', 1], ['G5', 1], ['F5', 1], ['E5', 1],
  ['F5', 1], ['G5', 1], ['A5', 1], ['G5', 3],
  ['E5', 1], ['F5', 1], ['G5', 1], ['D5', 1], ['E5', 1], ['F5', 1],
  ['E5', 1], ['D5', 1], ['B4', 1], ['C5', 3],
];
// One bass note per half bar (3 eighths).
const BASS = ['C4', 'G3', 'C4', 'G3', 'G3', 'B3', 'C4', 'G3', 'C4', 'E4', 'F4', 'C4', 'C4', 'G3', 'G3', 'C4'];

const VOICE: Record<CustomerId | 'ziggy', number> = { bear: 150, elephant: 190, giraffe: 330, rabbit: 520, penguin: 430, ziggy: 400 };

export class PizzaAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private crackle: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  musicOn = true;

  private ensure(): AudioContext | null {
    if (isMuted()) return null;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, at: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    o.connect(g);
    g.connect(this.master!);
    o.start(at);
    o.stop(at + dur + 0.03);
  }

  private noise(at: number, dur: number, vol: number, filter: BiquadFilterType, freq: number, q = 1, freqTo?: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, at);
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, at + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master!);
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.05);
  }

  /** A topping lands: a soft plop, a little higher each time. */
  plop(step = 0) {
    const c = this.ensure();
    if (!c) return;
    const t = c.currentTime;
    const f = 520 * 2 ** (Math.min(step, 10) / 12);
    this.tone(f * 1.6, t, 0.14, 'sine', 0.22, f * 0.7);
  }

  whoosh() {
    const c = this.ensure();
    if (!c) return;
    this.noise(c.currentTime, 0.45, 0.12, 'bandpass', 400, 1.5, 2400);
  }

  splat() {
    const c = this.ensure();
    if (!c) return;
    this.noise(c.currentTime, 0.25, 0.14, 'lowpass', 900, 1, 300);
  }

  /** "Oh?" — a soft boing, never a buzzer. */
  boing() {
    const c = this.ensure();
    if (!c) return;
    const t = c.currentTime;
    this.tone(330, t, 0.3, 'sine', 0.18, 210);
    this.tone(420, t + 0.12, 0.25, 'sine', 0.1, 520);
  }

  yay() {
    const c = this.ensure();
    if (!c) return;
    const t = c.currentTime;
    ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => this.tone(N(S[n]), t + i * 0.08, 0.5, 'triangle', 0.18));
  }

  ding() {
    const c = this.ensure();
    if (!c) return;
    const t = c.currentTime;
    this.tone(1760, t, 1.6, 'sine', 0.22);
    this.tone(2637, t, 1.0, 'sine', 0.08);
    this.tone(1760 * 2.76, t, 0.5, 'sine', 0.04);
  }

  tick() {
    const c = this.ensure();
    if (!c) return;
    this.noise(c.currentTime, 0.03, 0.08, 'highpass', 3000, 1);
  }

  coin() {
    const c = this.ensure();
    if (!c) return;
    const t = c.currentTime;
    this.tone(1318, t, 0.12, 'triangle', 0.16);
    this.tone(1975, t + 0.07, 0.3, 'triangle', 0.14);
  }

  munch(times = 3) {
    const c = this.ensure();
    if (!c) return;
    for (let i = 0; i < times; i++) this.noise(c.currentTime + i * 0.2, 0.09, 0.2, 'lowpass', 1400, 2, 500);
  }

  slurp() {
    const c = this.ensure();
    if (!c) return;
    const t = c.currentTime;
    this.tone(200, t, 0.8, 'sawtooth', 0.05, 900);
    this.noise(t, 0.8, 0.08, 'bandpass', 600, 4, 2600);
  }

  gulp() {
    const c = this.ensure();
    if (!c) return;
    const t = c.currentTime;
    this.tone(260, t, 0.22, 'sine', 0.25, 90);
  }

  toot() {
    const c = this.ensure();
    if (!c) return;
    const t = c.currentTime;
    this.tone(233, t, 0.35, 'sawtooth', 0.06, 311);
    this.tone(311, t + 0.3, 0.45, 'sawtooth', 0.06, 349);
  }

  coo() {
    const c = this.ensure();
    if (!c) return;
    const t = c.currentTime;
    this.tone(420, t, 0.18, 'sine', 0.08, 360);
    this.tone(400, t + 0.2, 0.25, 'sine', 0.07, 330);
  }

  /** The cute babble of an animal (or Ziggy) talking. */
  babble(who: CustomerId | 'ziggy', syllables = 5) {
    const c = this.ensure();
    if (!c) return;
    const base = VOICE[who];
    let t = c.currentTime + 0.02;
    for (let i = 0; i < syllables; i++) {
      const f = base * (0.85 + Math.random() * 0.4);
      const d = 0.07 + Math.random() * 0.05;
      this.tone(f, t, d, 'triangle', 0.09, f * (Math.random() < 0.5 ? 1.2 : 0.85));
      t += d + 0.03;
    }
  }

  /** The oven's crackle while the pizza bakes. */
  crackleOn(on: boolean) {
    const c = this.ensure();
    if (!c) return;
    if (on && !this.crackle) {
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 2400;
      f.Q.value = 0.7;
      const g = c.createGain();
      g.gain.setValueAtTime(0, c.currentTime);
      g.gain.linearRampToValueAtTime(0.06, c.currentTime + 0.3);
      src.connect(f);
      f.connect(g);
      g.connect(this.master!);
      src.start();
      this.crackle = { src, gain: g };
    } else if (!on && this.crackle) {
      const { src, gain } = this.crackle;
      gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.3);
      src.stop(c.currentTime + 0.35);
      this.crackle = null;
    }
  }

  fanfare() {
    const c = this.ensure();
    if (!c) return;
    const t = c.currentTime;
    const seq: [string, number][] = [
      ['C5', 0],
      ['E5', 0.12],
      ['G5', 0.24],
      ['C6', 0.36],
      ['G5', 0.6],
      ['C6', 0.72],
    ];
    for (const [n, d] of seq) this.tone(N(S[n]), t + d, 0.6, 'triangle', 0.2);
    for (let i = 0; i < 6; i++) this.noise(t + i * 0.12, 0.08, 0.12, 'highpass', 2000, 1);
  }

  startMusic() {
    this.musicOn = true;
    const c = this.ensure();
    if (!c || this.musicTimer) return;
    const e = 0.19; // one eighth note
    const play = () => {
      if (!this.ctx || !this.musicOn || isMuted()) {
        this.musicTimer = null;
        return;
      }
      let at = this.ctx.currentTime + 0.1;
      const start = at;
      for (const [n, k] of TUNE) {
        this.tone(N(S[n]), at, Math.max(0.25, k * e * 1.4), 'triangle', 0.045);
        at += k * e;
      }
      BASS.forEach((n, i) => {
        this.tone(N(S[n]) / 2, start + i * 3 * e, 0.3, 'sine', 0.07);
        this.tone(N(S[n]), start + i * 3 * e + 2 * e, 0.12, 'triangle', 0.025);
      });
      this.musicTimer = window.setTimeout(play, (at - this.ctx.currentTime + 2.5) * 1000);
    };
    play();
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) window.clearTimeout(this.musicTimer);
    this.musicTimer = null;
  }

  /** Tab hidden: stop the tune for now (and the crackle), keep the wish. */
  suspend(hidden: boolean) {
    if (hidden) {
      const want = this.musicOn;
      this.stopMusic();
      this.musicOn = want;
      void this.ctx?.suspend();
    } else {
      void this.ctx?.resume();
      if (this.musicOn) this.startMusic();
    }
  }

  dispose() {
    this.stopMusic();
    this.crackle = null;
    void this.ctx?.close();
    this.ctx = null;
  }
}
