/**
 * Photo booth — pure maths (no DOM, unit tested in layout.test.ts):
 * where the child's cut-out goes, how the user's drag / pinch adjusts it,
 * how a backdrop canvas maps onto the photo, and what each tier exports.
 */
import type { BoothSlot, SantaTier } from '@/lib/santa/types';

export type Rect = { x: number; y: number; w: number; h: number };
export type Size = { w: number; h: number };

/** The person in the cut-out: its size in cut-out pixels, and whether the photo cuts it at the bottom (a bust). */
export type PersonShape = { w: number; h: number; touchesBottom: boolean };

/** The user's adjustment, on top of the automatic placement. */
export type Adjust = { dx: number; dy: number; zoom: number };
export const NO_ADJUST: Adjust = { dx: 0, dy: 0, zoom: 1 };
export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 2.5;

/**
 * Where to draw the cut-out (in photo pixels) so the child stands in the slot.
 * - A whole body (feet in the photo): as big as fits the slot, feet on the slot's bottom edge.
 * - A bust (cut at the bottom, the usual selfie): its cut edge sits on the photo's bottom edge
 *   (hidden by the ribbon), the head near the slot's top, never wider than ~1.6 slot widths.
 * Horizontally centred on the slot, kept inside the photo.
 */
export function fitInSlot(person: PersonShape, slot: BoothSlot, frame: Size): Rect {
  if (person.w <= 0 || person.h <= 0 || slot.w <= 0 || slot.h <= 0) return { x: slot.x, y: slot.y, w: 0, h: 0 };
  let scale: number;
  let bottom: number;
  if (person.touchesBottom) {
    bottom = frame.h;
    const top = Math.max(0, Math.min(slot.y + slot.h * 0.04, frame.h * 0.75));
    scale = (bottom - top) / person.h;
    scale = Math.min(scale, (slot.w * 1.6) / person.w, (frame.w * 0.82) / person.w);
  } else {
    bottom = Math.min(frame.h, slot.y + slot.h);
    scale = Math.min((slot.w * 0.98) / person.w, slot.h / person.h);
  }
  const w = person.w * scale;
  const h = person.h * scale;
  let x = slot.x + slot.w / 2 - w / 2;
  x = w >= frame.w ? (frame.w - w) / 2 : Math.max(0, Math.min(frame.w - w, x));
  return { x, y: bottom - h, w, h };
}

/** Applies the user's adjustment: zoom around the bottom centre (the feet stay put), then move. */
export function applyAdjust(r: Rect, a: Adjust): Rect {
  const z = clamp(a.zoom, ZOOM_MIN, ZOOM_MAX);
  const w = r.w * z;
  const h = r.h * z;
  return { x: r.x + r.w / 2 - w / 2 + a.dx, y: r.y + r.h - h + a.dy, w, h };
}

/** Keeps an adjustment sensible: zoom in range, and at least a quarter of the child visible in the photo. */
export function clampAdjust(a: Adjust, base: Rect, frame: Size): Adjust {
  const zoom = clamp(Number.isFinite(a.zoom) ? a.zoom : 1, ZOOM_MIN, ZOOM_MAX);
  const r = applyAdjust(base, { dx: 0, dy: 0, zoom });
  const minX = -r.x - r.w * 0.75;
  const maxX = frame.w - r.x - r.w * 0.25;
  const minY = -r.y - r.h * 0.75;
  const maxY = frame.h - r.y - r.h * 0.25;
  return { zoom, dx: clamp(a.dx || 0, minX, maxX), dy: clamp(a.dy || 0, minY, maxY) };
}

/** "object-fit: cover" of a `src`-sized image into a `dst`-sized box. */
export type Cover = { scale: number; ox: number; oy: number };
export function coverTransform(src: Size, dst: Size): Cover {
  if (src.w <= 0 || src.h <= 0) return { scale: 1, ox: 0, oy: 0 };
  const scale = Math.max(dst.w / src.w, dst.h / src.h);
  return { scale, ox: (dst.w - src.w * scale) / 2, oy: (dst.h - src.h * scale) / 2 };
}

export function mapRect(r: Rect, t: Cover): Rect {
  return { x: r.x * t.scale + t.ox, y: r.y * t.scale + t.oy, w: r.w * t.scale, h: r.h * t.scale };
}

/** A slot that falls (partly) outside the backdrop canvas is clipped; an empty one becomes a sensible default (right half). */
export function sanitizeSlot(slot: BoothSlot | null | undefined, canvas: Size): BoothSlot {
  const fallback = { x: canvas.w * 0.5, y: canvas.h * 0.3, w: canvas.w * 0.42, h: canvas.h * 0.62 };
  if (!slot || ![slot.x, slot.y, slot.w, slot.h].every(Number.isFinite)) return fallback;
  const x0 = clamp(slot.x, 0, canvas.w);
  const y0 = clamp(slot.y, 0, canvas.h);
  const x1 = clamp(slot.x + slot.w, 0, canvas.w);
  const y1 = clamp(slot.y + slot.h, 0, canvas.h);
  if (x1 - x0 < canvas.w * 0.05 || y1 - y0 < canvas.h * 0.05) return fallback;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** What the booth exports for a tier: the free photo is medium size and watermarked; a pass gives HD, no watermark, and video. */
export type BoothOutput = { width: number; height: number; watermark: boolean; video: boolean };
/** Photos are 4:5 (Instagram portrait; TikTok shows them whole). */
export const PHOTO_ASPECT = 4 / 5;
export function boothOutput(tier: SantaTier | null | undefined): BoothOutput {
  const paid = tier === 'essentiel' || tier === 'magique';
  const width = paid ? 1600 : 800;
  return { width, height: Math.round(width / PHOTO_ASPECT), watermark: !paid, video: paid };
}

/** Video clips: 720 × 900, 6 s. */
export const VIDEO_SIZE: Size = { w: 720, h: 900 };
export const VIDEO_SECONDS = 6;

/** The Christmas the photo belongs to: a photo taken in January still says the previous Christmas. */
export function christmasYear(d: Date = new Date()): number {
  return d.getMonth() < 6 ? d.getFullYear() - 1 : d.getFullYear();
}

/** Two-finger gesture → new adjustment (pinch zooms, the midpoint moves). Distances/positions in photo pixels. */
export function pinchAdjust(start: Adjust, d0: number, d1: number, mid0: { x: number; y: number }, mid1: { x: number; y: number }): Adjust {
  const k = d0 > 1 ? d1 / d0 : 1;
  return { zoom: clamp(start.zoom * k, ZOOM_MIN, ZOOM_MAX), dx: start.dx + (mid1.x - mid0.x), dy: start.dy + (mid1.y - mid0.y) };
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
