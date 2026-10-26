import * as THREE from 'three';
import { glow, glowMat, labelSprite, mat } from './look';

/**
 * Low-poly models built in code. Every model is a Group whose origin sits on
 * the ground, facing +Z.
 */

export const PALETTE = {
  ziggy: '#7fd04b',
  ziggyDark: '#4e9a2a',
  snow: '#f2f6ff',
  snowShade: '#c9d6f2',
  pine: '#2f6b4a',
  pineDark: '#1f4a35',
  trunk: '#6b4226',
  red: '#e2453c',
  blue: '#3f7fe0',
  yellow: '#ffcc33',
  green: '#3fbf6a',
  purple: '#9b6be8',
  orange: '#ff8a3d',
  pink: '#ff7ab8',
  warm: '#ffd48a',
} as const;

/** Ziggy: a round green plush robot with two antennas and a glowing heart. */
export function makeZiggy(): THREE.Group & { userData: { parts: Record<string, THREE.Object3D> } } {
  const g = new THREE.Group() as THREE.Group & { userData: { parts: Record<string, THREE.Object3D> } };
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10), mat(PALETTE.ziggy, { emissive: new THREE.Color(PALETTE.ziggy).multiplyScalar(0.18) }));
  body.scale.set(1, 1.08, 0.95);
  body.position.y = 0.95;
  body.castShadow = true;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), mat('#b9ef8a'));
  belly.position.set(0, 0.82, 0.32);
  belly.scale.set(1, 1, 0.55);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#1d2a33'));
  face.rotation.x = Math.PI / 2;
  face.position.set(0, 1.18, 0.42);
  face.scale.set(1, 0.42, 0.7);
  const eyeGeo = new THREE.SphereGeometry(0.085, 10, 8);
  const eyeL = new THREE.Mesh(eyeGeo, glowMat('#9ff8ff', 1.4));
  const eyeR = eyeL.clone();
  eyeL.position.set(-0.14, 1.2, 0.68);
  eyeR.position.set(0.14, 1.2, 0.68);
  const heart = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), glowMat('#ff5c8a', 1.5));
  heart.position.set(0, 0.78, 0.6);
  const heartGlow = glow('#ff5c8a', 0.7, 0.6);
  heartGlow.position.copy(heart.position);
  const antennas = new THREE.Group();
  for (const side of [-1, 1]) {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.36, 6), mat(PALETTE.ziggyDark));
    stalk.position.set(side * 0.22, 1.72, 0);
    stalk.rotation.z = -side * 0.25;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), glowMat('#fff27a', 1.3));
    tip.position.set(side * 0.27, 1.9, 0);
    const tipGlow = glow('#fff27a', 0.5, 0.7);
    tipGlow.position.copy(tip.position);
    antennas.add(stalk, tip, tipGlow);
  }
  const feet = new THREE.Group();
  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6), mat(PALETTE.ziggyDark));
    foot.scale.set(1, 0.6, 1.3);
    foot.position.set(side * 0.26, 0.14, 0.05);
    foot.castShadow = true;
    feet.add(foot);
  }
  const arms = new THREE.Group();
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.32, 4, 8), mat(PALETTE.ziggy));
    arm.position.set(side * 0.66, 0.95, 0.05);
    arm.rotation.z = side * 0.5;
    arm.castShadow = true;
    arm.name = side < 0 ? 'armL' : 'armR';
    arms.add(arm);
  }
  // A little Christmas hat (removable).
  const hat = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.6, 10), mat(PALETTE.red));
  cone.position.y = 1.84;
  cone.rotation.z = -0.25;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.08, 6, 14), mat('#ffffff'));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 1.56;
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat('#ffffff'));
  pom.position.set(0.16, 2.12, 0);
  hat.add(cone, rim, pom);
  hat.visible = false;

  const bodyGroup = new THREE.Group();
  bodyGroup.add(body, belly, face, eyeL, eyeR, heart, heartGlow, antennas, arms, hat);
  g.add(bodyGroup, feet);
  g.userData.parts = { bodyGroup, feet, antennas, arms, hat, eyeL, eyeR };
  return g;
}

/** A pine tree in 3 tiers, optionally snowy. */
export function makePine(scale = 1, snowy = true): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.6, 6), mat(PALETTE.trunk));
  trunk.position.y = 0.3;
  g.add(trunk);
  const tiers = [
    { r: 1.0, h: 1.3, y: 1.0 },
    { r: 0.78, h: 1.1, y: 1.65 },
    { r: 0.52, h: 0.9, y: 2.2 },
  ];
  tiers.forEach((t, i) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 7), mat(i % 2 ? PALETTE.pine : PALETTE.pineDark));
    cone.position.y = t.y;
    cone.castShadow = true;
    g.add(cone);
    if (snowy) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(t.r * 0.62, t.h * 0.42, 7), mat(PALETTE.snow));
      cap.position.y = t.y + t.h * 0.3;
      g.add(cap);
    }
  });
  g.scale.setScalar(scale);
  return g;
}

/** A cosy house with a numbered sign, a coloured roof and warm windows. */
export function makeHouse(opts: { roof: string; walls?: string; label?: string; seed?: number }): THREE.Group & { userData: { windows: THREE.Mesh[]; door: THREE.Vector3; smoke: THREE.Vector3; sign?: THREE.Sprite } } {
  const g = new THREE.Group() as THREE.Group & { userData: { windows: THREE.Mesh[]; door: THREE.Vector3; smoke: THREE.Vector3; sign?: THREE.Sprite } };
  const walls = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 2.6), mat(opts.walls ?? '#f1d3a8'));
  walls.position.y = 1.1;
  walls.castShadow = walls.receiveShadow = true;
  const roofGeo = new THREE.ConeGeometry(2.45, 1.6, 4, 1);
  const roof = new THREE.Mesh(roofGeo, mat(opts.roof));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.05, 1, 0.92);
  roof.position.y = 3.0;
  roof.castShadow = true;
  const roofSnow = new THREE.Mesh(new THREE.ConeGeometry(2.0, 0.7, 4, 1), mat(PALETTE.snow));
  roofSnow.rotation.y = Math.PI / 4;
  roofSnow.scale.set(1.05, 1, 0.92);
  roofSnow.position.y = 3.5;
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.1, 0.45), mat('#a0523d'));
  chimney.position.set(0.8, 3.4, -0.3);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.25, 0.08), mat('#7a3b12'));
  door.position.set(0, 0.63, 1.32);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), glowMat('#ffd166', 1));
  knob.position.set(0.24, 0.62, 1.37);
  const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 6, 12), mat(PALETTE.green));
  wreath.position.set(0, 1.05, 1.38);
  const windows: THREE.Mesh[] = [];
  for (const x of [-0.95, 0.95]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.55), glowMat('#ffcf6e', 0.95));
    w.position.set(x, 1.35, 1.31);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.07, 0.06), mat('#7a3b12'));
    frame.position.set(x, 1.35, 1.33);
    windows.push(w);
    g.add(w, frame);
  }
  g.add(walls, roof, roofSnow, chimney, door, knob, wreath);
  if (opts.label) {
    const sign = labelSprite(opts.label, { size: 0.9 });
    sign.position.set(0, 2.55, 1.45);
    g.add(sign);
    g.userData.sign = sign;
  }
  g.userData.windows = windows;
  g.userData.door = new THREE.Vector3(0, 0, 2.3);
  g.userData.smoke = new THREE.Vector3(0.8, 4.1, -0.3);
  return g;
}

/** A wrapped present with a ribbon; `label` adds a number tag. */
export function makeGift(color: string, label?: string, size = 0.55): THREE.Group {
  const g = new THREE.Group();
  // A touch of emissive so presents pop out of the night.
  const box = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat(color, { emissive: new THREE.Color(color).multiplyScalar(0.35) }));
  box.position.y = size / 2;
  box.castShadow = true;
  const ribbonMat = mat('#fff5d6');
  const r1 = new THREE.Mesh(new THREE.BoxGeometry(size * 1.02, size * 1.02, size * 0.16), ribbonMat);
  r1.position.y = size / 2;
  const r2 = new THREE.Mesh(new THREE.BoxGeometry(size * 0.16, size * 1.02, size * 1.02), ribbonMat);
  r2.position.y = size / 2;
  const bowL = new THREE.Mesh(new THREE.TorusGeometry(size * 0.16, size * 0.05, 5, 10), ribbonMat);
  bowL.position.set(-size * 0.12, size * 1.08, 0);
  bowL.rotation.y = Math.PI / 2;
  const bowR = bowL.clone();
  bowR.position.x = size * 0.12;
  g.add(box, r1, r2, bowL, bowR);
  if (label) {
    const tag = labelSprite(label, { size: size * 1.1, bg: '#ffffff', fg: '#1d2a6b' });
    tag.position.y = size * 1.7;
    g.add(tag);
  }
  return g;
}

/** The big village Christmas tree, with light bulbs we can switch on one by one. */
export function makeBigTree(): THREE.Group & { userData: { bulbs: THREE.Mesh[]; star: THREE.Object3D; slots: THREE.Vector3[] } } {
  const g = makePine(2.6, false) as THREE.Group & { userData: { bulbs: THREE.Mesh[]; star: THREE.Object3D; slots: THREE.Vector3[] } };
  // The big tree glows softly from its garland, so it stays the heart of the night.
  g.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined;
    if (m?.isMeshLambertMaterial && (o as THREE.Mesh).geometry.type === 'ConeGeometry') {
      m.color.set('#3f8a5e');
      m.emissive.set('#183a26');
    }
  });
  const bulbs: THREE.Mesh[] = [];
  const colors = [PALETTE.red, PALETTE.yellow, PALETTE.blue, PALETTE.pink, PALETTE.green];
  // A spiral garland of bulbs (in local tree units, the group is scaled ×2.6).
  for (let i = 0; i < 26; i++) {
    const t = i / 26;
    const y = 0.75 + t * 1.8;
    const r = 0.95 - t * 0.7;
    const a = t * Math.PI * 5;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), glowMat(colors[i % colors.length], 0.6));
    b.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    b.userData.color = colors[i % colors.length];
    bulbs.push(b);
    g.add(b);
  }
  const star = new THREE.Group();
  const starMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), glowMat('#ffe066', 0.4));
  starMesh.scale.set(1, 1.3, 0.5);
  const starGlow = glow('#ffe066', 1.4, 0);
  star.add(starMesh, starGlow);
  star.position.y = 2.75;
  g.add(star);
  // Where decorations go (front side, so the child sees them).
  const slots: THREE.Vector3[] = [];
  for (let i = 0; i < 6; i++) {
    const y = 0.95 + (i % 3) * 0.55;
    const r = 0.85 - (i % 3) * 0.22;
    const a = Math.PI / 2 + (i < 3 ? -0.45 : 0.45);
    slots.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  g.userData.bulbs = bulbs;
  g.userData.star = star;
  g.userData.slots = slots;
  return g;
}

/** A Christmas ball ornament. */
export function makeOrnament(color: string, shape: 'ball' | 'star' | 'bell' = 'ball'): THREE.Group {
  const g = new THREE.Group();
  const geo = shape === 'star' ? new THREE.OctahedronGeometry(0.2, 0) : shape === 'bell' ? new THREE.ConeGeometry(0.16, 0.26, 8) : new THREE.IcosahedronGeometry(0.17, 1);
  const m = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color, shininess: 90, flatShading: true }));
  if (shape === 'star') m.scale.set(1, 1.2, 0.5);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 6), mat('#d9b44a'));
  cap.position.y = 0.2;
  g.add(m, cap, glow(color, 0.55, 0.35));
  return g;
}

export function makeSnowman(): THREE.Group {
  const g = new THREE.Group();
  const s = mat(PALETTE.snow);
  const parts = [
    { r: 0.6, y: 0.55 },
    { r: 0.45, y: 1.35 },
    { r: 0.32, y: 1.95 },
  ];
  for (const p of parts) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(p.r, 1), s);
    b.position.y = p.y;
    b.castShadow = true;
    g.add(b);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.32, 6), mat(PALETTE.orange));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.95, 0.42);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.32, 8), mat('#2b2b3a'));
  hat.position.y = 2.38;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 6, 12), mat(PALETTE.red));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.65;
  g.add(nose, hat, scarf);
  return g;
}

export function makeLamp(): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 6), mat('#2b3245'));
  pole.position.y = 1.2;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.32, 6), glowMat('#ffd48a', 1.2));
  head.position.y = 2.5;
  const halo = glow('#ffcf6e', 2.4, 0.55);
  halo.position.y = 2.5;
  g.add(pole, head, halo);
  return g;
}

/** Sky dome with a gradient and stars, and a big moon. */
export function makeNightSky(): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(140, 24, 16);
  const colors: number[] = [];
  const pos = geo.attributes.position;
  const top = new THREE.Color('#0b1238');
  const bottom = new THREE.Color('#3b4a8f');
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, (pos.getY(i) + 20) / 120));
    const c = bottom.clone().lerp(top, t);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  g.add(dome);
  const starPos: number[] = [];
  for (let i = 0; i < 600; i++) {
    const a = Math.random() * Math.PI * 2;
    const y = 15 + Math.random() * 110;
    const r = 120;
    starPos.push(Math.cos(a) * r, y, Math.sin(a) * r);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  g.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 0.9, sizeAttenuation: true, fog: false })));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(6, 18, 12), new THREE.MeshBasicMaterial({ color: '#fff3d1', fog: false }));
  moon.position.set(-60, 70, -90);
  const moonGlow = glow('#fff1c4', 40, 0.4);
  (moonGlow.material as THREE.SpriteMaterial).fog = false;
  moonGlow.position.copy(moon.position);
  g.add(moon, moonGlow);
  return g;
}
