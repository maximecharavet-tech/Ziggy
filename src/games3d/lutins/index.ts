import * as THREE from 'three';
import { disposeTree, prefersLowPower, studioEnvironment } from '../kit/look';
import { fitOrtho, fitSphereDistance, orbit, packRow, sheetViews, stageCamera } from './framing';
import { makeElf, type ElfActor } from './elf';
import { buildHero, type HeroSet } from './hero';
import { ELF_IDS, type ElfId, type ElfPose, type LutinsSceneHandle, type LutinsSceneOptions, type SheetLayout, type StageCamera } from './types';

export { makeElf, buildElf, ElfRig, ELF_COLORS, type ElfActor, type ElfModel, type ElfOptions } from './elf';
export { ELF_IDS, ELF_POSES, type ElfId, type ElfPose, type LutinsSceneHandle, type LutinsSceneOptions, type SheetLayout, type StageCamera } from './types';

/** Very light neutral backdrop of the turnarounds; the line-ups are pure white. */
const SHEET_BG = '#f6f4f1';

/** A soft round shadow under a foot or a group (alpha texture, no light needed). */
function contactBlob(rx: number, rz: number, opacity: number): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, `rgba(30,24,20,${opacity})`);
  grad.addColorStop(0.55, `rgba(30,24,20,${opacity * 0.45})`);
  grad.addColorStop(1, 'rgba(30,24,20,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(rx * 2, rz * 2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.002;
  m.renderOrder = -1;
  return m;
}

/**
 * Soft "photo studio" light: a big soft key from the front left, a warm
 * fill from the right, a sky/floor bounce and a gentle rim from behind.
 */
function studioLights(root: THREE.Object3D, low: boolean, shadowHalf: number, center: THREE.Vector3) {
  // Bounce from a white studio: soft, slightly warm from below.
  root.add(new THREE.HemisphereLight('#fbf7f2', '#bfae9c', 0.75));
  // The big soft key (a softbox up front-left).
  const key = new THREE.DirectionalLight('#fff3e6', 2.3);
  key.position.set(center.x - 2.6, center.y + 3.4, center.z + 3.2);
  key.target.position.copy(center);
  key.castShadow = true;
  const size = low ? 1024 : 4096;
  key.shadow.mapSize.set(size, size);
  Object.assign(key.shadow.camera, { left: -shadowHalf, right: shadowHalf, top: shadowHalf, bottom: -shadowHalf, near: 0.5, far: 20 });
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.012;
  key.shadow.radius = 5;
  key.shadow.blurSamples = 16;
  root.add(key, key.target);
  // Fill card on the right, a little cooler.
  const fill = new THREE.DirectionalLight('#f2f0ff', 0.7);
  fill.position.set(center.x + 3.2, center.y + 1.0, center.z + 2.2);
  fill.target.position.copy(center);
  root.add(fill, fill.target);
  // Hair light from behind: the felt fuzz glows on the edges.
  const rim = new THREE.DirectionalLight('#fff8ee', 1.2);
  rim.position.set(center.x + 1.0, center.y + 3.0, center.z - 3.5);
  rim.target.position.copy(center);
  root.add(rim, rim.target);
}

/** Shadow catcher: an invisible floor that only shows the elves' shadows. */
function shadowFloor(size: number, opacity: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShadowMaterial({ opacity, color: '#2a2018' }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

/** Where the stage elves stand (left to right) and how they start. */
function stagePlacement(ids: ElfId[]): { id: ElfId; x: number; z: number; rotY: number; pose: ElfPose; side: 1 | -1 }[] {
  const defaults: Record<ElfId, ElfPose> = { pepin: 'wave', grelotte: 'stand', noisette: 'sit' };
  const n = ids.length;
  return ids.map((id, i) => {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    const small = id === 'noisette';
    // Gestures go outward (a wave toward the edge, not into a friend's face).
    return { id, x: t * 0.9 * Math.max(1, n - 1), z: small ? 0.25 : 0, rotY: -t * 0.35, pose: defaults[id], side: t < 0 ? -1 : 1 };
  });
}

/**
 * Mounts the elves on a canvas.
 *
 * - `hero`: a cosy night living-room corner (tree, presents, snowy window)
 *   with the three elves mid-prank, gently animated (landing page).
 * - `stage`: transparent background, the chosen elves together on an
 *   invisible floor with soft contact shadows, orbit camera (`setCamera`):
 *   the offline "AR" overlay on a parent's photo.
 * - `sheet`: still reference renders (`renderSheetFrame()`), see SheetLayout.
 *
 * Everything is code-built (no asset). Call `resize()` when the canvas box
 * changes (a ResizeObserver also follows it) and `dispose()` when done.
 */
export function mountLutinsScene(canvas: HTMLCanvasElement, opts: LutinsSceneOptions): LutinsSceneHandle {
  const low = opts.lowPower ?? prefersLowPower();
  const reduce = Boolean(opts.reducedMotion);
  const sheet = opts.mode === 'sheet';
  const transparent = Boolean(opts.transparent);
  const layout: SheetLayout = opts.sheet ?? { kind: 'lineup' };

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: transparent,
    premultipliedAlpha: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: transparent || sheet,
  });
  const ratio = opts.pixelRatio ?? Math.min(window.devicePixelRatio || 1, low ? 1 : 1.75);
  renderer.setPixelRatio(ratio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // Neutral tone mapping keeps the felt colours true (no orange reds, no neon).
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  if (transparent) renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 50);
  const actors: ElfActor[] = [];
  const envCleanups: (() => void)[] = [];
  const energy = reduce ? 0.4 : 1;

  const addElf = (id: ElfId, pose: ElfPose) => {
    const a = makeElf(id, { lowPower: low, pose });
    a.userData.rig.energy = energy;
    envCleanups.push(studioEnvironment(renderer, a, sheet ? 0.35 : 0.3));
    actors.push(a);
    scene.add(a);
    return a;
  };

  let hero: HeroSet | null = null;
  let width = 1;
  let height = 1;
  let disposed = false;
  let stageCam = stageCamera(opts.camera);
  const stageFocus = new THREE.Vector3(0, 0.45, 0.05);
  let stageRadius = 0.9;

  // ---------------------------------------------------------------------
  if (opts.mode === 'hero') {
    hero = buildHero({ lowPower: low, energy });
    scene.add(hero.root);
    scene.background = transparent ? null : hero.background;
    scene.fog = hero.fog;
    for (const spot of hero.spots) {
      const a = addElf(spot.id, opts.poses?.[spot.id] ?? spot.pose);
      a.position.copy(spot.pos);
      a.rotation.y = spot.rotY;
      a.userData.rig.setPose(opts.poses?.[spot.id] ?? spot.pose, spot.side);
      a.userData.rig.snap();
    }
    hero.bind(actors);
    // No bloom: it veils the felt in a milky haze (and once whited out a game);
    // the bulbs shine with their own glow sprites.
  } else if (opts.mode === 'stage') {
    const ids = (opts.elves?.length ? opts.elves : [...ELF_IDS]).filter((id, i, all) => ELF_IDS.includes(id) && all.indexOf(id) === i);
    const root = new THREE.Group();
    scene.add(root);
    studioLights(root, low, 2, stageFocus);
    root.add(shadowFloor(8, 0.32));
    let minX = 0;
    let maxX = 0;
    for (const p of stagePlacement(ids)) {
      const a = addElf(p.id, opts.poses?.[p.id] ?? p.pose);
      a.userData.rig.setPose(opts.poses?.[p.id] ?? p.pose, p.side);
      a.userData.rig.snap();
      a.position.set(p.x, 0, p.z);
      a.rotation.y = p.rotY;
      const blob = contactBlob(p.id === 'noisette' ? 0.2 : 0.32, p.id === 'noisette' ? 0.16 : 0.22, 0.38);
      blob.position.set(p.x, 0.002, p.z + 0.02);
      root.add(blob);
      minX = Math.min(minX, p.x - 0.35);
      maxX = Math.max(maxX, p.x + 0.35);
    }
    stageFocus.x = (minX + maxX) / 2;
    stageRadius = Math.max(0.75, (maxX - minX) / 2 + 0.15);
    if (!transparent) scene.background = new THREE.Color(SHEET_BG);
  } else {
    // Sheet: every view is its own elf, all in one scene, side by side.
    const views = sheetViews(layout);
    // Turnaround views overlap a little (the front one stands nearest) so the elf stays big.
    const gap = layout.kind === 'turnaround' ? -0.1 : 0.08;
    const extents = views.map((v) => {
      const a = addElf(v.elf, layout.kind === 'avatar' ? 'wave' : 'stand');
      a.rotation.y = layout.kind === 'avatar' ? 0.3 : v.yaw;
      a.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(a);
      return { min: b.min.x, max: b.max.x };
    });
    packRow(extents, gap).forEach((x, i) => actors[i].position.set(x, 0, layout.kind === 'turnaround' ? 0.4 - i * 0.4 : 0));
    const lights = new THREE.Group();
    studioLights(lights, low, 2.4, new THREE.Vector3(0, 0.5, 0));
    scene.add(lights);
    if (layout.kind === 'turnaround') {
      // A soft floor shadow under each view (the line-ups stay pure white, no floor).
      scene.add(shadowFloor(12, 0.2));
      actors.forEach((a) => {
        const blob = contactBlob(a.userData.id === 'noisette' ? 0.2 : 0.34, a.userData.id === 'noisette' ? 0.16 : 0.26, 0.28);
        blob.position.set(a.position.x, 0.002, a.position.z + 0.02);
        scene.add(blob);
      });
    }
  }

  // ---------------------------------------------------------------------
  // Sheet rendering

  const renderSheet = () => {
    if (disposed) return;
    const W = canvas.width;
    const Hh = canvas.height;
    const pure = layout.kind === 'lineup' || layout.kind === 'lineup34';
    scene.background = null;
    if (transparent) renderer.setClearColor(0x000000, 0);
    else renderer.setClearColor(pure ? '#ffffff' : SHEET_BG, 1);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const a of actors) box.expandByObject(a);
    if (layout.kind === 'avatar') {
      // A cheerful bust: head, hat and shoulders, seen a little from above.
      const d = actors[0].userData.model.dims;
      const bottom = d.headCenter - d.headSize * 2.0;
      const top = box.max.y + 0.01;
      const cx = (box.max.x + box.min.x) / 2;
      const cy = (top + bottom) / 2;
      const radius = Math.max((top - bottom) / 2, (box.max.x - box.min.x) / 2) * 1.0;
      camera.fov = 24;
      camera.aspect = W / Hh;
      camera.updateProjectionMatrix();
      const p = orbit({ x: cx, y: cy, z: 0 }, 0, 6, fitSphereDistance(radius, camera.fov, camera.aspect));
      camera.position.set(p.x, p.y, p.z);
      camera.lookAt(cx, cy, 0);
      renderer.render(scene, camera);
      return;
    }
    const f = fitOrtho({ minX: box.min.x, maxX: box.max.x, minY: Math.min(0, box.min.y), maxY: box.max.y }, W / Hh, 0.045);
    Object.assign(ortho, f);
    ortho.updateProjectionMatrix();
    ortho.position.set(0, 0, 10);
    ortho.lookAt(0, 0, 0);
    renderer.render(scene, ortho);
  };

  // ---------------------------------------------------------------------
  // Live cameras

  const base = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  const frameCamera = () => {
    const aspect = width / height;
    camera.aspect = aspect;
    if (hero) {
      const f = hero.frame(aspect);
      camera.fov = f.fov;
      base.pos.copy(f.pos);
      base.target.copy(f.target);
    } else if (opts.mode === 'stage') {
      camera.fov = 28;
      const dist = fitSphereDistance(stageRadius, camera.fov, aspect) / stageCam.zoom;
      const p = orbit(stageFocus, stageCam.azimuth, stageCam.elevation, dist);
      base.pos.set(p.x, p.y, p.z);
      base.target.copy(stageFocus);
    }
    camera.updateProjectionMatrix();
    camera.position.copy(base.pos);
    camera.lookAt(base.target);
  };

  const resize = () => {
    if (disposed) return;
    width = Math.max(1, Math.round(canvas.clientWidth || canvas.width / ratio || 1));
    height = Math.max(1, Math.round(canvas.clientHeight || canvas.height / ratio || 1));
    renderer.setSize(width, height, false);
    if (sheet) renderSheet();
    else frameCamera();
  };
  resize();

  // ---------------------------------------------------------------------
  // Loop (hero, stage)

  let raf = 0;
  let hidden = typeof document !== 'undefined' && document.hidden;
  const timer = new THREE.Timer();
  let time = 0;
  const tmp = new THREE.Vector3();
  const loop = () => {
    raf = requestAnimationFrame(loop);
    timer.update();
    const raw = timer.getDelta();
    if (hidden) return;
    const dt = Math.min(0.05, raw);
    time += dt;
    if (hero && !reduce) {
      const off = tmp.copy(base.pos).sub(base.target);
      off.applyAxisAngle(THREE.Object3D.DEFAULT_UP, Math.sin(time * 0.12) * 0.035);
      camera.position.copy(base.target).add(off);
      camera.position.y += Math.sin(time * 0.19) * 0.03;
      camera.lookAt(base.target);
    }
    for (const a of actors) {
      const rig = a.userData.rig;
      // Look toward the camera (a little).
      a.getWorldPosition(tmp);
      rig.gaze.x = THREE.MathUtils.clamp((camera.position.x - tmp.x) * 0.2, -0.5, 0.5);
      rig.update(dt);
    }
    hero?.update(dt, time);
    renderer.render(scene, camera);
  };
  const onVisibility = () => {
    hidden = document.hidden;
    timer.update();
  };
  const ro = !sheet && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
  if (!sheet) {
    document.addEventListener('visibilitychange', onVisibility);
    ro?.observe(canvas);
    loop();
  }

  return {
    canvas,
    setPose(id: ElfId, pose: ElfPose) {
      for (const a of actors) {
        if (a.userData.id !== id) continue;
        a.userData.rig.setPose(pose);
        if (sheet) a.userData.rig.snap();
      }
      if (sheet) renderSheet();
    },
    setCamera(cam: StageCamera) {
      stageCam = stageCamera({ ...stageCam, ...cam });
      if (opts.mode === 'stage') frameCamera();
    },
    resize,
    renderSheetFrame: sheet ? renderSheet : undefined,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      ro?.disconnect();
      timer.dispose();
      envCleanups.forEach((f) => f());
      if (hero) disposeTree(hero.root);
      for (const a of actors) disposeTree(a);
      disposeTree(scene);
      scene.clear();
      renderer.dispose();
    },
  };
}
