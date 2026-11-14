/**
 * Machine registry: id → plug-in. Adding a machine = one small module in this
 * folder + one line here + its FR/EN texts in texts.ts (a test checks it).
 */
import type { AnyMachine } from './types';
import { belt } from './belt';
import { chute } from './chute';
import { shaper } from './shaper';
import { painter } from './painter';
import { mixer } from './mixer';
import { assembler } from './assembler';
import { counter } from './counter';
import { sorter } from './sorter';
import { loop } from './loop';
import { stamper } from './stamper';
import { wrapper } from './wrapper';
import { arm } from './arm';
import { sack } from './sack';

const ALL: AnyMachine[] = [belt, chute, shaper, painter, mixer, assembler, counter, sorter, loop, stamper, wrapper, arm, sack];

const REGISTRY = new Map<string, AnyMachine>();

export function registerMachine(def: AnyMachine): void {
  if (REGISTRY.has(def.id)) throw new Error(`Machine "${def.id}" is registered twice`);
  REGISTRY.set(def.id, def);
}

for (const m of ALL) registerMachine(m);

export const getMachine = (id: string): AnyMachine | undefined => REGISTRY.get(id);
export const machineIds = (): string[] => [...REGISTRY.keys()];
export const isMachineId = (id: unknown): id is string => typeof id === 'string' && REGISTRY.has(id);
