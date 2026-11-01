// Ziggy app artwork, drawn in a browser canvas from the official plush pictures
// (public/mascot/*). Nothing is invented: the cutouts are only cleaned up.
//  - ziggy-heart.webp: its right antenna was flattened by a retouch and the head top
//    has a notch next to it; the real (left) antenna and dome are mirrored over it.
//  - every cutout: the light halo left by the background removal is trimmed.
// Loaded by make-assets.mjs in a Playwright page.

const PEACH = ['#FFF7E6', '#FFE6C4', '#FFC9A6'];
const NIGHT = ['#2B3A86', '#1A2360', '#0E1440'];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Trims the light halo: alpha eroded by one pixel, then a steeper edge. */
function cleanAlpha(c) {
  const g = c.getContext('2d');
  const { width: w, height: h } = c;
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const a0 = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) a0[i] = d[i * 4 + 3];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 255;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.min(w - 1, Math.max(0, x + dx));
          const yy = Math.min(h - 1, Math.max(0, y + dy));
          m = Math.min(m, a0[yy * w + xx]);
        }
      }
      const a = Math.max(0, Math.min(255, ((m - 40) * 255) / 175));
      d[(y * w + x) * 4 + 3] = a;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** ziggy-heart.webp with the real left antenna and head dome mirrored onto the right. */
function repairHeart(img) {
  const w = img.width;
  const h = img.height;
  const axis = 389; // the head's seam line
  const band = 230; // antennae + top of the dome
  const feather = 45;
  const out = canvas(w, h);
  const g = out.getContext('2d');
  g.drawImage(img, 0, 0);

  const flip = canvas(w, band);
  const f = flip.getContext('2d');
  f.save();
  f.translate(2 * axis, 0);
  f.scale(-1, 1);
  f.drawImage(img, 0, 0);
  f.restore();
  f.globalCompositeOperation = 'destination-in';
  const keepRight = f.createLinearGradient(axis - 6, 0, axis + 6, 0);
  keepRight.addColorStop(0, 'rgba(0,0,0,0)');
  keepRight.addColorStop(1, 'rgba(0,0,0,1)');
  f.fillStyle = keepRight;
  f.fillRect(0, 0, w, band);
  const fade = f.createLinearGradient(0, band - feather, 0, band);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  f.fillStyle = fade;
  f.fillRect(0, 0, w, band);

  // Erase the original right-top proportionally, then add the mirrored part.
  const eraser = canvas(w, band);
  const e = eraser.getContext('2d');
  const right = e.createLinearGradient(axis - 6, 0, axis + 6, 0);
  right.addColorStop(0, 'rgba(0,0,0,0)');
  right.addColorStop(1, 'rgba(0,0,0,1)');
  e.fillStyle = right;
  e.fillRect(0, 0, w, band);
  e.globalCompositeOperation = 'destination-in';
  const fade2 = e.createLinearGradient(0, band - feather, 0, band);
  fade2.addColorStop(0, 'rgba(0,0,0,1)');
  fade2.addColorStop(1, 'rgba(0,0,0,0)');
  e.fillStyle = fade2;
  e.fillRect(0, 0, w, band);
  g.globalCompositeOperation = 'destination-out';
  g.drawImage(eraser, 0, 0);
  g.globalCompositeOperation = 'lighter';
  g.drawImage(flip, 0, 0);
  g.globalCompositeOperation = 'source-over';
  return cleanAlpha(out);
}

export async function loadZiggy(base) {
  const [heart, wave] = await Promise.all([loadImage(`${base}/ziggy-heart.webp`), loadImage(`${base}/ziggy-wave.webp`)]);
  const waveC = canvas(wave.width, wave.height);
  waveC.getContext('2d').drawImage(wave, 0, 0);
  return { heart: repairHeart(heart), wave: cleanAlpha(waveC) };
}

/** Same gradient as the adaptive icon background (res/drawable/ic_launcher_background.xml). */
function gradientBg(g, size, colors, w = size, h = size) {
  const r = g.createRadialGradient(w * 0.5, h * 0.2, 0, w * 0.5, h * 0.2, Math.max(w, h) * 0.88);
  r.addColorStop(0, colors[0]);
  r.addColorStop(0.5, colors[1]);
  r.addColorStop(1, colors[2]);
  g.fillStyle = r;
  g.fillRect(0, 0, w, h);
}

/**
 * Ziggy's head (and the hands holding the glowing heart), placed so that the face
 * centre is at (cx, cy) and the head, ears included, is `width` px wide.
 * Source coordinates in ziggy-heart.webp: ears span x 5..760, face centre y 470.
 */
function drawHead(g, heart, cx, cy, width, { bottom = Infinity } = {}) {
  const s = width / 755;
  const srcBottom = Math.min(heart.height, 470 + (bottom - cy) / s);
  g.drawImage(heart, 0, 0, heart.width, srcBottom, cx - 389 * s, cy - 470 * s, heart.width * s, srcBottom * s);
}

/** Android adaptive icon foreground (108 dp canvas, safe zone 66 dp) or full icon. */
export function icon(z, size, variant) {
  const c = canvas(size, size);
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  if (variant === 'foreground') {
    // 108 units: head 59 units wide (inside the 66-unit safe circle), face centred.
    drawHead(g, z.heart, size / 2, size * 0.5, size * 0.55);
  } else if (variant === 'monochrome') {
    // Themed icon (Android 13+): the head's silhouette, eyes and smile cut out.
    drawHead(g, z.heart, size / 2, size * 0.5, size * 0.55, { bottom: size * 0.7 });
    const soft = canvas(size, size);
    const sg = soft.getContext('2d');
    sg.filter = `blur(${Math.max(1, size / 140)}px)`;
    sg.drawImage(c, 0, 0);
    const img = g.getImageData(0, 0, size, size);
    const blurred = sg.getImageData(0, 0, size, size).data;
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const l = (0.2126 * blurred[i] + 0.7152 * blurred[i + 1] + 0.0722 * blurred[i + 2]) / 255;
      const feature = blurred[i + 3] > 200 && (l < 0.2 || l > 0.78);
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = feature ? 0 : d[i + 3] > 128 ? 255 : 0;
    }
    g.putImageData(img, 0, 0);
  } else {
    // Full square icon (iOS App Store, Play Store 512, legacy launchers).
    gradientBg(g, size, PEACH);
    drawHead(g, z.heart, size / 2, size * 0.53, size * 0.74);
  }
  return c;
}

/** Splash mark: Ziggy in a soft disc (2/3 of the canvas, Android 12 icon rule). */
export function splash(z, size, dark) {
  const c = canvas(size, size);
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  const r = size / 3;
  g.save();
  g.beginPath();
  g.arc(size / 2, size / 2, r, 0, Math.PI * 2);
  g.clip();
  const grad = g.createRadialGradient(size / 2, size / 2 - r * 0.6, 0, size / 2, size / 2, r * 1.15);
  const colors = dark ? NIGHT : PEACH;
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(0.55, colors[1]);
  grad.addColorStop(1, colors[2]);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  drawHead(g, z.heart, size / 2, size / 2 + r * 0.02, r * 1.62);
  g.restore();
  return c;
}

export { PEACH, NIGHT, drawHead, gradientBg, canvas };
