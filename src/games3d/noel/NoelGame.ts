import * as THREE from 'three';
import { createRenderer, studioEnvironment, disposeTree, glow, glowTex, labelSprite, prefersLowPower } from '../kit/look';
import { makeBigTree, makeGift, makeHouse, makeLamp, makeNightSky, makeOrnament, makePine, makeSnowman, makeZiggy, PALETTE } from '../kit/models';
import { makeSnowGround, Puffs, Snowfall } from '../kit/world';
import { Controls } from '../kit/input';
import { GameAudio } from '../kit/music';
import { rng } from '../kit/rng';
import {
  COLOR_HEX,
  HOUSE_ROOFS,
  MISSIONS,
  canPick,
  hintText,
  isReady,
  missionText,
  planMission,
  planPattern,
  type Band,
  type Gift,
  type MissionPlan,
  type Ornament,
  type PatternRound,
} from './missions';

export type NoelPhase = 'explore' | 'tree' | 'done';

export interface NoelState {
  phase: NoelPhase;
  missionIndex: number;
  plan: MissionPlan;
  carried: Gift[];
  ready: boolean;
  round: number;
  pattern: PatternRound | null;
}

export interface NoelCallbacks {
  onState: (s: NoelState) => void;
  /** A sentence for Ziggy to say (mission, hints, praise). */
  onSay: (text: string, kind: 'mission' | 'hint' | 'praise') => void;
  onFinish: (stats: { correct: number; mistakes: number; total: number; durationMs: number }) => void;
}

const HOUSE_RADIUS = 13.5;
const SPEED = 4.6;

type GiftObj = THREE.Group & { userData: { gift: Gift; tappable: boolean; base: THREE.Vector3; cooldown: number; hop: number; phase: number } };

export class NoelGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private dropEnv: () => void = () => {};
  private camera = new THREE.PerspectiveCamera(52, 1, 0.1, 400);
  private clock = new THREE.Clock();
  private raf = 0;
  private ziggy = makeZiggy({ accessory: 'santa', lowPower: prefersLowPower() });
  private tree = makeBigTree();
  private houses: ReturnType<typeof makeHouse>[] = [];
  private gifts: GiftObj[] = [];
  private carriedObjs: THREE.Group[] = [];
  private snow: Snowfall;
  private puffs = new Puffs(glowTex());
  private sparkles = new Puffs(glowTex());
  private controls: Controls;
  private audio = new GameAudio();
  private beacon = glow('#fff1a8', 3.2, 0);
  private resize: ResizeObserver;
  private lowPower = prefersLowPower();
  private started = performance.now();

  private missionIndex = 0;
  private plan: MissionPlan;
  private carried: Gift[] = [];
  private delivering = 0;
  private lastHintAt = 0;
  private phase: NoelPhase = 'explore';
  private patterns: PatternRound[];
  private round = 0;
  private placed: THREE.Object3D[] = [];
  private stats = { correct: 0, mistakes: 0 };
  private cam = { pos: new THREE.Vector3(0, 9, 19), look: new THREE.Vector3() };
  private flights: { obj: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; done?: () => void; parent?: THREE.Object3D }[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private seed: number,
    private band: Band,
    private level: number,
    private locale: string,
    private cb: NoelCallbacks
  ) {
    this.renderer = createRenderer(canvas, { lowPower: this.lowPower });
    this.dropEnv = studioEnvironment(this.renderer, this.ziggy, 0.9);
    this.snow = new Snowfall(this.lowPower ? 700 : 1600);
    this.plan = planMission(seed, band, level, 0);
    this.patterns = planPattern(seed, band);
    this.buildWorld();
    this.controls = new Controls(canvas, this.camera, this.scene.getObjectByName('ground')!, (o) => this.tapObject(o), () => this.gifts);
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(canvas.parentElement ?? canvas);
    this.fit();
    this.startMission();
    this.loop();
  }

  /* ── World ── */

  private buildWorld() {
    const s = this.scene;
    s.fog = new THREE.Fog('#1c2657', 20, 68);
    s.add(makeNightSky());
    s.add(new THREE.HemisphereLight('#8ea4f0', '#221c3a', 0.62));
    const moon = new THREE.DirectionalLight('#b9c8ff', 0.95);
    moon.position.set(-18, 30, -12);
    moon.castShadow = true;
    const sm = this.lowPower ? 512 : 1024;
    moon.shadow.mapSize.set(sm, sm);
    Object.assign(moon.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 80 });
    moon.shadow.bias = -0.0015;
    s.add(moon);
    const treeLight = new THREE.PointLight('#ffb35c', 55, 26, 1.5);
    treeLight.position.set(0, 4, 0);
    s.add(treeLight);

    s.add(makeSnowGround());
    this.tree.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m && (o as THREE.Mesh).geometry?.type === 'ConeGeometry') m.transparent = true;
    });
    s.add(this.tree);

    HOUSE_ROOFS.forEach((roof, i) => {
      const a = (i / HOUSE_ROOFS.length) * Math.PI * 2 + Math.PI / 6;
      const h = makeHouse({ roof: COLOR_HEX[roof], walls: i % 2 ? '#f1d3a8' : '#e8c79c', label: String(this.plan.signs[i]) });
      h.position.set(Math.cos(a) * HOUSE_RADIUS, 0, Math.sin(a) * HOUSE_RADIUS);
      h.lookAt(0, 0, 0);
      h.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (m && !(o as THREE.Sprite).isSprite) m.transparent = true;
      });
      this.houses.push(h);
      s.add(h);
      const lamp = makeLamp();
      const la = a + Math.PI / HOUSE_ROOFS.length;
      lamp.position.set(Math.cos(la) * 9.5, 0, Math.sin(la) * 9.5);
      s.add(lamp);
      if (!this.lowPower && i % 2 === 0) {
        const pl = new THREE.PointLight('#ffc874', 14, 9, 1.8);
        pl.position.set(lamp.position.x, 2.4, lamp.position.z);
        s.add(pl);
      }
    });

    const r = rng(this.seed + 5);
    for (let i = 0; i < (this.lowPower ? 34 : 60); i++) {
      const a = r() * Math.PI * 2;
      const d = 19 + r() * 22;
      const p = makePine(0.9 + r() * 1.1);
      p.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      p.rotation.y = r() * Math.PI;
      s.add(p);
    }
    for (const [x, z, ry] of [
      [5.5, 5, -0.6],
      [-6, -4.5, 2.4],
    ]) {
      const sn = makeSnowman();
      sn.position.set(x, 0, z);
      sn.rotation.y = ry;
      s.add(sn);
    }

    this.ziggy.position.set(0, 0, 7.5);
    this.ziggy.rotation.y = Math.PI;
    s.add(this.ziggy);
    s.add(this.snow.points, this.puffs.group, this.sparkles.group);
    this.beacon.position.y = 6;
    s.add(this.beacon);
  }

  private fit() {
    const el = this.canvas.parentElement ?? this.canvas;
    const w = el.clientWidth || 800;
    const h = el.clientHeight || 600;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Portrait screens: step back so the village stays visible.
    this.camera.fov = w < h ? 64 : 52;
    this.camera.updateProjectionMatrix();
  }

  /* ── Missions ── */

  private startMission() {
    // Clear old gifts, update the house signs.
    for (const g of this.gifts) this.scene.remove(g);
    this.gifts = [];
    this.houses.forEach((h, i) => {
      if (h.userData.sign) {
        h.remove(h.userData.sign);
        (h.userData.sign.material as THREE.SpriteMaterial).map?.dispose();
        h.userData.sign.material.dispose();
      }
      const sign = labelSprite(String(this.plan.signs[i]), { size: 0.9 });
      sign.position.set(0, 2.55, 1.45);
      h.add(sign);
      h.userData.sign = sign;
    });
    const r = rng(this.seed * 97 + this.missionIndex);
    const spots: THREE.Vector3[] = [];
    for (const gift of this.plan.gifts) {
      let p = new THREE.Vector3();
      for (let tries = 0; tries < 40; tries++) {
        const a = r() * Math.PI * 2;
        const d = 4.2 + r() * 6.5;
        p = new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d);
        if (spots.every((q) => q.distanceTo(p) > 1.6) && p.distanceTo(this.ziggy.position) > 2) break;
      }
      spots.push(p);
      const obj = makeGift(COLOR_HEX[gift.color], gift.value !== undefined ? String(gift.value) : undefined) as GiftObj;
      obj.position.copy(p);
      const halo = glow(COLOR_HEX[gift.color], 1.6, 0.35);
      halo.position.y = 0.3;
      obj.add(halo);
      obj.userData = { gift, tappable: true, base: p.clone(), cooldown: 0, hop: 0, phase: r() * 6 };
      this.gifts.push(obj);
      this.scene.add(obj);
    }
    this.cb.onSay(missionText(this.plan, this.locale), 'mission');
    this.emit();
  }

  private emit() {
    this.cb.onState({
      phase: this.phase,
      missionIndex: this.missionIndex,
      plan: this.plan,
      carried: [...this.carried],
      ready: isReady(this.plan.mission, this.carried),
      round: this.round,
      pattern: this.phase === 'tree' ? this.patterns[this.round] ?? null : null,
    });
  }

  private hint(text: string) {
    const now = performance.now();
    if (now - this.lastHintAt < 2500) return;
    this.lastHintAt = now;
    this.cb.onSay(text, 'hint');
  }

  private tryPick(obj: GiftObj) {
    if (obj.userData.cooldown > 0 || this.delivering > 0) return;
    const v = canPick(this.plan.mission, this.carried, obj.userData.gift);
    if (!v.ok) {
      obj.userData.cooldown = 2.2;
      obj.userData.hop = 1;
      if (v.reason !== 'full') this.stats.mistakes++;
      this.audio.chime('oops');
      this.ziggy.userData.rig.cue('oops');
      this.hint(hintText(v, this.plan.mission, this.locale));
      return;
    }
    this.audio.chime('pick');
    this.carried.push(obj.userData.gift);
    this.gifts = this.gifts.filter((g) => g !== obj);
    obj.userData.tappable = false;
    // The gift flies into Ziggy's arms and stacks up.
    const slot = new THREE.Vector3(0, 0.85 + this.carriedObjs.length * 0.48, 0.66);
    this.fly(obj, obj.position.clone(), this.ziggy.localToWorld(slot.clone()), 0.35, () => {
      this.scene.remove(obj);
      obj.position.copy(slot);
      obj.rotation.set(0, 0, 0);
      obj.scale.setScalar(0.85);
      this.ziggy.add(obj);
      this.carriedObjs.push(obj);
    });
    this.sparkles.emit(obj.position.clone().add(new THREE.Vector3(0, 0.6, 0)), { color: COLOR_HEX[obj.userData.gift.color], count: 8, up: 1.6, life: 0.8, size: 0.35, additive: true });
    if (isReady(this.plan.mission, this.carried)) {
      this.cb.onSay(this.locale === 'fr' ? 'Bravo ! Maintenant, allons à la bonne maison.' : 'Well done! Now, to the right house.', 'praise');
    }
    this.emit();
  }

  private deliver() {
    const house = this.houses[this.plan.mission.house];
    this.delivering = 1;
    this.audio.chime('deliver');
    const door = house.localToWorld(house.userData.door.clone().setY(0.4));
    this.carriedObjs.forEach((o, i) => {
      const from = this.ziggy.localToWorld(o.position.clone());
      this.ziggy.remove(o);
      o.position.copy(from);
      this.scene.add(o);
      this.fly(o, from, door.clone().add(new THREE.Vector3((i - 1) * 0.5, 0, 0)), 0.5 + i * 0.12, () => this.scene.remove(o));
    });
    this.carriedObjs = [];
    this.carried = [];
    this.stats.correct++;
    this.ziggy.userData.rig.cue('cheer');
    for (const w of house.userData.windows) (w.material as THREE.MeshBasicMaterial).color.set('#ffd98c').multiplyScalar(1.8);
    for (let k = 0; k < 4; k++) setTimeout(() => this.puffs.emit(house.localToWorld(house.userData.smoke.clone()), { count: 4, up: 1.4, life: 2.6, size: 0.9 }), k * 450);
    this.sparkles.emit(door.clone().add(new THREE.Vector3(0, 1.5, 0)), { color: '#ffe680', count: 24, spread: 3, up: 2.5, life: 1.4, size: 0.4, additive: true });
    // The tree lights up a little more after each delivery.
    const bulbs = this.tree.userData.bulbs;
    const on = Math.round(((this.missionIndex + 1) / MISSIONS) * bulbs.length);
    bulbs.slice(0, on).forEach((b) => (b.material as THREE.MeshBasicMaterial).color.set(b.userData.color).multiplyScalar(1.8));
    this.cb.onSay(this.locale === 'fr' ? 'Livré ! Merci, Ziggy !' : 'Delivered! Thank you, Ziggy!', 'praise');
    setTimeout(() => {
      this.delivering = 0;
      this.missionIndex++;
      if (this.missionIndex >= MISSIONS) return this.startTree();
      this.plan = planMission(this.seed, this.band, this.level, this.missionIndex);
      this.startMission();
    }, 2200);
    this.emit();
  }

  /* ── Tree decoration ── */

  private startTree() {
    this.phase = 'tree';
    for (const g of this.gifts) this.scene.remove(g);
    this.gifts = [];
    this.controls.target = new THREE.Vector3(0, 0, 5);
    this.cb.onSay(
      this.locale === 'fr' ? 'Toutes les maisons sont livrées ! Décorons le grand sapin. Quelle boule vient ensuite ?' : 'Every house has its presents! Let’s decorate the big tree. Which bauble comes next?',
      'mission'
    );
    this.emit();
  }

  /** Called by the HUD when the child picks an ornament. */
  chooseOrnament(o: Ornament): boolean {
    const p = this.patterns[this.round];
    if (this.phase !== 'tree' || !p) return false;
    if (o !== p.answer) {
      this.stats.mistakes++;
      this.audio.chime('oops');
      this.ziggy.userData.rig.cue('think');
      this.hint(this.locale === 'fr' ? 'Presque ! Regarde bien la suite des couleurs.' : 'Almost! Look carefully at the colour pattern.');
      return false;
    }
    this.stats.correct++;
    this.audio.chime('pick');
    this.ziggy.userData.rig.cue('jump');
    const orn = makeOrnament(COLOR_HEX[o === 'yellow' ? 'yellow' : o], this.round === 2 ? 'star' : 'ball');
    const slots = this.tree.userData.slots;
    const target = this.tree.localToWorld(slots[(this.round * 2) % slots.length].clone());
    const from = this.ziggy.position.clone().add(new THREE.Vector3(0, 1.6, 0));
    orn.position.copy(from);
    orn.scale.setScalar(2);
    this.scene.add(orn);
    this.placed.push(orn);
    this.fly(orn, from, target, 0.7);
    this.round++;
    if (this.round >= this.patterns.length) setTimeout(() => this.finale(), 900);
    else this.cb.onSay(this.locale === 'fr' ? 'Bravo ! Encore une !' : 'Well done! One more!', 'praise');
    this.emit();
    return true;
  }

  private finale() {
    this.phase = 'done';
    this.audio.chime('star');
    const star = this.tree.userData.star;
    (star.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.color.set('#ffe066').multiplyScalar(2.2);
    ((star.children[1] as THREE.Sprite).material as THREE.SpriteMaterial).opacity = 0.95;
    for (const b of this.tree.userData.bulbs) (b.material as THREE.MeshBasicMaterial).color.set(b.userData.color).multiplyScalar(2);
    const top = this.tree.localToWorld(star.position.clone());
    for (let k = 0; k < 6; k++)
      setTimeout(() => this.sparkles.emit(top, { color: ['#ffe066', '#ff7ab8', '#7fd0ff', '#9bf07f'][k % 4], count: 26, spread: 7, up: 3, life: 2, size: 0.45, additive: true }), k * 350);
    this.cb.onSay(this.locale === 'fr' ? 'Joyeux Noël ! Le village est tout illuminé grâce à toi !' : 'Merry Christmas! The whole village is shining thanks to you!', 'praise');
    this.emit();
    setTimeout(() => this.cb.onFinish({ ...this.stats, total: MISSIONS + this.patterns.length, durationMs: performance.now() - this.started }), 3500);
  }

  /* ── Interaction & animation ── */

  private tapObject(o: THREE.Object3D): boolean {
    if (this.phase !== 'explore') return false;
    // Tapping a gift walks Ziggy to it.
    this.controls.target = o.position.clone();
    return true;
  }

  private fly(obj: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, dur: number, done?: () => void) {
    this.flights.push({ obj, from, to, t: 0, dur, done });
  }

  setMusic(on: boolean) {
    if (on) this.audio.startMusic();
    else this.audio.stopMusic();
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    this.step(dt, t);
    this.renderer.render(this.scene, this.camera);
  };

  private step(dt: number, t: number) {
    const z = this.ziggy;
    // Movement: keys first, else walk to the tapped point.
    const move = new THREE.Vector3();
    const kv = this.controls.keyVector();
    if (kv.lengthSq()) move.set(kv.x, 0, kv.y);
    else if (this.controls.target) {
      move.subVectors(this.controls.target, z.position).setY(0);
      if (move.length() < 0.25) {
        this.controls.target = null;
        move.set(0, 0, 0);
      } else move.normalize();
    }
    const walking = move.lengthSq() > 0 && this.delivering === 0;
    if (walking) {
      z.position.addScaledVector(move, SPEED * dt);
      const want = Math.atan2(move.x, move.z);
      let d = want - z.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      z.rotation.y += d * Math.min(1, dt * 10);
    }
    this.collide(z.position);
    // The plush walks, carries, breathes, blinks — all from its rig.
    const rig = z.userData.rig;
    rig.walk += ((walking ? 1 : 0) - rig.walk) * Math.min(1, dt * 8);
    rig.carrying = this.carriedObjs.length > 0;
    rig.update(dt);

    // Gifts bob, spin, and react.
    for (const g of this.gifts) {
      const u = g.userData;
      u.cooldown = Math.max(0, u.cooldown - dt);
      u.hop = Math.max(0, u.hop - dt * 2.2);
      g.position.y = u.base.y + 0.18 + Math.sin(t * 2 + u.phase) * 0.12 + Math.sin(u.hop * Math.PI) * 1.2;
      g.rotation.y += dt * 0.8;
      if (this.phase === 'explore' && g.position.distanceTo(z.position) < 1.25) this.tryPick(g);
    }

    // Delivery: near the right door with the right gifts.
    if (this.phase === 'explore' && this.delivering === 0) {
      const ready = isReady(this.plan.mission, this.carried);
      const target = this.houses[this.plan.mission.house];
      this.beacon.position.lerp(target.position.clone().setY(6.2 + Math.sin(t * 3) * 0.3), 0.2);
      (this.beacon.material as THREE.SpriteMaterial).opacity = ready ? 0.9 : 0;
      this.houses.forEach((h, i) => {
        const door = h.localToWorld(h.userData.door.clone());
        if (door.distanceTo(z.position) < 2.6) {
          if (i === this.plan.mission.house && ready) this.deliver();
          else if (this.carried.length) {
            if (i !== this.plan.mission.house) this.hint(this.locale === 'fr' ? 'Ce n’est pas cette maison. Cherche la bonne !' : 'Not this house. Look for the right one!');
            else this.hint(this.locale === 'fr' ? 'Il manque encore des cadeaux.' : 'A few presents are still missing.');
          }
        }
      });
    }

    // Flights (gifts to arms/doors, ornaments to the tree).
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      f.t = Math.min(1, f.t + dt / f.dur);
      const e = 1 - (1 - f.t) ** 3;
      f.obj.position.lerpVectors(f.from, f.to, e);
      f.obj.position.y += Math.sin(f.t * Math.PI) * 1.2;
      if (f.t >= 1) {
        this.flights.splice(i, 1);
        f.done?.();
      }
    }
    for (const o of this.placed) o.rotation.y += dt;
    (this.tree.userData.star as THREE.Object3D).rotation.y += dt * (this.phase === 'done' ? 2 : 0.4);
    this.tree.userData.bulbs.forEach((b, i) => b.scale.setScalar(1 + Math.max(0, Math.sin(t * 3 + i)) * 0.25));

    this.snow.update(dt, t, z.position);
    this.puffs.update(dt);
    this.sparkles.update(dt);

    // A house between the camera and Ziggy fades out, so he is never hidden.
    const cam2 = new THREE.Vector2(this.camera.position.x, this.camera.position.z);
    const zig2 = new THREE.Vector2(z.position.x, z.position.z);
    for (const h of [...this.houses, this.tree]) {
      const c = new THREE.Vector2(h.position.x, h.position.z);
      const seg = zig2.clone().sub(cam2);
      const k2 = Math.max(0, Math.min(1, c.clone().sub(cam2).dot(seg) / Math.max(0.001, seg.lengthSq())));
      const hidden = this.phase === 'explore' && c.distanceTo(cam2.clone().addScaledVector(seg, k2)) < 2.8 && k2 < 0.98;
      const target = hidden ? (h === this.tree ? 0.35 : 0.22) : 1;
      h.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (m && m.transparent) m.opacity += (target - m.opacity) * Math.min(1, dt * 8);
      });
    }

    // Camera: follows Ziggy from behind/above; frames the tree for the finale.
    const focus = this.phase === 'explore' ? z.position : new THREE.Vector3(0, 0, 2);
    const offset = this.phase === 'explore' ? new THREE.Vector3(0, 7.2, 10.5) : new THREE.Vector3(0, 5.5, 13.5);
    this.cam.pos.lerp(focus.clone().add(offset), 1 - Math.exp(-dt * 2.5));
    this.cam.look.lerp(focus.clone().add(new THREE.Vector3(0, this.phase === 'explore' ? 1 : 3.5, 0)), 1 - Math.exp(-dt * 4));
    this.camera.position.copy(this.cam.pos);
    this.camera.lookAt(this.cam.look);
  }

  private collide(p: THREE.Vector3) {
    const push = (cx: number, cz: number, r: number) => {
      const dx = p.x - cx;
      const dz = p.z - cz;
      const d = Math.hypot(dx, dz);
      if (d < r && d > 0.0001) {
        p.x = cx + (dx / d) * r;
        p.z = cz + (dz / d) * r;
      }
    };
    push(0, 0, 2.7);
    for (const h of this.houses) push(h.position.x, h.position.z, 2.3);
    const d = Math.hypot(p.x, p.z);
    if (d > 17) p.multiplyScalar(17 / d);
    p.y = 0;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resize.disconnect();
    this.controls.dispose();
    this.audio.dispose();
    disposeTree(this.scene);
    this.dropEnv();
    this.renderer.dispose();
  }
}

export { PALETTE };
