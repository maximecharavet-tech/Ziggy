import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../../kit/rng';

/**
 * The dollhouse kit: a tiny geometry DSL that builds felt and wood objects
 * from primitives into ONE geometry with vertex colours (one draw call per
 * object), plus the few shared materials and canvas textures of the house.
 *
 * Every part carries a `main` flag: main parts take the object's colour
 * (recolour prank) and its colour-blind pattern; the other parts keep their
 * own colour and sample a plain corner of the pattern texture.
 *
 * Code-built only (no asset to load). Client runtime (canvas textures).
 */

export type V3 = [number, number, number];
export type Hex = string;

/** Where plain (non-main) parts read the pattern texture: a white corner. */
const PLAIN_UV = 0.985;
/** Main parts use this share of the texture (the rest is the plain corner). */
const UV_SPAN = 0.86;

export interface PartOpts {
  at?: V3;
  rot?: V3;
  scale?: V3 | number;
  /** Take the object's colour + pattern. */
  main?: boolean;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const tmpC = new THREE.Color();

/** Collects coloured primitives, then merges them. */
export class Shape {
  private parts: THREE.BufferGeometry[] = [];

  add(geo: THREE.BufferGeometry, color: Hex, o: PartOpts = {}): this {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    // keep exactly position / normal / uv
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    g = g.clone();
    const n = g.attributes.position.count;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < n; i++) {
      if (o.main) uv.setXY(i, (uv.getX(i) % 1) * UV_SPAN, (uv.getY(i) % 1) * UV_SPAN);
      else uv.setXY(i, PLAIN_UV, PLAIN_UV);
    }
    const col = new Float32Array(n * 3);
    const main = new Float32Array(n);
    tmpC.set(color).convertSRGBToLinear();
    for (let i = 0; i < n; i++) {
      col[i * 3] = tmpC.r;
      col[i * 3 + 1] = tmpC.g;
      col[i * 3 + 2] = tmpC.b;
      main[i] = o.main ? 1 : 0;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('main', new THREE.BufferAttribute(main, 1));
    const s = o.scale ?? 1;
    tmpS.set(...(typeof s === 'number' ? ([s, s, s] as V3) : s));
    tmpQ.setFromEuler(tmpE.set(...(o.rot ?? [0, 0, 0])));
    tmpP.set(...(o.at ?? [0, 0, 0]));
    g.applyMatrix4(tmpM.compose(tmpP, tmpQ, tmpS));
    this.parts.push(g);
    return this;
  }

  box(w: number, h: number, d: number, color: Hex, o: PartOpts & { r?: number } = {}): this {
    return this.add(o.r ? roundedBox(w, h, d, o.r) : new THREE.BoxGeometry(w, h, d), color, o);
  }
  sphere(r: number, color: Hex, o: PartOpts & { seg?: number } = {}): this {
    const s = o.seg ?? 12;
    return this.add(new THREE.SphereGeometry(r, s, Math.max(6, Math.round(s * 0.7))), color, o);
  }
  cyl(rt: number, rb: number, h: number, color: Hex, o: PartOpts & { seg?: number; open?: boolean } = {}): this {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 14, 1, o.open ?? false), color, o);
  }
  cone(r: number, h: number, color: Hex, o: PartOpts & { seg?: number } = {}): this {
    return this.add(new THREE.ConeGeometry(r, h, o.seg ?? 14), color, o);
  }
  torus(r: number, tube: number, color: Hex, o: PartOpts & { arc?: number; seg?: number } = {}): this {
    return this.add(new THREE.TorusGeometry(r, tube, 8, o.seg ?? 18, o.arc ?? Math.PI * 2), color, o);
  }
  capsule(r: number, len: number, color: Hex, o: PartOpts = {}): this {
    return this.add(new THREE.CapsuleGeometry(r, len, 4, 10), color, o);
  }
  /** A flat extruded outline (stars, hearts, signs). */
  extrude(shape: THREE.Shape, depth: number, color: Hex, o: PartOpts & { bevel?: number } = {}): this {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: Boolean(o.bevel), bevelSize: o.bevel ?? 0, bevelThickness: o.bevel ?? 0, bevelSegments: 1, curveSegments: 6 });
    g.translate(0, 0, -depth / 2);
    return this.add(g, color, o);
  }

  get empty(): boolean {
    return this.parts.length === 0;
  }

  /** One merged geometry (null when nothing was added). */
  build(): THREE.BufferGeometry {
    const g = this.parts.length === 1 ? this.parts[0] : mergeGeometries(this.parts, false);
    if (!g) throw new Error('kit: merge failed');
    if (this.parts.length > 1) for (const p of this.parts) p.dispose();
    this.parts = [];
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

/** A soft rounded box (felt cushions, furniture). */
export function roundedBox(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  const rr = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  const s = new THREE.Shape();
  const x = w / 2 - rr;
  const y = h / 2 - rr;
  s.moveTo(-x, -h / 2);
  s.lineTo(x, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -y);
  s.lineTo(w / 2, y);
  s.quadraticCurveTo(w / 2, h / 2, x, h / 2);
  s.lineTo(-x, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, y);
  s.lineTo(-w / 2, -y);
  s.quadraticCurveTo(-w / 2, -h / 2, -x, -h / 2);
  const depth = Math.max(1e-3, d - rr * 2);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: rr * 0.98, bevelThickness: rr, bevelSegments: 2, curveSegments: 3 });
  g.translate(0, 0, -depth / 2);
  // the bevel grows the outline: shrink back to the asked size
  g.computeBoundingBox();
  const b = g.boundingBox!;
  g.scale(w / (b.max.x - b.min.x), h / (b.max.y - b.min.y), d / (b.max.z - b.min.z));
  return g;
}

/** Recolour the main parts of an object geometry (sRGB hex). */
export function tintMain(geo: THREE.BufferGeometry, hex: Hex): void {
  const col = geo.attributes.color as THREE.BufferAttribute;
  const main = geo.attributes.main as THREE.BufferAttribute | undefined;
  if (!col || !main) return;
  tmpC.set(hex).convertSRGBToLinear();
  for (let i = 0; i < main.count; i++) if (main.getX(i) > 0.5) col.setXYZ(i, tmpC.r, tmpC.g, tmpC.b);
  col.needsUpdate = true;
}

/** A star outline (decorations). */
export function starShape(r: number, inner = 0.45, points = 5): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  s.closePath();
  return s;
}

export function heartShape(r: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, -r);
  s.bezierCurveTo(r * 1.4, -r * 0.1, r * 0.9, r * 1.1, 0, r * 0.45);
  s.bezierCurveTo(-r * 0.9, r * 1.1, -r * 1.4, -r * 0.1, 0, -r);
  return s;
}

// ---------------------------------------------------------------------------
// Textures (cached per game session; disposed with `disposeKit`)

type Pattern = 'dots' | 'stripes' | 'zigzag' | 'stars' | 'checks' | 'waves' | 'plain' | 'hearts';
const texCache = new Map<string, THREE.Texture>();

function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false): THREE.CanvasTexture {
  const hit = texCache.get(key);
  if (hit) return hit as THREE.CanvasTexture;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}

/** Felt fibres: a light speckle that never darkens a colour much. */
function fibres(g: CanvasRenderingContext2D, w: number, h: number, seed: number, strength = 1) {
  const r = rng(seed);
  for (let i = 0; i < w * h * 0.05; i++) {
    const x = r() * w;
    const y = r() * h;
    const a = r() * Math.PI;
    const l = 2 + r() * 5;
    g.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${0.1 * strength})` : `rgba(60,40,30,${0.08 * strength})`;
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
}

/** The felt texture of objects, with a colour-blind pattern (and a plain corner for details). */
export function patternTexture(pattern: Pattern): THREE.CanvasTexture {
  return canvasTex(`pattern:${pattern}`, 256, 256, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 256, 256);
    fibres(g, 256, 256, 7);
    const span = 256 * UV_SPAN;
    g.save();
    g.beginPath();
    g.rect(0, 256 - span, span, span);
    g.clip();
    g.fillStyle = 'rgba(40,24,16,0.30)';
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    const step = span / 4;
    const oy = 256 - span;
    if (pattern === 'dots')
      for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
        g.beginPath();
        g.arc(x * step + (y % 2) * step * 0.5, oy + y * step, step * 0.17, 0, Math.PI * 2);
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.fill();
      }
    if (pattern === 'stripes') {
      g.lineWidth = step * 0.28;
      for (let i = -4; i < 10; i++) {
        g.beginPath();
        g.moveTo(i * step, oy);
        g.lineTo(i * step + span, oy + span);
        g.stroke();
      }
    }
    if (pattern === 'zigzag') {
      g.lineWidth = step * 0.16;
      for (let y = 0; y < 5; y++) {
        g.beginPath();
        for (let x = 0; x <= 8; x++) g.lineTo((x * step) / 2, oy + y * step + (x % 2 ? step * 0.3 : 0));
        g.stroke();
      }
    }
    if (pattern === 'waves') {
      g.lineWidth = step * 0.14;
      for (let y = 0; y < 5; y++) {
        g.beginPath();
        for (let x = 0; x <= span; x += 4) g.lineTo(x, oy + y * step + Math.sin((x / step) * Math.PI) * step * 0.18);
        g.stroke();
      }
    }
    if (pattern === 'checks') {
      g.fillStyle = 'rgba(255,255,255,0.55)';
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) g.fillRect((x * step) / 2, oy + (y * step) / 2, step / 2, step / 2);
    }
    if (pattern === 'stars' || pattern === 'hearts') {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          const cx = x * step + step / 2 + (y % 2) * step * 0.3;
          const cy = oy + y * step + step / 2;
          g.beginPath();
          if (pattern === 'stars')
            for (let i = 0; i < 10; i++) {
              const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
              const rr = i % 2 ? step * 0.1 : step * 0.24;
              g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
            }
          else {
            const r0 = step * 0.18;
            g.moveTo(cx, cy + r0);
            g.bezierCurveTo(cx + r0 * 1.6, cy - r0 * 0.2, cx + r0 * 0.8, cy - r0 * 1.4, cx, cy - r0 * 0.5);
            g.bezierCurveTo(cx - r0 * 0.8, cy - r0 * 1.4, cx - r0 * 1.6, cy - r0 * 0.2, cx, cy + r0);
          }
          g.fill();
        }
    }
    g.restore();
  });
}

/** Wood grain (greyscale, tinted by vertex colours). */
export function woodTexture(): THREE.CanvasTexture {
  return canvasTex(
    'wood',
    256,
    256,
    (g) => {
      const r = rng(11);
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, 256, 256);
      for (let l = 0; l < 40; l++) {
        g.strokeStyle = `rgba(90,55,30,${0.05 + r() * 0.08})`;
        g.lineWidth = 1 + r() * 2;
        g.beginPath();
        const y0 = r() * 256;
        for (let x = 0; x <= 256; x += 8) g.lineTo(x, y0 + Math.sin(x * 0.03 + l) * 3);
        g.stroke();
      }
    },
    true
  );
}

/** Floor boards (greyscale planks). */
export function boardsTexture(): THREE.CanvasTexture {
  return canvasTex(
    'boards',
    256,
    256,
    (g) => {
      const r = rng(5);
      for (let i = 0; i < 4; i++) {
        const k = 0.88 + r() * 0.12;
        const v = Math.round(255 * k);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(0, i * 64, 256, 64);
        g.strokeStyle = 'rgba(80,50,30,0.10)';
        for (let l = 0; l < 7; l++) {
          g.beginPath();
          const y = i * 64 + r() * 64;
          for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + l) * 1.5);
          g.stroke();
        }
        g.fillStyle = 'rgba(60,35,20,0.35)';
        g.fillRect(0, i * 64, 256, 2);
        g.fillRect(((i * 97) % 200) + 20, i * 64, 2, 64);
      }
    },
    true
  );
}

export interface WallTheme {
  base: Hex;
  stripe: Hex;
  motif: 'stars' | 'dots' | 'stripes' | 'flowers' | 'tiles' | 'bricks' | 'planks' | 'snow';
  accent: Hex;
}

/** A cosy wallpaper per room (repeats). */
export function wallTexture(t: WallTheme): THREE.CanvasTexture {
  return canvasTex(
    `wall:${t.base}:${t.stripe}:${t.motif}:${t.accent}`,
    256,
    256,
    (g) => {
      g.fillStyle = t.base;
      g.fillRect(0, 0, 256, 256);
      const r = rng(3);
      if (t.motif === 'stripes' || t.motif === 'stars' || t.motif === 'flowers') {
        g.fillStyle = t.stripe;
        for (let i = 0; i < 8; i += 2) g.fillRect(i * 32, 0, 32, 256);
      }
      g.fillStyle = t.accent;
      if (t.motif === 'stars')
        for (let y = 0; y < 4; y++)
          for (let x = 0; x < 4; x++) {
            const cx = 32 + x * 64 + (y % 2) * 32 - 16;
            const cy = 32 + y * 64;
            g.beginPath();
            for (let i = 0; i < 10; i++) {
              const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
              const rr = i % 2 ? 3 : 7;
              g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
            }
            g.fill();
          }
      if (t.motif === 'dots') for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2 === 0) g.fillRect(x * 32 + 14, y * 32 + 14, 5, 5);
      if (t.motif === 'flowers')
        for (let y = 0; y < 4; y++)
          for (let x = 0; x < 4; x++) {
            const cx = 32 + x * 64;
            const cy = 32 + y * 64 + (x % 2) * 32;
            for (let p = 0; p < 5; p++) {
              g.beginPath();
              g.arc(cx + Math.cos((p / 5) * 6.28) * 5, cy + Math.sin((p / 5) * 6.28) * 5, 4, 0, 6.28);
              g.fill();
            }
          }
      if (t.motif === 'tiles') {
        g.strokeStyle = t.stripe;
        g.lineWidth = 3;
        for (let i = 0; i <= 8; i++) {
          g.beginPath();
          g.moveTo(i * 32, 0);
          g.lineTo(i * 32, 256);
          g.moveTo(0, i * 32);
          g.lineTo(256, i * 32);
          g.stroke();
        }
      }
      if (t.motif === 'bricks')
        for (let y = 0; y < 8; y++)
          for (let x = 0; x < 5; x++) {
            g.fillStyle = r() < 0.5 ? t.stripe : t.accent;
            g.fillRect(x * 64 + (y % 2) * 32 - 32 + 2, y * 32 + 2, 60, 28);
          }
      if (t.motif === 'planks')
        for (let x = 0; x < 6; x++) {
          g.fillStyle = r() < 0.5 ? t.stripe : t.base;
          g.fillRect(x * 43, 0, 41, 256);
        }
      if (t.motif === 'snow') {
        const grad = g.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, t.base);
        grad.addColorStop(1, t.stripe);
        g.fillStyle = grad;
        g.fillRect(0, 0, 256, 256);
        g.fillStyle = 'rgba(255,255,255,0.9)';
        for (let i = 0; i < 70; i++) {
          g.beginPath();
          g.arc(r() * 256, r() * 256, 1 + r() * 2.5, 0, 6.28);
          g.fill();
        }
      }
      fibres(g, 256, 256, 13, 0.6);
    },
    true
  );
}

/** The night outside a window (sky, moon, snowy hills). */
export function windowTexture(): THREE.CanvasTexture {
  return canvasTex('window', 256, 256, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#1d2a6b');
    grad.addColorStop(0.65, '#5a6fc0');
    grad.addColorStop(1, '#a9b8ee');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    const r = rng(21);
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {
      g.globalAlpha = 0.4 + r() * 0.6;
      g.fillRect(r() * 256, r() * 150, 2, 2);
    }
    g.globalAlpha = 1;
    g.fillStyle = '#fff6d8';
    g.beginPath();
    g.arc(190, 60, 22, 0, 6.28);
    g.fill();
    g.fillStyle = '#eef3ff';
    g.beginPath();
    g.moveTo(0, 210);
    g.quadraticCurveTo(80, 160, 150, 200);
    g.quadraticCurveTo(210, 175, 256, 195);
    g.lineTo(256, 256);
    g.lineTo(0, 256);
    g.fill();
  });
}

/** A soft round contact shadow. */
export function blobTexture(): THREE.CanvasTexture {
  return canvasTex('blob', 128, 128, (g) => {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(40,24,16,0.42)');
    grad.addColorStop(0.6, 'rgba(40,24,16,0.18)');
    grad.addColorStop(1, 'rgba(40,24,16,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  });
}

/** A picture drawn on a small canvas (clue icons, number badges…). */
export function iconTexture(key: string, draw: (g: CanvasRenderingContext2D, s: number) => void, size = 128): THREE.CanvasTexture {
  return canvasTex(`icon:${key}`, size, size, (g) => draw(g, size));
}

// ---------------------------------------------------------------------------
// Materials (cached; low path = Lambert)

const matCache = new Map<string, THREE.Material>();

export interface KitMats {
  felt(pattern?: Pattern): THREE.Material;
  wood: THREE.Material;
  boards: THREE.Material;
  wall(t: WallTheme, repeat: [number, number]): THREE.Material;
  window: THREE.Material;
  glow(color: Hex, intensity?: number): THREE.Material;
  ghost: THREE.MeshBasicMaterial;
  blob: THREE.MeshBasicMaterial;
}

export function kitMats(low: boolean): KitMats {
  const make = (key: string, f: () => THREE.Material) => {
    const k = `${low ? 'L' : 'H'}:${key}`;
    let m = matCache.get(k);
    if (!m) {
      m = f();
      matCache.set(k, m);
    }
    return m;
  };
  const surface = (map: THREE.Texture, extra: { roughness?: number } = {}) =>
    low ? new THREE.MeshLambertMaterial({ map, vertexColors: true }) : new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: extra.roughness ?? 1, metalness: 0 });
  return {
    felt: (pattern: Pattern = 'plain') => make(`felt:${pattern}`, () => surface(patternTexture(pattern))),
    get wood() {
      return make('wood', () => surface(woodTexture(), { roughness: 0.75 }));
    },
    get boards() {
      return make('boards', () => {
        const t = boardsTexture();
        return surface(t, { roughness: 0.8 });
      });
    },
    wall: (t, repeat) =>
      make(`wall:${t.base}:${t.motif}:${t.stripe}:${repeat.join('x')}`, () => {
        const tex = wallTexture(t).clone();
        tex.repeat.set(repeat[0], repeat[1]);
        tex.needsUpdate = true;
        return low ? new THREE.MeshLambertMaterial({ map: tex }) : new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
      }),
    get window() {
      return make('window', () => new THREE.MeshBasicMaterial({ map: windowTexture(), toneMapped: false }));
    },
    glow: (color, intensity = 1.25) => make(`glow:${color}:${intensity}`, () => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false })),
    get ghost() {
      return make('ghost', () => new THREE.MeshBasicMaterial({ color: '#fff7d6', transparent: true, opacity: 0.45, depthWrite: false })) as THREE.MeshBasicMaterial;
    },
    get blob() {
      return make('blob', () => new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, toneMapped: false })) as THREE.MeshBasicMaterial;
    },
  };
}

/** The colour-blind pattern of a colour id (vocab COLORS). */
export const PATTERN_OF: Record<string, Pattern> = {
  red: 'dots',
  yellow: 'stripes',
  blue: 'waves',
  green: 'zigzag',
  purple: 'stars',
  orange: 'checks',
  white: 'plain',
  brown: 'hearts',
  shadow: 'plain',
};

/** Dispose every cached texture and material (game dispose). */
export function disposeKit(): void {
  for (const m of matCache.values()) m.dispose();
  matCache.clear();
  for (const t of texCache.values()) t.dispose();
  texCache.clear();
}

/** A flat quad on the floor (rugs, blobs, footprints). */
export function floorQuad(w: number, d: number, material: THREE.Material, y = 0.004): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  return m;
}

/** Freeze a static object's matrices (no per-frame matrix work). */
export function freeze(o: THREE.Object3D): void {
  o.updateMatrixWorld(true);
  o.traverse((x) => {
    x.matrixAutoUpdate = false;
  });
}
