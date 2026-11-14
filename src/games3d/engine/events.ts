import type { L } from '@/lib/i18n-text';
import type { LearningSkill } from '@/lib/learning/skills';

/**
 * Typed message bus between a game and its React player.
 *
 * - `Emitter<Map>`: a synchronous, ordered emitter keyed by event name.
 *   Events emitted *while* another event is being delivered are queued and
 *   delivered after it (FIFO), so every listener sees the same order.
 * - `GameBus<Evt, Cmd>`: game → React events + React → game commands.
 * - `BaseGameEvents<Hud>`: the events every Ziggy game shares (HUD state,
 *   read-aloud requests, reactions, results). Games extend it.
 *
 * React never touches three.js objects; the game never touches the React tree.
 */

export type EventMap = Record<string, unknown>;
export type Listener<T> = (payload: T) => void;

export class Emitter<E extends EventMap> {
  private listeners = new Map<keyof E, Listener<never>[]>();
  private any: ((name: keyof E, payload: E[keyof E]) => void)[] = [];
  private queue: { name: keyof E; payload: unknown }[] = [];
  private delivering = false;

  /** Subscribe; returns the unsubscribe function. */
  on<K extends keyof E>(name: K, fn: Listener<E[K]>): () => void {
    const list = this.listeners.get(name) ?? [];
    list.push(fn as Listener<never>);
    this.listeners.set(name, list);
    return () => this.off(name, fn);
  }

  /** Subscribe for a single delivery. */
  once<K extends keyof E>(name: K, fn: Listener<E[K]>): () => void {
    const off = this.on(name, (p) => {
      off();
      fn(p);
    });
    return off;
  }

  /** Every event, after its own listeners (React wrappers, debug logs). */
  onAny(fn: (name: keyof E, payload: E[keyof E]) => void): () => void {
    this.any.push(fn);
    return () => {
      const i = this.any.indexOf(fn);
      if (i >= 0) this.any.splice(i, 1);
    };
  }

  off<K extends keyof E>(name: K, fn: Listener<E[K]>): void {
    const list = this.listeners.get(name);
    if (!list) return;
    const i = list.indexOf(fn as Listener<never>);
    if (i >= 0) list.splice(i, 1);
  }

  /** Deliver to every listener, in subscription order. Re-entrant emits are queued (FIFO). */
  emit<K extends keyof E>(name: K, ...args: E[K] extends void | undefined ? [payload?: E[K]] : [payload: E[K]]): void {
    this.queue.push({ name, payload: args[0] });
    if (this.delivering) return;
    this.delivering = true;
    try {
      while (this.queue.length) {
        const ev = this.queue.shift()!;
        // Copy: a listener may unsubscribe (once) during delivery.
        const list: ((p: unknown) => void)[] = [...((this.listeners.get(ev.name) ?? []) as ((p: unknown) => void)[]), ...this.any.map((fn) => (p: unknown) => fn(ev.name, p as E[keyof E]))];
        for (const fn of list) {
          try {
            fn(ev.payload);
          } catch (err) {
            // One broken listener never stops the game or the other listeners.
            console.error('[engine/events]', String(ev.name), err);
          }
        }
      }
    } finally {
      this.delivering = false;
    }
  }

  listenerCount(name: keyof E): number {
    return this.listeners.get(name)?.length ?? 0;
  }

  clear(): void {
    this.listeners.clear();
    this.any = [];
    this.queue.length = 0;
  }
}

/** Who speaks a line (the HUD shows their face; the voice picks their timbre). */
export type Speaker = 'ziggy' | 'pepin' | 'grelotte' | 'noisette' | 'santa' | 'narrator' | (string & {});

/** A read-aloud request: bilingual lines + an optional pre-baked voice line id. */
export interface SayRequest {
  /** Stable id (voice line id when baked, else any unique key). */
  id: string;
  lines: L[];
  who: Speaker;
  /** Speak even when auto read-aloud is off (an explicit 🔊 press). */
  force?: boolean;
  /** Free tag for the HUD (hint, praise, letter…). */
  kind?: string;
}

/** The result of a round, shaped for `finishExtraGame(gameId, skill, stats, durationMs)`. */
export interface RoundResult {
  gameId: string;
  skill: LearningSkill;
  stats: { correct: number; mistakes: number; total: number };
  durationMs: number;
}

/** Happy-only reactions (the face module has no sad emotion). */
export type Reaction = 'smile' | 'laugh' | 'surprise' | 'listen' | 'wink' | 'cheer';

/** Events every game shares. `Hud` is the game's own HUD state shape. */
export type BaseGameEvents<Hud> = {
  /** New HUD state (replace, not merge). */
  hud: Hud;
  /** Please read these lines aloud / show them in the speech bubble. */
  say: SayRequest;
  /** A character's face, mirrored in the HUD. */
  react: { who: Speaker; reaction: Reaction };
  /** A round is finished: record it in World Memory. */
  result: RoundResult;
  /** The whole session is over (show the end card). */
  finish: void;
  /** Something blocked rendering (WebGL lost / restored). */
  status: { webgl: 'lost' | 'restored' };
  /** A hotspot got the focus (TV / keyboard / switch scan). */
  focus: { id: string | null };
};

/** Commands every game accepts from React. */
export type BaseGameCommands = {
  pause: void;
  resume: void;
  /** Read the last line again (🔊 button). */
  replay: void;
  hint: void;
  music: { on: boolean };
};

/** Both directions in one object, owned by the host. */
export class GameBus<Evt extends EventMap, Cmd extends EventMap> {
  readonly events = new Emitter<Evt>();
  readonly commands = new Emitter<Cmd>();
  dispose(): void {
    this.events.clear();
    this.commands.clear();
  }
}
