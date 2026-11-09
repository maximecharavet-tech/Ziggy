import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heartShape, moonShape, starShape } from './geo';
import { patternMaterial } from './patterns';

/**
 * Toy primitives drawn with instancing: every item on the belts, on the
 * surprise shelf, in an assembler's basket or flying to the sleigh is made
 * of these few shapes, so ALL the toys of a workshop cost one draw call per
 * primitive kind (≈ 10), however many there are. No allocation per frame:
 * `add()` writes straight into the instance buffers.
 */

export const PRIMS = ['cube', 'ball', 'cylinder', 'cone', 'star', 'wheel', 'log', 'feltpad', 'tin', 'yarnball', 'gift', 'ribbon', 'bow', 'stkStar', 'stkHeart', 'stkMoon', 'stkSnow', 'dot'] as const;
export type Prim = (typeof PRIMS)[number];

const CAPACITY: Record<Prim, number> = {
  cube: 700,
  ball: 320,
  cylinder: 320,
  cone: 240,
  star: 120,
  wheel: 360,
  log: 80,
  feltpad: 80,
  tin: 80,
  yarnball: 80,
  gift: 160,
  ribbon: 160,
  bow: 160,
  stkStar: 100,
  stkHeart: 100,
  stkMoon: 100,
  stkSnow: 100,
  dot: 400,
};

function clean(g: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.index) {
    const n = g.attributes.position.count;
    const idx = new Uint16Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  return g;
}

function flatShape(sh: THREE.Shape, depth: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: depth * 0.4, bevelSize: depth * 0.4, bevelSegments: 1, curveSegments: 5 });
  g.center();
  return g;
}

/** Unit-sized primitive geometries (about 1 unit across, centred). */
export function primGeometry(p: Prim, low: boolean): THREE.BufferGeometry {
  const seg = low ? 12 : 18;
  switch (p) {
    case 'cube':
      return clean(new RoundedBoxGeometry(1, 1, 1, 2, 0.14));
    case 'ball':
      return clean(new THREE.SphereGeometry(0.5, seg, Math.round(seg * 0.7)));
    case 'cylinder':
      return clean(new THREE.CylinderGeometry(0.5, 0.5, 1, seg));
    case 'cone':
      return clean(new THREE.ConeGeometry(0.5, 1, seg));
    case 'star': {
      const g = flatShape(starShape(0.5, 0.22), 0.26);
      return clean(g);
    }
    case 'wheel': {
      const tire = new THREE.TorusGeometry(0.36, 0.14, 6, seg);
      const hub = new THREE.CylinderGeometry(0.24, 0.24, 0.16, 10);
      hub.rotateX(Math.PI / 2);
      return clean(mergeGeometries([clean(tire), clean(hub)]) as THREE.BufferGeometry);
    }
    case 'log': {
      const g = new THREE.CylinderGeometry(0.34, 0.38, 1, 7);
      g.rotateZ(Math.PI / 2);
      return clean(g);
    }
    case 'feltpad':
      return clean(new RoundedBoxGeometry(1, 0.42, 1, 2, 0.18));
    case 'tin':
      return clean(new THREE.CylinderGeometry(0.42, 0.42, 1, 12));
    case 'yarnball':
      return clean(new THREE.IcosahedronGeometry(0.5, 1));
    case 'gift':
      return clean(new RoundedBoxGeometry(1, 1, 1, 2, 0.06));
    case 'ribbon': {
      const a = new THREE.BoxGeometry(1.04, 1.04, 0.18);
      const b = new THREE.BoxGeometry(0.18, 1.04, 1.04);
      return clean(mergeGeometries([clean(a), clean(b)]) as THREE.BufferGeometry);
    }
    case 'bow': {
      const l = new THREE.TorusGeometry(0.22, 0.09, 5, 10);
      l.rotateY(Math.PI / 2);
      l.rotateZ(0.5);
      l.translate(-0.18, 0, 0);
      const r = new THREE.TorusGeometry(0.22, 0.09, 5, 10);
      r.rotateY(Math.PI / 2);
      r.rotateZ(-0.5);
      r.translate(0.18, 0, 0);
      l.rotateY(Math.PI / 2);
      r.rotateY(Math.PI / 2);
      const k = new THREE.SphereGeometry(0.12, 8, 6);
      return clean(mergeGeometries([clean(l), clean(r), clean(k)]) as THREE.BufferGeometry);
    }
    case 'stkStar': {
      const g = flatShape(starShape(0.5, 0.24), 0.08);
      g.rotateX(-Math.PI / 2);
      return clean(g);
    }
    case 'stkHeart': {
      const g = flatShape(heartShape(1), 0.08);
      g.rotateX(-Math.PI / 2);
      return clean(g);
    }
    case 'stkMoon': {
      const g = flatShape(moonShape(0.45), 0.08);
      g.rotateX(-Math.PI / 2);
      return clean(g);
    }
    case 'stkSnow': {
      const parts: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 3; i++) {
        const b = new THREE.BoxGeometry(1, 0.08, 0.14);
        b.rotateY((i * Math.PI) / 3);
        parts.push(clean(b));
      }
      return clean(mergeGeometries(parts) as THREE.BufferGeometry);
    }
    case 'dot':
      return clean(new THREE.SphereGeometry(0.5, 8, 6));
  }
}

export class ItemInstancer {
  readonly group = new THREE.Group();
  readonly material: THREE.MeshLambertMaterial;
  private meshes = new Map<Prim, THREE.InstancedMesh>();
  private pats = new Map<Prim, THREE.InstancedBufferAttribute>();
  private counts = new Map<Prim, number>();
  private color = new THREE.Color();

  constructor(low: boolean, shadows: boolean) {
    this.group.name = 'toys';
    this.material = patternMaterial();
    for (const p of PRIMS) {
      const g = primGeometry(p, low);
      const cap = CAPACITY[p];
      const pat = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
      pat.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('aPat', pat);
      const m = new THREE.InstancedMesh(g, this.material, cap);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.setColorAt(0, this.color.set('#ffffff'));
      (m.instanceColor as THREE.InstancedBufferAttribute).setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.visible = false;
      m.frustumCulled = false;
      m.castShadow = shadows;
      m.name = `toy-${p}`;
      this.meshes.set(p, m);
      this.pats.set(p, pat);
      this.counts.set(p, 0);
      this.group.add(m);
    }
  }

  begin(): void {
    for (const p of PRIMS) this.counts.set(p, 0);
  }

  add(p: Prim, m: THREE.Matrix4, color: number, pat: number): void {
    const mesh = this.meshes.get(p) as THREE.InstancedMesh;
    const i = this.counts.get(p) as number;
    if (i >= CAPACITY[p]) return;
    mesh.setMatrixAt(i, m);
    this.color.setHex(color);
    mesh.setColorAt(i, this.color);
    (this.pats.get(p) as THREE.InstancedBufferAttribute).setX(i, pat);
    this.counts.set(p, i + 1);
  }

  end(): void {
    for (const p of PRIMS) {
      const mesh = this.meshes.get(p) as THREE.InstancedMesh;
      const n = this.counts.get(p) as number;
      mesh.count = n;
      mesh.visible = n > 0;
      if (n > 0) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        (this.pats.get(p) as THREE.InstancedBufferAttribute).needsUpdate = true;
      }
    }
  }

  /** Instances drawn this frame (tests / perf overlay). */
  total(): number {
    let n = 0;
    for (const p of PRIMS) n += this.counts.get(p) as number;
    return n;
  }
}
