/**
 * Plays the recipes on a bus: per-play variation, the caller's options, the
 * measured loudness gain, then the mix limits (rate limit per sound, polyphony
 * cap with voice stealing). Works on any BaseAudioContext, live or offline.
 */
import { SOUNDS, type SoundName } from './catalog';
import { createBus, type Bus, type Ctx, type Voice } from './engine';
import { GAINS } from './gains';
import { RateLimiter, VoicePool } from './limits';
import { clamp, dbToGain, mulberry32, seedOf } from './math';
import { RECIPES } from './recipes';
import { pitchAndTime, vary } from './variation';

export type PlayOptions = {
  /** Transpose, in semitones (−12…12). */
  pitch?: number;
  /** 0–1, on top of the sound's own balance. */
  volume?: number;
  /** −1 (left) … 1 (right). */
  pan?: number;
  /** Tiny random changes on each play (default true). */
  variation?: boolean;
};

export type VoiceHandle = {
  name: SoundName;
  start: number;
  end: number;
  cents: number;
  /** Fade out quickly (30 ms) and stop. */
  stop(at?: number): void;
};

/** Most voices at once. */
export const MAX_VOICES = 8;
/** A voice younger than this (s) is only cut for a more important one. */
export const MIN_STEAL_AGE = 0.08;

/** Schedule one sound on a bus. No limits here: see SfxPlayer. */
export function startVoice(
  ctx: Ctx,
  bus: Bus,
  name: SoundName,
  opts: PlayOptions = {},
  when = ctx.currentTime,
  lastCents?: number,
  /** Loudness balance; the offline measurements pass 1 to hear the raw recipe. */
  balance: number = GAINS[name],
): VoiceHandle {
  const meta = SOUNDS[name];
  const varied = opts.variation !== false;
  const rng = varied ? Math.random : mulberry32(seedOf(name));
  const v = vary(meta.vary, rng, varied, lastCents);
  const { ratio, stretch } = pitchAndTime(opts.pitch, v);

  const out = ctx.createGain();
  out.gain.value = balance * clamp(opts.volume ?? 1, 0, 1) * dbToGain(v.db);
  let tail: AudioNode = out;
  if (opts.pan && typeof ctx.createStereoPanner === 'function') {
    const pan = ctx.createStereoPanner();
    pan.pan.value = clamp(opts.pan, -1, 1);
    out.connect(pan);
    tail = pan;
  }
  tail.connect(bus.input);
  if (meta.room > 0) {
    const send = ctx.createGain();
    send.gain.value = meta.room;
    tail.connect(send).connect(bus.room);
  }

  const voice: Voice = { ctx, t: when, p: ratio, s: stretch, out, rng, end: when, sources: [] };
  RECIPES[name](voice);
  // Unplug the voice once its last note has ended (the room's tail lives on in the bus).
  if (voice.last) voice.last.onended = () => tail.disconnect();

  return {
    name,
    start: when,
    end: voice.end,
    cents: v.cents,
    stop(at = ctx.currentTime) {
      try {
        out.gain.cancelScheduledValues(at);
        out.gain.setValueAtTime(out.gain.value, at);
        out.gain.linearRampToValueAtTime(0, at + 0.03);
        for (const s of voice.sources) s.stop(at + 0.04);
      } catch {
        /* already stopped */
      }
    },
  };
}

/** A bus plus the mix limits: what the site uses to play sounds. */
export class SfxPlayer {
  readonly bus: Bus;
  private limiter = new RateLimiter();
  private pool = new VoicePool<VoiceHandle>(MAX_VOICES, MIN_STEAL_AGE);
  private lastCents = new Map<SoundName, number>();

  constructor(
    readonly ctx: Ctx,
    bus?: Bus,
  ) {
    this.bus = bus ?? createBus(ctx);
  }

  /** Play a sound at `when` (context time). Returns false when a limit skipped it. */
  play(name: SoundName, opts: PlayOptions = {}, when = this.ctx.currentTime): boolean {
    const meta = SOUNDS[name];
    if (!meta) return false;
    const ms = when * 1000;
    if (!this.limiter.ready(name, ms, meta.minGapMs)) return false;
    const verdict = this.pool.admit({ name, priority: meta.priority, now: when, maxPerName: meta.maxPerName, onFull: meta.onFull });
    if (!verdict.ok) return false;
    this.limiter.mark(name, ms);
    for (const victim of verdict.steal) victim.handle.stop(when);
    const handle = startVoice(this.ctx, this.bus, name, opts, when, this.lastCents.get(name));
    this.lastCents.set(name, handle.cents);
    this.pool.add({ name, priority: meta.priority, start: when, end: handle.end, handle });
    return true;
  }

  /** Fade out everything (mute pressed mid-sound). */
  stopAll(at = this.ctx.currentTime): void {
    for (const v of this.pool.clear()) v.handle.stop(at);
  }
}
