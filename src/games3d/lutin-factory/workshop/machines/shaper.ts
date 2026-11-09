import type { Dial, Shape } from '../../logic';
import { FELT, SHAPE_ICON } from '../palette';
import { at, box, cyl, merge } from '../geo';
import { RIDE, gantry, outArrow, parse, plate, type MachineArt } from './common';

type D = { shape?: Shape; shapes?: Shape[] };

/** Shaper (Grelotte): a lavender press; the stamping head goes up and down. */
export const shaperArt: MachineArt = {
  id: 'shaper',
  ride: RIDE,
  height: 0.95,
  body: () => merge([...plate(FELT.lavender), outArrow(), ...gantry(FELT.lavender, FELT.lavenderDark, 0.66), at(cyl(0.06, 0.06, 0.1, FELT.gold, 10), -0.02, 0.96, 0)]),
  mover: {
    geometry: () => merge([at(cyl(0.035, 0.035, 0.3, FELT.steel, 8), 0, 0.15, 0), at(box(0.3, 0.08, 0.3, FELT.lavenderDark), 0, 0, 0)]),
    pose(out, t, act) {
      const k = act > 0 ? Math.abs(Math.sin(t * 9)) : 0.15 + Math.sin(t * 1.3) * 0.03;
      out.makeTranslation(-0.02, 0.58 - k * 0.22 * (act > 0 ? 1 : 0.2), 0);
    },
  },
  sign: (dial: Dial) => {
    const d = parse<D>(dial);
    return (d.shapes ?? [d.shape ?? 'cube']).map((s) => SHAPE_ICON[s]).join('');
  },
};
