import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Small helpers for the factory scene: particles (confetti, rainbow steam,
 * bubbles, sparkles, notes, hearts), a gradient sky and static batching.
 */

const tex = new Map<string, THREE.CanvasTexture>();

function canvasTex(key: string, size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const hit = tex.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  tex.set(key, t);
  return t;
}

export const fxTex = {
  dot: () =>
    canvasTex('dot', 64, (g, s) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.45, 'rgba(255,255,255,0.75)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, s, s);
    }),
  puff: () =>
    canvasTex('puff', 128, (g, s) => {
      for (let i = 0; i < 6; i++) {
        const x = s / 2 + Math.cos(i) * s * 0.16;
        const y = s / 2 + Math.sin(i * 1.7) * s * 0.14;
        const gr = g.createRadialGradient(x, y, 0, x, y, s * 0.3);
        gr.addColorStop(0, 'rgba(255,255,255,0.9)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, s, s);
      }
    }),
  confetti: () =>
    canvasTex('confetti', 32, (g) => {
      g.fillStyle = '#ffffff';
      g.fillRect(5, 10, 22, 12);
    }),
  star: () =>
    canvasTex('star', 64, (g, s) => {
      g.fillStyle = '#ffffff';
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        const r = i % 2 ? s * 0.2 : s * 0.48;
        g.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r);
      }
      g.fill();
    }),
  bubble: () =>
    canvasTex('bubble', 64, (g, s) => {
      g.strokeStyle = 'rgba(255,255,255,0.95)';
      g.lineWidth = 4;
      g.beginPath();
      g.arc(s / 2, s / 2, s * 0.4, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.beginPath();
      g.ellipse(s * 0.36, s * 0.34, s * 0.08, s * 0.05, -0.6, 0, Math.PI * 2);
      g.fill();
    }),
  heart: () =>
    canvasTex('heart', 64, (g) => {
      g.translate(32, 35);
      g.beginPath();
      g.moveTo(0, 19);
      g.bezierCurveTo(-30, -1, -21, -29, 0, -13);
      g.bezierCurveTo(21, -29, 30, -1, 0, 19);
      g.fillStyle = '#ffffff';
      g.fill();
    }),
  note: () =>
    canvasTex('note', 64, (g) => {
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(22, 46, 12, 9, -0.4, 0, Math.PI * 2);
      g.fill();
      g.fillRect(30, 10, 6, 36);
      g.beginPath();
      g.moveTo(30, 10);
      g.quadraticCurveTo(48, 14, 50, 28);
      g.quadraticCurveTo(44, 20, 36, 20);
      g.fill();
    }),
};

export function disposeFxTextures() {
  for (const t of tex.values()) t.dispose();
  tex.clear();
}

export const RAINBOW = ['#ff5c7a', '#ff9f43', '#ffd93d', '#6bdc6b', '#4fc3f7', '#8b7bff', '#ff7ad9'];

interface P {
  s: THREE.Sprite;
  v: THREE.Vector3;
  life: number;
  max: number;
  spin: number;
  grav: number;
  grow: number;
  fade: number;
  size: number;
  drag: number;
}

export interface Emit {
  tex: THREE.Texture;
  color?: THREE.ColorRepresentation | readonly THREE.ColorRepresentation[];
  count?: number;
  spread?: number;
  up?: number;
  life?: number;
  size?: number;
  gravity?: number;
  spin?: number;
  additive?: boolean;
  grow?: number;
  opacity?: number;
  drag?: number;
  /** Start inside a sphere of this radius. */
  radius?: number;
}

/** A capped pool of sprites with gravity, spin, growth and fade. */
export class Particles {
  readonly group = new THREE.Group();
  private items: P[] = [];
  private free: THREE.Sprite[] = [];
  constructor(private cap = 260) {}

  emit(at: THREE.Vector3, o: Emit) {
    const n = o.count ?? 8;
    const cols = Array.isArray(o.color) ? o.color : [o.color ?? '#ffffff'];
    for (let i = 0; i < n; i++) {
      if (this.items.length >= this.cap) this.kill(0);
      let s = this.free.pop();
      if (!s) s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
      const m = s.material;
      m.map = o.tex;
      m.color.set(cols[Math.floor(Math.random() * cols.length)] as THREE.ColorRepresentation);
      m.blending = o.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
      m.rotation = Math.random() * Math.PI * 2;
      m.opacity = o.opacity ?? 1;
      m.needsUpdate = true;
      const size = (o.size ?? 0.25) * (0.7 + Math.random() * 0.6);
      s.scale.setScalar(size);
      s.position.copy(at);
      if (o.radius) s.position.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(o.radius * 2));
      const sp = o.spread ?? 1;
      const v = new THREE.Vector3((Math.random() - 0.5) * sp, (o.up ?? 1.5) * (0.6 + Math.random() * 0.8), (Math.random() - 0.5) * sp);
      const max = (o.life ?? 1.4) * (0.7 + Math.random() * 0.6);
      this.items.push({ s, v, life: max, max, spin: (Math.random() - 0.5) * (o.spin ?? 0), grav: o.gravity ?? 0, grow: o.grow ?? 0, fade: o.opacity ?? 1, size, drag: o.drag ?? 0 });
      s.visible = true;
      this.group.add(s);
    }
  }

  private kill(i: number) {
    const p = this.items[i];
    this.items.splice(i, 1);
    p.s.visible = false;
    this.group.remove(p.s);
    this.free.push(p.s);
  }

  update(dt: number) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.kill(i);
        continue;
      }
      p.v.y -= p.grav * dt;
      if (p.drag) p.v.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.s.position.addScaledVector(p.v, dt);
      const m = p.s.material;
      m.rotation += p.spin * dt;
      if (p.grow) p.s.scale.setScalar(p.size * (1 + (1 - p.life / p.max) * p.grow));
      m.opacity = Math.min(1, (p.life / p.max) * 2.5) * p.fade;
    }
  }

  clear() {
    while (this.items.length) this.kill(0);
  }

  dispose() {
    this.clear();
    for (const s of this.free) s.material.dispose();
    this.free = [];
  }
}

/** A soft gradient sky dome, behind everything. */
export function makeSky(top: string, horizon: string, below: string): THREE.Mesh {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(horizon) }, below: { value: new THREE.Color(below) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:
      'uniform vec3 top; uniform vec3 bottom; uniform vec3 below; varying vec3 vP; void main(){ vec3 c = vP.y > 0.0 ? mix(bottom, top, smoothstep(0.0, 0.55, vP.y)) : mix(bottom, below, smoothstep(0.0, -0.25, vP.y)); gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n}',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 24, 16), m);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  return sky;
}

/**
 * Merge every static Lambert mesh under `root` into a few meshes (colours baked
 * into vertex colours), so the world is drawn in a handful of calls.
 * Objects flagged `userData.noMerge` (and their children) are left alone.
 */
export function mergeStatic(root: THREE.Object3D, receive = true): void {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const buckets = new Map<string, { geos: THREE.BufferGeometry[]; cast: boolean }>();
  const done: THREE.Mesh[] = [];
  const skipped = (o: THREE.Object3D) => {
    for (let x: THREE.Object3D | null = o; x && x !== root.parent; x = x.parent) if (x.userData.noMerge) return true;
    return false;
  };
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || skipped(m)) return;
    const mt = m.material as THREE.MeshLambertMaterial;
    if (Array.isArray(m.material) || !mt.isMeshLambertMaterial || mt.transparent || mt.map) return;
    let g = m.geometry.clone();
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(inv.clone().multiply(m.matrixWorld));
    const base = mt.color.clone().add(mt.emissive ?? new THREE.Color(0));
    const n = g.attributes.position.count;
    const cols = new Float32Array(n * 3);
    const src = mt.vertexColors ? (g.attributes.color as THREE.BufferAttribute | undefined) : undefined;
    for (let i = 0; i < n; i++) {
      cols[i * 3] = base.r * (src ? src.getX(i) : 1);
      cols[i * 3 + 1] = base.g * (src ? src.getY(i) : 1);
      cols[i * 3 + 2] = base.b * (src ? src.getZ(i) : 1);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const key = `${m.castShadow}`;
    if (!buckets.has(key)) buckets.set(key, { geos: [], cast: m.castShadow });
    buckets.get(key)!.geos.push(g);
    done.push(m);
  });
  for (const m of done) {
    m.parent?.remove(m);
    m.geometry.dispose();
    (m.material as THREE.Material).dispose();
  }
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    b.geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.castShadow = b.cast;
    mesh.receiveShadow = receive;
    root.add(mesh);
  }
}

export const easeOut = (k: number) => 1 - (1 - k) ** 3;
export const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
export const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
