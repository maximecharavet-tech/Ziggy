import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Small helpers for the fairground: merging static pieces into a few draw
 * calls, and textures painted on a canvas (stripes, number badges, labels).
 */

/** Merge every static, untextured Lambert mesh under `root` into vertex-coloured meshes. */
export function mergeStatic(root: THREE.Object3D, opts: { receive?: boolean; smooth?: boolean } = {}): void {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const buckets = new Map<string, { geos: THREE.BufferGeometry[]; cast: boolean; side: THREE.Side; flat: boolean }>();
  const done: THREE.Mesh[] = [];
  const skipped = (o: THREE.Object3D) => {
    for (let x: THREE.Object3D | null = o; x && x !== root.parent; x = x.parent) if (x.userData.noMerge) return true;
    return false;
  };
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || skipped(m)) return;
    const mt = m.material as THREE.MeshLambertMaterial;
    if (Array.isArray(m.material) || !mt.isMeshLambertMaterial || mt.transparent || mt.map) return;
    let g = m.geometry.clone();
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(inv.clone().multiply(m.matrixWorld));
    const base = mt.color.clone().add(mt.emissive ?? new THREE.Color(0));
    const n = g.attributes.position.count;
    const cols = new Float32Array(n * 3);
    const src = mt.vertexColors ? (g.attributes.color as THREE.BufferAttribute | undefined) : undefined;
    for (let i = 0; i < n; i++) {
      cols[i * 3] = base.r * (src ? src.getX(i) : 1);
      cols[i * 3 + 1] = base.g * (src ? src.getY(i) : 1);
      cols[i * 3 + 2] = base.b * (src ? src.getZ(i) : 1);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const flat = opts.smooth ? Boolean(mt.flatShading) : true;
    const key = `${m.castShadow}-${mt.side}-${flat}`;
    if (!buckets.has(key)) buckets.set(key, { geos: [], cast: m.castShadow, side: mt.side, flat });
    buckets.get(key)!.geos.push(g);
    done.push(m);
  });
  for (const m of done) {
    m.parent?.remove(m);
    m.geometry.dispose();
    (m.material as THREE.Material).dispose();
  }
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    b.geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: b.flat, side: b.side }));
    mesh.castShadow = b.cast;
    mesh.receiveShadow = Boolean(opts.receive);
    root.add(mesh);
  }
}

/** Lambert material (smooth by default: the fair is soft, not faceted). */
export const soft = (color: THREE.ColorRepresentation, extra: Partial<THREE.MeshLambertMaterialParameters> = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
export const flat = (color: THREE.ColorRepresentation, extra: Partial<THREE.MeshLambertMaterialParameters> = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
/** Shiny plastic (balloons, the cart, the duck). */
export const shiny = (color: THREE.ColorRepresentation, shininess = 70) => new THREE.MeshPhongMaterial({ color, shininess, specular: new THREE.Color('#ffffff').multiplyScalar(0.35) });

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function texture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Stripes (circus tents, awnings, the pool rim). */
export function stripes(colors: string[], count: number, vertical = true): THREE.CanvasTexture {
  const [c, g] = canvas(256, 64);
  const w = 256 / count;
  for (let i = 0; i < count; i++) {
    g.fillStyle = colors[i % colors.length];
    if (vertical) g.fillRect(i * w, 0, w + 1, 64);
    else g.fillRect(0, (i * 64) / count, 256, 64 / count + 1);
  }
  const t = texture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const FONT = 'Fredoka, "Baloo 2", system-ui, sans-serif';

export type BadgeStyle = 'station' | 'start' | 'target' | 'hidden' | 'small';

const BADGE: Record<BadgeStyle, { fill: string; ring: string; ink: string }> = {
  station: { fill: '#fffaf0', ring: '#5b6fd8', ink: '#1d2a6b' },
  start: { fill: '#dff8e6', ring: '#2fae66', ink: '#14532d' },
  target: { fill: '#ffe066', ring: '#ff7a1a', ink: '#5a2a00' },
  hidden: { fill: '#ffe1f0', ring: '#ff5ca8', ink: '#7a1550' },
  small: { fill: '#fff4dc', ring: '#c9a36b', ink: '#5b4630' },
};

/** A round number badge for a station; little ones also get dots to count. */
export function badgeTexture(text: string, style: BadgeStyle, dotCount = 0): { tex: THREE.CanvasTexture; aspect: number } {
  const withDots = dotCount > 0;
  const W = 128;
  const H = withDots ? 168 : 128;
  const [c, g] = canvas(W, H);
  const s = BADGE[style];
  g.fillStyle = s.fill;
  g.strokeStyle = s.ring;
  g.lineWidth = 10;
  if (withDots) {
    const r = 26;
    g.beginPath();
    g.moveTo(r + 6, 6);
    g.arcTo(W - 6, 6, W - 6, H - 6, r);
    g.arcTo(W - 6, H - 6, 6, H - 6, r);
    g.arcTo(6, H - 6, 6, 6, r);
    g.arcTo(6, 6, W - 6, 6, r);
    g.closePath();
  } else {
    g.beginPath();
    g.arc(64, 64, 57, 0, Math.PI * 2);
  }
  g.fill();
  g.stroke();
  g.fillStyle = s.ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `bold ${text.length > 2 ? 54 : text.length > 1 ? 66 : 78}px ${FONT}`;
  g.fillText(text, 64, withDots ? 58 : 70);
  if (withDots) {
    const n = Math.min(10, dotCount);
    const perRow = 5;
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, n - row * perRow);
      const col = i % perRow;
      const x = 64 + (col - (inRow - 1) / 2) * 20;
      const y = 112 + row * 22;
      g.beginPath();
      g.arc(x, y, 7.5, 0, Math.PI * 2);
      g.fillStyle = style === 'target' ? '#ff7a1a' : style === 'start' ? '#2fae66' : '#5b6fd8';
      g.fill();
    }
  }
  return { tex: texture(c), aspect: W / H };
}

/** A pill label for a rail piece ("+3", "×2") in the piece's colour, with dots for little ones. */
export function pillTexture(text: string, color: string, dotCount = 0): { tex: THREE.CanvasTexture; aspect: number } {
  const W = 200;
  const H = dotCount ? 136 : 100;
  const [c, g] = canvas(W, H);
  const r = 44;
  g.fillStyle = color;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(r + 6, 6);
  g.arcTo(W - 6, 6, W - 6, H - 6, r);
  g.arcTo(W - 6, H - 6, 6, H - 6, r);
  g.arcTo(6, H - 6, 6, 6, r);
  g.arcTo(6, 6, W - 6, 6, r);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `bold 66px ${FONT}`;
  g.fillText(text, W / 2, dotCount ? 50 : 54);
  for (let i = 0; i < Math.min(10, dotCount); i++) {
    const x = W / 2 + (i - (Math.min(10, dotCount) - 1) / 2) * 17;
    g.beginPath();
    g.arc(x, 104, 6.5, 0, Math.PI * 2);
    g.fill();
  }
  return { tex: texture(c), aspect: W / H };
}

/** A speech-bubble label ("+2" over the gap, the big number when the cart lands). */
export function bubbleTexture(text: string, ink = '#ff3d7f'): { tex: THREE.CanvasTexture; aspect: number } {
  const W = 256;
  const H = 150;
  const [c, g] = canvas(W, H);
  g.fillStyle = '#ffffff';
  g.strokeStyle = ink;
  g.lineWidth = 9;
  const r = 50;
  g.beginPath();
  g.moveTo(r + 6, 6);
  g.arcTo(W - 6, 6, W - 6, 120, r);
  g.arcTo(W - 6, 120, 6, 120, r);
  g.lineTo(140, 120);
  g.lineTo(128, 144);
  g.lineTo(112, 120);
  g.arcTo(6, 120, 6, 6, r);
  g.arcTo(6, 6, W - 6, 6, r);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `bold ${text.length > 3 ? 70 : 88}px ${FONT}`;
  g.fillText(text, W / 2, 66);
  return { tex: texture(c), aspect: W / H };
}

/** A sprite from a texture, keeping its aspect ratio; `h` is the height in world units. */
export function spriteOf(t: { tex: THREE.Texture; aspect: number }, h: number, opts: { depthTest?: boolean } = {}): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.tex, depthWrite: false, depthTest: opts.depthTest ?? true, transparent: true }));
  s.scale.set(h * t.aspect, h, 1);
  s.userData.baseScale = s.scale.clone();
  return s;
}

/** A soft five-pointed star (dizzy stars, sparkles). */
export function starTexture(): THREE.Texture {
  const [c, g] = canvas(64, 64);
  g.translate(32, 33);
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 12 : 28;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fillStyle = '#ffffff';
  g.shadowColor = 'rgba(255,255,255,0.9)';
  g.shadowBlur = 6;
  g.fill();
  return texture(c);
}

/** A drawn icon for a stall sign (no emoji font needed): popcorn, lollipop, balloon, teddy. */
export function signTexture(kind: 'popcorn' | 'candy' | 'balloon' | 'duck', bg: string): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  g.fillStyle = bg;
  g.beginPath();
  g.arc(64, 64, 60, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = '#ffffff';
  g.stroke();
  if (kind === 'popcorn') {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(40, 54);
    g.lineTo(88, 54);
    g.lineTo(80, 104);
    g.lineTo(48, 104);
    g.closePath();
    g.fill();
    g.fillStyle = '#e2453c';
    for (const x of [50, 64, 78]) g.fillRect(x - 4, 56, 8, 46);
    g.fillStyle = '#fff6d0';
    for (const [x, y] of [
      [46, 48],
      [58, 40],
      [70, 42],
      [82, 48],
      [64, 30],
    ]) {
      g.beginPath();
      g.arc(x, y, 10, 0, Math.PI * 2);
      g.fill();
    }
  } else if (kind === 'candy') {
    g.fillStyle = '#ffffff';
    g.fillRect(61, 64, 6, 46);
    const cols = ['#ff5ca8', '#ffffff', '#7fd0ff', '#ffffff'];
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.arc(64, 50, 26 - i * 6, 0, Math.PI * 2);
      g.fillStyle = cols[i];
      g.fill();
    }
  } else if (kind === 'balloon') {
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(64, 80);
    g.quadraticCurveTo(56, 98, 66, 112);
    g.stroke();
    g.fillStyle = '#ff4f5e';
    g.beginPath();
    g.ellipse(64, 52, 22, 27, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath();
    g.ellipse(56, 42, 6, 9, -0.4, 0, Math.PI * 2);
    g.fill();
  } else {
    g.fillStyle = '#ffd23d';
    g.beginPath();
    g.ellipse(66, 80, 32, 20, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(50, 52, 17, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ff8a3d';
    g.beginPath();
    g.ellipse(32, 56, 10, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1d2a6b';
    g.beginPath();
    g.arc(46, 48, 3.5, 0, Math.PI * 2);
    g.fill();
  }
  return texture(c);
}
