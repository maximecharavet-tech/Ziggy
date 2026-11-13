import * as THREE from 'three';
import { CameraRig } from '../engine/camera';
import type { BaseGameCommands, BaseGameEvents, SayRequest } from '../engine/events';
import type { CommandOf, GameDefinition, GameHost, HostScene } from '../engine/host';
import type { HotspotDef } from '../engine/input/hotspots';
import type { InputEvent } from '../engine/input/actions';
import { ease } from '../engine/tween';
import { disposeTree } from '../kit/look';
import type { ZiggyAccessory } from '../ziggy/types';
import { Cast, type ElfCtl } from './actors';
import type { ElfPose } from '../lutins/types';
import { Confetti, GlowRing, bobMarks, clueMarks, disposeMarks, ghostOf } from './fx';
import {
  ELF_IDS,
  GAME_TITLE,
  PRANK_TYPES,
  ROOMS,
  UI,
  applyChanges,
  elfName,
  loadLayout,
  reduce,
  reduceSandbox,
  resumeRoom,
  revertChanges,
  roomById,
  sandboxLayout,
  startRoom,
  startSandbox,
  wordById,
  type Band,
  type ChaosAction,
  type ChaosEvent,
  type Clue,
  type ElfId,
  type FixCheck,
  type L,
  type Line,
  type PrankPhase,
  type Puzzle,
  type RoomDef,
  type RoomResult,
  type RoomSession,
  type RoomSnapshot,
  type RoomState,
  type SandboxAction,
  type SandboxEvent,
  type SandboxLayout,
  type SandboxState,
} from './logic';
import { buildRoom, type RoomSet } from './rooms/build';
import { THEMES } from './rooms/layouts';
import { Shape, disposeKit, kitMats } from './rooms/kit';
import { buildGag } from './rooms/furniture';
import { disposePropGeometries } from './rooms/props';
import { PropView, arrange, isLeftItem, type PropPose } from './rooms/propview';
import { buildHouse, type HouseSet } from './rooms/house';
import { ChaosAudio, type ChaosSfx } from './sfx';

/**
 * Lutin Chaos runtime (« Le Grand Chahut des Lutins »): the house map and
 * the rooms in three.js, on top of the shared engine (GameHost, scenes,
 * hotspots, camera rig, tweens, audio).
 *
 * The rules live in `./logic` only: every tap becomes a `ChaosAction` for
 * `reduce()` (or a `SandboxAction` for `reduceSandbox()`), and this file
 * just plays the returned events — props hopping, clues appearing, elves
 * peeking and tumbling out laughing, rooms healing, the chain reaction and
 * its rewind — and tells the React player what to show and say.
 */

// ---------------------------------------------------------------------------
// Contract with the React player

export type ChaosView = 'house' | 'room' | 'sandbox' | 'photo';
export type Who = 'ziggy' | ElfId;

export interface PrankHud {
  id: string;
  phase: PrankPhase;
  /** Known culprit (after naming / peeking), else null. */
  culprit: ElfId | null;
  peeking: boolean;
  clues: Clue[];
  eliminated: { elf: ElfId; reason: L | null }[];
  spot: L;
  icon: string;
  fromTonight: boolean;
}

export interface FinaleHud {
  name: L;
  steps: { id: string; label: L }[];
  undone: string[];
  phase: 'watch' | 'predict' | 'rewind' | 'done';
  predictAt: number | null;
  options: string[];
  glow: string | null;
}

export interface SandboxHud {
  phase: SandboxState['phase'];
  elves: Partial<Record<ElfId, string>>;
  spots: { id: string; label: L }[];
  pranks: { id: string; label: L; icon: string }[];
  /** Room prank id → the sandbox prank id it became. */
  added: { id: string; sid: string }[];
  found: ElfId[];
  selected: ElfId | null;
  ziggyAt: string | null;
}

export interface ChaosHud {
  view: ChaosView;
  roomId: string | null;
  title: L;
  band: Band;
  phase: RoomSession['phase'] | null;
  pranks: PrankHud[];
  active: string | null;
  puzzle: { prank: string; elf: ElfId; puzzle: Puzzle; tries: number; hint: Extract<FixCheck, { solved: false }> | null } | null;
  finale: FinaleHud | null;
  team: ElfId[];
  busy: boolean;
  sandbox: SandboxHud | null;
  photo: { poses: Record<Who, number> } | null;
  done: boolean;
  /** House map: which rooms are open / finished. */
  house: { open: string[]; done: string[] } | null;
}

export type ChaosEvents = BaseGameEvents<ChaosHud> & {
  /** A room of the house map was chosen in 3D. */
  pick: { roomId: string };
  /** Save after every prank (stopping anytime loses nothing). */
  progress: RoomSnapshot;
  /** The room is done: results for World Memory + the album photo. */
  roomDone: { result: RoomResult; seed: number; photo: string | null };
  /** Sandbox creation to keep on the device. */
  layout: SandboxLayout;
  /** Photo mode: a picture for the album. */
  snapshot: { roomId: string; photo: string };
  /** Who is talking (mirrors the HUD bubble). */
  sfx: { name: ChaosSfx };
};

export interface OpenRoom {
  roomId: string;
  band: Band;
  seed: number;
  night: string | null;
  resume: RoomSnapshot | null;
  costume: ZiggyAccessory;
}

export type ChaosCommands = BaseGameCommands & {
  house: { open: string[]; done: string[]; costume: ZiggyAccessory };
  open: OpenRoom;
  act: { action: ChaosAction };
  sandbox: { roomId: string; seed: number; layout: SandboxLayout | null; costume: ZiggyAccessory };
  sandboxAct: { action: SandboxAction };
  sandboxPick: { elf: ElfId | null };
  photoMode: { roomId: string; costume: ZiggyAccessory };
  photoPose: { who: Who };
  snap: void;
  talking: { who: string | null; seconds: number };
  /** Pixels of the canvas covered by the HUD (top bar, bottom panel): the room stays in the free part. */
  insets: { top: number; bottom: number };
};

type Host = GameHost<ChaosEvents, ChaosCommands>;
type Cmd = CommandOf<ChaosCommands>;

/** Visible runtime texts (FR + EN, spoken by the player). */
export const RT = {
  firstThisOne: { fr: 'Oh, encore une farce ! Mais d’abord, trouvons qui a fait celle-ci.', en: 'Ooh, another prank! But first, let’s find who did this one.' },
  emptySpot: { fr: 'la place vide', en: 'the empty spot' },
  tickle: { fr: 'Chatouiller', en: 'Tickle' },
  snapDone: { fr: 'Clic ! Une jolie photo pour l’album.', en: 'Click! A lovely photo for the album.' },
  sandboxPlaced: { fr: 'Bonne cachette !', en: 'Great hiding place!' },
  hidingPlace: { fr: 'Cachette', en: 'Hiding place' },
  room: { fr: 'Pièce', en: 'Room' },
} satisfies Record<string, L>;

const ROOM_ORDER = ROOMS.map((r) => r.id);
const SFX_OF: Record<ElfId, ChaosSfx> = { pepin: 'jingle', grelotte: 'hum', noisette: 'squeak' };
const POSES: Record<Who, string[]> = {
  ziggy: ['wave', 'cheer', 'jump', 'giggle', 'love', 'dance'],
  pepin: ['wave', 'laugh', 'point', 'tiptoe', 'sit', 'peek'],
  grelotte: ['laugh', 'wave', 'tiptoe', 'point', 'sit', 'peek'],
  noisette: ['sit', 'laugh', 'wave', 'peek', 'tiptoe', 'point'],
};

// ---------------------------------------------------------------------------
// The game object shared by the scenes (cast, audio, last HUD)

class ChaosRuntime {
  cast: Cast | null = null;
  costume: ZiggyAccessory = 'none';
  houseState: { open: string[]; done: string[] } = { open: [], done: [] };

  constructor(readonly host: Host) {}

  getCast(): Cast {
    if (!this.cast) {
      this.cast = new Cast(this.host.lowPower);
      this.cast.setEnergy(this.host.reducedMotion ? 0.4 : 1);
    }
    return this.cast;
  }

  sfx(name: ChaosSfx) {
    this.host.audio?.sfx(name);
  }

  say(line: Line, kind?: string) {
    const req: SayRequest = { id: line.id, lines: [line.text], who: line.who, kind: kind ?? line.moment };
    this.host.emit('say', req);
  }

  sayText(text: L, who: Who = 'ziggy', kind = 'text') {
    this.host.emit('say', { id: `chaos.text.${kind}`, lines: [text], who, kind });
  }

  dispose() {
    this.cast?.dispose(disposeTree);
    this.cast = null;
    disposePropGeometries();
    disposeKit();
  }
}

function capture(host: Host, scene: THREE.Scene, camera: THREE.Camera): string | null {
  try {
    host.renderer.render(scene, camera);
    const src = host.renderer.domElement;
    const w = 360;
    const h = Math.round((w * src.height) / Math.max(1, src.width));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d')!.drawImage(src, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.72);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// House map

class HouseScene implements HostScene<ChaosEvents, ChaosCommands> {
  readonly id = 'chaos.house';
  view: { scene: THREE.Scene; camera: THREE.PerspectiveCamera };
  private rig = new CameraRig({ c: [0, 5.2, 0], r: 24, pitch: 0.12, yaw: 0 });
  private set: HouseSet | null = null;
  private host!: Host;
  private t = 0;

  constructor(private rt: ChaosRuntime) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1c2350');
    scene.fog = new THREE.Fog('#1c2350', 40, 80);
    this.view = { scene, camera: new THREE.PerspectiveCamera(40, 1, 0.1, 200) };
    this.rig.fov = 40;
  }

  load(host: Host) {
    this.host = host;
    this.set = buildHouse(ROOMS, this.rt.houseState, { lowPower: host.lowPower });
    this.view.scene.add(this.set.root);
    const z = this.rt.getCast().ziggy(this.rt.costume);
    z.root.position.copy(this.set.ziggy);
    z.root.rotation.y = 0.25;
    z.lookToward(this.set.ziggy.x + 2, 14);
    this.view.scene.add(z.root);
    this.rig.reducedMotion = host.reducedMotion;
    this.frameHouse(host.size.w, host.size.h);
  }

  /** The house sits in the upper part of the screen, above the room cards. */
  private frameHouse(w: number, h: number) {
    const aspect = w / Math.max(1, h);
    const portrait = aspect < 0.9;
    this.rig.aspect = portrait ? Math.max(aspect, 0.83) : aspect;
    this.rig.addView('house', portrait ? { c: [0, -5.6, 0], r: 26, pitch: 0.1, yaw: 0 } : { c: [0, 1.8, 0], r: 27, pitch: 0.1, yaw: 0 });
    if (this.host) this.rig.goTo('house');
  }

  enter(host: Host) {
    host.renderer.toneMappingExposure = host.lowPower ? 1.25 : 1.15;
    this.frameHouse(host.size.w, host.size.h);
    this.rig.goTo('house', { cut: true });
    this.hotspots();
    this.rt.getCast().ziggy(this.rt.costume).cue('wave');
    host.emit('hud', this.hud());
  }

  resume() {
    this.hotspots();
  }

  resize(w: number, h: number) {
    this.frameHouse(w, h);
  }

  private hud(): ChaosHud {
    return { view: 'house', roomId: null, title: GAME_TITLE, band: 'little', phase: null, pranks: [], active: null, puzzle: null, finale: null, team: [], busy: false, sandbox: null, photo: null, done: false, house: this.rt.houseState };
  }

  private hotspots() {
    if (!this.set) return;
    const defs: HotspotDef[] = [];
    for (const [id, box] of this.set.boxes) {
      if (!this.rt.houseState.open.includes(id)) continue;
      const room = roomById(id)!;
      defs.push({ id: `room:${id}`, label: room.title, at: box.center, size: box.size, order: room.number, attrs: { 'data-testid': `house-${id}` } });
    }
    this.host.input.hotspots.set(defs);
  }

  command(c: Cmd) {
    if (c.type === 'house') {
      this.rt.houseState = { open: c.open, done: c.done };
      this.set?.refresh(this.rt.houseState);
      this.hotspots();
      this.host.emit('hud', this.hud());
    }
  }

  input(e: InputEvent) {
    const a = e.action;
    if (a.type === 'select' && a.target?.startsWith('room:')) {
      this.rt.sfx('pick');
      this.host.emit('pick', { roomId: a.target.slice(5) });
    }
    if (a.type === 'focus' && a.target !== undefined) {
      const box = a.target?.startsWith('room:') ? this.set?.boxes.get(a.target.slice(5)) : undefined;
      this.rig.follow(box ? [box.center.x, box.center.y, box.center.z] : null, 0.25);
      this.host.emit('focus', { id: a.target ?? null });
    }
    if (a.type === 'pan') this.rig.pan(-a.dx * 0.02);
  }

  update(dt: number) {
    this.t += dt;
    this.rig.update(dt);
    this.rig.applyTo(this.view.camera);
    this.set?.update(dt, this.t, this.host.reducedMotion);
    this.rt.getCast().ziggy(this.rt.costume).update(dt);
  }

  dispose() {
    this.rt.cast?.detachFrom(this.view.scene);
  }
}

// ---------------------------------------------------------------------------
// A room (play / sandbox / photo)

type Mode = 'play' | 'sandbox' | 'photo';

interface PlayOpts {
  mode: Mode;
  room: RoomDef;
  band: Band;
  seed: number;
  night: string | null;
  resume: RoomSnapshot | null;
  layout: SandboxLayout | null;
}

class RoomScene implements HostScene<ChaosEvents, ChaosCommands> {
  readonly id: string;
  view: { scene: THREE.Scene; camera: THREE.PerspectiveCamera };
  private host!: Host;
  private rig = new CameraRig({ c: [0, 1.5, 0.3], r: 13.5, pitch: 0.36, yaw: 0 });
  private set!: RoomSet;
  private props = new Map<string, PropView>();
  private order: string[];
  private drawn!: RoomState;
  private session: RoomSession | null = null;
  private sandbox: SandboxState | null = null;
  private cast!: Cast;
  private confetti!: Confetti;
  private hintRing = new GlowRing('#ffd54a');
  private peekRing = new GlowRing('#ff7ab8');
  private stepRing = new GlowRing('#7dffb0');
  private marks: THREE.Group | null = null;
  private ghosts: THREE.Group | null = null;
  private eliminated = new Map<string, { elf: ElfId; reason: L | null }[]>();
  private team: ElfId[] = [];
  private active: string | null = null;
  private finaleHud: FinaleHud | null = null;
  private busyUntil = 0;
  private t = 0;
  private idle = 0;
  private hinted = false;
  private selected: ElfId | null = null;
  private autoLook = 0;
  private photoPoses: Record<Who, number> = { ziggy: 0, pepin: 0, grelotte: 0, noisette: 0 };
  private done = false;
  private lastHint: Extract<FixCheck, { solved: false }> | null = null;
  private hiddenRefPos = new Map<string, THREE.Vector3>();
  private insets = { top: 0, bottom: 0 };
  private freezeQueue: { elf: ElfCtl; pose: ElfPose; side?: 1 | -1 }[] = [];
  private lastSize = { w: 1, h: 1 };

  constructor(
    private rt: ChaosRuntime,
    private o: PlayOpts
  ) {
    this.id = `chaos.${o.mode}:${o.room.id}`;
    const scene = new THREE.Scene();
    const theme = THEMES[o.room.id];
    scene.background = new THREE.Color(theme?.outdoor ? '#16205a' : '#2b2140');
    this.view = { scene, camera: new THREE.PerspectiveCamera(40, 1, 0.1, 120) };
    this.rig.fov = 40;
    this.order = o.room.props.map((p) => p.id);
  }

  // ---- lifecycle -----------------------------------------------------------

  load(host: Host) {
    this.host = host;
    const low = host.lowPower;
    this.set = buildRoom(this.o.room, { lowPower: low, shadows: !low });
    this.view.scene.add(this.set.root);
    this.cast = this.rt.getCast();
    const z = this.cast.ziggy(this.rt.costume);
    z.root.position.copy(this.set.ziggy);
    z.root.rotation.y = 0;
    z.lookToward(this.set.ziggy.x * 0.3, 14);
    z.sleep(false);
    this.view.scene.add(z.root);
    for (const id of ELF_IDS) this.view.scene.add(this.cast.elves[id].root);
    this.confetti = new Confetti(48, low);
    this.view.scene.add(this.confetti.mesh, this.hintRing.mesh, this.stepRing.mesh, this.peekRing.mesh);

    for (const p of this.o.room.props) {
      const v = new PropView(p.id, p.kind, isLeftItem(p.slot, p.id), low, !low);
      this.props.set(p.id, v);
      this.view.scene.add(v.group);
    }
    // the tidy room (reference), used by the intro and the magnifier
    const ref = startSandbox(this.o.room, 1).state;
    const refPoses = arrange(this.set, ref, this.order);
    for (const [id, pose] of refPoses) this.hiddenRefPos.set(id, pose.pos.clone().add(new THREE.Vector3(0, this.props.get(id)!.kind.h / 2, 0)));

    if (this.o.mode === 'play') {
      this.session = this.o.resume ? resumeRoom(this.o.room, this.o.resume) : startRoom(this.o.room, this.o.band, this.o.seed, { nightPrankId: this.o.night });
      this.team = this.session.pranks.filter((p) => p.phase === 'fixed').map((p) => p.culprit);
      this.drawn = this.o.resume ? this.session.state : ref;
    } else if (this.o.mode === 'sandbox') {
      this.sandbox = this.o.layout ? loadLayout(this.o.room, this.o.layout, this.o.seed) : startSandbox(this.o.room, this.o.seed);
      this.drawn = this.sandbox.state;
    } else {
      this.drawn = ref;
    }
    this.snapProps(this.drawn);
    this.rig.reducedMotion = host.reducedMotion;
  }

  enter(host: Host) {
    // warm felt colours: a touch brighter than the kit default under ACES
    host.renderer.toneMappingExposure = host.lowPower ? 1.3 : 1.18;
    this.frameCamera(host.size.w, host.size.h);
    this.rig.goTo('room', { cut: true });
    const reduce = host.reducedMotion;
    if (this.o.mode === 'play' && this.session) {
      if (this.session.phase === 'finale') this.startFinaleView(true);
      else if (!this.o.resume) {
        // the tidy room for a beat, then a felt poof: the elves were here!
        this.busy(reduce ? 0.2 : 1.6);
        host.tween.after(reduce ? 0.05 : 0.7, () => {
          this.rt.sfx('whoosh');
          this.confetti.burst(new THREE.Vector3(0, 1.4, 0), 1.3);
          this.flyTo(this.session!.state, 'scatter');
          this.peekAll();
        });
      }
      this.rt.sayText(this.o.room.intro, 'ziggy', 'intro');
      this.cast.ziggy(this.rt.costume).cue('wave');
    } else if (this.o.mode === 'sandbox') {
      this.rt.sayText(UI.sandboxSetup, 'ziggy', 'sandbox');
      this.showSandboxElves();
    } else {
      this.photoStage();
    }
    this.refresh();
  }

  resume() {
    this.refresh();
  }

  resize(w: number, h: number) {
    this.frameCamera(w, h);
  }

  dispose() {
    this.rt.cast?.detachFrom(this.view.scene);
    if (this.marks) disposeMarks(this.marks);
    for (const v of this.props.values()) v.dispose();
    this.props.clear();
  }

  private frameCamera(w: number, h: number) {
    this.lastSize = { w, h };
    const aspect = w / Math.max(1, h);
    const portrait = aspect < 0.9;
    this.rig.aspect = portrait ? Math.max(aspect * 1.75, 0.7) : aspect;
    const base = portrait ? { c: [0, 0.4, 0.6] as [number, number, number], r: 12.6, pitch: 0.52, yaw: 0 } : { c: [0, 1.45, 0.5] as [number, number, number], r: 11.6, pitch: 0.36, yaw: 0 };
    // look lower when a panel covers the bottom: the room (and Ziggy at the front) moves up into view
    const free = Math.max(-0.1, Math.min(0.45, (this.insets.bottom - this.insets.top) / Math.max(1, h)));
    const shift = free * base.r * Math.tan((20 * Math.PI) / 180) * (portrait ? 1.1 : 1.25);
    this.rig.addView('room', { ...base, c: [base.c[0], base.c[1] - shift, base.c[2]] });
    this.rig.limits = { min: [portrait ? -3 : -1.6, -6, -1], max: [portrait ? 3 : 1.6, 3, 1.6] };
    if (this.host) this.rig.goTo('room', { keepPan: true });
  }

  // ---- HUD -------------------------------------------------------------------

  private hud(): ChaosHud {
    const s = this.session;
    const room = this.o.room;
    const pranks: PrankHud[] = (s?.pranks ?? []).map((p) => {
      const def = room.pranks.find((x) => x.id === p.id)!;
      const known = p.phase === 'found' || p.phase === 'caught' || p.phase === 'fixed' || (p.peeking && s?.band === 'little');
      return {
        id: p.id,
        phase: p.phase,
        culprit: known ? p.culprit : null,
        peeking: p.peeking,
        clues: p.phase === 'hidden' ? [] : p.clues,
        eliminated: this.eliminated.get(p.id) ?? [],
        spot: def.spot,
        icon: PRANK_TYPES[def.type]?.icon ?? '❓',
        fromTonight: p.fromTonight,
      };
    });
    const caught = s?.pranks.find((p) => p.phase === 'caught');
    const sb = this.sandbox;
    return {
      view: this.o.mode === 'play' ? 'room' : this.o.mode,
      roomId: room.id,
      title: room.title,
      band: s?.band ?? this.o.band,
      phase: s?.phase ?? null,
      pranks,
      active: this.active,
      puzzle: caught ? { prank: caught.id, elf: caught.culprit, puzzle: caught.puzzle, tries: caught.tries, hint: this.lastHint } : null,
      finale: this.finaleHud,
      team: [...this.team],
      busy: this.host.tween.now < this.busyUntil,
      sandbox: sb
        ? {
            phase: sb.phase,
            elves: { ...sb.elves },
            spots: room.hidingSpots.map((h) => ({ id: h.id, label: h.label })),
            pranks: room.pranks.filter((p) => p.type !== 'chain-reaction').map((p) => ({ id: p.id, label: p.spot, icon: PRANK_TYPES[p.type]?.icon ?? '🎈' })),
            added: room.pranks.flatMap((rp) => {
              const hit = sb.pranks.find((p) => p.type === rp.type && JSON.stringify(p.params) === JSON.stringify(rp.params));
              return hit ? [{ id: rp.id, sid: hit.id }] : [];
            }),
            found: [...sb.found],
            selected: this.selected,
            ziggyAt: sb.ziggyAt,
          }
        : null,
      photo: this.o.mode === 'photo' ? { poses: { ...this.photoPoses } } : null,
      done: this.done,
      house: null,
    };
  }

  /** HUD + hotspots after any change. */
  private refresh() {
    this.host.emit('hud', this.hud());
    this.hotspots();
  }

  private busy(seconds: number) {
    this.busyUntil = Math.max(this.busyUntil, this.host.tween.now + seconds);
    this.host.tween.after(seconds + 0.02, () => this.refresh());
  }

  private get isBusy() {
    return this.host.tween.now < this.busyUntil;
  }

  // ---- hotspots ---------------------------------------------------------------

  private propLabel(id: string): L {
    const v = this.props.get(id)!;
    const w = wordById(v.kindId);
    return w ? { fr: w.frDef, en: `the ${w.en}` } : { fr: id, en: id };
  }

  private hotspots() {
    const defs: HotspotDef[] = [];
    const room = this.o.room;
    const s = this.session;
    if (this.o.mode === 'play' && s) {
      if (s.phase === 'pranks' && !s.pranks.some((p) => p.phase === 'caught')) {
        let order = 1;
        for (const id of this.order) {
          const v = this.props.get(id)!;
          const st = this.drawn.props[id];
          if (st.hidden) {
            const at = this.hiddenRefPos.get(id);
            if (at) defs.push({ id: `prop:${id}`, label: { fr: `${RT.emptySpot.fr} (${this.propLabel(id).fr})`, en: `${RT.emptySpot.en} (${this.propLabel(id).en})` }, at, size: 0.7, order: order++, attrs: { 'data-testid': `prop-${id}` } });
            continue;
          }
          defs.push({ id: `prop:${id}`, label: this.propLabel(id), at: v.center, size: v.hotspotSize, order: order++, attrs: { 'data-testid': `prop-${id}` } });
        }
        const act = this.activePrank();
        if (act) {
          for (const h of room.hidingSpots) {
            const place = this.set.hides.get(h.id);
            if (!place) continue;
            defs.push({ id: `spot:${h.id}`, label: h.label, at: place.obj.position.clone().setY(place.h * 0.55), size: [place.w, place.h, place.w], order: 100 + defs.length, attrs: { 'data-testid': `spot-${h.id}` } });
          }
          if (act.peeking) {
            const elf = this.cast.elves[act.culprit];
            defs.push({ id: `elf:${act.id}`, label: { fr: `${RT.tickle.fr} ${elfName(act.culprit).fr}`, en: `${RT.tickle.en} ${elfName(act.culprit).en}` }, at: elf.center, size: 0.9, order: 0, attrs: { 'data-testid': `tickle-${act.culprit}`, 'data-tv-autofocus': '' } });
          }
        }
      }
      if (s.phase === 'finale' && this.finaleHud?.phase === 'rewind' && s.finale) {
        s.finale.steps.forEach((st, i) => {
          if (s.finale!.undone.includes(st.id)) return;
          const rec = s.finale!.record.steps?.find((x) => x.id === st.id);
          const pid = rec?.changes[0]?.prop;
          const v = pid ? this.props.get(pid) : undefined;
          if (v) defs.push({ id: `step:${st.id}`, label: st.label, at: v.center, size: v.hotspotSize, order: i + 1, attrs: { 'data-testid': `step-${st.id}` } });
        });
      }
    }
    if (this.o.mode === 'sandbox' && this.sandbox) {
      for (const h of room.hidingSpots) {
        const place = this.set.hides.get(h.id);
        if (!place) continue;
        defs.push({ id: `spot:${h.id}`, label: h.label, at: place.obj.position.clone().setY(place.h * 0.55), size: [place.w, place.h, place.w], order: defs.length + 1, attrs: { 'data-testid': `spot-${h.id}` } });
      }
    }
    if (this.o.mode === 'photo') {
      const z = this.cast.ziggy(this.rt.costume);
      defs.push({ id: 'pose:ziggy', label: { fr: 'Ziggy', en: 'Ziggy' }, at: z.center, size: 1.2, order: 1 });
      ELF_IDS.forEach((e, i) => defs.push({ id: `pose:${e}`, label: elfName(e), at: this.cast.elves[e].center, size: 0.9, order: i + 2 }));
    }
    this.host.input.hotspots.set(defs);
  }

  private activePrank() {
    const s = this.session;
    if (!s) return null;
    return s.pranks.find((p) => p.id === this.active && (p.phase === 'spotted' || p.phase === 'found')) ?? s.pranks.find((p) => p.phase === 'spotted' || p.phase === 'found') ?? null;
  }

  // ---- input --------------------------------------------------------------------

  input(e: InputEvent) {
    const a = e.action;
    if (a.type === 'focus' && a.target !== undefined) {
      this.focusOn(a.target ?? null);
      this.host.emit('focus', { id: a.target ?? null });
      return;
    }
    if (a.type === 'pan') {
      this.rig.pan(-a.dx * 0.012);
      return;
    }
    if (a.type === 'hint' && this.o.mode === 'play') {
      this.act({ type: 'magnifier' });
      return;
    }
    if (a.type !== 'select' || !a.target) return;
    this.idle = 0;
    const [kind, id] = splitId(a.target);
    if (this.o.mode === 'sandbox') return this.sandboxTap(kind, id);
    if (this.o.mode === 'photo') {
      if (kind === 'pose') this.cyclePose(id as Who);
      return;
    }
    if (this.isBusy) return;
    const s = this.session;
    if (!s) return;
    if (kind === 'prop') {
      const act = this.activePrank();
      const target = s.pranks.find((p) => p.hotspots.includes(id) && p.phase === 'hidden');
      if (act && target && target.id !== act.id) {
        // one elf at a time: finish this one first (no rule change: nothing is reduced)
        this.rt.sfx('normal');
        this.rt.sayText(RT.firstThisOne, 'ziggy', 'redirect');
        this.wiggleProp(id);
        return;
      }
      this.wiggleProp(id);
      this.act({ type: 'tap-prop', prop: id });
    } else if (kind === 'spot') {
      const act = this.activePrank();
      if (act) this.act({ type: 'tap-spot', prank: act.id, spot: id });
    } else if (kind === 'elf') this.act({ type: 'tickle', prank: id });
    else if (kind === 'step') this.act({ type: 'finale-tap', step: id });
  }

  command(c: Cmd) {
    switch (c.type) {
      case 'act':
        if (this.o.mode === 'play') this.act(c.action);
        break;
      case 'sandboxAct':
        if (this.o.mode === 'sandbox') this.sandboxAct(c.action);
        break;
      case 'sandboxPick':
        this.selected = c.elf;
        this.refresh();
        break;
      case 'photoPose':
        this.cyclePose(c.who);
        break;
      case 'snap':
        this.snap();
        break;
      case 'talking':
        this.talking(c.who, c.seconds);
        break;
      case 'insets':
        if (Math.abs(c.bottom - this.insets.bottom) > 12 || Math.abs(c.top - this.insets.top) > 12) {
          this.insets = { top: c.top, bottom: c.bottom };
          this.frameCamera(this.lastSize.w, this.lastSize.h);
        }
        break;
      case 'hint':
        if (this.o.mode === 'play') this.act({ type: 'magnifier' });
        break;
    }
  }

  private talking(who: string | null, seconds: number) {
    const z = this.cast.ziggy(this.rt.costume);
    for (const id of ELF_IDS) if (who !== id) this.cast.elves[id].silence();
    if (who !== 'ziggy') z.silence();
    if (!who) return;
    if (who === 'ziggy') z.talk(seconds);
    else if ((ELF_IDS as readonly string[]).includes(who)) this.cast.elves[who as ElfId].talk(seconds);
  }

  // ---- the reducer -----------------------------------------------------------------

  private act(action: ChaosAction) {
    if (!this.session) return;
    const before = this.session;
    const { session, events } = reduce(before, action, this.o.room);
    this.session = session;
    if (action.type === 'tap-prop') {
      const sp = events.find((x): x is Extract<ChaosEvent, { type: 'spotted' }> => x.type === 'spotted');
      if (sp) this.active = sp.prank;
    }
    this.play(events, before);
    const changedFixed = session.pranks.filter((p) => p.phase === 'fixed').length !== before.pranks.filter((p) => p.phase === 'fixed').length;
    if (changedFixed || action.type === 'tap-prop') this.host.emit('progress', snapshotOf(session, this.o.night));
    this.refresh();
  }

  /** Play the reducer's events: the only place where the room changes on screen. */
  private play(events: ChaosEvent[], before: RoomSession) {
    const tw = this.host.tween;
    const reduce = this.host.reducedMotion;
    const z = this.cast.ziggy(this.rt.costume);
    let delay = 0;
    for (const ev of events) {
      switch (ev.type) {
        case 'say':
          this.rt.say(ev.line);
          if (ev.line.who === 'ziggy' && ev.line.cue) {
            const cue = ev.line.cue;
            tw.after(delay, () => z.cue(cue));
          } else if (ev.line.who !== 'ziggy') this.elfFace(ev.line.who as ElfId, ev.line.face);
          break;
        case 'text':
          this.rt.sayText(ev.text, 'ziggy', 'text');
          break;
        case 'spotted': {
          this.rt.sfx('spot');
          for (const pid of ev.props) this.wiggleProp(pid, 1.4);
          this.hintRing.hide();
          const p = this.props.get(ev.props[0]);
          if (p) this.focusPoint(p.center, 0.35);
          delay += 0.5;
          break;
        }
        case 'clues': {
          const run = this.session!.pranks.find((x) => x.id === ev.prank)!;
          const pid = run.hotspots[0];
          const at = this.drawn.props[pid]?.hidden ? (this.hiddenRefPos.get(pid) ?? new THREE.Vector3()) : this.props.get(pid)!.center.clone();
          const hide = this.set.hides.get(run.hideSpot);
          if (this.marks) {
            this.view.scene.remove(this.marks);
            disposeMarks(this.marks);
          }
          this.marks = clueMarks(ev.clues, at, hide?.at ?? new THREE.Vector3(), this.host.lowPower);
          this.view.scene.add(this.marks);
          const sound = ev.clues.find((c) => c.kind === 'sound');
          if (sound) tw.after(delay + 0.4, () => this.rt.sfx(sound.fits.length === 1 ? SFX_OF[sound.fits[0]] : 'hint'));
          break;
        }
        case 'eliminate': {
          const list = this.eliminated.get(ev.prank) ?? [];
          list.push({ elf: ev.elf, reason: ev.reason });
          this.eliminated.set(ev.prank, list);
          // the named elf pops up laughing "not me!" for a second
          const elf = this.cast.elves[ev.elf];
          if (elf.mode === 'away') {
            const at = this.set.stage.clone().add(new THREE.Vector3(-1.2, 0, 0));
            elf.show(at, 'stage');
            elf.lookToward(at.x * 0.3, 14);
            this.posed(elf, 'laugh');
            tw.after(1.8, () => {
              if (elf.mode === 'stage') elf.popAway(tw, reduce);
            });
          }
          break;
        }
        case 'peek': {
          const hide = this.set.hides.get(ev.spot);
          const elf = this.cast.elves[ev.elf];
          if (hide) {
            tw.after(delay, () => {
              // the clues did their job: clear the marks (and their draw calls) when the elf shows up
              if (this.marks) {
                this.view.scene.remove(this.marks);
                disposeMarks(this.marks);
                this.marks = null;
              }
              elf.peek(tw, hide.peek, reduce);
              this.peekRing.show(hide.peek, elf.id === 'noisette' ? 1.2 : 1.6);
              this.focusPoint(hide.peek, 0.3);
              this.wiggleHide(ev.spot, 0.8);
              this.rt.sfx(SFX_OF[ev.elf]);
              this.refresh();
            });
          }
          delay += 0.4;
          break;
        }
        case 'miss': {
          this.rt.sfx('cuckoo');
          this.gagAt(ev.spot, events.find((x): x is Extract<ChaosEvent, { type: 'say' }> => x.type === 'say' && x.line.moment === 'miss')?.line.gag ?? 'cuckoo');
          this.wiggleHide(ev.wiggle.spot, ev.wiggle.strength);
          z.cue('think');
          break;
        }
        case 'caught': {
          this.peekRing.hide();
          const elf = this.cast.elves[ev.elf];
          const run = before.pranks.find((x) => x.id === ev.prank)!;
          const hide = this.set.hides.get(run.hideSpot);
          if (elf.mode === 'away' && hide) elf.show(hide.peek, 'peek');
          this.busy(reduce ? 0.3 : 1.5);
          this.rt.sfx('giggle');
          tw.after(0.25, () => this.rt.sfx(SFX_OF[ev.elf]));
          if (hide) this.wiggleHide(hide.id, 1);
          elf.tumbleTo(tw, this.set.stage, ev.anim, reduce, () => {
            this.confetti.burst(elf.root.position.clone().setY(0.8), 0.8);
            this.rt.sfx('boing');
          });
          z.cue('jump');
          z.lookToward(this.set.stage.x, this.set.stage.z + 2);
          if (this.marks) {
            this.view.scene.remove(this.marks);
            disposeMarks(this.marks);
            this.marks = null;
          }
          this.focusPoint(this.set.stage, 0.3);
          break;
        }
        case 'puzzle':
          this.lastHint = null;
          break;
        case 'hint': {
          this.lastHint = ev.check;
          this.rt.sfx('hint');
          const run = this.session!.pranks.find((x) => x.id === ev.prank);
          if (run) {
            const elf = this.cast.elves[run.culprit];
            elf.pose('point');
            tw.after(1.6, () => elf.mode === 'stage' && elf.pose('laugh'));
          }
          this.rt.sayText(ev.check.hint, 'ziggy', 'hint');
          z.cue('nod');
          break;
        }
        case 'healed': {
          this.lastHint = null;
          this.rt.sfx('heal');
          const run = before.pranks.find((x) => x.id === ev.prank)!;
          const elf = this.cast.elves[run.culprit];
          elf.hop(tw, reduce);
          this.busy(reduce ? 0.3 : 1.3);
          const props = [...new Set(ev.changes.map((c) => c.prop))];
          tw.after(0.15, () => {
            this.flyTo(this.session!.phase === 'finale' ? this.beforeChain() : this.session!.state, 'heal');
            for (const pid of props) {
              const v = this.props.get(pid);
              if (v) tw.after(0.75, () => this.confetti.burst(v.center.clone(), 0.5));
            }
          });
          z.cue('cheer');
          elf.popAway(tw, reduce, () => {
            if (!this.team.includes(run.culprit)) this.team.push(run.culprit);
            this.refresh();
          });
          this.rig.goTo('room', { keepPan: true });
          break;
        }
        case 'magnifier':
          this.showGhosts(ev.props);
          this.rt.sfx('hint');
          break;
        case 'room-fixed':
          this.rt.sfx('tada');
          tw.after(0.6, () => z.cue('dance'));
          break;
        case 'finale-start':
          tw.after(1.4, () => this.startFinaleView(false));
          this.busy(1.4);
          break;
        case 'finale-predicted':
          if (this.finaleHud) this.finaleHud = { ...this.finaleHud, phase: 'watch' };
          if (ev.correct) z.cue('cheer');
          tw.after(0.4, () => this.playChain(this.session!.finale!.predictAt ?? 0, this.session!.finale!.steps.length, () => this.rewindPhase()));
          break;
        case 'finale-glow': {
          const pid = this.session!.finale!.record.steps?.find((x) => x.id === ev.step)?.changes[0]?.prop;
          const v = pid ? this.props.get(pid) : undefined;
          if (v) this.stepRing.show(v.group.position, 1.4, 2.5);
          if (this.finaleHud) this.finaleHud = { ...this.finaleHud, glow: ev.step };
          this.rt.sfx('hint');
          break;
        }
        case 'finale-undone': {
          this.stepRing.hide();
          const rec = this.session!.finale!.record.steps?.find((x) => x.id === ev.step);
          if (this.finaleHud) this.finaleHud = { ...this.finaleHud, undone: [...this.finaleHud.undone, ev.step], glow: null };
          this.rt.sfx('rewind');
          this.busy(reduce ? 0.2 : 0.8);
          if (rec) this.flyTo(this.session!.state, 'rewind');
          break;
        }
        case 'photo':
          break;
        case 'room-done': {
          const result = ev.result;
          this.photoPose();
          tw.after(reduce ? 0.45 : 0.9, () => {
            this.rt.sfx('flash');
            for (const q of this.freezeQueue.splice(0)) {
              q.elf.root.visible = true;
              q.elf.snapPose(q.pose, q.side);
              this.freezeNow(q.elf);
            }
            const photo = capture(this.host, this.view.scene, this.view.camera);
            this.host.emit('roomDone', { result, seed: this.session!.seed, photo });
            tw.after(1.6, () => this.napEnding());
          });
          break;
        }
      }
    }
    if (this.session?.phase === 'photo' && this.finaleHud && this.finaleHud.phase !== 'done') {
      this.finaleHud = { ...this.finaleHud, phase: 'done' };
      tw.after(0.9, () => {
        this.gather();
        z.cue('cheer');
      });
    }
  }

  // ---- props on screen ------------------------------------------------------------

  private snapProps(state: RoomState) {
    const poses = arrange(this.set, state, this.order);
    for (const [id, pose] of poses) this.props.get(id)?.apply(pose);
    this.drawn = state;
  }

  /** Animate every prop to where `state` puts it. */
  private flyTo(state: RoomState, style: 'scatter' | 'heal' | 'chain' | 'rewind', stagger = 0.05) {
    const reduce = this.host.reducedMotion;
    const poses = arrange(this.set, state, this.order);
    let i = 0;
    for (const [id, pose] of poses) {
      const v = this.props.get(id);
      if (!v) continue;
      const cur = this.drawn.props[id];
      const nxt = state.props[id];
      const moved = v.group.position.distanceToSquared(pose.pos) > 1e-4;
      const changed = moved || cur.rot !== nxt.rot || cur.hidden !== nxt.hidden || cur.color !== nxt.color || cur.count !== nxt.count;
      if (!changed) continue;
      if (reduce) {
        v.apply(pose);
        continue;
      }
      this.animateProp(v, pose, cur.color !== nxt.color, style, (i++ % 8) * stagger);
    }
    this.drawn = state;
  }

  private animateProp(v: PropView, pose: PropPose, recolour: boolean, style: 'scatter' | 'heal' | 'chain' | 'rewind', delay: number) {
    const tw = this.host.tween;
    const from = v.group.position.clone();
    const fromRot = v.spin.rotation.z;
    const toRot = (pose.rot * Math.PI) / 2;
    const fromYaw = v.group.rotation.y;
    const lift = style === 'rewind' ? 0.35 : style === 'chain' ? 0.6 : 0.9 + from.distanceTo(pose.pos) * 0.08;
    const dur = style === 'rewind' ? 0.45 : style === 'chain' ? 0.75 : 0.7;
    const showing = !pose.hidden;
    if (showing) {
      v.group.visible = true;
    }
    tw.killTweensOf(v.group.position);
    tw.run(
      (k) => {
        v.group.position.lerpVectors(from, pose.pos, k);
        v.group.position.y += Math.sin(Math.PI * k) * lift;
        v.spin.rotation.z = fromRot + (toRot - fromRot) * k + (style === 'scatter' || style === 'chain' ? Math.sin(Math.PI * k) * 0.6 : 0);
        v.group.rotation.y = fromYaw + (pose.yaw - fromYaw) * k;
        const sy = pose.hidden ? 1 - k * 0.99 : v.group.scale.y < 0.5 ? 0.01 + k * 0.99 : 1;
        v.group.scale.y = sy;
        if (recolour && k > 0.5 && v.color !== pose.color) v.setColor(pose.color);
        v.updateCenter();
      },
      {
        duration: dur,
        delay,
        ease: style === 'rewind' ? ease.inOut : ease.outCubic,
        kind: 'other',
        onDone: () => {
          v.apply(pose);
          if (style === 'chain') this.rt.sfx('thud');
        },
      },
      v.group.position
    );
    if (pose.count !== v.count) tw.after(delay + dur * 0.5, () => v.setCount(pose.count));
  }

  /** A little hop of a tapped prop (feedback on every tap). */
  private wiggleProp(id: string, strength = 1) {
    const v = this.props.get(id);
    if (!v || this.host.reducedMotion || !v.group.visible) return;
    const base = v.spin.rotation.z;
    this.host.tween.run((k) => (v.spin.rotation.z = base + Math.sin(k * Math.PI * 4) * 0.18 * strength * (1 - k)), { duration: 0.5, kind: 'other' });
  }

  private wiggleHide(id: string, strength: number) {
    const h = this.set.hides.get(id);
    if (!h || this.host.reducedMotion) return;
    const base = h.obj.rotation.z;
    this.host.tween.run((k) => (h.obj.rotation.z = base + Math.sin(k * Math.PI * 6) * 0.08 * strength * (1 - k)), { duration: 0.9, kind: 'other' });
  }

  /** A funny miss: a cuckoo, a yawning plush cat, a sock puppet or a twirling lampshade pops out. */
  private gagAt(spotId: string, gag: string) {
    const h = this.set.hides.get(spotId);
    if (!h) return;
    const g = this.gags.get(gag) ?? this.makeGag(gag);
    g.visible = true;
    g.position.copy(h.obj.position).setY(h.h * 0.85);
    g.scale.setScalar(0.01);
    const reduce = this.host.reducedMotion;
    this.host.tween.run((k) => g.scale.setScalar(Math.max(0.01, ease.hop(k) * 1.6)), { duration: reduce ? 1.2 : 1.4, kind: 'other', onDone: () => (g.visible = false) });
    if (!reduce) this.host.tween.run((k) => (g.rotation.y = Math.sin(k * Math.PI * 3) * 0.5), { duration: 1.4, kind: 'other' });
  }

  private gags = new Map<string, THREE.Mesh>();
  private makeGag(gag: string): THREE.Mesh {
    const m = new THREE.Mesh(gagGeometry(gag), kitMats(this.host.lowPower).felt('plain'));
    m.visible = false;
    this.view.scene.add(m);
    this.gags.set(gag, m);
    return m;
  }

  private showGhosts(propIds: string[]) {
    if (this.ghosts) {
      this.view.scene.remove(this.ghosts);
      this.ghosts = null;
    }
    const ref = startSandbox(this.o.room, 1).state;
    const poses = arrange(this.set, ref, this.order);
    const g = new THREE.Group();
    const mat = kitMats(this.host.lowPower).ghost;
    for (const id of propIds) {
      const v = this.props.get(id);
      const pose = poses.get(id);
      if (!v || !pose) continue;
      const holder = new THREE.Group();
      holder.position.copy(pose.pos);
      holder.rotation.y = pose.yaw;
      if (v.mirrored) holder.scale.x = -1;
      const gm = ghostOf(v.mesh.geometry, mat);
      holder.add(gm);
      g.add(holder);
      this.wiggleProp(id, 1.2);
    }
    this.ghosts = g;
    this.view.scene.add(g);
    mat.opacity = 0.55;
    this.host.tween.after(3.5, () => {
      if (this.ghosts === g) {
        this.view.scene.remove(g);
        this.ghosts = null;
      }
    });
  }

  // ---- elves -------------------------------------------------------------------

  private elfFace(elf: ElfId, face: string) {
    const e = this.cast.elves[elf];
    if (e.mode === 'stage' || e.mode === 'peek') e.pose(face === 'laugh' ? 'laugh' : face === 'wink' ? 'wave' : e.mode === 'peek' ? 'peek' : 'laugh');
  }

  /** Little ones: at the start every culprit giggles from its hiding place for a second. */
  private peekAll() {
    const s = this.session;
    if (!s) return;
    for (const p of s.pranks) {
      if (p.phase !== 'found' || !p.peeking) continue;
      const hide = this.set.hides.get(p.hideSpot);
      if (hide) this.cast.elves[p.culprit].peek(this.host.tween, hide.peek, this.host.reducedMotion);
    }
  }

  // ---- finale ------------------------------------------------------------------

  /** The tidy room just before the chain reaction (the last heal lands there). */
  private beforeChain(): RoomState {
    const s = this.session!;
    return s.finale ? revertChanges(s.state, s.finale.record.changes) : s.state;
  }

  private startFinaleView(resumed: boolean) {
    const s = this.session!;
    const f = s.finale!;
    this.finaleHud = { name: this.o.room.finale.name, steps: f.steps, undone: [...f.undone], phase: 'watch', predictAt: f.predictAt, options: f.predictOptions, glow: null };
    const z = this.cast.ziggy(this.rt.costume);
    if (resumed) {
      this.snapProps(s.state);
      this.finaleHud = { ...this.finaleHud, phase: f.phase === 'predict' ? 'predict' : 'rewind' };
      this.refresh();
      return;
    }
    this.rt.sayText(UI.finaleWatch, 'ziggy', 'finale');
    z.cue('think');
    // a starter elf "accidentally" bumps the first step
    const starter = this.cast.elves[ELF_IDS[s.seed % 3]];
    const firstProp = f.record.steps?.[0]?.changes[0]?.prop;
    const fv = firstProp ? this.props.get(firstProp) : undefined;
    if (fv) {
      const at = fv.group.position.clone();
      at.y = 0;
      at.z = Math.min(2.6, at.z + 0.9);
      starter.show(at, 'stage');
      starter.pose('tiptoe');
      starter.lookToward(fv.group.position.x, fv.group.position.z);
      this.host.tween.after(0.7, () => {
        starter.pose('point');
        this.rt.sfx('pop');
      });
      this.host.tween.after(2.0, () => starter.popAway(this.host.tween, this.host.reducedMotion));
    }
    const until = f.predictAt ?? f.steps.length;
    this.host.tween.after(1.0, () =>
      this.playChain(0, until, () => {
        if (f.predictAt !== null && s.finale?.phase === 'predict') {
          this.finaleHud = { ...this.finaleHud!, phase: 'predict' };
          this.rt.sayText(UI.finalePredict, 'ziggy', 'predict');
          this.refresh();
        } else this.rewindPhase();
      })
    );
    this.refresh();
  }

  /** Play chain steps [from, to) one after the other, from the drawn state. */
  private playChain(from: number, to: number, done: () => void) {
    const f = this.session!.finale!;
    const steps = f.record.steps ?? [];
    const gap = this.host.reducedMotion ? 0.5 : 0.95;
    this.busy((to - from) * gap + 0.4);
    let st = this.drawn;
    for (let i = from; i < to; i++) {
      st = applyChanges(st, steps[i].changes);
      const next = st;
      this.host.tween.after((i - from) * gap, () => {
        this.flyTo(next, 'chain', 0.08);
        this.rt.sfx(i % 2 ? 'boing' : 'whoosh');
        const pid = steps[i].changes[0]?.prop;
        const v = pid ? this.props.get(pid) : undefined;
        if (v) this.focusPoint(v.group.position, 0.25);
      });
    }
    this.host.tween.after((to - from) * gap + 0.3, done);
  }

  private rewindPhase() {
    if (!this.finaleHud) return;
    this.finaleHud = { ...this.finaleHud, phase: 'rewind' };
    this.rt.sayText(UI.finaleRewind, 'ziggy', 'rewind');
    this.rig.goTo('room');
    this.refresh();
  }

  /** Low power: still elves on stage become billboards (group moments stay ≤ budget). */
  private freezeNow(elf?: ElfCtl) {
    if (!this.host.lowPower) return;
    this.view.camera.updateMatrixWorld();
    if (elf) elf.freeze(this.host.renderer, this.view.camera.position);
    else this.cast.freezeStage(this.host.renderer, this.view.camera.position);
  }

  /** Put an elf in a pose: live with a hop on capable devices, a still billboard on the low path. */
  private posed(elf: ElfCtl, pose: ElfPose, side?: 1 | -1) {
    if (this.host.lowPower) {
      // one capture per frame (a capture costs an elf's draw calls once): the elves pop in one by one
      elf.root.visible = false;
      this.freezeQueue = this.freezeQueue.filter((q) => q.elf !== elf);
      this.freezeQueue.push({ elf, pose, side });
    } else {
      elf.pose(pose, side);
      elf.hop(this.host.tween, this.host.reducedMotion);
    }
  }

  /** Everybody comes for the photo. */
  private gather() {
    const base = this.set.stage.clone();
    const side = base.x >= this.set.ziggy.x ? 1 : -1;
    ELF_IDS.forEach((id, i) => {
      const e = this.cast.elves[id];
      const at = base.clone().add(new THREE.Vector3(side * (-0.35 + i * 0.85), 0, id === 'noisette' ? 0.25 : -0.1));
      e.show(at, 'stage');
      e.lookToward(at.x * 0.3, 14);
      e.actor.position.y = 0;
      this.posed(e, id === 'noisette' ? 'tiptoe' : 'wave', i === 0 ? -1 : 1);
    });
    this.team = [...ELF_IDS];
    this.refresh();
  }

  private photoPose() {
    const z = this.cast.ziggy(this.rt.costume);
    z.cue('cheer');
    this.rig.goTo({ c: [this.set.stage.x - 0.3, 1.0, this.set.stage.z - 0.5], r: 7.5, pitch: 0.18, yaw: 0 });
    ELF_IDS.forEach((id) => this.posed(this.cast.elves[id], id === 'pepin' ? 'laugh' : id === 'grelotte' ? 'wave' : 'tiptoe'));
  }

  /** The natural stopping point: the elves curl up for a nap, the lights soften. */
  private napEnding() {
    this.done = true;
    const z = this.cast.ziggy(this.rt.costume);
    z.sleep(true);
    ELF_IDS.forEach((id) => this.posed(this.cast.elves[id], 'sit'));
    const hemi = this.set.hemi;
    const key = this.set.key;
    const h0 = hemi.intensity;
    const k0 = key.intensity;
    this.host.tween.run(
      (k) => {
        hemi.intensity = h0 * (1 - 0.35 * k);
        key.intensity = k0 * (1 - 0.5 * k);
      },
      { duration: 2, kind: 'fade' }
    );
    this.rt.sayText(UI.nap, 'ziggy', 'nap');
    this.rig.goTo('room');
    this.refresh();
  }

  // ---- sandbox ------------------------------------------------------------------

  private sandboxTap(kind: string, id: string) {
    const sb = this.sandbox;
    if (!sb || kind !== 'spot') return;
    if (sb.phase === 'setup') {
      const elf = this.selected ?? ELF_IDS.find((e) => !sb.elves[e]) ?? 'pepin';
      this.sandboxAct({ type: 'place-elf', elf, spot: id });
    } else if (sb.phase === 'seeking') this.sandboxAct({ type: 'point', spot: id });
  }

  private sandboxAct(action: SandboxAction) {
    if (!this.sandbox) return;
    const { state, events } = reduceSandbox(this.sandbox, action, this.o.room);
    const before = this.sandbox;
    this.sandbox = state;
    this.playSandbox(events, before, action);
    if (action.type === 'go' && state.phase === 'seeking') {
      this.host.emit('layout', sandboxLayout(state));
      this.autoLook = 3.5;
    }
    if (action.type === 'again') this.showSandboxElves();
    this.refresh();
  }

  private playSandbox(events: SandboxEvent[], before: SandboxState, action: SandboxAction) {
    const tw = this.host.tween;
    const reduce = this.host.reducedMotion;
    const z = this.cast.ziggy(this.rt.costume);
    let walkDone = 0;
    for (const ev of events) {
      switch (ev.type) {
        case 'say': {
          const line = ev.line;
          tw.after(walkDone, () => {
            this.rt.say(line);
            if (line.who === 'ziggy' && line.cue) z.cue(line.cue);
          });
          break;
        }
        case 'placed': {
          this.rt.sfx(SFX_OF[ev.elf]);
          this.rt.sayText(RT.sandboxPlaced, 'ziggy', 'placed');
          this.showSandboxElves();
          this.selected = ELF_IDS.find((e) => !this.sandbox!.elves[e]) ?? null;
          break;
        }
        case 'prank':
          if (ev.ok) {
            this.rt.sfx('whoosh');
            this.flyTo(this.sandbox!.state, 'scatter');
          }
          break;
        case 'ziggy-moves': {
          const h = this.set.hides.get(ev.spot);
          if (!h) break;
          const to = h.obj.position.clone();
          to.z = Math.min(2.8, to.z + h.w * 0.6 + 0.4);
          to.y = 0;
          const dist = z.root.position.distanceTo(to);
          walkDone = reduce ? 0.1 : Math.min(2.2, 0.35 + dist * 0.38) + 0.2;
          z.walkTo(tw, to, reduce, () => {
            z.lookToward(h.obj.position.x, h.obj.position.z);
            this.wiggleHide(ev.spot, 0.8);
          });
          break;
        }
        case 'found': {
          const elf = this.cast.elves[ev.elf];
          const h = this.set.hides.get(ev.spot);
          tw.after(walkDone, () => {
            if (h) elf.show(h.peek, 'peek');
            this.rt.sfx('giggle');
            const target = this.set.stage.clone().add(new THREE.Vector3(-1.2 + ELF_IDS.indexOf(ev.elf) * 0.9, 0, 0));
            elf.tumbleTo(tw, target, null, reduce, () => {
              this.confetti.burst(target.clone().setY(0.8), 0.7);
              elf.lookToward(target.x * 0.3, 14);
              this.posed(elf, 'laugh');
            });
            z.cue('jump');
          });
          break;
        }
        case 'all-found':
          tw.after(walkDone + 1.2, () => {
            this.rt.sfx('tada');
            z.cue('dance');
            this.refresh();
          });

          break;
      }
    }
    if (action.type === 'go') for (const e of ELF_IDS) this.cast.elves[e].hide();
    void before;
    if (walkDone) this.busy(walkDone);
  }

  /** Setup: show each placed elf peeking from its spot (only its hat shows). */
  private showSandboxElves() {
    const sb = this.sandbox;
    if (!sb) return;
    for (const e of ELF_IDS) {
      const spot = sb.elves[e];
      const h = spot ? this.set.hides.get(spot) : undefined;
      const elf = this.cast.elves[e];
      if (h && sb.phase === 'setup') elf.peek(this.host.tween, h.peek, this.host.reducedMotion);
      else elf.hide();
    }
    const z = this.cast.ziggy(this.rt.costume);
    z.walkTo(this.host.tween, this.set.ziggy, true);
    z.lookToward(this.set.ziggy.x * 0.3, 14);
  }

  // ---- photo mode -----------------------------------------------------------------

  private photoStage() {
    this.gather();
    const z = this.cast.ziggy(this.rt.costume);
    z.cue('wave');
    this.rig.goTo({ c: [this.set.stage.x - 0.3, 1.0, this.set.stage.z - 0.6], r: 8, pitch: 0.2, yaw: 0 });
  }

  private cyclePose(who: Who) {
    this.photoPoses[who] = (this.photoPoses[who] + 1) % POSES[who].length;
    const name = POSES[who][this.photoPoses[who]];
    if (who === 'ziggy') this.cast.ziggy(this.rt.costume).cue(name as 'wave');
    else {
      const e = this.cast.elves[who];
      this.posed(e, name as ElfPose);
    }
    this.rt.sfx(who === 'ziggy' ? 'boing' : SFX_OF[who]);
    this.refresh();
  }

  private snap() {
    this.rt.sfx('flash');
    const photo = capture(this.host, this.view.scene, this.view.camera);
    if (photo) this.host.emit('snapshot', { roomId: this.o.room.id, photo });
    this.rt.sayText(RT.snapDone, 'ziggy', 'snap');
  }

  // ---- camera & frame ---------------------------------------------------------------

  private focusOn(target: string | null) {
    if (!target) {
      this.rig.follow(null);
      return;
    }
    const [kind, id] = splitId(target);
    const p = kind === 'prop' || kind === 'step' ? this.props.get(id)?.center : kind === 'spot' ? this.set.hides.get(id)?.obj.position : null;
    if (p) this.focusPoint(p, 0.3);
  }

  private focusPoint(p: THREE.Vector3, strength: number) {
    this.rig.follow([p.x, p.y, p.z], strength);
  }

  update(dt: number) {
    this.t += dt;
    const reduce = this.host.reducedMotion;
    this.rig.update(dt);
    this.rig.applyTo(this.view.camera);
    const z = this.cast.ziggy(this.rt.costume);
    z.update(dt);
    const next = this.freezeQueue.shift();
    if (next && next.elf.mode !== 'away') {
      next.elf.root.visible = true;
      next.elf.snapPose(next.pose, next.side);
      this.freezeNow(next.elf);
    }
    for (const id of ELF_IDS) this.cast.elves[id].update(dt);
    for (const v of this.props.values()) if (v.group.visible) v.updateCenter();
    this.confetti.update(dt);
    this.hintRing.update(dt, reduce);
    this.peekRing.update(dt, reduce);
    this.stepRing.update(dt, reduce);
    bobMarks(this.marks, this.t, reduce);
    if (this.ghosts && !reduce) kitMats(this.host.lowPower).ghost.opacity = 0.4 + 0.2 * Math.sin(this.t * 6);
    // little ones: a glowing hint after 8 s without a tap (design A2)
    const s = this.session;
    if (s && s.band === 'little' && s.phase === 'pranks' && !this.activePrank() && !s.pranks.some((p) => p.phase === 'caught')) {
      this.idle += dt;
      if (this.idle > 8 && !this.hinted) {
        const p = s.pranks.find((x) => x.phase === 'hidden');
        const v = p ? this.props.get(p.hotspots[0]) : undefined;
        if (v) {
          this.hintRing.show(v.group.position, Math.max(1, v.kind.w * 2.2), 4);
          this.wiggleProp(v.id, 1.2);
          this.rt.sfx('hint');
        }
        this.hinted = true;
        this.idle = 0;
      } else if (this.idle > 6) this.hinted = false;
    }
    // sandbox: Ziggy keeps looking around on his own
    if (this.sandbox?.phase === 'seeking' && !this.isBusy) {
      this.autoLook -= dt;
      if (this.autoLook <= 0) {
        this.autoLook = 4;
        this.sandboxAct({ type: 'ziggy-look' });
      }
    }
  }
}

// ---------------------------------------------------------------------------

function splitId(target: string): [string, string] {
  const i = target.indexOf(':');
  return i < 0 ? [target, ''] : [target.slice(0, i), target.slice(i + 1)];
}

function snapshotOf(s: RoomSession, night: string | null): RoomSnapshot {
  return { roomId: s.roomId, band: s.band, seed: s.seed, night, fixed: s.pranks.filter((p) => p.phase === 'fixed').map((p) => p.id) };
}

const gagCache = new Map<string, THREE.BufferGeometry>();

function gagGeometry(gag: string): THREE.BufferGeometry {
  let g = gagCache.get(gag);
  if (!g) {
    const s = new Shape();
    buildGag(gag, s);
    g = s.build();
    g.scale(1.4, 1.4, 1.4);
    gagCache.set(gag, g);
  }
  return g;
}

// ---------------------------------------------------------------------------
// The game definition (lazy-loaded by the player)

export interface ChaosStart {
  open: string[];
  done: string[];
  costume: ZiggyAccessory;
}

export function createChaosGame(start: ChaosStart): GameDefinition<ChaosEvents, ChaosCommands> {
  return {
    id: 'lutin-chaos',
    async start(host) {
      const rt = new ChaosRuntime(host);
      rt.houseState = { open: start.open, done: start.done };
      rt.costume = start.costume;
      host.onDispose(() => {
        rt.dispose();
        gagCache.forEach((g) => g.dispose());
        gagCache.clear();
      });
      host.bus.commands.on('open', (c) => {
        const room = roomById(c.roomId);
        if (!room) return;
        rt.costume = c.costume;
        void host.replace(new RoomScene(rt, { mode: 'play', room, band: c.band, seed: c.seed, night: c.night, resume: c.resume, layout: null }));
      });
      host.bus.commands.on('sandbox', (c) => {
        const room = roomById(c.roomId);
        if (!room) return;
        rt.costume = c.costume;
        void host.replace(new RoomScene(rt, { mode: 'sandbox', room, band: 'middle', seed: c.seed, night: null, resume: null, layout: c.layout }));
      });
      host.bus.commands.on('photoMode', (c) => {
        const room = roomById(c.roomId);
        if (!room) return;
        rt.costume = c.costume;
        void host.replace(new RoomScene(rt, { mode: 'photo', room, band: 'middle', seed: 1, night: null, resume: null, layout: null }));
      });
      host.bus.commands.on('house', (c) => {
        rt.houseState = { open: c.open, done: c.done };
        rt.costume = c.costume;
        if (host.stack.top?.id !== 'chaos.house') void host.replace(new HouseScene(rt));
      });
      await host.push(new HouseScene(rt));
    },
  };
}

export { ROOM_ORDER, ChaosAudio };
