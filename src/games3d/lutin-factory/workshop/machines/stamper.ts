import type { Dial } from '../../logic';
import { FELT, STICKER_ICON } from '../palette';
import { at, box, cyl, merge } from '../geo';
import { RIDE, gantry, outArrow, parse, plate, type MachineArt } from './common';

type D = { sticker: string };

/** Sticker stamper (Noisette): a hazelnut press with a big rubber stamp. */
export const stamperArt: MachineArt = {
  id: 'stamper',
  ride: RIDE,
  height: 0.95,
  body: () => merge([...plate(FELT.hazel), outArrow(), ...gantry(FELT.hazel, FELT.hazelDark, 0.68, [0.36, 0.24, 0.86])]),
  mover: {
    geometry: () => merge([at(cyl(0.03, 0.03, 0.26, FELT.woodDark, 6), 0, 0.13, 0), at(box(0.22, 0.08, 0.22, FELT.pink), 0, 0, 0), at(cyl(0.07, 0.07, 0.08, FELT.red, 10), 0, 0.3, 0)]),
    pose(out, t, act) {
      const k = act > 0 ? Math.abs(Math.sin(t * 8)) : 0.05;
      out.makeTranslation(-0.02, 0.6 - k * 0.24, 0);
    },
  },
  sign: (dial: Dial) => STICKER_ICON[parse<D>(dial).sticker] ?? '⭐',
};
