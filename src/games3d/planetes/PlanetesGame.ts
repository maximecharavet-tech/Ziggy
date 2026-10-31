import * as THREE from 'three';
import { Post } from '../kit/post';
import { createRenderer, disposeTree, glow, glowTex, prefersLowPower, studioEnvironment } from '../kit/look';
import { makeZiggy, type ZiggyActor } from '../kit/models';
import { Puffs } from '../kit/world';
import { SpaceAudio } from './audio';
import { BODIES, BODY, REVEAL_AFTER, checkAnswer, type BodyId, type Delivery } from './logic';
import {
  ALIENS,
  Alien,
  LAYOUT,
  MOON_ORBIT,
  POST_SPOT,
  makeBelt,
  makeGift,
  makeOrbits,
  makeParcel,
  makePlanet,
  makePostOffice,
  makeRocket,
  makeSun,
  type Parcel,
  type PlanetView,
  type Rocket,
} from './models';
import { buildStage, type Stage } from './stage';
import { haloRingTexture, nameTag, numberBadge, questionBubble, stampSprite, starTexture } from './textures';

/**
 * Le Facteur des Planètes — the three.js scene.
 *
 * Two places: the solar system seen from above (the riddle: pick a planet,
 * the rocket flies there), and a landing scene at character scale (Ziggy
 * hops out, hands over the parcels, the inhabitant opens them). The logic
 * (riddles, answers, words) lives in `logic.ts`; this file only animates and
 * reports events to the React player.
 */

export type Phase = 'intro' | 'ask' | 'fly' | 'detour' | 'land' | 'deliver' | 'opened' | 'depart' | 'end';

export interface PlanetesState {
  phase: Phase;
  index: number;
  tried: BodyId[];
  reveal: boolean;
  visited: BodyId[];
  target: BodyId | null;
}

export interface PlanetesCallbacks {
  onState: (s: PlanetesState) => void;
  /** A new delivery: read the riddle. */
  onAsk: (index: number) => void;
  /** Wrong address (the funny detour starts). */
  onWrong: (body: BodyId, mistakes: number, index: number) => void;
  /** A tap on a planet that isn't one of the choices: say its name. */
  onPeek: (body: BodyId) => void;
  /** Right address: the rocket lands. */
  onArrive: (index: number) => void;
  /** A parcel handed over (counted aloud). */
  onCount: (n: number) => void;
  /** The parcel is open: show the reaction and the fact; `next()` continues. */
  onOpened: (index: number, stats: { mistakes: number; durationMs: number }) => void;
  onFinish: () => void;
}

const ROCKET_SMALL = 0.27;
/** The rocket's landing pad on the post office asteroid. */
const POST_PAD = POST_SPOT.clone().add(new THREE.Vector3(-0.34, 0.36, 0.14));
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const easeOut = (k: number) => 1 - (1 - k) ** 3;

interface Tween {
  t: number;
  dur: number;
  fn: (k: number) => void;
  done?: () => void;
}

function bezier(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, t: number, out: THREE.Vector3) {
  const u = 1 - t;
  return out
    .copy(p0)
    .multiplyScalar(u * u * u)
    .addScaledVector(p1, 3 * u * u * t)
    .addScaledVector(p2, 3 * u * t * t)
    .addScaledVector(p3, t * t * t);
}

function makeSkyDome(): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color('#060a24') }, bottom: { value: new THREE.Color('#1a1240') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:
      'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float k = smoothstep(-0.15, 0.55, vP.y); gl_FragColor = vec4(mix(bottom, top, k), 1.0);\n#include <colorspace_fragment>\n}',
  });
  return new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), m);
}

function makeStarfield(count: number, size: number, seed: number, color = '#ffffff'): THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pos: number[] = [];
  for (let i = 0; i < count; i++) {
    const u = r() * 2 - 1;
    const a = r() * Math.PI * 2;
    const h = Math.sqrt(1 - u * u);
    pos.push(Math.cos(a) * h * 420, u * 420, Math.sin(a) * h * 420);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color, size, sizeAttenuation: false, map: glowTex(), transparent: true, depthWrite: false, fog: false }));
}

export class PlanetesGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1200);
  private tmpCam = new THREE.PerspectiveCamera(45, 1, 0.1, 1200);
  private post: Post;
  private clock = new THREE.Clock();
  private raf = 0;
  private running = false;
  private resize: ResizeObserver;
  private lowPower = prefersLowPower();
  private reduceMotion = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  private audio = new SpaceAudio();
  private dropEnv: () => void = () => {};
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private insets = { top: 0, bottom: 0 };

  // World
  private sky = makeSkyDome();
  private stars: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private brightStars: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private nebulae: THREE.Sprite[] = [];
  private system = new THREE.Group();
  private sun = makeSun();
  private planets = new Map<BodyId, PlanetView>();
  private halos = new Map<BodyId, THREE.Sprite>();
  private tags = new Map<BodyId, THREE.Sprite>();
  private badges: THREE.Sprite[] = [];
  private stamps: THREE.Sprite[] = [];
  private belt: THREE.InstancedMesh;
  private postOffice = makePostOffice();
  private ambient = new THREE.AmbientLight('#9aa0e0', 1.05);
  private sunLight = new THREE.PointLight('#fff1dc', 3.2, 0, 0);
  private hemi = new THREE.HemisphereLight('#ffffff', '#444444', 0);
  private key = new THREE.DirectionalLight('#ffffff', 0);
  private comet: { s: THREE.Sprite; v: THREE.Vector3; life: number } | null = null;
  private nextComet = 6;

  // Actors
  private rocket: Rocket;
  private ziggy: ZiggyActor;
  private alien: Alien | null = null;
  private stage: Stage | null = null;
  private stageProps: THREE.Object3D[] = [];
  private parcels: Parcel[] = [];
  private gift: THREE.Object3D | null = null;
  private giftAnim: ((dt: number, t: number) => void) | null = null;
  private bubble = questionBubble();
  private sparkles = new Puffs(glowTex());
  private starBurst = new Puffs(starTexture());
  private dust = new Puffs(glowTex());
  private fade: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

  // Rocket motion (overview)
  private rocketAt = new THREE.Vector3();
  private hover = true;
  private thrust = 0;
  private trailT = 0;
  private flying: { p: THREE.Vector3[]; t: number; dur: number; done: () => void } | null = null;
  private orbitLoop: { center: THREE.Vector3; r: number; a0: number; t: number; dur: number; done: () => void } | null = null;

  // Camera
  private view = { pos: new THREE.Vector3(0, 30, 30), look: new THREE.Vector3() };
  private cur = { pos: new THREE.Vector3(0, 30, 30), look: new THREE.Vector3() };
  private camRate = 2.2;
  private follow: (() => THREE.Vector3[]) | null = null;
  private followDir: THREE.Vector3 | null = null;

  // Game
  private phase: Phase = 'intro';
  private index = 0;
  private tried: BodyId[] = [];
  private visited: BodyId[] = [];
  private mistakes = 0;
  private askedAt = 0;
  private target: BodyId | null = null;
  private tweens: Tween[] = [];
  /** Waits on the game's own clock: sequences stay in step with the tweens on any device. */
  private waits: { t: number; fn: () => void }[] = [];
  private down: { x: number; y: number; t: number } | null = null;
  private perf = { frames: 0, time: 0, ratio: 0 };

  constructor(
    private canvas: HTMLCanvasElement,
    private plan: Delivery[],
    private opts: { locale: string },
    private cb: PlanetesCallbacks
  ) {
    this.renderer = createRenderer(canvas, { lowPower: this.lowPower });
    if (this.lowPower) this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMappingExposure = 1.05;
    this.post = new Post(this.renderer, this.scene, this.camera, { enabled: !this.lowPower, strength: 0.5, radius: 0.55, threshold: 1.05 });
    this.stars = makeStarfield(this.lowPower ? 700 : 1400, 2.2, 11);
    this.brightStars = makeStarfield(this.lowPower ? 90 : 160, 5, 23, '#fff3c8');
    this.belt = makeBelt(this.lowPower ? 150 : 300);
    this.rocket = makeRocket(this.lowPower);
    this.ziggy = makeZiggy({ lowPower: this.lowPower });
    this.dropEnv = studioEnvironment(this.renderer, this.ziggy, 0.5);
    if (this.reduceMotion) this.ziggy.userData.rig.energy = 0.35;
    const fadeMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false });
    this.fade = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), fadeMat);
    this.fade.position.z = -1;
    this.fade.renderOrder = 9999;
    this.fade.visible = false;
    this.build();
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onCancel);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(canvas.parentElement ?? canvas);
    this.fit();
    this.intro();
    this.cur.pos.copy(this.view.pos);
    this.cur.look.copy(this.view.look);
    this.start();
  }

  /* ───────────────────────── Building ───────────────────────── */

  private build() {
    const s = this.scene;
    s.add(this.sky, this.stars, this.brightStars, this.camera);
    this.camera.add(this.fade);
    const nebulaCols = ['#7a4fd0', '#2ec4b6', '#ff7ab8', '#3f7fe0'];
    nebulaCols.forEach((c, i) => {
      const n = glow(c, 260 + i * 40, 0.13);
      (n.material as THREE.SpriteMaterial).fog = false;
      const a = i * 1.7 + 0.4;
      n.position.set(Math.cos(a) * 380, -80 + i * 50, Math.sin(a) * 380);
      this.nebulae.push(n);
      s.add(n);
    });
    s.add(this.ambient, this.hemi, this.key, this.key.target);
    this.key.castShadow = true;
    const sm = this.lowPower ? 512 : 1024;
    this.key.shadow.mapSize.set(sm, sm);
    Object.assign(this.key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 60 });
    this.key.shadow.bias = -0.0008;
    this.key.shadow.normalBias = 0.03;

    // The solar system.
    const sys = this.system;
    sys.add(this.sunLight, this.sun.group, makeOrbits(), this.belt);
    const haloTex = haloRingTexture();
    for (const id of BODIES) {
      const p = makePlanet(id, this.lowPower);
      this.planets.set(id, p);
      sys.add(p.group);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: '#ffe8a0', transparent: true, depthWrite: false, opacity: 0.9 }));
      halo.visible = false;
      this.halos.set(id, halo);
      sys.add(halo);
      const tag = nameTag(BODY[id].label[this.opts.locale === 'fr' ? 'fr' : 'en'], BODY[id].color);
      tag.visible = false;
      this.tags.set(id, tag);
      sys.add(tag);
    }
    this.postOffice.position.copy(POST_SPOT);
    sys.add(this.postOffice);
    s.add(sys);

    // The rocket and Ziggy in his seat.
    this.ziggy.userData.rig.seated = true;
    this.ziggy.scale.setScalar(0.92);
    this.rocket.seat.add(this.ziggy);
    this.rocket.root.scale.setScalar(ROCKET_SMALL);
    sys.add(this.rocket.root);
    this.bubble.visible = false;
    s.add(this.bubble);
    s.add(this.sparkles.group, this.starBurst.group, this.dust.group);
    this.overviewLights(true);
  }

  private overviewLights(on: boolean) {
    this.ambient.intensity = on ? 1.05 : 0;
    this.sunLight.intensity = on ? 3.2 : 0;
    this.sky.material.uniforms.top.value.set('#060a24');
    this.sky.material.uniforms.bottom.value.set('#1a1240');
    this.stars.material.opacity = 1;
    this.brightStars.material.opacity = 1;
    for (const n of this.nebulae) n.visible = on;
    this.scene.fog = null;
    this.hemi.intensity = 0;
    this.key.intensity = 0;
    // Shadows only in the landing scenes.
    this.key.castShadow = !on;
  }

  /* ───────────────────────── Layout & camera ───────────────────────── */

  /** Heights (px) covered by the HUD at the top and bottom: the camera frames the rest. */
  setInsets(top: number, bottom: number) {
    this.insets = { top, bottom };
    this.refit();
  }

  private fit() {
    const el = this.canvas.parentElement ?? this.canvas;
    const w = el.clientWidth || 800;
    const h = el.clientHeight || 600;
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 55 : 45;
    this.camera.updateProjectionMatrix();
    // The fade plane covers the whole view.
    const hh = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 1.1;
    this.fade.scale.set((hh * this.camera.aspect) / 20 + 0.05, hh / 20 + 0.05, 1);
    this.refit();
  }

  private portrait() {
    return this.camera.aspect < 0.95;
  }

  /** Direction from the look point to the camera for the overview. */
  private overviewDir(): THREE.Vector3 {
    if (this.portrait()) {
      // Nearly from above: the far planets don't shrink, the line of planets fills the height.
      const p = THREE.MathUtils.degToRad(78);
      return new THREE.Vector3(-Math.cos(p), Math.sin(p), 0.0001).normalize();
    }
    const p = THREE.MathUtils.degToRad(52);
    return new THREE.Vector3(0.0001, Math.sin(p), Math.cos(p)).normalize();
  }

  /**
   * Frame a set of points in the free part of the screen (between the HUD's
   * top and bottom), looking from `dir`. Returns where the camera goes.
   */
  private frame(points: THREE.Vector3[], dir: THREE.Vector3, margin = 0.08, minDist = 3) {
    const cam = this.tmpCam;
    cam.fov = this.camera.fov;
    cam.aspect = this.camera.aspect;
    cam.updateProjectionMatrix();
    const H = Math.max(1, this.canvas.clientHeight || (this.canvas.parentElement?.clientHeight ?? 600));
    const top = Math.min(0.42, this.insets.top / H);
    const bottom = Math.min(0.42, this.insets.bottom / H);
    const yHi = 1 - 2 * top - margin;
    const yLo = -1 + 2 * bottom + margin;
    const xLim = 1 - margin;
    const center = new THREE.Vector3();
    for (const p of points) center.add(p);
    center.divideScalar(points.length);
    let dist = 25;
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const v = new THREE.Vector3();
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    for (let it = 0; it < 10; it++) {
      cam.position.copy(center).addScaledVector(dir, dist);
      cam.lookAt(center);
      cam.updateMatrixWorld();
      right.setFromMatrixColumn(cam.matrixWorld, 0);
      up.setFromMatrixColumn(cam.matrixWorld, 1);
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const p of points) {
        v.copy(p).project(cam);
        minX = Math.min(minX, v.x);
        maxX = Math.max(maxX, v.x);
        minY = Math.min(minY, v.y);
        maxY = Math.max(maxY, v.y);
      }
      const wy = dist * tanV;
      const wx = wy * cam.aspect;
      center.addScaledVector(right, ((minX + maxX) / 2) * wx * 0.9).addScaledVector(up, ((minY + maxY) / 2 - (yHi + yLo) / 2) * wy * 0.9);
      const s = Math.max((maxX - minX) / (2 * xLim), (maxY - minY) / Math.max(0.2, yHi - yLo));
      dist = Math.max(minDist, dist * (0.15 + 0.85 * s));
    }
    return { pos: center.clone().addScaledVector(dir, dist), look: center };
  }

  private setView(points: THREE.Vector3[], dir: THREE.Vector3, opts: { margin?: number; minDist?: number; snap?: boolean } = {}) {
    const f = this.frame(points, dir, opts.margin, opts.minDist);
    this.view.pos.copy(f.pos);
    this.view.look.copy(f.look);
    if (opts.snap) {
      this.cur.pos.copy(f.pos);
      this.cur.look.copy(f.look);
    }
  }

  private overviewPoints(): THREE.Vector3[] {
    const pts: THREE.Vector3[] = [
      new THREE.Vector3(0.6, 0, 0),
      POST_SPOT.clone().add(new THREE.Vector3(-1.6, 0, 0)),
      POST_SPOT.clone().add(new THREE.Vector3(1.4, 0, 0)),
      POST_SPOT.clone().add(new THREE.Vector3(0, 0, 1.5)),
      POST_SPOT.clone().add(new THREE.Vector3(0, 1.4, 0)),
    ];
    for (const id of BODIES) {
      const L = LAYOUT[id];
      const r = id === 'saturn' ? L.r * 2.2 : id === 'earth' ? MOON_ORBIT + 0.3 : L.r * 1.2;
      pts.push(new THREE.Vector3(L.x - r, 0, L.z), new THREE.Vector3(L.x + r, 0, L.z), new THREE.Vector3(L.x, 0, L.z - r), new THREE.Vector3(L.x, 0, L.z + r));
    }
    return pts;
  }

  private overview(snap = false) {
    this.follow = null;
    this.camRate = 1.8;
    this.setView(this.overviewPoints(), this.overviewDir(), { margin: 0.04, snap });
  }

  private refit() {
    if (this.follow) return;
    if (this.stage) this.stageView();
    else if (this.phase === 'ask' || this.phase === 'end') this.overview();
  }

  /* ───────────────────────── Overview ───────────────────────── */

  private planetPos(id: BodyId): THREE.Vector3 {
    return this.planets.get(id)!.group.position.clone();
  }

  /** A spot just in front of a planet (towards the camera), where the rocket stops. */
  private arrivalNear(id: BodyId): THREE.Vector3 {
    const p = this.planetPos(id);
    const r = LAYOUT[id].r * (id === 'saturn' ? 1.9 : 1) + 0.75;
    const toCam = this.overviewDir().setY(0).normalize();
    return p.add(toCam.multiplyScalar(r)).add(new THREE.Vector3(0, LAYOUT[id].r * 0.4 + 0.25, 0));
  }

  private intro() {
    this.phase = 'intro';
    this.rocketAt.copy(POST_PAD);
    this.rocket.root.position.copy(this.rocketAt);
    // Start close on the post office, then pull back to the whole system.
    const near = [POST_SPOT.clone().add(new THREE.Vector3(-1.2, 0, 0)), POST_SPOT.clone().add(new THREE.Vector3(1.2, 1.2, 0.5))];
    this.setView(near, this.overviewDir(), { snap: true, minDist: 4 });
    this.ziggy.userData.rig.cue('wave');
    this.later(this.reduceMotion ? 600 : 1500, () => {
      this.overview();
      this.later(this.reduceMotion ? 500 : 1400, () => this.ask());
    });
  }

  private emit() {
    this.cb.onState({ phase: this.phase, index: this.index, tried: [...this.tried], reveal: this.mistakes >= REVEAL_AFTER, visited: [...this.visited], target: this.target });
  }

  private current(): Delivery | null {
    return this.plan[this.index] ?? null;
  }

  private ask() {
    const d = this.current();
    if (!d) return this.finish();
    this.phase = 'ask';
    this.tried = [];
    this.mistakes = 0;
    this.target = null;
    this.askedAt = performance.now();
    this.fillRack(d.parcels, BODY[d.answer].color);
    this.showChoices(true);
    this.overview();
    this.emit();
    this.cb.onAsk(this.index);
  }

  private fillRack(n: number, color: string) {
    const rack = this.rocket.rack;
    for (const c of [...rack.children]) {
      rack.remove(c);
      disposeTree(c);
    }
    for (let i = 0; i < n; i++) {
      const p = makeParcel(color, 0.42);
      p.position.set((i - (n - 1) / 2) * 0.46, 0, 0);
      p.rotation.y = (i - 1) * 0.15;
      rack.add(p);
    }
  }

  private showChoices(on: boolean) {
    const d = this.current();
    for (const id of BODIES) {
      const cand = on && Boolean(d?.candidates.includes(id)) && !this.tried.includes(id);
      this.halos.get(id)!.visible = cand;
      this.tags.get(id)!.visible = cand;
    }
    for (const b of this.badges) {
      this.system.remove(b);
      disposeTree(b);
    }
    this.badges = [];
  }

  /** Counting hint: the planets' numbers pop one by one from the Sun. */
  private showNumbers() {
    if (this.badges.length) return;
    (['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'] as BodyId[]).forEach((id, i) => {
      const b = numberBadge(i + 1);
      b.userData.body = id;
      b.userData.pop = -i * 0.22;
      b.scale.setScalar(0.001);
      this.badges.push(b);
      this.system.add(b);
    });
  }

  /** The child picked a planet (HUD button or tap in 3D). */
  choose(body: BodyId) {
    const d = this.current();
    if (!d || this.phase !== 'ask' || this.tried.includes(body)) return;
    this.audio.play('pick');
    this.target = body;
    const right = checkAnswer(d, body);
    this.phase = right ? 'fly' : 'detour';
    this.halos.forEach((h, id) => (h.visible = right ? id === body : h.visible && id !== body));
    this.emit();
    const to = this.arrivalNear(body);
    this.flyTo(to, () => (right ? this.landOn(body) : this.detour(body)));
  }

  private flyTo(to: THREE.Vector3, done: () => void) {
    const from = this.rocket.root.position.clone();
    const L = from.distanceTo(to);
    const lift = 1.2 + L * 0.12;
    const dir = to.clone().sub(from).normalize();
    const c1 = from.clone().addScaledVector(dir, L * 0.3).add(new THREE.Vector3(0, lift, 0));
    const c2 = to.clone().addScaledVector(dir, -L * 0.3).add(new THREE.Vector3(0, lift * 0.8, 0));
    this.hover = false;
    this.audio.play('whoosh');
    this.ziggy.userData.rig.cue('jump');
    const dur = Math.max(1.1, Math.min(2.8, 0.8 + L * 0.075)) * (this.reduceMotion ? 1.1 : 1);
    this.flying = { p: [from, c1, c2, to], t: 0, dur, done };
    // The camera keeps both the rocket and where it goes in view.
    this.follow = () => [this.rocket.root.position.clone(), to.clone().add(new THREE.Vector3(0, 0, 0)), from.clone().lerp(to, 0.5)];
    this.followDir = this.overviewDir();
    this.camRate = 2.4;
  }

  private detour(body: BodyId) {
    const d = this.current()!;
    this.tried.push(body);
    this.mistakes++;
    this.audio.play('boing');
    this.ziggy.userData.rig.cue('oops');
    this.bubble.visible = true;
    const center = this.planetPos(body);
    const start = this.rocket.root.position.clone();
    const rel = start.clone().sub(center);
    const span = Math.hypot(rel.x, rel.z) + 1.6;
    this.follow = () => [-1, 1].flatMap((s) => [center.clone().add(new THREE.Vector3(s * span, 0, 0)), center.clone().add(new THREE.Vector3(0, s * 0.8, s * span))]);
    this.cb.onWrong(body, this.mistakes, this.index);
    // The planet shakes "not here!" while the rocket circles round it.
    this.planets.get(body)!.group.userData.wobble = 1;
    this.orbitLoop = {
      center: center.clone().setY(start.y),
      r: Math.hypot(rel.x, rel.z),
      a0: Math.atan2(rel.z, rel.x),
      t: 0,
      dur: this.reduceMotion ? 1.4 : 2.3,
      done: () => {
        this.bubble.visible = false;
        if (d.numbers && this.mistakes >= 1) this.showNumbers();
        this.phase = 'ask';
        this.target = null;
        this.hover = true;
        this.rocketAt.copy(this.rocket.root.position);
        for (const id of BODIES) this.halos.get(id)!.visible = d.candidates.includes(id) && !this.tried.includes(id);
        this.overview();
        this.emit();
      },
    };
  }

  /* ───────────────────────── Landing scene ───────────────────────── */

  private landOn(body: BodyId) {
    const d = this.current()!;
    this.phase = 'land';
    this.emit();
    const durationMs = performance.now() - this.askedAt;
    this.stats = { mistakes: this.mistakes, durationMs };
    this.cb.onArrive(this.index);
    // Dive towards the planet, then fade into the landing scene.
    const p = this.planetPos(body);
    const from = this.rocket.root.position.clone();
    this.follow = () => [p.clone().add(new THREE.Vector3(LAYOUT[body].r * 1.4, 0, 0)), p.clone().add(new THREE.Vector3(-LAYOUT[body].r * 1.4, 0, 0)), this.rocket.root.position.clone()];
    this.camRate = 3;
    this.audio.play('whoosh');
    this.tween(this.reduceMotion ? 0.5 : 0.9, (k) => {
      const e = easeInOut(k);
      this.rocket.root.position.lerpVectors(from, p, e * 0.75);
      this.rocket.root.scale.setScalar(ROCKET_SMALL * (1 - e * 0.6));
      this.thrust = 1;
    });
    this.later(this.reduceMotion ? 250 : 550, () =>
      this.fadeTo(BODY[body].color, () => {
        this.enterStage(body, d);
      })
    );
  }

  private stats = { mistakes: 0, durationMs: 0 };

  private fadeTo(color: string, mid: () => void) {
    const m = this.fade.material;
    m.color.set(color);
    this.fade.visible = true;
    const outDur = this.reduceMotion ? 0.25 : 0.4;
    this.tween(outDur, (k) => (m.opacity = k), () => {
      mid();
      this.tween(this.reduceMotion ? 0.3 : 0.55, (k) => (m.opacity = 1 - k), () => (this.fade.visible = false));
    });
  }

  private enterStage(body: BodyId, d: Delivery) {
    this.showChoices(false);
    this.system.visible = false;
    this.overviewLights(false);
    const st = buildStage(body, this.lowPower);
    if (this.portrait()) {
      st.rocketSpot.x *= 0.8;
      st.alienSpot.x *= 0.82;
    }
    this.stage = st;
    this.scene.add(st.group);
    this.sky.material.uniforms.top.value.set(st.sky.top);
    this.sky.material.uniforms.bottom.value.set(st.sky.bottom);
    this.stars.material.opacity = st.sky.stars;
    this.brightStars.material.opacity = st.sky.stars;
    this.scene.fog = st.fog ? new THREE.Fog(st.fog.color, st.fog.near, st.fog.far) : null;
    this.hemi.color.set(st.hemi.sky);
    this.hemi.groundColor.set(st.hemi.ground);
    this.hemi.intensity = st.hemi.intensity;
    this.key.color.set(st.key.color);
    this.key.intensity = st.key.intensity;
    this.key.position.set(-6, 10, 9);
    this.key.target.position.set(0, 0, 0);

    // The inhabitant.
    const alien = new Alien(ALIENS[body], this.lowPower);
    alien.energy = this.reduceMotion ? 0.35 : 1;
    alien.root.position.copy(st.alienSpot);
    alien.root.rotation.y = -0.45;
    alien.root.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    alien.onSneeze = () => {
      const at = alien.root.localToWorld(alien.mouthPos.clone());
      this.starBurst.emit(at, { color: '#ffe066', count: this.lowPower ? 14 : 28, spread: 3.2, up: 1.6, life: 1.4, size: 0.32, additive: true });
      this.starBurst.emit(at, { color: '#ff9ad5', count: this.lowPower ? 6 : 12, spread: 2.6, up: 2.2, life: 1.2, size: 0.26, additive: true });
      this.ziggy.userData.rig.cue('oops');
      this.later(900, () => this.ziggy.userData.rig.cue('giggle'));
    };
    this.alien = alien;
    st.group.add(alien.root);
    this.later(600, () => alien.cue('wave'));

    // The rocket comes down from the sky.
    const rk = this.rocket.root;
    st.group.add(rk);
    rk.scale.setScalar(1);
    rk.quaternion.identity();
    const hoverY = st.kind === 'cloud' ? 0.15 : 0;
    const spot = st.rocketSpot.clone().setY(hoverY);
    const from = spot.clone().add(new THREE.Vector3(2.5, 16, -6));
    rk.position.copy(from);
    this.flying = null;
    this.orbitLoop = null;
    this.hover = false;
    this.thrust = 1;
    this.stageView(true);
    this.audio.play('takeoff');
    const dur = this.reduceMotion ? 1.3 : 2.2;
    this.tween(
      dur,
      (k) => {
        const e = easeOut(k);
        rk.position.lerpVectors(from, spot, e);
        rk.rotation.z = (1 - e) * 0.35;
        this.thrust = 1 - e * 0.55;
      },
      () => {
        rk.rotation.z = 0;
        if (st.kind !== 'cloud') {
          this.thrust = 0;
          this.audio.play('land');
          this.dust.emit(spot.clone().add(new THREE.Vector3(0, 0.2, 0)), { color: st.dust, count: this.lowPower ? 8 : 16, spread: 4, up: 0.5, life: 1.6, size: 1.1 });
          this.tween(0.45, (k) => rk.scale.set(1 + Math.sin(k * Math.PI) * 0.08, 1 - Math.sin(k * Math.PI) * 0.12, 1 + Math.sin(k * Math.PI) * 0.08));
        } else this.thrust = 0.35;
        this.later(450, () => this.deliver(d));
      }
    );
    this.phase = 'land';
    this.emit();
  }

  private stageView(snap = false) {
    const st = this.stage;
    if (!st) return;
    const r = st.rocketSpot;
    const a = st.alienSpot;
    const pts = [
      r.clone().add(new THREE.Vector3(-1.6, 0, 0)),
      // On the Moon, room for Ziggy's giant slow-motion jumps.
      r.clone().add(new THREE.Vector3(0, st.gravity < 0.3 ? 6.4 : 4.6, 0)),
      a.clone().add(new THREE.Vector3(1.2, 0, 0)),
      a.clone().add(new THREE.Vector3(0, 3.0, 0)),
      new THREE.Vector3(0, -0.3, 1.6),
    ];
    const dir = new THREE.Vector3(0, this.portrait() ? 0.36 : 0.26, 1).normalize();
    this.follow = null;
    this.camRate = 2.2;
    this.setView(pts, dir, { margin: 0.06, snap, minDist: 6 });
  }

  /** Hand over the parcels, then the inhabitant opens one. */
  private deliver(d: Delivery) {
    const st = this.stage!;
    const alien = this.alien!;
    const rig = this.ziggy.userData.rig;
    this.phase = 'deliver';
    this.emit();
    const pile = (i: number) => st.alienSpot.clone().add(new THREE.Vector3(-0.95, i * 0.43 + (st.kind === 'cloud' ? 0.02 : 0), 0.55));
    // Parcels leave the rack.
    const rack = this.rocket.rack;
    for (const c of [...rack.children]) {
      rack.remove(c);
      disposeTree(c);
    }
    const make = () => {
      const p = makeParcel(BODY[d.answer].color, 0.45);
      p.traverse((o) => ((o as THREE.Mesh).castShadow = true));
      this.parcels.push(p);
      return p;
    };
    const give = (i: number, from: () => THREE.Vector3, then: () => void) => {
      if (i >= d.parcels) return then();
      const p = make();
      st.group.add(p);
      const a = from();
      const b = pile(i);
      p.position.copy(a);
      const lift = st.kind === 'cloud' ? 2.2 : 1.1;
      this.tween(
        st.kind === 'cloud' ? 0.8 : 0.55,
        (k) => {
          p.position.lerpVectors(a, b, easeInOut(k));
          p.position.y += Math.sin(k * Math.PI) * lift;
          p.rotation.y = k * Math.PI * 2;
        },
        () => {
          p.rotation.y = (i % 2) * 0.3 - 0.15;
          this.audio.play('pop');
          this.sparkles.emit(b.clone().add(new THREE.Vector3(0, 0.4, 0)), { color: '#ffe680', count: 8, spread: 0.8, up: 1, life: 0.6, size: 0.25, additive: true });
          this.cb.onCount(i + 1);
          this.later(380, () => give(i + 1, from, then));
        }
      );
    };

    if (st.kind === 'cloud') {
      // No ground: Ziggy stays in the rocket and tosses the parcels across.
      rig.cue('cheer');
      this.later(700, () =>
        give(0, () => this.rocket.root.localToWorld(new THREE.Vector3(0.4, 3.0, 0.4)), () => {
          alien.cue('receive');
          this.later(600, () => this.open(d));
        })
      );
      return;
    }

    // Open the dome, hop out with the parcels in his arms, walk (or bounce, on the Moon) to the inhabitant.
    const moon = st.gravity < 0.3;
    this.tween(0.5, (k) => this.rocket.setDome(easeOut(k)));
    this.later(450, () => {
      const z = this.ziggy;
      st.group.attach(z);
      z.rotation.set(0, 0.5, 0);
      z.scale.setScalar(1);
      rig.seated = false;
      rig.carrying = true;
      const carried: Parcel[] = [];
      for (let i = 0; i < d.parcels; i++) {
        const p = make();
        p.scale.setScalar(0.8);
        p.position.set(0, i * 0.3 - 0.15, 0.05);
        z.userData.model.carry.add(p);
        carried.push(p);
      }
      const land = st.rocketSpot.clone().add(new THREE.Vector3(1.35, 0, 0.9));
      const start = z.position.clone();
      rig.cue('jump');
      const hopH = moon ? 3.2 : 1.4;
      this.tween(moon ? 1.7 : 0.75, (k) => {
        z.position.lerpVectors(start, land, k);
        z.position.y += Math.sin(k * Math.PI) * hopH;
      }, () => {
        this.dust.emit(land.clone().add(new THREE.Vector3(0, 0.1, 0)), { color: st.dust, count: 6, spread: 1.4, up: 0.4, life: 1.1, size: 0.6 });
        const goal = st.alienSpot.clone().add(new THREE.Vector3(-1.75, 0, 0.75));
        const walk = () => {
          // Towards the inhabitant, his face still turned to the child.
          this.ziggy.rotation.y = 0.8;
          if (moon) {
            // Two giant, slow-motion jumps: boing… boing…
            const mid = land.clone().lerp(goal, 0.5);
            const hop = (a: THREE.Vector3, b: THREE.Vector3, then: () => void) => {
              rig.cue('jump');
              this.audio.play('boing');
              this.tween(this.reduceMotion ? 1.0 : 1.9, (k) => {
                z.position.lerpVectors(a, b, k);
                z.position.y += Math.sin(k * Math.PI) * (this.reduceMotion ? 1.2 : 3.6);
                z.rotation.x = Math.sin(k * Math.PI * 2) * 0.15 * (this.reduceMotion ? 0 : 1);
              }, () => {
                z.rotation.x = 0;
                this.dust.emit(b.clone().add(new THREE.Vector3(0, 0.1, 0)), { color: st.dust, count: 6, spread: 1.4, up: 0.3, life: 1.4, size: 0.6 });
                then();
              });
            };
            hop(land, mid, () => hop(mid, goal, arrived));
          } else {
            rig.walk = 1;
            const dist = land.distanceTo(goal);
            this.tween(dist / 1.7, (k) => z.position.lerpVectors(land, goal, k), () => {
              rig.walk = 0;
              arrived();
            });
          }
        };
        const arrived = () => {
          z.rotation.y = 0.4;
          alien.cue('receive');
          // Each parcel goes onto the pile, counted aloud.
          let i = 0;
          const next = () => {
            const p = carried[i];
            if (!p) {
              rig.carrying = false;
              rig.cue('wave');
              this.later(500, () => this.open(d));
              return;
            }
            const a = p.getWorldPosition(new THREE.Vector3());
            st.group.attach(p);
            p.scale.setScalar(1);
            const b = pile(i);
            this.tween(0.45, (k) => {
              p.position.lerpVectors(a, b, easeInOut(k));
              p.position.y += Math.sin(k * Math.PI) * 0.5;
            }, () => {
              p.position.copy(b);
              p.rotation.set(0, (i % 2) * 0.3 - 0.15, 0);
              this.audio.play('pop');
              this.cb.onCount(i + 1);
              i++;
              this.later(380, next);
            });
          };
          next();
        };
        walk();
      });
    });
  }

  /** The inhabitant opens the top parcel: maybe a sneeze first, then the present pops out. */
  private open(d: Delivery) {
    const alien = this.alien!;
    const st = this.stage!;
    const top = this.parcels[this.parcels.length - 1];
    const doOpen = () => {
      if (!top) return this.opened(d);
      this.audio.play('open');
      const lid = top.userData.lid;
      const lidFrom = lid.position.clone();
      const at = top.localToWorld(lidFrom.clone());
      this.sparkles.emit(at, { color: '#fff1a8', count: this.lowPower ? 12 : 24, spread: 1.8, up: 2.2, life: 1.0, size: 0.32, additive: true });
      this.tween(0.9, (k) => {
        lid.position.set(lidFrom.x - k * 0.6, lidFrom.y + Math.sin(k * Math.PI) * 1.2 + k * 0.2, lidFrom.z);
        lid.rotation.z = k * 4;
        lid.scale.setScalar(1 - k * 0.9);
      });
      const gift = makeGift(d.gift);
      this.gift = gift;
      st.group.add(gift);
      const g0 = at.clone().add(new THREE.Vector3(0, -0.1, 0));
      const g1 = at.clone().add(new THREE.Vector3(0, 1.1, 0));
      gift.position.copy(g0);
      gift.scale.setScalar(0.2);
      this.tween(0.9, (k) => {
        gift.position.lerpVectors(g0, g1, easeOut(k));
        gift.scale.setScalar(0.2 + easeOut(k) * 0.9);
        gift.rotation.y = k * Math.PI * 2;
      }, () => this.later(350, () => this.placeGift(d, gift)));
    };
    if (d.sneeze) {
      alien.cue('sneeze');
      this.audio.play('sneeze');
      this.later(1900, doOpen);
    } else doOpen();
  }

  /** Where the present ends up: socks and hats on the head, glasses on the eyes, the hoop spinning… */
  private placeGift(d: Delivery, gift: THREE.Object3D) {
    const alien = this.alien!;
    const st = this.stage!;
    const moveTo = (parent: THREE.Object3D, pos: THREE.Vector3, scale: number, rot: THREE.Euler, then?: () => void) => {
      const a = gift.getWorldPosition(new THREE.Vector3());
      const s0 = gift.scale.x;
      st.group.attach(gift);
      parent.updateMatrixWorld(true);
      const b = parent.localToWorld(pos.clone());
      this.tween(0.6, (k) => {
        gift.position.lerpVectors(a, b, easeInOut(k));
        gift.position.y += Math.sin(k * Math.PI) * 0.6;
        gift.scale.setScalar(s0 + (scale - s0) * k);
      }, () => {
        parent.attach(gift);
        gift.position.copy(pos);
        gift.rotation.copy(rot);
        // attach() keeps the world scale: set it in the parent's space.
        const ws = parent.getWorldScale(new THREE.Vector3()).x || 1;
        gift.scale.setScalar(scale / ws);
        then?.();
      });
    };
    const done = () => this.opened(d);
    switch (d.gift) {
      case 'sock':
        moveTo(alien.top, new THREE.Vector3(0.05, 0.1, 0), 1.25, new THREE.Euler(0, 0.3, -0.35), done);
        break;
      case 'hat':
        moveTo(alien.top, new THREE.Vector3(0, -0.12, 0), 1.9, new THREE.Euler(0, 0, 0.12), done);
        break;
      case 'sunglasses':
        moveTo(alien.face, new THREE.Vector3(0, -0.32, 0.12), ALIENS[d.answer].eyes === 1 ? 1.4 : 1.3, new THREE.Euler(0, 0, 0), done);
        break;
      case 'hoop':
        moveTo(alien.waist, new THREE.Vector3(0, 0, 0), 1.75, new THREE.Euler(0, 0, 0), () => {
          const hoop = gift;
          this.giftAnim = (dt, t) => {
            hoop.rotation.y += dt * 9;
            hoop.rotation.x = Math.sin(t * 9) * 0.18;
            hoop.position.x = Math.sin(t * 9) * 0.12;
            hoop.position.z = Math.cos(t * 9) * 0.12;
          };
          done();
        });
        break;
      case 'ball': {
        const base = st.alienSpot.clone().add(new THREE.Vector3(-0.2, 0, 1.2));
        moveTo(st.group, base, 1.1, new THREE.Euler(), () => {
          const g = st.gravity;
          this.giftAnim = (_dt, t) => {
            const period = 1 / Math.sqrt(Math.max(0.15, g)) * 0.7;
            const ph = (t % period) / period;
            gift.position.y = base.y + Math.sin(ph * Math.PI) * (g < 0.3 ? 3.2 : 1.2) * (this.reduceMotion ? 0.3 : 1);
          };
          done();
        });
        break;
      }
      case 'plant':
      case 'fan':
        moveTo(st.group, st.alienSpot.clone().add(new THREE.Vector3(1.1, 0, 0.6)), 1.3, new THREE.Euler(0, -0.4, 0), () => {
          const spin = gift.getObjectByName('spin');
          if (spin) this.giftAnim = (dt) => (spin.rotation.z += dt * 14);
          done();
        });
        break;
      default:
        alien.setHold(1);
        moveTo(alien.hands, new THREE.Vector3(0, 0, 0), 1.0, new THREE.Euler(0, 0, 0), done);
    }
  }

  private opened(d: Delivery) {
    const alien = this.alien!;
    this.phase = 'opened';
    this.visited.push(d.answer);
    alien.cue(d.gift === 'hoop' ? 'joy' : 'spin');
    this.later(1100, () => alien.cue('joy'));
    this.ziggy.userData.rig.cue('cheer');
    this.audio.play('star');
    this.sparkles.emit(alien.root.position.clone().add(new THREE.Vector3(0, 2.4, 0)), { color: '#ffe066', count: this.lowPower ? 16 : 34, spread: 3.4, up: 2.6, life: 1.4, size: 0.4, additive: true });
    this.emit();
    this.cb.onOpened(this.index, { ...this.stats });
  }

  /** After the reaction: back to the rocket, a joyful loop, and on to the next delivery. */
  next() {
    if (this.phase !== 'opened' || !this.stage) return;
    this.phase = 'depart';
    this.emit();
    const st = this.stage;
    const rig = this.ziggy.userData.rig;
    const z = this.ziggy;
    const takeoff = () => {
      this.audio.play('takeoff');
      const rk = this.rocket.root;
      const base = rk.position.clone();
      this.thrust = 1;
      this.tween(0.5, (k) => this.rocket.setDome(1 - easeOut(k)));
      const up1 = base.clone().add(new THREE.Vector3(0, 3.2, 0));
      this.tween(this.reduceMotion ? 1.0 : 0.9, (k) => rk.position.lerpVectors(base, up1, easeInOut(k)), () => {
        const fin = () => {
          const top = rk.position.clone();
          const away = top.clone().add(new THREE.Vector3(3, 14, -6));
          this.tween(0.9, (k) => {
            rk.position.lerpVectors(top, away, k * k);
            rk.rotation.z = -k * 0.4;
          });
          this.later(450, () => this.fadeTo('#ffffff', () => this.exitStage()));
        };
        if (this.reduceMotion) return fin();
        // A little loop-the-loop of joy.
        // Going up, it curls over to the left and comes back round: the axis follows the circle.
        const c = up1.clone().add(new THREE.Vector3(-1.7, 0, 0));
        this.tween(1.5, (k) => {
          const a = easeInOut(k) * Math.PI * 2;
          rk.position.set(c.x + Math.cos(a) * 1.7, c.y + Math.sin(a) * 1.7, c.z);
          rk.rotation.z = a;
          this.trail(rk, 1);
        }, () => {
          rk.rotation.z = 0;
          fin();
        });
      });
    };
    if (st.kind === 'cloud' || z.parent === this.rocket.seat) {
      rig.cue('wave');
      this.later(500, takeoff);
      return;
    }
    // Walk (or bounce) back and hop into the seat.
    const moon = st.gravity < 0.3;
    const land = st.rocketSpot.clone().add(new THREE.Vector3(1.35, 0, 0.9));
    const from = z.position.clone();
    z.rotation.y = -Math.PI / 2;
    const into = () => {
      rig.cue('jump');
      const a = z.position.clone();
      const seatW = this.rocket.seat.getWorldPosition(new THREE.Vector3());
      this.tween(moon ? 1.4 : 0.7, (k) => {
        z.position.lerpVectors(a, seatW, k);
        z.position.y += Math.sin(k * Math.PI) * (moon ? 2.6 : 1.4);
        z.rotation.y = -Math.PI / 2 + k * (Math.PI / 2);
      }, () => {
        this.rocket.seat.attach(z);
        z.position.set(0, 0, 0);
        z.rotation.set(0, 0, 0);
        z.scale.setScalar(0.92);
        rig.seated = true;
        rig.cue('wave');
        this.later(400, takeoff);
      });
    };
    if (moon) {
      rig.cue('jump');
      this.tween(this.reduceMotion ? 1.0 : 1.9, (k) => {
        z.position.lerpVectors(from, land, k);
        z.position.y += Math.sin(k * Math.PI) * (this.reduceMotion ? 1.2 : 3.4);
      }, into);
    } else {
      rig.walk = 1;
      this.tween(from.distanceTo(land) / 1.9, (k) => z.position.lerpVectors(from, land, k), () => {
        rig.walk = 0;
        into();
      });
    }
  }

  private exitStage() {
    const st = this.stage;
    const body = this.target;
    this.giftAnim = null;
    this.gift = null;
    this.parcels = [];
    // Bring the rocket (and Ziggy in it) back to the overview, next to the planet.
    this.system.add(this.rocket.root);
    this.rocket.root.scale.setScalar(ROCKET_SMALL);
    this.rocket.root.rotation.set(0, 0, 0);
    this.rocket.setDome(0);
    if (this.ziggy.parent !== this.rocket.seat) {
      this.rocket.seat.attach(this.ziggy);
      this.ziggy.position.set(0, 0, 0);
      this.ziggy.rotation.set(0, 0, 0);
      this.ziggy.scale.setScalar(0.92);
      this.ziggy.userData.rig.seated = true;
    }
    if (st) {
      this.scene.remove(st.group);
      st.group.remove(this.rocket.root);
      disposeTree(st.group);
    }
    this.stage = null;
    this.alien = null;
    this.system.visible = true;
    this.overviewLights(true);
    this.rocketAt.copy(body ? this.arrivalNear(body) : POST_SPOT);
    this.rocket.root.position.copy(this.rocketAt);
    this.hover = true;
    this.thrust = 0;
    this.index++;
    this.target = null;
    this.overview(true);
    if (this.index >= this.plan.length) this.finish();
    else this.later(350, () => this.ask());
  }

  /** The round is over: home to the post office, a stamp on every planet visited. */
  private finish() {
    this.phase = 'end';
    this.showChoices(false);
    this.emit();
    this.flyTo(POST_PAD.clone(), () => {
      this.hover = true;
      this.rocketAt.copy(this.rocket.root.position);
      this.overview();
      this.ziggy.userData.rig.cue('cheer');
    });
    this.later(900, () => {
      this.visited.forEach((id, i) => {
        this.later(i * 450, () => {
          const s = stampSprite(['#e2453c', '#7a4fd0', '#2e9e6a', '#e07a10', '#3f6fd9'][i % 5]);
          s.userData.body = id;
          s.userData.pop = 0;
          this.stamps.push(s);
          this.system.add(s);
          this.audio.play('stamp');
        });
      });
      this.later(this.visited.length * 450 + 500, () => {
        this.audio.play('star');
        this.cb.onFinish();
      });
    });
  }

  /* ───────────────────────── Input ───────────────────────── */

  private onDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
  };
  private onCancel = () => {
    this.down = null;
  };
  private onUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 16 || performance.now() - d.t > 1200) return;
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    if (this.system.visible && this.phase === 'ask') {
      const hits = this.ray.intersectObjects([...this.planets.values()].map((p) => p.hit), false);
      const body = hits[0]?.object.userData.body as BodyId | undefined;
      if (!body) return;
      const d0 = this.current();
      if (d0?.candidates.includes(body) && !this.tried.includes(body)) this.choose(body);
      else {
        this.audio.play('peek');
        this.planets.get(body)!.group.userData.wobble = 1;
        this.cb.onPeek(body);
      }
      return;
    }
    if (this.stage && this.alien) {
      const hit = this.ray.intersectObject(this.alien.root, true)[0];
      if (hit) {
        this.alien.cue('joy');
        this.audio.play('pop');
        return;
      }
      if (this.ray.intersectObject(this.ziggy, true)[0]) {
        this.ziggy.userData.rig.cue('giggle');
        this.audio.play('pop');
      }
    }
  };

  private onVisibility = () => {
    if (document.hidden) {
      this.stop();
      this.audio.suspend(true);
    } else {
      this.audio.suspend(false);
      this.start();
    }
  };

  /* ───────────────────────── Loop ───────────────────────── */

  setMusic(on: boolean) {
    if (on) this.audio.startMusic();
    else this.audio.stopMusic();
  }

  private start() {
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
    this.loop();
  }

  private stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private tween(dur: number, fn: (k: number) => void, done?: () => void) {
    this.tweens.push({ t: 0, dur: Math.max(0.01, dur), fn, done });
  }

  private later(ms: number, fn: () => void) {
    this.waits.push({ t: ms / 1000, fn });
  }

  private loop = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const raw = this.clock.getDelta();
    const dt = Math.min(0.1, raw);
    const t = this.clock.elapsedTime;
    this.step(dt, t, Math.min(0.5, raw));
    this.post.render(dt);
    this.adaptResolution(raw);
  };

  /** Weak device: lower the internal resolution a little, step by step (never below 0.55). */
  private adaptResolution(raw: number) {
    const p = this.perf;
    p.frames++;
    p.time += raw;
    if (p.time < 2.5) return;
    const fps = p.frames / p.time;
    p.frames = 0;
    p.time = 0;
    if (!p.ratio) p.ratio = this.renderer.getPixelRatio();
    if (fps < 24 && p.ratio > 0.56) {
      p.ratio = Math.max(0.55, p.ratio - 0.15);
      this.renderer.setPixelRatio(p.ratio);
      this.fit();
    }
  }

  /** Star trail behind the flying rocket. */
  private trail(rk: THREE.Object3D, scale: number) {
    if (this.trailT > 0) return;
    this.trailT = this.lowPower ? 0.06 : 0.035;
    const at = rk.localToWorld(this.rocket.tail.clone());
    const cols = ['#ffe066', '#ff9ad5', '#9fd8ff', '#ffffff'];
    this.sparkles.emit(at, { color: cols[Math.floor(Math.random() * cols.length)], count: 1, spread: 0.2 * scale, up: 0.05 * scale, life: 0.9, size: 0.5 * scale, additive: true });
  }

  private orient(rk: THREE.Object3D, upDir: THREE.Vector3, dt: number) {
    // Rocket axis along `upDir`, its front (porthole, Ziggy's face) turned towards the camera.
    const y = upDir.clone().normalize();
    const toCam = this.camera.position.clone().sub(rk.getWorldPosition(new THREE.Vector3())).normalize();
    const z = toCam.sub(y.clone().multiplyScalar(toCam.dot(y)));
    if (z.lengthSq() < 1e-4) z.set(0, 0, 1);
    z.normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    rk.quaternion.slerp(q, Math.min(1, dt * 8));
  }

  private step(dt: number, t: number, rawDt = dt) {
    const motion = this.reduceMotion ? 0.35 : 1;
    this.trailT -= dt;

    // Waits, then tweens.
    for (let i = 0; i < this.waits.length; i++) {
      const w = this.waits[i];
      w.t -= dt;
      if (w.t <= 0) {
        this.waits.splice(i, 1);
        i--;
        w.fn();
      }
    }
    for (let i = 0; i < this.tweens.length; i++) {
      const tw = this.tweens[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(k);
      if (k >= 1) {
        this.tweens.splice(i, 1);
        i--;
        tw.done?.();
      }
    }

    // ── Overview life ──
    if (this.system.visible) {
      this.sun.rays.material.rotation += dt * 0.05 * motion;
      const pulse = 1 + Math.sin(t * 1.6) * 0.04 * motion;
      this.sun.glows[0].scale.setScalar(7.8 * pulse);
      this.belt.rotation.y += dt * 0.012 * motion;
      for (const [id, p] of this.planets) {
        const L = LAYOUT[id];
        p.ball.rotation.y += dt * L.spin * motion;
        const clouds = p.group.userData.axis.getObjectByName('clouds') as THREE.Object3D | undefined;
        if (clouds) clouds.rotation.y += dt * 0.25 * motion;
        if (id === 'moon') {
          const a = t * 0.45 * (this.reduceMotion ? 0.4 : 1);
          const e = LAYOUT.earth;
          p.group.position.set(e.x + Math.cos(a) * MOON_ORBIT, 0.05, e.z + Math.sin(a) * MOON_ORBIT);
          p.ball.rotation.y = -a + Math.PI;
        }
        const w = (p.group.userData.wobble as number | undefined) ?? 0;
        if (w > 0) {
          p.group.userData.wobble = Math.max(0, w - dt * 1.6);
          p.group.scale.setScalar(1 + Math.sin(w * 18) * 0.12 * w);
        }
      }
      // Halos, name tags, number badges and stamps follow their planets.
      const camUp = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
      const d = this.current();
      const reveal = this.mistakes >= REVEAL_AFTER && this.phase === 'ask';
      for (const id of BODIES) {
        const p = this.planets.get(id)!;
        const r = id === 'saturn' ? LAYOUT[id].r * 2.45 : LAYOUT[id].r;
        const halo = this.halos.get(id)!;
        if (halo.visible) {
          halo.position.copy(p.group.position);
          const big = reveal && d?.answer === id;
          halo.scale.setScalar(Math.max(1.3, r * 3.1) * (1 + Math.sin(t * (big ? 6 : 3) + r) * (big ? 0.14 : 0.06) * motion) * (big ? 1.25 : 1));
          (halo.material as THREE.SpriteMaterial).color.set(big ? '#fff07a' : '#ffe8a0');
          (halo.material as THREE.SpriteMaterial).opacity = big ? 1 : 0.75;
          if (big && Math.random() < dt * 6) this.sparkles.emit(p.group.position.clone().addScaledVector(camUp, r), { color: '#fff07a', count: 1, spread: r * 2, up: 0.4, life: 0.8, size: 0.35, additive: true });
        }
        const tag = this.tags.get(id)!;
        if (tag.visible) tag.position.copy(p.group.position).addScaledVector(camUp, -((id === 'saturn' ? LAYOUT[id].r * 1.3 : r) * 1.05 + 0.4));
      }
      for (const b of this.badges) {
        const id = b.userData.body as BodyId;
        b.userData.pop += dt;
        const k = Math.max(0, Math.min(1, b.userData.pop / 0.3));
        b.scale.setScalar(0.07 * (k < 1 ? Math.sin(k * Math.PI * 0.75) * 1.25 : 1) + 0.0001);
        b.position.copy(this.planets.get(id)!.group.position).addScaledVector(camUp, LAYOUT[id].r * (id === 'saturn' ? 1.2 : 1) + 0.55);
      }
      for (const s of this.stamps) {
        const id = s.userData.body as BodyId;
        s.userData.pop += dt;
        const k = Math.min(1, s.userData.pop / 0.35);
        s.scale.setScalar(0.062 * (k < 1 ? 1.8 - 0.8 * k : 1));
        s.position.copy(this.planets.get(id)!.group.position).addScaledVector(camUp, LAYOUT[id].r * (id === 'saturn' ? 1.2 : 1) + 0.6);
      }
      // A comet now and then.
      this.nextComet -= dt;
      if (this.nextComet <= 0 && !this.comet && !this.reduceMotion) {
        this.nextComet = 9 + Math.random() * 8;
        const s = glow('#dff3ff', 1.2, 0.95);
        const from = new THREE.Vector3(30 + Math.random() * 10, 2 + Math.random() * 3, -12 - Math.random() * 6);
        s.position.copy(from);
        this.system.add(s);
        this.comet = { s, v: new THREE.Vector3(-9 - Math.random() * 4, -0.2, 3 + Math.random() * 2), life: 5 };
      }
      if (this.comet) {
        const c = this.comet;
        c.life -= dt;
        c.s.position.addScaledVector(c.v, dt);
        if (Math.random() < dt * 30) this.sparkles.emit(c.s.position.clone(), { color: '#bfe9ff', count: 1, spread: 0.1, up: 0.02, life: 1.2, size: 0.45, additive: true });
        if (c.life <= 0) {
          this.system.remove(c.s);
          c.s.material.dispose();
          this.comet = null;
        }
      }
      this.postOffice.rotation.y = Math.sin(t * 0.3) * 0.08;
    }
    this.brightStars.material.opacity = (this.stage ? this.stage.sky.stars : 1) * (0.75 + Math.sin(t * 2.3) * 0.25 * motion);

    // ── The rocket in the overview ──
    const rk = this.rocket.root;
    if (this.system.visible && rk.parent === this.system) {
      if (this.flying) {
        const f = this.flying;
        f.t = Math.min(1, f.t + dt / f.dur);
        const e = easeInOut(f.t);
        const pos = bezier(f.p[0], f.p[1], f.p[2], f.p[3], e, new THREE.Vector3());
        const ahead = bezier(f.p[0], f.p[1], f.p[2], f.p[3], Math.min(1, e + 0.02), new THREE.Vector3());
        const tangent = ahead.sub(pos);
        rk.position.copy(pos);
        if (tangent.lengthSq() > 1e-8) this.orient(rk, tangent, dt);
        this.thrust = 1;
        this.trail(rk, 1);
        if (f.t >= 1) {
          this.flying = null;
          f.done();
        }
      } else if (this.orbitLoop) {
        const o = this.orbitLoop;
        o.t = Math.min(1, o.t + dt / o.dur);
        const a = o.a0 + easeInOut(o.t) * Math.PI * 2;
        rk.position.set(o.center.x + Math.cos(a) * o.r, o.center.y + Math.sin(o.t * Math.PI) * 0.6 + Math.sin(o.t * Math.PI * 4) * 0.25 * motion, o.center.z + Math.sin(a) * o.r);
        this.orient(rk, new THREE.Vector3(-Math.sin(a), 0.2, Math.cos(a)), dt);
        this.thrust = 0.8;
        this.trail(rk, 1);
        if (o.t >= 1) {
          this.orbitLoop = null;
          o.done();
        }
      } else if (this.hover) {
        rk.position.copy(this.rocketAt).add(new THREE.Vector3(0, Math.sin(t * 2) * 0.06 * motion, 0));
        this.orient(rk, new THREE.Vector3(0, 1, 0).add(this.camera.position.clone().sub(rk.position).normalize().multiplyScalar(0.55)), dt);
        this.thrust = this.phase === 'end' ? 0.15 : 0.25;
      }
      if (this.bubble.visible) this.bubble.position.copy(rk.position).add(new THREE.Vector3(0, 1.1, 0));
    } else if (this.stage && this.stage.kind === 'cloud' && rk.parent === this.stage.group && this.phase !== 'depart' && this.phase !== 'land') {
      rk.position.y = 0.15 + Math.sin(t * 1.4) * 0.08 * motion;
    }
    this.rocket.setThrust(this.thrust, t);

    // ── Landing scene ──
    if (this.stage) {
      this.stage.update(dt, t);
      this.alien?.update(dt);
      this.giftAnim?.(dt, t);
      // Ziggy looks at the inhabitant.
      if (this.alien) this.ziggy.userData.rig.lookAt(0.5, 0);
    }
    this.ziggy.userData.rig.update(dt);
    this.sparkles.update(dt);
    this.starBurst.update(dt);
    this.dust.update(dt);

    // ── Camera ──
    if (this.follow && this.followDir) {
      const f = this.frame(this.follow(), this.followDir, 0.12, 3.5);
      this.view.pos.copy(f.pos);
      this.view.look.copy(f.look);
    }
    // Smoothed on the real time, so a slow device still frames the action in time.
    const k = 1 - Math.exp(-rawDt * this.camRate);
    this.cur.pos.lerp(this.view.pos, k);
    this.cur.look.lerp(this.view.look, k);
    const sway = this.reduceMotion ? 0 : Math.sin(t * 0.25) * 0.15;
    this.camera.position.copy(this.cur.pos).add(new THREE.Vector3(sway, 0, 0));
    this.camera.lookAt(this.cur.look);
  }

  dispose() {
    this.stop();
    this.waits = [];
    this.tweens = [];
    this.resize.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onCancel);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.audio.dispose();
    if (this.stage) disposeTree(this.stage.group);
    this.ziggy.userData.model.dispose();
    disposeTree(this.scene);
    this.dropEnv();
    this.post.dispose();
    this.renderer.dispose();
  }
}
