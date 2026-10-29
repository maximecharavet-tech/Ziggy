import * as THREE from 'three';
import { rng } from '../kit/rng';

/**
 * The dig box: a height field of loose sand the child rubs away. Brushing
 * lowers the sand around the pointer (dry pale sand on top, darker damp sand
 * deeper down); bones lying on the floor show through as the sand goes down.
 */
export class SandBox {
  readonly mesh: THREE.Mesh;
  readonly width: number;
  readonly depth: number;
  /** Floor of the box (bones lie on it) and the sand's resting top. */
  readonly floor = 0.04;
  readonly top: number;
  private nx: number;
  private nz: number;
  private h: Float32Array;
  private base: Float32Array;
  private dirty = true;
  private geo: THREE.PlaneGeometry;
  private dry = new THREE.Color('#f6dca6');
  private damp = new THREE.Color('#d6a467');
  private deep = new THREE.Color('#b98552');

  constructor(width: number, depth: number, top = 0.62, lowPower = false) {
    this.width = width;
    this.depth = depth;
    this.top = top;
    this.nx = lowPower ? 48 : 64;
    this.nz = Math.round((this.nx * depth) / width);
    this.geo = new THREE.PlaneGeometry(width, depth, this.nx, this.nz);
    this.geo.rotateX(-Math.PI / 2);
    this.geo.deleteAttribute('uv');
    const count = (this.nx + 1) * (this.nz + 1);
    this.h = new Float32Array(count);
    this.base = new Float32Array(count);
    this.geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.mesh.receiveShadow = true;
    this.mesh.name = 'sand';
    this.refill(1);
  }

  /** A fresh, bumpy layer of sand (a new dinosaur to dig). */
  refill(seed: number) {
    const r = rng(seed * 97 + 13);
    const bumps = Array.from({ length: 7 }, () => ({ x: (r() - 0.5) * this.width, z: (r() - 0.5) * this.depth, s: 0.5 + r() * 0.9, a: 0.04 + r() * 0.08 }));
    const pos = this.geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      let y = this.top + Math.sin(x * 2.1 + seed) * Math.cos(z * 2.7) * 0.025;
      for (const b of bumps) y += b.a * Math.exp(-((x - b.x) ** 2 + (z - b.z) ** 2) / (b.s * b.s));
      // Sand slumps a little against the boards.
      const ex = Math.min(this.width / 2 - Math.abs(x), this.depth / 2 - Math.abs(z));
      y -= Math.max(0, 0.18 - ex) * 0.4;
      this.h[i] = y;
      this.base[i] = y;
    }
    this.dirty = true;
    this.update();
  }

  private index(ix: number, iz: number) {
    return iz * (this.nx + 1) + ix;
  }

  /** Local (box) coordinates of a world point: the box mesh is never rotated. */
  private toLocal(x: number, z: number) {
    return { x: x - this.mesh.position.x, z: z - this.mesh.position.z };
  }

  heightAt(wx: number, wz: number): number {
    const { x, z } = this.toLocal(wx, wz);
    const fx = ((x + this.width / 2) / this.width) * this.nx;
    const fz = ((z + this.depth / 2) / this.depth) * this.nz;
    if (fx < 0 || fz < 0 || fx > this.nx || fz > this.nz) return this.floor;
    const ix = Math.min(this.nx - 1, Math.floor(fx));
    const iz = Math.min(this.nz - 1, Math.floor(fz));
    const tx = fx - ix;
    const tz = fz - iz;
    const a = this.h[this.index(ix, iz)];
    const b = this.h[this.index(ix + 1, iz)];
    const c = this.h[this.index(ix, iz + 1)];
    const d = this.h[this.index(ix + 1, iz + 1)];
    return this.mesh.position.y + (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }

  /** Is the world point inside the box (with a margin)? */
  contains(wx: number, wz: number, margin = 0): boolean {
    const { x, z } = this.toLocal(wx, wz);
    return Math.abs(x) <= this.width / 2 + margin && Math.abs(z) <= this.depth / 2 + margin;
  }

  /**
   * Brush at a world point: lowers the sand by up to `amount` with a soft
   * round brush. Returns how much sand moved (for grains and sounds).
   */
  scrape(wx: number, wz: number, radius: number, amount: number, minY = this.floor): number {
    const { x, z } = this.toLocal(wx, wz);
    const cx = ((x + this.width / 2) / this.width) * this.nx;
    const cz = ((z + this.depth / 2) / this.depth) * this.nz;
    const rx = (radius / this.width) * this.nx;
    const rz = (radius / this.depth) * this.nz;
    let moved = 0;
    for (let iz = Math.max(0, Math.floor(cz - rz)); iz <= Math.min(this.nz, Math.ceil(cz + rz)); iz++)
      for (let ix = Math.max(0, Math.floor(cx - rx)); ix <= Math.min(this.nx, Math.ceil(cx + rx)); ix++) {
        const d = Math.hypot((ix - cx) / rx, (iz - cz) / rz);
        if (d > 1) continue;
        const k = 1 - d * d;
        const i = this.index(ix, iz);
        const before = this.h[i];
        const after = Math.max(minY, before - amount * k);
        if (after < before) {
          this.h[i] = after;
          moved += before - after;
        }
      }
    if (moved > 0) this.dirty = true;
    return moved;
  }

  /** Lower everything a little (the wind blows the last sand away). */
  settle(amount: number) {
    for (let i = 0; i < this.h.length; i++) this.h[i] = Math.max(this.floor, this.h[i] - amount);
    this.dirty = true;
  }

  /** How much sand is left, 0..1. */
  remaining(): number {
    let a = 0;
    let b = 0;
    for (let i = 0; i < this.h.length; i++) {
      a += this.h[i] - this.floor;
      b += this.base[i] - this.floor;
    }
    return b > 0 ? a / b : 0;
  }

  update() {
    if (!this.dirty) return;
    this.dirty = false;
    const pos = this.geo.attributes.position as THREE.BufferAttribute;
    const colors = this.geo.attributes.color as THREE.BufferAttribute;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = this.h[i];
      pos.setY(i, y);
      const dug = 1 - (y - this.floor) / Math.max(0.01, this.base[i] - this.floor);
      c.copy(this.dry).lerp(this.damp, Math.min(1, Math.max(0, dug * 1.6)));
      if (dug > 0.75) c.lerp(this.deep, (dug - 0.75) * 2.4);
      // A soft speckle so the sand never looks like plastic.
      const n = Math.sin(i * 12.9898) * 43758.5453;
      c.offsetHSL(0, 0, (n - Math.floor(n) - 0.5) * 0.035);
      colors.setXYZ(i, c.r, c.g, c.b);
    }
    pos.needsUpdate = true;
    colors.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }

  dispose() {
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/** Sand grains flying off the brush: a pooled Points cloud with gravity. */
export class Grains {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private next = 0;

  constructor(private count = 500) {
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    const cols = new Float32Array(count * 3);
    const a = new THREE.Color('#f3d49a');
    const b = new THREE.Color('#c98f55');
    for (let i = 0; i < count; i++) {
      this.pos[i * 3 + 1] = -50;
      const c = a.clone().lerp(b, Math.random());
      cols.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.075, vertexColors: true, sizeAttenuation: true }));
    this.points.frustumCulled = false;
  }

  emit(at: THREE.Vector3, n: number, spread = 1, up = 2.2) {
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.count;
      this.pos[i * 3] = at.x + (Math.random() - 0.5) * 0.2;
      this.pos[i * 3 + 1] = at.y + 0.02;
      this.pos[i * 3 + 2] = at.z + (Math.random() - 0.5) * 0.2;
      const a = Math.random() * Math.PI * 2;
      const s = (0.4 + Math.random()) * spread;
      this.vel[i * 3] = Math.cos(a) * s;
      this.vel[i * 3 + 1] = up * (0.5 + Math.random() * 0.7);
      this.vel[i * 3 + 2] = Math.sin(a) * s;
      this.life[i] = 0.6 + Math.random() * 0.5;
    }
  }

  update(dt: number) {
    let any = false;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= 9 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.life[i] <= 0 || this.pos[i * 3 + 1] < 0) {
        this.life[i] = 0;
        this.pos[i * 3 + 1] = -50;
      }
    }
    if (any) (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
