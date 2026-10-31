import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createRenderer, glow, glowTex, prefersLowPower } from '../kit/look';
import { makeZiggy, type ZiggyActor } from '../kit/models';
import { Puffs } from '../kit/world';
import { heartTex } from '../nid/garden';
import { DinoAudio } from './audio';
import { buildDino, type DinoModel, type PieceModel } from './dinos';
import { Parts, col, disposeDeep, ell, v, type V3 } from './geo';
import {
  DINOS,
  awakeText,
  boneChoices,
  buildText,
  checkAnswer,
  checkPiece,
  choiceLabel,
  countWord,
  digDoneText,
  digText,
  dinoLabel,
  funText,
  hideFoundText,
  hideWrongText,
  museumText,
  pieceHint,
  praiseFor,
  roundDoneText,
  roundTotal,
  skeletonDoneText,
  turnHint,
  turnText,
  type DinoId,
  type DinoSkill,
  type GamePlan,
  type PieceId,
  type Question,
  type RoundPlan,
} from './logic';
import { SITE, buildWorld, type World } from './scenery';
import { Grains, SandBox } from './sand';

export type Phase = 'dig' | 'gather' | 'digQuestion' | 'build' | 'turn' | 'awake' | 'fun' | 'hide' | 'quiz' | 'roundDone' | 'museum';

export interface DinoState {
  phase: Phase;
  round: number;
  rounds: number;
  dino: DinoId;
  found: number;
  buried: number;
  step: number;
  steps: number;
  /** Bones offered for the current spot (build). */
  choices: PieceId[];
  question: Question | null;
  /** Hide-and-seek: how many palms. */
  palms: number;
  /** A cinematic is playing: the HUD shows "continue". */
  canSkip: boolean;
  /** An animation is running: inputs are ignored meanwhile. */
  busy: boolean;
  /** Dinosaurs rebuilt so far. */
  done: DinoId[];
  /** Increments for the museum photo flash. */
  flash: number;
}

export type SayKind = 'instruction' | 'question' | 'hint' | 'praise' | 'count' | 'fact';

export interface DinoCallbacks {
  onState: (s: DinoState) => void;
  /** Something Ziggy says (shown and read aloud). `extra`: lines read after it (answers for pre-readers). */
  onSay: (text: string, kind: SayKind, extra?: string[]) => void;
  /** A dinosaur is rebuilt and its question answered: one round for the learning engine. */
  onRoundDone: (r: { skill: DinoSkill; correct: number; mistakes: number; total: number; durationMs: number; dino: DinoId }) => void;
  onFinish: () => void;
}

interface Pose {
  p: V3;
  q: THREE.Quaternion;
  s: V3;
}

interface Flight {
  from: Pose;
  to: Pose;
  t: number;
  dur: number;
  arc: number;
  done?: () => void;
}

interface Bone {
  id: PieceId;
  model: PieceModel;
  mesh: THREE.Mesh;
  mat: THREE.MeshLambertMaterial;
  found: boolean;
  placed: boolean;
  box: Pose;
  tarp: Pose;
  /** Points on the bone's top surface, in world space while it lies in the sand. */
  samples: V3[];
  flight: Flight | null;
  wiggle: number;
  glowT: number;
}

interface Task {
  at: number;
  fn: () => void;
  tag: string;
}

const Z_AXIS = v(0, 0, 1);
/** Once alive, dinosaurs stand three-quarters towards the child. */
const LIVE_YAW = -0.42;
const qTurn = (quarters: number) => new THREE.Quaternion().setFromAxisAngle(Z_AXIS, (quarters * Math.PI) / 2);
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const elastic = (t: number) => (t >= 1 ? 1 : 1 - Math.cos(t * Math.PI * 3.2) * Math.exp(-t * 5.5));

export class DinoGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  private probe = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  private clock = new THREE.Clock();
  private raf = 0;
  private time = 0;
  private resize: ResizeObserver;
  private lowPower = prefersLowPower();
  private reduceMotion = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  private audio = new DinoAudio();
  private envTex: THREE.Texture | null = null;
  private pmrem: THREE.PMREMGenerator | null = null;
  private world: World;
  private sand: SandBox;
  private grains: Grains;
  private puffs = new Puffs(glowTex());
  private sparkles = new Puffs(glowTex());
  private hearts = new Puffs(heartTex());
  private ziggy: ZiggyActor;
  private brush: THREE.Group;
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private insets = { top: 80, bottom: 200 };
  private hidden = false;
  private perf = { frames: 0, time: 0, ratio: 0 };

  // Plan and state
  private round = -1;
  private phase: Phase = 'dig';
  private dinos = new Map<DinoId, DinoModel>();
  private dino!: DinoModel;
  private bones: Bone[] = [];
  private presetMeshes: THREE.Mesh[] = [];
  private ghosts = new Map<PieceId, THREE.Mesh>();
  private found = 0;
  private step = 0;
  private choices: PieceId[] = [];
  private turnOff = 0;
  private turnTries = 0;
  private holding: Bone | null = null;
  private question: Question | null = null;
  private stats = { correct: 0, mistakes: 0 };
  private roundStart = 0;
  private busyUntil = 0;
  private tasks: Task[] = [];
  private done: DinoId[] = [];
  private flash = 0;
  private canSkip = false;
  private palmsShown = 0;
  private hideSpot = -1;
  private boxScale = 1;

  // Pointer (rubbing the sand, tapping)
  private pointer: { id: number; x: number; y: number; t: number; last: V3 | null; moved: number } | null = null;
  private rubbing = 0;
  private autoBrush: { bone: Bone; t: number; dur: number; path: V3[]; done: number } | null = null;
  private brushQueue = 0;
  private idleDig = 0;

  // Camera
  private camPos = v(0, 9, 14);
  private camTarget = v(0, 0, 0);
  private goal = { pos: v(0, 9, 14), target: v(0, 0, 0) };
  private viewName: string = 'dig';
  private viewFn: () => { box: THREE.Box3; pitch: number; yaw: number } = () => this.digView();

  // Props
  private arrow: THREE.Group;
  private cookie: THREE.Group;
  private butterfly: THREE.Group;
  private ziggyMove: { to: V3; face: number | null; speed: number; then?: () => void } | null = null;
  private ziggyFly: { t: number; from: V3; to: V3; dur: number } | null = null;
  private dinoWalk: { d: DinoModel; from: V3; to: V3; t: number; dur: number; faceFrom: number; faceTo: number; then?: () => void } | null = null;
  private flesh: { d: DinoModel; t: number } | null = null;
  private dinoTurn: { d: DinoModel; from: number; to: number; t: number; dur: number } | null = null;
  private plateShow: { i: number; t: number } | null = null;
  private roarT = -1;
  private sniffT = -1;
  private reachT = -1;

  constructor(
    private canvas: HTMLCanvasElement,
    private plan: GamePlan,
    private seed: number,
    private locale: string,
    private cb: DinoCallbacks
  ) {
    this.renderer = createRenderer(canvas, { lowPower: this.lowPower });
    this.renderer.toneMappingExposure = 1.0;
    if (this.lowPower) this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.world = buildWorld(this.scene, { lowPower: this.lowPower, locale });
    this.sand = new SandBox(SITE.boxW, SITE.boxD, SITE.boxTop, this.lowPower);
    this.sand.mesh.position.set(SITE.box.x, 0, SITE.box.z);
    this.scene.add(this.sand.mesh);
    this.grains = new Grains(this.lowPower ? 260 : 520);
    this.scene.add(this.grains.points, this.puffs.group, this.sparkles.group, this.hearts.group);

    // Ziggy, the palaeontologist: an explorer's hat and a brush.
    this.ziggy = makeZiggy({ lowPower: this.lowPower });
    this.ziggy.userData.rig.energy = this.reduceMotion ? 0.4 : 1;
    this.ziggy.userData.model.hatAnchor.add(this.makeHat());
    this.brush = this.makeBrush();
    this.ziggy.userData.model.arms[1].wrist.add(this.brush);
    this.scene.add(this.ziggy);
    // Only Ziggy's big pieces cast shadows (dozens of little felt parts would double the draw calls).
    const parts: THREE.Mesh[] = [];
    this.ziggy.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.castShadow) parts.push(m);
    });
    const tris = (m: THREE.Mesh) => (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count);
    parts.sort((a, b) => tris(b) - tris(a)).slice(8).forEach((m) => (m.castShadow = false));

    this.arrow = this.makeArrow();
    this.cookie = this.makeCookie();
    this.butterfly = this.makeButterfly();
    this.scene.add(this.arrow, this.cookie, this.butterfly);
    this.arrow.visible = this.cookie.visible = this.butterfly.visible = false;

    // Dinosaurs of this game (built once; thumbnails need all four).
    for (const id of DINOS) this.dinos.set(id, buildDino(id));
    this.setupEnvironment();
    this.renderThumbs();
    for (const id of DINOS) if (!plan.rounds.some((r) => r.dino === id)) {
      this.dinos.get(id)!.dispose();
      this.dinos.delete(id);
    }

    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    canvas.addEventListener('pointerleave', this.onUp);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(canvas.parentElement ?? canvas);
    this.fit();
    this.startRound(0);
    this.camPos.copy(this.goal.pos);
    this.camTarget.copy(this.goal.target);
    this.loop();
  }

  /* ───────────────────────── Public API (HUD buttons) ───────────────────────── */

  /** The "Brush" button: a stroke of the brush over the next hidden bone. */
  brushOnce() {
    if (this.phase !== 'dig') return;
    this.idleDig = 0;
    if (this.autoBrush) {
      this.brushQueue = Math.min(2, this.brushQueue + 1);
      return;
    }
    this.startAutoBrush();
  }

  chooseBone(piece: PieceId) {
    if (this.phase !== 'build' || this.isBusy()) return;
    const bone = this.bones.find((b) => b.id === piece && !b.placed);
    if (!bone) return;
    const round = this.roundPlan;
    const slot = this.slotPose(bone);
    this.audio.pick();
    if (checkPiece(round, this.step, piece)) {
      const turns = round.placements[this.step].turns;
      if (turns) {
        this.holding = bone;
        this.turnOff = turns;
        this.turnTries = 0;
        this.busyFor(0.9);
        this.fly(bone, this.hoverPose(bone, turns), 0.85, 1.2, () => {
          this.setPhase('turn');
          this.say(turnText(this.locale), 'instruction');
        });
        this.setView('turn');
      } else {
        this.busyFor(0.9);
        this.fly(bone, slot, 0.85, 1.4, () => this.placed(bone));
      }
    } else {
      // A wrong bone wiggles in front of the spot, then goes gently back to the tarp.
      this.stats.mistakes++;
      this.busyFor(2.1);
      const near = this.hoverPose(bone, 0);
      this.fly(bone, near, 0.75, 1.0, () => {
        bone.wiggle = 1;
        this.audio.wiggle();
        this.ziggy.userData.rig.cue('oops');
        this.say(pieceHint(round, this.step, this.plan.band, this.locale), 'hint');
        this.after(0.8, () => this.fly(bone, bone.tarp, 0.7, 0.8));
      });
    }
    this.emit();
  }

  /** Turn the bone a quarter turn: 1 = clockwise (↻), -1 = counter-clockwise (↺). */
  turn(dir: 1 | -1) {
    if (this.phase !== 'turn' || !this.holding || this.isBusy()) return;
    this.turnOff = (this.turnOff + (dir > 0 ? 3 : 1)) % 4;
    this.audio.turn();
    this.busyFor(0.28);
    this.fly(this.holding, this.hoverPose(this.holding, this.turnOff), 0.26, 0);
  }

  /** Put the turned bone in place. */
  place() {
    if (this.phase !== 'turn' || !this.holding || this.isBusy()) return;
    const bone = this.holding;
    if (this.turnOff === 0) {
      this.holding = null;
      this.busyFor(0.6);
      this.fly(bone, this.slotPose(bone), 0.5, 0.2, () => this.placed(bone));
      this.setPhase('build');
    } else {
      this.stats.mistakes++;
      this.turnTries++;
      bone.wiggle = 1;
      this.audio.wiggle();
      this.ziggy.userData.rig.cue('think');
      this.busyFor(0.7);
      this.say(turnHint((4 - this.turnOff) % 4, this.turnTries, this.locale), 'hint');
    }
  }

  answer(index: number) {
    if ((this.phase !== 'digQuestion' && this.phase !== 'quiz') || !this.question || this.isBusy()) return;
    const q = this.question;
    if (checkAnswer(q, index)) {
      this.stats.correct++;
      this.audio.star();
      this.ziggy.userData.rig.cue('cheer');
      this.sparkles.emit(this.ziggy.position.clone().add(v(0, 2.2, 0)), { color: '#ffe066', count: this.lowPower ? 10 : 22, spread: 2.4, up: 2.2, life: 1.0, size: 0.4, additive: true });
      this.say(`${praiseFor(this.round + this.step + 1, this.locale)} ${q.explain[this.locale === 'fr' ? 'fr' : 'en']}`, 'praise');
      this.question = null;
      this.busyFor(1.2);
      if (this.phase === 'digQuestion') this.after(1.6, () => this.startBuild());
      else {
        this.roarT = 0;
        this.after(1.4, () => this.finishRound());
      }
    } else {
      this.stats.mistakes++;
      this.audio.oops();
      this.ziggy.userData.rig.cue('think');
      this.busyFor(0.6);
      this.say(q.hint[this.locale === 'fr' ? 'fr' : 'en'], 'hint');
    }
    this.emit();
  }

  /** Hide-and-seek: the child points at a palm tree. */
  pickPalm(i: number) {
    if (this.phase !== 'hide' || this.isBusy() || this.hideSpot < 0) return;
    const palm = this.world.hidePalms[this.palmIndex(i)];
    if (!palm) return;
    if (i !== this.hideSpot) {
      (palm.userData.shake as () => void)?.();
      this.audio.wiggle();
      this.ziggy.userData.rig.cue('giggle');
      this.say(hideWrongText(this.locale), 'hint');
      this.busyFor(0.8);
      return;
    }
    (palm.userData.shake as () => void)?.();
    this.busyFor(3.2);
    this.hideSpot = -1;
    this.audio.star();
    this.say(hideFoundText(this.locale), 'praise');
    this.ziggy.userData.rig.cue('cheer');
    // It pops out of the bush, turns to the child and roars a tiny happy roar.
    const d = this.dino;
    const from = d.root.position.clone();
    const to = from.clone().add(v(0, 0, 3.2));
    this.walkDino(d, from, to, 1.1, -Math.PI / 2, -Math.PI / 2 + 0.0001, () => {
      this.turnDinoTo(d, -0.6, 0.6);
      this.roarT = 0;
      this.hearts.emit(d.root.position.clone().add(v(0, 2.6, 0)), { count: this.lowPower ? 5 : 10, spread: 1.8, up: 1.6, life: 1.4, size: 0.5 });
      this.after(1.6, () => this.startQuiz());
    });
    this.emit();
  }

  /** "Continue": skip a cinematic, or go to the next dinosaur. */
  next() {
    if (this.phase === 'roundDone') {
      if (this.isBusy()) return;
      this.leaveStand();
      return;
    }
    if ((this.phase === 'awake' || this.phase === 'fun') && this.canSkip) this.skipCinematic();
  }

  setMusic(on: boolean) {
    if (on) this.audio.startMusic();
    else this.audio.stopMusic();
  }

  /** Height of the HUD at the top and bottom (pixels): the camera frames the action between them. */
  setInsets(top: number, bottom: number) {
    if (Math.abs(top - this.insets.top) < 4 && Math.abs(bottom - this.insets.bottom) < 4) return;
    this.insets = { top, bottom };
    this.fit();
  }

  /** Thumbnails for the HUD buttons (data URLs). */
  readonly thumbs = { piece: new Map<string, string>(), scaled: new Map<string, string>(), dino: new Map<DinoId, string>() };

  thumbFor(kind: 'piece' | 'scaled', dino: DinoId, piece: PieceId): string | undefined {
    return (kind === 'piece' ? this.thumbs.piece : this.thumbs.scaled).get(`${dino}-${piece}`);
  }

  /* ───────────────────────── Rounds ───────────────────────── */

  private get roundPlan(): RoundPlan {
    return this.plan.rounds[this.round];
  }

  private startRound(i: number) {
    this.round = i;
    const round = this.roundPlan;
    this.stats = { correct: 0, mistakes: 0 };
    this.roundStart = performance.now();
    this.found = 0;
    this.step = 0;
    this.choices = [];
    this.question = null;
    this.holding = null;
    this.palmsShown = 0;
    this.hideSpot = -1;
    this.canSkip = false;
    this.idleDig = 0;
    this.cancel('cine');

    // The dinosaur's place on the stand, its ghost silhouette and the bones already there.
    this.dino = this.dinos.get(round.dino)!;
    const d = this.dino;
    const s = d.scale;
    d.root.scale.setScalar(s);
    d.root.rotation.set(0, 0, 0);
    d.root.position.copy(this.standPos(d));
    d.flesh.visible = false;
    d.flesh.scale.setScalar(1);
    d.rig.awake = 0;
    d.rig.dance = d.rig.roar = d.rig.reach = d.rig.sniff = d.rig.walk = 0;
    if (!d.root.parent) this.scene.add(d.root);
    for (const g of this.ghosts.values()) {
      g.parent?.remove(g);
      (g.material as THREE.Material).dispose();
    }
    this.ghosts.clear();
    for (const m of this.presetMeshes) {
      m.parent?.remove(m);
      (m.material as THREE.Material).dispose();
    }
    this.presetMeshes = [];
    for (const b of this.bones) {
      b.mesh.parent?.remove(b.mesh);
      b.mat.dispose();
    }
    this.bones = [];
    d.root.updateMatrixWorld(true);
    for (const pm of d.pieces) {
      if (round.preset.includes(pm.id)) {
        const mesh = new THREE.Mesh(pm.geometry, this.boneMaterial());
        mesh.position.copy(pm.slot);
        mesh.castShadow = true;
        d.root.add(mesh);
        this.presetMeshes.push(mesh);
      } else {
        const g = new THREE.Mesh(pm.geometry, new THREE.MeshBasicMaterial({ color: '#8fd8ff', transparent: true, opacity: 0.26, depthWrite: false }));
        g.position.copy(pm.slot);
        g.renderOrder = 2;
        d.root.add(g);
        this.ghosts.set(pm.id, g);
      }
    }

    // Bury the bones in fresh sand.
    this.sand.refill(this.seed + i * 17);
    this.layoutBones(round);
    this.setPhase('dig');
    if (this.camera.aspect < 0.9) this.ziggyTeleport(v(SITE.box.x - SITE.boxW / 2 - 0.75, 0, SITE.box.z + 0.6), Math.PI / 2);
    else this.ziggyTeleport(v(-1.7, 0, SITE.box.z - SITE.boxD / 2 - 0.55), 0);
    this.ziggy.userData.rig.idle = 'calm';
    this.setView('dig');
    this.say(digText(this.plan.band, this.locale), 'instruction');
  }

  private standPos(d: DinoModel): V3 {
    const cx = (d.box.min.x + d.box.max.x) / 2;
    return SITE.stand.clone().add(v(-cx * d.scale, SITE.standTop, -0.2));
  }

  private boneMaterial() {
    return new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#000000' });
  }

  /** Lay the round's bones in the sand (box) and plan their places on the tarp. */
  private layoutBones(round: RoundPlan) {
    const d = this.dino;
    const pieces = round.buried.map((id) => d.pieces.find((p) => p.id === id)!);
    const maxSize = Math.max(...d.pieces.map((p) => Math.max(p.w, p.h)));
    let s = Math.min(1, 2.7 / maxSize) * d.scale;
    const pack = (W: number, D: number, scale: number) => {
      const items = pieces.map((p) => {
        const long = Math.max(p.w, p.h) * scale;
        const short = Math.min(p.w, p.h) * scale;
        return { p, long, short, yaw: p.h > p.w ? -Math.PI / 2 : 0 };
      });
      items.sort((a, b) => b.long - a.long);
      const rows: { items: typeof items; w: number; d: number }[] = [];
      for (const it of items) {
        const row = rows.find((r) => r.w + it.long + 0.35 <= W);
        if (row) {
          row.items.push(it);
          row.w += it.long + 0.35;
          row.d = Math.max(row.d, it.short);
        } else rows.push({ items: [it], w: it.long, d: it.short });
      }
      const depth = rows.reduce((a, r) => a + r.d, 0) + (rows.length - 1) * 0.3;
      return { rows, depth, fits: depth <= D };
    };
    let boxPack = pack(SITE.boxW - 0.7, SITE.boxD - 0.6, s);
    for (let k = 0; k < 8 && !boxPack.fits; k++) {
      s *= 0.9;
      boxPack = pack(SITE.boxW - 0.7, SITE.boxD - 0.6, s);
    }
    this.boxScale = s;
    const r = this.seededRandom(this.round);
    const flat = new THREE.Quaternion().setFromAxisAngle(v(1, 0, 0), -Math.PI / 2);
    const poses = new Map<PieceId, { box: Pose; tarp: Pose }>();
    const place = (pk: ReturnType<typeof pack>, center: V3, floorY: number, squashMax: number, jitter: number) => {
      const out = new Map<PieceId, Pose>();
      let z = center.z - pk.depth / 2;
      for (const row of pk.rows) {
        let x = center.x - row.w / 2;
        for (const it of row.items) {
          const zExt = (it.p.geometry.boundingBox!.max.z - it.p.geometry.boundingBox!.min.z) * s;
          const squash = Math.min(1, squashMax / Math.max(0.01, zExt));
          const yaw = new THREE.Quaternion().setFromAxisAngle(v(0, 1, 0), it.yaw + (r() - 0.5) * jitter);
          const q = yaw.multiply(flat.clone());
          const p = v(x + it.long / 2 + (r() - 0.5) * jitter * 0.4, floorY + (zExt * squash) / 2, z + row.d / 2 + (r() - 0.5) * jitter * 0.3);
          out.set(it.p.id, { p, q, s: v(s, s, s * squash) });
          x += it.long + 0.35;
        }
        z += row.d + 0.3;
      }
      return out;
    };
    const inBox = place(boxPack, SITE.box, this.sand.floor, 0.3, 0.35);
    let tarpPack = pack(SITE.tarpW - 0.6, SITE.tarpD - 0.3, s);
    if (!tarpPack.fits) tarpPack = pack(SITE.tarpW - 0.4, SITE.tarpD + 1.2, s);
    const onTarp = place(tarpPack, SITE.tarp, SITE.tarp.y + 0.01, 0.55, 0.12);
    for (const p of pieces) poses.set(p.id, { box: inBox.get(p.id)!, tarp: onTarp.get(p.id)! });

    for (const pm of pieces) {
      const mat = this.boneMaterial();
      const mesh = new THREE.Mesh(pm.geometry, mat);
      mesh.castShadow = true;
      mesh.userData.tapBone = pm.id;
      const pose = poses.get(pm.id)!;
      this.applyPose(mesh, pose.box);
      this.scene.add(mesh);
      mesh.updateMatrixWorld(true);
      // Samples on the top surface: they show when the sand above them is gone.
      const pos = pm.geometry.attributes.position as THREE.BufferAttribute;
      const samples: V3[] = [];
      const step = Math.max(1, Math.floor(pos.count / 90));
      const zMid = (pm.geometry.boundingBox!.max.z + pm.geometry.boundingBox!.min.z) / 2;
      for (let i = 0; i < pos.count; i += step) {
        const p = v().fromBufferAttribute(pos, i);
        if (p.z < zMid) continue;
        samples.push(p.applyMatrix4(mesh.matrixWorld));
      }
      this.bones.push({ id: pm.id, model: pm, mesh, mat, found: false, placed: false, box: pose.box, tarp: pose.tarp, samples, flight: null, wiggle: 0, glowT: 0 });
    }
    // Younger children see the tip of each bone peeking out of the sand: a clue where to rub.
    if (this.plan.band !== 'big')
      for (const b of this.bones) {
        const top = b.samples.reduce((a, p) => (p.y > a.y ? p : a), b.samples[0]);
        const end = b.samples.reduce((a, p) => (p.x < a.x ? p : a), b.samples[0]);
        this.sand.peek(end.x, end.z, 0.32, top.y - 0.03);
      }
  }

  private seededRandom(k: number) {
    let a = (this.seed * 7919 + k * 104729 + 1) >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ── Digging ── */

  private scrapeAt(x: number, z: number, amount: number) {
    if (!this.sand.contains(x, z, 0.3)) return;
    const radius = this.plan.band === 'little' ? 0.62 : 0.52;
    const moved = this.sand.scrape(x, z, radius, amount);
    if (moved > 0.002) {
      this.rubbing = 0.25;
      this.audio.scrape();
      const y = this.sand.heightAt(x, z);
      if (Math.random() < 0.5) this.grains.emit(v(x, y, z), this.lowPower ? 2 : 4, 1.1, 2.4);
      if (Math.random() < 0.12) this.puffs.emit(v(x, y + 0.1, z), { color: '#f3dcae', count: 1, spread: 0.6, up: 0.6, life: 0.8, size: 0.7 });
    }
  }

  private startAutoBrush() {
    const next = this.bones.find((b) => !b.found);
    if (!next) return;
    // A zig-zag stroke over the bone's footprint, decided now and brushed over a few frames
    // (the same amount of sand whatever the frame rate).
    const b = next;
    const xs = b.samples.map((p) => p.x);
    const zs = b.samples.map((p) => p.z);
    const x0 = Math.min(...xs) - 0.1;
    const x1 = Math.max(...xs) + 0.1;
    const zc = (Math.min(...zs) + Math.max(...zs)) / 2;
    const zh = (Math.max(...zs) - Math.min(...zs)) / 2 + 0.12;
    const path: V3[] = [];
    const len = (x1 - x0) * 2.4 + zh * 10;
    const n = Math.max(12, Math.ceil(len / 0.08));
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      path.push(v(x0 + (x1 - x0) * k, 0, zc + Math.sin(k * Math.PI * 5) * zh));
    }
    this.autoBrush = { bone: next, t: 0, dur: this.reduceMotion ? 0.45 : 0.7, path, done: 0 };
  }

  private stepAutoBrush(dt: number) {
    const ab = this.autoBrush;
    if (!ab) return;
    ab.t += dt;
    const k = Math.min(1, ab.t / ab.dur);
    const upto = Math.floor(k * (ab.path.length - 1));
    const depth = this.plan.band === 'little' ? 0.11 : 0.06;
    for (; ab.done <= upto; ab.done++) {
      const p = ab.path[ab.done];
      this.scrapeAt(p.x, p.z, depth);
    }
    if (k >= 1) {
      this.autoBrush = null;
      if (this.brushQueue > 0 && this.phase === 'dig') {
        this.brushQueue--;
        this.startAutoBrush();
      }
    }
  }

  private checkFound() {
    if (this.phase !== 'dig') return;
    const need = this.plan.band === 'little' ? 0.34 : 0.42;
    for (const b of this.bones) {
      if (b.found) continue;
      let seen = 0;
      for (const s of b.samples) if (s.y > this.sand.heightAt(s.x, s.z) - 0.005) seen++;
      if (seen / Math.max(1, b.samples.length) >= need) this.boneFound(b);
    }
  }

  private boneFound(b: Bone) {
    b.found = true;
    this.found++;
    const n = this.found;
    this.idleDig = 0;
    // Brush away what's left on top of it.
    for (const s of b.samples) this.sand.scrape(s.x, s.z, 0.28, 1, this.sand.floor);
    b.glowT = 1.2;
    this.audio.found(n);
    this.ziggy.userData.rig.cue(n % 2 ? 'jump' : 'cheer');
    const at = b.mesh.position.clone().add(v(0, 0.3, 0));
    this.sparkles.emit(at, { color: '#ffe9a8', count: this.lowPower ? 10 : 20, spread: 1.6, up: 2.2, life: 0.9, size: 0.35, additive: true });
    this.say(countWord(n, this.locale), 'count');
    this.emit();
    if (this.found >= this.bones.length) {
      this.autoBrush = null;
      this.brushQueue = 0;
      this.setPhase('gather');
      this.after(0.9, () => this.gather());
    }
  }

  private gather() {
    this.say(digDoneText(this.locale), 'instruction');
    this.audio.whoosh();
    this.bones.forEach((b, i) => this.after(0.15 + i * 0.22, () => this.fly(b, b.tarp, 0.9, 1.3)));
    const total = 0.15 + this.bones.length * 0.22 + 1.0;
    const q = this.roundPlan.digQuestion;
    this.after(0.5, () => this.setView(q ? 'tarp' : 'build'));
    this.after(total, () => {
      if (q) {
        this.question = q;
        this.setPhase('digQuestion');
        this.askQuestion(q);
      } else this.startBuild();
    });
  }

  /* ── Rebuilding ── */

  private startBuild() {
    this.step = 0;
    this.setPhase('build');
    this.setView('build');
    this.ziggyGo(this.ziggyBuildSpot(), 0);
    this.nextStep(true);
  }

  private ziggyBuildSpot(): V3 {
    const d = this.dino;
    const left = d.root.position.x + d.box.min.x * d.scale;
    return v(Math.max(-7.4, left - 0.6), 0, SITE.stand.z + SITE.standD / 2 + 0.8);
  }

  private nextStep(first = false) {
    const round = this.roundPlan;
    if (this.step >= round.placements.length) {
      this.skeletonDone();
      return;
    }
    this.choices = boneChoices(round, this.step, this.seed);
    const piece = round.placements[this.step].piece;
    for (const [id, g] of this.ghosts) {
      const m = g.material as THREE.MeshBasicMaterial;
      const current = id === piece;
      m.color.set(current ? '#ffd166' : '#8fd8ff');
      m.opacity = current ? 0.55 : 0.22;
    }
    this.arrow.visible = true;
    if (first) this.say(buildText(this.locale), 'instruction');
    this.emit();
  }

  private placed(bone: Bone) {
    bone.placed = true;
    this.stats.correct++;
    if (this.roundPlan.placements[this.step].turns) this.stats.correct++;
    const ghost = this.ghosts.get(bone.id);
    if (ghost) ghost.visible = false;
    bone.glowT = 0.8;
    this.audio.clack();
    this.ziggy.userData.rig.cue(this.step % 2 ? 'cheer' : 'nod');
    const at = bone.mesh.position.clone();
    this.sparkles.emit(at, { color: '#fff3c4', count: this.lowPower ? 12 : 26, spread: 2.2, up: 1.8, life: 0.9, size: 0.38, additive: true });
    this.say(praiseFor(this.step + this.round, this.locale), 'praise');
    this.step++;
    this.setView('build');
    this.nextStep();
  }

  private skeletonDone() {
    this.arrow.visible = false;
    this.choices = [];
    this.setPhase('awake');
    this.canSkip = true;
    this.say(skeletonDoneText(this.locale), 'instruction');
    this.setView('dino');
    const d = this.dino;
    const meshes = [...this.presetMeshes, ...this.bones.map((b) => b.mesh)];
    this.after(0.2, () => meshes.forEach((m) => ((m as THREE.Mesh & { userData: { glow?: number } }).userData.glow = 1.6)), 'cine');
    this.after(1.4, () => {
      this.audio.pouf();
      const box = this.dinoWorldBox(d);
      const c = box.getCenter(v());
      const size = box.getSize(v());
      for (let k = 0; k < (this.lowPower ? 6 : 12); k++)
        this.puffs.emit(c.clone().add(v((Math.random() - 0.5) * size.x, (Math.random() - 0.3) * size.y * 0.8, 0.5)), { color: k % 3 ? '#ffffff' : '#ffe1f0', count: 2, spread: 1.2, up: 0.8, life: 1.3, size: 2.0 });
      this.sparkles.emit(c, { color: '#ffe066', count: this.lowPower ? 18 : 40, spread: size.x * 0.6, up: 2.5, life: 1.4, size: 0.45, additive: true });
      d.flesh.visible = true;
      this.flesh = { d, t: 0 };
      this.ziggy.userData.rig.cue('jump');
    }, 'cine');
    this.after(1.7, () => {
      for (const m of meshes) m.visible = false;
    }, 'cine');
    // Alive: it turns three-quarters towards the child (we see its face, its frill, both eyes).
    this.after(1.9, () => this.turnDinoTo(d, LIVE_YAW, 1.0), 'cine');
    this.after(2.5, () => {
      d.rig.awake = 1;
      d.rig.blink();
      this.say(awakeText(d.id, this.locale), 'fact');
    }, 'cine');
    this.after(3.3, () => {
      this.roarT = 0;
      this.ziggy.userData.rig.cue('giggle');
    }, 'cine');
    this.after(4.7, () => {
      d.rig.dance = 1;
      this.ziggy.userData.rig.idle = 'dance';
      this.audio.star();
      this.hearts.emit(this.dinoWorldBox(d).getCenter(v()).add(v(0, 1.5, 0.5)), { count: this.lowPower ? 4 : 8, spread: 2.5, up: 1.4, life: 1.6, size: 0.55 });
    }, 'cine');
    this.after(7.2, () => {
      d.rig.dance = 0;
      this.ziggy.userData.rig.idle = 'calm';
      this.startFun();
    }, 'cine');
  }

  private dinoWorldBox(d: DinoModel): THREE.Box3 {
    d.root.updateMatrixWorld(true);
    const out = new THREE.Box3();
    const bb = d.box;
    for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) out.expandByPoint(v(x, y, z).applyMatrix4(d.root.matrixWorld));
    return out;
  }

  /* ── The funny moment ── */

  private startFun() {
    const round = this.roundPlan;
    const d = this.dino;
    this.setPhase('fun');
    this.say(funText(round.fun, this.locale), 'instruction');
    const head = (o: THREE.Object3D) => o.getWorldPosition(v());
    if (round.fun === 'cookie') {
      const m = head(d.mouth);
      const fwd = v(1, 0, 0).applyAxisAngle(v(0, 1, 0), d.root.rotation.y);
      const cookieAt = m.clone().addScaledVector(fwd, 0.9).add(v(0, -1.7, 0.4));
      this.cookie.position.copy(cookieAt);
      this.cookie.scale.setScalar(0.01);
      this.cookie.visible = true;
      this.cookie.userData.pop = 0;
      this.reachT = 0;
      this.ziggyGo(v(cookieAt.x + 0.6, 0, SITE.stand.z + SITE.standD / 2 + 0.9), -0.3);
      this.after(2.6, () => this.ziggy.userData.rig.cue('giggle'), 'cine');
      this.after(3.6, () => {
        this.reachT = -1;
        d.rig.reach = 0;
        this.ziggy.userData.rig.cue('jump');
        this.audio.whoosh();
        this.flyObject(this.cookie, head(d.mouth), 0.8, 1.2, () => {
          this.cookie.visible = false;
          d.rig.chew = 1.6;
          this.audio.munch();
          this.grains.emit(head(d.mouth), this.lowPower ? 8 : 16, 1.0, 1.5);
          this.hearts.emit(head(d.mouth).add(v(0, 0.6, 0)), { count: this.lowPower ? 4 : 8, spread: 1.4, up: 1.4, life: 1.3, size: 0.5 });
        });
        this.after(0.5, () => (this.roarT = 0.25), 'cine');
      }, 'cine');
      this.after(6.4, () => this.startQuiz(), 'cine');
    } else if (round.fun === 'sneeze') {
      const nose = head(d.nose);
      const spot = v(nose.x + 1.2, 0, SITE.stand.z + SITE.standD / 2 + 0.9);
      this.ziggyGo(spot, -0.6);
      this.butterfly.visible = true;
      this.butterfly.position.copy(nose).add(v(4, 1.5, 2));
      this.flyObject(this.butterfly, nose.clone().add(v(0.15, 0.1, 0)), 1.6, 0.6);
      this.after(1.6, () => {
        this.sniffT = 0;
        this.audio.sneeze();
      }, 'cine');
      this.after(2.65, () => {
        this.sniffT = -1;
        d.rig.sniff = 0;
        const n = head(d.nose);
        for (let k = 0; k < (this.lowPower ? 5 : 10); k++) this.puffs.emit(n.clone().add(v(0.3 + k * 0.12, -0.1, 0)), { color: '#ffffff', count: 2, spread: 1.4, up: 0.3, life: 1.2, size: 1.3 });
        this.flyObject(this.butterfly, n.clone().add(v(5, 3, 3)), 1.4, 1.5, () => (this.butterfly.visible = false));
        const from = this.ziggy.position.clone();
        this.ziggyMove = null;
        this.ziggyFly = { t: 0, from, to: from.clone().add(v(2.8, 0, 1.2)), dur: 1.7 };
        this.audio.whoosh();
      }, 'cine');
      this.after(4.6, () => this.ziggy.userData.rig.cue('giggle'), 'cine');
      this.after(6.2, () => this.startQuiz(), 'cine');
    } else if (round.fun === 'music') {
      const plates = d.rig.parts.plates;
      this.ziggyGo(v(d.root.position.x + 0.4, 0, SITE.stand.z + SITE.standD / 2 + 0.9), 0);
      d.rig.dance = 0.25;
      this.after(1.2, () => (this.plateShow = { i: 0, t: 0 }), 'cine');
      this.after(1.2 + plates.length * 0.3 + 1.6, () => {
        d.rig.dance = 0;
        this.plateShow = null;
        for (const p of plates) ((p.material as THREE.MeshStandardMaterial).emissive as THREE.Color).set('#000000');
        this.startQuiz();
      }, 'cine');
    } else {
      // Hide-and-seek: the Triceratops trots off behind a palm tree.
      this.canSkip = false;
      const hide = round.hide!;
      this.palmsShown = hide.palms;
      const palm = this.world.hidePalms[this.palmIndex(hide.spot)];
      const behind = palm.position.clone().add(v(0, 0, -1.25));
      d.root.position.y = 0;
      this.setView('hide');
      this.ziggyGo(v(SITE.hide[0].x - 1.6, 0, SITE.hide[0].z + 2.8), 0.6);
      this.ziggy.userData.rig.cue('think');
      this.walkDino(d, d.root.position.clone(), behind, 2.4, d.root.rotation.y, -Math.PI / 2, () => {
        this.hideSpot = hide.spot;
        this.setPhase('hide');
        this.say(funText('hide', this.locale), 'question', this.palmWords(hide.palms));
      });
    }
    this.emit();
  }

  /** On-screen palms (2 for little ones: the outer ones). */
  private palmIndex(i: number) {
    return this.palmsShown === 2 ? [0, 2][i] ?? 0 : i;
  }

  private palmWords(n: number): string[] {
    const fr = this.locale === 'fr';
    const names = n === 2 ? (fr ? ['À gauche', 'À droite'] : ['Left', 'Right']) : fr ? ['À gauche', 'Au milieu', 'À droite'] : ['Left', 'Middle', 'Right'];
    return names;
  }

  private skipCinematic() {
    const fromAwake = this.phase === 'awake';
    this.cancel('cine');
    const d = this.dino;
    this.flesh = null;
    d.flesh.visible = true;
    d.flesh.scale.setScalar(1);
    for (const m of [...this.presetMeshes, ...this.bones.map((b) => b.mesh)]) m.visible = false;
    d.rig.awake = 1;
    this.dinoTurn = null;
    if (this.roundPlan.fun !== 'hide') d.root.rotation.y = LIVE_YAW;
    d.rig.dance = d.rig.reach = d.rig.sniff = 0;
    this.roarT = this.sniffT = this.reachT = -1;
    d.rig.roar = 0;
    this.cookie.visible = this.butterfly.visible = false;
    this.plateShow = null;
    for (const p of d.rig.parts.plates) (p.material as THREE.MeshStandardMaterial).emissive.set('#000000');
    this.ziggyFly = null;
    this.ziggy.rotation.x = 0;
    this.ziggy.userData.rig.idle = 'calm';
    if (this.ziggy.position.y > 0.01) this.ziggy.position.y = 0;
    this.ziggyMove = null;
    this.objFlights = [];
    // "Continue" while it wakes up goes on to the funny moment; during the funny moment, to the question.
    if (fromAwake) this.startFun();
    else this.startQuiz();
  }

  /* ── The question ── */

  private startQuiz() {
    const q = this.roundPlan.quiz;
    this.canSkip = false;
    this.palmsShown = 0;
    this.question = q;
    this.setPhase('quiz');
    this.setView('dino');
    this.askQuestion(q);
  }

  private askQuestion(q: Question) {
    const text = q.text[this.locale === 'fr' ? 'fr' : 'en'];
    // Pre-readers hear every answer (pictures and numbers are named).
    const extra = this.plan.band === 'little' || q.choices.some((c) => c.kind === 'text') ? q.choices.map((c) => choiceLabel(c, this.locale)) : [];
    this.say(text, 'question', extra);
    this.emit();
  }

  private finishRound() {
    const round = this.roundPlan;
    this.done.push(round.dino);
    const total = roundTotal(round);
    this.cb.onRoundDone({
      skill: round.skill,
      correct: Math.max(total, this.stats.correct),
      mistakes: this.stats.mistakes,
      total,
      durationMs: performance.now() - this.roundStart,
      dino: round.dino,
    });
    this.setPhase('roundDone');
    this.say(roundDoneText(round.dino, this.round >= this.plan.rounds.length - 1, this.locale), 'praise');
    this.ziggy.userData.rig.cue('wave');
    this.emit();
  }

  /** The dinosaur walks off to the museum; then the next dig (or the museum). */
  private leaveStand() {
    const d = this.dino;
    this.busyFor(2.0);
    const from = d.root.position.clone();
    const to = from.clone().add(v(9, 0, 1.5));
    this.walkDino(d, from, to, 1.8, d.root.rotation.y, 0.25, () => {
      this.toMuseum(d, this.done.length - 1);
      if (this.round + 1 < this.plan.rounds.length) this.startRound(this.round + 1);
      else this.startMuseum();
    });
    this.ziggy.userData.rig.cue('wave');
  }

  private toMuseum(d: DinoModel, i: number) {
    const ped = this.world.pedestals[this.plan.rounds.length === 2 ? [0, 2][i] : i] ?? this.world.pedestals[1];
    const len = (d.box.max.x - d.box.min.x) * d.scale;
    const k = Math.min(0.9, 4.6 / len);
    d.root.scale.setScalar(d.scale * k);
    const cx = (d.box.min.x + d.box.max.x) / 2;
    d.root.position.copy(ped).add(v(-cx * d.scale * k, 0, 0));
    d.root.rotation.set(0, -0.3, 0);
    d.flesh.visible = true;
    d.rig.walk = 0;
    this.world.setPlaque(this.world.pedestals.indexOf(ped), dinoLabel(d.id, this.locale));
  }

  private startMuseum() {
    this.setPhase('museum');
    this.setView('museum');
    this.ziggyTeleport(SITE.museum.clone().add(v(0, 0.5, 3.0)), 0);
    this.ziggy.userData.rig.idle = 'wave';
    for (const id of this.done) {
      const d = this.dinos.get(id)!;
      d.rig.dance = 0.6;
    }
    this.say(museumText(this.locale), 'praise');
    this.after(2.6, () => {
      this.flash++;
      this.audio.click();
      this.ziggy.userData.rig.cue('cheer');
      for (let k = 0; k < 5; k++)
        this.after(k * 0.25, () =>
          this.sparkles.emit(SITE.museum.clone().add(v((k - 2) * 4, 5, -1)), { color: ['#ffe066', '#ff7ab8', '#7fd0ff', '#9bf07f', '#ffffff'][k], count: this.lowPower ? 12 : 26, spread: 4, up: 2.4, life: 1.6, size: 0.45, additive: true })
        );
      this.emit();
      this.cb.onFinish();
    });
    this.emit();
  }

  /* ───────────────────────── Motion helpers ───────────────────────── */

  private applyPose(o: THREE.Object3D, p: Pose) {
    o.position.copy(p.p);
    o.quaternion.copy(p.q);
    o.scale.copy(p.s);
  }

  private poseOf(o: THREE.Object3D): Pose {
    return { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() };
  }

  private slotPose(b: Bone): Pose {
    const d = this.dino;
    const s = d.root.scale.x;
    return { p: d.root.position.clone().add(b.model.slot.clone().multiplyScalar(s)), q: new THREE.Quaternion(), s: v(s, s, s) };
  }

  /** In front of its spot (towards the camera), turned by `quarters`. */
  private hoverPose(b: Bone, quarters: number): Pose {
    const slot = this.slotPose(b);
    const lift = Math.max(b.model.w, b.model.h) * slot.s.x * 0.15;
    return { p: slot.p.clone().add(v(0, lift, 1.6)), q: qTurn(quarters), s: slot.s.clone().multiplyScalar(1.05) };
  }

  private fly(b: Bone, to: Pose, dur: number, arc: number, done?: () => void) {
    b.flight = { from: this.poseOf(b.mesh), to, t: 0, dur: this.reduceMotion ? dur * 0.7 : dur, arc, done };
  }

  private objFlights: { o: THREE.Object3D; from: V3; to: V3; t: number; dur: number; arc: number; done?: () => void }[] = [];

  private flyObject(o: THREE.Object3D, to: V3, dur: number, arc: number, done?: () => void) {
    this.objFlights = this.objFlights.filter((f) => f.o !== o);
    this.objFlights.push({ o, from: o.position.clone(), to: to.clone(), t: 0, dur, arc, done });
  }

  private walkDino(d: DinoModel, from: V3, to: V3, dur: number, faceFrom: number, faceTo: number, then?: () => void) {
    this.dinoWalk = { d, from, to, t: 0, dur, faceFrom, faceTo, then };
  }

  private turnDino(d: DinoModel, yaw: number) {
    d.root.rotation.y = yaw;
  }

  private turnDinoTo(d: DinoModel, yaw: number, dur: number) {
    this.dinoTurn = { d, from: d.root.rotation.y, to: yaw, t: 0, dur };
  }

  private ziggyTeleport(p: V3, face: number) {
    this.ziggyMove = null;
    this.ziggyFly = null;
    this.ziggy.position.copy(p);
    this.ziggy.rotation.set(0, face, 0);
    this.ziggy.userData.rig.walk = 0;
  }

  private ziggyGo(p: V3, face: number | null, then?: () => void) {
    if (this.ziggy.position.distanceTo(p) > 14) {
      this.sparkles.emit(this.ziggy.position.clone().add(v(0, 1, 0)), { color: '#bfe8ff', count: 10, spread: 1.2, up: 1.2, life: 0.7, size: 0.35, additive: true });
      this.ziggyTeleport(p, face ?? this.ziggy.rotation.y);
      then?.();
      return;
    }
    this.ziggyMove = { to: p.clone(), face, speed: 2.8, then };
  }

  private after(sec: number, fn: () => void, tag = 'game') {
    this.tasks.push({ at: this.time + sec, fn, tag });
  }

  private cancel(tag: string) {
    this.tasks = this.tasks.filter((t) => t.tag !== tag);
  }

  private busyFor(sec: number) {
    this.busyUntil = Math.max(this.busyUntil, this.time + sec);
    this.emit();
    this.after(sec + 0.02, () => this.emit());
  }

  private isBusy() {
    return this.time < this.busyUntil;
  }

  private setPhase(p: Phase) {
    this.phase = p;
    this.emit();
  }

  private say(text: string, kind: SayKind, extra?: string[]) {
    this.cb.onSay(text, kind, extra);
  }

  private emit() {
    const round = this.plan.rounds[this.round];
    if (!round) return;
    this.cb.onState({
      phase: this.phase,
      round: this.round,
      rounds: this.plan.rounds.length,
      dino: round.dino,
      found: this.found,
      buried: round.buried.length,
      step: this.step,
      steps: round.placements.length,
      choices: this.phase === 'build' ? [...this.choices] : [],
      question: this.phase === 'digQuestion' || this.phase === 'quiz' ? this.question : null,
      palms: this.phase === 'hide' ? this.palmsShown : 0,
      canSkip: this.canSkip && (this.phase === 'awake' || this.phase === 'fun'),
      busy: this.isBusy(),
      done: [...this.done],
      flash: this.flash,
    });
  }

  /* ───────────────────────── Camera ───────────────────────── */

  private digView() {
    const B = SITE.box;
    const portrait = this.camera.aspect < 0.9;
    const box = new THREE.Box3(v(B.x - SITE.boxW / 2 - (portrait ? 0.9 : 0.2), 0, B.z - SITE.boxD / 2 - (portrait ? 0.2 : 0.9)), v(B.x + SITE.boxW / 2 + 0.2, portrait ? 1.2 : 2.3, B.z + SITE.boxD / 2 + 0.2));
    // Portrait: look along the box's long side, so it fills the tall screen.
    return { box, pitch: portrait ? 1.0 : 0.82, yaw: portrait ? Math.PI / 2 : 0 };
  }

  private setView(name: string) {
    this.viewName = name;
    const d = () => this.dino;
    const views: Record<string, () => { box: THREE.Box3; pitch: number; yaw: number }> = {
      dig: () => this.digView(),
      tarp: () => {
        const T = SITE.tarp;
        const portrait = this.camera.aspect < 0.9;
        return { box: new THREE.Box3(v(T.x - SITE.tarpW / 2, 0, T.z - SITE.tarpD / 2), v(T.x + SITE.tarpW / 2, 0.8, T.z + SITE.tarpD / 2)), pitch: portrait ? 1.05 : 0.85, yaw: portrait ? Math.PI / 2 : 0 };
      },
      build: () => {
        const b = this.dinoWorldBox(d());
        const portrait = this.camera.aspect < 0.9;
        b.expandByPoint(v(b.min.x, 0, SITE.tarp.z - SITE.tarpD / 2 + 0.4));
        // Wide screens (and phones, from higher up) also show the bones waiting on the tarp.
        if (this.camera.aspect > 1.1 || portrait) b.expandByPoint(v(b.max.x, 0, SITE.tarp.z + 0.6));
        return { box: b, pitch: portrait ? 0.62 : 0.3, yaw: 0 };
      },
      turn: () => {
        const bone = this.holding ?? this.bones.find((x) => !x.placed);
        const c = bone ? this.slotPose(bone).p : this.dinoWorldBox(d()).getCenter(v());
        const r = bone ? Math.max(bone.model.w, bone.model.h) * d().root.scale.x * 0.85 + 0.9 : 3;
        const box = new THREE.Box3(c.clone().sub(v(r, r * 0.8, 0.5)), c.clone().add(v(r, r * 0.8, 2)));
        return { box, pitch: 0.22, yaw: 0 };
      },
      dino: () => {
        const b = this.dinoWorldBox(d());
        const zp = this.ziggy.position;
        b.expandByPoint(zp.clone().add(v(-0.75, 2.3, 0)));
        b.expandByPoint(zp.clone().add(v(0.75, 0, 0.4)));
        if (this.roundPlan?.fun === 'sneeze' && this.phase !== 'quiz') b.max.y += 1.5;
        b.max.y += 0.8;
        return { box: b, pitch: 0.13, yaw: 0 };
      },
      hide: () => {
        const a = SITE.hide[0];
        const c = SITE.hide[2];
        return { box: new THREE.Box3(v(a.x - 3.0, 0, a.z - 2.5), v(c.x + 2.4, 4.6, c.z + 3.8)), pitch: 0.3, yaw: 0 };
      },
      museum: () => {
        const M = SITE.museum;
        const portrait = this.camera.aspect < 0.9;
        const n = this.done.length;
        const half = n <= 2 && !portrait ? 9.5 : 9.8;
        return { box: new THREE.Box3(v(M.x - half, 0.3, M.z - 2.2), v(M.x + half, portrait ? 4.2 : 6.2, M.z + 4.2)), pitch: portrait ? 0.32 : 0.2, yaw: 0 };
      },
    };
    this.viewFn = views[name] ?? views.dig;
    this.computeGoal();
  }

  /** Find a camera position from which the box fits between the HUD bars. */
  private computeGoal() {
    const { box, pitch, yaw } = this.viewFn();
    const c = box.getCenter(v());
    const dir = v(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).normalize();
    const pr = this.probe;
    pr.fov = this.camera.fov;
    pr.aspect = this.camera.aspect;
    pr.updateProjectionMatrix();
    const h = Math.max(1, this.canvas.clientHeight || 600);
    const limY = Math.max(0.25, ((h - this.insets.top - this.insets.bottom) / h) * 0.94);
    const limX = 0.94;
    const corners: V3[] = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(v(x, y, z));
    let dist = box.getSize(v()).length() * 1.2 + 2;
    const tmp = v();
    for (let it = 0; it < 7; it++) {
      pr.position.copy(c).addScaledVector(dir, dist);
      pr.lookAt(c);
      pr.updateMatrixWorld(true);
      let m = 0;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const k of corners) {
        tmp.copy(k).project(pr);
        m = Math.max(m, Math.abs(tmp.x) / limX);
        minY = Math.min(minY, tmp.y);
        maxY = Math.max(maxY, tmp.y);
      }
      m = Math.max(m, (maxY - minY) / (2 * limY));
      dist = Math.max(3, dist * (0.15 + 0.85 * m));
    }
    // Centre the box vertically (its projection may be lopsided at steep angles).
    pr.position.copy(c).addScaledVector(dir, dist);
    pr.lookAt(c);
    pr.updateMatrixWorld(true);
    let minY = Infinity;
    let maxY = -Infinity;
    for (const k of corners) {
      tmp.copy(k).project(pr);
      minY = Math.min(minY, tmp.y);
      maxY = Math.max(maxY, tmp.y);
    }
    const mid = (minY + maxY) / 2;
    const up = v(0, 1, 0).applyQuaternion(pr.quaternion);
    const halfH = Math.tan(THREE.MathUtils.degToRad(pr.fov / 2)) * dist;
    const shift = up.multiplyScalar(mid * halfH);
    this.goal.target.copy(c).add(shift);
    this.goal.pos.copy(c).addScaledVector(dir, dist).add(shift);
  }

  private fit() {
    const el = this.canvas.parentElement ?? this.canvas;
    const w = el.clientWidth || 800;
    const h = el.clientHeight || 600;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 55 : 42;
    const offY = (this.insets.bottom - this.insets.top) / 2;
    this.camera.setViewOffset(w, h, 0, offY, w, h);
    this.camera.updateProjectionMatrix();
    this.computeGoal();
  }

  /* ───────────────────────── Input ───────────────────────── */

  private toNdc(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
  }

  /** Where the pointer meets the sand (a plane at the sand's middle height). */
  private sandPoint(e: PointerEvent): V3 | null {
    this.toNdc(e);
    const plane = new THREE.Plane(v(0, 1, 0), -SITE.boxTop * 0.55);
    const p = new THREE.Vector3();
    return this.ray.ray.intersectPlane(plane, p) ? p : null;
  }

  private onDown = (e: PointerEvent) => {
    if (this.audio.musicOn) this.audio.startMusic();
    this.pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), last: null, moved: 0 };
    if (this.phase === 'dig') {
      const p = this.sandPoint(e);
      if (p && this.sand.contains(p.x, p.z, 0.3)) {
        this.pointer.last = p;
        this.scrapeAt(p.x, p.z, this.rubAmount());
        try {
          this.canvas.setPointerCapture(e.pointerId);
        } catch {
          /* not capturable: fine */
        }
      }
    }
  };

  private rubAmount() {
    return this.plan.band === 'little' ? 0.07 : 0.055;
  }

  private onMove = (e: PointerEvent) => {
    const pt = this.pointer;
    if (!pt || pt.id !== e.pointerId) return;
    pt.moved = Math.max(pt.moved, Math.hypot(e.clientX - pt.x, e.clientY - pt.y));
    if (this.phase !== 'dig') return;
    const p = this.sandPoint(e);
    if (!p) return;
    if (!pt.last) {
      if (this.sand.contains(p.x, p.z, 0.3)) pt.last = p;
      return;
    }
    const d = p.distanceTo(pt.last);
    const steps = Math.min(12, Math.ceil(d / 0.09));
    for (let i = 1; i <= steps; i++) {
      const q = pt.last.clone().lerp(p, i / steps);
      this.scrapeAt(q.x, q.z, this.rubAmount());
    }
    pt.last = p;
    this.idleDig = 0;
  };

  private onUp = (e: PointerEvent) => {
    const pt = this.pointer;
    if (!pt || pt.id !== e.pointerId) return;
    this.pointer = null;
    if (pt.moved > 12 || performance.now() - pt.t > 600) return;
    this.tap(e);
  };

  /** Taps on 3D things: bones on the tarp, the turning bone, palms, the dinosaur, Ziggy. */
  private tap(e: PointerEvent) {
    this.toNdc(e);
    if (this.phase === 'build') {
      const meshes = this.bones.filter((b) => !b.placed && !b.flight).map((b) => b.mesh);
      const hit = this.ray.intersectObjects(meshes, false)[0];
      if (hit) {
        const id = hit.object.userData.tapBone as PieceId;
        if (this.choices.includes(id)) this.chooseBone(id);
        return;
      }
    }
    if (this.phase === 'turn' && this.holding) {
      if (this.ray.intersectObject(this.holding.mesh, false).length) return this.turn(1);
    }
    if (this.phase === 'hide') {
      for (let i = 0; i < this.palmsShown; i++) {
        const palm = this.world.hidePalms[this.palmIndex(i)];
        if (this.ray.intersectObject(palm, true).length) return this.pickPalm(i);
      }
    }
    if ((this.phase === 'quiz' || this.phase === 'roundDone' || this.phase === 'museum') && this.dino) {
      if (this.ray.intersectObject(this.dino.flesh, true).length) {
        this.roarT = 0;
        this.hearts.emit(this.dinoWorldBox(this.dino).getCenter(v()).add(v(0, 1.4, 0.6)), { count: 4, spread: 1.2, up: 1.2, life: 1.1, size: 0.45 });
        return;
      }
    }
    if (this.ray.intersectObject(this.ziggy, true).length) this.ziggy.userData.rig.cue('giggle');
  }

  private onVisibility = () => {
    const hide = document.hidden;
    if (hide === this.hidden) return;
    this.hidden = hide;
    this.audio.suspend(hide);
    if (hide) cancelAnimationFrame(this.raf);
    else {
      this.clock.getDelta();
      this.loop();
    }
  };

  /* ───────────────────────── Props ───────────────────────── */

  private makeHat(): THREE.Group {
    // A little explorer's hat, between the antennas.
    const P = new Parts();
    ell(P, v(0, 0.09, 0), v(0.24, 0.17, 0.25), '#e3c98f', [0, 0, 0], 20);
    P.add(new THREE.CylinderGeometry(0.255, 0.255, 0.05, 24), '#8a5a2b', THREE_TF(v(0, 0.05, 0)));
    P.add(new THREE.CylinderGeometry(0.34, 0.36, 0.025, 28), '#d8bb7c', THREE_TF(v(0, 0.015, 0.03), v(0.8, 1, 1.08)));
    const m = new THREE.Mesh(P.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
    m.castShadow = true;
    const g = new THREE.Group();
    g.add(m);
    g.position.y = -0.02;
    g.rotation.x = -0.12;
    return g;
  }

  private makeBrush(): THREE.Group {
    const P = new Parts();
    P.add(new THREE.CylinderGeometry(0.025, 0.03, 0.32, 8), '#e2453c', THREE_TF(v(0, -0.12, 0)));
    P.add(new THREE.CylinderGeometry(0.04, 0.035, 0.06, 8), '#c0c6d0', THREE_TF(v(0, -0.3, 0)));
    P.add(new THREE.BoxGeometry(0.11, 0.12, 0.05), '#f3dcb0', THREE_TF(v(0, -0.38, 0)));
    const m = new THREE.Mesh(P.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
    m.castShadow = true;
    const g = new THREE.Group();
    g.add(m);
    g.position.set(0, -0.14, 0.06);
    g.rotation.set(1.2, 0, 0);
    return g;
  }

  private makeArrow(): THREE.Group {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.55, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd166').multiplyScalar(1.2), toneMapped: false }));
    m.rotation.x = Math.PI;
    g.add(m, glow('#ffd166', 1.6, 0.55));
    return g;
  }

  private makeCookie(): THREE.Group {
    const P = new Parts();
    P.add(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 22), (p, n) => (Math.abs(n.y) > 0.5 ? col('#e0a55c') : col('#c98a45')));
    const r = this.seededRandom(99);
    for (let i = 0; i < 7; i++) {
      const a = r() * Math.PI * 2;
      const d = r() * 0.3;
      ell(P, v(Math.cos(a) * d, 0.06, Math.sin(a) * d), v(0.06, 0.04, 0.06), '#5a3418', [0, 0, 0], 8);
    }
    const m = new THREE.Mesh(P.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.rotation.x = Math.PI / 2 - 0.3;
    m.castShadow = true;
    const g = new THREE.Group();
    g.add(m, glow('#ffe7a8', 1.6, 0.4));
    return g;
  }

  private makeButterfly(): THREE.Group {
    const g = new THREE.Group();
    const wingGeo = new THREE.CircleGeometry(0.22, 10);
    const mat = new THREE.MeshLambertMaterial({ color: '#ff9ad5', side: THREE.DoubleSide, emissive: '#5a1d40' });
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(wingGeo, mat);
      w.position.x = s * 0.18;
      w.scale.set(1, 1.3, 1);
      w.userData.side = s;
      g.add(w);
    }
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.22, 3, 6), new THREE.MeshLambertMaterial({ color: '#4a3a5a' }));
    body.rotation.x = Math.PI / 2;
    g.add(body);
    return g;
  }

  /* ───────────────────────── Thumbnails & environment ───────────────────────── */

  private setupEnvironment() {
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const apply = (root: THREE.Object3D, k: number) =>
      root.traverse((o) => {
        const mats = (o as THREE.Mesh).material;
        for (const m of Array.isArray(mats) ? mats : mats ? [mats] : [])
          if (m instanceof THREE.MeshStandardMaterial) {
            m.envMap = this.envTex;
            m.envMapIntensity = k;
          }
      });
    apply(this.ziggy, 0.45);
    for (const d of this.dinos.values()) apply(d.root, 0.12);
  }

  /** Pictures of the bones and dinosaurs for the HUD buttons, rendered once. */
  private renderThumbs() {
    const R = 288;
    const OUT = 160;
    const rt = new THREE.WebGLRenderTarget(R, R);
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#c9b28a', 1.6));
    const key = new THREE.DirectionalLight('#fff4e0', 2.2);
    key.position.set(3, 5, 6);
    scene.add(key);
    const cam = new THREE.PerspectiveCamera(28, 1, 0.05, 200);
    const buf = new Uint8Array(R * R * 4);
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = R;
    const out = document.createElement('canvas');
    out.width = out.height = OUT;
    const tctx = tmp.getContext('2d');
    const octx = out.getContext('2d');
    if (!tctx || !octx) return;
    const img = tctx.createImageData(R, R);
    const prevColor = new THREE.Color();
    this.renderer.getClearColor(prevColor);
    const prevAlpha = this.renderer.getClearAlpha();
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    /** `half` set: a flat profile picture where 1 unit is the same size in every picture (to compare sizes). */
    const shoot = (obj: THREE.Object3D, center: V3, radius: number, yaw = 0.35, pitch = 0.18, half = 0): string => {
      scene.add(obj);
      let c: THREE.Camera = cam;
      if (half > 0) {
        ortho.left = ortho.bottom = -half;
        ortho.right = ortho.top = half;
        ortho.position.copy(center).add(v(0, 0, 20));
        ortho.lookAt(center);
        ortho.updateProjectionMatrix();
        c = ortho;
      } else {
        const dir = v(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
        const dist = radius / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) * 1.02;
        cam.position.copy(center).addScaledVector(dir, dist);
        cam.lookAt(center);
        cam.near = Math.max(0.05, dist - radius * 2);
        cam.far = dist + radius * 2;
        cam.updateProjectionMatrix();
      }
      this.renderer.setRenderTarget(rt);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.clear();
      this.renderer.render(scene, c);
      this.renderer.readRenderTargetPixels(rt, 0, 0, R, R, buf);
      this.renderer.setRenderTarget(null);
      scene.remove(obj);
      for (let y = 0; y < R; y++) img.data.set(buf.subarray((R - 1 - y) * R * 4, (R - y) * R * 4), y * R * 4);
      tctx.putImageData(img, 0, 0);
      octx.clearRect(0, 0, OUT, OUT);
      octx.imageSmoothingQuality = 'high';
      octx.drawImage(tmp, 0, 0, R, R, 0, 0, OUT, OUT);
      return out.toDataURL('image/png');
    };
    try {
      const boneMat = new THREE.MeshLambertMaterial({ vertexColors: true });
      for (const r of this.plan.rounds) {
        const d = this.dinos.get(r.dino)!;
        // "Biggest / smallest": the pieces of the question, all at one scale, fitted to the biggest one.
        const compared = (r.digQuestion?.choices ?? []).flatMap((c) => (c.kind === 'piece' ? [c.piece] : []));
        const maxSide = Math.max(1e-3, ...d.pieces.filter((p) => compared.includes(p.id)).map((p) => Math.max(p.w, p.h)));
        for (const p of d.pieces) {
          const m = new THREE.Mesh(p.geometry, boneMat);
          const rad = p.geometry.boundingSphere!.radius;
          this.thumbs.piece.set(`${d.id}-${p.id}`, shoot(m, v(), rad * 0.92, 0.3, 0.12));
          if (compared.includes(p.id)) this.thumbs.scaled.set(`${d.id}-${p.id}`, shoot(m, v(), rad, 0, 0, maxSide * 0.56));
        }
      }
      boneMat.dispose();
      for (const d of this.dinos.values()) {
        d.flesh.visible = true;
        d.rig.awake = 1;
        d.rig.update(0);
        d.root.position.set(0, 0, 0);
        d.root.scale.setScalar(1);
        d.root.updateMatrixWorld(true);
        const c = d.box.getCenter(v());
        const rad = d.box.getSize(v()).length() / 2;
        this.thumbs.dino.set(d.id, shoot(d.root, c, rad * 0.8, 0.45, 0.15));
        d.flesh.visible = false;
      }
    } catch {
      /* Thumbnails are a bonus: the HUD falls back to words and emoji. */
    } finally {
      this.renderer.setRenderTarget(null);
      this.renderer.setClearColor(prevColor, prevAlpha);
      rt.dispose();
      scene.clear();
    }
  }

  /* ───────────────────────── Loop ───────────────────────── */

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const raw = this.clock.getDelta();
    const dt = Math.min(0.05, raw);
    this.time += dt;
    this.step3d(dt, this.time);
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

  private step3d(dt: number, t: number) {
    // Scheduled steps.
    if (this.tasks.length) {
      const due = this.tasks.filter((k) => k.at <= t);
      if (due.length) {
        this.tasks = this.tasks.filter((k) => k.at > t);
        for (const k of due) k.fn();
      }
    }
    const motion = this.reduceMotion ? 0.4 : 1;

    // Digging.
    if (this.phase === 'dig') {
      this.stepAutoBrush(dt);
      this.checkFound();
      this.idleDig += dt;
      // A little sparkle where a bone hides, when the child waits.
      if (this.idleDig > 7) {
        this.idleDig = 4.5;
        const b = this.bones.find((x) => !x.found);
        if (b) {
          const s = b.samples[Math.floor(b.samples.length / 2)];
          this.sparkles.emit(v(s.x, this.sand.heightAt(s.x, s.z) + 0.15, s.z), { color: '#fff3b0', count: 8, spread: 0.6, up: 1.2, life: 0.9, size: 0.35, additive: true });
        }
      }
    }
    this.sand.update();
    this.rubbing = Math.max(0, this.rubbing - dt);

    // Flights of bones.
    for (const b of this.bones) {
      if (b.flight) {
        const f = b.flight;
        f.t = Math.min(1, f.t + dt / f.dur);
        const e = ease(f.t);
        b.mesh.position.lerpVectors(f.from.p, f.to.p, e);
        b.mesh.position.y += Math.sin(f.t * Math.PI) * f.arc;
        b.mesh.quaternion.slerpQuaternions(f.from.q, f.to.q, e);
        b.mesh.scale.lerpVectors(f.from.s, f.to.s, e);
        if (f.t >= 1) {
          b.flight = null;
          f.done?.();
        }
      }
      if (b.wiggle > 0) {
        b.wiggle = Math.max(0, b.wiggle - dt * 1.4);
        const k = b.wiggle;
        b.mesh.rotateZ(Math.sin(t * 28) * 0.05 * k * motion);
        b.mesh.position.y += Math.sin(t * 20) * 0.01 * k;
      }
      if (b.glowT > 0) {
        b.glowT = Math.max(0, b.glowT - dt);
        b.mat.emissive.setRGB(0.55, 0.45, 0.2).multiplyScalar(Math.min(1, b.glowT));
      }
    }
    for (const m of [...this.presetMeshes, ...this.bones.map((b) => b.mesh)]) {
      const g = (m.userData as { glow?: number }).glow;
      if (g) {
        const ng = Math.max(0, g - dt);
        m.userData.glow = ng;
        (m.material as THREE.MeshLambertMaterial).emissive.setRGB(0.6, 0.5, 0.25).multiplyScalar(Math.min(1, ng) * (0.6 + Math.sin(t * 12) * 0.4));
      }
    }
    for (let i = this.objFlights.length - 1; i >= 0; i--) {
      const f = this.objFlights[i];
      f.t = Math.min(1, f.t + dt / f.dur);
      f.o.position.lerpVectors(f.from, f.to, ease(f.t));
      f.o.position.y += Math.sin(f.t * Math.PI) * f.arc;
      if (f.t >= 1) {
        this.objFlights.splice(i, 1);
        f.done?.();
      }
    }

    // The current spot: ghost pulse and arrow.
    if (this.phase === 'build' || this.phase === 'turn') {
      const piece = this.roundPlan.placements[this.step]?.piece;
      const g = piece ? this.ghosts.get(piece) : undefined;
      if (g) {
        (g.material as THREE.MeshBasicMaterial).opacity = 0.42 + Math.sin(t * 4) * 0.16 * motion;
        const top = g.getWorldPosition(v());
        const pm = this.dino.pieces.find((p) => p.id === piece)!;
        this.arrow.position.copy(top).add(v(0, (pm.h / 2) * this.dino.root.scale.x + 0.75 + Math.abs(Math.sin(t * 3)) * 0.3 * motion, 0.2));
        this.arrow.visible = this.phase === 'build';
      }
    }

    // Living dinosaurs.
    if (this.flesh) {
      const f = this.flesh;
      f.t += dt / 0.9;
      const k = Math.min(1, f.t);
      f.d.flesh.scale.setScalar(0.35 + 0.65 * (this.reduceMotion ? ease(k) : elastic(k)));
      if (f.t >= 1) this.flesh = null;
    }
    if (this.roarT >= 0) {
      this.roarT += dt;
      const r = this.roarT;
      if (r < 0.05 && r - dt < 0) this.audio.roar();
      this.dino.rig.roar = r < 0.3 ? r / 0.3 : r < 1.0 ? 1 : Math.max(0, 1 - (r - 1.0) / 0.35);
      if (r > 1.4) {
        this.roarT = -1;
        this.dino.rig.roar = 0;
      }
    }
    if (this.sniffT >= 0) {
      this.sniffT += dt;
      this.dino.rig.sniff = Math.min(1, this.sniffT / 0.9) * (0.8 + Math.sin(this.sniffT * 9) * 0.2);
    }
    if (this.reachT >= 0) {
      this.reachT += dt;
      this.dino.rig.reach = Math.min(1, this.reachT / 0.4);
      this.cookie.userData.pop = Math.min(1, (this.cookie.userData.pop ?? 0) + dt * 2.5);
      this.cookie.scale.setScalar(Math.max(0.01, elastic(this.cookie.userData.pop)));
    }
    if (this.cookie.visible) this.cookie.rotation.y = Math.sin(t * 2) * 0.4;
    if (this.butterfly.visible)
      for (const w of this.butterfly.children) if (w.userData.side) w.rotation.y = (w.userData.side as number) * Math.abs(Math.sin(t * 18)) * 1.1;
    if (this.plateShow) {
      const ps = this.plateShow;
      const plates = this.dino.rig.parts.plates;
      ps.t += dt;
      const order = plates.map((_, i) => i).sort((a, b) => plates[a].position.x - plates[b].position.x);
      while (ps.i < order.length && ps.t > ps.i * 0.3) {
        const m = plates[order[ps.i]];
        (m.material as THREE.MeshStandardMaterial).emissive.setHSL(ps.i / order.length, 0.9, 0.45);
        this.audio.note(Math.floor(ps.i / 2) + (ps.i % 2) * 2);
        this.sparkles.emit(m.getWorldPosition(v()).add(v(0, 0.5, 0.3)), { color: '#ffffff', count: 4, spread: 0.6, up: 1.4, life: 0.6, size: 0.3, additive: true });
        if (ps.i % 2 === 0) this.ziggy.userData.rig.cue('jump');
        ps.i++;
      }
      for (const [i, oi] of order.entries()) {
        const m = plates[oi];
        const lit = ps.i > i;
        m.scale.y = lit ? 1 + Math.max(0, Math.sin((t - i * 0.3) * 10)) * 0.08 : 1;
      }
    }
    if (this.dinoTurn) {
      const tw = this.dinoTurn;
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      tw.d.root.rotation.y = tw.from + (tw.to - tw.from) * ease(tw.t);
      tw.d.rig.walk = tw.t < 1 ? 0.5 : 0;
      if (tw.t >= 1) this.dinoTurn = null;
    }
    if (this.dinoWalk) {
      const w = this.dinoWalk;
      w.t = Math.min(1, w.t + dt / w.dur);
      w.d.rig.walk = w.t < 1 ? 1 : 0;
      w.d.root.position.lerpVectors(w.from, w.to, ease(w.t));
      const k = Math.min(1, w.t * 3);
      w.d.root.rotation.y = w.faceFrom + (w.faceTo - w.faceFrom) * k;
      if (w.t >= 1) {
        this.dinoWalk = null;
        w.then?.();
      }
    }
    for (const d of this.dinos.values()) {
      d.rig.energy = this.reduceMotion ? 0.35 : 1;
      if (d.flesh.visible) d.rig.update(dt);
    }

    // Ziggy: walking, flying (the sneeze), brushing.
    const z = this.ziggy;
    const rig = z.userData.rig;
    if (this.ziggyMove) {
      const m = this.ziggyMove;
      const d = m.to.clone().sub(z.position).setY(0);
      const dist = d.length();
      if (dist < 0.05) {
        rig.walk = 0;
        if (m.face !== null) z.rotation.y = m.face;
        this.ziggyMove = null;
        m.then?.();
      } else {
        rig.walk = 1;
        z.position.addScaledVector(d.normalize(), Math.min(dist, m.speed * dt));
        const yaw = Math.atan2(d.x, d.z);
        let dy = yaw - z.rotation.y;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        z.rotation.y += dy * Math.min(1, dt * 10);
      }
    }
    if (this.ziggyFly) {
      const f = this.ziggyFly;
      f.t = Math.min(1, f.t + dt / f.dur);
      z.position.lerpVectors(f.from, f.to, f.t);
      z.position.y = Math.sin(f.t * Math.PI) * 3.6;
      z.rotation.x = -f.t * Math.PI * 2 * (this.reduceMotion ? 0 : 1);
      if (f.t >= 1) {
        this.ziggyFly = null;
        z.rotation.x = 0;
        z.position.y = 0;
        this.puffs.emit(z.position.clone().add(v(0, 0.1, 0)), { color: '#f3dcae', count: 6, spread: 1.4, up: 0.6, life: 0.8, size: 0.8 });
      }
    }
    rig.update(dt);
    const brushing = this.phase === 'dig' && (this.rubbing > 0 || this.autoBrush);
    if (brushing) {
      const arm = z.userData.model.arms[1];
      arm.shoulder.rotation.x -= 0.9 + Math.sin(t * 16) * 0.35 * motion;
      arm.shoulder.rotation.z += Math.sin(t * 16 + 1) * 0.15 * motion;
      z.userData.model.body.rotation.x += 0.18;
    }
    if (this.phase === 'dig') rig.lookAt(0, -0.8);

    // Particles and the world.
    this.grains.update(dt);
    this.puffs.update(dt);
    this.sparkles.update(dt);
    this.hearts.update(dt);
    this.world.update(dt, t);

    // Camera: glides to its goal, with a soft breathing sway.
    const k = 1 - Math.exp(-dt * (this.reduceMotion ? 6 : 2.2));
    this.camPos.lerp(this.goal.pos, k);
    this.camTarget.lerp(this.goal.target, k);
    this.camera.position.copy(this.camPos);
    if (!this.reduceMotion) this.camera.position.add(v(Math.sin(t * 0.21) * 0.08, Math.sin(t * 0.17) * 0.05, 0));
    this.camera.lookAt(this.camTarget);
    if (this.viewName === 'dino' || this.viewName === 'build') this.computeGoalSoon(dt);

    // The sun's shadows follow the action.
    const sun = this.world.sun;
    sun.target.position.copy(this.camTarget);
    sun.position.copy(this.camTarget).add(v(14, 22, 12));
  }

  private reframeT = 0;
  /** Views that follow moving things (Ziggy walking next to the dinosaur) are recomputed now and then. */
  private computeGoalSoon(dt: number) {
    this.reframeT += dt;
    if (this.reframeT > 0.5) {
      this.reframeT = 0;
      this.computeGoal();
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resize.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
    this.canvas.removeEventListener('pointerleave', this.onUp);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.tasks = [];
    this.audio.dispose();
    for (const b of this.bones) b.mat.dispose();
    for (const d of this.dinos.values()) {
      d.root.parent?.remove(d.root);
      d.dispose();
    }
    this.ziggy.parent?.remove(this.ziggy);
    this.ziggy.userData.model.dispose();
    this.world.dispose();
    this.sand.dispose();
    this.grains.dispose();
    disposeDeep(this.scene, new Set([glowTex(), heartTex()]));
    this.envTex?.dispose();
    this.pmrem?.dispose();
    this.renderer.dispose();
  }
}

/** A matrix helper for props (position, optional scale). */
function THREE_TF(p: V3, s?: V3): THREE.Matrix4 {
  return new THREE.Matrix4().compose(p, new THREE.Quaternion(), s ?? v(1, 1, 1));
}

