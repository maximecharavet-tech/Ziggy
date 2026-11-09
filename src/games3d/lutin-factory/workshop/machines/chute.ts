import { COLOR_ICON, type Dial, type ItemSpec, type Material } from '../../logic';
import { FELT, MATERIAL_HEX, MATERIAL_ICON, SHAPE_ICON, STICKER_ICON } from '../palette';
import { at, box, cone, cyl, merge, rbox } from '../geo';
import { RIDE, outArrow, parse, plate, type MachineArt } from './common';
import { eyes } from './common';

type D = { material: Material; count: number; items?: ItemSpec[] };

/** Material chute (Pépin): a felt hopper on stilts with a slide down to the plate. */
export const chuteArt: MachineArt = {
  id: 'chute',
  ride: RIDE,
  height: 0.95,
  body: (dial: Dial) => {
    const d = parse<D>(dial);
    const fill = MATERIAL_HEX[d.material] ?? FELT.wood;
    return merge([
      ...plate(FELT.green),
      outArrow(),
      // Stilts at the back.
      at(box(0.06, 0.62, 0.06, FELT.woodDark), -0.36, 0.42, -0.3),
      at(box(0.06, 0.62, 0.06, FELT.woodDark), -0.36, 0.42, 0.3),
      // Hopper (an upside-down cone in Pépin's green) full of material.
      at(cone(0.3, 0.34, FELT.green, 12), -0.3, 0.68, 0, Math.PI, 0, 0),
      at(cyl(0.3, 0.3, 0.12, FELT.greenDark, 12), -0.3, 0.9, 0),
      at(cyl(0.27, 0.27, 0.04, fill, 12), -0.3, 0.96, 0),
      at(rbox(0.12, 0.08, 0.12, 0.03, fill), -0.34, 1.0, 0.06),
      at(rbox(0.1, 0.08, 0.1, 0.03, fill), -0.24, 0.99, -0.07),
      ...eyes(-0.3 + 0.12, 1.0, 0.1, 0.07),
      // The slide.
      at(box(0.46, 0.04, 0.34, FELT.red), -0.08, 0.36, 0, 0, 0, -0.6),
      at(box(0.46, 0.06, 0.03, FELT.gold), -0.08, 0.39, 0.17, 0, 0, -0.6),
      at(box(0.46, 0.06, 0.03, FELT.gold), -0.08, 0.39, -0.17, 0, 0, -0.6),
    ]);
  },
  mover: {
    geometry: () => merge([at(box(0.08, 0.2, 0.04, FELT.red), 0, 0.1, 0), at(cyl(0.05, 0.05, 0.03, FELT.gold, 8), 0, 0.22, 0, Math.PI / 2, 0, 0)]),
    pose(out, t, act) {
      // A little lever on the hopper that Pépin pulls.
      out.makeRotationZ(-0.3 + Math.sin(t * (act > 0 ? 10 : 1.5)) * (0.15 + 0.35 * act));
      out.setPosition(-0.3, 0.96, 0.32);
    },
  },
  sign: (dial: Dial) => {
    const d = parse<D>(dial);
    if (d.items?.length) {
      const s = d.items.map((it) => (it.color ? COLOR_ICON[it.color] : it.sticker ? STICKER_ICON[it.sticker] : it.shape ? SHAPE_ICON[it.shape] : MATERIAL_ICON[d.material])).join('');
      return `${s}×${d.count}`;
    }
    return `${MATERIAL_ICON[d.material] ?? '🪵'}×${d.count}`;
  },
};
