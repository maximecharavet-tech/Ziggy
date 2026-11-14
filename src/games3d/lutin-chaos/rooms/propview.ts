import * as THREE from 'three';
import type { PropState, RoomState } from '../logic';
import { colorById } from '../logic';
import { PATTERN_OF, kitMats, tintMain } from './kit';
import { propGeometry, propKind, type PropKind } from './props';
import type { RoomSet, SlotPlace } from './build';

/**
 * One room prop on screen: a group (position, facing, mirror for left items)
 * → a spin pivot at its middle (quarter turns: upside-down pranks) → one
 * InstancedMesh (copies for `count`). Recolours re-tint its own geometry and
 * swap to the colour's pattern material (colour-blind safe).
 */

export interface PropPose {
  pos: THREE.Vector3;
  yaw: number;
  rot: number;
  hidden: boolean;
  count: number;
  color: string;
}

const MAX_COPIES = 20;
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3(1, 1, 1);
const tmpE = new THREE.Euler();

export class PropView {
  readonly group = new THREE.Group();
  readonly spin = new THREE.Group();
  readonly mesh: THREE.InstancedMesh;
  readonly kind: PropKind;
  /** Live centre for the hotspot button. */
  readonly center = new THREE.Vector3();
  readonly hotspotSize = new THREE.Vector3();
  color = '';
  count = 1;
  private geo: THREE.BufferGeometry;

  constructor(
    readonly id: string,
    readonly kindId: string,
    readonly mirrored: boolean,
    private low: boolean,
    shadows: boolean
  ) {
    this.kind = propKind(kindId);
    this.geo = propGeometry(kindId).clone();
    this.mesh = new THREE.InstancedMesh(this.geo, kitMats(low).felt('plain'), MAX_COPIES);
    this.mesh.castShadow = shadows;
    this.mesh.receiveShadow = shadows;
    this.mesh.frustumCulled = false;
    const half = this.kind.hang ? -this.kind.h / 2 : this.kind.h / 2;
    this.spin.position.y = half;
    this.mesh.position.y = -half;
    this.spin.add(this.mesh);
    this.group.add(this.spin);
    this.group.name = `prop:${id}`;
    if (mirrored) this.group.scale.x = -1;
    this.mesh.userData.propId = id;
    this.hotspotSize.set(Math.max(0.45, this.kind.w * 1.2), Math.max(0.45, this.kind.h * 1.1), Math.max(0.45, this.kind.w));
    this.setCount(1);
  }

  setColor(color: string) {
    if (color === this.color) return;
    this.color = color;
    tintMain(this.geo, colorById(color)?.hex ?? '#cccccc');
    this.mesh.material = kitMats(this.low).felt(PATTERN_OF[color] ?? 'plain');
  }

  setCount(n: number) {
    this.count = Math.max(1, Math.min(MAX_COPIES, n));
    const k = this.kind;
    for (let i = 0; i < this.count; i++) {
      if (i === 0) tmpV.set(0, 0, 0);
      else if (k.stack) tmpV.set(Math.sin(i * 2.1) * 0.02, i * k.h * 0.92, Math.cos(i * 1.7) * 0.02);
      else {
        // a little heap: rings around the first one
        const ring = Math.ceil(Math.sqrt(i));
        const a = i * 2.39996;
        tmpV.set(Math.cos(a) * k.w * 0.55 * ring, (i % 3) * 0.02, Math.sin(a) * k.w * 0.4 * ring);
      }
      tmpQ.setFromEuler(tmpE.set(0, i ? i * 0.9 : 0, 0));
      this.mesh.setMatrixAt(i, tmpM.compose(tmpV, tmpQ, tmpS));
    }
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Snap to a pose (no animation). */
  apply(p: PropPose) {
    this.group.position.copy(p.pos);
    this.group.rotation.y = p.yaw;
    this.spin.rotation.z = (p.rot * Math.PI) / 2;
    this.group.visible = !p.hidden;
    this.group.scale.y = p.hidden ? 0.01 : 1;
    this.setColor(p.color);
    if (p.count !== this.count) this.setCount(p.count);
    this.updateCenter();
  }

  updateCenter() {
    this.spin.getWorldPosition(this.center);
  }

  dispose() {
    this.geo.dispose();
    this.mesh.dispose();
  }
}

/** Is this prop a "left" one (drawn mirrored)? From its tidy slot name. */
export const isLeftItem = (refSlot: string, propId: string) => /left$/.test(refSlot) || /-l$/.test(propId);

/**
 * Where every prop of the room stands for a room state: props in the same
 * slot share its row (in room order), hang from hooks, sink into containers,
 * or decorate the tree. Hidden props stay in their slot, invisible.
 */
export function arrange(set: RoomSet, state: RoomState, order: readonly string[]): Map<string, PropPose> {
  const bySlot = new Map<string, PropState[]>();
  for (const id of order) {
    const p = state.props[id];
    if (!p) continue;
    const list = bySlot.get(p.slot) ?? [];
    list.push(p);
    bySlot.set(p.slot, list);
  }
  const out = new Map<string, PropPose>();
  for (const [slotId, props] of bySlot) {
    const place = set.slots.get(slotId);
    if (!place) continue;
    const visible = props.filter((p) => !p.hidden);
    visible.forEach((p, i) => out.set(p.id, poseIn(place, p, i, visible)));
    for (const p of props) if (p.hidden) out.set(p.id, { ...poseIn(place, p, 0, [p]), hidden: true });
  }
  return out;
}

function poseIn(place: SlotPlace, p: PropState, i: number, all: PropState[]): PropPose {
  const k = propKind(p.kind);
  const pos = place.at.clone();
  const n = all.length;
  if (place.tree) {
    // around the tree, on the side facing the room
    const t = n <= 1 ? 0.5 : i / (n - 1);
    const a = -1.1 + t * 2.2;
    const level = (i * 0.37) % 1;
    const y = 0.15 + level * 0.75;
    const r = place.tree.r * (1 - y * 0.85) + 0.08;
    pos.set(place.at.x + Math.sin(a) * r, place.at.y + y * place.tree.h, place.at.z + Math.cos(a) * r);
  } else if (n > 1) {
    const widths = all.map((x) => propKind(x.kind).w * Math.min(2, Math.max(1, x.count > 1 && !propKind(x.kind).stack ? 1.6 : 1)));
    const total = widths.reduce((a, b) => a + b, 0) + 0.06 * (n - 1);
    const scale = total > place.len ? place.len / total : 1;
    let x = (-total * scale) / 2;
    for (let j = 0; j < i; j++) x += (widths[j] + 0.06) * scale;
    x += (widths[i] * scale) / 2;
    pos.addScaledVector(place.dir, x);
  }
  if (place.hang && !k.hang) pos.y -= k.h;
  if (!place.hang && k.hang) pos.y += k.h;
  pos.y -= place.sink * k.h;
  return { pos, yaw: place.yaw, rot: p.rot, hidden: p.hidden, count: p.count, color: p.color };
}
