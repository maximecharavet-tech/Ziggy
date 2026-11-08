import 'server-only';
import { postJson, ProviderError } from './http';
import { agnesBase } from './agnes';

/**
 * Agnes video (image-to-video for Les Lutins Farceurs). Asynchronous:
 *   POST {base}/v1/videos { model, prompt, width, height, num_frames, frame_rate, <image field>: [url] }
 *     → { video_id | id }
 *   GET  {base}/agnesapi?video_id=… → { status, … video url somewhere }
 * (AgnesAI-Labs/AgnesAI-Models examples.) The image field for image-to-video is
 * not in the public examples: `AGNES_VIDEO_IMAGE_FIELD` (default `image`) and
 * `AGNES_VIDEO_MODEL` (default `agnes-video-v2.0`) make it adjustable without code.
 */

export const agnesVideoModel = () => process.env.AGNES_VIDEO_MODEL?.trim() || 'agnes-video-v2.0';
const imageField = () => process.env.AGNES_VIDEO_IMAGE_FIELD?.trim() || 'image';

export type VideoStatus = { state: 'pending' | 'done' | 'failed'; url: string | null };

export async function agnesVideoCreate(prompt: string, imageUrl: string, opts: { width?: number; height?: number; seconds?: number } = {}): Promise<string> {
  const key = process.env.AGNES_API_KEY;
  if (!key) throw new ProviderError('Agnes not configured', 0, 'not_configured');
  const fps = 24;
  const seconds = Math.min(8, Math.max(3, opts.seconds ?? 5));
  // Frame counts of 8k+1 are what LTX-style video models expect.
  const frames = Math.round((seconds * fps) / 8) * 8 + 1;
  const body = await postJson<Record<string, unknown>>({
    provider: 'agnes-video',
    url: `${agnesBase()}/v1/videos`,
    key,
    timeoutMs: 30_000,
    retries: 1,
    body: { model: agnesVideoModel(), prompt, width: opts.width ?? 768, height: opts.height ?? 1152, num_frames: frames, frame_rate: fps, [imageField()]: [imageUrl] },
  });
  const id = body.video_id ?? body.id ?? (body.data as Record<string, unknown> | undefined)?.video_id;
  if (typeof id !== 'string' && typeof id !== 'number') throw new ProviderError('Agnes video: no id', 502, 'bad_response');
  return String(id);
}

/** Finds the first http(s) URL that looks like a video anywhere in the answer. */
export function findVideoUrl(value: unknown, depth = 0): string | null {
  if (depth > 6 || value == null) return null;
  if (typeof value === 'string') return /^https?:\/\/\S+/.test(value) && /(\.mp4|\.webm|\.mov|video)/i.test(value) ? value : null;
  if (Array.isArray(value)) {
    for (const v of value) {
      const u = findVideoUrl(v, depth + 1);
      if (u) return u;
    }
    return null;
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    for (const k of ['video_url', 'url', 'output', 'result', 'video', 'data', 'outputs', 'videos']) {
      if (k in o) {
        const u = findVideoUrl(o[k], depth + 1);
        if (u) return u;
      }
    }
    for (const v of Object.values(o)) {
      const u = findVideoUrl(v, depth + 1);
      if (u) return u;
    }
  }
  return null;
}

export function readVideoStatus(body: unknown): VideoStatus {
  const o = (body ?? {}) as Record<string, unknown>;
  const raw = String(o.status ?? (o.data as Record<string, unknown> | undefined)?.status ?? '').toLowerCase();
  const url = findVideoUrl(body);
  if (['failed', 'error', 'cancelled', 'canceled'].includes(raw)) return { state: 'failed', url: null };
  if (['succeeded', 'success', 'completed', 'done', 'finished'].includes(raw) || (!raw && url)) return { state: url ? 'done' : 'pending', url };
  return { state: 'pending', url: null };
}

export async function agnesVideoPoll(id: string): Promise<VideoStatus> {
  const key = process.env.AGNES_API_KEY;
  if (!key) throw new ProviderError('Agnes not configured', 0, 'not_configured');
  const res = await fetch(`${agnesBase()}/agnesapi?video_id=${encodeURIComponent(id)}`, {
    headers: { authorization: `Bearer ${key}`, accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 404) return { state: 'failed', url: null };
  if (!res.ok) throw new ProviderError(`agnes-video: HTTP ${res.status}`, res.status, res.status === 429 ? 'rate_limited' : 'unavailable');
  return readVideoStatus(await res.json());
}
