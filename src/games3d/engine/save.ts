/**
 * Device-only, versioned game saves (never sent anywhere).
 *
 * - Key `ziggy:game:<gameId>:v<N>`, value `{ v: N, savedAt, data }` (small JSON, < 50 KB).
 * - Loading looks for the current version first, then older ones, migrates
 *   them step by step (`migrations[n]` turns v n into v n+1), writes the
 *   result under the current key and removes the old keys.
 * - Unreadable / invalid data → a fresh save and a console note: never a
 *   crash, never a scary message for the child.
 * - Every storage access is in try/catch; private mode, quota or a missing
 *   `localStorage` fall back to an in-memory store for the session.
 * - `saveSoon()` debounces writes (500 ms): saved after every change, so
 *   stopping anytime loses nothing.
 */

/** The bit of the Storage API we use (window.localStorage matches it). */
export interface KVStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStorage implements KVStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

/** localStorage when it works (probed), else a memory store. */
export function deviceStorage(): KVStorage {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return new MemoryStorage();
    const ls = window.localStorage;
    const probe = 'ziggy:game:__probe';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return new MemoryStorage();
  }
}

export type Migration = (old: unknown) => unknown;

export interface SaveOptions<T> {
  gameId: string;
  /** Current schema version (≥ 1). */
  version: number;
  /** A fresh save. */
  defaults: () => T;
  /** `migrations[n]` upgrades data of version n to n + 1. */
  migrations?: Record<number, Migration>;
  /** Shape check after loading/migrating; false → fresh save. */
  validate?: (data: unknown) => data is T;
  storage?: KVStorage;
  debounceMs?: number;
  /** Clock for `savedAt` (tests). */
  now?: () => number;
}

export interface SaveEnvelope<T> {
  v: number;
  savedAt: number;
  data: T;
}

export type LoadSource = 'current' | 'migrated' | 'fresh' | 'reset';

export const saveKey = (gameId: string, v: number) => `ziggy:game:${gameId}:v${v}`;

export class SaveStore<T> {
  private storage: KVStorage;
  private fallback: MemoryStorage | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: T | null = null;
  /** How the last `load()` went (tests, debugging). */
  lastSource: LoadSource = 'fresh';

  constructor(private opts: SaveOptions<T>) {
    if (!(opts.version >= 1)) throw new Error('save: version must be ≥ 1');
    this.storage = opts.storage ?? deviceStorage();
  }

  get key(): string {
    return saveKey(this.opts.gameId, this.opts.version);
  }

  /** The saved data, migrated to the current version, or a fresh save. Never throws. */
  load(): T {
    const { version } = this.opts;
    for (let v = version; v >= 1; v--) {
      const raw = this.read(saveKey(this.opts.gameId, v));
      if (raw === null) continue;
      const parsed = this.parse(raw, v);
      if (parsed === undefined) {
        this.note(`unreadable save v${v}, starting fresh`);
        this.lastSource = 'reset';
        return this.opts.defaults();
      }
      const migrated = this.migrate(parsed, v);
      if (migrated === undefined || (this.opts.validate && !this.opts.validate(migrated))) {
        this.note(`save v${v} could not be upgraded, starting fresh`);
        this.lastSource = 'reset';
        return this.opts.defaults();
      }
      if (v !== version) {
        this.write(migrated as T);
        for (let o = v; o < version; o++) this.del(saveKey(this.opts.gameId, o));
        this.lastSource = 'migrated';
      } else this.lastSource = 'current';
      return migrated as T;
    }
    this.lastSource = 'fresh';
    return this.opts.defaults();
  }

  /** Write now. Returns false when only the memory fallback could keep it. */
  save(data: T): boolean {
    this.cancelPending();
    return this.write(data);
  }

  /** Debounced save (default 500 ms); the latest data wins. */
  saveSoon(data: T): void {
    this.pending = data;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.opts.debounceMs ?? 500);
  }

  /** Write a pending debounced save now (on pagehide / dispose). */
  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.pending !== null) {
      const p = this.pending;
      this.pending = null;
      this.write(p);
    }
  }

  /** Forget the save (all versions). */
  clear(): void {
    this.cancelPending();
    for (let v = 1; v <= this.opts.version; v++) this.del(saveKey(this.opts.gameId, v));
  }

  private cancelPending() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }

  private parse(raw: string, v: number): unknown {
    try {
      const env = JSON.parse(raw) as Partial<SaveEnvelope<unknown>> | null;
      if (!env || typeof env !== 'object' || env.v !== v || !('data' in env)) return undefined;
      return env.data;
    } catch {
      return undefined;
    }
  }

  private migrate(data: unknown, from: number): unknown {
    let d = data;
    for (let v = from; v < this.opts.version; v++) {
      const m = this.opts.migrations?.[v];
      if (!m) return undefined;
      try {
        d = m(d);
      } catch {
        return undefined;
      }
      if (d === undefined) return undefined;
    }
    return d;
  }

  private write(data: T): boolean {
    const env: SaveEnvelope<T> = { v: this.opts.version, savedAt: (this.opts.now ?? Date.now)(), data };
    let json: string;
    try {
      json = JSON.stringify(env);
    } catch {
      this.note('save data is not serialisable');
      return false;
    }
    try {
      this.storage.setItem(this.key, json);
      return true;
    } catch {
      // Quota / private mode: keep it for this session.
      this.fallback ??= new MemoryStorage();
      this.fallback.setItem(this.key, json);
      return false;
    }
  }

  private read(key: string): string | null {
    try {
      const v = this.storage.getItem(key);
      if (v !== null) return v;
    } catch {
      /* fall through to the memory copy */
    }
    return this.fallback?.getItem(key) ?? null;
  }

  private del(key: string) {
    try {
      this.storage.removeItem(key);
    } catch {
      /* ignore */
    }
    this.fallback?.removeItem(key);
  }

  private note(msg: string) {
    console.info(`[save:${this.opts.gameId}] ${msg}`);
  }
}
