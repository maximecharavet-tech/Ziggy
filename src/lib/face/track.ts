/**
 * Face track file format ("ziggy-face-track" v1): a pre-baked facial
 * animation for one voice clip, small enough to ship next to the audio.
 *
 *   public/face/{character}/{locale}/{clipId}.face.json   (suggested path)
 *
 * {
 *   "format": "ziggy-face-track",
 *   "version": 1,
 *   "id": "santa/fr/greet-01",            // lowercase a-z 0-9 / _ . -
 *   "fps": 30,                             // 10..120
 *   "frames": 150,                         // number of frames
 *   "duration": 5,                         // seconds, = frames / fps (± 1 frame)
 *   "channels": ["jawOpen", "mouthClose", "mouthFunnel", ...],
 *   "data": "<base64>",                    // frames × channels bytes, frame-major, value = byte / 255
 *   "emotions": [[0, "smile", 0.6], [2.1, "laugh", 1]],   // optional keys: [time s, emotion, 0..1]
 *   "source": {
 *     "generator": "audio2face-3d" | "web-fallback" | "manual",
 *     "model": "Audio2Face-3D-v3.0/Claire", // required for audio2face-3d
 *     "modelLicense": "NVIDIA Open Model License",
 *     "audioSha256": "…",                    // hex of the exact audio file the track was baked from
 *     "createdAt": "2026-11-09"
 *   }
 * }
 *
 * Channels: ARKit blendshape names (minus FORBIDDEN_ARKIT: frowns, brow-down,
 * sneers, never on our faces) and/or our viseme channels jaw / AA / EE / OO /
 * MM / FF. 8-bit quantisation is plenty for a plush mouth: ~2 KB per 5 s at
 * 30 fps with 10 channels.
 */
import { clamp01 } from './features';
import { ARKIT_52, EMOTIONS, FORBIDDEN_ARKIT, type Emotion } from './types';

export const TRACK_FORMAT = 'ziggy-face-track';
export const TRACK_VERSION = 1;
export const VISEME_CHANNELS = ['jaw', 'AA', 'EE', 'OO', 'MM', 'FF'] as const;
export type TrackChannel = (typeof ARKIT_52)[number] | (typeof VISEME_CHANNELS)[number];

export const ALLOWED_CHANNELS: ReadonlySet<string> = new Set<string>([
  ...ARKIT_52.filter((n) => !FORBIDDEN_ARKIT.includes(n)),
  ...VISEME_CHANNELS,
]);

export type TrackGenerator = 'audio2face-3d' | 'web-fallback' | 'manual';

export interface FaceTrackFile {
  format: typeof TRACK_FORMAT;
  version: typeof TRACK_VERSION;
  id: string;
  fps: number;
  frames: number;
  duration: number;
  channels: string[];
  data: string;
  emotions?: [number, Emotion, number][];
  source: {
    generator: TrackGenerator;
    model?: string;
    modelLicense?: string;
    audioSha256?: string;
    createdAt?: string;
  };
}

/** A decoded track, ready to sample. */
export interface FaceTrack {
  id: string;
  fps: number;
  frames: number;
  duration: number;
  channels: string[];
  /** frames × channels values in 0..1, frame-major. */
  values: Float32Array;
  emotions: [number, Emotion, number][];
  source: FaceTrackFile['source'];
}

export const LIMITS = { minFps: 10, maxFps: 120, maxSeconds: 600, maxChannels: 64 } as const;
const ID_RE = /^[a-z0-9][a-z0-9/_.-]{0,127}$/;

// ---------- base64 (no atob / Buffer: same result in browser, Node and workers) ----------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INV = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

/** Returns null on any invalid character or length. */
export function base64ToBytes(s: string): Uint8Array | null {
  if (typeof s !== 'string' || s.length % 4 !== 0) return null;
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((s.length / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    let n = 0;
    for (let j = 0; j < 4; j++) {
      const ch = s.charCodeAt(i + j);
      const isPad = ch === 61 && i + j >= s.length - pad;
      const v = isPad ? 0 : ch < 128 ? B64_INV[ch] : -1;
      if (v < 0) return null;
      n = (n << 6) | v;
    }
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

// ---------- validation ----------

export type ValidationResult = { ok: true; track: FaceTrack } | { ok: false; errors: string[] };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Full check of an untrusted track file; decodes it when valid. */
export function validateTrack(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errors: ['track must be an object'] };
  const t = input as Record<string, unknown>;
  if (t.format !== TRACK_FORMAT) errors.push(`format must be "${TRACK_FORMAT}"`);
  if (t.version !== TRACK_VERSION) errors.push(`version must be ${TRACK_VERSION}`);
  if (typeof t.id !== 'string' || !ID_RE.test(t.id)) errors.push('id must match ' + ID_RE.source);
  const fps = t.fps;
  if (!isNum(fps) || fps < LIMITS.minFps || fps > LIMITS.maxFps) errors.push(`fps must be ${LIMITS.minFps}..${LIMITS.maxFps}`);
  const frames = t.frames;
  if (!isNum(frames) || !Number.isInteger(frames) || frames < 1) errors.push('frames must be a positive integer');
  const duration = t.duration;
  if (!isNum(duration) || duration <= 0 || duration > LIMITS.maxSeconds) errors.push(`duration must be in (0, ${LIMITS.maxSeconds}]`);
  if (isNum(fps) && isNum(frames) && isNum(duration) && fps > 0 && Math.abs(frames / fps - duration) > 1 / fps + 1e-6) {
    errors.push('duration must equal frames / fps (± 1 frame)');
  }

  const ch = t.channels;
  if (!Array.isArray(ch) || ch.length === 0 || ch.length > LIMITS.maxChannels) {
    errors.push(`channels must be a list of 1..${LIMITS.maxChannels} names`);
  } else {
    const seen = new Set<string>();
    for (const c of ch) {
      if (typeof c !== 'string') {
        errors.push('channel names must be strings');
        continue;
      }
      if ((FORBIDDEN_ARKIT as readonly string[]).includes(c)) errors.push(`channel "${c}" is forbidden (sad / cross face)`);
      else if (!ALLOWED_CHANNELS.has(c)) errors.push(`unknown channel "${c}"`);
      if (seen.has(c)) errors.push(`duplicate channel "${c}"`);
      seen.add(c);
    }
  }

  let bytes: Uint8Array | null = null;
  if (typeof t.data !== 'string') errors.push('data must be a base64 string');
  else {
    bytes = base64ToBytes(t.data);
    if (!bytes) errors.push('data is not valid base64');
    else if (Array.isArray(ch) && isNum(frames) && bytes.length !== frames * ch.length) {
      errors.push(`data has ${bytes.length} bytes, expected frames × channels = ${frames * ch.length}`);
    }
  }

  const emotions: [number, Emotion, number][] = [];
  if (t.emotions !== undefined) {
    if (!Array.isArray(t.emotions)) errors.push('emotions must be a list');
    else {
      let last = -Infinity;
      for (const k of t.emotions) {
        if (!Array.isArray(k) || k.length !== 3 || !isNum(k[0]) || typeof k[1] !== 'string' || !isNum(k[2])) {
          errors.push('each emotion key must be [time, emotion, weight]');
          continue;
        }
        const [time, e, w] = k as [number, string, number];
        if (!(EMOTIONS as readonly string[]).includes(e)) errors.push(`emotion "${e}" is not allowed (only ${EMOTIONS.join(', ')})`);
        if (w < 0 || w > 1) errors.push('emotion weight must be 0..1');
        if (time < 0 || (isNum(duration) && time > duration + 1e-6)) errors.push('emotion time must be within the clip');
        if (time < last) errors.push('emotion keys must be sorted by time');
        last = time;
        emotions.push([time, e as Emotion, w]);
      }
    }
  }

  const src = t.source as Record<string, unknown> | undefined;
  if (!src || typeof src !== 'object') errors.push('source is required');
  else {
    const gens: TrackGenerator[] = ['audio2face-3d', 'web-fallback', 'manual'];
    if (!gens.includes(src.generator as TrackGenerator)) errors.push(`source.generator must be one of ${gens.join(', ')}`);
    if (src.generator === 'audio2face-3d') {
      if (typeof src.model !== 'string' || !src.model) errors.push('source.model is required for audio2face-3d tracks');
      if (typeof src.modelLicense !== 'string' || !src.modelLicense) errors.push('source.modelLicense is required for audio2face-3d tracks');
    }
    if (src.audioSha256 !== undefined && (typeof src.audioSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(src.audioSha256))) {
      errors.push('source.audioSha256 must be 64 lowercase hex characters');
    }
  }

  if (errors.length || !bytes) return { ok: false, errors: errors.length ? errors : ['invalid track'] };
  const values = new Float32Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) values[i] = bytes[i] / 255;
  return {
    ok: true,
    track: {
      id: t.id as string,
      fps: fps as number,
      frames: frames as number,
      duration: duration as number,
      channels: [...(ch as string[])],
      values,
      emotions,
      source: { ...(src as FaceTrackFile['source']) },
    },
  };
}

// ---------- encoding (used by bake scripts and tests) ----------

export interface EncodeInput {
  id: string;
  fps: number;
  channels: string[];
  /** One row per frame, one value (0..1) per channel. */
  rows: ArrayLike<number>[];
  emotions?: [number, Emotion, number][];
  source: FaceTrackFile['source'];
}

/** Quantise rows to a track file. Forbidden channels are dropped silently. */
export function encodeTrack(input: EncodeInput): FaceTrackFile {
  const keep = input.channels.map((c, i) => [c, i] as const).filter(([c]) => ALLOWED_CHANNELS.has(c));
  const frames = input.rows.length;
  const bytes = new Uint8Array(frames * keep.length);
  input.rows.forEach((row, f) => {
    keep.forEach(([, src], j) => {
      bytes[f * keep.length + j] = Math.round(clamp01(row[src] ?? 0) * 255);
    });
  });
  return {
    format: TRACK_FORMAT,
    version: TRACK_VERSION,
    id: input.id,
    fps: input.fps,
    frames,
    duration: Math.round((frames / input.fps) * 1000) / 1000,
    channels: keep.map(([c]) => c),
    data: bytesToBase64(bytes),
    ...(input.emotions?.length ? { emotions: input.emotions } : {}),
    source: input.source,
  };
}

// ---------- sampling ----------

/** Channel values at time t (seconds), linearly interpolated, clamped to the clip. */
export function sampleTrack(track: FaceTrack, t: number): Record<string, number> {
  const out: Record<string, number> = {};
  const n = track.channels.length;
  const pos = Math.max(0, Math.min(track.frames - 1, (Number.isFinite(t) ? t : 0) * track.fps));
  const i0 = Math.floor(pos);
  const i1 = Math.min(track.frames - 1, i0 + 1);
  const k = pos - i0;
  for (let c = 0; c < n; c++) {
    const a = track.values[i0 * n + c];
    const b = track.values[i1 * n + c];
    out[track.channels[c]] = clamp01(a + (b - a) * k);
  }
  return out;
}

/** Emotion keys at time t: the latest key at or before t, else none. */
export function emotionAt(track: FaceTrack, t: number): { emotion: Emotion; weight: number } | null {
  let best: [number, Emotion, number] | null = null;
  for (const k of track.emotions) if (k[0] <= t) best = k;
  return best ? { emotion: best[1], weight: best[2] } : null;
}
