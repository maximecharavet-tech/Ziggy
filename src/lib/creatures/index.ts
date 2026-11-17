/**
 * The Usine à Créatures engine. Rust compiled to WebAssembly when the browser
 * can run it, the TypeScript twin (`core.ts`) otherwise — same answers either way
 * (a parity test compares them). Everything here is pure and offline.
 *
 *   const core = getCore();          // right now: the TS twin, always works
 *   void loadCore().then(...)        // once loaded, getCore() is the wasm one
 */
import type { Creature } from '@/games3d/creatures/logic';
import * as ts from './core';
import type { PowerId, SillyEvent } from './core';

export type { PowerId, SillyEvent };

export interface GeneratedChallenge {
  id: string;
  band: 'little' | 'middle' | 'big';
  skill: string;
  icon: string;
  text: { fr: string; en: string };
  reqs: Record<string, unknown>[];
}

export interface CreatureCore {
  engine: 'wasm' | 'ts';
  randomCreature(seed: number): Creature;
  makeName(seed: number): string;
  cross(a: Creature, b: Creature, seed: number): Creature;
  powersOf(c: Creature): PowerId[];
  sillyEvent(seed: number): SillyEvent;
  pose(kind: string, p: number): [number, number, number, number, number];
  encodeCode(c: Creature): string;
  decodeCode(code: string): Creature | null;
  comboCount(): number;
  /** A brand new, always buildable challenge (wasm only: `null` in the TS twin). */
  generateChallenge(band: string, seed: number): GeneratedChallenge | null;
  checkRequirements(reqs: unknown[], c: Creature): boolean[] | null;
}

export const tsCore: CreatureCore = {
  engine: 'ts',
  randomCreature: ts.randomCreature,
  makeName: ts.makeName,
  cross: ts.cross,
  powersOf: ts.powersOf,
  sillyEvent: ts.sillyEvent,
  pose: ts.pose,
  encodeCode: ts.encodeCode,
  decodeCode: ts.decodeCode,
  comboCount: ts.comboCount,
  generateChallenge: () => null,
  checkRequirements: () => null,
};

type Glue = typeof import('./wasm/creatures_core.js');

function wrap(g: Glue): CreatureCore {
  const parse = <T>(s: string): T | null => {
    if (!s) return null;
    try {
      return JSON.parse(s) as T;
    } catch {
      return null;
    }
  };
  const J = (c: Creature) => JSON.stringify(c);
  return {
    engine: 'wasm',
    randomCreature: (seed) => parse<Creature>(g.random_creature(seed)) ?? ts.randomCreature(seed),
    makeName: (seed) => g.make_name(seed) || ts.makeName(seed),
    cross: (a, b, seed) => parse<Creature>(g.cross(J(a), J(b), seed)) ?? ts.cross(a, b, seed),
    powersOf: (c) => parse<PowerId[]>(g.powers_of(J(c))) ?? ts.powersOf(c),
    sillyEvent: (seed) => (g.silly_event(seed) as SillyEvent) || ts.sillyEvent(seed),
    pose: (kind, p) => {
      const v = g.pose(kind, p);
      return [v[0], v[1], v[2], v[3], v[4]];
    },
    encodeCode: (c) => g.encode_code(J(c)) || ts.encodeCode(c),
    decodeCode: (code) => parse<Creature>(g.decode_code(code)),
    comboCount: () => g.combo_count(),
    generateChallenge: (band, seed) => parse<GeneratedChallenge>(g.generate_challenge(band, seed)),
    checkRequirements: (reqs, c) => parse<boolean[]>(g.check_requirements(JSON.stringify(reqs), J(c))),
  };
}

let current: CreatureCore = tsCore;
let loading: Promise<CreatureCore> | null = null;

export function getCore(): CreatureCore {
  return current;
}

/** Loads the wasm engine once; on any failure the TS twin stays in charge. */
export function loadCore(opts: { wasmBytes?: BufferSource } = {}): Promise<CreatureCore> {
  loading ??= (async () => {
    try {
      const glue = (await import('./wasm/creatures_core.js')) as Glue;
      if (opts.wasmBytes) glue.initSync({ module: opts.wasmBytes });
      else await glue.default({ module_or_path: new URL('./wasm/creatures_core_bg.wasm', import.meta.url) });
      current = wrap(glue);
    } catch {
      current = tsCore;
    }
    return current;
  })();
  return loading;
}
