import * as THREE from 'three';
import { glow, mat } from '../kit/look';
import { makeCompanion, makeScarf } from '../nid/companions3d';
import { mergeStatic } from '../nid/garden';
import { HUE_HEX, type AlibiProp, type Species, type Suspect } from './logic';

/**
 * The village friends (the suspects), modelled in code in the same round,
 * low-poly style as the garden companions: big shiny eyes, pink cheeks.
 * Cat, fox, owl, panda and dragon are the site's companions; the dog, bunny,
 * pig, bear, mouse, frog and duck are built here with the same rig shape:
 *   root ─ body (breathing, squash) ─ head (looks around, blinks)
 * plus wiggles (ears, tails) and anchors for the hat and the scarf.
 */
export interface Critter {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  eyes: THREE.Object3D[];
  setMouth: (open: number) => void;
  wiggles: { obj: THREE.Object3D; axis: 'x' | 'y' | 'z'; amp: number; speed: number; base: number; phase: number }[];
  neck: THREE.Object3D;
  crown: THREE.Object3D;
  mouthY: number;
  hitbox: THREE.Mesh;
  idleYaw?: number;
}

export interface SuspectActor {
  id: Species;
  data: Suspect;
  c: Critter;
  /** Where the mouth is, in head space (crumbs, trumpet). */
  mouth: THREE.Vector3;
  /** Blush sprites on the cheeks (the culprit turns pink). */
  blush: THREE.Sprite[];
  hat: THREE.Object3D | null;
  glasses: THREE.Object3D | null;
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
  g.userData.eyeSize = size;
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

function face(
  head: THREE.Group,
  R: number,
  c: THREE.Vector3,
  opts: { eye?: number; eyeX?: number; eyeY?: number; mouthY?: number; mouthZ?: number; iris?: string; mouthColor?: string; noCheeks?: boolean; cheekY?: number }
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
  if (!opts.noCheeks) cheeks(head, R * 0.15, c.y + R * (opts.cheekY ?? -0.18), c.z + R * 0.8, R * 0.58);
  return { eyes, setMouth: mouth.setMouth };
}

function biped(color: string, belly: string, bodyR = 0.5, feet?: string) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const torso = put(ball(bodyR, color), 0, bodyR * 1.05, 0, 1, 1, 0.92);
  const tummy = put(ball(bodyR * 0.62, belly), 0, bodyR * 1.05, bodyR * 0.62, 1, 0.98, 0.5);
  body.add(torso, tummy);
  for (const s of [-1, 1]) {
    const foot = put(ball(bodyR * 0.36, feet ?? shade(color, -0.12)), s * bodyR * 0.48, bodyR * 0.2, bodyR * 0.25, 1, 0.62, 1.3);
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

function anchorCrown(head: THREE.Object3D, y: number, z = 0) {
  const a = new THREE.Object3D();
  a.position.set(0, y, z);
  head.add(a);
  return a;
}
function addHit(root: THREE.Object3D, r: number, y: number) {
  const h = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  h.position.y = y;
  h.userData.hitbox = true;
  root.add(h);
  return h;
}

/* ───────────────────────── The village friends ───────────────────────── */

function dog(): Critter {
  const color = '#e0a868';
  const dark = '#8a5534';
  const { root, body, head, neck } = biped(color, '#fff1dc');
  const R = 0.56;
  const c = new THREE.Vector3(0, R * 0.85, 0.05);
  head.add(put(ball(R, color), c.x, c.y, c.z, 1.05, 0.95, 0.95));
  head.add(put(ball(R * 0.5, '#fff1dc'), 0, c.y - R * 0.35, c.z + R * 0.68, 1.25, 0.8, 0.85));
  head.add(put(ball(R * 0.13, '#2a1d22', 10, 8), 0, c.y - R * 0.14, c.z + R * 1.08, 1.3, 1, 0.9));
  // A brown patch around one eye.
  head.add(put(ball(R * 0.3, dark, 12, 8), R * 0.4, c.y + R * 0.12, c.z + R * 0.78, 1, 1.1, 0.4));
  const wiggles: Critter['wiggles'] = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(s * R * 0.78, c.y + R * 0.55, c.z - R * 0.05);
    const flap = put(ball(R * 0.34, dark, 12, 10), 0, -R * 0.38, 0, 0.55, 1.3, 0.38);
    ear.add(flap);
    ear.rotation.z = s * 0.25;
    head.add(ear);
    wiggles.push({ obj: ear, axis: 'z', amp: 0.12, speed: 2, base: s * 0.25, phase: s });
  }
  const f = face(head, R, c, { eye: 0.22, eyeY: 0.14, mouthY: -0.55, mouthZ: 1.0 });
  const tail = new THREE.Group();
  tail.position.set(0, 0.42, -0.42);
  const t1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.3, 4, 8), mat(color));
  t1.position.set(0, 0.16, -0.08);
  t1.rotation.x = -0.6;
  tail.add(t1);
  body.add(tail);
  wiggles.push({ obj: tail, axis: 'z', amp: 0.55, speed: 9, base: 0, phase: 0 });
  return { root, body, head, eyes: f.eyes, setMouth: f.setMouth, wiggles, neck, crown: anchorCrown(head, c.y + R * 0.9), mouthY: 1.15, hitbox: addHit(root, 1.0, 0.95) };
}

function rabbit(): Critter {
  const color = '#f6f1ea';
  const { root, body, head, neck } = biped(color, '#ffffff');
  const R = 0.54;
  const c = new THREE.Vector3(0, R * 0.85, 0.05);
  head.add(put(ball(R, color), c.x, c.y, c.z, 1.05, 0.95, 0.95));
  head.add(put(ball(R * 0.36, '#ffffff'), 0, c.y - R * 0.33, c.z + R * 0.72, 1.35, 0.8, 0.8));
  head.add(put(ball(R * 0.1, '#ff8fb0', 10, 8), 0, c.y - R * 0.14, c.z + R * 1.0, 1.3, 1, 0.8));
  for (const s of [-1, 1]) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(R * 0.11, R * 0.15, R * 0.05), mat('#ffffff'));
    tooth.position.set(s * R * 0.06, c.y - R * 0.58, c.z + R * 0.93);
    head.add(tooth);
  }
  const wiggles: Critter['wiggles'] = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(s * R * 0.32, c.y + R * 0.78, c.z - R * 0.08);
    const outer = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.17, R * 0.95, 4, 10), mat(color));
    outer.position.y = R * 0.62;
    outer.scale.z = 0.55;
    outer.castShadow = true;
    const inner = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.1, R * 0.75, 4, 8), mat('#ffb3c9'));
    inner.position.set(0, R * 0.62, R * 0.07);
    inner.scale.z = 0.4;
    ear.add(outer, inner);
    ear.rotation.z = -s * 0.18;
    head.add(ear);
    wiggles.push({ obj: ear, axis: 'z', amp: 0.14, speed: 1.6, base: -s * 0.18, phase: s * 1.3 });
  }
  const f = face(head, R, c, { eye: 0.24, eyeY: 0.12, mouthY: -0.47, mouthZ: 0.98, iris: '#c46a8f' });
  const tail = put(ball(0.17, '#ffffff', 10, 8), 0, 0.42, -0.48);
  body.add(tail);
  return { root, body, head, eyes: f.eyes, setMouth: f.setMouth, wiggles, neck, crown: anchorCrown(head, c.y + R * 0.9), mouthY: 1.12, hitbox: addHit(root, 1.0, 1.0) };
}

function pig(): Critter {
  const color = '#f7a9bc';
  const { root, body, head, neck } = biped(color, '#ffd3de');
  const R = 0.58;
  const c = new THREE.Vector3(0, R * 0.82, 0.05);
  head.add(put(ball(R, color), c.x, c.y, c.z, 1.08, 0.95, 0.95));
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.27, R * 0.3, R * 0.26, 16), mat('#ff8fa9'));
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, c.y - R * 0.2, c.z + R * 0.98);
  head.add(snout);
  for (const s of [-1, 1]) {
    const n = put(ball(R * 0.06, '#9a3f5c', 8, 6), s * R * 0.1, c.y - R * 0.2, c.z + R * 1.11, 1, 1.4, 0.5);
    head.add(n);
  }
  const wiggles: Critter['wiggles'] = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(s * R * 0.58, c.y + R * 0.7, c.z);
    const e = new THREE.Mesh(new THREE.ConeGeometry(R * 0.24, R * 0.42, 4), mat(shade(color, -0.08)));
    e.position.y = R * 0.15;
    e.rotation.x = 0.5;
    e.scale.z = 0.5;
    ear.add(e);
    ear.rotation.z = -s * 0.5;
    head.add(ear);
    wiggles.push({ obj: ear, axis: 'x', amp: 0.18, speed: 2.2, base: 0, phase: s });
  }
  const f = face(head, R, c, { eye: 0.2, eyeY: 0.22, eyeX: 0.42, mouthY: -0.55, mouthZ: 0.92 });
  const tail = new THREE.Group();
  tail.position.set(0, 0.45, -0.46);
  const curl = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 6, 12, Math.PI * 1.6), mat(color));
  curl.rotation.y = Math.PI / 2;
  tail.add(curl);
  body.add(tail);
  wiggles.push({ obj: tail, axis: 'y', amp: 0.4, speed: 5, base: 0, phase: 0 });
  return { root, body, head, eyes: f.eyes, setMouth: f.setMouth, wiggles, neck, crown: anchorCrown(head, c.y + R * 0.88), mouthY: 1.1, hitbox: addHit(root, 1.0, 0.95) };
}

function bear(): Critter {
  const color = '#b07a4c';
  const { root, body, head, neck } = biped(color, '#ecd2a8', 0.54);
  const R = 0.6;
  const c = new THREE.Vector3(0, R * 0.82, 0.05);
  head.add(put(ball(R, color), c.x, c.y, c.z, 1.05, 0.95, 0.95));
  head.add(put(ball(R * 0.42, '#ecd2a8'), 0, c.y - R * 0.3, c.z + R * 0.72, 1.25, 0.85, 0.8));
  head.add(put(ball(R * 0.12, '#2a1d22', 10, 8), 0, c.y - R * 0.14, c.z + R * 1.04, 1.35, 0.95, 0.8));
  const wiggles: Critter['wiggles'] = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(s * R * 0.66, c.y + R * 0.68, c.z - R * 0.05);
    ear.add(put(ball(R * 0.26, color, 10, 8), 0, 0, 0, 1, 1, 0.6));
    ear.add(put(ball(R * 0.15, '#ecd2a8', 10, 8), 0, 0, R * 0.1, 1, 1, 0.4));
    head.add(ear);
    wiggles.push({ obj: ear, axis: 'z', amp: 0.08, speed: 1.3, base: 0, phase: s });
  }
  const f = face(head, R, c, { eye: 0.19, eyeY: 0.14, mouthY: -0.47, mouthZ: 1.0 });
  body.add(put(ball(0.12, color, 8, 6), 0, 0.38, -0.5));
  return { root, body, head, eyes: f.eyes, setMouth: f.setMouth, wiggles, neck, crown: anchorCrown(head, c.y + R * 0.88), mouthY: 1.2, hitbox: addHit(root, 1.05, 1.0) };
}

function mouse(): Critter {
  const color = '#b9bccb';
  const { root, body, head, neck } = biped(color, '#f1f1f7', 0.46);
  const R = 0.5;
  const c = new THREE.Vector3(0, R * 0.85, 0.05);
  head.add(put(ball(R, color), c.x, c.y, c.z, 1.02, 0.95, 1.0));
  head.add(put(ball(R * 0.38, '#f1f1f7'), 0, c.y - R * 0.3, c.z + R * 0.72, 1.2, 0.8, 0.95));
  head.add(put(ball(R * 0.1, '#ff8fb0', 10, 8), 0, c.y - R * 0.16, c.z + R * 1.08));
  const wiggles: Critter['wiggles'] = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(s * R * 0.62, c.y + R * 0.75, c.z - R * 0.1);
    ear.add(put(ball(R * 0.45, color, 14, 10), 0, 0, 0, 1, 1, 0.3));
    ear.add(put(ball(R * 0.32, '#ffb3c9', 12, 8), 0, 0, R * 0.08, 1, 1, 0.2));
    ear.rotation.z = -s * 0.2;
    head.add(ear);
    wiggles.push({ obj: ear, axis: 'z', amp: 0.1, speed: 2.4, base: -s * 0.2, phase: s });
    for (const k of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(R * 0.6, 0.012, 0.012), mat('#6d6d80'));
      w.position.set(s * R * 0.55, c.y - R * 0.2 + k * 0.05, c.z + R * 0.85);
      w.rotation.z = s * k * 0.15;
      head.add(w);
    }
  }
  const f = face(head, R, c, { eye: 0.24, eyeY: 0.12, mouthY: -0.45, mouthZ: 1.02 });
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.15, 0.05, -0.3), new THREE.Vector3(0.35, 0.3, -0.45), new THREE.Vector3(0.3, 0.6, -0.5)]);
  const tail = new THREE.Group();
  tail.position.set(0, 0.25, -0.38);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.035, 6), mat('#ffb3c9'));
  tail.add(tube);
  body.add(tail);
  wiggles.push({ obj: tail, axis: 'z', amp: 0.3, speed: 2.4, base: 0, phase: 0 });
  return { root, body, head, eyes: f.eyes, setMouth: f.setMouth, wiggles, neck, crown: anchorCrown(head, c.y + R * 0.9), mouthY: 1.0, hitbox: addHit(root, 0.95, 0.9) };
}

function frog(): Critter {
  const color = '#6ccb64';
  const { root, body, head, neck } = biped(color, '#f4f2b8', 0.5, '#5ab553');
  const R = 0.56;
  const c = new THREE.Vector3(0, R * 0.68, 0.05);
  head.add(put(ball(R, color), c.x, c.y, c.z, 1.22, 0.82, 1.0));
  const wiggles: Critter['wiggles'] = [];
  const eyes: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const bump = put(ball(R * 0.34, color, 14, 10), s * R * 0.5, c.y + R * 0.62, c.z + R * 0.28);
    head.add(bump);
    const e = makeEye(R * 0.22);
    e.position.set(s * R * 0.5, c.y + R * 0.66, c.z + R * 0.56);
    head.add(e);
    eyes.push(e);
  }
  // A wide, happy frog smile.
  const smile = new THREE.Mesh(new THREE.TorusGeometry(R * 0.36, R * 0.04, 6, 18, Math.PI), mat('#2f5a2b'));
  smile.rotation.z = Math.PI;
  smile.position.set(0, c.y - R * 0.12, c.z + R * 0.95);
  smile.scale.set(1, 0.55, 1);
  const open = new THREE.Mesh(new THREE.SphereGeometry(R * 0.3, 12, 10), new THREE.MeshLambertMaterial({ color: '#8a2c3e' }));
  open.position.set(0, c.y - R * 0.25, c.z + R * 0.88);
  open.scale.set(1.3, 0.6, 0.4);
  open.visible = false;
  smile.userData.noMerge = true;
  open.userData.noMerge = true;
  head.add(smile, open);
  cheeks(head, R * 0.14, c.y - R * 0.05, c.z + R * 0.85, R * 0.75);
  const setMouth = (k: number) => {
    open.visible = k > 0.05;
    smile.visible = !open.visible;
    open.scale.set(1.3, 0.3 + k * 0.6, 0.4);
  };
  return { root, body, head, eyes, setMouth, wiggles, neck, crown: anchorCrown(head, c.y + R * 0.78, -0.08), mouthY: 1.05, hitbox: addHit(root, 1.0, 0.9) };
}

function duck(): Critter {
  const color = '#fbfaf2';
  const orange = '#ff9f2e';
  const { root, body, head, neck } = biped(color, '#ffffff', 0.5, orange);
  // Wings instead of arms.
  body.traverse((o) => {
    if ((o as THREE.Mesh).geometry?.type === 'CapsuleGeometry') {
      const m = o as THREE.Mesh;
      m.scale.set(1.5, 1.1, 0.5);
    }
  });
  const R = 0.52;
  const c = new THREE.Vector3(0, R * 0.85, 0.05);
  head.add(put(ball(R, color), c.x, c.y, c.z, 1.0, 0.98, 0.98));
  const upper = put(ball(R * 0.32, orange, 12, 8), 0, c.y - R * 0.18, c.z + R * 1.0, 1.25, 0.42, 1.25);
  const lower = put(ball(R * 0.26, shade(orange, -0.1), 12, 8), 0, c.y - R * 0.34, c.z + R * 0.92, 1.1, 0.35, 1.1);
  head.add(upper, lower);
  for (let i = 0; i < 3; i++) {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(R * 0.07, R * 0.35, 5), mat(color));
    tuft.position.set((i - 1) * R * 0.1, c.y + R * 1.05, c.z - R * 0.05);
    tuft.rotation.z = (i - 1) * 0.4;
    head.add(tuft);
  }
  const f = face(head, R, c, { eye: 0.21, eyeY: 0.22, eyeX: 0.4, mouthY: -0.6, mouthZ: 0.5, cheekY: -0.1 });
  const tail = new THREE.Group();
  tail.position.set(0, 0.5, -0.45);
  const t = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 5), mat(color));
  t.rotation.x = -1.0;
  tail.add(t);
  body.add(tail);
  const wiggles: Critter['wiggles'] = [{ obj: tail, axis: 'z', amp: 0.25, speed: 3, base: 0, phase: 0 }];
  return { root, body, head, eyes: f.eyes, setMouth: f.setMouth, wiggles, neck, crown: anchorCrown(head, c.y + R * 0.92), mouthY: 1.1, hitbox: addHit(root, 1.0, 0.95) };
}

const COMPANION_COLORS: Partial<Record<Species, string>> = {
  cat: '#f4a259',
  fox: '#f2793c',
  owl: '#a07a55',
  dragon: '#7ccf6e',
};

export function makeCritter(id: Species): Critter {
  switch (id) {
    case 'dog':
      return dog();
    case 'rabbit':
      return rabbit();
    case 'pig':
      return pig();
    case 'bear':
      return bear();
    case 'mouse':
      return mouse();
    case 'frog':
      return frog();
    case 'duck':
      return duck();
    case 'cat':
    case 'fox':
    case 'owl':
    case 'panda':
    case 'dragon': {
      const r = makeCompanion(id, COMPANION_COLORS[id] ?? '#ffffff');
      return { root: r.root, body: r.body, head: r.head, eyes: r.eyes, setMouth: r.setMouth, wiggles: r.wiggles, neck: r.neck, crown: r.crown, mouthY: r.mouthY, hitbox: r.hitbox, idleYaw: r.idleYaw };
    }
  }
}

/* ───────────────────────── Outfits ───────────────────────── */

/** A little felt hat with a band and a flower. */
export function makeHat(hue: string): THREE.Group {
  const g = new THREE.Group();
  const m = mat(hue);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.05, 20), m);
  brim.castShadow = true;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.3, 18), m);
  crown.position.y = 0.17;
  crown.castShadow = true;
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), m);
  top.scale.y = 0.3;
  top.position.y = 0.32;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.276, 0.282, 0.08, 18), mat('#fff6e0'));
  band.position.y = 0.07;
  const flower = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), mat('#ffffff'));
    p.position.set(Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0);
    flower.add(p);
  }
  flower.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), mat('#ffd166')), 0, 0, 0.02));
  flower.position.set(0.2, 0.09, 0.17);
  flower.rotation.y = 0.85;
  g.add(brim, crown, top, band, flower);
  g.rotation.z = -0.12;
  return g;
}

/** Round glasses, fitted on the critter's eyes. */
export function makeGlasses(c: Critter): THREE.Group {
  const g = new THREE.Group();
  const frame = mat('#2a2438');
  const lensMat = new THREE.MeshBasicMaterial({ color: '#dff4ff', transparent: true, opacity: 0.28, depthWrite: false });
  c.root.updateMatrixWorld(true);
  const pts = c.eyes.map((e) => c.head.worldToLocal(e.getWorldPosition(new THREE.Vector3())));
  const size = Math.max(...c.eyes.map((e) => (e.userData.eyeSize as number | undefined) ?? 0.13));
  const rr = size * 1.45 + 0.02;
  for (const p of pts) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.022, 6, 20), frame);
    ring.position.set(p.x, p.y, p.z + size * 0.55);
    ring.rotation.y = p.x * 0.5;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(rr, 18), lensMat);
    lens.position.copy(ring.position);
    lens.rotation.y = ring.rotation.y;
    g.add(ring, lens);
  }
  if (pts.length === 2) {
    const [a, b] = pts;
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, Math.max(0.02, Math.abs(b.x - a.x) - rr * 2 + 0.04), 6), frame);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set((a.x + b.x) / 2, (a.y + b.y) / 2 + rr * 0.25, Math.max(a.z, b.z) + size * 0.6);
    g.add(bridge);
    for (const p of pts) {
      const s = Math.sign(p.x) || 1;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.3), frame);
      arm.position.set(p.x + s * rr, p.y, p.z - 0.1);
      arm.rotation.y = s * 0.25;
      g.add(arm);
    }
  }
  c.head.add(g);
  return g;
}

/** Find the front of the face at mouth height (crumbs and trumpets go there). */
function mouthPoint(c: Critter): THREE.Vector3 {
  c.root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(c.root.localToWorld(new THREE.Vector3(0, c.mouthY, 3)), new THREE.Vector3(0, 0, -1).transformDirection(c.root.matrixWorld));
  const meshes: THREE.Object3D[] = [];
  c.head.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.visible) meshes.push(o);
  });
  const hit = ray.intersectObjects(meshes, false)[0];
  const world = hit ? hit.point : c.root.localToWorld(new THREE.Vector3(0, c.mouthY, 0.55));
  return c.head.worldToLocal(world.clone());
}

export function makeSuspect(data: Suspect, lowPower: boolean): SuspectActor {
  const c = makeCritter(data.id);
  if (lowPower) c.root.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = false) : null));
  let hat: THREE.Object3D | null = null;
  let glasses: THREE.Object3D | null = null;
  if (data.hat) {
    hat = makeHat(HUE_HEX[data.hat]);
    c.crown.add(hat);
  }
  if (data.scarf) {
    const scarf = makeScarf((c.neck.userData.r as number | undefined) ?? 0.4, HUE_HEX[data.scarf]);
    c.neck.add(scarf);
  }
  if (data.glasses) glasses = makeGlasses(c);
  const mouth = mouthPoint(c);
  // Blush: hidden until the culprit owns up.
  const blush: THREE.Sprite[] = [];
  for (const s of [-1, 1]) {
    const b = glow('#ff5f8f', 0.5, 0);
    b.position.set(s * 0.32, mouth.y + 0.18, mouth.z - 0.12);
    c.head.add(b);
    blush.push(b);
  }
  c.root.userData.suspect = data.id;
  c.hitbox.userData.suspect = data.id;
  mergeCritter(c, hat);
  return { id: data.id, data, c, mouth, blush, hat, glasses };
}

/**
 * A friend is made of dozens of little meshes: merge the still ones (per
 * moving part: feet, body, head) so six friends cost a few draw calls each.
 * Moving bits (ears, tails, eyes, mouth, hat) stay separate.
 */
function mergeCritter(c: Critter, hat: THREE.Object3D | null) {
  for (const w of c.wiggles) w.obj.userData.noMerge = true;
  if (hat) hat.userData.noMerge = true;
  c.root.traverse((o) => {
    // The mouth: a group holding the hidden "open" shape (or that shape itself).
    if ((o as THREE.Mesh).isMesh && !o.visible) {
      const parent = o.parent;
      if (parent && parent !== c.head && parent !== c.body && parent !== c.root) parent.userData.noMerge = true;
      else o.userData.noMerge = true;
    }
  });
  c.body.userData.noMerge = true;
  mergeStatic(c.root);
  c.body.userData.noMerge = false;
  c.head.userData.noMerge = true;
  mergeStatic(c.body);
  c.head.userData.noMerge = false;
  mergeStatic(c.head);
}

/* ───────────────────────── Props ───────────────────────── */

/** What a wrongly accused friend proudly shows (it pops above their head). */
export function makeAlibiProp(kind: AlibiProp): THREE.Group {
  const g = new THREE.Group();
  switch (kind) {
    case 'pillow': {
      const p = put(ball(0.32, '#9fd0ff', 14, 10), 0, 0, 0, 1.2, 0.5, 0.9);
      const btn = put(ball(0.05, '#ffffff', 8, 6), 0, 0.15, 0);
      g.add(p, btn);
      break;
    }
    case 'bone': {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), mat('#fff6e6'));
      shaft.rotation.z = Math.PI / 2;
      g.add(shaft);
      for (const x of [-0.27, 0.27]) for (const y of [-0.06, 0.06]) g.add(put(ball(0.08, '#fff6e6', 10, 8), x, y, 0));
      break;
    }
    case 'carrot': {
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 8), mat('#ff8a2a'));
      body.rotation.z = Math.PI;
      g.add(body);
      for (let i = 0; i < 3; i++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.22, 4), mat('#4caf50'));
        leaf.position.set((i - 1) * 0.05, 0.33, 0);
        leaf.rotation.z = (i - 1) * 0.4;
        g.add(leaf);
      }
      break;
    }
    case 'balls': {
      ['#ff5f6d', '#ffd166', '#5fb8ff'].forEach((col, i) => {
        const b = put(ball(0.1, col, 10, 8), Math.cos(i * 2.1) * 0.22, Math.sin(i * 2.1) * 0.22, 0);
        b.userData.juggle = i;
        g.add(b);
      });
      break;
    }
    case 'bubbles': {
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(
          new THREE.SphereGeometry(0.09 + i * 0.03, 12, 10),
          new THREE.MeshPhongMaterial({ color: '#cfefff', transparent: true, opacity: 0.55, shininess: 120, specular: '#ffffff' })
        );
        b.position.set((i - 1.5) * 0.15, Math.sin(i * 1.7) * 0.12, 0);
        g.add(b);
      }
      break;
    }
    case 'book': {
      const cover = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.1), mat('#d94b5b'));
      const pages = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.48, 0.11), mat('#fffaf0'));
      pages.position.x = 0.03;
      const star = put(ball(0.05, '#ffd166', 6, 4), -0.05, 0.08, 0.06);
      g.add(cover, pages, star);
      break;
    }
    case 'honey': {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.3, 14), mat('#ffb733'));
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 14), mat('#e05a3a'));
      lid.position.y = 0.17;
      const drip = put(ball(0.06, '#ffcc4d', 8, 6), 0.12, 0.1, 0.12, 1, 1.4, 1);
      g.add(pot, lid, drip);
      break;
    }
    case 'cheese': {
      const wedge = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 3, 1, false, 0, Math.PI * 0.6), mat('#ffd34d'));
      wedge.rotation.x = 0.3;
      g.add(wedge);
      for (let i = 0; i < 3; i++) g.add(put(ball(0.035, '#e8a920', 6, 4), 0.08 + i * 0.05, 0.11, 0.05 + i * 0.03));
      break;
    }
    case 'note': {
      const head = put(ball(0.1, '#7a4bc2', 10, 8), 0, 0, 0, 1.2, 0.9, 0.6);
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.03), mat('#7a4bc2'));
      stem.position.set(0.1, 0.2, 0);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.03), mat('#7a4bc2'));
      flag.position.set(0.17, 0.37, 0);
      flag.rotation.z = -0.5;
      g.add(head, stem, flag);
      break;
    }
    case 'ring': {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.09, 8, 18), mat('#ff5f6d'));
      g.add(ring);
      for (let i = 0; i < 4; i++) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.093, 8, 3, 0.35), mat('#ffffff'));
        band.rotation.z = (i / 4) * Math.PI * 2;
        g.add(band);
      }
      break;
    }
    case 'bamboo': {
      for (let i = 0; i < 3; i++) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 8), mat(i % 2 ? '#7cc36a' : '#6ab35a'));
        seg.position.y = i * 0.2 - 0.2;
        g.add(seg);
      }
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 4), mat('#4f9a3f'));
      leaf.position.set(0.12, 0.25, 0);
      leaf.rotation.z = -1;
      leaf.scale.z = 0.3;
      g.add(leaf);
      break;
    }
    case 'marshmallow': {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 5), mat('#a0643c'));
      stick.rotation.z = 0.4;
      const mm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 12), mat('#fff3e8'));
      mm.position.set(-0.13, 0.27, 0);
      mm.rotation.z = 0.4;
      const toast = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.04, 12), mat('#d9954a'));
      toast.position.set(-0.15, 0.32, 0);
      toast.rotation.z = 0.4;
      g.add(stick, mm, toast);
      break;
    }
  }
  return g;
}

/** Cake crumbs stuck around a mouth (the cake muncher's giveaway). */
export function makeCrumbs(): THREE.Group {
  const g = new THREE.Group();
  const cols = ['#f2c27a', '#e0a35a', '#fff0d0', '#ff8fb8'];
  for (let i = 0; i < 9; i++) {
    const cr = new THREE.Mesh(new THREE.DodecahedronGeometry(0.03 + (i % 3) * 0.008, 0), mat(cols[i % cols.length]));
    cr.position.set((i - 4) * 0.035 + Math.sin(i * 3.1) * 0.02, Math.cos(i * 2.3) * 0.04 - 0.02, Math.sin(i) * 0.02);
    g.add(cr);
  }
  return g;
}

export function makeTrumpet(): THREE.Group {
  const g = new THREE.Group();
  const gold = new THREE.MeshPhongMaterial({ color: '#ffcf4a', shininess: 110, specular: '#fff6c8', flatShading: true });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), gold);
  tube.rotation.x = Math.PI / 2;
  const bell = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 14, 1, true), gold);
  bell.material.side = THREE.DoubleSide;
  bell.rotation.x = -Math.PI / 2;
  bell.position.z = 0.32;
  const valves = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6), gold);
    v.position.set(0, 0.06, -0.05 + i * 0.06);
    valves.add(v);
  }
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 6, 12, Math.PI), gold);
  loop.rotation.y = Math.PI / 2;
  loop.position.set(0, -0.07, 0.05);
  g.add(tube, bell, valves, loop);
  return g;
}

export function makeBouquet(): THREE.Group {
  const g = new THREE.Group();
  const cols = ['#ff5f8f', '#ffd166', '#ff7a45', '#c99bff', '#ff4d6d'];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 4), mat('#4f9a3f'));
    stem.position.set(Math.cos(a) * 0.04, 0.0, Math.sin(a) * 0.04);
    stem.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    const tulip = put(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(cols[i % cols.length])), Math.cos(a) * 0.1, 0.2, Math.sin(a) * 0.1, 1, 1.3, 1);
    g.add(stem, tulip);
  }
  const wrap = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 8, 1, true), mat('#fff6e0', { side: THREE.DoubleSide }));
  wrap.rotation.x = Math.PI;
  wrap.position.y = -0.1;
  g.add(wrap);
  return g;
}

export function makeBalloon(color: string, string = 1.1): THREE.Group {
  const g = new THREE.Group();
  const b = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 14, 12),
    new THREE.MeshPhongMaterial({ color, shininess: 90, specular: '#ffffff', emissive: new THREE.Color(color).multiplyScalar(0.15) })
  );
  b.scale.set(1, 1.18, 1);
  b.position.y = string;
  b.castShadow = true;
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.06, 6), mat(color));
  knot.position.y = string - 0.26;
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, string, 3), mat('#ffffff'));
  line.position.y = string / 2;
  g.add(b, knot, line);
  return g;
}

/** Brown splashes on the feet: the puddle jumper. */
export function makeMud(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const s = put(new THREE.Mesh(new THREE.SphereGeometry(0.07 + (i % 3) * 0.02, 8, 6), mat('#7a4e2a')), Math.sin(i * 2.4) * 0.3, 0.06 + (i % 3) * 0.06, 0.2 + Math.cos(i * 1.7) * 0.12, 1, 0.5, 1);
    g.add(s);
  }
  return g;
}
