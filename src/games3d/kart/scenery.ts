import * as THREE from 'three';
import { glow, glowTex } from '../kit/look';
import { rng } from '../kit/rng';
import { Kit, mergeModel } from './props';
import { newFrame, type Track } from './track';

/**
 * The world under and around the rainbow road: a pastel sky, a sea of soft
 * clouds, floating candy islands (lollipops, candy canes, gumdrops,
 * cotton-candy trees), giant rainbows and drifting hot-air balloons.
 * Static pieces are merged so the whole landscape costs a few draw calls.
 */

export function makeSky(): THREE.Mesh {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color('#4fb0ff') },
      mid: { value: new THREE.Color('#a9dcff') },
      horizon: { value: new THREE.Color('#ffd6ee') },
      below: { value: new THREE.Color('#ffeef7') },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:
      'uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 below; varying vec3 vP; void main(){ float y = vP.y; vec3 c = y > 0.0 ? (y > 0.25 ? mix(mid, top, smoothstep(0.25, 0.8, y)) : mix(horizon, mid, smoothstep(0.0, 0.25, y))) : mix(horizon, below, smoothstep(0.0, -0.3, y)); gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n}',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(520, 24, 16), m);
  sky.name = 'sky';
  return sky;
}

export function makeSun(): THREE.Group {
  const g = new THREE.Group();
  const big = glow('#fff1c9', 160, 0.55);
  const core = glow('#ffffff', 50, 0.9);
  for (const s of [big, core]) (s.material as THREE.SpriteMaterial).fog = false;
  g.add(big, core);
  g.position.set(260, 190, -330);
  return g;
}

/** A soft sea of clouds far below the road. */
export function makeCloudSea(lowPower: boolean, seed: number): THREE.Group {
  const g = new THREE.Group();
  const r = rng(seed);
  const n = lowPower ? 90 : 170;
  const puffs = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: new THREE.Color('#ffffff').multiplyScalar(0.4) }),
    n
  );
  const tints = ['#ffffff', '#fff0f7', '#f3eaff', '#fff6ea', '#eef8ff'].map((c) => new THREE.Color(c));
  const o = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 420;
    o.position.set(Math.cos(a) * d, -34 + r() * 5, Math.sin(a) * d * 0.85);
    const s = 9 + r() * 16;
    o.scale.set(s, s * (0.35 + r() * 0.2), s * (0.8 + r() * 0.4));
    o.rotation.y = r() * Math.PI;
    o.updateMatrix();
    puffs.setMatrixAt(i, o.matrix);
    puffs.setColorAt(i, tints[i % tints.length]);
  }
  puffs.instanceMatrix.needsUpdate = true;
  if (puffs.instanceColor) puffs.instanceColor.needsUpdate = true;
  puffs.frustumCulled = false;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(700, 32), new THREE.MeshBasicMaterial({ color: '#fde6f3' }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -36;
  g.add(floor, puffs);
  g.name = 'cloudSea';
  return g;
}

/* ───────────────────────── Candy islands ───────────────────────── */

const FROSTING = ['#ffb3d1', '#b8f2c9', '#fff0a8', '#cdb8ff', '#a8e6ff'];
const CANDY = ['#ff6fa8', '#ffb347', '#7ed6ff', '#a98bff', '#7be495', '#ffe066', '#ff8a8a'];

function decor(k: Kit, kind: number, x: number, z: number, y: number, r: () => number) {
  const c = CANDY[Math.floor(r() * CANDY.length)];
  const s = 0.8 + r() * 0.7;
  switch (kind) {
    case 0: {
      // Lollipop
      k.cyl(0.07 * s, 0.07 * s, 2.2 * s, '#fffaf0', [x, y + 1.1 * s, z]);
      const ry = r() * Math.PI;
      k.cyl(0.7 * s, 0.7 * s, 0.2 * s, c, [x, y + 2.4 * s, z], [Math.PI / 2, 0, ry]);
      k.torus(0.4 * s, 0.1 * s, '#ffffff', [x + Math.sin(ry) * 0.12, y + 2.4 * s, z + Math.cos(ry) * 0.12], [0, ry, 0], Math.PI * 2, 14);
      break;
    }
    case 1: {
      // Candy cane
      for (let i = 0; i < 6; i++) k.cyl(0.13 * s, 0.13 * s, 0.32 * s, i % 2 ? '#ffffff' : '#ff5a6e', [x, y + (0.16 + i * 0.32) * s, z]);
      k.torus(0.32 * s, 0.13 * s, '#ff5a6e', [x + 0.32 * s, y + 1.92 * s, z], [0, r() * 0.6, 0], Math.PI, 10);
      break;
    }
    case 2: {
      // Gumdrop
      k.add(new THREE.SphereGeometry(0.55 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), c, [x, y, z], [1, 1.3, 1]);
      break;
    }
    case 3: {
      // Cotton-candy tree
      k.cyl(0.12 * s, 0.18 * s, 1.4 * s, '#c58b5c', [x, y + 0.7 * s, z]);
      const fc = ['#ffb3d1', '#cdb8ff', '#a8e6ff'][Math.floor(r() * 3)];
      k.add(new THREE.IcosahedronGeometry(0.85 * s, 1), fc, [x, y + 1.9 * s, z]);
      k.add(new THREE.IcosahedronGeometry(0.55 * s, 1), fc, [x + 0.55 * s, y + 1.6 * s, z + 0.2 * s]);
      k.add(new THREE.IcosahedronGeometry(0.5 * s, 1), fc, [x - 0.5 * s, y + 1.7 * s, z - 0.2 * s]);
      break;
    }
    case 4: {
      // Mushroom
      k.cyl(0.18 * s, 0.24 * s, 0.6 * s, '#fff4e6', [x, y + 0.3 * s, z]);
      k.add(new THREE.SphereGeometry(0.6 * s, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), r() < 0.5 ? '#ff6b6b' : '#b197fc', [x, y + 0.58 * s, z], [1, 0.75, 1]);
      for (let i = 0; i < 4; i++) k.ball(0.08 * s, '#ffffff', [x + Math.cos(i * 1.7) * 0.35 * s, y + 0.86 * s, z + Math.sin(i * 1.7) * 0.35 * s], [1, 0.5, 1]);
      break;
    }
    default: {
      // Donut standing up
      const ry = r() * Math.PI;
      k.torus(0.55 * s, 0.26 * s, '#e0a96d', [x, y + 0.8 * s, z], [0, ry, 0], Math.PI * 2, 14);
      k.torus(0.55 * s, 0.2 * s, c, [x + Math.sin(ry) * 0.1 * s, y + 0.86 * s, z + Math.cos(ry) * 0.1 * s], [0, ry, 0], Math.PI * 2, 14);
    }
  }
}

function makeIsland(r: () => number, size: number): THREE.Group {
  const k = new Kit();
  const top = FROSTING[Math.floor(r() * FROSTING.length)];
  // Cookie and chocolate layers under a thick frosting, drips over the edge.
  k.add(new THREE.ConeGeometry(size * 0.95, size * 1.5, 9), '#8a5537', [0, -size * 1.0, 0], 1, [Math.PI, 0, 0]);
  k.cyl(size * 1.0, size * 0.92, size * 0.35, '#c98b5e', [0, -size * 0.2, 0], [0, 0, 0], 12);
  k.cyl(size * 1.04, size * 1.04, size * 0.16, top, [0, 0, 0], [0, 0, 0], 12);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.3;
    k.ball(size * 0.14, top, [Math.cos(a) * size, -size * 0.12 - r() * size * 0.12, Math.sin(a) * size], [0.8, 1.5, 0.8], [0, 0, 0], 8);
  }
  // Sprinkles.
  for (let i = 0; i < 10; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * size * 0.9;
    k.box(0.08, 0.06, 0.32, CANDY[i % CANDY.length], [Math.cos(a) * d, size * 0.09, Math.sin(a) * d], [0, r() * Math.PI, 0]);
  }
  const n = 2 + Math.floor(size / 2.2);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = (0.2 + r() * 0.6) * size;
    decor(k, Math.floor(r() * 6), Math.cos(a) * d, Math.sin(a) * d, size * 0.08, r);
  }
  return mergeModel(k.g, { receive: false, emissive: 0x181018 });
}

export interface Island {
  group: THREE.Group;
  baseY: number;
  phase: number;
}

/** Islands around the loop, never on the road. */
export function makeIslands(track: Track, lowPower: boolean, seed: number): Island[] {
  const r = rng(seed + 101);
  const out: Island[] = [];
  const n = lowPower ? 11 : 18;
  const f = newFrame();
  const road: THREE.Vector3[] = [];
  for (let s = 0; s < track.length; s += 6) road.push(track.frame(s, f).p.clone());
  let tries = 0;
  while (out.length < n && tries++ < 400) {
    const size = 3 + r() * 6;
    const s = r() * track.length;
    const side = r() < 0.5 ? -1 : 1;
    const off = track.halfWidth + size + 8 + r() * 55;
    const p = track.at(s, side * off, 0, f);
    const high = r() < 0.3;
    p.y += high ? 3 + r() * 6 : -9 - r() * 14;
    const clear = road.every((q) => Math.hypot(q.x - p.x, q.z - p.z) > size + track.halfWidth + 6 || q.y - p.y > size * 2.4 + 4);
    if (!clear) continue;
    const g = makeIsland(r, size);
    g.position.copy(p);
    g.rotation.y = r() * Math.PI * 2;
    out.push({ group: g, baseY: p.y, phase: r() * Math.PI * 2 });
  }
  return out;
}

/* ───────────────────────── Rainbows & balloons ───────────────────────── */

export function makeRainbow(radius: number): THREE.Group {
  const g = new THREE.Group();
  const cols = ['#ff7b7b', '#ffb36b', '#ffe170', '#93e6a0', '#7cc4ff', '#b79cff'];
  cols.forEach((c, i) => {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(radius - i * 6, 3.2, 6, 48, Math.PI),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, fog: false, depthWrite: false })
    );
    g.add(m);
  });
  g.name = 'rainbow';
  return g;
}

export function makeBalloon(r: () => number): THREE.Group {
  const g = new THREE.Group();
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI;
    // Narrow at the bottom, round at the top.
    const rad = Math.sin(a) * (0.62 + 0.38 * (1 - Math.cos(a)) * 0.5) * 2.2;
    prof.push(new THREE.Vector2(Math.max(0.05, rad), 2.4 - Math.cos(a) * 2.4));
  }
  const seg = 12;
  const geo = new THREE.LatheGeometry(prof, seg).toNonIndexed();
  const a = CANDY[Math.floor(r() * CANDY.length)];
  const b = '#ffffff';
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 3) {
    // Colour each triangle by its angle: vertical stripes.
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const k = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * seg) % 2;
    const c = k ? ca : cb;
    for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (i + j) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const env = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: new THREE.Color('#2a1a2a') }));
  env.position.y = 1.2;
  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), new THREE.MeshLambertMaterial({ color: '#b07a4a', flatShading: true }));
  basket.position.y = 0.3;
  g.add(env, basket);
  for (const [x, z] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4), new THREE.MeshLambertMaterial({ color: '#7a5a3a' }));
    rope.position.set(x, 1.1, z);
    g.add(rope);
  }
  return g;
}

/** Pastel sparkles floating around the road. */
export function makeSparkles(track: Track, lowPower: boolean, seed: number): THREE.Points {
  const r = rng(seed + 7);
  const n = lowPower ? 140 : 320;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const f = newFrame();
  const tints = ['#ffffff', '#ffe066', '#ffb3d1', '#a8e6ff', '#cdb8ff'].map((c) => new THREE.Color(c));
  for (let i = 0; i < n; i++) {
    const p = track.at(r() * track.length, (r() < 0.5 ? -1 : 1) * (track.halfWidth + 2 + r() * 30), -6 + r() * 18, f);
    pos.set([p.x, p.y, p.z], i * 3);
    const c = tints[i % tints.length];
    col.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTex(), vertexColors: true, size: 1.1, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  pts.frustumCulled = false;
  return pts;
}
