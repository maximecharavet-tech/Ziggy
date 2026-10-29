import * as THREE from 'three';
import { glow, glowMat, mat } from '../kit/look';
import { rng } from '../kit/rng';
import { canvasTex, mergeStatic } from './util';

/**
 * The little village square around the pizza truck: warm cobblestones,
 * pastel houses with shutters and flower boxes, a bell tower, cypresses and
 * round trees, a fountain, café tables, lamp posts with bunting, soft hills
 * and clouds. Static pieces are merged into a few draw calls.
 */

function cobbleTexture(): THREE.CanvasTexture {
  return canvasTex(
    512,
    512,
    (g) => {
      g.fillStyle = '#bda78a';
      g.fillRect(0, 0, 512, 512);
      const r = rng(17);
      const cols = ['#ead9bf', '#e2cdb0', '#f1e3cc', '#dcc4a2', '#e8d2b4', '#f3e6d2'];
      const n = 8;
      const s = 512 / n;
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n + 1; x++) {
          const ox = (y % 2) * s * 0.5;
          const cx = x * s + ox + (r() - 0.5) * 6;
          const cy = y * s + s / 2 + (r() - 0.5) * 6;
          const w = s * 0.86;
          const h = s * 0.8;
          for (const dx of [0, -512, 512]) {
            g.fillStyle = cols[Math.floor(r() * cols.length)];
            g.beginPath();
            g.ellipse(cx + dx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = 'rgba(255,255,255,0.22)';
            g.beginPath();
            g.ellipse(cx + dx - w * 0.12, cy - h * 0.14, w * 0.26, h * 0.16, 0, 0, Math.PI * 2);
            g.fill();
          }
        }
    },
    [16, 16]
  );
}

const box = (w: number, h: number, d: number, color: string, x: number, y: number, z: number, cast = false) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = cast;
  return m;
};

const HOUSE_COLS = ['#ffb8a8', '#ffe08a', '#bfe6c5', '#a9d8ff', '#ffd0a1', '#e4c8ff', '#fff1d0', '#ffc6dd'];
const SHUTTERS = ['#3fa37a', '#4a86d9', '#c9773e', '#7a5fc7', '#e0564a'];

function makeHouse(w: number, floors: number, color: string, r: () => number, shop: boolean): THREE.Group {
  const g = new THREE.Group();
  const fh = 1.7;
  const h = floors * fh + 0.5;
  const d = 3;
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  walls.position.y = h / 2;
  walls.castShadow = true;
  walls.receiveShadow = true;
  g.add(walls);
  g.add(box(w + 0.08, 0.35, d + 0.08, '#d8c4a8', 0, 0.17, 0));
  // Roof: terracotta, gable or flat with a ledge.
  if (r() < 0.65) {
    const tri = new THREE.Shape();
    tri.moveTo(-d / 2 - 0.25, 0);
    tri.lineTo(d / 2 + 0.25, 0);
    tri.lineTo(0, 1.25);
    tri.closePath();
    const geo = new THREE.ExtrudeGeometry(tri, { depth: w + 0.3, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-(w + 0.3) / 2, 0, 0);
    const roof = new THREE.Mesh(geo, mat('#d9693f'));
    roof.position.y = h;
    roof.castShadow = true;
    g.add(roof);
  } else {
    g.add(box(w + 0.3, 0.22, d + 0.3, '#c9573a', 0, h + 0.11, 0, true));
  }
  // Windows with shutters and flower boxes.
  const sh = SHUTTERS[Math.floor(r() * SHUTTERS.length)];
  const nWin = w > 3.8 ? 3 : 2;
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < nWin; i++) {
      const x = (i - (nWin - 1) / 2) * (w / nWin);
      const y = 0.5 + f * fh + fh * 0.55;
      if (f === 0 && i === Math.floor(nWin / 2)) {
        // Door with a little arch.
        g.add(box(0.8, 1.35, 0.06, '#7a4a2a', x, 0.35 + 0.67, d / 2 + 0.02));
        const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 12, 1, false, -Math.PI / 2, Math.PI), mat('#7a4a2a'));
        arch.rotation.x = Math.PI / 2;
        arch.position.set(x, 1.7, d / 2 + 0.02);
        g.add(arch);
        g.add(box(0.06, 0.06, 0.04, '#ffd166', x + 0.25, 1.0, d / 2 + 0.06));
        if (shop) {
          // A little striped shop awning over the door.
          for (let k = 0; k < 5; k++) {
            const s = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.7), mat(k % 2 ? '#ffffff' : sh));
            s.rotation.x = 0.45;
            s.position.set(x - 0.6 + k * 0.3, 2.3, d / 2 + 0.32);
            g.add(s);
          }
        }
        continue;
      }
      g.add(box(0.62, 0.82, 0.05, '#4d6f99', x, y, d / 2 + 0.02));
      g.add(box(0.72, 0.07, 0.07, '#fdf8ee', x, y + 0.44, d / 2 + 0.04));
      g.add(box(0.72, 0.07, 0.07, '#fdf8ee', x, y - 0.44, d / 2 + 0.04));
      g.add(box(0.07, 0.86, 0.04, '#fdf8ee', x, y, d / 2 + 0.04));
      for (const sx of [-1, 1]) g.add(box(0.3, 0.86, 0.05, sh, x + sx * 0.48, y, d / 2 + 0.03));
      if ((f + i) % 2 === 0) {
        g.add(box(0.7, 0.16, 0.22, '#9b5a3a', x, y - 0.52, d / 2 + 0.12));
        for (let k = 0; k < 4; k++) {
          const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), mat(['#ff5c7a', '#ffd166', '#ff8ad1', '#ffffff'][k]));
          fl.position.set(x - 0.24 + k * 0.16, y - 0.4, d / 2 + 0.16);
          g.add(fl);
        }
      }
    }
  }
  return g;
}

function makeTower(): THREE.Group {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(2.2, 9, 2.2), mat('#f3d9b5'));
  shaft.position.y = 4.5;
  shaft.castShadow = true;
  g.add(shaft);
  g.add(box(2.4, 0.3, 2.4, '#e2c39a', 0, 6.6, 0));
  g.add(box(2.4, 0.3, 2.4, '#e2c39a', 0, 9.0, 0));
  // Bell opening and a golden bell.
  g.add(box(1.0, 1.4, 0.1, '#5a4a6a', 0, 7.7, 1.12));
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.42, 0.6, 10), mat('#ffcf4a'));
  bell.position.set(0, 7.6, 1.0);
  g.add(bell);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.75, 2.2, 4), mat('#d9693f'));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 10.25;
  roof.castShadow = true;
  g.add(roof);
  // Clock face.
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), mat('#fffaf0'));
  clock.position.set(0, 5.4, 1.12);
  g.add(clock);
  g.add(box(0.06, 0.4, 0.03, '#3b3f4a', 0, 5.55, 1.14));
  g.add(box(0.3, 0.06, 0.03, '#3b3f4a', 0.12, 5.4, 1.14));
  return g;
}

function makeRoundTree(s: number, r: () => number): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.2 * s, 1.4 * s, 7), mat('#8a5a3a'));
  trunk.position.y = 0.7 * s;
  trunk.castShadow = true;
  g.add(trunk);
  const greens = ['#6cc24a', '#5cb848', '#7dd06a'];
  for (let k = 0; k < 3; k++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry((0.85 - k * 0.15) * s, 1), mat(greens[k]));
    b.position.set((k - 1) * 0.45 * s, (1.9 + (k === 1 ? 0.45 : 0)) * s, (r() - 0.5) * 0.3 * s);
    b.castShadow = true;
    g.add(b);
  }
  return g;
}

function makeCypress(s: number): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.14 * s, 0.6 * s, 6), mat('#7a4f30'));
  trunk.position.y = 0.3 * s;
  g.add(trunk);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.62 * s, 10, 8), mat('#3f8a4a'));
  body.scale.set(1, 3.0, 1);
  body.position.y = 2.2 * s;
  body.castShadow = true;
  g.add(body);
  return g;
}

function makeLampPost(): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.4, 8), mat('#3b4a5a'));
  pole.position.y = 1.7;
  pole.castShadow = true;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.3, 8), mat('#3b4a5a'));
  base.position.y = 0.15;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.38, 6), glowMat('#ffe6a8', 1.0));
  head.position.y = 3.55;
  const capM = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.28, 6), mat('#3b4a5a'));
  capM.position.y = 3.86;
  g.add(pole, base, head, capM);
  return g;
}

function makeCafeTable(): THREE.Group {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 14), mat('#ffffff'));
  top.position.y = 0.78;
  top.castShadow = true;
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.78, 6), mat('#3b4a5a'));
  leg.position.y = 0.39;
  g.add(top, leg);
  for (const a of [0, Math.PI]) {
    const chair = new THREE.Group();
    chair.add(box(0.42, 0.06, 0.42, '#ec4a3f', 0, 0.48, 0, true));
    chair.add(box(0.42, 0.5, 0.06, '#ec4a3f', 0, 0.74, -0.2, true));
    for (const [lx, lz] of [
      [-0.17, -0.17],
      [0.17, -0.17],
      [-0.17, 0.17],
      [0.17, 0.17],
    ])
      chair.add(box(0.04, 0.46, 0.04, '#3b4a5a', lx, 0.23, lz));
    chair.position.set(Math.sin(a) * 0.75, 0, Math.cos(a) * 0.75);
    chair.rotation.y = a + Math.PI;
    g.add(chair);
  }
  // Striped parasol.
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 5), mat('#e8e2d6'));
  pole.position.y = 1.55;
  g.add(pole);
  const segs = 8;
  for (let i = 0; i < segs; i++) {
    const seg = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.45, segs, 1, true, (i / segs) * Math.PI * 2, (Math.PI * 2) / segs), mat(i % 2 ? '#ffffff' : '#4cc9b7', { side: THREE.DoubleSide }));
    seg.position.y = 2.3;
    seg.castShadow = true;
    g.add(seg);
  }
  return g;
}

function makeFountain(): THREE.Group & { userData: { spout: THREE.Vector3; water: THREE.Mesh } } {
  const g = new THREE.Group() as THREE.Group & { userData: { spout: THREE.Vector3; water: THREE.Mesh } };
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.8, 0.55, 18, 1, true), mat('#e6d3b8', { side: THREE.DoubleSide }));
  basin.position.y = 0.27;
  basin.castShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.12, 6, 24), mat('#f1e3cc'));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.55;
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1.66, 24),
    new THREE.MeshPhongMaterial({ color: '#6fd0f2', emissive: '#1d6a8f', emissiveIntensity: 0.35, shininess: 90, specular: '#ffffff', flatShading: true })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.45;
  water.userData.noMerge = true;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.3, 10), mat('#f1e3cc'));
  pillar.position.y = 0.95;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.25, 0.25, 14), mat('#e6d3b8'));
  bowl.position.y = 1.65;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat('#f1e3cc'));
  ball.position.y = 1.9;
  g.add(basin, rim, water, pillar, bowl, ball);
  g.userData.spout = new THREE.Vector3(0, 2.0, 0);
  g.userData.water = water;
  return g;
}

/** A string of little triangle flags hanging between two points. */
function bunting(a: THREE.Vector3, b: THREE.Vector3, sag: number, r: () => number): THREE.Group {
  const g = new THREE.Group();
  const cols = ['#ec4a3f', '#ffcf4a', '#4cc9b7', '#7fb3ef', '#ff8ad1', '#9bf07f'];
  const len = a.distanceTo(b);
  const n = Math.max(4, Math.floor(len / 0.55));
  const at = (t: number) => a.clone().lerp(b, t).add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * sag, 0));
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) pts.push(at(i / 24));
  const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.015, 3, false), mat('#f5ead8'));
  g.add(rope);
  const dir = b.clone().sub(a).setY(0).normalize();
  const yaw = Math.atan2(dir.x, dir.z) + Math.PI / 2;
  for (let i = 1; i < n; i++) {
    const p = at(i / n);
    const tri = new THREE.Shape();
    tri.moveTo(-0.17, 0);
    tri.lineTo(0.17, 0);
    tri.lineTo(0, -0.36);
    tri.closePath();
    const f = new THREE.Mesh(new THREE.ShapeGeometry(tri), mat(cols[Math.floor(r() * cols.length)], { side: THREE.DoubleSide }));
    f.position.copy(p);
    f.rotation.y = yaw;
    g.add(f);
  }
  return g;
}

export interface Village {
  group: THREE.Group;
  fountain: THREE.Vector3;
  water: THREE.Mesh;
  clouds: THREE.Group;
  /** Perches for the pigeons (lamp tops, fountain rim). */
  perches: THREE.Vector3[];
}

export function makeVillage(lowPower: boolean): Village {
  const root = new THREE.Group();
  const r = rng(23);

  // Cobbled square, then grass, then soft hills far away.
  const ground = new THREE.Mesh(new THREE.CircleGeometry(36, 64).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: cobbleTexture() }));
  ground.receiveShadow = true;
  ground.name = 'ground';
  root.add(ground);
  const statics = new THREE.Group();
  root.add(statics);
  const grass = new THREE.Mesh(new THREE.RingGeometry(35.5, 140, 48, 2).rotateX(-Math.PI / 2), mat('#98cf6a'));
  grass.position.y = -0.02;
  statics.add(grass);
  const hillCols = ['#8fcf72', '#a3d97f', '#7fc46a', '#b4e08c'];
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI * 0.95 + (i / 13) * Math.PI * 0.9 + (r() - 0.5) * 0.15;
    const d = 62 + r() * 22;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(14 + r() * 12, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(hillCols[i % 4]));
    hill.scale.y = 0.38 + r() * 0.25;
    hill.position.set(Math.cos(a) * d, -1, Math.sin(a) * d);
    statics.add(hill);
  }
  // A curb ring where the cobbles end around the square.
  const curb = new THREE.Mesh(new THREE.TorusGeometry(19, 0.12, 4, 64), mat('#d8c4a8'));
  curb.rotation.x = Math.PI / 2;
  curb.position.y = 0.04;
  statics.add(curb);

  // Houses around the back of the square.
  const houses: [number, number, number, number][] = [
    [-15.5, -8.5, 0.55, 2],
    [-11.4, -10.6, 0.35, 3],
    [-7.3, -11.6, 0.15, 2],
    [-3.2, -12.2, 0.05, 3],
    [1.0, -12.4, 0, 2],
    [5.2, -12.1, -0.06, 3],
    [9.3, -11.3, -0.18, 2],
    [13.2, -9.9, -0.36, 3],
    [16.6, -7.6, -0.6, 2],
  ];
  houses.forEach(([x, z, yaw, floors], i) => {
    const h = makeHouse(3.3 + r() * 1.1, floors, HOUSE_COLS[i % HOUSE_COLS.length], r, i % 3 === 1);
    h.position.set(x, 0, z);
    h.rotation.y = yaw;
    statics.add(h);
  });
  const tower = makeTower();
  tower.position.set(-20, 0, -14);
  tower.rotation.y = 0.7;
  statics.add(tower);
  if (!lowPower) {
    const far = [
      [-24, -24, 0.6],
      [22, -22, -0.6],
      [-6, -21, 0],
      [8, -22, 0],
    ];
    far.forEach(([x, z, yaw], i) => {
      const h = makeHouse(3.6, 3, HOUSE_COLS[(i + 3) % HOUSE_COLS.length], r, false);
      h.position.set(x, 0, z);
      h.rotation.y = yaw;
      statics.add(h);
    });
  }

  // Trees.
  const cypresses: [number, number, number][] = [
    [-13.5, -5.5, 1.1],
    [12.5, -5.8, 1.2],
    [-18.5, -10.5, 1.3],
    [19.5, -11, 1.2],
    [-9.2, -8.6, 0.95],
    [10.5, -8.4, 0.9],
  ];
  for (const [x, z, s] of cypresses) {
    const c = makeCypress(s);
    c.position.set(x, 0, z);
    statics.add(c);
  }
  const rounds: [number, number, number][] = [
    [-12, 1.5, 1.2],
    [12.5, 0.5, 1.1],
    [-16, 6, 1.3],
    [16.5, 7, 1.25],
    [-21, -3, 1.4],
    [22, -2, 1.3],
  ];
  for (const [x, z, s] of lowPower ? rounds.slice(0, 4) : rounds) {
    const t = makeRoundTree(s, r);
    t.position.set(x, 0, z);
    statics.add(t);
  }

  // Fountain, café, benches, lamp posts.
  const fountain = makeFountain();
  fountain.position.set(-8.2, 0, 3.2);
  statics.add(fountain);
  for (const [x, z] of [
    [7.6, 1.2],
    [9.6, 4.4],
  ]) {
    const t = makeCafeTable();
    t.position.set(x, 0, z);
    t.rotation.y = r() * Math.PI;
    statics.add(t);
  }
  const bench = new THREE.Group();
  bench.add(box(1.8, 0.08, 0.5, '#c98a5a', 0, 0.48, 0, true));
  bench.add(box(1.8, 0.4, 0.07, '#c98a5a', 0, 0.75, -0.24, true));
  for (const x of [-0.75, 0.75]) bench.add(box(0.08, 0.48, 0.45, '#3b4a5a', x, 0.24, 0));
  bench.position.set(-6.2, 0, -5.4);
  bench.rotation.y = 0.35;
  statics.add(bench);
  const lampSpots: [number, number][] = [
    [-6.0, 5.6],
    [6.4, 6.2],
    [-10.5, -4.2],
    [10.8, -4.0],
  ];
  const perches: THREE.Vector3[] = [];
  for (const [x, z] of lampSpots) {
    const l = makeLampPost();
    l.position.set(x, 0, z);
    statics.add(l);
    perches.push(new THREE.Vector3(x, 4.0, z));
  }
  perches.push(new THREE.Vector3(-8.2 + 1.7, 0.66, 3.2), new THREE.Vector3(-8.2 - 1.2, 0.66, 3.2 + 1.2));

  // Bunting across the square, behind the truck.
  const bunts = new THREE.Group();
  bunts.add(bunting(new THREE.Vector3(-13.5, 5.6, -8.2), new THREE.Vector3(13.5, 5.6, -8.2), 1.0, r));
  bunts.add(bunting(new THREE.Vector3(-10.5, 3.9, -4.2), new THREE.Vector3(-4.2, 5.0, -1.2), 0.5, r));
  bunts.add(bunting(new THREE.Vector3(10.8, 3.9, -4.0), new THREE.Vector3(3.6, 5.0, -1.2), 0.5, r));
  bunts.add(bunting(new THREE.Vector3(-10.5, 3.9, -4.2), new THREE.Vector3(-6.0, 3.9, 5.6), 0.6, r));
  bunts.add(bunting(new THREE.Vector3(10.8, 3.9, -4.0), new THREE.Vector3(6.4, 3.9, 6.2), 0.6, r));
  statics.add(bunts);

  // Flower beds along the houses.
  for (let i = 0; i < (lowPower ? 10 : 22); i++) {
    const a = -Math.PI * 0.92 + (i / 21) * Math.PI * 0.84;
    const d = 17.2 + r() * 1.2;
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 + r() * 0.25, 1), mat(r() > 0.5 ? '#5cb848' : '#4caf50'));
    bush.position.set(Math.cos(a) * d, 0.3, Math.sin(a) * d * 0.62 - 1.5);
    bush.castShadow = true;
    statics.add(bush);
    for (let k = 0; k < 3; k++) {
      const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), mat(['#ff5c7a', '#ffd166', '#ff8ad1', '#ffffff', '#b38cff'][(i + k) % 5]));
      fl.position.copy(bush.position).add(new THREE.Vector3(Math.cos(k * 2.1) * 0.4, 0.25, Math.sin(k * 2.1) * 0.4));
      statics.add(fl);
    }
  }

  mergeStatic(statics, true);

  // Clouds (drift slowly) and a warm sun.
  const clouds = new THREE.Group();
  const cm = mat('#ffffff', { emissive: new THREE.Color('#ffffff').multiplyScalar(0.35) });
  for (let i = 0; i < 8; i++) {
    const cl = new THREE.Group();
    const n = 3 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 + r() * 1.6, 1), cm);
      p.position.set((k - n / 2) * 2.2, r() * 0.9, r() * 1.2);
      p.scale.y = 0.62;
      cl.add(p);
    }
    const a = -Math.PI * 0.95 + (i / 7) * Math.PI * 0.9;
    const d = 55 + r() * 25;
    cl.position.set(Math.cos(a) * d, 16 + r() * 14, Math.sin(a) * d);
    cl.lookAt(0, cl.position.y, 0);
    clouds.add(cl);
  }
  mergeStatic(clouds);
  root.add(clouds);
  const sun = glow('#fff1c4', 34, 0.55);
  (sun.material as THREE.SpriteMaterial).fog = false;
  sun.position.set(40, 46, -110);
  const sunCore = glow('#fffbe8', 10, 0.9);
  (sunCore.material as THREE.SpriteMaterial).fog = false;
  sunCore.position.copy(sun.position);
  root.add(sun, sunCore);

  return { group: root, fountain: fountain.position.clone().add(fountain.userData.spout), water: fountain.userData.water, clouds, perches };
}
