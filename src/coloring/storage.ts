import type { Drawing, Sticker, Stroke, StrokeTool } from './types';

/**
 * Saved artworks stay on the device. This module holds the format (versioned,
 * compact, validated on the way back in) and an in-memory store with the same
 * interface as the IndexedDB one, used as a fallback and in tests.
 */

export const ART_VERSION = 1;

export type Artwork = {
  id: string;
  pageId: string;
  createdAt: number;
  updatedAt: number;
  drawing: Drawing;
  /** Small PNG data URL for the gallery. */
  thumb: string;
};

export type ArtworkMeta = Omit<Artwork, 'drawing'>;

export type SaveResult = { ok: true } | { ok: false; reason: 'quota' | 'unavailable' };

export interface ArtStore {
  list(): Promise<ArtworkMeta[]>;
  get(id: string): Promise<Artwork | null>;
  put(art: Artwork): Promise<SaveResult>;
  remove(id: string): Promise<void>;
}

const TOOLS: StrokeTool[] = ['brush', 'rainbow', 'glitter', 'eraser'];
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Compact JSON: coordinates rounded to 0.1 page unit. */
export function serializeArtwork(a: Artwork): string {
  return JSON.stringify({
    v: ART_VERSION,
    id: a.id,
    pageId: a.pageId,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    thumb: a.thumb,
    fills: a.drawing.fills,
    strokes: a.drawing.strokes.map((s) => [s.id, s.tool, s.color, r1(s.size), s.pts.map(r1)]),
    stickers: a.drawing.stickers.map((s) => [s.id, s.e, r1(s.x), r1(s.y), r1(s.s), Math.round(s.r)]),
  });
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Reads an artwork back; anything malformed gives null instead of crashing the gallery. */
export function parseArtwork(raw: unknown): Artwork | null {
  let o: unknown = raw;
  if (isStr(raw)) {
    try {
      o = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!o || typeof o !== 'object') return null;
  const x = o as Record<string, unknown>;
  if (x.v !== ART_VERSION || !isStr(x.id) || !isStr(x.pageId) || !isNum(x.createdAt) || !isNum(x.updatedAt)) return null;
  const fills: Record<string, string> = {};
  if (x.fills && typeof x.fills === 'object') {
    for (const [k, v] of Object.entries(x.fills as Record<string, unknown>)) if (isStr(v)) fills[k] = v;
  }
  const strokes: Stroke[] = [];
  if (Array.isArray(x.strokes)) {
    for (const s of x.strokes) {
      if (!Array.isArray(s) || s.length !== 5) continue;
      const [id, tool, color, size, pts] = s as unknown[];
      if (!isStr(id) || !TOOLS.includes(tool as StrokeTool) || !isStr(color) || !isNum(size) || !Array.isArray(pts)) continue;
      if (pts.length % 3 !== 0 || !pts.every(isNum)) continue;
      strokes.push({ id, tool: tool as StrokeTool, color, size, pts: pts as number[] });
    }
  }
  const stickers: Sticker[] = [];
  if (Array.isArray(x.stickers)) {
    for (const s of x.stickers) {
      if (!Array.isArray(s) || s.length !== 6) continue;
      const [id, e, sx, sy, ss, sr] = s as unknown[];
      if (!isStr(id) || !isStr(e) || !isNum(sx) || !isNum(sy) || !isNum(ss) || !isNum(sr)) continue;
      stickers.push({ id, e, x: sx, y: sy, s: ss, r: sr });
    }
  }
  return {
    id: x.id,
    pageId: x.pageId,
    createdAt: x.createdAt,
    updatedAt: x.updatedAt,
    thumb: isStr(x.thumb) ? x.thumb : '',
    drawing: { fills, strokes, stickers },
  };
}

export function newId(prefix = 'art', now = Date.now(), rand = Math.random): string {
  return `${prefix}-${now.toString(36)}-${Math.floor(rand() * 1e9).toString(36)}`;
}

/** True when the drawing has something worth saving. */
export const hasContent = (d: Drawing): boolean => Object.keys(d.fills).length > 0 || d.strokes.length > 0 || d.stickers.length > 0;

export function isQuotaError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const name = (e as { name?: unknown }).name;
  const code = (e as { code?: unknown }).code;
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014;
}

export const newestFirst = <T extends { updatedAt: number }>(a: T, b: T) => b.updatedAt - a.updatedAt;

/** In-memory store (same behaviour as the device store, with an optional size quota). */
export function createMemoryStore(quotaBytes = Infinity): ArtStore {
  const rows = new Map<string, string>();
  const size = () => [...rows.values()].reduce((n, s) => n + s.length, 0);
  return {
    async list() {
      return [...rows.values()]
        .map((s) => parseArtwork(s))
        .filter((a): a is Artwork => a !== null)
        .map(({ drawing: _drawing, ...meta }) => meta)
        .sort(newestFirst);
    },
    async get(id) {
      const s = rows.get(id);
      return s ? parseArtwork(s) : null;
    },
    async put(art) {
      const s = serializeArtwork(art);
      const before = rows.get(art.id)?.length ?? 0;
      if (size() - before + s.length > quotaBytes) return { ok: false, reason: 'quota' };
      rows.set(art.id, s);
      return { ok: true };
    },
    async remove(id) {
      rows.delete(id);
    },
  };
}
