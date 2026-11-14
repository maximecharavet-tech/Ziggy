import { FELT } from '../palette';
import { at, box, cyl, merge } from '../geo';
import { RIDE, type MachineArt } from './common';

/** Conveyor belt: two wooden rails and rollers; the moving felt band is drawn by the board (scrolling chevrons). */
export const beltArt: MachineArt = {
  id: 'belt',
  ride: RIDE,
  height: 0.16,
  body: () =>
    merge([
      at(box(0.98, 0.1, 0.84, FELT.woodDark), 0, 0.05, 0),
      at(box(0.98, 0.07, 0.07, FELT.woodLight), 0, 0.135, 0.43),
      at(box(0.98, 0.07, 0.07, FELT.woodLight), 0, 0.135, -0.43),
      at(cyl(0.06, 0.06, 0.82, FELT.steel, 8), 0.44, 0.08, 0, Math.PI / 2, 0, 0),
      at(cyl(0.06, 0.06, 0.82, FELT.steel, 8), -0.44, 0.08, 0, Math.PI / 2, 0, 0),
    ]),
};
