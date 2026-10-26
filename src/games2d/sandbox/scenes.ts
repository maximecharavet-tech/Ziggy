/**
 * Ready-made scenes to start from something pretty. They adapt to any grid
 * size (landscape on a computer, portrait on a phone) and are built to be
 * calm: nothing reacts until the child adds something, so every discovery is
 * really theirs.
 */
import { CENTER, CLOUD, EMPTY, FLOWER, ICE, LEAF, PETAL, PLANT, SAND, SNOW, STONE, WATER, type Sandbox } from './sim';

export const SCENES = ['jardin', 'montagne', 'iles'] as const;
export type SceneId = (typeof SCENES)[number];

function fill(sim: Sandbox, x: number, y: number, t: number) {
  if (!sim.inside(x, y)) return;
  sim.set(x, y, t);
}

/** A grown plant with leaves and a flower on top. Inert: it does not grow any more. */
export function grownPlant(sim: Sandbox, x: number, ground: number, height: number, hue: number): void {
  const { w } = sim;
  let top = ground;
  for (let k = 0; k < height; k++) {
    const y = ground - 1 - k;
    if (!sim.inside(x, y) || sim.get(x, y) !== EMPTY) break;
    sim.set(x, y, PLANT);
    const i = y * w + x;
    sim.a[i] = 3;
    sim.c[i] = k;
    top = y;
    if (k > 1 && k < height - 2 && k % 3 === 1) {
      const lx = x + (k % 2 ? 1 : -1);
      if (sim.inside(lx, y) && sim.get(lx, y) === EMPTY) {
        sim.set(lx, y, PLANT);
        const l = y * w + lx;
        sim.b[l] = LEAF;
        sim.c[l] = k;
      }
    }
  }
  if (top === ground) return;
  const ti = top * w + x;
  sim.type[ti] = FLOWER;
  sim.a[ti] = hue % 5;
  sim.b[ti] = CENTER;
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
  ] as const) {
    const px = x + dx;
    const py = top + dy;
    if (!sim.inside(px, py) || sim.get(px, py) !== EMPTY) continue;
    sim.set(px, py, FLOWER);
    const j = py * w + px;
    sim.a[j] = hue % 5;
    sim.b[j] = PETAL;
    sim.c[j] = sim.c[ti];
  }
}

/** Top of the ground in column x (first non-empty cell), or h. */
function surface(sim: Sandbox, x: number): number {
  for (let y = 0; y < sim.h; y++) if (sim.get(x, y) !== EMPTY) return y;
  return sim.h;
}

export function loadScene(sim: Sandbox, id: SceneId): void {
  sim.clear();
  if (id === 'jardin') garden(sim);
  else if (id === 'montagne') mountain(sim);
  else islands(sim);
  sim.settle(90);
}

function garden(sim: Sandbox) {
  const { w, h } = sim;
  const base = h * (h > w ? 0.72 : 0.8);
  const ground = (x: number) => Math.round(base + Math.sin(x * 0.045) * h * 0.035 + Math.sin(x * 0.13 + 1.3) * 1.5);
  for (let x = 0; x < w; x++) {
    for (let y = ground(x); y < h; y++) fill(sim, x, y, y > h - 3 ? STONE : SAND);
  }
  // A little pond in a stone basin.
  const pw = Math.max(16, Math.round(w * 0.22));
  const px = Math.round(w * 0.58);
  const pd = Math.max(6, Math.round(h * 0.08));
  const level = Math.min(...Array.from({ length: pw }, (_, k) => ground(px + k))) + 1;
  for (let k = 0; k < pw; k++) {
    const x = px + k;
    const edge = Math.min(k, pw - 1 - k);
    const bottom = level + Math.min(pd, 2 + edge);
    for (let y = level; y <= bottom + 1; y++) fill(sim, x, y, y >= bottom ? STONE : WATER);
    for (let y = 0; y < level; y++) if (sim.get(x, y) === SAND) fill(sim, x, y, EMPTY);
  }
  // Flowers here and there (not too close to the water, so nothing reacts by itself).
  const spots = [0.08, 0.18, 0.3, 0.42, 0.88, 0.95];
  spots.forEach((f, n) => {
    const x = Math.round(w * f);
    if (x >= px - 2 && x <= px + pw + 2) return;
    grownPlant(sim, x, surface(sim, x), Math.round(h * (0.08 + ((n * 37) % 10) / 100)), n);
  });
  sceneClouds(sim, [
    [0.2, 0.14, 10],
    [0.72, 0.1, 13],
  ]);
  // A stone wall to build on.
  const wx = Math.round(w * 0.25);
  for (let y = ground(wx) - Math.round(h * 0.1); y < ground(wx); y++) for (let x = wx; x < wx + 3; x++) fill(sim, x, y, STONE);
}

function mountain(sim: Sandbox) {
  const { w, h } = sim;
  // A sandy valley floor on bedrock.
  const valley = Math.round(h * (h > w ? 0.8 : 0.86));
  for (let x = 0; x < w; x++) {
    const g = valley + Math.round(Math.sin(x * 0.07) * 1.5);
    for (let y = g; y < h; y++) fill(sim, x, y, y > h - 4 ? STONE : SAND);
  }
  // Two rocky peaks with thick snow caps. Slopes stay under 45°, so the snow stays on.
  const peaks = [
    { x: w * 0.3, top: h * (h > w ? 0.42 : 0.24) },
    { x: w * 0.64, top: h * (h > w ? 0.56 : 0.42) },
  ];
  const snowLine = h * (h > w ? 0.64 : 0.56);
  for (let x = 0; x < w; x++) {
    let top = h;
    for (const p of peaks) top = Math.min(top, p.top + Math.abs(x - p.x) * 0.78 + Math.sin(x * 0.13) * 1.5);
    if (top >= valley) continue;
    const ty = Math.round(top);
    // Packed into the rock outline, the snow cap stays put; thicker near the summit.
    const thick = ty < snowLine ? 3 + Math.round(((snowLine - ty) / snowLine) * 10) : 0;
    for (let y = ty; y < valley + 2; y++) fill(sim, x, y, y < ty + thick ? SNOW : STONE);
  }
  // A frozen lake in a stone basin, at the foot of the mountains.
  const lx = Math.round(w * 0.85);
  const lw = w - lx;
  for (let k = 0; k < lw && lx + k < w; k++) {
    const x = lx + k;
    const edge = Math.min(k, lw - 1 - k);
    const bottom = valley + Math.min(4, 1 + edge);
    for (let y = valley - 1; y <= bottom + 1; y++) fill(sim, x, y, y > bottom ? STONE : ICE);
  }
  // A few hardy flowers on the lower slopes and in the valley (not on snow or ice).
  let planted = 0;
  let lastX = -w;
  for (let x = 2; x < w - 2 && planted < 4; x++) {
    const ground = sim.get(x, surface(sim, x));
    if ((ground !== SAND && ground !== STONE) || x - lastX < w * 0.12) continue;
    grownPlant(sim, x, surface(sim, x), Math.round(h * 0.06), planted * 2 + 1);
    lastX = x;
    planted++;
  }
  sceneClouds(sim, [[0.58, 0.14, 10]]);
}

function islands(sim: Sandbox) {
  const { w, h } = sim;
  const tall = h > w;
  const sea = Math.round(h * (tall ? 0.6 : 0.62));
  const depth = Math.round(h * (tall ? 0.24 : 0.2));
  const steep = tall ? 5 : 3;
  for (let x = 0; x < w; x++) {
    const floor = Math.round(sea + depth + Math.sin(x * 0.09) * 2);
    for (let y = sea; y < h; y++) fill(sim, x, y, y >= floor ? (y > h - 4 ? STONE : SAND) : WATER);
  }
  const isles = [
    { x: w * 0.26, r: w * 0.13 },
    { x: w * 0.74, r: w * 0.1 },
  ];
  for (const isle of isles) {
    // A rock under the sea (rock can be steep) carrying a rounded sandy hill (sand can't).
    const reach = isle.r + depth / steep + 1;
    for (let x = Math.round(isle.x - reach); x <= Math.round(isle.x + reach); x++) {
      const dx = Math.abs(x - isle.x);
      const rock = dx <= isle.r + 1 ? sea : Math.round(sea + (dx - isle.r - 1) * steep);
      for (let y = rock; y < h && sim.get(x, y) !== SAND; y++) fill(sim, x, y, STONE);
      if (dx >= isle.r) continue;
      const d = dx / isle.r;
      const top = Math.round(sea - (1 - d * d) * Math.min(h * 0.08, isle.r * 0.4));
      for (let y = top; y < sea; y++) fill(sim, x, y, SAND);
    }
    for (const dx of [-0.45, 0.1, 0.5]) {
      const x = Math.round(isle.x + isle.r * dx);
      grownPlant(sim, x, surface(sim, x), Math.round(h * (0.09 + Math.abs(dx) * 0.06)), Math.round((dx + 1) * 3));
    }
  }
  sceneClouds(sim, [
    [0.18, 0.12, 9],
    [0.62, 0.08, 12],
  ]);
}

/**
 * Fluffy clouds at (fraction of width, fraction of height, half-width in
 * cells). Empty of rain and flagged to stay: they only rain once fed with steam.
 */
function sceneClouds(sim: Sandbox, clouds: [number, number, number][]) {
  const { w, h } = sim;
  for (const [cx, cy, rx0] of clouds) {
    const rx = Math.max(5, Math.round(Math.min(rx0, w * 0.09)));
    const ry = 3;
    for (let y = -ry; y <= ry; y++)
      for (let x = -rx; x <= rx; x++) {
        // A flat bottom and a bumpy top.
        const bump = y < 0 ? Math.sin((x / rx) * Math.PI * 1.5) * 0.35 : 0;
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 1 + bump) continue;
        const gx = Math.round(w * cx + x);
        const gy = Math.round(h * cy + y);
        if (!sim.inside(gx, gy)) continue;
        sim.set(gx, gy, CLOUD);
        sim.a[gy * w + gx] = 0;
        sim.b[gy * w + gx] = 1;
      }
  }
}
