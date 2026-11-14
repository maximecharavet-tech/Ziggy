import type { MachineArt } from './common';
import { beltArt } from './belt';
import { chuteArt } from './chute';
import { shaperArt } from './shaper';
import { painterArt } from './painter';
import { mixerArt } from './mixer';
import { assemblerArt } from './assembler';
import { counterArt } from './counter';
import { sorterArt } from './sorter';
import { loopArt } from './loop';
import { stamperArt } from './stamper';
import { wrapperArt } from './wrapper';
import { armArt } from './arm';
import { sackArt } from './sack';

export { type MachineArt, RIDE } from './common';
export { sorterIcon } from './sorter';

/** Machine art registry: one module per machine type (same ids as the logic's plug-ins). */
export const MACHINE_ART: Record<string, MachineArt> = Object.fromEntries(
  [beltArt, chuteArt, shaperArt, painterArt, mixerArt, assemblerArt, counterArt, sorterArt, loopArt, stamperArt, wrapperArt, armArt, sackArt].map((a) => [a.id, a])
);
