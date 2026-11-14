import { COLOR_ICON, type Dial, type Paint } from '../../logic';
import { FELT, PAINT_HEX } from '../palette';
import { at, box, cyl, merge } from '../geo';
import { RIDE, gantry, outArrow, parse, plate, pot, type MachineArt } from './common';

type D = { color?: Paint; colors?: Paint[] };

/** Painter (Pépin): a green booth with its paint pots on the roof and a brush that swishes. */
export const painterArt: MachineArt = {
  id: 'painter',
  ride: RIDE,
  height: 1.0,
  body: (dial: Dial) => {
    const d = parse<D>(dial);
    const cols = d.colors ?? [d.color ?? 'red'];
    const pots = cols.slice(0, 3).map((c, i, a) => at(pot(PAINT_HEX[c], 0.1, 0.14), -0.02, 0.98, (i - (a.length - 1) / 2) * 0.24));
    return merge([...plate(FELT.green), outArrow(), ...gantry(FELT.green, FELT.greenDark, 0.66), ...pots, at(box(0.44, 0.04, 0.9, PAINT_HEX[cols[0]]), -0.02, 0.66, 0)]);
  },
  mover: {
    geometry: () => merge([at(cyl(0.025, 0.025, 0.3, FELT.woodDark, 6), 0, -0.15, 0), at(box(0.1, 0.1, 0.06, FELT.cream), 0, -0.33, 0), at(box(0.1, 0.06, 0.07, FELT.ink), 0, -0.41, 0)]),
    pose(out, t, act) {
      out.makeRotationX(Math.sin(t * (act > 0 ? 12 : 1.2)) * (act > 0 ? 0.7 : 0.08));
      out.setPosition(0.14, 0.64, 0);
    },
  },
  sign: (dial: Dial) => {
    const d = parse<D>(dial);
    return (d.colors ?? [d.color ?? 'red']).map((c) => COLOR_ICON[c]).join('');
  },
};
