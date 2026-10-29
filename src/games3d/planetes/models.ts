import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { glow, glowMat, mat } from '../kit/look';
import type { BodyId, GiftId } from './logic';
import { earthClouds, envelopeTexture, flameTexture, parcelLabel, planetMap, ringTexture, stripes, sunMap, raysTexture } from './textures';

/**
 * The game's models, built in code at "character scale" (Ziggy is about
 * 2.3 units tall): the little round rocket, the planets' inhabitants (all
 * imaginary and friendly), parcels, the presents inside, and the post office
 * asteroid. The overview's planets are built here too.
 */

/** A shiny toy-plastic material (smooth, unlike the faceted world). */
export const toy = (color: THREE.ColorRepresentation, shininess = 50, extra: Partial<THREE.MeshPhongMaterialParameters> = {}) =>
  new THREE.MeshPhongMaterial({ color, shininess, specular: new THREE.Color('#ffffff').multiplyScalar(0.25), ...extra });

/* ───────────────────────── Static merge ───────────────────────── */

/**
 * Merge every plain (untextured, opaque) mesh under `root` into one mesh per
 * material kind, keeping colours as vertex colours: fewer draw calls.
 */
export function mergeStatic(root: THREE.Object3D, opts: { shadows?: boolean; phong?: boolean } = {}): void {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const buckets = new Map<string, { geos: THREE.BufferGeometry[]; flat: boolean; phong: boolean }>();
  const done: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.keep) return;
    for (let p: THREE.Object3D | null = m.parent; p && p !== root; p = p.parent) if (p.userData.keep) return;
    const mt = m.material as THREE.MeshLambertMaterial & THREE.MeshPhongMaterial;
    if (Array.isArray(m.material) || mt.transparent || mt.map || !(mt.isMeshLambertMaterial || mt.isMeshPhongMaterial)) return;
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
    const phong = Boolean(mt.isMeshPhongMaterial);
    const flat = Boolean(mt.flatShading);
    const key = `${phong}-${flat}`;
    if (!buckets.has(key)) buckets.set(key, { geos: [], flat, phong });
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
    const material = b.phong
      ? new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: b.flat, shininess: 50, specular: new THREE.Color('#ffffff').multiplyScalar(0.22) })
      : new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: b.flat });
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = Boolean(opts.shadows);
    mesh.receiveShadow = Boolean(opts.shadows);
    root.add(mesh);
  }
}

/* ───────────────────────── Rocket ───────────────────────── */

export interface Rocket {
  root: THREE.Group;
  /** Where Ziggy sits (origin on the seat). */
  seat: THREE.Group;
  /** The glass dome, hinged at the back: rotation.x < 0 opens it. */
  dome: THREE.Group;
  flames: THREE.Group;
  /** Thrust 0..1 (flame size), set every frame. */
  setThrust(k: number, t: number): void;
  /** Tail of the rocket in local space (star trail). */
  tail: THREE.Vector3;
  /** Parcels waiting in the hold (shown on the rack). */
  rack: THREE.Group;
}

/** Ziggy's little round post rocket: coral body, porthole with a letter, cockpit with a glass bubble. */
export function makeRocket(lowPower: boolean): Rocket {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const seg = lowPower ? 16 : 24;

  const profile = [
    [0.3, 0.48],
    [0.72, 0.56],
    [1.04, 0.82],
    [1.22, 1.24],
    [1.27, 1.7],
    [1.2, 2.14],
    [1.03, 2.48],
    [0.95, 2.6],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const hull = new THREE.Mesh(new THREE.LatheGeometry(profile, seg), toy('#ff6b5a', 60));
  hull.castShadow = true;
  body.add(hull);
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.26, 0.075, 8, seg * 2), toy('#fff3dc', 40));
  band.rotation.x = Math.PI / 2;
  band.position.y = 1.85;
  body.add(band);
  const band2 = band.clone();
  band2.scale.setScalar(0.93);
  band2.position.y = 0.9;
  body.add(band2);
  // Cockpit: golden rim and a dark seat well.
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.085, 8, seg * 2), toy('#ffd166', 80));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 2.6;
  body.add(rim);
  const well = new THREE.Mesh(new THREE.CircleGeometry(0.93, seg), toy('#2b2156', 10));
  well.rotation.x = -Math.PI / 2;
  well.position.y = 2.42;
  body.add(well);
  // Nozzle.
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.52, 0.34, seg, 1, true), toy('#4d5375', 70, { side: THREE.DoubleSide }));
  nozzle.position.y = 0.36;
  body.add(nozzle);
  // Three fins with golden ball tips (none in front of the porthole), three little feet.
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.62, -0.35);
  finShape.quadraticCurveTo(0.78, -0.42, 0.74, -0.2);
  finShape.lineTo(0.5, 0.55);
  finShape.quadraticCurveTo(0.2, 0.75, 0, 0.7);
  finShape.lineTo(0, 0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 6 });
  finGeo.translate(0, 0, -0.06);
  for (const a of [Math.PI / 6, (5 * Math.PI) / 6, -Math.PI / 2]) {
    const fin = new THREE.Mesh(finGeo, toy('#2ec4b6', 60));
    fin.position.set(Math.cos(a) * 1.0, 0.72, Math.sin(a) * 1.0);
    fin.rotation.y = -a;
    fin.castShadow = true;
    body.add(fin);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), toy('#ffd166', 90));
    tip.position.set(Math.cos(a) * 1.72, 0.36, Math.sin(a) * 1.72);
    body.add(tip);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.42, 6), toy('#4d5375', 40));
    leg.position.set(Math.cos(a) * 0.62, 0.3, Math.sin(a) * 0.62);
    leg.rotation.z = Math.cos(a) * 0.35;
    leg.rotation.x = -Math.sin(a) * 0.35;
    body.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 6), toy('#ffd166', 60));
    foot.scale.y = 0.6;
    foot.position.set(Math.cos(a) * 0.74, 0.08, Math.sin(a) * 0.74);
    body.add(foot);
  }
  // A little red mail flag on the side.
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 6), toy('#fff3dc', 40));
  pole.position.set(1.2, 2.55, -0.35);
  pole.rotation.z = -0.25;
  body.add(pole);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.05), toy('#e2453c', 40));
  flag.position.set(1.43, 2.8, -0.35);
  flag.rotation.z = -0.25;
  body.add(flag);
  mergeStatic(body, { shadows: true });

  // Porthole with a letter inside (textured: kept apart).
  const portRing = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.07, 8, 24), toy('#ffd166', 90));
  portRing.position.set(0, 1.4, 1.245);
  portRing.rotation.x = -0.08;
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.31, 24), new THREE.MeshBasicMaterial({ map: envelopeTexture() }));
  glass.position.set(0, 1.4, 1.235);
  glass.rotation.x = -0.08;
  root.add(portRing, glass);

  // The glass bubble over the cockpit, hinged at the back of the rim.
  const dome = new THREE.Group();
  dome.position.set(0, 2.6, -0.95);
  const bubble = new THREE.Mesh(
    new THREE.SphereGeometry(1.0, seg, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhongMaterial({ color: '#cdeeff', transparent: true, opacity: 0.22, shininess: 140, specular: new THREE.Color('#ffffff'), depthWrite: false, side: THREE.DoubleSide })
  );
  bubble.position.z = 0.95;
  bubble.renderOrder = 2;
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }));
  shine.scale.set(1, 1.6, 0.4);
  shine.position.set(-0.45, 0.62, 1.5);
  shine.rotation.z = 0.5;
  dome.add(bubble, shine);
  root.add(dome);

  // Seat for Ziggy.
  const seat = new THREE.Group();
  seat.position.set(0, 1.6, 0.05);
  root.add(seat);

  // Parcel rack behind the cockpit (the parcels for this delivery wait there).
  const rack = new THREE.Group();
  rack.position.set(0, 2.66, -1.0);
  root.add(rack);

  // Soft flames: two cones of glowing gradient + a halo.
  const flames = new THREE.Group();
  flames.position.y = 0.2;
  const fTex = flameTexture();
  const outer = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 1.4, 16, 1, true),
    new THREE.MeshBasicMaterial({ map: fTex, color: '#ffb35c', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
  );
  outer.rotation.x = Math.PI;
  outer.position.y = -0.7;
  const inner = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.9, 12, 1, true),
    new THREE.MeshBasicMaterial({ map: fTex, color: '#fff6c8', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
  );
  inner.rotation.x = Math.PI;
  inner.position.y = -0.45;
  const halo = glow('#ffb35c', 2.2, 0.8);
  halo.position.y = -0.3;
  flames.add(outer, inner, halo);
  root.add(flames);

  const setThrust = (k: number, t: number) => {
    flames.visible = k > 0.02;
    const flick = 1 + Math.sin(t * 40) * 0.08 + Math.sin(t * 23) * 0.06;
    flames.scale.set(0.6 + k * 0.4, (0.35 + k * 0.9) * flick, 0.6 + k * 0.4);
    (halo.material as THREE.SpriteMaterial).opacity = 0.35 + k * 0.5;
  };
  setThrust(0, 0);
  return { root, seat, dome, flames, setThrust, tail: new THREE.Vector3(0, -0.4, 0), rack };
}

/* ───────────────────────── Parcels ───────────────────────── */

export type Parcel = THREE.Group & { userData: { lid: THREE.Group } };

/** A kraft cardboard parcel with tape, a lid that pops off, and an address label. */
export function makeParcel(stampColor: string, size = 0.5): Parcel {
  const g = new THREE.Group() as Parcel;
  const kraft = mat('#c99a62', { flatShading: false });
  const tape = mat('#a8743f', { flatShading: false });
  const box = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.8, size), kraft);
  box.position.y = size * 0.4;
  box.castShadow = true;
  const strip = new THREE.Mesh(new THREE.BoxGeometry(size * 0.2, size * 0.81, size * 1.01), tape);
  strip.position.y = size * 0.4;
  g.add(box, strip);
  const lid = new THREE.Group();
  lid.position.y = size * 0.8;
  const top = new THREE.Mesh(new THREE.BoxGeometry(size * 1.06, size * 0.14, size * 1.06), kraft);
  top.position.y = size * 0.05;
  const topTape = new THREE.Mesh(new THREE.BoxGeometry(size * 0.2, size * 0.15, size * 1.07), tape);
  topTape.position.y = size * 0.05;
  lid.add(top, topTape);
  g.add(lid);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.62, size * 0.46), new THREE.MeshLambertMaterial({ map: parcelLabel(stampColor) }));
  label.position.set(size * 0.12, size * 0.4, size * 0.505);
  g.add(label);
  g.userData.lid = lid;
  return g;
}

/* ───────────────────────── Presents ───────────────────────── */

/** What's inside the parcel. Origin at the bottom, about 0.8 tall. */
export function makeGift(id: GiftId): THREE.Group {
  const g = new THREE.Group();
  switch (id) {
    case 'sock': {
      const tex = stripes(['#e2453c', '#ffffff', '#ffd166', '#ffffff'], false, 8);
      tex.repeat.set(1, 2);
      const m = new THREE.MeshLambertMaterial({ map: tex });
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.7, 6, 12), m);
      leg.position.y = 0.6;
      const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.42, 6, 12), m);
      foot.rotation.z = Math.PI / 2;
      foot.position.set(0.22, 0.2, 0);
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 8, 16), mat('#ffffff', { flatShading: false }));
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = 1.0;
      g.add(leg, foot, cuff);
      break;
    }
    case 'sunglasses': {
      const lensM = toy('#1d1d2e', 120);
      const frameM = toy('#ff7ab8', 60);
      for (const x of [-0.26, 0.26]) {
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 20), lensM);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(x, 0.3, 0);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.035, 6, 20), frameM);
        ring.position.set(x, 0.3, 0.01);
        g.add(lens, ring);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.04), frameM);
      bridge.position.y = 0.36;
      g.add(bridge);
      break;
    }
    case 'fan': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.1, 16), toy('#7fd0ff'));
      base.position.y = 0.05;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), toy('#ffffff'));
      stem.position.y = 0.33;
      const head = new THREE.Group();
      head.position.set(0, 0.68, 0.02);
      const cage = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 24), toy('#7fd0ff'));
      const blades = new THREE.Group();
      blades.name = 'spin';
      for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 6), toy('#ffffff'));
        b.scale.set(1, 0.45, 0.12);
        const a = (i / 3) * Math.PI * 2;
        b.position.set(Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0);
        b.rotation.z = a;
        blades.add(b);
      }
      head.add(cage, blades);
      g.add(base, stem, head);
      break;
    }
    case 'plant': {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.19, 0.34, 14), toy('#d9784a', 20));
      pot.position.y = 0.17;
      const soil = new THREE.Mesh(new THREE.CircleGeometry(0.24, 14), mat('#6b4226'));
      soil.rotation.x = -Math.PI / 2;
      soil.position.y = 0.33;
      g.add(pot, soil);
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), toy('#4caf50', 20));
        leaf.scale.set(0.6, 1.4, 0.3);
        const a = (i / 5) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 0.11, 0.5, Math.sin(a) * 0.11);
        leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
        g.add(leaf);
      }
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), toy('#ffd166'));
      flower.position.y = 0.72;
      g.add(flower);
      for (let i = 0; i < 6; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), toy('#ff7ab8'));
        const a = (i / 6) * Math.PI * 2;
        p.position.set(Math.cos(a) * 0.12, 0.72 + Math.sin(a) * 0.12, 0);
        g.add(p);
      }
      break;
    }
    case 'ball': {
      const tex = stripes(['#e2453c', '#ffffff', '#3f7fe0', '#ffffff', '#ffd166', '#ffffff'], true, 6);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), new THREE.MeshPhongMaterial({ map: tex, shininess: 70 }));
      ball.position.y = 0.34;
      ball.name = 'ball';
      g.add(ball);
      break;
    }
    case 'bucket': {
      const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.4, 16, 1, true), toy('#3fbf6a', 40, { side: THREE.DoubleSide }));
      bucket.position.y = 0.2;
      const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), toy('#3fbf6a'));
      bottom.rotation.x = -Math.PI / 2;
      bottom.position.y = 0.01;
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.02, 6, 16, Math.PI), toy('#ffd166'));
      handle.position.y = 0.38;
      const spade = new THREE.Group();
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.03), toy('#ffd166'));
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6), toy('#ff7ab8'));
      stick.position.y = 0.3;
      spade.add(blade, stick);
      spade.position.set(0.12, 0.45, 0);
      spade.rotation.z = -0.4;
      g.add(bucket, bottom, handle, spade);
      break;
    }
    case 'pizza': {
      const crust = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.08, 24), toy('#f0b860', 20));
      crust.position.y = 0.04;
      const sauce = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.09, 24), toy('#e2553c', 30));
      sauce.position.y = 0.05;
      const cheese = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.1, 24), toy('#ffe08a', 30));
      cheese.position.y = 0.055;
      g.add(crust, sauce, cheese);
      for (let i = 0; i < 7; i++) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.11, 12), toy('#b8322b', 30));
        const a = i * 2.4;
        const r = i === 0 ? 0 : 0.3;
        p.position.set(Math.cos(a) * r, 0.06, Math.sin(a) * r);
        g.add(p);
      }
      g.rotation.x = 0.9;
      const holder = new THREE.Group();
      holder.add(g);
      g.position.y = 0.4;
      return holder;
    }
    case 'hoop': {
      const tex = stripes(['#ff7ab8', '#ffd166', '#7fd0ff', '#9bf07f'], true, 12);
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 8, 40), new THREE.MeshPhongMaterial({ map: tex, shininess: 60 }));
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = 0.06;
      hoop.name = 'hoop';
      g.add(hoop);
      break;
    }
    case 'pillow': {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 12), toy('#b38cff', 20));
      p.scale.set(1.2, 0.45, 0.85);
      p.position.y = 0.2;
      g.add(p);
      for (const [x, z] of [
        [-0.44, -0.3],
        [0.44, -0.3],
        [-0.44, 0.3],
        [0.44, 0.3],
      ]) {
        const tassel = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), toy('#ffd166'));
        tassel.position.set(x, 0.2, z);
        g.add(tassel);
      }
      break;
    }
    case 'hat': {
      const tex = stripes(['#3f7fe0', '#ffffff', '#e2453c', '#ffffff'], false, 8);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex }));
      cap.scale.y = 1.15;
      cap.position.y = 0.1;
      const brim = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.08, 8, 24), toy('#e2453c', 10));
      brim.rotation.x = Math.PI / 2;
      brim.position.y = 0.1;
      const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), toy('#ffffff', 5));
      pom.position.y = 0.55;
      g.add(cap, brim, pom);
      break;
    }
  }
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
}

/* ───────────────────────── Inhabitants ───────────────────────── */

export interface AlienSpec {
  color: string;
  belly: string;
  eyes: 1 | 2 | 3;
  stalks?: boolean;
  ears?: 'bunny' | 'fins' | 'horns' | 'none';
  antennas?: 0 | 1 | 2;
  spots?: string;
  belt?: string;
  chubby?: boolean;
  feet?: 2 | 3;
}

/** The (imaginary) inhabitants: friendly, round, with big eyes. */
export const ALIENS: Record<BodyId, AlienSpec> = {
  mercury: { color: '#f4a261', belly: '#ffd6a8', eyes: 1, antennas: 1, ears: 'horns', feet: 2 },
  venus: { color: '#ffd166', belly: '#fff2c4', eyes: 2, stalks: true, antennas: 0, spots: '#f4a261', feet: 2 },
  earth: { color: '#7bd389', belly: '#d6f5da', eyes: 2, antennas: 2, ears: 'none', feet: 2 },
  moon: { color: '#d7d0ff', belly: '#f6f3ff', eyes: 2, ears: 'bunny', antennas: 0, feet: 2 },
  mars: { color: '#ff6f91', belly: '#ffd0dc', eyes: 3, antennas: 1, ears: 'none', feet: 3 },
  jupiter: { color: '#ffb38a', belly: '#ffe3cf', eyes: 2, antennas: 2, chubby: true, belt: '#c4553a', feet: 2 },
  saturn: { color: '#b39ddb', belly: '#e9e0fb', eyes: 2, antennas: 1, belt: '#ffd166', feet: 2 },
  uranus: { color: '#72efdd', belly: '#d4fbf5', eyes: 1, stalks: true, antennas: 0, ears: 'fins', feet: 2 },
  neptune: { color: '#5e8bff', belly: '#cfdcff', eyes: 2, antennas: 1, ears: 'fins', spots: '#3f63d9', feet: 3 },
};

export type AlienCue = 'wave' | 'joy' | 'receive' | 'sneeze' | 'spin' | 'hold';

/** A little animation rig for an inhabitant. */
export class Alien {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  /** On top of the head (hats, socks). */
  readonly top = new THREE.Group();
  /** In front of the eyes (sunglasses). */
  readonly face = new THREE.Group();
  /** Around the waist (hoop). */
  readonly waist = new THREE.Group();
  /** Above the head, held up with both hands. */
  readonly hands = new THREE.Group();
  readonly mouthPos = new THREE.Vector3();
  private arms: THREE.Group[] = [];
  private eyes: THREE.Group[] = [];
  private smile: THREE.Mesh;
  private ohMouth: THREE.Mesh;
  private antennaTips: THREE.Object3D[] = [];
  private cueKind: AlienCue | null = null;
  private cueT = 0;
  private t = Math.random() * 10;
  private blinkAt = 1.5;
  private holdUp = 0;
  /** 0..1, motion amplitude (reduced motion). */
  energy = 1;
  /** Called at the peak of a sneeze (for the star burst). */
  onSneeze: (() => void) | null = null;
  private sneezed = false;
  readonly height: number;

  constructor(spec: AlienSpec, lowPower = false) {
    const seg = lowPower ? 14 : 22;
    const skin = toy(spec.color, 30);
    const r = spec.chubby ? 0.82 : 0.7;
    const h = spec.chubby ? 1.0 : 1.15;
    this.height = 0.25 + r * h * 2 + (spec.antennas ? 0.5 : 0.1);
    this.root.add(this.body);
    const torso = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), skin);
    torso.scale.set(1, h, 0.92);
    torso.position.y = 0.22 + r * h;
    torso.castShadow = true;
    this.body.add(torso);
    const cy = torso.position.y;
    const belly = new THREE.Mesh(new THREE.SphereGeometry(r * 0.62, seg, 10), toy(spec.belly, 20));
    belly.scale.set(1, 0.95, 0.45);
    belly.position.set(0, cy - r * 0.35, r * 0.62);
    this.body.add(belly);
    if (spec.spots) {
      const sm = toy(spec.spots, 20);
      for (let i = 0; i < 6; i++) {
        const a = i * 1.9 + 0.6;
        if (Math.cos(a) > -0.2 && Math.abs(Math.sin(a)) < 0.45) continue; // keep the face clear
        const yy = cy + Math.sin(i * 2.3) * r * 0.6;
        const k = Math.sqrt(Math.max(0, 1 - ((yy - cy) / (r * h)) ** 2));
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.09 + (i % 2) * 0.04, 8, 6), sm);
        s.scale.z = 0.35;
        s.position.set(Math.sin(a) * r * k * 0.98, yy, Math.cos(a) * r * k * 0.9);
        s.lookAt(s.position.x * 2, yy, s.position.z * 2);
        this.body.add(s);
      }
    }
    if (spec.belt) {
      const belt = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, 0.06, 8, 32), toy(spec.belt, 40));
      belt.rotation.x = Math.PI / 2;
      belt.position.y = cy - r * 0.15;
      belt.scale.z = 0.92;
      this.body.add(belt);
    }
    // Eyes.
    const eyeY = cy + r * h * 0.32;
    const eyeR = spec.eyes === 1 ? 0.27 : spec.eyes === 3 ? 0.15 : 0.19;
    const xs = spec.eyes === 1 ? [0] : spec.eyes === 2 ? [-0.24, 0.24] : [-0.3, 0, 0.3];
    const white = toy('#ffffff', 80);
    const pupilM = toy('#1d1d2e', 120);
    xs.forEach((x, i) => {
      const eye = new THREE.Group();
      const yOff = spec.eyes === 3 && i === 1 ? 0.14 : 0;
      if (spec.stalks) {
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 6), skin);
        stalk.position.set(x * 1.2, cy + r * h * 0.85 + 0.15, 0.1);
        stalk.rotation.z = -x * 0.8;
        this.body.add(stalk);
        eye.position.set(x * 1.45, cy + r * h * 0.85 + 0.42, 0.12);
      } else {
        const z = Math.sqrt(Math.max(0.01, r * r - x * x - ((eyeY + yOff - cy) / h) ** 2)) * 0.92;
        eye.position.set(x, eyeY + yOff, z - eyeR * 0.35);
      }
      const ball = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 16, 12), white);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.52, 12, 10), pupilM);
      pupil.position.z = eyeR * 0.62;
      const spark = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.18, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      spark.position.set(eyeR * 0.2, eyeR * 0.22, eyeR * 1.05);
      eye.add(ball, pupil, spark);
      this.eyes.push(eye);
      this.body.add(eye);
    });
    this.face.position.set(0, eyeY + 0.02, r * 0.95);
    this.body.add(this.face);
    // Mouth: a smile, or a round "oh".
    const mouthY = cy - r * h * 0.05;
    const mz = r * 0.93;
    this.smile = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.035, 6, 14, Math.PI), toy('#5a2340', 10));
    this.smile.rotation.z = Math.PI;
    this.smile.position.set(0, mouthY + 0.05, mz);
    this.ohMouth = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), toy('#5a2340', 10));
    this.ohMouth.scale.set(1, 1.2, 0.4);
    this.ohMouth.position.set(0, mouthY, mz);
    this.ohMouth.visible = false;
    this.mouthPos.set(0, mouthY, mz + 0.1);
    this.body.add(this.smile, this.ohMouth);
    // Cheeks.
    for (const x of [-0.36, 0.36]) {
      const ch = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), toy('#ff8fb3', 5, { transparent: true, opacity: 0.75 }));
      ch.scale.z = 0.3;
      ch.position.set(x, mouthY + 0.08, r * 0.86);
      ch.lookAt(x * 3, mouthY + 0.08, r * 3);
      this.body.add(ch);
    }
    // Antennas with glowing tips.
    const topY = cy + r * h;
    for (let i = 0; i < (spec.antennas ?? 0); i++) {
      const x = spec.antennas === 1 ? 0 : i ? 0.22 : -0.22;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.42, 6), skin);
      stalk.position.set(x, topY + 0.15, 0);
      stalk.rotation.z = -x * 1.2;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), glowMat('#ffe066', 1.3));
      tip.position.set(x * 1.9, topY + 0.38, 0);
      this.antennaTips.push(tip);
      this.body.add(stalk, tip);
    }
    if (spec.ears === 'bunny') {
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.45, 4, 10), skin);
        ear.position.set(s * 0.25, topY + 0.25, -0.05);
        ear.rotation.z = -s * 0.25;
        const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.32, 4, 8), toy('#ffc2dc', 10));
        inner.position.set(s * 0.25 + s * 0.005, topY + 0.25, 0.05);
        inner.rotation.z = -s * 0.25;
        this.body.add(ear, inner);
      }
    } else if (spec.ears === 'fins') {
      for (const s of [-1, 1]) {
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 8), toy(spec.belly, 30));
        fin.position.set(s * r * 0.92, cy + 0.2, 0);
        fin.rotation.z = -s * 1.1;
        this.body.add(fin);
      }
    } else if (spec.ears === 'horns') {
      for (const s of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 8), toy('#fff3dc', 40));
        horn.position.set(s * 0.32, topY - 0.02, 0.05);
        horn.rotation.z = -s * 0.5;
        this.body.add(horn);
      }
    }
    this.top.position.set(0, topY - 0.05, 0);
    this.body.add(this.top);
    this.waist.position.set(0, cy - r * 0.2, 0);
    this.body.add(this.waist);
    this.hands.position.set(0, topY + 0.55, 0.25);
    this.body.add(this.hands);
    // Arms (pivot at the shoulder).
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * r * 0.9, cy - 0.05, 0.05);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.36, 4, 10), skin);
      arm.position.y = -0.22;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), toy(spec.belly, 20));
      hand.position.y = -0.46;
      pivot.add(arm, hand);
      pivot.rotation.z = s * 0.5;
      this.arms.push(pivot);
      this.body.add(pivot);
    }
    // Feet.
    const nf = spec.feet ?? 2;
    for (let i = 0; i < nf; i++) {
      const x = nf === 2 ? (i ? 0.26 : -0.26) : (i - 1) * 0.32;
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), toy(spec.color, 20));
      foot.scale.set(1, 0.55, 1.35);
      foot.position.set(x, 0.09, 0.12);
      foot.castShadow = true;
      this.root.add(foot);
    }
  }

  cue(kind: AlienCue) {
    this.cueKind = kind;
    this.cueT = 0;
    this.sneezed = false;
  }

  /** Hold something up (0 = arms down, 1 = both hands up). */
  setHold(k: number) {
    this.holdUp = k;
  }

  update(dt: number) {
    this.t += dt;
    const t = this.t;
    const E = this.energy;
    let y = Math.abs(Math.sin(t * 2.2)) * 0.04 * E;
    let sq = Math.sin(t * 4.4) * 0.02 * E;
    let tilt = Math.sin(t * 1.3) * 0.05 * E;
    let pitch = 0;
    let spin = 0;
    let armL = 0.5 + Math.sin(t * 2.2) * 0.08 * E;
    let armR = 0.5 + Math.sin(t * 2.2 + 1) * 0.08 * E;
    let fwd = 0;
    let oh = false;
    if (this.holdUp > 0) {
      armL = armR = 0.5 + (2.7 - 0.5) * this.holdUp;
      fwd = -0.2 * this.holdUp;
    }
    if (this.cueKind) {
      this.cueT += dt;
      const c = this.cueT;
      switch (this.cueKind) {
        case 'wave': {
          const d = 1.6;
          const w = Math.min(1, c / 0.2, (d - c) / 0.2);
          armR = 0.5 + 2.2 * w + Math.sin(c * 14) * 0.35 * w * E;
          tilt += 0.1 * w;
          if (c > d) this.cueKind = null;
          break;
        }
        case 'joy': {
          const d = 1.6;
          const hop = Math.max(0, Math.sin((c / d) * Math.PI * 2));
          y += hop * 0.55 * E;
          sq += -hop * 0.06 + (hop < 0.1 ? 0.05 : 0);
          armL = armR = 2.6;
          if (c > d) this.cueKind = null;
          break;
        }
        case 'spin': {
          const d = 1.0;
          spin = (Math.min(1, c / d) * Math.PI * 2) * (E > 0.5 ? 1 : 0);
          y += Math.sin(Math.min(1, c / d) * Math.PI) * 0.35 * E;
          armL = armR = 1.8;
          if (c > d) this.cueKind = null;
          break;
        }
        case 'receive': {
          const d = 1.2;
          const w = Math.min(1, c / 0.25, (d - c) / 0.25);
          fwd = 1.1 * w;
          armL = armR = 0.5 + 0.2 * w;
          if (c > d) this.cueKind = null;
          break;
        }
        case 'sneeze': {
          // Inhale (lean back, stretch), then ATCHOUM (snap forward, squash).
          if (c < 1.0) {
            const k = Math.sin((c / 1.0) * Math.PI * 0.5);
            pitch = -0.35 * k * E;
            sq += 0.1 * k;
            oh = true;
            armL = armR = 0.5 + 0.9 * k;
          } else if (c < 1.6) {
            const k = 1 - (c - 1.0) / 0.6;
            pitch = 0.45 * k * E;
            sq -= 0.12 * k;
            if (!this.sneezed) {
              this.sneezed = true;
              this.onSneeze?.();
            }
          } else this.cueKind = null;
          break;
        }
        case 'hold':
          this.cueKind = null;
          break;
      }
    }
    this.body.position.y = y;
    this.body.scale.set(1 - sq * 0.5, 1 + sq, 1 - sq * 0.5);
    this.body.rotation.set(pitch, spin, tilt);
    this.arms[0].rotation.set(-fwd, 0, -armL);
    this.arms[1].rotation.set(-fwd, 0, armR);
    this.smile.visible = !oh;
    this.ohMouth.visible = oh;
    // Blink.
    if (t > this.blinkAt) {
      const k = (t - this.blinkAt) / 0.15;
      const s = k < 1 ? 1 - Math.sin(k * Math.PI) * 0.9 : 1;
      for (const e of this.eyes) e.scale.y = s;
      if (k >= 1) this.blinkAt = t + 2 + Math.random() * 3;
    }
    for (const [i, a] of this.antennaTips.entries()) a.position.x += Math.sin(t * 6 + i) * 0.0015 * E;
  }
}

/* ───────────────────────── Overview: the solar system ───────────────────────── */

export interface PlanetView {
  id: BodyId;
  group: THREE.Group;
  /** The sphere (spins on its axis). */
  ball: THREE.Mesh;
  radius: number;
  /** Invisible bigger sphere for taps. */
  hit: THREE.Mesh;
  extra?: THREE.Object3D;
}

/** Stylised layout: distances are not to scale, sizes keep the right order. */
export const LAYOUT: Record<BodyId, { x: number; z: number; r: number; tilt: number; spin: number }> = {
  mercury: { x: 4.7, z: -0.8, r: 0.42, tilt: 0, spin: 0.25 },
  venus: { x: 6.7, z: 0.9, r: 0.66, tilt: 3.1, spin: -0.12 },
  earth: { x: 9.0, z: -0.7, r: 0.7, tilt: 0.41, spin: 0.5 },
  moon: { x: 9.0, z: -0.7, r: 0.21, tilt: 0, spin: 0 },
  mars: { x: 11.4, z: 1.0, r: 0.52, tilt: 0.44, spin: 0.48 },
  jupiter: { x: 15.2, z: -1.1, r: 1.6, tilt: 0.05, spin: 0.9 },
  saturn: { x: 20.0, z: 1.2, r: 1.35, tilt: 0.47, spin: 0.8 },
  uranus: { x: 24.0, z: -1.0, r: 0.95, tilt: 1.71, spin: 0.6 },
  neptune: { x: 27.4, z: 0.9, r: 0.92, tilt: 0.49, spin: 0.6 },
};
export const MOON_ORBIT = 1.35;
export const SUN_RADIUS = 2.6;
export const POST_SPOT = new THREE.Vector3(1.6, 0, 4.4);
export const BELT = { inner: 12.9, outer: 13.9 };

export function makeSun(): { group: THREE.Group; rays: THREE.Sprite; glows: THREE.Sprite[] } {
  const group = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(SUN_RADIUS, 32, 20), new THREE.MeshBasicMaterial({ map: sunMap(), color: new THREE.Color('#ffffff').multiplyScalar(1.25), toneMapped: false }));
  const rays = new THREE.Sprite(new THREE.SpriteMaterial({ map: raysTexture(), color: '#ffd27a', transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
  rays.scale.setScalar(SUN_RADIUS * 4.6);
  const g1 = glow('#ffe08a', SUN_RADIUS * 3.0, 0.9);
  const g2 = glow('#ff9a3c', SUN_RADIUS * 5.5, 0.4);
  group.add(rays, g2, g1, ball);
  return { group, rays, glows: [g1, g2] };
}

export function makePlanet(id: BodyId, lowPower: boolean): PlanetView {
  const L = LAYOUT[id];
  const group = new THREE.Group();
  const seg = lowPower ? 28 : 40;
  const axis = new THREE.Group();
  axis.rotation.z = L.tilt;
  group.add(axis);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(L.r, seg, Math.round(seg * 0.7)), new THREE.MeshLambertMaterial({ map: planetMap(id, lowPower) }));
  axis.add(ball);
  let extra: THREE.Object3D | undefined;
  if (id === 'earth') {
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(L.r * 1.03, seg, Math.round(seg * 0.7)), new THREE.MeshLambertMaterial({ map: earthClouds(), transparent: true, depthWrite: false }));
    clouds.name = 'clouds';
    axis.add(clouds);
    const atmo = glow('#7fc4ff', L.r * 3.0, 0.32);
    group.add(atmo);
  }
  if (id === 'saturn' || id === 'uranus') {
    const inner = L.r * (id === 'saturn' ? 1.25 : 1.5);
    const outer = L.r * (id === 'saturn' ? 2.25 : 1.95);
    const geo = new THREE.RingGeometry(inner, outer, 96, 1);
    // u runs from the inner to the outer edge.
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const d = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (d - inner) / (outer - inner), 0.5);
    }
    const ring = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: ringTexture(id), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 1;
    axis.add(ring);
    extra = ring;
  }
  if (id === 'venus') group.add(glow('#ffe7a8', L.r * 2.8, 0.28));
  if (id === 'neptune' || id === 'uranus') group.add(glow(id === 'neptune' ? '#7f9cff' : '#a6f0f2', L.r * 2.7, 0.22));
  const hit = new THREE.Mesh(new THREE.SphereGeometry(Math.max(L.r * 1.35, 1.05), 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hit.userData.body = id;
  group.add(hit);
  group.position.set(L.x, 0, L.z);
  group.userData.axis = axis;
  return { id, group, ball, radius: L.r, hit, extra };
}

/** Thin glowing orbits (one draw call). */
export function makeOrbits(): THREE.Mesh {
  const geos: THREE.BufferGeometry[] = [];
  for (const id of ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'] as BodyId[]) {
    const L = LAYOUT[id];
    const r = Math.hypot(L.x, L.z);
    const g = new THREE.RingGeometry(r - 0.035, r + 0.035, 220, 1);
    g.rotateX(-Math.PI / 2);
    g.deleteAttribute('uv');
    geos.push(g);
  }
  const merged = mergeGeometries(geos, false)!;
  geos.forEach((g) => g.dispose());
  return new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ color: '#8fa6ff', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
}

/** The asteroid belt between Mars and Jupiter (instanced: one draw call). */
export function makeBelt(count: number, seed = 3): THREE.InstancedMesh {
  const geo = new THREE.DodecahedronGeometry(0.09, 0);
  const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ flatShading: true }), count);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2;
    const d = BELT.inner + r() * (BELT.outer - BELT.inner);
    dummy.position.set(Math.cos(a) * d, (r() - 0.5) * 0.35, Math.sin(a) * d);
    dummy.rotation.set(r() * 3, r() * 3, r() * 3);
    dummy.scale.setScalar(0.5 + r() * 1.3);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
    m.setColorAt(i, col.set(r() < 0.5 ? '#9c8f80' : '#bfae98'));
  }
  return m;
}

/** The post office: a little asteroid with a yellow mailbox and a landing pad. */
export function makePostOffice(): THREE.Group {
  const g = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 1), mat('#8d7f9e'));
  rock.scale.set(1.25, 0.55, 1.1);
  rock.position.y = -0.35;
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.08, 24), mat('#e8e6f5', { flatShading: false }));
  pad.position.set(-0.25, 0.12, 0.1);
  const padRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 6, 24), mat('#ffd166'));
  padRing.rotation.x = Math.PI / 2;
  padRing.position.set(-0.25, 0.17, 0.1);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.3), toy('#ffcc33', 50));
  box.position.set(0.7, 0.45, -0.1);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.34, 12, 1, false, 0, Math.PI), toy('#ffcc33', 50));
  roof.rotation.z = Math.PI / 2;
  roof.position.set(0.7, 0.66, -0.1);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.02), mat('#3a2a10'));
  slot.position.set(0.7, 0.55, 0.06);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 6), mat('#6b6f88'));
  post.position.set(0.7, 0.12, -0.1);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.14), mat('#e2453c'));
  flag.position.set(0.88, 0.62, -0.06);
  g.add(rock, pad, padRing, box, roof, slot, post, flag);
  mergeStatic(g);
  const lamp = glow('#ffd166', 1.3, 0.55);
  lamp.position.set(-0.25, 0.3, 0.1);
  g.add(lamp);
  return g;
}

/** A sphere textured like a body (for the sky of a landing scene). */
export function makeSkyBody(id: BodyId, radius: number, lowPower: boolean): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, lowPower ? 28 : 40, 24), new THREE.MeshBasicMaterial({ map: planetMap(id, lowPower), fog: false }));
  return m;
}
