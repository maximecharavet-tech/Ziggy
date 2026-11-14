import { flattenProgram, type Dial, type ProgramEntry } from '../../logic';
import { FELT } from '../palette';
import { at, ball, box, cyl, merge, rbox } from '../geo';
import { RIDE, outArrow, parse, plate, type MachineArt } from './common';

type D = { program: ProgramEntry[] };

/** Robot arm (Pépin + Grelotte's cards): a tin arm on a turntable and a build plate. */
export const armArt: MachineArt = {
  id: 'arm',
  ride: RIDE,
  height: 1.0,
  body: () =>
    merge([
      ...plate(FELT.steel),
      outArrow(),
      at(cyl(0.18, 0.22, 0.14, FELT.greenDark, 14), -0.24, 0.19, -0.24),
      at(cyl(0.16, 0.16, 0.03, FELT.gold, 14), 0.06, 0.135, 0),
      // Card holder (the program) at the back.
      at(rbox(0.5, 0.26, 0.06, 0.03, FELT.cream), 0.05, 0.34, -0.4),
      at(box(0.08, 0.12, 0.01, FELT.red), -0.12, 0.36, -0.365),
      at(box(0.08, 0.12, 0.01, FELT.sky), 0.0, 0.36, -0.365),
      at(box(0.08, 0.12, 0.01, FELT.gold), 0.12, 0.36, -0.365),
      at(box(0.08, 0.12, 0.01, FELT.mint), 0.24, 0.36, -0.365),
    ]),
  mover: {
    geometry: () =>
      merge([
        at(rbox(0.1, 0.5, 0.1, 0.04, FELT.steel), 0, 0.25, 0),
        at(ball(0.07, FELT.gold, 8, 6), 0, 0.5, 0),
        at(rbox(0.44, 0.08, 0.08, 0.03, FELT.steel), 0.2, 0.52, 0),
        at(box(0.04, 0.12, 0.12, FELT.red), 0.42, 0.45, 0),
      ]),
    pose(out, t, act) {
      out.makeRotationY(0.9 + Math.sin(t * (act > 0 ? 4 : 0.5)) * (act > 0 ? 1.1 : 0.2));
      out.setPosition(-0.24, 0.26, -0.24);
    },
  },
  sign: (dial: Dial) => `🤖${flattenProgram(parse<D>(dial).program).length}`,
};
