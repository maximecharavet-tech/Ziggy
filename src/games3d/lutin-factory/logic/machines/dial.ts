/** Tiny strict parsers for machine dials (no dependency, JSON in → clean object out). */
import { COLORS, MATERIALS, PAINTS, PATTERNS, SHAPES, STICKERS } from '../types';
import type { Color, Item, ItemSpec, Material, Paint, Pattern, Shape, Sticker } from '../types';

export type Raw = Record<string, unknown>;

/** The raw dial as an object whose keys are all in `allowed`, else null. */
export function obj(raw: unknown, allowed: readonly string[]): Raw | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  for (const k of Object.keys(raw)) if (!allowed.includes(k)) return null;
  return raw as Raw;
}

export function oneOf<T extends string>(v: unknown, values: readonly T[]): T | null {
  return typeof v === 'string' && (values as readonly string[]).includes(v) ? (v as T) : null;
}

export function int(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;
}

export function listOf<T>(v: unknown, item: (x: unknown) => T | null, min: number, max: number): T[] | null {
  if (!Array.isArray(v) || v.length < min || v.length > max) return null;
  const out: T[] = [];
  for (const x of v) {
    const p = item(x);
    if (p === null) return null;
    out.push(p);
  }
  return out;
}

export const shape = (v: unknown): Shape | null => oneOf(v, SHAPES);
export const color = (v: unknown): Color | null => oneOf(v, COLORS);
export const paint = (v: unknown): Paint | null => oneOf(v, PAINTS);
export const pattern = (v: unknown): Pattern | null => oneOf(v, PATTERNS);
export const sticker = (v: unknown): Sticker | null => oneOf(v, STICKERS);
export const material = (v: unknown): Material | null => oneOf(v, MATERIALS);

export function itemSpec(v: unknown): ItemSpec | null {
  const o = obj(v, ['material', 'shape', 'color', 'sticker']);
  if (!o) return null;
  const out: ItemSpec = {};
  if (o.material !== undefined) {
    const m = material(o.material);
    if (!m) return null;
    out.material = m;
  }
  if (o.shape !== undefined) {
    const s = shape(o.shape);
    if (!s) return null;
    out.shape = s;
  }
  if (o.color !== undefined) {
    const c = color(o.color);
    if (!c) return null;
    out.color = c;
  }
  if (o.sticker !== undefined) {
    const s = sticker(o.sticker);
    if (!s) return null;
    out.sticker = s;
  }
  return out;
}

/**
 * A dial that is either one value (`color: "red"`) or a repeating cycle
 * (`colors: ["red", "blue"]`): the k-th item gets cycle[k % length].
 */
export function single<T>(o: Raw, one: string, many: string, item: (x: unknown) => T | null, maxCycle = 8): T[] | null {
  const hasOne = o[one] !== undefined;
  const hasMany = o[many] !== undefined;
  if (hasOne === hasMany) return null;
  if (hasOne) {
    const v = item(o[one]);
    return v === null ? null : [v];
  }
  return listOf(o[many], item, 1, maxCycle);
}

/** Paint an item (and the parts of an assembled toy) in place. */
export function paintItem(it: Item, c: Color): void {
  it.color = c;
  if (it.parts) for (const p of it.parts) p.color = c;
}

/** Colour of a set of parts if they all share one. */
export function commonColor(parts: Item[]): Color | undefined {
  const c = parts[0]?.color;
  return c && parts.every((p) => p.color === c) ? c : undefined;
}
