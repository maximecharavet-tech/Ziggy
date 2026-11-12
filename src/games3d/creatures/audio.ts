import { isMuted } from '@/lib/sound';
import type { CategoryId, Voice } from './logic';

/**
 * Every sound of the factory, synthesised in Web Audio (nothing to download):
 * one signature per kind of part (a "pip" per eye, a "tap" per leg, a flutter
 * for wings…), the creature voices made from their shape and size, a sneeze, a
 * giggle, the bubbling machine and a soft bouncy tune. Pitches vary by ±5 % so
 * nothing gets tiring; the music ducks while somebody speaks; silent when the
 * site is muted.
 */
export class FactoryAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private musicOn = true;
  private duck = false;

  private ensure(): AudioContext | null {
    if (isMuted()) return null;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      try {
        this.ctx = new AC();
      } catch {
        return null;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = 0.9;
      this.sfx.connect(this.master);
      this.music = this.ctx.createGain();
      this.music.gain.value = 0.16;
      this.music.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private vary(f: number) {
    return f * (0.95 + Math.random() * 0.1);
  }

  /** One oscillator note with a pitch curve and a soft envelope. */
  private osc(type: OscillatorType, f0: number, f1: number, at: number, dur: number, vol: number, out?: AudioNode, curve: 'exp' | 'lin' = 'exp') {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), at);
    if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
    else o.frequency.linearRampToValueAtTime(Math.max(20, f1), at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g);
    g.connect(out ?? this.sfx!);
    o.start(at);
    o.stop(at + dur + 0.03);
    return o;
  }

  private noise(at: number, dur: number, vol: number, filter: BiquadFilterType, f0: number, f1: number, q = 1) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = filter;
    bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, at);
    bp.frequency.exponentialRampToValueAtTime(Math.max(30, f1), at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfx!);
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.05);
  }

  /** The "plop" every part makes when it lands. */
  plop(pitch = 1) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.osc('sine', this.vary(520 * pitch), 180 * pitch, t, 0.14, 0.35);
    this.noise(t, 0.04, 0.08, 'highpass', 2500, 2000);
  }

  /** A signature sound per kind of part. `n` = how many (one pip per eye, one tap per leg). */
  part(cat: CategoryId, n = 1) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.02;
    switch (cat) {
      case 'color':
      case 'accent':
        this.noise(t, 0.35, 0.18, 'bandpass', 600, 3000, 0.8);
        this.osc('sine', this.vary(400), 900, t, 0.25, 0.18);
        break;
      case 'pattern':
        for (let i = 0; i < 5; i++) this.osc('sine', this.vary(1600 + i * 260), 2400 + i * 200, t + i * 0.05, 0.18, 0.08);
        break;
      case 'body': {
        // Boing!
        const o = this.osc('triangle', this.vary(160), 260, t, 0.45, 0.32, undefined, 'lin');
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 18;
        const lg = ctx.createGain();
        lg.gain.value = 40;
        lfo.connect(lg);
        lg.connect(o.frequency);
        lfo.start(t);
        lfo.stop(t + 0.5);
        break;
      }
      case 'head':
        this.osc('sine', this.vary(700), 220, t, 0.12, 0.32);
        this.osc('sine', this.vary(900), 300, t + 0.08, 0.1, 0.2);
        break;
      case 'eyes':
        for (let i = 0; i < Math.max(1, n); i++) this.osc('sine', this.vary(1100 + i * 90), 1400 + i * 90, t + i * 0.11, 0.08, 0.2);
        break;
      case 'legs':
        if (n === 0) this.osc('sine', this.vary(300), 120, t, 0.3, 0.3);
        for (let i = 0; i < n; i++) {
          this.noise(t + i * 0.1, 0.05, 0.3, 'bandpass', 900 + (i % 2) * 300, 700, 3);
          this.osc('sine', this.vary(220 + (i % 2) * 40), 140, t + i * 0.1, 0.06, 0.25);
        }
        break;
      case 'arms':
        this.osc('sawtooth', this.vary(200), 600, t, 0.25, 0.06);
        this.osc('sine', this.vary(300), 700, t, 0.25, 0.15);
        break;
      case 'wings':
      case 'wingtail':
        for (let i = 0; i < 7; i++) this.noise(t + i * 0.045, 0.04, 0.16, 'bandpass', 1400, 900, 1.2);
        break;
      case 'tail':
        this.noise(t, 0.3, 0.2, 'bandpass', 400, 2600, 2);
        break;
      case 'mouth':
        this.osc('triangle', this.vary(260), 420, t, 0.1, 0.25);
        this.osc('triangle', this.vary(420), 240, t + 0.11, 0.12, 0.25);
        break;
      case 'top': {
        const o = this.osc('sine', this.vary(500), 900, t, 0.4, 0.22, undefined, 'lin');
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 22;
        const lg = ctx.createGain();
        lg.gain.value = 120;
        lfo.connect(lg);
        lg.connect(o.frequency);
        lfo.start(t);
        lfo.stop(t + 0.42);
        break;
      }
      case 'hat':
        [1046, 1318, 1568].forEach((f, i) => this.osc('sine', this.vary(f), f, t + i * 0.06, 0.6, 0.12));
        break;
      case 'nose':
        // Honk! A clown-nose squeeze.
        this.osc('square', this.vary(330), 220, t, 0.14, 0.06);
        this.osc('triangle', this.vary(660), 440, t, 0.16, 0.2);
        break;
      case 'aura':
        [1568, 1976, 2349].forEach((f, i) => this.osc('sine', this.vary(f), f * 1.02, t + i * 0.07, 0.35, 0.09));
        break;
      case 'pet':
        this.osc('sine', this.vary(1200), 1700, t, 0.07, 0.2);
        this.osc('sine', this.vary(1500), 1900, t + 0.09, 0.07, 0.2);
        break;
      case 'size':
        this.osc('sine', this.vary(n > 1 ? 180 : 700), n > 1 ? 90 : 1300, t, 0.4, 0.26);
        break;
    }
  }

  /** A creature speaks: its voice comes from its shape and size. */
  voice(v: Voice, excited = false) {
    const ctx = this.ensure();
    if (!ctx) return 0;
    const t = ctx.currentTime + 0.02;
    const n = v.syllables + (excited ? 1 : 0);
    const f = this.vary(v.pitch) * (excited ? 1.12 : 1);
    let at = t;
    for (let i = 0; i < n; i++) {
      const up = i % 2 ? 0.85 : 1.15;
      const d = 0.13 + (i === n - 1 ? 0.1 : 0);
      switch (v.kind) {
        case 'squeak':
          this.osc('sine', f, f * up * 1.3, at, d, 0.28);
          break;
        case 'honk': {
          const ctx2 = this.ctx!;
          const lp = ctx2.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 1400;
          lp.connect(this.sfx!);
          this.osc('sawtooth', f, f * up, at, d + 0.04, 0.14, lp);
          this.osc('square', f * 1.01, f * up, at, d + 0.04, 0.05, lp);
          break;
        }
        case 'boing':
          this.osc('triangle', f, f * 2.2, at, d + 0.05, 0.3, undefined, 'lin');
          break;
        case 'blub':
          for (let j = 0; j < 3; j++) this.osc('sine', f * (1.4 - j * 0.1), f * 2.4, at + j * 0.04, 0.05, 0.22);
          break;
        case 'buzz': {
          const o = this.osc('sawtooth', f, f * up, at, d, 0.08);
          const am = this.ctx!.createOscillator();
          am.frequency.value = 45;
          const ag = this.ctx!.createGain();
          ag.gain.value = 30;
          am.connect(ag);
          ag.connect(o.frequency);
          am.start(at);
          am.stop(at + d + 0.03);
          break;
        }
        case 'purr': {
          const o = this.osc('triangle', f, f * up, at, d + 0.08, 0.3);
          const am = this.ctx!.createOscillator();
          am.frequency.value = 24;
          const ag = this.ctx!.createGain();
          ag.gain.value = 25;
          am.connect(ag);
          ag.connect(o.frequency);
          am.start(at);
          am.stop(at + d + 0.1);
          break;
        }
        case 'roar':
          this.osc('sawtooth', f, f * 0.7, at, d + 0.08, 0.1);
          this.noise(at, d + 0.08, 0.08, 'lowpass', 900, 300);
          break;
      }
      at += d + 0.04;
    }
    return at - t;
  }

  /** A… a… TCHOUM! */
  sneeze(v: Voice) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const f = v.pitch;
    this.osc('sine', f * 0.9, f * 1.2, t, 0.3, 0.14, undefined, 'lin');
    this.osc('sine', f, f * 1.45, t + 0.4, 0.35, 0.16, undefined, 'lin');
    this.noise(t + 0.82, 0.35, 0.45, 'bandpass', 3500, 1200, 0.7);
    this.osc('sine', f * 1.5, f * 0.6, t + 0.82, 0.2, 0.2);
  }

  /** One sound per power: a spring, a chime, a hiccup… all gentle and a little silly. */
  power(id: string) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.02;
    const scale = (notes: number[], step = 0.07, dur = 0.3, vol = 0.14, type: OscillatorType = 'sine') => notes.forEach((f, i) => this.osc(type, this.vary(f), f, t + i * step, dur, vol));
    switch (id) {
      case 'bounce':
        for (let i = 0; i < 3; i++) this.osc('triangle', 220 + i * 40, 520 + i * 60, t + i * 0.2, 0.18, 0.28);
        break;
      case 'fly':
      case 'float':
        this.osc('sine', 300, 900, t, 0.7, 0.2, undefined, 'lin');
        this.noise(t, 0.6, 0.1, 'bandpass', 500, 2000, 1);
        break;
      case 'swim':
        for (let i = 0; i < 6; i++) this.osc('sine', this.vary(500 + (i % 3) * 120), 250, t + i * 0.09, 0.08, 0.16);
        break;
      case 'sparkle':
        scale([1318, 1568, 1976, 2349, 2637], 0.06, 0.4, 0.1);
        break;
      case 'dance':
      case 'music':
        scale([523, 659, 784, 659, 880, 784, 659, 523], 0.12, 0.18, 0.15, 'triangle');
        break;
      case 'camo':
        this.noise(t, 0.5, 0.18, 'lowpass', 1800, 200);
        this.osc('sine', 700, 120, t, 0.5, 0.1);
        break;
      case 'laugh':
        this.giggle(1.1);
        this.osc('triangle', 600, 900, t + 0.5, 0.12, 0.14);
        break;
      case 'rainbow':
        scale([523, 587, 659, 698, 784, 880, 988], 0.06, 0.3, 0.12);
        break;
      case 'roll':
        this.noise(t, 0.7, 0.2, 'bandpass', 300, 1200, 2);
        this.osc('sawtooth', 120, 260, t, 0.7, 0.05, undefined, 'lin');
        break;
      case 'zap':
        for (let i = 0; i < 6; i++) this.osc('square', this.vary(900 + i * 160), 300, t + i * 0.04, 0.05, 0.05);
        break;
      case 'hearts':
        for (let i = 0; i < 4; i++) this.osc('sine', this.vary(880 + i * 110), 1300, t + i * 0.1, 0.09, 0.16);
        break;
      default:
        scale([660, 880], 0.1, 0.2);
    }
  }

  /** The little silly surprises (all kind): hiccup, wonky blink, applause, bubbles. */
  silly(ev: string) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.02;
    switch (ev) {
      case 'hiccup':
        this.osc('sine', this.vary(380), 900, t, 0.07, 0.3);
        this.osc('sine', this.vary(400), 950, t + 0.5, 0.07, 0.3);
        break;
      case 'wonky':
        this.osc('triangle', 900, 300, t, 0.25, 0.2, undefined, 'lin');
        this.osc('triangle', 300, 900, t + 0.25, 0.2, 0.2, undefined, 'lin');
        break;
      case 'applause':
        for (let i = 0; i < 12; i++) this.noise(t + i * 0.07 + Math.random() * 0.03, 0.04, 0.18, 'bandpass', 2200 + Math.random() * 1500, 1800, 1.5);
        break;
      case 'surprised':
        this.osc('sine', 500, 1100, t, 0.18, 0.25, undefined, 'lin');
        break;
      case 'bubbles':
        for (let i = 0; i < 6; i++) this.osc('sine', this.vary(500 + Math.random() * 500), 1400, t + i * 0.08, 0.07, 0.12);
        break;
      case 'flash':
        this.osc('sine', 300, 1800, t, 0.3, 0.2, undefined, 'lin');
        this.noise(t + 0.25, 0.2, 0.2, 'highpass', 4000, 2000);
        break;
      default:
        this.confetti();
    }
  }

  giggle(high = 1) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 5; i++) this.osc('sine', this.vary(900 * high - i * 60), 700 * high - i * 60, t + i * 0.085, 0.07, 0.18);
  }

  /** The Surprise machine: clunk of the lever, bubbles and springs, then plop. */
  machine() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.noise(t, 0.12, 0.35, 'lowpass', 600, 200);
    this.osc('square', 90, 60, t, 0.12, 0.08);
    for (let i = 0; i < 8; i++) this.osc('sine', this.vary(250 + Math.random() * 300), 600 + Math.random() * 400, t + 0.12 + i * 0.065, 0.06, 0.12);
    const o = this.osc('triangle', 140, 200, t + 0.15, 0.45, 0.12, undefined, 'lin');
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 12;
    const lg = ctx.createGain();
    lg.gain.value = 50;
    lfo.connect(lg);
    lg.connect(o.frequency);
    lfo.start(t + 0.15);
    lfo.stop(t + 0.62);
  }

  /** Tubes: the creature goes down the pipe (whoosh) and plops out. */
  whoosh() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.noise(t, 0.35, 0.22, 'bandpass', 500, 2500, 1.4);
  }

  confetti() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.noise(t, 0.18, 0.3, 'highpass', 3000, 1500);
    for (let i = 0; i < 4; i++) this.osc('sine', this.vary(1300 + i * 200), 1800, t + 0.04 + i * 0.05, 0.12, 0.08);
  }

  /** Little fanfare (challenge done, alive!). */
  fanfare() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => {
      this.osc('triangle', f, f, t + i * 0.11, 0.35 + (i === 3 ? 0.4 : 0), 0.16);
      this.osc('sine', f * 2, f * 2, t + i * 0.11, 0.25, 0.05);
    });
  }

  /** Camera shutter. */
  shutter() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.noise(t, 0.05, 0.35, 'highpass', 4000, 3000);
    this.noise(t + 0.08, 0.06, 0.25, 'highpass', 3000, 2000);
  }

  /** Splash in the pond. */
  splash() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.noise(t, 0.4, 0.25, 'lowpass', 2500, 400);
    for (let i = 0; i < 3; i++) this.osc('sine', this.vary(500 + i * 150), 1200, t + 0.1 + i * 0.07, 0.06, 0.1);
  }

  /** A step on the floor (soft). */
  step(pitch = 1) {
    const ctx = this.ensure();
    if (!ctx) return;
    this.osc('sine', this.vary(180 * pitch), 110 * pitch, ctx.currentTime, 0.06, 0.12);
  }

  count(i: number) {
    const ctx = this.ensure();
    if (!ctx) return;
    const f = 520 * Math.pow(2, Math.min(i, 12) / 12 * 2);
    this.osc('triangle', f, f, ctx.currentTime, 0.22, 0.16);
  }

  /* ── Music: a bouncy marimba loop (original), very soft ── */

  setMusic(on: boolean) {
    this.musicOn = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  /** Lower the music while Ziggy talks. */
  setDuck(on: boolean) {
    this.duck = on;
    if (this.music && this.ctx) this.music.gain.setTargetAtTime(on ? 0.05 : 0.16, this.ctx.currentTime, 0.15);
  }

  startMusic() {
    if (!this.musicOn) return;
    const ctx = this.ensure();
    if (!ctx || this.musicTimer) return;
    // C major pentatonic, two little phrases.
    const N = [392, 440, 523, 587, 659, 784, 880];
    const phrase = [2, 4, 5, 4, 2, 1, 2, -1, 3, 5, 6, 5, 3, 2, 0, -1, 2, 4, 5, 6, 5, 4, 2, 1, 0, 1, 2, -1, 4, 2, 0, -1];
    const bass = [131, 131, 147, 165, 131, 131, 110, 98];
    const beat = 0.24;
    const play = () => {
      if (!this.ctx || !this.musicOn) return;
      let at = this.ctx.currentTime + 0.1;
      phrase.forEach((n, i) => {
        if (n >= 0) this.osc('sine', N[n] * 2, N[n] * 2, at, 0.35, 0.18, this.music!);
        if (n >= 0) this.osc('triangle', N[n], N[n], at, 0.25, 0.1, this.music!);
        if (i % 4 === 0) this.osc('sine', bass[(i / 4) % bass.length], bass[(i / 4) % bass.length], at, 0.4, 0.3, this.music!);
        at += beat;
      });
      this.musicTimer = window.setTimeout(play, (at - this.ctx.currentTime + 2.5) * 1000);
    };
    play();
    if (this.duck) this.setDuck(true);
  }

  stopMusic() {
    if (this.musicTimer) window.clearTimeout(this.musicTimer);
    this.musicTimer = null;
  }

  dispose() {
    this.stopMusic();
    void this.ctx?.close();
    this.ctx = null;
  }
}
