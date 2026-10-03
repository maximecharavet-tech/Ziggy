import { describe, expect, it } from 'vitest';
import { toVector, predict, similarity, isTrainable, unbalanced, starsFor, GRID, type Example } from './knn';

const W = 120;
/** Draw a shape into an ink buffer, optionally shifted and scaled, like a child would. */
function draw(shape: 'circle' | 'cross' | 'bar', dx = 0, dy = 0, scale = 1): Float32Array {
  const ink = new Float32Array(W * W);
  const c = W / 2;
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const px = (x - c - dx) / scale;
      const py = (y - c - dy) / scale;
      let on = false;
      if (shape === 'circle') on = Math.abs(Math.hypot(px, py) - 30) < 4;
      if (shape === 'cross') on = (Math.abs(px - py) < 4 || Math.abs(px + py) < 4) && Math.abs(px) < 30;
      if (shape === 'bar') on = Math.abs(px) < 4 && Math.abs(py) < 32;
      if (on) ink[y * W + x] = 1;
    }
  }
  return ink;
}

const vec = (s: 'circle' | 'cross' | 'bar', dx = 0, dy = 0, scale = 1) => toVector(draw(s, dx, dy, scale), W, W)!;

describe('toVector', () => {
  it('returns null for an empty drawing', () => {
    expect(toVector(new Float32Array(W * W), W, W)).toBeNull();
  });

  it('sees the same shape wherever and however big it is drawn', () => {
    const a = vec('circle');
    const b = vec('circle', 25, -20, 0.6);
    expect(a).toHaveLength(GRID * GRID);
    expect(similarity(a, b)).toBeGreaterThan(0.9);
    expect(similarity(a, vec('cross'))).toBeLessThan(similarity(a, b));
  });
});

describe('predict', () => {
  const labels = ['circle', 'cross', 'bar'];
  const examples: Example[] = [
    ...[0, 10, -10].map((d, i) => ({ id: `c${i}`, label: 'circle', vector: vec('circle', d, d / 2, 1 - i * 0.1) })),
    ...[0, 12, -8].map((d, i) => ({ id: `x${i}`, label: 'cross', vector: vec('cross', d, -d, 1 - i * 0.12) })),
    ...[0, 6, -14].map((d, i) => ({ id: `b${i}`, label: 'bar', vector: vec('bar', d, d, 0.8 + i * 0.1) })),
  ];

  it('recognises new drawings it has never seen', () => {
    expect(predict(examples, vec('circle', -30, 20, 0.5), labels).best).toBe('circle');
    expect(predict(examples, vec('cross', 18, 5, 0.7), labels).best).toBe('cross');
    expect(predict(examples, vec('bar', -20, -5, 1.1), labels).best).toBe('bar');
  });

  it('gives probabilities that add up to 1 and shows its nearest examples', () => {
    const p = predict(examples, vec('circle', 5, 5, 0.9), labels);
    const sum = Object.values(p.scores).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
    expect(p.neighbours).toHaveLength(3);
    expect(p.neighbours[0].example.label).toBe('circle');
    expect(p.neighbours[0].similarity).toBeGreaterThanOrEqual(p.neighbours[1].similarity);
  });

  it('knows nothing without examples', () => {
    expect(predict([], vec('circle'), labels).best).toBeNull();
  });
});

describe('training helpers', () => {
  const ex = (label: string, n: number): Example[] =>
    Array.from({ length: n }, (_, i) => ({ id: `${label}${i}`, label, vector: vec('bar') }));

  it('needs examples of every kind before testing', () => {
    expect(isTrainable([...ex('a', 3), ...ex('b', 2)], ['a', 'b'])).toBe(false);
    expect(isTrainable([...ex('a', 3), ...ex('b', 3)], ['a', 'b'])).toBe(true);
  });

  it('spots an unbalanced set', () => {
    expect(unbalanced([...ex('a', 9), ...ex('b', 3)], ['a', 'b'])).toBe('b');
    expect(unbalanced([...ex('a', 4), ...ex('b', 3)], ['a', 'b'])).toBeNull();
  });

  it('turns accuracy into stars', () => {
    expect([starsFor(5, 5), starsFor(3, 5), starsFor(1, 5), starsFor(0, 0)]).toEqual([3, 2, 1, 0]);
  });
});
