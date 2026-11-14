import * as THREE from 'three';
import type { GameDefinition, GameHost, HostScene, CommandOf } from '@/games3d/engine/host';
import type { BaseGameCommands, BaseGameEvents } from '@/games3d/engine/events';
import type { InputEvent } from '@/games3d/engine/input/actions';
import type { HotspotDef } from '@/games3d/engine/input/hotspots';
import { CameraRig, viewPosition } from '@/games3d/engine/camera';
import { DiscreteTicker } from '@/games3d/engine/loop';
import {
  TICK_SECONDS,
  cellLabel,
  decodeLayout,
  dialText,
  encodeLayout,
  getLevel,
  getMachine,
  getToy,
  getWriter,
  lookOfSpec,
  phrase,
  pickLine,
  pieceAt,
  texts,
  type Band,
  type Cell,
  type Dial,
  type Dir,
  type Item,
  type L,
  type Order,
  type Slot,
} from './logic';
import { FactoryController, hallOpen, skillFor, HALLS, type TickInfo } from './controller';
import { createFactorySave, type CatalogueEntry, type FactorySave } from './save';
import { Board, TILE_Y } from './workshop/board';
import { buildHall, type HallInfo } from './workshop/hall';
import { ItemInstancer } from './workshop/prims';
import { ItemLayer } from './workshop/items';
import { Crew } from './workshop/crew';
import { bakeCrew, type CrewAtlas, type CrewId } from './workshop/impostor';
import { Fx } from './workshop/fx';
import { MACHINE_ART } from './workshop/machines';
import { COLOR_ICON } from './logic';
import { PAINT_HEX, STICKER_ICON, PATTERN_ICON, FELT } from './workshop/palette';
import type { SaveStore } from '@/games3d/engine/save';

/**
 * Lutin Factory runtime (« L'Atelier des Lutins »): one workshop scene on
 * the shared engine. The pure controller decides; this scene draws the hall,
 * the workbench, the machines, the toys and the crew, and turns hotspot taps
 * and HUD commands into controller calls. Game → React: `hud`, `say`,
 * `result` (World Memory), `letterDone`, `share`. React → game: the commands
 * below (all from DOM buttons, so TV remote, keyboard and switch work).
 */

/* ---------- messages ---------- */

export interface OrderChip {
  /** Toy emoji (or 🎁 for "a surprise"). */
  emoji: string;
  /** Icons of the wanted look (colour fruit, sticker, paper…), colour-blind safe. */
  icons: string;
  label: L;
  made: number;
  wanted: number;
  done: boolean;
  bay?: string;
  /** Pattern letters: the sequence of looks. */
  sequence?: { emoji: string; icons: string }[];
}

export interface PieceInfo {
  at: Cell;
  cell: string;
  machine: string;
  name: L;
  does: L;
  dial: Dial;
  dialText: L;
  dir: Dir;
  locked: boolean;
  dialLocked: boolean;
}

export interface SlotInfo {
  at: Cell;
  choices: { machine: string; dial: Dial; name: L; icon: string }[];
  current: number;
}

export interface FactoryHud {
  ready: boolean;
  mode: 'idle' | 'level' | 'sandbox';
  levelId: string | null;
  band: Band;
  hall: string;
  number: number;
  title: L | null;
  newIdea: L | null;
  letters: { from: string; emoji: string; name: L; text: L }[];
  orders: OrderChip[];
  tray: string[];
  tool: string | null;
  selected: PieceInfo | null;
  slot: SlotInfo | null;
  running: boolean;
  speed: 1 | 2;
  canUndo: boolean;
  canRedo: boolean;
  hasRun: boolean;
  complete: boolean;
  hint: { text: L; kind: string; canShow: boolean } | null;
  ideas: L[];
  /** Mixer pots allowed (level 4: only the three first colours, the mixing lesson). */
  pots: string[];
  done: Record<string, Band[]>;
  hallsOpen: Record<string, boolean>;
  catalogue: CatalogueEntry[];
  shelfCount: number;
  reason: L | null;
}

export type FactoryEvents = BaseGameEvents<FactoryHud> & {
  letterDone: { levelId: string; band: Band; firstTime: boolean; reason: L; writer: string; toy: string };
  share: { code: string };
  shareResult: { ok: boolean; message: L };
};

export type FactoryCommands = BaseGameCommands & {
  openLevel: { id: string; band: Band };
  openSandbox: void;
  openMap: void;
  tool: { id: string | null };
  slot: { index: number };
  rotate: void;
  remove: void;
  dial: { dial: Dial };
  deselect: void;
  go: void;
  stop: void;
  step: void;
  speed: { x: 1 | 2 };
  reset: void;
  undo: void;
  redo: void;
  showHint: void;
  dismissHint: void;
  shareCode: void;
  loadCode: { code: string };
  insets: { top: number; bottom: number; left?: number };
  /** Tap a tile (tests, the D-pad cursor). */
  cell: { x: number; y: number };
};

type Host = GameHost<FactoryEvents, FactoryCommands>;
type Cmd = CommandOf<FactoryCommands>;

/* ---------- texts of the runtime ---------- */

const T = {
  workshop: { fr: 'L’atelier des lutins', en: 'The elves’ workshop' },
  cell: { fr: 'Case {cell}', en: 'Tile {cell}' },
  cellWith: { fr: 'Case {cell} : {machine}', en: 'Tile {cell}: {machine}' },
  cellSlot: { fr: 'Case {cell} : la case qui brille', en: 'Tile {cell}: the glowing tile' },
  ideaMax: { fr: 'Défi de Grelotte : {n} machines ou moins (pour s’amuser).', en: 'Jingle’s challenge: {n} machines or fewer (just for fun).' },
  ideaOne: { fr: 'Défi de Grelotte : tout faire en un seul « C’est parti ! ».', en: 'Jingle’s challenge: make it all with one GO.' },
  shareOk: { fr: 'Et voilà l’atelier de ton ami !', en: 'Here is your friend’s workshop!' },
  newMachine: { fr: 'Nouvelle machine : {machine} !', en: 'New machine: {machine}!' },
  surprise: { fr: 'une surprise', en: 'a surprise' },
} satisfies Record<string, L>;

const fillL = (t: L, v: Record<string, string | number>): L => texts.fillL(t, { fr: v, en: v });

/** Icons of a wanted look (HUD letter card, colour-blind safe). */
function lookIcons(o: { props?: Order['props'] }): string {
  const p = o.props ?? {};
  let s = '';
  if (p.color) s += COLOR_ICON[p.color];
  if (p.partColors) s += p.partColors.map((c) => COLOR_ICON[c]).join('');
  if (p.sticker && p.sticker !== 'none') s += STICKER_ICON[p.sticker];
  if (p.wrap && p.wrap !== 'none') s += PATTERN_ICON[p.wrap];
  if (p.n) s += `×${p.n}`;
  return s;
}

const CAMERA_PITCH = (62 * Math.PI) / 180;
const FOV = 32;
/** Smallest spacing between two tiles on screen (px): the hotspot buttons stay ≥ 64 px and never overlap. */
const MIN_TILE_PX = 70;

class WorkshopScene implements HostScene<FactoryEvents, FactoryCommands> {
  readonly id = 'factory.workshop';
  view = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(FOV, 1.6, 0.1, 120) };
  private host!: Host;
  private store!: SaveStore<FactorySave>;
  private save!: FactorySave;
  private ctrl!: FactoryController;
  private board!: Board;
  private inst!: ItemInstancer;
  private items!: ItemLayer;
  private crew!: Crew;
  private atlas!: CrewAtlas;
  private fx!: Fx;
  private hall: HallInfo | null = null;
  private hallKey = '';
  private rig = new CameraRig({ c: [0, 0, 0], r: 10, pitch: CAMERA_PITCH, yaw: 0 });
  private ticker = new DiscreteTicker(() => this.onTick(), TICK_SECONDS[1]);
  private stepAnim = 1;
  private t = 0;
  private insets = { top: 0, bottom: 0, left: 0 };
  private key!: THREE.DirectionalLight;
  private lineN = 0;
  private lastLine = 0;
  private firstGo = true;
  private ready = false;
  private canPan = false;
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(TILE_Y + 0.3));
  private hit = new THREE.Vector3();
  private hotspotAt = new Map<string, THREE.Vector3>();
  private hintCell: Cell | null = null;
  private lastSay: { id: string; lines: L[]; who: string } | null = null;
  /** Re-register the tile buttons once the camera has settled (only the tiles in the free area get one). */
  private hotspotsDirty = false;
  private probeV = new THREE.Vector3();

  async load(host: Host) {
    this.host = host;
    this.store = createFactorySave();
    this.save = this.store.load();
    this.ctrl = new FactoryController(this.save);
    this.ticker.speed = this.save.speed;
    const low = host.lowPower;
    const scene = this.view.scene;
    scene.background = new THREE.Color('#2b1a12');
    scene.add(new THREE.HemisphereLight('#fff1dc', '#7a4a2a', 1.35));
    this.key = new THREE.DirectionalLight('#fff0d8', 1.9);
    this.key.position.set(-6, 12, 8);
    if (!low) {
      this.key.castShadow = true;
      this.key.shadow.mapSize.set(2048, 2048);
      this.key.shadow.bias = -0.0005;
      this.key.shadow.normalBias = 0.02;
    }
    scene.add(this.key, this.key.target);
    const fill = new THREE.DirectionalLight('#ffe2c4', 0.45);
    fill.position.set(6, 4, 6);
    scene.add(fill);

    this.atlas = bakeCrew(host.renderer, { low });
    this.board = new Board(!low);
    this.inst = new ItemInstancer(low, !low);
    this.items = new ItemLayer(this.inst, this.board);
    this.crew = new Crew(this.atlas, CAMERA_PITCH);
    this.fx = new Fx();
    scene.add(this.board.group, this.inst.group, this.crew.group, this.fx.mesh);
    this.camUp();
    this.applyReduced();
    this.rig.aspect = 100; // framing is computed here (fitCamera), not by the rig's aspect rule
    this.rig.fov = FOV;
    this.rig.smoothTime = 0.35;
    this.openMap();
    host.onDispose(() => {
      this.store.flush();
      this.atlas.dispose();
      this.board.dispose();
      this.crew.dispose();
      this.fx.dispose();
    });
    if (typeof window !== 'undefined') window.addEventListener('pagehide', this.flush);
    host.onDispose(() => window.removeEventListener('pagehide', this.flush));
    this.ready = true;
  }

  private flush = () => this.store.flush();

  enter(host: Host) {
    host.input.setPick((ndc) => this.pick(ndc));
    this.dragOnButtons(host);
    this.registerHotspots();
    this.emitHud();
  }

  /**
   * The tile buttons cover the canvas, so a finger drag starts on a button: turn
   * such drags into camera pans too (and swallow the click that ends them), or
   * a phone could never reach the tiles out of view. (Engine note: the hotspot
   * layer could do this itself.)
   */
  private dragOnButtons(host: Host) {
    const root = host.input.hotspots.root;
    // Fingers must reach us as pointer moves, not as a browser scroll gesture.
    root.classList.add('zg-factory-hotspots');
    if (!document.getElementById('zg-factory-style')) {
      const st = document.createElement('style');
      st.id = 'zg-factory-style';
      st.textContent = '.zg-factory-hotspots .zg-hotspot{touch-action:none}';
      document.head.appendChild(st);
    }
    let down: { id: number; x: number; y: number; lx: number; ly: number; drag: boolean } | null = null;
    let swallow = false;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      down = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, drag: false };
    };
    const onMove = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id || !this.canPan) return;
      if (!down.drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 14) down.drag = true;
      if (down.drag) {
        this.input({ action: { type: 'pan', dx: e.clientX - down.lx, dy: e.clientY - down.ly }, source: 'pointer' });
        down.lx = e.clientX;
        down.ly = e.clientY;
      }
    };
    const onUp = (e: PointerEvent) => {
      if (down && e.pointerId === down.id && down.drag) swallow = true;
      down = null;
    };
    const onClick = (e: MouseEvent) => {
      if (!swallow) return;
      swallow = false;
      e.stopPropagation();
      e.preventDefault();
    };
    root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', onUp);
    root.addEventListener('click', onClick, true);
    host.onDispose(() => {
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', onUp);
      root.removeEventListener('click', onClick, true);
    });
  }

  resume() {
    this.registerHotspots();
  }

  /* ---------- camera ---------- */

  private camUp() {
    // Signs lie flat, their top toward the camera's "up" on the floor (north).
    this.board.setCameraUp(new THREE.Vector3(0, 0, -1));
  }

  private fitCamera(cut: boolean) {
    const cam = this.view.camera;
    const W = this.host.size.w;
    const H = this.host.size.h;
    const top = Math.min(this.insets.top, H * 0.45);
    const bottom = Math.min(this.insets.bottom, H * 0.45);
    const left = Math.min(this.insets.left, W * 0.6);
    cam.aspect = W / H;
    cam.setViewOffset(W, H, -left / 2, -(top - bottom) / 2, W, H);
    cam.updateProjectionMatrix();
    const l = this.ctrl.layout;
    const bw = this.ctrl.mode === 'idle' ? 5 : l.w;
    const bh = this.ctrl.mode === 'idle' ? 3 : l.h;
    // What must show: the board, the crew behind it, Ziggy at the side, a bit of the surprise shelf.
    const x0 = -bw / 2 - 0.7;
    const x1 = bw / 2 + 1.6;
    const wallZ = this.hall?.wallZ ?? -bh / 2 - 1.75;
    const z1 = bh / 2 + 0.35;
    // Front corners of the board; the shelf on the wall and the crew's heads at the back.
    const corners: [number, number, number][] = [
      [x0, 0, z1],
      [x1, 0, z1],
      [x0 + 0.4, 3.15, wallZ + 0.4],
      [x1 - 1.0, 3.15, wallZ + 0.4],
    ];
    const c: [number, number, number] = [(x0 + x1) / 2, 0, (wallZ + z1) / 2 + 0.6];
    const probe = cam.clone();
    const v = new THREE.Vector3();
    const margin = 10;
    const fits = (r: number) => {
      const p = viewPosition({ c, r, pitch: CAMERA_PITCH, yaw: 0 });
      probe.position.set(p[0], p[1], p[2]);
      probe.lookAt(c[0], c[1], c[2]);
      probe.updateMatrixWorld();
      for (const k of corners) {
        v.set(k[0], k[1], k[2]).project(probe);
        const sx = (v.x + 1) * 0.5 * W;
        const sy = (1 - v.y) * 0.5 * H;
        if (sx < left + margin || sx > W - margin || sy < top + margin || sy > H - bottom - margin) return false;
      }
      return true;
    };
    const spacing = (r: number) => {
      const p = viewPosition({ c, r, pitch: CAMERA_PITCH, yaw: 0 });
      probe.position.set(p[0], p[1], p[2]);
      probe.lookAt(c[0], c[1], c[2]);
      probe.updateMatrixWorld();
      // The far row is the smallest on screen.
      const a = new THREE.Vector3(0, TILE_Y, -bh / 2 + 0.5).project(probe);
      const b = new THREE.Vector3(1, TILE_Y, -bh / 2 + 0.5).project(probe);
      const d = new THREE.Vector3(0, TILE_Y, -bh / 2 + 1.5).project(probe);
      return Math.min(Math.abs(b.x - a.x) * 0.5 * W, Math.abs(d.y - a.y) * 0.5 * H);
    };
    let lo = 3;
    let hi = 80;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    let r = hi;
    this.canPan = false;
    if (this.ctrl.mode !== 'idle' && spacing(r) < MIN_TILE_PX) {
      // Too small for fingers: come closer and let the child pan (drag) around the board.
      let a = 2.5;
      let b = r;
      for (let i = 0; i < 30; i++) {
        const mid = (a + b) / 2;
        if (spacing(mid) >= MIN_TILE_PX) a = mid;
        else b = mid;
      }
      r = a;
      this.canPan = true;
    }
    // Panning stays around the framing centre: enough to reach every tile, never lost in the hall.
    this.rig.limits = this.canPan ? { min: [-bw / 2, 0, Math.min(c[2], -bh / 2)], max: [bw / 2, 0, bh / 2] } : null;
    // Panning: the board comes first (its centre in the middle of the free area).
    let focus: [number, number, number] = this.canPan ? [0, 0, Math.max(c[2], -0.2)] : c;
    if (this.canPan) {
      // As far north as possible (the crew in view) while the front row stays on screen.
      const frontOk = (z: number) => {
        const p = viewPosition({ c: [0, 0, z], r, pitch: CAMERA_PITCH, yaw: 0 });
        probe.position.set(p[0], p[1], p[2]);
        probe.lookAt(0, 0, z);
        probe.updateMatrixWorld();
        v.set(0, 0, bh / 2 + 0.1).project(probe);
        return (1 - v.y) * 0.5 * H <= H - bottom - margin;
      };
      let zs = Math.min(c[2], focus[2]);
      let ze = Math.max(bh / 2, focus[2]);
      if (frontOk(zs)) focus = [0, 0, zs];
      else {
        for (let i = 0; i < 24; i++) {
          const m = (zs + ze) / 2;
          if (frontOk(m)) ze = m;
          else zs = m;
        }
        focus = [0, 0, ze];
      }
    }
    const slot = this.ctrl.slots()[0];
    if (this.canPan && slot) {
      // Little ones: start with the glowing tile in view.
      const wc = this.board.cellCenter(slot.at);
      focus = [focus[0] + (wc.x - focus[0]) * 0.7, 0, focus[2]];
    }
    this.rig.goTo({ c: focus, r, pitch: CAMERA_PITCH, yaw: 0 }, { cut });
    this.rig.update(0);
    this.rig.applyTo(cam);
    this.hotspotsDirty = true;
    // Shadow camera around the board.
    const s = Math.max(bw, bh) + 4;
    Object.assign(this.key.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 40 });
    this.key.shadow.camera.updateProjectionMatrix();
  }

  resize() {
    if (this.ready) this.fitCamera(true);
  }

  /* ---------- building a workshop ---------- */

  private setHall(hall: string, w: number, h: number) {
    const k = `${hall}:${w}x${h}`;
    if (k === this.hallKey) return;
    this.hallKey = k;
    if (this.hall) {
      this.view.scene.remove(this.hall.group);
      this.hall.group.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | undefined;
        if (mat && !(mat instanceof THREE.SpriteMaterial)) mat.dispose();
        if (mat instanceof THREE.SpriteMaterial) mat.dispose();
      });
    }
    this.hall = buildHall(hall, w, h, this.host.lowPower);
    this.view.scene.add(this.hall.group);
  }

  private rebuildBoard(gridToo: boolean) {
    const l = this.ctrl.layout;
    if (gridToo) this.board.setGrid(l, this.ctrl.mode !== 'idle');
    this.board.setSlots(this.ctrl.slots().map((s) => s.at));
    this.board.setLayout(l);
    this.syncSelection();
  }

  private openMap() {
    this.stopRun(true);
    this.ctrl.close();
    this.setHall('wood-shop', 5, 3);
    this.ctrl.history = { past: [], present: { w: 5, h: 3, pieces: [] }, future: [] };
    this.rebuildBoard(true);
    this.crew.layout(5, 3, this.hall!.crewZ);
    this.items.clear();
    this.items.setShelf(this.save.shelf, this.hall!.shelf);
    this.crew.play('ziggy', ['wave1', 'wave2'], 2.4, 3);
    this.crew.play('pepin', ['wave1', 'wave2'], 2.4, 4);
    this.fitCamera(true);
    this.registerHotspots();
    this.emitHud();
  }

  private openLevel(id: string, band: Band) {
    const lv = getLevel(id);
    if (!lv) return;
    this.stopRun(true);
    this.ctrl.openLevel(lv, band);
    const l = this.ctrl.layout;
    this.setHall(lv.hall, l.w, l.h);
    this.rebuildBoard(true);
    this.crew.layout(l.w, l.h, this.hall!.crewZ);
    this.items.clear();
    this.items.setShelf(this.save.shelf, this.hall!.shelf);
    this.fitCamera(true);
    this.registerHotspots();
    this.store.saveSoon(this.save);
    // Ziggy reads the letter.
    const b = lv.bands[band];
    const arrive = pickLine('letter-arrives', this.lineN++);
    const lines: L[] = [];
    if (arrive) lines.push({ fr: arrive.fr, en: arrive.en });
    for (const letter of b.letters) lines.push(letter.text);
    this.crew.play('ziggy', ['read'], 5, 1);
    this.crew.play('pepin', ['point'], 1.5, 1);
    this.say('letter', lines, 'ziggy', 'letter', true);
    const fresh = lv.introduces.filter((m) => m !== 'belt' && m !== 'sack' && m !== 'chute');
    if (fresh.length) {
      const nm = texts.MACHINE_TEXT[fresh[0]]?.name;
      this.host.tween.after(this.host.reducedMotion ? 0.1 : 5.5, () => {
        if (this.ctrl.level?.id !== id) return;
        this.crew.play('grelotte', ['point', 'wave1', 'wave2'], 2, 3);
        if (nm) this.say('new', [texts.fillL(T.newMachine, { fr: { machine: nm.fr }, en: { machine: nm.en } }), lv.newIdea], 'grelotte', 'idea', false);
      });
    }
    this.emitHud();
  }

  private openSandbox() {
    this.stopRun(true);
    this.ctrl.openSandbox();
    const l = this.ctrl.layout;
    this.setHall('assembly-line', l.w, l.h);
    this.rebuildBoard(true);
    this.crew.layout(l.w, l.h, this.hall!.crewZ);
    this.items.clear();
    this.items.setShelf(this.save.shelf, this.hall!.shelf);
    this.fitCamera(true);
    this.registerHotspots();
    this.crew.play('grelotte', ['wave1', 'wave2'], 2, 3);
    this.emitHud();
  }

  /* ---------- hotspots and picking ---------- */

  private registerHotspots() {
    if (!this.host) return;
    const l = this.ctrl.layout;
    if (this.ctrl.mode === 'idle') {
      this.host.input.hotspots.set([]);
      return;
    }
    const defs: HotspotDef[] = [];
    const slots = this.ctrl.slots();
    for (let y = 0; y < l.h; y++)
      for (let x = 0; x < l.w; x++) {
        const id = `cell:${x},${y}`;
        let at = this.hotspotAt.get(id);
        if (!at) {
          at = new THREE.Vector3();
          this.hotspotAt.set(id, at);
        }
        this.board.cellCenter([x, y], at).y = TILE_Y + 0.3;
        if (!this.inFreeArea(at)) continue;
        const p = pieceAt(l, [x, y]);
        const cell = cellLabel([x, y]);
        const isSlot = slots.some((s) => s.at[0] === x && s.at[1] === y);
        const blocked = (l.blocked ?? []).some((b) => b[0] === x && b[1] === y);
        const name = p ? texts.MACHINE_TEXT[p.machine]?.name : null;
        const label = p && name ? texts.fillL(T.cellWith, { fr: { cell, machine: name.fr }, en: { cell, machine: name.en } }) : isSlot ? fillL(T.cellSlot, { cell }) : fillL(T.cell, { cell });
        defs.push({
          id,
          label,
          at,
          size: [0.9, 0.04, 0.9],
          order: y * l.w + x,
          disabled: blocked,
          attrs: { 'data-testid': `cell-${x}-${y}`, ...(isSlot ? { 'data-slot': '' } : {}) },
        });
      }
    this.host.input.hotspots.set(defs);
  }

  /** Is this point in the part of the screen the HUD leaves free (with the camera where it will settle)? */
  private inFreeArea(p: THREE.Vector3): boolean {
    const W = this.host.size.w;
    const H = this.host.size.h;
    const cam = this.view.camera;
    cam.updateMatrixWorld();
    const v = this.probeV.copy(p).project(cam);
    const sx = (v.x + 1) * 0.5 * W;
    const sy = (1 - v.y) * 0.5 * H;
    const m = 24;
    return sx > this.insets.left + m && sx < W - m && sy > Math.min(this.insets.top, H * 0.45) + m && sy < H - Math.min(this.insets.bottom, H * 0.45) - m;
  }

  private pick(ndc: { x: number; y: number }): string | null {
    if (this.ctrl.mode === 'idle') return null;
    this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), this.view.camera);
    if (!this.raycaster.ray.intersectPlane(this.plane, this.hit)) return null;
    const c = this.board.cellAt(this.hit.x, this.hit.z);
    return c ? `cell:${c[0]},${c[1]}` : null;
  }

  /* ---------- running ---------- */

  private stopRun(reset: boolean) {
    this.ticker.running = false;
    this.stepAnim = 1;
    if (reset) {
      this.ctrl.resetRun();
      this.items.clear();
      this.items.setStatics([]);
      this.board.clearActivity();
      this.crew.goHome();
    }
  }

  private go() {
    if (this.ctrl.mode === 'idle') return;
    if (this.ticker.running) {
      this.ticker.running = false;
      this.emitHud();
      return;
    }
    const fresh = !this.ctrl.sim || this.ctrl.sim.settled;
    if (fresh) {
      this.items.clear();
      this.items.setStatics([]);
    }
    this.ctrl.ensureRun();
    this.ticker.tickSeconds = TICK_SECONDS[1];
    this.ticker.running = true;
    this.host.audio?.sfx('pick');
    if (fresh) {
      const line = pickLine(this.firstGo ? 'go-first-of-day' : 'go', this.lineN++);
      this.firstGo = false;
      if (line) this.say('go', [{ fr: line.fr, en: line.en }], line.speaker, 'go', false);
      this.crew.play('pepin', ['point', 'laugh1', 'laugh2'], 1.4, 4);
      this.crew.play('ziggy', ['cheer1', 'cheer2'], 1.2, 4);
      this.crew.play('noisette', ['tiptoe', 'peek'], 1.2, 3);
    }
    this.emitHud();
  }

  private step() {
    if (this.ctrl.mode === 'idle') return;
    this.ticker.running = false;
    this.onTick();
    this.stepAnim = 0;
    this.emitHud();
  }

  private onTick() {
    let info: TickInfo;
    try {
      info = this.ctrl.tick();
    } catch (e) {
      console.error('[factory] tick', e);
      this.ticker.running = false;
      return;
    }
    this.items.applyTick(info);
    this.reactTo(info);
    this.syncStatics();
    if (info.settled) {
      this.ticker.running = false;
      this.finishRun();
    } else if (info.deliveries.length) this.emitHud();
  }

  private syncStatics() {
    const sim = this.ctrl.sim;
    if (!sim) return;
    const list: { at: Cell; dir: string; items: Item[]; kind: 'basket' | 'plate' | 'hand' }[] = [];
    for (const p of this.ctrl.layout.pieces) {
      if (p.machine === 'assembler') {
        const st = sim.machineState(p.at) as { basket?: Item[] } | undefined;
        if (st?.basket?.length) list.push({ at: p.at, dir: p.dir, items: st.basket, kind: 'basket' });
      } else if (p.machine === 'arm') {
        const st = sim.machineState(p.at) as { plate?: Item[]; hand?: Item | null } | undefined;
        if (st?.plate?.length) list.push({ at: p.at, dir: p.dir, items: st.plate, kind: 'plate' });
        if (st?.hand) list.push({ at: p.at, dir: p.dir, items: [st.hand], kind: 'hand' });
      }
    }
    this.items.setStatics(list);
  }

  private crewOf(machine: string): CrewId | null {
    const c = getMachine(machine)?.crew;
    return c === 'pepin' || c === 'grelotte' || c === 'noisette' ? c : null;
  }

  private reactTo(info: TickInfo) {
    let worked = 0;
    for (const e of info.events) {
      if (e.type === 'process' || e.type === 'build' || e.type === 'emit' || e.type === 'absorb' || e.type === 'work') {
        this.board.poke(e.at, 1);
        const who = this.crewOf(e.machine);
        if (who && worked < 2) {
          worked++;
          const x = this.board.cellCenter(e.at).x;
          this.crew.hopTo(who, x);
          this.crew.play(who, e.type === 'build' ? ['laugh1', 'laugh2'] : ['point', 'stand'], 0.7, 4);
        }
        if (e.machine === 'painter' || e.machine === 'mixer') {
          const p = pieceAt(this.ctrl.layout, e.at);
          const dial = (p?.dial ?? {}) as { color?: string; colors?: string[]; a?: string };
          const col = PAINT_HEX[(dial.color ?? dial.colors?.[0] ?? dial.a ?? 'red') as keyof typeof PAINT_HEX] ?? FELT.red;
          this.fx.burst(this.board.cellCenter(e.at).setY(0.7), [col, '#ffffff'], 6, 0.5);
        }
      }
      if (e.type === 'deliver') this.board.poke(e.at, 1);
    }
    for (const d of info.deliveries) {
      const at = this.board.cellCenter(d.delivery.at).setY(0.8);
      if (d.matched) {
        this.host.audio?.sfx('deliver');
        this.crew.play('ziggy', ['jump', 'cheer2'], 1.1, 4);
        this.crew.play('pepin', ['laugh1', 'laugh2'], 1.1, 5);
        this.fx.burst(at, [FELT.gold, FELT.red, FELT.mint, '#ffffff'], 18, 0.8);
        if (this.t - this.lastLine > 6) {
          const line = pickLine('right-toy', this.lineN++);
          if (line) this.say('right', [{ fr: line.fr, en: line.en }, d.name], line.speaker, 'praise', false);
        }
      } else {
        this.host.audio?.sfx('oops');
        this.crew.play('ziggy', ['think', 'giggle'], 1.4, 2);
        this.crew.play('noisette', ['laugh1', 'laugh2'], 1.4, 5);
        if (this.ctrl.mode === 'level' || this.ctrl.mode === 'sandbox') {
          const n = this.save.shelf.length;
          this.items.setShelf(this.save.shelf, this.hall?.shelf ?? []);
          this.items.fly({ ...d.delivery.item }, at, Math.min(n - 1, (this.hall?.shelf.length ?? 1) - 1));
        }
        if (this.t - this.lastLine > 6) {
          const line = pickLine('surprise-toy', this.lineN++);
          const made = d.name;
          if (line) this.say('surprise', [{ fr: line.fr, en: line.en }, made], line.speaker, 'surprise', false);
        }
      }
    }
  }

  private finishRun() {
    const end = this.ctrl.endRun();
    this.store.saveSoon(this.save);
    this.crew.goHome();
    if (!end) {
      this.emitHud();
      return;
    }
    const lv = this.ctrl.level;
    if (end.complete && lv) {
      this.host.audio?.sfx('star');
      this.crew.cheerAll();
      const sack = this.ctrl.layout.pieces.filter((p) => p.machine === 'sack');
      for (const s of sack) this.fx.burst(this.board.cellCenter(s.at).setY(1), [FELT.gold, FELT.red, FELT.mint, FELT.sky, FELT.pink, '#ffffff'], 40, 1.1);
      const line = pickLine('letter-done', this.lineN++);
      const lines: L[] = [end.result.reason];
      if (line) lines.push({ fr: line.fr, en: line.en });
      this.say('done', lines, 'ziggy', 'done', true);
      const b = lv.bands[this.ctrl.band];
      this.host.emit('result', { gameId: 'lutin-factory', skill: skillFor(lv, this.ctrl.band), stats: this.ctrl.resultStats(), durationMs: Math.max(1000, Date.now() - this.ctrl.startedAt) });
      this.host.emit('letterDone', { levelId: lv.id, band: this.ctrl.band, firstTime: end.firstTime, reason: end.result.reason, writer: b.letters[0]?.from ?? '', toy: b.orders[0]?.toy ?? b.orders[0]?.sequence?.[0]?.toy ?? 'ball' });
    } else if (lv) {
      const r = end.result;
      const lines: L[] = [r.reason];
      if (r.blame) lines.push(r.blame);
      this.say('check', lines, 'ziggy', 'check', true);
      this.crew.play('ziggy', ['think', 'giggle', 'idle'], 2.4, 2);
      this.crew.play('grelotte', ['point'], 1.6, 1);
    }
    this.emitHud();
  }

  /* ---------- editing ---------- */

  private refuse(why: string) {
    const l = texts.EDIT_REFUSAL[why];
    if (l) this.say('refuse', [l], 'grelotte', 'refusal', true);
    this.crew.play('grelotte', ['laugh1', 'laugh2'], 0.9, 4);
  }

  private afterEdit() {
    this.stopRun(true);
    this.rebuildBoard(false);
    this.registerHotspots();
    this.store.saveSoon(this.save);
    this.setHint(null);
    this.emitHud();
  }

  private tap(at: Cell) {
    if (this.ctrl.mode === 'idle') return;
    const l = this.ctrl.layout;
    const wouldEdit = this.ctrl.tool && !pieceAt(l, at) && !this.ctrl.slotAt(at);
    if (wouldEdit && (this.ticker.running || this.ctrl.sim)) this.stopRun(true);
    const r = this.ctrl.tapCell(at, false);
    if (r.kind === 'placed') {
      this.host.audio?.sfx('pick');
      const who = this.crewOf(r.machine);
      if (who) {
        this.crew.hopTo(who, this.board.cellCenter(at).x, true);
        this.crew.play(who, ['wave1', 'wave2'], 1.2, 4);
      }
      this.fx.burst(this.board.cellCenter(at).setY(0.3), [FELT.cream, FELT.gold], 8, 0.4);
      if (r.machine !== 'belt' && this.t - this.lastLine > 8) {
        const line = pickLine('machine-placed', this.lineN++);
        if (line) this.say('placed', [{ fr: line.fr, en: line.en }], line.speaker, 'placed', false);
      }
      this.afterEdit();
      return;
    }
    if (r.kind === 'refused') {
      if (r.why !== 'running') this.refuse(r.why);
      this.syncSelection();
      this.emitHud();
      return;
    }
    if (r.kind === 'selected') {
      const p = pieceAt(l, at);
      if (p) {
        const name = texts.MACHINE_TEXT[p.machine];
        const lines: L[] = name ? [name.name, dialText(p.machine, p.dial ?? {})] : [];
        if (p.locked) lines.push(texts.EDIT_REFUSAL.locked);
        if (lines.length) this.say('machine', lines.filter((x) => x.fr), 'ziggy', 'machine', false);
      }
    }
    if (r.kind === 'slot') {
      this.say('slot', [texts.HINT_TEXT.slot], 'ziggy', 'slot', false);
    }
    this.syncSelection();
    this.emitHud();
  }

  private syncSelection() {
    this.board.setSelected(this.ctrl.selected ?? this.ctrl.slotOpen?.at ?? null);
    const tool = this.ctrl.tool;
    if (tool) {
      const l = this.ctrl.layout;
      const free: Cell[] = [];
      for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) if (!pieceAt(l, [x, y]) && !(l.blocked ?? []).some((b) => b[0] === x && b[1] === y)) free.push([x, y]);
      this.board.setToolCells(free);
    } else this.board.setToolCells([]);
  }

  private setHint(c: Cell | null) {
    this.hintCell = c;
    this.board.setHint(c);
    if (c) {
      const w = this.board.cellCenter(c);
      this.rig.follow([w.x, 0, w.z], this.canPan ? 0.9 : 0.15);
    } else this.rig.follow(null);
  }

  /* ---------- engine hooks ---------- */

  fixedUpdate(step: number) {
    this.ticker.advance(step);
  }

  update(dt: number) {
    this.t += dt;
    const reduce = this.host.reducedMotion;
    if (this.board.reduced !== reduce) this.applyReduced();
    if (this.stepAnim < 1) this.stepAnim = Math.min(1, this.stepAnim + dt / (TICK_SECONDS[1] / Math.max(1, this.ticker.speed)));
    const p = this.ticker.running ? this.ticker.progress : this.stepAnim;
    this.items.update(p, this.t, dt);
    const beltSpeed = this.ticker.running ? (1 / this.ticker.tickSeconds) * this.ticker.speed : this.stepAnim < 1 ? 2 : 0;
    this.board.update(this.t, dt, beltSpeed);
    this.crew.update(dt, this.view.camera);
    this.fx.update(dt);
    if (this.hall) for (let i = 0; i < this.hall.glows.length; i++) this.hall.glows[i].material.opacity = (reduce ? 0.5 : 0.48 + Math.sin(this.t * 2.3 + i * 1.7) * 0.06) * (this.host.lowPower ? 0.8 : 1);
    this.rig.update(dt);
    this.rig.applyTo(this.view.camera);
    if (this.hotspotsDirty && this.rig.settled) {
      this.hotspotsDirty = false;
      this.registerHotspots();
    }
  }

  private applyReduced() {
    const r = this.host.reducedMotion;
    this.board.reduced = r;
    this.crew.reduced = r;
    this.items.reduced = r;
    this.fx.reduced = r;
    this.rig.reducedMotion = r;
  }

  input(e: InputEvent) {
    const a = e.action;
    switch (a.type) {
      case 'select': {
        const id = a.target;
        if (id?.startsWith('cell:')) {
          const [x, y] = id.slice(5).split(',').map(Number);
          this.tap([x, y]);
        }
        break;
      }
      case 'focus':
        if (a.target?.startsWith('cell:')) {
          const [x, y] = a.target.slice(5).split(',').map(Number);
          if (this.canPan) {
            const w = this.board.cellCenter([x, y]);
            this.rig.follow([w.x, 0, w.z], 0.85);
            this.hotspotsDirty = true;
          }
        }
        break;
      case 'pan':
        if (this.canPan) {
          const unit = Math.abs(a.dx) <= 1 && Math.abs(a.dy) <= 1;
          const wpp = (2 * this.rig.current.r * Math.tan((FOV * Math.PI) / 360)) / Math.max(1, this.host.size.h);
          if (unit) this.rig.pan(a.dx * 0.25, a.dy * 0.25);
          else this.rig.pan(-a.dx * wpp, -a.dy * wpp / Math.sin(CAMERA_PITCH));
          this.hotspotsDirty = true;
        }
        break;
      case 'rotate':
        this.command({ type: 'rotate' } as Cmd);
        break;
      case 'remove':
        this.command({ type: 'remove' } as Cmd);
        break;
      case 'undo':
        this.command({ type: 'undo' } as Cmd);
        break;
      case 'redo':
        this.command({ type: 'redo' } as Cmd);
        break;
      case 'go':
        this.go();
        break;
      case 'step':
        this.step();
        break;
      case 'hint':
        this.command({ type: 'hint' } as Cmd);
        break;
      case 'replay':
        this.command({ type: 'replay' } as Cmd);
        break;
      case 'back':
        this.command({ type: 'deselect' } as Cmd);
        break;
      case 'pick': {
        if (this.ctrl.slotOpen) this.command({ type: 'slot', index: a.index } as Cmd);
        else {
          const tray = this.ctrl.tray();
          if (tray[a.index]) this.command({ type: 'tool', id: this.ctrl.tool === tray[a.index] ? null : tray[a.index] } as Cmd);
        }
        break;
      }
    }
  }

  command(c: Cmd) {
    switch (c.type) {
      case 'openLevel':
        this.openLevel(c.id, c.band);
        break;
      case 'openSandbox':
        this.openSandbox();
        break;
      case 'openMap':
        this.openMap();
        break;
      case 'tool':
        this.ctrl.selectTool(c.id);
        this.syncSelection();
        this.emitHud();
        break;
      case 'cell':
        this.tap([c.x, c.y]);
        break;
      case 'deselect':
        this.ctrl.selectTool(null);
        this.syncSelection();
        this.emitHud();
        break;
      case 'slot': {
        this.stopRun(true);
        const r = this.ctrl.chooseSlot(c.index);
        if (r.kind === 'placed') {
          this.host.audio?.sfx('pick');
          const who = this.crewOf(r.machine);
          if (who) {
            this.crew.hopTo(who, this.board.cellCenter(r.at).x, true);
            this.crew.play(who, ['wave1', 'wave2'], 1.2, 4);
          }
          this.fx.burst(this.board.cellCenter(r.at).setY(0.4), [FELT.gold, FELT.cream, FELT.mint], 12, 0.5);
          const p = pieceAt(this.ctrl.layout, r.at);
          if (p) this.say('slotChoice', [texts.MACHINE_TEXT[p.machine].name, dialText(p.machine, p.dial ?? {})], 'ziggy', 'machine', false);
          this.afterEdit();
        } else if (r.kind === 'refused') this.refuse(r.why);
        break;
      }
      case 'rotate': {
        if (!this.ctrl.selected) break;
        const why = this.ctrl.rotateSelected();
        if (why) this.refuse(why);
        else this.afterEdit();
        break;
      }
      case 'remove': {
        if (!this.ctrl.selected) break;
        const why = this.ctrl.removeSelected();
        if (why) this.refuse(why);
        else this.afterEdit();
        break;
      }
      case 'dial': {
        const why = this.ctrl.setSelectedDial(c.dial);
        if (why) this.refuse(why);
        else {
          const p = this.ctrl.selected ? pieceAt(this.ctrl.layout, this.ctrl.selected) : undefined;
          if (p) this.say('dial', [dialText(p.machine, p.dial ?? {})], 'ziggy', 'dial', false);
          this.afterEdit();
        }
        break;
      }
      case 'go':
        this.go();
        break;
      case 'stop':
        this.ticker.running = false;
        this.emitHud();
        break;
      case 'step':
        this.step();
        break;
      case 'speed':
        this.ticker.speed = c.x;
        this.save.speed = c.x;
        this.store.saveSoon(this.save);
        this.emitHud();
        break;
      case 'reset':
        this.stopRun(true);
        this.emitHud();
        break;
      case 'undo':
        if (this.ctrl.undo()) this.afterEdit();
        break;
      case 'redo':
        if (this.ctrl.redo()) this.afterEdit();
        break;
      case 'hint': {
        const h = this.ctrl.askHint();
        if (h) {
          this.setHint(h.at ?? null);
          const offer = pickLine('hint-offer', this.lineN++);
          this.crew.play('grelotte', ['point', 'wave1'], 1.6, 3);
          this.say('hint', [h.text], offer?.speaker === 'grelotte' ? 'grelotte' : 'ziggy', 'hint', true);
        }
        this.emitHud();
        break;
      }
      case 'showHint':
        if (this.ctrl.showHint()) {
          this.afterEdit();
          this.syncSelection();
        }
        break;
      case 'dismissHint':
        this.ctrl.hint = null;
        this.setHint(null);
        this.emitHud();
        break;
      case 'replay':
        if (this.lastSay) this.host.emit('say', { id: this.lastSay.id, lines: this.lastSay.lines, who: this.lastSay.who, force: true });
        break;
      case 'shareCode':
        this.host.emit('share', { code: encodeLayout(this.ctrl.layout) });
        break;
      case 'loadCode': {
        const r = decodeLayout(c.code.trim());
        if (!r.ok) {
          this.host.emit('shareResult', { ok: false, message: texts.UI.shareBad });
          break;
        }
        if (this.ctrl.mode !== 'sandbox') this.openSandbox();
        this.stopRun(true);
        this.ctrl.loadLayout(r.layout);
        this.setHall('assembly-line', r.layout.w, r.layout.h);
        this.rebuildBoard(true);
        this.crew.layout(r.layout.w, r.layout.h, this.hall!.crewZ);
        this.items.setShelf(this.save.shelf, this.hall!.shelf);
        this.fitCamera(true);
        this.registerHotspots();
        this.store.saveSoon(this.save);
        this.host.emit('shareResult', { ok: true, message: T.shareOk });
        this.emitHud();
        break;
      }
      case 'insets':
        this.insets = { top: c.top, bottom: c.bottom, left: c.left ?? 0 };
        if (this.ready) this.fitCamera(false);
        break;
      case 'music':
        break;
    }
  }

  /* ---------- talking to React ---------- */

  private say(id: string, lines: L[], who: string, kind: string, force: boolean) {
    const clean = lines.filter((l) => l && l.fr && l.en);
    if (!clean.length) return;
    this.lastLine = this.t;
    this.lastSay = { id: `factory.${id}`, lines: clean, who };
    this.host.emit('say', { id: `factory.${id}`, lines: clean, who, kind, force });
  }

  private orderChips(): OrderChip[] {
    const b = this.ctrl.bandLevel;
    if (!b) return [];
    const prog = this.ctrl.progress();
    return b.orders.map((o, i) => {
      if (o.sequence) {
        const seq = o.sequence.map((s) => ({ emoji: s.toy === 'surprise' ? '🎁' : (getToy(s.toy)?.emoji ?? '🎁'), icons: lookIcons(s) }));
        return { emoji: seq[0]?.emoji ?? '🎁', icons: '', label: phrase(lookOfSpec(o.sequence[0]), { count: o.count }), made: prog[i]?.made ?? 0, wanted: o.count, done: prog[i]?.done ?? false, sequence: seq, ...(o.bay ? { bay: o.bay } : {}) };
      }
      const toy = o.toy ?? 'surprise';
      const label = toy === 'surprise' ? T.surprise : phrase(lookOfSpec({ toy, props: o.props }), { count: o.count, article: 'indef' });
      return { emoji: toy === 'surprise' ? '🎁' : (getToy(toy)?.emoji ?? '🎁'), icons: lookIcons(o), label, made: prog[i]?.made ?? 0, wanted: o.count, done: prog[i]?.done ?? false, ...(o.bay ? { bay: o.bay } : {}) };
    });
  }

  private pieceInfo(): PieceInfo | null {
    const at = this.ctrl.selected;
    if (!at) return null;
    const p = pieceAt(this.ctrl.layout, at);
    if (!p) return null;
    const mt = texts.MACHINE_TEXT[p.machine];
    const dial = getMachine(p.machine)?.dial.parse(p.dial ?? {}) ?? {};
    return {
      at,
      cell: cellLabel(at),
      machine: p.machine,
      name: mt?.name ?? { fr: p.machine, en: p.machine },
      does: mt?.does ?? { fr: '', en: '' },
      dial,
      dialText: dialText(p.machine, dial),
      dir: p.dir,
      locked: Boolean(p.locked),
      dialLocked: p.dialLocked ?? p.locked ?? false,
    };
  }

  private slotInfo(s: Slot | null): SlotInfo | null {
    if (!s) return null;
    return {
      at: s.at,
      current: this.ctrl.slotChoiceIndex(s),
      choices: s.choices.map((c) => {
        const dial = getMachine(c.machine)?.dial.parse(c.dial ?? {}) ?? {};
        return { machine: c.machine, dial, name: dialText(c.machine, dial), icon: MACHINE_ART[c.machine]?.sign?.(dial) ?? getMachine(c.machine)?.icon ?? '❓' };
      }),
    };
  }

  private emitHud() {
    if (!this.host) return;
    const lv = this.ctrl.level;
    const b = this.ctrl.bandLevel;
    const hallsOpen: Record<string, boolean> = {};
    for (const h of HALLS) hallsOpen[h] = hallOpen(h, this.save);
    const ideas: L[] = (b?.ideas ?? []).map((i) => (i.kind === 'max-machines' ? fillL(T.ideaMax, { n: i.value ?? 0 }) : T.ideaOne));
    const hint = this.ctrl.hint;
    const hud: FactoryHud = {
      ready: this.ready,
      mode: this.ctrl.mode,
      levelId: lv?.id ?? null,
      band: this.ctrl.band,
      hall: lv?.hall ?? (this.ctrl.mode === 'sandbox' ? 'sandbox' : 'wood-shop'),
      number: lv?.number ?? 0,
      title: lv?.title ?? null,
      newIdea: lv?.newIdea ?? null,
      letters: (b?.letters ?? []).map((l) => {
        const w = getWriter(l.from);
        return { from: l.from, emoji: w?.emoji ?? '✉️', name: w?.name ?? { fr: '', en: '' }, text: l.text };
      }),
      orders: this.orderChips(),
      tray: this.ctrl.tray(),
      tool: this.ctrl.tool,
      selected: this.pieceInfo(),
      slot: this.slotInfo(this.ctrl.slotOpen),
      running: this.ticker.running,
      speed: this.ticker.speed === 2 ? 2 : 1,
      canUndo: this.ctrl.canUndo,
      canRedo: this.ctrl.canRedo,
      hasRun: this.ctrl.hasRun,
      complete: this.ctrl.complete,
      hint: hint ? { text: hint.text, kind: hint.kind, canShow: ['slot', 'place', 'dial', 'turn', 'remove', 'stuck'].includes(hint.kind) } : null,
      ideas,
      pots: lv?.number === 4 ? ['red', 'yellow', 'blue'] : ['red', 'yellow', 'blue', 'green', 'purple', 'orange'],
      done: this.save.done,
      hallsOpen,
      catalogue: this.save.catalogue,
      shelfCount: this.save.shelf.length,
      reason: this.ctrl.lastCheck && this.ctrl.hasRun && !this.ticker.running ? this.ctrl.lastCheck.reason : null,
    };
    this.host.emit('hud', hud);
  }

  /** Test hook: draw calls / triangles of one plain render of the scene, and the state. */
  debug() {
    const r = this.host.renderer;
    const prev = r.info.autoReset;
    r.info.autoReset = false;
    r.info.reset();
    r.render(this.view.scene, this.view.camera);
    const out = { calls: r.info.render.calls, triangles: r.info.render.triangles, textures: r.info.memory.textures, geometries: r.info.memory.geometries, lowPower: this.host.lowPower, mode: this.ctrl.mode, level: this.ctrl.level?.id ?? null, band: this.ctrl.band, complete: this.ctrl.complete, running: this.ticker.running, tick: this.ctrl.sim?.tick ?? 0, instances: this.inst.total(), canPan: this.canPan };
    r.info.autoReset = prev;
    return out;
  }

  /** Test hook: run to the end at once (keeps tests short on software GL). */
  fastForward(max = 400) {
    for (let i = 0; i < max && this.ctrl.mode !== 'idle'; i++) {
      this.onTick();
      if (!this.ctrl.sim || this.ctrl.sim.settled) break;
    }
  }

  dispose() {
    this.store?.flush();
  }
}

export const factoryGame: GameDefinition<FactoryEvents, FactoryCommands> = {
  id: 'lutin-factory',
  start: (host) => host.push(new WorkshopScene()),
};
