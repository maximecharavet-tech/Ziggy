import * as THREE from 'three';
import { glow, glowMat, mat } from '../kit/look';
import { TOPPINGS, TOPPING_INFO, type ToppingId } from './logic';
import { makePiece } from './food';
import { EMOJI_FONT, canvasTex, mergeStatic, roundRect } from './util';

/**
 * Ziggy's pizza truck: a mint food truck with a red-and-white awning, a
 * wood-fired oven inside (its mouth glows through the window), a roof sign,
 * a spinning pizza on a pole, a roof hatch (for a very tall customer), a
 * tomato-shaped kitchen timer, bowls of toppings on the counter and a little
 * crate for the small customers. Origin on the ground, serving side +z.
 */

export const TRUCK = {
  floorY: 0.8,
  counterY: 1.66,
  /** Where the pizza sits while the child tops it. */
  pizza: new THREE.Vector3(0, 1.66, 1.48),
  /** Where it waits for the customer. */
  serve: new THREE.Vector3(-1.15, 1.66, 1.62),
  ziggy: new THREE.Vector3(0, 0.8, 0.42),
  ziggyOven: new THREE.Vector3(1.25, 0.8, 0.2),
  oven: new THREE.Vector3(2.3, 1.62, -0.62),
  ovenMouth: new THREE.Vector3(2.3, 1.78, 0.14),
  ovenInside: new THREE.Vector3(2.3, 1.7, -0.62),
  hatch: new THREE.Vector3(0.1, 3.95, 0.25),
  crate: new THREE.Vector3(-2.45, 0, 2.6),
  crateTop: 0.46,
};

const C = {
  body: '#4cc9b7',
  bodyDark: '#2fa596',
  cream: '#fff3dc',
  trim: '#ffcf4a',
  red: '#ec4a3f',
  white: '#fff8ef',
  wall: '#ffe7c4',
  wood: '#d9a066',
  woodDark: '#a8703a',
  tyre: '#2b2b36',
  metal: '#5b6170',
  glass: '#a9e2ff',
  brick: '#c45c3c',
  brickLight: '#de7b52',
};

const box = (w: number, h: number, d: number, color: string, x: number, y: number, z: number, cast = true) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
};

export interface Truck {
  group: THREE.Group;
  /** Hinged on the front of the roof: rotation.x < 0 lifts it. */
  awning: THREE.Group;
  flames: THREE.Mesh[];
  ovenGlow: THREE.Sprite;
  ovenLight: THREE.PointLight;
  hatch: THREE.Group;
  timer: THREE.Group;
  timerHand: THREE.Object3D;
  spinner: THREE.Group;
  bulbs: THREE.Sprite[];
  bowls: Map<ToppingId, THREE.Vector3>;
  chimneyTop: THREE.Vector3;
}

function signTexture(): THREE.CanvasTexture {
  return canvasTex(1024, 256, (g) => {
    g.fillStyle = '#fff3dc';
    roundRect(g, 8, 8, 1008, 240, 60);
    g.fill();
    g.lineWidth = 16;
    g.strokeStyle = '#ec4a3f';
    roundRect(g, 8, 8, 1008, 240, 60);
    g.stroke();
    // A slice of pizza on each side.
    const slice = (x: number, flip: number) => {
      g.save();
      g.translate(x, 128);
      g.scale(flip, 1);
      g.beginPath();
      g.moveTo(-60, -70);
      g.quadraticCurveTo(0, -95, 60, -70);
      g.lineTo(0, 80);
      g.closePath();
      g.fillStyle = '#ffcf4a';
      g.fill();
      g.lineWidth = 10;
      g.strokeStyle = '#e09a3a';
      g.stroke();
      g.fillStyle = '#ec4a3f';
      for (const [px, py] of [
        [-18, -38],
        [20, -30],
        [0, 6],
      ]) {
        g.beginPath();
        g.arc(px, py, 14, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    };
    slice(110, 1);
    slice(914, -1);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 120px Fredoka, system-ui, sans-serif';
    g.lineJoin = 'round';
    g.lineWidth = 18;
    g.strokeStyle = '#ffffff';
    g.strokeText('Pizzeria Ziggy', 512, 136);
    g.fillStyle = '#2f8f7f';
    g.fillText('Pizzeria Ziggy', 512, 136);
  });
}

function menuTexture(): THREE.CanvasTexture {
  return canvasTex(256, 320, (g) => {
    g.fillStyle = '#2f3b36';
    g.fillRect(0, 0, 256, 320);
    g.strokeStyle = '#c99a5b';
    g.lineWidth = 16;
    g.strokeRect(8, 8, 240, 304);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `46px ${EMOJI_FONT}`;
    g.fillText('🍕', 128, 52);
    TOPPINGS.forEach((t, i) => {
      g.font = `40px ${EMOJI_FONT}`;
      g.fillText(TOPPING_INFO[t].emoji, 74 + (i % 3) * 54, 120 + Math.floor(i / 3) * 62);
    });
    g.strokeStyle = 'rgba(255,255,255,.6)';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(60, 90);
    g.lineTo(196, 90);
    g.stroke();
  });
}

export function makeTruck(lowPower: boolean): Truck {
  const g = new THREE.Group();
  const F = TRUCK.floorY;

  // Wheels and chassis.
  for (const x of [-2.55, 2.1])
    for (const z of [-1.18, 1.18]) {
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.34, 18), mat(C.tyre));
      tyre.rotation.x = Math.PI / 2;
      tyre.position.set(x, 0.46, z);
      tyre.castShadow = true;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.36, 12), mat('#f2f2f2'));
      hub.rotation.x = Math.PI / 2;
      hub.position.copy(tyre.position);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.38, 8), mat(C.trim));
      cap.rotation.x = Math.PI / 2;
      cap.position.copy(tyre.position);
      g.add(tyre, hub, cap);
    }
  g.add(box(7.0, 0.3, 2.2, '#3b3f4a', -0.25, 0.62, 0));
  // Wheel arches (dark half rings on the side).
  for (const x of [-2.55, 2.1]) {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.07, 6, 16, Math.PI), mat(C.bodyDark));
    arch.position.set(x, 0.5, 1.26);
    g.add(arch);
  }

  // Kitchen box: walls around a big serving window.
  const x0 = -1.9;
  const x1 = 3.4;
  const W = x1 - x0;
  const cx = (x0 + x1) / 2;
  const top = 3.85;
  g.add(box(W, top - F, 0.12, C.body, cx, (top + F) / 2, -1.26)); // back
  g.add(box(0.12, top - F, 2.6, C.body, x1 - 0.06, (top + F) / 2, 0)); // right
  g.add(box(W, 0.82, 0.12, C.body, cx, F + 0.41, 1.26)); // under the window
  g.add(box(0.36, top - 1.55, 0.12, C.body, x0 + 0.18, (top + 1.55) / 2, 1.26));
  g.add(box(0.36, top - 1.55, 0.12, C.body, x1 - 0.18, (top + 1.55) / 2, 1.26));
  // Skirt and belt.
  g.add(box(W + 0.04, 0.3, 0.14, C.bodyDark, cx, F + 0.12, 1.27));
  g.add(box(W + 0.04, 0.16, 0.14, C.cream, cx, F + 0.52, 1.28, false));
  // Dots on the lower panel (cheerful decor).
  for (let i = 0; i < 11; i++) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10), mat(i % 2 ? C.trim : C.white));
    d.position.set(x0 + 0.35 + i * 0.47, F + 0.33, 1.33);
    g.add(d);
  }
  // Window trim.
  g.add(box(0.08, top - 1.7, 0.16, C.trim, x0 + 0.38, (top + 1.7) / 2, 1.3, false));
  g.add(box(0.08, top - 1.7, 0.16, C.trim, x1 - 0.38, (top + 1.7) / 2, 1.3, false));
  g.add(box(W - 0.6, 0.08, 0.16, C.trim, cx, top - 0.08, 1.3, false));
  // Roof with rounded edges.
  g.add(box(W + 0.16, 0.14, 2.76, C.white, cx, top + 0.07, 0));
  for (const z of [-1.38, 1.38]) {
    const edge = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, W + 0.16, 8), mat(C.white));
    edge.rotation.z = Math.PI / 2;
    edge.position.set(cx, top + 0.05, z);
    g.add(edge);
  }

  // Inside: floor, warm walls, shelves with jars, hanging ladles.
  g.add(box(W - 0.2, 0.05, 2.4, '#c98a5a', cx, F, 0, false));
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.24, top - F - 0.1), mat(C.wall));
  wall.position.set(cx, (top + F) / 2, -1.19);
  g.add(wall);
  const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(2.4, top - F - 0.1), mat('#ffd9a8'));
  sideWall.rotation.y = Math.PI / 2;
  sideWall.position.set(x0 + 0.02, (top + F) / 2, 0);
  g.add(sideWall);
  for (const [sy, sx0, sx1] of [
    [2.75, -1.6, 1.2],
    [3.3, -1.6, 1.2],
  ] as const) {
    g.add(box(sx1 - sx0, 0.06, 0.32, C.woodDark, (sx0 + sx1) / 2, sy, -1.02, false));
    const jarCols = ['#ff8a5c', '#ffd166', '#7fd0ff', '#9bf07f', '#ff7ab8', '#c99bff'];
    for (let i = 0; i < 6; i++) {
      const jx = sx0 + 0.25 + i * 0.47;
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.26, 10), mat(jarCols[(i + (sy > 3 ? 2 : 0)) % 6]));
      jar.position.set(jx, sy + 0.16, -1.0);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.05, 10), mat(C.red));
      lid.position.set(jx, sy + 0.31, -1.0);
      g.add(jar, lid);
    }
  }
  for (let i = 0; i < 3; i++) {
    const lx = -1.3 + i * 0.32;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.45, 5), mat('#c9ced8'));
    handle.position.set(lx, 2.25, -1.12);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('#c9ced8', { side: THREE.DoubleSide }));
    head.position.set(lx, 2.03, -1.1);
    g.add(handle, head);
  }

  // The counter: a wooden ledge out of the window, with brackets.
  g.add(box(W - 0.24, 0.1, 1.2, C.wood, cx - 0.02, TRUCK.counterY - 0.05, 1.5));
  g.add(box(W - 0.24, 0.05, 0.08, C.woodDark, cx - 0.02, TRUCK.counterY - 0.09, 2.1, false));
  for (const x of [-1.4, 2.9]) {
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 0.32, 0.5, 3, 1), mat(C.woodDark));
    br.rotation.set(Math.PI / 2, 0, 0);
    br.scale.set(0.25, 1, 1);
    br.position.set(x, TRUCK.counterY - 0.36, 1.55);
    g.add(br);
  }
  // Inner worktop where the oven stands.
  g.add(box(1.7, F + 0.85 - F, 1.25, C.brick, TRUCK.oven.x, F + 0.42, -0.6));

  // The oven: a brick dome with a glowing mouth.
  const domeGeo = new THREE.SphereGeometry(0.78, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const dc: number[] = [];
  const dp = domeGeo.attributes.position;
  const b1 = new THREE.Color(C.brick);
  const b2 = new THREE.Color(C.brickLight);
  for (let i = 0; i < dp.count; i++) {
    const row = Math.floor((dp.getY(i) / 0.78) * 5);
    const col = Math.floor(((Math.atan2(dp.getZ(i), dp.getX(i)) + Math.PI) / (Math.PI * 2)) * 18 + (row % 2) * 0.5);
    const c = (row + col) % 3 === 0 ? b2 : b1;
    dc.push(c.r, c.g, c.b);
  }
  domeGeo.setAttribute('color', new THREE.Float32BufferAttribute(dc, 3));
  const dome = new THREE.Mesh(domeGeo, mat('#ffffff', { vertexColors: true }));
  dome.position.copy(TRUCK.oven);
  dome.castShadow = true;
  g.add(dome);
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.36, 16, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#2a0e05' }));
  mouth.position.set(TRUCK.oven.x, TRUCK.oven.y + 0.02, TRUCK.oven.z + 0.76);
  mouth.userData.noMerge = true;
  g.add(mouth);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.06, 6, 16, Math.PI), mat('#f1d3a2'));
  arch.position.set(TRUCK.oven.x, TRUCK.oven.y + 0.02, TRUCK.oven.z + 0.77);
  g.add(arch);
  g.add(box(1.5, 0.06, 0.32, '#f1d3a2', TRUCK.oven.x, TRUCK.oven.y + 0.0, TRUCK.oven.z + 0.86, false));
  // Chimney pipe through the roof.
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 10), mat(C.metal));
  pipe.position.set(TRUCK.oven.x, TRUCK.oven.y + 1.8, TRUCK.oven.z);
  pipe.castShadow = true;
  const pipeCap = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.2, 10), mat('#3b3f4a'));
  pipeCap.position.set(TRUCK.oven.x, TRUCK.oven.y + 3.2, TRUCK.oven.z);
  g.add(pipe, pipeCap);

  // Flames and glow (animated, never merged).
  const fire = new THREE.Group();
  fire.userData.noMerge = true;
  const flames: THREE.Mesh[] = [];
  const flameCols = ['#ff7a1a', '#ffb02e', '#ffd84a', '#ff9a2a', '#ffe680'];
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.07 + (i % 2) * 0.03, 0.3, 6), glowMat(flameCols[i], 1.35));
    f.position.set(TRUCK.oven.x - 0.22 + i * 0.11, TRUCK.oven.y + 0.15, TRUCK.oven.z + 0.66);
    f.userData.base = f.position.clone();
    f.userData.phase = i * 1.3;
    flames.push(f);
    fire.add(f);
  }
  const ovenGlow = glow('#ff8a2a', 1.6, 0.55);
  ovenGlow.position.set(TRUCK.oven.x, TRUCK.oven.y + 0.15, TRUCK.oven.z + 0.8);
  fire.add(ovenGlow);
  g.add(fire);
  const ovenLight = new THREE.PointLight('#ff9a3c', 3, 4.5, 1.6);
  ovenLight.position.set(TRUCK.oven.x, TRUCK.oven.y + 0.3, TRUCK.oven.z + 1.1);
  g.add(ovenLight);

  // The tomato kitchen timer on the oven ledge.
  const timer = new THREE.Group();
  timer.userData.noMerge = true;
  const tomato = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), new THREE.MeshStandardMaterial({ color: '#e5392f', roughness: 0.4 }));
  tomato.scale.y = 0.85;
  const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.06, 5), new THREE.MeshStandardMaterial({ color: '#3fae3f', roughness: 0.6 }));
  leaf.position.y = 0.14;
  leaf.rotation.x = Math.PI;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.06, 5), new THREE.MeshStandardMaterial({ color: '#3fae3f' }));
  stem.position.y = 0.17;
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.085, 16), new THREE.MeshBasicMaterial({ color: '#fff8ef' }));
  face.position.z = 0.13;
  const hand = new THREE.Group();
  const handMesh = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.07, 0.01), new THREE.MeshBasicMaterial({ color: '#4a2a12' }));
  handMesh.position.y = 0.032;
  hand.add(handMesh);
  hand.position.z = 0.135;
  timer.add(tomato, leaf, stem, face, hand);
  timer.position.set(TRUCK.oven.x + 0.56, TRUCK.oven.y + 0.15, TRUCK.oven.z + 0.86);
  timer.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  g.add(timer);

  // The red-and-white awning with its scalloped edge, hinged on the roof edge
  // like a serving hatch: it lifts up when the camera comes close, so nothing
  // hides the pizza and Ziggy.
  const awning = new THREE.Group();
  awning.userData.noMerge = true;
  awning.position.set(0, top, 1.32);
  const cloth = new THREE.Group();
  const aw0 = x0 - 0.05;
  const aw1 = x1 + 0.05;
  const stripes = 15;
  const sw = (aw1 - aw0) / stripes;
  const slope = 0.52;
  const len = 1.25;
  const ey = -Math.sin(slope) * len;
  const ez = Math.cos(slope) * len;
  for (let i = 0; i < stripes; i++) {
    const col = i % 2 ? C.white : C.red;
    const x = aw0 + sw * (i + 0.5);
    const s = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.002, 0.04, len), mat(col));
    s.rotation.x = slope;
    s.position.set(x, ey / 2, ez / 2);
    s.castShadow = true;
    const scallop = new THREE.Mesh(new THREE.CylinderGeometry(sw / 2, sw / 2, 0.04, 10, 1, false, Math.PI / 2, Math.PI), mat(col));
    scallop.rotation.set(Math.PI / 2, 0, 0);
    scallop.position.set(x, ey - 0.15, ez);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.002, 0.16, 0.04), mat(col));
    lip.position.set(x, ey - 0.08, ez);
    cloth.add(s, scallop, lip);
  }
  mergeStatic(cloth);
  awning.add(cloth);

  // String lights under the awning edge.
  const lights = new THREE.Group();
  const bulbs: THREE.Sprite[] = [];
  const bulbCols = ['#ffd166', '#ff7ab8', '#7fd0ff', '#9bf07f', '#ffb35c'];
  for (let i = 0; i < 16; i++) {
    const x = aw0 + 0.15 + i * ((aw1 - aw0 - 0.3) / 15);
    const sag = -Math.abs(Math.sin(i * 1.7)) * 0.04;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), glowMat(bulbCols[i % 5], 1.2));
    bulb.position.set(x, ey - 0.24 + sag, ez + 0.03);
    const halo = glow(bulbCols[i % 5], 0.42, 0.55);
    halo.position.copy(bulb.position);
    halo.userData.phase = i * 0.9;
    bulbs.push(halo);
    lights.add(bulb, halo);
  }
  awning.add(lights);
  g.add(awning);

  // The roof sign and the spinning pizza.
  const signMat = new THREE.MeshLambertMaterial({ map: signTexture() });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.9, 0.1), [mat(C.trim), mat(C.trim), mat(C.trim), mat(C.trim), signMat, mat(C.trim)]);
  sign.position.set(0.3, 4.62, 0.95);
  sign.castShadow = true;
  sign.userData.noMerge = true;
  g.add(sign);
  for (const x of [-0.9, 1.5]) g.add(box(0.08, 0.5, 0.08, C.metal, x, 4.1, 0.95));
  const spinner = new THREE.Group();
  spinner.userData.noMerge = true;
  {
    const slice = new THREE.Group();
    const wedge = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.12, 3, 1, false, -Math.PI / 6, Math.PI / 3), mat('#ffcf4a'));
    wedge.rotation.x = Math.PI / 2;
    const crust = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.78, 8), mat('#e09a3a'));
    crust.rotation.z = Math.PI / 2;
    crust.position.y = 0.68;
    slice.add(wedge, crust);
    for (const [px, py] of [
      [-0.13, 0.42],
      [0.15, 0.36],
      [0.0, 0.16],
    ]) {
      for (const side of [-1, 1]) {
        const pep = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 10), mat(C.red));
        pep.rotation.x = Math.PI / 2;
        pep.position.set(px, py, side * 0.07);
        slice.add(pep);
      }
    }
    slice.rotation.z = Math.PI;
    slice.position.y = 0.55;
    spinner.add(slice);
  }
  spinner.position.set(2.85, 4.25, 0.2);
  const spPole = box(0.06, 0.5, 0.06, C.metal, 2.85, 4.12, 0.2);
  g.add(spinner, spPole);

  // Roof hatch (opens for Gina the giraffe).
  const hatch = new THREE.Group();
  hatch.userData.noMerge = true;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.07, 0.9), mat(C.trim));
  lid.position.z = 0.45;
  lid.castShadow = true;
  hatch.add(lid);
  hatch.position.set(TRUCK.hatch.x, TRUCK.hatch.y + 0.06, TRUCK.hatch.z - 0.45);
  g.add(hatch);
  g.add(box(1.05, 0.06, 1.0, '#3b3f4a', TRUCK.hatch.x, TRUCK.hatch.y + 0.01, TRUCK.hatch.z, false));

  // Cab.
  const cab = new THREE.Group();
  cab.add(box(1.55, 1.9, 2.4, C.body, -2.68, F + 0.95, 0));
  cab.add(box(0.5, 0.8, 2.3, C.body, -3.62, F + 0.4, 0));
  cab.add(box(1.6, 0.16, 2.44, C.cream, -2.68, F + 0.52, 0, false));
  cab.add(box(1.62, 0.1, 2.46, C.white, -2.68, F + 1.95, 0));
  const shield = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.85), mat(C.glass, { emissive: new THREE.Color('#2a5a7a') }));
  shield.rotation.y = -Math.PI / 2;
  shield.rotation.x = 0;
  shield.position.set(-3.47, F + 1.38, 0);
  cab.add(shield);
  const sideWin = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), mat(C.glass, { emissive: new THREE.Color('#2a5a7a') }));
  sideWin.position.set(-2.7, F + 1.42, 1.211);
  cab.add(sideWin);
  cab.add(box(1.08, 0.06, 0.04, C.trim, -2.7, F + 1.8, 1.22, false));
  cab.add(box(1.08, 0.06, 0.04, C.trim, -2.7, F + 1.05, 1.22, false));
  const handleD = box(0.2, 0.05, 0.05, '#e8e2d6', -2.35, F + 0.85, 1.23, false);
  cab.add(handleD);
  for (const z of [-0.85, 0.85]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), glowMat('#fff3c4', 1.05));
    lamp.position.set(-3.86, F + 0.45, z);
    cab.add(lamp);
  }
  cab.add(box(0.12, 0.2, 2.3, '#d9dde3', -3.9, F + 0.1, 0));
  const mirror = box(0.12, 0.22, 0.06, '#3b3f4a', -3.3, F + 1.55, 1.32);
  cab.add(mirror);
  g.add(cab);

  // Topping bowls on the counter, right of the pizza.
  const bowls = new Map<ToppingId, THREE.Vector3>();
  const bowlGroup = new THREE.Group();
  TOPPINGS.forEach((t, i) => {
    const row = i < 4 ? 0 : 1;
    const bx = 1.05 + (row ? 0.25 : 0) + (i % 4) * 0.5;
    const bz = row ? 1.3 : 1.78;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.13, 14, 1, true), mat('#ffffff', { side: THREE.DoubleSide }));
    bowl.position.set(bx, TRUCK.counterY + 0.065, bz);
    bowl.castShadow = true;
    const fill = new THREE.Mesh(new THREE.CircleGeometry(0.18, 14), mat(TOPPING_INFO[t].hex === '#fff3d6' ? '#fff8e8' : TOPPING_INFO[t].hex));
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(bx, TRUCK.counterY + 0.11, bz);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.015, 4, 16), mat('#7fd0ff'));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(bx, TRUCK.counterY + 0.13, bz);
    bowlGroup.add(bowl, fill, ring);
    // A few real pieces on top, so the bowl says what it holds.
    const pieces = new THREE.Group();
    pieces.userData.noMerge = true;
    for (let k = 0; k < 3; k++) {
      const p = makePiece(t);
      p.position.set(bx + Math.cos(k * 2.1) * 0.07, TRUCK.counterY + 0.1 + k * 0.012, bz + Math.sin(k * 2.1) * 0.07);
      p.rotation.y = k * 1.3;
      p.castShadow = false;
      pieces.add(p);
    }
    bowlGroup.add(pieces);
    bowls.set(t, new THREE.Vector3(bx, TRUCK.counterY + 0.15, bz));
  });
  g.add(bowlGroup);

  // A crate to stand on, for the little customers.
  const crate = new THREE.Group();
  const cw = 1.0;
  crate.add(box(cw, 0.42, 0.8, '#d7a26a', 0, 0.21, 0));
  for (const y of [0.1, 0.31]) {
    crate.add(box(cw + 0.02, 0.07, 0.82, '#b9834e', 0, y, 0, false));
  }
  crate.add(box(cw + 0.04, 0.05, 0.84, '#e8b97f', 0, 0.44, 0, false));
  crate.position.copy(TRUCK.crate);
  g.add(crate);

  // A chalkboard menu of the toppings (pictures only: every language).
  const easel = new THREE.Group();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.12), new THREE.MeshLambertMaterial({ map: menuTexture() }));
  board.position.set(0, 1.0, 0.04);
  board.rotation.x = -0.12;
  board.userData.noMerge = true;
  easel.add(board);
  for (const sx of [-0.4, 0.4]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.06), mat(C.woodDark));
    leg.position.set(sx, 0.78, 0);
    leg.rotation.x = -0.12;
    easel.add(leg);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.5, 0.06), mat(C.woodDark));
  back.position.set(0, 0.72, -0.35);
  back.rotation.x = 0.35;
  easel.add(back);
  easel.position.set(4.3, 0, 2.3);
  easel.rotation.y = -0.35;
  g.add(easel);

  // Flower pots beside the truck.
  for (const [px, pz, col] of [
    [3.9, 1.1, '#ff7ab8'],
    [-4.35, 1.35, '#ffd166'],
  ] as const) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.45, 10), mat('#d0703e'));
    pot.position.set(px, 0.22, pz);
    pot.castShadow = true;
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 1), mat('#4caf50'));
    bush.position.set(px, 0.62, pz);
    bush.castShadow = true;
    g.add(pot, bush);
    for (let k = 0; k < 6; k++) {
      const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(col));
      fl.position.set(px + Math.cos(k * 1.1) * 0.28, 0.66 + Math.sin(k * 2.3) * 0.12, pz + Math.sin(k * 1.1) * 0.28);
      g.add(fl);
    }
  }

  void lowPower;
  // Hundreds of little static pieces → a few draw calls.
  mergeStatic(g, true);
  return {
    group: g,
    awning,
    flames,
    ovenGlow,
    ovenLight,
    hatch,
    timer,
    timerHand: hand,
    spinner,
    bulbs,
    bowls,
    chimneyTop: new THREE.Vector3(TRUCK.oven.x, TRUCK.oven.y + 3.35, TRUCK.oven.z),
  };
}
