import * as THREE from 'three';
import { confettiGeometry } from './rooms/furniture';
import { iconTexture, kitMats, type V3 } from './rooms/kit';
import type { Clue } from './logic';

/**
 * Small visual helpers of the rooms: a felt-confetti burst (one instanced
 * draw call, no per-frame allocation), glow rings (hints, the finale step to
 * rewind), clue marks (footprint trails, yarn threads, clue badges) and the
 * magnifier's ghost props.
 */

const CONFETTI_COLORS = ['#e2453c', '#ffcc33', '#3f7fe0', '#3a9d4f', '#7950f2', '#f08c00', '#ff7ab8'];

export class Confetti {
  readonly mesh: THREE.InstancedMesh;
  private pos: Float32Array;
  private vel: Float32Array;
  private spin: Float32Array;
  private life = 0;
  private readonly n: number;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3(1, 1, 1);

  constructor(n = 48, low = false) {
    this.n = n;
    this.mesh = new THREE.InstancedMesh(confettiGeometry(), kitMats(low).felt('plain'), n);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) this.mesh.setColorAt(i, c.set(CONFETTI_COLORS[i % CONFETTI_COLORS.length]).convertSRGBToLinear());
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.spin = new Float32Array(n);
  }

  burst(at: THREE.Vector3, power = 1) {
    for (let i = 0; i < this.n; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = 2.5 + Math.random() * 2.5;
      const out = 1 + Math.random() * 1.8;
      this.pos[i * 3] = at.x;
      this.pos[i * 3 + 1] = at.y;
      this.pos[i * 3 + 2] = at.z;
      this.vel[i * 3] = Math.cos(a) * out * power;
      this.vel[i * 3 + 1] = up * power;
      this.vel[i * 3 + 2] = Math.sin(a) * out * power;
      this.spin[i] = Math.random() * 10;
    }
    this.life = 1.6;
    this.mesh.visible = true;
  }

  update(dt: number) {
    if (this.life <= 0) return;
    this.life -= dt;
    const k = Math.max(0, this.life / 1.6);
    for (let i = 0; i < this.n; i++) {
      const j = i * 3;
      this.vel[j + 1] -= 6 * dt;
      this.vel[j] *= 1 - dt * 1.2;
      this.vel[j + 2] *= 1 - dt * 1.2;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] = Math.max(0.03, this.pos[j + 1] + this.vel[j + 1] * dt);
      this.pos[j + 2] += this.vel[j + 2] * dt;
      this.spin[i] += dt * 6;
      this.q.setFromEuler(this.e.set(this.spin[i], this.spin[i] * 0.7, 0));
      this.s.setScalar(0.6 + 0.6 * k);
      this.mesh.setMatrixAt(i, this.m.compose(this.v.set(this.pos[j], this.pos[j + 1], this.pos[j + 2]), this.q, this.s));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.life <= 0) this.mesh.visible = false;
  }
}

/** A soft pulsing ring on the floor / furniture (hint, finale step to undo). */
export class GlowRing {
  readonly mesh: THREE.Mesh;
  private t = 0;
  private until = 0;

  constructor(color = '#ffd54a') {
    this.mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.46, 28),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false })
    );
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.visible = false;
    this.mesh.renderOrder = 2;
  }

  show(at: THREE.Vector3, size: number, seconds = 1e9) {
    this.mesh.position.set(at.x, at.y + 0.02, at.z);
    this.mesh.scale.setScalar(size);
    this.mesh.visible = true;
    this.until = this.t + seconds;
  }

  hide() {
    this.mesh.visible = false;
  }

  update(dt: number, reduce: boolean) {
    this.t += dt;
    if (!this.mesh.visible) return;
    if (this.t > this.until) {
      this.mesh.visible = false;
      return;
    }
    const m = this.mesh.material as THREE.MeshBasicMaterial;
    m.opacity = reduce ? 0.8 : 0.55 + 0.4 * Math.sin(this.t * 5);
  }
}

// ---------------------------------------------------------------------------
// Clue marks

type Draw = (g: CanvasRenderingContext2D, s: number) => void;

const ink = '#3b2a22';

/** Pictograms drawn on canvas (no emoji font needed). */
const ICONS: Record<string, Draw> = {
  bell: (g, s) => {
    g.fillStyle = '#ffcc33';
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.22);
    g.quadraticCurveTo(s * 0.74, s * 0.26, s * 0.74, s * 0.6);
    g.lineTo(s * 0.8, s * 0.7);
    g.lineTo(s * 0.2, s * 0.7);
    g.lineTo(s * 0.26, s * 0.6);
    g.quadraticCurveTo(s * 0.26, s * 0.26, s * 0.5, s * 0.22);
    g.fill();
    g.beginPath();
    g.arc(s * 0.5, s * 0.76, s * 0.07, 0, 6.28);
    g.fill();
    g.strokeStyle = ink;
    g.lineWidth = s * 0.03;
    for (const k of [-1, 1]) {
      g.beginPath();
      g.arc(s * 0.5, s * 0.5, s * 0.4, k > 0 ? -0.5 : Math.PI - 0.5 + 1, k > 0 ? 0.0 : Math.PI + 1);
      g.stroke();
    }
  },
  notes: (g, s) => {
    g.fillStyle = '#7950f2';
    g.strokeStyle = '#7950f2';
    g.lineWidth = s * 0.05;
    for (const [x, y] of [
      [0.32, 0.68],
      [0.64, 0.6],
    ]) {
      g.beginPath();
      g.ellipse(s * x, s * y, s * 0.09, s * 0.065, -0.4, 0, 6.28);
      g.fill();
      g.beginPath();
      g.moveTo(s * (x + 0.08), s * y);
      g.lineTo(s * (x + 0.08), s * (y - 0.4));
      g.stroke();
    }
    g.beginPath();
    g.moveTo(s * 0.4, s * 0.28);
    g.lineTo(s * 0.72, s * 0.2);
    g.stroke();
  },
  squeak: (g, s) => {
    g.fillStyle = '#a0612b';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.6, s * 0.24, s * 0.16, 0, 0, 6.28);
    g.fill();
    g.beginPath();
    g.arc(s * 0.36, s * 0.42, s * 0.09, 0, 6.28);
    g.arc(s * 0.6, s * 0.42, s * 0.09, 0, 6.28);
    g.fill();
    g.fillStyle = ink;
    g.beginPath();
    g.arc(s * 0.42, s * 0.56, s * 0.025, 0, 6.28);
    g.arc(s * 0.56, s * 0.56, s * 0.025, 0, 6.28);
    g.fill();
    g.strokeStyle = '#7950f2';
    g.lineWidth = s * 0.035;
    g.beginPath();
    g.arc(s * 0.82, s * 0.3, s * 0.08, -1.2, 1.2);
    g.stroke();
  },
  shh: (g, s) => {
    g.strokeStyle = ink;
    g.lineWidth = s * 0.06;
    g.beginPath();
    g.arc(s * 0.5, s * 0.5, s * 0.26, 0, 6.28);
    g.stroke();
    g.beginPath();
    g.moveTo(s * 0.32, s * 0.32);
    g.lineTo(s * 0.68, s * 0.68);
    g.stroke();
    g.fillStyle = '#ffcc33';
    g.beginPath();
    g.arc(s * 0.5, s * 0.5, s * 0.12, 0, 6.28);
    g.fill();
  },
  acorn: (g, s) => {
    g.fillStyle = '#c98a4a';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.6, s * 0.17, s * 0.2, 0, 0, 6.28);
    g.fill();
    g.fillStyle = '#6e3f1a';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.42, s * 0.22, s * 0.12, 0, Math.PI, 0);
    g.fill();
    g.fillRect(s * 0.47, s * 0.22, s * 0.06, s * 0.1);
  },
  button: (g, s) => {
    g.fillStyle = '#e8b33a';
    g.beginPath();
    g.arc(s * 0.5, s * 0.5, s * 0.22, 0, 6.28);
    g.fill();
    g.fillStyle = ink;
    for (const [x, y] of [
      [0.44, 0.44],
      [0.56, 0.44],
      [0.44, 0.56],
      [0.56, 0.56],
    ]) {
      g.beginPath();
      g.arc(s * x, s * y, s * 0.025, 0, 6.28);
      g.fill();
    }
  },
  curl: (g, s) => {
    g.strokeStyle = '#d06a2c';
    g.lineWidth = s * 0.07;
    g.beginPath();
    for (let a = 0; a < 12; a += 0.2) g.lineTo(s * 0.5 + Math.cos(a) * s * (0.05 + a * 0.016), s * 0.5 + Math.sin(a) * s * (0.05 + a * 0.016));
    g.stroke();
  },
  glasses: (g, s) => {
    g.strokeStyle = '#c99a2a';
    g.lineWidth = s * 0.06;
    g.beginPath();
    g.arc(s * 0.33, s * 0.52, s * 0.14, 0, 6.28);
    g.stroke();
    g.beginPath();
    g.arc(s * 0.67, s * 0.52, s * 0.14, 0, 6.28);
    g.stroke();
    g.beginPath();
    g.moveTo(s * 0.47, s * 0.5);
    g.lineTo(s * 0.53, s * 0.5);
    g.stroke();
  },
  bow: (g, s) => {
    g.fillStyle = '#e03131';
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.5);
    g.lineTo(s * 0.22, s * 0.32);
    g.lineTo(s * 0.22, s * 0.68);
    g.closePath();
    g.moveTo(s * 0.5, s * 0.5);
    g.lineTo(s * 0.78, s * 0.32);
    g.lineTo(s * 0.78, s * 0.68);
    g.closePath();
    g.fill();
    g.beginPath();
    g.arc(s * 0.5, s * 0.5, s * 0.07, 0, 6.28);
    g.fill();
  },
  ladder: (g, s) => {
    g.strokeStyle = '#a0612b';
    g.lineWidth = s * 0.05;
    g.beginPath();
    g.moveTo(s * 0.36, s * 0.2);
    g.lineTo(s * 0.36, s * 0.82);
    g.moveTo(s * 0.64, s * 0.2);
    g.lineTo(s * 0.64, s * 0.82);
    for (let i = 0; i < 4; i++) {
      g.moveTo(s * 0.36, s * (0.3 + i * 0.15));
      g.lineTo(s * 0.64, s * (0.3 + i * 0.15));
    }
    g.stroke();
    g.fillStyle = '#e2453c';
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.06);
    g.lineTo(s * 0.62, s * 0.18);
    g.lineTo(s * 0.38, s * 0.18);
    g.fill();
  },
  hat: (g, s) => {
    g.fillStyle = '#7950f2';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.6, s * 0.26, s * 0.08, 0, 0, 6.28);
    g.fill();
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.5, s * 0.15, s * 0.14, 0, Math.PI, 0);
    g.fill();
  },
  magnifier: (g, s) => {
    g.strokeStyle = ink;
    g.lineWidth = s * 0.06;
    g.beginPath();
    g.arc(s * 0.44, s * 0.44, s * 0.18, 0, 6.28);
    g.stroke();
    g.beginPath();
    g.moveTo(s * 0.57, s * 0.57);
    g.lineTo(s * 0.78, s * 0.78);
    g.stroke();
  },
};

const CLUE_ICON: Record<string, string> = {
  'bell-jingle': 'bell',
  hum: 'notes',
  'squeak-tiny': 'squeak',
  'no-bell': 'shh',
  'acorn-cap': 'acorn',
  'golden-button': 'button',
  'copper-curl': 'curl',
  'glasses-smudge': 'glasses',
  'braid-bow': 'bow',
  'high-shelf': 'ladder',
  'short-hat': 'hat',
  'no-glasses': 'magnifier',
};

const THREAD: Record<string, { a: string; b: string }> = {
  'stripe-yarn': { a: '#e03131', b: '#fbf6ee' },
  'thread-hazelnut': { a: '#8e5527', b: '#c98a4a' },
  'mustard-scarf': { a: '#e9ac2c', b: '#c98a1c' },
  'red-fluff': { a: '#e03131', b: '#ff8a8a' },
  'green-fluff': { a: '#3a9d4f', b: '#7ed38d' },
};

function badge(key: string): THREE.Sprite {
  const draw = ICONS[key] ?? ICONS.magnifier;
  const tex = iconTexture(`badge:${key}`, (g, s) => {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(s / 2, s / 2, s * 0.46, 0, 6.28);
    g.fill();
    g.lineWidth = s * 0.05;
    g.strokeStyle = '#ffb35c';
    g.stroke();
    draw(g, s);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.setScalar(0.62);
  sp.renderOrder = 5;
  return sp;
}

function footprintTexture(kind: string): THREE.CanvasTexture {
  return iconTexture(`foot:${kind}`, (g, s) => {
    g.fillStyle = 'rgba(70,40,25,0.75)';
    const tiny = kind === 'footprint-tiny';
    const sc = tiny ? 0.55 : 1;
    const cx = s / 2;
    const cy = s / 2;
    g.beginPath();
    if (kind === 'footprint-curly') {
      g.ellipse(cx, cy + s * 0.08, s * 0.14, s * 0.22, 0, 0, 6.28);
      g.fill();
      g.lineWidth = s * 0.07;
      g.strokeStyle = 'rgba(70,40,25,0.75)';
      g.beginPath();
      g.arc(cx + s * 0.08, cy - s * 0.2, s * 0.1, Math.PI, Math.PI * 2.3);
      g.stroke();
    } else if (kind === 'footprint-pointy') {
      g.moveTo(cx, cy - s * 0.36);
      g.quadraticCurveTo(cx + s * 0.18, cy, cx + s * 0.1, cy + s * 0.3);
      g.lineTo(cx - s * 0.1, cy + s * 0.3);
      g.quadraticCurveTo(cx - s * 0.18, cy, cx, cy - s * 0.36);
      g.fill();
    } else {
      g.ellipse(cx, cy + s * 0.06 * sc, s * 0.13 * sc, s * 0.22 * sc, 0, 0, 6.28);
      g.fill();
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.arc(cx - s * 0.09 * sc + i * s * 0.06 * sc, cy - s * 0.22 * sc, s * 0.035 * sc, 0, 6.28);
        g.fill();
      }
    }
  });
}

/** Builds the 3D marks of a set of clues around a pranked prop. */
export function clueMarks(clues: readonly Clue[], at: THREE.Vector3, toward: THREE.Vector3, low: boolean): THREE.Group {
  const g = new THREE.Group();
  const own: THREE.Material[] = [];
  g.userData.own = own;
  let badges = 0;
  for (const c of clues) {
    if (c.kind === 'footprint') {
      const tex = footprintTexture(c.id === 'footprint-big' ? 'footprint-round' : c.id);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
      own.push(mat);
      const n = 5;
      const size = c.id === 'footprint-tiny' ? 0.3 : 0.48;
      const geo = new THREE.PlaneGeometry(size, size);
      const prints = new THREE.InstancedMesh(geo, mat, n);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const dir = new THREE.Vector3(toward.x - at.x, 0, toward.z - at.z);
      const len = Math.max(1, dir.length());
      dir.normalize();
      const yaw = Math.atan2(dir.x, dir.z);
      const side = new THREE.Vector3(dir.z, 0, -dir.x);
      for (let i = 0; i < n; i++) {
        const t = 0.15 + (i / n) * 0.7;
        const p = new THREE.Vector3(at.x, 0.02, at.z).addScaledVector(dir, t * len).addScaledVector(side, i % 2 ? 0.12 : -0.12);
        q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, -yaw + Math.PI, 'YXZ'));
        prints.setMatrixAt(i, m.compose(p, q, new THREE.Vector3(1, 1, 1)));
      }
      prints.renderOrder = 1;
      g.add(prints);
    } else if (c.kind === 'thread' && THREAD[c.id]) {
      const t = THREAD[c.id];
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 14; i++) pts.push(new THREE.Vector3(-0.35 + i * 0.05, 0.03 + Math.abs(Math.sin(i * 0.9)) * 0.04, Math.sin(i * 1.3) * 0.08));
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.022, 5, false), kitMats(low).felt(c.pattern === 'stripes' ? 'stripes' : c.pattern === 'dots' ? 'dots' : 'zigzag'));
      const col = new THREE.Color(t.a).convertSRGBToLinear();
      const n = tube.geometry.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) col.toArray(arr, i * 3);
      tube.geometry.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      tube.position.set(at.x + 0.3, Math.max(0.02, at.y - 0.05), at.z + 0.35);
      g.add(tube);
      const b = badge(c.pattern === 'stripes' ? 'bow' : 'curl');
      own.push(b.material);
      g.add(placeBadge(b, at, badges++));
    } else {
      const b = badge(CLUE_ICON[c.id] ?? 'magnifier');
      own.push(b.material);
      g.add(placeBadge(b, at, badges++));
    }
  }
  return g;
}

function placeBadge(b: THREE.Sprite, at: THREE.Vector3, i: number): THREE.Sprite {
  b.position.set(at.x + (i - 0.5) * 0.7, at.y + 1.0 + (i % 2) * 0.15, at.z + 0.2);
  b.userData.baseY = b.position.y;
  return b;
}

/** Bob the clue badges gently (call each frame). */
export function bobMarks(g: THREE.Group | null, t: number, reduce: boolean) {
  if (!g || reduce) return;
  for (const c of g.children) if (c instanceof THREE.Sprite) c.position.y = (c.userData.baseY as number) + Math.sin(t * 2.4 + c.position.x) * 0.06;
}

export function disposeMarks(g: THREE.Group) {
  g.traverse((o) => {
    if (!(o instanceof THREE.Sprite)) (o as THREE.Mesh).geometry?.dispose();
  });
  for (const m of (g.userData.own as THREE.Material[] | undefined) ?? []) m.dispose();
}

/** A ghost of a prop where it belongs (magnifier). */
export function ghostOf(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 3;
  return m;
}

export const v3 = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);
