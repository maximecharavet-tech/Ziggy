/**
 * The little synthesiser behind Ziggy's sound effects.
 *
 * Everything is made with Web Audio nodes (no audio file, no licence, nothing
 * to download): oscillators with pitch glides, two-operator FM for bells and
 * wood, filtered noise for air and paper, a formant "robot voice" for the
 * giggle and the yay, ADSR envelopes, vibrato and tremolo. It works on any
 * BaseAudioContext, so the very same code plays live and renders offline
 * (OfflineAudioContext) for the loudness measurements.
 *
 * The master bus: voices → ducking → volume → tone → gentle compressor →
 * soft clipper (never above −3.1 dBFS), with a tiny room made of four short
 * filtered delays (no convolution, no impulse file).
 */
import { CEILING, KNEE, mulberry32, softClipCurve } from './math';

export type Ctx = BaseAudioContext;
type Pt = readonly [time: number, value: number];

/** One playing sound: where its notes go and how its time and pitch are scaled. */
export interface Voice {
  ctx: Ctx;
  /** Start time on the context clock (s). */
  t: number;
  /** Pitch ratio applied to every frequency. */
  p: number;
  /** Time stretch applied to every time. */
  s: number;
  out: AudioNode;
  rng: () => number;
  /** Latest stop time scheduled so far (s). */
  end: number;
  sources: AudioScheduledSourceNode[];
  /** The source that stops last (its `onended` frees the voice). */
  last?: AudioScheduledSourceNode;
}

export type Env = {
  /** Attack (s). Never instant: nothing clicks, nothing startles. */
  a?: number;
  /** Decay to the sustain level (s). */
  d?: number;
  /** Sustain level (0–1 of peak); leave out for a percussive note that just rings down. */
  s?: number;
  /** Release (s), inside `dur`. */
  r?: number;
};

export type Filter = {
  type: BiquadFilterType;
  f?: number;
  to?: number;
  glide?: number;
  pts?: Pt[];
  q?: number;
  gain?: number;
};

type Common = Env & {
  at?: number;
  dur: number;
  peak?: number;
  filter?: Filter | Filter[];
  /** Vibrato: rate (Hz) and depth (cents), optionally fading to `depthTo`, starting after `delay`. */
  vib?: { rate: number; depth: number; depthTo?: number; delay?: number };
  /** Tremolo: rate (Hz) and depth (0–0.5). */
  trem?: { rate: number; depth: number };
  pan?: number;
  panTo?: number;
};

export type ToneOpts = Common & {
  type?: OscillatorType;
  /** Frequency (Hz) at the start… */
  f?: number;
  /** …gliding to this one… */
  to?: number;
  /** …over this long (default: the whole note). */
  glide?: number;
  /** Or a full pitch contour: [time, Hz] points. */
  pts?: Pt[];
  curve?: 'exp' | 'lin';
  detune?: number;
};

export type FmOpts = ToneOpts & {
  /** Modulator frequency = carrier × ratio. */
  ratio: number;
  /** Modulation index at the start, fading to `indexTo` over `indexTime` (default: the note). */
  index: number;
  indexTo?: number;
  indexTime?: number;
};

export type NoiseOpts = Common & { rate?: number };

export type VoxOpts = Common & {
  type?: OscillatorType;
  /** Pitch contour [time, Hz]. */
  pts: Pt[];
  /** Vowel contour [time, F1, F2, F3]. */
  formants: readonly (readonly [number, number, number, number])[];
  /** Formant levels. */
  levels?: readonly [number, number, number];
};

/* ───────────────────────── scheduling helpers ───────────────────────── */

const at = (v: Voice, t = 0) => v.t + t * v.s;

function track(v: Voice, src: AudioScheduledSourceNode, start: number, stop: number, offset?: number) {
  if (offset === undefined) src.start(start);
  else (src as AudioBufferSourceNode).start(start, offset);
  src.stop(stop);
  v.sources.push(src);
  if (stop >= v.end) {
    v.end = stop;
    v.last = src;
  }
}

/** Amplitude envelope on a gain param. Linear attack, exponential (natural) decays. */
function envelope(g: AudioParam, t0: number, dur: number, peak: number, e: Env, s: number) {
  const a = Math.min(Math.max(0.0015, (e.a ?? 0.004) * s), dur * 0.5);
  const end = t0 + dur;
  const floor = Math.max(1e-5, peak * 0.001); // −60 dB below the peak
  g.setValueAtTime(0, t0);
  g.linearRampToValueAtTime(peak, t0 + a);
  if (e.s === undefined || e.s <= 0) {
    g.exponentialRampToValueAtTime(floor, end);
  } else {
    const sus = Math.max(floor, peak * e.s);
    const r = Math.min(Math.max(0.005, (e.r ?? 0.05) * s), dur - a);
    const d = Math.min(Math.max(0.001, (e.d ?? 0.02) * s), Math.max(0.001, dur - a - r));
    g.exponentialRampToValueAtTime(sus, t0 + a + d);
    g.setValueAtTime(sus, Math.max(t0 + a + d, end - r));
    g.exponentialRampToValueAtTime(floor, end);
  }
  g.setValueAtTime(0, end + 0.001);
}

/** Point contour on a param (times scaled by the voice, values by `scale`). */
function contour(param: AudioParam, v: Voice, t0: number, pts: readonly Pt[], scale: number, curve: 'exp' | 'lin') {
  const [first, ...rest] = pts;
  param.setValueAtTime(first[1] * scale, t0 + first[0] * v.s);
  for (const [t, val] of rest) {
    const time = t0 + t * v.s;
    if (curve === 'exp') param.exponentialRampToValueAtTime(Math.max(1, val * scale), time);
    else param.linearRampToValueAtTime(val * scale, time);
  }
}

function pitchPoints(o: { f?: number; to?: number; glide?: number; pts?: Pt[] }, dur: number): Pt[] {
  if (o.pts?.length) return o.pts;
  const f = o.f ?? 440;
  return o.to === undefined ? [[0, f]] : [[0, f], [o.glide ?? dur, o.to]];
}

/** Filters in series; returns the last node. */
function filters(v: Voice, input: AudioNode, spec: Filter | Filter[] | undefined, t0: number, dur: number, pitched: boolean): AudioNode {
  if (!spec) return input;
  let node = input;
  for (const f of Array.isArray(spec) ? spec : [spec]) {
    const bq = v.ctx.createBiquadFilter();
    bq.type = f.type;
    bq.Q.value = f.q ?? 0.7;
    if (f.gain !== undefined) bq.gain.value = f.gain;
    // Filters follow the voice's pitch (a tiny bit less than fully), so a higher variant stays in tune with itself.
    const scale = pitched ? v.p : Math.sqrt(v.p);
    const pts = f.pts ?? (f.to === undefined ? [[0, f.f ?? 1000] as Pt] : [[0, f.f ?? 1000] as Pt, [f.glide ?? dur / v.s, f.to] as Pt]);
    contour(bq.frequency, v, t0, pts.map(([t, hz]) => [t, Math.min(hz, 20000 / Math.max(1, scale))] as Pt), scale, 'exp');
    node.connect(bq);
    node = bq;
  }
  return node;
}

function lfo(v: Voice, rate: number, t0: number, stop: number): OscillatorNode {
  const o = v.ctx.createOscillator();
  o.frequency.value = rate;
  track(v, o, t0, stop);
  return o;
}

/** Envelope, tremolo, pan, then out. */
function finish(v: Voice, src: AudioNode, o: Common, t0: number, dur: number) {
  const amp = v.ctx.createGain();
  envelope(amp.gain, t0, dur, o.peak ?? 0.3, o, v.s);
  src.connect(amp);
  let node: AudioNode = amp;
  if (o.trem) {
    const tr = v.ctx.createGain();
    const depth = Math.min(0.5, o.trem.depth);
    tr.gain.value = 1 - depth;
    const m = v.ctx.createGain();
    m.gain.value = depth;
    lfo(v, o.trem.rate, t0, t0 + dur + 0.02).connect(m).connect(tr.gain);
    node.connect(tr);
    node = tr;
  }
  if ((o.pan !== undefined || o.panTo !== undefined) && typeof v.ctx.createStereoPanner === 'function') {
    const pn = v.ctx.createStereoPanner();
    pn.pan.setValueAtTime(o.pan ?? 0, t0);
    if (o.panTo !== undefined) pn.pan.linearRampToValueAtTime(o.panTo, t0 + dur);
    node.connect(pn);
    node = pn;
  }
  node.connect(v.out);
}

function vibrato(v: Voice, target: AudioParam, o: Common, t0: number, dur: number) {
  if (!o.vib) return;
  const depth = v.ctx.createGain();
  const start = t0 + (o.vib.delay ?? 0) * v.s;
  depth.gain.setValueAtTime(0, t0);
  depth.gain.setValueAtTime(0, start);
  depth.gain.linearRampToValueAtTime(o.vib.depth, Math.min(t0 + dur, start + 0.04 * v.s));
  if (o.vib.depthTo !== undefined) depth.gain.linearRampToValueAtTime(o.vib.depthTo, t0 + dur);
  lfo(v, o.vib.rate, t0, t0 + dur + 0.02).connect(depth).connect(target);
}

/* ───────────────────────────── primitives ───────────────────────────── */

/** An oscillator note with pitch glide, filter, vibrato and envelope. */
export function tone(v: Voice, o: ToneOpts): void {
  const t0 = at(v, o.at);
  const dur = o.dur * v.s;
  const osc = v.ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  contour(osc.frequency, v, t0, pitchPoints(o, o.dur), v.p, o.curve ?? 'exp');
  if (o.detune) osc.detune.value = o.detune;
  vibrato(v, osc.detune, o, t0, dur);
  finish(v, filters(v, osc, o.filter, t0, dur, true), o, t0, dur);
  track(v, osc, t0, t0 + dur + 0.02);
}

/** Two-operator FM: a modulator wobbles the carrier's frequency (bells, wood, metal). */
export function fm(v: Voice, o: FmOpts): void {
  const t0 = at(v, o.at);
  const dur = o.dur * v.s;
  const pts = pitchPoints(o, o.dur);
  const curve = o.curve ?? 'exp';
  const car = v.ctx.createOscillator();
  car.type = o.type ?? 'sine';
  contour(car.frequency, v, t0, pts, v.p, curve);
  const mod = v.ctx.createOscillator();
  contour(mod.frequency, v, t0, pts, v.p * o.ratio, curve);
  // Depth in Hz = index × modulator frequency: one gain follows the pitch, the next the index envelope.
  const follow = v.ctx.createGain();
  contour(follow.gain, v, t0, pts, v.p * o.ratio * o.index, curve);
  const idx = v.ctx.createGain();
  idx.gain.setValueAtTime(1, t0);
  const fade = (o.indexTime ?? o.dur) * v.s;
  idx.gain.exponentialRampToValueAtTime(Math.max(0.001, (o.indexTo ?? o.index * 0.2) / o.index), t0 + Math.min(dur, fade));
  mod.connect(follow).connect(idx).connect(car.frequency);
  if (o.detune) car.detune.value = o.detune;
  vibrato(v, car.detune, o, t0, dur);
  finish(v, filters(v, car, o.filter, t0, dur, true), o, t0, dur);
  track(v, car, t0, t0 + dur + 0.02);
  track(v, mod, t0, t0 + dur + 0.02);
}

const noiseBuffers = new WeakMap<Ctx, AudioBuffer>();

/** Two seconds of white noise per context (seeded: renders are reproducible). */
function noiseBuffer(ctx: Ctx): AudioBuffer {
  let buf = noiseBuffers.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, Math.round(ctx.sampleRate * 2), ctx.sampleRate);
    const data = buf.getChannelData(0);
    const rnd = mulberry32(7);
    for (let i = 0; i < data.length; i++) data[i] = rnd() * 2 - 1;
    noiseBuffers.set(ctx, buf);
  }
  return buf;
}

/** Filtered noise: air, paper, breath, the snap of a party popper. */
export function noise(v: Voice, o: NoiseOpts): void {
  const t0 = at(v, o.at);
  const dur = o.dur * v.s;
  const src = v.ctx.createBufferSource();
  src.buffer = noiseBuffer(v.ctx);
  src.loop = true;
  src.playbackRate.value = o.rate ?? 1;
  finish(v, filters(v, src, o.filter, t0, dur, false), o, t0, dur);
  track(v, src, t0, t0 + dur + 0.02, v.rng() * 1.5);
}

/** A buzzy source through three moving formants: a robot vowel ("ee", "ah"…), never a recorded voice. */
export function vox(v: Voice, o: VoxOpts): void {
  const t0 = at(v, o.at);
  const dur = o.dur * v.s;
  const osc = v.ctx.createOscillator();
  osc.type = o.type ?? 'sawtooth';
  contour(osc.frequency, v, t0, o.pts, v.p, 'exp');
  vibrato(v, osc.detune, o, t0, dur);
  const sum = v.ctx.createGain();
  const levels = o.levels ?? [1, 0.6, 0.25];
  const qs = [6, 10, 12];
  for (let k = 0; k < 3; k++) {
    const bp = v.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = qs[k];
    contour(bp.frequency, v, t0, o.formants.map((f) => [f[0], f[k + 1]] as Pt), Math.sqrt(v.p), 'exp');
    const g = v.ctx.createGain();
    g.gain.value = levels[k];
    osc.connect(bp).connect(g).connect(sum);
  }
  finish(v, filters(v, sum, o.filter, t0, dur, true), o, t0, dur);
  track(v, osc, t0, t0 + dur + 0.02);
}

/* ───────────────────────────── instruments ───────────────────────────── */

/** A glassy little bell: inharmonic FM that rings down. */
export function bell(v: Voice, o: { f: number; at?: number; dur: number; peak?: number; pan?: number }): void {
  fm(v, { f: o.f, at: o.at, dur: o.dur, peak: o.peak, pan: o.pan, ratio: 3.5, index: 1.4, indexTo: 0.05, indexTime: o.dur * 0.5, a: 0.002 });
  tone(v, { f: o.f * 2.76, at: o.at, dur: o.dur * 0.45, peak: (o.peak ?? 0.3) * 0.18, pan: o.pan, a: 0.002 });
}

/** A marimba bar: warm fundamental, a quick 4th partial, a tiny knock. */
export function mallet(v: Voice, o: { f: number; at?: number; dur: number; peak?: number; pan?: number }): void {
  const peak = o.peak ?? 0.3;
  tone(v, { f: o.f, at: o.at, dur: o.dur, peak, pan: o.pan, a: 0.003 });
  tone(v, { f: o.f * 3.93, at: o.at, dur: o.dur * 0.35, peak: peak * 0.22, pan: o.pan, a: 0.002 });
  tone(v, { f: o.f * 9.2, at: o.at, dur: o.dur * 0.12, peak: peak * 0.06, pan: o.pan, a: 0.0015 });
}

/** A soft toy trumpet: two detuned saws through a filter that opens and settles. */
export function brass(v: Voice, o: { f: number; at?: number; dur: number; peak?: number; vib?: Common['vib']; pan?: number }): void {
  const peak = o.peak ?? 0.2;
  const filter: Filter = { type: 'lowpass', pts: [[0, o.f * 1.2], [0.05, o.f * 4.5], [Math.max(0.06, o.dur), o.f * 2.6]], q: 1.2 };
  for (const detune of [-7, 7]) {
    tone(v, { type: 'sawtooth', f: o.f, at: o.at, dur: o.dur, peak: peak * 0.5, detune, a: 0.018, d: 0.06, s: 0.75, r: Math.min(0.12, o.dur * 0.4), filter, vib: o.vib, pan: o.pan });
  }
}

/** A slide whistle: an almost pure tone with a breath of air and a little vibrato. */
export function whistle(v: Voice, from: number, to: number, dur: number, peak = 0.4): void {
  tone(v, { f: from, to, curve: 'exp', dur, peak, a: 0.03, d: 0.05, s: 0.85, r: 0.07, vib: { rate: 6, depth: 14, delay: 0.05 } });
  tone(v, { f: from * 2, to: to * 2, curve: 'exp', dur, peak: peak * 0.08, a: 0.03, d: 0.05, s: 0.8, r: 0.07 });
  noise(v, { dur, peak: peak * 0.05, a: 0.03, d: 0.05, s: 0.8, r: 0.07, filter: { type: 'bandpass', f: from, to, q: 6 } });
}

/** A scatter of tiny bells on a high pentatonic, left and right. */
export function glitter(v: Voice, o: { at?: number; dur: number; count: number; lo: number; hi: number; peak: number }): void {
  const scale = [0, 2, 4, 7, 9]; // major pentatonic
  const notes: number[] = [];
  for (let m = 60; m < 110; m++) {
    const hz = 440 * 2 ** ((m - 69) / 12);
    if (hz >= o.lo && hz <= o.hi && scale.includes(m % 12)) notes.push(hz);
  }
  for (let i = 0; i < o.count; i++) {
    const when = (o.at ?? 0) + o.dur * (i / o.count) ** 1.25 + v.rng() * 0.03;
    const f = notes[Math.floor(v.rng() * notes.length)] ?? o.lo;
    bell(v, { f, at: when, dur: 0.12 + v.rng() * 0.12, peak: o.peak * (1 - (0.6 * i) / o.count), pan: v.rng() * 1.4 - 0.7 });
  }
}

/* ───────────────────────────── master bus ───────────────────────────── */

export interface Bus {
  /** Voices connect here (dry). */
  input: AudioNode;
  /** Reverb send. */
  room: AudioNode;
  /** Master level (0–1) and the soft-sounds tone. */
  setLevel(volume: number, soft: boolean): void;
  /** Lower the effects while Ziggy speaks. */
  setDucked(on: boolean): void;
}

/** Gentle glue: only overlapping sounds reach the threshold. */
export const COMPRESSOR = { threshold: -12, knee: 6, ratio: 4, attack: 0.003, release: 0.12 } as const;
/**
 * Web Audio compressors add their own make-up gain (pow(1 / curve(1), 0.6),
 * same code in Chromium, WebKit and Gecko). This trim cancels it, measured
 * offline, so a sound below the threshold leaves the bus at the level it entered.
 */
export const COMPRESSOR_TRIM = 0.6129;
/** How far the effects dip under Ziggy's voice. */
export const DUCK_GAIN = 0.35;
/** "Sons doux": quieter and rounder. */
export const SOFT_VOLUME = 0.42;
export const SOFT_TONE_HZ = 4800;

export type BusOptions = {
  destination?: AudioNode;
  /** false = no compressor/clipper/tone (dry measurement renders). */
  processing?: boolean;
};

export function createBus(ctx: Ctx, opts: BusOptions = {}): Bus {
  const destination = opts.destination ?? ctx.destination;
  const processing = opts.processing !== false;
  const input = ctx.createGain();
  const room = ctx.createGain();
  const duck = ctx.createGain();
  const volume = ctx.createGain();
  input.connect(duck);

  // A tiny felt room: four short filtered feedback delays, spread left and right.
  const wet = ctx.createGain();
  wet.gain.value = 0.55;
  for (const [ms, side] of [[23, -0.5], [31, 0.5], [41, -0.25], [53, 0.25]] as const) {
    const delay = ctx.createDelay(0.2);
    delay.delayTime.value = ms / 1000;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 3200;
    const fb = ctx.createGain();
    fb.gain.value = 0.34;
    room.connect(delay);
    delay.connect(damp);
    damp.connect(fb).connect(delay);
    if (typeof ctx.createStereoPanner === 'function') {
      const pan = ctx.createStereoPanner();
      pan.pan.value = side;
      damp.connect(pan).connect(wet);
    } else damp.connect(wet);
  }
  wet.connect(duck);
  duck.connect(volume);

  let tone: BiquadFilterNode | null = null;
  if (processing) {
    tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 18000;
    tone.Q.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = COMPRESSOR.threshold;
    comp.knee.value = COMPRESSOR.knee;
    comp.ratio.value = COMPRESSOR.ratio;
    comp.attack.value = COMPRESSOR.attack;
    comp.release.value = COMPRESSOR.release;
    const trim = ctx.createGain();
    trim.gain.value = COMPRESSOR_TRIM;
    const clip = ctx.createWaveShaper();
    clip.curve = softClipCurve(2049, KNEE, CEILING);
    clip.oversample = 'none'; // no resampling filter: the output can never ring past the ceiling
    volume.connect(tone).connect(comp).connect(trim).connect(clip).connect(destination);
  } else {
    volume.connect(destination);
  }

  return {
    input,
    room,
    setLevel(level, soft) {
      const gain = Math.max(0, Math.min(1, level)) * (soft ? SOFT_VOLUME : 1);
      const hz = soft ? SOFT_TONE_HZ : 18000;
      const now = ctx.currentTime;
      if (now === 0) {
        // A fresh context: set at once.
        volume.gain.value = gain;
        if (tone) tone.frequency.value = hz;
        return;
      }
      // Quick enough that the preview played right after a change is already at the new level.
      volume.gain.setTargetAtTime(gain, now, 0.01);
      tone?.frequency.setTargetAtTime(hz, now, 0.01);
    },
    setDucked(on) {
      // Quick to duck (Ziggy's first word stays clear), slow to come back.
      duck.gain.setTargetAtTime(on ? DUCK_GAIN : 1, ctx.currentTime, on ? 0.04 : 0.25);
    },
  };
}
