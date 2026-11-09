import type { Dial } from '../../logic';
import { FELT } from '../palette';
import { at, box, merge, torus } from '../geo';
import { RIDE, outArrow, parse, plate, type MachineArt } from './common';

type D = { times: number };

/** Repeat loop: a little round track; a felt wagon goes round while it copies. */
export const loopArt: MachineArt = {
  id: 'loop',
  ride: RIDE,
  height: 0.75,
  body: () => merge([...plate(FELT.mint), outArrow(), at(torus(0.3, 0.05, FELT.woodDark, 24), 0, 0.5, 0, Math.PI / 2, 0, 0), at(box(0.06, 0.38, 0.06, FELT.woodDark), -0.3, 0.3, 0), at(box(0.06, 0.38, 0.06, FELT.woodDark), 0.3, 0.3, 0)]),
  mover: {
    geometry: () => merge([at(box(0.14, 0.1, 0.12, FELT.mint), 0.3, 0.06, 0)]),
    pose(out, t, act) {
      out.makeRotationY(t * (act > 0 ? 6 : 0.5));
      out.setPosition(0, 0.5, 0);
    },
  },
  sign: (dial: Dial) => `🔁×${parse<D>(dial).times}`,
};
