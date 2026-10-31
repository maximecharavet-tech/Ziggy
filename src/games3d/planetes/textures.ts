import * as THREE from 'three';
import { rng } from '../kit/rng';
import type { BodyId } from './logic';

/**
 * Every picture of the game is painted here, in code, on small canvases:
 * planet maps (wrapping around the sphere), Saturn's rings, the Sun, the
 * highlight ring, labels, stamps and little patterns. Nothing to download.
 */

/* ───────────────────────── Noise ───────────────────────── */

/** Value noise that wraps around horizontally (planet maps meet at the back). */
function wrapNoise(seed: number, cellsX: number, cellsY: number) {
  const r = rng(seed);
  const grid = new Float32Array(cellsX * (cellsY + 1));
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  const at = (x: number, y: number) => grid[(y * cellsX + (((x % cellsX) + cellsX) % cellsX)) | 0];
  return (u: number, v: number) => {
    const x = u * cellsX;
    const y = Math.max(0, Math.min(cellsY - 1e-6, v * cellsY));
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx;
    const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
    return a + (b - a) * sy;
  };
}

function fbm(seed: number, base: number, octaves = 4) {
  const layers = Array.from({ length: octaves }, (_, o) => wrapNoise(seed + o * 101, base * 2 ** o, Math.max(2, Math.round((base * 2 ** o) / 2))));
  return (u: number, v: number) => {
    let s = 0;
    let amp = 0.5;
    let norm = 0;
    for (const n of layers) {
      s += n(u, v) * amp;
      norm += amp;
      amp *= 0.5;
    }
    return s / norm;
  };
}

/* ───────────────────────── Colour helpers ───────────────────────── */

type RGB = [number, number, number];
const hex = (h: string): RGB => {
  const c = new THREE.Color(h);
  return [c.r * 255, c.g * 255, c.b * 255];
};
const mix = (a: RGB, b: RGB, t: number): RGB => {
  const k = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
};
const shade = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d')! };
}

function toTexture(c: HTMLCanvasElement, wrap = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (wrap) t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Paint a W×H equirectangular map, pixel by pixel (u: longitude 0..1, v: latitude 0 top .. 1 bottom). */
function paint(w: number, h: number, fn: (u: number, v: number) => RGB | [number, number, number, number]): HTMLCanvasElement {
  const { c, g } = canvas(w, h);
  const img = g.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = fn(x / w, (y + 0.5) / h);
      const i = (y * w + x) * 4;
      d[i] = p[0];
      d[i + 1] = p[1];
      d[i + 2] = p[2];
      d[i + 3] = p.length > 3 ? (p as number[])[3] : 255;
    }
  g.putImageData(img, 0, 0);
  return c;
}

/** Round craters with a dark floor and a light rim, stamped on a map. */
function craters(seed: number, count: number, rMin: number, rMax: number) {
  const r = rng(seed);
  const list = Array.from({ length: count }, () => ({ u: r(), v: 0.12 + r() * 0.76, rad: rMin + r() * (rMax - rMin) }));
  return (u: number, v: number) => {
    let k = 0;
    for (const c of list) {
      let du = Math.abs(u - c.u);
      du = Math.min(du, 1 - du) * 2; // longitude is twice as long as latitude on the map
      const d = Math.hypot(du, v - c.v) / c.rad;
      if (d < 1) k += d < 0.78 ? -0.22 * (1 - d * 0.5) : 0.16;
    }
    return k;
  };
}

/* ───────────────────────── Planet maps ───────────────────────── */

export function planetMap(id: BodyId, small = false): THREE.CanvasTexture {
  const W = small ? 192 : 256;
  const H = W / 2;
  let c: HTMLCanvasElement;
  switch (id) {
    case 'mercury': {
      const n = fbm(11, 6);
      const cr = craters(12, 70, 0.02, 0.08);
      const a = hex('#8f8983');
      const b = hex('#c2bbb3');
      c = paint(W, H, (u, v) => shade(mix(a, b, n(u, v) * 1.3 - 0.15), 1 + cr(u, v)));
      break;
    }
    case 'venus': {
      const n = fbm(21, 4);
      const m = fbm(22, 3);
      const a = hex('#f6dda0');
      const b = hex('#d9a24f');
      const c2 = hex('#fff2c9');
      c = paint(W, H, (u, v) => {
        const swirl = n(u + Math.sin(v * 9 + m(u, v) * 4) * 0.04, v) * 0.7 + Math.sin(v * 18 + n(u, v) * 6) * 0.15;
        return mix(mix(a, b, swirl), c2, smooth(0.62, 0.8, m(u, v)) * 0.6);
      });
      break;
    }
    case 'earth': {
      const n = fbm(31, 5);
      const det = fbm(33, 12, 3);
      const sea = hex('#1f6fd1');
      const sea2 = hex('#46a6ee');
      const green = hex('#4caf50');
      const green2 = hex('#86c55a');
      const sand = hex('#c9a66b');
      const ice = hex('#f4fbff');
      c = paint(W, H, (u, v) => {
        const h = n(u, v) + (det(u, v) - 0.5) * 0.12;
        const lat = Math.abs(v - 0.5) * 2;
        if (lat > 0.86) return ice;
        if (h < 0.53) return mix(sea, sea2, smooth(0.4, 0.53, h));
        const land = mix(green, green2, det(u, v));
        return h > 0.66 ? mix(land, sand, smooth(0.66, 0.74, h)) : land;
      });
      break;
    }
    case 'moon': {
      const n = fbm(41, 4);
      const cr = craters(42, 55, 0.025, 0.09);
      const maria = hex('#8e8e98');
      const high = hex('#dcdce2');
      c = paint(W, H, (u, v) => shade(mix(maria, high, smooth(0.38, 0.6, n(u, v))), 1 + cr(u, v) * 0.8));
      break;
    }
    case 'mars': {
      const n = fbm(51, 5);
      const cr = craters(52, 25, 0.02, 0.06);
      const a = hex('#b5482a');
      const b = hex('#e3864f');
      const dark = hex('#7e3420');
      const ice = hex('#fff6f0');
      c = paint(W, H, (u, v) => {
        const lat = Math.abs(v - 0.5) * 2;
        if (lat > 0.9) return ice;
        const h = n(u, v);
        const base = mix(a, b, smooth(0.3, 0.7, h));
        return shade(mix(base, dark, smooth(0.62, 0.75, 1 - h) * 0.6), 1 + cr(u, v) * 0.5);
      });
      break;
    }
    case 'jupiter': {
      const turb = fbm(61, 6);
      const fine = fbm(62, 14, 3);
      const zone = hex('#f3e7cf');
      const zone2 = hex('#ead7b4');
      const pole = hex('#b9a184');
      // Brown belts between cream zones, like the real planet (latitude, half-width, colour).
      const belts: [number, number, RGB][] = [
        [0.2, 0.025, hex('#c8a47e')],
        [0.29, 0.03, hex('#d3ae86')],
        [0.39, 0.045, hex('#b07c52')],
        [0.6, 0.042, hex('#b5845a')],
        [0.71, 0.028, hex('#cfa47a')],
        [0.8, 0.025, hex('#c49c75')],
      ];
      const spot = hex('#c4553a');
      const spotRim = hex('#f1c79a');
      c = paint(W, H, (u, v) => {
        const vv = v + (turb(u, v) - 0.5) * 0.035 + (fine(u, v) - 0.5) * 0.01;
        let col = mix(zone, zone2, fine(u, v));
        for (const [lat, hw, bc] of belts) {
          const k = Math.exp(-(((vv - lat) / hw) ** 2));
          if (k > 0.01) col = mix(col, bc, k * 0.9);
        }
        col = mix(col, pole, smooth(0.36, 0.48, Math.abs(v - 0.5)));
        // The Great Red Spot, on the south belt.
        let du = Math.abs(u - 0.66);
        du = Math.min(du, 1 - du);
        const d = Math.hypot(du / 0.07, (v - 0.645) / 0.04);
        if (d < 1.3) col = mix(col, spotRim, smooth(1.3, 1.0, d) * 0.8);
        if (d < 1) col = mix(col, spot, smooth(1, 0.5, d));
        return col;
      });
      break;
    }
    case 'saturn': {
      const turb = fbm(71, 5);
      const bands = [hex('#f2e2b8'), hex('#e0c385'), hex('#f5e9c8'), hex('#d4b06d'), hex('#ead6a3')];
      c = paint(W, H, (u, v) => {
        const f = (v + (turb(u, v) - 0.5) * 0.025) * 10;
        const i = Math.floor(f);
        return mix(bands[i % bands.length], bands[(i + 1) % bands.length], smooth(0.5, 1, f - i));
      });
      break;
    }
    case 'uranus': {
      const turb = fbm(81, 4);
      const a = hex('#a6ecef');
      const b = hex('#7fcdd6');
      c = paint(W, H, (u, v) => mix(a, b, Math.sin(v * 20 + turb(u, v) * 2) * 0.25 + 0.35 + Math.abs(v - 0.5) * 0.4));
      break;
    }
    case 'neptune': {
      const turb = fbm(91, 5);
      const a = hex('#4f74e6');
      const b = hex('#2a4bbd');
      const white = hex('#e6f0ff');
      const dark = hex('#1b2a7a');
      c = paint(W, H, (u, v) => {
        let col = mix(a, b, Math.sin(v * 16 + turb(u, v) * 3) * 0.5 + 0.5);
        let du = Math.abs(u - 0.3);
        du = Math.min(du, 1 - du);
        const d = Math.hypot(du / 0.06, (v - 0.6) / 0.04);
        if (d < 1) col = mix(col, dark, smooth(1, 0.4, d));
        const streak = Math.abs(v - 0.42 - Math.sin(u * 12) * 0.01);
        if (streak < 0.012 && turb(u, v) > 0.5) col = mix(col, white, 0.8);
        return col;
      });
      break;
    }
  }
  return toTexture(c, true);
}

/** Earth's white clouds (transparent), on a sphere just above the ground. */
export function earthClouds(): THREE.CanvasTexture {
  const n = fbm(35, 6);
  const c = paint(256, 128, (u, v) => {
    const k = smooth(0.55, 0.72, n(u, v));
    return [255, 255, 255, k * 230];
  });
  return toTexture(c, true);
}

/** The Sun's boiling surface. */
export function sunMap(): THREE.CanvasTexture {
  const n = fbm(5, 8);
  const a = hex('#ffb12e');
  const b = hex('#fff0a0');
  const c = paint(256, 128, (u, v) => mix(a, b, smooth(0.3, 0.75, n(u, v))));
  return toTexture(c, true);
}

/** Soft rays around the Sun (additive sprite). */
export function raysTexture(): THREE.CanvasTexture {
  const { c, g } = canvas(256, 256);
  g.translate(128, 128);
  for (let i = 0; i < 16; i++) {
    g.rotate((Math.PI * 2) / 16);
    const grad = g.createLinearGradient(0, 0, 0, -126);
    grad.addColorStop(0, 'rgba(255,230,140,0.9)');
    grad.addColorStop(1, 'rgba(255,170,60,0)');
    g.fillStyle = grad;
    g.beginPath();
    const w = i % 2 ? 9 : 16;
    g.moveTo(-w, 0);
    g.lineTo(0, i % 2 ? -100 : -126);
    g.lineTo(w, 0);
    g.closePath();
    g.fill();
  }
  return toTexture(c);
}

/** Saturn's (and Uranus's) rings: bands along the radius, u = 0 inside → 1 outside. */
export function ringTexture(kind: 'saturn' | 'uranus'): THREE.CanvasTexture {
  const r = rng(kind === 'saturn' ? 7 : 8);
  const { c, g } = canvas(512, 4);
  for (let x = 0; x < 512; x++) {
    const t = x / 511;
    let a: number;
    let col: string;
    if (kind === 'saturn') {
      // C ring (faint), B ring (bright), Cassini division, A ring.
      const gap = t > 0.62 && t < 0.68;
      a = gap ? 0.08 : t < 0.22 ? 0.35 : t < 0.62 ? 0.92 : 0.72;
      a *= 0.85 + r() * 0.15;
      const light = t < 0.22 ? '200,185,160' : t < 0.62 ? '240,226,190' : '222,204,165';
      col = `rgba(${light},${a})`;
    } else {
      // Two soft, thin rings (no fine lines: they shimmer when seen edge-on).
      a = 0.05 + 0.4 * Math.exp(-(((t - 0.35) / 0.07) ** 2)) + 0.5 * Math.exp(-(((t - 0.75) / 0.06) ** 2));
      col = `rgba(210,244,248,${a.toFixed(3)})`;
    }
    g.fillStyle = col;
    g.fillRect(x, 0, 1, 4);
  }
  const t = toTexture(c);
  return t;
}

/** A glowing circle that marks the planets you can pick. */
export function haloRingTexture(): THREE.CanvasTexture {
  const { c, g } = canvas(256, 256);
  g.translate(128, 128);
  for (const [w, a] of [
    [26, 0.12],
    [16, 0.25],
    [8, 0.6],
    [4, 1],
  ] as const) {
    g.strokeStyle = `rgba(255,236,150,${a})`;
    g.lineWidth = w;
    g.beginPath();
    g.arc(0, 0, 104, 0, Math.PI * 2);
    g.stroke();
  }
  // Little sparkles on the ring.
  g.fillStyle = 'rgba(255,255,255,0.95)';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    g.beginPath();
    g.arc(Math.cos(a) * 104, Math.sin(a) * 104, 7, 0, Math.PI * 2);
    g.fill();
  }
  return toTexture(c);
}

/** A rounded name tag under a planet (constant size on screen). */
export function nameTag(text: string, color: string): THREE.Sprite {
  const { c, g } = canvas(256, 72);
  g.font = 'bold 40px Fredoka, system-ui, sans-serif';
  const w = Math.min(248, g.measureText(text).width + 40);
  g.fillStyle = 'rgba(12,16,48,0.82)';
  const x = (256 - w) / 2;
  g.beginPath();
  g.roundRect(x, 8, w, 56, 28);
  g.fill();
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.stroke();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 38);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: toTexture(c), transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false }));
  s.scale.set(0.16, 0.045, 1);
  s.renderOrder = 10;
  return s;
}

/** A round number badge (counting from the Sun). */
export function numberBadge(n: number): THREE.Sprite {
  const { c, g } = canvas(128, 128);
  g.fillStyle = '#ffe066';
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = '#1d2a6b';
  g.stroke();
  g.fillStyle = '#1d2a6b';
  g.font = 'bold 76px Fredoka, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(n), 64, 70);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: toTexture(c), transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false }));
  s.scale.setScalar(0.07);
  s.renderOrder = 11;
  return s;
}

/** A rubber stamp "delivered" for the end map. */
export function stampSprite(color = '#e2453c'): THREE.Sprite {
  const { c, g } = canvas(160, 160);
  g.translate(80, 80);
  g.rotate(-0.25);
  g.strokeStyle = color;
  g.fillStyle = 'rgba(255,255,255,0.88)';
  g.lineWidth = 10;
  g.beginPath();
  g.arc(0, 0, 66, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.lineWidth = 4;
  g.beginPath();
  g.arc(0, 0, 52, 0, Math.PI * 2);
  g.stroke();
  // A big check mark and an envelope.
  g.lineWidth = 14;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(-30, 2);
  g.lineTo(-8, 26);
  g.lineTo(34, -24);
  g.stroke();
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: toTexture(c), transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false }));
  s.scale.setScalar(0.085);
  s.renderOrder = 12;
  return s;
}

/** A speech-bubble "?" over the rocket after a wrong address. */
export function questionBubble(): THREE.Sprite {
  const { c, g } = canvas(128, 128);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(64, 58, 50, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(44, 98);
  g.lineTo(36, 124);
  g.lineTo(66, 104);
  g.fill();
  g.fillStyle = '#7a4fd0';
  g.font = 'bold 76px Fredoka, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('?', 64, 62);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: toTexture(c), transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false }));
  s.scale.setScalar(0.07);
  s.renderOrder = 12;
  return s;
}

/** A five-point star (sparkles, sneezes). */
export function starTexture(): THREE.CanvasTexture {
  const { c, g } = canvas(64, 64);
  g.translate(32, 32);
  g.fillStyle = '#ffffff';
  g.shadowColor = 'rgba(255,240,180,1)';
  g.shadowBlur = 8;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 11 : 26;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  return toTexture(c);
}

/** Stripes (giant sock, beach ball, woolly hat). */
export function stripes(colors: string[], vertical = false, n = 8): THREE.CanvasTexture {
  const { c, g } = canvas(64, 64);
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[i % colors.length];
    if (vertical) g.fillRect((i * 64) / n, 0, 64 / n + 1, 64);
    else g.fillRect(0, (i * 64) / n, 64, 64 / n + 1);
  }
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** The address label on a parcel: a stamp and lines of "writing". */
export function parcelLabel(color: string): THREE.CanvasTexture {
  const { c, g } = canvas(128, 96);
  g.fillStyle = '#fffaf0';
  g.fillRect(0, 0, 128, 96);
  g.fillStyle = color;
  g.fillRect(88, 8, 32, 36);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 3;
  g.setLineDash([4, 3]);
  g.strokeRect(90, 10, 28, 32);
  g.setLineDash([]);
  g.fillStyle = '#ffe066';
  g.beginPath();
  g.arc(104, 26, 7, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#5b6b9a';
  g.lineWidth = 5;
  g.lineCap = 'round';
  for (const [y, w] of [
    [56, 90],
    [72, 70],
    [86, 80],
  ] as const) {
    g.beginPath();
    g.moveTo(12, y);
    g.lineTo(12 + w, y);
    g.stroke();
  }
  return toTexture(c);
}

/** The envelope behind the rocket's porthole. */
export function envelopeTexture(): THREE.CanvasTexture {
  const { c, g } = canvas(128, 128);
  const grad = g.createRadialGradient(64, 54, 8, 64, 64, 64);
  grad.addColorStop(0, '#d8f4ff');
  grad.addColorStop(1, '#5fb6ea');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#ffffff';
  g.fillRect(28, 40, 72, 50);
  g.strokeStyle = '#e2453c';
  g.lineWidth = 6;
  g.lineJoin = 'round';
  g.strokeRect(28, 40, 72, 50);
  g.beginPath();
  g.moveTo(28, 40);
  g.lineTo(64, 70);
  g.lineTo(100, 40);
  g.stroke();
  return toTexture(c);
}

/** A soft vertical gradient for flames (white core → orange → transparent). */
export function flameTexture(): THREE.CanvasTexture {
  const { c, g } = canvas(16, 128);
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(255,255,230,1)');
  grad.addColorStop(0.35, 'rgba(255,200,90,0.95)');
  grad.addColorStop(0.75, 'rgba(255,120,60,0.55)');
  grad.addColorStop(1, 'rgba(255,90,60,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 128);
  return toTexture(c);
}
