'use client';

import { deviceId, journal, type JournalEntry } from './journal';

/**
 * Turns a prank picture into a short video: the AI video (Agnes image-to-video)
 * when it's available, otherwise a "magic card" made on the device by the Rust
 * engine (slow zoom, snow, sparkles). The video is stored with the entry.
 */

export type AnimateState = { phase: 'starting' | 'waiting' | 'downloading' | 'card' | 'done' | 'failed'; progress: number; reason?: string };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function aiVideo(entry: JournalEntry, onState: (s: AnimateState) => void, portrait: boolean): Promise<Blob | null> {
  if (!entry.sourceUrl || !entry.sourceSig) return null;
  onState({ phase: 'starting', progress: 0.05 });
  const res = await fetch('/api/lutins/video', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ device: deviceId(), sourceUrl: entry.sourceUrl, sig: entry.sourceSig, prankId: entry.prankId, portrait }),
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { error?: string };
    onState({ phase: 'failed', progress: 0, reason: e.error ?? 'failed' });
    return null;
  }
  const { id } = (await res.json()) as { id: string };
  const t0 = Date.now();
  // Short clips take one to three minutes; poll gently (the provider asks for low-frequency polling).
  while (Date.now() - t0 < 6 * 60_000) {
    await wait(7000);
    onState({ phase: 'waiting', progress: Math.min(0.9, 0.08 + (Date.now() - t0) / 200_000) });
    const st = (await fetch(`/api/lutins/video?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .catch(() => ({ state: 'pending' }))) as { state: string };
    if (st.state === 'failed') return null;
    if (st.state === 'done') {
      onState({ phase: 'downloading', progress: 0.95 });
      const file = await fetch(`/api/lutins/video?id=${encodeURIComponent(id)}&file=1`);
      return file.ok ? await file.blob() : null;
    }
  }
  return null;
}

/** On-device fallback: the Rust engine draws each frame, the browser records them. */
async function cardVideo(entry: JournalEntry, onState: (s: AnimateState) => void): Promise<Blob | null> {
  const [{ renderCard }, { recordCanvas, canRecordVideo }] = await Promise.all([import('./client-engine'), import('@/components/santa/booth/record')]);
  if (!canRecordVideo()) return null;
  onState({ phase: 'card', progress: 0.1 });
  const bmp = await createImageBitmap(entry.image);
  const max = 900;
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round((bmp.width * s) / 2) * 2;
  const h = Math.round((bmp.height * s) / 2) * 2;
  const base = document.createElement('canvas');
  base.width = w;
  base.height = h;
  base.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const draw = await renderCard(base, out);
  const clip = await recordCanvas(out, { seconds: 6, draw, fps: 24, onProgress: (p) => onState({ phase: 'card', progress: 0.1 + p * 0.85 }) });
  return clip.blob;
}

export async function animateEntry(entry: JournalEntry, onState: (s: AnimateState) => void): Promise<Blob | null> {
  const bmp = await createImageBitmap(entry.image);
  const portrait = bmp.height >= bmp.width;
  bmp.close();
  let blob = await aiVideo(entry, onState, portrait).catch(() => null);
  if (!blob) blob = await cardVideo(entry, onState).catch(() => null);
  if (!blob) {
    onState({ phase: 'failed', progress: 0 });
    return null;
  }
  await journal.patch(entry.id, { video: blob });
  onState({ phase: 'done', progress: 1 });
  return blob;
}
