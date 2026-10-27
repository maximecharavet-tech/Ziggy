import * as THREE from 'three';
import { rng } from '../kit/rng';

/**
 * Ziggy's face is embroidered: the eyes, lashes, brows and mouth are thread
 * on felt. They are painted once on small canvases (with thread strokes so
 * close-ups look stitched), then laid on the head as decals.
 */

function canvas(w: number, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function tex(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Satin-stitch texture: many short parallel threads over a fill. */
function threads(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, light: string, dark: string, seed: number, radialStitch = false) {
  const rnd = rng(seed);
  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.clip();
  g.lineCap = 'round';
  for (let i = 0; i < r * 9; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * r;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const dir = radialStitch ? a : -0.5 + rnd() * 0.12;
    const len = r * (0.05 + rnd() * 0.08);
    g.strokeStyle = rnd() < 0.5 ? light : dark;
    g.globalAlpha = 0.18 + rnd() * 0.2;
    g.lineWidth = 1 + rnd() * 1.2;
    g.beginPath();
    g.moveTo(x - Math.cos(dir) * len, y - Math.sin(dir) * len);
    g.lineTo(x + Math.cos(dir) * len, y + Math.sin(dir) * len);
    g.stroke();
  }
  g.restore();
  g.globalAlpha = 1;
}

let cache: FaceTextures | null = null;

export interface FaceTextures {
  sclera: THREE.Texture;
  iris: THREE.Texture;
  brow: THREE.Texture;
  mouths: Record<MouthShape, THREE.Texture>;
}

export type MouthShape = 'smile' | 'grin' | 'open' | 'o' | 'small' | 'sleep';

/** White of the eye: embroidered white with a soft grey edge. */
function drawSclera() {
  const S = 256;
  const [c, g] = canvas(S);
  const r = S / 2 - 4;
  const grad = g.createRadialGradient(S * 0.45, S * 0.4, r * 0.2, S / 2, S / 2, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.75, '#f5f1f3');
  grad.addColorStop(1, '#d9d0d8');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(S / 2, S / 2, r, 0, Math.PI * 2);
  g.fill();
  threads(g, S / 2, S / 2, r, '#ffffff', '#cfc6d2', 11);
  // Thin embroidered rim.
  g.strokeStyle = 'rgba(150,130,150,0.55)';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(S / 2, S / 2, r - 3, 0, Math.PI * 2);
  g.stroke();
  return tex(c);
}

/**
 * Iris and pupil on a transparent square: shifting the texture moves the
 * gaze, and the round eye patch clips it like a real eye.
 */
function drawIris() {
  const S = 512;
  const [c, g] = canvas(S);
  const cx = S / 2;
  const r = S * 0.34;
  // Green iris: dark ring outside, fresh green inside, radial stitches.
  const grad = g.createRadialGradient(cx, cx, r * 0.35, cx, cx, r);
  grad.addColorStop(0, '#9bd36a');
  grad.addColorStop(0.55, '#6db044');
  grad.addColorStop(0.85, '#3f7f2c');
  grad.addColorStop(1, '#24521b');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cx, r, 0, Math.PI * 2);
  g.fill();
  threads(g, cx, cx, r, '#b8e88a', '#2f6a22', 23, true);
  // Pupil: deep brown-black with a faint warm edge.
  const pr = r * 0.56;
  const pg = g.createRadialGradient(cx - pr * 0.2, cx - pr * 0.25, pr * 0.1, cx, cx, pr);
  pg.addColorStop(0, '#3a2a26');
  pg.addColorStop(0.7, '#1b1210');
  pg.addColorStop(1, '#2a1c16');
  g.fillStyle = pg;
  g.beginPath();
  g.arc(cx, cx, pr, 0, Math.PI * 2);
  g.fill();
  // Highlights: the big round catchlight and a little one, like the photos.
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(cx + r * 0.3, cx - r * 0.32, r * 0.2, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 0.85;
  g.beginPath();
  g.arc(cx - r * 0.3, cx + r * 0.32, r * 0.08, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** An eyebrow: a thick black embroidered arc. */
function drawBrow() {
  const W = 256;
  const H = 96;
  const [c, g] = canvas(W, H);
  g.lineCap = 'round';
  g.strokeStyle = '#1d1a22';
  g.lineWidth = 26;
  g.beginPath();
  g.moveTo(24, 70);
  g.quadraticCurveTo(W / 2, 6, W - 24, 70);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.12)';
  g.lineWidth = 3;
  for (let i = 0; i < 18; i++) {
    const x = 34 + i * 11;
    g.beginPath();
    g.moveTo(x, 70 - Math.sin((x / W) * Math.PI) * 54 - 8);
    g.lineTo(x + 8, 70 - Math.sin(((x + 8) / W) * Math.PI) * 54 + 6);
    g.stroke();
  }
  return tex(c);
}

/** The mouths: thread smile, open grin with teeth and tongue, little "o"… */
function drawMouth(kind: MouthShape) {
  const W = 256;
  const H = 160;
  const [c, g] = canvas(W, H);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const ink = '#16121a';
  if (kind === 'smile' || kind === 'small' || kind === 'sleep') {
    const w = kind === 'smile' ? 0.82 : kind === 'small' ? 0.5 : 0.36;
    const x0 = W * (0.5 - w / 2);
    const x1 = W * (0.5 + w / 2);
    g.strokeStyle = ink;
    g.lineWidth = kind === 'smile' ? 20 : 17;
    g.beginPath();
    g.moveTo(x0, H * 0.36);
    g.quadraticCurveTo(W / 2, H * (kind === 'sleep' ? 0.58 : 0.82), x1, H * 0.36);
    g.stroke();
    return tex(c);
  }
  // Open mouths: dark inside, pink tongue, white teeth, embroidered rim.
  const shape = (cx: number, cy: number, w: number, h: number, round: boolean) => {
    g.beginPath();
    if (round) g.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    else {
      g.moveTo(cx - w / 2, cy - h * 0.42);
      g.quadraticCurveTo(cx, cy - h * 0.55, cx + w / 2, cy - h * 0.42);
      g.quadraticCurveTo(cx + w * 0.42, cy + h * 0.6, cx, cy + h * 0.55);
      g.quadraticCurveTo(cx - w * 0.42, cy + h * 0.6, cx - w / 2, cy - h * 0.42);
    }
    g.closePath();
  };
  const dims = { grin: [W * 0.62, H * 0.62, false], open: [W * 0.46, H * 0.6, false], o: [W * 0.26, H * 0.42, true] } as const;
  const [w, h, round] = dims[kind];
  const cx = W / 2;
  const cy = H * 0.5;
  shape(cx, cy, w, h, round);
  g.fillStyle = '#2a0f17';
  g.fill();
  g.save();
  shape(cx, cy, w, h, round);
  g.clip();
  // Tongue.
  g.fillStyle = '#e8737f';
  g.beginPath();
  g.ellipse(cx, cy + h * 0.42, w * 0.32, h * 0.32, 0, 0, Math.PI * 2);
  g.fill();
  // Teeth (not in the little "o").
  if (!round) {
    g.fillStyle = '#fbf6f0';
    g.fillRect(cx - w * 0.38, cy - h * 0.56, w * 0.76, h * 0.2);
  }
  g.restore();
  shape(cx, cy, w, h, round);
  g.strokeStyle = ink;
  g.lineWidth = 11;
  g.stroke();
  return tex(c);
}

export function faceTextures(): FaceTextures {
  if (cache) return cache;
  cache = {
    sclera: drawSclera(),
    iris: drawIris(),
    brow: drawBrow(),
    mouths: {
      smile: drawMouth('smile'),
      grin: drawMouth('grin'),
      open: drawMouth('open'),
      o: drawMouth('o'),
      small: drawMouth('small'),
      sleep: drawMouth('sleep'),
    },
  };
  return cache;
}

export function isFaceTexture(t: THREE.Texture) {
  if (!cache) return false;
  return t === cache.sclera || t === cache.iris || t === cache.brow || Object.values(cache.mouths).includes(t);
}

/**
 * The upper eyelid at a given openness (1 open, 0 closed), as two flat 2D
 * shapes in the eye's frame (radius R): the felt lid covering the top of the
 * eye, and the black lash line along its edge with three lashes on the outer
 * side (+x). Both are later laid on the head.
 */
export function lidShapes(R: number, open: number): { lid: THREE.Shape | null; lash: THREE.Shape; lashes: THREE.Shape[] } {
  const steps = 28;
  // Lid edge: a soft downward curve sliding from above the eye to its bottom.
  const L = -R * 1.05 + (R * 1.25 + R * 1.05) * open;
  const sag = R * 0.28 * (1 - open * 0.6);
  const edge = (x: number) => L - sag * (1 - (x / R) * (x / R));
  const top = (x: number) => Math.sqrt(Math.max(0, R * R - x * x));
  const xs: number[] = [];
  for (let i = 0; i <= steps; i++) xs.push(-R + (2 * R * i) / steps);
  const lashY = (x: number) => Math.max(-top(x), Math.min(top(x), edge(x)));

  let lid: THREE.Shape | null = null;
  const covered = xs.filter((x) => edge(x) < top(x));
  if (covered.length > 1) {
    lid = new THREE.Shape();
    const pad = R * 0.08;
    lid.moveTo(covered[0] - pad, top(covered[0]) + pad);
    for (const x of covered) lid.lineTo(x, top(x) + pad);
    lid.lineTo(covered[covered.length - 1] + pad, top(covered[covered.length - 1]) + pad);
    for (let i = covered.length - 1; i >= 0; i--) lid.lineTo(covered[i], lashY(covered[i]));
    lid.closePath();
  }

  // Lash line: thick, thicker toward the outer corner, slightly overhanging.
  const lash = new THREE.Shape();
  const thick = (x: number) => R * (0.09 + 0.07 * ((x / R + 1) / 2));
  const ext = R * 1.08;
  const pts = xs.map((x) => [x * (ext / R), lashY(x)] as const);
  lash.moveTo(pts[0][0], pts[0][1] - R * 0.02);
  for (const [x, y] of pts) lash.lineTo(x, y - R * 0.02);
  for (let i = pts.length - 1; i >= 0; i--) lash.lineTo(pts[i][0], pts[i][1] + thick(pts[i][0]));
  lash.closePath();
  // Three lashes flicking outward at the outer corner (only when open enough).
  const lashes: THREE.Shape[] = [];
  if (open > 0.25) {
    const k = Math.min(1, (open - 0.25) / 0.4);
    [0.55, 0.75, 0.93].forEach((f, i) => {
      const x = R * f;
      const y = lashY(x) + thick(x) * 0.7;
      const ang = 0.9 - i * 0.45;
      const len = R * (0.32 + i * 0.04) * k;
      const w = R * 0.05;
      const tip = [x + Math.cos(ang) * len, y + Math.sin(ang) * len];
      const sh = new THREE.Shape();
      sh.moveTo(x - w, y - w * 0.5);
      sh.quadraticCurveTo(x + Math.cos(ang) * len * 0.5 - w, y + Math.sin(ang) * len * 0.6, tip[0], tip[1]);
      sh.quadraticCurveTo(x + Math.cos(ang) * len * 0.5 + w, y + Math.sin(ang) * len * 0.4, x + w, y - w * 0.5);
      lashes.push(sh);
    });
  }
  return { lid, lash, lashes };
}
