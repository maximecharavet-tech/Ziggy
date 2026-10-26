import * as THREE from 'three';

/**
 * The "PS2" look: low-poly flat-shaded models, painted vertex colours, soft
 * fog, warm key light with soft shadows, and additive glow sprites instead of
 * expensive post-processing. Everything is built in code: no asset to load.
 */

export function createRenderer(canvas: HTMLCanvasElement, opts: { lowPower: boolean }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !opts.lowPower, powerPreference: 'high-performance' });
  // A slightly lower internal resolution gives the console look and keeps 60 fps on tablets.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.lowPower ? 0.85 : 1.35));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

/** Flat-shaded material: the faceted low-poly feel. */
export const mat = (color: THREE.ColorRepresentation, extra: Partial<THREE.MeshLambertMaterialParameters> = {}) =>
  new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

/** Glowing material for lights, eyes, windows. */
export const glowMat = (color: THREE.ColorRepresentation, intensity = 1.6) =>
  new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false });

let glowTexture: THREE.Texture | null = null;
/** A soft radial dot, shared by every glow sprite. */
export function glowTex(): THREE.Texture {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

/** Additive halo around a light — the cheap, very PS2 way to make things shine. */
export function glow(color: THREE.ColorRepresentation, size: number, opacity = 0.85): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
}

/** A text label painted on a canvas, as a sprite (house numbers, signs). */
export function labelSprite(text: string, opts: { bg?: string; fg?: string; size?: number } = {}): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = opts.bg ?? '#fff7e0';
  g.beginPath();
  g.arc(128, 128, 118, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 14;
  g.strokeStyle = '#7a3b12';
  g.stroke();
  g.fillStyle = opts.fg ?? '#7a1d1d';
  g.font = `bold ${text.length > 2 ? 110 : 150}px Fredoka, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 140);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  s.scale.setScalar(opts.size ?? 1);
  return s;
}

export { rng } from './rng';

/** Gentle height field for snowy hills. */
export function hillHeight(x: number, z: number): number {
  return Math.sin(x * 0.11) * Math.cos(z * 0.09) * 0.8 + Math.sin(x * 0.031 + z * 0.047) * 1.6;
}

/** Dispose every geometry/material/texture under an object. */
export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose?.();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const x of mats) {
      for (const v of Object.values(x)) if (v instanceof THREE.Texture && v !== glowTexture) v.dispose();
      x.dispose();
    }
  });
}

/** Reduced motion or a weak device: fewer particles, no shadows bobbing. */
export function prefersLowPower(): boolean {
  if (typeof window === 'undefined') return false;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  return Boolean(reduce) || cores <= 4;
}
