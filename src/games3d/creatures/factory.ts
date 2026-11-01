import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makeSky, mergeStatic } from './fx';

/**
 * The world of the factory, built in code: a candy-coloured machine with its
 * glass tube, gauges, gears, chimneys and the big Surprise lever, the turntable
 * where creatures stand, and all around a sunny meadow with a pond, round
 * trees, flowers and clouds (where creatures go and show what they can do).
 * Static pieces are merged into a few draw calls; moving bits are kept apart.
 */

export const SPOT = {
  /** Where the creature stands (top of the turntable). */
  stage: new THREE.Vector3(0, 0.16, 0),
  ziggy: new THREE.Vector3(1.95, 0.02, 0.1),
  ziggyPortrait: new THREE.Vector3(1.1, 0.02, -0.95),
  lever: new THREE.Vector3(2.55, 0, -1.55),
  tubeMouth: new THREE.Vector3(0, 3.05, -0.55),
  pond: new THREE.Vector3(5.6, 0, 1.4),
  pondR: 1.9,
  meadow: new THREE.Vector3(2.4, 0, 2.2),
};

export interface Factory {
  group: THREE.Group;
  turntable: THREE.Group;
  lever: THREE.Group;
  leverBall: THREE.Mesh;
  porthole: THREE.Mesh;
  needles: THREE.Object3D[];
  gears: THREE.Object3D[];
  machine: THREE.Group;
  chimneys: THREE.Vector3[];
  funnel: THREE.Vector3;
  water: THREE.Mesh;
  ripples: THREE.Mesh[];
  clouds: THREE.Group;
  bulbs: THREE.Mesh[];
  /** Tap targets. */
  leverHit: THREE.Object3D;
  machineHit: THREE.Object3D;
  update(dt: number, t: number, reduce: boolean): void;
  dispose(): void;
}

const lam = (color: THREE.ColorRepresentation, extra: Partial<THREE.MeshLambertMaterialParameters> = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const std = (color: THREE.ColorRepresentation, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...extra });

function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, pos: [number, number, number], rot?: [number, number, number], cast = true): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.position.set(...pos);
  if (rot) o.rotation.set(...rot);
  o.castShadow = cast;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

function gearGeometry(r: number, teeth: number, depth: number): THREE.BufferGeometry {
  const sh = new THREE.Shape();
  const steps = teeth * 4;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const tooth = i % 4 < 2 ? 1 : 0.8;
    const x = Math.cos(a) * r * tooth;
    const y = Math.sin(a) * r * tooth;
    if (i === 0) sh.moveTo(x, y);
    else sh.lineTo(x, y);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, r * 0.28, 0, Math.PI * 2, true);
  sh.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  return g;
}

export function makeFactory(low: boolean, env: THREE.Texture | null): Factory {
  const group = new THREE.Group();
  const statics = new THREE.Group();
  group.add(statics);
  const live: THREE.Material[] = [];
  const keep = <M extends THREE.Material>(m: M) => {
    live.push(m);
    return m;
  };

  // ── Sky & meadow ──
  group.add(makeSky('#55b7ff', '#cdeeff', '#9fdc7c'));
  const groundGeo = new THREE.CircleGeometry(70, low ? 40 : 64, 0, Math.PI * 2);
  groundGeo.rotateX(-Math.PI / 2);
  {
    const p = groundGeo.attributes.position;
    const cols: number[] = [];
    const a = new THREE.Color('#7fd65a');
    const b = new THREE.Color('#5fbf48');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const k = 0.5 + Math.sin(x * 0.35) * Math.cos(z * 0.28) * 0.35 + Math.sin(x * 0.9 + z * 0.7) * 0.15;
      const c = a.clone().lerp(b, Math.max(0, Math.min(1, k)));
      cols.push(c.r, c.g, c.b);
    }
    groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  }
  const ground = new THREE.Mesh(groundGeo, lam('#ffffff', { vertexColors: true }));
  ground.receiveShadow = true;
  ground.userData.noMerge = true;
  group.add(ground);

  // Rolling hills far away, round trees, flowers.
  const hillM = lam('#6fcf55');
  const hillM2 = lam('#58b84a');
  for (let i = 0; i < 9; i++) {
    const a = -0.4 + (i / 8) * Math.PI * 1.2 + Math.PI * 0.95;
    const r = 34 + (i % 3) * 6;
    const h = add(statics, new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), i % 2 ? hillM : hillM2, [Math.cos(a) * r, -0.2, Math.sin(a) * r], undefined, false);
    h.scale.set(9 + (i % 4) * 2.5, 4 + (i % 3) * 1.6, 7);
  }
  const trunkM = lam('#a86a3d');
  const leafMs = [lam('#4fbf5a'), lam('#3fae58'), lam('#78d24a'), lam('#ff9fc8')];
  const treeAt = (x: number, z: number, s: number, m: number) => {
    add(statics, new THREE.CylinderGeometry(0.12 * s, 0.17 * s, 1.1 * s, 7), trunkM, [x, 0.55 * s, z]);
    add(statics, new THREE.IcosahedronGeometry(0.85 * s, 1), leafMs[m % leafMs.length], [x, 1.55 * s, z]);
    add(statics, new THREE.IcosahedronGeometry(0.55 * s, 1), leafMs[(m + 1) % leafMs.length], [x + 0.45 * s, 1.25 * s, z + 0.2 * s]);
  };
  const trees: [number, number, number][] = [
    [-6.5, -3.5, 1.3],
    [-8.5, -1, 1.0],
    [-5.5, 2.5, 0.9],
    [8.8, -2.5, 1.2],
    [9.5, 2.2, 1.0],
    [6.6, -4.6, 1.4],
    [-3.5, -7.5, 1.5],
    [3.5, -7.2, 1.3],
    [-11, -6, 1.6],
    [12, -6, 1.7],
    [0.5, -9.5, 1.4],
    [-9.5, 4.5, 1.1],
  ];
  trees.forEach(([x, z, s], i) => treeAt(x, z, s, i));
  const petal = [lam('#ffffff'), lam('#ffd93d'), lam('#ff7ab8'), lam('#a98bff'), lam('#ff8a5c')];
  const stemM = lam('#3f9e3f');
  const rand = (() => {
    let s = 7;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();
  for (let i = 0; i < (low ? 40 : 80); i++) {
    const a = rand() * Math.PI * 2;
    const r = 4.2 + rand() * 9;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r + 1;
    if (Math.hypot(x - SPOT.pond.x, z - SPOT.pond.z) < SPOT.pondR + 0.5) continue;
    if (z < -3.6 && Math.abs(x) < 3.2) continue;
    add(statics, new THREE.CylinderGeometry(0.015, 0.015, 0.22, 4), stemM, [x, 0.11, z], undefined, false);
    add(statics, new THREE.IcosahedronGeometry(0.07, 0), petal[i % petal.length], [x, 0.24, z], undefined, false);
  }
  // Pond: stones around, lily pads, water (kept apart: it moves).
  const stoneM = lam('#c9c3d6');
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const s = add(statics, new THREE.IcosahedronGeometry(0.22 + (i % 3) * 0.05, 0), stoneM, [SPOT.pond.x + Math.cos(a) * (SPOT.pondR + 0.1), 0.05, SPOT.pond.z + Math.sin(a) * (SPOT.pondR + 0.1) * 0.8], [i, i * 2, 0], false);
    s.scale.y = 0.55;
  }
  const water = new THREE.Mesh(new THREE.CircleGeometry(SPOT.pondR + 0.05, 40), std('#38b6ff', { roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.88 }));
  keep(water.material as THREE.Material);
  water.rotation.x = -Math.PI / 2;
  water.scale.y = 0.8;
  water.position.set(SPOT.pond.x, 0.035, SPOT.pond.z);
  water.receiveShadow = true;
  group.add(water);
  const padM = keep(lam('#5fc95a'));
  for (let i = 0; i < 3; i++) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.25, 12, 0.3, Math.PI * 1.8), padM);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(SPOT.pond.x - 1 + i * 0.9, 0.045, SPOT.pond.z + (i % 2 ? 0.6 : -0.5));
    group.add(pad);
  }
  const ripples: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 32), keep(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })));
    r.rotation.x = -Math.PI / 2;
    r.position.set(SPOT.pond.x, 0.05, SPOT.pond.z);
    r.userData.t = i / 3;
    group.add(r);
    ripples.push(r);
  }

  // Clouds: puffy, slowly drifting.
  const clouds = new THREE.Group();
  const cloudM = keep(lam('#ffffff', { emissive: new THREE.Color('#dfefff'), emissiveIntensity: 0.45 }));
  const cloudGeo = new THREE.IcosahedronGeometry(1, 2);
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group();
    const n = 4;
    for (let j = 0; j < n; j++) {
      const m = new THREE.Mesh(cloudGeo, cloudM);
      m.scale.setScalar(1 - Math.abs(j - 1.5) * 0.22);
      m.position.set((j - 1.5) * 1.1, Math.sin(j * 2) * 0.25, 0);
      c.add(m);
    }
    const a = -Math.PI / 2 + (i - 3) * 0.5;
    c.position.set(Math.cos(a) * (18 + (i % 3) * 5), 8 + (i % 3) * 1.6, Math.sin(a) * 16 - 6);
    c.scale.setScalar(1.2 + (i % 2) * 0.5);
    clouds.add(c);
  }
  group.add(clouds);

  // ── The workshop floor (tiles) and the turntable ──
  const tiles = canvasTex(
    256,
    256,
    (g) => {
      const cols = ['#fff2d6', '#ffe1ec'];
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          g.fillStyle = cols[(x + y) % 2];
          g.fillRect(x * 64, y * 64, 64, 64);
        }
      g.strokeStyle = 'rgba(160,110,140,0.25)';
      g.lineWidth = 3;
      for (let i = 0; i <= 4; i++) {
        g.beginPath();
        g.moveTo(i * 64, 0);
        g.lineTo(i * 64, 256);
        g.moveTo(0, i * 64);
        g.lineTo(256, i * 64);
        g.stroke();
      }
    },
    [4, 3]
  );
  const floorM = keep(new THREE.MeshLambertMaterial({ map: tiles }));
  const floor = new THREE.Mesh(new RoundedBoxGeometry(8.4, 0.08, 6.2, 2, 0.04), floorM);
  floor.position.set(0, 0.0, -0.9);
  floor.receiveShadow = true;
  group.add(floor);
  const rimM = lam('#ff8fb8');
  add(statics, new RoundedBoxGeometry(8.6, 0.06, 0.18, 2, 0.03), rimM, [0, 0.02, 2.2], undefined, false);

  const turntable = new THREE.Group();
  const ttTop = canvasTex(256, 256, (g) => {
    const cols = ['#ffd93d', '#ff9f43', '#ff6f91', '#8b7bff', '#4fc3f7', '#6bdc6b'];
    for (let i = 0; i < 12; i++) {
      g.fillStyle = cols[i % cols.length];
      g.beginPath();
      g.moveTo(128, 128);
      g.arc(128, 128, 130, (i / 12) * Math.PI * 2, ((i + 1) / 12) * Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#fff6e0';
    g.beginPath();
    g.arc(128, 128, 96, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffe9b0';
    g.beginPath();
    g.arc(128, 128, 60, 0, Math.PI * 2);
    g.fill();
  });
  const ttM = keep(std('#ffffff', { map: ttTop, roughness: 0.55 }));
  const ttSide = keep(std('#7c5cff', { roughness: 0.4 }));
  const tt = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.58, 0.14, low ? 36 : 56), [ttSide, ttM, ttSide]);
  tt.position.y = 0.08;
  tt.receiveShadow = true;
  tt.castShadow = true;
  turntable.add(tt);
  const bulbs: THREE.Mesh[] = [];
  const bulbGeo = new THREE.SphereGeometry(0.045, 8, 6);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const b = new THREE.Mesh(bulbGeo, keep(new THREE.MeshBasicMaterial({ color: '#fff3b0', toneMapped: false })));
    b.position.set(Math.cos(a) * 1.545, 0.08, Math.sin(a) * 1.545);
    turntable.add(b);
    bulbs.push(b);
  }
  group.add(turntable);

  // ── The machine ──
  const machine = new THREE.Group();
  machine.position.set(-0.2, 0, -3.1);
  group.add(machine);
  const mStatic = new THREE.Group();
  machine.add(mStatic);
  const purple = lam('#8a63ff');
  const lilac = lam('#b9a2ff');
  const teal = lam('#2ec4b6');
  const yellow = lam('#ffd23f');
  const pink = lam('#ff6fa8');
  const metal = lam('#d8dcf0');
  const body = add(mStatic, new RoundedBoxGeometry(4.8, 2.8, 1.5, 3, 0.3), purple, [0, 1.45, 0]);
  void body;
  add(mStatic, new RoundedBoxGeometry(5.0, 0.3, 1.7, 2, 0.12), pink, [0, 2.92, 0]);
  add(mStatic, new RoundedBoxGeometry(5.0, 0.26, 1.7, 2, 0.1), teal, [0, 0.13, 0]);
  // Rivets.
  for (let i = 0; i < 9; i++) add(mStatic, new THREE.SphereGeometry(0.05, 6, 4), yellow, [-2.2 + i * 0.55, 2.62, 0.77], undefined, false);
  // Porthole frame.
  add(mStatic, new THREE.TorusGeometry(0.62, 0.1, 10, 32), yellow, [-1.15, 1.75, 0.76]);
  // Buttons row.
  ['#ff5c7a', '#ffd23f', '#6bdc6b', '#4fc3f7'].forEach((c, i) => {
    add(mStatic, new THREE.CylinderGeometry(0.13, 0.15, 0.08, 14), metal, [0.35 + i * 0.42, 0.75, 0.77], [Math.PI / 2, 0, 0]);
    add(mStatic, new THREE.SphereGeometry(0.11, 12, 8), lam(c), [0.35 + i * 0.42, 0.75, 0.83]);
  });
  // Gauges (needles move).
  const needles: THREE.Object3D[] = [];
  const gaugeFace = canvasTex(128, 128, (g) => {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(64, 64, 62, 0, Math.PI * 2);
    g.fill();
    const cols = ['#6bdc6b', '#ffd93d', '#ff9f43', '#ff5c7a'];
    for (let i = 0; i < 4; i++) {
      g.strokeStyle = cols[i];
      g.lineWidth = 14;
      g.beginPath();
      g.arc(64, 64, 46, Math.PI * (0.8 + i * 0.35), Math.PI * (0.8 + (i + 1) * 0.35));
      g.stroke();
    }
  });
  const gaugeM = keep(new THREE.MeshBasicMaterial({ map: gaugeFace }));
  for (const [x, y] of [
    [0.55, 2.0],
    [1.45, 2.0],
  ] as const) {
    add(mStatic, new THREE.TorusGeometry(0.34, 0.06, 8, 24), metal, [x, y, 0.77]);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.33, 24), gaugeM);
    face.position.set(x, y, 0.78);
    machine.add(face);
    const needle = new THREE.Group();
    needle.position.set(x, y, 0.8);
    const n = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.26, 0.02), keep(lam('#2c2440')));
    n.position.y = 0.11;
    needle.add(n);
    machine.add(needle);
    needles.push(needle);
  }
  // Porthole: a swirl of colours turning behind glass.
  const swirl = canvasTex(256, 256, (g) => {
    const cols = ['#ff5c7a', '#ff9f43', '#ffd93d', '#6bdc6b', '#4fc3f7', '#8b7bff'];
    for (let i = 0; i < 24; i++) {
      g.fillStyle = cols[i % cols.length];
      g.beginPath();
      g.moveTo(128, 128);
      g.arc(128, 128, 140, (i / 24) * Math.PI * 2, ((i + 1) / 24) * Math.PI * 2 + 0.02);
      g.fill();
    }
    const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.15)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
  });
  const porthole = new THREE.Mesh(new THREE.CircleGeometry(0.58, 32), keep(new THREE.MeshBasicMaterial({ map: swirl, toneMapped: false })));
  porthole.position.set(-1.15, 1.75, 0.765);
  machine.add(porthole);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), keep(std('#ffffff', { transparent: true, opacity: 0.18, roughness: 0.05, envMap: env ?? null, envMapIntensity: 1 })));
  glass.rotation.x = Math.PI / 2;
  glass.scale.z = 0.25;
  glass.position.set(-1.15, 1.75, 0.76);
  machine.add(glass);
  // Gears (they turn).
  const gears: THREE.Object3D[] = [];
  for (const [x, y, r, c] of [
    [1.75, 0.95, 0.42, '#ffd23f'],
    [2.2, 1.55, 0.28, '#4fc3f7'],
    [-2.05, 0.75, 0.3, '#6bdc6b'],
  ] as const) {
    const gm = new THREE.Mesh(gearGeometry(r, r > 0.35 ? 10 : 7, 0.1), keep(lam(c)));
    gm.position.set(x, y, 0.82);
    gm.castShadow = true;
    machine.add(gm);
    gears.push(gm);
  }
  // Funnel on top (bubbles), chimneys (rainbow steam).
  add(mStatic, new THREE.CylinderGeometry(0.62, 0.18, 0.75, 20, 1, true), lilac, [-1.6, 3.42, -0.1]);
  add(mStatic, new THREE.TorusGeometry(0.62, 0.06, 8, 24), yellow, [-1.6, 3.8, -0.1], [Math.PI / 2, 0, 0]);
  add(mStatic, new THREE.CylinderGeometry(0.2, 0.24, 1.0, 14), teal, [1.4, 3.45, -0.2]);
  add(mStatic, new THREE.TorusGeometry(0.22, 0.05, 8, 18), yellow, [1.4, 3.95, -0.2], [Math.PI / 2, 0, 0]);
  add(mStatic, new THREE.CylinderGeometry(0.15, 0.18, 0.7, 14), pink, [2.0, 3.3, 0.05]);
  add(mStatic, new THREE.TorusGeometry(0.17, 0.045, 8, 18), yellow, [2.0, 3.65, 0.05], [Math.PI / 2, 0, 0]);
  const chimneys = [new THREE.Vector3(1.2, 4.05, -3.3), new THREE.Vector3(1.8, 3.75, -3.05)];
  const funnel = new THREE.Vector3(-1.8, 3.85, -3.2);
  // Pipes on the sides.
  const pipeM = lam('#4fc3f7');
  const pipe2 = lam('#ff9f43');
  const pipeTube = (pts: THREE.Vector3[], r: number, m: THREE.Material) => {
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 10, false);
    const o = new THREE.Mesh(g, m);
    o.castShadow = true;
    o.receiveShadow = true;
    mStatic.add(o);
  };
  pipeTube([new THREE.Vector3(-2.4, 2.3, 0.2), new THREE.Vector3(-3.0, 2.2, 0.4), new THREE.Vector3(-3.2, 1.2, 0.6), new THREE.Vector3(-3.1, 0.1, 0.9)], 0.13, pipeM);
  pipeTube([new THREE.Vector3(2.4, 2.4, -0.3), new THREE.Vector3(3.0, 2.6, -0.2), new THREE.Vector3(3.3, 1.6, 0.0), new THREE.Vector3(3.4, 0.1, 0.1)], 0.11, pipe2);
  for (const [x, y, z] of [
    [-3.17, 1.4, 0.58],
    [3.32, 1.5, 0.0],
  ] as const)
    add(mStatic, new THREE.TorusGeometry(0.16, 0.05, 8, 16), yellow, [x, y, z], [Math.PI / 2, 0, 0]);
  // Bunting along the top.
  const flagCols = ['#ff5c7a', '#ffd93d', '#4fc3f7', '#6bdc6b', '#ff9f43', '#b48bff'];
  for (let i = 0; i < 11; i++) {
    const x = -2.4 + i * 0.48;
    const f = add(mStatic, new THREE.ConeGeometry(0.15, 0.32, 3), lam(flagCols[i % flagCols.length]), [x, 2.6 - Math.sin((i / 10) * Math.PI) * 0.12, 0.92], [Math.PI, 0, 0], false);
    f.scale.z = 0.25;
  }
  // The glass tube, from the machine to above the turntable.
  const tubeCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.2, 2.35, 0.7), new THREE.Vector3(0.15, 3.2, 1.6), new THREE.Vector3(0.0, 3.55, 2.35), new THREE.Vector3(0.0, 3.25, 2.55)]);
  const tubeM = keep(std('#bfe9ff', { transparent: true, opacity: 0.32, roughness: 0.05, envMap: env ?? null, envMapIntensity: 1.2, depthWrite: false }));
  const glassTube = new THREE.Mesh(new THREE.TubeGeometry(tubeCurve, 30, 0.32, 16, false), tubeM);
  machine.add(glassTube);
  for (const k of [0.08, 0.5, 0.97]) {
    const p = tubeCurve.getPointAt(k);
    const tg = tubeCurve.getTangentAt(k);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 8, 20), keep(lam('#ffd23f')));
    ring.position.copy(p);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg);
    ring.castShadow = true;
    machine.add(ring);
  }
  // Mouth of the tube (a funnel pointing down at the turntable).
  const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 0.3, 20, 1, true), keep(lam('#ffd23f', { side: THREE.DoubleSide })));
  mouth.position.set(0, 3.08, 2.55);
  machine.add(mouth);

  // ── The lever ──
  const lever = new THREE.Group();
  const leverBase = add(statics, new RoundedBoxGeometry(0.5, 0.75, 0.5, 2, 0.08), teal, [SPOT.lever.x, 0.38, SPOT.lever.z]);
  void leverBase;
  add(statics, new THREE.CylinderGeometry(0.1, 0.1, 0.56, 12), metal, [SPOT.lever.x, 0.72, SPOT.lever.z], [0, 0, Math.PI / 2]);
  lever.position.set(SPOT.lever.x, 0.72, SPOT.lever.z);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.0, 10), keep(lam('#d8dcf0')));
  arm.position.y = 0.5;
  arm.castShadow = true;
  const leverBall = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 12), keep(std('#ff4d6d', { roughness: 0.3, envMap: env ?? null, envMapIntensity: 0.6 })));
  leverBall.position.y = 1.02;
  leverBall.castShadow = true;
  lever.add(arm, leverBall);
  lever.rotation.x = -0.55;
  group.add(lever);

  // Merge the static bits.
  mergeStatic(statics);
  mergeStatic(mStatic);

  // Hit targets (invisible, generous).
  const hitM = keep(new THREE.MeshBasicMaterial({ visible: false }));
  const leverHit = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), hitM);
  leverHit.position.set(SPOT.lever.x, 1.2, SPOT.lever.z);
  group.add(leverHit);
  const machineHit = new THREE.Mesh(new THREE.BoxGeometry(4.8, 3.6, 1.6), hitM);
  machineHit.position.set(-0.2, 1.7, -3.1);
  group.add(machineHit);

  return {
    group,
    turntable,
    lever,
    leverBall,
    porthole,
    needles,
    gears,
    machine,
    chimneys,
    funnel,
    water,
    ripples,
    clouds,
    bulbs,
    leverHit,
    machineHit,
    update(dt, t, reduce) {
      const E = reduce ? 0.3 : 1;
      porthole.rotation.z -= dt * 0.8 * E;
      gears[0].rotation.z += dt * 0.7 * E;
      gears[1].rotation.z -= dt * 1.1 * E;
      gears[2].rotation.z -= dt * 0.9 * E;
      needles[0].rotation.z = Math.sin(t * 1.3) * 0.9 * E;
      needles[1].rotation.z = Math.sin(t * 0.8 + 1) * 1.1 * E;
      clouds.rotation.y = Math.sin(t * 0.02) * 0.08;
      for (const r of ripples) {
        r.userData.t = (r.userData.t + dt * 0.25) % 1;
        const k = r.userData.t as number;
        r.scale.setScalar(0.2 + k * 1.5);
        (r.material as THREE.MeshBasicMaterial).opacity = Math.sin(k * Math.PI) * 0.35;
      }
      bulbs.forEach((b, i) => {
        const on = Math.sin(t * 3 - i * 0.9) > 0;
        (b.material as THREE.MeshBasicMaterial).color.set(on ? '#fff3b0' : '#ffb3d1');
      });
    },
    dispose() {
      for (const m of live) m.dispose();
    },
  };
}
