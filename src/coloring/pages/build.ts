import type { ColoringPage, Detail, Region } from '../types';

type Meta = Omit<ColoringPage, 'regions' | 'details' | 'viewBox'> & { viewBox?: string };

/**
 * Draw a page in paint order: `r` adds a fillable region (later ones cover
 * earlier ones), `d` a decorative line on top of everything, and `deco` a line
 * that belongs to the last region (so later regions can cover it).
 * An id ending with '#' is numbered automatically (bauble-1, bauble-2…).
 */
export class PageBuilder {
  readonly regions: Region[] = [];
  readonly details: Detail[] = [];
  private counters = new Map<string, number>();

  r(id: string, d: string, c: string): this {
    let rid = id;
    if (id.endsWith('#')) {
      const base = id.slice(0, -1);
      const n = (this.counters.get(base) ?? 0) + 1;
      this.counters.set(base, n);
      rid = `${base}-${n}`;
    }
    this.regions.push({ id: rid, d, c });
    return this;
  }

  /** Decorative line on top of the page. */
  d(d: string, fill?: Detail['fill'], w?: number): this {
    this.details.push({ d, ...(fill ? { fill } : {}), ...(w ? { w } : {}) });
    return this;
  }

  /** Decorative line attached to the last region. */
  deco(d: string, fill?: Detail['fill'], w?: number): this {
    const last = this.regions[this.regions.length - 1];
    if (!last) return this.d(d, fill, w);
    (last.deco ??= []).push({ d, ...(fill ? { fill } : {}), ...(w ? { w } : {}) });
    return this;
  }
}

export function definePage(meta: Meta, draw: (b: PageBuilder) => void): ColoringPage {
  const b = new PageBuilder();
  draw(b);
  return { viewBox: '0 0 600 600', ...meta, regions: b.regions, details: b.details };
}
