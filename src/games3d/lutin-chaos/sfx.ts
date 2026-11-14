import { GameAudio } from '../kit/music';
import type { SfxBackend } from '../engine/audio';

/**
 * Lutin Chaos sounds, synthesised in Web Audio (nothing to download): soft
 * felt boings, the elves' signature sounds (Pépin's bell, Grelotte's hum,
 * Noisette's squeak, always paired with an on-screen icon), giggles, a
 * rewind zip, a camera click. Music = the kit's music-box tune.
 * The engine's `EngineAudio` handles the site mute and the first gesture.
 */

export type ChaosSfx =
  | 'pick'
  | 'spot'
  | 'normal'
  | 'jingle'
  | 'hum'
  | 'squeak'
  | 'giggle'
  | 'boing'
  | 'whoosh'
  | 'pop'
  | 'cuckoo'
  | 'heal'
  | 'tada'
  | 'rewind'
  | 'thud'
  | 'flash'
  | 'hint';

export class ChaosAudio implements SfxBackend<ChaosSfx> {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private music = new GameAudio();

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.28;
      this.out.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(f0: number, f1: number, at: number, dur: number, type: OscillatorType, vol: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.out!);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  private noise(at: number, dur: number, vol: number, from = 1800, to = 300) {
    const c = this.ctx!;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(from, at);
    f.frequency.exponentialRampToValueAtTime(to, at + dur);
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.out!);
    src.start(at);
  }

  play(name: ChaosSfx): void {
    const c = this.ensure();
    if (!c) return;
    const t = c.currentTime + 0.01;
    switch (name) {
      case 'pick':
        this.tone(660, 880, t, 0.09, 'sine', 0.25);
        break;
      case 'normal':
        this.tone(520, 520, t, 0.08, 'sine', 0.18);
        this.tone(620, 620, t + 0.09, 0.1, 'sine', 0.16);
        break;
      case 'spot':
        this.tone(300, 900, t, 0.22, 'triangle', 0.3);
        this.tone(900, 1200, t + 0.2, 0.12, 'sine', 0.2);
        break;
      case 'boing':
        this.tone(180, 520, t, 0.28, 'sine', 0.35);
        break;
      case 'thud':
        this.tone(140, 70, t, 0.16, 'sine', 0.35);
        break;
      case 'jingle':
        for (let i = 0; i < 4; i++) this.tone(2100 + (i % 2) * 330, 2000, t + i * 0.07, 0.25, 'triangle', 0.12);
        break;
      case 'hum':
        this.tone(330, 350, t, 0.25, 'sine', 0.2);
        this.tone(392, 370, t + 0.26, 0.3, 'sine', 0.2);
        break;
      case 'squeak':
        this.tone(1400, 2400, t, 0.1, 'sine', 0.2);
        this.tone(2400, 1600, t + 0.1, 0.08, 'sine', 0.15);
        break;
      case 'giggle':
        for (let i = 0; i < 5; i++) this.tone(820 + i * 60, 980 + i * 60, t + i * 0.08, 0.06, 'triangle', 0.16);
        break;
      case 'whoosh':
        this.noise(t, 0.35, 0.45, 600, 2600);
        break;
      case 'pop':
        this.tone(900, 240, t, 0.08, 'square', 0.12);
        break;
      case 'cuckoo':
        this.tone(740, 740, t, 0.16, 'sine', 0.25);
        this.tone(587, 587, t + 0.2, 0.22, 'sine', 0.25);
        break;
      case 'heal':
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, f, t + i * 0.08, 0.3, 'sine', 0.16));
        break;
      case 'tada':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f * 1.01, t + i * 0.1, 0.45, 'triangle', 0.18));
        break;
      case 'rewind':
        this.tone(1200, 200, t, 0.35, 'sawtooth', 0.08);
        this.noise(t, 0.3, 0.2, 3000, 400);
        break;
      case 'flash':
        this.noise(t, 0.08, 0.5, 4000, 2000);
        this.tone(1800, 1800, t + 0.02, 0.05, 'square', 0.06);
        break;
      case 'hint':
        this.tone(660, 990, t, 0.18, 'sine', 0.2);
        break;
    }
  }

  startMusic(): void {
    this.music.musicOn = true;
    this.music.startMusic();
  }

  stopMusic(): void {
    this.music.stopMusic();
  }

  dispose(): void {
    this.music.dispose();
    void this.ctx?.close();
    this.ctx = null;
  }
}
