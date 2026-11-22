/**
 * Offline rendering (OfflineAudioContext) of the sounds, for the loudness
 * measurements, the WAV demo and checks in a real browser. Not used by the
 * site at runtime.
 */
import { SOUND_NAMES, type SoundName } from './catalog';
import { createBus } from './engine';
import { GAINS } from './gains';
import { SfxPlayer, startVoice, type PlayOptions } from './player';

export type RenderOptions = {
  sampleRate?: number;
  seconds?: number;
  /** false = dry (no compressor, clipper or tone): what `gains.ts` is measured on. */
  processing?: boolean;
  /** false = render at unity gain (to measure the raw recipe). */
  balanced?: boolean;
  /** Render with the "sons doux" setting. */
  soft?: boolean;
  /** When the sound starts (s); later than 0 lets the compressor settle as on a live page. */
  start?: number;
};

type Ctor = typeof OfflineAudioContext;

/** Render one sound (no variation unless asked) to stereo channels. */
export async function renderSound(name: SoundName, play: PlayOptions = {}, o: RenderOptions = {}): Promise<Float32Array[]> {
  const sr = o.sampleRate ?? 48000;
  const start = o.start ?? 0.25;
  const ctx = new (OfflineAudioContext as Ctor)(2, Math.round(((o.seconds ?? 2.4) + start) * sr), sr);
  const bus = createBus(ctx, { processing: o.processing });
  if (o.soft) bus.setLevel(1, true);
  startVoice(ctx, bus, name, { variation: false, ...play }, start, undefined, o.balanced === false ? 1 : GAINS[name]);
  const buf = await ctx.startRendering();
  const from = Math.max(0, Math.round((start - 0.02) * sr));
  return [buf.getChannelData(0).slice(from), buf.getChannelData(1).slice(from)];
}

export type ScriptEvent = { at: number; name: SoundName; opts?: PlayOptions };

/** Render a timeline through the full player (limits included), e.g. a spam-tap stress test. */
export async function renderScript(events: ScriptEvent[], seconds: number, sampleRate = 48000): Promise<{ channels: Float32Array[]; played: boolean[] }> {
  const ctx = new (OfflineAudioContext as Ctor)(2, Math.round(seconds * sampleRate), sampleRate);
  const player = new SfxPlayer(ctx);
  const played = events.map((e) => player.play(e.name, e.opts, e.at));
  const buf = await ctx.startRendering();
  return { channels: [buf.getChannelData(0).slice(), buf.getChannelData(1).slice()], played };
}

export { SOUND_NAMES };
