/**
 * Lip sync: each recorded clip's mouth cues, precomputed offline with Rhubarb
 * Lip Sync (MIT, voice-engine/santa_visemes.py) into public/santa/visemes/<locale>.json.
 * A cue string is "X0 C6 B13 …": a Rhubarb mouth shape and its start in
 * centiseconds. Shapes (Preston Blair set): A closed (M B P), B slightly open
 * (most consonants), C open (E), D wide open (A), E rounded (O), F puckered
 * (U W), G teeth on lip (F V), H tongue (L), X rest.
 */
import { SANTA_VOICE } from '@/data/santa/voice-clips';
import type { SantaLocale } from '@/data/santa/lines';

export type Viseme = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'X';

/** How a shape moves Santa's mouth: jaw opening 0–1 and mouth width (1 = rest, < 1 rounded). */
export const VISEME_POSE: Record<Viseme, { open: number; wide: number }> = {
  A: { open: 0, wide: 1 },
  B: { open: 0.22, wide: 1.05 },
  C: { open: 0.5, wide: 1.12 },
  D: { open: 0.85, wide: 1.05 },
  E: { open: 0.55, wide: 0.82 },
  F: { open: 0.28, wide: 0.66 },
  G: { open: 0.14, wide: 1.02 },
  H: { open: 0.42, wide: 1 },
  X: { open: 0, wide: 1 },
};

const parsed = new Map<string, { t: number[]; v: Viseme[] }>();

function parse(cues: string) {
  let p = parsed.get(cues);
  if (!p) {
    p = { t: [], v: [] };
    for (const c of cues.split(' ')) {
      const v = c.charAt(0) as Viseme;
      const t = Number(c.slice(1)) / 100;
      if (v in VISEME_POSE && Number.isFinite(t)) {
        p.t.push(t);
        p.v.push(v);
      }
    }
    if (parsed.size > 400) parsed.clear();
    parsed.set(cues, p);
  }
  return p;
}

/** The mouth shape at `t` seconds into the clip. */
export function cuesAt(cues: string, t: number): Viseme {
  const { t: ts, v } = parse(cues);
  if (!ts.length || t < ts[0]) return 'X';
  let lo = 0;
  let hi = ts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ts[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return v[lo];
}

const cache = new Map<SantaLocale, Promise<Record<string, string> | null>>();

/** A locale's cues (about 60 kB, fetched once per call, cached by the browser). */
export function loadVisemes(locale: SantaLocale, fetcher: typeof fetch = fetch): Promise<Record<string, string> | null> {
  let p = cache.get(locale);
  if (!p) {
    p = fetcher(`/santa/visemes/${locale}.json?v=${encodeURIComponent(SANTA_VOICE.voice)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { voice?: string; clips?: Record<string, string> } | null) => (j?.voice === SANTA_VOICE.voice ? j.clips ?? null : null))
      .catch(() => {
        cache.delete(locale);
        return null;
      });
    cache.set(locale, p);
  }
  return p;
}
