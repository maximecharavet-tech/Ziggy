import * as THREE from 'three';
import { disposeTree, prefersLowPower, studioEnvironment } from '../kit/look';
import { Post } from '../kit/post';
import type { BoothSceneId, BoothSlot, SantaSceneHandle, SantaSceneMode } from '@/lib/santa/types';
import { ndcRect } from './framing';
import { makeSanta, type SantaActor, type SantaPose } from './santa';
import { buildBooth, buildOffice, buildVillage, type Stage, type StageContext } from './stages';

export { makeSanta, buildSanta, SantaRig, type SantaActor, type SantaModel, type SantaPose } from './santa';
export type { SantaSceneHandle } from '@/lib/santa/types';

export interface SantaSceneOptions {
  mode: SantaSceneMode;
  /** Booth backdrop to start with (booth mode). Default 'cheminee'. */
  boothScene?: BoothSceneId;
  /** No camera drift and a calmer Santa (still rendered and alive). */
  reducedMotion?: boolean;
  /** Force the light path (fewer particles, no bloom); default: detected. */
  lowPower?: boolean;
}

type Expression = Parameters<SantaSceneHandle['setExpression']>[0];

/**
 * Mounts a Santa scene on a canvas and starts its render loop.
 *
 * - `village`: the hub hero (cabin at night, aurora, sleigh, reindeer, Ziggy the elf, Santa waving).
 * - `call`: video-call framing in Santa's cosy office (talks with `setTalk`, reacts with `setExpression`).
 * - `booth`: photo-booth backdrops (`setScene`), fixed camera, `getSlot()` gives where the child goes.
 *
 * Everything is code-built (no asset). Call `resize()` when the canvas box
 * changes and `dispose()` when done.
 */
export function mountSantaScene(canvas: HTMLCanvasElement, opts: SantaSceneOptions): SantaSceneHandle {
  const low = opts.lowPower ?? prefersLowPower();
  const reduce = Boolean(opts.reducedMotion);
  // Heavier touches (depth of field) only on strong devices: never on phones with little memory.
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }) : null;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(nav?.userAgent ?? '');
  const rich = !low && !mobile && (nav?.deviceMemory ?? 8) >= 6 && (nav?.hardwareConcurrency ?? 8) >= 6;
  const ctx: StageContext = { lowPower: low, energy: reduce ? 0.4 : 1, rich };
  const booth = opts.mode === 'booth';

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !low,
    alpha: false,
    powerPreference: 'high-performance',
    // The booth canvas is composited into a 2D canvas every frame.
    preserveDrawingBuffer: booth,
  });
  const ratio = Math.min(window.devicePixelRatio || 1, low ? 1 : 1.5);
  renderer.setPixelRatio(ratio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = low ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  const santa: SantaActor = makeSanta({ lowPower: low });
  const rig = santa.userData.rig;
  rig.energy = ctx.energy;
  // The studio reflections go on Santa only (an environment on the whole
  // scene plus bloom once veiled a game in white).
  const disposeEnv = studioEnvironment(renderer, santa, 0.35);
  scene.add(santa);

  let stage: Stage = opts.mode === 'village' ? buildVillage(ctx) : opts.mode === 'call' ? buildOffice(ctx) : buildBooth(ctx, opts.boothScene ?? 'cheminee');
  let expression: Expression = 'idle';
  let post: Post | null = null;

  const applyStage = () => {
    scene.add(stage.root);
    scene.background = stage.background;
    scene.fog = stage.fog;
    santa.position.copy(stage.santa.pos);
    santa.rotation.y = stage.santa.rotY;
    rig.side = stage.santa.side;
    rig.rest = stage.santa.rest ?? 'belly';
    applyExpression();
    post?.dispose();
    post = new Post(renderer, scene, camera, { enabled: !low, ...stage.bloom });
  };

  const applyExpression = () => {
    // In the booth and the village, "idle" means the scene's own pose
    // (posing next to the child, waving at the door).
    const pose: SantaPose = expression === 'idle' && stage.santa.pose !== 'idle' ? stage.santa.pose : expression;
    rig.setPose(pose);
  };

  let disposed = false;
  let width = 1;
  let height = 1;
  const base = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  const frameCamera = () => {
    const f = stage.frame(width / height);
    camera.fov = f.fov;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    base.pos.copy(f.pos);
    base.target.copy(f.target);
    camera.position.copy(f.pos);
    camera.lookAt(f.target);
    post?.setFocus(f.pos.distanceTo(f.target));
  };

  const resize = () => {
    if (disposed) return;
    width = Math.max(1, Math.round(canvas.clientWidth || canvas.width || 1));
    height = Math.max(1, Math.round(canvas.clientHeight || canvas.height || 1));
    renderer.setSize(width, height, false);
    post?.setSize(width, height);
    frameCamera();
  };

  applyStage();
  resize();

  // --- Loop ---------------------------------------------------------------
  const clock = new THREE.Clock();
  let raf = 0;
  let time = 0;
  let hidden = typeof document !== 'undefined' && document.hidden;
  const tmp = new THREE.Vector3();
  const slow = { t: 0, n: 0 };
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const raw = clock.getDelta();
    if (hidden) return;
    const dt = Math.min(0.05, raw);
    time += dt;
    // Gentle camera drift (never in the booth, never with reduced motion).
    if (stage.drift > 0 && !reduce) {
      const a = Math.sin(time * 0.11) * 0.05 * stage.drift;
      const off = tmp.copy(base.pos).sub(base.target);
      off.applyAxisAngle(THREE.Object3D.DEFAULT_UP, a);
      camera.position.copy(base.target).add(off);
      camera.position.y += Math.sin(time * 0.17) * 0.06 * stage.drift;
      camera.lookAt(base.target);
    }
    // Santa looks at the camera (a little), wherever he stands.
    rig.gaze.x = THREE.MathUtils.clamp((camera.position.x - santa.position.x) * 0.15, -0.4, 0.4);
    rig.gaze.y = 0;
    rig.update(dt);
    stage.update(dt, time, camera);
    post?.render(dt);
    // Adaptive quality: when frames get slow (a software GPU, a busy phone),
    // the heavy touches (depth of field, film grade) switch off for good.
    slow.t += raw;
    slow.n++;
    if (slow.t >= 2) {
      if (slow.t / slow.n > 1 / 24) post?.lighten();
      slow.t = 0;
      slow.n = 0;
    }
  };
  const onVisibility = () => {
    hidden = document.hidden;
    clock.getDelta();
  };
  document.addEventListener('visibilitychange', onVisibility);
  // Follow the canvas box on our own too (the page may forget to call resize()).
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
  ro?.observe(canvas);
  loop();

  const disposeStage = (s: Stage) => {
    scene.remove(s.root);
    for (const z of s.ziggies) {
      z.parent?.remove(z);
      z.userData.model.dispose();
    }
    disposeTree(s.root);
  };

  return {
    canvas,
    setTalk(level: number) {
      rig.setTalk(level);
    },
    setMouth(open: number, wide: number) {
      rig.setMouth(open, wide);
    },
    ziggy(cmd) {
      stage.ziggy?.(cmd);
    },
    setExpression(e: Expression) {
      expression = e;
      applyExpression();
    },
    setScene(id: BoothSceneId) {
      if (!booth || disposed) return;
      disposeStage(stage);
      stage = buildBooth(ctx, id);
      applyStage();
      resize();
    },
    getSlot(): BoothSlot {
      const s = stage.slot;
      if (!s) return { x: 0, y: 0, w: 0, h: 0 };
      camera.updateMatrixWorld();
      const pts = [
        [s.x0, s.y0],
        [s.x1, s.y0],
        [s.x0, s.y1],
        [s.x1, s.y1],
      ].map(([x, y]) => {
        const p = new THREE.Vector3(x, y, s.z).project(camera);
        return { x: p.x, y: p.y };
      });
      // In drawing-buffer pixels (canvas.width × canvas.height), origin top-left.
      return ndcRect(pts, canvas.width, canvas.height);
    },
    resize,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      ro?.disconnect();
      disposeStage(stage);
      post?.dispose();
      disposeEnv();
      disposeTree(santa);
      scene.clear();
      renderer.dispose();
    },
  };
}
