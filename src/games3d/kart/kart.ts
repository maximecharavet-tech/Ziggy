import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { glow, glowMat } from '../kit/look';
import { Kit, mergeModel } from './props';

/**
 * Ziggy's little kart (coral body, sunny side pods, rainbow spoiler, a "Z"
 * on the nose), its trailer for the word objects, and a striped scarf tail
 * that flaps in the wind. Origin on the road, +z forward.
 */

export interface KartModel {
  root: THREE.Group;
  /** Visual body: bounces, leans and corkscrews (Ziggy rides in it). */
  body: THREE.Group;
  /** Where Ziggy sits. */
  seat: THREE.Group;
  wheels: THREE.Object3D[];
  steer: THREE.Object3D[];
  flag: THREE.Object3D;
  /** Exhaust pipe ends (body space). */
  exhaust: THREE.Vector3[];
}

function zDecal(font: string): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(64, 64, 60, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = '#ffd23f';
  g.stroke();
  g.fillStyle = '#4c9a3a';
  g.font = `bold 92px ${font}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('Z', 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), new THREE.MeshLambertMaterial({ map: t, transparent: true }));
}

function wheel(r: number, w: number): THREE.Group {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 18), new THREE.MeshLambertMaterial({ color: '#3b3552', flatShading: true }));
  tire.rotation.z = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.52, r * 0.52, w + 0.02, 10), new THREE.MeshLambertMaterial({ color: '#ffd23f', flatShading: true }));
  hub.rotation.z = Math.PI / 2;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.2, w + 0.06, 8), new THREE.MeshLambertMaterial({ color: '#ffffff' }));
  cap.rotation.z = Math.PI / 2;
  // Tread bumps so the spin can be seen.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, r * 0.18, r * 0.3), new THREE.MeshLambertMaterial({ color: '#2a2540' }));
    b.position.set(0, Math.cos(a) * r, Math.sin(a) * r);
    b.rotation.x = a;
    g.add(b);
  }
  g.add(tire, hub, cap);
  g.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
  return g;
}

export function makeKart(font: string): KartModel {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const k = new Kit();
  const coral = '#ff5a6e';
  const sun = '#ffd23f';
  const purple = '#7b61ff';
  k.add(new RoundedBoxGeometry(1.7, 0.44, 2.6, 2, 0.16), coral, [0, 0.52, -0.05]);
  k.add(new RoundedBoxGeometry(1.15, 0.36, 1.0, 2, 0.14), coral, [0, 0.5, 1.45]);
  k.add(new THREE.CapsuleGeometry(0.15, 1.3, 4, 8), sun, [0, 0.36, 1.98], 1, [0, 0, Math.PI / 2]);
  for (const sx of [-1, 1]) {
    k.add(new THREE.CapsuleGeometry(0.23, 1.3, 4, 10), sun, [sx * 0.92, 0.44, 0.0], 1, [Math.PI / 2, 0, 0]);
    k.box(0.06, 0.08, 1.6, '#ffffff', [sx * 0.86, 0.75, 0.0]);
  }
  // Cockpit rim and seat back.
  k.add(new THREE.TorusGeometry(0.62, 0.09, 6, 20), purple, [0, 0.76, -0.15], [1, 1.25, 1], [Math.PI / 2, 0, 0]);
  k.add(new RoundedBoxGeometry(1.05, 0.85, 0.2, 2, 0.08), purple, [0, 1.05, -0.78], 1, [-0.15, 0, 0]);
  k.add(new RoundedBoxGeometry(1.2, 0.26, 0.4, 2, 0.08), coral, [0, 0.82, 0.78]);
  // Steering column and wheel.
  k.cyl(0.035, 0.035, 0.4, '#495057', [0, 0.98, 0.66], [0.9, 0, 0]);
  k.add(new THREE.TorusGeometry(0.21, 0.045, 6, 16), '#343a40', [0, 1.12, 0.5], 1, [-0.7, 0, 0]);
  // Rainbow spoiler.
  for (const sx of [-1, 1]) k.box(0.08, 0.5, 0.12, '#ffffff', [sx * 0.6, 1.0, -1.3]);
  ['#ff8a8a', '#ffb36b', '#ffe170', '#93e6a0', '#7cc4ff', '#b79cff'].forEach((c, i) => k.box(0.32, 0.08, 0.42, c, [-0.8 + i * 0.32, 1.27, -1.32]));
  // Exhaust pipes.
  for (const sx of [-1, 1]) k.cyl(0.09, 0.11, 0.35, '#ced4da', [sx * 0.38, 0.5, -1.42], [Math.PI / 2, 0, 0], 10);
  // Wheel arches.
  for (const sx of [-1, 1]) for (const z of [0.95, -0.95]) k.add(new THREE.TorusGeometry(0.46, 0.06, 4, 12, Math.PI), coral, [sx * 0.98, 0.42, z], 1, [0, Math.PI / 2, 0]);
  const shell = mergeModel(k.g, { emissive: 0x1a0a10 });
  body.add(shell);

  const decal = zDecal(font);
  decal.position.set(0, 0.69, 1.42);
  decal.rotation.x = -Math.PI / 2 + 0.12;
  body.add(decal);

  // Headlights.
  for (const sx of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), glowMat('#fff6d0', 1.05));
    l.position.set(sx * 0.4, 0.55, 1.96);
    const h = glow('#fff1c4', 0.45, 0.35);
    h.position.copy(l.position).add(new THREE.Vector3(0, 0, 0.08));
    body.add(l, h);
  }

  // Wheels: front ones steer.
  const wheels: THREE.Object3D[] = [];
  const steer: THREE.Object3D[] = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(sx * 0.98, 0.38, 0.95);
    const wf = wheel(0.38, 0.32);
    piv.add(wf);
    body.add(piv);
    steer.push(piv);
    wheels.push(wf);
    const wr = wheel(0.43, 0.38);
    wr.position.set(sx * 1.0, 0.43, -0.95);
    body.add(wr);
    wheels.push(wr);
  }

  // A little pennant with a star.
  const flag = new THREE.Group();
  flag.position.set(0.62, 1.32, -1.3);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 5), new THREE.MeshLambertMaterial({ color: '#ffffff' }));
  pole.position.y = 0.45;
  const tri = new THREE.Shape();
  tri.moveTo(0, 0);
  tri.lineTo(0, 0.3);
  tri.lineTo(-0.55, 0.15);
  tri.closePath();
  const pen = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshLambertMaterial({ color: '#ff7eb6', side: THREE.DoubleSide }));
  pen.position.set(0, 0.6, 0);
  pen.rotation.y = -Math.PI / 2;
  pen.name = 'pennant';
  flag.add(pole, pen);
  body.add(flag);

  const seat = new THREE.Group();
  seat.position.set(0, 0.4, -0.22);
  body.add(seat);

  body.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  decal.castShadow = false;
  return { root, body, seat, wheels, steer, flag, exhaust: [new THREE.Vector3(-0.38, 0.5, -1.65), new THREE.Vector3(0.38, 0.5, -1.65)] };
}

export interface TrailerModel {
  root: THREE.Group;
  body: THREE.Group;
  slots: THREE.Group[];
  wheels: THREE.Object3D[];
}

/** The little trailer where the word objects ride (six seats). */
export function makeTrailer(): TrailerModel {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const k = new Kit();
  const blue = '#74c0fc';
  k.add(new RoundedBoxGeometry(1.7, 0.16, 1.6, 2, 0.06), blue, [0, 0.42, 0]);
  for (const sx of [-1, 1]) k.add(new RoundedBoxGeometry(0.12, 0.38, 1.6, 2, 0.05), blue, [sx * 0.8, 0.62, 0]);
  for (const sz of [-1, 1]) k.add(new RoundedBoxGeometry(1.7, 0.38, 0.12, 2, 0.05), blue, [0, 0.62, sz * 0.75]);
  for (const sx of [-1, 1]) k.box(0.16, 0.06, 1.66, '#ffffff', [sx * 0.8, 0.83, 0]);
  for (const sz of [-1, 1]) k.box(1.76, 0.06, 0.16, '#ffffff', [0, 0.83, sz * 0.75]);
  k.cyl(0.05, 0.05, 1.1, '#adb5bd', [0, 0.4, 1.3], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 5; i++) k.ball(0.07, ['#ff8a8a', '#ffe170', '#93e6a0', '#7cc4ff', '#b79cff'][i], [-0.6 + i * 0.3, 0.62, 0.82], [1, 1, 0.5]);
  body.add(mergeModel(k.g, { emissive: 0x101820 }));
  const wheels: THREE.Object3D[] = [];
  for (const sx of [-1, 1]) {
    const w = wheel(0.3, 0.24);
    w.position.set(sx * 0.95, 0.3, -0.1);
    body.add(w);
    wheels.push(w);
  }
  const slots: THREE.Group[] = [];
  for (const z of [0.38, -0.38])
    for (const x of [-0.5, 0, 0.5]) {
      const s = new THREE.Group();
      s.position.set(x, 0.5, z);
      body.add(s);
      slots.push(s);
    }
  body.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return { root, body, slots, wheels };
}

/** A long striped scarf tail that streams behind Ziggy's neck. */
export class ScarfTail {
  readonly mesh: THREE.Mesh;
  private n = 12;
  private len = 1.05;
  private pos: Float32Array;

  constructor() {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 64;
    const g = c.getContext('2d')!;
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? '#fdf5ea' : '#e2453c';
      g.fillRect(0, i * 16, 16, 16);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 3);
    const geo = new THREE.BufferGeometry();
    const n = this.n;
    this.pos = new Float32Array((n + 1) * 2 * 3);
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      uv.push(0, i / n, 1, i / n);
      if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.update(0, 0, 0);
  }

  /** wind: 0 (hanging) .. 1 (streaming). Ziggy-model space, from the back of the neck. */
  update(t: number, wind: number, motion: number) {
    const n = this.n;
    const base = new THREE.Vector3(0.1, 1.08, -0.24);
    const w = 0.085;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const flap = Math.sin(t * 15 - u * 6) * 0.1 * u * wind * motion;
      const sway = Math.sin(t * 9 - u * 4) * 0.12 * u * (0.3 + wind) * motion;
      const x = base.x + sway + u * 0.08;
      const y = base.y - u * this.len * (1 - wind) * 0.9 + u * wind * 0.18 + flap;
      const z = base.z - u * this.len * (0.15 + wind * 0.85);
      this.pos.set([x - w, y, z], i * 6);
      this.pos.set([x + w, y, z], i * 6 + 3);
    }
    const geo = this.mesh.geometry;
    (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }
}
