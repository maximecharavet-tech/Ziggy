/**
 * Photo booth — the matte (pure, unit tested in matte.test.ts).
 *
 * MediaPipe gives a soft "person" confidence per pixel (0–1). A clean cut-out
 * needs a little more:
 *   1. keep the child (the biggest blobs), drop stray specks of background;
 *   2. tighten the soft ramp (smoothstep lo..hi): crisper hair, no grey veil;
 *   3. erode a pixel: the outermost ring is where the background's colour
 *      bleeds in (the "halo");
 *   4. feather: a small separable box blur (twice ≈ a tent filter) so the edge
 *      melts into the scene instead of looking scissor-cut.
 * Everything runs on the mask's own grid (≈ 256–512 px); the canvas then
 * scales the alpha up smoothly to the photo's resolution.
 */

export type MatteOptions = {
  /** Confidence at or below which a pixel is background. */
  lo?: number;
  /** Confidence at or above which a pixel is fully the child. */
  hi?: number;
  /** Erosion radius in mask pixels (0 = none). */
  erode?: number;
  /** Feather (box blur) radius in mask pixels (0 = none). */
  feather?: number;
  /** Blobs smaller than this share of the biggest one are dropped. */
  minBlob?: number;
};

export const DEFAULT_MATTE: Required<MatteOptions> = { lo: 0.3, hi: 0.72, erode: 1, feather: 1, minBlob: 0.12 };

export function refineMask(conf: Float32Array, w: number, h: number, opts: MatteOptions = {}): Float32Array {
  const o = { ...DEFAULT_MATTE, ...opts };
  if (conf.length !== w * h) throw new Error('mask size mismatch');
  let a = keepMainBlobs(conf, w, h, 0.5, o.minBlob);
  const span = Math.max(1e-3, o.hi - o.lo);
  for (let i = 0; i < a.length; i++) {
    const t = Math.min(1, Math.max(0, (a[i] - o.lo) / span));
    a[i] = t * t * (3 - 2 * t);
  }
  if (o.erode > 0) a = minFilter(a, w, h, o.erode);
  if (o.feather > 0) {
    a = boxBlur(a, w, h, o.feather);
    a = boxBlur(a, w, h, o.feather);
  }
  return a;
}

/**
 * Zeroes everything that is not part of a "big" connected blob (4-neighbour,
 * pixels above `thr`), plus a 3-pixel margin around kept blobs so their soft
 * edges survive. Returns a new array.
 */
export function keepMainBlobs(conf: Float32Array, w: number, h: number, thr = 0.5, minRatio = 0.12): Float32Array {
  const n = w * h;
  const label = new Int32Array(n).fill(-1);
  const sizes: number[] = [];
  const stack = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (label[s] !== -1 || conf[s] <= thr) continue;
    const id = sizes.length;
    let top = 0;
    let size = 0;
    stack[top++] = s;
    label[s] = id;
    while (top > 0) {
      const p = stack[--top];
      size++;
      const x = p % w;
      const y = (p - x) / w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q >= 0 && label[q] === -1 && conf[q] > thr) {
          label[q] = id;
          stack[top++] = q;
        }
      }
    }
    sizes.push(size);
  }
  const out = new Float32Array(conf);
  if (!sizes.length) return out;
  const biggest = Math.max(...sizes);
  const keepId = sizes.map((s) => s >= biggest * minRatio);
  if (keepId.every(Boolean)) return out;
  // Kept pixels, grown by 3 px (so soft edges below `thr` next to them stay).
  let keep: Float32Array = new Float32Array(n);
  for (let i = 0; i < n; i++) keep[i] = label[i] >= 0 && keepId[label[i]] ? 1 : 0;
  keep = maxFilter(keep, w, h, 3);
  for (let i = 0; i < n; i++) if (!keep[i]) out[i] = 0;
  return out;
}

/** Separable box blur with clamped edges. */
export function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r <= 0) return new Float32Array(src);
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const k = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += src[row + Math.min(w - 1, Math.max(0, i))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / k;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += tmp[Math.min(h - 1, Math.max(0, i)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / k;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

function rankFilter(src: Float32Array, w: number, h: number, r: number, pick: (a: number, b: number) => number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = src[y * w + x];
      for (let i = Math.max(0, x - r); i <= Math.min(w - 1, x + r); i++) v = pick(v, src[y * w + i]);
      tmp[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = tmp[y * w + x];
      for (let j = Math.max(0, y - r); j <= Math.min(h - 1, y + r); j++) v = pick(v, tmp[j * w + x]);
      out[y * w + x] = v;
    }
  }
  return out;
}

/** Erosion (square window of radius r). */
export const minFilter = (src: Float32Array, w: number, h: number, r: number) => rankFilter(src, w, h, r, Math.min);
/** Dilation (square window of radius r). */
export const maxFilter = (src: Float32Array, w: number, h: number, r: number) => rankFilter(src, w, h, r, Math.max);

/** Bounding box of the pixels above `thr`, and whether it touches the bottom edge (a bust). Null when empty. */
export function maskBox(a: Float32Array, w: number, h: number, thr = 0.5) {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  let count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (a[y * w + x] > thr) {
        count++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, touchesBottom: y1 >= h - 1 - Math.max(1, Math.round(h * 0.01)), coverage: count / (w * h) };
}

/** Share of the mask that is the child (mean alpha). */
export function coverage(a: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return a.length ? s / a.length : 0;
}

/** A soft oval (portrait medallion): the graceful fallback when there is no usable segmentation. */
export function ovalMask(w: number, h: number, softness = 0.08): Float32Array {
  const a = new Float32Array(w * h);
  const cx = w / 2;
  const cy = h * 0.52;
  const rx = w * 0.42;
  const ry = h * 0.47;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      const t = Math.min(1, Math.max(0, (1 - d) / softness));
      a[y * w + x] = t * t * (3 - 2 * t);
    }
  }
  return a;
}

/** White pixels carrying the alpha (RGBA bytes), ready for an ImageData mask. */
export function alphaToRGBA(a: Float32Array): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(a.length * 4);
  for (let i = 0; i < a.length; i++) {
    out[i * 4] = 255;
    out[i * 4 + 1] = 255;
    out[i * 4 + 2] = 255;
    out[i * 4 + 3] = Math.round(a[i] * 255);
  }
  return out;
}

/** The fast matte for the live preview: only the smoothstep (no blob search, no blur). */
export function quickMatte(conf: Float32Array, lo = 0.35, hi = 0.75): Float32Array {
  const out = new Float32Array(conf.length);
  const span = hi - lo;
  for (let i = 0; i < conf.length; i++) {
    const t = Math.min(1, Math.max(0, (conf[i] - lo) / span));
    out[i] = t * t * (3 - 2 * t);
  }
  return out;
}
