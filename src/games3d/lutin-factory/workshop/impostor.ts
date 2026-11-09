import * as THREE from 'three';
import { makeElf, type ElfActor } from '@/games3d/lutins/elf';
import type { ElfPose } from '@/games3d/lutins/types';
import { makeZiggy, type ZiggyActor } from '@/games3d/kit/models';
import { studioEnvironment, disposeTree } from '@/games3d/kit/look';
import type { ZiggyCue } from '@/games3d/ziggy/types';

/**
 * Baked crew sprites. The real felt elves and Ziggy (the exact hero models,
 * same rigs and poses) are rendered ONCE at load into an atlas of frames,
 * from a friendly 3/4 view; in the workshop each character is then a single
 * textured card. Why: the hero models cost ≈ 250 draw calls and 150k
 * triangles together, the whole low-power budget (docs/GAME_ARCHITECTURE.md
 * §4); four cards cost 4 draw calls. The workshop camera never orbits, so
 * the cards look like the 3D characters; motion comes from frame changes,
 * hops, squash and breathing.
 */

export type CrewId = 'pepin' | 'grelotte' | 'noisette' | 'ziggy';
export const CREW: CrewId[] = ['pepin', 'grelotte', 'noisette', 'ziggy'];

export const ELF_FRAMES = ['stand', 'blink', 'wave1', 'wave2', 'laugh1', 'laugh2', 'point', 'tiptoe', 'sit', 'peek'] as const;
export const ZIGGY_FRAMES = ['idle', 'blink', 'read', 'cheer1', 'cheer2', 'jump', 'think', 'wave1', 'wave2', 'love', 'giggle'] as const;
export type FrameName = (typeof ELF_FRAMES)[number] | (typeof ZIGGY_FRAMES)[number];

export interface CharSheet {
  id: CrewId;
  /** Card size in world units on the billboard (width, height) and where the feet are (0..1 from the bottom). */
  width: number;
  height: number;
  feet: number;
  frames: Map<string, [number, number, number, number]>;
}

export interface CrewAtlas {
  texture: THREE.Texture;
  sheets: Map<CrewId, CharSheet>;
  dispose(): void;
}

/** Ziggy stands a little taller than the elves (he is their big plush friend). */
export const ZIGGY_SCALE = 0.62;
const BAKE_PITCH = (14 * Math.PI) / 180;

function lights(scene: THREE.Scene): THREE.Light[] {
  const hemi = new THREE.HemisphereLight('#fff4e6', '#a07a5a', 1.25);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#fff0dc', 2.2);
  key.position.set(-2.5, 4, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#ffe8c8', 0.9);
  rim.position.set(2, 3, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight('#f2f0ff', 0.5);
  fill.position.set(3, 1, 2);
  scene.add(fill);
  return [hemi, key, rim, fill];
}

function advance(update: (dt: number) => void, seconds: number) {
  let t = seconds;
  while (t > 1e-6) {
    const d = Math.min(0.033, t);
    update(d);
    t -= d;
  }
}

function elfFrame(actor: ElfActor, name: string) {
  const rig = actor.userData.rig;
  const pose: Record<string, ElfPose> = { stand: 'stand', blink: 'stand', wave1: 'wave', wave2: 'wave', laugh1: 'laugh', laugh2: 'laugh', point: 'point', tiptoe: 'tiptoe', sit: 'sit', peek: 'peek' };
  rig.energy = 1;
  rig.gaze = { x: 0, y: 0.1 };
  rig.setPose(pose[name] ?? 'stand', 1);
  rig.snap();
  advance((d) => rig.update(d), 0.05);
  if (name === 'wave2') advance((d) => rig.update(d), 0.37);
  if (name === 'laugh2') advance((d) => rig.update(d), 0.2);
  if (name === 'blink') {
    rig.blink();
    advance((d) => rig.update(d), 0.07);
  }
}

function ziggyFrame(actor: ZiggyActor, name: string, letter: THREE.Object3D) {
  const rig = actor.userData.rig;
  const model = actor.userData.model;
  rig.carrying = name === 'read';
  letter.visible = name === 'read';
  rig.mood = name === 'think' ? 'curious' : name.startsWith('cheer') || name === 'jump' || name === 'giggle' ? 'excited' : 'happy';
  const cue: Partial<Record<string, [ZiggyCue, number]>> = {
    cheer1: ['cheer', 0.45],
    cheer2: ['cheer', 0.9],
    jump: ['jump', 0.42],
    think: ['think', 1.0],
    wave1: ['wave', 0.7],
    wave2: ['wave', 0.95],
    love: ['love', 1.0],
    giggle: ['giggle', 0.45],
  };
  advance((d) => rig.update(d), 0.6);
  const c = cue[name];
  if (c) {
    rig.cue(c[0]);
    advance((d) => rig.update(d), c[1]);
  }
  void model;
}

/**
 * Bake every frame of the crew into one render target. `cell` = pixels per
 * card width (lower on the low-power path).
 */
export function bakeCrew(renderer: THREE.WebGLRenderer, opts: { low: boolean }): CrewAtlas {
  const low = opts.low;
  const cell = low ? 112 : 176;
  const actors: { id: CrewId; obj: THREE.Object3D; frames: readonly string[]; set: (name: string) => void; cleanup?: () => void }[] = [];
  for (const id of ['pepin', 'grelotte', 'noisette'] as const) {
    const a = makeElf(id, { lowPower: low });
    actors.push({ id, obj: a, frames: ELF_FRAMES, set: (n) => elfFrame(a, n) });
  }
  const z = makeZiggy({ lowPower: low });
  z.scale.setScalar(ZIGGY_SCALE);
  const letter = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.03), new THREE.MeshStandardMaterial({ color: '#fff6e2', roughness: 0.9 }));
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 12), new THREE.MeshStandardMaterial({ color: '#d8392f', roughness: 0.6 }));
  seal.rotation.x = Math.PI / 2;
  seal.position.set(0, -0.02, 0.025);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.02), new THREE.MeshStandardMaterial({ color: '#e9d3a8', roughness: 0.9 }));
  flap.position.set(0, 0.08, 0.02);
  letter.add(paper, seal, flap);
  letter.rotation.x = -0.25;
  letter.position.set(0, 0.06, 0.12);
  z.userData.model.carry.add(letter);
  actors.push({ id: 'ziggy', obj: z, frames: ZIGGY_FRAMES, set: (n) => ziggyFrame(z, n, letter) });

  // Card sizes from each character's standing height.
  const box = new THREE.Box3();
  const sizes = actors.map((a) => {
    a.set(a.frames[0]);
    a.obj.updateMatrixWorld(true);
    box.setFromObject(a.obj);
    const h = box.max.y - Math.min(0, box.min.y);
    const width = h * (a.id === 'ziggy' ? 1.25 : 1.2) + (a.id === 'noisette' ? 0.25 : 0.1);
    const height = h * (a.id === 'ziggy' ? 1.32 : 1.28) + 0.12;
    return { width, height };
  });
  const cols = Math.max(...actors.map((a) => a.frames.length));
  const rowsPx = sizes.map((s) => Math.round((cell * s.height) / s.width));
  const W = cols * cell;
  const H = rowsPx.reduce((a, b) => a + b, 0);
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: low ? 0 : 4, type: THREE.UnsignedByteType, colorSpace: THREE.NoColorSpace });
  rt.texture.generateMipmaps = false;
  rt.texture.minFilter = THREE.LinearFilter;
  rt.texture.magFilter = THREE.LinearFilter;

  const scene = new THREE.Scene();
  const lit = lights(scene);
  const base = lit.map((l) => l.intensity);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
  const prevTarget = renderer.getRenderTarget();
  const prevClear = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  const prevShadow = renderer.shadowMap.enabled;
  const prevAuto = renderer.autoClear;
  renderer.shadowMap.enabled = false;
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(rt);
  renderer.clear();

  const sheets = new Map<CrewId, CharSheet>();
  let y0 = 0;
  actors.forEach((a, i) => {
    const { width, height } = sizes[i];
    const feet = 0.07;
    // Camera looks at the card centre; the feet sit `feet` up from the bottom.
    const ty = (height * (0.5 - feet)) / Math.cos(BAKE_PITCH);
    cam.left = -width / 2;
    cam.right = width / 2;
    cam.top = height / 2;
    cam.bottom = -height / 2;
    cam.updateProjectionMatrix();
    cam.position.set(0, ty + Math.sin(BAKE_PITCH) * 10, Math.cos(BAKE_PITCH) * 10);
    cam.lookAt(0, ty, 0);
    scene.add(a.obj);
    let envOff: (() => void) | null = null;
    // Ziggy's felt is lighter than the elves': a softer light keeps his green true.
    lit.forEach((l, k) => (l.intensity = base[k] * (a.id === 'ziggy' ? 0.62 : 1)));
    if (a.id === 'ziggy') envOff = studioEnvironment(renderer, a.obj, 0.3);
    const frames = new Map<string, [number, number, number, number]>();
    const hPx = rowsPx[i];
    a.frames.forEach((name, k) => {
      a.set(name);
      a.obj.updateMatrixWorld(true);
      const x = k * cell;
      rt.viewport.set(x, y0, cell, hPx);
      rt.scissor.set(x, y0, cell, hPx);
      rt.scissorTest = true;
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, cam);
      frames.set(name, [x / W, y0 / H, (x + cell) / W, (y0 + hPx) / H]);
    });
    envOff?.();
    scene.remove(a.obj);
    sheets.set(a.id, { id: a.id, width, height, feet, frames });
    y0 += hPx;
  });

  rt.scissorTest = false;
  rt.viewport.set(0, 0, W, H);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevClear, prevAlpha);
  renderer.shadowMap.enabled = prevShadow;
  renderer.autoClear = prevAuto;
  for (const a of actors) disposeTree(a.obj);
  return {
    texture: rt.texture,
    sheets,
    dispose: () => rt.dispose(),
  };
}

/** A crew card: a vertical plane at the character's feet, frames from the atlas. */
export class CrewCard {
  readonly mesh: THREE.Mesh;
  private uv: THREE.BufferAttribute;
  private frame = '';

  constructor(
    readonly sheet: CharSheet,
    material: THREE.Material,
    cameraPitch: number
  ) {
    // The card is upright; it is stretched so that, seen from the workshop camera,
    // the character shows at its natural height (the bake looked at it from the front).
    const stretch = 1 / Math.max(0.3, Math.cos(cameraPitch));
    const g = new THREE.PlaneGeometry(sheet.width, sheet.height * stretch);
    g.translate(0, sheet.height * stretch * (0.5 - sheet.feet), 0);
    this.uv = g.attributes.uv as THREE.BufferAttribute;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.name = `crew-${sheet.id}`;
    this.mesh.renderOrder = 4;
    this.mesh.frustumCulled = false;
    this.setFrame(sheet.id === 'ziggy' ? 'idle' : 'stand');
  }

  setFrame(name: string): void {
    if (name === this.frame) return;
    const r = this.sheet.frames.get(name);
    if (!r) return;
    this.frame = name;
    const [u0, v0, u1, v1] = r;
    // PlaneGeometry uv order: (0,1) (1,1) (0,0) (1,0).
    this.uv.setXY(0, u0, v1);
    this.uv.setXY(1, u1, v1);
    this.uv.setXY(2, u0, v0);
    this.uv.setXY(3, u1, v0);
    this.uv.needsUpdate = true;
  }

  get current(): string {
    return this.frame;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
  }
}

/** Material for the cards: premultiplied (the bake was anti-aliased onto transparent black). */
export function cardMaterial(tex: THREE.Texture): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.04, depthWrite: true, side: THREE.DoubleSide });
  m.blending = THREE.CustomBlending;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = THREE.OneFactor;
  m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  return m;
}
