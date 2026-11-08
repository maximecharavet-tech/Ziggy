import * as THREE from 'three';
import { glow, glowTex } from '../kit/look';
import { makeGift, makeNightSky, type ZiggyActor } from '../kit/models';
import { makeSnowGround, Puffs, Snowfall } from '../kit/world';
import type { BoothSceneId } from '@/lib/santa/types';
import { fitDistance, slotBox, wideness } from './framing';
import {
  animateFire,
  animateReindeer,
  makeAurora,
  makeBlock,
  makeCabin,
  makeCandyCane,
  makeDrum,
  makeElfZiggy,
  makeFireplace,
  makeLightString,
  makePineBulbs,
  makeReindeer,
  makeShelf,
  makeSleigh,
  makeSoftPine,
  makeSoftSnowman,
  makeSparkles,
  makeStocking,
  makeTeddy,
  makeTrain,
  shadowed,
  soft,
  twinkleBulbs,
  type Aurora,
  type Cabin,
  type Fireplace,
  type Reindeer,
} from './props';
import type { SantaPose } from './santa';
import { nightWindowTexture, planksTexture, scrollTexture, wallpaperTexture } from './textures';

/**
 * The three kinds of Santa scenes. A stage owns its props, lights and
 * camera framing; the mount (index.ts) owns the renderer, Santa and the loop.
 */

export interface StageContext {
  lowPower: boolean;
  /** 1 = full motion, about 0.4 with reduced motion. */
  energy: number;
}

export interface Framing {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

export interface Stage {
  root: THREE.Group;
  santa: { pos: THREE.Vector3; rotY: number; pose: SantaPose; side: 1 | -1; rest?: 'belly' | 'desk' };
  background: THREE.Color;
  fog: THREE.Fog | null;
  /** Camera for a screen aspect (width / height). */
  frame(aspect: number): Framing;
  /** Gentle camera drift amplitude (0 = fixed camera). */
  drift: number;
  update(dt: number, t: number, camera: THREE.PerspectiveCamera): void;
  /** Booth only: the child's place, a rectangle on the plane z = slot.z (world units). */
  slot?: { x0: number; x1: number; y0: number; y1: number; z: number };
  /** Bloom settings when post-processing runs (capable devices). */
  bloom: { strength: number; radius: number; threshold: number };
  ziggies: ZiggyActor[];
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function addShadowSun(root: THREE.Group, light: THREE.DirectionalLight, target: THREE.Vector3, half: number, low: boolean) {
  light.castShadow = true;
  const size = low ? 1024 : 2048;
  light.shadow.mapSize.set(size, size);
  Object.assign(light.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 0.5, far: 60 });
  light.shadow.bias = -0.0004;
  light.shadow.normalBias = 0.03;
  light.target.position.copy(target);
  root.add(light, light.target);
}

/** A soft warm light from the camera side, so Santa's white fur stays white indoors. */
function frontFill(root: THREE.Group, intensity = 0.8, at = V(0, 1.4, 0)) {
  const f = new THREE.DirectionalLight('#fff1e0', intensity);
  f.position.set(at.x + 2, at.y + 1.5, at.z + 8);
  f.target.position.copy(at);
  root.add(f, f.target);
}

/** A soft round shadow blob on the ground (cheaper and softer than a map for small things). */
function contactShadow(r: number, opacity = 0.35): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(20,20,50,${opacity})`);
  grad.addColorStop(1, 'rgba(20,20,50,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.01;
  return m;
}

// ---------------------------------------------------------------------------
// Village (hub hero)

export function buildVillage(ctx: StageContext): Stage {
  const low = ctx.lowPower;
  const root = new THREE.Group();
  const ziggies: ZiggyActor[] = [];

  root.add(makeNightSky());
  const aurora = makeAurora({ radius: 46, y: 10, lowPower: low, opacity: 0.95 });
  aurora.position.z = -10;
  root.add(aurora);
  const ground = makeSnowGround(150, 16);
  root.add(ground);

  // Lights: moonlight, sky, the warm door, and a soft warm key on Santa.
  root.add(new THREE.HemisphereLight('#9fb3ff', '#2c2550', 0.75));
  const moon = new THREE.DirectionalLight('#c4d0ff', 1.0);
  moon.position.set(-9, 15, 9);
  addShadowSun(root, moon, V(0, 0, -1), 11, low);
  const key = new THREE.DirectionalLight('#ffe0bd', 0.9);
  key.position.set(4, 5, 9);
  key.target.position.set(0, 1.4, 0);
  root.add(key, key.target);
  const doorLight = new THREE.PointLight('#ffb35c', 14, 10, 1.6);
  doorLight.position.set(0, 1.8, -0.9);
  root.add(doorLight);

  // Santa's cabin.
  const cabin: Cabin = makeCabin(low);
  cabin.scale.setScalar(1.3);
  cabin.position.set(0, 0, -3.6);
  root.add(cabin);
  const smoke = new Puffs(glowTex());
  root.add(smoke.group);
  const chimney = cabin.userData.chimney.clone().multiplyScalar(1.3).add(cabin.position);


  // The sleigh and the reindeer, on the left.
  const sleigh = makeSleigh({ lowPower: low });
  sleigh.position.set(-3.8, 0, -0.5);
  sleigh.rotation.y = -0.85;
  root.add(sleigh, contactShadow(1.8, 0.3).translateX(-3.8).translateZ(-0.5));
  const deer: Reindeer[] = [];
  const deerSpots: [number, number, number, boolean][] = [
    [-5.5, 0.9, 0.55, false],
    [-4.4, 2.0, 0.35, true],
  ];
  if (!low) deerSpots.push([-6.4, -0.6, 0.7, false]);
  deerSpots.forEach(([x, z, ry, nose], i) => {
    const r = makeReindeer({ lowPower: low, glowNose: nose, seed: i + 2, color: i === 2 ? '#94603a' : undefined });
    r.position.set(x, 0, z);
    r.rotation.y = ry;
    r.scale.setScalar(1.15);
    deer.push(r);
    root.add(r);
  });

  // Ziggy the elf, gifts and candy canes, on the right.
  const ziggy = makeElfZiggy(low);
  ziggy.scale.setScalar(0.55);
  ziggy.position.set(2.5, 0, 0.4);
  ziggy.rotation.y = -0.45;
  ziggy.userData.rig.idle = 'calm';
  ziggy.userData.rig.energy = ctx.energy;
  ziggies.push(ziggy);
  root.add(ziggy);
  const giftCols = ['#3f7fe0', '#ffcc33', '#3fbf6a', '#9b6be8', '#ff7ab8', '#e2453c'];
  const giftSpots: [number, number, number, number][] = [
    [3.3, 0, -0.3, 0.6],
    [3.9, 0, 0.3, 0.48],
    [3.5, 0.6, -0.25, 0.4],
    [4.3, 0, -0.5, 0.55],
    [3.0, 0, 0.5, 0.36],
  ];
  giftSpots.forEach(([x, y, z, s], i) => {
    const gift = makeGift(giftCols[i % giftCols.length], undefined, s);
    gift.position.set(x, y, z);
    gift.rotation.y = i * 0.7;
    root.add(shadowed(gift));
  });
  for (const [x, z, ry] of [
    [-1.25, 0.2, 0.3],
    [1.25, 0.2, -0.3],
    [-1.4, 1.6, 0.4],
    [1.4, 1.6, -0.4],
  ]) {
    const cane = makeCandyCane(0.85);
    cane.position.set(x, 0, z);
    cane.rotation.y = ry + (x < 0 ? Math.PI : 0);
    root.add(cane);
  }

  // Pines all around, a snowman.
  const pines: [number, number, number][] = [
    [-7.5, -5, 1.5],
    [7, -5.5, 1.6],
    [-9.5, -1.5, 1.3],
    [9.5, -1.0, 1.4],
    [5.2, -8.5, 1.8],
    [-4.0, -9.5, 1.9],
    [0.5, -11, 2.0],
    [-11, -7, 1.7],
    [11.5, -7.5, 1.7],
    [-6.0, 4.5, 1.1],
    [7.0, 3.5, 1.2],
  ];
  pines.slice(0, low ? 8 : pines.length).forEach(([x, z, s], i) => {
    const p = makeSoftPine(s, i + 3, low);
    p.position.set(x, 0, z);
    root.add(p);
  });
  const snowman = makeSoftSnowman(low);
  snowman.position.set(5.4, 0, -2.4);
  snowman.rotation.y = -0.5;
  root.add(snowman);

  const snow = new Snowfall(low ? 350 : 1100, 22, 14);
  root.add(snow.points);
  const sparkles = makeSparkles(low ? 30 : 70, new THREE.Box3(V(-7, 0.3, -3), V(7, 5, 3)), '#fff2c4', 0.14);
  root.add(sparkles);

  let smokeT = 0;
  const center = V(0, 0, 0);
  return {
    root,
    ziggies,
    santa: { pos: V(0, 0, -0.25), rotY: 0, pose: 'wave', side: 1 },
    background: new THREE.Color('#141c48'),
    fog: new THREE.Fog('#1c2657', 26, 95),
    drift: ctx.energy,
    bloom: { strength: 0.5, radius: 0.5, threshold: 1.4 },
    frame(aspect) {
      // Wide screens see the whole yard; portrait keeps Santa, the door and the sky.
      const k = wideness(aspect);
      // Santa stands a little above the middle of the picture: the hub page
      // lays its title over the lower part.
      // The hub page lays its title over the lower half: Santa stands in the
      // upper part of the picture (about a third from the top on a phone).
      const fov = lerp(46, 38, k);
      const w = lerp(5.8, 13.8, k);
      const h = lerp(8.2, 7.4, k);
      const target = V(lerp(0, -0.5, k), lerp(-0.25, 1.35, k), -1.2);
      const d = fitDistance(w, h, fov, aspect);
      const dir = V(0, lerp(0.08, 0.1, k), 1).normalize();
      return { pos: target.clone().addScaledVector(dir, d), target, fov };
    },
    update(dt, t, camera) {
      for (const m of aurora.userData.mats) m.uniforms.uTime.value = t * (0.4 + 0.6 * ctx.energy);
      twinkleBulbs(cabin.userData.bulbs, t, ctx.energy);
      deer.forEach((r) => animateReindeer(r, t, ctx.energy));
      ziggy.userData.rig.update(dt);
      center.set(camera.position.x, 0, camera.position.z - 13);
      snow.update(dt * (0.5 + 0.5 * ctx.energy), t, center);
      sparkles.rotation.y = Math.sin(t * 0.05) * 0.1;
      (sparkles.material as THREE.PointsMaterial).opacity = 0.6 + 0.3 * Math.sin(t * 1.3);
      smokeT -= dt;
      if (smokeT <= 0) {
        smokeT = low ? 0.9 : 0.5;
        smoke.emit(chimney, { count: 1, color: '#c9d2f0', size: 0.9, up: 0.9, spread: 0.4, life: 3.2 });
      }
      smoke.update(dt);
    },
  };
}

// ---------------------------------------------------------------------------
// Call: Santa's cosy office

export function buildOffice(ctx: StageContext): Stage {
  const low = ctx.lowPower;
  const root = new THREE.Group();
  const ziggies: ZiggyActor[] = [];
  const LIFT = 0.12;

  // Back wall with a window (a hole), wallpaper above and wood below.
  const wallZ = -1.6;
  const wp = wallpaperTexture();
  wp.repeat.set(0.45, 0.45);
  const wall = new THREE.Shape();
  wall.moveTo(-6, 0);
  wall.lineTo(6, 0);
  wall.lineTo(6, 5);
  wall.lineTo(-6, 5);
  wall.closePath();
  const win = { x: 1.55, y: 2.15, w: 1.2, h: 1.4 };
  const hole = new THREE.Path();
  hole.moveTo(win.x - win.w / 2, win.y - win.h / 2);
  hole.lineTo(win.x + win.w / 2, win.y - win.h / 2);
  hole.lineTo(win.x + win.w / 2, win.y + win.h / 2);
  hole.lineTo(win.x - win.w / 2, win.y + win.h / 2);
  hole.closePath();
  wall.holes.push(hole);
  const wallMesh = new THREE.Mesh(new THREE.ShapeGeometry(wall), new THREE.MeshStandardMaterial({ map: wp, roughness: 0.95 }));
  wallMesh.position.z = wallZ;
  wallMesh.receiveShadow = true;
  root.add(wallMesh);
  const wains = planksTexture('#7a4a2a', 8);
  wains.repeat.set(4, 1);
  const wainscot = new THREE.Mesh(new THREE.BoxGeometry(12, 1.1, 0.06), new THREE.MeshStandardMaterial({ map: wains, roughness: 0.85 }));
  wainscot.position.set(0, 0.55, wallZ + 0.03);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(12, 0.08, 0.1), soft('#5e3418'));
  rail.position.set(0, 1.12, wallZ + 0.05);
  root.add(wainscot, rail);
  // Window: frame, mullions, snowy night outside with falling snow.
  const night = new THREE.Mesh(new THREE.PlaneGeometry(win.w * 1.6, win.h * 1.4), new THREE.MeshBasicMaterial({ map: nightWindowTexture() }));
  night.position.set(win.x, win.y, wallZ - 0.45);
  root.add(night);
  const trim = soft('#f3ead8');
  for (const [w, h, x, y] of [
    [win.w + 0.2, 0.12, 0, win.h / 2 + 0.04],
    [win.w + 0.3, 0.14, 0, -win.h / 2 - 0.05],
    [0.12, win.h + 0.1, -win.w / 2 - 0.04, 0],
    [0.12, win.h + 0.1, win.w / 2 + 0.04, 0],
    [0.05, win.h, 0, 0],
    [win.w, 0.05, 0, 0.1],
  ]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), trim);
    bar.position.set(win.x + x, win.y + y, wallZ + 0.02);
    root.add(bar);
  }
  const winSnow = new Snowfall(low ? 40 : 90, 1.4, win.h + 0.4);
  winSnow.points.position.set(win.x, win.y - win.h / 2 - 0.2, wallZ - 0.22);
  winSnow.points.scale.set(1, 1, 0.25);
  (winSnow.points.material as THREE.PointsMaterial).size = 0.06;
  root.add(winSnow.points);
  // Floor.
  const floorTex = planksTexture('#8a5530', 6);
  floorTex.repeat.set(4, 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  // The fireplace behind Santa's right (its mantel and stockings show above
  // the desk), a toy shelf above it, a toy shelf and a little tree on the right.
  const fire: Fireplace = makeFireplace(low, true);
  fire.position.set(-1.75, 0, wallZ + 0.72);
  root.add(fire);
  ['#e2453c', '#3fbf6a', '#3f7fe0', '#ffcc33'].forEach((c, i) => {
    const st = makeStocking(c, low);
    st.position.set(-0.85 + i * 0.55, fire.userData.mantelY - 0.05, 0.12);
    fire.add(st);
  });
  const garland = makeLightString(V(-1.3, 0, 0), V(1.3, 0, 0), 12, 0.1, 0.04);
  garland.position.set(0, fire.userData.mantelY + 0.05, 0.22);
  fire.add(garland);
  const put = (o: THREE.Object3D, x: number, y: number, ry = 0, z = wallZ + 0.22) => {
    o.position.set(x, y + 0.04, z);
    o.rotation.y = ry;
    root.add(shadowed(o));
  };
  // On the mantel.
  const mz = wallZ + 0.72 - 0.25;
  put(makeTeddy('#c48a55', low), -2.6, fire.userData.mantelY - 0.04, 0.3, mz);
  put(makeBlock('#ff8a3d', 0.2), -1.0, fire.userData.mantelY - 0.04, 0.3, mz);
  put(makeBlock('#3fbf6a', 0.16), -0.95, fire.userData.mantelY + 0.16, -0.2, mz);
  // Shelves.
  const shelfL = makeShelf(2.2);
  shelfL.position.set(-1.75, 2.65, wallZ + 0.2);
  root.add(shelfL);
  put(makeTrain(), -2.45, 2.65, 0.6);
  put(makeDrum(), -1.85, 2.65);
  put(makeGift('#9b6be8', undefined, 0.3), -1.25, 2.65, 0.3);
  put(makeTeddy('#e7d1b0', low), -0.85, 2.65, -0.3);
  const shelfR = makeShelf(1.3);
  shelfR.position.set(1.55, 3.15, wallZ + 0.2);
  root.add(shelfR);
  put(makeBlock('#3f7fe0'), 1.1, 3.15, 0.2);
  put(makeGift('#ffcc33', undefined, 0.3), 1.6, 3.15, -0.2);
  put(makeDrum(), 2.05, 3.15);
  const tree = makeSoftPine(0.75, 7, low);
  tree.position.set(2.75, 0, -0.95);
  root.add(tree);
  const tb = makePineBulbs(0.75, 18);
  tb.position.copy(tree.position);
  root.add(tb);
  const treeLights: THREE.Mesh[] = [...garland.userData.bulbs, ...tb.userData.bulbs];

  // The desk, with the "nice things" scroll, a candle, cocoa and cookies.
  const deskTop = 0.98 + LIFT * 0;
  const deskTex = planksTexture('#7a4524', 5);
  deskTex.repeat.set(2, 1);
  const deskMat = new THREE.MeshStandardMaterial({ map: deskTex, roughness: 0.7 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 0.9), deskMat);
  top.position.set(0, deskTop - 0.05, 0.98);
  const front = new THREE.Mesh(new THREE.BoxGeometry(2.7, deskTop - 0.1, 0.08), deskMat);
  front.position.set(0, (deskTop - 0.1) / 2, 1.38);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(2.86, 0.05, 0.96), soft('#5e3418'));
  edge.position.set(0, deskTop - 0.1, 0.98);
  root.add(shadowed(top), shadowed(front), edge);
  // Front panel decoration: a gold star.
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.07 : 0.17;
    if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const starMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(star, { depth: 0.02, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color: '#f0bd45', metalness: 0.7, roughness: 0.3, emissive: '#6a4400', emissiveIntensity: 0.4 }));
  starMesh.position.set(0, 0.55, 1.43);
  root.add(starMesh);
  // The unrolled scroll on the desk.
  const scrollTex = scrollTexture();
  const paperGeo = new THREE.PlaneGeometry(0.62, 0.8, 1, 8);
  const pp = paperGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pp.count; i++) pp.setZ(i, Math.max(0, pp.getY(i) + 0.25) * 0.15);
  paperGeo.computeVertexNormals();
  const paper = new THREE.Mesh(paperGeo, new THREE.MeshStandardMaterial({ map: scrollTex, roughness: 0.9, side: THREE.DoubleSide }));
  paper.rotation.set(-Math.PI / 2 + 0.05, 0, 0.25);
  paper.position.set(-0.85, deskTop + 0.01, 1.0);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.66, 12), soft('#f1dca8'));
  roll.rotation.set(0, 0.25, Math.PI / 2);
  roll.position.set(-0.85 - 0.1, deskTop + 0.05, 0.62);
  root.add(paper, shadowed(roll));
  // Candle with a warm flame.
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 12), soft('#fff3e0'));
  candle.position.set(0.95, deskTop + 0.11, 0.85);
  const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.03, 16), new THREE.MeshStandardMaterial({ color: '#f0bd45', metalness: 0.7, roughness: 0.3 }));
  holder.position.set(0.95, deskTop + 0.015, 0.85);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(2.6), toneMapped: false }));
  flame.scale.set(1, 1.8, 1);
  flame.position.set(0.95, deskTop + 0.27, 0.85);
  const flameGlow = glow('#ffb347', 0.6, 0.7);
  flameGlow.position.copy(flame.position);
  const candleLight = new THREE.PointLight('#ffb35c', 1.6, 3, 1.5);
  candleLight.position.set(0.95, deskTop + 0.4, 0.9);
  root.add(shadowed(candle), holder, flame, flameGlow, candleLight);
  // Cocoa mug and cookies.
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.15, 16), soft('#e2453c', { roughness: 0.4 }));
  mug.position.set(0.55, deskTop + 0.075, 1.15);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 12), soft('#e2453c', { roughness: 0.4 }));
  handle.position.set(0.635, deskTop + 0.08, 1.15);
  const cocoa = new THREE.Mesh(new THREE.CircleGeometry(0.065, 16), soft('#6b3a1f'));
  cocoa.rotation.x = -Math.PI / 2;
  cocoa.position.set(0.55, deskTop + 0.14, 1.15);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.02, 20), soft('#ffffff', { roughness: 0.3 }));
  plate.position.set(0.25, deskTop + 0.01, 1.2);
  root.add(shadowed(mug), handle, cocoa, shadowed(plate));
  for (let i = 0; i < 3; i++) {
    const cookie = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.018, 12), soft('#c98a4b'));
    cookie.position.set(0.2 + i * 0.05, deskTop + 0.03 + i * 0.012, 1.18 + (i % 2) * 0.04);
    cookie.rotation.z = (i - 1) * 0.15;
    root.add(cookie);
  }

  // Lights: warm key, warm fill from the fire, cool rim from the window.
  root.add(new THREE.HemisphereLight('#ffe6cc', '#3a2418', 0.5));
  const key = new THREE.DirectionalLight('#ffe3c4', 1.25);
  key.position.set(-2.5, 4.5, 5);
  addShadowSun(root, key, V(0, 1.4, 0), 4, low);
  const rim = new THREE.DirectionalLight('#9fb8ff', 0.9);
  rim.position.set(3, 3, -3);
  rim.target.position.set(0, 1.6, 0);
  root.add(rim, rim.target);
  const fill = new THREE.PointLight('#ffb070', 1.2, 6, 1.5);
  fill.position.set(0, 2.2, 2.2);
  root.add(fill);
  frontFill(root, 0.45, V(0, 1.7, 0));

  // Ziggy peeks in from the side now and then.
  const ziggy = makeElfZiggy(low);
  ziggy.scale.setScalar(0.62);
  ziggy.userData.rig.energy = ctx.energy;
  ziggies.push(ziggy);
  root.add(ziggy);
  const peek = { t: 6, phase: 0, x: 10, waved: false };

  let camHalfW = 2;
  return {
    root,
    ziggies,
    santa: { pos: V(0, LIFT, 0), rotY: 0, pose: 'idle', side: 1, rest: 'desk' },
    background: new THREE.Color('#2a1416'),
    fog: null,
    drift: 0.35 * ctx.energy,
    bloom: { strength: 0.35, radius: 0.45, threshold: 2.0 },
    frame(aspect) {
      // Chest-up, centred: the head sits a little above the middle.
      const k = wideness(aspect);
      const fov = 30;
      const headY = 1.8 + LIFT;
      // Portrait crops the arms a little so the face stays big.
      const w = lerp(1.35, 2.1, k);
      const hMin = 2.0;
      const d = fitDistance(w, hMin, fov, aspect);
      const hv = 2 * d * Math.tan((fov * Math.PI) / 360);
      camHalfW = (hv * aspect) / 2;
      const cy = headY - lerp(0.17, 0.1, k) * hv;
      const target = V(0, cy, 0.3);
      return { pos: V(0, cy + 0.08, 0.3 + d), target, fov };
    },
    update(dt, t) {
      animateFire(fire, t, ctx.energy);
      twinkleBulbs(treeLights, t, ctx.energy);
      winSnow.update(dt, t, V(0, 0, 0));
      flameGlow.material.opacity = 0.6 + Math.sin(t * 11) * 0.06 + Math.sin(t * 7) * 0.05;
      // Peek: slide in behind the desk's right end, wave, slide out.
      peek.t -= dt;
      const outX = Math.max(1.6, camHalfW + 0.7);
      const inX = Math.max(0.95, Math.min(1.55, camHalfW - 0.35));
      if (peek.phase === 0 && peek.t <= 0) {
        peek.phase = 1;
        peek.t = 6;
        peek.waved = false;
      }
      let want = outX;
      if (peek.phase === 1) {
        want = inX;
        if (!peek.waved && Math.abs(peek.x - inX) < 0.08) {
          peek.waved = true;
          ziggy.userData.rig.cue('wave');
        }
        if (peek.t <= 0) {
          peek.phase = 0;
          peek.t = 14 + Math.random() * 6;
        }
      }
      if (peek.x > outX + 0.5) peek.x = outX;
      peek.x += (want - peek.x) * Math.min(1, dt * 2.2);
      ziggy.position.set(peek.x, 0.12, 0.62);
      ziggy.rotation.y = -0.55;
      ziggy.userData.rig.walk = Math.min(1, Math.abs(want - peek.x) * 2);
      ziggy.userData.rig.lookAt(-0.6, 0.1);
      ziggy.visible = peek.x < outX - 0.02;
      ziggy.userData.rig.update(dt);
    },
  };
}

// ---------------------------------------------------------------------------
// Booth backdrops

const SLOT = { gap: 0.55, w: 1.2, h: 1.75 };

/** Framing for a booth: Santa and the child's slot fill the picture, floor near the bottom. */
function boothFrame(santaX: number, slot: { x0: number; x1: number }, aspect: number): Framing {
  const fov = 36;
  // Room for Santa's tummy and waving arm on one side, the child on the other.
  const x0 = Math.min(santaX - 1.0, slot.x0 - 0.25);
  const x1 = Math.max(santaX + 1.0, slot.x1 + 0.25);
  const w = x1 - x0;
  const h = 2.75;
  const d = fitDistance(w, h, fov, aspect);
  const hv = 2 * d * Math.tan((fov * Math.PI) / 360);
  const cy = 0.42 * hv - 0.02;
  const cx = (x0 + x1) / 2;
  return { pos: V(cx, cy, d), target: V(cx, cy, 0), fov };
}

function boothBase(ctx: StageContext, santaX: number, side: 1 | -1, pose: SantaPose) {
  const sb = slotBox(santaX, side, SLOT.gap, SLOT.w, SLOT.h);
  return {
    santa: { pos: V(santaX, 0, 0), rotY: side * 0.18, pose, side },
    slot: { ...sb, z: 0 },
    frame: (aspect: number) => boothFrame(santaX, sb, aspect),
    drift: 0,
    ctx,
  };
}

function indoorRoom(root: THREE.Group, wallTex: THREE.Texture, floorColor: string) {
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 }));
  wall.position.set(0, 3.5, -2.6);
  wall.receiveShadow = true;
  const floorTex = planksTexture(floorColor, 6);
  floorTex.repeat.set(4, 3);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(wall, floor);
}

function buildCheminee(ctx: StageContext): Stage {
  const low = ctx.lowPower;
  const root = new THREE.Group();
  const base = boothBase(ctx, -0.55, 1, 'hug');
  const wp = wallpaperTexture();
  wp.repeat.set(5, 2.4);
  indoorRoom(root, wp, '#8a5530');
  const fire = makeFireplace(low, true);
  fire.position.set(-1.0, 0, -1.9);
  root.add(fire);
  ['#e2453c', '#3fbf6a', '#3f7fe0', '#ffcc33'].forEach((c, i) => {
    const st = makeStocking(c, low);
    st.position.set(-0.85 + i * 0.55, fire.userData.mantelY - 0.05, 0.14);
    fire.add(st);
  });
  // Garland and candles on the mantel.
  const garland = makeLightString(V(-1.3, 0, 0), V(1.3, 0, 0), 12, 0.12, 0.045);
  garland.position.set(0, fire.userData.mantelY + 0.06, 0.25);
  fire.add(garland);
  const tree = makeSoftPine(1.25, 4, low);
  tree.position.set(1.9, 0, -1.7);
  root.add(tree);
  const tb = makePineBulbs(1.25, 26);
  tb.position.copy(tree.position);
  root.add(tb);
  const treeLights: THREE.Mesh[] = [...garland.userData.bulbs, ...tb.userData.bulbs];
  ['#3f7fe0', '#ff7ab8', '#3fbf6a'].forEach((c, i) => {
    const gift = makeGift(c, undefined, 0.42 - i * 0.06);
    gift.position.set(1.4 + i * 0.5, 0, -1.0 + (i % 2) * 0.2);
    gift.rotation.y = i * 0.6;
    root.add(shadowed(gift));
  });
  // A round felt rug.
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.7, 40), soft('#b22a36', { roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.scale.y = 0.6;
  rug.position.set(0, 0.012, 0.1);
  rug.receiveShadow = true;
  root.add(rug);
  root.add(new THREE.HemisphereLight('#ffe6cc', '#3a2418', 0.6));
  const key = new THREE.DirectionalLight('#ffe3c4', 1.7);
  key.position.set(-2, 5, 6);
  addShadowSun(root, key, V(0, 1, 0), 4, low);
  const fill = new THREE.PointLight('#ffb070', 1.5, 7, 1.5);
  fill.position.set(1, 2.5, 3);
  root.add(fill);
  frontFill(root, 0.8, V(-0.55, 1.3, 0));
  return {
    ...base,
    root,
    ziggies: [],
    background: new THREE.Color('#2a1416'),
    fog: null,
    bloom: { strength: 0.35, radius: 0.45, threshold: 2.0 },
    update(_dt, t) {
      animateFire(fire, t, ctx.energy);
      twinkleBulbs(treeLights, t, ctx.energy);
    },
  };
}

function snowyOutdoor(root: THREE.Group, ctx: StageContext, auroraOpacity: number): { aurora: Aurora; snow: Snowfall } {
  root.add(makeNightSky());
  const aurora = makeAurora({ radius: 55, y: 9, lowPower: ctx.lowPower, opacity: auroraOpacity });
  aurora.position.z = -6;
  root.add(aurora);
  root.add(makeSnowGround(120, 10));
  const snow = new Snowfall(ctx.lowPower ? 250 : 700, 16, 9);
  root.add(snow.points);
  root.add(new THREE.HemisphereLight('#9fb3ff', '#2c2550', 0.8));
  const moon = new THREE.DirectionalLight('#c4d0ff', 1.0);
  moon.position.set(-5, 10, 7);
  addShadowSun(root, moon, V(0, 0, -1), 6, ctx.lowPower);
  const key = new THREE.DirectionalLight('#ffe0bd', 1.0);
  key.position.set(3, 4, 8);
  key.target.position.set(0, 1.2, 0);
  root.add(key, key.target);
  return { aurora, snow };
}

function buildTraineau(ctx: StageContext): Stage {
  const low = ctx.lowPower;
  const root = new THREE.Group();
  const base = boothBase(ctx, 0.6, -1, 'wave');
  const { aurora, snow } = snowyOutdoor(root, ctx, 1);
  const sleigh = makeSleigh({ lowPower: low });
  sleigh.position.set(-0.6, 0, -3.3);
  sleigh.rotation.y = -Math.PI / 2 + 0.3;
  sleigh.scale.setScalar(1.25);
  root.add(sleigh);
  const deer = makeReindeer({ lowPower: low, glowNose: true, seed: 5 });
  deer.position.set(-3.2, 0, -3.0);
  deer.rotation.y = -0.6;
  deer.scale.setScalar(1.1);
  root.add(deer);
  for (const [x, z, s, i] of [
    [-3.5, -5, 1.6, 1],
    [3.6, -4.5, 1.5, 2],
    [-1.2, -7, 1.9, 3],
    [2.0, -8, 2.1, 4],
    [5.5, -3.5, 1.3, 5],
    [-5.5, -3, 1.4, 6],
  ]) {
    const p = makeSoftPine(s, i, low);
    p.position.set(x, 0, z);
    root.add(p);
  }
  const center = V(0, 0, -2);
  return {
    ...base,
    root,
    ziggies: [],
    background: new THREE.Color('#141c48'),
    fog: new THREE.Fog('#1c2657', 14, 60),
    bloom: { strength: 0.45, radius: 0.5, threshold: 1.8 },
    update(dt, t) {
      for (const m of aurora.userData.mats) m.uniforms.uTime.value = t * (0.4 + 0.6 * ctx.energy);
      animateReindeer(deer, t, ctx.energy);
      snow.update(dt * (0.5 + 0.5 * ctx.energy), t, center);
    },
  };
}

function buildRennes(ctx: StageContext): Stage {
  const low = ctx.lowPower;
  const root = new THREE.Group();
  const base = boothBase(ctx, -0.6, 1, 'hug');
  const { aurora, snow } = snowyOutdoor(root, ctx, 0.6);
  const deer: Reindeer[] = [];
  const spots: [number, number, number, boolean, number][] = [
    [-1.95, -0.9, 0.6, false, 1.05],
    [1.75, -1.6, -0.5, true, 1.1],
    [0.2, -3.2, 0.2, false, 1.0],
  ];
  spots.forEach(([x, z, ry, nose, s], i) => {
    const r = makeReindeer({ lowPower: low, glowNose: nose, seed: 11 + i, color: i === 2 ? '#94603a' : undefined });
    r.position.set(x, 0, z);
    r.rotation.y = ry;
    r.scale.setScalar(s);
    deer.push(r);
    root.add(r);
  });
  const pines: [number, number, number][] = [
    [-3.2, -2.5, 1.5],
    [3.4, -2.8, 1.6],
    [-1.6, -5, 1.9],
    [1.8, -5.5, 2.0],
    [-4.6, -5.5, 1.8],
    [4.8, -6, 1.9],
    [0, -8, 2.3],
    [-6, -2, 1.3],
    [6, -1.8, 1.3],
  ];
  pines.slice(0, low ? 7 : pines.length).forEach(([x, z, s], i) => {
    const p = makeSoftPine(s, i + 20, low);
    p.position.set(x, 0, z);
    root.add(p);
  });
  const sparkles = makeSparkles(low ? 20 : 50, new THREE.Box3(V(-4, 0.3, -4), V(4, 3.5, -0.5)), '#fff2c4', 0.1);
  root.add(sparkles);
  const center = V(0, 0, -2);
  return {
    ...base,
    root,
    ziggies: [],
    background: new THREE.Color('#141c48'),
    fog: new THREE.Fog('#1c2657', 12, 50),
    bloom: { strength: 0.45, radius: 0.5, threshold: 1.8 },
    update(dt, t) {
      for (const m of aurora.userData.mats) m.uniforms.uTime.value = t * (0.4 + 0.6 * ctx.energy);
      deer.forEach((r) => animateReindeer(r, t, ctx.energy));
      snow.update(dt * (0.5 + 0.5 * ctx.energy), t, center);
      (sparkles.material as THREE.PointsMaterial).opacity = 0.6 + 0.3 * Math.sin(t * 1.3);
    },
  };
}

function buildAtelier(ctx: StageContext): Stage {
  const low = ctx.lowPower;
  const root = new THREE.Group();
  const base = boothBase(ctx, 0.6, -1, 'hug');
  const logs = planksTexture('#9a6238', 10);
  logs.rotation = Math.PI / 2;
  logs.repeat.set(3, 6);
  indoorRoom(root, logs, '#7a4a2a');
  // Workbench with toys in progress.
  const benchMat = soft('#8a5530');
  const bench = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.9), benchMat);
  bench.position.set(-0.6, 0.95, -1.7);
  root.add(shadowed(bench));
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.95, 0.12), benchMat);
    leg.position.set(-0.6 + sx * 1.45, 0.47, -1.7);
    root.add(shadowed(leg));
  }
  const put = (o: THREE.Object3D, x: number, y: number, z: number, ry = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    root.add(shadowed(o));
  };
  put(makeTrain(), -1.6, 1.01, -1.65, 0.6);
  put(makeDrum(), -0.9, 1.01, -1.6);
  put(makeBlock('#ff8a3d'), 0.0, 1.01, -1.7, 0.3);
  put(makeBlock('#3fbf6a', 0.18), 0.05, 1.23, -1.7, -0.2);
  put(makeTeddy('#c48a55', low), 0.6, 1.01, -1.7, -0.3);
  // Shelves with gifts on the wall.
  for (const [y, w] of [
    [2.0, 3.6],
    [2.8, 3.6],
  ] as const) {
    const s = makeShelf(w);
    s.position.set(-0.4, y, -2.38);
    root.add(s);
  }
  const cols = ['#e2453c', '#3f7fe0', '#ffcc33', '#9b6be8', '#3fbf6a', '#ff7ab8'];
  for (let i = 0; i < 6; i++) put(makeGift(cols[i], undefined, 0.3 + (i % 3) * 0.04), -1.9 + i * 0.6, i % 2 ? 2.84 : 2.04, -2.35, i * 0.4);
  // Ziggy the elf waves from a little shelf above the child's place.
  const zx = (base.slot.x0 + base.slot.x1) / 2 - 0.1;
  const plank = makeShelf(0.9);
  plank.position.set(zx, 1.86, -1.3);
  root.add(plank);
  for (const sx of [-1, 1]) {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.3), soft('#6d3d1e'));
    bracket.position.set(zx + sx * 0.35, 1.68, -1.35);
    root.add(shadowed(bracket));
  }
  const ziggy = makeElfZiggy(low);
  ziggy.scale.setScalar(0.48);
  ziggy.position.set(zx, 1.9, -1.25);
  ziggy.rotation.y = 0.25;
  ziggy.userData.rig.idle = 'wave';
  ziggy.userData.rig.energy = ctx.energy;
  root.add(ziggy);
  // (No garland across the top: the photo booth draws its own in the foreground.)
  root.add(new THREE.HemisphereLight('#ffe6cc', '#3a2418', 0.65));
  const key = new THREE.DirectionalLight('#ffe3c4', 1.6);
  key.position.set(2, 5, 6);
  addShadowSun(root, key, V(0, 1, 0), 4, low);
  const warm = new THREE.PointLight('#ffc070', 2.5, 8, 1.5);
  warm.position.set(-1, 3, 0);
  root.add(warm);
  frontFill(root, 0.8, V(0.6, 1.3, 0));
  return {
    ...base,
    root,
    ziggies: [ziggy],
    background: new THREE.Color('#2a1a10'),
    fog: null,
    bloom: { strength: 0.35, radius: 0.45, threshold: 2.0 },
    update(dt) {
      ziggy.userData.rig.update(dt);
    },
  };
}

export function buildBooth(ctx: StageContext, id: BoothSceneId): Stage {
  switch (id) {
    case 'traineau':
      return buildTraineau(ctx);
    case 'rennes':
      return buildRennes(ctx);
    case 'atelier':
      return buildAtelier(ctx);
    default:
      return buildCheminee(ctx);
  }
}
