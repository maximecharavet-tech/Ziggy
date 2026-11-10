'use client';

/**
 * Keeps the clips of a scheduled call on the device in advance (Cache Storage),
 * so the call rings and plays at its time even when the network is slow or the
 * voice service is busy (Christmas Eve). Only Santa's fixed clips are stored
 * (recorded files, or the voice service for those not recorded yet), plus the child's first name spoken alone — nothing else about the child.
 */
import { clipSources } from './audio';
import type { SantaLocale } from '@/data/santa/lines';

export const CALL_CACHE = 'ziggy-santa-calls-v1';

export function canPrecache(): boolean {
  return typeof caches !== 'undefined';
}

/** Fetches every clip not stored yet; resolves with how many are stored (0–keys.length). */
export async function precacheClips(keys: string[], locale: SantaLocale, onProgress?: (p: number) => void): Promise<number> {
  if (!canPrecache() || !keys.length) return 0;
  const cache = await caches.open(CALL_CACHE);
  let ok = 0;
  let done = 0;
  const queue = [...new Set(keys)];
  const total = queue.length;
  const worker = async () => {
    for (let k = queue.shift(); k; k = queue.shift()) {
      try {
        // The recorded file first, then the voice service (first names, clips not recorded yet).
        for (const url of clipSources(k, locale)) {
          if (await cache.match(url)) {
            ok++;
            break;
          }
          let res = await fetch(url);
          // Busy voice service: one more try a little later (there is time before the call).
          if (res.status === 502 || res.status === 429) {
            await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1500));
            res = await fetch(url);
          }
          if (res.ok) {
            await cache.put(url, res);
            ok++;
            break;
          }
        }
      } catch {
        /* not stored: the call will fetch it live */
      }
      onProgress?.(++done / total);
    }
  };
  await Promise.all([worker(), worker()]);
  return ok;
}

/** A stored clip, or null. */
export async function cachedClip(url: string): Promise<ArrayBuffer | null> {
  if (!canPrecache()) return null;
  try {
    const hit = await (await caches.open(CALL_CACHE)).match(url);
    return hit ? await hit.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** Parents' "erase everything". */
export async function clearPrecache() {
  if (canPrecache()) await caches.delete(CALL_CACHE).catch(() => false);
}
