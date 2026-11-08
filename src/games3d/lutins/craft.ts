import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../kit/rng';
import { smoothSeams, taperedTube } from '../santa/fluff';

/**
 * The craft kit of the felt elves, all generated in code: knitted wool
 * (V stitches with relief), twisted yarn, an acorn cup, hand stitches along
 * seams and hems, glossy bead eyes, a three-strand braid and little bows.
 */

// ---------------------------------------------------------------------------
// Textures

function dataTex(data: Uint8Array, w: number, h: number, srgb: boolean): THREE.DataTexture {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Tangent-space normal map from a tiling height field. */
export function heightToNormal(h: Float32Array, w: number, hh: number, strength: number): THREE.DataTexture {
  const out = new Uint8Array(w * hh * 4);
  const at = (x: number, y: number) => h[(((y % hh) + hh) % hh) * w + (((x % w) + w) % w)];
  for (let y = 0; y < hh; y++)
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const o = (y * w + x) * 4;
      out[o] = ((-dx / l) * 0.5 + 0.5) * 255;
      // Data textures are not flipped: +y of the image is +v.
      out[o + 1] = ((-dy / l) * 0.5 + 0.5) * 255;
      out[o + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      out[o + 3] = 255;
    }
  return dataTex(out, w, hh, false);
}

export interface KnitOptions {
  /** Yarn colours, one per stripe (a single colour = plain knit). */
  colors: string[];
  /** Knitted rows per stripe. */
  rowsPerStripe?: number;
  /** Stitch columns and rows in one tile. */
  cols?: number;
  rows?: number;
  /** Which texture axis the columns run along: 'v' (default, image up) or 'u' (tubes: along their length). */
  along?: 'u' | 'v';
  /** Ribbing (knit 1, purl 1) instead of stockinette: deep vertical ribs. */
  rib?: boolean;
  size?: number;
  seed?: number;
}

export interface KnitTextures {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
}

/**
 * Knitted wool: rows of V stitches, each V two plump slanted loops, with
 * fluffy fibres. Returns a colour map (colours baked in, use a white
 * material colour) and the matching normal map.
 */
export function knitTextures(o: KnitOptions): KnitTextures {
  const S = o.size ?? 256;
  const cols = o.cols ?? 8;
  const rows = o.rows ?? 10;
  const rps = o.rowsPerStripe ?? rows;
  const alongU = o.along === 'u';
  const r = rng(o.seed ?? 31);
  const h = new Float32Array(S * S);
  const stripe = new Uint8Array(S * S);
  const lobe = (u: number, v: number, cx: number, ang: number) => {
    const x = u - cx;
    const y = v - 0.5;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const rx = (x * ca - y * sa) / 0.25;
    const ry = (x * sa + y * ca) / 0.62;
    const d = rx * rx + ry * ry;
    return d >= 1 ? 0 : Math.pow(1 - d, 0.55);
  };
  for (let py = 0; py < S; py++)
    for (let px = 0; px < S; px++) {
      // (a, b): a across the columns, b along them.
      const a = ((alongU ? py : px) / S) * cols;
      const b = ((alongU ? px : py) / S) * rows;
      const cu = a - Math.floor(a);
      let best = 0;
      let bestRow = Math.floor(b);
      for (let k = -1; k <= 1; k++) {
        const rowI = Math.floor(b) + k;
        const cv = b - rowI;
        let v: number;
        if (o.rib && Math.floor(a) % 2 === 1) {
          // A purl column: little bumps sunk between the ribs.
          const x = (cu - 0.5) / 0.4;
          const y = (cv - 0.5) / 0.45;
          const d = x * x + y * y;
          v = d >= 1 ? 0 : Math.pow(1 - d, 0.8) * 0.45;
        } else {
          v = Math.max(lobe(cu, cv, 0.28, -0.55), lobe(cu, cv, 0.72, 0.55));
        }
        if (v > best) {
          best = v;
          bestRow = rowI;
        }
      }
      const i = py * S + px;
      h[i] = best;
      stripe[i] = Math.floor((((bestRow % rows) + rows) % rows) / rps) % o.colors.length;
    }
  // Fibres: short random strokes of extra height (the woolly halo).
  for (let n = 0; n < S * 9; n++) {
    const x = r() * S;
    const y = r() * S;
    const ang = r() * Math.PI * 2;
    const len = 2 + r() * 5;
    const s = (r() - 0.4) * 0.16;
    for (let k = 0; k < len; k++) {
      const xx = ((Math.round(x + Math.cos(ang) * k) % S) + S) % S;
      const yy = ((Math.round(y + Math.sin(ang) * k) % S) + S) % S;
      h[yy * S + xx] += s;
    }
  }
  const cols3 = o.colors.map((c) => new THREE.Color(c));
  const map = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    const c = cols3[stripe[i]];
    const v = Math.max(0, Math.min(1.15, h[i]));
    const shade = 0.5 + 0.55 * Math.pow(v, 0.7) + (r() - 0.5) * 0.05;
    // Colours are sRGB components in the data texture.
    const cs = c.clone().convertLinearToSRGB();
    map[i * 4] = Math.min(255, cs.r * shade * 255);
    map[i * 4 + 1] = Math.min(255, cs.g * shade * 255);
    map[i * 4 + 2] = Math.min(255, cs.b * shade * 255);
    map[i * 4 + 3] = 255;
  }
  return { map: dataTex(map, S, S, true), normalMap: heightToNormal(h, S, S, o.rib ? 3.2 : 2.6) };
}

/** A knitted wool material (soft sheen like real yarn). */
export function knitMaterial(t: KnitTextures, repeat: [number, number], low: boolean, sheen = '#ffffff'): THREE.MeshStandardMaterial {
  t.map.repeat.set(repeat[0], repeat[1]);
  t.normalMap.repeat.set(repeat[0], repeat[1]);
  const base = { color: '#ffffff', map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.92, metalness: 0 };
  if (low) return new THREE.MeshStandardMaterial(base);
  return new THREE.MeshPhysicalMaterial({ ...base, sheen: 0.8, sheenRoughness: 0.45, sheenColor: new THREE.Color(sheen) });
}

/**
 * Twisted yarn (hair, braids, curls): diagonal plies along the tube
 * length (u). Colour map + normal map.
 */
export function yarnTextures(color: string, plies = 3, seed = 5): KnitTextures {
  const W = 128;
  const H = 64;
  const r = rng(seed);
  const h = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      const p = (u * 6 + v * plies) % 1;
      h[y * W + x] = Math.pow(Math.sin(p * Math.PI), 0.7) + (r() - 0.5) * 0.18;
    }
  // Stray fibres.
  for (let n = 0; n < 300; n++) {
    const x = r() * W;
    const y = r() * H;
    const len = 3 + r() * 6;
    for (let k = 0; k < len; k++) {
      const xx = Math.floor(x + k) % W;
      const yy = Math.floor(y + k * 0.4) % H;
      h[yy * W + xx] += 0.15;
    }
  }
  const c = new THREE.Color(color).convertLinearToSRGB();
  const map = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const s = 0.62 + 0.45 * Math.max(0, Math.min(1, h[i]));
    map[i * 4] = Math.min(255, c.r * s * 255);
    map[i * 4 + 1] = Math.min(255, c.g * s * 255);
    map[i * 4 + 2] = Math.min(255, c.b * s * 255);
    map[i * 4 + 3] = 255;
  }
  return { map: dataTex(map, W, H, true), normalMap: heightToNormal(h, W, H, 2.4) };
}

/** The cup of an acorn: rows of small overlapping rounded scales. */
export function acornTextures(): KnitTextures {
  const S = 256;
  const cols = 14;
  const rows = 9;
  const r = rng(17);
  const h = new Float32Array(S * S);
  const tone = new Float32Array(S * S);
  for (let py = 0; py < S; py++)
    for (let px = 0; px < S; px++) {
      const b = (py / S) * rows;
      let best = 0;
      let t = 0;
      for (let k = -1; k <= 1; k++) {
        const row = Math.floor(b) + k;
        const off = row % 2 ? 0.5 : 0;
        const a = (px / S) * cols + off;
        const cu = a - Math.floor(a) - 0.5;
        const cv = b - row - 0.35;
        // A scale: rounded at the bottom, tucked under the next row at the top.
        const d = (cu * cu) / 0.2 + (cv * cv) / (cv > 0 ? 0.55 : 0.22);
        const v = d >= 1 ? 0 : Math.pow(1 - d, 0.5) * (0.75 + 0.25 * (cv > 0 ? 1 - cv : 1));
        if (v > best) {
          best = v;
          t = 0.85 + 0.3 * (((row * 7 + Math.floor(a) * 13) % 5) / 5);
        }
      }
      h[py * S + px] = best + (r() - 0.5) * 0.06;
      tone[py * S + px] = t;
    }
  const base = new THREE.Color('#8a5a2e').convertLinearToSRGB();
  const map = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    const s = (0.45 + 0.7 * Math.max(0, Math.min(1, h[i]))) * tone[i];
    map[i * 4] = Math.min(255, base.r * s * 255);
    map[i * 4 + 1] = Math.min(255, base.g * s * 255);
    map[i * 4 + 2] = Math.min(255, base.b * s * 255);
    map[i * 4 + 3] = 255;
  }
  return { map: dataTex(map, S, S, true), normalMap: heightToNormal(h, S, S, 3) };
}

let feltTex: { map: THREE.DataTexture; normalMap: THREE.DataTexture } | null = null;

/**
 * Close-up wool felt for the dolls (finer and fuzzier than Ziggy's): a dense
 * mat of short fibres with a few lighter strays, soft thicker/thinner
 * patches (hand-made irregularity), as a colour multiplier and normal map.
 */
export function elfFeltTextures() {
  if (feltTex) return feltTex;
  const S = 512;
  const r = rng(101);
  const h = new Float32Array(S * S);
  const tone = new Float32Array(S * S).fill(0);
  const wrap = (v: number) => ((Math.round(v) % S) + S) % S;
  for (let i = 0; i < 26000; i++) {
    const x = r() * S;
    const y = r() * S;
    const a = r() * Math.PI * 2;
    const len = 4 + r() * 14;
    const hgt = (r() - 0.3) * 0.7;
    const t = (r() - 0.5) * (r() < 0.04 ? 0.9 : 0.25);
    const bend = (r() - 0.5) * 0.15;
    let px = x;
    let py = y;
    let ang = a;
    for (let k = 0; k < len; k++) {
      const f = Math.sin((k / len) * Math.PI);
      const o = wrap(py) * S + wrap(px);
      h[o] += hgt * f;
      tone[o] += t * f;
      ang += bend;
      px += Math.cos(ang);
      py += Math.sin(ang);
    }
  }
  // Soft lumps: the felt is a little thicker here, thinner there.
  const grid = 6;
  const g = Array.from({ length: grid * grid }, () => r());
  const at = (gx: number, gy: number) => g[(((gy % grid) + grid) % grid) * grid + (((gx % grid) + grid) % grid)];
  const lump = (x: number, y: number) => {
    const fx = (x / S) * grid;
    const fy = (y / S) * grid;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const sx = (fx - x0) * (fx - x0) * (3 - 2 * (fx - x0));
    const sy = (fy - y0) * (fy - y0) * (3 - 2 * (fy - y0));
    return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
  };
  const b = new Float32Array(S * S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += h[wrap(y + dy) * S + wrap(x + dx)] * (dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1);
      b[y * S + x] = sum / 16 + lump(x, y) * 0.6;
    }
  const map = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const v = 0.86 + (lump(x * 1.7 + 40, y * 1.7) - 0.5) * 0.1 + tone[i] * 0.35 + (b[i] - 0.3) * 0.06 + (r() - 0.5) * 0.03;
      const c = Math.max(0, Math.min(255, v * 255));
      map[i * 4] = map[i * 4 + 1] = map[i * 4 + 2] = c;
      map[i * 4 + 3] = 255;
    }
  feltTex = { map: dataTex(map, S, S, true), normalMap: heightToNormal(b, S, S, 1.6) };
  return feltTex;
}

export interface ElfFeltOptions {
  repeat?: number;
  sheen?: string;
  roughness?: number;
  lowPower?: boolean;
  emissive?: string;
  emissiveIntensity?: number;
  /** Strength of the fibres' relief. */
  fuzz?: number;
}

/** A felt material for the elves: fuzzy, matte, a soft velvet sheen on the edges. */
export function elfFelt(color: string, opts: ElfFeltOptions = {}): THREE.MeshStandardMaterial {
  const t = elfFeltTextures();
  const rep = (opts.repeat ?? 3) * 1.2;
  const map = t.map.clone();
  const normalMap = t.normalMap.clone();
  map.repeat.set(rep, rep);
  normalMap.repeat.set(rep, rep);
  const f = opts.fuzz ?? 0.75;
  const base = {
    color,
    map,
    normalMap,
    normalScale: new THREE.Vector2(f, f),
    roughness: opts.roughness ?? 1,
    metalness: 0,
    emissive: opts.emissive ?? '#000000',
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  };
  if (opts.lowPower) return new THREE.MeshStandardMaterial(base);
  return new THREE.MeshPhysicalMaterial({
    ...base,
    sheen: 1,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(opts.sheen ?? '#ffffff').lerp(new THREE.Color(color), 0.5),
  });
}

/** Shiny thread colour for stitches (cotton embroidery floss). */
export function threadMaterial(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0 });
}

/** Polished brass (bell, buttons, buckle, glasses). */
export function goldMaterial(low: boolean): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: '#f2c14e', metalness: low ? 0.5 : 0.9, roughness: 0.28, emissive: '#4a3000', emissiveIntensity: low ? 0.35 : 0.12 });
}

// ---------------------------------------------------------------------------
// Geometry helpers

/**
 * Running stitches along a path: little thread dashes lying on the felt.
 * `points` should already sit on (or just above) the surface.
 */
export function stitchGeometry(points: THREE.Vector3[], o: { closed?: boolean; dash?: number; gap?: number; radius?: number; seg?: number } = {}): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, Boolean(o.closed), 'centripetal');
  const len = curve.getLength();
  const dash = o.dash ?? 0.022;
  const gap = o.gap ?? 0.014;
  const rad = o.radius ?? 0.0042;
  const n = Math.max(1, Math.floor(len / (dash + gap)));
  const step = len / n;
  const parts: THREE.BufferGeometry[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const t0 = (i * step + gap / 2) / len;
    const t1 = (i * step + gap / 2 + Math.min(dash, step - gap * 0.5)) / len;
    const a = curve.getPointAt(Math.min(1, t0));
    const b = curve.getPointAt(Math.min(1, t1));
    const d = b.clone().sub(a);
    const l = d.length();
    if (l < 1e-5) continue;
    const g = new THREE.CapsuleGeometry(rad, Math.max(0.0005, l - rad * 2), 2, o.seg ?? 6);
    q.setFromUnitVectors(up, d.normalize());
    g.applyQuaternion(q);
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    parts.push(g);
  }
  if (!parts.length) return new THREE.BufferGeometry();
  const merged = mergeGeometries(parts, false) ?? new THREE.BufferGeometry();
  parts.forEach((p) => p.dispose());
  return merged;
}

/** Keeps only the triangles whose centre passes `keep` (holes for a hood, a hair line). */
export function clipGeometry(g: THREE.BufferGeometry, keep: (c: THREE.Vector3) => boolean): THREE.BufferGeometry {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const idx = g.index;
  if (!idx) return g;
  const out: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(pos, idx.getX(i));
    b.fromBufferAttribute(pos, idx.getX(i + 1));
    c.fromBufferAttribute(pos, idx.getX(i + 2));
    a.add(b).add(c).divideScalar(3);
    if (keep(a)) out.push(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
  }
  g.setIndex(out);
  return g;
}

/** A glossy black bead eye with two white highlights (the light in the eyes). */
export function beadEye(radius: number, low: boolean): THREE.Group {
  const g = new THREE.Group();
  const mat = low
    ? new THREE.MeshStandardMaterial({ color: '#16100f', roughness: 0.12, metalness: 0.1 })
    : new THREE.MeshPhysicalMaterial({ color: '#120c0c', roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 28, 20), mat);
  ball.scale.set(1, 1.06, 0.72);
  const shine = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const hi = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.3, 14, 10), shine);
  hi.scale.set(1, 1, 0.4);
  hi.position.set(-radius * 0.34, radius * 0.38, radius * 0.6);
  const hi2 = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.14, 10, 8), shine);
  hi2.scale.set(1, 1, 0.4);
  hi2.position.set(radius * 0.36, -radius * 0.3, radius * 0.6);
  g.add(ball, hi, hi2);
  g.userData.ball = ball;
  return g;
}

/**
 * A three-strand braid hanging along `points`: each strand a twisted yarn
 * tube weaving over and under the others (a figure-of-eight, phase-shifted).
 */
export function braidGeometry(points: THREE.Vector3[], o: { width: number; strand: number; crossings: number; taper?: number; side?: THREE.Vector3; depth?: THREE.Vector3 }): THREE.BufferGeometry[] {
  const curve = new THREE.CatmullRomCurve3(points);
  const side = (o.side ?? new THREE.Vector3(1, 0, 0)).clone().normalize();
  const depth = (o.depth ?? new THREE.Vector3(0, 0, 1)).clone().normalize();
  const strands: THREE.BufferGeometry[] = [];
  const N = Math.max(24, Math.round(o.crossings * 14));
  for (let k = 0; k < 3; k++) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const taper = 1 - (o.taper ?? 0.35) * t;
      const th = t * o.crossings * Math.PI * 2 + (k * Math.PI * 2) / 3;
      const p = curve.getPointAt(t);
      p.addScaledVector(side, Math.sin(th) * o.width * taper);
      p.addScaledVector(depth, Math.sin(th * 2) * o.width * 0.45 * taper);
      pts.push(p);
    }
    strands.push(taperedTube(pts, (t) => o.strand * (1 - (o.taper ?? 0.35) * t * 0.8), { tubular: N * 2, radial: 10 }));
  }
  return strands;
}

/** A little ribbon bow (two loops, a knot, two tails), facing +z, centred. */
export function bowGeometry(size: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const loop = new THREE.TorusGeometry(size * 0.42, size * 0.16, 8, 18);
    loop.scale(1, 0.62, 0.55);
    loop.rotateZ(sx * 0.25);
    loop.translate(sx * size * 0.45, 0, 0);
    parts.push(loop);
    const tail = taperedTube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(sx * size * 0.2, -size * 0.45, 0.01), new THREE.Vector3(sx * size * 0.32, -size * 0.85, 0)], (t) => size * (0.16 + t * 0.06), {
      tubular: 8,
      radial: 6,
      squash: 0.6,
      squashAxis: new THREE.Vector3(0, 0, 1),
    });
    parts.push(tail);
  }
  const knot = new THREE.SphereGeometry(size * 0.22, 12, 10);
  knot.scale(1, 1, 0.8);
  parts.push(knot);
  for (const p of parts) for (const k of Object.keys(p.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') p.deleteAttribute(k);
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false) ?? new THREE.BufferGeometry();
  parts.forEach((p) => p.dispose());
  return merged;
}

/**
 * A soft pointy elf ear: a leaf shape with a pillowy bevel (felt stuffed
 * thin), tip along +x. Returns outer and inner (pinker) parts.
 */
export function earGeometry(len: number, width: number, low: boolean): { outer: THREE.BufferGeometry; inner: THREE.BufferGeometry; rim: THREE.Vector3[] } {
  const shape = (l: number, w: number) => {
    const s = new THREE.Shape();
    s.moveTo(0, -w * 0.5);
    s.bezierCurveTo(l * 0.35, -w * 0.62, l * 0.7, -w * 0.32, l, w * 0.18);
    s.bezierCurveTo(l * 0.68, w * 0.46, l * 0.3, w * 0.62, 0, w * 0.5);
    s.bezierCurveTo(-w * 0.18, w * 0.25, -w * 0.18, -w * 0.25, 0, -w * 0.5);
    return s;
  };
  const bev = Math.min(width * 0.18, 0.018);
  const outer = new THREE.ExtrudeGeometry(shape(len, width), { depth: width * 0.05, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.9, bevelSegments: low ? 2 : 5, curveSegments: low ? 10 : 22 });
  outer.translate(0, 0, -width * 0.025);
  smoothSeams(outer);
  const inner = new THREE.ExtrudeGeometry(shape(len * 0.72, width * 0.52), { depth: 0.002, bevelEnabled: true, bevelThickness: bev * 0.35, bevelSize: bev * 0.35, bevelSegments: 2, curveSegments: low ? 8 : 16 });
  inner.translate(len * 0.1, 0, width * 0.025 + bev * 0.9);
  // The stitch line around the inner patch.
  const rim = shape(len * 0.8, width * 0.66)
    .getSpacedPoints(40)
    .map((p) => new THREE.Vector3(p.x + len * 0.06, p.y, width * 0.025 + bev * 0.95));
  return { outer, inner, rim };
}

/** Bends a geometry along x around the y axis (a cupped ear, a curved collar). */
export function cupGeometry(g: THREE.BufferGeometry, amount: number): THREE.BufferGeometry {
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setZ(i, pos.getZ(i) - y * y * amount);
  }
  g.computeVertexNormals();
  return g;
}

/** A canvas drawn once and wrapped as a colour texture (decals: mouths). */
export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
