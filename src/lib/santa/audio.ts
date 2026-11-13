'use client';

import { santaText, type SantaLocale } from '@/data/santa/lines';
import { staticClipUrl } from '@/data/santa/voice-clips';
import { cachedClip } from './precache';
import { anonNameKey, nameClipUrl, type NameVariant } from './names';
import { cuesAt, loadVisemes, type Viseme } from './visemes';

/**
 * Santa's voice on the device: ONE voice everywhere. Plays Santa's recorded
 * clips (public/santa/voice, santa-v2, made offline for free) and the child's
 * first name from the recorded greetings (public/santa/names), or a same-voice
 * greeting without the name when it is not recorded. When a clip cannot be
 * fetched, Santa's words show as a caption (no other voice takes over).
 * The mouth follows each clip's precomputed mouth cues (Rhubarb Lip Sync,
 * public/santa/visemes), or the loudness for the first names.
 * Also code-built sounds (no audio files): the phone ringing, sleigh bells, a
 * reindeer's snort and a sparkle.
 */

/** Bump when the texts of src/data/santa/lines.ts change (busts the CDN cache of the live AI route). */
export const VOICE_VERSION = 1;
/** Pause before the one retry of a clip the live AI route could not make (502/429). */
export const RETRY_MS = 1500;

export const clipUrl = (key: string, locale: SantaLocale) => `/api/santa/voice?k=${encodeURIComponent(key)}&l=${locale}&v=${VOICE_VERSION}`;

/** Where a clip comes from: its recorded file (first names: the recorded greeting, or the nameless one). */
export const clipSources = async (key: string, locale: SantaLocale, fetcher?: typeof fetch): Promise<string[]> => {
  const [kind, variant, ...rest] = key.split(':');
  if (kind === 'name' && (variant === 'hello' || variant === 'bye')) {
    const named = await nameClipUrl(variant as NameVariant, rest.join(':'), locale, fetcher);
    const anon = staticClipUrl(anonNameKey(variant as NameVariant), locale);
    return [named, anon].filter((u): u is string => Boolean(u));
  }
  const file = staticClipUrl(key, locale);
  return file ? [file] : [];
};

/** A clip's mouth-cue name: `line-open.hohoho` for `/santa/voice/fr/line-open.hohoho.mp3?…`. */
export const cueName = (url: string) => (url.startsWith('/santa/voice/') ? (url.split('/').pop() ?? '').replace(/\.mp3.*$/, '') : null);

type Level = (v: number) => void;

export class SantaAudio {
  readonly ctx: AudioContext;
  private analyser: AnalyserNode;
  private master: GainNode;
  private buffers = new Map<string, AudioBuffer | null>();
  private current: AudioBufferSourceNode | null = null;
  private raf = 0;
  private stopped = false;
  private cut = false;

  private urls = new Map<string, string>();
  private visemes: Promise<Record<string, string> | null>;

  constructor(private locale: SantaLocale, private onLevel: Level, private onViseme?: (v: Viseme | null) => void) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.95;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.master.connect(this.ctx.destination);
    this.visemes = onViseme ? loadVisemes(locale) : Promise.resolve(null);
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
    // Two at a time: clips not recorded are made one by one by the voice service, which limits bursts.
    await Promise.all([worker(), worker()]);
    onProgress?.(1);
  }

  private async load(key: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(key)) return this.buffers.get(key) ?? null;
    try {
      let bytes: ArrayBuffer | null = null;
      for (const url of await clipSources(key, this.locale)) {
        // A scheduled call's clips were stored on the device in advance (precache.ts).
        bytes = await cachedClip(url);
        if (!bytes) {
          const res = await fetch(url).catch(() => null);
          if (this.stopped) throw new Error('stopped');
          bytes = res?.ok ? await res.arrayBuffer() : null;
        }
        if (bytes) {
          this.urls.set(key, url);
          break;
        }
      }
      if (!bytes) throw new Error('no clip');
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
    if (buf) {
      const name = cueName(this.urls.get(key) ?? '');
      const cues = name ? (await this.visemes)?.[name] ?? null : null;
      return this.playBuffer(buf, cues);
    }
    // No clip: Santa's words stay as the caption for as long as he would speak them.
    return this.silentCaption(text);
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
    return this.silentCaption(text);
  }

  private playBuffer(buf: AudioBuffer, cues: string | null = null): Promise<void> {
    return new Promise((resolve) => {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.analyser);
      this.analyser.connect(this.master);
      this.current = src;
      const data = new Uint8Array(this.analyser.fftSize);
      const t0 = this.ctx.currentTime;
      // Output latency: the mouth should move with what is heard, not what is scheduled.
      const lat = (this.ctx as AudioContext & { outputLatency?: number }).outputLatency ?? this.ctx.baseLatency ?? 0;
      const tick = () => {
        this.analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        const level = Math.min(1, Math.sqrt(sum / data.length) * 5);
        if (cues && this.onViseme) this.onViseme(cuesAt(cues, this.ctx.currentTime - t0 - lat));
        else this.onLevel(level);
        this.raf = requestAnimationFrame(tick);
      };
      tick();
      src.onended = () => {
        cancelAnimationFrame(this.raf);
        this.onViseme?.(null);
        this.onLevel(0);
        src.disconnect();
        if (this.current === src) this.current = null;
        resolve();
      };
      src.start();
    });
  }

  /** The last resort: no sound, the caption stays up (about the time it takes to say it). */
  private silentCaption(text: string): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Math.min(9000, 900 + text.length * 60)));
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
  }

  /** True once after `interrupt()` (read by the live call to skip the rest of a reply). */
  takeInterrupted(): boolean {
    const c = this.cut;
    this.cut = false;
    return c;
  }

  /** Is Santa's voice playing right now? */
  get speaking(): boolean {
    return this.current !== null;
  }

  stop() {
    this.stopped = true;
    try {
      this.current?.stop();
    } catch {
      /* already stopped */
    }
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
