import { capsule, circle, cloud, ellipse, heart, hill, quad, rect, ringsAlong, rotate, smooth, type P } from '../shapes';
import { definePage, type PageBuilder } from './build';
import { groundFlower, tufts } from './parts';

/*
 * Ziggy as he really is: the soft green plush robot of the photos and the
 * film. A big rounded-square head (wider than the body) with two thin
 * antennas and felt balls, round "headphone" ear pads, big embroidered eyes
 * (green iris, black upper lash line with three lashes on the outer side,
 * black eyebrows), a small smile, a glowing heart with a stitched outline,
 * ribbed arms and legs, mitten hands with a thumb and big boots.
 */

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Superellipse: a rounded square with soft sides (Ziggy's head and body). */
function squircle(cx: number, cy: number, a: number, b: number, n = 3, steps = 32): string {
  const pts: P[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    pts.push([cx + a * Math.sign(c) * Math.abs(c) ** (2 / n), cy + b * Math.sign(s) * Math.abs(s) ** (2 / n)]);
  }
  return smooth(pts, true, 0.9);
}

/** The four-point twinkle of the mascot artwork. */
function twinkle(cx: number, cy: number, r: number): string {
  const p = (x: number, y: number) => `${r1(cx + x * r)} ${r1(cy + y * r)}`;
  return `M${p(0, -1)}C${p(0.09, -0.42)} ${p(0.42, -0.09)} ${p(1, 0)}C${p(0.42, 0.09)} ${p(0.09, 0.42)} ${p(0, 1)}C${p(-0.09, 0.42)} ${p(-0.42, 0.09)} ${p(-1, 0)}C${p(-0.42, -0.09)} ${p(-0.09, -0.42)} ${p(0, -1)}Z`;
}

/** A mitten (fingers up, thumb on the left), turned by `deg` around its wrist. */
function mitten(cx: number, cy: number, deg: number, k = 1): string {
  const shape: P[] = [
    [-18, 30],
    [0, 32],
    [18, 30],
    [25, 12],
    [27, -10],
    [20, -30],
    [4, -38],
    [-12, -34],
    [-21, -20],
    [-22, -7],
    [-31, -12],
    [-40, -8],
    [-39, 3],
    [-29, 14],
    [-20, 24],
  ];
  return smooth(
    rotate(
      shape.map(([x, y]) => [cx + x * k, cy + y * k] as P),
      cx,
      cy,
      deg
    ),
    true,
    0.85
  );
}

/** The flat band at the wrist, across the end (x2, y2) of an arm going from (x1, y1). */
function band(x1: number, y1: number, x2: number, y2: number, w = 46, t = 13): string {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = (-(y2 - y1) / len) * (w / 2 - t / 2);
  const ny = ((x2 - x1) / len) * (w / 2 - t / 2);
  return capsule(x2 + nx, y2 + ny, x2 - nx, y2 - ny, t);
}

/** A big round plush boot; `dir` = 1 points the toe right, -1 left. */
function boot(cx: number, cy: number, dir: 1 | -1): string {
  const shape: P[] = [
    [-24, -30],
    [0, -33],
    [24, -30],
    [28, -10],
    [42, 4],
    [48, 20],
    [36, 31],
    [0, 33],
    [-34, 31],
    [-42, 16],
    [-34, -8],
  ];
  return smooth(
    shape.map(([x, y]) => [cx + x * dir, cy + y] as P),
    true,
    0.85
  );
}

/** Eye: white, green iris (regions), pupil and shine (on the iris), upper lash line with three lashes on the outer side. */
function eye(b: PageBuilder, side: 'left' | 'right', cx: number, cy: number) {
  const out = side === 'left' ? -1 : 1;
  const rx = 39;
  const ry = 42;
  b.r(`eye-${side}`, ellipse(cx, cy, rx, ry), 'white');
  const ix = cx - out * 5;
  const iy = cy + 6;
  b.r(`iris-${side}`, circle(ix, iy, 27), 'lime');
  b.deco(circle(ix + 1, iy + 1, 14.5), 'ink');
  b.deco(circle(ix - 9, iy - 10, 6.5), 'white', 1);
  b.deco(circle(ix + 8, iy + 10, 3), 'white', 1);
  // Lash line hugging the top of the eye, heavier on the outer corner.
  const at = (deg: number, grow = 0): P => {
    const t = (deg * Math.PI) / 180;
    return [cx + (rx + grow) * Math.cos(t), cy + (ry + grow) * Math.sin(t)];
  };
  const a0 = side === 'left' ? 192 : 222;
  const a1 = side === 'left' ? 318 : 348;
  const [sx, sy] = at(a0, 1);
  const [ex, ey] = at(a1, 1);
  b.d(`M${r1(sx)} ${r1(sy)}A${rx + 1} ${ry + 1} 0 0 1 ${r1(ex)} ${r1(ey)}`, undefined, 7);
  // Three lashes on the outer side.
  let lashes = '';
  for (const deg of side === 'left' ? [196, 210, 226] : [314, 330, 344]) {
    const [x0, y0] = at(deg, 2);
    const [x1, y1] = at(deg + (side === 'left' ? -6 : 6), 15);
    lashes += `M${r1(x0)} ${r1(y0)}L${r1(x1)} ${r1(y1)}`;
  }
  b.d(lashes, undefined, 5);
}

/** Ziggy, the green plush robot, waving, with his glowing heart. */
export const ziggy = definePage(
  { id: 'ziggy', theme: 'espace', title: { fr: 'Ziggy le robot', en: 'Ziggy the robot' }, emoji: '🤖', level: 1 },
  (b) => {
    // Sky, sun, clouds and twinkles.
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('sun', circle(70, 70, 38), 'yellow');
    let rays = '';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + 0.2;
      rays += `M${r1(70 + Math.cos(a) * 50)} ${r1(70 + Math.sin(a) * 50)}L${r1(70 + Math.cos(a) * 66)} ${r1(70 + Math.sin(a) * 66)}`;
    }
    b.deco(rays, undefined, 5);
    b.r('cloud#', cloud(498, 98, 150, 62), 'white');
    b.r('cloud#', cloud(78, 318, 112, 46), 'white');
    b.r('twinkle#', twinkle(140, 150, 17), 'yellow');
    b.r('twinkle#', twinkle(560, 318, 19), 'pink');
    b.r('twinkle#', twinkle(54, 220, 12), 'turquoise');
    b.r('twinkle#', twinkle(96, 420, 12), 'yellow');
    b.r('hill-back', hill(0, 470, [420, 390], 600, 456, 600), 'mint');
    b.r('hill', hill(0, 522, [300, 480], 600, 516, 600), 'lime');
    groundFlower(b, 64, 552, 22, 'pink', 5);
    groundFlower(b, 540, 548, 24, 'red', 6);
    groundFlower(b, 478, 580, 14, 'purple', 5);
    groundFlower(b, 128, 584, 13, 'orange', 5);

    // Antennas: thin stalks with felt balls.
    b.r('antenna-left', capsule(256, 112, 218, 54, 12), 'green');
    b.r('antenna-right', capsule(344, 110, 366, 44, 12), 'green');
    b.r('antenna-ball-left', circle(213, 46, 20), 'green');
    b.r('antenna-ball-right', circle(368, 36, 20), 'green');

    // Round "headphone" ear pads, half behind the head.
    b.r('ear-left', ellipse(156, 214, 33, 50), 'green');
    b.r('ear-left-in', ellipse(146, 214, 17, 33), 'lime');
    b.r('ear-right', ellipse(444, 214, 33, 50), 'green');
    b.r('ear-right-in', ellipse(454, 214, 17, 33), 'lime');

    // Ribbed arms, wrist bands and mittens: one hangs, one waves.
    b.r('arm-left', capsule(206, 360, 186, 424, 36), 'grey');
    b.deco(ringsAlong(206, 360, 186, 424, 36, 4), undefined, 3.5);
    b.r('hand-left', mitten(182, 462, 186, 1), 'green');
    b.r('band-left', band(206, 360, 188, 428), 'grey');
    b.r('arm-right', capsule(392, 352, 498, 254, 36), 'grey');
    b.deco(ringsAlong(392, 352, 498, 254, 36, 5), undefined, 3.5);
    b.r('hand-right', mitten(521, 225, 30, 1.05), 'green');
    b.r('band-right', band(392, 352, 502, 250), 'grey');

    // Ribbed legs and big boots.
    b.r('leg-left', capsule(266, 440, 262, 490, 38), 'grey');
    b.deco(ringsAlong(266, 440, 262, 490, 38, 3), undefined, 3.5);
    b.r('leg-right', capsule(334, 440, 338, 490, 38), 'grey');
    b.deco(ringsAlong(334, 440, 338, 490, 38, 3), undefined, 3.5);
    b.r('boot-left', boot(256, 516, -1), 'green');
    b.deco(quad([226, 500], [256, 508], [286, 500]), undefined, 3);
    b.r('boot-right', boot(344, 516, 1), 'green');
    b.deco(quad([314, 500], [344, 508], [374, 500]), undefined, 3);

    // Shoulders, body (soft rounded square with seams) and the glowing heart.
    b.r('shoulder-left', circle(216, 346, 27), 'green');
    b.r('shoulder-right', circle(384, 346, 27), 'green');
    b.r('body', squircle(300, 378, 84, 76, 3.2), 'green');
    b.deco(quad([226, 418], [300, 438], [374, 418]), undefined, 3);
    b.deco('M300 430L300 452', undefined, 3);
    b.r('heart-rim', heart(300, 386, 100), 'orange');
    b.r('heart', heart(300, 385, 73), 'yellow');

    // The big rounded-square head with a seam on top.
    b.r('head', squircle(300, 210, 146, 120, 2.35), 'green');
    b.deco('M300 93Q297 112 300 132', undefined, 3);

    // Face: eyebrows, eyes with lashes, small smile.
    eye(b, 'left', 244, 214);
    eye(b, 'right', 356, 214);
    b.d(quad([214, 156], [236, 140], [262, 150]), undefined, 7);
    b.d(quad([338, 148], [364, 136], [388, 152]), undefined, 7);
    b.d(quad([276, 276], [304, 298], [334, 270]), undefined, 6);
    tufts(b, [[178, 560], [420, 548], [584, 590], [24, 506]], 9);
  }
);
