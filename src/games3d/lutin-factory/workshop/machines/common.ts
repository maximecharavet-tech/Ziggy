import * as THREE from 'three';
import type { Dial } from '../../logic';
import { FELT } from '../palette';
import { arrow, at, ball, box, cyl, rbox, merge, type Geo } from '../geo';

/**
 * Machine art contract (one module per machine type, like the logic's
 * plug-ins): a chunky toy-like body built in code, in local space (centred
 * on its tile, floor at y = 0, facing +X = its output side), painted with
 * vertex colours so every machine body of the workshop merges into one
 * mesh. One optional moving part per type is drawn with instancing.
 */
export interface MachineArt {
  id: string;
  body(d: Dial): Geo;
  mover?: {
    geometry(): Geo;
    /** Local transform of the moving part: `t` seconds, `act` 0..1 (working). */
    pose(out: THREE.Matrix4, t: number, act: number, d: Dial): void;
  };
  /** Icon text drawn on the machine's sign (dial at a glance, colour-blind safe). */
  sign?(d: Dial): string | null;
  /** Sign on the roof (the sack) instead of the front corner of the plate (default). */
  signOnTop?: boolean;
  /** Where items ride through this machine (y). */
  ride: number;
  /** Top of the body (sign height). */
  height: number;
}

/** Item height on belts and machine plates. */
export const RIDE = 0.15;

/** The wooden base plate every machine stands on, with a felt trim in the crew colour. */
export function plate(crew: string, h = 0.12): Geo[] {
  return [at(rbox(0.88, h, 0.88, 0.05, FELT.woodLight), 0, h / 2, 0), at(rbox(0.92, 0.05, 0.92, 0.02, crew), 0, 0.025, 0)];
}

/** Yellow output arrow on the front edge of the plate. */
export function outArrow(y = 0.125, color: string = FELT.gold, x = 0.3, z = 0, yaw = 0): Geo {
  return at(arrow(0.22, 0.24, color, 0.03), x, y, z, 0, yaw, 0);
}

/** Two pillars and a top housing: the item rides through underneath. */
export function gantry(color: string, dark: string, top = 0.66, housing: [number, number, number] = [0.42, 0.26, 0.86]): Geo[] {
  const out: Geo[] = [];
  for (const z of [-0.38, 0.38]) {
    out.push(at(rbox(0.16, top, 0.12, 0.04, dark), -0.02, top / 2, z));
  }
  out.push(at(rbox(housing[0], housing[1], housing[2], 0.07, color), -0.02, top + housing[1] / 2 - 0.04, 0));
  // Rivets / buttons on the front of the housing (the camera sees the top and the south face).
  out.push(at(cyl(0.035, 0.035, 0.03, FELT.gold, 8), -0.02, top + housing[1] - 0.02, 0.33, 0, 0, 0));
  out.push(at(cyl(0.035, 0.035, 0.03, FELT.gold, 8), -0.02, top + housing[1] - 0.02, -0.33, 0, 0, 0));
  out.push(...eyes(-0.02 + housing[0] / 2 - 0.06, top + housing[1] - 0.04, 0.13));
  return out;
}

/** Two googly felt eyes on top of a machine, looking where the toys go (+X). */
export function eyes(x: number, y: number, spread = 0.12, r = 0.075): Geo[] {
  const out: Geo[] = [];
  for (const z of [-spread, spread]) {
    out.push(at(ball(r, '#ffffff', 10, 8), x, y, z));
    out.push(at(ball(r * 0.48, FELT.ink, 8, 6), x + r * 0.55, y + r * 0.45, z));
    out.push(at(ball(r * 0.16, '#ffffff', 5, 4), x + r * 0.82, y + r * 0.75, z - r * 0.12));
  }
  return out;
}

/** A paint pot (open tin with a wooden rim). */
export function pot(color: THREE.ColorRepresentation, r = 0.12, h = 0.16): Geo {
  return merge([cyl(r, r * 0.92, h, FELT.steel, 12), at(cyl(r * 0.9, r * 0.9, 0.02, color, 12), 0, h / 2 + 0.005, 0), at(box(r * 0.5, 0.02, r * 0.5, color), r * 0.9, h / 2 - 0.02, 0, 0, 0, -0.6)]);
}

export const parse = <T>(d: Dial) => d as unknown as T;
