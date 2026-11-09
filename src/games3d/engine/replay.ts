import type { Action } from './input/actions';

/**
 * Deterministic replays. A session = seed + band + the list of
 * `(tick, action)`; the fixed-step loop and the seeded rng (kit/rng.ts,
 * mulberry32) make the final state hash reproducible. Golden replays run in
 * Vitest on the pure layer (no WebGL); a bug report can carry the replay
 * string (`encodeReplay`).
 *
 * Actions reach the simulation only at tick boundaries, through an
 * `ActionQueue`: the same inputs → the same ticks → the same state.
 */

export interface Replay<A = Action> {
  format: 'ziggy.replay/1';
  game: string;
  seed: number;
  band?: string;
  /** Total simulation ticks of the session. */
  ticks: number;
  /** `[tick, action]`, ticks non-decreasing. */
  actions: [number, A][];
}

/** A pure simulation the replay runner can drive. */
export interface Simulation<S, A = Action> {
  create(seed: number, band?: string): S;
  /** Apply one player action (between ticks). */
  apply(state: S, action: A): S | void;
  /** One fixed tick. */
  tick(state: S, tick: number): S | void;
}

/** Stable JSON: object keys sorted, so equal states give equal strings. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') {
    if (typeof v === 'number' && !Number.isFinite(v)) return 'null';
    return JSON.stringify(v) ?? 'null';
  }
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v instanceof Map) return stableStringify([...v.entries()]);
  if (v instanceof Set) return stableStringify([...v.values()]);
  if (ArrayBuffer.isView(v)) return stableStringify(Array.from(v as unknown as ArrayLike<number>));
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(',')}}`;
}

/** FNV-1a 32-bit hash of a state, as 8 hex digits. */
export function hashState(state: unknown): string {
  const s = stableStringify(state);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Stamps actions with the tick they are applied at; drained by fixedUpdate. */
export class ActionQueue<A = Action> {
  private q: A[] = [];
  private recorder: ReplayRecorder<A> | null = null;

  push(a: A): void {
    this.q.push(a);
  }

  /** Record every drained action into this recorder. */
  record(r: ReplayRecorder<A> | null): void {
    this.recorder = r;
  }

  /** Apply queued actions at `tick` (call at the start of fixedUpdate). */
  drain(tick: number, apply: (a: A) => void): number {
    if (!this.q.length) return 0;
    const list = this.q;
    this.q = [];
    for (const a of list) {
      this.recorder?.add(tick, a);
      apply(a);
    }
    return list.length;
  }

  get size(): number {
    return this.q.length;
  }

  /** Drop queued actions (pause). */
  clear(): void {
    this.q = [];
  }
}

export class ReplayRecorder<A = Action> {
  private actions: [number, A][] = [];
  private last = 0;

  constructor(
    private game: string,
    private seed: number,
    private band?: string
  ) {}

  add(tick: number, a: A): void {
    this.actions.push([tick, structuredCloneSafe(a)]);
    this.last = Math.max(this.last, tick);
  }

  /** The replay so far; `ticks` = the session length. */
  finish(ticks: number): Replay<A> {
    return { format: 'ziggy.replay/1', game: this.game, seed: this.seed, band: this.band, ticks: Math.max(ticks, this.last + 1), actions: this.actions.map(([t, a]) => [t, a]) };
  }
}

function structuredCloneSafe<A>(a: A): A {
  return a === null || typeof a !== 'object' ? a : (JSON.parse(JSON.stringify(a)) as A);
}

/**
 * Re-run a replay on a pure simulation. At each tick, the actions recorded
 * for that tick are applied first, then the tick runs (the order the
 * engine uses: `ActionQueue.drain` at the start of fixedUpdate).
 */
export function runReplay<S, A>(sim: Simulation<S, A>, replay: Replay<A>, onTick?: (state: S, tick: number) => void): S {
  let state = sim.create(replay.seed, replay.band);
  let i = 0;
  const acts = replay.actions;
  for (let t = 0; t < replay.ticks; t++) {
    while (i < acts.length && acts[i][0] === t) {
      const r = sim.apply(state, acts[i][1]);
      if (r !== undefined) state = r;
      i++;
    }
    const r = sim.tick(state, t);
    if (r !== undefined) state = r;
    onTick?.(state, t);
  }
  return state;
}

export function validateReplay(x: unknown): x is Replay<unknown> {
  if (!x || typeof x !== 'object') return false;
  const r = x as Replay<unknown>;
  if (r.format !== 'ziggy.replay/1' || typeof r.game !== 'string' || !Number.isInteger(r.seed) || !Number.isInteger(r.ticks) || r.ticks < 0) return false;
  if (!Array.isArray(r.actions)) return false;
  let prev = 0;
  for (const a of r.actions) {
    if (!Array.isArray(a) || a.length !== 2 || !Number.isInteger(a[0]) || a[0] < prev || a[0] >= r.ticks) return false;
    prev = a[0];
  }
  return true;
}

/** Compact string for bug reports (base64 of the JSON, URL-safe). */
export function encodeReplay(r: Replay<unknown>): string {
  const bytes = new TextEncoder().encode(JSON.stringify(r));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeReplay(s: string): Replay<unknown> | null {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const r = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return validateReplay(r) ? r : null;
  } catch {
    return null;
  }
}
