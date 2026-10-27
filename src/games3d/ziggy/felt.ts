import * as THREE from 'three';
import { rng } from '../kit/rng';

/**
 * Ziggy is a felt plush: the look comes from a fuzzy normal map (thousands of
 * tiny fibres), a soft mottled colour, and the "sheen" term of the physical
 * material, which is exactly what velvet and felt do under light (bright,
 * soft rims). All textures are generated once, in code, tiling.
 */

const N = 256;

let fibres: { normal: THREE.DataTexture; mottle: THREE.DataTexture } | null = null;

function wrap(i: number) {
  return ((i % N) + N) % N;
}

function buildFibres() {
  const rnd = rng(7);
  const h = new Float32Array(N * N);
  // Short fibres in every direction, the fuzz of felt.
  for (let i = 0; i < 5200; i++) {
    const x = rnd() * N;
    const y = rnd() * N;
    const a = rnd() * Math.PI * 2;
    const len = 3 + rnd() * 9;
    const s = (rnd() - 0.35) * 0.9;
    for (let k = 0; k < len; k++) {
      const px = Math.round(x + Math.cos(a) * k);
      const py = Math.round(y + Math.sin(a) * k);
      const f = s * Math.sin((k / len) * Math.PI);
      h[wrap(py) * N + wrap(px)] += f;
    }
  }
  // Fine grain, then a light blur so fibres read as soft, not as noise.
  for (let i = 0; i < h.length; i++) h[i] += (rnd() - 0.5) * 0.25;
  const b = new Float32Array(N * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += h[wrap(y + dy) * N + wrap(x + dx)] * (dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1);
      b[y * N + x] = s / 16;
    }

  const normal = new Uint8Array(N * N * 4);
  const k = 2.2;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = (b[y * N + wrap(x + 1)] - b[y * N + wrap(x - 1)]) * k;
      const dy = (b[wrap(y + 1) * N + x] - b[wrap(y - 1) * N + x]) * k;
      const l = Math.hypot(dx, dy, 1);
      const o = (y * N + x) * 4;
      normal[o] = ((-dx / l) * 0.5 + 0.5) * 255;
      normal[o + 1] = ((-dy / l) * 0.5 + 0.5) * 255;
      normal[o + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      normal[o + 3] = 255;
    }

  // Soft blotches of slightly lighter/darker wool, plus the fibres themselves.
  const mottle = new Uint8Array(N * N * 4);
  const grid = 8;
  const g = Array.from({ length: grid * grid }, () => rnd());
  const at = (gx: number, gy: number) => g[(((gy % grid) + grid) % grid) * grid + (((gx % grid) + grid) % grid)];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const fx = (x / N) * grid;
      const fy = (y / N) * grid;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      const n = (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
      const v = 0.9 + n * 0.1 + b[y * N + x] * 0.05;
      const c = Math.max(0, Math.min(255, v * 255));
      const o = (y * N + x) * 4;
      mottle[o] = mottle[o + 1] = mottle[o + 2] = c;
      mottle[o + 3] = 255;
    }

  const make = (data: Uint8Array, srgb: boolean) => {
    const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return { normal: make(normal, false), mottle: make(mottle, true) };
}

export function feltTextures() {
  fibres ??= buildFibres();
  return fibres;
}

/** Shared textures must survive when one Ziggy is disposed. */
export function isSharedTexture(t: THREE.Texture) {
  return Boolean(fibres && (t.source === fibres.normal.source || t.source === fibres.mottle.source));
}

export interface FeltOptions {
  /** Texture tiles across the UV range (bigger parts get more). */
  repeat?: number;
  sheen?: string;
  roughness?: number;
  /** Cheaper material for weak devices. */
  lowPower?: boolean;
  emissive?: string;
  emissiveIntensity?: number;
}

/** A felt material: fuzzy, matte, with a soft velvet sheen on the edges. */
export function felt(color: string, opts: FeltOptions = {}): THREE.MeshStandardMaterial {
  const { normal, mottle } = feltTextures();
  const rep = opts.repeat ?? 4;
  const n = normal.clone();
  const m = mottle.clone();
  n.repeat.set(rep, rep);
  m.repeat.set(rep, rep);
  const base = {
    color,
    map: m,
    normalMap: n,
    normalScale: new THREE.Vector2(0.42, 0.42),
    roughness: opts.roughness ?? 0.95,
    metalness: 0,
    emissive: opts.emissive ?? '#000000',
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  };
  if (opts.lowPower) return new THREE.MeshStandardMaterial(base);
  return new THREE.MeshPhysicalMaterial({
    ...base,
    sheen: 1,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(opts.sheen ?? '#ffffff').lerp(new THREE.Color(color), 0.35),
  });
}

/** A soft ribbed fabric (Ziggy's grey "accordion" arms and legs). */
export function ribbedFabric(color: string, lowPower = false): THREE.MeshStandardMaterial {
  return felt(color, { repeat: 3, sheen: '#b9b6c4', roughness: 0.85, lowPower });
}
