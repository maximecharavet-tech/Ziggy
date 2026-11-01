import * as THREE from 'three';
import { glowTex } from '../kit/look';
import { bubbleTexture, spriteOf, starTexture, stripes } from './util';

/**
 * Little effects: sparks with gravity (splash drops, confetti, fireworks) in
 * one Points cloud, the big number that pops when the cart lands on a
 * station, Ziggy's scarf that flutters in the wind (and flies away during
 * the loop!), and the dizzy stars after the splash.
 */

/** A pool of glowing particles with gravity: one draw call for all of them. */
export class Sparks {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private base: Float32Array;
  private life: Float32Array;
  private max: Float32Array;
  private grav: Float32Array;
  private next = 0;
  constructor(
    private n: number,
    size = 0.32
  ) {
    this.pos = new Float32Array(n * 3).fill(-999);
    this.col = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.base = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n).fill(1);
    this.grav = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: glowTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.points.frustumCulled = false;
  }

  /** `dir` null: a round burst; otherwise mostly along `dir` with some spread. */
  emit(at: THREE.Vector3, opts: { count: number; colors: string[]; speed: number; spread?: number; dir?: THREE.Vector3 | null; life?: number; gravity?: number; glow?: number }) {
    const c = new THREE.Color();
    const v = new THREE.Vector3();
    for (let k = 0; k < opts.count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.n;
      if (opts.dir) {
        v.copy(opts.dir).normalize();
        v.x += (Math.random() - 0.5) * (opts.spread ?? 0.8);
        v.y += (Math.random() - 0.5) * (opts.spread ?? 0.8) * 0.5;
        v.z += (Math.random() - 0.5) * (opts.spread ?? 0.8);
        v.normalize().multiplyScalar(opts.speed * (0.55 + Math.random() * 0.6));
      } else {
        v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(opts.speed * (0.7 + Math.random() * 0.4));
      }
      at.toArray(this.pos, i * 3);
      v.toArray(this.vel, i * 3);
      c.set(opts.colors[k % opts.colors.length]).multiplyScalar(opts.glow ?? 1.4);
      c.toArray(this.base, i * 3);
      this.max[i] = (opts.life ?? 1.2) * (0.75 + Math.random() * 0.5);
      this.life[i] = this.max[i];
      this.grav[i] = opts.gravity ?? 6;
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const j = i * 3;
      this.vel[j + 1] -= this.grav[i] * dt;
      this.vel[j] *= 1 - dt * 0.6;
      this.vel[j + 2] *= 1 - dt * 0.6;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      const k = Math.max(0, this.life[i] / this.max[i]);
      const f = Math.min(1, k * 1.6);
      this.col[j] = this.base[j] * f;
      this.col[j + 1] = this.base[j + 1] * f;
      this.col[j + 2] = this.base[j + 2] * f;
      if (this.life[i] <= 0) this.pos[j + 1] = -999;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}

/** The big number that pops above a station when the cart lands there. */
export class Pops {
  readonly group = new THREE.Group();
  private items: { s: THREE.Sprite; t: number; base: THREE.Vector3; size: number }[] = [];
  pop(text: string, at: THREE.Vector3, size = 1.0, ink = '#ff3d7f') {
    const s = spriteOf(bubbleTexture(text, ink), size, { depthTest: false });
    s.renderOrder = 20;
    s.position.copy(at);
    this.group.add(s);
    this.items.push({ s, t: 0, base: at.clone(), size });
  }
  update(dt: number) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.t += dt;
      const t = p.t;
      const grow = t < 0.18 ? (t / 0.18) * 1.25 : t < 0.32 ? 1.25 - ((t - 0.18) / 0.14) * 0.25 : 1;
      const base = p.s.userData.baseScale as THREE.Vector3;
      p.s.scale.set(base.x * grow, base.y * grow, 1);
      p.s.position.set(p.base.x, p.base.y + t * 0.5, p.base.z);
      p.s.material.opacity = t > 0.9 ? Math.max(0, 1 - (t - 0.9) / 0.4) : 1;
      if (t > 1.3) {
        this.group.remove(p.s);
        p.s.material.map?.dispose();
        p.s.material.dispose();
        this.items.splice(i, 1);
      }
    }
  }
  clear() {
    for (const p of this.items) {
      this.group.remove(p.s);
      p.s.material.map?.dispose();
      p.s.material.dispose();
    }
    this.items = [];
  }
}

/**
 * A long striped scarf around Ziggy's neck (child of the model's body, in
 * Ziggy units): a ring and a tail made of jointed strips that stream in the
 * wind and flutter.
 */
export class Scarf {
  readonly group = new THREE.Group();
  readonly joints: THREE.Group[] = [];
  private tex: THREE.Texture;
  private mat: THREE.MeshLambertMaterial;
  readonly rest = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: new THREE.Vector3(1, 1, 1) };
  constructor(neckY = 1.12) {
    this.tex = stripes(['#ff4f5e', '#ffffff', '#ffcc33', '#ffffff'], 8);
    this.mat = new THREE.MeshLambertMaterial({ map: this.tex });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.08, 10, 32), this.mat);
    ring.rotation.x = Math.PI / 2;
    ring.scale.set(1, 0.88, 1);
    ring.position.y = neckY;
    ring.castShadow = true;
    this.group.add(ring);
    let parent: THREE.Object3D = this.group;
    const root = new THREE.Group();
    root.position.set(0.13, neckY - 0.03, -0.24);
    this.group.add(root);
    parent = root;
    const segGeo = new THREE.BoxGeometry(0.17, 0.18, 0.04);
    segGeo.translate(0, -0.09, 0);
    for (let i = 0; i < 6; i++) {
      const j = new THREE.Group();
      if (i > 0) j.position.y = -0.18;
      const seg = new THREE.Mesh(segGeo, this.mat);
      seg.castShadow = true;
      j.add(seg);
      parent.add(j);
      this.joints.push(j);
      parent = j;
    }
    // Fringe at the end.
    for (const x of [-0.06, 0, 0.06]) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 4), this.mat);
      f.position.set(x, -0.23, 0);
      parent.add(f);
    }
    this.group.userData.segGeo = segGeo;
  }

  /** wind 0..1 (cart speed), t in seconds. */
  flutter(t: number, wind: number, motion: number, spin = 0) {
    const w = Math.max(0, Math.min(1, wind));
    this.joints.forEach((j, i) => {
      const wave = Math.sin(t * (7 + 11 * w) * motion - i * 0.9) * (0.06 + 0.32 * w) * motion;
      j.rotation.x = (i === 0 ? 0.25 + 1.2 * w : 0.02 * (1 - w)) + wave;
      j.rotation.z = Math.sin(t * 5.3 * motion + i * 1.7) * (0.04 + 0.12 * w + spin * 0.3) * motion;
    });
  }

  dispose() {
    this.tex.dispose();
    this.mat.dispose();
  }
}

/** Five little stars turning around Ziggy's head after the splash. */
export function makeDizzy(): THREE.Group {
  const g = new THREE.Group();
  const colors = ['#ffe066', '#ffffff', '#ffb3d1', '#ffe066', '#9fe8ff'];
  const tex = starTexture();
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(colors[i]).multiplyScalar(1.4), transparent: true, depthWrite: false, toneMapped: false }));
    const a = (i / 5) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.62, Math.sin(a * 2) * 0.06, Math.sin(a) * 0.62);
    s.scale.setScalar(0.34);
    g.add(s);
  }
  g.position.y = 1.08;
  g.visible = false;
  return g;
}
