'use client';

import { isMuted } from '@/lib/sound';
import { DRUMS, MELODY, type Song, type SoundKind } from './song';

/**
 * Tiny Web Audio band for the song maker: four melody voices and three
 * drums, all synthesised (no samples to download), with a look-ahead
 * scheduler so timing stays tight even when the page is busy.
 */
export class Band {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextAt = 0;
  song: Song | null = null;
  /** Called (on the UI thread, at the right moment) when a step plays. */
  onStep: ((step: number) => void) | null = null;

  private ensure(): AudioContext | null {
    if (isMuted()) return null;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.5;
      this.out.connect(comp);
      comp.connect(this.ctx.destination);
      const n = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
      const d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = n;
    }
    void this.ctx.resume();
    return this.ctx;
  }

  /** One note right now (when the child taps a cell). */
  preview(row: number, sound: SoundKind) {
    const ctx = this.ensure();
    if (!ctx) return;
    this.voice(row, sound, ctx.currentTime + 0.01);
  }

  private voice(row: number, sound: SoundKind, at: number) {
    const ctx = this.ctx!;
    if (row >= MELODY.length) return this.drum(DRUMS[row - MELODY.length].id, at);
    const f = MELODY[row].freq / (sound === 'piano' ? 2 : 1);
    const g = ctx.createGain();
    g.connect(this.out!);
    const o = ctx.createOscillator();
    if (sound === 'xylo') {
      o.type = 'triangle';
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.5, at + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = f * 4;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.12, at);
      g2.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
      o2.connect(g2);
      g2.connect(this.out!);
      o2.start(at);
      o2.stop(at + 0.15);
    } else if (sound === 'flute') {
      o.type = 'sine';
      const vib = ctx.createOscillator();
      vib.frequency.value = 5.5;
      const vg = ctx.createGain();
      vg.gain.value = f * 0.01;
      vib.connect(vg);
      vg.connect(o.frequency);
      vib.start(at);
      vib.stop(at + 0.5);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.4, at + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
    } else if (sound === 'piano') {
      o.type = 'sawtooth';
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(f * 6, at);
      lp.frequency.exponentialRampToValueAtTime(f * 1.5, at + 0.5);
      o.connect(lp);
      lp.connect(g);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.35, at + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
      o.frequency.value = f;
      o.start(at);
      o.stop(at + 1);
      return;
    } else {
      // Ziggy's robot voice: a square wave with a little pitch "blip".
      o.type = 'square';
      o.frequency.setValueAtTime(f * 1.06, at);
      o.frequency.exponentialRampToValueAtTime(f, at + 0.04);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.16, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
    }
    if (sound !== 'robot') o.frequency.setValueAtTime(f, at);
    o.connect(g);
    o.start(at);
    o.stop(at + 0.9);
  }

  private drum(id: string, at: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.connect(this.out!);
    if (id === 'kick') {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(140, at);
      o.frequency.exponentialRampToValueAtTime(45, at + 0.18);
      g.gain.setValueAtTime(0.9, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
      o.connect(g);
      o.start(at);
      o.stop(at + 0.32);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = id === 'shaker' ? 'highpass' : 'bandpass';
    f.frequency.value = id === 'shaker' ? 6000 : 1500;
    src.connect(f);
    f.connect(g);
    const len = id === 'shaker' ? 0.06 : 0.12;
    g.gain.setValueAtTime(id === 'shaker' ? 0.25 : 0.55, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    src.start(at);
    src.stop(at + len + 0.02);
  }

  play(song: Song) {
    this.song = song;
    const ctx = this.ensure();
    if (!ctx || this.timer) return;
    this.step = 0;
    this.nextAt = ctx.currentTime + 0.08;
    const tick = () => {
      const s = this.song;
      if (!s || !this.ctx) return;
      const dur = 60 / s.tempo / 2; // steps are eighth notes
      while (this.nextAt < this.ctx.currentTime + 0.12) {
        const step = this.step % s.steps;
        s.grid.forEach((r, row) => r[step] && this.voice(row, s.sound, this.nextAt));
        const delay = Math.max(0, (this.nextAt - this.ctx.currentTime) * 1000);
        window.setTimeout(() => this.onStep?.(step), delay);
        this.nextAt += dur;
        this.step++;
      }
      this.timer = window.setTimeout(tick, 25);
    };
    tick();
  }

  stop() {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = null;
    this.onStep?.(-1);
  }

  get playing() {
    return this.timer !== null;
  }

  dispose() {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }
}
