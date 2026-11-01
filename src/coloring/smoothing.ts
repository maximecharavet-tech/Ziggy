/**
 * Freehand stroke smoothing, written by hand.
 *
 * 1. Capture: points closer than `minDist` are skipped (finger jitter), and
 *    each kept point gets a width from the drawing speed: a slow, careful line
 *    is a little thicker, a quick swoosh a little thinner, like a felt pen.
 *    The width eases towards its target so it never jumps.
 * 2. Render: the line goes through the midpoints of consecutive points with
 *    quadratic curves whose control points are the captured points. That gives
 *    a smooth, continuous curve (C1) without overshoot.
 */

export type Seg = { x0: number; y0: number; cx: number; cy: number; x1: number; y1: number; w: number; dist: number };

const MIN_W = 0.55;
const MAX_W = 1.18;

/** Width factor for a speed in page units per millisecond. */
export function speedFactor(speed: number): number {
  const s = Math.max(0, Number.isFinite(speed) ? speed : 0);
  return Math.max(MIN_W, Math.min(MAX_W, 0.62 + 0.56 / (1 + s * 0.7)));
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export class StrokeCapture {
  readonly pts: number[] = [];
  private last: { x: number; y: number; t: number; w: number } | null = null;

  constructor(
    readonly base: number,
    readonly minDist = Math.max(1.5, base * 0.18)
  ) {}

  /** Adds a point; returns false when it was too close to the previous one. */
  add(x: number, y: number, t: number): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const prev = this.last;
    if (!prev) {
      const w = round1(this.base * MAX_W * 0.92);
      this.last = { x, y, t, w };
      this.pts.push(round1(x), round1(y), w);
      return true;
    }
    const d = Math.hypot(x - prev.x, y - prev.y);
    if (d < this.minDist) return false;
    const dt = Math.max(1, t - prev.t);
    const target = this.base * speedFactor(d / dt);
    const w = round1(prev.w + (target - prev.w) * 0.35);
    this.last = { x, y, t, w };
    this.pts.push(round1(x), round1(y), w);
    return true;
  }

  get count(): number {
    return this.pts.length / 3;
  }
}

/** Number of points in a flat x, y, w array. */
export const pointCount = (pts: number[]) => Math.floor(pts.length / 3);

/**
 * The quadratic segments of a stroke. Segment i (i ≥ 1) only depends on
 * points i-1, i, i+1, so while drawing, every segment but the last ("tail")
 * is final and can be painted once.
 */
export function segments(pts: number[]): Seg[] {
  const n = pointCount(pts);
  if (n === 0) return [];
  const X = (i: number) => pts[i * 3];
  const Y = (i: number) => pts[i * 3 + 1];
  const W = (i: number) => pts[i * 3 + 2];
  if (n === 1) return [{ x0: X(0), y0: Y(0), cx: X(0), cy: Y(0), x1: X(0), y1: Y(0), w: W(0), dist: 0 }];
  const out: Seg[] = [];
  let dist = 0;
  const pushSeg = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w: number) => {
    out.push({ x0, y0, cx, cy, x1, y1, w, dist });
    dist += Math.hypot(cx - x0, cy - y0) + Math.hypot(x1 - cx, y1 - cy);
  };
  if (n === 2) {
    pushSeg(X(0), Y(0), (X(0) + X(1)) / 2, (Y(0) + Y(1)) / 2, X(1), Y(1), (W(0) + W(1)) / 2);
    return out;
  }
  for (let i = 1; i < n - 1; i++) {
    const sx = i === 1 ? X(0) : (X(i - 1) + X(i)) / 2;
    const sy = i === 1 ? Y(0) : (Y(i - 1) + Y(i)) / 2;
    pushSeg(sx, sy, X(i), Y(i), (X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2, W(i));
  }
  // Tail: straight to the last point.
  const tx = (X(n - 2) + X(n - 1)) / 2;
  const ty = (Y(n - 2) + Y(n - 1)) / 2;
  pushSeg(tx, ty, (tx + X(n - 1)) / 2, (ty + Y(n - 1)) / 2, X(n - 1), Y(n - 1), W(n - 1));
  return out;
}

/** Total length of a stroke along its smoothed curve (approximate). */
export function strokeLength(pts: number[]): number {
  const segs = segments(pts);
  const last = segs[segs.length - 1];
  if (!last) return 0;
  return last.dist + Math.hypot(last.cx - last.x0, last.cy - last.y0) + Math.hypot(last.x1 - last.cx, last.y1 - last.cy);
}

/** Point on a quadratic segment at t ∈ [0, 1]. */
export function segPoint(s: Seg, t: number): { x: number; y: number } {
  const u = 1 - t;
  return { x: u * u * s.x0 + 2 * u * t * s.cx + t * t * s.x1, y: u * u * s.y0 + 2 * u * t * s.cy + t * t * s.y1 };
}

/** Small deterministic random numbers (glitter sparkles must not move on redraw). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
