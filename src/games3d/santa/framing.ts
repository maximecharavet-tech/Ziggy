/**
 * Pure camera / slot maths for the Santa scenes (no three.js, unit tested).
 */

export type Rect = { x: number; y: number; w: number; h: number };
export type Pt = { x: number; y: number };

/** Below this aspect ratio (width / height) a screen counts as portrait. */
export const PORTRAIT_BELOW = 0.95;

/**
 * Distance at which a perspective camera (vertical field of view `fovDeg`,
 * screen `aspect` = width / height) sees a `w` × `h` box face-on, whole.
 */
export function fitDistance(w: number, h: number, fovDeg: number, aspect: number): number {
  const t = Math.tan(((fovDeg * Math.PI) / 180) / 2);
  const a = Math.max(0.05, aspect);
  return Math.max(h / 2 / t, w / 2 / (t * a));
}

/** Smoothly goes from 0 (portrait, aspect ≤ lo) to 1 (wide, aspect ≥ hi). */
export function wideness(aspect: number, lo = 0.5, hi = 1.6): number {
  const k = Math.max(0, Math.min(1, (aspect - lo) / (hi - lo)));
  return k * k * (3 - 2 * k);
}

/**
 * Bounding rectangle, in pixels (origin top-left, y down), of points given in
 * normalised device coordinates (-1..1, y up), clamped to the canvas.
 */
export function ndcRect(points: Pt[], width: number, height: number): Rect {
  if (!points.length || width <= 0 || height <= 0) return { x: 0, y: 0, w: 0, h: 0 };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    const px = ((p.x + 1) / 2) * width;
    const py = ((1 - p.y) / 2) * height;
    x0 = Math.min(x0, px);
    x1 = Math.max(x1, px);
    y0 = Math.min(y0, py);
    y1 = Math.max(y1, py);
  }
  x0 = Math.max(0, Math.min(width, x0));
  x1 = Math.max(0, Math.min(width, x1));
  y0 = Math.max(0, Math.min(height, y0));
  y1 = Math.max(0, Math.min(height, y1));
  return { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
}

/**
 * Where a child stands next to Santa in a booth scene, in world units on the
 * floor plane: on the `side` of Santa (+1 = to the right of the picture),
 * `gap` away from his centre, as wide as `w` and as tall as `h`.
 */
export function slotBox(santaX: number, side: 1 | -1, gap: number, w: number, h: number): { x0: number; x1: number; y0: number; y1: number } {
  const near = santaX + side * gap;
  const far = near + side * w;
  return { x0: Math.min(near, far), x1: Math.max(near, far), y0: 0, y1: h };
}

/** Exponential smoothing factor for a rate (per second) over `dt` seconds. */
export function damp(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * Math.max(0, dt));
}

/** Mouth opening follows the voice: fast to open, a bit slower to close. */
export function followTalk(current: number, target: number, dt: number): number {
  const t = Math.max(0, Math.min(1, Number.isFinite(target) ? target : 0));
  const k = damp(t > current ? 28 : 14, dt);
  return current + (t - current) * k;
}
