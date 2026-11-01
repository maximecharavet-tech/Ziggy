import type { ColoringPage } from '../types';
import { arc, asterisk, capsule, circle, cloud, curve, ellipse, flower, heart, hill, leaf, mirrorX, petal, polar, poly, quad, rect, ringSegment, smooth, softStar, waveTop, type P } from '../shapes';
import { definePage, type PageBuilder } from './build';
import { groundFlower, inkEye, smile, tufts } from './parts';

/* ───────────── little helpers for these pages ───────────── */

/** A point on an ellipse (degrees, clockwise on screen). */
const onEllipse = (cx: number, cy: number, rx: number, ry: number, deg: number): P => [cx + rx * Math.cos((deg * Math.PI) / 180), cy + ry * Math.sin((deg * Math.PI) / 180)];

/** A thick curved band along a centre line (tails, branches, stems), width w0 → w1. */
function tube(pts: P[], w0: number, w1 = w0): string {
  const n = pts.length;
  const left: P[] = [];
  const right: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const c = pts[Math.min(n - 1, i + 1)];
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
    const w = (w0 + ((w1 - w0) * i) / (n - 1)) / 2;
    const nx = (-(c[1] - a[1]) / len) * w;
    const ny = ((c[0] - a[0]) / len) * w;
    left.push([pts[i][0] + nx, pts[i][1] + ny]);
    right.push([pts[i][0] - nx, pts[i][1] - ny]);
  }
  const cap = (i: number, j: number, w: number): P => {
    const dx = pts[i][0] - pts[j][0];
    const dy = pts[i][1] - pts[j][1];
    const l = Math.hypot(dx, dy) || 1;
    return [pts[i][0] + (dx / l) * w * 0.45, pts[i][1] + (dy / l) * w * 0.45];
  };
  return smooth([cap(0, 1, w0), ...left, cap(n - 1, n - 2, w1), ...right.reverse()], true, 0.8);
}

/** A water drop (tip up). */
function drop(x: number, y: number, r: number): string {
  const f = (n: number) => Math.round(n * 10) / 10;
  return `M${f(x)} ${f(y - 2.1 * r)}C${f(x + 0.35 * r)} ${f(y - 1.3 * r)} ${f(x + r)} ${f(y - 0.7 * r)} ${f(x + r)} ${f(y)}A${f(r)} ${f(r)} 0 0 1 ${f(x - r)} ${f(y)}C${f(x - r)} ${f(y - 0.7 * r)} ${f(x - 0.35 * r)} ${f(y - 1.3 * r)} ${f(x)} ${f(y - 2.1 * r)}Z`;
}

/** A soft irregular spot (cow patches). */
function blotch(cx: number, cy: number, r: number, seed: number): string {
  const pts: P[] = [];
  for (let i = 0; i < 7; i++) pts.push(polar(cx, cy, r * (0.74 + 0.26 * Math.abs(Math.sin(i * 2.3 + seed))), i * (360 / 7) + seed * 17));
  return smooth(pts, true, 1);
}

/** A rounded hexagon (turtle shell plates). */
const softHex = (cx: number, cy: number, r: number, ry = r): string => smooth(Array.from({ length: 6 }, (_, i) => onEllipse(cx, cy, r, ry, i * 60)), true, 0.4);

/** A leaf with its middle vein (the vein is a decoration of the leaf). */
function veinLeaf(b: PageBuilder, id: string, a: P, t: P, w: number, color: string, veins = false) {
  b.r(id, leaf(a, t, w), color);
  const m: P = [a[0] + (t[0] - a[0]) * 0.86, a[1] + (t[1] - a[1]) * 0.86];
  let d = quad([a[0] + (t[0] - a[0]) * 0.08, a[1] + (t[1] - a[1]) * 0.08], [(a[0] + t[0]) / 2 + (t[1] - a[1]) * 0.04, (a[1] + t[1]) / 2 - (t[0] - a[0]) * 0.04], m);
  if (veins) {
    const len = Math.hypot(t[0] - a[0], t[1] - a[1]);
    const ux = (t[0] - a[0]) / len;
    const uy = (t[1] - a[1]) / len;
    for (const k of [0.3, 0.5, 0.68]) {
      const px = a[0] + (t[0] - a[0]) * k;
      const py = a[1] + (t[1] - a[1]) * k;
      const s = w * 0.62 * (1 - Math.abs(k - 0.42));
      d += `M${Math.round(px)} ${Math.round(py)}l${Math.round((ux - uy) * s * 0.75)} ${Math.round((uy + ux) * s * 0.75)}`;
      d += `M${Math.round(px)} ${Math.round(py)}l${Math.round((ux + uy) * s * 0.75)} ${Math.round((uy - ux) * s * 0.75)}`;
    }
  }
  b.deco(d, undefined, 3);
}

/** A small smiling fish; dir = 1 looks left, -1 looks right. */
function fish(b: PageBuilder, x: number, y: number, s: number, color: string, dir: 1 | -1, stripe?: string) {
  const X = (dx: number) => x + dx * s * dir;
  b.r('fish-tail#', smooth([[X(26), y], [X(56), y - 22 * s], [X(50), y], [X(56), y + 22 * s]], true, 0.3), color);
  b.r('fish#', ellipse(x, y, 38 * s, 25 * s), color);
  if (stripe) b.r('fish-stripe#', ellipse(X(6), y, 8 * s, 22 * s), stripe);
  inkEye(b, X(-18), y - 5 * s, 5 * s);
  b.d(quad([X(-34), y + 7 * s], [X(-27), y + 13 * s], [X(-21), y + 9 * s]), undefined, 3);
}

/** A 5-petal hibiscus with a yellow heart. */
function hibiscus(b: PageBuilder, cx: number, cy: number, r: number, color: string, rot = 0) {
  for (let k = 0; k < 5; k++) b.r('hibiscus-petal#', petal(cx, cy, r * 0.1, r, rot - 90 + k * 72, r * 0.5), color);
  b.r('hibiscus-heart#', circle(cx, cy, r * 0.26), 'yellow');
  b.d(quad([cx, cy], [cx + r * 0.3, cy - r * 0.2], [cx + r * 0.55, cy - r * 0.55]), undefined, 3);
  b.d(circle(cx + r * 0.55, cy - r * 0.55, 4), 'ink');
}

/** A small butterfly (4 wings + body). */
function butterfly(b: PageBuilder, cx: number, cy: number, s: number, top: string, low: string) {
  const up: P[] = [[cx - 3 * s, cy - 4 * s], [cx - 20 * s, cy - 30 * s], [cx - 44 * s, cy - 34 * s], [cx - 48 * s, cy - 12 * s], [cx - 30 * s, cy + 2 * s]];
  const lo: P[] = [[cx - 3 * s, cy + 4 * s], [cx - 30 * s, cy + 8 * s], [cx - 36 * s, cy + 28 * s], [cx - 16 * s, cy + 32 * s]];
  b.r('butterfly-wing#', smooth(up), top);
  b.r('butterfly-wing#', smooth(mirrorX(up, cx)), top);
  b.r('butterfly-wing#', smooth(lo), low);
  b.r('butterfly-wing#', smooth(mirrorX(lo, cx)), low);
  b.r('butterfly-body', capsule(cx, cy - 18 * s, cx, cy + 26 * s, 10 * s), 'brown');
  b.d(`M${cx - 2 * s} ${cy - 20 * s}Q${cx - 8 * s} ${cy - 36 * s} ${cx - 16 * s} ${cy - 40 * s}M${cx + 2 * s} ${cy - 20 * s}Q${cx + 8 * s} ${cy - 36 * s} ${cx + 16 * s} ${cy - 40 * s}`, undefined, 3);
}

/* ───────────── 1. Lion ───────────── */

/** A lion whose mane shines like the sun. */
export const lion = definePage(
  { id: 'lion', theme: 'animaux', title: { fr: 'Le lion à la crinière soleil', en: 'The lion with a sunshine mane' }, emoji: '🦁', level: 1 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('cloud', cloud(500, 76, 150, 60), 'white');
    b.r('savanna', hill(0, 452, [300, 404], 600, 452, 600), 'lime');
    b.r('tail', tube([[396, 502], [466, 504], [512, 464], [528, 410]], 20), 'caramel');
    b.r('tail-tuft', flower(530, 392, 30, 7), 'orange');
    b.r('body', ellipse(300, 470, 126, 86), 'caramel');
    b.r('paw-left', ellipse(232, 546, 46, 28), 'caramel');
    b.deco('M220 534V554M244 534V554', undefined, 3.5);
    b.r('paw-right', ellipse(368, 546, 46, 28), 'caramel');
    b.deco('M356 534V554M380 534V554', undefined, 3.5);
    b.r('mane', softStar(300, 250, 198, 140, 16), 'orange');
    b.r('mane-inner', flower(300, 256, 128, 14), 'yellow');
    b.r('ear-left', circle(222, 172, 30), 'caramel');
    b.deco(arc(222, 172, 15, 180, 330), undefined, 3.5);
    b.r('ear-right', circle(378, 172, 30), 'caramel');
    b.deco(arc(378, 172, 15, 210, 360), undefined, 3.5);
    b.r('face', circle(300, 266, 100), 'caramel');
    b.r('muzzle', ellipse(300, 316, 60, 40), 'cream');
    b.r('nose', smooth([[272, 290], [328, 290], [300, 318]], true, 0.45), 'brown');
    b.d('M300 318V330M300 330Q287 346 272 334M300 330Q313 346 328 334', undefined, 4);
    b.d(circle(262, 318, 2.8) + circle(250, 306, 2.8) + circle(338, 318, 2.8) + circle(350, 306, 2.8), 'ink');
    b.r('cheek-left', circle(230, 294, 15), 'pink');
    b.r('cheek-right', circle(370, 294, 15), 'pink');
    inkEye(b, 262, 248, 11);
    inkEye(b, 338, 248, 11);
    b.d('M244 222Q260 210 276 218M324 218Q340 210 356 222', undefined, 4);
    tufts(b, [[60, 520], [140, 584], [470, 590], [566, 530]], 9);
  }
);

/* ───────────── 2. Cow and barn ───────────── */

/** A cow in front of the red barn, with a little chick. */
export const cowFarm = definePage(
  { id: 'cow-farm', theme: 'animaux', title: { fr: 'La vache et la grange rouge', en: 'The cow and the red barn' }, emoji: '🐄', level: 2 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('sun', circle(530, 74, 40), 'yellow');
    b.r('cloud#', cloud(340, 76, 150, 56), 'white');
    b.r('cloud#', cloud(470, 170, 100, 40), 'white');
    b.r('hill', hill(0, 340, [320, 262], 600, 330, 600), 'green');
    b.r('meadow', hill(0, 424, [300, 398], 600, 424, 600), 'lime');
    // Barn
    b.r('barn', rect(40, 232, 200, 206), 'red');
    b.deco('M70 252V300M210 252V300', undefined, 3);
    b.r('barn-roof', poly([[16, 252], [56, 174], [140, 124], [224, 174], [264, 252]]), 'brown');
    b.deco('M56 174L224 174', undefined, 3);
    b.r('hayloft', rect(112, 186, 56, 50, 6), 'yellow');
    b.deco('M122 236L132 206M138 236L144 202M154 236L160 210', undefined, 3);
    b.r('barn-door', rect(80, 318, 120, 120, 4), 'white');
    b.deco('M80 318L140 438M140 318L80 438M140 318L200 438M200 318L140 438M140 318V438', undefined, 3.5);
    b.r('haystack', 'M14 548Q18 456 76 450Q134 456 138 548Z', 'yellow');
    b.deco('M44 520Q50 490 64 474M76 530Q76 500 80 470M108 520Q104 494 92 476M30 536Q36 520 44 512M122 536Q118 522 110 512', undefined, 3);
    // Fence
    for (const x of [380, 460, 540]) b.r('fence-post#', rect(x, 318, 22, 100, 6), 'white');
    b.r('fence-rail#', rect(262, 338, 338, 14, 5), 'white');
    b.r('fence-rail#', rect(262, 376, 338, 14, 5), 'white');
    // Cow
    b.r('tail', tube([[560, 420], [580, 452], [586, 498]], 10), 'white');
    b.r('tail-tuft', flower(586, 510, 15, 5, 90), 'black');
    for (const [i, x] of [488, 530].entries()) {
      b.r(`leg-back-${i + 1}`, rect(x, 452, 32, 88, 12), 'white');
      b.r(`hoof-back-${i + 1}`, rect(x, 528, 32, 20, 7), 'black');
    }
    for (const [i, x] of [360, 404].entries()) {
      b.r(`leg-front-${i + 1}`, rect(x, 462, 32, 88, 12), 'white');
      b.r(`hoof-front-${i + 1}`, rect(x, 538, 32, 20, 7), 'black');
    }
    b.r('udder', ellipse(462, 506, 24, 17), 'pink');
    b.deco('M452 520v8M462 522v8M472 520v8', undefined, 3);
    b.r('body', ellipse(446, 438, 122, 72), 'white');
    b.r('spot#', blotch(482, 408, 32, 1), 'black');
    b.r('spot#', blotch(400, 456, 24, 2), 'black');
    b.r('spot#', blotch(538, 456, 20, 3), 'black');
    b.r('horn-left', capsule(272, 326, 256, 290, 16), 'cream');
    b.r('horn-right', capsule(328, 326, 344, 290, 16), 'cream');
    b.r('ear-left', ellipse(228, 346, 34, 16, -18), 'white');
    b.r('ear-left-in', ellipse(232, 346, 18, 7, -18), 'pink');
    b.r('ear-right', ellipse(372, 346, 34, 16, 18), 'white');
    b.r('ear-right-in', ellipse(368, 346, 18, 7, 18), 'pink');
    b.d('M300 428V442', undefined, 3);
    b.r('bell', circle(300, 454, 15), 'yellow');
    b.deco('M292 458h16', undefined, 3);
    b.r('head', ellipse(300, 372, 62, 58), 'white');
    b.r('head-spot', blotch(342, 326, 19, 4), 'black');
    b.r('muzzle', ellipse(300, 404, 52, 30), 'pink');
    b.deco(ellipse(282, 398, 6, 8) + ellipse(318, 398, 6, 8), 'ink');
    b.d(smile(300, 414, 26, 8), undefined, 4);
    b.r('cheek-left', circle(256, 376, 11), 'pink');
    b.r('cheek-right', circle(344, 376, 11), 'pink');
    inkEye(b, 276, 356, 9);
    inkEye(b, 324, 356, 9);
    // Chick
    b.r('chick', circle(172, 538, 28), 'yellow');
    b.deco(quad([160, 538], [172, 554], [188, 536]), undefined, 3);
    b.r('chick-head', circle(150, 504, 20), 'yellow');
    b.r('chick-beak', poly([[134, 494], [110, 506], [134, 518]]), 'orange');
    inkEye(b, 146, 498, 4);
    b.d('M164 564l-4 14M180 564l4 14', undefined, 3.5);
    groundFlower(b, 262, 562, 22, 'pink', 5);
    groundFlower(b, 44, 568, 22, 'purple', 5);
    tufts(b, [[230, 500], [340, 590], [560, 588]], 8);
  }
);

/* ───────────── 3. Panda ───────────── */

/** A panda munching bamboo. */
export const panda = definePage(
  { id: 'panda', theme: 'animaux', title: { fr: 'Le panda qui mange du bambou', en: 'The panda eating bamboo' }, emoji: '🐼', level: 1 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('sun', circle(520, 80, 44), 'yellow');
    b.r('bamboo', capsule(76, -40, 76, 640, 46), 'green');
    b.deco('M53 130h46M53 290h46M53 450h46', undefined, 4);
    b.r('bamboo-leaf', leaf([96, 140], [190, 96], 24), 'forest');
    b.r('ground', hill(0, 474, [300, 432], 600, 474, 600), 'lime');
    b.r('body', ellipse(300, 432, 132, 116), 'white');
    b.r('leg-left', ellipse(196, 510, 62, 46, -12), 'black');
    b.r('leg-right', ellipse(404, 510, 62, 46, 12), 'black');
    b.r('ear-left', circle(212, 128, 40), 'black');
    b.r('ear-right', circle(388, 128, 40), 'black');
    b.r('head', circle(300, 214, 106), 'white');
    b.r('patch-left', ellipse(256, 214, 31, 40, 30), 'black');
    b.r('patch-right', ellipse(344, 214, 31, 40, -30), 'black');
    inkEye(b, 260, 210, 11);
    inkEye(b, 340, 210, 11);
    b.r('nose', ellipse(300, 260, 20, 13), 'black');
    b.d('M300 273V283M300 283Q290 295 280 287M300 283Q310 295 320 287', undefined, 4);
    b.r('cheek-left', circle(234, 266, 16), 'pink');
    b.r('cheek-right', circle(366, 266, 16), 'pink');
    // Bamboo stick held in both paws
    const s0: P = [228, 506];
    const s1: P = [384, 300];
    b.r('stick', capsule(...s0, ...s1, 26), 'green');
    const len = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]);
    const [ux, uy] = [(s1[0] - s0[0]) / len, (s1[1] - s0[1]) / len];
    let nodes = '';
    for (const t of [0.12, 0.5, 0.88]) {
      const [x, y] = [s0[0] + (s1[0] - s0[0]) * t, s0[1] + (s1[1] - s0[1]) * t];
      nodes += `M${Math.round(x - uy * 12)} ${Math.round(y + ux * 12)}L${Math.round(x + uy * 12)} ${Math.round(y - ux * 12)}`;
    }
    b.deco(nodes, undefined, 4);
    b.r('stick-leaf#', leaf([384, 300], [454, 246], 20), 'forest');
    b.r('stick-leaf#', leaf([384, 300], [326, 306], 15), 'forest');
    b.r('arm-left', capsule(198, 372, 275, 444, 54), 'black');
    b.r('arm-right', capsule(406, 382, 350, 344, 54), 'black');
    tufts(b, [[60, 560], [300, 590], [540, 560]], 9);
  }
);

/* ───────────── 4. Sea turtle ───────────── */

/** A sea turtle swimming with little fish. */
export const seaTurtle = definePage(
  { id: 'sea-turtle', theme: 'animaux', title: { fr: 'La tortue de mer et les poissons', en: 'The sea turtle and the fish' }, emoji: '🐢', level: 2 },
  (b) => {
    b.r('water', rect(0, 0, 600, 600), 'sky');
    b.r('sand', waveTop(0, 512, 600, 88, 9, 3), 'sand');
    b.r('seaweed#', smooth([[34, 522], [20, 452], [44, 396], [28, 340], [48, 306], [66, 346], [58, 400], [78, 456], [64, 522]]), 'green');
    b.r('seaweed#', smooth([[548, 522], [534, 462], [556, 412], [540, 366], [560, 340], [578, 378], [570, 420], [588, 470], [576, 522]]), 'forest');
    b.r('coral', smooth([[430, 524], [422, 470], [402, 436], [418, 426], [436, 452], [442, 412], [462, 408], [460, 452], [482, 424], [498, 434], [474, 480], [480, 524]], true, 0.7), 'raspberry');
    b.r('rock', ellipse(250, 536, 62, 26), 'grey');
    b.r('starfish', softStar(120, 556, 34, 15, 5), 'orange');
    b.deco(circle(113, 550, 2.5) + circle(127, 550, 2.5), 'ink');
    b.r('seashell', ringSegment(350, 574, 6, 32, 200, 340), 'pink');
    b.deco('M350 574L322 560M350 574L338 544M350 574L362 544M350 574L378 560', undefined, 3);
    // Fish
    fish(b, 476, 108, 1.1, 'yellow', 1, 'orange');
    fish(b, 110, 96, 0.95, 'orange', -1, 'white');
    fish(b, 510, 438, 0.9, 'purple', 1, 'pink');
    // Turtle, seen from above, swimming to the left
    b.r('flipper-back-top', leaf([424, 236], [486, 192], 22), 'mint');
    b.r('flipper-back-bottom', leaf([424, 326], [486, 370], 22), 'mint');
    b.r('tail', smooth([[432, 260], [504, 282], [432, 304]], true, 0.5), 'mint');
    b.r('flipper-front-top', leaf([272, 222], [186, 128], 36), 'mint');
    b.r('flipper-front-bottom', leaf([272, 340], [180, 432], 36), 'mint');
    b.r('head', ellipse(168, 282, 60, 46), 'mint');
    b.r('shell-rim', ellipse(330, 282, 142, 100), 'forest');
    b.r('shell', ellipse(330, 282, 122, 82), 'green');
    b.r('plate-middle', softHex(330, 282, 38, 32), 'lime');
    for (let i = 0; i < 6; i++) {
      const [x, y] = onEllipse(330, 282, 78, 50, i * 60);
      b.r('plate#', softHex(x, y, 25, 21), 'lime');
    }
    inkEye(b, 146, 268, 9);
    b.r('cheek', circle(168, 298, 11), 'pink');
    b.d(quad([116, 290], [128, 304], [146, 298]), undefined, 4);
    for (const [x, y, r] of [[84, 232, 14], [64, 190, 12], [82, 150, 11], [298, 130, 13], [328, 98, 11]] as [number, number, number][]) {
      b.r('bubble#', circle(x, y, r), 'white');
      b.deco(`M${x - r * 0.5} ${y - r * 0.1}Q${x - r * 0.5} ${y - r * 0.5} ${x - r * 0.1} ${y - r * 0.55}`, undefined, 2);
    }
  }
);

/* ───────────── 5. Hedgehog ───────────── */

/** A hedgehog carrying an apple among autumn leaves. */
export const hedgehog = definePage(
  { id: 'hedgehog', theme: 'animaux', title: { fr: "Le hérisson et les feuilles d'automne", en: 'The hedgehog and the autumn leaves' }, emoji: '🦔', level: 2 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('sun', circle(526, 78, 40), 'yellow');
    b.r('cloud', cloud(340, 76, 150, 54), 'white');
    b.r('trunk', smooth([[36, 476], [54, 330], [50, 170], [96, 170], [92, 330], [112, 476]], true, 0.5), 'brown');
    b.deco('M66 420q8 -14 0 -30M80 290q-8 -16 0 -30', undefined, 3);
    b.r('tree', flower(70, 100, 126, 9, -70), 'orange');
    b.r('ground', hill(0, 452, [300, 412], 600, 452, 600), 'green');
    // Falling leaves
    const falling: [P, P, string][] = [
      [[214, 128], [262, 168], 'red'],
      [[392, 172], [444, 140], 'yellow'],
      [[560, 206], [536, 262], 'orange'],
      [[220, 262], [186, 300], 'yellow'],
      [[464, 252], [500, 290], 'red'],
    ];
    for (const [a, t, c] of falling) veinLeaf(b, 'leaf#', a, t, 17, c);
    // Mushroom
    b.r('mushroom-stem', rect(522, 470, 34, 54, 12), 'cream');
    b.r('mushroom-cap', 'M484 482Q484 424 539 422Q594 424 594 482Z', 'red');
    b.r('mushroom-dot#', circle(512, 456, 12), 'white');
    b.r('mushroom-dot#', circle(548, 440, 12), 'white');
    b.r('mushroom-dot#', circle(574, 466, 10), 'white');
    // Hedgehog
    const hx = 280;
    const hy = 420;
    const back: P[] = [];
    for (let i = 0; i <= 22; i++) back.push(onEllipse(hx, hy, 150 * (i % 2 ? 1.22 : 1), 100 * (i % 2 ? 1.24 : 1), 160 + (i * 220) / 22));
    for (const a of [60, 90, 120]) back.push(onEllipse(hx, hy, 150, 100, a));
    b.r('body', smooth(back, true, 0.4), 'brown');
    b.deco('M182 404l12 -18l12 18M232 360l12 -18l12 18M206 458l12 -18l12 18M300 368l12 -18l12 18M270 442l12 -18l12 18', undefined, 3);
    b.r('foot-left', ellipse(214, 516, 30, 16), 'caramel');
    b.r('foot-right', ellipse(346, 518, 30, 16), 'caramel');
    b.r('ear', circle(372, 342, 23), 'sand');
    b.r('face', smooth([[348, 342], [410, 352], [470, 394], [500, 426], [478, 452], [410, 478], [350, 490], [318, 428]], true, 0.9), 'sand');
    b.r('nose', circle(500, 426, 15), 'black');
    b.r('cheek', circle(440, 446, 13), 'pink');
    inkEye(b, 424, 402, 10);
    b.d(quad([458, 452], [470, 464], [484, 452]), undefined, 4);
    b.r('apple', circle(248, 316, 32), 'red');
    b.deco('M248 286Q246 276 252 266', undefined, 4);
    b.r('apple-leaf', leaf([252, 286], [292, 264], 15), 'green');
    // Leaves on the ground
    veinLeaf(b, 'ground-leaf#', [90, 524], [156, 500], 20, 'red');
    veinLeaf(b, 'ground-leaf#', [56, 566], [124, 584], 20, 'yellow');
    veinLeaf(b, 'ground-leaf#', [420, 566], [486, 548], 20, 'orange');
    tufts(b, [[200, 576], [340, 580], [580, 556]], 8);
  }
);

/* ───────────── 6. Koala ───────────── */

/** A koala hugging its eucalyptus tree. */
export const koala = definePage(
  { id: 'koala', theme: 'animaux', title: { fr: 'Le koala dans son eucalyptus', en: 'The koala in its eucalyptus tree' }, emoji: '🐨', level: 2 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('sun', circle(300, 70, 42), 'yellow');
    b.r('cloud#', cloud(470, 300, 120, 46), 'white');
    b.r('cloud#', cloud(120, 330, 110, 42), 'white');
    b.r('ground', hill(0, 520, [300, 488], 600, 520, 600), 'lime');
    b.r('branch-left', tube([[300, 470], [220, 340], [140, 222], [70, 120]], 54, 30), 'brown');
    b.r('branch-right', tube([[300, 470], [390, 330], [470, 222], [540, 112]], 54, 30), 'brown');
    b.r('trunk', tube([[300, 640], [300, 560], [300, 450]], 92, 80), 'brown');
    b.deco('M286 556q10 -16 0 -32M316 590q-8 -12 0 -24', undefined, 3);
    const leaves: [P, P][] = [
      [[70, 120], [20, 56]],
      [[74, 118], [96, 36]],
      [[80, 132], [8, 156]],
      [[104, 176], [40, 214]],
      [[132, 214], [96, 270]],
      [[540, 112], [588, 54]],
      [[538, 110], [494, 34]],
      [[530, 124], [596, 156]],
      [[496, 176], [560, 214]],
      [[468, 214], [504, 270]],
    ];
    const greens = ['green', 'mint', 'turquoise'];
    leaves.forEach(([a, t], i) => veinLeaf(b, 'leaf#', a, t, 15, greens[i % 3]));
    // Koala
    b.r('body', ellipse(300, 410, 84, 94), 'grey');
    b.r('belly', ellipse(300, 432, 52, 62), 'cream');
    b.r('leg-left', ellipse(246, 488, 36, 24, -10), 'grey');
    b.deco('M232 506v8M246 508v8M260 506v8', undefined, 3);
    b.r('leg-right', ellipse(354, 488, 36, 24, 10), 'grey');
    b.deco('M340 506v8M354 508v8M368 506v8', undefined, 3);
    b.r('arm-left', capsule(246, 364, 194, 302, 38), 'grey');
    b.deco('M178 296l-8 -6M182 310l-10 -2', undefined, 3);
    b.r('arm-right', capsule(354, 364, 410, 302, 38), 'grey');
    b.deco('M426 296l8 -6M422 310l10 -2', undefined, 3);
    for (const [side, x] of [['left', 206], ['right', 394]] as const) {
      b.r(`ear-${side}`, flower(x, 196, 54, 9), 'grey');
      b.r(`ear-${side}-in`, flower(x, 198, 32, 7), 'pink');
    }
    b.r('head', circle(300, 252, 90), 'grey');
    b.deco('M232 182q8 -8 18 -6M368 182q-8 -8 -18 -6', undefined, 3);
    b.r('nose', ellipse(300, 270, 25, 33), 'black');
    b.deco(ellipse(291, 256, 6, 10), 'white');
    b.r('cheek-left', circle(244, 284, 15), 'pink');
    b.r('cheek-right', circle(356, 284, 15), 'pink');
    inkEye(b, 254, 238, 10);
    inkEye(b, 346, 238, 10);
    b.d(smile(300, 314, 28, 10), undefined, 4);
    tufts(b, [[80, 560], [200, 584], [420, 584], [540, 556]], 8);
  }
);

/* ───────────── 7. Penguins ───────────── */

/** A penguin: body, white face and belly, beak, feet; `extra` adds a scarf or a hat. */
function penguin(b: PageBuilder, id: string, cx: number, cy: number, s: number, extra?: 'scarf' | 'hat') {
  const S = (dx: number, dy: number): P => [cx + dx * s, cy + dy * s];
  b.r(`${id}-flipper-left`, ellipse(cx - 64 * s, cy + 6 * s, 18 * s, 52 * s, 22), 'black');
  b.r(`${id}-flipper-right`, ellipse(cx + 64 * s, cy + 6 * s, 18 * s, 52 * s, -22), 'black');
  b.r(`${id}-body`, ellipse(cx, cy, 70 * s, 102 * s), 'black');
  const face: P[] = [[0, -60], [22, -84], [46, -74], [52, -40], [56, 10], [44, 66], [0, 92], [-44, 66], [-56, 10], [-52, -40], [-46, -74], [-22, -84]];
  b.r(`${id}-belly`, smooth(face.map(([x, y]) => S(x, y)), true, 0.9), 'white');
  b.r(`${id}-foot-left`, ellipse(cx - 28 * s, cy + 100 * s, 26 * s, 12 * s), 'orange');
  b.r(`${id}-foot-right`, ellipse(cx + 28 * s, cy + 100 * s, 26 * s, 12 * s), 'orange');
  b.r(`${id}-cheek-left`, circle(...S(-34, -28), 12 * s), 'pink');
  b.r(`${id}-cheek-right`, circle(...S(34, -28), 12 * s), 'pink');
  if (extra === 'scarf') {
    b.r(`${id}-scarf-tail`, poly([S(16, -4), S(40, -2), S(46, 46), S(24, 48)]), 'red');
    b.deco(`M${S(24, 12).join(' ')}L${S(42, 12).join(' ')}M${S(26, 30).join(' ')}L${S(44, 30).join(' ')}`, undefined, 3);
    b.r(`${id}-scarf`, capsule(...S(-58, -8), ...S(58, -8), 18 * s), 'red');
  }
  if (extra === 'hat') {
    const [hx, hy] = S(0, -92);
    b.r(`${id}-hat`, `M${hx - 46 * s} ${hy + 6 * s}Q${hx - 44 * s} ${hy - 44 * s} ${hx} ${hy - 46 * s}Q${hx + 44 * s} ${hy - 44 * s} ${hx + 46 * s} ${hy + 6 * s}Z`, 'blue');
    b.r(`${id}-hat-band`, capsule(hx - 46 * s, hy + 4 * s, hx + 46 * s, hy + 4 * s, 16 * s), 'sky');
    b.r(`${id}-pompom`, circle(hx, hy - 48 * s, 14 * s), 'yellow');
  }
  b.r(`${id}-beak`, smooth([S(-18, -42), S(18, -42), S(0, -18)], true, 0.5), 'orange');
  inkEye(b, ...S(-21, -56), 8 * s);
  inkEye(b, ...S(21, -56), 8 * s);
}

/** A penguin family on the ice floe. */
export const penguins = definePage(
  { id: 'penguins', theme: 'animaux', title: { fr: 'Les pingouins sur la banquise', en: 'Penguins on the ice' }, emoji: '🐧', level: 2 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('sun', circle(90, 86, 42), 'yellow');
    b.r('cloud', cloud(320, 70, 150, 56), 'white');
    b.r('iceberg-back', smooth([[330, 330], [380, 210], [420, 236], [470, 150], [530, 230], [600, 196], [600, 330]], true, 0.25), 'lavender');
    b.r('iceberg', smooth([[0, 330], [0, 230], [60, 196], [110, 250], [170, 222], [230, 330]], true, 0.25), 'white');
    b.r('sea', rect(0, 318, 600, 282), 'blue');
    b.deco('M240 350q15 -10 30 0q15 10 30 0M470 352q15 -10 30 0q15 10 30 0M60 360q15 -10 30 0', undefined, 3);
    b.r('ice-side', smooth([[12, 420], [588, 420], [580, 490], [440, 520], [160, 520], [20, 490]], true, 0.6), 'sky');
    b.r('ice', smooth([[10, 424], [90, 388], [300, 378], [510, 388], [590, 424], [520, 458], [300, 466], [80, 458]], true, 0.8), 'white');
    b.deco('M450 498l20 -14M140 504l-16 -12', undefined, 3);
    penguin(b, 'mum', 300, 318, 1);
    penguin(b, 'baby-1', 136, 364, 0.7, 'scarf');
    penguin(b, 'baby-2', 464, 366, 0.7, 'hat');
    fish(b, 120, 556, 1, 'orange', -1, 'yellow');
    b.d('M60 584q8 -10 18 -2M168 582q10 -8 18 2', undefined, 3);
    fish(b, 480, 562, 0.85, 'yellow', 1, 'red');
    let flakes = '';
    for (const [x, y, r] of [[200, 160, 10], [560, 70, 10], [440, 110, 8], [30, 170, 8], [250, 40, 7], [180, 280, 8]] as [number, number, number][]) flakes += asterisk(x, y, r);
    b.d(flakes, undefined, 3);
  }
);

/* ───────────── 8. Whale ───────────── */

/** A happy whale blowing a water spout. */
export const whale = definePage(
  { id: 'whale', theme: 'animaux', title: { fr: "La baleine et son jet d'eau", en: 'The whale and its water spout' }, emoji: '🐳', level: 1 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('sun', circle(522, 84, 46), 'yellow');
    b.r('cloud', cloud(110, 80, 160, 62), 'white');
    const jet: P[] = [[234, 244], [226, 196], [204, 154], [168, 132], [128, 142]];
    b.r('spout-left', tube(jet, 34, 24), 'white');
    b.r('spout-right', tube(mirrorX(jet, 246), 34, 24), 'white');
    b.r('drop#', drop(122, 196, 11), 'white');
    b.r('drop#', drop(370, 196, 11), 'white');
    b.r('drop#', drop(246, 116, 12), 'white');
    b.r('tail', smooth([[516, 318], [530, 276], [502, 230], [500, 210], [532, 216], [556, 246], [578, 212], [598, 208], [594, 236], [566, 286], [552, 324]], true, 0.6), 'blue');
    b.r('body', smooth([[92, 352], [104, 288], [150, 240], [232, 214], [322, 218], [404, 250], [462, 292], [508, 312], [538, 300], [554, 318], [530, 352], [470, 384], [380, 412], [262, 426], [160, 418], [108, 396]], true, 0.9), 'blue');
    b.r('belly', smooth([[100, 368], [180, 360], [290, 376], [400, 400], [300, 422], [190, 424], [120, 406]], true, 0.8), 'cream');
    b.deco('M150 382Q220 394 296 398M180 404Q240 410 300 412', undefined, 3);
    b.r('flipper', ellipse(316, 352, 46, 20, 28), 'blue');
    b.r('cheek', circle(206, 326, 15), 'pink');
    inkEye(b, 170, 298, 12);
    b.d(quad([100, 336], [150, 358], [204, 350]), undefined, 4.5);
    b.r('sea', waveTop(0, 414, 600, 186, 12, 3), 'turquoise');
    b.d('M40 476q15 -10 30 0q15 10 30 0M250 500q15 -10 30 0q15 10 30 0M470 470q15 -10 30 0q15 10 30 0M120 560q15 -10 30 0q15 10 30 0', undefined, 3.5);
    fish(b, 420, 540, 1.1, 'orange', 1);
  }
);

/* ───────────── 9. Parrot ───────────── */

/** A macaw on a branch in the jungle (many small zones). */
export const parrot = definePage(
  { id: 'parrot-jungle', theme: 'animaux', title: { fr: 'Le perroquet dans la jungle', en: 'The parrot in the jungle' }, emoji: '🦜', level: 3 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('sun', circle(470, 70, 38), 'yellow');
    b.r('jungle-back', hill(0, 470, [300, 380], 600, 470, 600), 'forest');
    // Big leaves around the edges
    const big: [P, P, number, string][] = [
      [[0, 180], [150, 130], 44, 'green'],
      [[0, 300], [140, 340], 42, 'forest'],
      [[0, 420], [126, 450], 38, 'lime'],
      [[600, 190], [456, 140], 44, 'green'],
      [[600, 310], [470, 350], 42, 'lime'],
      [[110, 0], [176, 110], 32, 'lime'],
      [[530, 0], [592, 96], 26, 'forest'],
      [[40, 600], [140, 490], 40, 'green'],
      [[560, 600], [450, 492], 40, 'green'],
      [[220, 600], [190, 512], 28, 'lime'],
      [[390, 600], [420, 514], 28, 'forest'],
    ];
    for (const [a, t, w, c] of big) veinLeaf(b, 'leaf#', a, t, w, c, true);
    // Hanging vines
    b.d(curve([[250, 0], [240, 50], [256, 100], [246, 150]]) + curve([[380, 0], [392, 40], [380, 86], [392, 120]]), undefined, 4);
    for (const [a, t] of [[[244, 40], [222, 60]], [[252, 90], [276, 106]], [[246, 140], [224, 160]], [[390, 36], [412, 52]], [[382, 80], [360, 96]], [[392, 118], [412, 138]]] as [P, P][]) b.r('vine-leaf#', leaf(a, t, 10), 'lime');
    hibiscus(b, 92, 250, 42, 'red', 10);
    hibiscus(b, 522, 254, 40, 'pink', -10);
    hibiscus(b, 476, 336, 32, 'magenta', 20);
    // Tail feathers (behind the branch)
    b.r('tail-blue', tube([[288, 380], [282, 460], [272, 548]], 28, 14), 'blue');
    b.r('tail-yellow', tube([[328, 380], [344, 450], [362, 530]], 26, 12), 'yellow');
    b.r('tail-red', tube([[308, 380], [312, 470], [316, 566]], 32, 16), 'red');
    b.deco('M312 400V550', undefined, 3);
    // Branch
    b.r('branch', tube([[-20, 446], [200, 428], [400, 424], [620, 404]], 30, 24), 'brown');
    b.deco('M60 440h40M440 418h40', undefined, 3);
    // Parrot
    b.r('body', ellipse(300, 310, 66, 98, -6), 'red');
    b.deco('M266 330q10 8 20 0q10 8 20 0M262 360q10 8 20 0q10 8 20 0M270 390q10 8 20 0', undefined, 3);
    const rows: [number, number, number, string][] = [
      [298, 410, 13, 'blue'],
      [270, 344, 12, 'green'],
      [242, 292, 11, 'yellow'],
    ];
    for (const [y0, y1, w, c] of rows) for (let k = 0; k < 4; k++) b.r('feather#', leaf([322 + k * 16, y0], [332 + k * 16, y1], w), c);
    b.r('foot-left', ellipse(282, 422, 18, 11), 'grey');
    b.deco('M274 432v8M288 432v8', undefined, 3);
    b.r('foot-right', ellipse(326, 420, 18, 11), 'grey');
    b.deco('M318 430v8M332 430v8', undefined, 3);
    b.r('head', circle(296, 196, 62), 'red');
    b.r('face-patch', ellipse(274, 196, 32, 28), 'white');
    b.deco('M252 214q8 4 16 0M258 224q8 4 16 0', undefined, 2.5);
    b.r('beak-low', smooth([[216, 228], [234, 214], [254, 220], [248, 240], [226, 248]], true, 0.7), 'black');
    b.r('beak', smooth([[252, 184], [224, 180], [204, 198], [198, 228], [212, 246], [216, 222], [234, 212], [254, 214]], true, 0.7), 'cream');
    b.r('cheek', circle(306, 222, 10), 'pink');
    inkEye(b, 278, 190, 9);
    b.r('crest#', leaf([300, 140], [326, 110], 12), 'orange');
    b.r('crest#', leaf([312, 144], [346, 128], 11), 'yellow');
    butterfly(b, 160, 66, 0.9, 'turquoise', 'purple');
  }
);

/* ───────────── 10. Flower garden ───────────── */

/** A tulip: stem, leaf, cup and front petal. */
function tulip(b: PageBuilder, x: number, y: number, h: number, color: string) {
  b.r('stem#', tube([[x, y + h], [x - 4, y + h * 0.5], [x, y + 20]], 10), 'green');
  b.r('tulip-leaf#', leaf([x - 2, y + h - 6], [x - 40, y + h * 0.45], 16), 'green');
  b.r('tulip#', smooth([[x - 28, y - 22], [x - 26, y + 14], [x, y + 30], [x + 26, y + 14], [x + 28, y - 22], [x + 14, y - 6], [x, y - 28], [x - 14, y - 6]], true, 0.6), color);
  b.r('tulip-front#', smooth([[x - 14, y - 6], [x, y - 28], [x + 14, y - 6], [x + 12, y + 16], [x, y + 28], [x - 12, y + 16]], true, 0.7), color);
}

/** A daisy: stem, white petals one by one and a yellow heart. */
function daisy(b: PageBuilder, x: number, y: number, h: number, r: number, petals = 10, color = 'white') {
  b.r('stem#', tube([[x, y + h], [x + 4, y + h * 0.5], [x, y]], 9), 'green');
  b.r('daisy-leaf#', leaf([x + 2, y + h - 10], [x + 38, y + h * 0.5], 14), 'green');
  for (let k = 0; k < petals; k++) b.r('daisy-petal#', petal(x, y, r * 0.3, r, k * (360 / petals), r * 0.2), color);
  b.r('daisy-heart#', circle(x, y, r * 0.36), 'yellow');
}

/** A garden in bloom with its watering can (zen, many small zones). */
export const flowerGarden = definePage(
  { id: 'flower-garden', theme: 'zen', title: { fr: "Le jardin de fleurs et l'arrosoir", en: 'The flower garden and the watering can' }, emoji: '🌷', level: 3 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('sun', circle(526, 74, 36), 'yellow');
    for (let i = 0; i < 8; i++) {
      const a = i * 45 + 22;
      b.r('sun-ray#', poly([polar(526, 74, 46, a - 9), polar(526, 74, 66, a), polar(526, 74, 46, a + 9)]), 'yellow');
    }
    b.r('cloud#', cloud(250, 64, 140, 52), 'white');
    b.r('cloud#', cloud(400, 140, 100, 40), 'white');
    b.r('hill', hill(0, 320, [300, 270], 600, 320, 600), 'green');
    // Fence
    b.r('fence-rail#', rect(0, 316, 600, 14, 4), 'white');
    b.r('fence-rail#', rect(0, 356, 600, 14, 4), 'white');
    for (let x = 8; x < 600; x += 46) b.r('picket#', poly([[x, 400], [x, 300], [x + 13, 286], [x + 26, 300], [x + 26, 400]]), 'white');
    b.r('lawn', rect(0, 392, 600, 208), 'lime');
    // Stepping stones
    for (const [x, y, rx] of [[470, 588, 34], [404, 548, 28], [352, 590, 26]] as [number, number, number][]) b.r('stone#', ellipse(x, y, rx, rx * 0.45), 'grey');
    // Sunflower
    b.r('stem#', tube([[76, 470], [70, 330], [80, 200]], 14), 'green');
    b.r('sunflower-leaf#', leaf([72, 380], [24, 340], 20), 'green');
    b.r('sunflower-leaf#', leaf([74, 320], [128, 290], 20), 'green');
    for (let k = 0; k < 14; k++) b.r('sunflower-petal#', petal(80, 190, 28, 70, k * (360 / 14), 13), k % 2 ? 'orange' : 'yellow');
    b.r('sunflower-heart', circle(80, 190, 32), 'brown');
    let seeds = '';
    for (const [dx, dy] of [[-12, -12], [0, -16], [12, -12], [-16, 0], [0, 0], [16, 0], [-12, 12], [0, 16], [12, 12]] as P[]) seeds += circle(80 + dx, 190 + dy, 2.5);
    b.d(seeds, 'ink');
    // Flower bed
    b.r('flower-bed', ellipse(224, 476, 204, 40), 'brown');
    b.deco('M90 476h14M150 492h14M260 498h14M330 476h14M200 464h14', undefined, 3);
    tulip(b, 156, 336, 140, 'red');
    daisy(b, 228, 290, 186, 40, 10);
    tulip(b, 300, 352, 120, 'pink');
    daisy(b, 366, 364, 108, 30, 8, 'lavender');
    tulip(b, 120, 410, 66, 'purple');
    // Watering can
    b.r('can-handle', ringSegment(526, 446, 30, 46, 180, 360), 'blue');
    b.r('can-spout', poly([[482, 506], [412, 432], [426, 418], [488, 478]]), 'blue');
    b.r('can-rose', ellipse(414, 424, 14, 24, 45), 'grey');
    b.deco(circle(410, 418, 2.4) + circle(418, 428, 2.4) + circle(406, 430, 2.4), 'ink');
    b.r('can', rect(462, 444, 128, 108, 22), 'blue');
    b.r('can-band', rect(462, 444, 128, 20, 8), 'turquoise');
    b.r('can-heart', heart(526, 506, 40), 'pink');
    for (const [x, y] of [[388, 440], [370, 468], [396, 482], [376, 502]] as P[]) b.r('drop#', drop(x, y, 7), 'turquoise');
    // Little visitors
    butterfly(b, 300, 186, 0.9, 'purple', 'pink');
    b.r('ladybug', ellipse(560, 580, 20, 16, -10), 'red');
    b.deco('M546 574L574 586', undefined, 3);
    b.deco(circle(554, 572, 3) + circle(566, 588, 3), 'ink');
    groundFlower(b, 46, 552, 20, 'red', 5);
    tufts(b, [[110, 584], [200, 584], [290, 560]], 8);
  }
);

/** More animal and nature pages (lion, panda, sea turtle…). */
export const MORE_ANIMALS: ColoringPage[] = [lion, cowFarm, panda, seaTurtle, hedgehog, koala, penguins, whale, parrot, flowerGarden];
