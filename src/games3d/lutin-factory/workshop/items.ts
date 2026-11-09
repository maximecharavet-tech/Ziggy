import * as THREE from 'three';
import type { Cell, Item, SimItem } from '../logic';
import type { TickInfo } from '../controller';
import type { Board } from './board';
import { TILE_Y } from './board';
import { DIR_YAW } from './geo';
import { RIDE } from './machines';
import type { ItemInstancer } from './prims';
import { toyLook } from './toys';

/**
 * Everything that rides, waits, flies or sits: the items on the belts,
 * moving smoothly between two simulator ticks (the ticker's progress), the
 * parts waiting in an assembler's basket, the robot arm's build plate, the
 * surprise shelf, and the surprise toys flying from the sack to the shelf.
 * All drawn through the instancer; no allocation in `update`.
 */

interface Vis {
  fx: number;
  fz: number;
  tx: number;
  tz: number;
  a: Item;
  b: Item;
  switchAt: number;
  /** 0 none, 1 dropped down a chute, 2 pops out of a machine. */
  appear: number;
  /** 0 none, 1 absorbed by a machine, 2 dropped into a sack. */
  vanish: number;
  yawA: number;
  yawB: number;
}

interface Flight {
  item: Item;
  from: THREE.Vector3;
  slot: number;
  t: number;
  dur: number;
}

interface StaticToy {
  item: Item;
  x: number;
  y: number;
  z: number;
  yaw: number;
  s: number;
}

const M = new THREE.Matrix4();
const P = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const V = new THREE.Vector3();
const S = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const C = new THREE.Vector3();

const smooth = (k: number) => k * k * (3 - 2 * k);
const lerpAngle = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

export class ItemLayer {
  private vis: Vis[] = [];
  private flights: Flight[] = [];
  private shelfItems: Item[] = [];
  private shelfSlots: THREE.Vector3[] = [];
  private statics: StaticToy[] = [];
  reduced = false;

  constructor(
    private inst: ItemInstancer,
    private board: Board
  ) {}

  private world(c: Cell): THREE.Vector3 {
    return this.board.cellCenter(c, C);
  }

  /** A new tick: who goes from where to where, and what changes on the way. */
  applyTick(info: TickInfo): void {
    const moves = new Map<number, { from: Cell; to: Cell }>();
    const processed = new Set<number>();
    const built = new Set<number>();
    const emitted = new Map<number, string>();
    const gone = new Map<number, number>();
    for (const e of info.events) {
      if (e.type === 'move') moves.set(e.id, { from: e.from, to: e.to });
      else if (e.type === 'process') processed.add(e.id);
      else if (e.type === 'build') built.add(e.id);
      else if (e.type === 'emit') emitted.set(e.id, e.machine);
      else if (e.type === 'absorb') gone.set(e.id, 1);
      else if (e.type === 'deliver') gone.set(e.id, 2);
    }
    const out: Vis[] = [];
    for (const [id, now] of info.after) {
      const prev = info.before.get(id);
      const mv = moves.get(id);
      const c = this.world(now.at);
      const v: Vis = { fx: c.x, fz: c.z, tx: c.x, tz: c.z, a: now.item, b: now.item, switchAt: 2, appear: 0, vanish: 0, yawA: DIR_YAW[now.exit], yawB: DIR_YAW[now.exit] };
      if (emitted.has(id)) v.appear = emitted.get(id) === 'chute' ? 1 : 2;
      else if (built.has(id)) {
        v.appear = 2;
        v.switchAt = 0.5;
      } else if (mv) {
        const f = this.world(mv.from);
        v.fx = f.x;
        v.fz = f.z;
        if (prev) {
          v.a = prev.item;
          v.yawA = DIR_YAW[prev.exit];
        }
        if (processed.has(id)) v.switchAt = 0.55;
      } else if (prev) v.yawA = DIR_YAW[prev.exit];
      out.push(v);
    }
    for (const [id, kind] of gone) {
      const prev = info.before.get(id);
      const mv = moves.get(id);
      if (!prev || !mv) continue;
      const f = this.world(mv.from);
      const fx = f.x;
      const fz = f.z;
      const t = this.world(mv.to);
      out.push({ fx, fz, tx: t.x, tz: t.z, a: prev.item, b: prev.item, switchAt: 2, appear: 0, vanish: kind, yawA: DIR_YAW[prev.exit], yawB: DIR_YAW[prev.exit] });
    }
    this.vis = out;
  }

  /** Items resting where they are (after a reset: nothing). */
  rest(items: SimItem[]): void {
    this.vis = items.map((s) => {
      const c = this.world(s.at);
      const y = DIR_YAW[s.exit];
      return { fx: c.x, fz: c.z, tx: c.x, tz: c.z, a: s.item, b: s.item, switchAt: 2, appear: 0, vanish: 0, yawA: y, yawB: y };
    });
  }

  clear(): void {
    this.vis = [];
  }

  setShelf(items: Omit<Item, 'id'>[], slots: THREE.Vector3[]): void {
    this.shelfItems = items.map((it, i) => ({ id: -1 - i, ...it }) as Item);
    this.shelfSlots = slots;
  }

  /** A surprise toy flies from the sack to its spot on the shelf (index in the shelf list). */
  fly(item: Item, from: THREE.Vector3, slot: number): void {
    this.flights.push({ item, from: from.clone(), slot, t: 0, dur: this.reduced ? 0.01 : 1.3 });
  }

  /** Parts in baskets, the arm's plate: toys that sit still on machines. */
  setStatics(list: { at: Cell; dir: string; items: Item[]; kind: 'basket' | 'plate' | 'hand' }[]): void {
    this.statics = [];
    for (const s of list) {
      const c = this.world(s.at);
      const yaw = DIR_YAW[s.dir] ?? 0;
      const cs = Math.cos(yaw);
      const sn = Math.sin(yaw);
      const loc = (lx: number, lz: number) => [c.x + lx * cs + lz * sn, c.z - lx * sn + lz * cs];
      if (s.kind === 'basket') {
        s.items.slice(-5).forEach((it, i) => {
          const [x, z] = loc(-0.24 + ((i % 2) - 0.5) * 0.12, -0.24 + (Math.floor(i / 2) - 0.5) * 0.1);
          this.statics.push({ item: it, x, y: TILE_Y + 0.24 + Math.floor(i / 2) * 0.05, z, yaw: i * 0.9, s: 0.42 });
        });
      } else if (s.kind === 'plate') {
        const [x, z] = loc(0.06, 0);
        s.items.forEach((it, i) => this.statics.push({ item: it, x, y: TILE_Y + 0.15 + i * 0.16, z, yaw: (i % 2) * 0.3, s: 0.7 }));
      } else {
        const [x, z] = loc(0.1, -0.1);
        s.items.forEach((it) => this.statics.push({ item: it, x, y: TILE_Y + 0.62, z, yaw: 0, s: 0.6 }));
      }
    }
  }

  private draw(it: Item, x: number, y: number, z: number, yaw: number, s: number) {
    const look = toyLook(it);
    Q.setFromAxisAngle(UP, yaw);
    M.compose(V.set(x, y, z), Q, S.set(s, s, s));
    for (const p of look.parts) {
      P.multiplyMatrices(M, p.m);
      this.inst.add(p.prim, P, p.color, p.pat);
    }
  }

  /** `p` = progress inside the current tick (0..1); `t` seconds. */
  update(p: number, t: number, dt: number): void {
    this.inst.begin();
    const k = smooth(Math.min(1, Math.max(0, p)));
    const base = TILE_Y + RIDE;
    for (const v of this.vis) {
      const x = v.fx + (v.tx - v.fx) * k;
      const z = v.fz + (v.tz - v.fz) * k;
      let y = base;
      let s = 1;
      const moving = v.fx !== v.tx || v.fz !== v.tz;
      if (moving && !this.reduced) y += Math.sin(Math.PI * k) * 0.05;
      const yaw = lerpAngle(v.yawA, v.yawB, k);
      let it = p < v.switchAt ? v.a : v.b;
      if (v.appear === 1) {
        if (p < 0.5) {
          const q = p / 0.5;
          y += (1 - q) * 0.55;
          s = 0.6 + 0.4 * q;
        }
      } else if (v.appear === 2) {
        const start = v.switchAt <= 1 ? v.switchAt : 0;
        if (p < start) continue;
        const q = Math.min(1, (p - start) / 0.35);
        s = this.reduced ? 1 : 0.3 + q * 0.7 + Math.sin(q * Math.PI) * 0.25;
        it = v.b;
      }
      if (v.switchAt <= 1 && v.appear === 0 && !this.reduced) {
        // A little "pop" when the machine changes the toy.
        const d = p - v.switchAt;
        if (d > 0 && d < 0.3) s *= 1 + Math.sin((d / 0.3) * Math.PI) * 0.22;
      }
      if (v.vanish) {
        if (p > 0.5) {
          const q = Math.min(1, (p - 0.5) / 0.45);
          s *= 1 - q;
          if (v.vanish === 2) y += Math.sin(q * Math.PI) * 0.35;
        }
        if (s <= 0.02) continue;
      }
      this.draw(it, x, y, z, yaw, s * 1.22);
    }
    for (const st of this.statics) this.draw(st.item, st.x, st.y, st.z, st.yaw, st.s);
    // The shelf (toys facing the room), minus the ones still flying there.
    const facing = -Math.PI / 2;
    for (let i = 0; i < this.shelfItems.length && i < this.shelfSlots.length; i++) {
      let flying = false;
      for (const f of this.flights) if (f.slot === i) flying = true;
      if (flying) continue;
      const sp = this.shelfSlots[i];
      const wob = this.reduced ? 0 : Math.sin(t * 1.3 + i) * 0.04;
      this.draw(this.shelfItems[i], sp.x, sp.y, sp.z, facing + wob, 0.72);
    }
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      f.t += dt;
      const q = Math.min(1, f.t / f.dur);
      const to = this.shelfSlots[Math.min(f.slot, this.shelfSlots.length - 1)];
      if (!to) {
        this.flights.splice(i, 1);
        continue;
      }
      const e = smooth(q);
      const x = f.from.x + (to.x - f.from.x) * e;
      const z = f.from.z + (to.z - f.from.z) * e;
      const y = f.from.y + (to.y - f.from.y) * e + Math.sin(q * Math.PI) * 2.0;
      this.draw(f.item, x, y, z, facing + q * Math.PI * 2, 0.72 + (1 - q) * 0.2);
      if (q >= 1) this.flights.splice(i, 1);
    }
    this.inst.end();
  }
}
