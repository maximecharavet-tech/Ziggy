/**
 * Asset registry: lookups over the manifest (pure, safe to ship to the client).
 *
 *   import { assets } from '@/lib/assets/registry';
 *   const url = assets.url('lutins.ref.pepin');          // "/lutins/refs/pepin.png?v=1.0.0"
 *   const order = assets.loadOrder('lutins.ref.sheet');  // dependencies first
 *
 * Games never hard-code a public path: they ask the registry by id, so a new
 * version of a file (a re-render, a re-bake) busts caches by itself and the
 * licence/provenance of everything on screen stays known.
 */
import manifestJson from '@/data/assets/manifest.json';
import type { AssetEntry, AssetManifest, AssetType } from './types';

export class AssetRegistry {
  private byId = new Map<string, AssetEntry>();

  constructor(readonly manifest: AssetManifest) {
    for (const a of manifest.assets) {
      if (this.byId.has(a.id)) throw new Error(`Asset id "${a.id}" is declared twice`);
      this.byId.set(a.id, a);
    }
  }

  get size(): number {
    return this.byId.size;
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  /** The entry, or throws: a typo in an asset id should fail loudly in tests. */
  get(id: string): AssetEntry {
    const a = this.byId.get(id);
    if (!a) throw new Error(`Unknown asset "${id}"`);
    return a;
  }

  find(id: string): AssetEntry | undefined {
    return this.byId.get(id);
  }

  list(): AssetEntry[] {
    return [...this.byId.values()];
  }

  byType(type: AssetType): AssetEntry[] {
    return this.list().filter((a) => a.type === type);
  }

  byTag(tag: string): AssetEntry[] {
    return this.list().filter((a) => a.tags?.includes(tag));
  }

  /**
   * Public URL of a served file, with the version as a cache-buster
   * (`/lutins/refs/pepin.png?v=1.0.0`). Throws for code-built assets, which
   * have no URL (import their factory instead).
   */
  url(id: string, opts: { bust?: boolean } = {}): string {
    const a = this.get(id);
    if (a.location.kind !== 'public') throw new Error(`Asset "${id}" is built in code (${a.location.path}); it has no URL`);
    return opts.bust === false ? a.location.path : `${a.location.path}?v=${encodeURIComponent(a.version)}`;
  }

  /** Direct dependencies (entries). */
  dependencies(id: string): AssetEntry[] {
    return (this.get(id).dependencies ?? []).map((d) => this.get(d));
  }

  /**
   * Everything `id` needs, transitively, in load order (dependencies before
   * dependents), ending with `id` itself. Throws on a cycle.
   */
  loadOrder(id: string): AssetEntry[] {
    const out: AssetEntry[] = [];
    const state = new Map<string, 1 | 2>();
    const visit = (cur: string, path: string[]) => {
      const s = state.get(cur);
      if (s === 2) return;
      if (s === 1) throw new Error(`Asset dependency cycle: ${[...path, cur].join(' → ')}`);
      state.set(cur, 1);
      for (const d of this.get(cur).dependencies ?? []) visit(d, [...path, cur]);
      state.set(cur, 2);
      out.push(this.get(cur));
    };
    visit(id, []);
    return out;
  }

  /** Assets that depend on `id` directly (what to re-render when it changes). */
  dependents(id: string): AssetEntry[] {
    return this.list().filter((a) => a.dependencies?.includes(id));
  }
}

/** The project's registry, built from `src/data/assets/manifest.json`. */
export const assets = new AssetRegistry(manifestJson as AssetManifest);
