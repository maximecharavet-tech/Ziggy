import { getToy, type Dial } from '../../logic';
import { FELT } from '../palette';
import { at, box, cyl, merge, rbox, torus } from '../geo';
import { RIDE, outArrow, parse, plate, type MachineArt } from './common';
import { eyes } from './common';

type D = { toy: string; n?: number };

/** Assembler (Grelotte): a workbench with a parts basket and a little crane that swings. */
export const assemblerArt: MachineArt = {
  id: 'assembler',
  ride: RIDE,
  height: 1.0,
  body: () =>
    merge([
      ...plate(FELT.lavender),
      outArrow(),
      // Basket at the back-left (the spare parts wait in it).
      at(cyl(0.2, 0.16, 0.18, FELT.woodDark, 10), -0.24, 0.21, -0.24),
      at(torus(0.19, 0.025, FELT.gold, 14), -0.24, 0.3, -0.24, Math.PI / 2, 0, 0),
      // Crane mast.
      at(rbox(0.12, 0.8, 0.12, 0.04, FELT.lavenderDark), -0.32, 0.5, 0.3),
      at(rbox(0.2, 0.1, 0.2, 0.04, FELT.lavender), -0.32, 0.92, 0.3),
      at(box(0.06, 0.06, 0.06, FELT.gold), -0.32, 0.99, 0.3),
      ...eyes(-0.24, 1.0, 0.07, 0.055).map((g) => at(g, 0, 0, 0.3)),
    ]),
  mover: {
    geometry: () => merge([at(box(0.62, 0.06, 0.08, FELT.lavender), 0.31, 0, 0), at(cyl(0.012, 0.012, 0.22, FELT.ink, 4), 0.56, -0.11, 0), at(box(0.12, 0.05, 0.1, FELT.gold), 0.56, -0.24, 0)]),
    pose(out, t, act) {
      out.makeRotationY(-1.2 + Math.sin(t * (act > 0 ? 5 : 0.6)) * (act > 0 ? 0.9 : 0.25));
      out.setPosition(-0.32, 0.86, 0.3);
    },
  },
  sign: (dial: Dial) => {
    const d = parse<D>(dial);
    const toy = getToy(d.toy);
    return `${toy?.emoji ?? '🧸'}${toy?.n && d.n ? `×${d.n}` : ''}`;
  },
};
