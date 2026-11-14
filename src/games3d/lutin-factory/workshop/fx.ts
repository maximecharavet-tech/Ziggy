import * as THREE from 'three';

/**
 * Felt confetti and paint puffs: one pooled InstancedMesh (one draw call),
 * fixed capacity, no allocation per frame. Reduced motion: fewer pieces,
 * shorter, no spin.
 */
const CAP = 220;

interface P {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  spin: number;
  size: number;
}

const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const E = new THREE.Euler();
const V = new THREE.Vector3();
const S = new THREE.Vector3();
const COL = new THREE.Color();

export class Fx {
  readonly mesh: THREE.InstancedMesh;
  private ps: P[] = [];
  private next = 0;
  reduced = false;

  constructor() {
    const g = new THREE.PlaneGeometry(1, 0.6);
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), CAP);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, COL.set('#ffffff'));
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'fx';
    for (let i = 0; i < CAP; i++) this.ps.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, spin: 0, size: 0.1 });
  }

  /** A burst at a point. `colors` are hex strings. */
  burst(at: THREE.Vector3, colors: string[], count = 24, power = 1): void {
    const n = this.reduced ? Math.ceil(count / 3) : count;
    for (let i = 0; i < n; i++) {
      const p = this.ps[this.next];
      const slot = this.next;
      this.next = (this.next + 1) % CAP;
      const a = Math.random() * Math.PI * 2;
      const sp = (0.6 + Math.random() * 1.4) * power;
      p.x = at.x;
      p.y = at.y;
      p.z = at.z;
      p.vx = Math.cos(a) * sp * 0.8;
      p.vz = Math.sin(a) * sp * 0.8;
      p.vy = (1.8 + Math.random() * 2.2) * power;
      p.max = p.life = this.reduced ? 0.6 : 1.1 + Math.random() * 0.8;
      p.spin = this.reduced ? 0 : (Math.random() - 0.5) * 14;
      p.size = 0.07 + Math.random() * 0.07;
      this.mesh.setColorAt(slot, COL.set(colors[i % colors.length]));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    let alive = 0;
    for (let i = 0; i < CAP; i++) {
      const p = this.ps[i];
      if (p.life <= 0) {
        M.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, M);
        continue;
      }
      alive++;
      p.life -= dt;
      p.vy -= 6.5 * dt;
      p.vx *= 1 - dt * 1.2;
      p.vz *= 1 - dt * 1.2;
      p.x += p.vx * dt;
      p.y = Math.max(0.03, p.y + p.vy * dt);
      p.z += p.vz * dt;
      const k = Math.min(1, p.life / (p.max * 0.3));
      E.set(p.spin * p.life, p.spin * 0.7 * p.life, 0);
      Q.setFromEuler(E);
      M.compose(V.set(p.x, p.y, p.z), Q, S.setScalar(p.size * k));
      this.mesh.setMatrixAt(i, M);
    }
    this.mesh.count = alive > 0 ? CAP : 0;
    this.mesh.visible = alive > 0;
    if (alive > 0) this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
