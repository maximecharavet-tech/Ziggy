import * as THREE from 'three';
import { glow, mat } from '../kit/look';
import { makePine } from '../kit/models';
import { rng } from '../kit/rng';
import { BODY, type BodyId } from './logic';
import { makeSkyBody, mergeStatic } from './models';
import { planetMap } from './textures';

/**
 * The landing scenes, at character scale: a curved piece of ground (rocky
 * worlds and the Moon), a deck of clouds high above a giant planet (Jupiter,
 * Uranus, Neptune: no ground!), or Saturn's icy rings. Each has its own sky,
 * light and haze, the Sun at the right size for its distance, and the Earth
 * hanging in the Moon's sky.
 */

export interface Stage {
  id: BodyId;
  group: THREE.Group;
  kind: 'ground' | 'cloud' | 'ring';
  sky: { top: string; bottom: string; stars: number };
  fog: { color: string; near: number; far: number } | null;
  hemi: { sky: string; ground: string; intensity: number };
  key: { color: string; intensity: number };
  rocketSpot: THREE.Vector3;
  alienSpot: THREE.Vector3;
  /** 1 = Earth; the Moon is about 0.17: slow, giant jumps. */
  gravity: number;
  dust: string;
  update(dt: number, t: number): void;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** How big the Sun looks from each world (not to scale, but in the right order). */
const SUN_SIZE: Record<BodyId, number> = { mercury: 70, venus: 46, earth: 34, moon: 34, mars: 26, jupiter: 13, saturn: 10, uranus: 7, neptune: 6 };
// Just above the horizon, a little to the left: it shows in the frame (the camera looks a little down).
export const SUN_DIR = new THREE.Vector3(-0.3, 0.025, -0.95).normalize();

interface GroundOpts {
  seed: number;
  curve: number;
  low: string;
  high: string;
  accent?: string;
  craters: number;
  bump: number;
  size?: number;
  seg?: number;
}

/** A curved, faceted piece of ground with soft bumps and craters; flat where the characters stand. */
function makeGround(o: GroundOpts): THREE.Mesh {
  const size = o.size ?? 150;
  const seg = o.seg ?? 72;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const r = rng(o.seed);
  const cr = Array.from({ length: o.craters }, () => {
    const a = r() * Math.PI * 2;
    const d = 7 + r() * 45;
    return { x: Math.cos(a) * d, z: Math.sin(a) * d - 8, rad: 1.2 + r() * 4.5, depth: 0.25 + r() * 0.6 };
  });
  // Craters the camera can see well, also in front of the characters.
  if (o.craters) cr.push({ x: -7.5, z: -3, rad: 2.2, depth: 0.5 }, { x: 8, z: -5, rad: 3, depth: 0.6 }, { x: -4.2, z: 5.2, rad: 1.5, depth: 0.35 }, { x: 4.6, z: 6.8, rad: 2.0, depth: 0.45 }, { x: 0.6, z: 9.5, rad: 1.2, depth: 0.3 });
  const pos = geo.attributes.position;
  const colors: number[] = [];
  const lo = new THREE.Color(o.low);
  const hi = new THREE.Color(o.high);
  const ac = new THREE.Color(o.accent ?? o.low);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // Flat only on the strip where the rocket, Ziggy and the inhabitant stand.
    const flat = smooth(0, 3, Math.hypot(Math.max(0, Math.abs(x) - 5), Math.max(0, z - 2.4) + Math.max(0, -3 - z)));
    let y = -(x * x + z * z) / (2 * o.curve);
    const n = Math.sin(x * 0.35 + z * 0.12) * Math.cos(z * 0.41 - x * 0.07) + Math.sin(x * 0.9 + 1.3) * Math.sin(z * 0.8) * 0.4;
    y += n * o.bump * flat + (r() - 0.5) * 0.12 * flat;
    let floor = 0;
    for (const k of cr) {
      const d = Math.hypot(x - k.x, z - k.z) / k.rad;
      if (d < 1) {
        y -= k.depth * (1 - d * d);
        floor = Math.max(floor, 1 - d);
      } else if (d < 1.45) y += k.depth * 0.45 * (1 - (d - 1) / 0.45);
    }
    pos.setY(i, y);
    c.copy(lo).lerp(hi, Math.max(0, Math.min(1, 0.5 + n * 0.35 + (r() - 0.5) * 0.25)));
    if (floor > 0) c.lerp(ac, Math.min(1, floor * 1.6));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, mat('#ffffff', { vertexColors: true }));
  ground.receiveShadow = true;
  return ground;
}

/** Rocks scattered around, never where the characters stand. */
function scatterRocks(g: THREE.Group, seed: number, count: number, colors: string[], curve: number, scale = 1) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2;
    const d = 5.5 + r() * 26;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d * 0.8 - 3;
    if (Math.abs(x) < 5.5 && z > -3.5 && z < 4) continue;
    const s = (0.25 + r() * r() * 1.1) * scale;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat(colors[i % colors.length]));
    rock.position.set(x, -(x * x + z * z) / (2 * curve) + s * 0.3, z);
    rock.rotation.set(r() * 3, r() * 3, r() * 3);
    rock.scale.y = 0.6 + r() * 0.5;
    rock.castShadow = true;
    g.add(rock);
  }
}

/** A puffy cloud cluster (merged). */
function cloudCluster(r: () => number, color: string, size = 1, n = 7): THREE.Group {
  const g = new THREE.Group();
  const m = mat(color, { flatShading: false });
  for (let i = 0; i < n; i++) {
    const s = (0.6 + r() * 0.6) * size;
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), m);
    p.position.set((i - (n - 1) / 2) * 0.55 * size, Math.sin((i / (n - 1)) * Math.PI) * 0.45 * size, (r() - 0.5) * 0.7 * size);
    p.scale.y = 0.7;
    g.add(p);
  }
  return g;
}

/** A soft glow of their own for merged clouds (they stay white in the shade). */
function tintMerged(g: THREE.Group, color: THREE.ColorRepresentation) {
  for (const o of g.children) {
    const m = (o as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined;
    if (m?.isMeshLambertMaterial) m.emissive = new THREE.Color(color);
  }
}

function sunInSky(g: THREE.Group, id: BodyId) {
  const size = SUN_SIZE[id];
  const at = SUN_DIR.clone().multiplyScalar(150);
  const halo = glow(id === 'venus' ? '#ffe7a8' : '#ffd27a', size, id === 'venus' ? 0.35 : 0.55);
  const core = glow('#fffbe8', size * 0.32, id === 'venus' ? 0.4 : 1);
  for (const s of [halo, core]) {
    (s.material as THREE.SpriteMaterial).fog = false;
    s.position.copy(at);
    g.add(s);
  }
}

export function buildStage(id: BodyId, lowPower: boolean): Stage {
  const group = new THREE.Group();
  const r = rng(id.length * 97 + 5);
  const anims: ((dt: number, t: number) => void)[] = [];
  const base = {
    id,
    group,
    rocketSpot: new THREE.Vector3(-2.5, 0, 0),
    alienSpot: new THREE.Vector3(2.4, 0, 0.2),
    gravity: 1,
    update: (dt: number, t: number) => anims.forEach((f) => f(dt, t)),
  };
  sunInSky(group, id);

  // ── Rocky worlds and the Moon ──
  if (BODY[id].kind === 'rocky' || id === 'moon') {
    const cfg: Record<string, { ground: GroundOpts; rocks: string[]; sky: Stage['sky']; fog: Stage['fog']; hemi: Stage['hemi']; key: Stage['key']; dust: string }> = {
      mercury: {
        ground: { seed: 1, curve: 60, low: '#77716b', high: '#b5aea6', accent: '#5f5a55', craters: 26, bump: 0.5 },
        rocks: ['#8a847d', '#a19a92'],
        sky: { top: '#02030a', bottom: '#0d0f22', stars: 1 },
        fog: null,
        hemi: { sky: '#c9c4d8', ground: '#4a4440', intensity: 0.7 },
        key: { color: '#fff4dc', intensity: 3.0 },
        dust: '#b5aea6',
      },
      venus: {
        ground: { seed: 2, curve: 110, low: '#a8642c', high: '#d9a04e', accent: '#8a4f22', craters: 4, bump: 0.7 },
        rocks: ['#9c5a28', '#c28040'],
        sky: { top: '#c98a35', bottom: '#f6d58c', stars: 0 },
        fog: { color: '#eec27a', near: 9, far: 55 },
        hemi: { sky: '#ffe2a6', ground: '#8a5426', intensity: 1.1 },
        key: { color: '#ffe0a0', intensity: 1.6 },
        dust: '#e0b060',
      },
      earth: {
        ground: { seed: 3, curve: 160, low: '#4f9e3f', high: '#86c95a', accent: '#3d8a33', craters: 0, bump: 0.6 },
        rocks: ['#9aa1ad', '#b7bcc6'],
        sky: { top: '#4aa3f0', bottom: '#d6efff', stars: 0 },
        fog: { color: '#cfe8fb', near: 30, far: 95 },
        hemi: { sky: '#d6ecff', ground: '#6f9a4a', intensity: 1.25 },
        key: { color: '#fff1d6', intensity: 2.2 },
        dust: '#cfe9b8',
      },
      moon: {
        ground: { seed: 4, curve: 50, low: '#85858f', high: '#c2c2ca', accent: '#696973', craters: 30, bump: 0.4 },
        rocks: ['#a9a9b2', '#c4c4cc'],
        sky: { top: '#02030a', bottom: '#0b0e24', stars: 1 },
        fog: null,
        hemi: { sky: '#cfd2ea', ground: '#55555e', intensity: 0.7 },
        key: { color: '#ffffff', intensity: 2.1 },
        dust: '#e2e2e8',
      },
      mars: {
        ground: { seed: 5, curve: 90, low: '#a94a2a', high: '#dc8350', accent: '#86391f', craters: 8, bump: 0.7 },
        rocks: ['#8e3a20', '#b85a34', '#6e2c18'],
        sky: { top: '#c7896a', bottom: '#f2cba3', stars: 0 },
        fog: { color: '#eebf98', near: 25, far: 85 },
        hemi: { sky: '#ffd9bd', ground: '#7a3520', intensity: 1.05 },
        key: { color: '#ffe6cc', intensity: 2.0 },
        dust: '#d98a5a',
      },
    };
    const c = cfg[id];
    const ground = makeGround({ ...c.ground, seg: lowPower ? 56 : 80 });
    group.add(ground);
    const deco = new THREE.Group();
    scatterRocks(deco, c.ground.seed * 13, lowPower ? 26 : 44, c.rocks, c.ground.curve, id === 'earth' ? 0.6 : 1);
    if (id === 'earth') {
      // Pines, round bushes and flowers.
      for (let i = 0; i < (lowPower ? 14 : 22); i++) {
        const a = -Math.PI * 0.95 + r() * Math.PI * 0.9;
        const d = 11 + r() * 22;
        const x = Math.cos(a) * d;
        const z = Math.sin(a) * d * 0.7 - 4;
        const p = makePine(1.2 + r() * 1.4, false);
        p.position.set(x, -(x * x + z * z) / 320 - 0.1, z);
        deco.add(p);
      }
      for (let i = 0; i < 16; i++) {
        const x = (r() - 0.5) * 30;
        const z = -4 - r() * 14;
        if (Math.abs(x) < 6) continue;
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 + r() * 0.6, 1), mat(r() < 0.5 ? '#3f8a3a' : '#5aa845'));
        b.position.set(x, 0.2 - (x * x + z * z) / 320, z);
        b.scale.y = 0.75;
        b.castShadow = true;
        deco.add(b);
      }
      const petals = ['#ff7ab8', '#ffd166', '#ffffff', '#b38cff'];
      for (let i = 0; i < (lowPower ? 40 : 80); i++) {
        const x = (r() - 0.5) * 22;
        const z = -6 + r() * 11;
        if (Math.abs(x) < 4.6 && z > -2.5) continue;
        const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), mat(petals[i % petals.length]));
        f.position.set(x, 0.08 - (x * x + z * z) / 320, z);
        deco.add(f);
      }
    }
    if (id === 'mars') {
      // Far away, a giant flat volcano.
      const v = new THREE.Mesh(new THREE.CylinderGeometry(6, 30, 7, 14, 1), mat('#b9603a'));
      v.position.set(18, -9, -62);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 6, 0.8, 14), mat('#93452a'));
      top.position.set(18, -5.2, -62);
      deco.add(v, top);
    }
    // The foreground: pebbles everywhere, flowers and grass on the Earth.
    for (let i = 0; i < (lowPower ? 18 : 34); i++) {
      const x = (r() - 0.5) * 18;
      const z = 3 + r() * 9;
      const s = 0.08 + r() * 0.18;
      const p = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat(c.rocks[i % c.rocks.length]));
      p.position.set(x, -(x * x + z * z) / (2 * c.ground.curve) + s * 0.2, z);
      p.rotation.set(r() * 3, r() * 3, r() * 3);
      deco.add(p);
    }
    if (id === 'earth') {
      const petals = ['#ff7ab8', '#ffd166', '#ffffff', '#b38cff', '#ff8a3d'];
      for (let i = 0; i < (lowPower ? 26 : 50); i++) {
        const x = (r() - 0.5) * 16;
        const z = 2.6 + r() * 8;
        const y = -(x * x + z * z) / 320;
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.4, 4), mat(r() < 0.5 ? '#3f8a3a' : '#5aa845'));
        tuft.position.set(x, y + 0.18, z);
        tuft.rotation.z = (r() - 0.5) * 0.6;
        deco.add(tuft);
        if (i % 2) {
          const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), mat(petals[i % petals.length]));
          f.position.set(x + 0.15, y + 0.36, z);
          const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), mat('#ffd166'));
          heart.position.set(x + 0.15, y + 0.38, z + 0.08);
          deco.add(f, heart);
        }
      }
    }
    mergeStatic(deco, { shadows: true });
    group.add(deco);
    if (id === 'moon') {
      // The Earth, blue and white, in the black sky.
      const earth = makeSkyBody('earth', 6, lowPower);
      earth.position.set(24, 9.5, -88);
      earth.rotation.z = 0.4;
      const halo = glow('#7fc4ff', 22, 0.45);
      (halo.material as THREE.SpriteMaterial).fog = false;
      halo.position.copy(earth.position);
      group.add(halo, earth);
      anims.push((dt) => (earth.rotation.y += dt * 0.05));
    }
    if (id === 'earth') {
      // Fluffy clouds drifting.
      const clouds = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const cl = cloudCluster(r, '#ffffff', 2.2 + r() * 1.5);
        cl.position.set(-60 + i * 22 + r() * 8, 16 + r() * 10, -60 - r() * 25);
        clouds.add(cl);
      }
      mergeStatic(clouds);
      tintMerged(clouds, '#8a9ab8');
      group.add(clouds);
      anims.push((dt) => (clouds.position.x = ((clouds.position.x + dt * 0.6 + 30) % 60) - 30));
    }
    if (id === 'mars') {
      const phobos = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2, 1), new THREE.MeshLambertMaterial({ color: '#8a7d70', flatShading: true }));
      phobos.scale.set(1.3, 0.9, 1);
      phobos.position.set(30, 38, -110);
      group.add(phobos);
    }
    return { ...base, kind: 'ground', sky: c.sky, fog: c.fog, hemi: c.hemi, key: c.key, gravity: id === 'moon' ? 0.17 : id === 'mercury' || id === 'mars' ? 0.38 : id === 'earth' ? 1 : 0.9, dust: c.dust };
  }

  // ── Saturn: we deliver on the icy rings ──
  if (id === 'saturn') {
    const count = lowPower ? 260 : 520;
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const chunks = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ flatShading: true }), count);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const tints = ['#f4f8ff', '#dfe8f5', '#e9dcc4', '#cfd9ea', '#ffffff'];
    let k = 0;
    while (k < count) {
      const x = (r() - 0.5) * 150;
      const z = -r() * 110 + 14;
      if (Math.abs(x) < 6 && z > -3.5) continue;
      const s = 0.25 + r() * r() * 1.6;
      dummy.position.set(x, -0.9 + (r() - 0.5) * 0.7 - (x * x + z * z) / 2400, z);
      dummy.rotation.set(r() * 3, r() * 3, r() * 3);
      dummy.scale.set(s, s * (0.6 + r() * 0.5), s);
      dummy.updateMatrix();
      chunks.setMatrixAt(k, dummy.matrix);
      chunks.setColorAt(k, col.set(tints[k % tints.length]));
      k++;
    }
    chunks.receiveShadow = true;
    group.add(chunks);
    // Two big ice blocks: one for the inhabitant, one for the rocket.
    const blocks = new THREE.Group();
    for (const [x, z, s] of [
      [2.4, 0.2, 1.5],
      [-2.5, 0, 1.8],
    ] as const) {
      const b = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 1), mat('#eaf2ff'));
      b.scale.set(1.2, 0.42, 1.0);
      b.position.set(x, -s * 0.42, z);
      b.castShadow = true;
      blocks.add(b);
    }
    mergeStatic(blocks, { shadows: true });
    group.add(blocks);
    // Saturn itself, huge in the sky, lit from the side.
    const saturn = new THREE.Mesh(new THREE.SphereGeometry(48, 48, 32), new THREE.MeshLambertMaterial({ map: planetMap('saturn', lowPower) }));
    saturn.position.set(-20, -6, -150);
    saturn.rotation.z = 0.12;
    group.add(saturn);
    anims.push((dt) => (saturn.rotation.y += dt * 0.02));
    return {
      ...base,
      kind: 'ring',
      sky: { top: '#02030a', bottom: '#141a3a', stars: 1 },
      fog: { color: '#141a3a', near: 40, far: 190 },
      hemi: { sky: '#dfe6ff', ground: '#3a3f66', intensity: 0.9 },
      key: { color: '#fff4dc', intensity: 2.2 },
      dust: '#ffffff',
      gravity: 0.9,
    };
  }

  // ── Jupiter, Uranus, Neptune: no ground, a deck of clouds above the giant ──
  const tint: Record<string, { sky: Stage['sky']; fog: Stage['fog']; cloud: string[]; hemi: Stage['hemi'] }> = {
    jupiter: { sky: { top: '#1a1640', bottom: '#e9c49a', stars: 0.6 }, fog: { color: '#e2bd92', near: 45, far: 210 }, cloud: ['#f6e3c4', '#f1d2a8', '#ffffff'], hemi: { sky: '#ffe8cc', ground: '#a8703f', intensity: 1.1 } },
    uranus: { sky: { top: '#0b2a40', bottom: '#a6ecef', stars: 0.6 }, fog: { color: '#a6e6ea', near: 45, far: 210 }, cloud: ['#dffafb', '#c5f1f3', '#ffffff'], hemi: { sky: '#e0fbff', ground: '#4fa6ae', intensity: 1.15 } },
    neptune: { sky: { top: '#0a1450', bottom: '#6a8cf2', stars: 0.7 }, fog: { color: '#6a8cf2', near: 45, far: 210 }, cloud: ['#dbe6ff', '#b9ccff', '#ffffff'], hemi: { sky: '#dfe8ff', ground: '#2a4bbd', intensity: 1.15 } },
  };
  const tt = tint[id];
  const deckTex = planetMap(id, lowPower);
  deckTex.repeat.set(5, 3);
  deckTex.wrapT = THREE.RepeatWrapping;
  const deck = new THREE.Mesh(new THREE.SphereGeometry(180, 64, 32), new THREE.MeshLambertMaterial({ map: deckTex }));
  deck.position.y = -194;
  group.add(deck);
  anims.push((dt) => (deck.rotation.y += dt * 0.004));
  // Clouds all around, and two big fluffy ones for the inhabitant and the rocket.
  const clouds = new THREE.Group();
  for (let i = 0; i < (lowPower ? 16 : 28); i++) {
    const a = r() * Math.PI * 2;
    const d = 9 + r() * 55;
    const cl = cloudCluster(r, tt.cloud[i % tt.cloud.length], 1.4 + r() * 2.2);
    cl.position.set(Math.cos(a) * d, -3.5 - r() * 7, Math.sin(a) * d * 0.8 - 10);
    clouds.add(cl);
  }
  mergeStatic(clouds);
  group.add(clouds);
  anims.push((dt, t) => (clouds.position.x = Math.sin(t * 0.05) * 2));
  const pads = new THREE.Group();
  for (const [x, z, s] of [
    [2.4, 0.2, 1.05],
    [-2.5, 0.2, 1.2],
  ] as const) {
    const cl = cloudCluster(r, '#ffffff', s, 6);
    cl.position.set(x, -0.95 * s, z);
    pads.add(cl);
  }
  mergeStatic(pads, { shadows: true });
  tintMerged(pads, new THREE.Color(tt.cloud[1]).multiplyScalar(0.25));
  group.add(pads);
  anims.push((_, t) => (pads.position.y = Math.sin(t * 1.1) * 0.08));
  if (id === 'uranus' || id === 'neptune') {
    // Faint rings across the sky (Uranus's stand almost upright: the planet lies on its side).
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(70, 73, 96, 1),
      new THREE.MeshBasicMaterial({ color: id === 'uranus' ? '#e9fbff' : '#c9d6ff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, fog: false, depthWrite: false })
    );
    ring.position.set(10, -30, -120);
    ring.rotation.set(id === 'uranus' ? 0.15 : 1.25, 0.35, 0.2);
    group.add(ring);
  }
  if (id === 'jupiter') {
    const io = makeSkyBody('venus', 3, lowPower);
    io.position.set(40, 45, -120);
    group.add(io);
  }
  return {
    ...base,
    kind: 'cloud',
    sky: tt.sky,
    fog: tt.fog,
    hemi: tt.hemi,
    key: { color: '#fff1d6', intensity: 2.0 },
    dust: '#ffffff',
    gravity: 0.9,
  };
}
