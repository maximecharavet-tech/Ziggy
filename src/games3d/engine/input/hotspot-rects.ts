/**
 * Pure maths for the hotspot layer (no DOM, no three.js; unit tested):
 * project a 3D box to a screen rectangle, then lay the rectangles out as
 * tap targets: at least `minSize` px (64 by default), inside the viewport,
 * and never overlapping (pushed apart along the axis of least overlap).
 *
 * Matrices are column-major 4×4 arrays, the layout of three.js `Matrix4.elements`.
 */

export type Mat4 = ArrayLike<number>;
export type Vec3Tuple = readonly [number, number, number];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Viewport {
  w: number;
  h: number;
}

export const MIN_HOTSPOT_PX = 64;

/** out = a × b (column-major). */
export function multiplyMat4(a: Mat4, b: Mat4, out: Float64Array | number[] = new Float64Array(16)): Float64Array | number[] {
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  return out;
}

/**
 * A world point → screen pixels (y down). `null` when the point is behind
 * the camera. `depth` is NDC z (-1 near … 1 far).
 */
export function projectPoint(m: Mat4, x: number, y: number, z: number, vp: Viewport): { x: number; y: number; depth: number } | null {
  const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (cw <= 1e-6) return null;
  const cx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / cw;
  const cy = (m[1] * x + m[5] * y + m[9] * z + m[13]) / cw;
  const cz = (m[2] * x + m[6] * y + m[10] * z + m[14]) / cw;
  return { x: (cx + 1) * 0.5 * vp.w, y: (1 - cy) * 0.5 * vp.h, depth: cz };
}

/**
 * Screen rectangle of an axis-aligned world box (centre + half extents):
 * the bounding rect of its 8 projected corners. `null` when any corner is
 * behind the camera, when it lies beyond the far plane, or when it is fully
 * off screen (the button is then hidden, so the TV remote can't reach it).
 */
export function projectBox(m: Mat4, center: Vec3Tuple, half: Vec3Tuple, vp: Viewport): Rect | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let nearest = Infinity;
  for (let i = 0; i < 8; i++) {
    const p = projectPoint(m, center[0] + (i & 1 ? half[0] : -half[0]), center[1] + (i & 2 ? half[1] : -half[1]), center[2] + (i & 4 ? half[2] : -half[2]), vp);
    if (!p) return null;
    nearest = Math.min(nearest, p.depth);
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  if (nearest > 1) return null;
  if (x1 < 0 || y1 < 0 || x0 > vp.w || y0 > vp.h) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export interface LayoutItem {
  id: string;
  /** Projected rect, or null when not on screen. */
  rect: Rect | null;
}

export interface LaidOut {
  id: string;
  rect: Rect;
  visible: boolean;
}

export interface LayoutOptions {
  minSize?: number;
  /** Largest side (px); defaults to 45 % of the viewport's short side (a near object must not cover everything). */
  maxSize?: number;
  /** Gap kept between two targets (px); ≥ 2 so whole-pixel rounding in the DOM never makes them overlap. */
  gap?: number;
  iterations?: number;
}

const overlapX = (a: Rect, b: Rect) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
const overlapY = (a: Rect, b: Rect) => Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);

/** Do two rects overlap (touching edges don't count)? */
export function overlaps(a: Rect, b: Rect, slack = 0.01): boolean {
  return overlapX(a, b) > slack && overlapY(a, b) > slack;
}

function clampInto(r: Rect, vp: Viewport) {
  r.x = Math.max(0, Math.min(vp.w - r.w, r.x));
  r.y = Math.max(0, Math.min(vp.h - r.h, r.y));
}

/**
 * Tap targets from projected rects: grown to `minSize` around their centre,
 * capped at `maxSize`, kept inside the viewport and separated. Deterministic
 * (items are processed in the given order: the switch-scan order).
 */
export function layoutHotspots(items: readonly LayoutItem[], vp: Viewport, opts: LayoutOptions = {}): LaidOut[] {
  const min = Math.min(opts.minSize ?? MIN_HOTSPOT_PX, vp.w, vp.h);
  const max = Math.max(min, opts.maxSize ?? Math.min(vp.w, vp.h) * 0.45);
  const gap = opts.gap ?? 4;
  const iterations = opts.iterations ?? 32;
  const out: LaidOut[] = items.map(({ id, rect }) => {
    if (!rect) return { id, rect: { x: 0, y: 0, w: 0, h: 0 }, visible: false };
    const w = Math.min(max, Math.max(min, rect.w));
    const h = Math.min(max, Math.max(min, rect.h));
    const r = { x: rect.x + rect.w / 2 - w / 2, y: rect.y + rect.h / 2 - h / 2, w, h };
    clampInto(r, vp);
    return { id, rect: r, visible: true };
  });
  const vis = out.filter((o) => o.visible).map((o) => o.rect);
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < vis.length; i++)
      for (let j = i + 1; j < vis.length; j++) {
        const a = vis[i];
        const b = vis[j];
        const ox = overlapX(a, b);
        const oy = overlapY(a, b);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        // Push apart along the axis that needs the smaller move.
        if (ox <= oy) {
          const s = (ox + gap) / 2;
          const dir = a.x + a.w / 2 <= b.x + b.w / 2 ? 1 : -1;
          a.x -= dir * s;
          b.x += dir * s;
        } else {
          const s = (oy + gap) / 2;
          const dir = a.y + a.h / 2 <= b.y + b.h / 2 ? 1 : -1;
          a.y -= dir * s;
          b.y += dir * s;
        }
        clampInto(a, vp);
        clampInto(b, vp);
      }
    if (!moved) break;
  }
  return out;
}

/** Test/QA helper: every visible target is ≥ min px and no two overlap. */
export function checkLayout(laid: readonly LaidOut[], min = MIN_HOTSPOT_PX): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const vis = laid.filter((l) => l.visible);
  for (const l of vis) if (l.rect.w + 1e-6 < min || l.rect.h + 1e-6 < min) problems.push(`${l.id}: ${l.rect.w.toFixed(1)}×${l.rect.h.toFixed(1)} < ${min}`);
  for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) if (overlaps(vis[i].rect, vis[j].rect)) problems.push(`${vis[i].id} overlaps ${vis[j].id}`);
  return { ok: problems.length === 0, problems };
}
