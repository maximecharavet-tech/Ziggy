import * as THREE from 'three';
import { disposeTree, prefersLowPower, studioEnvironment } from '../kit/look';
import { makeElf, type ElfActor } from './elf';
import { actionFrame, deviceQuaternion, lightFromSample, lineupDistance, recentered, yawOf, type Quat } from './ar-math';
import { ELF_IDS, type ElfId, type ElfPose } from './types';

/**
 * "La caméra magique": the felt elves standing on a virtual floor over the
 * live camera picture (or a gallery photo), all on the device.
 *
 * The canvas is transparent; the page shows the camera `<video>` under it.
 * The virtual camera stands `CAMERA_HEIGHT` above the floor plane y = 0 and
 * looks down by the pitch (a slider) or follows the phone (DeviceOrientation,
 * rotation only, recentered so the elves start in front). Perspective does
 * the rest: an elf dragged farther away gets smaller.
 *
 * Gestures on the canvas: touch an elf to pick it and drag it along the
 * floor; touch the floor to bring the picked elf there; pinch / mouse wheel
 * to resize it, twist with two fingers to turn it.
 */

export type ARAction = ElfPose | 'dance' | 'hide';
export const AR_ACTIONS: readonly ARAction[] = ['wave', 'laugh', 'peek', 'tiptoe', 'sit', 'point', 'dance', 'hide', 'stand'];

/** One placed elf (floor units: the elves' own size, Pépin ≈ 0.9 tall). */
export type ARElf = { id: ElfId; x: number; z: number; scale: number; rotY: number; action: ARAction };

/** Where an elf shows in the picture (fractions of the width / height; radius in widths), for the journal's "find the elves". */
export type ARSpot = { id: ElfId; x: number; y: number; r: number };

export type DeviceAngles = { alpha: number; beta: number; gamma: number; screen: number };

export interface LutinsAROptions {
  elves: ElfId[];
  reducedMotion?: boolean;
  lowPower?: boolean;
  /** Vertical field of view of the picture under the canvas, degrees (also `setFov`). */
  fov?: number;
  /** Called when the picked elf changes (by a touch or by `select`). */
  onSelect?: (id: ElfId | null) => void;
}

export interface LutinsARHandle {
  canvas: HTMLCanvasElement;
  list(): ARElf[];
  selected(): ElfId | null;
  select(id: ElfId | null): void;
  add(id: ElfId): void;
  remove(id: ElfId): void;
  setAction(id: ElfId, action: ARAction): void;
  /** Turn by `rad` (positive = counter-clockwise seen from above). */
  rotate(id: ElfId, rad: number): void;
  /** Multiply the size (clamped 0.35–3.5). */
  scaleBy(id: ElfId, k: number): void;
  /** Manual camera pitch in degrees (negative = looking down), used without the phone's sensors. */
  setPitch(deg: number): void;
  /** Follow the phone (null = back to the manual pitch). */
  setDeviceOrientation(o: DeviceAngles | null): void;
  /** The elves come back in front of the camera (sensors: the current heading becomes "in front"). */
  recenter(): void;
  /** Vertical field of view of the picture under the canvas (degrees). */
  setFov(deg: number): void;
  /** Average colour of the camera picture, 0–255. */
  setLight(r: number, g: number, b: number): void;
  /** Where each elf shows in the picture now. */
  spots(): ARSpot[];
  /**
   * Renders now and draws the elves over `ctx` (`w` × `h`, the same aspect
   * as the canvas). `hiRes` renders at that size for a sharp photo.
   */
  drawTo(ctx: CanvasRenderingContext2D, w: number, h: number, opts?: { hiRes?: boolean }): void;
  resize(): void;
  dispose(): void;
}

/** Height of the virtual camera above the floor, in elf units (≈ 1 m if Pépin is 30 cm). */
export const CAMERA_HEIGHT = 3.2;
const MIN_DIST = 1.2;
const MAX_DIST = 22;

type Slot = {
  el: ARElf;
  holder: THREE.Group;
  mover: THREE.Group;
  hop: THREE.Group;
  actor: ElfActor;
  blob: THREE.Mesh;
  proxy: THREE.Mesh;
  height: number;
  /** Time the current action started (s). */
  t0: number;
  lastPose: string;
};

/** A soft round contact shadow (alpha texture, no light needed). */
function blobTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(20,16,12,0.62)');
  grad.addColorStop(0.5, 'rgba(20,16,12,0.3)');
  grad.addColorStop(1, 'rgba(20,16,12,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function mountLutinsAR(canvas: HTMLCanvasElement, opts: LutinsAROptions): LutinsARHandle {
  const low = opts.lowPower ?? prefersLowPower();
  const reduce = Boolean(opts.reducedMotion);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, alpha: true, premultipliedAlpha: true, powerPreference: low ? 'low-power' : 'high-performance' });
  const ratio = Math.min(window.devicePixelRatio || 1, low ? 1.25 : 1.75);
  renderer.setPixelRatio(ratio);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = !low;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(THREE.MathUtils.clamp(opts.fov ?? 55, 15, 120), 1, 0.05, 120);
  camera.position.set(0, CAMERA_HEIGHT, 0);
  camera.rotation.order = 'YXZ';

  // Light: a sky/floor bounce tinted by the room, a soft key from above, a little fill.
  const hemi = new THREE.HemisphereLight('#fbf7f2', '#8a7b6c', 1.25);
  const key = new THREE.DirectionalLight('#fff3e6', 1.8);
  key.castShadow = !low;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  const fill = new THREE.DirectionalLight('#f2f0ff', 0.45);
  scene.add(hemi, key, key.target, fill, fill.target);
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.22, color: '#20180f' }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = 0.001;
  catcher.receiveShadow = true;
  catcher.visible = !low;
  scene.add(catcher);
  const lightNow = { sky: new THREE.Color('#fbf7f2'), ground: new THREE.Color('#8a7b6c'), exposure: 1, key: 1.8 };
  const lightTo = { sky: lightNow.sky.clone(), ground: lightNow.ground.clone(), exposure: 1, key: 1.8 };

  const blobTex = blobTexture();
  const slots: Slot[] = [];
  const envCleanups: (() => void)[] = [];
  let picked: ElfId | null = null;
  let width = 1;
  let height = 1;
  let disposed = false;
  let time = 0;
  let pitch = -32;
  let device: DeviceAngles | null = null;
  let yaw0: number | null = null;
  const qTarget = new THREE.Quaternion();
  const raycaster = new THREE.Raycaster();
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();

  const applyManualCamera = () => {
    camera.quaternion.setFromEuler(new THREE.Euler(pitch * THREE.MathUtils.DEG2RAD, 0, 0, 'YXZ'));
  };
  applyManualCamera();

  /** Floor point under a picture position (NDC −1..1). */
  const floorAt = (nx: number, ny: number, out: THREE.Vector3): THREE.Vector3 => {
    camera.updateMatrixWorld();
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const hit = raycaster.ray.intersectPlane(floor, out);
    const flat = tmpV2.set(raycaster.ray.direction.x, 0, raycaster.ray.direction.z);
    if (!hit || out.distanceTo(camera.position) > MAX_DIST * 1.5) {
      // Looking at or above the horizon: as far as allowed along the heading.
      if (flat.lengthSq() < 1e-6) flat.set(0, 0, -1);
      flat.normalize().multiplyScalar(MAX_DIST);
      out.set(camera.position.x + flat.x, 0, camera.position.z + flat.z);
    }
    return out;
  };

  const clampSpot = (el: ARElf) => {
    const dx = el.x - camera.position.x;
    const dz = el.z - camera.position.z;
    const d = Math.hypot(dx, dz);
    if (d < MIN_DIST || d > MAX_DIST) {
      const k = THREE.MathUtils.clamp(d, MIN_DIST, MAX_DIST) / Math.max(1e-6, d);
      el.x = camera.position.x + (d < 1e-6 ? 0 : dx * k);
      el.z = camera.position.z + (d < 1e-6 ? -MIN_DIST : dz * k);
    }
  };

  const faceCamera = (el: ARElf) => {
    el.rotY = Math.atan2(camera.position.x - el.x, camera.position.z - el.z);
  };

  const sync = (s: Slot) => {
    s.holder.position.set(s.el.x, 0, s.el.z);
    s.holder.rotation.y = s.el.rotY;
    s.holder.scale.setScalar(s.el.scale);
  };

  const makeSlot = (id: ElfId, el: ARElf): Slot => {
    const actor = makeElf(id, { lowPower: low, pose: 'stand' });
    actor.userData.rig.energy = reduce ? 0.4 : 1;
    actor.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = !low;
    });
    envCleanups.push(studioEnvironment(renderer, actor, 0.3));
    actor.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(actor);
    const h = Math.max(0.2, box.max.y);
    const holder = new THREE.Group();
    const mover = new THREE.Group();
    const hop = new THREE.Group();
    hop.add(actor);
    mover.add(hop);
    holder.add(mover);
    const small = id === 'noisette';
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(small ? 0.42 : 0.66, small ? 0.34 : 0.5),
      new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, toneMapped: false }),
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.003;
    blob.renderOrder = -1;
    blob.raycast = () => {};
    mover.add(blob);
    // Picking proxy: a generous invisible cylinder (fingers are big, elves are small).
    const proxy = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(0.28, h * 0.42), Math.max(0.28, h * 0.42), h * 1.15, 10), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.y = (h * 1.15) / 2;
    proxy.userData.id = id;
    mover.add(proxy);
    scene.add(holder);
    const s: Slot = { el, holder, mover, hop, actor, blob, proxy, height: h, t0: time, lastPose: '' };
    sync(s);
    return s;
  };

  /** The camera's heading on the floor and its right-hand side. */
  const heading = () => {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0);
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 1, 0).applyQuaternion(camera.quaternion).setY(0);
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    return { fwd, right: new THREE.Vector3(-fwd.z, 0, fwd.x) };
  };

  /** Spots for `n` elves, side by side in front of the camera, far enough to all fit the picture. */
  const defaultSpot = (i: number, n: number): { x: number; z: number } => {
    const { fwd, right } = heading();
    // Far enough to fit, and with the feet a little above the middle of the picture (the controls cover the bottom).
    const mid = floorAt(0, 0.0, new THREE.Vector3());
    const d = Math.max(lineupDistance(n, camera.fov, camera.aspect, CAMERA_HEIGHT), Math.min(MAX_DIST * 0.6, Math.hypot(mid.x - camera.position.x, mid.z - camera.position.z)));
    const off = (i - (n - 1) / 2) * 0.85;
    return { x: camera.position.x + fwd.x * d + right.x * off, z: camera.position.z + fwd.z * d + right.z * off };
  };

  const ids = opts.elves.filter((id, i, all) => ELF_IDS.includes(id) && all.indexOf(id) === i);

  const firstAction = (id: ElfId): ARAction => (id === 'pepin' ? 'wave' : id === 'grelotte' ? 'laugh' : 'peek');
  const place = (id: ElfId, p: { x: number; z: number }) => {
    const el: ARElf = { id, x: p.x, z: p.z, scale: 1, rotY: 0, action: firstAction(id) };
    clampSpot(el);
    faceCamera(el);
    slots.push(makeSlot(id, el));
  };
  /** A later elf comes in beside the others, alternating right and left. */
  const add = (id: ElfId) => {
    if (!ELF_IDS.includes(id) || slots.some((s) => s.el.id === id)) return;
    if (!slots.length) return place(id, defaultSpot(0, 1));
    const { right } = heading();
    const c = slots.reduce((a, s) => ({ x: a.x + s.el.x / slots.length, z: a.z + s.el.z / slots.length }), { x: 0, z: 0 });
    const side = slots.length % 2 === 0 ? -1 : 1;
    const off = side * (0.85 * Math.ceil(slots.length / 2) + 0.45);
    place(id, { x: c.x + right.x * off, z: c.z + right.z * off });
  };
  const placeAll = () => ids.forEach((id, i) => place(id, defaultSpot(i, ids.length)));

  const slotOf = (id: ElfId | null) => (id ? slots.find((s) => s.el.id === id) : undefined);

  const select = (id: ElfId | null) => {
    if (id === picked) return;
    picked = id && slotOf(id) ? id : null;
    opts.onSelect?.(picked);
  };

  // ---------------------------------------------------------------------
  // Gestures

  const pointers = new Map<number, { x: number; y: number }>();
  let drag: { id: ElfId; dx: number; dz: number } | null = null;
  let pinch: { dist: number; angle: number; scale: number; rotY: number } | null = null;

  const ndc = (e: { clientX: number; clientY: number }) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1, y: -(((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1) };
  };

  const pick = (nx: number, ny: number): ElfId | null => {
    camera.updateMatrixWorld();
    scene.updateMatrixWorld();
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const hits = raycaster.intersectObjects(
      slots.filter((s) => s.mover.scale.x > 0.2).map((s) => s.proxy),
      false,
    );
    return hits.length ? (hits[0].object.userData.id as ElfId) : null;
  };

  const twoFinger = () => {
    const [a, b] = [...pointers.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), angle: Math.atan2(b.y - a.y, b.x - a.x) };
  };

  const onDown = (e: PointerEvent) => {
    if (disposed) return;
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      drag = null;
      const s = slotOf(picked);
      if (s) pinch = { ...twoFinger(), scale: s.el.scale, rotY: s.el.rotY };
      return;
    }
    if (pointers.size > 2) return;
    const p = ndc(e);
    const hit = pick(p.x, p.y);
    const fp = floorAt(p.x, p.y, new THREE.Vector3());
    if (hit) {
      select(hit);
      const s = slotOf(hit)!;
      drag = { id: hit, dx: s.el.x - fp.x, dz: s.el.z - fp.z };
    } else if (picked) {
      drag = { id: picked, dx: 0, dz: 0 };
      onMove(e);
    }
  };

  const onMove = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const s = slotOf(picked);
      if (!s) return;
      const now = twoFinger();
      s.el.scale = THREE.MathUtils.clamp(pinch.scale * (now.dist / Math.max(10, pinch.dist)), 0.35, 3.5);
      s.el.rotY = pinch.rotY - (now.angle - pinch.angle);
      sync(s);
      return;
    }
    if (!drag) return;
    const s = slotOf(drag.id);
    if (!s) return;
    const p = ndc(e);
    const fp = floorAt(p.x, p.y, new THREE.Vector3());
    s.el.x = fp.x + drag.dx;
    s.el.z = fp.z + drag.dz;
    clampSpot(s.el);
    sync(s);
  };

  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) drag = null;
  };

  const onWheel = (e: WheelEvent) => {
    const s = slotOf(picked);
    if (!s) return;
    e.preventDefault();
    s.el.scale = THREE.MathUtils.clamp(s.el.scale * Math.exp(-e.deltaY * 0.0015), 0.35, 3.5);
    sync(s);
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // ---------------------------------------------------------------------
  // Frame

  const updateCamera = () => {
    if (device) {
      const q = deviceQuaternion(device.alpha, device.beta, device.gamma, device.screen);
      if (yaw0 === null) yaw0 = yawOf(q);
      const r = recentered(q, yaw0);
      qTarget.set(r[0], r[1], r[2], r[3]);
      camera.quaternion.slerp(qTarget, 0.35);
    }
  };

  const updateLight = (dt: number) => {
    const k = 1 - Math.exp(-dt * 2.5);
    lightNow.sky.lerp(lightTo.sky, k);
    lightNow.ground.lerp(lightTo.ground, k);
    lightNow.exposure += (lightTo.exposure - lightNow.exposure) * k;
    lightNow.key += (lightTo.key - lightNow.key) * k;
    hemi.color.copy(lightNow.sky);
    hemi.groundColor.copy(lightNow.ground);
    renderer.toneMappingExposure = lightNow.exposure;
    key.intensity = lightNow.key;
    key.color.copy(lightNow.sky).lerp(new THREE.Color('#ffffff'), 0.5);
    // Key from above and a little behind the camera; shadows fall slightly away from it.
    let cx = 0;
    let cz = 0;
    let spread = 1.5;
    for (const s of slots) {
      cx += s.el.x / Math.max(1, slots.length);
      cz += s.el.z / Math.max(1, slots.length);
    }
    for (const s of slots) spread = Math.max(spread, Math.hypot(s.el.x - cx, s.el.z - cz) + 1.2 * s.el.scale);
    const back = tmpV.set(0, 0, 1).applyQuaternion(camera.quaternion).setY(0);
    if (back.lengthSq() < 1e-6) back.set(0, 0, 1);
    back.normalize();
    key.position.set(cx + back.x * 2 - 1.2, 6, cz + back.z * 2);
    key.target.position.set(cx, 0, cz);
    fill.position.set(cx + 3, 2, cz + 2);
    fill.target.position.set(cx, 0.4, cz);
    Object.assign(key.shadow.camera, { left: -spread, right: spread, top: spread, bottom: -spread, near: 0.5, far: 20 });
    key.shadow.camera.updateProjectionMatrix();
  };

  const updateElves = (dt: number) => {
    for (const s of slots) {
      const f = actionFrame(s.el.action, time - s.t0, reduce);
      s.mover.position.set(f.x, 0, f.z);
      s.mover.rotation.y = f.rotY;
      s.hop.position.y = f.hop;
      const sc = Math.max(0.0001, f.scale);
      s.hop.scale.setScalar(sc);
      s.blob.scale.setScalar(Math.min(1, sc) * (1 - f.hop * 2));
      s.actor.visible = f.scale > 0.01;
      const poseKey = `${f.pose}|${f.side}`;
      if (poseKey !== s.lastPose) {
        s.actor.userData.rig.setPose(f.pose, f.side);
        s.lastPose = poseKey;
      }
      const rig = s.actor.userData.rig;
      s.actor.getWorldPosition(tmpV);
      // Look toward the camera a little.
      const local = s.actor.worldToLocal(tmpV2.copy(camera.position));
      rig.gaze.x = THREE.MathUtils.clamp(local.x * 0.15, -0.5, 0.5);
      rig.update(dt);
    }
  };

  let raf = 0;
  let hidden = document.hidden;
  let lastExternal = -1e9;
  const timer = new THREE.Timer();
  const loop = () => {
    raf = requestAnimationFrame(loop);
    timer.update();
    const raw = timer.getDelta();
    if (hidden || disposed) return;
    const dt = Math.min(0.05, raw);
    time += dt;
    updateCamera();
    updateElves(dt);
    updateLight(dt);
    // While a recording draws every frame itself, don't render twice.
    if (performance.now() - lastExternal > 120) renderer.render(scene, camera);
  };

  const resize = () => {
    if (disposed) return;
    width = Math.max(1, Math.round(canvas.clientWidth || 1));
    height = Math.max(1, Math.round(canvas.clientHeight || 1));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  placeAll();
  const onVisibility = () => {
    hidden = document.hidden;
    timer.update();
  };
  document.addEventListener('visibilitychange', onVisibility);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
  ro?.observe(canvas);
  loop();

  return {
    canvas,
    list: () => slots.map((s) => ({ ...s.el })),
    selected: () => picked,
    select,
    add,
    remove(id) {
      const i = slots.findIndex((s) => s.el.id === id);
      if (i < 0) return;
      const [s] = slots.splice(i, 1);
      scene.remove(s.holder);
      disposeTree(s.actor);
      s.proxy.geometry.dispose();
      s.blob.geometry.dispose();
      (s.blob.material as THREE.Material).dispose();
      if (picked === id) select(null);
    },
    setAction(id, action) {
      const s = slotOf(id);
      if (!s || !AR_ACTIONS.includes(action)) return;
      s.el.action = action;
      s.t0 = time;
    },
    rotate(id, rad) {
      const s = slotOf(id);
      if (!s || !Number.isFinite(rad)) return;
      s.el.rotY += rad;
      sync(s);
    },
    scaleBy(id, k) {
      const s = slotOf(id);
      if (!s || !(k > 0)) return;
      s.el.scale = THREE.MathUtils.clamp(s.el.scale * k, 0.35, 3.5);
      sync(s);
    },
    setPitch(deg) {
      pitch = THREE.MathUtils.clamp(Number.isFinite(deg) ? deg : -32, -85, 5);
      if (!device) applyManualCamera();
    },
    setDeviceOrientation(o) {
      if (o && [o.alpha, o.beta, o.gamma].some((v) => v == null || !Number.isFinite(v))) return;
      const was = Boolean(device);
      device = o;
      if (!o) {
        yaw0 = null;
        applyManualCamera();
      } else if (!was) {
        // Jump straight to the phone's orientation on the first reading.
        yaw0 = null;
        updateCamera();
        camera.quaternion.copy(qTarget);
      }
    },
    recenter() {
      if (device) {
        const q: Quat = deviceQuaternion(device.alpha, device.beta, device.gamma, device.screen);
        yaw0 = yawOf(q);
        updateCamera();
        camera.quaternion.copy(qTarget);
      }
      const n = slots.length;
      slots.forEach((s, i) => {
        const p = defaultSpot(i, n);
        s.el.x = p.x;
        s.el.z = p.z;
        clampSpot(s.el);
        faceCamera(s.el);
        sync(s);
      });
    },
    setFov(deg) {
      if (!Number.isFinite(deg)) return;
      camera.fov = THREE.MathUtils.clamp(deg, 15, 120);
      camera.updateProjectionMatrix();
    },
    setLight(r, g, b) {
      const m = lightFromSample(r, g, b);
      lightTo.sky.setRGB(...m.sky);
      lightTo.ground.setRGB(...m.ground);
      lightTo.exposure = m.exposure;
      lightTo.key = m.key;
    },
    spots() {
      scene.updateMatrixWorld();
      camera.updateMatrixWorld();
      const out: ARSpot[] = [];
      for (const s of slots) {
        if (!s.actor.visible) continue;
        const scale = s.el.scale * s.hop.scale.x;
        const foot = s.hop.getWorldPosition(new THREE.Vector3());
        const head = foot.clone().add(new THREE.Vector3(0, s.height * scale, 0));
        const mid = foot.clone().lerp(head, 0.5).project(camera);
        const a = foot.project(camera);
        const b = head.project(camera);
        if (mid.z > 1 || Math.abs(mid.x) > 1.1 || Math.abs(mid.y) > 1.1) continue;
        const hPx = (Math.abs(b.y - a.y) / 2) * height;
        out.push({ id: s.el.id, x: (mid.x + 1) / 2, y: (1 - mid.y) / 2, r: Math.max(0.03, (hPx * 0.55) / width) });
      }
      return out;
    },
    drawTo(ctx, w, h, o = {}) {
      if (disposed) return;
      lastExternal = performance.now();
      if (o.hiRes) {
        const r = Math.max(ratio, Math.min(3, w / width));
        renderer.setPixelRatio(r);
        renderer.setSize(width, height, false);
        renderer.render(scene, camera);
        ctx.drawImage(canvas, 0, 0, w, h);
        renderer.setPixelRatio(ratio);
        renderer.setSize(width, height, false);
        renderer.render(scene, camera);
        return;
      }
      renderer.render(scene, camera);
      ctx.drawImage(canvas, 0, 0, w, h);
    },
    resize,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      document.removeEventListener('visibilitychange', onVisibility);
      ro?.disconnect();
      timer.dispose();
      envCleanups.forEach((f) => f());
      for (const s of slots) disposeTree(s.holder);
      disposeTree(scene);
      blobTex.dispose();
      scene.clear();
      renderer.dispose();
    },
  };
}
