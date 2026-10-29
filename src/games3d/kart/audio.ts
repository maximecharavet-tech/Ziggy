import { isMuted } from '@/lib/sound';

/**
 * Sounds of the kart, synthesised with Web Audio (nothing to download): a
 * bouncy original tune, letter chimes, a soft "boing" for the corkscrew
 * (never a buzzer), slide whistles for the jumps, bubble pops, a turbo
 * whoosh, a cow's "moo" and a finish fanfare. Quiet, and silent when the
 * site is muted.
 */

const A4 = 440;
const NOTES: Record<string, number> = {};
['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((n, i) => {
  for (let o = 2; o <= 7; o++) NOTES[`${n}${o}`] = A4 * 2 ** ((i - 9) / 12 + (o - 4));
});
const hz = (n: string) => NOTES[n] ?? 440;

// An original little racing tune (16 beats): melody [note, beats], bass one note a beat.
const MELODY: [string, number][] = [
  ['E5', 0.5], ['G5', 0.5], ['A5', 0.5], ['G5', 0.5], ['E5', 0.5], ['C5', 0.5], ['D5', 1],
  ['E5', 0.5], ['G5', 0.5], ['A5', 0.5], ['C6', 0.5], ['B5', 0.5], ['A5', 0.5], ['G5', 1],
  ['A5', 0.5], ['G5', 0.5], ['E5', 0.5], ['G5', 0.5], ['A5', 0.5], ['G5', 0.5], ['E5', 0.5], ['D5', 0.5],
  ['C5', 0.5], ['D5', 0.5], ['E5', 0.5], ['G5', 0.5], ['C6', 1], ['-', 1],
];
const BASS = ['C3', 'G3', 'A3', 'E3', 'F3', 'C3', 'G3', 'G3', 'A3', 'E3', 'F3', 'C3', 'F3', 'G3', 'C3', 'C3'];

export type KartSound = 'lane' | 'pick' | 'word' | 'oops' | 'jump' | 'land' | 'turbo' | 'pop' | 'moo' | 'finish' | 'go' | 'giggle';

export class KartAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private musicOn = false;

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
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
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
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    o.connect(g);
    g.connect(this.master!);
    o.start(at);
    o.stop(at + dur + 0.03);
  }

  private hiss(at: number, dur: number, from: number, to: number, vol: number, q = 1.2) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(from, at);
    f.frequency.exponentialRampToValueAtTime(to, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master!);
    src.start(at);
    src.stop(at + dur + 0.05);
  }

  play(kind: KartSound, pitch = 0) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const up = 2 ** (pitch / 12);
    switch (kind) {
      case 'lane':
        this.tone(660 * up, t, 0.09, 'triangle', 0.08, 880 * up);
        break;
      case 'pick':
        ['C6', 'E6', 'G6'].forEach((n, i) => this.tone(hz(n) * up, t + i * 0.07, 0.45, 'triangle', 0.16));
        break;
      case 'word':
        ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'].forEach((n, i) => this.tone(hz(n), t + i * 0.08, 0.6, 'triangle', 0.14));
        this.hiss(t + 0.1, 0.9, 400, 4000, 0.12, 0.8);
        break;
      case 'oops':
        // A cartoon "boing" spiral, never a buzzer.
        this.tone(520, t, 0.5, 'sine', 0.16, 180);
        this.tone(260, t + 0.05, 0.45, 'triangle', 0.06, 120);
        break;
      case 'jump':
        this.tone(420, t, 0.55, 'sine', 0.12, 1250);
        break;
      case 'land':
        this.tone(140, t, 0.18, 'sine', 0.18, 70);
        this.hiss(t, 0.2, 300, 120, 0.06);
        break;
      case 'turbo':
        this.hiss(t, 0.9, 300, 3200, 0.16, 0.9);
        this.tone(220, t, 0.7, 'sawtooth', 0.025, 660);
        break;
      case 'pop':
        this.tone(900 + Math.random() * 500, t, 0.06, 'sine', 0.08, 1600);
        break;
      case 'giggle':
        [0, 1, 2, 3].forEach((i) => this.tone((780 + (i % 2) * 120) * up, t + i * 0.09, 0.08, 'sine', 0.06));
        break;
      case 'moo': {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(150, t);
        o.frequency.linearRampToValueAtTime(175, t + 0.25);
        o.frequency.exponentialRampToValueAtTime(110, t + 1.1);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(500, t);
        lp.frequency.linearRampToValueAtTime(900, t + 0.3);
        lp.frequency.linearRampToValueAtTime(400, t + 1.1);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.16, t + 0.12);
        g.gain.setValueAtTime(0.16, t + 0.8);
        g.gain.exponentialRampToValueAtTime(0.0008, t + 1.15);
        o.connect(lp);
        lp.connect(g);
        g.connect(this.master!);
        o.start(t);
        o.stop(t + 1.2);
        break;
      }
      case 'finish':
        [['C5', 0], ['E5', 0.12], ['G5', 0.24], ['C6', 0.36], ['G5', 0.6], ['C6', 0.72]].forEach(([n, d]) => this.tone(hz(n as string), t + (d as number), 0.5, 'square', 0.05));
        ['C5', 'E5', 'G5', 'C6'].forEach((n) => this.tone(hz(n), t + 0.95, 1.4, 'triangle', 0.09));
        break;
      case 'go':
        this.tone(hz('G5'), t, 0.15, 'triangle', 0.12);
        this.tone(hz('C6'), t + 0.18, 0.35, 'triangle', 0.14);
        this.tone(90, t, 0.6, 'sawtooth', 0.03, 180);
        break;
    }
  }

  startMusic() {
    this.musicOn = true;
    const ctx = this.ensure();
    if (!ctx || this.musicTimer) return;
    const beat = 60 / 132;
    const loop = () => {
      if (!this.ctx || !this.musicOn) return;
      const start = this.ctx.currentTime + 0.08;
      let at = start;
      for (const [n, b] of MELODY) {
        if (n !== '-') this.tone(hz(n), at, Math.max(0.18, b * beat * 0.9), 'triangle', 0.05);
        at += b * beat;
      }
      BASS.forEach((n, i) => {
        this.tone(hz(n), start + i * beat, beat * 0.8, 'sine', 0.08);
        this.hiss(start + i * beat + beat / 2, 0.05, 7000, 9000, 0.015, 2);
      });
      this.musicTimer = window.setTimeout(loop, (at - this.ctx.currentTime - 0.05) * 1000);
    };
    loop();
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) window.clearTimeout(this.musicTimer);
    this.musicTimer = null;
  }

  setPaused(p: boolean) {
    if (!this.ctx) return;
    if (p) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  dispose() {
    this.stopMusic();
    void this.ctx?.close();
    this.ctx = null;
  }
}
