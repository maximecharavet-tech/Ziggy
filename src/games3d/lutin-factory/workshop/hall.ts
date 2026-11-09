import * as THREE from 'three';
import { glow } from '@/games3d/kit/look';
import { FELT, PAINT_HEX } from './palette';
import { at, ball, box, cone, cyl, feltMaterial, merge, rbox, starShape, extrude, torus, type Geo } from './geo';

/**
 * The workshop halls (design doc B6), code-built felt and wood: a plank
 * floor, a back wall with snowy night windows, a garland, lamps, the
 * surprise shelf, and props per hall. Hall 1 (wood shop) is the polished
 * reference; the others are variants of it (wall colour, props, lights).
 * Everything static merges into ONE vertex-coloured mesh; the windows'
 * night glow is a second unlit mesh, plus a few glow sprites.
 */

export interface HallInfo {
  group: THREE.Group;
  /** World positions of the surprise shelf's toy spots (left → right, bottom → top). */
  shelf: THREE.Vector3[];
  /** Where the characters stand (behind the board). */
  crewZ: number;
  wallZ: number;
  /** Lamps that flicker gently. */
  glows: THREE.Sprite[];
}

interface Theme {
  wall: string;
  wallTrim: string;
  floor: [string, string];
  rug: string;
  lamp: string;
}

const THEMES: Record<string, Theme> = {
  'wood-shop': { wall: '#b9794a', wallTrim: '#8a5530', floor: ['#d39a62', '#c78d57'], rug: '#c4553f', lamp: '#ffcf7a' },
  'paint-room': { wall: '#f1dcc0', wallTrim: '#c49a6c', floor: ['#dcae7c', '#cfa06f'], rug: '#4f8fc4', lamp: '#fff0b0' },
  'assembly-line': { wall: '#5f9e94', wallTrim: '#3f7a72', floor: ['#cf9b66', '#c28e5a'], rug: '#e0a03c', lamp: '#ffd890' },
  'logic-room': { wall: '#4a5a8c', wallTrim: '#34406a', floor: ['#c99560', '#bb8855'], rug: '#8e5bd6', lamp: '#d8e8ff' },
  dispatch: { wall: '#a8443a', wallTrim: '#7d2f28', floor: ['#d29c63', '#c48f57'], rug: '#2f7a5a', lamp: '#ffd890' },
  'christmas-eve': { wall: '#7a2f3a', wallTrim: '#58202a', floor: ['#d29c63', '#c48f57'], rug: '#2f6b4a', lamp: '#ffe0a0' },
};

export function buildHall(hall: string, W: number, H: number, low: boolean): HallInfo {
  const th = THEMES[hall] ?? THEMES['wood-shop'];
  const group = new THREE.Group();
  group.name = `hall-${hall}`;
  const parts: Geo[] = [];
  const glass: Geo[] = [];
  const glows: THREE.Sprite[] = [];
  const crewZ = -H / 2 - 0.75;
  const wallZ = crewZ - 1.0;
  const span = Math.max(26, W + 18);

  // Plank floor.
  const planks = Math.ceil(span / 0.9);
  for (let i = 0; i < planks; i++) {
    const x = -span / 2 + (i + 0.5) * 0.9;
    parts.push(at(box(0.88, 0.2, span, th.floor[i % 2]), x, -0.1, wallZ + span / 2 - 0.2));
  }
  // Back wall: panels, a skirting board, a top trim.
  parts.push(at(box(span, 5.2, 0.3, th.wall), 0, 2.6, wallZ - 0.15));
  parts.push(at(box(span, 0.34, 0.1, th.wallTrim), 0, 0.17, wallZ + 0.04));
  parts.push(at(box(span, 0.16, 0.12, th.wallTrim), 0, 3.4, wallZ + 0.04));
  for (let x = -span / 2; x < span / 2; x += 1.6) parts.push(at(box(0.06, 3.0, 0.06, th.wallTrim), x, 1.9, wallZ + 0.02));

  // Windows with snowy sills (night outside).
  const winXs = [W / 2 + 1.6, -W / 2 - 3.4, W / 2 + 4.6];
  for (const wx of winXs) {
    parts.push(at(rbox(1.5, 1.6, 0.16, 0.06, FELT.woodDeep), wx, 2.2, wallZ + 0.05));
    glass.push(at(box(1.2, 1.3, 0.04, '#2a3f7a'), wx, 2.2, wallZ + 0.14));
    parts.push(at(box(0.06, 1.3, 0.06, FELT.woodDeep), wx, 2.2, wallZ + 0.17));
    parts.push(at(box(1.2, 0.06, 0.06, FELT.woodDeep), wx, 2.2, wallZ + 0.17));
    parts.push(at(rbox(1.6, 0.1, 0.3, 0.04, FELT.woodLight), wx, 1.36, wallZ + 0.16));
    parts.push(at(rbox(1.5, 0.08, 0.26, 0.04, FELT.snow), wx, 1.43, wallZ + 0.16));
    // Snowflakes painted on the glass.
    for (let k = 0; k < 5; k++) glass.push(at(ball(0.04, '#e8f0ff', 6, 4), wx - 0.45 + k * 0.22, 2.0 + ((k * 37) % 5) * 0.12, wallZ + 0.17));
  }

  // Garland with felt baubles along the wall.
  for (let i = 0; i < 24; i++) {
    const x = -W / 2 - 4 + i * ((W + 8) / 23);
    const sag = Math.sin((i % 6) * (Math.PI / 5)) * 0.18;
    parts.push(at(ball(0.13, FELT.greenDark, 7, 5), x, 3.15 - sag, wallZ + 0.18));
    if (i % 2 === 0) parts.push(at(ball(0.09, [FELT.red, FELT.gold, FELT.sky][i % 3], 8, 6), x, 2.98 - sag, wallZ + 0.26));
  }

  // The surprise shelf (left of the board, on the wall): three planks and a star sign.
  const shelf: THREE.Vector3[] = [];
  const sx = -Math.min(0.6, W / 2 - 1.3);
  const sw = 2.6;
  parts.push(at(rbox(0.12, 1.5, 0.5, 0.03, FELT.woodDeep), sx - sw / 2, 2.05, wallZ + 0.3));
  parts.push(at(rbox(0.12, 1.5, 0.5, 0.03, FELT.woodDeep), sx + sw / 2, 2.05, wallZ + 0.3));
  for (let r = 0; r < 3; r++) {
    const y = 1.42 + r * 0.55;
    parts.push(at(rbox(sw + 0.12, 0.08, 0.52, 0.03, FELT.wood), sx, y, wallZ + 0.32));
    for (let k = 0; k < 6; k++) shelf.push(new THREE.Vector3(sx - sw / 2 + 0.25 + k * ((sw - 0.5) / 5), y + 0.05, wallZ + 0.34));
  }
  parts.push(at(extrude(starShape(0.3, 0.13), 0.08, FELT.gold, 0.02), sx, 3.05, wallZ + 0.2));

  // Lamps (warm glow).
  for (const lx of [-W / 2 - 1.8, W / 2 + 0.2]) {
    parts.push(at(cyl(0.02, 0.02, 0.8, FELT.ink, 4), lx, 3.9, wallZ + 0.6));
    parts.push(at(cone(0.28, 0.24, th.wallTrim, 10), lx, 3.45, wallZ + 0.6));
    parts.push(at(ball(0.11, th.lamp, 8, 6), lx, 3.32, wallZ + 0.6));
    const gl = glow(th.lamp, 1.6, low ? 0.4 : 0.55);
    gl.position.set(lx, 3.3, wallZ + 0.6);
    glows.push(gl);
    group.add(gl);
  }

  // Hall props.
  const L = -W / 2 - 1.3; // left of the board
  const R = W / 2 + 1.3; // right of the board
  const front = H / 2 + 0.6;
  switch (hall) {
    case 'paint-room': {
      // Paint pots stacks, splats on the floor, an easel.
      const cols = Object.values(PAINT_HEX).slice(0, 6);
      cols.forEach((c, i) => {
        parts.push(at(cyl(0.2, 0.18, 0.28, FELT.steel, 10), L - 0.3 + (i % 3) * 0.44, 0.14 + Math.floor(i / 3) * 0.3, -H / 2 + 0.6 + (i % 2) * 0.1));
        parts.push(at(cyl(0.18, 0.18, 0.02, c, 10), L - 0.3 + (i % 3) * 0.44, 0.29 + Math.floor(i / 3) * 0.3, -H / 2 + 0.6 + (i % 2) * 0.1));
        parts.push(at(cyl(0.3 + (i % 2) * 0.15, 0.3 + (i % 2) * 0.15, 0.01, c, 9), (i % 2 ? R : L) + Math.sin(i) * 0.5, 0.005, front - 1.2 - i * 0.5));
      });
      parts.push(at(box(0.06, 1.6, 0.06, FELT.woodDark), R, 0.8, -H / 2 + 0.4, 0.2, 0, 0));
      parts.push(at(box(0.9, 0.7, 0.05, FELT.cream), R, 1.15, -H / 2 + 0.3, -0.25, 0, 0));
      parts.push(at(ball(0.16, PAINT_HEX.blue, 8, 6), R - 0.15, 1.2, -H / 2 + 0.36));
      parts.push(at(ball(0.12, PAINT_HEX.yellow, 8, 6), R + 0.2, 1.05, -H / 2 + 0.36));
      break;
    }
    case 'assembly-line': {
      for (let i = 0; i < 3; i++) parts.push(at(torus(0.4 - i * 0.08, 0.07, [FELT.gold, FELT.steel, FELT.red][i], 10), -W / 2 + 1.2 + i * 0.95, 2.4 + (i % 2) * 0.4, wallZ + 0.2));
      for (let i = 0; i < 4; i++) parts.push(at(rbox(0.7, 0.55, 0.7, 0.05, FELT.wood), L + (i % 2) * 0.1, 0.28 + Math.floor(i / 2) * 0.56, -H / 2 + 0.4 + (i % 2) * 0.8));
      parts.push(at(torus(1.0, 0.05, FELT.woodDark, 28), R + 0.4, 0.03, front - 1.6, Math.PI / 2, 0, 0));
      parts.push(at(torus(0.8, 0.05, FELT.woodDark, 28), R + 0.4, 0.03, front - 1.6, Math.PI / 2, 0, 0));
      break;
    }
    case 'logic-room': {
      parts.push(at(rbox(2.6, 1.4, 0.08, 0.04, '#24402f'), W / 2 + 2.6, 2.1, wallZ + 0.1));
      parts.push(at(box(2.7, 0.08, 0.14, FELT.woodLight), W / 2 + 2.6, 1.38, wallZ + 0.14));
      // Abacus.
      parts.push(at(box(0.06, 1.0, 0.06, FELT.woodDark), L - 0.5, 0.5, -H / 2 + 0.6));
      parts.push(at(box(0.06, 1.0, 0.06, FELT.woodDark), L + 0.5, 0.5, -H / 2 + 0.6));
      for (let r = 0; r < 4; r++) {
        parts.push(at(cyl(0.015, 0.015, 1.0, FELT.steel, 4), L, 0.25 + r * 0.22, -H / 2 + 0.6, 0, 0, Math.PI / 2));
        for (let b = 0; b < 5; b++) parts.push(at(ball(0.06, [FELT.red, FELT.gold, FELT.sky, FELT.mint][r], 6, 4), L - 0.3 + b * 0.1 + (r % 2) * 0.15, 0.25 + r * 0.22, -H / 2 + 0.6, 0, 0, 0, 1.2, 1, 1));
      }
      for (let i = 0; i < 5; i++) parts.push(at(rbox(0.5, 0.1, 0.36, 0.02, [FELT.red, FELT.navy, FELT.gold, FELT.green, FELT.lavender][i]), R, 0.05 + i * 0.1, front - 1.4, 0, i * 0.2, 0));
      break;
    }
    case 'dispatch':
    case 'christmas-eve': {
      // A big red sleigh on the right, mail sacks, parcels.
      parts.push(at(rbox(1.5, 0.5, 0.9, 0.12, FELT.red), R + 0.6, 0.45, -H / 2 + 0.7));
      parts.push(at(rbox(0.5, 0.8, 0.9, 0.12, FELT.red), R + 1.2, 0.7, -H / 2 + 0.7));
      parts.push(at(box(1.8, 0.06, 0.08, FELT.gold), R + 0.6, 0.12, -H / 2 + 0.3));
      parts.push(at(box(1.8, 0.06, 0.08, FELT.gold), R + 0.6, 0.12, -H / 2 + 1.1));
      for (let i = 0; i < 3; i++) parts.push(at(ball(0.3, FELT.cream, 9, 7), L + (i % 2) * 0.4, 0.28, -H / 2 + 0.5 + i * 0.55, 0, 0, 0, 1, 1.1, 1));
      for (let i = 0; i < 4; i++) parts.push(at(rbox(0.4, 0.34, 0.4, 0.04, [FELT.gold, FELT.mint, FELT.pink, FELT.sky][i]), R + 0.2 + (i % 2) * 0.45, 0.17 + Math.floor(i / 2) * 0.34, front - 1.0));
      if (hall === 'christmas-eve') {
        // A felt Christmas tree with baubles and a star.
        const tx = R + 0.3;
        const tz = -H / 2 - 0.4;
        parts.push(at(cyl(0.12, 0.14, 0.4, FELT.woodDeep, 6), tx, 0.2, tz));
        [1.0, 0.8, 0.58].forEach((r, i) => parts.push(at(cone(r, 1.0, i % 2 ? FELT.green : FELT.greenDark, 9), tx, 0.85 + i * 0.6, tz)));
        for (let k = 0; k < 10; k++) {
          const a = k * 2.4;
          const y = 0.6 + (k / 10) * 1.6;
          const r = 0.95 - (k / 10) * 0.6;
          parts.push(at(ball(0.07, [FELT.red, FELT.gold, FELT.sky, FELT.pink][k % 4], 6, 4), tx + Math.cos(a) * r, y, tz + Math.sin(a) * r));
        }
        parts.push(at(extrude(starShape(0.22, 0.1), 0.06, FELT.gold, 0.02), tx, 2.45, tz));
        const gl = glow('#ffd86b', 1.3, 0.6);
        gl.position.set(tx, 2.45, tz + 0.1);
        glows.push(gl);
        group.add(gl);
      }
      break;
    }
    default: {
      // Wood shop: a log pile, a saw horse, tools on the wall, a wood stove.
      for (let r = 0; r < 3; r++)
        for (let k = 0; k < 3 - r; k++) parts.push(at(cyl(0.2, 0.2, 1.1, k % 2 ? FELT.wood : FELT.woodLight, 8), L - 0.1 + k * 0.42 + r * 0.21, 0.2 + r * 0.36, -H / 2 + 0.7, Math.PI / 2, 0, 0));
      parts.push(at(box(1.2, 0.1, 0.18, FELT.woodLight), R, 0.62, front - 1.4));
      for (const dx of [-0.45, 0.45]) {
        parts.push(at(box(0.07, 0.66, 0.07, FELT.woodDark), R + dx, 0.31, front - 1.25, 0.25, 0, 0));
        parts.push(at(box(0.07, 0.66, 0.07, FELT.woodDark), R + dx, 0.31, front - 1.55, -0.25, 0, 0));
      }
      // Tool rack.
      parts.push(at(box(2.2, 0.1, 0.1, FELT.woodDeep), W / 2 + 2.6, 2.7, wallZ + 0.08));
      parts.push(at(box(0.08, 0.6, 0.05, FELT.woodDark), W / 2 + 1.9, 2.3, wallZ + 0.12));
      parts.push(at(box(0.3, 0.12, 0.06, FELT.steel), W / 2 + 1.9, 2.02, wallZ + 0.12));
      parts.push(at(box(0.5, 0.3, 0.03, FELT.steel), W / 2 + 2.6, 2.3, wallZ + 0.12));
      parts.push(at(box(0.08, 0.5, 0.05, FELT.red), W / 2 + 3.3, 2.35, wallZ + 0.12));
      // Wood stove with a warm glow.
      const stx = W / 2 + 1.0;
      const stz = -H / 2 - 1.2;
      parts.push(at(rbox(0.8, 0.9, 0.7, 0.1, '#3a3036'), stx, 0.45, stz));
      parts.push(at(cyl(0.1, 0.1, 2.4, '#3a3036', 8), stx, 2.1, stz - 0.1));
      glass.push(at(box(0.4, 0.3, 0.04, '#ff9a3c'), stx, 0.42, stz + 0.36));
      const gl = glow('#ff9a3c', 1.4, low ? 0.35 : 0.5);
      gl.position.set(stx, 0.45, stz + 0.45);
      glows.push(gl);
      group.add(gl);
      break;
    }
  }

  const mesh = new THREE.Mesh(merge(parts), feltMaterial());
  mesh.receiveShadow = !low;
  mesh.name = 'hall';
  mesh.matrixAutoUpdate = false;
  group.add(mesh);
  if (glass.length) {
    const g = new THREE.Mesh(merge(glass), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    g.name = 'hall-glow';
    g.matrixAutoUpdate = false;
    group.add(g);
  }
  return { group, shelf, crewZ, wallZ, glows };
}
