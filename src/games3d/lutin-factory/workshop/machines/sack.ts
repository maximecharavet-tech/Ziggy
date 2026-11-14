import * as THREE from 'three';
import type { Dial } from '../../logic';
import { FELT } from '../palette';
import { at, ball, box, cyl, merge, torus } from '../geo';
import { RIDE, type MachineArt } from './common';

const V = new THREE.Vector3();

type D = { bay?: string };

/** Sleigh sack (Ziggy's check gate): Santa's red felt sack on a little sledge; it wobbles when a toy drops in. */
export const sackArt: MachineArt = {
  id: 'sack',
  ride: RIDE,
  signOnTop: true,
  height: 0.9,
  body: () =>
    merge([
      // Sledge runners and slats.
      at(box(0.9, 0.05, 0.08, FELT.gold), 0, 0.03, 0.32),
      at(box(0.9, 0.05, 0.08, FELT.gold), 0, 0.03, -0.32),
      at(torus(0.07, 0.025, FELT.gold, 10, Math.PI), 0.45, 0.1, 0.32, 0, 0, -Math.PI / 2),
      at(torus(0.07, 0.025, FELT.gold, 10, Math.PI), 0.45, 0.1, -0.32, 0, 0, -Math.PI / 2),
      at(box(0.8, 0.06, 0.78, FELT.redDark), 0, 0.1, 0),
    ]),
  mover: {
    geometry: () =>
      merge([
        at(ball(0.36, FELT.red, 14, 10), 0, 0.3, 0, 0, 0, 0, 1, 0.9, 1),
        at(cyl(0.16, 0.24, 0.16, FELT.red, 12), 0, 0.66, 0),
        at(torus(0.17, 0.035, FELT.gold, 14), 0, 0.66, 0, Math.PI / 2, 0, 0),
        at(cyl(0.2, 0.17, 0.08, FELT.cream, 12), 0, 0.77, 0),
      ]),
    pose(out, t, act) {
      const w = act > 0 ? Math.sin(t * 16) * 0.12 * act : Math.sin(t * 1.4) * 0.015;
      out.makeRotationZ(w);
      const s = 1 + act * 0.08;
      out.scale(V.set(s, 1 / Math.sqrt(s), s));
      out.setPosition(0, 0.12, 0);
    },
  },
  sign: (dial: Dial) => (dial as D).bay ?? '🎁',
};
