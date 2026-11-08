import * as THREE from 'three';
import { rng } from '../kit/rng';

/**
 * Canvas textures painted in code for the Santa scenes (no image to load).
 */

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function tex(c: HTMLCanvasElement, repeat?: [number, number]): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

/** Red and white candy stripes (wraps around a tube). */
export function stripesTexture(a = '#e23b3b', b = '#fff8f0', n = 6): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  g.fillStyle = b;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = a;
  const step = 128 / n;
  for (let i = -n; i < n * 2; i++) {
    g.beginPath();
    g.moveTo(i * step, 0);
    g.lineTo(i * step + step * 0.5, 0);
    g.lineTo(i * step + step * 0.5 + 128, 128);
    g.lineTo(i * step + 128, 128);
    g.closePath();
    g.fill();
  }
  return tex(c, [1, 1]);
}

/** Warm log-cabin wall: horizontal round logs with grain. */
export function logsTexture(rows = 8): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  const r = rng(11);
  const h = 256 / rows;
  for (let i = 0; i < rows; i++) {
    const y = i * h;
    const grad = g.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, '#6e3f22');
    grad.addColorStop(0.18, '#a8683a');
    grad.addColorStop(0.5, '#b97a45');
    grad.addColorStop(0.82, '#8c5530');
    grad.addColorStop(1, '#4a2814');
    g.fillStyle = grad;
    g.fillRect(0, y, 256, h);
    g.strokeStyle = 'rgba(70,35,15,0.25)';
    g.lineWidth = 1.5;
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      const yy = y + h * (0.3 + r() * 0.45);
      g.moveTo(0, yy);
      for (let x = 0; x <= 256; x += 16) g.lineTo(x, yy + Math.sin(x * 0.05 + r() * 6) * 1.5);
      g.stroke();
    }
  }
  return tex(c, [1, 1]);
}

/** Wooden planks (floor, desk, shelves). */
export function planksTexture(base = '#9a5f34', n = 6): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  const r = rng(5);
  const w = 256 / n;
  const col = new THREE.Color(base);
  for (let i = 0; i < n; i++) {
    const k = 0.85 + r() * 0.3;
    g.fillStyle = `#${col.clone().multiplyScalar(k).getHexString()}`;
    g.fillRect(i * w, 0, w, 256);
    g.strokeStyle = 'rgba(60,30,10,0.18)';
    for (let l = 0; l < 6; l++) {
      g.beginPath();
      const x = i * w + r() * w;
      g.moveTo(x, 0);
      for (let y = 0; y <= 256; y += 16) g.lineTo(x + Math.sin(y * 0.04 + l) * 2, y);
      g.stroke();
    }
    g.fillStyle = 'rgba(40,20,8,0.55)';
    g.fillRect(i * w, 0, 2, 256);
  }
  return tex(c, [1, 1]);
}

/** Cosy wallpaper: deep red with little golden stars and dots. */
export function wallpaperTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#8f2a2e';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#86262a' : '#962f33';
    g.fillRect(i * 32, 0, 32, 256);
  }
  const star = (x: number, y: number, r: number) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  };
  g.fillStyle = '#e9b85a';
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) star(32 + x * 64 + (y % 2) * 32 - 16, 32 + y * 64, 7);
  g.fillStyle = 'rgba(255,220,150,0.5)';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) g.fillRect(x * 32 + 15, y * 32 + 15, 2, 2);
  return tex(c, [3, 2]);
}

/** Bricks for the fireplace. */
export function bricksTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  const r = rng(9);
  g.fillStyle = '#d9c3a8';
  g.fillRect(0, 0, 256, 256);
  const bh = 32;
  const bw = 64;
  for (let row = 0; row < 8; row++)
    for (let i = -1; i < 5; i++) {
      const x = i * bw + (row % 2 ? bw / 2 : 0);
      const k = 0.85 + r() * 0.3;
      const col = new THREE.Color('#b0553c').multiplyScalar(k);
      g.fillStyle = `#${col.getHexString()}`;
      g.beginPath();
      g.roundRect(x + 3, row * bh + 3, bw - 6, bh - 6, 6);
      g.fill();
    }
  return tex(c, [1, 1]);
}

/**
 * The big "nice things" scroll: parchment with hand-drawn lines of gold
 * stars, hearts and little drawings (no words: little ones can't read, and
 * it is never a "naughty list").
 */
export function scrollTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 512);
  const r = rng(21);
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, '#ecd29c');
  grad.addColorStop(0.15, '#fbecc6');
  grad.addColorStop(0.85, '#fbecc6');
  grad.addColorStop(1, '#e6c88e');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 512);
  // A big heart at the top.
  g.fillStyle = '#e2453c';
  g.beginPath();
  g.moveTo(128, 76);
  g.bezierCurveTo(96, 52, 92, 26, 112, 22);
  g.bezierCurveTo(122, 20, 128, 30, 128, 36);
  g.bezierCurveTo(128, 30, 134, 20, 144, 22);
  g.bezierCurveTo(164, 26, 160, 52, 128, 76);
  g.fill();
  const icons = ['star', 'heart', 'star', 'tree', 'star', 'heart'];
  for (let line = 0; line < 13; line++) {
    const y = 110 + line * 30;
    const icon = icons[line % icons.length];
    g.fillStyle = icon === 'heart' ? '#e2453c' : icon === 'tree' ? '#2f8a50' : '#e3a51c';
    if (icon === 'tree') {
      g.beginPath();
      g.moveTo(30, y - 9);
      g.lineTo(40, y + 8);
      g.lineTo(20, y + 8);
      g.fill();
    } else if (icon === 'heart') {
      g.beginPath();
      g.arc(26, y - 2, 5, 0, Math.PI * 2);
      g.arc(35, y - 2, 5, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(21, y);
      g.lineTo(30.5, y + 10);
      g.lineTo(40, y);
      g.fill();
    } else {
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 ? 4 : 10;
        g.lineTo(30 + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      g.fill();
    }
    // A wavy "handwriting" line in brown ink.
    g.strokeStyle = 'rgba(92,52,28,0.75)';
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath();
    const len = 140 + r() * 60;
    for (let x = 0; x <= len; x += 4) {
      const yy = y + Math.sin(x * 0.32 + line) * 3 + Math.sin(x * 0.11) * 1.5;
      if (x === 0) g.moveTo(54 + x, yy);
      else g.lineTo(54 + x, yy);
    }
    g.stroke();
  }
  return tex(c);
}

/** Night window: deep blue with a soft glow at the bottom (snow light). */
export function nightWindowTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#1a2766');
  grad.addColorStop(0.65, '#3a4fa0');
  grad.addColorStop(1, '#a9b8ef');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const r = rng(4);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 26; i++) {
    g.globalAlpha = 0.5 + r() * 0.5;
    g.beginPath();
    g.arc(r() * 128, r() * 90, 0.6 + r() * 1.2, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  // Snowy hills.
  g.fillStyle = '#e8eeff';
  g.beginPath();
  g.moveTo(0, 128);
  g.lineTo(0, 104);
  g.quadraticCurveTo(40, 88, 70, 104);
  g.quadraticCurveTo(100, 94, 128, 100);
  g.lineTo(128, 128);
  g.fill();
  return tex(c);
}

/** Warm lit window: amber glow with a soft centre. */
export function warmWindowTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(64, 64);
  const grad = g.createRadialGradient(32, 40, 2, 32, 32, 44);
  grad.addColorStop(0, '#fff3c4');
  grad.addColorStop(0.5, '#ffc861');
  grad.addColorStop(1, '#e88a2c');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return tex(c);
}

/** A star-shaped sparkle (twinkles, magic). */
export function sparkleTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#ffffff';
  g.translate(32, 32);
  for (const rot of [0, Math.PI / 2]) {
    g.save();
    g.rotate(rot);
    g.beginPath();
    g.moveTo(-30, 0);
    g.quadraticCurveTo(0, -3, 30, 0);
    g.quadraticCurveTo(0, 3, -30, 0);
    g.fill();
    g.restore();
  }
  return tex(c);
}

/** Vertical soft gradient (backdrop wall glow, fog cards). */
export function gradientTexture(stops: [number, string][], w = 4, h = 256): THREE.CanvasTexture {
  const [c, g] = canvas(w, h);
  const grad = g.createLinearGradient(0, 0, 0, h);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  return tex(c);
}
