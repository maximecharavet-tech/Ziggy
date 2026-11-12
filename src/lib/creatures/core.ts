/**
 * The TypeScript twin of `rust/creatures-core`: the same algorithms on the same
 * vocabulary (`src/data/creatures/parts.json`). It is the fallback when WebAssembly
 * is not available (and the reference the parity tests compare the wasm against).
 */
import parts from '@/data/creatures/parts.json';
import { rng } from '@/games3d/kit/rng';
import { cleanName, STARTER, type Creature } from '@/games3d/creatures/logic';

type Data = typeof parts;
const D: Data = parts;

export const ALL_FIELDS = ['body', 'head', 'legs', 'legStyle', 'arms', 'armStyle', 'wings', 'tail', 'eyes', 'eyeSize', 'mouth', 'top', 'hat', 'pattern', 'color', 'accent', 'size', 'nose', 'aura', 'pet'] as const;
type Field = (typeof ALL_FIELDS)[number];
const NUMERIC = new Set<string>(['legs', 'arms', 'eyes', 'size']);

type Bag = Record<string, string | number>;
const get = (c: Creature, f: string): string => String((c as unknown as Bag)[f]);
function set(c: Creature, f: string, v: string): void {
  (c as unknown as Bag)[f] = NUMERIC.has(f) ? Number.parseInt(v, 10) || 0 : v;
}

export function fullList(f: string): string[] {
  switch (f) {
    case 'legs':
      return D.legCounts.map(String);
    case 'arms':
      return D.armCounts.map(String);
    case 'eyes':
      return D.eyeCounts.map(String);
    case 'size':
      return D.sizes.map(String);
    case 'accent':
      return [...D.parts.color];
    default:
      return [...((D.parts as Record<string, string[]>)[f] ?? [])];
  }
}

const pool = (f: string): string[] => {
  const p = (D.surprise.pools as Record<string, (string | number)[]>)[f];
  return p ? p.map(String) : fullList(f);
};
const pickOf = <T>(r: () => number, l: readonly T[]): T => l[Math.floor(r() * l.length) % l.length];

export function makeName(seed: number): string {
  const n = D.names;
  const r = rng(seed * 7 + 3);
  const a = pickOf(r, n.n1) + pickOf(r, n.n2);
  const b = pickOf(r, n.m1) + pickOf(r, n.m2) + pickOf(r, n.m3);
  return `${a}-${b}`;
}

export function randomCreature(seed: number): Creature {
  const r = rng(seed);
  const colors = D.parts.color;
  const ci = Math.floor(r() * colors.length) % colors.length;
  let ai = Math.floor(r() * colors.length) % colors.length;
  if (ai === ci) ai = (ci + 3) % colors.length;
  const c: Creature = { ...STARTER };
  c.color = colors[ci] as Creature['color'];
  c.accent = colors[ai] as Creature['accent'];
  c.name = makeName(Math.floor(r() * 1e9));
  for (const f of D.surprise.order) set(c, f, pickOf(r, pool(f)));
  return c;
}

/** Two parents, one child: every part comes from one of them, now and then a surprise. */
export function cross(a: Creature, b: Creature, seed: number): Creature {
  const r = rng(seed);
  const c: Creature = { ...a, id: '' };
  for (const f of ALL_FIELDS) {
    const coin = r();
    const mutate = r();
    let v = coin < 0.5 ? get(a, f) : get(b, f);
    if (mutate < 0.07) v = pickOf(r, fullList(f));
    set(c, f, v);
  }
  if (c.accent === c.color) {
    const colors = D.parts.color;
    const i = Math.max(0, colors.indexOf(c.color));
    c.accent = colors[(i + 3) % colors.length] as Creature['accent'];
  }
  c.name = makeName(Math.floor(r() * 1e9));
  return c;
}

export function comboCount(): number {
  return ALL_FIELDS.reduce((n, f) => n * fullList(f).length, 1);
}

export type PowerId = 'bounce' | 'fly' | 'swim' | 'sparkle' | 'dance' | 'camo' | 'laugh' | 'rainbow' | 'roll' | 'float' | 'zap' | 'hearts' | 'music';

export function powersOf(c: Creature): PowerId[] {
  const out = D.powers.filter((rule) => (rule.any as [string, string | number][]).some(([f, v]) => get(c, f) === String(v))).map((rule) => rule.id as PowerId);
  return out.length ? out : ['dance'];
}

export type SillyEvent = 'confetti' | 'flash' | 'wonky' | 'sneeze' | 'hiccup' | 'applause' | 'surprised' | 'bubbles';

export function sillyEvent(seed: number): SillyEvent {
  const total = D.events.reduce((n, e) => n + e.w, 0);
  let x = Math.floor(rng(seed)() * total);
  for (const e of D.events) {
    if (x < e.w) return e.id as SillyEvent;
    x -= e.w;
  }
  return D.events[0].id as SillyEvent;
}

/** `[lift, squash, roll, yaw, pitch]` for a little reaction or power animation at progress `p`. */
export function pose(kind: string, p0: number): [number, number, number, number, number] {
  const p = Math.max(0, Math.min(1, p0));
  const env = (x: number) => Math.sin(Math.max(0, Math.min(1, x)) * Math.PI);
  const smooth = (x: number) => {
    const t = Math.max(0, Math.min(1, x));
    return t * t * (3 - 2 * t);
  };
  const e = env(p);
  const PI = Math.PI;
  switch (kind) {
    case 'bounce': {
      const ph = (p * 3) % 1;
      const up = Math.sin(ph * PI);
      return [up * 0.5 * (1 - 0.25 * p), ph < 0.12 || ph > 0.9 ? -0.2 : 0.08 * up, 0, 0, 0];
    }
    case 'float':
      return [Math.pow(env(p), 0.6) * 0.7, 0.04 * Math.sin(p * 12) * e, Math.sin(p * 9) * 0.06 * e, 0, 0];
    case 'roll':
      return [Math.sin(p * PI) * 0.28, -0.12 * e, 0, 0, smooth(p) * PI * 2];
    case 'stretch':
      return [0, 0.38 * e, Math.sin(p * 14) * 0.05 * e, 0, 0];
    case 'dance':
      return [Math.abs(Math.sin(p * PI * 8)) * 0.12 * e, Math.cos(p * PI * 8) * 0.06 * e, Math.sin(p * PI * 8) * 0.18 * e, Math.sin(p * PI * 4) * 0.5 * e, 0];
    case 'surprised': {
      const a = smooth(p * 4);
      return [Math.sin(a * PI) * 0.3 * (1 - p), 0.22 * a * (1 - p), 0, 0, -0.3 * a * (1 - smooth((p - 0.4) * 2))];
    }
    case 'clap':
      return [0, -0.05 * Math.abs(Math.sin(p * PI * 10)) * e, 0, 0, 0];
    case 'giggle':
      return [Math.abs(Math.sin(p * PI * 7)) * 0.06 * e, -0.05 * Math.abs(Math.sin(p * PI * 14)) * e, Math.sin(p * PI * 14) * 0.07 * e, 0, 0];
    case 'zap':
      return [0, 0, Math.sin(p * 60) * 0.06 * e, Math.sin(p * 47) * 0.08 * e, 0];
    case 'camo':
      return [0, -0.03 * e, 0, 0, 0];
    case 'dizzy':
      return [0, 0, Math.sin(p * PI * 6) * 0.15 * (1 - p), p * PI * 2, 0];
    default:
      return [0, 0, 0, 0, 0];
  }
}

/* ───────── Share code ("ZC2-XXXXX-…") ───────── */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const VERSION = 2;

function fnv16(bytes: number[]): number {
  let h = 0x811c9dc5;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ((h >>> 16) ^ (h & 0xffff)) & 0xffff;
}

export function encodeCode(c: Creature): string {
  const bytes: number[] = [VERSION];
  for (const f of ALL_FIELDS) bytes.push(Math.max(0, fullList(f).indexOf(get(c, f))));
  const nb = [...new TextEncoder().encode(cleanName(c.name))];
  bytes.push(nb.length, ...nb);
  const sum = fnv16(bytes);
  bytes.push(sum >> 8, sum & 255);
  let out = '';
  let acc = 0;
  let bits = 0;
  for (const b of bytes) {
    acc = ((acc << 8) | b) >>> 0;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(acc >>> bits) & 31];
    }
    acc &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(acc << (5 - bits)) & 31];
  return `ZC2-${(out.match(/.{1,5}/g) ?? []).join('-')}`;
}

export function decodeCode(code: string): Creature | null {
  let s = code.trim().toUpperCase();
  if (s.startsWith('ZC2')) s = s.slice(3);
  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;
  for (let ch of s) {
    if (ch === '-' || /\s/.test(ch)) continue;
    ch = ch === 'O' ? '0' : ch === 'I' || ch === 'L' ? '1' : ch === 'U' ? 'V' : ch;
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    acc = ((acc << 5) | v) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >>> bits) & 255);
    }
    if (bytes.length > 120) return null;
  }
  const n = ALL_FIELDS.length;
  if (bytes.length < n + 4 || bytes[0] !== VERSION) return null;
  const nameLen = bytes[n + 1];
  const end = n + 2 + nameLen;
  if (bytes.length < end + 2) return null;
  if (fnv16(bytes.slice(0, end)) !== ((bytes[end] << 8) | bytes[end + 1])) return null;
  const c: Creature = { ...STARTER };
  for (let i = 0; i < n; i++) {
    const v = fullList(ALL_FIELDS[i])[bytes[i + 1]];
    if (v === undefined) return null;
    set(c, ALL_FIELDS[i], v);
  }
  let name = '';
  try {
    name = cleanName(new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes.slice(n + 2, end))));
  } catch {
    return null;
  }
  if (name) c.name = name;
  c.id = '';
  return c;
}

export type { Field };
