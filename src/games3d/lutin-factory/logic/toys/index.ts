/**
 * Toy recipes (data in src/data/games/lutin-factory/toys.json): a toy is a
 * list of parts (shape, optional material, count or the variable `n`). New
 * toys are only data. Single-part toys (a ball, a spinning top…) come straight
 * out of the shaper; the others are built by the assembler or the robot arm.
 */
import toysJson from '@/data/games/lutin-factory/toys.json';
import { MATERIALS, SHAPES, type Item, type L, type Material, type Shape } from '../types';

export interface ToyPart {
  role: string;
  shape?: Shape;
  material?: Material;
  count: number | 'n';
}

export interface ToyN {
  min: number;
  max: number;
  default: number;
  join: L;
  unit: { fr: [string, string]; en: [string, string] };
}

export interface ToyDef {
  id: string;
  emoji: string;
  gender: 'm' | 'f';
  name: L;
  plural: L;
  gift?: string;
  parts: ToyPart[];
  n?: ToyN;
}

const isL = (v: unknown): v is L =>
  !!v && typeof v === 'object' && typeof (v as L).fr === 'string' && typeof (v as L).en === 'string' && !!(v as L).fr && !!(v as L).en;

/** Schema check of toys.json; returns human-readable issues (empty = valid). */
export function validateToys(raw: unknown): string[] {
  const out: string[] = [];
  const data = raw as { schema?: unknown; toys?: unknown };
  if (!data || data.schema !== 'ziggy.factory-toys/1') out.push('toys.json: schema must be "ziggy.factory-toys/1"');
  if (!Array.isArray(data?.toys)) return [...out, 'toys.json: toys must be an array'];
  const seen = new Set<string>();
  for (const t of data.toys as Record<string, unknown>[]) {
    const id = String(t?.id);
    if (!/^[a-z][a-z-]*$/.test(id)) out.push(`toy "${id}": bad id`);
    if (seen.has(id)) out.push(`toy "${id}": duplicate id`);
    seen.add(id);
    for (const k of Object.keys(t)) {
      if (!['id', 'emoji', 'gender', 'name', 'plural', 'gift', 'parts', 'n'].includes(k)) out.push(`toy "${id}": unknown key "${k}"`);
    }
    if (typeof t.emoji !== 'string' || !t.emoji) out.push(`toy "${id}": emoji missing`);
    if (t.gender !== 'm' && t.gender !== 'f') out.push(`toy "${id}": gender must be m or f`);
    if (!isL(t.name) || !isL(t.plural)) out.push(`toy "${id}": name/plural need fr and en`);
    const parts = t.parts as ToyPart[] | undefined;
    if (!Array.isArray(parts) || parts.length === 0) {
      out.push(`toy "${id}": parts missing`);
      continue;
    }
    let usesN = false;
    for (const p of parts) {
      if (typeof p.role !== 'string' || !p.role) out.push(`toy "${id}": part without role`);
      if (p.shape !== undefined && !(SHAPES as readonly string[]).includes(p.shape)) out.push(`toy "${id}": unknown shape ${p.shape}`);
      if (p.material !== undefined && !(MATERIALS as readonly string[]).includes(p.material)) out.push(`toy "${id}": unknown material ${p.material}`);
      if (p.shape === undefined && p.material === undefined) out.push(`toy "${id}": part "${p.role}" needs a shape or a material`);
      if (p.count === 'n') usesN = true;
      else if (!Number.isInteger(p.count) || (p.count as number) < 1 || (p.count as number) > 12) out.push(`toy "${id}": bad count`);
    }
    const n = t.n as ToyN | undefined;
    if (usesN !== !!n) out.push(`toy "${id}": a part counted by "n" needs an "n" block (and only then)`);
    if (n) {
      if (!(Number.isInteger(n.min) && Number.isInteger(n.max) && n.min >= 1 && n.max >= n.min && n.default >= n.min && n.default <= n.max))
        out.push(`toy "${id}": bad n range`);
      if (!isL(n.join) || !Array.isArray(n.unit?.fr) || !Array.isArray(n.unit?.en) || n.unit.fr.length !== 2 || n.unit.en.length !== 2)
        out.push(`toy "${id}": n needs join and singular/plural units in fr and en`);
    }
  }
  return out;
}

const issues = validateToys(toysJson);
if (issues.length) throw new Error(`Invalid toys.json:\n${issues.join('\n')}`);

export const TOYS: readonly ToyDef[] = (toysJson as unknown as { toys: ToyDef[] }).toys;
const BY_ID = new Map(TOYS.map((t) => [t.id, t]));

export const getToy = (id: string): ToyDef | undefined => BY_ID.get(id);
export const isToyId = (id: unknown): id is string => typeof id === 'string' && BY_ID.has(id);

/** Parts needed for one toy, with `n` resolved. */
export function recipe(toy: ToyDef, n?: number): { role: string; shape?: Shape; material?: Material; count: number }[] {
  const nn = toy.n ? clampN(toy, n) : undefined;
  return toy.parts.map((p) => ({ role: p.role, shape: p.shape, material: p.material, count: p.count === 'n' ? (nn as number) : p.count }));
}

export function clampN(toy: ToyDef, n?: number): number {
  if (!toy.n) return 1;
  const v = n ?? toy.n.default;
  return Math.max(toy.n.min, Math.min(toy.n.max, v));
}

/** Does a loose item fit a recipe part? (assembled toys are never parts) */
export function fitsPart(item: Item, part: { shape?: Shape; material?: Material }): boolean {
  if (item.toy) return false;
  if (part.shape === undefined ? item.shape !== undefined : item.shape !== part.shape) return false;
  return part.material === undefined || item.material === part.material;
}

/**
 * What toy is this item? The assembler's / arm's stamp, else a single-part
 * toy made by the shaper (a ball, a spinning top, a drum…), else null (a
 * lump of material, a lone wheel: still a fine surprise!).
 */
export function identifyToy(item: Item): string | null {
  if (item.toy) return item.toy;
  if (!item.shape) return null;
  for (const t of TOYS) {
    if (t.parts.length === 1 && t.parts[0].count === 1 && fitsPart(item, t.parts[0])) return t.id;
  }
  return null;
}
