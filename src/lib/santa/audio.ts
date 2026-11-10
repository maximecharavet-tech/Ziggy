'use client';

import { santaText, type SantaLocale } from '@/data/santa/lines';
import { cachedClip } from './precache';

/**
 * Santa's voice on the device: fetches the cached clips (/api/santa/voice),
 * plays them through an analyser so the 3D Santa's mouth follows the voice,
 * and falls back to the device's own voice when a clip can't be fetched.
 * Also code-built sounds (no audio files): the phone ringing, sleigh bells, a
 * reindeer's snort and a sparkle.
 */

/** Bump when the texts of src/data/santa/lines.ts change (busts the CDN cache). */
export const VOICE_VERSION = 1;
/** Pause before the one retry of a clip the voice service could not make (502/429). */
export const RETRY_MS = 1500;

export const clipUrl = (key: string, locale: SantaLocale) => `/api/santa/voice?k=${encodeURIComponent(key)}&l=${locale}&v=${VOICE_VERSION}`;

type Level = (v: number) => void;

export class SantaAudio {
  readonly ctx: AudioContext;
  private analyser: AnalyserNode;
  private master: GainNode;
  private buffers = new Map<string, AudioBuffer | null>();
  private current: AudioBufferSourceNode | null = null;
  private raf = 0;
  private stopped = false;
  private voiceDown = false;
  private cut = false;

  constructor(private locale: SantaLocale, private onLevel: Level) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.95;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.master.connect(this.ctx.destination);
  }

  /** Must run from a tap (browsers start audio only after a gesture). */
  async unlock() {
    if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {});
  }

  /** Fetches and decodes clips, two at a time; reports progress 0–1. */
  async preload(keys: string[], onProgress?: (p: number) => void) {
    let done = 0;
    const queue = keys.filter((k) => !this.buffers.has(k));
    const worker = async () => {
      for (let k = queue.shift(); k; k = queue.shift()) {
        await this.load(k);
        onProgress?.(++done / keys.length);
      }
    };
    // Two at a time: new clips are made one by one by the voice service, which limits bursts.
    await Promise.all([worker(), worker()]);
    onProgress?.(1);
  }

  private async load(key: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(key)) return this.buffers.get(key) ?? null;
    if (this.voiceDown) {
      this.buffers.set(key, null);
      return null;
    }
    try {
      const url = clipUrl(key, this.locale);
      // A scheduled call's clips were stored on the device in advance (precache.ts).
      let bytes = await cachedClip(url);
      if (!bytes) {
        let res = await fetch(url);
        // 502/429: the voice service is busy for a moment (a burst of new clips):
        // one more try shortly after, before falling back to the device voice.
        if (res.status === 502 || res.status === 429) {
          await new Promise((r) => setTimeout(r, RETRY_MS + Math.random() * 800));
          if (this.stopped) throw new Error('stopped');
          res = await fetch(url);
        }
        if (res.status === 503) this.voiceDown = true;
        if (!res.ok) throw new Error(String(res.status));
        bytes = await res.arrayBuffer();
      }
      const buf = await this.ctx.decodeAudioData(bytes);
      this.buffers.set(key, buf);
      return buf;
    } catch {
      this.buffers.set(key, null);
      return null;
    }
  }

  /** Plays one clip (or speaks it with the device voice); resolves when it ends. */
  async say(key: string, onText?: (text: string) => void): Promise<void> {
    if (this.stopped) return;
    const text = santaText(key, this.locale) ?? '';
    onText?.(text);
    const buf = await this.load(key);
    if (this.stopped) return;
    if (buf) return this.playBuffer(buf);
    return this.speakFallback(text);
  }

  /** A reply from the live AI call: WAV bytes, or the text for the device voice. */
  async sayRaw(text: string, wav: ArrayBuffer | null, onText?: (text: string) => void): Promise<void> {
    if (this.stopped) return;
    onText?.(text);
    if (wav) {
      try {
        return this.playBuffer(await this.ctx.decodeAudioData(wav));
      } catch {
        /* fall through */
      }
    }
    return this.speakFallback(text);
  }

  private playBuffer(buf: AudioBuffer): Promise<void> {
    return new Promise((resolve) => {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.analyser);
      this.analyser.connect(this.master);
      this.current = src;
      const data = new Uint8Array(this.analyser.fftSize);
      const tick = () => {
        this.analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        this.onLevel(Math.min(1, Math.sqrt(sum / data.length) * 5));
        this.raf = requestAnimationFrame(tick);
      };
      tick();
      src.onended = () => {
        cancelAnimationFrame(this.raf);
        this.onLevel(0);
        src.disconnect();
        if (this.current === src) this.current = null;
        resolve();
      };
      src.start();
    });
  }

  private speakFallback(text: string): Promise<void> {
    return new Promise((resolve) => {
      const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
      if (!synth || !text) {
        setTimeout(resolve, 600);
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = this.locale === 'fr' ? 'fr-FR' : 'en-GB';
      u.pitch = 0.55;
      u.rate = 0.88;
      const voice = synth.getVoices().find((v) => v.lang.startsWith(this.locale) && /male|homme|thomas|daniel|google/i.test(v.name));
      if (voice) u.voice = voice;
      let t = 0;
      const wobble = setInterval(() => this.onLevel(0.35 + 0.35 * Math.abs(Math.sin((t += 0.6)))), 90);
      const done = () => {
        clearInterval(wobble);
        this.onLevel(0);
        resolve();
      };
      u.onend = done;
      u.onerror = done;
      // Some browsers never fire onend: a safety net based on length.
      setTimeout(done, 1500 + text.length * 90);
      synth.speak(u);
    });
  }

  /** Code-built sounds. */
  sfx(id: 'ring' | 'bells' | 'reindeer' | 'sparkle' | 'hangup', when = 0): number {
    const t0 = this.ctx.currentTime + when;
    const out = this.master;
    const tone = (freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.18) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0 + start);
      g.gain.exponentialRampToValueAtTime(gain, t0 + start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      o.connect(g).connect(out);
      o.start(t0 + start);
      o.stop(t0 + start + dur + 0.05);
    };
    const bell = (freq: number, start: number, gain = 0.12) => {
      tone(freq, start, 0.9, 'sine', gain);
      tone(freq * 2.76, start, 0.35, 'sine', gain * 0.35);
      tone(freq * 5.4, start, 0.18, 'sine', gain * 0.15);
    };
    if (id === 'ring') {
      // "Jingle Bells" (1857, public domain) first phrase, on bells: 2.4 s.
      const E = 659.25, G = 783.99, C = 523.25, D = 587.33;
      const notes: [number, number][] = [[E, 0], [E, 0.22], [E, 0.44], [E, 0.88], [E, 1.1], [E, 1.32], [E, 1.76], [G, 1.98], [C, 2.2], [D, 2.38]];
      notes.forEach(([f, s]) => bell(f, s, 0.14));
      return 2.9;
    }
    if (id === 'bells') {
      for (let i = 0; i < 14; i++) bell(1800 + (i % 3) * 260 + Math.random() * 120, i * 0.11 + Math.random() * 0.03, 0.05);
      return 1.8;
    }
    if (id === 'reindeer') {
      // A playful snort (filtered noise) then a happy little bleat, with bells.
      const len = 0.5;
      const noise = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const n = this.ctx.createBufferSource();
      n.buffer = noise;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 600;
      f.Q.value = 0.8;
      const g = this.ctx.createGain();
      g.gain.value = 0.5;
      n.connect(f).connect(g).connect(out);
      n.start(t0);
      const o = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(320, t0 + 0.6);
      o.frequency.linearRampToValueAtTime(420, t0 + 0.75);
      o.frequency.linearRampToValueAtTime(300, t0 + 1.05);
      og.gain.setValueAtTime(0.0001, t0 + 0.6);
      og.gain.exponentialRampToValueAtTime(0.06, t0 + 0.65);
      og.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1400;
      o.connect(lp).connect(og).connect(out);
      o.start(t0 + 0.6);
      o.stop(t0 + 1.2);
      for (let i = 0; i < 8; i++) bell(2000 + Math.random() * 400, 1.2 + i * 0.12, 0.05);
      return 2.3;
    }
    if (id === 'sparkle') {
      [1568, 2093, 2637, 3136].forEach((fr, i) => bell(fr, i * 0.07, 0.05));
      return 0.6;
    }
    // hang up: two soft descending tones
    tone(660, 0, 0.18, 'sine', 0.12);
    tone(440, 0.2, 0.25, 'sine', 0.12);
    return 0.5;
  }

  /** Santa is interrupted (the child speaks over him): the current sound stops, the call goes on. */
  interrupt() {
    this.cut = true;
    try {
      this.current?.stop();
    } catch {
      /* already stopped */
    }
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }

  /** True once after `interrupt()` (read by the live call to skip the rest of a reply). */
  takeInterrupted(): boolean {
    const c = this.cut;
    this.cut = false;
    return c;
  }

  /** Is Santa's voice playing right now? */
  get speaking(): boolean {
    return this.current !== null || (typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking);
  }

  stop() {
    this.stopped = true;
    try {
      this.current?.stop();
    } catch {
      /* already stopped */
    }
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    cancelAnimationFrame(this.raf);
    this.onLevel(0);
  }

  close() {
    this.stop();
    void this.ctx.close().catch(() => {});
  }
}

/** Waits `s` seconds (call pacing). */
export const wait = (s: number) => new Promise<void>((r) => setTimeout(r, s * 1000));
