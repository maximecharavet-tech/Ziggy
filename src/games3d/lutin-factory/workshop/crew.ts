import * as THREE from 'three';
import { CrewCard, cardMaterial, type CrewAtlas, type CrewId } from './impostor';

/**
 * The crew on the workshop floor: Pépin, Grelotte and Noisette behind the
 * workbench (they hop to the machine they run), Ziggy at the sleigh sacks
 * reading the letter and checking every toy. Always happy (design doc B8):
 * salutes, button presses, laughs, cheers; a different toy is a giggle.
 * Reduced motion: no hops (they step), smaller squash, calm idles.
 */

interface Act {
  frames: string[];
  fps: number;
  until: number;
}

interface Member {
  id: CrewId;
  card: CrewCard;
  home: THREE.Vector3;
  pos: THREE.Vector3;
  hopFrom: THREE.Vector3;
  hopTo: THREE.Vector3;
  hopT: number;
  hopLen: number;
  lastHop: number;
  act: Act | null;
  idle: string;
  blinkAt: number;
  squash: number;
  phase: number;
  facing: 1 | -1;
}

const M4 = new THREE.Matrix4();

const IDLE: Record<CrewId, string> = { pepin: 'stand', grelotte: 'stand', noisette: 'stand', ziggy: 'idle' };

export class Crew {
  readonly group = new THREE.Group();
  private members = new Map<CrewId, Member>();
  private material: THREE.MeshBasicMaterial;
  private shadows: THREE.InstancedMesh;
  private t = 0;
  private minX = -2;
  private maxX = 2;
  reduced = false;

  constructor(atlas: CrewAtlas, cameraPitch: number) {
    this.group.name = 'crew';
    this.material = cardMaterial(atlas.texture);
    const blob = new THREE.CircleGeometry(0.5, 20);
    blob.rotateX(-Math.PI / 2);
    this.shadows = new THREE.InstancedMesh(blob, new THREE.MeshBasicMaterial({ color: '#3a2418', transparent: true, opacity: 0.28, depthWrite: false }), 4);
    this.shadows.frustumCulled = false;
    this.shadows.renderOrder = 1;
    this.group.add(this.shadows);
    for (const [id, sheet] of atlas.sheets) {
      const card = new CrewCard(sheet, this.material, cameraPitch);
      this.group.add(card.mesh);
      const v = new THREE.Vector3();
      this.members.set(id, {
        id,
        card,
        home: v.clone(),
        pos: v.clone(),
        hopFrom: v.clone(),
        hopTo: v.clone(),
        hopT: 1,
        hopLen: 0.45,
        lastHop: -10,
        act: null,
        idle: IDLE[id],
        blinkAt: 1 + Math.random() * 3,
        squash: 0,
        phase: Math.random() * 6,
        facing: 1,
      });
    }
  }

  /** Stand everyone in place for a board of w × h tiles. */
  layout(w: number, h: number, crewZ: number): void {
    this.minX = -w / 2 + 0.2;
    this.maxX = w / 2 - 0.2;
    const homes: Record<CrewId, [number, number]> = {
      pepin: [-w / 2 + 0.4, crewZ],
      grelotte: [Math.min(0, w / 2 - 2.2), crewZ - 0.05],
      noisette: [w / 2 - 1.1, crewZ + 0.1],
      ziggy: [w / 2 + 0.95, crewZ + 0.55],
    };
    for (const m of this.members.values()) {
      const [x, z] = homes[m.id];
      m.home.set(x, 0, z);
      m.pos.copy(m.home);
      m.hopFrom.copy(m.home);
      m.hopTo.copy(m.home);
      m.hopT = 1;
      m.act = null;
      m.facing = m.id === 'ziggy' ? -1 : 1;
    }
  }

  get(id: CrewId): Member | undefined {
    return this.members.get(id);
  }

  /** World position of a member (speech bubbles, sparkles). */
  position(id: CrewId, out = new THREE.Vector3()): THREE.Vector3 {
    const m = this.members.get(id);
    return m ? out.copy(m.pos) : out.set(0, 0, 0);
  }

  /** Play a few frames for `seconds`, then back to idle. */
  play(id: CrewId, frames: string[], seconds = 1.2, fps = 4): void {
    const m = this.members.get(id);
    if (!m) return;
    m.act = { frames, fps: this.reduced ? Math.min(fps, 2) : fps, until: this.t + seconds };
    m.squash = this.reduced ? 0.04 : 0.12;
  }

  /** Hop along the crew line to stand behind a machine's column. */
  hopTo(id: CrewId, x: number, force = false): void {
    const m = this.members.get(id);
    if (!m || id === 'ziggy') return;
    if (!force && this.t - m.lastHop < 1.3) return;
    let tx = Math.min(this.maxX, Math.max(this.minX, x));
    // Do not stand on a friend's feet.
    const gap = 0.95;
    for (const o of this.members.values()) if (o !== m && o.id !== 'ziggy' && Math.abs(o.hopTo.x - tx) < gap) tx = tx >= o.hopTo.x ? o.hopTo.x + gap : o.hopTo.x - gap;
    tx = Math.min(this.maxX + 0.6, Math.max(this.minX - 0.6, tx));
    if (Math.abs(tx - m.pos.x) < 0.1) return;
    m.facing = tx > m.pos.x ? 1 : -1;
    m.hopFrom.copy(m.pos);
    m.hopTo.set(tx, 0, m.home.z);
    m.hopLen = Math.min(0.9, 0.3 + Math.abs(tx - m.pos.x) * 0.12);
    m.hopT = this.reduced ? 1 : 0;
    if (this.reduced) m.pos.copy(m.hopTo);
    m.lastHop = this.t;
  }

  goHome(): void {
    for (const m of this.members.values()) if (m.id !== 'ziggy') this.hopTo(m.id, m.home.x, true);
  }

  /** Everybody cheers (the letter is done). */
  cheerAll(): void {
    this.play('ziggy', ['cheer1', 'cheer2', 'jump', 'cheer2'], 2.6, 4);
    this.play('pepin', ['laugh1', 'laugh2', 'wave1', 'wave2'], 2.6, 5);
    this.play('grelotte', ['wave1', 'wave2'], 2.6, 4);
    this.play('noisette', ['tiptoe', 'laugh1', 'laugh2'], 2.6, 4);
  }

  update(dt: number, camera: THREE.Camera): void {
    this.t += dt;
    const t = this.t;
    let i = 0;
    const m4 = M4;
    void camera;
    for (const m of this.members.values()) {
      // Hop.
      let hopY = 0;
      if (m.hopT < 1) {
        m.hopT = Math.min(1, m.hopT + dt / m.hopLen);
        const k = m.hopT;
        m.pos.lerpVectors(m.hopFrom, m.hopTo, k * k * (3 - 2 * k));
        hopY = Math.sin(Math.PI * k) * (0.25 + 0.1 * Math.abs(m.hopTo.x - m.hopFrom.x));
        if (m.hopT >= 1) m.squash = this.reduced ? 0.03 : 0.14;
      }
      // Frame: an action, else idle with blinks.
      let frame = m.idle;
      if (m.act && t < m.act.until) frame = m.act.frames[Math.floor(t * m.act.fps) % m.act.frames.length];
      else {
        m.act = null;
        if (m.hopT < 1) frame = m.id === 'ziggy' ? 'idle' : 'tiptoe';
        else if (t > m.blinkAt) {
          frame = 'blink';
          if (t > m.blinkAt + 0.14) m.blinkAt = t + 2 + Math.random() * 3.5;
        }
      }
      m.card.setFrame(frame);
      // Squash and breathing.
      m.squash = Math.max(0, m.squash - dt * 0.9);
      const sq = m.squash > 0 ? Math.sin((1 - m.squash / 0.14) * Math.PI * 2) * m.squash : 0;
      const breathe = this.reduced ? 0 : Math.sin(t * 1.9 + m.phase) * 0.012;
      const sy = 1 - sq + breathe;
      const sx = (1 + sq * 0.6) * m.facing;
      const mesh = m.card.mesh;
      mesh.position.set(m.pos.x, hopY, m.pos.z);
      mesh.scale.set(sx, sy, 1);
      mesh.rotation.z = this.reduced ? 0 : Math.sin(t * 0.8 + m.phase) * 0.015;
      // Contact shadow (smaller in the air).
      const s = (m.id === 'noisette' ? 0.5 : m.id === 'ziggy' ? 1.0 : 0.75) * (1 - Math.min(0.5, hopY));
      m4.makeScale(s, 1, s * 0.7).setPosition(m.pos.x, 0.012, m.pos.z + 0.05);
      this.shadows.setMatrixAt(i++, m4);
    }
    this.shadows.count = i;
    this.shadows.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    for (const m of this.members.values()) m.card.dispose();
    this.material.dispose();
    this.shadows.geometry.dispose();
  }
}
