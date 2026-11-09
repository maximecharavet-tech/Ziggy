/** Seeded helpers over the kit's mulberry32 (`src/games3d/kit/rng.ts`). Pure. */
import { rng as mulberry } from '@/games3d/kit/rng';

export type Rng = () => number;

export const makeRng = (seed: number): Rng => mulberry(seed);

/** Integer in [min, max] (both included). */
export const int = (r: Rng, min: number, max: number): number => min + Math.floor(r() * (max - min + 1));

export function pick<T>(r: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick from an empty list');
  return items[Math.floor(r() * items.length) % items.length];
}

/** Fisher–Yates on a copy. */
export function shuffle<T>(r: Rng, items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** `n` distinct items. */
export const sample = <T>(r: Rng, items: readonly T[], n: number): T[] => shuffle(r, items).slice(0, n);

/** Stable 32-bit hash of a string (FNV-1a), to derive seeds from ids. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mix several numbers into one seed. */
export function mixSeed(...parts: (number | string)[]): number {
  let h = 0x9e3779b9;
  for (const p of parts) {
    const v = typeof p === 'string' ? hashString(p) : p >>> 0;
    h = Math.imul(h ^ v, 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
  }
  return h >>> 0;
}
