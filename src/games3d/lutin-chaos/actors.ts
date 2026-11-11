import * as THREE from 'three';
import { attachFace, type FaceLink } from '../engine/face';
import type { Tweener } from '../engine/tween';
import { ease } from '../engine/tween';
import { makeZiggy, type ZiggyActor } from '../kit/models';
import { ElfRig, makeElf, type ElfActor } from '../lutins/elf';
import { ELF_POSES, type ElfPose } from '../lutins/types';
import { ZiggyRig } from '../ziggy/rig';
import type { ZiggyAccessory, ZiggyCue as RigCue } from '../ziggy/types';
import type { ElfId, ZiggyCue } from './logic';
import { blobTexture } from './rooms/kit';
import { findDynamic, mergeStill } from './rig-merge';

/**
 * The cast of Lutin Chaos over their code rigs: Pépin, Grelotte, Noisette
 * (`makeElf`) and Ziggy (`makeZiggy`, the felt plush). Built once per game
 * (their still meshes merged to cut draw calls), then moved from room to
 * room. Every move is happy: peek, giggle, tumble out laughing, bow, wave,
 * hop off to the fix-it team, nap. Never sad.
 */

export const ZIGGY_SCALE = 0.8;
export const ELF_SCALE = 1.05;

const UP = new THREE.Vector3(0, 1, 0);

function blob(r: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 1.6), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.012;
  m.renderOrder = -1;
  return m;
}

/** Lighten a rig: merge its still meshes (see rig-merge.ts). */
function optimizeElf(a: ElfActor) {
  const rig = a.userData.rig;
  const model = a.userData.model;
  const dyn = findDynamic(a, (f) => {
    rig.setPose(ELF_POSES[Math.floor(f / 30) % ELF_POSES.length], f % 60 < 30 ? 1 : -1);
    rig.gaze.x = Math.sin(f) * 0.5;
    rig.gaze.y = Math.cos(f) * 0.3;
    if (f % 17 === 0) rig.blink();
    model.setMouth((f % 10) / 9);
    rig.update(1 / 20);
  });
  model.setMouth(0);
  a.userData.rig = new ElfRig(model);
  mergeStill(a, dyn);
}

function optimizeZiggy(z: ZiggyActor) {
  const rig = z.userData.rig;
  const cues: RigCue[] = ['wave', 'cheer', 'jump', 'nod', 'oops', 'think', 'love', 'giggle'];
  const dyn = findDynamic(
    z,
    (f) => {
      if (f % 30 === 0) rig.cue(cues[(f / 30) % cues.length]);
      rig.talking = f % 50 < 25;
      rig.walk = f > 240 ? 1 : 0;
      rig.idle = f > 270 ? 'dance' : 'calm';
      rig.lookAt(Math.sin(f), Math.cos(f));
      rig.update(1 / 20);
    },
    320
  );
  z.userData.rig = new ZiggyRig(z.userData.model);
  mergeStill(z, dyn);
}

// ---------------------------------------------------------------------------

export type ElfMode = 'away' | 'hidden' | 'peek' | 'stage' | 'busy';

/**
 * Low-power trick for group moments (photo, nap): an elf standing still is
 * rendered once into a small texture and shown as one billboard (1 draw call
 * instead of ~45). Re-captured when its pose changes.
 */
class Impostor {
  readonly sprite: THREE.Sprite;
  private target: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  private box = new THREE.Box3();
  private size = new THREE.Vector3();
  private mid = new THREE.Vector3();

  constructor() {
    this.target = new THREE.WebGLRenderTarget(256, 320, { type: THREE.UnsignedByteType });
    this.target.texture.colorSpace = THREE.LinearSRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: this.target.texture, alphaTest: 0.5, transparent: false });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.visible = false;
    this.scene.add(new THREE.HemisphereLight('#fff4e0', '#8a6a52', 1.6));
    const key = new THREE.DirectionalLight('#ffe6c4', 1.8);
    key.position.set(-3.5, 8, 6);
    this.scene.add(key);
  }

  /** Render `actor` (detached into the impostor stage) seen from `camPos`. */
  capture(renderer: THREE.WebGLRenderer, actor: THREE.Object3D, rootYaw: number, worldPos: THREE.Vector3, camPos: THREE.Vector3) {
    const parent = actor.parent;
    const holder = new THREE.Group();
    holder.rotation.y = rootYaw;
    holder.add(actor);
    this.scene.add(holder);
    holder.updateMatrixWorld(true);
    this.box.setFromObject(actor);
    this.box.getSize(this.size);
    this.box.getCenter(this.mid);
    const half = Math.max(this.size.x, this.size.z, this.size.y * 0.8) * 0.62;
    const aspect = this.target.width / this.target.height;
    const hh = Math.max(half / aspect, this.size.y * 0.58);
    const hw = hh * aspect;
    Object.assign(this.cam, { left: -hw, right: hw, top: hh, bottom: -hh });
    this.cam.updateProjectionMatrix();
    const dir = new THREE.Vector3(camPos.x - worldPos.x, Math.max(0, camPos.y - worldPos.y) * 0.6, camPos.z - worldPos.z).normalize();
    this.cam.position.copy(this.mid).addScaledVector(dir, 8);
    this.cam.lookAt(this.mid);
    const prevTarget = renderer.getRenderTarget();
    const prevClear = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(this.scene, this.cam);
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevClear, prevAlpha);
    this.scene.remove(holder);
    holder.remove(actor);
    parent?.add(actor);
    this.sprite.scale.set(hw * 2, hh * 2, 1);
    this.sprite.position.set(0, this.mid.y, 0);
    this.sprite.visible = true;
  }

  hide() {
    this.sprite.visible = false;
  }

  dispose() {
    this.target.dispose();
    this.sprite.material.dispose();
  }
}

export class ElfCtl {
  readonly root = new THREE.Group();
  readonly actor: ElfActor;
  readonly face: FaceLink;
  readonly shadow: THREE.Mesh;
  mode: ElfMode = 'away';
  /** Live point for the tickle hotspot. */
  readonly center = new THREE.Vector3();
  private talkT = 0;
  private time = Math.random() * 10;
  private spinY = 0;
  private faceYaw = 0;
  private impostor: Impostor | null = null;
  /** Shown as a still billboard (low-power group moments). */
  frozen = false;

  constructor(
    readonly id: ElfId,
    low: boolean
  ) {
    this.actor = makeElf(id, { lowPower: low });
    optimizeElf(this.actor);
    const model = this.actor.userData.model;
    this.face = attachFace({ kind: 'elf', elf: id, setMouth: (o) => model.setMouth(o) });
    this.actor.scale.setScalar(ELF_SCALE);
    this.shadow = blob(id === 'noisette' ? 0.22 : 0.36);
    this.root.add(this.actor, this.shadow);
    this.root.visible = false;
    this.root.name = `elf:${id}`;
  }

  get rig(): ElfRig {
    return this.actor.userData.rig;
  }

  get height(): number {
    return (this.id === 'noisette' ? 0.6 : 1.3) * ELF_SCALE;
  }

  setEnergy(e: number) {
    this.rig.energy = e;
  }

  pose(p: ElfPose, side?: 1 | -1) {
    this.thaw();
    this.rig.setPose(p, side);
  }

  /** Jump straight into a pose (no blend): used right before a freeze. */
  snapPose(p: ElfPose, side?: 1 | -1) {
    this.pose(p, side);
    this.actor.position.y = 0;
    this.rig.snap();
  }

  /** Face the camera / a point (yaw only). */
  lookToward(x: number, z: number) {
    this.faceYaw = Math.atan2(x - this.root.position.x, z - this.root.position.z);
  }

  show(at: THREE.Vector3, mode: ElfMode) {
    this.thaw();
    this.root.position.copy(at);
    this.root.visible = mode !== 'away' && mode !== 'hidden';
    this.mode = mode;
  }

  hide() {
    this.thaw();
    this.root.visible = false;
    this.mode = 'away';
    this.face.silence();
  }

  /** Low power: become a still billboard seen from `camPos` (1 draw call). */
  freeze(renderer: THREE.WebGLRenderer, camPos: THREE.Vector3) {
    if (!this.root.visible) return;
    if (!this.impostor) {
      this.impostor = new Impostor();
      this.root.add(this.impostor.sprite);
    }
    // face the wanted way right now (the turn is usually smoothed)
    this.root.rotation.y = this.faceYaw + this.spinY;
    this.root.updateMatrixWorld(true);
    this.impostor.capture(renderer, this.actor, this.root.rotation.y, this.root.position, camPos);
    // the sprite faces the camera by itself: cancel the root's turn for its offset
    this.actor.visible = false;
    this.frozen = true;
  }

  thaw() {
    if (!this.frozen) return;
    this.frozen = false;
    this.actor.visible = true;
    this.impostor?.hide();
  }

  /** Peek out from a hiding place: pops up with a giggle. */
  peek(tw: Tweener, at: THREE.Vector3, reduce: boolean) {
    this.show(at, 'peek');
    this.pose('peek', at.x > 0 ? -1 : 1);
    this.lookToward(at.x * 0.3, 12);
    this.actor.position.y = -this.height * 0.6;
    tw.killTweensOf(this.actor.position);
    tw.to(this.actor.position, { y: 0 }, { duration: reduce ? 0.01 : 0.45, ease: ease.outBack });
  }

  /** The catch: tumble out of the hiding place to the stage, laughing. */
  tumbleTo(tw: Tweener, to: THREE.Vector3, anim: string | null, reduce: boolean, onDone?: () => void) {
    this.thaw();
    const from = this.root.position.clone();
    this.root.visible = true;
    this.mode = 'busy';
    this.pose('laugh');
    this.actor.position.y = 0;
    const height = 1.2 + from.distanceTo(to) * 0.12;
    const spins = anim === 'teacup-roll' || anim === 'tumble-bow' ? 2 : anim === 'spin-jingle' || anim === 'scarf-twirl' ? 1 : 0;
    tw.killTweensOf(this.root.position);
    if (reduce) {
      this.root.position.copy(to);
      this.lookToward(to.x * 0.5, 12);
      this.mode = 'stage';
      onDone?.();
      return;
    }
    tw.run(
      (k) => {
        this.root.position.lerpVectors(from, to, k);
        this.root.position.y = from.y + (to.y - from.y) * k + Math.sin(Math.PI * k) * height;
        this.actor.rotation.x = spins ? k * Math.PI * 2 * spins : 0;
      },
      {
        duration: 0.95,
        ease: ease.inOut,
        onDone: () => {
          this.actor.rotation.x = 0;
          this.lookToward(to.x * 0.5, 12);
          this.mode = 'stage';
          this.gag(tw, anim, reduce);
          onDone?.();
        },
      }
    );
  }

  /** The elf's own little catch gag. */
  gag(tw: Tweener, anim: string | null, reduce: boolean) {
    if (reduce) return;
    const a = this.actor;
    if (anim === 'tumble-bow') {
      this.pose('wave');
      tw.run((k) => (a.rotation.x = Math.sin(Math.PI * k) * 0.55), { duration: 0.9, delay: 0.2, kind: 'other' });
    } else if (anim === 'hat-flop' || anim === 'glasses-wobble' || anim === 'giggle-snort') {
      tw.run((k) => (a.rotation.z = Math.sin(k * Math.PI * 6) * 0.14 * (1 - k)), { duration: 1.3, kind: 'other' });
    } else if (anim === 'spin-jingle' || anim === 'scarf-twirl') {
      tw.run((k) => (this.spinY = k * Math.PI * 2), { duration: 0.9, ease: ease.inOut, kind: 'other', onDone: () => (this.spinY = 0) });
    } else if (anim === 'squeak-hop' || anim === 'teacup-roll') {
      tw.run((k) => (a.position.y = Math.abs(Math.sin(k * Math.PI * 3)) * 0.25 * (1 - k)), { duration: 1.2, kind: 'other' });
    } else {
      tw.run((k) => (a.position.y = Math.sin(Math.PI * k) * 0.2), { duration: 0.5, kind: 'other' });
    }
  }

  /** A happy hop in place (right answer, cheer). */
  hop(tw: Tweener, reduce: boolean) {
    if (reduce) return;
    tw.run((k) => (this.actor.position.y = Math.sin(Math.PI * k) * 0.28), { duration: 0.45, kind: 'other' });
  }

  /** Hop off to join the fix-it team (leaves the stage with a felt puff). */
  popAway(tw: Tweener, reduce: boolean, onDone?: () => void) {
    // a frozen billboard stays frozen (low power): only its root shrinks
    if (!this.frozen) this.pose('wave');
    if (reduce) {
      this.hide();
      onDone?.();
      return;
    }
    const r = this.root;
    tw.run(
      (k) => {
        r.scale.setScalar(Math.max(0.001, 1 - ease.inQuad(k)));
        r.position.y = Math.sin(Math.PI * k) * 0.5;
      },
      {
        duration: 0.55,
        delay: 0.5,
        kind: 'other',
        onDone: () => {
          r.scale.setScalar(1);
          r.position.y = 0;
          this.hide();
          onDone?.();
        },
      },
      r.scale
    );
  }

  talk(seconds: number) {
    this.talkT = seconds;
    this.face.speak();
  }

  silence() {
    this.talkT = 0;
    this.face.silence();
  }

  update(dt: number) {
    this.time += dt;
    if (!this.root.visible || this.frozen) return;
    const r = this.root;
    // turn smoothly toward the wanted facing
    const want = this.faceYaw + this.spinY;
    let d = want - r.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    r.rotation.y += d * Math.min(1, dt * 8);
    this.rig.update(dt);
    if (this.talkT > 0) {
      this.talkT -= dt;
      const level = 0.35 + 0.35 * Math.abs(Math.sin(this.time * 17)) + 0.3 * Math.abs(Math.sin(this.time * 7.3));
      this.face.update(dt, { time: this.time, level });
      if (this.talkT <= 0) this.face.silence();
    }
    this.center.copy(r.position).addScaledVector(UP, this.height * 0.55);
  }

  dispose() {
    this.face.dispose();
    this.impostor?.dispose();
  }
}

// ---------------------------------------------------------------------------

const CUE: Record<ZiggyCue, RigCue | 'dance'> = {
  cheer: 'cheer',
  giggle: 'giggle',
  think: 'think',
  nod: 'nod',
  jump: 'jump',
  dance: 'dance',
  wave: 'wave',
  'high-five': 'cheer',
};

export class ZiggyCtl {
  readonly root = new THREE.Group();
  readonly actor: ZiggyActor;
  readonly shadow: THREE.Mesh;
  readonly center = new THREE.Vector3();
  private talkT = 0;
  private danceT = 0;
  private faceYaw = 0;

  constructor(
    readonly accessory: ZiggyAccessory,
    low: boolean
  ) {
    this.actor = makeZiggy({ accessory, lowPower: low });
    optimizeZiggy(this.actor);
    this.actor.scale.setScalar(ZIGGY_SCALE);
    this.shadow = blob(0.55);
    this.root.add(this.actor, this.shadow);
    this.root.name = 'ziggy';
  }

  get rig(): ZiggyRig {
    return this.actor.userData.rig;
  }

  setEnergy(e: number) {
    this.rig.energy = e * 0.9;
  }

  cue(c: ZiggyCue) {
    const k = CUE[c] ?? 'nod';
    if (k === 'dance') {
      this.danceT = 2.4;
      this.rig.idle = 'dance';
    } else this.rig.cue(k);
  }

  sleep(on: boolean) {
    this.rig.idle = on ? 'sleep' : 'calm';
    this.rig.mood = on ? 'sleepy' : 'happy';
  }

  lookToward(x: number, z: number) {
    this.faceYaw = Math.atan2(x - this.root.position.x, z - this.root.position.z);
  }

  /** Look at a world point with the eyes/head (screen-ish -1..1). */
  glance(x: number, y: number) {
    this.rig.lookAt(x, y);
  }

  talk(seconds: number) {
    this.talkT = seconds;
    this.rig.talking = true;
  }

  silence() {
    this.talkT = 0;
    this.rig.talking = false;
  }

  /** Walk to a point (sandbox search, photo pose). */
  walkTo(tw: Tweener, to: THREE.Vector3, reduce: boolean, onDone?: () => void) {
    const from = this.root.position.clone();
    const dist = from.distanceTo(to);
    this.lookToward(to.x, to.z);
    tw.killTweensOf(this.root.position);
    if (reduce || dist < 0.05) {
      this.root.position.copy(to);
      onDone?.();
      return;
    }
    this.rig.walk = 1;
    tw.run((k) => this.root.position.lerpVectors(from, to, k), {
      duration: Math.min(2.2, 0.35 + dist * 0.38),
      ease: ease.inOut,
      onDone: () => {
        this.rig.walk = 0;
        onDone?.();
      },
    });
  }

  update(dt: number) {
    let d = this.faceYaw - this.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.root.rotation.y += d * Math.min(1, dt * 6);
    if (this.talkT > 0) {
      this.talkT -= dt;
      if (this.talkT <= 0) this.rig.talking = false;
    }
    if (this.danceT > 0) {
      this.danceT -= dt;
      if (this.danceT <= 0 && this.rig.idle === 'dance') this.rig.idle = 'calm';
    }
    this.rig.update(dt);
    this.center.copy(this.root.position).addScaledVector(UP, 1.0);
  }
}

// ---------------------------------------------------------------------------

/** The cast, built once per game and moved between rooms. */
export class Cast {
  readonly elves: Record<ElfId, ElfCtl>;
  private ziggies = new Map<ZiggyAccessory, ZiggyCtl>();

  constructor(private low: boolean) {
    this.elves = { pepin: new ElfCtl('pepin', low), grelotte: new ElfCtl('grelotte', low), noisette: new ElfCtl('noisette', low) };
  }

  /** Ziggy in an outfit (each outfit is built once). */
  ziggy(accessory: ZiggyAccessory = 'none'): ZiggyCtl {
    let z = this.ziggies.get(accessory);
    if (!z) {
      z = new ZiggyCtl(accessory, this.low);
      this.ziggies.set(accessory, z);
    }
    return z;
  }

  /** Low power: freeze every elf standing still on stage into a billboard. */
  freezeStage(renderer: THREE.WebGLRenderer, camPos: THREE.Vector3) {
    for (const el of Object.values(this.elves)) if (el.root.visible && el.mode === 'stage') el.freeze(renderer, camPos);
  }

  setEnergy(e: number) {
    for (const el of Object.values(this.elves)) el.setEnergy(e);
    for (const z of this.ziggies.values()) z.setEnergy(e);
  }

  /** Take everyone out of `scene` before it is disposed (they live on in the next one). */
  detachFrom(scene: THREE.Object3D) {
    for (const el of Object.values(this.elves))
      if (el.root.parent === scene) {
        el.root.removeFromParent();
        el.hide();
      }
    for (const z of this.ziggies.values()) if (z.root.parent === scene) z.root.removeFromParent();
  }

  /** Take everyone out of every scene (game dispose). */
  detach() {
    for (const el of Object.values(this.elves)) {
      el.root.removeFromParent();
      el.hide();
    }
    for (const z of this.ziggies.values()) z.root.removeFromParent();
  }

  dispose(disposeTree: (o: THREE.Object3D) => void) {
    this.detach();
    for (const el of Object.values(this.elves)) {
      el.dispose();
      disposeTree(el.root);
    }
    for (const z of this.ziggies.values()) disposeTree(z.root);
    this.ziggies.clear();
  }
}
