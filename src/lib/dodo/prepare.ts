import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DODO_STORIES, OUTRO_SCENE, outroText } from '@/data/dodo';
import type { DodoStory } from '@/data/dodo/types';
import { agnesImage, agnesReady } from '@/lib/hyper-engine/providers/agnes';
import { nvidiaImage, nvidiaImageReady } from '@/lib/hyper-engine/providers/nvidia-image';
import { fetchImage } from '@/lib/avatar/fetch-image';
import { synthesize } from '@/lib/tts-gemini';
import { logEvent, newRequestId } from '@/lib/analytics/log';

/**
 * Mode dodo pre-generation: every illustration and every narrated scene is
 * produced ONCE (by the owner, from the console) and stored in the public
 * `ziggy-dodo` bucket. Children then get instant, identical stories, with no
 * per-play AI cost and no personal data involved.
 */

export const DODO_BUCKET = 'ziggy-dodo';
export const ART_STYLE =
  "Soft dreamy watercolor and gouache children's bedtime picture-book illustration, rounded friendly characters, gentle glowing light, calm cozy atmosphere, delicate textures, wholesome and safe for young children, no text, no letters, no logos.";

export type AssetKind = 'image' | 'audio';
export type AssetKey = { story: string; scene: number; kind: AssetKind; locale: '-' | 'fr' | 'en' };
type Row = { story_id: string; scene: number; kind: AssetKind; locale: string; path: string };

/** Everything that should exist, for the given narration languages. */
export function plannedAssets(locales: ('fr' | 'en')[], kinds: AssetKind[] = ['image', 'audio']): AssetKey[] {
  const out: AssetKey[] = [];
  for (const s of DODO_STORIES) {
    if (kinds.includes('image')) s.scenes.forEach((_, i) => out.push({ story: s.id, scene: i + 1, kind: 'image', locale: '-' }));
    if (kinds.includes('audio'))
      for (const l of locales) {
        s.scenes.forEach((_, i) => out.push({ story: s.id, scene: i + 1, kind: 'audio', locale: l }));
        out.push({ story: s.id, scene: OUTRO_SCENE, kind: 'audio', locale: l });
      }
  }
  return out;
}

const keyOf = (k: { story: string; scene: number; kind: string; locale: string }) => `${k.story}|${k.scene}|${k.kind}|${k.locale}`;

export async function existingAssets(sb: SupabaseClient): Promise<Row[]> {
  const { data, error } = await sb.from('ziggy_dodo_assets').select('story_id, scene, kind, locale, path').limit(5000);
  if (error) throw new Error('manifest_unavailable');
  return (data ?? []) as Row[];
}

export function missing(planned: AssetKey[], rows: Row[]): AssetKey[] {
  const have = new Set(rows.map((r) => keyOf({ story: r.story_id, scene: r.scene, kind: r.kind, locale: r.locale })));
  return planned.filter((k) => !have.has(keyOf(k)));
}

export function providersReady() {
  return { image: nvidiaImageReady() || agnesReady(), imageProvider: nvidiaImageReady() ? 'nvidia' : agnesReady() ? 'agnes' : null, voice: Boolean(process.env.GEMINI_API_KEY) };
}

async function referenceDataUri(story: DodoStory, origin: string): Promise<string | undefined> {
  if (!story.reference) return undefined;
  try {
    const res = await fetch(new URL(story.reference, origin), { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return undefined;
    const type = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  } catch {
    return undefined;
  }
}

async function makeImage(story: DodoStory, scene: number, origin: string): Promise<{ bytes: Uint8Array; type: string; ext: string; provider: string }> {
  const s = story.scenes[scene - 1];
  const prompt = `${s.prompt}. ${ART_STYLE}`;
  const reference = await referenceDataUri(story, origin);
  // A fixed seed per story keeps the look consistent from scene to scene.
  const seed = [...story.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 1_000_000;
  let url: string;
  let provider: string;
  if (nvidiaImageReady()) {
    ({ url } = await nvidiaImage(prompt, { width: 1344, height: 768, seed, reference }));
    provider = 'nvidia';
  } else if (agnesReady()) {
    ({ url } = await agnesImage(prompt, { size: '1536x1024', reference }));
    provider = 'agnes';
  } else throw new Error('no_image_provider');
  const img = await fetchImage(url);
  if (!img) throw new Error('image_download_failed');
  return { ...img, provider };
}

async function makeAudio(story: DodoStory, scene: number, locale: 'fr' | 'en'): Promise<Uint8Array> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('no_voice_provider');
  const text = scene === OUTRO_SCENE ? outroText(story, locale) : story.scenes[scene - 1].text[locale];
  const wav = await synthesize(key, text, 'bedtime');
  if (!wav) throw new Error('voice_failed');
  return wav;
}

/** Generate up to `max` missing assets. Returns what was done and how much is left. */
export async function prepareSome(
  sb: SupabaseClient,
  opts: { locales: ('fr' | 'en')[]; kinds: AssetKind[]; max: number; origin: string; story?: string }
): Promise<{ done: AssetKey[]; failed: { key: AssetKey; error: string }[]; remaining: number }> {
  let todo = missing(plannedAssets(opts.locales, opts.kinds), await existingAssets(sb));
  if (opts.story) todo = todo.filter((k) => k.story === opts.story);
  const batch = todo.slice(0, opts.max);
  const done: AssetKey[] = [];
  const failed: { key: AssetKey; error: string }[] = [];
  for (const k of batch) {
    const story = DODO_STORIES.find((s) => s.id === k.story)!;
    const started = Date.now();
    const requestId = newRequestId();
    try {
      let bytes: Uint8Array;
      let type: string;
      let ext: string;
      let provider: string;
      if (k.kind === 'image') ({ bytes, type, ext, provider } = await makeImage(story, k.scene, opts.origin));
      else {
        bytes = await makeAudio(story, k.scene, k.locale as 'fr' | 'en');
        type = 'audio/wav';
        ext = 'wav';
        provider = 'gemini-tts';
      }
      const path = `${k.story}/${k.kind === 'image' ? `scene-${k.scene}` : `${k.locale}/scene-${k.scene}`}.${ext}`;
      const up = await sb.storage.from(DODO_BUCKET).upload(path, bytes, { contentType: type, upsert: true });
      if (up.error) throw new Error('storage_failed');
      const { error } = await sb.from('ziggy_dodo_assets').upsert({ story_id: k.story, scene: k.scene, kind: k.kind, locale: k.locale, path, provider });
      if (error) throw new Error('manifest_failed');
      done.push(k);
      logEvent({ kind: 'generation', operation: `dodo_${k.kind}`, status: 'COMPLETED', requestId, latencyMs: Date.now() - started, provider });
    } catch (e) {
      const error = e instanceof Error ? e.message.slice(0, 60) : 'error';
      failed.push({ key: k, error });
      logEvent({ kind: 'generation', operation: `dodo_${k.kind}`, status: 'FAILED', requestId, latencyMs: Date.now() - started, detail: error });
    }
  }
  return { done, failed, remaining: todo.length - done.length };
}
