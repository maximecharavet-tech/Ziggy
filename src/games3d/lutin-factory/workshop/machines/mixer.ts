import { COLOR_ICON, mixColors, type Dial, type Paint } from '../../logic';
import { FELT, PAINT_HEX } from '../palette';
import { at, ball, cyl, merge } from '../geo';
import { RIDE, gantry, outArrow, parse, plate, pot, type MachineArt } from './common';

type D = { a: Paint; b?: Paint };

/** Colour mixer (Grelotte): two pots pour into a big bowl; a whisk spins. */
export const mixerArt: MachineArt = {
  id: 'mixer',
  ride: RIDE,
  height: 1.05,
  body: (dial: Dial) => {
    const d = parse<D>(dial);
    const mixed = d.b ? mixColors(d.a, d.b) : d.a;
    return merge([
      ...plate(FELT.lavender),
      outArrow(),
      ...gantry(FELT.lavender, FELT.lavenderDark, 0.62),
      at(pot(PAINT_HEX[d.a], 0.11, 0.15), -0.02, 0.97, -0.24, 0.35, 0, 0),
      at(pot(d.b ? PAINT_HEX[d.b] : FELT.cream, 0.11, 0.15), -0.02, 0.97, 0.24, -0.35, 0, 0),
      at(cyl(0.16, 0.11, 0.12, FELT.cream, 12), -0.02, 0.92, 0),
      at(ball(0.12, PAINT_HEX[mixed], 10, 6), -0.02, 0.94, 0, 0, 0, 0, 1, 0.4, 1),
    ]);
  },
  mover: {
    geometry: () => merge([at(cyl(0.015, 0.015, 0.26, FELT.steel, 6), 0, 0.13, 0), at(ball(0.05, FELT.steel, 8, 6), 0, 0.0, 0, 0, 0, 0, 1, 1.6, 1)]),
    pose(out, t, act) {
      out.makeRotationY(t * (act > 0 ? 14 : 1));
      out.setPosition(-0.02, 0.96, 0);
    },
  },
  sign: (dial: Dial) => {
    const d = parse<D>(dial);
    return d.b ? `${COLOR_ICON[d.a]}+${COLOR_ICON[d.b]}` : `+${COLOR_ICON[d.a]}`;
  },
};
