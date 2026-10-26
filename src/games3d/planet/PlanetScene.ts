import * as THREE from 'three';
import { createRenderer, disposeTree, glow, mat, prefersLowPower } from '../kit/look';
import { makePine, makeZiggy, PALETTE } from '../kit/models';
import { rng } from '../kit/rng';

/**
 * Ziggy's little planet for the home page: a low-poly world that turns slowly,
 * with landmarks (castle, rocket, snowy pines, palm, big tree, moonlit house)
 * and Ziggy waving on top. Drag to spin it; hotspots are projected to the
 * screen so the page can place real, accessible links over them.
 */
export interface Hotspot {
  id: string;
  /** Point on the planet (local), the label follows it. */
  local: THREE.Vector3;
}

export interface HotspotScreen {
  id: string;
  x: number;
  y: number;
  /** Facing the viewer (visible) or behind the planet. */
  front: boolean;
}

const R = 3;

function onSphere(lat: number, lon: number, r = R): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const th = (lon * Math.PI) / 180;
  return new THREE.Vector3(r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
}

/** Place an object on the surface, standing "up" along the normal. */
function plant(obj: THREE.Object3D, lat: number, lon: number, lift = 0) {
  const p = onSphere(lat, lon, R + lift);
  obj.position.copy(p);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
  return obj;
}

function castle(): THREE.Group {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.6), mat('#f6dbe8'));
  wall.position.y = 0.27;
  g.add(wall);
  for (const [x, z] of [
    [-0.45, -0.3],
    [0.45, -0.3],
    [-0.45, 0.3],
    [0.45, 0.3],
  ]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.8, 8), mat('#fbe7f0'));
    t.position.set(x, 0.4, z);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.32, 8), mat('#ec5f9a'));
    roof.position.set(x, 0.96, z);
    g.add(t, roof);
  }
  const flag = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 3), mat(PALETTE.yellow));
  flag.position.set(0.45, 1.2, 0.3);
  flag.rotation.z = -Math.PI / 2;
  g.add(flag);
  return g;
}

function rocket(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.8, 10), mat('#f2f4fb'));
  body.position.y = 0.55;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 10), mat(PALETTE.red));
  nose.position.y = 1.11;
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10), new THREE.MeshBasicMaterial({ color: '#7fd0ff' }));
  win.position.set(0, 0.7, 0.165);
  g.add(body, nose, win);
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.22), mat(PALETTE.red));
    const a = (i / 3) * Math.PI * 2;
    fin.position.set(Math.cos(a) * 0.2, 0.25, Math.sin(a) * 0.2);
    fin.rotation.y = -a;
    g.add(fin);
  }
  const flame = glow('#ffb35c', 0.7, 0.9);
  flame.position.y = 0.08;
  g.add(flame);
  return g;
}

function palm(): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.9, 6), mat(PALETTE.trunk));
  trunk.position.y = 0.45;
  trunk.rotation.z = 0.15;
  g.add(trunk);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.6, 4), mat('#3fbf6a'));
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(0.07 + Math.cos(a) * 0.22, 0.88, Math.sin(a) * 0.22);
    leaf.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
    g.add(leaf);
  }
  return g;
}

function cottage(): THREE.Group {
  const g = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.5), mat('#f1d3a8'));
  walls.position.y = 0.22;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.4, 4), mat('#6a6ee8'));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 0.64;
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.14), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(1.5), toneMapped: false }));
  win.position.set(0, 0.26, 0.255);
  g.add(walls, roof, win);
  const moonGlow = glow('#ffd27a', 0.6, 0.6);
  moonGlow.position.set(0, 0.26, 0.3);
  g.add(moonGlow);
  return g;
}

export class PlanetScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  private planet = new THREE.Group();
  private ziggy = makeZiggy();
  private moon = new THREE.Group();
  private clock = new THREE.Clock();
  private raf = 0;
  private visible = true;
  private spin = 0.12;
  private dragging: { x: number; y: number; rotY: number; rotX: number } | null = null;
  private velocity = 0;
  private hop = 0;
  private lowPower = prefersLowPower();
  private reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  private resize: ResizeObserver;
  readonly hotspots: Hotspot[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private onHotspots: (h: HotspotScreen[]) => void
  ) {
    this.renderer = createRenderer(canvas, { lowPower: this.lowPower });
    this.renderer.setClearColor(0x000000, 0);
    this.build();
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(canvas.parentElement ?? canvas);
    this.fit();
    canvas.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    this.loop();
  }

  private build() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#fff6e8', '#7a6ab0', 1.25));
    const sun = new THREE.DirectionalLight('#fff1d6', 2.1);
    sun.position.set(5, 6, 6);
    s.add(sun);
    const rim = new THREE.DirectionalLight('#9fc4ff', 1.1);
    rim.position.set(-6, 2, -4);
    s.add(rim);

    // Planet: an icosphere painted per face — meadows, sand, snow cap, a lake.
    const geo = new THREE.IcosahedronGeometry(R, 3);
    const pos = geo.attributes.position;
    const colors: number[] = [];
    const r = rng(7);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 3) {
      const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
      const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
      const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      const lake = Math.hypot(cx - 1.3, cy + 1.4, cz - 2.2) < 1.3;
      if (cy > 2.25) c.set('#f4f7ff');
      else if (lake) c.set(r() < 0.5 ? '#5fb6ea' : '#4fa5dc');
      else if (cy < -2.3) c.set('#f2d49b');
      else c.set(r() < 0.5 ? '#7fc85c' : r() < 0.5 ? '#8fd46a' : '#6fb94f');
      for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ball = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    this.planet.add(ball);
    // Soft atmosphere halo.
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 32, 24), new THREE.MeshBasicMaterial({ color: '#bfe3ff', transparent: true, opacity: 0.12, side: THREE.BackSide }));
    this.planet.add(atmo);

    // Landmarks (each a hotspot for a section of the site).
    this.planet.add(plant(castle(), 25, 20));
    this.planet.add(plant(rocket(), 15, 120));
    const tree = makePine(0.42, false);
    this.planet.add(plant(tree, 30, -60));
    for (const [la, lo] of [
      [62, 40],
      [58, 90],
      [66, 150],
      [55, -120],
    ])
      this.planet.add(plant(makePine(0.24, true), la, lo));
    this.planet.add(plant(palm(), -20, 60));
    this.planet.add(plant(palm(), -28, 75));
    this.planet.add(plant(cottage(), -10, -150));
    this.hotspots.push(
      { id: 'world', local: onSphere(25, 20, R + 1.3) },
      { id: 'games3d', local: onSphere(15, 120, R + 1.4) },
      { id: 'coloring', local: onSphere(-20, 60, R + 1.2) },
      { id: 'dodo', local: onSphere(-10, -150, R + 1.0) },
      { id: 'lab', local: onSphere(30, -60, R + 1.4) }
    );

    // Ziggy on the north pole, waving.
    this.ziggy.scale.setScalar(0.55);
    this.ziggy.position.y = R - 0.05;
    this.planet.add(this.ziggy);

    // A little moon with its own glow, and stars.
    const moonBall = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), mat('#f6eccb'));
    this.moon.add(moonBall, glow('#fff3c4', 2.2, 0.45));
    s.add(this.moon);
    const starGeo = new THREE.BufferGeometry();
    const sp: number[] = [];
    for (let i = 0; i < 160; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const d = 14 + Math.random() * 6;
      sp.push(Math.cos(a) * Math.cos(b) * d, Math.sin(b) * d, Math.sin(a) * Math.cos(b) * d - 8);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    s.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffd77a', size: 0.12 })));

    this.planet.rotation.x = 0.35;
    s.add(this.planet);
    this.camera.position.set(0, 0.9, 15.5);
    this.camera.lookAt(0, 0.6, 0);
  }

  private fit() {
    const el = this.canvas.parentElement ?? this.canvas;
    const w = el.clientWidth || 600;
    const h = el.clientHeight || 500;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.position.z = w < h ? 19 : 15.5;
    this.camera.updateProjectionMatrix();
  }

  setVisible(v: boolean) {
    this.visible = v;
  }

  /** Ziggy jumps and spins (when the child taps him or the planet). */
  wave() {
    this.hop = 1;
  }

  private onDown = (e: PointerEvent) => {
    this.dragging = { x: e.clientX, y: e.clientY, rotY: this.planet.rotation.y, rotX: this.planet.rotation.x };
    this.velocity = 0;
  };
  private onMove = (e: PointerEvent) => {
    const d = this.dragging;
    if (!d) return;
    const ny = d.rotY + (e.clientX - d.x) * 0.008;
    this.velocity = ny - this.planet.rotation.y;
    this.planet.rotation.y = ny;
    this.planet.rotation.x = Math.max(-0.2, Math.min(0.9, d.rotX + (e.clientY - d.y) * 0.004));
  };
  private onUp = (e: PointerEvent) => {
    const d = this.dragging;
    this.dragging = null;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) this.wave();
  };

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.visible) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    if (!this.dragging) {
      this.velocity *= 0.95;
      this.planet.rotation.y += this.reduced ? 0 : this.spin * dt + this.velocity;
    }
    // Ziggy: idle bounce, waving arm, a happy hop when tapped.
    const p = this.ziggy.userData.parts;
    this.hop = Math.max(0, this.hop - dt * 1.4);
    const jump = Math.sin(this.hop * Math.PI) * 1.2;
    this.ziggy.position.y = R - 0.05 + jump * 0.55 + (this.reduced ? 0 : Math.abs(Math.sin(t * 2.2)) * 0.06);
    this.ziggy.rotation.y = -this.planet.rotation.y + Math.sin(t * 0.7) * 0.4 + this.hop * Math.PI * 2;
    const armR = p.arms.children.find((a) => a.name === 'armR');
    if (armR) armR.rotation.z = -2.2 + Math.sin(t * 6) * 0.45;
    p.antennas.rotation.z = Math.sin(t * 3) * 0.12;
    // The moon orbits.
    this.moon.position.set(Math.cos(t * 0.35) * 5.2, 1.6 + Math.sin(t * 0.35) * 0.8, Math.sin(t * 0.35) * 5.2);
    this.renderer.render(this.scene, this.camera);

    // Hotspot positions for the HTML labels.
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    const camDir = this.camera.position.clone().normalize();
    this.onHotspots(
      this.hotspots.map((hs) => {
        const world = this.planet.localToWorld(hs.local.clone());
        const front = world.clone().normalize().dot(camDir) > 0.15;
        const v = world.project(this.camera);
        return { id: hs.id, x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, front };
      })
    );
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resize.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    disposeTree(this.scene);
    this.renderer.dispose();
  }
}
