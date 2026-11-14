/**
 * Mode dodo — keep a story for tonight, without network.
 *
 * A parent taps « Garder pour ce soir »: the page asks the service worker
 * (public/sw.js) to download everything the story needs (Ziggy's recorded
 * voice and its timings, the sung versions, the pictures) into a cache that
 * stays on the device. Same-origin files only: nothing goes to a third party,
 * nothing costs anything. The URL list is pure so it can be tested.
 */
import type { DodoStory } from '@/data/dodo/types';
import { textLocale } from './player';
import { songVersions } from './song';
import { voiceBase, type DodoVoiceTiming } from './voice';

/** Cache name used by public/sw.js (not versioned: a new service worker keeps the stories). */
export const KEEP_CACHE = 'ziggy-dodo-stories';
/** The list of generated pictures per story (cached too, so the pictures show offline). */
export const DODO_ASSETS_URL = '/api/ziggy/dodo/assets';
/** Message type understood by public/sw.js. */
export const KEEP_MESSAGE = 'dodo-keep';

export type KeepMessage = { type: typeof KEEP_MESSAGE; story: string; urls: string[] };
export type KeepResult = { type: 'dodo-keep-done'; story: string; ok: number; failed: number };

/** Same-origin paths a story may ask to keep (mirrors `keepable` in public/sw.js). */
export function isKeepable(url: string): boolean {
  return (/^\/dodo\/[A-Za-z0-9._/-]+$/.test(url) && !url.includes('..')) || url === DODO_ASSETS_URL;
}

/**
 * Every file needed to tell this story offline, in the page's language, with
 * no duplicates: the recorded voice (timing.json + the segments, only when it
 * exists), each sung version (audio + timing), the cover and the pictures.
 */
export function storyOfflineUrls(
  story: DodoStory,
  locale: string,
  opts: { timing?: DodoVoiceTiming | null; images?: Iterable<string> } = {}
): string[] {
  const urls: string[] = [];
  const base = voiceBase(locale, story.id);
  if (opts.timing) {
    urls.push(`${base}/timing.json`);
    for (const seg of Object.values(opts.timing.segments)) urls.push(`${base}/${seg.file}`);
  }
  for (const v of songVersions(story, textLocale(locale))) {
    urls.push(v.url);
    if (v.timing) urls.push(v.timing);
  }
  if (story.cover) urls.push(story.cover);
  for (const img of opts.images ?? []) urls.push(img);
  urls.push(DODO_ASSETS_URL);
  return [...new Set(urls)].filter(isKeepable);
}

export function keepMessage(story: string, urls: string[]): KeepMessage {
  return { type: KEEP_MESSAGE, story, urls };
}

/** Browser: is every file of the story already in the device's cache? */
export async function isStoryKept(urls: string[]): Promise<boolean> {
  if (typeof caches === 'undefined' || urls.length === 0) return false;
  try {
    const cache = await caches.open(KEEP_CACHE);
    const hits = await Promise.all(urls.filter((u) => u !== DODO_ASSETS_URL).map((u) => cache.match(u)));
    return hits.length > 0 && hits.every(Boolean);
  } catch {
    return false;
  }
}

/** Browser: ask the service worker to keep the files; resolves with its report (null when there is no worker). */
export async function requestKeep(story: string, urls: string[]): Promise<KeepResult | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.ready;
  const worker = reg.active;
  if (!worker) return null;
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => resolve(null), 180_000);
    channel.port1.onmessage = (e: MessageEvent<KeepResult>) => {
      window.clearTimeout(timer);
      resolve(e.data);
    };
    worker.postMessage(keepMessage(story, urls), [channel.port2]);
  });
}
