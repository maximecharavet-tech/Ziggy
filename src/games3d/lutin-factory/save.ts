/**
 * Lutin Factory device save (engine `SaveStore`, key `ziggy:game:lutin-factory:v1`).
 * Pure (no three.js, no DOM at module level): the runtime writes it, the
 * React player only shows what the game reports. Nothing leaves the device.
 */
import { SaveStore, type KVStorage } from '@/games3d/engine/save';
import type { Band, Item, L, Layout } from './logic';

export interface CatalogueEntry {
  /** Stable key of the look (toy, colour, sticker, wrap, n…). */
  key: string;
  /** The toy itself (without its simulation id), for the picture. */
  item: Omit<Item, 'id'>;
  name: L;
  /** How many were made. */
  count: number;
  /** Made for a letter (true) or a surprise / free creation (false). */
  wished: boolean;
}

export interface FactorySave {
  /** levelId → bands completed. */
  done: Record<string, Band[]>;
  /** `${levelId}:${band}` → the child's last layout (design B5: always kept). */
  layouts: Record<string, Layout>;
  sandbox: Layout | null;
  catalogue: CatalogueEntry[];
  /** The surprise shelf, newest last. */
  shelf: Omit<Item, 'id'>[];
  /** Machines the child has met (sandbox tray). */
  met: string[];
  speed: 1 | 2;
}

export const SHELF_MAX = 18;
export const CATALOGUE_MAX = 200;

export const defaultSave = (): FactorySave => ({ done: {}, layouts: {}, sandbox: null, catalogue: [], shelf: [], met: [], speed: 1 });

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function isFactorySave(v: unknown): v is FactorySave {
  if (!isObj(v)) return false;
  return isObj(v.done) && isObj(v.layouts) && Array.isArray(v.catalogue) && Array.isArray(v.shelf) && Array.isArray(v.met) && (v.speed === 1 || v.speed === 2) && (v.sandbox === null || isObj(v.sandbox));
}

export function createFactorySave(storage?: KVStorage): SaveStore<FactorySave> {
  return new SaveStore<FactorySave>({ gameId: 'lutin-factory', version: 1, defaults: defaultSave, validate: isFactorySave, storage });
}
