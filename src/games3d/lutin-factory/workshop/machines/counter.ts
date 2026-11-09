import type { Dial } from '../../logic';
import { FELT } from '../palette';
import { at, box, merge, rbox } from '../geo';
import { RIDE, outArrow, parse, plate, type MachineArt } from './common';
import { eyes } from './common';

type D = { n: number; mode: 'first' | 'every' };

/** Counter gate (Noisette): a hazelnut gate with a counting board; its flag flips right. */
export const counterArt: MachineArt = {
  id: 'counter',
  ride: RIDE,
  height: 0.95,
  body: () =>
    merge([
      ...plate(FELT.hazel),
      outArrow(),
      outArrow(0.125, FELT.mint, 0, 0.3, -Math.PI / 2),
      at(rbox(0.12, 0.7, 0.12, 0.04, FELT.hazelDark), -0.3, 0.42, -0.36),
      at(rbox(0.12, 0.7, 0.12, 0.04, FELT.hazelDark), -0.3, 0.42, 0.36),
      at(rbox(0.16, 0.3, 0.86, 0.06, FELT.hazel), -0.3, 0.8, 0),
      at(box(0.02, 0.18, 0.6, FELT.cream), -0.21, 0.8, 0),
      ...eyes(-0.24, 0.98, 0.16, 0.07),
    ]),
  mover: {
    geometry: () => merge([at(box(0.02, 0.26, 0.02, FELT.ink), 0, 0.13, 0), at(box(0.02, 0.12, 0.18, FELT.mint), 0, 0.22, 0.09)]),
    pose(out, t, act) {
      out.makeRotationX(act > 0 ? -1.1 * act : Math.sin(t * 0.8) * 0.06);
      out.setPosition(0.3, 0.12, 0.3);
    },
  },
  sign: (dial: Dial) => {
    const d = parse<D>(dial);
    return d.mode === 'first' ? `${d.n}➡️` : `${d.n}↪️`;
  },
};
