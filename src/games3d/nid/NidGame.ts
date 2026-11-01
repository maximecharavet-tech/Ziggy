import * as THREE from 'three';
import type { CompanionId } from '@/data/types';
import { createRenderer, disposeTree, glowTex, labelSprite, prefersLowPower } from '../kit/look';
import { Puffs } from '../kit/world';
import { GameAudio } from '../kit/music';
import { makeCompanion, makeCrown, makeFlowerCrown, makeScarf, type CompanionRig } from './companions3d';
import { makeZiggyCompanion } from './ziggy-companion';
import {
  SPOT,
  heartTex,
  makeAppleTree,
  makeBall,
  mergeStatic,
  makeBasket,
  makeBlanket,
  makeBubble,
  makeButterfly,
  makeClouds,
  makeCottage,
  makeDecor,
  makeFence,
  makeFood,
  makeHoop,
  makeIsland,
  makeNest,
  makePond,
  makeScatter,
  makeSky,
  makeSpotMarker,
  makeStars,
  makeSwing,
  textSprite,
} from './garden';
import { DECOR_SPOTS, bubblesDone, checkBubble, checkChoice, checkPick, checkThrow, countWord, heartsFromRub, stepsOf, type Challenge, type DecorId, type FoodId, type HintReason } from './logic';

export interface NidProgress {
  kind: Challenge['kind'];
  count: number;
  target: number;
  round: number;
  popped: string[];
}

export interface NidCallbacks {
  /** The child tapped the companion (outside a cuddle): it jumps with joy. */
  onCompanionTap: () => void;
  onProgress: (p: NidProgress) => void;
  /** Something to say right now (counting aloud, a letter). */
  onStep: (spoken: string) => void;
  onHint: (reason: HintReason, ctx: { count?: number; popped?: string[]; round?: number }) => void;
  onDone: (stats: { correct: number; mistakes: number; total: number }) => void;
  /** A decoration spot was tapped (decorate mode). */
  onSpot: (spot: number) => void;
}

export interface NidOptions {
  /** Who lives in the garden: Ziggy, or one of the companions. */
  companion: CompanionId | 'ziggy';
  color: string;
  stage: number;
  decor: (DecorId | null)[];
  locale: string;
}

type TapInfo =
  | { kind: 'companion' }
  | { kind: 'fruit'; fruit: 'apple' | 'pear' }
  | { kind: 'food'; food: FoodId }
  | { kind: 'hoop'; index: number }
  | { kind: 'bubble'; label: string }
  | { kind: 'spot'; index: number };

interface Flight {
  obj: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  dur: number;
  arc: number;
  done?: () => void;
}

const STAGE_SCALE = [1.15, 1.32, 1.5, 1.66];
const DAY = {
  top: new THREE.Color('#6ec2ff'),
  bottom: new THREE.Color('#ffe6c4'),
  below: new THREE.Color('#a9dcff'),
  fog: new THREE.Color('#d8eefc'),
  hemiSky: new THREE.Color('#d6ecff'),
  hemiGround: new THREE.Color('#8fae6a'),
  sun: new THREE.Color('#fff1d6'),
};
const NIGHT = {
  top: new THREE.Color('#0b1238'),
  bottom: new THREE.Color('#3b3f86'),
  below: new THREE.Color('#141a45'),
  fog: new THREE.Color('#1c2657'),
  hemiSky: new THREE.Color('#6f80d8'),
  hemiGround: new THREE.Color('#1d2440'),
  sun: new THREE.Color('#9fb4ff'),
};
const WINDOW_DAY = new THREE.Color('#cfeaff');
const WINDOW_NIGHT = new THREE.Color('#ffc865').multiplyScalar(1.4);

const lerpAngle = (a: number, b: number, k: number) => {
  let d = b - a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return a + d * k;
};

export class NidGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
  private clock = new THREE.Clock();
  private raf = 0;
  private resize: ResizeObserver;
  private lowPower = prefersLowPower();
  private reduceMotion = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  private audio = new GameAudio();
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();

  // World
  private sky = makeSky();
  private stars: ReturnType<typeof makeStars>;
  private clouds = makeClouds();
  private hemi = new THREE.HemisphereLight(DAY.hemiSky, DAY.hemiGround, 1.35);
  private sun = new THREE.DirectionalLight(DAY.sun, 2.3);
  private porch = new THREE.PointLight('#ffb35c', 0, 9, 1.6);
  private nestLight = new THREE.PointLight('#ffd9a0', 0, 6, 1.4);
  private cottage = makeCottage();
  private tree = makeAppleTree();
  private basket = makeBasket();
  private pond = makePond();
  private swing = makeSwing();
  private nightGlows: THREE.Sprite[] = [];
  private fireflies: THREE.Sprite[] = [];
  private butterflies: ReturnType<typeof makeButterfly>[] = [];
  private decorObjs: (THREE.Object3D | null)[] = Array(DECOR_SPOTS).fill(null);
  private decorIds: (DecorId | null)[] = Array(DECOR_SPOTS).fill(null);
  private markers: THREE.Group[] = [];
  private puffs = new Puffs(glowTex());
  private sparkles = new Puffs(glowTex());
  private hearts = new Puffs(heartTex());
  private zzz: { s: THREE.Sprite; life: number }[] = [];
  private smokeT = 0;

  // Companion
  private comp!: CompanionRig;
  private accessories: THREE.Object3D[] = [];
  private stage = 0;
  private c = {
    pos: new THREE.Vector3(),
    target: null as THREE.Vector3 | null,
    onArrive: null as (() => void) | null,
    yaw: 0,
    hop: 0,
    jump: 0,
    jumpH: 0.9,
    blink: 0,
    nextBlink: 2.5,
    munch: 0,
    yawn: 0,
    sleep: 0,
    sleeping: false,
    spin: 0,
    sink: 0,
    elev: 0,
    pop: 1,
    purr: 0,
    carry: null as THREE.Object3D | null,
    lookHold: 0,
    lookAt: new THREE.Vector3(),
  };
  private idleT = 6;
  private partyT = 0;

  // Camera
  private view = { center: new THREE.Vector3(0, 0.8, 0.6), radius: 9.5, pitch: 0.55 };
  private cur = { center: new THREE.Vector3(0, 0.8, 0.6), radius: 9.5, pitch: 0.55 };
  private orbit = 0;

  // Pointer
  private pointer = { world: new THREE.Vector3(), at: -10 };
  private down: { x: number; y: number; lx: number; ly: number; t: number; rub: boolean; drag: boolean } | null = null;

  // Modes
  private nightK = 0;
  private nightTarget = 0;
  private decorMode = false;

  // Challenge
  private ch: Challenge | null = null;
  private chObjs: THREE.Object3D[] = [];
  private tappables: THREE.Object3D[] = [];
  private flights: Flight[] = [];
  private busy = false;
  private mistakes = 0;
  private count = 0;
  private round = 0;
  private popped: string[] = [];
  private rubPx = 0;
  private hoops: THREE.Group[] = [];
  private ball: THREE.Mesh | null = null;
  private basketFruits: THREE.Object3D[] = [];
  private wobbles = new Map<THREE.Object3D, number>();
  private timers: number[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: NidOptions,
    private cb: NidCallbacks
  ) {
    this.renderer = createRenderer(canvas, { lowPower: this.lowPower });
    this.renderer.toneMappingExposure = 1.0;
    // Soft shadows are costly on weak devices: plain filtered ones look almost the same.
    if (this.lowPower) this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.stars = makeStars(this.lowPower ? 300 : 700);
    this.buildWorld();
    this.setCompanion(opts.companion, opts.color);
    this.setStage(opts.stage, false);
    this.setDecor(opts.decor, false);
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onCancel);
    canvas.addEventListener('pointerleave', this.onCancel);
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(canvas.parentElement ?? canvas);
    this.fit();
    this.overview();
    this.cur.center.copy(this.view.center);
    this.cur.radius = this.view.radius;
    this.loop();
  }

  /* ───────────────────────── World ───────────────────────── */

  private buildWorld() {
    const s = this.scene;
    s.fog = new THREE.Fog(DAY.fog.clone(), 38, 120);
    s.add(this.sky, this.stars, this.clouds);
    s.add(this.hemi);
    this.sun.position.set(9, 18, 10);
    this.sun.castShadow = true;
    const sm = this.lowPower ? 512 : 1024;
    this.sun.shadow.mapSize.set(sm, sm);
    Object.assign(this.sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 50 });
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    s.add(this.sun);

    const island = makeIsland();
    s.add(island.group);
    this.cottage.position.copy(SPOT.house);
    this.cottage.rotation.y = 0.5;
    s.add(this.cottage);
    this.porch.position.copy(this.cottage.localToWorld(new THREE.Vector3(0, 1.6, 2.2)));
    s.add(this.porch);
    this.nestLight.position.copy(SPOT.nest).add(new THREE.Vector3(0.8, 2.6, 1.6));
    s.add(this.nestLight);
    const nest = makeNest();
    nest.position.copy(SPOT.nest);
    s.add(nest);
    this.tree.group.position.copy(SPOT.tree);
    s.add(this.tree.group);
    this.basket.position.copy(SPOT.basket);
    s.add(this.basket);
    this.pond.position.copy(SPOT.pond);
    s.add(this.pond);
    this.swing.group.position.copy(SPOT.swing);
    this.swing.group.rotation.y = 1.1;
    s.add(this.swing.group);
    const fence = makeFence();
    const scatter = makeScatter(this.lowPower);
    s.add(fence, scatter);

    // Fruits that always hang in the tree (decoration; the challenge adds its own).
    this.tree.anchors.slice(0, 5).forEach((p, i) => {
      const f = makeFood('apple');
      f.position.copy(p).add(new THREE.Vector3(0, -0.1, 0));
      f.rotation.z = (i - 2) * 0.2;
      f.name = 'treeFruit';
      f.userData.noMerge = true;
      this.tree.group.add(f);
    });
    // Hundreds of little static pieces → a few draw calls.
    mergeStatic(island.group, true);
    for (const g of [this.cottage, nest, this.tree.group, this.basket, this.pond, this.swing.group, fence, scatter, this.clouds]) mergeStatic(g);

    // Butterflies by day, fireflies by night.
    if (!this.reduceMotion) {
      ['#ffd166', '#ff9ad5', '#9fd8ff'].forEach((col) => {
        const b = makeButterfly(col);
        this.butterflies.push(b);
        s.add(b);
      });
    }
    for (let i = 0; i < (this.lowPower ? 10 : 22); i++) {
      const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#fff59a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      f.scale.setScalar(0.35);
      f.userData.phase = i * 1.7;
      f.userData.base = new THREE.Vector3(Math.cos(i * 2.4) * (2 + (i % 5) * 1.5), 0.8 + (i % 3) * 0.6, Math.sin(i * 2.4) * (2 + (i % 5) * 1.5));
      this.fireflies.push(f);
      s.add(f);
    }
    s.add(this.puffs.group, this.sparkles.group, this.hearts.group);
    this.collectNightGlows();
  }

  private collectNightGlows() {
    this.nightGlows = [];
    this.scene.traverse((o) => {
      if ((o as THREE.Sprite).isSprite && o.userData.nightGlow) this.nightGlows.push(o as THREE.Sprite);
    });
  }

  private fit() {
    const el = this.canvas.parentElement ?? this.canvas;
    const w = el.clientWidth || 800;
    const h = el.clientHeight || 600;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 52 : 42;
    this.camera.updateProjectionMatrix();
  }

  private portrait() {
    return this.camera.aspect < 1;
  }

  private focus(center: THREE.Vector3, radius: number, pitch = 0.5) {
    this.view.center.copy(center);
    this.view.radius = radius;
    this.view.pitch = pitch;
  }

  private overview() {
    if (this.portrait()) this.focus(new THREE.Vector3(0.4, 0.7, 0.3), 5.0, 0.58);
    else this.focus(new THREE.Vector3(0, 0.4, 0.4), 8.0, 0.55);
  }

  /* ───────────────────────── Companion ───────────────────────── */

  private homePos(): THREE.Vector3 {
    return this.comp?.aquatic ? SPOT.pond.clone().add(new THREE.Vector3(-0.2, 0, 0.3)) : SPOT.home.clone();
  }

  setCompanion(id: CompanionId | 'ziggy', color: string) {
    const night = this.nightTarget > 0.5;
    if (this.comp) {
      this.scene.remove(this.comp.root);
      disposeTree(this.comp.root);
    }
    this.comp = id === 'ziggy' ? makeZiggyCompanion({ lowPower: this.lowPower, reduceMotion: this.reduceMotion }) : makeCompanion(id, color);
    this.comp.hitbox.userData.tap = { kind: 'companion' } satisfies TapInfo;
    this.accessories = [];
    this.scene.add(this.comp.root);
    this.c.pos.copy(night && !this.comp.aquatic ? SPOT.nest : this.homePos());
    this.c.target = null;
    this.c.onArrive = null;
    this.c.sleeping = night;
    this.c.sleep = night ? 1 : 0;
    this.c.pop = 0.2;
    this.c.jump = 1;
    this.applyAccessories();
    this.sparkles.emit(this.c.pos.clone().add(new THREE.Vector3(0, 1, 0)), { color: color, count: this.lowPower ? 10 : 22, spread: 2.5, up: 2, life: 1.1, size: 0.4, additive: true });
  }

  setStage(stage: number, celebrate = true) {
    const grew = stage > this.stage;
    this.stage = Math.max(0, Math.min(3, stage));
    this.applyAccessories();
    if (celebrate && grew) {
      this.c.pop = 0.5;
      this.c.jump = 1;
      this.audio.chime('star');
      this.sparkles.emit(this.c.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), { color: '#ffe066', count: 30, spread: 3, up: 2.4, life: 1.4, size: 0.45, additive: true });
    }
  }

  private applyAccessories() {
    if (!this.comp) return;
    for (const a of this.accessories) {
      a.parent?.remove(a);
      disposeTree(a);
    }
    this.accessories = [];
    if (this.comp.dress) {
      this.accessories = this.comp.dress(this.stage);
      return;
    }
    if (this.stage >= 1) {
      const scarf = makeScarf(this.comp.neck.userData.r ?? 0.4, this.stage >= 3 ? '#9b6be8' : '#ff6f91');
      this.comp.neck.add(scarf);
      this.accessories.push(scarf);
    }
    if (this.stage === 2) {
      const fc = makeFlowerCrown();
      this.comp.crown.add(fc);
      this.accessories.push(fc);
    }
    if (this.stage >= 3) {
      const cr = makeCrown();
      this.comp.crown.add(cr);
      this.accessories.push(cr);
    }
  }

  private walkTo(p: THREE.Vector3, then?: () => void) {
    if (this.comp.aquatic) {
      // The dolphin swims within the pond only.
      const d = p.clone().sub(SPOT.pond).setY(0);
      if (d.length() > SPOT.pondR - 0.6) d.setLength(SPOT.pondR - 0.6);
      p = SPOT.pond.clone().add(d);
    }
    this.c.target = p.clone().setY(0);
    this.c.onArrive = then ?? null;
  }

  /** Jump for joy with hearts. */
  joy(big = false) {
    if (this.c.sleeping) return;
    this.c.jump = 1;
    this.c.jumpH = (big ? 1.3 : 0.9) * (this.reduceMotion ? 0.5 : 1) * (this.comp.aquatic ? 1.6 : 1);
    if (big && !this.reduceMotion) this.c.spin = Math.PI * 2;
    this.comp.react?.(big ? 'bigJoy' : 'joy');
    this.audio.chime('pick');
    this.hearts.emit(this.mouthWorld().add(new THREE.Vector3(0, 0.6, 0)), { color: '#ffffff', count: big ? 8 : 4, spread: 1.6, up: 1.4, life: 1.4, size: 0.42 });
  }

  private mouthWorld(): THREE.Vector3 {
    const s = STAGE_SCALE[this.stage];
    const fwd = new THREE.Vector3(Math.sin(this.c.yaw), 0, Math.cos(this.c.yaw));
    return this.comp.root.position
      .clone()
      .add(new THREE.Vector3(0, this.comp.mouthY * s, 0))
      .addScaledVector(fwd, 0.45 * s);
  }

  /* ───────────────────────── Decorations ───────────────────────── */

  setDecor(decor: (DecorId | null)[], animate = true) {
    for (let i = 0; i < DECOR_SPOTS; i++) {
      const id = decor[i] ?? null;
      if (id === this.decorIds[i]) continue;
      const old = this.decorObjs[i];
      if (old) {
        this.scene.remove(old);
        disposeTree(old);
      }
      this.decorIds[i] = id;
      this.decorObjs[i] = null;
      if (!id) continue;
      const o = makeDecor(id);
      const p = SPOT.decor[i];
      o.position.copy(p);
      // Face the centre of the garden (and so the camera, mostly).
      o.lookAt(0, 0, 3);
      o.traverse((m) => ((m as THREE.Mesh).castShadow = true));
      if (animate) {
        o.scale.setScalar(0.01);
        o.userData.grow = 0;
        this.sparkles.emit(p.clone().add(new THREE.Vector3(0, 0.8, 0)), { color: '#ffe680', count: 14, spread: 1.6, up: 1.8, life: 0.9, size: 0.35, additive: true });
        this.audio.chime('pick');
      }
      this.decorObjs[i] = o;
      this.scene.add(o);
    }
    this.collectNightGlows();
  }

  setDecorMode(on: boolean) {
    this.decorMode = on;
    for (const m of this.markers) {
      this.scene.remove(m);
      disposeTree(m);
    }
    this.markers = [];
    if (on) {
      SPOT.decor.forEach((p, i) => {
        const m = makeSpotMarker();
        m.position.copy(p);
        m.userData.tap = { kind: 'spot', index: i } satisfies TapInfo;
        const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
        hit.position.y = 0.8;
        m.add(hit);
        this.markers.push(m);
        this.scene.add(m);
      });
      this.focus(new THREE.Vector3(0, 0, 0.6), this.portrait() ? 9.2 : 10.8, 0.75);
    } else this.overview();
    this.refreshTappables();
  }

  /* ───────────────────────── Night ───────────────────────── */

  setNight(on: boolean) {
    this.cancelChallenge();
    this.nightTarget = on ? 1 : 0;
    if (on) {
      const bed = this.comp.aquatic ? SPOT.pond.clone() : SPOT.nest.clone();
      this.focus(bed.clone().add(new THREE.Vector3(0.2, 0.9, 0.4)), this.portrait() ? 3.6 : 4.2, 0.45);
      this.walkTo(bed, () => {
        this.c.yawn = 1;
        this.later(1800, () => {
          if (this.nightTarget === 1) this.c.sleeping = true;
        });
      });
    } else {
      this.c.sleeping = false;
      this.c.yawn = 0;
      this.later(300, () => {
        this.joy();
        this.walkTo(this.homePos());
      });
      this.overview();
    }
  }

  /** The child's own "Fête du nid": confetti and a happy dance. */
  party() {
    this.partyT = 4;
    this.audio.chime('star');
    this.focus(this.homePos().add(new THREE.Vector3(0, 1, 0.5)), this.portrait() ? 4 : 5, 0.45);
    this.later(4200, () => this.overview());
  }

  /* ───────────────────────── Challenges ───────────────────────── */

  startChallenge(ch: Challenge) {
    this.cancelChallenge();
    this.ch = ch;
    this.mistakes = 0;
    this.count = 0;
    this.round = 0;
    this.popped = [];
    this.rubPx = 0;
    this.busy = false;
    const s = this.scene;
    const add = (o: THREE.Object3D) => {
      this.chObjs.push(o);
      s.add(o);
      return o;
    };
    switch (ch.kind) {
      case 'pick': {
        this.count = ch.start;
        this.tree.group.children.forEach((o) => {
          if (o.name === 'treeFruit') o.visible = false;
        });
        const spots = [...this.tree.anchors];
        const kinds: ('apple' | 'pear')[] = [...Array(ch.apples).fill('apple'), ...Array(ch.pears).fill('pear')];
        // Spread apples and pears among the anchors.
        kinds.sort((a, b) => (a === b ? 0 : a === 'apple' ? -1 : 1));
        const order = spots.map((_, i) => i).sort((a, b) => ((a * 7) % 11) - ((b * 7) % 11));
        kinds.forEach((k, i) => {
          const anchor = spots[order[i % order.length]];
          const f = makeFood(k === 'apple' ? 'apple' : 'pearTree');
          f.scale.setScalar(1.25);
          const world = this.tree.group.localToWorld(anchor.clone().add(new THREE.Vector3(0, -0.12, 0)));
          f.position.copy(world);
          f.userData.tap = { kind: 'fruit', fruit: k } satisfies TapInfo;
          f.userData.anchor = world.clone();
          f.add(this.hit(0.42));
          add(f);
        });
        for (let i = 0; i < ch.start; i++) {
          const a = makeFood('apple');
          a.position.copy(this.basketSlot(i));
          this.basketFruits.push(a);
          add(a);
        }
        this.walkTo(SPOT.basket.clone().add(new THREE.Vector3(-1.2, 0, 0.9)));
        this.focus(new THREE.Vector3(3.4, 2.0, -2.8), this.portrait() ? 3.6 : 4.4, 0.32);
        break;
      }
      case 'choose': {
        const blanket = makeBlanket();
        blanket.position.copy(SPOT.blanket);
        add(blanket);
        ch.choices.forEach((f, i) => {
          const o = makeFood(f);
          o.scale.setScalar(1.6);
          o.position.copy(SPOT.blanket).add(new THREE.Vector3((i - 1) * 1.15, 0.36, 0));
          o.userData.tap = { kind: 'food', food: f } satisfies TapInfo;
          o.userData.base = o.position.clone();
          o.add(this.hit(0.36));
          add(o);
        });
        this.walkTo(this.homePos());
        this.focus(this.comp.aquatic ? new THREE.Vector3(2.4, 0.8, 3.0) : new THREE.Vector3(0, 0.8, 2.6), this.portrait() ? 3.0 : 3.8, 0.42);
        break;
      }
      case 'throw': {
        const cols = ['#ff7a6b', '#ffd166', '#7fd0ff'];
        SPOT.hoops.forEach((p, i) => {
          const h = makeHoop(cols[i]);
          h.position.copy(p);
          h.lookAt(SPOT.throwFrom.x, 0, SPOT.throwFrom.z);
          h.userData.tap = { kind: 'hoop', index: i } satisfies TapInfo;
          const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.4, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
          hb.position.y = 1.1;
          h.add(hb);
          this.hoops.push(h);
          add(h);
        });
        this.labelHoops();
        this.ball = makeBall();
        this.ball.position.copy(SPOT.throwFrom);
        add(this.ball);
        this.walkTo(this.comp.aquatic ? this.homePos() : new THREE.Vector3(-1.2, 0, 2.6));
        this.focus(new THREE.Vector3(-1.0, 0.5, 5.2), this.portrait() ? 4.2 : 5.0, 0.5);
        break;
      }
      case 'rub': {
        this.walkTo(this.homePos());
        const p = this.homePos();
        const k = STAGE_SCALE[this.stage] / STAGE_SCALE[0];
        this.focus(p.add(new THREE.Vector3(0, (this.comp.aquatic ? 0.5 : 0.8) * k, 0)), (this.portrait() ? 1.9 : 2.5) * k, 0.3);
        break;
      }
      case 'bubbles': {
        const n = ch.labels.length;
        ch.labels.forEach((label, i) => {
          const b = makeBubble(label);
          const a = (i / n) * Math.PI * 2 + 0.4;
          const base = SPOT.pond.clone().add(new THREE.Vector3(Math.cos(a) * 1.75, 1.9 + (i % 2) * 0.7, Math.sin(a) * 1.25));
          b.position.copy(base);
          b.userData.base = base;
          b.userData.phase = i * 1.3;
          b.userData.tap = { kind: 'bubble', label } satisfies TapInfo;
          b.scale.setScalar(0.01);
          b.userData.grow = 0;
          add(b);
        });
        this.walkTo(SPOT.pond.clone().add(new THREE.Vector3(-0.3, 0, 0.2)));
        this.focus(SPOT.pond.clone().add(new THREE.Vector3(0, 1.3, 0)), this.portrait() ? 3.0 : 3.6, 0.38);
        break;
      }
    }
    this.refreshTappables();
    this.emitProgress();
  }

  cancelChallenge() {
    for (const o of this.chObjs) {
      this.scene.remove(o);
      disposeTree(o);
    }
    this.chObjs = [];
    this.hoops = [];
    this.ball = null;
    this.basketFruits = [];
    this.flights = [];
    this.wobbles.clear();
    this.c.carry = null;
    this.c.purr = 0;
    this.tree.group.children.forEach((o) => {
      if (o.name === 'treeFruit') o.visible = true;
    });
    const was = this.ch;
    this.ch = null;
    this.busy = false;
    this.refreshTappables();
    if (was) {
      this.walkTo(this.homePos());
      this.overview();
    }
  }

  private hit(r: number) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    return h;
  }

  private basketSlot(i: number) {
    const ring = i % 6;
    const layer = Math.floor(i / 6);
    const a = ring * 1.05 + layer * 0.5;
    const r = ring === 0 && layer > 0 ? 0 : 0.27;
    return SPOT.basket.clone().add(new THREE.Vector3(Math.cos(a) * r, 0.36 + layer * 0.2, Math.sin(a) * r));
  }

  private emitProgress() {
    const ch = this.ch;
    if (!ch) return;
    let count = 0;
    let target = stepsOf(ch);
    if (ch.kind === 'pick') {
      count = this.count;
      target = ch.target;
    } else if (ch.kind === 'throw') count = this.round;
    else if (ch.kind === 'rub') count = this.count;
    else if (ch.kind === 'bubbles') count = this.popped.length;
    this.cb.onProgress({ kind: ch.kind, count, target, round: this.round, popped: [...this.popped] });
  }

  private refreshTappables() {
    const list: THREE.Object3D[] = [this.comp.hitbox];
    for (const o of this.chObjs) if (o.userData.tap) list.push(o);
    if (this.decorMode) list.push(...this.markers);
    this.tappables = list;
  }

  private success() {
    const ch = this.ch;
    if (!ch) return;
    const total = stepsOf(ch);
    const stats = { correct: total, mistakes: this.mistakes, total };
    this.busy = true;
    this.later(500, () => {
      this.joy(true);
      // A cuddle ends in a hug back.
      if (ch.kind === 'rub') this.comp.react?.('love');
      this.audio.chime('star');
      this.sparkles.emit(this.c.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), { color: '#ffe066', count: this.lowPower ? 14 : 30, spread: 3, up: 2.4, life: 1.4, size: 0.42, additive: true });
      this.cb.onDone(stats);
    });
    this.later(2300, () => {
      if (this.ch === ch) this.cancelChallenge();
    });
  }

  private hint(reason: HintReason, ctx: { count?: number; popped?: string[]; round?: number } = {}, mistake = true) {
    if (mistake) this.mistakes++;
    this.audio.chime('oops');
    this.cb.onHint(reason, ctx);
  }

  private feed(obj: THREE.Object3D, then?: () => void) {
    obj.userData.tap = undefined;
    this.refreshTappables();
    this.fly(obj, obj.position.clone(), this.mouthWorld(), 0.65, 1.0, () => {
      this.scene.remove(obj);
      this.c.munch = 1.4;
      this.audio.chime('deliver');
      this.hearts.emit(this.mouthWorld().add(new THREE.Vector3(0, 0.5, 0)), { color: '#ffffff', count: 3, spread: 1, up: 1.2, life: 1.2, size: 0.35 });
      then?.();
    });
  }

  /** Called by the HUD's food cards (and by taps on the 3D foods). */
  chooseFood(food: FoodId) {
    const ch = this.ch;
    if (!ch || ch.kind !== 'choose' || this.busy) return;
    const obj = this.chObjs.find((o) => (o.userData.tap as TapInfo | undefined)?.kind === 'food' && (o.userData.tap as { food: FoodId }).food === food);
    if (!checkChoice(ch, food)) {
      if (obj) this.wobbles.set(obj, 1);
      this.hint('wrong');
      return;
    }
    this.busy = true;
    this.count = 1;
    this.emitProgress();
    if (obj) this.feed(obj, () => this.success());
    else this.success();
  }

  /** The "C'est prêt" button of the apple picking. */
  pickReady() {
    const ch = this.ch;
    if (!ch || ch.kind !== 'pick' || this.busy || this.flights.length) return;
    const v = checkPick(ch, this.count);
    if (v === 'more') return this.hint('more', { count: this.count });
    if (v === 'over') return this.hint('over', { count: this.count });
    this.busy = true;
    const top = this.basketFruits[this.basketFruits.length - 1];
    if (top) {
      this.basketFruits.pop();
      this.feed(top, () => this.success());
    } else this.success();
  }

  private tapFruit(o: THREE.Object3D, fruit: 'apple' | 'pear') {
    const ch = this.ch;
    if (!ch || ch.kind !== 'pick' || this.busy) return;
    if (fruit === 'pear') {
      this.wobbles.set(o, 1);
      this.hint('wrong');
      return;
    }
    if (ch.autoFinish && this.count >= ch.target) return;
    o.userData.tap = undefined;
    this.refreshTappables();
    this.count++;
    const n = this.count;
    this.cb.onStep(countWord(n, this.opts.locale));
    this.audio.chime('pick');
    const slot = this.basketSlot(n - 1);
    this.basketFruits.push(o);
    this.emitProgress();
    this.fly(o, o.position.clone(), slot, 0.55, 0.6, () => {
      o.scale.setScalar(1);
      this.sparkles.emit(slot.clone().add(new THREE.Vector3(0, 0.3, 0)), { color: '#ffe680', count: 6, spread: 0.6, up: 1, life: 0.6, size: 0.25, additive: true });
      const v = checkPick(ch, this.count);
      if (v === 'over') {
        // One too many: it hops back into the tree, no fuss.
        this.hint('over', { count: this.count });
        this.basketFruits.pop();
        this.count--;
        this.emitProgress();
        this.later(500, () => {
          this.fly(o, o.position.clone(), o.userData.anchor as THREE.Vector3, 0.6, 1.2, () => {
            o.scale.setScalar(1.25);
            o.userData.tap = { kind: 'fruit', fruit: 'apple' } satisfies TapInfo;
            this.refreshTappables();
          });
        });
      } else if (v === 'done' && ch.autoFinish && !this.busy) {
        this.busy = true;
        this.later(400, () => {
          const top = this.basketFruits.pop();
          if (top) this.feed(top, () => this.success());
          else this.success();
        });
      }
    });
  }

  private labelHoops() {
    const ch = this.ch;
    if (!ch || ch.kind !== 'throw') return;
    const rd = ch.rounds[this.round];
    this.hoops.forEach((h, i) => {
      const old = h.getObjectByName('label');
      if (old) {
        h.remove(old);
        disposeTree(old);
      }
      if (ch.mode === 'count' || !rd) return;
      const l = labelSprite(String(rd.targets[i]), { size: 0.85, bg: '#fffaf0', fg: '#1d2a6b' });
      l.position.y = 2.25;
      l.name = 'label';
      h.add(l);
    });
  }

  private throwAt(i: number) {
    const ch = this.ch;
    const ball = this.ball;
    if (!ch || ch.kind !== 'throw' || this.busy || !ball) return;
    const rd = ch.rounds[this.round];
    if (!rd) return;
    this.busy = true;
    const hoop = this.hoops[i];
    const center = hoop.position.clone().add(new THREE.Vector3(0, 1.25, 0));
    this.audio.chime('pick');
    this.fly(ball, ball.position.clone(), center, 0.55, 1.4, () => {
      if (!checkThrow(ch, this.round, rd.targets[i])) {
        this.wobbles.set(hoop, 1);
        this.hint('wrong', { round: this.round });
        this.fly(ball, center, SPOT.throwFrom.clone(), 0.65, 0.9, () => (this.busy = false));
        return;
      }
      this.sparkles.emit(center, { color: '#ffe680', count: 16, spread: 1.4, up: 1.4, life: 0.8, size: 0.35, additive: true });
      this.audio.chime('deliver');
      if (ch.mode === 'count') this.cb.onStep(countWord(this.round + 1, this.opts.locale));
      const away = center.clone().sub(SPOT.throwFrom).setY(0).normalize();
      const land = hoop.position.clone().addScaledVector(away, 1.3).setY(0.28);
      this.fly(ball, center, land, 0.4, 0.4, () => {
        if (this.comp.aquatic) {
          this.joy(true);
          this.later(900, () => this.fly(ball, land, SPOT.throwFrom.clone(), 0.8, 2.0, () => this.nextRound()));
          return;
        }
        const stand = land.clone().addScaledVector(away, 0.6).setY(0);
        this.walkTo(stand, () => {
          this.c.carry = ball;
          this.audio.chime('pick');
          this.walkTo(new THREE.Vector3(-1.2, 0, 2.6), () => {
            this.c.carry = null;
            this.joy();
            this.fly(ball, ball.position.clone(), SPOT.throwFrom.clone(), 0.7, 1.4, () => this.nextRound());
          });
        });
      });
    });
  }

  private nextRound() {
    const ch = this.ch;
    if (!ch || ch.kind !== 'throw') return;
    this.round++;
    this.emitProgress();
    if (this.round >= ch.rounds.length) return this.success();
    this.labelHoops();
    this.busy = false;
  }

  private popBubble(o: THREE.Object3D, label: string) {
    const ch = this.ch;
    if (!ch || ch.kind !== 'bubbles' || this.busy) return;
    if (!checkBubble(ch, this.popped, label)) {
      this.wobbles.set(o, 1);
      this.hint('wrong', { popped: [...this.popped] });
      return;
    }
    this.popped.push(label);
    this.chObjs = this.chObjs.filter((x) => x !== o);
    this.scene.remove(o);
    disposeTree(o);
    this.refreshTappables();
    this.audio.chime('pick');
    this.sparkles.emit(o.position.clone(), { color: '#bfe9ff', count: this.lowPower ? 8 : 16, spread: 1.4, up: 0.8, life: 0.7, size: 0.32, additive: true });
    this.cb.onStep(ch.mode === 'any' ? countWord(this.popped.length, this.opts.locale) : ch.mode === 'word' && bubblesDone(ch, this.popped) ? `${label}… ${ch.order.join('')} !` : label);
    this.emitProgress();
    if (bubblesDone(ch, this.popped)) this.success();
  }

  private rubAt(dx: number, dy: number, hitPoint: THREE.Vector3) {
    const ch = this.ch;
    if (!ch || ch.kind !== 'rub' || this.busy) return;
    this.rubPx += Math.hypot(dx, dy);
    this.c.purr = 0.6;
    const h = heartsFromRub(ch, this.rubPx);
    if (h > this.count) {
      this.count = h;
      this.hearts.emit(hitPoint.clone().add(new THREE.Vector3(0, 0.3, 0)), { color: '#ffffff', count: 1, spread: 0.3, up: 1.4, life: 1.6, size: 0.6 });
      this.audio.chime('pick');
      this.cb.onStep(countWord(h, this.opts.locale));
      this.emitProgress();
      if (h >= ch.hearts) this.success();
    }
  }

  /* ───────────────────────── Pointer ───────────────────────── */

  private setNdc(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
  }

  private pickTap(): { info: TapInfo; obj: THREE.Object3D; point: THREE.Vector3 } | null {
    const hits = this.ray.intersectObjects(this.tappables, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.tap) o = o.parent;
      if (o) return { info: o.userData.tap as TapInfo, obj: o, point: h.point };
    }
    return null;
  }

  private onDown = (e: PointerEvent) => {
    this.setNdc(e);
    this.updatePointerWorld();
    const hit = this.pickTap();
    const rub = hit?.info.kind === 'companion' && this.ch?.kind === 'rub';
    this.down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), rub, drag: !hit };
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* not supported */
    }
  };

  private onMove = (e: PointerEvent) => {
    this.setNdc(e);
    this.updatePointerWorld();
    const d = this.down;
    if (!d) return;
    const dx = e.clientX - d.lx;
    const dy = e.clientY - d.ly;
    d.lx = e.clientX;
    d.ly = e.clientY;
    if (this.ch?.kind === 'rub') {
      const hit = this.ray.intersectObject(this.comp.hitbox, false)[0];
      if (hit) this.rubAt(dx, dy, hit.point);
    } else if (d.drag && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) {
      this.orbit = Math.max(-0.9, Math.min(0.9, this.orbit - dx * 0.006));
    }
  };

  private onUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (moved > 14 || performance.now() - d.t > 900) return;
    this.setNdc(e);
    const hit = this.pickTap();
    if (!hit) return;
    this.tap(hit.info, hit.obj);
  };

  private onCancel = () => {
    this.down = null;
  };

  private updatePointerWorld() {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1);
    const p = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(plane, p)) {
      this.pointer.world.copy(p);
      this.pointer.at = this.clock.elapsedTime;
    }
  }

  private tap(info: TapInfo, obj: THREE.Object3D) {
    switch (info.kind) {
      case 'companion':
        if (this.ch?.kind === 'rub') {
          this.hint('tooFast', {}, false);
          return;
        }
        if (this.c.sleeping) {
          // A sleepy little smile, and back to sleep.
          this.hearts.emit(this.mouthWorld().add(new THREE.Vector3(0, 0.5, 0)), { color: '#ffffff', count: 1, spread: 0.3, up: 0.8, life: 1.4, size: 0.35 });
          return;
        }
        this.joy();
        this.cb.onCompanionTap();
        return;
      case 'fruit':
        return this.tapFruit(obj, info.fruit);
      case 'food':
        return this.chooseFood(info.food);
      case 'hoop':
        return this.throwAt(info.index);
      case 'bubble':
        return this.popBubble(obj, info.label);
      case 'spot':
        this.audio.chime('pick');
        return this.cb.onSpot(info.index);
    }
  }

  /* ───────────────────────── Loop ───────────────────────── */

  private fly(obj: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, dur: number, arc: number, done?: () => void) {
    this.flights = this.flights.filter((f) => f.obj !== obj);
    this.flights.push({ obj, from, to, t: 0, dur, arc, done });
  }

  private later(ms: number, fn: () => void) {
    const id = window.setTimeout(() => {
      this.timers = this.timers.filter((t) => t !== id);
      fn();
    }, ms);
    this.timers.push(id);
  }

  private perf = { frames: 0, time: 0, ratio: 0 };

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const raw = this.clock.getDelta();
    const dt = Math.min(0.1, raw);
    const t = this.clock.elapsedTime;
    this.step(dt, t);
    this.renderer.render(this.scene, this.camera);
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

  private step(dt: number, t: number) {
    const motion = this.reduceMotion ? 0.4 : 1;
    // Night fade.
    this.nightK += (this.nightTarget - this.nightK) * Math.min(1, dt * 1.2);
    this.applyNight(this.nightK, t);

    this.stepCompanion(dt, t, motion);

    // Flights (fruits to the basket, balls, food to the mouth).
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      f.t = Math.min(1, f.t + dt / f.dur);
      const e = f.t < 0.5 ? 2 * f.t * f.t : 1 - (-2 * f.t + 2) ** 2 / 2;
      f.obj.position.lerpVectors(f.from, f.to, e);
      f.obj.position.y += Math.sin(f.t * Math.PI) * f.arc;
      f.obj.rotation.y += dt * 6;
      if (f.t >= 1) {
        this.flights.splice(i, 1);
        f.done?.();
      }
    }
    // A carried ball follows the companion's mouth (Ziggy's hands).
    if (this.c.carry) {
      if (this.comp.carryAt) this.comp.carryAt.getWorldPosition(this.c.carry.position);
      else this.c.carry.position.copy(this.mouthWorld().add(new THREE.Vector3(0, 0.05, 0.05)));
    }
    // Wobbles (gentle "not this one" shake).
    for (const [o, w] of this.wobbles) {
      const nw = Math.max(0, w - dt * 1.8);
      o.rotation.z = Math.sin(nw * 22) * 0.25 * nw;
      if (nw <= 0) this.wobbles.delete(o);
      else this.wobbles.set(o, nw);
    }
    // Challenge props idle animation.
    for (const o of this.chObjs) {
      const u = o.userData;
      if (u.grow !== undefined && u.grow < 1) {
        u.grow = Math.min(1, u.grow + dt * 2.5);
        o.scale.setScalar(Math.max(0.01, 1 - (1 - u.grow) ** 3));
      }
      if (u.tap?.kind === 'bubble' && u.base) {
        o.position.set(u.base.x + Math.sin(t * 0.8 + u.phase) * 0.12 * motion, u.base.y + Math.sin(t * 1.6 + u.phase) * 0.15 * motion, u.base.z);
        o.rotation.y = Math.sin(t + u.phase) * 0.3;
      }
      if (u.tap?.kind === 'food' && u.base && !this.flights.some((f) => f.obj === o)) {
        o.position.y = u.base.y + Math.abs(Math.sin(t * 2 + u.base.x)) * 0.12 * motion;
        o.rotation.y += dt * 0.6;
      }
      if (u.tap?.kind === 'fruit' && u.anchor && !this.flights.some((f) => f.obj === o)) {
        o.position.y = u.anchor.y + Math.sin(t * 2.2 + u.anchor.x * 3) * 0.04 * motion;
      }
    }
    if (this.ball && !this.busy) this.ball.position.y = SPOT.throwFrom.y + Math.abs(Math.sin(t * 3)) * 0.25 * motion;
    for (const h of this.hoops) {
      const l = h.getObjectByName('label');
      if (l) l.position.y = 2.25 + Math.sin(t * 2 + h.position.x) * 0.06;
    }
    // Decor: grow in, star lamp spin, markers pulse.
    for (const o of this.decorObjs) {
      if (!o) continue;
      if (o.userData.grow !== undefined && o.userData.grow < 1) {
        o.userData.grow = Math.min(1, o.userData.grow + dt * 2.2);
        const g = o.userData.grow;
        o.scale.setScalar(Math.max(0.01, 1 + Math.sin(g * Math.PI) * 0.25 - (1 - g) * 0.9));
      }
      const sp = o.getObjectByName('spin');
      if (sp) sp.rotation.y += dt * 1.2;
    }
    this.markers.forEach((m, i) => {
      m.scale.setScalar(1 + Math.sin(t * 3 + i) * 0.08 * motion);
      m.children[2].position.y = 0.9 + Math.sin(t * 2.5 + i) * 0.12 * motion;
    });

    // Garden life.
    this.swing.seat.rotation.x = Math.sin(t * 1.3) * 0.22 * motion;
    this.clouds.rotation.y += dt * 0.006;
    (this.pond.userData.water.material as THREE.MeshPhongMaterial).emissiveIntensity = 0.22 + Math.sin(t * 1.5) * 0.05;
    this.butterflies.forEach((b, i) => {
      const k = t * (0.35 + i * 0.07) + i * 2;
      b.position.set(Math.sin(k) * (4 + i) + (i - 1) * 1.5, 1.2 + Math.sin(k * 2.3) * 0.5 + i * 0.3, Math.cos(k * 0.8) * (3 + i) + 1);
      b.rotation.y = Math.atan2(Math.cos(k), -Math.sin(k * 0.8));
      const flap = Math.sin(t * 18 + i) * 0.9;
      b.userData.wings[0].rotation.z = flap;
      b.userData.wings[1].rotation.z = -flap;
      b.visible = this.nightK < 0.6;
    });
    this.fireflies.forEach((f) => {
      const ph = f.userData.phase as number;
      const base = f.userData.base as THREE.Vector3;
      f.position.set(base.x + Math.sin(t * 0.5 + ph) * 0.8, base.y + Math.sin(t * 0.9 + ph) * 0.3, base.z + Math.cos(t * 0.4 + ph) * 0.8);
      (f.material as THREE.SpriteMaterial).opacity = this.nightK * (0.5 + Math.sin(t * 3 + ph) * 0.4);
    });
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 1.6;
      this.puffs.emit(this.cottage.localToWorld(this.cottage.userData.chimney.clone()), { color: this.nightK > 0.5 ? '#9aa3c8' : '#ffffff', count: 1, up: 0.9, life: 3, size: 0.7, spread: 0.3 });
    }
    // Party confetti.
    if (this.partyT > 0) {
      const before = this.partyT;
      this.partyT -= dt;
      if (Math.floor(before * 3) !== Math.floor(this.partyT * 3)) {
        const cols = ['#ff7ab8', '#ffd166', '#7fd0ff', '#9bf07f', '#c99bff'];
        const at = this.c.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 2.2, (Math.random() - 0.5) * 2));
        this.sparkles.emit(at, { color: cols[Math.floor(Math.random() * cols.length)], count: this.lowPower ? 10 : 22, spread: 3.5, up: 2.4, life: 1.3, size: 0.4, additive: true });
        if (this.c.jump <= 0) this.joy(Math.random() > 0.5);
      }
    }
    // Zzz.
    if (this.c.sleeping && this.c.sleep > 0.8 && Math.random() < dt * 0.7) {
      const z = textSprite('Z', { size: 0.45, fg: '#e8ecff', stroke: '#5a64b8' });
      z.position.copy(this.mouthWorld().add(new THREE.Vector3(0.3, 0.6, 0)));
      this.scene.add(z);
      this.zzz.push({ s: z, life: 2.6 });
    }
    for (let i = this.zzz.length - 1; i >= 0; i--) {
      const z = this.zzz[i];
      z.life -= dt;
      z.s.position.y += dt * 0.35;
      z.s.position.x += Math.sin(z.life * 3) * dt * 0.2;
      (z.s.material as THREE.SpriteMaterial).opacity = Math.min(1, z.life / 1.2);
      z.s.scale.setScalar(0.45 + (2.6 - z.life) * 0.12);
      if (z.life <= 0) {
        this.scene.remove(z.s);
        disposeTree(z.s);
        this.zzz.splice(i, 1);
      }
    }
    this.puffs.update(dt);
    this.sparkles.update(dt);
    this.hearts.update(dt);

    // Camera.
    const v = this.view;
    const k = 1 - Math.exp(-dt * 2.2);
    this.cur.center.lerp(v.center, k);
    this.cur.radius += (v.radius - this.cur.radius) * k;
    this.cur.pitch += (v.pitch - this.cur.pitch) * k;
    const vf = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const hf = Math.atan(Math.tan(vf) * this.camera.aspect);
    const dist = this.cur.radius / Math.tan(Math.min(vf, hf)) + 1;
    if (!this.down) this.orbit *= 1 - Math.min(1, dt * 0.25);
    const yaw = this.orbit + (this.reduceMotion ? 0 : Math.sin(t * 0.12) * 0.05);
    const p = this.cur.pitch;
    this.camera.position.set(this.cur.center.x + Math.sin(yaw) * Math.cos(p) * dist, this.cur.center.y + Math.sin(p) * dist, this.cur.center.z + Math.cos(yaw) * Math.cos(p) * dist);
    this.camera.lookAt(this.cur.center);
  }

  private stepCompanion(dt: number, t: number, motion: number) {
    const c = this.c;
    const rig = this.comp;
    const s = STAGE_SCALE[this.stage];
    // Walking (little hops).
    let walking = false;
    let yawWant = c.yaw;
    if (c.target) {
      const d = c.target.clone().sub(c.pos).setY(0);
      const dist = d.length();
      if (dist < 0.06) {
        c.pos.copy(c.target);
        c.target = null;
        const then = c.onArrive;
        c.onArrive = null;
        then?.();
      } else {
        walking = true;
        c.pos.addScaledVector(d.normalize(), Math.min(dist, (rig.aquatic ? 2.2 : 3.4) * dt));
        yawWant = Math.atan2(d.x, d.z);
      }
    }
    if (!walking) {
      const cam = this.camera.position;
      yawWant = Math.atan2(cam.x - c.pos.x, cam.z - c.pos.z) + (rig.idleYaw ?? 0);
    }
    c.yaw = lerpAngle(c.yaw, yawWant, Math.min(1, dt * 7));
    if (walking) c.hop += dt * 10;
    else c.hop = 0;

    // Idle life: a hop, a little stroll, a dance.
    if (!this.ch && !c.sleeping && this.nightTarget === 0 && !this.decorMode && !this.reduceMotion && this.partyT <= 0) {
      this.idleT -= dt;
      if (this.idleT <= 0) {
        this.idleT = 6 + Math.random() * 6;
        const r = Math.random();
        if (r < 0.35) this.joy();
        else if (r < 0.7 && !c.target) {
          const home = this.homePos();
          const a = Math.random() * Math.PI * 2;
          this.walkTo(home.clone().add(new THREE.Vector3(Math.cos(a) * 1.6, 0, Math.sin(a) * 1.2)), () =>
            this.later(1500, () => {
              if (!this.ch && !c.sleeping && !c.target) this.walkTo(this.homePos());
            })
          );
        } else {
          c.lookHold = 2;
          c.lookAt.set(c.pos.x + (Math.random() - 0.5) * 8, 1.5, c.pos.z + 2);
        }
      }
    }

    // Water and nest height.
    const inPond = c.pos.distanceTo(SPOT.pond) < SPOT.pondR - 0.15;
    const sinkWant = rig.aquatic ? -0.22 + Math.sin(t * 1.8) * 0.05 : inPond ? -0.42 * s : 0;
    c.sink += (sinkWant - c.sink) * Math.min(1, dt * 4);
    const atNest = !rig.aquatic && c.pos.distanceTo(SPOT.nest) < 0.4;
    c.elev += ((atNest ? 0.3 : 0) - c.elev) * Math.min(1, dt * 5);

    let y = c.sink + c.elev + (walking ? Math.abs(Math.sin(c.hop)) * 0.22 * s * motion : 0);
    let squash = 0;
    if (c.jump > 0) {
      c.jump = Math.max(0, c.jump - dt / 0.7);
      const ph = 1 - c.jump;
      y += Math.sin(ph * Math.PI) * c.jumpH * s;
      squash = ph < 0.15 ? (0.15 - ph) * 1.2 : ph > 0.85 ? (ph - 0.85) * 1.2 : -0.06;
    }
    if (c.spin > 0) {
      const ds = Math.min(c.spin, dt * 9);
      c.spin -= ds;
    }
    c.pop += (1 - c.pop) * Math.min(1, dt * 6);
    rig.root.scale.setScalar(s * c.pop);
    rig.root.position.set(c.pos.x, y, c.pos.z);
    rig.root.rotation.y = c.yaw + (c.spin > 0 ? Math.PI * 2 - c.spin : 0);
    if (this.partyT > 0) rig.root.rotation.y += Math.sin(t * 6) * 0.3;

    // Sleep / yawn.
    c.sleep += ((c.sleeping ? 1 : 0) - c.sleep) * Math.min(1, dt * 1.5);
    if (c.yawn > 0) c.yawn = Math.max(0, c.yawn - dt / 1.8);
    const yawnK = c.yawn > 0 ? Math.sin((1 - c.yawn) * Math.PI) : 0;

    // Breathing and squash.
    const breath = Math.sin(t * (c.sleeping ? 1.3 : 2.4)) * (c.sleeping ? 0.04 : 0.025);
    const purr = c.purr > 0 ? Math.sin(t * 30) * 0.015 : 0;
    c.purr = Math.max(0, c.purr - dt);
    rig.body.scale.set(1 - breath * 0.5 + squash * 0.6 + purr, 1 + breath - squash - c.sleep * 0.08 + yawnK * 0.06, 1 - breath * 0.5 + squash * 0.6);
    rig.body.rotation.z = c.purr > 0 ? Math.sin(t * 5) * 0.08 : 0;

    // Blink.
    c.nextBlink -= dt;
    if (c.nextBlink <= 0) {
      c.blink = 1;
      c.nextBlink = 2 + Math.random() * 3;
    }
    c.blink = Math.max(0, c.blink - dt / 0.16);
    const blinkK = Math.sin(c.blink * Math.PI);
    const happyClose = c.purr > 0 || c.munch > 0 ? 0.55 : 0;
    const eyeY = Math.max(0.1, Math.min(1 - blinkK * 0.9, 1 - happyClose, 1 - c.sleep * 0.9, 1 - yawnK * 0.6));
    for (const e of rig.eyes) e.scale.y = eyeY;

    // Wiggles (tail, wings, ears): livelier during the party and when walking.
    const excite = this.partyT > 0 || c.jump > 0 ? 2 : walking ? 1.5 : 1;
    for (const w of rig.wiggles) w.obj.rotation[w.axis] = w.base + Math.sin(t * w.speed * excite + w.phase) * w.amp * motion * (1 - c.sleep * 0.7);

    // Mouth.
    if (c.munch > 0) {
      c.munch = Math.max(0, c.munch - dt);
      rig.setMouth(Math.abs(Math.sin(c.munch * 10)) * 0.7);
    } else rig.setMouth(Math.max(yawnK, c.jump > 0.2 ? 0.35 : 0));

    // Head: looks at the pointer (or at the child), or nods off.
    const head = rig.head;
    let tyaw = 0;
    let tpitch = 0;
    if (c.sleep < 0.5 && head.parent) {
      c.lookHold = Math.max(0, c.lookHold - dt);
      const look = c.lookHold > 0 ? c.lookAt : this.clock.elapsedTime - this.pointer.at < 4 ? this.pointer.world : this.camera.position;
      const local = head.parent.worldToLocal(look.clone()).sub(head.position);
      tyaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), rig.aquatic ? -0.4 : -0.75, rig.aquatic ? 0.4 : 0.75);
      tpitch = THREE.MathUtils.clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)), -0.35, 0.3);
    }
    tpitch += c.sleep * 0.25 - yawnK * 0.35 + (c.munch > 0 ? Math.sin(c.munch * 10) * 0.08 : 0);
    head.rotation.y += (tyaw - head.rotation.y) * Math.min(1, dt * 6);
    head.rotation.x += (tpitch - head.rotation.x) * Math.min(1, dt * 6);
    head.rotation.z += (c.sleep * 0.3 - head.rotation.z) * Math.min(1, dt * 3);

    rig.tick?.(dt, { walking, sleeping: c.sleep > 0.5, party: this.partyT > 0, carrying: Boolean(c.carry) });
  }

  private applyNight(k: number, t: number) {
    const u = this.sky.material.uniforms;
    (u.top.value as THREE.Color).copy(DAY.top).lerp(NIGHT.top, k);
    (u.bottom.value as THREE.Color).copy(DAY.bottom).lerp(NIGHT.bottom, k);
    (u.below.value as THREE.Color).copy(DAY.below).lerp(NIGHT.below, k);
    (this.scene.fog as THREE.Fog).color.copy(DAY.fog).lerp(NIGHT.fog, k);
    this.hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, k);
    this.hemi.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, k);
    this.hemi.intensity = 1.35 - k * 0.85;
    this.sun.color.copy(DAY.sun).lerp(NIGHT.sun, k);
    this.sun.intensity = 2.3 - k * 1.85;
    this.porch.intensity = k * 14;
    this.nestLight.intensity = k * 9;
    this.nestLight.position.copy(this.comp.aquatic ? SPOT.pond : SPOT.nest).add(new THREE.Vector3(0.8, 2.6, 1.6));
    this.stars.material.opacity = k * (0.85 + Math.sin(t * 2) * 0.1);
    for (const w of this.cottage.userData.windows) (w.material as THREE.MeshBasicMaterial).color.copy(WINDOW_DAY).lerp(WINDOW_NIGHT, k);
    for (const g of this.nightGlows) {
      const n = g.userData.nightGlow as { day: number; night: number };
      (g.material as THREE.SpriteMaterial).opacity = n.day + (n.night - n.day) * k;
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    for (const id of this.timers) window.clearTimeout(id);
    this.resize.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onCancel);
    this.canvas.removeEventListener('pointerleave', this.onCancel);
    this.audio.dispose();
    disposeTree(this.scene);
    this.renderer.dispose();
  }
}
