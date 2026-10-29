import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { glow, glowMat } from '../kit/look';
import type { PropId } from './logic';

/**
 * The objects of the words (a cat, a moon, a bike…), low-poly and built in
 * code, cute faces included. Each one is merged into a single vertex-coloured
 * mesh (plus a glow here and there), sits on y = 0, faces +z and is about one
 * unit tall, so it can jump into the kart's trailer.
 */

type V3 = [number, number, number];
type Scale = number | V3;

export class Kit {
  readonly g = new THREE.Group();
  private mats = new Map<string, THREE.MeshLambertMaterial>();

  private mat(color: string) {
    let m = this.mats.get(color);
    if (!m) {
      m = new THREE.MeshLambertMaterial({ color, flatShading: true });
      this.mats.set(color, m);
    }
    return m;
  }

  add(geo: THREE.BufferGeometry, color: string, p: V3 = [0, 0, 0], s: Scale = 1, r: V3 = [0, 0, 0]) {
    const m = new THREE.Mesh(geo, this.mat(color));
    m.position.set(...p);
    if (typeof s === 'number') m.scale.setScalar(s);
    else m.scale.set(...s);
    m.rotation.set(...r);
    this.g.add(m);
    return m;
  }
  ball(r: number, color: string, p: V3, s: Scale = 1, rot: V3 = [0, 0, 0], seg = 14) {
    return this.add(new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.7))), color, p, s, rot);
  }
  cyl(rt: number, rb: number, h: number, color: string, p: V3, rot: V3 = [0, 0, 0], seg = 12) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), color, p, 1, rot);
  }
  cone(r: number, h: number, color: string, p: V3, rot: V3 = [0, 0, 0], seg = 10) {
    return this.add(new THREE.ConeGeometry(r, h, seg), color, p, 1, rot);
  }
  box(w: number, h: number, d: number, color: string, p: V3, rot: V3 = [0, 0, 0]) {
    return this.add(new THREE.BoxGeometry(w, h, d), color, p, 1, rot);
  }
  torus(R: number, t: number, color: string, p: V3, rot: V3 = [0, 0, 0], arc = Math.PI * 2, seg = 20) {
    return this.add(new THREE.TorusGeometry(R, t, 8, seg, arc), color, p, 1, rot);
  }
  tube(points: V3[], r: number, color: string, seg = 16) {
    const curve = new THREE.CatmullRomCurve3(points.map((q) => new THREE.Vector3(...q)));
    return this.add(new THREE.TubeGeometry(curve, seg, r, 7, false), color);
  }
  /** Shiny black eyes with a white sparkle — the cute look. */
  eyes(x: number, y: number, z: number, r = 0.065, tilt = 0) {
    for (const sx of [-1, 1]) {
      this.ball(r, '#1d1830', [sx * x, y, z], [0.85, 1.05, 0.6], [0, sx * tilt, 0], 10);
      this.ball(r * 0.36, '#ffffff', [sx * x + r * 0.3, y + r * 0.35, z + r * 0.45], 1, [0, 0, 0], 8);
    }
  }
  smile(y: number, z: number, w = 0.08, color = '#3a2238') {
    return this.torus(w, w * 0.22, color, [0, y, z], [0, 0, Math.PI], Math.PI, 10);
  }
  blush(x: number, y: number, z: number, r = 0.05) {
    for (const sx of [-1, 1]) this.ball(r, '#ff9fb8', [sx * x, y, z], [1.2, 0.7, 0.4], [0, 0, 0], 8);
  }
}

/* ───────────────────────── The models ───────────────────────── */

function quad(k: Kit, color: string, y: number, spread: number, len: number, r = 0.07) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(r, r * 0.9, len, color, [sx * spread, y, sz * spread * 1.3]);
}

const BUILD: Record<PropId, (k: Kit) => void> = {
  cat(k) {
    const c = '#ffa94d';
    const w = '#fff4e6';
    k.ball(0.4, c, [0, 0.38, -0.05], [1, 0.85, 1.15]);
    k.ball(0.28, w, [0, 0.33, 0.22], [1, 0.9, 0.6]);
    k.ball(0.36, c, [0, 0.86, 0.16], [1.12, 0.95, 1]);
    for (const sx of [-1, 1]) {
      k.cone(0.13, 0.27, c, [sx * 0.21, 1.16, 0.12], [0, 0, -sx * 0.35]);
      k.cone(0.07, 0.15, '#ff8fab', [sx * 0.2, 1.13, 0.17], [0, 0, -sx * 0.35]);
      k.ball(0.1, w, [sx * 0.16, 0.08, 0.32], [1, 0.7, 1.3]);
      k.box(0.04, 0.12, 0.04, '#e8590c', [sx * 0.09, 1.14, 0.3], [0.3, 0, sx * 0.2]);
    }
    k.ball(0.13, w, [0, 0.76, 0.46], [1.3, 0.8, 0.7]);
    k.ball(0.045, '#ff6b8b', [0, 0.82, 0.54]);
    k.eyes(0.14, 0.92, 0.45);
    k.blush(0.24, 0.78, 0.43);
    k.tube([[0, 0.3, -0.5], [0, 0.55, -0.78], [0.12, 0.95, -0.72], [0.2, 1.05, -0.55]], 0.07, c);
  },
  dog(k) {
    const c = '#d9a066';
    const d = '#8b5a2b';
    k.ball(0.38, c, [0, 0.4, -0.05], [1, 0.9, 1.2]);
    k.ball(0.36, c, [0, 0.9, 0.18]);
    k.ball(0.16, '#f5deb3', [0, 0.8, 0.46], [1.2, 0.85, 1]);
    k.ball(0.06, '#2b1d14', [0, 0.86, 0.6]);
    for (const sx of [-1, 1]) {
      k.ball(0.14, d, [sx * 0.34, 0.86, 0.12], [0.6, 1.4, 0.9], [0, 0, sx * 0.25]);
      k.ball(0.1, c, [sx * 0.16, 0.08, 0.3], [1, 0.7, 1.3]);
    }
    k.ball(0.1, d, [-0.15, 1.02, 0.4], [1, 0.8, 0.4]);
    k.eyes(0.13, 0.98, 0.47);
    k.smile(0.74, 0.53, 0.06);
    k.tube([[0, 0.45, -0.5], [0.05, 0.75, -0.7], [0.12, 0.95, -0.62]], 0.06, c);
  },
  bear(k) {
    const c = '#b07a4a';
    const l = '#e9c9a0';
    k.ball(0.42, c, [0, 0.42, 0], [1, 0.95, 1]);
    k.ball(0.28, l, [0, 0.4, 0.24], [1, 1, 0.6]);
    k.ball(0.36, c, [0, 0.98, 0.08]);
    for (const sx of [-1, 1]) {
      k.ball(0.12, c, [sx * 0.28, 1.27, 0.02]);
      k.ball(0.07, l, [sx * 0.28, 1.27, 0.08]);
      k.ball(0.13, c, [sx * 0.2, 0.1, 0.25], [1, 0.8, 1.2]);
    }
    k.ball(0.14, l, [0, 0.9, 0.38], [1.2, 0.85, 0.8]);
    k.ball(0.055, '#2b1d14', [0, 0.95, 0.48]);
    k.eyes(0.14, 1.05, 0.37);
    k.blush(0.24, 0.92, 0.36);
  },
  lion(k) {
    const c = '#ffc94d';
    const m = '#e8743b';
    k.ball(0.38, c, [0, 0.4, -0.1], [1, 0.9, 1.2]);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      k.ball(0.15, i % 2 ? m : '#d9531e', [Math.cos(a) * 0.36, 0.92 + Math.sin(a) * 0.36, 0.05], [1, 1, 0.7]);
    }
    k.ball(0.34, c, [0, 0.92, 0.12]);
    k.ball(0.14, '#fff1c9', [0, 0.82, 0.4], [1.25, 0.85, 0.8]);
    k.ball(0.05, '#6b3a1f', [0, 0.88, 0.5]);
    for (const sx of [-1, 1]) {
      k.ball(0.08, c, [sx * 0.24, 1.2, 0.12]);
      k.ball(0.1, c, [sx * 0.16, 0.08, 0.3], [1, 0.7, 1.3]);
    }
    k.eyes(0.13, 0.98, 0.42);
    k.tube([[0, 0.4, -0.55], [0.1, 0.6, -0.8], [0.2, 0.8, -0.8]], 0.05, c);
    k.ball(0.09, m, [0.22, 0.84, -0.78]);
  },
  rabbit(k) {
    const c = '#f3f0f7';
    k.ball(0.38, c, [0, 0.38, 0], [1, 0.9, 1.1]);
    k.ball(0.32, c, [0, 0.88, 0.14]);
    for (const sx of [-1, 1]) {
      k.ball(0.11, c, [sx * 0.13, 1.4, 0.05], [0.8, 2.6, 0.6], [0, 0, -sx * 0.15]);
      k.ball(0.06, '#ffb3c8', [sx * 0.13, 1.4, 0.1], [0.8, 2.4, 0.4], [0, 0, -sx * 0.15]);
      k.ball(0.11, c, [sx * 0.17, 0.08, 0.3], [1, 0.7, 1.4]);
    }
    k.ball(0.14, '#ffffff', [0, 0.3, -0.42]);
    k.ball(0.045, '#ff7aa2', [0, 0.85, 0.46]);
    k.eyes(0.13, 0.95, 0.4);
    k.blush(0.22, 0.82, 0.38);
  },
  pig(k) {
    const c = '#ffadc2';
    k.ball(0.45, c, [0, 0.48, 0], [1, 0.9, 1.2]);
    k.ball(0.34, c, [0, 0.72, 0.42]);
    k.cyl(0.14, 0.15, 0.12, '#ff8fab', [0, 0.66, 0.74], [Math.PI / 2, 0, 0]);
    for (const sx of [-1, 1]) {
      k.ball(0.03, '#c2255c', [sx * 0.05, 0.66, 0.81]);
      k.cone(0.1, 0.18, c, [sx * 0.2, 1.04, 0.38], [0.3, 0, -sx * 0.4]);
    }
    quad(k, c, 0.12, 0.25, 0.25, 0.08);
    k.eyes(0.13, 0.84, 0.66);
    k.blush(0.24, 0.66, 0.64);
    k.torus(0.07, 0.025, c, [0, 0.6, -0.56], [0, Math.PI / 2, 0]);
  },
  cow(k) {
    const w = '#ffffff';
    const b = '#2e2a3a';
    k.ball(0.45, w, [0, 0.6, -0.05], [1, 0.85, 1.3]);
    for (const [x, y, z] of [[0.38, 0.7, -0.1], [-0.3, 0.75, 0.2], [0.1, 0.95, -0.3], [-0.35, 0.55, -0.35]] as V3[]) k.ball(0.15, b, [x, y, z], [0.5, 1, 1]);
    k.ball(0.3, w, [0, 0.95, 0.5]);
    k.ball(0.2, '#ffb3c8', [0, 0.82, 0.72], [1.2, 0.8, 0.8]);
    for (const sx of [-1, 1]) {
      k.ball(0.03, '#c2255c', [sx * 0.07, 0.84, 0.88]);
      k.cone(0.05, 0.18, '#fff3bf', [sx * 0.17, 1.24, 0.48], [0, 0, -sx * 0.4]);
      k.ball(0.09, b, [sx * 0.3, 1.08, 0.46], [1.4, 0.6, 0.6]);
    }
    quad(k, w, 0.17, 0.24, 0.35, 0.08);
    k.eyes(0.12, 1.02, 0.74);
    k.tube([[0, 0.7, -0.6], [0.05, 0.5, -0.72], [0.05, 0.35, -0.7]], 0.03, w, 8);
  },
  sheep(k) {
    const w = '#f8f6fb';
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      k.add(new THREE.IcosahedronGeometry(0.22, 1), w, [Math.cos(a) * 0.3, 0.55 + Math.sin(a * 2) * 0.12, Math.sin(a) * 0.36]);
    }
    k.add(new THREE.IcosahedronGeometry(0.36, 1), w, [0, 0.62, 0]);
    k.ball(0.22, '#4a4458', [0, 0.78, 0.5], [0.9, 1.05, 1]);
    k.add(new THREE.IcosahedronGeometry(0.13, 1), w, [0, 0.98, 0.48]);
    for (const sx of [-1, 1]) k.ball(0.08, '#4a4458', [sx * 0.24, 0.84, 0.44], [1.6, 0.6, 0.8]);
    quad(k, '#4a4458', 0.17, 0.18, 0.34, 0.06);
    k.eyes(0.09, 0.82, 0.68, 0.05);
  },
  duck(k) {
    const c = '#ffd43b';
    k.ball(0.42, c, [0, 0.38, -0.05], [1, 0.8, 1.25]);
    k.ball(0.3, c, [0, 0.88, 0.22]);
    k.ball(0.14, '#ff922b', [0, 0.8, 0.52], [1.3, 0.45, 1.2]);
    for (const sx of [-1, 1]) k.ball(0.18, '#fcc419', [sx * 0.38, 0.45, -0.05], [0.4, 0.8, 1.2]);
    k.cone(0.14, 0.28, c, [0, 0.55, -0.55], [-1.2, 0, 0]);
    k.eyes(0.12, 0.96, 0.44);
    k.blush(0.2, 0.84, 0.42);
  },
  chick(k) {
    const c = '#ffe066';
    k.ball(0.4, c, [0, 0.42, 0]);
    k.ball(0.28, c, [0, 0.88, 0.05]);
    k.cone(0.07, 0.16, '#ff922b', [0, 0.84, 0.36], [Math.PI / 2, 0, 0]);
    for (const sx of [-1, 1]) {
      k.ball(0.14, '#fcc419', [sx * 0.38, 0.45, 0], [0.4, 0.9, 1]);
      k.cyl(0.03, 0.03, 0.12, '#ff922b', [sx * 0.12, 0.04, 0.05]);
      k.ball(0.07, '#ff922b', [sx * 0.12, 0.0, 0.12], [1, 0.4, 1.4]);
    }
    for (const [x, z] of [[0, 0], [0.06, 0.04], [-0.06, 0.04]]) k.ball(0.05, c, [x, 1.17, z]);
    k.eyes(0.11, 0.94, 0.27, 0.055);
    k.blush(0.18, 0.84, 0.24, 0.04);
  },
  bird(k) {
    const c = '#4dabf7';
    k.ball(0.38, c, [0, 0.45, 0], [1, 0.95, 1.1]);
    k.ball(0.27, '#d0ebff', [0, 0.4, 0.2], [1, 1, 0.6]);
    k.ball(0.27, c, [0, 0.9, 0.12]);
    k.cone(0.07, 0.18, '#ffa94d', [0, 0.86, 0.42], [Math.PI / 2, 0, 0]);
    for (const sx of [-1, 1]) {
      k.ball(0.17, '#339af0', [sx * 0.36, 0.5, -0.05], [0.4, 0.8, 1.2], [0, 0, sx * 0.3]);
      k.cyl(0.025, 0.025, 0.14, '#ffa94d', [sx * 0.1, 0.05, 0.05]);
    }
    k.box(0.3, 0.06, 0.32, '#228be6', [0, 0.5, -0.45], [0.5, 0, 0]);
    k.eyes(0.11, 0.96, 0.33, 0.055);
  },
  penguin(k) {
    const b = '#2b2d42';
    k.ball(0.38, b, [0, 0.55, 0], [1, 1.35, 0.95]);
    k.ball(0.3, '#ffffff', [0, 0.5, 0.12], [1, 1.25, 0.85]);
    k.ball(0.06, '#ffffff', [0, 0.98, 0.33], [2.6, 1.2, 0.5]);
    k.cone(0.07, 0.16, '#ffa94d', [0, 0.92, 0.42], [Math.PI / 2, 0, 0]);
    for (const sx of [-1, 1]) {
      k.ball(0.14, b, [sx * 0.38, 0.55, 0], [0.35, 1.2, 0.7], [0, 0, sx * 0.35]);
      k.ball(0.09, '#ffa94d', [sx * 0.13, 0.03, 0.18], [1, 0.4, 1.5]);
    }
    k.eyes(0.12, 1.0, 0.33, 0.055);
    k.blush(0.2, 0.9, 0.3, 0.04);
  },
  fish(k) {
    const c = '#ff922b';
    k.ball(0.42, c, [0, 0.55, 0], [0.7, 0.95, 1.25]);
    k.ball(0.3, '#ffd8a8', [0, 0.45, 0.1], [0.62, 0.7, 1.1]);
    k.cone(0.3, 0.4, '#ff6b6b', [0, 0.55, -0.66], [-Math.PI / 2, 0, 0], 4);
    k.cone(0.16, 0.3, '#ff6b6b', [0, 1.0, -0.05], [-0.4, 0, 0], 4);
    for (const sx of [-1, 1]) k.ball(0.12, '#ff6b6b', [sx * 0.3, 0.42, 0.1], [0.3, 0.6, 1]);
    for (const z of [-0.15, 0.1]) k.torus(0.38, 0.03, '#fff3bf', [0, 0.55, z], [0, Math.PI / 2, 0], Math.PI, 14);
    k.eyes(0.22, 0.64, 0.33, 0.07, 0.6);
    k.smile(0.45, 0.5, 0.06);
  },
  dolphin(k) {
    const c = '#74a9d8';
    k.ball(0.32, c, [0, 0.55, 0], [0.9, 0.95, 1.7]);
    k.ball(0.24, '#e7f5ff', [0, 0.45, 0.08], [0.85, 0.75, 1.6]);
    k.ball(0.12, c, [0, 0.5, 0.62], [0.9, 0.7, 1.5]);
    k.cone(0.13, 0.32, c, [0, 0.92, -0.05], [-0.5, 0, 0], 5);
    k.box(0.5, 0.05, 0.16, c, [0, 0.62, -0.62], [0, 0, 0]);
    for (const sx of [-1, 1]) k.ball(0.11, c, [sx * 0.28, 0.4, 0.15], [0.4, 0.3, 1], [0, 0, sx * 0.6]);
    k.eyes(0.2, 0.66, 0.36, 0.055, 0.6);
    k.smile(0.5, 0.66, 0.06);
  },
  whale(k) {
    const c = '#4c6ef5';
    k.ball(0.5, c, [0, 0.5, 0], [1, 0.85, 1.25]);
    k.ball(0.4, '#dbe4ff', [0, 0.32, 0.12], [1, 0.55, 1.1]);
    k.cone(0.12, 0.3, c, [0, 0.6, -0.68], [-1.1, 0, 0], 5);
    k.box(0.6, 0.06, 0.2, c, [0, 0.8, -0.82], [0.3, 0, 0]);
    for (const sx of [-1, 1]) k.ball(0.14, c, [sx * 0.46, 0.3, 0.12], [0.4, 0.25, 1], [0, 0, sx * 0.6]);
    for (let i = 0; i < 5; i++) k.cone(0.05, 0.3, '#a5d8ff', [Math.cos(i * 1.26) * 0.08, 1.12, Math.sin(i * 1.26) * 0.08 + 0.05], [Math.sin(i * 1.26) * 0.4, 0, -Math.cos(i * 1.26) * 0.4], 5);
    k.eyes(0.3, 0.6, 0.5, 0.06, 0.5);
    k.smile(0.4, 0.6, 0.1);
    k.blush(0.36, 0.48, 0.46);
  },
  frog(k) {
    const c = '#69db7c';
    k.ball(0.45, c, [0, 0.4, 0], [1.1, 0.8, 1]);
    k.ball(0.35, '#d3f9d8', [0, 0.36, 0.2], [1, 0.7, 0.6]);
    for (const sx of [-1, 1]) {
      k.ball(0.17, c, [sx * 0.24, 0.78, 0.2]);
      k.ball(0.13, '#ffffff', [sx * 0.24, 0.8, 0.3]);
      k.ball(0.07, '#1d1830', [sx * 0.24, 0.81, 0.4]);
      k.ball(0.15, c, [sx * 0.4, 0.12, 0.1], [1.2, 0.6, 1.5]);
    }
    k.torus(0.22, 0.03, '#2b8a3e', [0, 0.52, 0.42], [0.2, 0, Math.PI], Math.PI, 12);
    k.blush(0.34, 0.5, 0.36);
  },
  turtle(k) {
    const s = '#2f9e44';
    const b = '#a9e34b';
    k.add(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), s, [0, 0.22, 0], [1, 0.9, 1.1]);
    k.cyl(0.52, 0.5, 0.1, '#fab005', [0, 0.22, 0], [0, 0, 0], 14);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      k.ball(0.11, '#8ce99a', [Math.cos(a) * 0.3, 0.5, Math.sin(a) * 0.35], [1, 0.4, 1]);
    }
    k.ball(0.13, '#8ce99a', [0, 0.66, 0], [1, 0.4, 1]);
    k.ball(0.2, b, [0, 0.35, 0.62]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.ball(0.12, b, [sx * 0.38, 0.12, sz * 0.35], [1, 0.6, 1.2]);
    k.eyes(0.09, 0.42, 0.78, 0.045);
    k.smile(0.3, 0.8, 0.05);
  },
  snail(k) {
    const b = '#ffd8a8';
    k.ball(0.22, b, [0, 0.16, 0.1], [0.9, 0.7, 2.6]);
    k.ball(0.18, b, [0, 0.38, 0.58]);
    k.torus(0.28, 0.17, '#ff8787', [0, 0.62, -0.05], [0, Math.PI / 2, 0], Math.PI * 2, 18);
    k.ball(0.2, '#ffa8a8', [0.02, 0.62, -0.05], [0.9, 1, 1]);
    k.ball(0.09, '#ff6b6b', [0.08, 0.62, -0.05]);
    for (const sx of [-1, 1]) {
      k.cyl(0.025, 0.025, 0.3, b, [sx * 0.09, 0.6, 0.62], [0.3, 0, sx * 0.25]);
      k.ball(0.05, '#1d1830', [sx * 0.13, 0.75, 0.67]);
    }
    k.smile(0.33, 0.75, 0.05);
  },
  bee(k) {
    k.ball(0.38, '#ffd43b', [0, 0.55, 0], [0.95, 0.95, 1.2]);
    for (const z of [-0.12, 0.12]) k.torus(0.36, 0.06, '#2b2d42', [0, 0.55, z * 1.6], [0, 0, 0], Math.PI * 2, 20);
    k.ball(0.27, '#ffd43b', [0, 0.65, 0.48]);
    k.cone(0.06, 0.16, '#2b2d42', [0, 0.52, -0.52], [-Math.PI / 2, 0, 0]);
    for (const sx of [-1, 1]) {
      k.ball(0.22, '#e7f5ff', [sx * 0.24, 1.0, -0.05], [0.5, 1, 0.9], [0, 0, -sx * 0.5]);
      k.cyl(0.015, 0.015, 0.25, '#2b2d42', [sx * 0.08, 0.98, 0.52], [0.3, 0, sx * 0.3]);
      k.ball(0.04, '#2b2d42', [sx * 0.12, 1.1, 0.56]);
    }
    k.eyes(0.1, 0.72, 0.7, 0.05);
    k.smile(0.58, 0.73, 0.05);
  },
  butterfly(k) {
    k.ball(0.07, '#5f3dc4', [0, 0.55, 0], [1, 1, 5]);
    k.ball(0.09, '#5f3dc4', [0, 0.58, 0.38]);
    for (const sx of [-1, 1]) {
      k.ball(0.32, '#f783ac', [sx * 0.3, 0.7, 0.05], [1, 1, 0.15], [0, sx * 0.3, sx * 0.3]);
      k.ball(0.22, '#b197fc', [sx * 0.26, 0.4, -0.12], [1, 1, 0.15], [0, sx * 0.3, -sx * 0.3]);
      k.ball(0.09, '#ffd43b', [sx * 0.34, 0.74, 0.12], [1, 1, 0.3], [0, sx * 0.3, 0]);
      k.cyl(0.012, 0.012, 0.3, '#5f3dc4', [sx * 0.06, 0.76, 0.48], [0.6, 0, sx * 0.3]);
      k.ball(0.035, '#ff6b6b', [sx * 0.1, 0.88, 0.58]);
    }
    k.eyes(0.04, 0.6, 0.46, 0.03);
  },
  apple(k) {
    k.ball(0.45, '#fa5252', [0, 0.45, 0], [1, 0.92, 1]);
    k.ball(0.12, '#ff8787', [-0.18, 0.62, 0.32], [1, 1, 0.4]);
    k.cyl(0.03, 0.04, 0.22, '#7a4a21', [0.02, 0.92, 0], [0, 0, -0.2]);
    k.ball(0.12, '#51cf66', [0.14, 0.96, 0], [1.4, 0.35, 0.8], [0, 0, 0.4]);
    k.eyes(0.13, 0.5, 0.42, 0.055);
    k.smile(0.36, 0.43, 0.06);
  },
  banana(k) {
    const pts: V3[] = [];
    for (let i = 0; i <= 8; i++) {
      const a = -0.9 + (i / 8) * 1.8;
      pts.push([Math.sin(a) * 0.55, 0.62 - Math.cos(a) * 0.4, 0]);
    }
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const geo = new THREE.TubeGeometry(curve, 24, 1, 8, false);
    // Taper both ends.
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const ring = Math.floor(i / 9);
      const t = ring / 24;
      const c = curve.getPointAt(Math.min(1, t));
      v.fromBufferAttribute(pos, i).sub(c).normalize().multiplyScalar(0.05 + 0.15 * Math.sin(t * Math.PI));
      pos.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
    }
    geo.computeVertexNormals();
    k.add(geo, '#ffe066', [0, 0.1, 0]);
    k.ball(0.05, '#7a5a21', [pts[0][0], pts[0][1] + 0.1, 0]);
    k.ball(0.05, '#7a5a21', [pts[8][0], pts[8][1] + 0.1, 0]);
    k.eyes(0.1, 0.35, 0.17, 0.045);
    k.smile(0.27, 0.18, 0.04);
  },
  orange(k) {
    k.add(new THREE.IcosahedronGeometry(0.45, 2), '#ff922b', [0, 0.46, 0]);
    k.cyl(0.03, 0.03, 0.12, '#7a4a21', [0, 0.95, 0]);
    k.ball(0.13, '#40c057', [0.15, 0.95, 0], [1.4, 0.3, 0.8], [0, 0, 0.3]);
    k.eyes(0.13, 0.52, 0.42, 0.055);
    k.smile(0.38, 0.43, 0.06);
    k.blush(0.24, 0.42, 0.38);
  },
  cake(k) {
    k.cyl(0.5, 0.52, 0.4, '#ffc9de', [0, 0.2, 0], [0, 0, 0], 16);
    k.torus(0.5, 0.06, '#ffffff', [0, 0.4, 0], [Math.PI / 2, 0, 0], Math.PI * 2, 16);
    k.cyl(0.36, 0.38, 0.3, '#fff0f6', [0, 0.55, 0], [0, 0, 0], 16);
    k.torus(0.36, 0.05, '#f06595', [0, 0.7, 0], [Math.PI / 2, 0, 0], Math.PI * 2, 16);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      k.ball(0.05, ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c'][i % 4], [Math.cos(a) * 0.48, 0.3, Math.sin(a) * 0.48]);
    }
    k.cyl(0.04, 0.04, 0.28, '#74c0fc', [0, 0.84, 0]);
    k.ball(0.09, '#e03131', [0.18, 0.75, 0.12]);
  },
  pumpkin(k) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      k.ball(0.28, i % 2 ? '#ff922b' : '#fd7e14', [Math.cos(a) * 0.22, 0.38, Math.sin(a) * 0.22], [0.75, 1, 0.75]);
    }
    k.ball(0.3, '#ff922b', [0, 0.4, 0]);
    k.cyl(0.05, 0.07, 0.2, '#2b8a3e', [0, 0.76, 0], [0, 0, 0.2]);
    k.ball(0.13, '#51cf66', [0.16, 0.74, 0.05], [1.4, 0.3, 0.8], [0, 0, 0.3]);
    k.eyes(0.13, 0.48, 0.47, 0.055);
    k.smile(0.34, 0.48, 0.08);
  },
  mushroom(k) {
    k.cyl(0.17, 0.22, 0.5, '#fff4e6', [0, 0.25, 0], [0, 0, 0], 12);
    k.add(new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#ff6b6b', [0, 0.5, 0], [1, 0.8, 1]);
    k.cyl(0.5, 0.42, 0.06, '#ffe3e3', [0, 0.5, 0], [0, 0, 0], 14);
    for (const [x, z] of [[0, 0], [0.28, 0.12], [-0.25, 0.2], [0.05, 0.36], [-0.1, -0.3], [0.3, -0.18]]) {
      const y = 0.5 + Math.sqrt(Math.max(0, 0.25 - x * x - z * z)) * 0.8;
      k.ball(0.07, '#ffffff', [x, y, z], [1, 0.4, 1]);
    }
    k.eyes(0.08, 0.3, 0.2, 0.045);
    k.smile(0.2, 0.21, 0.04);
  },
  egg(k) {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI;
      const r = Math.sin(a) * (0.36 + 0.06 * Math.cos(a));
      pts.push(new THREE.Vector2(Math.max(0.001, r), 0.5 - Math.cos(a) * 0.5));
    }
    k.add(new THREE.LatheGeometry(pts, 14), '#fff3d6', [0, 0, 0], [1, 1.1, 1]);
    for (const [x, y, z] of [[0.2, 0.7, 0.2], [-0.15, 0.85, 0.15], [0.1, 0.3, 0.32]] as V3[]) k.ball(0.04, '#e9c46a', [x, y, z], [1, 1, 0.4]);
    k.eyes(0.1, 0.55, 0.34, 0.05);
    k.smile(0.43, 0.35, 0.05);
  },
  tree(k) {
    k.cyl(0.1, 0.14, 0.6, '#8b5a2b', [0, 0.3, 0]);
    k.add(new THREE.IcosahedronGeometry(0.42, 1), '#51cf66', [0, 0.85, 0]);
    k.add(new THREE.IcosahedronGeometry(0.3, 1), '#40c057', [0.25, 1.0, 0.1]);
    k.add(new THREE.IcosahedronGeometry(0.3, 1), '#69db7c', [-0.22, 1.08, -0.05]);
    k.add(new THREE.IcosahedronGeometry(0.26, 1), '#51cf66', [0, 1.28, 0]);
    for (const [x, y, z] of [[0.2, 0.75, 0.33], [-0.25, 0.95, 0.25], [0.1, 1.25, 0.24]] as V3[]) k.ball(0.06, '#fa5252', [x, y, z]);
  },
  flower(k) {
    k.cyl(0.035, 0.04, 0.7, '#40c057', [0, 0.35, 0]);
    for (const sx of [-1, 1]) k.ball(0.12, '#51cf66', [sx * 0.12, 0.3, 0], [1.4, 0.3, 0.7], [0, 0, sx * 0.5]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      k.ball(0.16, '#f783ac', [Math.cos(a) * 0.2, 0.86 + Math.sin(a) * 0.2, 0], [1, 1, 0.4]);
    }
    k.ball(0.13, '#ffd43b', [0, 0.86, 0.04], [1, 1, 0.6]);
    k.eyes(0.05, 0.9, 0.11, 0.03);
  },
  sun(k) {
    k.ball(0.4, '#ffd43b', [0, 0.6, 0]);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      k.cone(0.09, 0.22, '#ffa94d', [Math.cos(a) * 0.52, 0.6 + Math.sin(a) * 0.52, 0], [0, 0, a - Math.PI / 2], 6);
    }
    k.eyes(0.13, 0.68, 0.36, 0.055);
    k.smile(0.52, 0.38, 0.09);
    k.blush(0.24, 0.55, 0.32);
  },
  moon(k) {
    k.add(new THREE.TorusGeometry(0.42, 0.2, 10, 18, Math.PI * 1.15), '#ffe8a3', [0, 0.62, 0], 1, [0, 0, Math.PI * 0.43]);
    k.ball(0.05, '#1d1830', [0.1, 0.72, 0.17], [1, 0.4, 0.5]);
    k.ball(0.06, '#ff9fb8', [0.14, 0.62, 0.16], [1.2, 0.7, 0.4]);
  },
  star(k) {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i / 10) * Math.PI * 2;
      const r = i % 2 ? 0.24 : 0.55;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 2 });
    geo.translate(0, 0, -0.07);
    k.add(geo, '#ffd43b', [0, 0.58, 0]);
    k.eyes(0.1, 0.64, 0.17, 0.05);
    k.smile(0.52, 0.18, 0.05);
  },
  cloud(k) {
    const w = '#ffffff';
    for (const [x, y, r] of [[-0.35, 0.4, 0.28], [0, 0.55, 0.38], [0.35, 0.42, 0.3], [0.18, 0.3, 0.26], [-0.15, 0.28, 0.27]] as V3[]) k.add(new THREE.IcosahedronGeometry(r, 1), w, [x, y, 0], [1, 0.9, 0.8]);
    k.eyes(0.1, 0.52, 0.3, 0.05);
    k.smile(0.4, 0.31, 0.05);
    k.blush(0.2, 0.42, 0.27);
  },
  house(k) {
    k.box(0.8, 0.6, 0.7, '#ffe3c2', [0, 0.3, 0]);
    k.add(new THREE.ConeGeometry(0.66, 0.45, 4), '#ff6b6b', [0, 0.82, 0], [1, 1, 0.88], [0, Math.PI / 4, 0]);
    k.box(0.2, 0.32, 0.04, '#a0522d', [0, 0.16, 0.36]);
    for (const sx of [-1, 1]) k.box(0.18, 0.16, 0.04, '#74c0fc', [sx * 0.25, 0.38, 0.36]);
    k.box(0.12, 0.3, 0.12, '#c92a2a', [0.2, 0.95, -0.1]);
    k.ball(0.03, '#ffd43b', [0.06, 0.16, 0.39]);
  },
  mountain(k) {
    k.add(new THREE.ConeGeometry(0.6, 1.1, 7), '#9775fa', [0, 0.55, 0]);
    k.add(new THREE.ConeGeometry(0.27, 0.32, 7), '#ffffff', [0, 0.95, 0]);
    k.add(new THREE.ConeGeometry(0.4, 0.7, 6), '#b197fc', [0.42, 0.35, 0.12]);
    k.add(new THREE.ConeGeometry(0.16, 0.18, 6), '#ffffff', [0.42, 0.62, 0.12]);
    k.eyes(0.12, 0.5, 0.36, 0.05);
    k.smile(0.4, 0.38, 0.06);
  },
  hat(k) {
    k.cyl(0.55, 0.55, 0.05, '#343a40', [0, 0.03, 0], [0, 0, 0], 16);
    k.cyl(0.32, 0.34, 0.65, '#343a40', [0, 0.37, 0], [0, 0, 0], 16);
    k.cyl(0.345, 0.345, 0.12, '#e03131', [0, 0.14, 0], [0, 0, 0], 16);
    k.ball(0.08, '#ffd43b', [0.25, 0.18, 0.22], [1, 1, 0.5]);
  },
  ball(k) {
    const cols = ['#ff6b6b', '#ffffff', '#4dabf7', '#ffffff', '#ffd43b', '#ffffff'];
    cols.forEach((c, i) => k.add(new THREE.SphereGeometry(0.45, 4, 10, (i / 6) * Math.PI * 2, Math.PI / 3), c, [0, 0.46, 0]));
    k.ball(0.06, '#69db7c', [0, 0.92, 0]);
  },
  boat(k) {
    const hull = new THREE.Shape();
    hull.moveTo(-0.55, 0.3);
    hull.lineTo(0.55, 0.3);
    hull.quadraticCurveTo(0.45, 0, 0.25, 0);
    hull.lineTo(-0.3, 0);
    hull.quadraticCurveTo(-0.5, 0.05, -0.55, 0.3);
    const hg = new THREE.ExtrudeGeometry(hull, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 1 });
    hg.translate(0, 0, -0.2);
    k.add(hg, '#e03131', [0, 0.02, 0], 1, [0, Math.PI / 2, 0]);
    k.box(0.36, 0.06, 0.95, '#ffe8cc', [0, 0.35, 0]);
    k.cyl(0.025, 0.025, 0.95, '#8b5a2b', [0, 0.8, 0.05]);
    const sail = new THREE.Shape();
    sail.moveTo(0, 0);
    sail.lineTo(0, 0.75);
    sail.lineTo(0.5, 0);
    sail.closePath();
    const sg = new THREE.ExtrudeGeometry(sail, { depth: 0.02, bevelEnabled: false });
    k.add(sg, '#ffffff', [0, 0.42, 0.08], 1, [0, -Math.PI / 2, 0]);
    k.box(0.04, 0.12, 0.16, '#ffd43b', [0, 1.22, 0.12]);
    for (const z of [-0.25, 0, 0.25]) k.cyl(0.05, 0.05, 0.02, '#74c0fc', [0.27, 0.2, z], [0, 0, Math.PI / 2], 10);
  },
  rocket(k) {
    k.cyl(0.24, 0.26, 0.75, '#f1f3f5', [0, 0.55, 0], [0, 0, 0], 14);
    k.cone(0.24, 0.38, '#fa5252', [0, 1.11, 0], [0, 0, 0], 14);
    k.cyl(0.11, 0.11, 0.04, '#74c0fc', [0, 0.72, 0.24], [Math.PI / 2, 0, 0], 12);
    k.torus(0.11, 0.025, '#868e96', [0, 0.72, 0.25], [0, 0, 0], Math.PI * 2, 12);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
      k.box(0.05, 0.3, 0.2, '#fa5252', [Math.cos(a) * 0.27, 0.27, Math.sin(a) * 0.27], [0, -a, 0]);
    }
    k.cyl(0.16, 0.2, 0.1, '#495057', [0, 0.13, 0], [0, 0, 0], 12);
  },
  plane(k) {
    k.ball(0.22, '#ffd43b', [0, 0.55, 0], [1, 1, 3]);
    k.box(1.2, 0.05, 0.3, '#4dabf7', [0, 0.52, 0.08]);
    k.box(0.45, 0.04, 0.16, '#4dabf7', [0, 0.6, -0.55]);
    k.box(0.04, 0.24, 0.18, '#4dabf7', [0, 0.72, -0.58]);
    k.cyl(0.04, 0.04, 0.08, '#495057', [0, 0.55, 0.68], [Math.PI / 2, 0, 0]);
    k.box(0.06, 0.45, 0.03, '#868e96', [0, 0.55, 0.72]);
    for (const z of [0.1, -0.1, -0.3]) for (const sx of [-1, 1]) k.ball(0.05, '#a5d8ff', [sx * 0.2, 0.62, z], [0.4, 1, 1]);
    k.cyl(0.03, 0.03, 0.3, '#495057', [0, 0.28, 0.12]);
    k.cyl(0.07, 0.07, 0.05, '#343a40', [0, 0.12, 0.12], [0, 0, Math.PI / 2]);
  },
  bus(k) {
    k.box(0.62, 0.55, 1.15, '#ffd43b', [0, 0.45, 0]);
    k.box(0.64, 0.06, 1.17, '#ff922b', [0, 0.32, 0]);
    for (const z of [-0.35, -0.05, 0.25]) for (const sx of [-1, 1]) k.box(0.02, 0.18, 0.22, '#a5d8ff', [sx * 0.32, 0.56, z]);
    k.box(0.5, 0.2, 0.02, '#a5d8ff', [0, 0.57, 0.58]);
    for (const sx of [-1, 1]) {
      k.ball(0.05, '#fff3bf', [sx * 0.2, 0.3, 0.58]);
      for (const z of [-0.35, 0.35]) k.cyl(0.14, 0.14, 0.1, '#343a40', [sx * 0.3, 0.15, z], [0, 0, Math.PI / 2], 12);
    }
  },
  bike(k) {
    for (const z of [-0.38, 0.38]) {
      k.torus(0.28, 0.04, '#343a40', [0, 0.3, z], [0, Math.PI / 2, 0], Math.PI * 2, 18);
      k.cyl(0.04, 0.04, 0.06, '#ffd43b', [0, 0.3, z], [0, 0, Math.PI / 2]);
    }
    const red = '#ff6b6b';
    k.cyl(0.03, 0.03, 0.55, red, [0, 0.42, 0], [Math.PI / 2 - 0.3, 0, 0]);
    k.cyl(0.03, 0.03, 0.4, red, [0, 0.45, -0.2], [0.5, 0, 0]);
    k.cyl(0.03, 0.03, 0.4, red, [0, 0.45, 0.3], [-0.35, 0, 0]);
    k.cyl(0.03, 0.03, 0.4, red, [0, 0.3, -0.25], [Math.PI / 2, 0, 0]);
    k.box(0.12, 0.04, 0.2, '#495057', [0, 0.66, -0.25]);
    k.cyl(0.025, 0.025, 0.4, '#495057', [0, 0.68, 0.36], [0, 0, Math.PI / 2]);
    k.ball(0.05, '#fff3bf', [0, 0.6, 0.44]);
  },
  train(k) {
    k.cyl(0.26, 0.26, 0.7, '#e03131', [0, 0.48, 0.15], [Math.PI / 2, 0, 0], 14);
    k.box(0.6, 0.65, 0.42, '#1971c2', [0, 0.55, -0.35]);
    k.box(0.7, 0.08, 0.5, '#343a40', [0, 0.9, -0.35]);
    k.box(0.4, 0.2, 0.02, '#a5d8ff', [0, 0.65, -0.13]);
    k.cyl(0.08, 0.11, 0.25, '#343a40', [0, 0.85, 0.32]);
    k.cyl(0.12, 0.12, 0.04, '#ffd43b', [0, 0.48, 0.52], [Math.PI / 2, 0, 0]);
    k.box(0.66, 0.1, 1.15, '#343a40', [0, 0.18, -0.05]);
    for (const sx of [-1, 1]) for (const z of [-0.4, 0, 0.35]) k.cyl(0.13, 0.13, 0.06, '#ffd43b', [sx * 0.33, 0.16, z], [0, 0, Math.PI / 2], 12);
    k.cone(0.2, 0.25, '#ffd43b', [0, 0.12, 0.62], [Math.PI / 2, 0, 0], 4);
  },
  robot(k) {
    k.box(0.5, 0.42, 0.4, '#adb5bd', [0, 0.5, 0]);
    k.box(0.22, 0.16, 0.02, '#ff8787', [0, 0.52, 0.21]);
    k.box(0.5, 0.38, 0.4, '#ced4da', [0, 0.95, 0]);
    k.box(0.38, 0.18, 0.02, '#343a40', [0, 0.98, 0.21]);
    k.cyl(0.02, 0.02, 0.18, '#868e96', [0, 1.22, 0]);
    k.ball(0.06, '#ff6b6b', [0, 1.33, 0]);
    for (const sx of [-1, 1]) {
      k.box(0.12, 0.34, 0.12, '#868e96', [sx * 0.33, 0.48, 0], [0, 0, sx * 0.2]);
      k.box(0.14, 0.28, 0.16, '#868e96', [sx * 0.13, 0.14, 0]);
      k.ball(0.06, '#4dabf7', [sx * 0.29, 0.95, 0]);
    }
  },
};

/* ───────────────────────── Merging & glow ───────────────────────── */

/** Merge every flat-colour mesh of a model into one vertex-coloured mesh. */
export function mergeModel(root: THREE.Group, opts: { receive?: boolean; emissive?: number } = {}): THREE.Group {
  root.updateMatrixWorld(true);
  const geos: THREE.BufferGeometry[] = [];
  const done: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mt = m.material as THREE.MeshLambertMaterial;
    if (!mt.isMeshLambertMaterial || mt.transparent) return;
    let g = m.geometry.clone();
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.applyMatrix4(m.matrixWorld);
    const n = g.attributes.position.count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      cols[i * 3] = mt.color.r;
      cols[i * 3 + 1] = mt.color.g;
      cols[i * 3 + 2] = mt.color.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geos.push(g);
    done.push(m);
  });
  const mats = new Set<THREE.Material>();
  for (const m of done) {
    m.parent?.remove(m);
    m.geometry.dispose();
    mats.add(m.material as THREE.Material);
  }
  mats.forEach((m) => m.dispose());
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  if (merged) {
    const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: new THREE.Color(opts.emissive ?? 0) }));
    mesh.castShadow = true;
    mesh.receiveShadow = Boolean(opts.receive);
    root.add(mesh);
  }
  return root;
}

/** Glowy extras that make some objects shine (not merged). */
function extras(id: PropId, g: THREE.Group) {
  if (id === 'rocket') {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 8), glowMat('#ffb347', 1.6));
    flame.rotation.x = Math.PI;
    flame.position.y = -0.12;
    flame.name = 'flame';
    const halo = glow('#ffb347', 0.9, 0.7);
    halo.position.y = -0.1;
    g.add(flame, halo);
  }
  if (id === 'cake') {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), glowMat('#ffd166', 2));
    f.scale.y = 1.6;
    f.position.y = 1.05;
    f.name = 'flame';
    const halo = glow('#ffd166', 0.6, 0.8);
    halo.position.y = 1.05;
    g.add(f, halo);
  }
  if (id === 'sun' || id === 'star' || id === 'moon') {
    const halo = glow(id === 'moon' ? '#fff3bf' : '#ffe066', 2.0, 0.45);
    halo.position.y = 0.6;
    g.add(halo);
  }
  if (id === 'robot') {
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), glowMat('#69f0ff', 1.8));
      eye.position.set(sx * 0.09, 0.98, 0.22);
      g.add(eye);
    }
  }
  if (id === 'bee') {
    // See-through wings would not merge: the wings stay pale opaque felt; a sparkle around.
    const halo = glow('#fff3bf', 1.3, 0.25);
    halo.position.y = 0.6;
    g.add(halo);
  }
}

/**
 * Build the object of a word, about `size` tall, standing on y = 0 and
 * facing +z. `userData.spin` objects (props) can idle-animate.
 */
export function makeProp(id: PropId, size = 1): THREE.Group {
  const k = new Kit();
  BUILD[id](k);
  const g = mergeModel(k.g);
  extras(id, g);
  // Normalise: `size` tall at most, on the ground, centred.
  const box = new THREE.Box3();
  g.children.forEach((c) => {
    if ((c as THREE.Mesh).isMesh && c.name !== 'flame') box.expandByObject(c);
  });
  const dim = box.getSize(new THREE.Vector3());
  const s = size / Math.max(dim.y, dim.x * 0.85, dim.z * 0.8, 0.01);
  const pivot = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(...g.children);
  const c = box.getCenter(new THREE.Vector3());
  inner.position.set(-c.x * s, -box.min.y * s, -c.z * s);
  inner.scale.setScalar(s);
  pivot.add(inner);
  pivot.userData.prop = id;
  pivot.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return pivot;
}

/** Little wings for the flying cow (they flap: `userData.wings`). */
export function makeFlyingCow(): THREE.Group {
  const cow = makeProp('cow', 2.2);
  const wings: THREE.Object3D[] = [];
  const wm = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: new THREE.Color('#e7f5ff').multiplyScalar(0.35), flatShading: true });
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.45, 1.35, -0.1);
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.32 - i * 0.06, 10, 6), wm);
      f.scale.set(1.6, 0.18, 0.7);
      f.position.set(sx * (0.38 + i * 0.22), 0.02 - i * 0.05, -i * 0.12);
      pivot.add(f);
    }
    pivot.userData.side = sx;
    wings.push(pivot);
    cow.add(pivot);
  }
  // A tiny red cape, for the superhero cow.
  const cape = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 4, 1, true), new THREE.MeshLambertMaterial({ color: '#ff6b6b', side: THREE.DoubleSide, flatShading: true }));
  cape.position.set(0, 1.15, -0.75);
  cape.rotation.set(-1.25, Math.PI / 4, 0);
  cape.scale.set(1, 1, 0.25);
  cow.add(cape);
  cow.userData.wings = wings;
  return cow;
}
