import * as THREE from 'three';
import { glowTex } from '../kit/look';
import { rng } from '../kit/rng';
import { flat, mergeStatic, shiny, signTexture, soft } from './util';

/**
 * The fairground at sunset, built in code: a gradient sky with a low sun,
 * soft hills, a big Ferris wheel with light bulbs, a carousel with bobbing
 * horses, a striped big top, candy stalls, garlands of bulbs and bunting,
 * lollipop trees and balloons. Static pieces are merged into a few meshes.
 */

export const FAIR_COLORS = ['#ff4f5e', '#ffb63d', '#3fc1c9', '#9b6be8', '#ff7ab8', '#5fd068'];

const SKY_DAY = { top: new THREE.Color('#4a5bc4'), mid: new THREE.Color('#f59bb8'), horizon: new THREE.Color('#ffc98a'), fog: new THREE.Color('#f7b9a2') };
const SKY_DUSK = { top: new THREE.Color('#1f2366'), mid: new THREE.Color('#b65aa6'), horizon: new THREE.Color('#ff8a5c'), fog: new THREE.Color('#c47a8e') };

export interface Sky {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  fog: THREE.Color;
  setDusk(k: number): void;
}

/** Sky dome: blue at the top, pink then gold at the horizon, a big soft sun. */
export function makeSky(): Sky {
  const uniforms = {
    top: { value: SKY_DAY.top.clone() },
    mid: { value: SKY_DAY.mid.clone() },
    horizon: { value: SKY_DAY.horizon.clone() },
    sunDir: { value: new THREE.Vector3(-0.42, 0.1, -1).normalize() },
    sunColor: { value: new THREE.Color('#fff0b8') },
  };
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; varying vec3 vP;
void main(){
  vec3 d = normalize(vP);
  float h = d.y;
  vec3 c = mix(horizon, mid, smoothstep(-0.02, 0.2, h));
  c = mix(c, top, smoothstep(0.18, 0.7, h));
  float s = max(dot(d, sunDir), 0.0);
  c += sunColor * (smoothstep(0.9975, 0.9985, s) * 1.6 + pow(s, 40.0) * 0.55 + pow(s, 6.0) * 0.18);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(260, 32, 20), m);
  mesh.renderOrder = -10;
  const fog = SKY_DAY.fog.clone();
  return {
    mesh,
    fog,
    setDusk(k: number) {
      uniforms.top.value.copy(SKY_DAY.top).lerp(SKY_DUSK.top, k);
      uniforms.mid.value.copy(SKY_DAY.mid).lerp(SKY_DUSK.mid, k);
      uniforms.horizon.value.copy(SKY_DAY.horizon).lerp(SKY_DUSK.horizon, k);
      uniforms.sunDir.value.set(-0.42, 0.1 - 0.12 * k, -1).normalize();
      fog.copy(SKY_DAY.fog).lerp(SKY_DUSK.fog, k);
    },
  };
}

/** A cone or a cylinder with coloured stripes painted face by face (stays mergeable). */
function striped(geo: THREE.BufferGeometry, colors: string[], segs: number, offset = 0): THREE.BufferGeometry {
  const g = geo.toNonIndexed();
  const pos = g.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const a = (Math.atan2(z, x) / (Math.PI * 2) + 1 + offset) % 1;
    c.set(colors[Math.floor(a * segs) % colors.length]);
    for (let k = 0; k < 3; k++) c.toArray(cols, (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.dispose();
  return g;
}
const stripedMesh = (geo: THREE.BufferGeometry, colors: string[], segs: number, offset = 0) => new THREE.Mesh(striped(geo, colors, segs, offset), flat('#ffffff', { vertexColors: true }));

/** Ground: green grass, a warm sandy plaza under the coaster, soft colour patches. */
export function makeGround(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(320, 320, 80, 80);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const cols: number[] = [];
  const grass = new THREE.Color('#78c25a');
  const grass2 = new THREE.Color('#5aa84d');
  const sand = new THREE.Color('#f4d3a1');
  const sand2 = new THREE.Color('#efc08c');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const plaza = (x / 34) ** 2 + ((z + 3) / 13) ** 2;
    const k = THREE.MathUtils.smoothstep(plaza, 0.85, 1.15);
    c.copy(sand).lerp(sand2, 0.5 + 0.5 * Math.sin(x * 0.9) * Math.cos(z * 0.8));
    const g = grass.clone().lerp(grass2, 0.5 + 0.5 * Math.sin(x * 0.13 + z * 0.07) * Math.cos(z * 0.11));
    c.lerp(g, k);
    // Gentle rolling far away.
    const d = Math.hypot(x, z);
    pos.setY(i, d > 60 ? Math.sin(x * 0.05) * Math.cos(z * 0.04) * 2.2 * Math.min(1, (d - 60) / 40) : -0.01);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, soft('#ffffff', { vertexColors: true }));
  ground.receiveShadow = true;
  return ground;
}

/** Hills, clouds and trees far away (one merged group). */
export function makeScenery(lowPower: boolean): THREE.Group {
  const g = new THREE.Group();
  const r = rng(77);
  // Hills on the horizon.
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const d = 95 + r() * 30;
    const h = new THREE.Mesh(new THREE.SphereGeometry(18 + r() * 14, 12, 8), flat(i % 2 ? '#6aa86a' : '#7db26e'));
    h.scale.y = 0.35 + r() * 0.2;
    h.position.set(Math.cos(a) * d, -2, Math.sin(a) * d);
    g.add(h);
  }
  // Lollipop trees around the fair.
  const greens = ['#3f9e4f', '#56b85a', '#2f8a4a', '#6cc25e'];
  const spots: [number, number][] = [];
  for (let i = 0; i < (lowPower ? 26 : 44); i++) {
    const side = i % 3;
    const x = side === 0 ? -30 - r() * 22 : side === 1 ? 30 + r() * 22 : (r() - 0.5) * 70;
    const z = side === 2 ? -32 - r() * 16 : -26 + r() * 40;
    if (Math.abs(x) < 29 && z > -30) continue;
    spots.push([x, z]);
  }
  // A few in the front corners, low enough to never hide the track.
  spots.push([-24, 12], [26, 13], [-31, 4], [33, 6]);
  for (const [x, z] of spots) {
    const s = 0.9 + r() * 0.9;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.26 * s, 1.6 * s, 6), flat('#8a5a36'));
    trunk.position.set(x, 0.8 * s, z);
    trunk.castShadow = true;
    g.add(trunk);
    const n = 2 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) {
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry((1.1 - k * 0.2) * s, 1), flat(greens[Math.floor(r() * greens.length)]));
      ball.position.set(x + (r() - 0.5) * 0.8 * s, (2.0 + k * 0.9) * s, z + (r() - 0.5) * 0.8 * s);
      ball.castShadow = true;
      g.add(ball);
    }
  }
  // Flower beds along the front, low.
  for (let i = 0; i < 26; i++) {
    const x = -36 + i * 2.9 + (r() - 0.5);
    const z = 10 + r() * 6;
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 + r() * 0.25, 0), flat('#4f9e45'));
    bush.position.set(x, 0.25, z);
    bush.scale.y = 0.7;
    g.add(bush);
    for (let k = 0; k < 3; k++) {
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), flat(FAIR_COLORS[Math.floor(r() * FAIR_COLORS.length)]));
      f.position.set(x + (r() - 0.5) * 0.7, 0.55, z + (r() - 0.5) * 0.7);
      g.add(f);
    }
  }
  mergeStatic(g, { receive: false });
  return g;
}

/** Soft pink clouds lit by the sunset. */
export function makeClouds(): THREE.Group {
  const g = new THREE.Group();
  const r = rng(5);
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.6;
    const d = 140 + r() * 40;
    const cx = Math.cos(a) * d;
    const cz = Math.sin(a) * d;
    const cy = 28 + r() * 30;
    for (let k = 0; k < 5; k++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(4 + r() * 4, 1), soft(k % 2 ? '#ffd9e6' : '#ffe9d6', { emissive: new THREE.Color('#ff9fb4').multiplyScalar(0.35), fog: false }));
      p.position.set(cx + (k - 2) * 5 + (r() - 0.5) * 3, cy + (r() - 0.5) * 2.5, cz + (r() - 0.5) * 3);
      p.scale.y = 0.55;
      g.add(p);
    }
  }
  mergeStatic(g);
  g.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined;
    if (m?.isMeshLambertMaterial) m.fog = false;
  });
  return g;
}

/** Light bulbs as one glowing Points cloud (bloom makes them shine). */
export class Bulbs {
  readonly points: THREE.Points;
  private base: Float32Array;
  private colors: Float32Array;
  private phase: Float32Array;
  constructor(positions: number[], colors: string[], size = 0.42) {
    const n = positions.length / 3;
    this.base = new Float32Array(n * 3);
    this.colors = new Float32Array(n * 3);
    this.phase = new Float32Array(n);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      c.set(colors[i % colors.length]).multiplyScalar(1.5);
      c.toArray(this.base, i * 3);
      this.phase[i] = i * 0.55;
    }
    this.colors.set(this.base);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size, map: glowTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
    );
  }
  /** A chase of light running along the strings; `boost` brightens everything (dusk, party). */
  update(t: number, boost: number, motion: number) {
    const n = this.phase.length;
    for (let i = 0; i < n; i++) {
      const k = (0.55 + boost * 0.35 + 0.45 * Math.max(0, Math.sin(t * 3.2 * motion - this.phase[i]))) * (0.85 + boost * 0.4);
      this.colors[i * 3] = this.base[i * 3] * k;
      this.colors[i * 3 + 1] = this.base[i * 3 + 1] * k;
      this.colors[i * 3 + 2] = this.base[i * 3 + 2] * k;
    }
    (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}

const BULB_COLORS = ['#fff1b0', '#ffb3d1', '#9fe8ff', '#fff1b0', '#ffd27a'];

/** Garlands of bulbs and bunting on striped poles behind the coaster. */
export function makeGarlands(): { group: THREE.Group; bulbs: Bulbs } {
  const g = new THREE.Group();
  const statics = new THREE.Group();
  const poles: THREE.Vector3[] = [
    new THREE.Vector3(-30, 6.2, -8),
    new THREE.Vector3(-18, 6.2, -9),
    new THREE.Vector3(-6, 6.2, -9.5),
    new THREE.Vector3(6, 6.2, -9.5),
    new THREE.Vector3(18, 6.2, -9),
    new THREE.Vector3(30, 6.2, -8),
  ];
  const sides: [THREE.Vector3, THREE.Vector3][] = [
    [new THREE.Vector3(-30, 6.2, -8), new THREE.Vector3(-34, 5.4, 4)],
    [new THREE.Vector3(30, 6.2, -8), new THREE.Vector3(34, 5.4, 4)],
  ];
  for (const p of [...poles, new THREE.Vector3(-34, 5.4, 4), new THREE.Vector3(34, 5.4, 4)]) {
    for (let k = 0; k < 4; k++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, p.y / 4, 8), flat(k % 2 ? '#ffffff' : '#ff4f5e'));
      seg.position.set(p.x, (p.y / 4) * (k + 0.5), p.z);
      statics.add(seg);
    }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), flat('#ffcc33'));
    knob.position.copy(p).add(new THREE.Vector3(0, 0.2, 0));
    statics.add(knob);
  }
  const bulbPos: number[] = [];
  const spans: [THREE.Vector3, THREE.Vector3][] = [];
  for (let i = 0; i < poles.length - 1; i++) spans.push([poles[i], poles[i + 1]]);
  spans.push(...sides);
  const flagGeo: THREE.BufferGeometry[] = [];
  let fi = 0;
  for (const [a, b] of spans) {
    const len = a.distanceTo(b);
    const n = Math.round(len * 1.6);
    const at = (t: number) => new THREE.Vector3().lerpVectors(a, b, t).add(new THREE.Vector3(0, -1.6 * 4 * t * (1 - t), 0));
    for (let i = 1; i < n; i++) at(i / n).toArray(bulbPos, bulbPos.length);
    // Bunting: little triangles hanging from a second, lower string.
    const m = Math.round(len * 1.1);
    for (let i = 1; i < m; i++) {
      const p = at(i / m).add(new THREE.Vector3(0, -0.45, 0));
      const tri = new THREE.BufferGeometry();
      const dir = new THREE.Vector3().subVectors(b, a).setY(0).normalize().multiplyScalar(0.28);
      const v = [p.x - dir.x, p.y, p.z - dir.z, p.x + dir.x, p.y, p.z + dir.z, p.x, p.y - 0.62, p.z];
      tri.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      tri.computeVertexNormals();
      const col = new THREE.Color(FAIR_COLORS[fi++ % FAIR_COLORS.length]);
      tri.setAttribute('color', new THREE.Float32BufferAttribute([col.r, col.g, col.b, col.r, col.g, col.b, col.r, col.g, col.b], 3));
      flagGeo.push(tri);
    }
  }
  for (const tri of flagGeo) statics.add(new THREE.Mesh(tri, flat('#ffffff', { vertexColors: true, side: THREE.DoubleSide })));
  mergeStatic(statics);
  const bulbs = new Bulbs(bulbPos, BULB_COLORS, 0.55);
  g.add(statics, bulbs.points);
  return { group: g, bulbs };
}

export interface Wheel {
  group: THREE.Group;
  wheel: THREE.Group;
  gondolas: THREE.Group[];
  bulbs: Bulbs;
  hub: THREE.Vector3;
  radius: number;
}

/** The big Ferris wheel: a white stand, a pink wheel with bulbs, and gondolas that stay upright. */
export function makeFerrisWheel(): Wheel {
  const R = 9;
  const hubY = R + 1.6;
  const group = new THREE.Group();
  const stand = new THREE.Group();
  for (const zs of [-1.5, 1.5])
    for (const xs of [-1, 1]) {
      const from = new THREE.Vector3(xs * 4.6, 0, zs * 1.5);
      const to = new THREE.Vector3(0, hubY, zs);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, from.distanceTo(to), 8), flat('#fdf6ff'));
      leg.position.copy(from).lerp(to, 0.5);
      leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
      leg.castShadow = true;
      stand.add(leg);
    }
  const base = new THREE.Mesh(new THREE.BoxGeometry(11, 0.5, 4.4), flat('#9b6be8'));
  base.position.y = 0.25;
  stand.add(base);
  // Boarding platform and little steps.
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 2.8), flat('#ffcc33'));
  deck.position.set(0, 0.45, 2.8);
  stand.add(deck);
  mergeStatic(stand);
  group.add(stand);

  const wheel = new THREE.Group();
  wheel.position.y = hubY;
  const parts = new THREE.Group();
  for (const zs of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.16, 8, 64), flat('#ff7ab8'));
    rim.position.z = zs;
    const inner = new THREE.Mesh(new THREE.TorusGeometry(R * 0.55, 0.1, 6, 48), flat('#ffd1e6'));
    inner.position.z = zs;
    parts.add(rim, inner);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, R, 5), flat('#fff4fb'));
      spoke.position.set(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, zs);
      spoke.rotation.z = a - Math.PI / 2;
      parts.add(spoke);
    }
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), flat('#fff4fb'));
    bar.rotation.x = Math.PI / 2;
    bar.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
    parts.add(bar);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 2.6, 16), flat('#ffcc33'));
  hub.rotation.x = Math.PI / 2;
  parts.add(hub);
  mergeStatic(parts);
  wheel.add(parts);

  const bulbPos: number[] = [];
  for (const zs of [-1.12, 1.12])
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      bulbPos.push(Math.cos(a) * R, Math.sin(a) * R, zs);
    }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    for (let k = 1; k <= 4; k++) bulbPos.push(Math.cos(a) * R * (k / 5), Math.sin(a) * R * (k / 5), 1.15);
  }
  const bulbs = new Bulbs(bulbPos, ['#fff1b0', '#ffb3d1', '#9fe8ff', '#c9b3ff'], 0.6);
  wheel.add(bulbs.points);

  const gondolas: THREE.Group[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const holder = new THREE.Group();
    holder.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
    const gnd = new THREE.Group();
    const col = FAIR_COLORS[i % FAIR_COLORS.length];
    const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.75, 0.75, 14), flat(col));
    tub.position.y = -1.55;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.07, 6, 18), flat('#ffffff'));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -1.18;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.55, 14), flat(col));
    roof.position.y = 0.05;
    for (const s of [-1, 1]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.25, 4), flat('#fff4fb'));
      rod.position.set(s * 0.72, -0.6, 0);
      gnd.add(rod);
    }
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 5), flat('#fff4fb'));
    hook.position.y = 0.3;
    gnd.add(tub, rim, roof, hook);
    mergeStatic(gnd);
    holder.add(gnd);
    holder.userData.cabin = gnd;
    wheel.add(holder);
    gondolas.push(holder);
  }
  group.add(wheel);
  return { group, wheel, gondolas, bulbs, hub: new THREE.Vector3(0, hubY, 0), radius: R };
}

export interface Carousel {
  group: THREE.Group;
  spin: THREE.Group;
  horses: THREE.Object3D[];
  bulbs: Bulbs;
}

function makeHorse(color: string, saddle: string): THREE.Group {
  const h = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.7, 4, 8), flat(color));
  body.rotation.z = Math.PI / 2;
  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.4, 4, 8), flat(color));
  neck.position.set(0.48, 0.3, 0);
  neck.rotation.z = -0.6;
  const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.3, 4, 8), flat(color));
  head.position.set(0.68, 0.48, 0);
  head.rotation.z = Math.PI / 2 - 0.3;
  const mane = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.08), flat(saddle));
  mane.position.set(0.42, 0.48, 0);
  mane.rotation.z = -0.6;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.5), flat(saddle));
  seat.position.set(-0.05, 0.27, 0);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.45, 6), flat(saddle));
  tail.position.set(-0.62, 0.02, 0);
  tail.rotation.z = -2.2;
  h.add(body, neck, head, mane, seat, tail);
  for (const [x, z, k] of [
    [0.3, 0.13, 1],
    [0.3, -0.13, -1],
    [-0.3, 0.13, -1],
    [-0.3, -0.13, 1],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 5), flat(color));
    leg.position.set(x + k * 0.08, -0.32, z);
    leg.rotation.z = k * 0.35;
    h.add(leg);
  }
  mergeStatic(h);
  return h;
}

/** The carousel: striped roof, golden poles, horses going up and down. */
export function makeCarousel(): Carousel {
  const group = new THREE.Group();
  const spin = new THREE.Group();
  const statics = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.6, 0.5, 28), flat('#9b6be8'));
  base.position.y = 0.25;
  const top = stripedMesh(new THREE.CylinderGeometry(4.15, 4.15, 0.12, 28), ['#ffe066', '#ffffff'], 14);
  top.position.y = 0.56;
  const col = stripedMesh(new THREE.CylinderGeometry(0.6, 0.6, 3.6, 12), ['#ff7ab8', '#ffffff'], 6);
  col.position.y = 2.3;
  const roof = stripedMesh(new THREE.ConeGeometry(5, 2.2, 24, 1, true), ['#ff4f5e', '#fff6e8'], 12);
  roof.position.y = 5.1;
  const roofUnder = new THREE.Mesh(new THREE.CircleGeometry(5, 24), flat('#ffd1e6'));
  roofUnder.rotation.x = Math.PI / 2;
  roofUnder.position.y = 4.0;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), flat('#ffcc33'));
  ball.position.y = 6.4;
  statics.add(base, top, col, roof, roofUnder, ball);
  // Scalloped valance.
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), flat(i % 2 ? '#ffffff' : '#3fc1c9'));
    s.position.set(Math.cos(a) * 4.85, 4.05, Math.sin(a) * 4.85);
    statics.add(s);
  }
  const horses: THREE.Object3D[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.5, 6), flat('#ffd65a'));
    pole.position.set(Math.cos(a) * 3.2, 2.3, Math.sin(a) * 3.2);
    statics.add(pole);
    const horse = makeHorse(i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#ffe3f0' : '#e0f2ff', FAIR_COLORS[i % FAIR_COLORS.length]);
    horse.position.set(Math.cos(a) * 3.2, 1.6, Math.sin(a) * 3.2);
    horse.rotation.y = -a + Math.PI;
    horse.userData.phase = i * 0.8;
    horses.push(horse);
    spin.add(horse);
  }
  mergeStatic(statics);
  spin.add(statics);
  const bulbPos: number[] = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    bulbPos.push(Math.cos(a) * 5.05, 4.2, Math.sin(a) * 5.05);
  }
  const bulbs = new Bulbs(bulbPos, BULB_COLORS, 0.5);
  spin.add(bulbs.points);
  group.add(spin);
  return { group, spin, horses, bulbs };
}

/** The striped big top, with a flag on the top. */
export function makeBigTop(): THREE.Group {
  const g = new THREE.Group();
  const wall = stripedMesh(new THREE.CylinderGeometry(6, 6, 3.6, 28, 1, true), ['#ff4f5e', '#fff6e8'], 14);
  wall.position.y = 1.8;
  const roof = stripedMesh(new THREE.ConeGeometry(6.8, 5.2, 28, 1, true), ['#ff4f5e', '#fff6e8'], 14);
  roof.position.y = 6.2;
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 0.4), flat('#5a2a6b'));
  door.position.set(0, 1.4, 5.9);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), flat('#fff4fb'));
  pole.position.y = 9.6;
  const flag = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 4), flat('#ffcc33'));
  flag.rotation.z = -Math.PI / 2;
  flag.position.set(0.7, 10.3, 0);
  const valance = new THREE.Group();
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.6, 4), flat(i % 2 ? '#ffcc33' : '#3fc1c9'));
    s.rotation.x = Math.PI;
    s.position.set(Math.cos(a) * 6.75, 3.3, Math.sin(a) * 6.75);
    valance.add(s);
  }
  g.add(wall, roof, door, pole, flag, valance);
  g.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
  mergeStatic(g);
  return g;
}

/** A sweet stall with a striped awning and a round sign. */
export function makeStall(kind: 'popcorn' | 'candy' | 'balloon' | 'duck', colorA: string): THREE.Group {
  const g = new THREE.Group();
  const counter = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 1.6), flat('#f7e3c4'));
  counter.position.y = 0.6;
  const front = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.35, 1.65), flat(colorA));
  front.position.y = 1.05;
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.6, 0.2), flat('#fff3e0'));
  back.position.set(0, 1.3, -0.75);
  g.add(counter, front, back);
  for (const x of [-1.5, 1.5]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), flat('#ffffff'));
    post.position.set(x, 2.2, 0.75);
    g.add(post);
  }
  // Awning: alternating slats, slanted.
  for (let i = 0; i < 8; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 1.9), flat(i % 2 ? '#ffffff' : colorA));
    slat.position.set(-1.47 + i * 0.42, 3.3, 0.1);
    slat.rotation.x = 0.28;
    g.add(slat);
    const flap = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.35, 3), flat(i % 2 ? '#ffffff' : colorA));
    flap.rotation.x = Math.PI;
    flap.position.set(-1.47 + i * 0.42, 2.92, 1.04);
    g.add(flap);
  }
  g.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
  mergeStatic(g);
  const tex = signTexture(kind, colorA);
  const sign = new THREE.Mesh(new THREE.CircleGeometry(0.75, 24), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  sign.position.set(0, 4.05, 0.45);
  g.add(sign);
  return g;
}

/** A shiny balloon on a string (origin at the end of the string). */
export function makeBalloon(color: string, string = 1.4): THREE.Group {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), shiny(color, 90));
  b.scale.set(1, 1.18, 1);
  b.position.y = string + 0.36;
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.12, 6), shiny(color, 60));
  knot.position.y = string + 0.0;
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.05, string * 0.5, 0), new THREE.Vector3(0, string, 0)]), new THREE.LineBasicMaterial({ color: '#ffffff' }));
  g.add(b, knot, line);
  return g;
}
