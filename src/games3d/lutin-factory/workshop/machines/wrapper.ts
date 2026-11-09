import * as THREE from 'three';
import type { Dial, Pattern } from '../../logic';
import { FELT, PATTERN_ICON, WRAP_HEX } from '../palette';
import { at, cyl, merge } from '../geo';
import { RIDE, gantry, outArrow, parse, plate, type MachineArt } from './common';

const SPIN = new THREE.Matrix4();

type D = { pattern?: Pattern; patterns?: Pattern[] };

/** Wrapper (Noisette): a big roll of paper unrolls over the toy. */
export const wrapperArt: MachineArt = {
  id: 'wrapper',
  ride: RIDE,
  height: 1.0,
  body: (dial: Dial) => {
    const d = parse<D>(dial);
    const p = (d.patterns ?? [d.pattern ?? 'stripes'])[0];
    return merge([...plate(FELT.hazel), outArrow(), ...gantry(FELT.hazel, FELT.hazelDark, 0.66), at(cyl(0.02, 0.02, 0.96, FELT.steel, 6), -0.02, 0.98, 0, Math.PI / 2, 0, 0), at(cyl(0.05, 0.05, 0.06, WRAP_HEX[p], 8), -0.02, 0.98, 0.45, Math.PI / 2, 0, 0)]);
  },
  mover: {
    geometry: () => merge([cyl(0.12, 0.12, 0.7, FELT.cream, 12), at(cyl(0.122, 0.122, 0.1, FELT.red, 12), 0, 0.2, 0), at(cyl(0.122, 0.122, 0.1, FELT.red, 12), 0, -0.2, 0)]),
    pose(out, t, act) {
      out.makeRotationX(Math.PI / 2);
      out.multiply(SPIN.makeRotationY(t * (act > 0 ? 10 : 0.4)));
      out.setPosition(-0.02, 0.98, 0);
    },
  },
  sign: (dial: Dial) => {
    const d = parse<D>(dial);
    return (d.patterns ?? [d.pattern ?? 'stripes']).map((p) => PATTERN_ICON[p]).join('');
  },
};
