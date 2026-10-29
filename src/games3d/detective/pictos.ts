import { HUE_HEX, type Clue, type Lit, type Species, type Suspect } from './logic';

/**
 * Clue pictures drawn on a canvas: a hat of the right colour, glasses, a
 * scarf, big/small friends, a little map of the square with the fountain,
 * and a soft "no" sign for negations. The same drawings appear in the HUD
 * (as images) and in the 3D village (as canvas textures), so little ones who
 * can't read yet match pictures, not words.
 */

const RAINBOW = ['#ff5f6d', '#ffb02e', '#ffd34d', '#7ed957', '#5fb8ff', '#b07dff'];
const INK = '#3b2a5a';

function card(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.save();
  g.fillStyle = '#fffaf0';
  g.strokeStyle = '#f0d9b5';
  g.lineWidth = s * 0.03;
  g.beginPath();
  g.roundRect(x + s * 0.03, y + s * 0.03, s * 0.94, s * 0.94, s * 0.16);
  g.fill();
  g.stroke();
  g.restore();
}

function rainbowFill(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const grad = g.createLinearGradient(x, y, x + w, y);
  RAINBOW.forEach((c, i) => grad.addColorStop(i / (RAINBOW.length - 1), c));
  return grad;
}

function drawHat(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string | 'any') {
  const fill = color === 'any' ? rainbowFill(g, cx - s * 0.32, cy, s * 0.64, 1) : color;
  g.save();
  g.lineJoin = 'round';
  g.lineWidth = s * 0.035;
  g.strokeStyle = INK;
  // Crown.
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(cx - s * 0.2, cy + s * 0.12);
  g.lineTo(cx - s * 0.18, cy - s * 0.2);
  g.quadraticCurveTo(cx, cy - s * 0.3, cx + s * 0.18, cy - s * 0.2);
  g.lineTo(cx + s * 0.2, cy + s * 0.12);
  g.closePath();
  g.fill();
  g.stroke();
  // Band.
  g.fillStyle = '#fff6e0';
  g.fillRect(cx - s * 0.2, cy + s * 0.02, s * 0.4, s * 0.08);
  g.strokeRect(cx - s * 0.2, cy + s * 0.02, s * 0.4, s * 0.08);
  // Brim.
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(cx, cy + s * 0.14, s * 0.34, s * 0.07, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.restore();
}

function drawScarf(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string | 'any') {
  const fill = color === 'any' ? rainbowFill(g, cx - s * 0.3, cy, s * 0.6, 1) : color;
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.lineWidth = s * 0.035;
  g.strokeStyle = INK;
  g.fillStyle = fill;
  // The loop around the neck.
  g.beginPath();
  g.ellipse(cx, cy - s * 0.08, s * 0.3, s * 0.13, 0, 0, Math.PI * 2);
  g.ellipse(cx, cy - s * 0.1, s * 0.18, s * 0.06, 0, 0, Math.PI * 2, true);
  g.fill('evenodd');
  g.stroke();
  // The hanging end with fringes.
  g.beginPath();
  g.moveTo(cx + s * 0.06, cy - s * 0.0);
  g.lineTo(cx + s * 0.2, cy + s * 0.0);
  g.lineTo(cx + s * 0.16, cy + s * 0.3);
  g.lineTo(cx + s * 0.02, cy + s * 0.28);
  g.closePath();
  g.fill();
  g.stroke();
  g.strokeStyle = '#fff6e0';
  g.lineWidth = s * 0.03;
  g.beginPath();
  g.moveTo(cx + s * 0.05, cy + s * 0.15);
  g.lineTo(cx + s * 0.18, cy + s * 0.16);
  g.stroke();
  g.strokeStyle = INK;
  g.lineWidth = s * 0.02;
  for (let i = 0; i < 4; i++) {
    const x = cx + s * (0.03 + i * 0.04);
    g.beginPath();
    g.moveTo(x, cy + s * 0.29);
    g.lineTo(x - s * 0.005, cy + s * 0.36);
    g.stroke();
  }
  g.restore();
}

function drawGlasses(g: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  g.save();
  g.lineWidth = s * 0.045;
  g.strokeStyle = INK;
  g.fillStyle = 'rgba(160,215,255,0.55)';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.arc(cx + sx * s * 0.17, cy, s * 0.13, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // Shine.
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.lineWidth = s * 0.025;
    g.beginPath();
    g.arc(cx + sx * s * 0.17, cy, s * 0.08, Math.PI * 1.1, Math.PI * 1.45);
    g.stroke();
    g.restore();
  }
  g.beginPath();
  g.moveTo(cx - s * 0.05, cy - s * 0.02);
  g.quadraticCurveTo(cx, cy - s * 0.07, cx + s * 0.05, cy - s * 0.02);
  g.stroke();
  g.beginPath();
  g.moveTo(cx - s * 0.3, cy - s * 0.03);
  g.lineTo(cx - s * 0.4, cy - s * 0.08);
  g.moveTo(cx + s * 0.3, cy - s * 0.03);
  g.lineTo(cx + s * 0.4, cy - s * 0.08);
  g.stroke();
  g.restore();
}

/** A round little friend silhouette. */
function buddy(g: CanvasRenderingContext2D, cx: number, base: number, h: number, color: string, star: boolean) {
  const r = h * 0.28;
  g.save();
  g.fillStyle = color;
  g.strokeStyle = INK;
  g.lineWidth = Math.max(2, h * 0.04);
  g.beginPath();
  g.ellipse(cx, base - h * 0.3, r * 1.05, h * 0.3, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.beginPath();
  g.arc(cx, base - h * 0.75, r, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.arc(cx + sx * r * 0.62, base - h * 0.75 - r * 0.85, r * 0.32, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.fillStyle = INK;
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.arc(cx + sx * r * 0.35, base - h * 0.77, Math.max(1.5, r * 0.12), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  if (star) {
    g.save();
    g.fillStyle = '#ffcf33';
    g.strokeStyle = '#c98a00';
    g.lineWidth = 2;
    const sy = base - h - r * 0.4;
    const R = Math.max(8, h * 0.13);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? R * 0.45 : R;
      g.lineTo(cx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
}

function drawSize(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, size: 'big' | 'small') {
  const base = cy + s * 0.32;
  buddy(g, cx - s * 0.17, base, s * 0.6, size === 'big' ? '#ffb36b' : '#e8e1f0', size === 'big');
  buddy(g, cx + s * 0.2, base, s * 0.32, size === 'small' ? '#ffb36b' : '#e8e1f0', size === 'small');
  g.save();
  g.strokeStyle = '#d8c7a8';
  g.lineWidth = s * 0.02;
  g.beginPath();
  g.moveTo(cx - s * 0.42, base + s * 0.01);
  g.lineTo(cx + s * 0.42, base + s * 0.01);
  g.stroke();
  g.restore();
}

/** Mini map of the square: back row on top, fountain in the middle, front row at the bottom. */
function drawMap(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, hl: { col?: 'left' | 'right'; row?: 'front' | 'back' }) {
  const colX = [-0.28, 0, 0.28];
  const rowY = { back: -0.25, front: 0.25 };
  g.save();
  // Ground.
  g.fillStyle = '#f1e4cc';
  g.beginPath();
  g.ellipse(cx, cy, s * 0.43, s * 0.4, 0, 0, Math.PI * 2);
  g.fill();
  // Highlight band.
  g.fillStyle = 'rgba(255,207,51,0.75)';
  if (hl.col) {
    const x = cx + colX[hl.col === 'left' ? 0 : 2] * s;
    g.beginPath();
    g.roundRect(x - s * 0.11, cy - s * 0.37, s * 0.22, s * 0.74, s * 0.08);
    g.fill();
  }
  if (hl.row) {
    const y = cy + rowY[hl.row] * s;
    g.beginPath();
    g.roundRect(cx - s * 0.4, y - s * 0.1, s * 0.8, s * 0.2, s * 0.08);
    g.fill();
  }
  // The fountain.
  g.fillStyle = '#7fd0ff';
  g.strokeStyle = '#3f7fe0';
  g.lineWidth = s * 0.025;
  g.beginPath();
  g.arc(cx, cy, s * 0.09, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(cx, cy, s * 0.03, 0, Math.PI * 2);
  g.fill();
  // The six places.
  for (const row of ['back', 'front'] as const)
    colX.forEach((x, i) => {
      const lit = (hl.col && i === (hl.col === 'left' ? 0 : 2)) || hl.row === row;
      g.fillStyle = lit ? '#ff8a3d' : '#cbbca4';
      g.beginPath();
      g.arc(cx + x * s, cy + rowY[row] * s, s * 0.055, 0, Math.PI * 2);
      g.fill();
    });
  // "You": an eye at the bottom, so front/back is clear.
  g.fillStyle = INK;
  g.beginPath();
  g.ellipse(cx, cy + s * 0.46, s * 0.07, s * 0.04, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(cx, cy + s * 0.46, s * 0.018, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawNo(g: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  g.save();
  g.strokeStyle = 'rgba(240,80,90,0.92)';
  g.lineWidth = s * 0.07;
  g.beginPath();
  g.arc(cx, cy, s * 0.38, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(cx - s * 0.27, cy - s * 0.27);
  g.lineTo(cx + s * 0.27, cy + s * 0.27);
  g.stroke();
  g.restore();
}

/** One statement in a square of side `s` at (x, y). */
export function drawLit(g: CanvasRenderingContext2D, l: Lit, x: number, y: number, s: number) {
  card(g, x, y, s);
  const cx = x + s / 2;
  const cy = y + s / 2;
  const t = l.trait;
  switch (t.k) {
    case 'hat':
      drawHat(g, cx, cy, s, HUE_HEX[t.hue]);
      break;
    case 'anyHat':
      drawHat(g, cx, cy, s, 'any');
      break;
    case 'scarf':
      drawScarf(g, cx, cy, s, HUE_HEX[t.hue]);
      break;
    case 'anyScarf':
      drawScarf(g, cx, cy, s, 'any');
      break;
    case 'glasses':
      drawGlasses(g, cx, cy, s);
      break;
    case 'size':
      drawSize(g, cx, cy, s, t.size);
      break;
    case 'side':
      drawMap(g, cx, cy, s, { col: t.side });
      break;
    case 'row':
      drawMap(g, cx, cy, s, { row: t.row });
      break;
  }
  if (l.not) drawNo(g, cx, cy, s);
}

/** The whole clue: one square, or two squares joined by a "+". */
export function clueCanvas(c: Clue, s = 256): HTMLCanvasElement {
  const n = c.lits.length;
  const gap = n > 1 ? s * 0.32 : 0;
  const cv = document.createElement('canvas');
  cv.width = Math.round(s * n + gap);
  cv.height = s;
  const g = cv.getContext('2d')!;
  c.lits.forEach((l, i) => drawLit(g, l, i * (s + gap), 0, s));
  if (n > 1) {
    g.fillStyle = INK;
    g.font = `bold ${Math.round(s * 0.3)}px Fredoka, system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('+', s + gap / 2, s / 2);
  }
  return cv;
}

const cache = new Map<string, string>();
export function clueDataUrl(c: Clue, s = 192): string {
  const key = JSON.stringify(c.lits) + s;
  const hit = cache.get(key);
  if (hit) return hit;
  const url = clueCanvas(c, s).toDataURL('image/png');
  cache.set(key, url);
  return url;
}

/** Mini map of where a friend stands (for the suspect cards of older children). */
export function placeOf(s: Suspect): { col: number; row: number } {
  return { col: s.col === 'left' ? 0 : s.col === 'center' ? 1 : 2, row: s.row === 'back' ? 0 : 2 };
}

export type PortraitMap = Partial<Record<Species, string>>;
