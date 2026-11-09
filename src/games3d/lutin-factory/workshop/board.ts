import * as THREE from 'three';
import { cellLabel, getMachine, type Cell, type Dir, type Layout, type Piece } from '../logic';
import { FELT } from './palette';
import { DIR_YAW, at, box, feltMaterial, merge, rbox, type Geo } from './geo';
import { IconAtlas } from './icons';
import { MACHINE_ART, type MachineArt } from './machines';

/**
 * The workbench floor and everything standing on it: felt mats in a
 * checker, the wooden rim, the elves' workbench stumps (blocked tiles), the
 * coordinates (A–I, 1–7), every machine body (ONE merged mesh), the moving
 * felt bands of the belts (one mesh, scrolling chevrons), the dial signs
 * (one mesh over an icon atlas), the machines' moving parts (one
 * InstancedMesh per machine type) and the highlights (selection, glowing
 * slots, hint). Rebuilt on every layout change, which is cheap.
 */

export const TILE_Y = 0.04;

const tmpM = new THREE.Matrix4();
const tmpL = new THREE.Matrix4();
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);

interface Placed {
  piece: Piece;
  art: MachineArt;
  base: THREE.Matrix4;
  key: string;
}

function beltTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#5b6b8c';
  g.fillRect(0, 0, 64, 128);
  // Felt band with chevrons pointing "up" (the flow direction).
  g.fillStyle = '#6f80a3';
  for (let y = 0; y < 128; y += 16) g.fillRect(0, y, 64, 3);
  g.fillStyle = '#ffd86b';
  for (const y0 of [24, 88]) {
    g.beginPath();
    g.moveTo(10, y0 + 18);
    g.lineTo(32, y0 - 6);
    g.lineTo(54, y0 + 18);
    g.lineTo(44, y0 + 18);
    g.lineTo(32, y0 + 6);
    g.lineTo(20, y0 + 18);
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ringGeometry(r0: number, r1: number): THREE.BufferGeometry {
  const g = new THREE.RingGeometry(r0, r1, 4, 1, Math.PI / 4);
  g.rotateX(-Math.PI / 2);
  return g;
}

export class Board {
  readonly group = new THREE.Group();
  w = 1;
  h = 1;
  private gridMesh: THREE.Mesh | null = null;
  private bodyMesh: THREE.Mesh | null = null;
  private beltMesh: THREE.Mesh | null = null;
  private signMesh: THREE.Mesh | null = null;
  private feltMat = feltMaterial();
  private beltMat: THREE.MeshLambertMaterial;
  private signMat: THREE.MeshBasicMaterial;
  private atlas = new IconAtlas();
  private movers = new Map<string, THREE.InstancedMesh>();
  private placed: Placed[] = [];
  private activity = new Map<string, number>();
  private selRing: THREE.Mesh;
  private hintRing: THREE.Mesh;
  private slotRings: THREE.InstancedMesh;
  private slotCells: Cell[] = [];
  private toolCells: THREE.InstancedMesh;
  private hintAt: Cell | null = null;
  private selAt: Cell | null = null;
  private signUp = new THREE.Vector3(0, 0, -1);
  reduced = false;
  private moverIdx = new Map<string, number>();

  constructor(private shadows: boolean) {
    this.group.name = 'board';
    this.beltMat = new THREE.MeshLambertMaterial({ map: beltTexture() });
    this.signMat = new THREE.MeshBasicMaterial({ map: this.atlas.texture, transparent: true, alphaTest: 0.05, depthWrite: false });
    this.selRing = new THREE.Mesh(ringGeometry(0.62, 0.74), new THREE.MeshBasicMaterial({ color: '#ffd54a', toneMapped: false, transparent: true, opacity: 0.95, depthWrite: false }));
    this.selRing.visible = false;
    this.selRing.renderOrder = 2;
    this.hintRing = new THREE.Mesh(ringGeometry(0.55, 0.72), new THREE.MeshBasicMaterial({ color: '#7cf0c8', toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false }));
    this.hintRing.visible = false;
    this.hintRing.renderOrder = 2;
    const slotMat = new THREE.MeshBasicMaterial({ color: '#ffb300', toneMapped: false, transparent: true, opacity: 1, depthWrite: false });
    const slotGeo = ringGeometry(0.42, 0.7);
    this.slotRings = new THREE.InstancedMesh(slotGeo, slotMat, 16);
    this.slotRings.count = 0;
    this.slotRings.renderOrder = 1;
    this.slotRings.frustumCulled = false;
    const toolGeo = new THREE.PlaneGeometry(0.9, 0.9);
    toolGeo.rotateX(-Math.PI / 2);
    this.toolCells = new THREE.InstancedMesh(toolGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false }), 200);
    this.toolCells.count = 0;
    this.toolCells.frustumCulled = false;
    this.group.add(this.selRing, this.hintRing, this.slotRings, this.toolCells);
  }

  /** Signs face the camera's up direction (set once the camera pitch is known). */
  setCameraUp(up: THREE.Vector3): void {
    this.signUp.copy(up);
  }

  /** World centre of a tile (y = top of the felt mat). */
  cellCenter(c: Cell, out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(c[0] - (this.w - 1) / 2, TILE_Y, c[1] - (this.h - 1) / 2);
  }

  /** Tile under a world point (or null). */
  cellAt(x: number, z: number): Cell | null {
    const cx = Math.round(x + (this.w - 1) / 2);
    const cy = Math.round(z + (this.h - 1) / 2);
    return cx >= 0 && cy >= 0 && cx < this.w && cy < this.h ? [cx, cy] : null;
  }

  /** The grid (felt mats, rim, stumps, coordinates): once per level. */
  setGrid(l: Pick<Layout, 'w' | 'h' | 'blocked'>, showCoords: boolean): void {
    this.w = l.w;
    this.h = l.h;
    this.atlas.reset();
    if (this.gridMesh) {
      this.group.remove(this.gridMesh);
      this.gridMesh.geometry.dispose();
    }
    const parts: Geo[] = [];
    const W = l.w;
    const H = l.h;
    // A big felt rug, then the wooden rim of the workbench mat.
    parts.push(at(rbox(W + 1.1, 0.03, H + 1.1, 0.12, '#c4553f'), 0, 0.005, 0));
    parts.push(at(rbox(W + 0.55, 0.04, H + 0.55, 0.1, FELT.woodDark), 0, 0.012, 0));
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const blocked = (l.blocked ?? []).some((b) => b[0] === x && b[1] === y);
        const c = this.cellCenter([x, y]);
        if (blocked) {
          // The elves' workbench: a wooden stump with a hammer and a spool on it.
          parts.push(at(rbox(0.94, 0.5, 0.94, 0.08, FELT.wood), c.x, 0.25, c.z));
          parts.push(at(rbox(0.98, 0.08, 0.98, 0.04, FELT.woodDark), c.x, 0.52, c.z));
          parts.push(at(box(0.36, 0.06, 0.08, FELT.steel), c.x - 0.1, 0.59, c.z + 0.1, 0, 0.5, 0));
          parts.push(at(box(0.06, 0.06, 0.3, FELT.woodDeep), c.x + 0.05, 0.59, c.z + 0.12, 0, 0.5, 0));
          parts.push(at(rbox(0.16, 0.14, 0.16, 0.05, FELT.pink), c.x + 0.22, 0.63, c.z - 0.2));
          continue;
        }
        const light = (x + y) % 2 === 0;
        parts.push(at(rbox(0.94, 0.05, 0.94, 0.06, light ? FELT.cream : FELT.peach), c.x, 0.03, c.z));
      }
    const geo = merge(parts);
    this.gridMesh = new THREE.Mesh(geo, this.feltMat);
    this.gridMesh.receiveShadow = this.shadows;
    this.gridMesh.name = 'grid';
    this.group.add(this.gridMesh);
    this.coords = showCoords;
  }

  private coords = true;

  /** Machines, belts, signs and movers for this layout. */
  setLayout(layout: Layout): void {
    for (const m of [this.bodyMesh, this.beltMesh, this.signMesh]) {
      if (!m) continue;
      this.group.remove(m);
      m.geometry.dispose();
    }
    this.bodyMesh = this.beltMesh = this.signMesh = null;
    this.placed = [];
    const bodies: Geo[] = [];
    const belts: { pos: number[]; uv: number[]; idx: number[] } = { pos: [], uv: [], idx: [] };
    const signs: { pos: number[]; uv: number[]; idx: number[] } = { pos: [], uv: [], idx: [] };
    for (const piece of layout.pieces) {
      const art = MACHINE_ART[piece.machine];
      if (!art || !getMachine(piece.machine)) continue;
      const c = this.cellCenter(piece.at);
      const yaw = DIR_YAW[piece.dir];
      const base = new THREE.Matrix4().compose(tmpV.set(c.x, TILE_Y, c.z), tmpQ.setFromAxisAngle(Y, yaw), new THREE.Vector3(1, 1, 1));
      const dial = getMachine(piece.machine)?.dial.parse(piece.dial ?? {}) ?? {};
      const g = art.body(dial);
      g.applyMatrix4(base);
      bodies.push(g);
      this.placed.push({ piece, art, base, key: `${piece.at[0]},${piece.at[1]}` });
      if (piece.machine === 'belt') this.addBeltTop(belts, c, piece.dir);
      const text = art.sign?.(dial);
      if (text) {
        if (art.signOnTop) this.addSign(signs, text, c.x, TILE_Y + art.height + 0.03, c.z + 0.02, 0.44);
        else this.addSign(signs, text, c.x - 0.22, TILE_Y + 0.16, c.z + 0.25, 0.4);
      }
      if (piece.locked) this.addSign(signs, '📌', c.x + 0.36, TILE_Y + 0.1, c.z + 0.36, 0.2);
    }
    for (const c of this.slotCells) {
      if (layout.pieces.some((p) => p.at[0] === c[0] && p.at[1] === c[1])) continue;
      const w = this.cellCenter(c);
      this.addSign(signs, '❓', w.x, TILE_Y + 0.45, w.z, 0.5);
    }
    if (this.coords) {
      for (let x = 0; x < this.w; x++) {
        const c = this.cellCenter([x, 0]);
        this.addSign(signs, cellLabel([x, 0]).slice(0, 1), c.x, 0.06, c.z - 0.8, 0.26);
      }
      for (let y = 0; y < this.h; y++) {
        const c = this.cellCenter([0, y]);
        this.addSign(signs, String(y + 1), c.x - 0.8, 0.06, c.z, 0.26);
      }
    }
    if (bodies.length) {
      this.bodyMesh = new THREE.Mesh(merge(bodies), this.feltMat);
      this.bodyMesh.castShadow = this.shadows;
      this.bodyMesh.receiveShadow = this.shadows;
      this.bodyMesh.name = 'machines';
      this.group.add(this.bodyMesh);
    }
    if (belts.pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(belts.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(belts.uv, 2));
      g.setIndex(belts.idx);
      g.computeVertexNormals();
      this.beltMesh = new THREE.Mesh(g, this.beltMat);
      this.beltMesh.receiveShadow = this.shadows;
      this.beltMesh.name = 'belt-bands';
      this.group.add(this.beltMesh);
    }
    if (signs.pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(signs.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(signs.uv, 2));
      g.setIndex(signs.idx);
      this.signMesh = new THREE.Mesh(g, this.signMat);
      this.signMesh.renderOrder = 3;
      this.signMesh.name = 'signs';
      this.group.add(this.signMesh);
    }
    this.syncMovers();
  }

  private addBeltTop(b: { pos: number[]; uv: number[]; idx: number[] }, c: THREE.Vector3, dir: Dir) {
    // Local quad facing +X: v runs along the flow so one texture scroll moves every belt forward.
    const yaw = DIR_YAW[dir];
    const cs = Math.cos(yaw);
    const sn = Math.sin(yaw);
    const corners: [number, number, number, number][] = [
      [-0.49, -0.4, 0, 0],
      [0.49, -0.4, 0, 1],
      [0.49, 0.4, 1, 1],
      [-0.49, 0.4, 1, 0],
    ];
    const i0 = b.pos.length / 3;
    for (const [lx, lz, u, v] of corners) {
      // Rotation about +Y by yaw: x' = x cos + z sin, z' = -x sin + z cos.
      b.pos.push(c.x + lx * cs + lz * sn, TILE_Y + 0.105, c.z - lx * sn + lz * cs);
      b.uv.push(u, v);
    }
    b.idx.push(i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2);
  }

  private addSign(s: { pos: number[]; uv: number[]; idx: number[] }, text: string, x: number, y: number, z: number, size: number) {
    const [u0, v0, u1, v1] = this.atlas.uv(text);
    const hs = size / 2;
    // Lying flat (readable from above): "up" of the picture toward the camera's up on the floor.
    const ux = this.signUp.x;
    const uz = this.signUp.z;
    const n = Math.hypot(ux, uz) || 1;
    const fx = ux / n;
    const fz = uz / n;
    const rx = -fz;
    const rz = fx;
    const i0 = s.pos.length / 3;
    const pts: [number, number, number, number][] = [
      [-1, -1, u0, v0],
      [1, -1, u1, v0],
      [1, 1, u1, v1],
      [-1, 1, u0, v1],
    ];
    for (const [a, b, u, v] of pts) {
      s.pos.push(x + (rx * a + fx * b) * hs, y, z + (rz * a + fz * b) * hs);
      s.uv.push(u, v);
    }
    s.idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
  }

  private syncMovers() {
    const counts = new Map<string, number>();
    for (const p of this.placed) if (p.art.mover) counts.set(p.art.id, (counts.get(p.art.id) ?? 0) + 1);
    for (const [id, mesh] of this.movers) {
      mesh.count = 0;
      mesh.visible = false;
      void id;
    }
    for (const [id, n] of counts) {
      let mesh = this.movers.get(id);
      if (!mesh || mesh.instanceMatrix.count < n) {
        if (mesh) {
          this.group.remove(mesh);
          mesh.geometry.dispose();
          mesh.dispose();
        }
        const art = MACHINE_ART[id];
        mesh = new THREE.InstancedMesh(art.mover!.geometry(), this.feltMat, Math.max(8, n * 2));
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        mesh.castShadow = this.shadows;
        mesh.name = `mover-${id}`;
        this.movers.set(id, mesh);
        this.group.add(mesh);
      }
      mesh.count = n;
      mesh.visible = true;
    }
  }

  /** A machine just worked: its moving part plays for a moment. */
  poke(at: Cell, amount = 1): void {
    const k = `${at[0]},${at[1]}`;
    this.activity.set(k, Math.max(this.activity.get(k) ?? 0, amount));
  }

  clearActivity(): void {
    this.activity.clear();
  }

  setSelected(c: Cell | null): void {
    this.selAt = c;
    this.selRing.visible = Boolean(c);
    if (c) this.cellCenter(c, this.selRing.position).y = TILE_Y + 0.03;
  }

  setHint(c: Cell | null): void {
    this.hintAt = c;
    this.hintRing.visible = Boolean(c);
    if (c) this.cellCenter(c, this.hintRing.position).y = TILE_Y + 0.035;
  }

  setSlots(cells: Cell[]): void {
    this.slotCells = cells;
    this.slotRings.count = cells.length;
  }

  /** Free tiles where the chosen tool can go (a soft glow). */
  setToolCells(cells: Cell[]): void {
    const n = Math.min(cells.length, 200);
    for (let i = 0; i < n; i++) {
      this.cellCenter(cells[i], tmpV);
      tmpM.makeTranslation(tmpV.x, TILE_Y + 0.02, tmpV.z);
      this.toolCells.setMatrixAt(i, tmpM);
    }
    this.toolCells.count = n;
    this.toolCells.instanceMatrix.needsUpdate = true;
  }

  update(t: number, dt: number, beltSpeed: number): void {
    // Belts: one scroll for all (each band's UVs follow its own direction).
    const map = this.beltMat.map as THREE.Texture;
    map.offset.y -= dt * beltSpeed;
    if (map.offset.y < -1) map.offset.y += 1;
    // Movers.
    const idx = this.moverIdx;
    idx.clear();
    for (const p of this.placed) {
      const mv = p.art.mover;
      if (!mv) continue;
      const mesh = this.movers.get(p.art.id);
      if (!mesh) continue;
      const i = idx.get(p.art.id) ?? 0;
      idx.set(p.art.id, i + 1);
      const act = this.reduced ? 0 : (this.activity.get(p.key) ?? 0);
      mv.pose(tmpL.identity(), t + p.piece.at[0] * 0.37 + p.piece.at[1] * 0.61, act, (p.piece.dial ?? getMachine(p.piece.machine)?.dial.defaults ?? {}) as Record<string, unknown>);
      tmpM.multiplyMatrices(p.base, tmpL);
      mesh.setMatrixAt(i, tmpM);
    }
    for (const mesh of this.movers.values()) if (mesh.visible) mesh.instanceMatrix.needsUpdate = true;
    for (const [k, v] of this.activity) {
      const nv = v - dt * 1.6;
      if (nv <= 0) this.activity.delete(k);
      else this.activity.set(k, nv);
    }
    // Highlights: a gentle pulse (still with reduced motion).
    const pulse = this.reduced ? 0.85 : 0.65 + Math.sin(t * 4) * 0.25;
    (this.slotRings.material as THREE.MeshBasicMaterial).opacity = Math.min(1, pulse * 1.1);
    for (let i = 0; i < this.slotCells.length; i++) {
      this.cellCenter(this.slotCells[i], tmpV);
      const s = this.reduced ? 1 : 1 + Math.sin(t * 4) * 0.03;
      tmpM.makeScale(s, 1, s).setPosition(tmpV.x, TILE_Y + 0.025, tmpV.z);
      this.slotRings.setMatrixAt(i, tmpM);
    }
    if (this.slotCells.length) this.slotRings.instanceMatrix.needsUpdate = true;
    if (this.hintAt) {
      const s = this.reduced ? 1 : 1 + Math.sin(t * 5) * 0.08;
      this.hintRing.scale.set(s, 1, s);
    }
    if (this.selAt) this.selRing.rotation.y = this.reduced ? 0 : Math.sin(t * 2) * 0.06;
  }

  dispose(): void {
    this.atlas.dispose();
    this.beltMat.map?.dispose();
    this.beltMat.dispose();
    this.signMat.dispose();
    this.feltMat.dispose();
  }
}

