import * as THREE from 'three';

/**
 * Cheap party effects, each drawn in ONE call: confetti (and sneezed
 * feathers) as an instanced mesh of little cards, and soap bubbles as an
 * instanced mesh of shiny spheres. Particles are recycled, never created
 * per frame.
 */

interface Bit {
  alive: boolean;
  p: THREE.Vector3;
  v: THREE.Vector3;
  r: THREE.Euler;
  spin: THREE.Vector3;
  life: number;
  max: number;
  sway: number;
  drag: number;
  grav: number;
  size: number;
}

export class Flakes {
  readonly mesh: THREE.InstancedMesh;
  private bits: Bit[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private next = 0;

  constructor(count: number, shape: 'card' | 'feather' = 'card') {
    const geo = shape === 'feather' ? featherGeometry() : new THREE.PlaneGeometry(0.12, 0.08);
    const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, vertexColors: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    const white = new THREE.Color('#ffffff');
    for (let i = 0; i < count; i++) {
      this.bits.push({ alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), spin: new THREE.Vector3(), life: 0, max: 1, sway: 0, drag: 0, grav: 0, size: 1 });
      this.mesh.setColorAt(i, white);
      this.m.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.count = count;
  }

  emit(at: THREE.Vector3, opts: { count?: number; colors: string[]; spread?: number; up?: number; life?: number; grav?: number; drag?: number; sway?: number; size?: number }) {
    const col = new THREE.Color();
    for (let k = 0; k < (opts.count ?? 20); k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.bits.length;
      const b = this.bits[i];
      const sp = opts.spread ?? 2;
      b.alive = true;
      b.p.copy(at);
      b.v.set((Math.random() - 0.5) * sp, (opts.up ?? 3) * (0.6 + Math.random() * 0.7), (Math.random() - 0.5) * sp);
      b.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      b.spin.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
      b.max = b.life = (opts.life ?? 2.4) * (0.7 + Math.random() * 0.6);
      b.grav = opts.grav ?? 5;
      b.drag = opts.drag ?? 1.6;
      b.sway = (opts.sway ?? 1) * (0.5 + Math.random());
      b.size = (opts.size ?? 1) * (0.7 + Math.random() * 0.6);
      this.mesh.setColorAt(i, col.set(opts.colors[Math.floor(Math.random() * opts.colors.length)]));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number, t: number) {
    let any = false;
    for (let i = 0; i < this.bits.length; i++) {
      const b = this.bits[i];
      if (!b.alive) continue;
      any = true;
      b.life -= dt;
      if (b.life <= 0 || b.p.y < -0.2) {
        b.alive = false;
        this.m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this.m);
        continue;
      }
      b.v.y -= b.grav * dt;
      b.v.multiplyScalar(Math.max(0, 1 - b.drag * dt));
      b.p.addScaledVector(b.v, dt);
      b.p.x += Math.sin(t * 3 + i) * b.sway * dt;
      if (b.p.y < 0.02) {
        b.p.y = 0.02;
        b.v.set(0, 0, 0);
        b.spin.multiplyScalar(0.9);
      }
      b.r.x += b.spin.x * dt;
      b.r.y += b.spin.y * dt;
      b.r.z += b.spin.z * dt;
      const fade = Math.min(1, b.life / 0.5);
      this.q.setFromEuler(b.r);
      this.s.setScalar(b.size * fade);
      this.m.compose(b.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}

function featherGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, -0.12);
  s.quadraticCurveTo(0.07, -0.02, 0, 0.12);
  s.quadraticCurveTo(-0.07, -0.02, 0, -0.12);
  return new THREE.ShapeGeometry(s, 4);
}

/** Soap bubbles rising and wobbling. */
export class Bubbles {
  readonly mesh: THREE.InstancedMesh;
  private items: { p: THREE.Vector3; v: number; life: number; r: number; ph: number }[] = [];
  private m = new THREE.Matrix4();
  private active = 0;

  constructor(count: number) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 14, 10),
      new THREE.MeshPhongMaterial({ color: '#d8f2ff', transparent: true, opacity: 0.45, shininess: 150, specular: '#ffffff', emissive: '#6fa8d8', emissiveIntensity: 0.15, depthWrite: false }),
      count
    );
    this.mesh.frustumCulled = false;
    for (let i = 0; i < count; i++) {
      this.items.push({ p: new THREE.Vector3(), v: 0, life: 0, r: 0, ph: 0 });
      this.m.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, this.m);
    }
  }

  /** Keep bubbles coming for `seconds` around `center`. */
  start(seconds: number) {
    this.active = seconds;
  }

  update(dt: number, t: number, center: THREE.Vector3, radius: number) {
    this.active = Math.max(0, this.active - dt);
    for (let i = 0; i < this.items.length; i++) {
      const b = this.items[i];
      if (b.life <= 0) {
        if (this.active > 0 && Math.random() < dt * 3) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() * radius;
          b.p.set(center.x + Math.cos(a) * d, 0.4 + Math.random() * 0.8, center.z + Math.sin(a) * d);
          b.v = 0.5 + Math.random() * 0.6;
          b.life = 3 + Math.random() * 3;
          b.r = 0.1 + Math.random() * 0.16;
          b.ph = Math.random() * 6;
        } else {
          this.m.makeScale(0, 0, 0);
          this.mesh.setMatrixAt(i, this.m);
          continue;
        }
      }
      b.life -= dt;
      b.p.y += b.v * dt;
      b.p.x += Math.sin(t * 1.7 + b.ph) * 0.25 * dt;
      const k = Math.min(1, b.life * 2) * b.r * (1 + Math.sin(t * 6 + b.ph) * 0.05);
      this.m.makeScale(k, k, k).setPosition(b.p);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}

/** A music note drawn on a canvas (no font needed), for sprites. */
export function noteTexture(color = '#7a4bc2'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 4;
  g.beginPath();
  g.ellipse(24, 46, 11, 8, -0.4, 0, Math.PI * 2);
  g.stroke();
  g.fill();
  g.fillRect(32, 10, 5, 36);
  g.beginPath();
  g.moveTo(37, 10);
  g.quadraticCurveTo(52, 16, 48, 30);
  g.quadraticCurveTo(46, 20, 37, 20);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A soft ring on the ground (highlight under a friend, "here!" marks). */
export function groundRing(color: string, r = 0.75): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(r * 0.78, r, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.04;
  m.renderOrder = 2;
  return m;
}
