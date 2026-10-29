import * as THREE from 'three';
import type { CustomerId } from './logic';
import { canvasTex, soft } from './util';
import { rng } from '../kit/rng';

/**
 * The customers: round, cute animals built in code (a giraffe, a bear, a
 * rabbit, an elephant and a penguin), with glossy eyes, blushing cheeks and
 * a little rig: walking, talking, a surprised face, happy "^ ^" eyes,
 * chewing, dancing. Nobody is ever sad: the "surprised" face is a funny
 * "oh?" with round eyes. Origin on the ground, facing +z.
 */

export type Mood = 'smile' | 'talk' | 'surprised' | 'joy' | 'chew';
export type CritterCue = 'hop' | 'surprise' | 'joy' | 'wave' | 'gulp' | 'fan' | 'spin';

const CUE_LEN: Record<CritterCue, number> = { hop: 0.6, surprise: 0.9, joy: 1.4, wave: 1.6, gulp: 1.0, fan: 1.6, spin: 0.9 };

const EYE_MAT = () => new THREE.MeshStandardMaterial({ color: '#1d1a24', roughness: 0.18, metalness: 0.1 });
const SHINE = new THREE.MeshBasicMaterial({ color: '#ffffff' });

function ball(r: number, m: THREE.Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, seg = 18): THREE.Mesh {
  const b = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, Math.round(seg * 0.7))), m);
  b.position.set(x, y, z);
  b.scale.set(sx, sy, sz);
  b.castShadow = true;
  return b;
}
function capsule(r: number, len: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const c = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 5, 12), m);
  c.position.set(x, y, z);
  c.castShadow = true;
  return c;
}
function pivot(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const p = new THREE.Group();
  p.position.set(x, y, z);
  parent.add(p);
  return p;
}

interface Face {
  eyes: THREE.Group[];
  joy: THREE.Mesh[];
  smile: THREE.Mesh | null;
  open: THREE.Group | null;
  ooh: THREE.Mesh | null;
  cheeks: THREE.Mesh[];
}

function makeFace(head: THREE.Object3D, o: { ex: number; ey: number; ez: number; er: number; mx?: number; my?: number; mz?: number; mw?: number; cx: number; cy: number; cz: number; cr?: number }): Face {
  const eyeMat = EYE_MAT();
  const eyes: THREE.Group[] = [];
  const joy: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(s * o.ex, o.ey, o.ez);
    g.rotation.y = Math.atan2(s * o.ex, o.ez) * 0.8;
    const e = new THREE.Mesh(new THREE.SphereGeometry(o.er, 16, 12), eyeMat);
    e.scale.set(0.78, 1, 0.45);
    const h1 = new THREE.Mesh(new THREE.SphereGeometry(o.er * 0.3, 8, 6), SHINE);
    h1.position.set(o.er * 0.24, o.er * 0.36, o.er * 0.36);
    const h2 = new THREE.Mesh(new THREE.SphereGeometry(o.er * 0.14, 6, 4), SHINE);
    h2.position.set(-o.er * 0.22, -o.er * 0.3, o.er * 0.36);
    g.add(e, h1, h2);
    head.add(g);
    eyes.push(g);
    const j = new THREE.Mesh(new THREE.TorusGeometry(o.er * 0.62, o.er * 0.2, 6, 14, Math.PI), eyeMat);
    j.position.copy(g.position).add(new THREE.Vector3(0, -o.er * 0.25, 0.01));
    j.rotation.y = g.rotation.y;
    j.visible = false;
    head.add(j);
    joy.push(j);
  }
  let smile: THREE.Mesh | null = null;
  let open: THREE.Group | null = null;
  let ooh: THREE.Mesh | null = null;
  if (o.mw !== undefined) {
    const mouthMat = new THREE.MeshStandardMaterial({ color: '#5a2430', roughness: 0.5 });
    smile = new THREE.Mesh(new THREE.TorusGeometry(o.mw, o.mw * 0.24, 6, 14, Math.PI), mouthMat);
    smile.rotation.z = Math.PI;
    smile.position.set(o.mx ?? 0, o.my!, o.mz!);
    open = new THREE.Group();
    const hole = new THREE.Mesh(new THREE.SphereGeometry(o.mw * 0.95, 12, 8), new THREE.MeshStandardMaterial({ color: '#7a2a3a', roughness: 0.6 }));
    hole.scale.set(1, 0.8, 0.35);
    const tongue = new THREE.Mesh(new THREE.SphereGeometry(o.mw * 0.55, 10, 6), new THREE.MeshStandardMaterial({ color: '#ff8fa8', roughness: 0.6 }));
    tongue.scale.set(1, 0.5, 0.4);
    tongue.position.set(0, -o.mw * 0.4, o.mw * 0.12);
    open.add(hole, tongue);
    open.position.copy(smile.position).add(new THREE.Vector3(0, -o.mw * 0.3, 0));
    open.visible = false;
    ooh = new THREE.Mesh(new THREE.TorusGeometry(o.mw * 0.45, o.mw * 0.2, 6, 14), mouthMat);
    ooh.position.copy(open.position);
    ooh.visible = false;
    head.add(smile, open, ooh);
  }
  const cheekMat = soft('#ff9db8', { roughness: 0.9 });
  const cheeks = [-1, 1].map((s) => {
    const c = ball(o.cr ?? o.er * 1.05, cheekMat, s * o.cx, o.cy, o.cz, 1, 0.62, 0.3, 12);
    c.rotation.y = Math.atan2(s * o.cx, o.cz);
    c.castShadow = false;
    head.add(c);
    return c;
  });
  return { eyes, joy, smile, open, ooh, cheeks };
}

function spotsTexture(): THREE.CanvasTexture {
  return canvasTex(
    256,
    256,
    (g) => {
      g.fillStyle = '#f9c84f';
      g.fillRect(0, 0, 256, 256);
      const r = rng(11);
      for (let i = 0; i < 26; i++) {
        const cx = r() * 256;
        const cy = r() * 256;
        const s = 14 + r() * 16;
        g.fillStyle = '#c8722e';
        for (const [dx, dy] of [
          [0, 0],
          [256, 0],
          [-256, 0],
          [0, 256],
          [0, -256],
        ]) {
          g.beginPath();
          const n = 6;
          for (let k = 0; k <= n; k++) {
            const a = (k / n) * Math.PI * 2;
            const rr = s * (0.75 + ((k * 7 + i) % 3) * 0.12);
            const x = cx + dx + Math.cos(a) * rr;
            const y = cy + dy + Math.sin(a) * rr * 0.85;
            if (k === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
          }
          g.closePath();
          g.fill();
        }
      }
    },
    [2, 2]
  );
}

export class Critter {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  head = new THREE.Group();
  face!: Face;
  arms: THREE.Group[] = [];
  legs: THREE.Group[] = [];
  ears: THREE.Group[] = [];
  trunk: THREE.Group[] = [];
  neck: THREE.Group | null = null;
  beak: THREE.Group | null = null;
  tail: THREE.Group | null = null;
  /** Where the food goes. */
  readonly mouth = new THREE.Object3D();
  /** Over the head: the order bubble hangs here. */
  readonly top = new THREE.Object3D();
  height = 2;
  /** Short customers stand on the crate. */
  small = false;

  walk = 0;
  mood: Mood = 'smile';
  dance = false;
  /** Penguin belly slide. */
  slide = 0;
  /** Extra head turn (towards the camera, the pizza…). */
  lookYaw = 0;
  lookPitch = 0;
  /** Giraffe: neck tilt forward (0.4 at rest), elephant: trunk reach (0..1). */
  neckTilt = 0.4;
  reach = 0;

  private cueKind: CritterCue | null = null;
  private cueT = 0;
  private walkPhase = 0;
  private blinkAt = 1 + Math.random() * 2;
  private blinkT = -1;
  private headBase = new THREE.Vector3();
  private phase = Math.random() * 10;

  constructor(readonly id: CustomerId) {
    this.root.add(this.body);
    switch (id) {
      case 'bear':
        this.buildBear();
        break;
      case 'rabbit':
        this.buildRabbit();
        break;
      case 'elephant':
        this.buildElephant();
        break;
      case 'penguin':
        this.buildPenguin();
        break;
      case 'giraffe':
        this.buildGiraffe();
        break;
    }
    this.headBase.copy(this.head.position);
  }

  get busy() {
    return this.cueKind !== null;
  }

  cue(kind: CritterCue) {
    this.cueKind = kind;
    this.cueT = 0;
  }

  /* ───────────── Builders ───────────── */

  private buildBear() {
    const skin = soft('#a86a3d');
    const light = soft('#f2cfa0');
    const dark = soft('#3a2418', { roughness: 0.35 });
    const b = this.body;
    b.add(ball(0.6, skin, 0, 0.95, 0, 1, 1.05, 0.9));
    b.add(ball(0.42, light, 0, 0.88, 0.33, 1, 1.15, 0.45));
    b.add(ball(0.1, skin, 0, 0.7, -0.55));
    for (const s of [-1, 1]) {
      const leg = pivot(b, s * 0.27, 0.5, 0);
      leg.add(capsule(0.16, 0.18, skin, 0, -0.18, 0));
      leg.add(ball(0.19, skin, 0, -0.42, 0.06, 1, 0.55, 1.25));
      leg.add(ball(0.1, light, 0, -0.42, 0.28, 1, 0.8, 0.3, 10));
      this.legs.push(leg);
      const arm = pivot(b, s * 0.52, 1.3, 0.05);
      const a = capsule(0.13, 0.32, skin, s * 0.06, -0.26, 0);
      a.rotation.z = s * 0.22;
      arm.add(a, ball(0.14, skin, s * 0.11, -0.5, 0.02));
      this.arms.push(arm);
    }
    // Red bow tie.
    const red = soft('#ec4a3f');
    for (const s of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 10), red);
      c.rotation.z = (s * Math.PI) / 2;
      c.position.set(s * 0.1, 1.44, 0.5);
      b.add(c);
    }
    b.add(ball(0.05, red, 0, 1.44, 0.53));
    const h = pivot(b, 0, 1.68, 0.02);
    this.head = h;
    h.add(ball(0.5, skin, 0, 0.12, 0));
    for (const s of [-1, 1]) {
      const ear = pivot(h, s * 0.34, 0.52, -0.05);
      ear.add(ball(0.16, skin), ball(0.09, soft('#e8a487'), 0, 0, 0.09, 1, 1, 0.4, 10));
      this.ears.push(ear);
    }
    h.add(ball(0.22, light, 0, -0.02, 0.4, 1.25, 0.88, 0.85));
    h.add(ball(0.08, dark, 0, 0.08, 0.6, 1.35, 0.9, 0.85, 12));
    h.add(ball(0.025, SHINE, 0.03, 0.12, 0.66, 1, 1, 1, 6));
    this.face = makeFace(h, { ex: 0.19, ey: 0.24, ez: 0.43, er: 0.075, my: -0.1, mz: 0.58, mw: 0.07, cx: 0.32, cy: 0.06, cz: 0.36 });
    this.mouth.position.set(0, -0.05, 0.66);
    this.top.position.set(0, 0.8, 0);
    h.add(this.mouth, this.top);
    this.height = 2.35;
  }

  private buildRabbit() {
    const fur = soft('#f5eff7');
    const white = soft('#ffffff');
    const pink = soft('#ffb3c9');
    const b = this.body;
    b.add(ball(0.4, fur, 0, 0.62, 0, 1, 1.12, 0.92));
    b.add(ball(0.3, white, 0, 0.58, 0.27, 1, 1.2, 0.4));
    b.add(ball(0.13, white, 0, 0.48, -0.42));
    for (const s of [-1, 1]) {
      const leg = pivot(b, s * 0.18, 0.3, 0);
      leg.add(ball(0.17, fur, 0, -0.08, -0.02));
      leg.add(ball(0.14, fur, 0, -0.24, 0.12, 0.85, 0.5, 1.7));
      this.legs.push(leg);
      const arm = pivot(b, s * 0.33, 0.88, 0.08);
      arm.add(capsule(0.075, 0.2, fur, 0, -0.17, 0), ball(0.085, fur, 0, -0.33, 0.02));
      this.arms.push(arm);
    }
    const h = pivot(b, 0, 1.12, 0.03);
    this.head = h;
    h.add(ball(0.4, fur, 0, 0.15, 0, 1.05, 0.95, 1));
    for (const s of [-1, 1]) {
      const ear = pivot(h, s * 0.15, 0.46, -0.04);
      ear.rotation.z = -s * 0.2;
      const e = capsule(0.095, 0.5, fur, 0, 0.32, 0);
      e.scale.z = 0.55;
      const inner = capsule(0.06, 0.42, pink, 0, 0.32, 0.04);
      inner.scale.z = 0.4;
      ear.add(e, inner);
      if (s > 0) ear.rotation.x = -0.35;
      this.ears.push(ear);
    }
    h.add(ball(0.11, white, -0.085, 0.0, 0.33), ball(0.11, white, 0.085, 0.0, 0.33));
    h.add(ball(0.05, soft('#ff8fb0', { roughness: 0.4 }), 0, 0.08, 0.41, 1.2, 0.9, 1, 10));
    for (const s of [-1, 1]) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.07, 0.02), white);
      tooth.position.set(s * 0.026, -0.11, 0.405);
      h.add(tooth);
      for (const k of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.22, 3), soft('#d8cfe0'));
        w.rotation.z = Math.PI / 2 + k * 0.15 * s;
        w.position.set(s * 0.24, 0.02 + k * 0.03, 0.36);
        h.add(w);
      }
    }
    // A little flower by the ear.
    const flower = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      flower.add(ball(0.045, soft('#ff7ab8'), Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0, 1, 1, 0.5, 8));
    }
    flower.add(ball(0.035, soft('#ffd166'), 0, 0, 0.02, 1, 1, 1, 8));
    flower.position.set(0.24, 0.5, 0.12);
    flower.rotation.y = 0.5;
    h.add(flower);
    this.face = makeFace(h, { ex: 0.16, ey: 0.25, ez: 0.33, er: 0.066, my: -0.035, mz: 0.43, mw: 0.04, cx: 0.27, cy: 0.1, cz: 0.27 });
    this.mouth.position.set(0, -0.02, 0.44);
    this.top.position.set(0, 1.05, 0);
    h.add(this.mouth, this.top);
    this.height = 1.95;
    this.small = true;
  }

  private buildElephant() {
    const skin = soft('#9fb4d8');
    const light = soft('#c4d3ec');
    const pink = soft('#f5bccb');
    const white = soft('#ffffff');
    const b = this.body;
    b.add(ball(0.62, skin, 0, 1.0, 0, 1.05, 1.02, 0.95));
    b.add(ball(0.45, light, 0, 0.92, 0.33, 1, 1.1, 0.45));
    for (const s of [-1, 1]) {
      const leg = pivot(b, s * 0.3, 0.55, 0);
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.55, 14), skin);
      l.position.y = -0.28;
      l.castShadow = true;
      leg.add(l);
      for (let k = -1; k <= 1; k++) leg.add(ball(0.045, white, k * 0.1, -0.5, 0.2, 1, 0.8, 0.6, 8));
      this.legs.push(leg);
      const arm = pivot(b, s * 0.55, 1.32, 0.05);
      const a = capsule(0.15, 0.3, skin, s * 0.05, -0.25, 0);
      a.rotation.z = s * 0.2;
      arm.add(a, ball(0.16, skin, s * 0.1, -0.48, 0));
      this.arms.push(arm);
    }
    const tail = pivot(b, 0, 0.9, -0.55);
    const tl = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.4, 5), skin);
    tl.position.y = -0.2;
    tail.add(tl, ball(0.06, soft('#5a6c8f'), 0, -0.42, 0));
    tail.rotation.x = 0.4;
    this.tail = tail;
    const h = pivot(b, 0, 1.72, 0.05);
    this.head = h;
    h.add(ball(0.55, skin, 0, 0.14, 0, 1.05, 0.98, 1));
    for (const s of [-1, 1]) {
      const ear = pivot(h, s * 0.42, 0.12, -0.08);
      ear.add(ball(0.44, skin, s * 0.24, 0, 0, 1, 1, 0.18), ball(0.33, pink, s * 0.24, 0, 0.06, 1, 1, 0.12));
      ear.rotation.y = -s * 0.35;
      this.ears.push(ear);
    }
    // The trunk: a chain of segments that curls, reaches and slurps.
    let parent: THREE.Object3D = pivot(h, 0, -0.02, 0.5);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const seg = i === 0 ? (parent as THREE.Group) : pivot(parent, 0, -0.15, 0);
      const r0 = 0.15 - i * 0.015;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r0 - 0.012, 0.17, 12), skin);
      c.position.y = -0.075;
      c.castShadow = true;
      seg.add(c);
      if (i === n - 1) {
        const tip = new THREE.Mesh(new THREE.TorusGeometry(r0 - 0.015, 0.022, 6, 12), soft('#8299c4'));
        tip.rotation.x = Math.PI / 2;
        tip.position.y = -0.16;
        seg.add(tip);
        this.mouth.position.set(0, -0.2, 0);
        seg.add(this.mouth);
      }
      this.trunk.push(seg);
      parent = seg;
    }
    for (const s of [-1, 1]) {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 8), white);
      tusk.position.set(s * 0.18, -0.12, 0.44);
      tusk.rotation.x = 1.9;
      h.add(tusk);
    }
    // A little yellow cap.
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.14, 16), soft('#ffcf4a'));
    cap.position.set(0.05, 0.66, 0);
    cap.rotation.z = -0.15;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 16, 1, false, 0, Math.PI), soft('#ffcf4a'));
    brim.position.set(0.05, 0.6, 0.18);
    brim.rotation.y = Math.PI / 2;
    h.add(cap, brim);
    this.face = makeFace(h, { ex: 0.21, ey: 0.27, ez: 0.46, er: 0.07, my: -0.24, mz: 0.44, mw: 0.06, cx: 0.34, cy: 0.06, cz: 0.4 });
    this.top.position.set(0, 0.9, 0);
    h.add(this.top);
    this.height = 2.5;
  }

  private buildPenguin() {
    const navy = soft('#2f3a5e');
    const white = soft('#fbfbff');
    const orange = soft('#ff9f2e', { roughness: 0.5 });
    const b = this.body;
    b.add(ball(0.5, navy, 0, 0.72, 0, 1, 1.3, 0.92));
    b.add(ball(0.43, white, 0, 0.66, 0.2, 0.95, 1.18, 0.6));
    for (const s of [-1, 1]) {
      const leg = pivot(b, s * 0.17, 0.08, 0);
      leg.add(ball(0.13, orange, 0, -0.03, 0.12, 1, 0.35, 1.5, 12));
      this.legs.push(leg);
      const arm = pivot(b, s * 0.45, 1.0, 0);
      const f = capsule(0.09, 0.36, navy, s * 0.04, -0.24, 0);
      f.scale.z = 0.35;
      f.rotation.z = s * 0.2;
      arm.add(f);
      this.arms.push(arm);
    }
    // A red scarf (he is a penguin, after all).
    const red = soft('#ec4a3f');
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.07, 8, 24), red);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.16;
    scarf.scale.set(1, 0.9, 1);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.05), red);
    tail.position.set(0.17, 0.98, 0.3);
    tail.rotation.z = 0.25;
    b.add(scarf, tail);
    const h = pivot(b, 0, 1.28, 0);
    this.head = h;
    h.add(ball(0.38, navy, 0, 0.12, 0));
    h.add(ball(0.2, white, -0.11, 0.15, 0.22, 1, 1.2, 0.6), ball(0.2, white, 0.11, 0.15, 0.22, 1, 1.2, 0.6), ball(0.18, white, 0, 0.02, 0.26, 1.3, 0.8, 0.5));
    const up = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 10), orange);
    up.rotation.x = Math.PI / 2;
    up.scale.set(1.25, 1, 0.6);
    up.position.set(0, 0.06, 0.46);
    h.add(up);
    const beak = pivot(h, 0, 0.02, 0.38);
    const low = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.15, 10), orange);
    low.rotation.x = Math.PI / 2;
    low.scale.set(1.2, 1, 0.5);
    low.position.z = 0.07;
    beak.add(low);
    this.beak = beak;
    this.face = makeFace(h, { ex: 0.12, ey: 0.2, ez: 0.35, er: 0.056, cx: 0.22, cy: 0.06, cz: 0.3, cr: 0.06 });
    this.mouth.position.set(0, 0.04, 0.52);
    this.top.position.set(0, 0.72, 0);
    h.add(this.mouth, this.top);
    this.height = 1.75;
    this.small = true;
  }

  private buildGiraffe() {
    const spots = spotsTexture();
    const coat = soft('#ffffff', { map: spots });
    const neckTex = spots.clone();
    neckTex.repeat.set(1, 3);
    neckTex.needsUpdate = true;
    const neckCoat = soft('#ffffff', { map: neckTex });
    const light = soft('#fde7b5');
    const dark = soft('#6b4226');
    const b = this.body;
    b.add(ball(0.6, coat, 0, 1.78, 0, 0.85, 0.78, 1.3));
    for (const [x, z] of [
      [-0.26, 0.42],
      [0.26, 0.42],
      [-0.26, -0.42],
      [0.26, -0.42],
    ]) {
      const leg = pivot(b, x, 1.5, z);
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.075, 1.36, 10), neckCoat);
      l.position.y = -0.68;
      l.castShadow = true;
      const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.14, 10), dark);
      hoof.position.y = -1.4;
      leg.add(l, hoof);
      this.legs.push(leg);
    }
    const tail = pivot(b, 0, 1.9, -0.75);
    const tl = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.6, 5), coat);
    tl.position.y = -0.3;
    tail.add(tl, ball(0.07, dark, 0, -0.62, 0, 1, 1.4, 1, 10));
    tail.rotation.x = 0.25;
    this.tail = tail;
    const neck = pivot(b, 0, 2.0, 0.55);
    const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.21, 2.0, 14), neckCoat);
    nk.position.y = 1.0;
    nk.castShadow = true;
    neck.add(nk);
    for (let k = 0; k < 8; k++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.1), soft('#c8722e'));
      m.position.set(0, 0.25 + k * 0.23, -0.17 + k * 0.006);
      neck.add(m);
    }
    neck.rotation.x = 0.4;
    this.neck = neck;
    const h = pivot(neck, 0, 2.0, 0);
    this.head = h;
    h.add(ball(0.3, coat, 0, 0.1, 0.02, 0.92, 0.85, 1.12));
    h.add(ball(0.2, light, 0, -0.01, 0.28, 0.92, 0.78, 1.0));
    for (const s of [-1, 1]) {
      h.add(ball(0.022, dark, s * 0.06, 0.06, 0.47, 1, 0.7, 0.6, 6));
      const oss = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.04, 0.22, 8), coat);
      oss.position.set(s * 0.1, 0.42, -0.04);
      oss.rotation.z = -s * 0.15;
      h.add(oss, ball(0.055, dark, s * 0.115, 0.54, -0.04, 1, 1, 1, 10));
      const ear = pivot(h, s * 0.24, 0.27, -0.06);
      const e = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.24, 10), coat);
      e.rotation.z = -s * 1.25;
      e.scale.z = 0.5;
      ear.add(e);
      this.ears.push(ear);
      // Long lashes.
      for (let k = 0; k < 3; k++) {
        const lash = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.012), dark);
        lash.position.set(s * (0.13 + k * 0.03), 0.29 + (k === 1 ? 0.01 : 0), 0.24 - k * 0.02);
        lash.rotation.z = -s * (0.3 + k * 0.25);
        h.add(lash);
      }
    }
    this.face = makeFace(h, { ex: 0.16, ey: 0.2, ez: 0.24, er: 0.06, my: -0.1, mz: 0.46, mw: 0.055, cx: 0.22, cy: 0.04, cz: 0.26, cr: 0.055 });
    this.mouth.position.set(0, -0.05, 0.5);
    this.top.position.set(0, 0.75, 0);
    h.add(this.mouth, this.top);
    this.height = 4.4;
  }

  /* ───────────── Animation ───────────── */

  update(dt: number, t: number, E: number) {
    const P = { y: 0, sq: Math.sin(t * 2.2 + this.phase) * 0.018 * E, roll: 0, pitch: 0, turn: 0, hy: 0, hp: 0, hr: 0, arm: [0, 0], armOut: [0, 0], mouthOpen: 0 };
    let mood: Mood = this.mood;
    // Walking: a bouncy little trot.
    if (this.walk > 0.01) {
      this.walkPhase += dt * 9 * Math.min(1.2, this.walk);
      const s = Math.sin(this.walkPhase);
      P.y += Math.abs(s) * 0.1 * this.walk * E;
      P.roll += s * (this.id === 'penguin' ? 0.16 : 0.06) * this.walk * E;
      P.arm = [s * 0.5 * this.walk, -s * 0.5 * this.walk];
      this.legs.forEach((l, i) => {
        const ph = this.legs.length === 4 ? (i === 0 || i === 3 ? 0 : Math.PI) : i * Math.PI;
        l.rotation.x = Math.sin(this.walkPhase + ph) * 0.55 * this.walk;
      });
    } else this.legs.forEach((l) => (l.rotation.x *= 0.8));
    if (this.dance) {
      const b = t * 5.2 + this.phase;
      P.y += Math.abs(Math.sin(b)) * 0.14 * E;
      P.roll += Math.sin(b) * 0.14 * E;
      P.armOut = [1.2 + Math.sin(b) * 0.6, 1.2 - Math.sin(b) * 0.6];
      P.hr += Math.sin(b) * 0.1;
      mood = 'joy';
    }
    // One-shot cues.
    if (this.cueKind) {
      this.cueT += dt;
      const len = CUE_LEN[this.cueKind];
      const p = Math.min(1, this.cueT / len);
      const env = Math.sin(p * Math.PI);
      switch (this.cueKind) {
        case 'hop':
          P.y += Math.sin(p * Math.PI) * 0.35 * E;
          P.sq -= Math.sin(p * Math.PI * 2) * 0.05;
          break;
        case 'surprise':
          P.y += (p < 0.4 ? Math.sin((p / 0.4) * Math.PI) : 0) * 0.28 * E;
          P.pitch -= env * 0.18;
          P.armOut = [env * 1.4, env * 1.4];
          mood = 'surprised';
          break;
        case 'joy':
          P.y += Math.abs(Math.sin(p * Math.PI * 2)) * 0.3 * E;
          P.armOut = [env * 2.2, env * 2.2];
          P.turn += this.id === 'giraffe' ? 0 : Math.sin(p * Math.PI * 2) * 0.4 * E;
          mood = 'joy';
          break;
        case 'wave':
          P.armOut = [P.armOut[0], 2.3 * env];
          P.arm = [P.arm[0], Math.sin(p * Math.PI * 8) * 0.4 * env];
          P.hr += 0.1 * env;
          break;
        case 'gulp':
          P.hp -= env * 0.5;
          P.y += env * 0.1;
          mood = p < 0.6 ? 'chew' : 'joy';
          break;
        case 'fan':
          P.armOut = [1.0 + Math.sin(p * 60) * 0.6 * env, 1.0 + Math.sin(p * 60 + 1) * 0.6 * env];
          P.hr += Math.sin(p * 14) * 0.08;
          mood = 'surprised';
          break;
        case 'spin':
          P.turn += p * Math.PI * 2;
          P.y += env * 0.25;
          mood = 'joy';
          break;
      }
      if (p >= 1) this.cueKind = null;
    }
    if (mood === 'talk') P.mouthOpen = Math.max(0, Math.sin(t * 15 + this.phase)) > 0.2 ? 1 : 0.15;
    if (mood === 'chew') P.mouthOpen = Math.abs(Math.sin(t * 12)) * 0.8;
    if (mood === 'joy') P.mouthOpen = 0.8;

    // Face.
    const f = this.face;
    const happy = mood === 'joy' || mood === 'chew';
    this.blinkAt -= dt;
    if (this.blinkAt <= 0 && this.blinkT < 0) {
      this.blinkT = 0;
      this.blinkAt = 2 + Math.random() * 3;
    }
    let lid = 1;
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      lid = 1 - Math.sin(Math.min(1, this.blinkT / 0.16) * Math.PI) * 0.9;
      if (this.blinkT > 0.16) this.blinkT = -1;
    }
    const big = mood === 'surprised' ? 1.3 : 1;
    f.eyes.forEach((e) => {
      e.visible = !happy;
      e.scale.set(big, big * lid, big);
    });
    f.joy.forEach((j) => (j.visible = happy));
    f.cheeks.forEach((c) => c.scale.set(happy ? 1.2 : 1, (happy ? 1.2 : 1) * 0.62, 0.3));
    if (f.smile && f.open && f.ooh) {
      const open = P.mouthOpen > 0.3;
      f.smile.visible = mood !== 'surprised' && !open;
      f.ooh.visible = mood === 'surprised';
      f.open.visible = open && mood !== 'surprised';
      f.open.scale.set(1, 0.6 + P.mouthOpen * 0.6, 1);
    }
    if (this.beak) this.beak.rotation.x = mood === 'surprised' ? 0.5 : P.mouthOpen * 0.45;

    // Ears and tail wiggle; the trunk curls; the giraffe's neck.
    this.ears.forEach((e, i) => {
      const s = i === 0 ? -1 : 1;
      if (this.id === 'elephant') e.rotation.y = -s * (0.35 + Math.sin(t * 2.4 + i) * 0.12 * E + (happy ? Math.sin(t * 14) * 0.15 : 0));
      else if (this.id === 'rabbit') e.rotation.z = -s * 0.2 + Math.sin(t * 3 + i * 2) * 0.06 * E + (happy ? Math.sin(t * 18 + i) * 0.12 : 0);
      else e.rotation.z = Math.sin(t * 2 + i) * 0.05 * E;
    });
    if (this.tail) this.tail.rotation.z = Math.sin(t * 3 + this.phase) * 0.3 * E;
    if (this.trunk.length) {
      const reach = this.reach;
      this.trunk.forEach((seg, i) => {
        const curl = i === 0 ? -0.15 : -0.26 + Math.sin(t * 1.8 - i * 0.6) * 0.07 * E;
        const fwd = i === 0 ? -1.35 : -0.05;
        seg.rotation.x = curl + (fwd - curl) * reach;
        seg.rotation.z = Math.sin(t * 1.3 - i * 0.5) * 0.04 * E * (1 - reach);
      });
    }
    if (this.neck) {
      this.neck.rotation.x = this.neckTilt + Math.sin(t * 1.1 + this.phase) * 0.03 * E;
      P.hp -= this.neckTilt - 0.15;
    }

    // Arms.
    this.arms.forEach((a, i) => {
      const s = i === 0 ? -1 : 1;
      a.rotation.x = -P.arm[i];
      a.rotation.z = s * P.armOut[i];
    });

    // Body, slide, head.
    const b = this.body;
    if (this.slide > 0) {
      b.rotation.x = this.slide * (Math.PI / 2 - 0.15);
      P.y += this.slide * 0.42;
    } else b.rotation.x = P.pitch;
    b.position.y = P.y;
    b.scale.set(1 - P.sq * 0.5, 1 + P.sq, 1 - P.sq * 0.5);
    b.rotation.z = P.roll;
    b.rotation.y = P.turn;
    const h = this.head;
    h.rotation.y += (this.lookYaw + P.hy - h.rotation.y) * Math.min(1, dt * 6);
    h.rotation.x += (this.lookPitch + P.hp - h.rotation.x) * Math.min(1, dt * 6);
    h.rotation.z = P.hr + (mood === 'talk' ? Math.sin(t * 7) * 0.05 : 0) + (mood === 'surprised' ? 0.12 : 0);
  }

  dispose() {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const x of mats) {
        if (x === SHINE) continue;
        (x as THREE.MeshStandardMaterial).map?.dispose();
        x.dispose();
      }
    });
  }
}

/* ───────────────────────── The pigeon ───────────────────────── */

export class Pigeon {
  readonly group = new THREE.Group();
  readonly body = new THREE.Group();
  readonly head = new THREE.Group();
  readonly beak = new THREE.Object3D();
  wings: THREE.Group[] = [];
  flying = false;
  private peck = 1 + Math.random() * 3;
  private peckT = -1;
  private phase = Math.random() * 10;

  constructor() {
    const grey = soft('#a9b2c4');
    const dark = soft('#7d879c');
    this.group.add(this.body);
    this.body.add(ball(0.16, grey, 0, 0.2, 0, 0.9, 0.85, 1.35));
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.025, 0.18), dark);
    tail.position.set(0, 0.22, -0.26);
    tail.rotation.x = -0.25;
    this.body.add(tail);
    for (const s of [-1, 1]) {
      const w = pivot(this.body, s * 0.12, 0.27, 0.02);
      w.add(ball(0.13, dark, s * 0.06, 0, -0.02, 0.45, 0.2, 1.1, 10));
      this.wings.push(w);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 4), soft('#f08a5d'));
      leg.position.set(s * 0.05, 0.05, 0.02);
      this.body.add(leg);
    }
    this.head.position.set(0, 0.3, 0.14);
    this.body.add(this.head);
    this.head.add(ball(0.1, soft('#6fbf9a'), 0, -0.04, -0.02, 1, 0.9, 1, 12));
    this.head.add(ball(0.085, soft('#8e98ad'), 0, 0.05, 0.04, 1, 1, 1, 12));
    const bk = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.07, 6), soft('#f2c14e'));
    bk.rotation.x = Math.PI / 2;
    bk.position.set(0, 0.04, 0.15);
    this.head.add(bk);
    this.beak.position.set(0, 0.03, 0.18);
    this.head.add(this.beak);
    for (const s of [-1, 1]) {
      const e = ball(0.018, EYE_MAT(), s * 0.05, 0.08, 0.09, 1, 1, 1, 8);
      e.castShadow = false;
      this.head.add(e);
    }
    this.group.scale.setScalar(1.25);
  }

  update(dt: number, t: number, E: number) {
    if (this.flying) {
      const f = Math.sin(t * 28 + this.phase);
      this.wings.forEach((w, i) => (w.rotation.z = (i === 0 ? -1 : 1) * (0.3 + f * 0.9)));
      this.body.rotation.x = -0.25;
      this.head.rotation.x = 0;
      return;
    }
    this.wings.forEach((w) => (w.rotation.z *= 0.8));
    this.body.rotation.x *= 0.9;
    this.peck -= dt;
    if (this.peck <= 0 && this.peckT < 0) {
      this.peckT = 0;
      this.peck = 1.5 + Math.random() * 3;
    }
    if (this.peckT >= 0) {
      this.peckT += dt;
      this.head.rotation.x = Math.sin(Math.min(1, this.peckT / 0.35) * Math.PI) * 0.9 * E;
      if (this.peckT > 0.35) this.peckT = -1;
    } else this.head.rotation.y = Math.sin(t * 0.7 + this.phase) * 0.5 * E;
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose?.();
    });
  }
}
