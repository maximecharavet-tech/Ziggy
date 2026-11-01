import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CompanionId } from '@/data/types';
import { glow, glowMat, mat } from '../kit/look';

/**
 * The eight companions, modelled in code: low-poly, round, big shiny eyes,
 * pink cheeks. Every rig has the same parts so one animation code drives all:
 *   root ─ body (breathing, squash) ─ head (looks at the pointer, blinks)
 * plus "wiggles" (tail, wings, ears) and anchors for the growth accessories.
 */
/** What the garden tells a rig with its own animation (Ziggy), every frame. */
export interface RigState {
  walking: boolean;
  sleeping: boolean;
  party: boolean;
  carrying: boolean;
}

/** One-shot reactions of a rig with its own animation. */
export type RigReaction = 'joy' | 'bigJoy' | 'love';

export interface CompanionRig {
  id: CompanionId | 'ziggy';
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  eyes: THREE.Object3D[];
  /** 0 = smile, 1 = mouth wide open (yawn, munch). */
  setMouth: (open: number) => void;
  wiggles: { obj: THREE.Object3D; axis: 'x' | 'y' | 'z'; amp: number; speed: number; base: number; phase: number }[];
  /** Scarf anchor (on the body) with its radius. */
  neck: THREE.Object3D;
  /** Crown anchor (on top of the head). */
  crown: THREE.Object3D;
  /** Lives in water (the dolphin). */
  aquatic: boolean;
  /** Height of the mouth above the root, at scale 1 (where food goes). */
  mouthY: number;
  /** Invisible, generous hit box for little fingers. */
  hitbox: THREE.Mesh;
  /** Turn a little when facing the child, so a four-legged body shows in 3/4 view. */
  idleYaw?: number;
  /** Rigs with their own animation (Ziggy): run after the shared motion, every frame. */
  tick?: (dt: number, state: RigState) => void;
  react?: (kind: RigReaction) => void;
  /** Own growth outfits instead of the shared scarf and crowns; returns what it added. */
  dress?: (stage: number) => THREE.Object3D[];
  /** Where a carried ball goes (in the hands); the mouth when absent. */
  carryAt?: THREE.Object3D;
}

const Z = new THREE.Vector3(0, 0, 1);

const shade = (c: string, k: number) => {
  const col = new THREE.Color(c);
  return k >= 0 ? col.lerp(new THREE.Color('#ffffff'), k) : col.lerp(new THREE.Color('#000000'), -k);
};

function ball(r: number, color: THREE.ColorRepresentation, ws = 16, hs = 12) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat(color));
  m.castShadow = true;
  return m;
}
function put<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, sx = 1, sy = sx, sz = sx): T {
  o.position.set(x, y, z);
  o.scale.set(sx, sy, sz);
  return o;
}

function makeEye(size: number, iris?: string): THREE.Group {
  const g = new THREE.Group();
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(size, 18, 14), new THREE.MeshPhongMaterial({ color: '#231a2b', shininess: 120, specular: '#666677' }));
  g.add(pupil);
  if (iris) {
    const ir = new THREE.Mesh(new THREE.SphereGeometry(size * 0.72, 16, 12), new THREE.MeshPhongMaterial({ color: iris, shininess: 100 }));
    ir.position.z = size * 0.42;
    ir.scale.z = 0.5;
    const p2 = new THREE.Mesh(new THREE.SphereGeometry(size * 0.42, 12, 10), new THREE.MeshPhongMaterial({ color: '#160f1c', shininess: 120 }));
    p2.position.z = size * 0.62;
    p2.scale.z = 0.4;
    g.add(ir, p2);
  }
  const hi = new THREE.Mesh(new THREE.SphereGeometry(size * 0.34, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  hi.position.set(size * 0.36, size * 0.38, size * 0.78);
  const hi2 = new THREE.Mesh(new THREE.SphereGeometry(size * 0.15, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  hi2.position.set(-size * 0.3, -size * 0.32, size * 0.86);
  g.add(hi, hi2);
  g.scale.z = 0.62;
  return g;
}

function makeMouth(size: number, color = '#4a2430') {
  const g = new THREE.Group();
  const smile = new THREE.Mesh(new THREE.TorusGeometry(size, size * 0.28, 6, 12, Math.PI), mat(color));
  smile.rotation.z = Math.PI;
  const open = new THREE.Mesh(new THREE.SphereGeometry(size * 1.05, 12, 10), new THREE.MeshLambertMaterial({ color: '#7a2c3e' }));
  open.scale.set(1, 1.15, 0.4);
  open.position.y = -size * 0.3;
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(size * 0.6, 10, 8), mat('#ff8fa8'));
  tongue.position.set(0, -size * 0.75, size * 0.2);
  tongue.scale.set(1, 0.6, 0.5);
  open.add(tongue);
  open.visible = false;
  g.add(smile, open);
  const setMouth = (k: number) => {
    open.visible = k > 0.05;
    smile.visible = !open.visible;
    open.scale.set(0.6 + k * 0.5, (0.4 + k * 0.9) * 1.15, 0.4);
  };
  return { g, setMouth };
}

function cheeks(parent: THREE.Object3D, r: number, y: number, z: number, x: number) {
  const m = new THREE.MeshBasicMaterial({ color: '#ff9fb8', transparent: true, opacity: 0.75 });
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), m);
    c.position.set(s * x, y, z);
    c.scale.set(1, 0.6, 0.35);
    c.quaternion.setFromUnitVectors(Z, new THREE.Vector3(s * x, 0, z).normalize());
    parent.add(c);
  }
}

function hitbox(r: number, y: number) {
  const h = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  h.position.y = y;
  h.userData.hitbox = true;
  return h;
}

/** A standard face on a head sphere of radius R (centre at `c`). */
function face(
  head: THREE.Group,
  R: number,
  c: THREE.Vector3,
  opts: { eye?: number; eyeX?: number; eyeY?: number; mouthY?: number; mouthZ?: number; iris?: string; mouthColor?: string; noCheeks?: boolean }
) {
  const eyes: THREE.Object3D[] = [];
  const es = R * (opts.eye ?? 0.24);
  for (const s of [-1, 1]) {
    const e = makeEye(es, opts.iris);
    const ex = R * (opts.eyeX ?? 0.4);
    const ey = R * (opts.eyeY ?? 0.08);
    const ez = Math.sqrt(Math.max(0.01, R * R - ex * ex - ey * ey)) * 0.97;
    e.position.set(c.x + s * ex, c.y + ey, c.z + ez);
    e.quaternion.setFromUnitVectors(Z, new THREE.Vector3(s * ex * 0.6, ey * 0.3, ez).normalize());
    head.add(e);
    eyes.push(e);
  }
  const mouth = makeMouth(R * 0.11, opts.mouthColor);
  mouth.g.position.set(c.x, c.y + R * (opts.mouthY ?? -0.32), c.z + R * (opts.mouthZ ?? 0.93));
  head.add(mouth.g);
  if (!opts.noCheeks) cheeks(head, R * 0.15, c.y - R * 0.18, c.z + R * 0.8, R * 0.58);
  return { eyes, setMouth: mouth.setMouth };
}

function biped(color: string, belly: string, bodyR = 0.5) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const torso = put(ball(bodyR, color), 0, bodyR * 1.05, 0, 1, 1, 0.92);
  const tummy = put(ball(bodyR * 0.62, belly), 0, bodyR * 1.05, bodyR * 0.62, 1, 0.98, 0.5);
  body.add(torso, tummy);
  for (const s of [-1, 1]) {
    const foot = put(ball(bodyR * 0.36, shade(color, -0.12)), s * bodyR * 0.48, bodyR * 0.2, bodyR * 0.25, 1, 0.62, 1.3);
    root.add(foot);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(bodyR * 0.17, bodyR * 0.42, 4, 8), mat(color));
    arm.position.set(s * bodyR * 0.92, bodyR * 1.0, bodyR * 0.18);
    arm.rotation.z = s * 0.55;
    arm.castShadow = true;
    body.add(arm);
  }
  const head = new THREE.Group();
  head.position.y = bodyR * 1.75;
  body.add(head);
  const neck = new THREE.Object3D();
  neck.position.y = bodyR * 1.72;
  neck.userData.r = bodyR * 0.62;
  body.add(neck);
  return { root, body, head, neck };
}

/* ───────────────────────── The eight companions ───────────────────────── */

function dragon(color: string): CompanionRig {
  const { root, body, head, neck } = biped(color, '#e9f7b0');
  const R = 0.58;
  const c = new THREE.Vector3(0, R * 0.9, 0.05);
  head.add(put(ball(R, color), c.x, c.y, c.z, 1, 0.95, 0.95));
  const snout = put(ball(R * 0.42, shade(color, 0.3)), 0, c.y - R * 0.42, c.z + R * 0.66, 1.25, 0.62, 0.7);
  head.add(snout);
  for (const s of [-1, 1]) {
    const n = put(ball(R * 0.045, '#2c5a2e', 6, 4), s * R * 0.15, c.y - R * 0.3, c.z + R * 0.96);
    head.add(n);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(R * 0.15, R * 0.5, 7), mat('#ffe9a8'));
    horn.position.set(s * R * 0.4, c.y + R * 1.0, c.z - R * 0.12);
    horn.rotation.z = -s * 0.35;
    head.add(horn);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(R * 0.16, R * 0.4, 4), mat(shade(color, 0.3)));
    fin.position.set(s * R * 0.92, c.y + R * 0.15, c.z - R * 0.05);
    fin.rotation.z = -s * 1.25;
    fin.scale.z = 0.4;
    head.add(fin);
  }
  const f = face(head, R, c, { eye: 0.26, eyeY: 0.14, mouthY: -0.55, mouthZ: 0.98 });
  // Wings: rounded membranes on a pivot at the shoulders.
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.quadraticCurveTo(0.35, 0.55, 0.75, 0.42);
  wingShape.quadraticCurveTo(0.62, 0.22, 0.7, 0.05);
  wingShape.quadraticCurveTo(0.5, 0.0, 0.52, -0.18);
  wingShape.quadraticCurveTo(0.25, -0.08, 0, 0);
  const wingGeo = new THREE.ShapeGeometry(wingShape, 6);
  const wiggles: CompanionRig['wiggles'] = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.22, 0.85, -0.38);
    const w = new THREE.Mesh(wingGeo, mat('#b8f0a0', { side: THREE.DoubleSide }));
    w.scale.set(s, 1, 1);
    w.rotation.y = s * 0.5;
    w.castShadow = true;
    pivot.add(w);
    body.add(pivot);
    wiggles.push({ obj: pivot, axis: 'y', amp: 0.35, speed: 3.2, base: s * -0.25, phase: s > 0 ? 0 : Math.PI });
  }
  // Back spikes and tail.
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 5), mat('#fff1c2'));
    sp.position.set(0, 0.95 - i * 0.22, -0.45 + i * 0.02);
    sp.rotation.x = -0.6 - i * 0.2;
    body.add(sp);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.32, -0.38);
  const t1 = put(ball(0.22, color), 0, 0, -0.18, 1, 1, 1.3);
  const t2 = put(ball(0.15, color), 0.04, 0.06, -0.48, 1, 1, 1.3);
  const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), mat('#fff1c2'));
  tip.position.set(0.06, 0.15, -0.7);
  tip.scale.set(1, 1, 0.5);
  tail.add(t1, t2, tip);
  body.add(tail);
  wiggles.push({ obj: tail, axis: 'y', amp: 0.4, speed: 2.4, base: 0, phase: 0 });
  return { id: 'dragon', root, body, head, eyes: f.eyes, setMouth: f.setMouth, wiggles, neck, crown: anchorCrown(head, c.y + R * 0.92), aquatic: false, mouthY: 1.2, hitbox: addHit(root, 1.0, 0.95) };
}

function unicorn(color: string): CompanionRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const coat = '#fbf3ff';
  body.add(put(ball(0.5, coat), 0, 0.72, -0.05, 0.95, 0.85, 1.2));
  const hoof = shade(color, -0.15);
  for (const [x, z] of [
    [-0.25, 0.3],
    [0.25, 0.3],
    [-0.25, -0.38],
    [0.25, -0.38],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.42, 8), mat(coat));
    leg.position.set(x, 0.28, z);
    leg.castShadow = true;
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.12, 8), mat(hoof));
    h.position.set(x, 0.06, z);
    root.add(leg, h);
  }
  const head = new THREE.Group();
  head.position.set(0, 1.0, 0.42);
  body.add(head);
  const R = 0.44;
  const c = new THREE.Vector3(0, R * 0.75, 0.05);
  head.add(put(ball(R, coat), c.x, c.y, c.z));
  head.add(put(ball(R * 0.55, '#ffe0ef'), 0, c.y - R * 0.38, c.z + R * 0.62, 1.1, 0.8, 0.8));
  for (const s of [-1, 1]) {
    head.add(put(ball(R * 0.05, '#c27a9a', 6, 4), s * R * 0.17, c.y - R * 0.3, c.z + R * 1.05));
    const ear = new THREE.Mesh(new THREE.ConeGeometry(R * 0.18, R * 0.42, 6), mat(coat));
    ear.position.set(s * R * 0.55, c.y + R * 0.85, c.z - R * 0.2);
    ear.rotation.z = -s * 0.4;
    head.add(ear);
  }
  // Golden spiral horn.
  const horn = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(R * 0.16, R * 0.85, 10), new THREE.MeshPhongMaterial({ color: '#ffd76a', shininess: 90, flatShading: true }));
  horn.add(cone);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R * (0.13 - i * 0.035), R * 0.025, 5, 12), mat('#ffbf3c'));
    ring.rotation.x = Math.PI / 2 + 0.3;
    ring.position.y = -R * 0.2 + i * R * 0.2;
    horn.add(ring);
  }
  horn.position.set(0, c.y + R * 1.18, c.z + R * 0.25);
  horn.rotation.x = 0.25;
  const hornGlow = glow('#fff2a6', 0.8, 0.45);
  hornGlow.position.copy(horn.position);
  head.add(horn, hornGlow);
  const f = face(head, R, c, { eye: 0.26, eyeY: 0.12, mouthY: -0.5, mouthZ: 1.05, iris: '#7a4bc2' });
  // Pastel mane and tail.
  const pastel = [color, '#ffb3d9', '#9fd8ff', '#fff0a0', '#b8f0c8'];
  for (let i = 0; i < 6; i++) {
    const m = ball(R * (0.3 - i * 0.02), pastel[i % pastel.length], 10, 8);
    m.position.set(0, c.y + R * (0.9 - i * 0.32), c.z - R * (0.35 + i * 0.12));
    head.add(m);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.85, -0.62);
  for (let i = 0; i < 5; i++) {
    const m = ball(0.16 - i * 0.015, pastel[i % pastel.length], 10, 8);
    m.position.set(Math.sin(i) * 0.05, -i * 0.12, -i * 0.08);
    tail.add(m);
  }
  body.add(tail);
  const neck = new THREE.Object3D();
  neck.position.set(0, 1.02, 0.3);
  neck.rotation.x = -0.5;
  neck.userData.r = 0.28;
  body.add(neck);
  return {
    id: 'unicorn',
    root,
    body,
    head,
    eyes: f.eyes,
    setMouth: f.setMouth,
    wiggles: [{ obj: tail, axis: 'y', amp: 0.35, speed: 2.6, base: 0, phase: 0 }],
    neck,
    crown: anchorCrown(head, c.y + R * 0.92),
    aquatic: false,
    mouthY: 1.1,
    hitbox: addHit(root, 0.95, 0.85),
    idleYaw: 0.6,
  };
}

function fox(color: string): CompanionRig {
  const { root, body, head, neck } = biped(color, '#fff6ea');
  const R = 0.56;
  const c = new THREE.Vector3(0, R * 0.85, 0.05);
  head.add(put(ball(R, color), c.x, c.y, c.z, 1.05, 0.95, 0.95));
  // White cheeks and muzzle.
  head.add(put(ball(R * 0.62, '#fff6ea'), 0, c.y - R * 0.32, c.z + R * 0.5, 1.25, 0.72, 0.85));
  head.add(put(ball(R * 0.1, '#2a1d22', 8, 6), 0, c.y - R * 0.12, c.z + R * 1.08));
  const wiggles: CompanionRig['wiggles'] = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(s * R * 0.5, c.y + R * 0.72, c.z - R * 0.05);
    const outer = new THREE.Mesh(new THREE.ConeGeometry(R * 0.3, R * 0.7, 4), mat(color));
    outer.position.y = R * 0.3;
    outer.scale.z = 0.55;
    const inner = new THREE.Mesh(new THREE.ConeGeometry(R * 0.18, R * 0.45, 4), mat('#4a2c2a'));
    inner.position.set(0, R * 0.25, R * 0.07);
    inner.scale.z = 0.4;
    ear.add(outer, inner);
    ear.rotation.z = -s * 0.32;
    head.add(ear);
    wiggles.push({ obj: ear, axis: 'z', amp: 0.08, speed: 1.6, base: -s * 0.32, phase: s });
  }
  const f = face(head, R, c, { eye: 0.23, eyeY: 0.14, mouthY: -0.42, mouthZ: 1.0 });
  // Big fluffy tail with a white tip.
  const tail = new THREE.Group();
  tail.position.set(0.1, 0.3, -0.38);
  const t1 = put(ball(0.32, color), 0.12, 0.25, -0.3, 0.85, 1.4, 0.85);
  t1.rotation.x = 0.5;
  t1.rotation.z = -0.4;
  const t2 = put(ball(0.2, '#fff6ea'), 0.32, 0.72, -0.42, 0.9, 1.1, 0.9);
  tail.add(t1, t2);
  body.add(tail);
  wiggles.push({ obj: tail, axis: 'z', amp: 0.22, speed: 2.2, base: 0, phase: 0 });
  return { id: 'fox', root, body, head, eyes: f.eyes, setMouth: f.setMouth, wiggles, neck, crown: anchorCrown(head, c.y + R * 0.9), aquatic: false, mouthY: 1.15, hitbox: addHit(root, 1.0, 0.95) };
}

function panda(): CompanionRig {
  const white = '#fbfbf7';
  const black = '#2c2c34';
  const { root, body, head, neck } = biped(white, '#ffffff', 0.54);
  // Black arms and feet.
  body.traverse((o) => {
    if ((o as THREE.Mesh).geometry?.type === 'CapsuleGeometry') ((o as THREE.Mesh).material as THREE.MeshLambertMaterial).color.set(black);
  });
  root.children.forEach((o) => {
    if ((o as THREE.Mesh).isMesh) ((o as THREE.Mesh).material as THREE.MeshLambertMaterial).color.set(black);
  });
  body.add(put(ball(0.56, black, 14, 6), 0, 0.92, -0.05, 1.02, 0.35, 0.95));
  const R = 0.6;
  const c = new THREE.Vector3(0, R * 0.82, 0.05);
  head.add(put(ball(R, white), c.x, c.y, c.z, 1.05, 0.95, 0.95));
  const wiggles: CompanionRig['wiggles'] = [];
  for (const s of [-1, 1]) {
    const ear = put(ball(R * 0.25, black, 10, 8), s * R * 0.68, c.y + R * 0.72, c.z - R * 0.1, 1, 1, 0.6);
    head.add(ear);
    wiggles.push({ obj: ear, axis: 'z', amp: 0.1, speed: 1.4, base: 0, phase: s });
    const patch = put(ball(R * 0.27, black, 12, 8), s * R * 0.4, c.y + R * 0.02, c.z + R * 0.82, 0.85, 1.15, 0.4);
    patch.rotation.z = s * 0.55;
    head.add(patch);
  }
  head.add(put(ball(R * 0.42, '#ffffff'), 0, c.y - R * 0.3, c.z + R * 0.68, 1.2, 0.8, 0.7));
  head.add(put(ball(R * 0.1, black, 8, 6), 0, c.y - R * 0.16, c.z + R * 0.98, 1.2, 0.8, 0.8));
  const f = face(head, R, c, { eye: 0.17, eyeY: 0.06, eyeX: 0.4, mouthY: -0.42, mouthZ: 0.98 });
  f.eyes.forEach((e) => (e.position.z += R * 0.06));
  // A little bamboo sprig behind the ear.
  const sprig = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), mat('#7cc36a'));
  sprig.position.set(R * 0.55, c.y + R * 0.6, c.z - R * 0.4);
  sprig.rotation.z = -0.8;
  const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 4), mat('#5aa84f'));
  leaf.position.set(R * 0.85, c.y + R * 0.95, c.z - R * 0.4);
  leaf.rotation.z = -1.6;
  leaf.scale.z = 0.3;
  head.add(sprig, leaf);
  return { id: 'panda', root, body, head, eyes: f.eyes, setMouth: f.setMouth, wiggles, neck, crown: anchorCrown(head, c.y + R * 0.9), aquatic: false, mouthY: 1.2, hitbox: addHit(root, 1.05, 1.0) };
}

function robot(color: string): CompanionRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const shell = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.78, 0.7, 3, 0.2), mat(color));
  shell.position.y = 0.62;
  shell.castShadow = true;
  const plate = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.42, 0.1, 2, 0.05), mat('#e8f7ff'));
  plate.position.set(0, 0.6, 0.35);
  const heart = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), glowMat('#ff6f9a', 1.4));
  heart.position.set(0, 0.62, 0.42);
  const heartGlow = glow('#ff6f9a', 0.5, 0.55);
  heartGlow.position.copy(heart.position);
  body.add(shell, plate, heart, heartGlow);
  for (const s of [-1, 1]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.14, 12), mat('#37474f'));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(s * 0.3, 0.17, 0.02);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 8), mat('#ffd166'));
    hub.rotation.z = Math.PI / 2;
    hub.position.copy(wheel.position);
    root.add(wheel, hub);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.3, 4, 8), mat('#90a4ae'));
    arm.position.set(s * 0.55, 0.6, 0.05);
    arm.rotation.z = s * 0.45;
    const hand = put(ball(0.11, shade(color, -0.15), 10, 8), s * 0.66, 0.42, 0.08);
    body.add(arm, hand);
  }
  const head = new THREE.Group();
  head.position.y = 1.02;
  body.add(head);
  const helm = new THREE.Mesh(new RoundedBoxGeometry(0.98, 0.72, 0.78, 3, 0.24), mat(shade(color, 0.15)));
  helm.position.y = 0.36;
  helm.castShadow = true;
  const screen = new THREE.Mesh(new RoundedBoxGeometry(0.76, 0.48, 0.1, 2, 0.08), new THREE.MeshPhongMaterial({ color: '#16233a', shininess: 120 }));
  screen.position.set(0, 0.36, 0.36);
  head.add(helm, screen);
  const eyes: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group();
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), glowMat('#8ff6ff', 1.5));
    lens.scale.set(1, 1.25, 0.4);
    const g = glow('#8ff6ff', 0.32, 0.6);
    e.add(lens, g);
    e.position.set(s * 0.17, 0.4, 0.42);
    head.add(e);
    eyes.push(e);
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 10), mat('#ffd166'));
    ear.rotation.z = Math.PI / 2;
    ear.position.set(s * 0.52, 0.36, 0);
    head.add(ear);
  }
  const mouth = makeMouth(0.06, '#8ff6ff');
  mouth.g.position.set(0, 0.24, 0.42);
  mouth.g.children.forEach((m) => ((m as THREE.Mesh).material = glowMat('#8ff6ff', 1.2)));
  head.add(mouth.g);
  cheeks(head, 0.07, 0.27, 0.43, 0.3);
  const antenna = new THREE.Group();
  antenna.position.set(0, 0.72, 0);
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.3, 6), mat('#90a4ae'));
  stalk.position.y = 0.15;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), glowMat('#fff27a', 1.4));
  bulb.position.y = 0.34;
  const bulbGlow = glow('#fff27a', 0.45, 0.7);
  bulbGlow.position.y = 0.34;
  antenna.add(stalk, bulb, bulbGlow);
  head.add(antenna);
  const neck = new THREE.Object3D();
  neck.position.y = 1.0;
  neck.userData.r = 0.4;
  body.add(neck);
  return {
    id: 'robot',
    root,
    body,
    head,
    eyes,
    setMouth: mouth.setMouth,
    wiggles: [{ obj: antenna, axis: 'z', amp: 0.18, speed: 3, base: 0, phase: 0 }],
    neck,
    crown: anchorCrown(head, 0.86),
    aquatic: false,
    mouthY: 1.25,
    hitbox: addHit(root, 1.0, 0.95),
  };
}

function owl(color: string): CompanionRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const light = '#f3e2c4';
  body.add(put(ball(0.55, color), 0, 0.62, 0, 1, 1.05, 0.92));
  body.add(put(ball(0.4, light), 0, 0.55, 0.26, 1, 1.1, 0.55));
  // Little feather marks on the tummy.
  for (let i = 0; i < 5; i++) {
    const v = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.08, 3), mat(shade(color, 0.2)));
    v.position.set(-0.12 + (i % 3) * 0.12 + (i > 2 ? 0.06 : 0), 0.62 - Math.floor(i / 3) * 0.16, 0.48);
    v.rotation.x = Math.PI;
    body.add(v);
  }
  for (const s of [-1, 1]) {
    const foot = put(ball(0.1, '#ffb74d', 8, 6), s * 0.18, 0.06, 0.25, 1.2, 0.5, 1.4);
    root.add(foot);
  }
  const wiggles: CompanionRig['wiggles'] = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.5, 0.88, 0);
    const wing = put(ball(0.26, shade(color, -0.12), 10, 8), s * 0.06, -0.26, 0, 0.45, 1.15, 0.8);
    pivot.add(wing);
    body.add(pivot);
    wiggles.push({ obj: pivot, axis: 'z', amp: 0.12, speed: 2, base: 0, phase: s });
  }
  const head = new THREE.Group();
  head.position.y = 1.0;
  body.add(head);
  const R = 0.52;
  const c = new THREE.Vector3(0, R * 0.62, 0);
  head.add(put(ball(R, color), c.x, c.y, c.z, 1.08, 0.92, 0.95));
  for (const s of [-1, 1]) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.36, R * 0.36, 0.05, 16), mat(light));
    disc.position.set(s * R * 0.38, c.y + R * 0.05, c.z + R * 0.84);
    disc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(s * 0.35, 0, 1).normalize());
    head.add(disc);
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(R * 0.16, R * 0.45, 4), mat(shade(color, -0.15)));
    tuft.position.set(s * R * 0.62, c.y + R * 0.82, c.z - R * 0.1);
    tuft.rotation.z = -s * 0.5;
    head.add(tuft);
  }
  const f = face(head, R, c, { eye: 0.27, eyeX: 0.38, eyeY: 0.06, mouthY: -0.48, mouthZ: 0.9, iris: '#f2a33a' });
  f.eyes.forEach((e) => (e.position.z += 0.04));
  const beak = new THREE.Mesh(new THREE.ConeGeometry(R * 0.1, R * 0.26, 4), mat('#ffb74d'));
  beak.position.set(0, c.y - R * 0.16, c.z + R * 1.0);
  beak.rotation.x = Math.PI + 0.3;
  head.add(beak);
  const neck = new THREE.Object3D();
  neck.position.y = 1.0;
  neck.userData.r = 0.42;
  body.add(neck);
  return { id: 'owl', root, body, head, eyes: f.eyes, setMouth: f.setMouth, wiggles, neck, crown: anchorCrown(head, c.y + R * 0.86), aquatic: false, mouthY: 1.2, hitbox: addHit(root, 0.95, 0.9) };
}

function cat(color: string): CompanionRig {
  const { root, body, head, neck } = biped(color, '#fff4e2');
  const R = 0.56;
  const c = new THREE.Vector3(0, R * 0.85, 0.05);
  head.add(put(ball(R, color), c.x, c.y, c.z, 1.08, 0.94, 0.95));
  head.add(put(ball(R * 0.45, '#fff4e2'), 0, c.y - R * 0.34, c.z + R * 0.62, 1.3, 0.75, 0.75));
  head.add(put(ball(R * 0.08, '#ff7a9a', 8, 6), 0, c.y - R * 0.16, c.z + R * 1.0, 1.3, 0.9, 0.8));
  // Stripes on the forehead.
  for (const x of [-0.16, 0, 0.16]) {
    const st = put(ball(R * 0.16, shade(color, -0.22), 8, 6), x * R * 2, c.y + R * 0.78, c.z + R * 0.42, 0.35, 0.9, 0.4);
    st.rotation.x = -0.6;
    head.add(st);
  }
  const wiggles: CompanionRig['wiggles'] = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(s * R * 0.55, c.y + R * 0.68, c.z);
    const outer = new THREE.Mesh(new THREE.ConeGeometry(R * 0.3, R * 0.55, 3), mat(color));
    outer.position.y = R * 0.22;
    const inner = new THREE.Mesh(new THREE.ConeGeometry(R * 0.17, R * 0.34, 3), mat('#ffb3c6'));
    inner.position.set(0, R * 0.2, R * 0.08);
    ear.add(outer, inner);
    ear.rotation.z = -s * 0.28;
    head.add(ear);
    wiggles.push({ obj: ear, axis: 'z', amp: 0.12, speed: 1.3, base: -s * 0.28, phase: s * 2 });
    for (const k of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(R * 0.55, 0.012, 0.012), mat('#6d4c41'));
      w.position.set(s * R * 0.62, c.y - R * 0.28 + k * 0.05, c.z + R * 0.78);
      w.rotation.z = s * k * 0.15;
      head.add(w);
    }
  }
  const f = face(head, R, c, { eye: 0.24, eyeY: 0.12, mouthY: -0.44, mouthZ: 1.0, iris: '#7bc96f' });
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.1, 0.15, -0.3), new THREE.Vector3(0.25, 0.55, -0.42), new THREE.Vector3(0.18, 0.85, -0.3)]);
  const tail = new THREE.Group();
  tail.position.set(0, 0.22, -0.38);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.075, 7), mat(color));
  tube.castShadow = true;
  const tip = put(ball(0.09, shade(color, -0.22), 8, 6), 0.18, 0.85, -0.3);
  tail.add(tube, tip);
  body.add(tail);
  wiggles.push({ obj: tail, axis: 'z', amp: 0.25, speed: 1.8, base: 0, phase: 0 });
  return { id: 'cat', root, body, head, eyes: f.eyes, setMouth: f.setMouth, wiggles, neck, crown: anchorCrown(head, c.y + R * 0.88), aquatic: false, mouthY: 1.15, hitbox: addHit(root, 1.0, 0.95) };
}

function dolphin(color: string): CompanionRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const head = new THREE.Group();
  head.position.y = 0.35;
  body.add(head);
  // The dolphin is all head: it turns entirely to look at the child.
  const main = put(ball(0.55, color), 0, 0.2, -0.1, 0.9, 0.85, 1.35);
  const belly = put(ball(0.45, '#e9f8ff'), 0, 0.05, 0.08, 0.8, 0.6, 1.2);
  const snout = put(ball(0.15, shade(color, 0.12)), 0, 0.02, 0.74, 0.85, 0.62, 1.45);
  head.add(main, belly, snout);
  const R = 0.5;
  const c = new THREE.Vector3(0, 0.25, 0.12);
  const f = face(head, R, c, { eye: 0.24, eyeX: 0.5, eyeY: 0.12, mouthY: -0.42, mouthZ: 1.05 });
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 4), mat(shade(color, -0.15)));
  fin.position.set(0, 0.75, -0.3);
  fin.rotation.x = -0.5;
  fin.scale.z = 0.35;
  head.add(fin);
  const wiggles: CompanionRig['wiggles'] = [];
  for (const s of [-1, 1]) {
    const flip = new THREE.Group();
    flip.position.set(s * 0.42, -0.05, 0.1);
    const fl = put(ball(0.16, shade(color, -0.1), 8, 6), s * 0.12, -0.05, 0, 1.4, 0.3, 0.8);
    flip.add(fl);
    head.add(flip);
    wiggles.push({ obj: flip, axis: 'z', amp: 0.25, speed: 2.5, base: 0, phase: s });
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.1, -0.78);
  const stem = put(ball(0.2, color, 10, 8), 0, 0, -0.1, 0.7, 0.6, 1.4);
  const fluke = new THREE.Group();
  fluke.position.z = -0.38;
  for (const s of [-1, 1]) {
    const lobe = put(ball(0.16, shade(color, -0.1), 8, 6), s * 0.18, 0.02, -0.04, 1.4, 0.25, 0.7);
    lobe.rotation.y = s * 0.5;
    fluke.add(lobe);
  }
  tail.add(stem, fluke);
  head.add(tail);
  wiggles.push({ obj: tail, axis: 'x', amp: 0.22, speed: 2.4, base: 0, phase: 0 });
  const neck = new THREE.Object3D();
  neck.position.set(0, 0.42, 0.08);
  neck.userData.r = 0.42;
  head.add(neck);
  return { id: 'dolphin', root, body, head, eyes: f.eyes, setMouth: f.setMouth, wiggles, neck, crown: anchorCrown(head, 0.82, -0.05), aquatic: true, mouthY: 0.4, hitbox: addHit(root, 1.0, 0.4) };
}

function anchorCrown(head: THREE.Object3D, y: number, z = 0) {
  const a = new THREE.Object3D();
  a.position.set(0, y, z);
  head.add(a);
  return a;
}
function addHit(root: THREE.Object3D, r: number, y: number) {
  const h = hitbox(r, y);
  root.add(h);
  return h;
}

export function makeCompanion(id: CompanionId, color: string): CompanionRig {
  switch (id) {
    case 'dragon':
      return dragon(color);
    case 'unicorn':
      return unicorn(color);
    case 'fox':
      return fox(color);
    case 'panda':
      return panda();
    case 'robot':
      return robot(color);
    case 'owl':
      return owl(color);
    case 'cat':
      return cat(color);
    case 'dolphin':
      return dolphin(color);
  }
}

/* ───────────────────────── Growth accessories ───────────────────────── */

export function makeScarf(r: number, color = '#ff6f91'): THREE.Group {
  const g = new THREE.Group();
  const m = mat(color);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.22, 6, 18), m);
  ring.rotation.x = Math.PI / 2;
  ring.castShadow = true;
  const end = new THREE.Mesh(new THREE.BoxGeometry(r * 0.38, r * 0.85, r * 0.14), m);
  end.position.set(r * 0.45, -r * 0.42, r * 0.92);
  end.rotation.z = 0.25;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(r * 0.4, r * 0.1, r * 0.16), mat('#fff3c4'));
  stripe.position.set(r * 0.45, -r * 0.6, r * 0.93);
  stripe.rotation.z = 0.25;
  g.add(ring, end, stripe);
  return g;
}

export function makeFlowerCrown(): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 5, 18), mat('#6fbf5a'));
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const cols = ['#ff8fb8', '#fff07a', '#9fd8ff', '#ffb36b'];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(cols[i % cols.length]));
    fl.position.set(Math.cos(a) * 0.3, 0.03, Math.sin(a) * 0.3);
    const ctr = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), mat('#fff8d6'));
    ctr.position.copy(fl.position).add(new THREE.Vector3(0, 0.05, 0));
    g.add(fl, ctr);
  }
  return g;
}

export function makeCrown(): THREE.Group {
  const g = new THREE.Group();
  const gold = new THREE.MeshPhongMaterial({ color: '#ffd24a', shininess: 110, specular: '#fff6c8', flatShading: true });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.14, 10, 1, true), gold);
  band.material.side = THREE.DoubleSide;
  g.add(band);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    const p = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 5), gold);
    p.position.set(Math.cos(a) * 0.25, 0.15, Math.sin(a) * 0.25);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), glowMat(['#ff6f91', '#7fd0ff', '#9bf07f', '#c99bff', '#ffe066'][i], 1.3));
    gem.position.set(Math.cos(a) * 0.265, 0.02, Math.sin(a) * 0.265);
    g.add(p, gem);
  }
  const halo = glow('#ffe58a', 1.1, 0.35);
  halo.position.y = 0.1;
  g.add(halo);
  return g;
}
