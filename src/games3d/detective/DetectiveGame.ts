import * as THREE from 'three';
import { createRenderer, disposeTree, glow, glowTex, prefersLowPower, studioEnvironment } from '../kit/look';
import { makeZiggy, type ZiggyActor } from '../kit/models';
import { Puffs } from '../kit/world';
import { heartTex, makeButterfly, makeClouds, makeSky, mergeStatic } from '../nid/garden';
import { makeAlibiProp, makeBalloon, makeBouquet, makeCrumbs, makeMud, makeSuspect, makeTrumpet, type SuspectActor } from './animals';
import { DetectiveAudio, type Sfx } from './audio';
import { Bubbles, Flakes, groundRing, noteTexture } from './fx';
import { makeDetectiveCap, makeMagnifier, type Magnifier } from './gear';
import { HUE_HEX, SPECIES_INFO, litHolds, type Case, type Clue, type MysteryId, type Species } from './logic';
import { clueCanvas, type PortraitMap } from './pictos';
import { CLUE_PLACES, MYSTERY_SPOT, REST_SPOTS, SLOT_X, SLOT_Z, ZIGGY_HOME, buildVillage, makeClueProp, makeMysteryScene, makeSlice, type CluePropKind, type Village } from './village';

/**
 * Ziggy Détective — the 3D village. The React player drives the story
 * (startCase → showClue → lineup → clear/objection → alibi/confess → party);
 * this class stages it: friends walking and reacting, Ziggy with his cap and
 * magnifying glass, close-ups on clues, the culprit's funny giveaway and the
 * party on the square. Everything is built in code.
 */

export interface DetectiveCallbacks {
  /** The friends are in place: the case can begin. */
  onReady: () => void;
  /** Ziggy holds the clue under his magnifier. */
  onClueFound: (step: number) => void;
  /** The culprit owned up and the party started. */
  onParty: () => void;
  /** A friend was tapped in the 3D view. */
  onSuspectTap: (id: Species) => void;
  /** Little pictures of the friends, for the buttons. */
  onPortraits: (p: PortraitMap) => void;
}

export interface DetectiveOptions {
  locale: string;
}

interface Walker {
  pos: THREE.Vector3;
  path: THREE.Vector3[];
  onArrive: (() => void) | null;
  yaw: number;
  face: THREE.Vector3 | null;
  speed: number;
}

interface Pal extends Walker {
  a: SuspectActor;
  scale: number;
  home: THREE.Vector3;
  hop: number;
  jump: number;
  blink: number;
  nextBlink: number;
  talk: number;
  shake: number;
  stretch: number;
  resting: boolean;
  glow: number;
  glowTarget: number;
  ring: THREE.Mesh;
  sneeze: number;
  prop: THREE.Object3D | null;
  propT: number;
  extras: THREE.Object3D[];
  blushK: number;
  blushTarget: number;
  float: number;
  floatTarget: number;
  dance: boolean;
  phase: number;
  look: THREE.Vector3 | null;
}

const RING = 5.6;
const STAGE = new THREE.Vector3(0, 0, 5.7);
const ZIGGY_STAGE = new THREE.Vector3(-1.45, 0, 5.3);
const ZIGGY_MYSTERY = new THREE.Vector3(2.0, 0, -7.0);

const lerpAngle = (a: number, b: number, k: number) => {
  let d = b - a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return a + d * k;
};
const angleOf = (p: THREE.Vector3) => Math.atan2(p.z, p.x);
const onRing = (a: number, r = RING) => new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);

/** Does the segment a→b stay outside the disc of radius r around the fountain? */
function clearOf(a: THREE.Vector3, b: THREE.Vector3, r: number): boolean {
  const ax = a.x;
  const az = a.z;
  const dx = b.x - ax;
  const dz = b.z - az;
  const l2 = dx * dx + dz * dz || 1e-6;
  const t = Math.max(0, Math.min(1, -(ax * dx + az * dz) / l2));
  return Math.hypot(ax + dx * t, az + dz * t) > r;
}

/** A path around the line-up (along a ring), so nobody walks through friends or the fountain. */
function route(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
  const inner = RING - 0.35;
  const fromIn = Math.hypot(from.x, from.z) < inner;
  const toIn = Math.hypot(to.x, to.z) < inner;
  if (!fromIn && !toIn && clearOf(from, to, inner)) return [to.clone()];
  const pts: THREE.Vector3[] = [];
  const a = angleOf(from);
  const b = angleOf(to);
  if (fromIn) pts.push(onRing(a));
  let d = b - a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const steps = Math.ceil(Math.abs(d) / 0.3);
  for (let i = 1; i < steps; i++) pts.push(onRing(a + (d * i) / steps));
  if (toIn) pts.push(onRing(b));
  pts.push(to.clone());
  return pts;
}

function propKind(c: Clue): CluePropKind {
  if (c.lits.length !== 1 || c.lits[0].not) return 'note';
  const k = c.lits[0].trait.k;
  return k === 'hat' ? 'bow' : k === 'scarf' ? 'yarn' : k === 'glasses' ? 'case' : k === 'size' ? 'prints' : 'note';
}

export class DetectiveGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  private clock = new THREE.Clock();
  private raf = 0;
  private resize: ResizeObserver;
  private lowPower = prefersLowPower();
  private reduceMotion = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  private audio = new DetectiveAudio();
  private dropEnv: () => void = () => {};
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private down: { x: number; y: number } | null = null;
  private running = true;
  private disposed = false;

  // World
  private village: Village;
  private sky = makeSky();
  private clouds = makeClouds();
  private hemi = new THREE.HemisphereLight('#dff1ff', '#8fbf6a', 1.25);
  private sun = new THREE.DirectionalLight('#fff0d0', 2.3);
  private butterflies: ReturnType<typeof makeButterfly>[] = [];
  private droplets: THREE.Points;
  private dropV: Float32Array;
  private ripples: THREE.Mesh[] = [];
  private sparkles = new Puffs(glowTex());
  private puffs = new Puffs(glowTex());
  private hearts = new Puffs(heartTex());
  private notes: Puffs;
  private confetti: Flakes;
  private feathers: Flakes;
  private bubbles: Bubbles;

  // Ziggy
  private ziggy: ZiggyActor;
  private zig: Walker = { pos: ZIGGY_HOME.clone(), path: [], onArrive: null, yaw: 0.9, face: null, speed: 4.2 };
  private magnifier: Magnifier;
  private magnify = 0;
  private magnifyTarget = 0;
  private bonk = 0;
  private stars: THREE.Sprite[] = [];
  private zigWalk = 0;
  private zigDance = false;

  // Case
  private case: Case | null = null;
  private pals = new Map<Species, Pal>();
  private clueProps: THREE.Group[] = [];
  private bubblesSprites: THREE.Sprite[] = [];
  private mystery: { before: THREE.Group; after: THREE.Group } | null = null;
  private caseObjs: THREE.Object3D[] = [];
  private partyT = 0;
  private partyKind: MysteryId | null = null;
  private sneezeIn = 8;
  private closeUp = false;
  private gen = 0;
  private tasks: { at: number; gen: number; fn: () => void }[] = [];
  private time = 0;

  // Camera
  /** Camera aim: a centre and the half-width / half-height (world units) to keep in view. */
  private view = { center: new THREE.Vector3(0, 0.9, 0), rx: 6, ry: 3, pitch: 0.55, yaw: 0 };
  private cur = { center: new THREE.Vector3(0, 1.4, -2), rx: 12, ry: 8, pitch: 0.7, yaw: 0.4 };
  private mode: 'lineup' | 'other' = 'other';
  private insets = { top: 0, bottom: 0 };
  private insetsCur = { top: 0, bottom: 0 };
  private perf = { frames: 0, time: 0, ratio: 0 };

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: DetectiveOptions,
    private cb: DetectiveCallbacks
  ) {
    this.renderer = createRenderer(canvas, { lowPower: this.lowPower });
    this.renderer.toneMappingExposure = 1.0;
    if (this.lowPower) this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.village = buildVillage(this.lowPower);
    this.ziggy = makeZiggy({ lowPower: this.lowPower });
    this.magnifier = makeMagnifier();
    const nDrops = this.lowPower ? 50 : 110;
    const dpos = new Float32Array(nDrops * 3);
    this.dropV = new Float32Array(nDrops * 3);
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    this.droplets = new THREE.Points(dg, new THREE.PointsMaterial({ color: '#e8f8ff', map: glowTex(), size: 0.16, transparent: true, opacity: 0.9, depthWrite: false }));
    this.droplets.frustumCulled = false;
    this.notes = new Puffs(noteTexture());
    this.confetti = new Flakes(this.lowPower ? 140 : 260);
    this.feathers = new Flakes(40, 'feather');
    this.bubbles = new Bubbles(this.lowPower ? 24 : 40);
    this.buildWorld();
    this.buildZiggy();
    this.dropEnv = studioEnvironment(this.renderer, this.ziggy, 0.5);
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointerup', this.onUp);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(canvas.parentElement ?? canvas);
    this.fit();
    this.cur.center.copy(this.view.center);
    this.loop();
  }

  /* ───────────────────────── World ───────────────────────── */

  private buildWorld() {
    const s = this.scene;
    s.fog = new THREE.Fog('#dcefff', 40, 115);
    const u = this.sky.material.uniforms;
    (u.top.value as THREE.Color).set('#5fb6ff');
    (u.bottom.value as THREE.Color).set('#fff0d2');
    (u.below.value as THREE.Color).set('#cdeaff');
    s.add(this.sky, this.clouds, this.hemi);
    this.sun.position.set(-9, 18, 11);
    this.sun.castShadow = true;
    const sm = this.lowPower ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    Object.assign(this.sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    s.add(this.sun);
    // A warm fill from the front so faces glow.
    const fill = new THREE.DirectionalLight('#ffe3c0', 0.55);
    fill.position.set(4, 6, 14);
    s.add(fill);

    s.add(this.village.group);
    mergeStatic(this.village.group, true);
    mergeStatic(this.clouds);

    // Fountain water: droplets and ripples.
    const pos = this.droplets.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) this.respawnDrop(i, Math.random());
    s.add(this.droplets);
    for (let i = 0; i < 3; i++) {
      const rp = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.36, 28), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
      rp.rotation.x = -Math.PI / 2;
      rp.position.y = 0.47;
      rp.userData.phase = i / 3;
      this.ripples.push(rp);
      s.add(rp);
    }
    if (!this.reduceMotion)
      ['#ffd166', '#ff9ad5', '#9fd8ff'].forEach((col) => {
        const b = makeButterfly(col);
        this.butterflies.push(b);
        s.add(b);
      });
    s.add(this.sparkles.group, this.puffs.group, this.hearts.group, this.notes.group, this.confetti.mesh, this.feathers.mesh, this.bubbles.mesh);
  }

  private respawnDrop(i: number, age = 0) {
    const pos = this.droplets.geometry.attributes.position as THREE.BufferAttribute;
    const a = Math.random() * Math.PI * 2;
    const sp = 0.7 + Math.random() * 0.5;
    const jet = this.village.fountain.userData.jets;
    let x = jet.x;
    let y = jet.y;
    let z = jet.z;
    let vx = Math.cos(a) * sp;
    let vy = 1.6 + Math.random() * 0.8;
    let vz = Math.sin(a) * sp;
    // Pre-age so the jet is full from the first frame.
    const tt = age * 0.9;
    x += vx * tt;
    z += vz * tt;
    y += vy * tt - 4.9 * tt * tt;
    vy -= 9.8 * tt;
    if (y < 0.5) {
      y = jet.y;
      x = jet.x;
      z = jet.z;
      vy = 1.6;
      vx = Math.cos(a) * sp;
      vz = Math.sin(a) * sp;
    }
    pos.setXYZ(i, x, y, z);
    this.dropV[i * 3] = vx;
    this.dropV[i * 3 + 1] = vy;
    this.dropV[i * 3 + 2] = vz;
  }

  private buildZiggy() {
    const z = this.ziggy;
    const model = z.userData.model;
    model.hatAnchor.add(makeDetectiveCap());
    // The magnifying glass in the right hand.
    const mg = this.magnifier.group;
    mg.position.set(0, -0.2, 0.06);
    mg.rotation.set(Math.PI / 2 + 0.25, 0, 0);
    model.arms[1].wrist.add(mg);
    z.position.copy(ZIGGY_HOME);
    z.scale.setScalar(0.92);
    z.userData.rig.energy = this.reduceMotion ? 0.4 : 1;
    this.scene.add(z);
    for (let i = 0; i < 3; i++) {
      const st = glow('#ffe066', 0.35, 0);
      this.stars.push(st);
      this.scene.add(st);
    }
  }

  /* ───────────────────────── Layout ───────────────────────── */

  private fit() {
    const el = this.canvas.parentElement ?? this.canvas;
    const w = el.clientWidth || 800;
    const h = el.clientHeight || 600;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // A narrow lens: a flatter, diorama-like view where far and near friends look alike.
    this.camera.fov = w < h ? 38 : 34;
    this.applyOffset();
    if (this.mode === 'lineup') this.frameLineup();
  }

  /** The HUD covers the top and the bottom: aim the camera at what stays visible. */
  setInsets(top: number, bottom: number) {
    this.insets.top = Math.max(0, top);
    this.insets.bottom = Math.max(0, bottom);
  }

  private applyOffset() {
    const el = this.canvas.parentElement ?? this.canvas;
    const w = el.clientWidth || 800;
    const h = el.clientHeight || 600;
    const shift = (this.insetsCur.bottom - this.insetsCur.top) / 2;
    if (Math.abs(shift) > 0.5) this.camera.setViewOffset(w, h, 0, shift, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  private portrait() {
    return this.camera.aspect < 0.9;
  }

  private setView(center: THREE.Vector3, rx: number, ry: number, pitch: number, yaw = 0) {
    this.view.center.copy(center);
    this.view.rx = rx;
    this.view.ry = ry;
    this.view.pitch = pitch;
    this.view.yaw = yaw;
  }

  private frameLineup() {
    this.mode = 'lineup';
    if (this.portrait()) this.setView(new THREE.Vector3(0, 0.7, 0.5), 4.4, 3.3, 0.62, 0);
    else this.setView(new THREE.Vector3(-0.9, 0.75, 0.7), 5.15, 2.5, 0.52, 0.05);
  }

  /* ───────────────────────── The story ───────────────────────── */

  /** Scheduled on the game clock (pauses with the game, dropped with the case). */
  private after(sec: number, fn: () => void) {
    this.tasks.push({ at: this.time + (this.reduceMotion ? sec * 0.7 : sec), gen: this.gen, fn });
  }

  startCase(c: Case) {
    this.gen++;
    this.tasks = [];
    this.clearCase();
    this.case = c;
    this.partyT = 0;
    this.partyKind = null;
    this.zigDance = false;
    this.magnifyTarget = 0;
    // The scene of the mystery.
    this.mystery = makeMysteryScene(c.mystery);
    this.scene.add(this.mystery.before, this.mystery.after);
    // The friends walk in from the edges of the square.
    c.suspects.forEach((s, i) => {
      const a = makeSuspect(s, this.lowPower);
      const scale = s.size === 'big' ? 1.2 : 0.82;
      const home = new THREE.Vector3(SLOT_X[s.col], 0, SLOT_Z[s.row]);
      const side = s.col === 'left' ? -1 : s.col === 'right' ? 1 : i % 2 ? 1 : -1;
      const start = new THREE.Vector3(side * (13 + i * 0.8), 0, s.row === 'front' ? 4 + i * 0.3 : -3 - i * 0.3);
      const ring = groundRing('#ffd84d', 0.85);
      a.c.root.add(ring);
      const pal: Pal = {
        a,
        scale,
        home,
        pos: start.clone(),
        path: [],
        onArrive: null,
        yaw: side > 0 ? -Math.PI / 2 : Math.PI / 2,
        face: null,
        speed: 3.2,
        hop: Math.random() * 3,
        jump: 0,
        blink: 0,
        nextBlink: 1 + Math.random() * 3,
        talk: 0,
        shake: 0,
        stretch: 0,
        resting: false,
        glow: 0,
        glowTarget: 0,
        ring,
        sneeze: 0,
        prop: null,
        propT: 0,
        extras: [],
        blushK: 0,
        blushTarget: 0,
        float: 0,
        floatTarget: 0,
        dance: false,
        phase: Math.random() * 6,
        look: null,
      };
      a.c.root.scale.setScalar(scale);
      a.c.root.position.copy(start);
      this.scene.add(a.c.root);
      this.pals.set(s.id, pal);
      this.walk(pal, home);
    });
    this.cb.onPortraits(this.renderPortraits());
    // Clue props, hidden until Ziggy finds them.
    this.clueProps = c.clues.map((clue) => {
      const kind = propKind(clue);
      const lit = clue.lits[0];
      const color = lit.trait.k === 'hat' || lit.trait.k === 'scarf' ? HUE_HEX[lit.trait.hue] : '#ffffff';
      const big = lit.trait.k === 'size' && lit.trait.size === 'big';
      let tex: THREE.Texture | undefined;
      if (kind === 'note') {
        const t = new THREE.CanvasTexture(clueCanvas(clue, 256));
        t.colorSpace = THREE.SRGBColorSpace;
        tex = t;
      }
      const g = makeClueProp(kind, color, big, tex);
      const place = CLUE_PLACES[clue.spot];
      g.position.copy(place.at);
      g.rotation.y = place.face;
      g.scale.setScalar(0.001);
      g.visible = false;
      g.userData.grow = 0;
      this.scene.add(g);
      return g;
    });
    // Ziggy discovers the mystery: a cut to the party table, Ziggy already there.
    this.closeUp = true;
    this.setView(MYSTERY_SPOT.clone().add(new THREE.Vector3(1.0, 1.0, 0.5)), 2.3, 1.45, 0.3, 0.45);
    this.mode = 'other';
    this.cur.center.copy(this.view.center);
    Object.assign(this.cur, { rx: this.view.rx, ry: this.view.ry, pitch: this.view.pitch, yaw: this.view.yaw });
    this.zig.path = [];
    this.zig.onArrive = null;
    this.zig.pos.copy(ZIGGY_MYSTERY);
    this.zig.face = MYSTERY_SPOT.clone();
    this.zig.yaw = Math.atan2(MYSTERY_SPOT.x - ZIGGY_MYSTERY.x, MYSTERY_SPOT.z - ZIGGY_MYSTERY.z);
    this.after(0.6, () => {
      this.ziggy.userData.rig.cue('oops');
      this.sfx('oops');
      this.sparkles.emit(MYSTERY_SPOT.clone().add(new THREE.Vector3(0, 1.2, 0)), { color: '#ffe066', count: this.lowPower ? 10 : 18, spread: 1.6, up: 1.4, life: 1.2, size: 0.3, additive: true });
    });
    this.after(3.4, () => {
      this.closeUp = false;
      this.frameLineup();
      this.walkZiggy(ZIGGY_HOME, () => (this.zig.face = new THREE.Vector3(0, 0, 0)));
    });
    this.after(5.2, () => this.cb.onReady());
  }

  private clearCase() {
    for (const p of this.pals.values()) {
      this.scene.remove(p.a.c.root);
      disposeTree(p.a.c.root);
    }
    this.pals.clear();
    for (const o of [...this.clueProps, ...this.bubblesSprites, ...this.caseObjs]) {
      this.scene.remove(o);
      disposeTree(o);
    }
    this.clueProps = [];
    this.bubblesSprites = [];
    this.caseObjs = [];
    if (this.mystery) {
      this.scene.remove(this.mystery.before, this.mystery.after);
      disposeTree(this.mystery.before);
      disposeTree(this.mystery.after);
      this.mystery = null;
    }
  }

  /** Ziggy walks to the clue, the camera comes close, the clue appears under the magnifier. */
  showClue(step: number) {
    const c = this.case;
    if (!c || !c.clues[step]) return;
    const clue = c.clues[step];
    const place = CLUE_PLACES[clue.spot];
    const dir = new THREE.Vector3(Math.sin(place.face), 0, Math.cos(place.face));
    const perp = new THREE.Vector3(dir.z, 0, -dir.x);
    // Ziggy stands beside the clue (not in front of it), seen three-quarters by the camera.
    const stand = place.at.clone().addScaledVector(perp, 0.95 * place.side).addScaledVector(dir, 0.25);
    const prop = this.clueProps[step];
    prop.visible = true;
    // A glint shows where the clue is.
    this.sparkles.emit(place.at.clone().add(new THREE.Vector3(0, 0.4, 0)), { color: '#fff3a8', count: this.lowPower ? 8 : 14, spread: 0.8, up: 1.2, life: 1.0, size: 0.35, additive: true });
    this.closeUp = true;
    this.mode = 'other';
    const mid = place.at.clone().lerp(stand, 0.45).add(new THREE.Vector3(0, 0.85, 0));
    this.setView(mid, 1.7, 1.25, 0.36, place.face - 0.55 * place.side);
    this.magnifyTarget = 0;
    this.walkZiggy(stand, () => {
      this.zig.face = place.at.clone();
      this.magnifyTarget = 1;
      this.after(0.5, () => {
        prop.userData.grow = 0.001;
        this.sfx('clue');
        this.sparkles.emit(place.at.clone().add(new THREE.Vector3(0, 0.5, 0)), { color: '#ffe066', count: this.lowPower ? 14 : 26, spread: 1.6, up: 2.2, life: 1.3, size: 0.4, additive: true });
        // The picture of the clue pops above it.
        const tex = new THREE.CanvasTexture(clueCanvas(clue, 256));
        tex.colorSpace = THREE.SRGBColorSpace;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
        const ratio = (tex.image as HTMLCanvasElement).width / (tex.image as HTMLCanvasElement).height;
        sp.userData.size = new THREE.Vector2(0.9 * ratio, 0.9);
        sp.userData.grow = 0;
        sp.position.copy(place.at).add(new THREE.Vector3(0, 1.75, 0)).addScaledVector(dir, 0.2);
        sp.scale.set(0.001, 0.001, 1);
        this.scene.add(sp);
        this.bubblesSprites.push(sp);
        this.ziggy.userData.rig.cue('nod');
        this.cb.onClueFound(step);
      });
    });
  }

  /** Back to the line-up: Ziggy goes home, the camera frames the friends. */
  lineup() {
    this.closeUp = false;
    this.magnifyTarget = 0;
    this.frameLineup();
    for (const sp of this.bubblesSprites) sp.userData.small = true;
    this.walkZiggy(ZIGGY_HOME, () => (this.zig.face = new THREE.Vector3(0, 0, 0)));
  }

  /** A friend is cleared: a happy hop, then off to the café terrace. */
  clear(id: Species) {
    const p = this.pals.get(id);
    if (!p) return;
    p.jump = 1;
    p.talk = 1.1;
    p.glowTarget = 0;
    this.sfx('clear');
    this.sparkles.emit(p.pos.clone().add(new THREE.Vector3(0, 1.4 * p.scale, 0)), { color: '#9bf07f', count: this.lowPower ? 10 : 18, spread: 1.4, up: 2, life: 1.0, size: 0.32, additive: true });
    const used = new Set([...this.pals.values()].filter((x) => x.resting && x !== p).map((x) => REST_SPOTS.findIndex((r) => r.distanceTo(x.home) < 0.01)));
    const free = REST_SPOTS.map((r, i) => ({ r, i })).filter(({ i }) => !used.has(i));
    const best = free.sort((a, b) => a.r.distanceTo(p.pos) - b.r.distanceTo(p.pos))[0] ?? { r: REST_SPOTS[0], i: 0 };
    p.resting = true;
    p.home = best.r.clone();
    this.after(0.55, () => {
      this.walk(p, best.r, () => {
        p.face = new THREE.Vector3(0, 0, 1.5);
        p.jump = 1;
      });
    });
  }

  /** The child tried to clear a friend who matches: "hey, look at my hat!" */
  objection(id: Species, clue: Clue) {
    const p = this.pals.get(id);
    if (!p) return;
    p.shake = 1;
    p.talk = 1.2;
    this.sfx('oops');
    this.ziggy.userData.rig.cue('oops');
    const lit = clue.lits.find((l) => litHolds(p.a.data, l) && !l.not) ?? clue.lits[0];
    const head = p.a.c.head;
    const at = new THREE.Vector3();
    switch (lit.trait.k) {
      case 'hat':
      case 'anyHat':
        if (p.a.hat) {
          p.a.hat.userData.bounce = 1;
          p.a.hat.getWorldPosition(at);
        } else head.getWorldPosition(at);
        break;
      case 'glasses':
        (p.a.glasses ?? head).getWorldPosition(at);
        break;
      case 'scarf':
      case 'anyScarf':
        p.a.c.neck.getWorldPosition(at);
        break;
      case 'size':
        p.stretch = 1;
        head.getWorldPosition(at);
        break;
      default:
        p.glow = 1;
        at.copy(p.pos).add(new THREE.Vector3(0, 0.3, 0));
    }
    this.sparkles.emit(at, { color: '#fff3a8', count: this.lowPower ? 10 : 18, spread: 0.9, up: 1.2, life: 1.0, size: 0.3, additive: true });
  }

  /** A wrong accusation: the friend proudly shows their alibi; Ziggy bonks his magnifier on his cap. */
  alibi(id: Species) {
    const p = this.pals.get(id);
    if (!p) return;
    p.jump = 1;
    p.talk = 2.6;
    if (p.prop) {
      p.a.c.root.remove(p.prop);
      disposeTree(p.prop);
    }
    const prop = makeAlibiProp(SPECIES_INFO[id].alibiProp);
    prop.position.set(0, 2.55, 0.2);
    prop.scale.setScalar(0.001);
    p.a.c.root.add(prop);
    p.prop = prop;
    p.propT = 3.4;
    this.sfx('pop');
    this.sparkles.emit(p.pos.clone().add(new THREE.Vector3(0, 2.4 * p.scale, 0)), { color: '#ffffff', count: 12, spread: 1, up: 1.4, life: 0.9, size: 0.3, additive: true });
    this.bonk = 1;
    this.after(0.35, () => {
      this.sfx('bonk');
      this.ziggy.userData.rig.cue('oops');
    });
  }

  /** The culprit steps forward, blushes, shows the giveaway… then the party. */
  confess(id: Species) {
    const c = this.case;
    const p = this.pals.get(id);
    if (!c || !p) return;
    this.sfx('reveal');
    this.closeUp = true;
    this.mode = 'other';
    p.glowTarget = 0;
    // The culprit steps forward (we watch them come), then the camera comes close.
    p.jump = 1;
    p.blushTarget = 0.6;
    this.walkZiggy(ZIGGY_STAGE, () => (this.zig.face = STAGE.clone()));
    p.speed = 5;
    this.walk(p, STAGE, () => {
      p.speed = 3.2;
      p.face = new THREE.Vector3(0.6, 0, 20);
      p.blushTarget = 1;
      p.talk = 3.2;
      p.jump = 1;
      this.giveaway(p, c.mystery);
      this.hearts.emit(p.pos.clone().add(new THREE.Vector3(0, 1.8 * p.scale, 0)), { count: 6, spread: 1.2, up: 1.2, life: 1.6, size: 0.35 });
      const head = STAGE.clone().add(new THREE.Vector3(-0.55, 0.95 * p.scale + 0.25, 0));
      this.setView(head, 1.55 + p.scale * 0.2, 0.95 + p.scale * 0.25, 0.12, 0.12);
      this.after(4.2, () => this.party());
    });
  }

  private giveaway(p: Pal, mystery: MysteryId) {
    const add = (o: THREE.Object3D, parent: THREE.Object3D) => {
      parent.add(o);
      p.extras.push(o);
    };
    switch (mystery) {
      case 'cake': {
        const cr = makeCrumbs();
        cr.position.copy(p.a.mouth).add(new THREE.Vector3(0, -0.02, 0.04));
        add(cr, p.a.c.head);
        break;
      }
      case 'trumpet': {
        const tr = makeTrumpet();
        tr.position.copy(p.a.mouth).add(new THREE.Vector3(0, -0.04, 0.2));
        tr.rotation.x = 0.15;
        add(tr, p.a.c.head);
        this.sfx('toot');
        for (let i = 0; i < 4; i++)
          this.after(i * 0.35, () => this.notes.emit(p.pos.clone().add(new THREE.Vector3(0.3, 1.5 * p.scale, 0.6)), { count: 1, spread: 0.8, up: 1.0, life: 1.8, size: 0.35 }));
        break;
      }
      case 'mud': {
        add(makeMud(), p.a.c.root);
        break;
      }
      case 'flowers': {
        const b = makeBouquet();
        b.position.set(0.15, 0.7, 0.6);
        b.rotation.x = 0.3;
        add(b, p.a.c.root);
        break;
      }
      case 'balloons': {
        ['#ff5f6d', '#ffd166', '#5fb8ff', '#7ed957'].forEach((col, i) => {
          const bl = makeBalloon(col, 1.3 + (i % 2) * 0.25);
          bl.position.set(0.55 + (i - 1.5) * 0.18, 0.7, 0.1);
          bl.rotation.z = (i - 1.5) * -0.15;
          add(bl, p.a.c.root);
        });
        p.floatTarget = 0.6;
        break;
      }
    }
  }

  /** Everyone together on the square: cake, balloons, bubbles, flowers, music. */
  party() {
    const c = this.case;
    if (!c || !this.mystery) return;
    this.closeUp = false;
    this.mode = 'other';
    this.partyKind = c.mystery;
    this.partyT = this.reduceMotion ? 4 : 9;
    this.sfx('party');
    this.mystery.after.visible = true;
    this.mystery.after.scale.setScalar(0.01);
    this.mystery.after.userData.grow = 0.01;
    if (c.mystery === 'cake') this.mystery.before.visible = false;
    this.mystery.before.traverse((o) => {
      if (o.name === 'dirty') o.visible = false;
    });
    const list = [...this.pals.values()];
    const n = list.length;
    const spread = Math.min(Math.PI * 1.15, n * 0.62);
    list.forEach((p, i) => {
      p.resting = false;
      p.floatTarget = 0;
      const a = -Math.PI / 2 + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0);
      const target = new THREE.Vector3(Math.cos(a) * 3.3, 0, Math.sin(a) * 3.3 + 0.2);
      p.home = target.clone();
      this.walk(p, target, () => {
        p.face = new THREE.Vector3(target.x * 0.4, 0, 14);
        p.dance = true;
        if (c.mystery === 'cake') {
          const sl = makeSlice();
          sl.position.set(0, 0.85, 0.5);
          p.a.c.root.add(sl);
          p.extras.push(sl);
        }
        if (c.mystery === 'balloons' && !p.extras.some((e) => e.userData.balloon)) {
          const bl = makeBalloon(['#ff5f6d', '#ffd166', '#5fb8ff', '#7ed957', '#c99bff'][i % 5], 1.4);
          bl.userData.balloon = true;
          bl.position.set(0.5, 0.6, 0);
          p.a.c.root.add(bl);
          p.extras.push(bl);
        }
      });
    });
    if (c.mystery === 'flowers') {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const f = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4), new THREE.MeshLambertMaterial({ color: '#4f9a3f' }));
        stem.position.y = 0.2;
        const tulip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshLambertMaterial({ color: ['#ff5f8f', '#ffd166', '#ff7a45', '#c99bff'][i % 4] }));
        tulip.scale.y = 1.4;
        tulip.position.y = 0.45;
        f.add(stem, tulip);
        f.position.set(Math.cos(a) * 9.6, 0, Math.sin(a) * 9.6);
        f.scale.setScalar(0.01);
        f.userData.grow = 0.01;
        f.userData.delay = i * 0.12;
        this.scene.add(f);
        this.caseObjs.push(f);
      }
    }
    if (c.mystery === 'mud') this.bubbles.start(this.reduceMotion ? 4 : 9);
    this.walkZiggy(new THREE.Vector3(0, 0, 2.6), () => {
      this.zig.face = new THREE.Vector3(0, 0, 20);
      this.zigDance = true;
      this.ziggy.userData.rig.cue('cheer');
    });
    this.setView(new THREE.Vector3(0, 1.0, 0.2), this.portrait() ? 4.4 : 4.6, 2.5, 0.42, 0);
    this.cb.onParty();
  }

  /** The friend focused or hovered in the HUD shines on the square. */
  highlight(id: Species | null) {
    for (const [k, p] of this.pals) p.glowTarget = k === id && !p.resting ? 1 : 0;
    const p = id ? this.pals.get(id) : null;
    if (p && !p.resting && p.jump <= 0) p.jump = 0.6;
  }

  setMusic(on: boolean) {
    if (on) this.audio.startMusic();
    else this.audio.stopMusic();
  }

  sfx(kind: Sfx) {
    this.audio.play(kind);
  }

  /* ───────────────────────── Walking ───────────────────────── */

  private walk(p: Walker, to: THREE.Vector3, then?: () => void) {
    p.path = route(p.pos, to);
    p.onArrive = then ?? null;
    p.face = null;
  }

  private walkZiggy(to: THREE.Vector3, then?: () => void) {
    this.walk(this.zig, to, then);
  }

  /** Move along the path; returns whether it moved. */
  private advance(w: Walker, dt: number): boolean {
    const next = w.path[0];
    if (!next) return false;
    const d = next.clone().sub(w.pos).setY(0);
    const dist = d.length();
    const stepLen = w.speed * dt;
    if (dist <= stepLen) {
      w.pos.copy(next);
      w.path.shift();
      if (!w.path.length) {
        const then = w.onArrive;
        w.onArrive = null;
        then?.();
      }
    } else w.pos.addScaledVector(d.normalize(), stepLen);
    if (dist > 0.001) w.yaw = lerpAngle(w.yaw, Math.atan2(d.x, d.z), Math.min(1, dt * 10));
    return true;
  }

  /* ───────────────────────── Portraits ───────────────────────── */

  /** Small pictures of each friend's face (with hat and glasses) for the HUD buttons. */
  private renderPortraits(): PortraitMap {
    const out: PortraitMap = {};
    try {
      const size = 112;
      const pr = this.renderer.getPixelRatio();
      const buf = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      if (buf.x < size * pr || buf.y < size * pr) return out;
      const ps = new THREE.Scene();
      ps.background = new THREE.Color('#fff1d6');
      ps.add(new THREE.HemisphereLight('#ffffff', '#c8b8a0', 1.6));
      const key = new THREE.DirectionalLight('#ffffff', 1.6);
      key.position.set(-2, 3, 4);
      ps.add(key);
      const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
      const c2 = document.createElement('canvas');
      c2.width = c2.height = size * 2;
      const g = c2.getContext('2d')!;
      this.renderer.setScissorTest(true);
      for (const [id, p] of this.pals) {
        const root = p.a.c.root;
        const parent = root.parent;
        const keep = { pos: root.position.clone(), rot: root.rotation.clone(), scale: root.scale.clone() };
        ps.add(root);
        root.position.set(0, 0, 0);
        root.rotation.set(0, 0.25, 0);
        root.scale.setScalar(1);
        p.ring.visible = false;
        root.updateMatrixWorld(true);
        // The face, the hat and the scarf (little ones compare the scarves too).
        const box = new THREE.Box3().setFromObject(p.a.c.head);
        box.expandByPoint(p.a.c.neck.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.22, 0)));
        const center = box.getCenter(new THREE.Vector3());
        const sz = box.getSize(new THREE.Vector3());
        const r = Math.max(sz.x, sz.y) * 0.56 + 0.05;
        cam.position.set(center.x + 0.25, center.y + 0.12, center.z + r / Math.tan(THREE.MathUtils.degToRad(15)));
        cam.lookAt(center.x, center.y - 0.04, center.z);
        this.renderer.setViewport(0, 0, size, size);
        this.renderer.setScissor(0, 0, size, size);
        this.renderer.render(ps, cam);
        g.clearRect(0, 0, c2.width, c2.height);
        g.drawImage(this.renderer.domElement, 0, buf.y - size * pr, size * pr, size * pr, 0, 0, c2.width, c2.height);
        out[id] = c2.toDataURL('image/png');
        ps.remove(root);
        parent?.add(root);
        root.position.copy(keep.pos);
        root.rotation.copy(keep.rot);
        root.scale.copy(keep.scale);
        p.ring.visible = true;
      }
    } catch {
      /* no portraits: the buttons show emoji instead */
    } finally {
      this.renderer.setScissorTest(false);
      const el = this.canvas.parentElement ?? this.canvas;
      this.renderer.setViewport(0, 0, el.clientWidth || 800, el.clientHeight || 600);
    }
    return out;
  }

  /* ───────────────────────── Input ───────────────────────── */

  private onDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY };
  };

  private onUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 14) return;
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const boxes = [...this.pals.values()].filter((p) => !p.resting).map((p) => p.a.c.hitbox);
    const hit = this.ray.intersectObjects(boxes, false)[0];
    const id = hit?.object.userData.suspect as Species | undefined;
    if (id) this.cb.onSuspectTap(id);
  };

  private onVisibility = () => {
    if (document.hidden) {
      this.running = false;
      cancelAnimationFrame(this.raf);
      this.audio.suspend();
    } else if (!this.running && !this.disposed) {
      this.running = true;
      this.clock.getDelta();
      this.audio.resume();
      this.loop();
    }
  };

  /* ───────────────────────── Frame ───────────────────────── */

  private loop = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const raw = this.clock.getDelta();
    const dt = Math.min(0.1, raw);
    this.time += dt;
    this.step(dt, this.time);
    this.renderer.render(this.scene, this.camera);
    this.adaptResolution(raw);
  };

  /** Weak device: lower the internal resolution step by step (never below 0.55). */
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

  private step(dt: number, t: number) {
    const motion = this.reduceMotion ? 0.4 : 1;
    // Scheduled story beats.
    if (this.tasks.length) {
      const due = this.tasks.filter((k) => k.at <= t);
      if (due.length) {
        this.tasks = this.tasks.filter((k) => k.at > t);
        for (const k of due) if (k.gen === this.gen) k.fn();
      }
    }

    this.stepZiggy(dt, t);
    for (const p of this.pals.values()) this.stepPal(p, dt, t, motion);
    this.stepSneeze(dt);

    // Clue props grow in; clue pictures pop and shrink once seen.
    for (const g of this.clueProps) {
      const u = g.userData;
      if (u.grow > 0 && u.grow < 1) {
        u.grow = Math.min(1, u.grow + dt * 2.4);
        const k = u.grow;
        g.scale.setScalar(Math.max(0.001, 1 + Math.sin(k * Math.PI) * 0.35 - (1 - k) * 0.8));
      }
    }
    for (const sp of this.bubblesSprites) {
      const u = sp.userData;
      u.grow = Math.min(1, u.grow + dt * 3);
      const target = u.small ? 0.55 : 1;
      u.k = (u.k ?? 0) + (target * (u.grow < 1 ? 1 + Math.sin(u.grow * Math.PI) * 0.3 : 1) - (u.k ?? 0)) * Math.min(1, dt * 8);
      sp.scale.set(u.size.x * u.k, u.size.y * u.k, 1);
      sp.position.y += Math.sin(t * 2 + sp.id) * 0.0015 * motion;
    }
    // The mystery's "after" scene grows in at the party.
    if (this.mystery?.after.userData.grow !== undefined && this.mystery.after.userData.grow < 1) {
      const u = this.mystery.after.userData;
      u.grow = Math.min(1, u.grow + dt * 1.8);
      this.mystery.after.scale.setScalar(Math.max(0.01, 1 + Math.sin(u.grow * Math.PI) * 0.25 - (1 - u.grow) * 0.9));
    }
    for (const o of this.caseObjs) {
      const u = o.userData;
      if (u.grow !== undefined && u.grow < 1) {
        u.delay = (u.delay ?? 0) - dt;
        if (u.delay <= 0) {
          u.grow = Math.min(1, u.grow + dt * 2);
          o.scale.setScalar(Math.max(0.01, 1 + Math.sin(u.grow * Math.PI) * 0.3 - (1 - u.grow) * 0.9));
        }
      }
    }

    // Party: confetti and music notes.
    if (this.partyT > 0) {
      const before = this.partyT;
      this.partyT -= dt;
      if (Math.floor(before * 2.5) !== Math.floor(this.partyT * 2.5)) {
        const cols = ['#ff5f6d', '#ffd166', '#5fb8ff', '#7ed957', '#c99bff', '#ff9a3c'];
        const at = new THREE.Vector3((Math.random() - 0.5) * 7, 4.5, (Math.random() - 0.5) * 4);
        this.confetti.emit(at, { count: this.lowPower ? 14 : 26, colors: cols, spread: 3, up: 1.5, life: 3, grav: 2.2, drag: 1.2, sway: 1.2 });
        if (this.partyKind === 'trumpet') this.notes.emit(new THREE.Vector3((Math.random() - 0.5) * 6, 2, (Math.random() - 0.5) * 3), { count: 2, spread: 1, up: 1, life: 2, size: 0.4 });
        if (this.partyKind === 'cake' && Math.random() < 0.3) this.hearts.emit(new THREE.Vector3((Math.random() - 0.5) * 6, 2, (Math.random() - 0.5) * 3), { count: 2, spread: 1, up: 1, life: 1.8, size: 0.3 });
      }
    }

    // Square life.
    this.stepWater(dt, t, motion);
    this.clouds.rotation.y += dt * 0.004;
    const flag = this.village.flag;
    if (flag) flag.rotation.y = Math.sin(t * 2.2) * 0.25 * motion;
    this.butterflies.forEach((b, i) => {
      const k = t * (0.3 + i * 0.07) + i * 2;
      b.position.set(Math.sin(k) * (6 + i * 1.5), 1.6 + Math.sin(k * 2.3) * 0.5 + i * 0.3, Math.cos(k * 0.8) * (5 + i) - 1);
      b.rotation.y = Math.atan2(Math.cos(k), -Math.sin(k * 0.8));
      const flap = Math.sin(t * 18 + i) * 0.9;
      b.userData.wings[0].rotation.z = flap;
      b.userData.wings[1].rotation.z = -flap;
    });
    this.sparkles.update(dt);
    this.puffs.update(dt);
    this.hearts.update(dt);
    this.notes.update(dt);
    this.confetti.update(dt, t);
    this.feathers.update(dt, t);
    this.bubbles.update(dt, t, new THREE.Vector3(0, 0, 0), 4.5);

    this.stepCamera(dt, t);
  }

  private stepWater(dt: number, t: number, motion: number) {
    const pos = this.droplets.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      this.dropV[i * 3 + 1] -= 9.8 * dt * 0.55;
      arr[i * 3] += this.dropV[i * 3] * dt * 0.55;
      arr[i * 3 + 1] += this.dropV[i * 3 + 1] * dt * 0.55;
      arr[i * 3 + 2] += this.dropV[i * 3 + 2] * dt * 0.55;
      const r = Math.hypot(arr[i * 3], arr[i * 3 + 2]);
      // Into the top bowl, or down to the big basin.
      if ((arr[i * 3 + 1] < 1.7 && r < 0.6) || arr[i * 3 + 1] < 0.48) this.respawnDrop(i);
    }
    pos.needsUpdate = true;
    const water = this.village.fountain.userData.water;
    (water.material as THREE.MeshPhongMaterial).emissiveIntensity = 0.22 + Math.sin(t * 1.6) * 0.06 * motion;
    for (const rp of this.ripples) {
      const k = (t * 0.35 + (rp.userData.phase as number)) % 1;
      rp.scale.setScalar(1 + k * 3.2);
      (rp.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.45 * motion;
    }
  }

  private stepZiggy(dt: number, t: number) {
    const z = this.zig;
    const moving = this.advance(z, dt);
    const rig = this.ziggy.userData.rig;
    this.zigWalk += ((moving ? 1 : 0) - this.zigWalk) * Math.min(1, dt * 8);
    rig.walk = this.zigWalk;
    if (!moving) {
      const look = z.face ?? this.camera.position;
      const want = Math.atan2(look.x - z.pos.x, look.z - z.pos.z);
      z.yaw = lerpAngle(z.yaw, want, Math.min(1, dt * 5));
    }
    rig.idle = this.zigDance && this.partyT > 0 ? 'dance' : 'calm';
    this.ziggy.position.copy(z.pos);
    this.ziggy.rotation.y = z.yaw;
    rig.update(dt);

    // The magnifier: raised to his eye while looking at a clue.
    this.magnify += (this.magnifyTarget - this.magnify) * Math.min(1, dt * 5);
    const arm = this.ziggy.userData.model.arms[1];
    if (this.magnify > 0.01) {
      const k = this.magnify;
      arm.shoulder.rotation.x = THREE.MathUtils.lerp(arm.shoulder.rotation.x, -1.25, k);
      arm.shoulder.rotation.z = THREE.MathUtils.lerp(arm.shoulder.rotation.z, 0.45, k);
      arm.elbow.rotation.x = THREE.MathUtils.lerp(arm.elbow.rotation.x, -0.95, k);
      arm.elbow.rotation.z = THREE.MathUtils.lerp(arm.elbow.rotation.z, 0.35, k);
      (this.magnifier.shine.material as THREE.SpriteMaterial).opacity = k * (0.5 + Math.sin(t * 5) * 0.3);
    } else (this.magnifier.shine.material as THREE.SpriteMaterial).opacity = 0;
    // Bonk! The magnifier taps his cap.
    if (this.bonk > 0) {
      this.bonk = Math.max(0, this.bonk - dt / 1.6);
      const p = 1 - this.bonk;
      const swing = p < 0.22 ? Math.sin((p / 0.22) * Math.PI * 0.5) : p < 0.4 ? 1 : Math.max(0, 1 - (p - 0.4) / 0.25);
      arm.shoulder.rotation.x = THREE.MathUtils.lerp(arm.shoulder.rotation.x, -2.2, swing);
      arm.shoulder.rotation.z = THREE.MathUtils.lerp(arm.shoulder.rotation.z, 0.6, swing);
      arm.elbow.rotation.x = THREE.MathUtils.lerp(arm.elbow.rotation.x, -1.6, swing);
      // Little stars turning around his head.
      const head = new THREE.Vector3();
      this.ziggy.userData.model.hatAnchor.getWorldPosition(head);
      this.stars.forEach((s, i) => {
        const a = t * 6 + (i * Math.PI * 2) / 3;
        s.position.set(head.x + Math.cos(a) * 0.5, head.y + 0.3 + Math.sin(a * 2) * 0.05, head.z + Math.sin(a) * 0.5);
        (s.material as THREE.SpriteMaterial).opacity = p > 0.2 ? Math.min(1, this.bonk * 2.5) : 0;
      });
    } else for (const s of this.stars) (s.material as THREE.SpriteMaterial).opacity = 0;
  }

  private stepPal(p: Pal, dt: number, t: number, motion: number) {
    const c = p.a.c;
    const moving = this.advance(p, dt);
    if (moving) p.hop += dt * 11;
    else {
      const look = p.face ?? (p.resting ? new THREE.Vector3(0, 0, 0) : this.camera.position);
      const want = Math.atan2(look.x - p.pos.x, look.z - p.pos.z) + (p.resting ? 0 : (c.idleYaw ?? 0) * 0.5);
      p.yaw = lerpAngle(p.yaw, want, Math.min(1, dt * 5));
    }
    let y = moving ? Math.abs(Math.sin(p.hop)) * 0.2 * p.scale * motion : 0;
    let squash = 0;
    if (p.jump > 0) {
      p.jump = Math.max(0, p.jump - dt / 0.6);
      const ph = 1 - p.jump;
      y += Math.sin(ph * Math.PI) * 0.6 * p.scale * motion;
      squash = ph < 0.15 ? (0.15 - ph) * 1.2 : ph > 0.85 ? (ph - 0.85) * 1.2 : -0.05;
    }
    if (p.dance && !moving) {
      const b = t * 7 + p.phase;
      y += Math.abs(Math.sin(b)) * 0.18 * p.scale * motion;
      c.root.rotation.z = Math.sin(b) * 0.12 * motion;
    } else c.root.rotation.z = 0;
    p.float += (p.floatTarget - p.float) * Math.min(1, dt * 1.2);
    y += p.float * (0.85 + Math.sin(t * 2) * 0.15);
    // Size objection: grow tall (or tiny) for a moment.
    let sy = 1;
    if (p.stretch > 0) {
      p.stretch = Math.max(0, p.stretch - dt / 1.2);
      sy = 1 + Math.sin((1 - p.stretch) * Math.PI) * (p.a.data.size === 'big' ? 0.25 : -0.2);
    }
    c.root.position.set(p.pos.x, y, p.pos.z);
    c.root.rotation.y = p.yaw;
    c.root.scale.set(p.scale, p.scale * sy, p.scale);

    const breath = Math.sin(t * 2.4 + p.phase) * 0.025;
    c.body.scale.set(1 - breath * 0.5 + squash * 0.6, 1 + breath - squash, 1 - breath * 0.5 + squash * 0.6);

    // Blink.
    p.nextBlink -= dt;
    if (p.nextBlink <= 0) {
      p.blink = 1;
      p.nextBlink = 2 + Math.random() * 3;
    }
    p.blink = Math.max(0, p.blink - dt / 0.16);
    const happy = p.talk > 0 && p.blushK > 0.5 ? 0.45 : 0;
    const eyeY = Math.max(0.1, Math.min(1 - Math.sin(p.blink * Math.PI) * 0.9, 1 - happy, p.sneeze > 0.3 ? 0.2 : 1));
    for (const e of c.eyes) e.scale.y = eyeY;

    const excite = p.dance || p.jump > 0 ? 2 : moving ? 1.5 : 1;
    for (const w of c.wiggles) w.obj.rotation[w.axis] = w.base + Math.sin(t * w.speed * excite + w.phase) * w.amp * motion;

    // Mouth: chatter while talking, open on a jump.
    if (p.talk > 0) {
      p.talk = Math.max(0, p.talk - dt);
      c.setMouth(Math.abs(Math.sin(t * 13 + p.phase)) * 0.7);
    } else c.setMouth(p.sneeze > 0 ? 0.8 : p.jump > 0.2 || p.dance ? 0.35 : 0);

    // Head: looks at Ziggy when he walks, at the child otherwise; shakes "no no" when objecting.
    const head = c.head;
    let tyaw = 0;
    let tpitch = 0;
    if (head.parent) {
      const look = p.look ?? (this.zigWalk > 0.3 ? this.zig.pos.clone().setY(1.4) : this.camera.position);
      const local = head.parent.worldToLocal(look.clone()).sub(head.position);
      tyaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -0.7, 0.7);
      tpitch = THREE.MathUtils.clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)), -0.3, 0.25);
    }
    if (p.shake > 0) {
      p.shake = Math.max(0, p.shake - dt / 1.1);
      tyaw += Math.sin(p.shake * 28) * 0.45 * p.shake;
    }
    if (p.sneeze > 0) {
      const s = 1 - p.sneeze;
      tpitch += s < 0.6 ? -0.35 * (s / 0.6) : 0.4 * Math.sin(((s - 0.6) / 0.4) * Math.PI);
      p.sneeze = Math.max(0, p.sneeze - dt / 1.3);
    }
    head.rotation.y += (tyaw - head.rotation.y) * Math.min(1, dt * (p.shake > 0 ? 20 : 6));
    head.rotation.x += (tpitch - head.rotation.x) * Math.min(1, dt * (p.sneeze > 0 ? 14 : 6));

    // Hat hop when objecting.
    const hat = p.a.hat;
    if (hat && hat.userData.bounce > 0) {
      hat.userData.bounce = Math.max(0, hat.userData.bounce - dt / 0.9);
      const k = 1 - hat.userData.bounce;
      hat.position.y = Math.sin(k * Math.PI) * 0.35;
      hat.rotation.y = k * Math.PI * 2;
    }
    // Blush.
    p.blushK += (p.blushTarget - p.blushK) * Math.min(1, dt * 2);
    for (const b of p.a.blush) {
      (b.material as THREE.SpriteMaterial).opacity = p.blushK * (0.75 + Math.sin(t * 4) * 0.15);
      b.scale.setScalar(0.45 + p.blushK * 0.15);
    }
    // Highlight ring.
    p.glow += (p.glowTarget - p.glow) * Math.min(1, dt * 8);
    const rm = p.ring.material as THREE.MeshBasicMaterial;
    rm.opacity = p.glow * (0.75 + Math.sin(t * 6) * 0.2);
    p.ring.scale.setScalar(1 + Math.sin(t * 5) * 0.06 * motion);
    // Alibi prop above the head.
    if (p.prop) {
      p.propT -= dt;
      const life = p.propT;
      const k = life > 3.0 ? 1 - (life - 3.0) / 0.4 : life < 0.5 ? Math.max(0, life / 0.5) : 1;
      p.prop.scale.setScalar(Math.max(0.001, (k * 1.7) / Math.max(0.8, p.scale)));
      p.prop.rotation.y = Math.sin(t * 2) * 0.5;
      p.prop.children.forEach((ch) => {
        if (ch.userData.juggle !== undefined) {
          const a = t * 5 + (ch.userData.juggle as number) * 2.1;
          ch.position.set(Math.cos(a) * 0.25, Math.abs(Math.sin(a)) * 0.35, 0);
        }
      });
      if (life <= 0) {
        c.root.remove(p.prop);
        disposeTree(p.prop);
        p.prop = null;
      }
    }
  }

  /** Every now and then a friend sneezes (feathers fly from the owl and the duck!). */
  private stepSneeze(dt: number) {
    if (this.closeUp || this.partyT > 0 || !this.pals.size) return;
    this.sneezeIn -= dt;
    if (this.sneezeIn > 0) return;
    this.sneezeIn = 11 + Math.random() * 9;
    const list = [...this.pals.values()].filter((p) => !p.resting && !p.path.length);
    if (!list.length) return;
    const birds = list.filter((p) => p.a.id === 'owl' || p.a.id === 'duck');
    const p = birds.length && Math.random() < 0.6 ? birds[0] : list[Math.floor(Math.random() * list.length)];
    p.sneeze = 1;
    this.after(0.75, () => {
      this.sfx('sneeze');
      const at = new THREE.Vector3();
      p.a.c.head.getWorldPosition(at);
      at.add(new THREE.Vector3(Math.sin(p.yaw) * 0.4, 0.1, Math.cos(p.yaw) * 0.4));
      if (p.a.id === 'owl' || p.a.id === 'duck') {
        const cols = p.a.id === 'owl' ? ['#a07a55', '#f3e2c4', '#c9a27a'] : ['#ffffff', '#fff6d6', '#ffe9b0'];
        this.feathers.emit(at, { count: this.lowPower ? 8 : 14, colors: cols, spread: 2.4, up: 1.8, life: 3.2, grav: 1.1, drag: 2.2, sway: 1.6, size: 1.6 });
      } else if (p.a.id === 'dragon') {
        this.puffs.emit(at, { color: '#e8e8f0', count: 6, spread: 0.8, up: 0.8, life: 1.6, size: 0.5 });
        this.sparkles.emit(at, { color: '#ffb36b', count: 8, spread: 0.8, up: 1, life: 0.8, size: 0.25, additive: true });
      } else this.puffs.emit(at, { color: '#ffffff', count: 5, spread: 0.6, up: 0.6, life: 1.2, size: 0.35 });
      // The others giggle.
      for (const o of this.pals.values()) if (o !== p && !o.resting && Math.random() < 0.6) o.talk = 0.6;
    });
  }

  private stepCamera(dt: number, t: number) {
    // HUD insets ease in, so the view never jumps.
    const ik = Math.min(1, dt * 6);
    const it = this.insetsCur;
    const changed = Math.abs(it.top - this.insets.top) > 0.5 || Math.abs(it.bottom - this.insets.bottom) > 0.5;
    it.top += (this.insets.top - it.top) * ik;
    it.bottom += (this.insets.bottom - it.bottom) * ik;
    if (changed) this.applyOffset();

    const v = this.view;
    const k = 1 - Math.exp(-dt * (this.reduceMotion ? 6 : 2.4));
    this.cur.center.lerp(v.center, k);
    this.cur.rx += (v.rx - this.cur.rx) * k;
    this.cur.ry += (v.ry - this.cur.ry) * k;
    this.cur.pitch += (v.pitch - this.cur.pitch) * k;
    this.cur.yaw = lerpAngle(this.cur.yaw, v.yaw, k);
    const el = this.canvas.parentElement ?? this.canvas;
    const h = el.clientHeight || 600;
    const safe = Math.max(0.3, (h - it.top - it.bottom) / h);
    const vf = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const tanV = Math.tan(vf) * safe;
    const tanH = Math.tan(vf) * this.camera.aspect;
    const dist = Math.max(this.cur.rx / tanH, this.cur.ry / tanV) + 0.5;
    const sway = this.reduceMotion ? 0 : Math.sin(t * 0.15) * 0.03 + (this.partyT > 0 ? Math.sin(t * 0.3) * 0.15 : 0);
    const yaw = this.cur.yaw + sway;
    const p = this.cur.pitch;
    const c = this.cur.center;
    this.camera.position.set(c.x + Math.sin(yaw) * Math.cos(p) * dist, c.y + Math.sin(p) * dist, c.z + Math.cos(yaw) * Math.cos(p) * dist);
    this.camera.lookAt(c);
  }

  /** Dev and test helper: where things are. */
  debugState() {
    return {
      ziggy: this.zig.pos.toArray(),
      ziggyMoving: this.zig.path.length > 0,
      closeUp: this.closeUp,
      pals: [...this.pals.entries()].map(([id, p]) => ({ id, pos: p.pos.toArray(), resting: p.resting, moving: p.path.length > 0 })),
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      ratio: this.renderer.getPixelRatio(),
    };
  }

  dispose() {
    this.disposed = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.resize.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointerup', this.onUp);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.audio.dispose();
    this.clearCase();
    this.confetti.dispose();
    this.feathers.dispose();
    this.bubbles.dispose();
    this.scene.remove(this.ziggy);
    this.ziggy.userData.model.dispose();
    disposeTree(this.scene);
    this.dropEnv();
    this.renderer.dispose();
  }
}
