/**
 * The AI Lab's brain: a real, tiny machine-learning model a child trains by
 * drawing examples — k nearest neighbours on a 16 × 16 picture of the drawing.
 *
 * Chosen because it can be explained honestly to a 7-year-old and shown
 * on screen: "Ziggy compares your drawing with every example you gave him and
 * listens to the ones that look the most alike." No network, no server: it
 * runs in the browser and nothing the child draws leaves the device.
 */

export const GRID = 16;

/** A drawing as Ziggy sees it: GRID × GRID values from 0 (paper) to 1 (ink). */
export type Vector = Float32Array;

export interface Example {
  id: string;
  label: string;
  vector: Vector;
}

export interface Neighbour {
  example: Example;
  /** 0..1, how alike the two drawings are. */
  similarity: number;
}

export interface Prediction {
  /** Label → probability, summing to 1. */
  scores: Record<string, number>;
  best: string | null;
  neighbours: Neighbour[];
}

/**
 * Turn the ink of a drawing (a grayscale or alpha channel, row by row) into
 * the picture Ziggy compares: crop to the ink, centre it in a square, shrink
 * to GRID × GRID by averaging, then soften a little so a stroke drawn one
 * pixel to the side still looks the same.
 */
export function toVector(ink: ArrayLike<number>, width: number, height: number, threshold = 0.1): Vector | null {
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (ink[y * width + x] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // nothing drawn

  // Square box around the ink, with a margin, so shape is kept and size does not matter.
  const side = Math.max(maxX - minX + 1, maxY - minY + 1) * 1.15;
  const cx = (minX + maxX + 1) / 2;
  const cy = (minY + maxY + 1) / 2;
  const x0 = cx - side / 2;
  const y0 = cy - side / 2;
  const cell = side / GRID;

  const out = new Float32Array(GRID * GRID);
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      let sum = 0;
      let n = 0;
      const sx0 = Math.floor(x0 + gx * cell);
      const sy0 = Math.floor(y0 + gy * cell);
      const sx1 = Math.max(sx0 + 1, Math.floor(x0 + (gx + 1) * cell));
      const sy1 = Math.max(sy0 + 1, Math.floor(y0 + (gy + 1) * cell));
      for (let y = sy0; y < sy1; y++) {
        for (let x = sx0; x < sx1; x++) {
          n++;
          if (x >= 0 && y >= 0 && x < width && y < height) sum += ink[y * width + x];
        }
      }
      out[gy * GRID + gx] = n ? sum / n : 0;
    }
  }
  return normalise(blur(out));
}

/** 3 × 3 soften. */
function blur(v: Vector): Vector {
  const out = new Float32Array(v.length);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      let s = 0;
      let w = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
          const k = dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1;
          s += v[ny * GRID + nx] * k;
          w += k;
        }
      }
      out[y * GRID + x] = s / w;
    }
  }
  return out;
}

/** Scale to the 0..1 range so a light and a heavy stroke compare fairly. */
function normalise(v: Vector): Vector {
  let max = 0;
  for (const x of v) if (x > max) max = x;
  if (max > 0) for (let i = 0; i < v.length; i++) v[i] /= max;
  return v;
}

/** Cosine similarity, 0..1 for non-negative pictures. */
export function similarity(a: Vector, b: Vector): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/**
 * Ask the model: the k most alike examples vote, each with a weight that
 * grows sharply with likeness, so one near-identical example counts more
 * than two vague ones.
 */
export function predict(examples: Example[], vector: Vector, labels: string[], k = 3): Prediction {
  const neighbours = examples
    .map((example) => ({ example, similarity: similarity(example.vector, vector) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, Math.min(k, examples.length));

  const raw: Record<string, number> = Object.fromEntries(labels.map((l) => [l, 0]));
  for (const n of neighbours) raw[n.example.label] = (raw[n.example.label] ?? 0) + Math.exp(12 * n.similarity);
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  const scores: Record<string, number> = Object.fromEntries(
    labels.map((l) => [l, total ? raw[l] / total : 1 / labels.length])
  );
  const best = neighbours.length ? labels.reduce((a, b) => (scores[b] > scores[a] ? b : a)) : null;
  return { scores, best, neighbours };
}

/** How many examples of each label; the lab nudges the child to balance them. */
export function countByLabel(examples: Example[], labels: string[]): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(labels.map((l) => [l, 0]));
  for (const e of examples) counts[e.label] = (counts[e.label] ?? 0) + 1;
  return counts;
}

/** Ready to test once every label has at least `min` examples. */
export function isTrainable(examples: Example[], labels: string[], min = 3): boolean {
  const c = countByLabel(examples, labels);
  return labels.every((l) => c[l] >= min);
}

/** A label with three times fewer examples than another: the lab explains why that matters. */
export function unbalanced(examples: Example[], labels: string[]): string | null {
  const c = countByLabel(examples, labels);
  const max = Math.max(...labels.map((l) => c[l]));
  return labels.find((l) => c[l] > 0 && max >= 3 * c[l]) ?? null;
}

/** Stars for a test session: how often Ziggy was right. */
export function starsFor(correct: number, total: number): number {
  if (total === 0) return 0;
  const rate = correct / total;
  return rate >= 0.8 ? 3 : rate >= 0.6 ? 2 : 1;
}
