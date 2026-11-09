import { COLOR_ICON, getToy, type Dial } from '../../logic';
import { FELT, MATERIAL_ICON, PATTERN_ICON, SHAPE_ICON, STICKER_ICON } from '../palette';
import { at, box, cyl, merge, rbox } from '../geo';
import { RIDE, parse, plate, outArrow, type MachineArt } from './common';
import { eyes } from './common';

type D = { color?: string; shape?: string; toy?: string; sticker?: string; wrap?: string; material?: string };

/** The test of a sorter as an icon: what goes LEFT. */
export function sorterIcon(d: D): string {
  if (d.color) return COLOR_ICON[d.color as keyof typeof COLOR_ICON];
  if (d.shape) return SHAPE_ICON[d.shape];
  if (d.toy) return getToy(d.toy)?.emoji ?? '🧸';
  if (d.sticker) return STICKER_ICON[d.sticker];
  if (d.wrap) return PATTERN_ICON[d.wrap as keyof typeof PATTERN_ICON];
  if (d.material) return MATERIAL_ICON[d.material as keyof typeof MATERIAL_ICON];
  return '❓';
}

/** Sorter (Noisette): IF it looks like the picture → left (mint arrow), ELSE → right (peach arrow). */
export const sorterArt: MachineArt = {
  id: 'sorter',
  ride: RIDE,
  height: 0.9,
  body: () =>
    merge([
      ...plate(FELT.hazel),
      // Left (north when facing east) = YES, right = NO.
      outArrow(0.125, FELT.mint, 0, -0.3, Math.PI / 2),
      outArrow(0.125, FELT.peach, 0, 0.3, -Math.PI / 2),
      at(rbox(0.14, 0.62, 0.14, 0.05, FELT.hazelDark), -0.32, 0.38, 0),
      at(rbox(0.3, 0.3, 0.3, 0.08, FELT.hazel), -0.32, 0.78, 0),
      at(cyl(0.11, 0.11, 0.03, FELT.cream, 14), -0.16, 0.8, 0, 0, 0, Math.PI / 2),
      at(box(0.04, 0.04, 0.04, FELT.gold), -0.32, 0.96, 0),
      ...eyes(-0.22, 0.86, 0.09, 0.065),
    ]),
  mover: {
    geometry: () => merge([at(box(0.5, 0.12, 0.04, FELT.hazelDark), 0.25, 0.06, 0)]),
    pose(out, t, act) {
      out.makeRotationY(Math.sin(t * (act > 0 ? 8 : 0.7)) * (act > 0 ? 0.8 : 0.12));
      out.setPosition(-0.22, 0.12, 0);
    },
  },
  sign: (dial: Dial) => `${sorterIcon(parse<D>(dial))}?`,
};
