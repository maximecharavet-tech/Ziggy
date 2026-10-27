import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildZiggy, makeScarf, type ZiggyModel } from './model';
import { ZiggyRig } from './rig';
import type { ZiggyAccessory, ZiggyCue, ZiggyFraming, ZiggyIdle, ZiggyMood } from './types';

export interface StageOptions {
  framing: ZiggyFraming;
  accessory: ZiggyAccessory;
  idle: ZiggyIdle;
  mood: ZiggyMood;
  followPointer: boolean;
  reduceMotion: boolean;
  /** Tests only: allow software WebGL (SwiftShader / llvmpipe). */
  allowSoftware?: boolean;
}

/** Software WebGL (no graphics card) is far too slow for the plush: keep the picture. */
function softwareRenderer(gl: WebGLRenderingContext | WebGL2RenderingContext) {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
}

/** Vertical extent the camera keeps in view for each framing (model units). */
const FRAMES: Record<ZiggyFraming, { bottom: number; top: number; width: number }> = {
  full: { bottom: -0.05, top: 2.45, width: 1.9 },
  bust: { bottom: 0.62, top: 2.42, width: 1.7 },
  face: { bottom: 1.05, top: 2.4, width: 1.45 },
};

function weakDevice() {
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  return cores <= 2 || mem <= 2;
}

function softShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(30,50,20,0.55)');
  grad.addColorStop(0.5, 'rgba(30,50,20,0.22)');
  grad.addColorStop(1, 'rgba(30,50,20,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function sparkleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.translate(32, 32);
  g.fillStyle = '#fff';
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? 6 : 30;
    const a = (i / 8) * Math.PI * 2;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * The living 3D Ziggy for any page: a small studio (soft key light, warm
 * fill, rim light, a felt-friendly environment), a contact shadow, sparkles
 * for happy moments, and the plush with its rig. Transparent background so
 * it sits on any design.
 */
export class ZiggyStage {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  private model: ZiggyModel;
  private rig: ZiggyRig;
  private clock = new THREE.Clock();
  private raf = 0;
  private running = false;
  private w = 1;
  private h = 1;
  private pmrem: THREE.PMREMGenerator;
  private envTex: THREE.Texture;
  private sparkles: { s: THREE.Sprite; v: THREE.Vector3; life: number }[] = [];
  private sparkleMat: THREE.SpriteMaterial;
  private ray = new THREE.Raycaster();
  private slowFrames = 0;
  private dpr: number;
  private scarf: THREE.Group | null = null;
  private frameTimes: number[] = [];
  /** Called once if the device can't keep up: the page shows the picture instead. */
  onTooSlow: (() => void) | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    private opts: StageOptions
  ) {
    const low = weakDevice();
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance', premultipliedAlpha: true });
    const gl = this.renderer.getContext();
    if (!gl || (!opts.allowSoftware && softwareRenderer(gl))) {
      this.renderer.dispose();
      throw new Error('no fast webgl');
    }
    this.dpr = Math.min(window.devicePixelRatio || 1, low ? 1.5 : 2);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = !low;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Soft studio reflections: what makes felt and sheen read as real fabric.
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.32;

    const hemi = new THREE.HemisphereLight('#fff4e0', '#6f9a5a', 0.55);
    const key = new THREE.DirectionalLight('#fff1dc', 2.6);
    key.position.set(-2.2, 4.2, 3.4);
    key.castShadow = !low;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -1.6;
    key.shadow.camera.right = 1.6;
    key.shadow.camera.top = 2.8;
    key.shadow.camera.bottom = -0.4;
    key.shadow.radius = 6;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    const fill = new THREE.DirectionalLight('#ffd9b0', 0.35);
    fill.position.set(3, 1.6, 2.5);
    const rim = new THREE.DirectionalLight('#d8f0ff', 1.6);
    rim.position.set(1.8, 3, -3.2);
    this.scene.add(hemi, key, fill, rim);

    // Ground: a soft contact shadow (Ziggy still shadows himself: arms, head).
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.1), new THREE.MeshBasicMaterial({ map: softShadowTexture(), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.002;
    this.scene.add(blob);

    this.model = buildZiggy({ lowPower: low, accessory: opts.accessory, shadows: !low });
    if (opts.accessory === 'scarf') {
      this.scarf = makeScarf(low);
      this.model.body.add(this.scarf);
    }
    this.scene.add(this.model.root);
    this.rig = new ZiggyRig(this.model);
    this.rig.idle = opts.idle;
    this.rig.mood = opts.mood;
    this.rig.energy = opts.reduceMotion ? 0.35 : 1;
    this.rig.onCue = (c) => {
      if (c === 'cheer' || c === 'love' || c === 'giggle') this.burst(c === 'cheer' ? 16 : 9);
    };

    this.sparkleMat = new THREE.SpriteMaterial({ map: sparkleTexture(), color: '#fff2a8', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.frame();
  }

  private frame() {
    const f = FRAMES[this.opts.framing];
    const aspect = this.w / this.h;
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const height = f.top - f.bottom;
    // Fit the height, and the width when the box is narrow.
    const dist = Math.max(height / 2 / Math.tan(fov / 2), f.width / 2 / (Math.tan(fov / 2) * aspect)) * 1.04;
    const cy = (f.top + f.bottom) / 2;
    this.camera.aspect = aspect;
    this.camera.position.set(0, cy + 0.12, dist);
    this.camera.lookAt(0, cy, 0);
    this.camera.updateProjectionMatrix();
  }

  setSize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h, false);
    this.frame();
    if (!this.running) this.render(0);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = this.clock.getDelta();
      this.render(dt);
      this.adapt(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Shaders compiled off the main thread when the browser can: no freeze on first paint. */
  async prepare() {
    await this.renderer.compileAsync(this.scene, this.camera);
  }

  /** Lower the resolution a little when frames are slow (cheap phones). */
  private adapt(dt: number) {
    // Watchdog on the first frames: hopelessly slow → give up and keep the picture.
    if (this.frameTimes.length < 24) {
      this.frameTimes.push(dt);
      if (this.frameTimes.length === 24) {
        const sorted = this.frameTimes.slice(4).sort((a, b) => a - b);
        if (sorted[Math.floor(sorted.length / 2)] > 0.09) {
          this.stop();
          this.onTooSlow?.();
          return;
        }
      }
    }
    this.slowFrames = dt > 1 / 32 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 1);
    if (this.slowFrames > 45 && this.dpr > 0.75) {
      this.dpr = Math.max(0.75, this.dpr - 0.25);
      this.renderer.setPixelRatio(this.dpr);
      this.renderer.setSize(this.w, this.h, false);
      this.slowFrames = 0;
    }
  }

  private render(dt: number) {
    this.rig.update(dt);
    this.updateSparkles(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private burst(n: number) {
    const colors = ['#fff2a8', '#ffd1f0', '#bff3ff', '#d6ffb8'];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(this.sparkleMat.clone());
      (s.material as THREE.SpriteMaterial).color.set(colors[i % colors.length]);
      s.position.set((Math.random() - 0.5) * 0.4, 1.3 + Math.random() * 0.5, 0.4);
      const a = Math.random() * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a) * (0.8 + Math.random()), 1.2 + Math.random() * 1.4, (Math.random() - 0.2) * 0.6);
      s.scale.setScalar(0.08 + Math.random() * 0.08);
      this.scene.add(s);
      this.sparkles.push({ s, v, life: 1 });
    }
  }

  private updateSparkles(dt: number) {
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const p = this.sparkles[i];
      p.life -= dt * 0.9;
      p.v.y -= dt * 2.2;
      p.s.position.addScaledVector(p.v, dt);
      p.s.material.rotation += dt * 3;
      (p.s.material as THREE.SpriteMaterial).opacity = Math.max(0, p.life);
      if (p.life <= 0) {
        this.scene.remove(p.s);
        p.s.material.dispose();
        this.sparkles.splice(i, 1);
      }
    }
  }

  setMood(m: ZiggyMood) {
    this.rig.mood = m;
  }

  setIdle(i: ZiggyIdle) {
    this.rig.idle = i;
  }

  setTalking(t: boolean) {
    this.rig.talking = t;
  }

  cue(c: ZiggyCue) {
    this.rig.cue(c);
  }

  /** Pointer in -1..1 over the box (it may be outside it). */
  pointer(x: number, y: number) {
    if (!this.opts.followPointer) return;
    // Ziggy's eyes sit high in the frame: aim relative to his face.
    const f = FRAMES[this.opts.framing];
    const faceY = ((1.55 - f.bottom) / (f.top - f.bottom)) * 2 - 1;
    this.rig.lookAt(x * 0.9, (y - faceY) * 0.9);
  }

  /** A tap: true if it touched Ziggy (who then giggles). */
  tap(x: number, y: number): boolean {
    this.ray.setFromCamera(new THREE.Vector2(x, y), this.camera);
    const hit = this.ray.intersectObject(this.model.root, true).length > 0;
    if (hit && !this.rig.busy) this.rig.cue(Math.random() < 0.5 ? 'giggle' : 'jump');
    return hit;
  }

  dispose() {
    this.stop();
    this.model.dispose();
    this.sparkles.forEach((p) => p.s.material.dispose());
    this.sparkleMat.map?.dispose();
    this.sparkleMat.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !this.model.root.getObjectById(m.id)) {
        m.geometry.dispose();
        const mat = m.material as THREE.Material & { map?: THREE.Texture };
        mat.map?.dispose();
        mat.dispose();
      }
    });
    this.envTex.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
