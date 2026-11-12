/**
 * "La farce du soir": a deterministic draw from the catalogue, and the check
 * of a parent's own idea. The reference implementation is the Rust engine
 * (`rust/lutins-core/src/pranks.rs`, via `engine.planPranks` / `engine.checkIdea`);
 * this file is the same algorithm in TypeScript for when the WebAssembly is
 * not loaded yet (and for the tests, which check both give the same answers).
 * Pure functions: no clock, no randomness beyond the seed.
 */
import { PRANKS, prankById } from '@/data/lutins/pranks';
import gentle from '@/data/lutins/gentle.json';
import { cleanParentText } from './text';
import type { IdeaCheck, Plan, PlanRequest } from './types';

const B = (v: string) => BigInt(v);
const MASK = (B('1') << B('64')) - B('1');
const UNGENTLE = new Set<string>(gentle.words);

/** FNV-1a 32 of a string (UTF-8), as an unsigned number. */
export function fnv32(text: string): number {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(text)) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function fnv64(text: string): bigint {
  let h = B('0xcbf29ce484222325');
  for (const b of new TextEncoder().encode(text)) {
    h ^= BigInt(b);
    h = (h * B('0x100000001b3')) & MASK;
  }
  return h;
}

function mix64(x: bigint): bigint {
  let z = x & MASK;
  z = ((z ^ (z >> B('30'))) * B('0xbf58476d1ce4e5b9')) & MASK;
  z = ((z ^ (z >> B('27'))) * B('0x94d049bb133111eb')) & MASK;
  return z ^ (z >> B('31'));
}

const keyOf = (seed: number, night: number, id: string) => mix64(BigInt(seed >>> 0) ^ (BigInt(night + 1) << B('40')) ^ fnv64(id));

/** Seed of the prank of a given evening (local date) and "another idea" counter. */
export function tonightSeed(date: Date, nth = 0): number {
  const d = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return fnv32(`lutins-tonight|${d}|${nth}`);
}

/** Same rules as `pranks::plan` in Rust: see there. */
export function planTonight(req: PlanRequest): Plan {
  const place = req.place ?? null;
  if (place !== null && !PRANKS.some((p) => p.cat === place)) throw new Error(`unknown place ${place}`);
  const count = Math.min(31, Math.max(1, Math.floor(req.count ?? 1)));
  const noRepeat = Math.max(0, Math.floor(req.no_repeat ?? 14));
  const history = [...(req.recent ?? [])];
  const ids: string[] = [];
  let relaxed = false;
  for (let night = 0; night < count; night++) {
    const pool = PRANKS.filter((p) => place === null || p.cat === place);
    const recent = new Set(history.slice(0, Math.min(noRepeat, history.length)));
    const fresh = pool.filter((p) => !recent.has(p.id));
    const lastCat = (history[0] ? prankById(history[0])?.cat : null) ?? null;
    let chosen: string | undefined;
    if (fresh.length) {
      const varied = place === null ? fresh.filter((p) => p.cat !== lastCat) : [];
      const from = varied.length ? varied : fresh;
      let best = from[0];
      let bestKey = keyOf(req.seed, night, best.id);
      for (const p of from.slice(1)) {
        const k = keyOf(req.seed, night, p.id);
        if (k < bestKey) (best = p), (bestKey = k);
      }
      chosen = best.id;
    } else if (pool.length) {
      relaxed = true;
      const age = (id: string) => {
        const i = history.indexOf(id);
        return i < 0 ? Infinity : i;
      };
      chosen = [...pool].sort((a, b) => age(b.id) - age(a.id) || (keyOf(req.seed, night, a.id) < keyOf(req.seed, night, b.id) ? -1 : 1))[0].id;
    }
    if (!chosen) break;
    ids.push(chosen);
    history.unshift(chosen);
  }
  return { ids, relaxed };
}

/** Same rules as `pranks::check_idea` in Rust: cleaned text, "too short", ungentle words. */
export function checkIdeaFallback(raw: unknown): IdeaCheck {
  const text = cleanParentText(raw);
  const reasons: string[] = [];
  if ([...text].length < 3) reasons.push('too_short');
  for (const w of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    const r = `unsafe_word:${w}`;
    if (w && UNGENTLE.has(w) && !reasons.includes(r)) reasons.push(r);
  }
  return { text, ok: reasons.length === 0, reasons };
}
