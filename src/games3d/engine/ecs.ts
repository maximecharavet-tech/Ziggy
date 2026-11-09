/**
 * ECS-lite: our own tiny entity/component store (bitECS is MPL-2.0: forbidden;
 * no dependency). Pure data, no three.js: the simulation runs in Node tests.
 *
 * - Entities are increasing integers (never reused: replays stay stable).
 * - `defineComponent<T>(name)` gives a typed token; values live in a Map per
 *   component (rich data). `SoAStore` adds struct-of-arrays Float32Array
 *   columns for hot numeric data (hundreds of belt items).
 * - `world.query(A, B)` returns the entities having all of them, in creation
 *   order; results are cached and rebuilt only after a structural change.
 * - Systems run in a fixed order, in the `fixed` phase (rules) or the
 *   `update` phase (visuals).
 *
 * Three.js objects are attached through a `View` component in the runtime
 * layer only.
 */

export type Entity = number;

export interface Component<T> {
  readonly id: number;
  readonly name: string;
  /** Phantom field for typing. */
  readonly __type?: T;
}

let nextComponentId = 1;

export function defineComponent<T>(name: string): Component<T> {
  return { id: nextComponentId++, name };
}

/** Tag component: presence only. */
export type Tag = Component<true>;
export const defineTag = (name: string): Tag => defineComponent<true>(name);

export interface System {
  name: string;
  phase: 'fixed' | 'update';
  /** Lower runs first; equal orders run in registration order. */
  order?: number;
  run(world: World, dt: number, alpha: number): void;
}

export class World {
  private next = 1;
  private alive = new Set<Entity>();
  private stores = new Map<number, Map<Entity, unknown>>();
  private cache = new Map<string, { version: number; list: Entity[] }>();
  private version = 0;
  private systems: { s: System; seq: number }[] = [];
  private seq = 0;

  create(): Entity {
    const e = this.next++;
    this.alive.add(e);
    this.version++;
    return e;
  }

  /** Create an entity with components at once. */
  spawn(...parts: [Component<unknown>, unknown][]): Entity {
    const e = this.create();
    for (const [c, v] of parts) this.add(e, c, v);
    return e;
  }

  destroy(e: Entity): void {
    if (!this.alive.delete(e)) return;
    for (const s of this.stores.values()) s.delete(e);
    this.version++;
  }

  isAlive(e: Entity): boolean {
    return this.alive.has(e);
  }

  get count(): number {
    return this.alive.size;
  }

  add<T>(e: Entity, c: Component<T>, value: T): T {
    if (!this.alive.has(e)) throw new Error(`ecs: entity ${e} is not alive`);
    const s = this.store(c);
    if (!s.has(e)) this.version++;
    s.set(e, value);
    return value;
  }

  /** Replace a value (no structural change if it was already there). */
  set<T>(e: Entity, c: Component<T>, value: T): void {
    this.add(e, c, value);
  }

  get<T>(e: Entity, c: Component<T>): T | undefined {
    return this.stores.get(c.id)?.get(e) as T | undefined;
  }

  /** Like `get`, but throws when missing (a bug in a system). */
  req<T>(e: Entity, c: Component<T>): T {
    const s = this.stores.get(c.id);
    if (!s || !s.has(e)) throw new Error(`ecs: entity ${e} has no ${c.name}`);
    return s.get(e) as T;
  }

  has(e: Entity, c: Component<unknown>): boolean {
    return this.stores.get(c.id)?.has(e) ?? false;
  }

  remove(e: Entity, c: Component<unknown>): void {
    if (this.stores.get(c.id)?.delete(e)) this.version++;
  }

  /** Entities with all the given components, in creation order. Don't mutate the array. */
  query(...cs: Component<unknown>[]): readonly Entity[] {
    if (!cs.length) return [...this.alive].sort((a, b) => a - b);
    const key = cs
      .map((c) => c.id)
      .sort((a, b) => a - b)
      .join(',');
    const hit = this.cache.get(key);
    if (hit && hit.version === this.version) return hit.list;
    // Iterate the smallest store, check the others.
    const stores = cs.map((c) => this.store(c)).sort((a, b) => a.size - b.size);
    const list: Entity[] = [];
    for (const e of stores[0].keys()) if (stores.every((s) => s.has(e))) list.push(e);
    list.sort((a, b) => a - b);
    this.cache.set(key, { version: this.version, list });
    return list;
  }

  /** First entity with all the components (singletons like the grid). */
  first(...cs: Component<unknown>[]): Entity | undefined {
    return this.query(...cs)[0];
  }

  addSystem(s: System): () => void {
    const entry = { s, seq: this.seq++ };
    this.systems.push(entry);
    this.systems.sort((a, b) => (a.s.order ?? 0) - (b.s.order ?? 0) || a.seq - b.seq);
    return () => {
      const i = this.systems.indexOf(entry);
      if (i >= 0) this.systems.splice(i, 1);
    };
  }

  /** Run the `fixed` systems (call from the loop's fixedUpdate). */
  runFixed(step: number): void {
    for (const { s } of this.systems) if (s.phase === 'fixed') s.run(this, step, 0);
  }

  /** Run the `update` systems (call once per frame). */
  runUpdate(dt: number, alpha: number): void {
    for (const { s } of this.systems) if (s.phase === 'update') s.run(this, dt, alpha);
  }

  /** Drop every entity and component (systems stay). */
  clear(): void {
    this.alive.clear();
    this.stores.clear();
    this.cache.clear();
    this.version++;
  }

  private store(c: Component<unknown>): Map<Entity, unknown> {
    let s = this.stores.get(c.id);
    if (!s) {
      s = new Map();
      this.stores.set(c.id, s);
    }
    return s;
  }
}

/**
 * Struct-of-arrays numeric store for hot data, indexed by entity id
 * (`store.x[e]`). Grows by doubling; no allocation per frame.
 */
export class SoAStore<F extends string> {
  private cols: Record<F, Float32Array>;
  private cap: number;

  constructor(
    readonly fields: readonly F[],
    capacity = 256
  ) {
    this.cap = Math.max(1, capacity);
    this.cols = {} as Record<F, Float32Array>;
    for (const f of fields) this.cols[f] = new Float32Array(this.cap);
  }

  /** The column for a field (re-read after `ensure`, it may be a new array). */
  col(f: F): Float32Array {
    return this.cols[f];
  }

  get(e: Entity, f: F): number {
    return e < this.cap ? this.cols[f][e] : 0;
  }

  set(e: Entity, f: F, v: number): void {
    this.ensure(e);
    this.cols[f][e] = v;
  }

  /** Make room for entity id `e`. */
  ensure(e: Entity): void {
    if (e < this.cap) return;
    let cap = this.cap;
    while (cap <= e) cap *= 2;
    for (const f of this.fields) {
      const a = new Float32Array(cap);
      a.set(this.cols[f]);
      this.cols[f] = a;
    }
    this.cap = cap;
  }

  /** Zero an entity's row (on destroy). */
  clearRow(e: Entity): void {
    if (e >= this.cap) return;
    for (const f of this.fields) this.cols[f][e] = 0;
  }

  get capacity(): number {
    return this.cap;
  }
}
