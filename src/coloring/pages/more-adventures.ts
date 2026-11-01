import {
  arc,
  blob,
  capsule,
  circle,
  cloud,
  ellipse,
  ellipseBand,
  heart,
  hill,
  leaf,
  mirrorX,
  petal,
  polar,
  poly,
  quad,
  rect,
  ringSegment,
  ringsAlong,
  rotate,
  smooth,
  softStar,
  waveTop,
  type P,
} from '../shapes';
import type { ColoringPage } from '../types';
import { definePage, type PageBuilder } from './build';
import { groundFlower, inkEye, smile, tufts } from './parts';

/** More fairy-tale, vehicle, space and Ziggy pages (dragon, pirate ship, fire truck…). */

const r1 = (n: number) => Math.round(n * 10) / 10;
const xy = (p: P) => `${r1(p[0])} ${r1(p[1])}`;
const line = (a: P, b: P) => `M${xy(a)}L${xy(b)}`;

/* ───────────────────────── Ziggy, at any size ───────────────────────── */

/** Superellipse: a rounded square with soft sides (Ziggy's head and body, as in ziggy.ts). */
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

const MITTEN: P[] = [
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

/** Ziggy's mitten (fingers along `deg`, thumb on the left unless flipped). */
function mitten(cx: number, cy: number, deg: number, k: number, flip: boolean): string {
  const pts = MITTEN.map(([x, y]) => [cx + (flip ? -x : x) * k, cy + y * k] as P);
  return smooth(rotate(pts, cx, cy, deg), true, 0.85);
}

const BOOT: P[] = [
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

/** A big round plush boot; `dir` = 1 points the toe right, -1 left. */
const boot = (cx: number, cy: number, k: number, dir: 1 | -1) =>
  smooth(
    BOOT.map(([x, y]) => [cx + x * dir * k, cy + y * k] as P),
    true,
    0.85
  );

/** Where Ziggy stands: his head centre and his size (1 = the big drawing of ziggy.ts). */
type Place = { x: number; y: number; k: number };

type ZiggyLook = {
  /** End of each arm, in the coordinates of the big drawing (head centred on 300, 210). */
  armLeft: P;
  armRight: P;
  suit?: string;
  limbs?: string;
  hands?: string;
  boots?: string;
  /** Astronaut: bubble helmet, collar and backpack (the body sits lower, under the helmet). */
  space?: boolean;
  /** Pastry chef: tall hat and apron. */
  chef?: boolean;
  /** Something held in the right hand, drawn just before the mitten (page coordinates). */
  hold?: (b: PageBuilder, hand: P, deg: number) => void;
};

/** Ziggy, the green plush robot (big head, antennas with felt balls, glowing heart). */
function drawZiggy(b: PageBuilder, at: Place, look: ZiggyLook) {
  const { k } = at;
  const low = look.space ? 80 : 0;
  const H = (x: number, y: number): P => [at.x + (x - 300) * k, at.y + (y - 210) * k];
  const T = (x: number, y: number): P => H(x, y + low);
  const dw = (n: number) => r1(Math.max(2.5, n * Math.sqrt(k)));
  const suit = look.suit ?? 'green';
  const limbs = look.limbs ?? 'grey';
  const hands = look.hands ?? 'green';
  const boots = look.boots ?? 'green';

  if (look.space) {
    const [x0, y0] = T(178, 300);
    b.r('ziggy-backpack', rect(x0, y0, 244 * k, 150 * k, 26 * k), 'grey');
  }

  // Ribbed legs and big boots.
  const small = k < 0.8;
  const legs: [P, P, P, 1 | -1][] = look.space
    ? [
        [[266, 440], [242, 506], [232, 532], -1],
        [[334, 440], [366, 496], [382, 518], 1],
      ]
    : [
        [[266, 440], [262, 490], [256, 516], -1],
        [[334, 440], [338, 490], [344, 516], 1],
      ];
  legs.forEach(([s, e, bt, dir], i) => {
    const side = i ? 'right' : 'left';
    const S = T(...s);
    const E = T(...e);
    b.r(`ziggy-leg-${side}`, capsule(S[0], S[1], E[0], E[1], 38 * k), limbs);
    b.deco(ringsAlong(S[0], S[1], E[0], E[1], 38 * k, 3), undefined, dw(3.5));
    const B = T(...bt);
    b.r(`ziggy-boot-${side}`, boot(B[0], B[1], k, dir), boots);
    b.deco(quad(T(bt[0] - 30, bt[1] - 16), T(bt[0], bt[1] - 8), T(bt[0] + 30, bt[1] - 16)), undefined, dw(3));
  });

  // Ribbed arms, wrist bands and mittens.
  const arm = (side: 'left' | 'right', s: P, e: P) => {
    const S = T(...s);
    const E = T(...e);
    const len = Math.hypot(E[0] - S[0], E[1] - S[1]) || 1;
    const ux = (E[0] - S[0]) / len;
    const uy = (E[1] - S[1]) / len;
    b.r(`ziggy-arm-${side}`, capsule(S[0], S[1], E[0], E[1], 36 * k), limbs);
    b.deco(ringsAlong(S[0], S[1], E[0], E[1], 36 * k, Math.max(2, Math.round(len / (22 * k)))), undefined, dw(3.5));
    const deg = (Math.atan2(ux, -uy) * 180) / Math.PI;
    const hand: P = [E[0] + ux * 36 * k, E[1] + uy * 36 * k];
    if (side === 'right' && look.hold) look.hold(b, hand, deg);
    b.r(`ziggy-hand-${side}`, mitten(hand[0], hand[1], deg, k, side === 'left'), hands);
    const bx = E[0] + ux * 4 * k;
    const by = E[1] + uy * 4 * k;
    const nx = -uy * 16.5 * k;
    const ny = ux * 16.5 * k;
    // Too thin to tap on a small Ziggy: the wrist band is then just a line.
    if (small) b.d(line([bx + nx * 1.3, by + ny * 1.3], [bx - nx * 1.3, by - ny * 1.3]), undefined, dw(4));
    else b.r(`ziggy-band-${side}`, capsule(bx + nx, by + ny, bx - nx, by - ny, 13 * k), limbs);
  };
  arm('left', [206, 360], look.armLeft);
  arm('right', [394, 360], look.armRight);

  // Shoulders, body, apron and the glowing heart.
  if (!look.space) {
    b.r('ziggy-shoulder-left', circle(...T(216, 346), 27 * k), suit);
    b.r('ziggy-shoulder-right', circle(...T(384, 346), 27 * k), suit);
  }
  b.r('ziggy-body', squircle(...T(300, 378), 84 * k, 76 * k, 3.2), suit);
  b.deco(quad(T(226, 418), T(300, 438), T(374, 418)), undefined, dw(3));
  if (look.chef) {
    b.r('ziggy-apron', smooth([T(246, 318), T(354, 318), T(366, 380), T(372, 446), T(300, 458), T(228, 446), T(234, 380)], true, 0.7), 'white');
    b.deco(rect(...T(318, 414), 34 * k, 26 * k, 6 * k), undefined, dw(3));
  }
  b.r('ziggy-heart-rim', heart(...T(300, 380), 108 * k), 'orange');
  b.r('ziggy-heart', heart(...T(300, 380), 70 * k), 'yellow');

  // Bubble helmet (astronaut): drawn over the body, under the head.
  if (look.space) {
    b.r('ziggy-helmet', ellipse(...H(300, 190), 206 * k, 218 * k), 'sky');
    b.deco(quad(H(140, 150), H(150, 60), H(226, 6)), undefined, dw(5));
  }

  // Antennas with felt balls (spread apart under a chef's hat), round ear pads.
  const antennas: [string, P, P, P][] = look.chef
    ? [
        ['left', [252, 112], [206, 76], [200, 66]],
        ['right', [348, 112], [394, 76], [400, 66]],
      ]
    : [
        ['left', [256, 112], [222, 60], [218, 52]],
        ['right', [344, 110], [364, 50], [366, 40]],
      ];
  for (const [side, s, e, ball] of antennas) {
    // A small Ziggy's stalk is too thin to fill: draw it as a line.
    if (small) b.d(line(H(...s), H(...e)), undefined, dw(10));
    else b.r(`ziggy-antenna-${side}`, capsule(...H(...s), ...H(...e), 12 * k), 'green');
    b.r(`ziggy-ball-${side}`, circle(...H(...ball), 21 * k), 'green');
  }
  b.r('ziggy-ear-left', ellipse(...H(156, 214), 33 * k, 50 * k), 'green');
  if (!small) b.r('ziggy-ear-left-in', ellipse(...H(146, 214), 17 * k, 33 * k), 'lime');
  b.r('ziggy-ear-right', ellipse(...H(444, 214), 33 * k, 50 * k), 'green');
  if (!small) b.r('ziggy-ear-right-in', ellipse(...H(454, 214), 17 * k, 33 * k), 'lime');

  // Head and face.
  b.r('ziggy-head', squircle(...H(300, 210), 146 * k, 120 * k, 2.35), 'green');
  for (const side of ['left', 'right'] as const) {
    const out = side === 'left' ? -1 : 1;
    const [cx, cy] = H(side === 'left' ? 244 : 356, 214);
    const rx = 39 * k;
    const ry = 42 * k;
    b.r(`ziggy-eye-${side}`, ellipse(cx, cy, rx, ry), 'white');
    const ix = cx - out * 5 * k;
    const iy = cy + 6 * k;
    b.r(`ziggy-iris-${side}`, circle(ix, iy, 27 * k), 'lime');
    b.deco(circle(ix + k, iy + k, 14.5 * k), 'ink');
    b.deco(circle(ix - 9 * k, iy - 10 * k, 6.5 * k), 'white', 1);
    b.deco(circle(ix + 8 * k, iy + 10 * k, 3 * k), 'white', 1);
    const onEye = (deg: number, grow = 0): P => [cx + (rx + grow * k) * Math.cos((deg * Math.PI) / 180), cy + (ry + grow * k) * Math.sin((deg * Math.PI) / 180)];
    const a0 = side === 'left' ? 192 : 222;
    const a1 = side === 'left' ? 318 : 348;
    b.d(`M${xy(onEye(a0, 1))}A${r1(rx + k)} ${r1(ry + k)} 0 0 1 ${xy(onEye(a1, 1))}`, undefined, dw(7));
    let lashes = '';
    for (const deg of side === 'left' ? [196, 210, 226] : [314, 330, 344]) lashes += line(onEye(deg, 2), onEye(deg + (side === 'left' ? -6 : 6), 15));
    b.d(lashes, undefined, dw(5));
  }
  b.r('ziggy-cheek-left', circle(...H(212, 274), 17 * k), 'pink');
  b.r('ziggy-cheek-right', circle(...H(388, 274), 17 * k), 'pink');
  b.d(quad(H(214, 156), H(236, 140), H(262, 150)), undefined, dw(7));
  b.d(quad(H(338, 148), H(364, 136), H(388, 152)), undefined, dw(7));
  b.d(quad(H(272, 274), H(302, 300), H(334, 270)), undefined, dw(6));

  if (look.space) b.r('ziggy-collar', ellipse(...H(300, 404), 132 * k, 28 * k), 'grey');
  if (look.chef) {
    const puff = (x: number, y: number, r: number): [number, number, number] => [...H(x, y), r * k];
    b.r('ziggy-hat-puff', blob([puff(260, 40, 36), puff(300, 14, 44), puff(340, 40, 36)], H(0, 74)[1]), 'white');
    b.deco(quad(H(280, 70), H(276, 44), H(284, 22)) + quad(H(320, 70), H(324, 44), H(316, 22)), undefined, dw(3));
    b.r('ziggy-hat-band', rect(...H(252, 66), 96 * k, 34 * k, 10 * k), 'white');
  }
}

/* ───────────────────────── small helpers ───────────────────────── */

/** Sun rays as short lines (details of the sun region). */
function rays(cx: number, cy: number, r0: number, r1_: number, n = 8, rot = 0.2): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n + rot;
    d += line([cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1_, cy + Math.sin(a) * r1_]);
  }
  return d;
}

/** The part of a circle between two horizontal lines (stripes of a planet). */
function circleBand(cx: number, cy: number, r: number, y0: number, y1: number): string {
  const hx = (y: number) => Math.sqrt(Math.max(0, r * r - (y - cy) ** 2));
  const a = hx(y0);
  const c = hx(y1);
  return `M${xy([cx - a, y0])}L${xy([cx + a, y0])}A${r} ${r} 0 0 1 ${xy([cx + c, y1])}L${xy([cx - c, y1])}A${r} ${r} 0 0 1 ${xy([cx - a, y0])}Z`;
}

/** A happy face (details): shiny eyes, smile. */
function face(b: PageBuilder, cx: number, cy: number, r: number) {
  inkEye(b, cx - r * 0.36, cy - r * 0.08, Math.max(2.6, r * 0.13));
  inkEye(b, cx + r * 0.36, cy - r * 0.08, Math.max(2.6, r * 0.13));
  b.d(smile(cx, cy + r * 0.28, r * 0.52, r * 0.24), undefined, r1(Math.max(2.5, r * 0.08)));
}

/** Closed happy eyes (∩), as details. */
const happyEye = (cx: number, cy: number, r: number) => arc(cx, cy, r, 200, 340);

/** Frosting along the top of a cake tier: rounded top corners, round drips below. */
function frosting(x: number, y: number, w: number, h: number, drips: number, rr: number): string {
  const step = w / drips;
  let d = `M${xy([x, y + h])}V${r1(y + rr)}Q${xy([x, y])} ${xy([x + rr, y])}H${r1(x + w - rr)}Q${xy([x + w, y])} ${xy([x + w, y + rr])}V${r1(y + h)}`;
  for (let i = drips - 1; i >= 0; i--) {
    const x0 = x + (i + 1) * step;
    const x1 = x + i * step;
    const deep = i % 2 ? h * 0.7 : h * 1.3;
    d += `Q${xy([(x0 + x1) / 2, y + h + deep * 1.6])} ${xy([x1, y + h])}`;
  }
  return `${d}Z`;
}

/** Striped sail: horizontal bands, each bulging down a little like wind in the cloth. */
function sail(b: PageBuilder, id: string, x0: number, x1: number, y0: number, y1: number, bulge: number, colors: string[]) {
  const n = colors.length;
  const edge = (t: number): [P, P, P] => {
    const y = y0 + (y1 - y0) * t;
    const flare = 10 * t;
    return [[x0 - flare, y], [(x0 + x1) / 2, y + bulge * (0.6 + t * 0.6)], [x1 + flare, y]];
  };
  colors.forEach((c, i) => {
    const [la, ca, ra] = edge(i / n);
    const [lb, cb, rb] = edge((i + 1) / n);
    b.r(`${id}#`, `M${xy(la)}Q${xy(ca)} ${xy(ra)}L${xy(rb)}Q${xy(cb)} ${xy(lb)}Z`, c);
  });
}

/** A little fish (body + tail regions, eye detail), facing right unless `dir` = -1. */
function fish(b: PageBuilder, cx: number, cy: number, s: number, body: string, tail: string, dir: 1 | -1 = 1, tilt = 0) {
  const tailPts = rotate(
    [
      [cx - dir * s * 0.8, cy],
      [cx - dir * s * 1.45, cy - s * 0.55],
      [cx - dir * s * 1.35, cy + s * 0.55],
    ],
    cx,
    cy,
    tilt
  );
  b.r('fish-tail#', smooth(tailPts, true, 0.4), tail);
  b.r('fish#', ellipse(cx, cy, s, s * 0.62, tilt), body);
  const [ex, ey] = rotate([[cx + dir * s * 0.45, cy - s * 0.12]], cx, cy, tilt)[0];
  inkEye(b, ex, ey, Math.max(2.6, s * 0.11));
  const [mx, my] = rotate([[cx + dir * s * 0.78, cy + s * 0.14]], cx, cy, tilt)[0];
  b.d(`M${xy([mx - dir * 6, my - 2])}Q${xy([mx - dir * 2, my + 4])} ${xy([mx + dir * 2, my - 2])}`, undefined, 2.5);
}

/* ───────────────────────── the pages ───────────────────────── */

/** 1. Ziggy floats in his spacesuit near a smiling Moon. */
export const ziggyAstronaut = definePage(
  { id: 'ziggy-astronaut', theme: 'espace', title: { fr: 'Ziggy astronaute près de la Lune', en: 'Astronaut Ziggy near the Moon' }, emoji: '🧑‍🚀', level: 2 },
  (b) => {
    b.r('space', rect(0, 0, 600, 600), 'navy');
    // Ringed planet and the Earth, far away.
    b.r('ring-back', ellipseBand(100, 100, 82, 23, 58, 13, -14, false), 'yellow');
    b.r('planet', circle(100, 100, 44), 'orange');
    b.deco(quad([60, 88], [100, 78], [140, 84]) + quad([58, 118], [100, 130], [142, 112]), undefined, 3);
    b.r('ring-front', ellipseBand(100, 100, 82, 23, 58, 13, -14, true), 'yellow');
    b.r('earth', circle(532, 504, 44), 'blue');
    b.r('land#', smooth([[506, 478], [534, 470], [552, 486], [534, 502], [514, 498]]), 'green');
    b.r('land#', smooth([[532, 520], [560, 508], [570, 526], [548, 540]]), 'green');
    // Stars and a comet.
    const stars: [number, number, number][] = [
      [226, 52, 19],
      [196, 170, 15],
      [560, 66, 19],
      [36, 300, 16],
      [562, 372, 16],
      [430, 560, 15],
      [548, 190, 14],
      [330, 34, 13],
    ];
    for (const [x, y, r] of stars) b.r('star#', softStar(x, y, r, r * 0.55), 'yellow');
    b.r('comet-tail', smooth([[124, 232], [60, 196], [76, 216], [52, 226], [118, 256]], true, 0.5), 'sky');
    b.r('comet', circle(132, 246, 16), 'yellow');
    // The Moon, with a sleepy smile and Ziggy's flag.
    b.d(line([238, 396], [238, 318]), undefined, 5);
    b.r('flag', smooth([[238, 318], [294, 324], [284, 340], [294, 358], [238, 354]], true, 0.3), 'red');
    b.r('flag-heart', heart(262, 338, 24), 'yellow');
    b.r('moon', circle(100, 600, 250), 'cream');
    b.r('crater#', circle(40, 412, 22), 'sand');
    b.r('crater#', circle(262, 484, 20), 'sand');
    b.r('crater#', circle(236, 566, 26), 'sand');
    b.r('crater#', circle(40, 566, 18), 'sand');
    b.r('moon-cheek-left', circle(88, 498, 14), 'pink');
    b.r('moon-cheek-right', circle(204, 498, 14), 'pink');
    b.d(happyEye(112, 474, 14) + happyEye(180, 474, 14), undefined, 5);
    b.d(smile(146, 504, 46, 16), undefined, 5);

    drawZiggy(b, { x: 396, y: 206, k: 0.62 }, { space: true, suit: 'white', limbs: 'white', hands: 'grey', boots: 'grey', armLeft: [134, 250], armRight: [482, 250] });
  }
);

/** 2. The solar system: the Sun and its smiling planets. */
export const solarSystem = definePage(
  { id: 'solar-system', theme: 'espace', title: { fr: 'Le Soleil et les planètes', en: 'The Sun and the planets' }, emoji: '🪐', level: 2 },
  (b) => {
    const S: P = [-40, 300];
    b.r('space', rect(0, 0, 600, 600), 'navy');
    for (const R of [230, 270, 315, 360, 435, 500, 562, 610]) b.deco(arc(S[0], S[1], R, -75, 75), undefined, 2);
    const stars: [number, number, number][] = [
      [40, 50, 15],
      [236, 44, 14],
      [470, 36, 15],
      [578, 128, 13],
      [420, 272, 13],
      [576, 334, 14],
      [44, 562, 15],
      [196, 552, 14],
      [380, 566, 15],
      [214, 336, 12],
    ];
    for (const [x, y, r] of stars) b.r('star#', softStar(x, y, r, r * 0.55), 'yellow');
    // The Sun.
    for (let a = -64; a <= 64; a += 16) b.r('sun-ray#', poly([polar(S[0], S[1], 150, a - 6.5), polar(S[0], S[1], 212, a), polar(S[0], S[1], 150, a + 6.5)]), 'orange');
    b.r('sun', circle(S[0], S[1], 172), 'yellow');
    b.r('sun-cheek-left', circle(14, 320, 15), 'pink');
    b.r('sun-cheek-right', circle(104, 320, 15), 'pink');
    inkEye(b, 30, 276, 10);
    inkEye(b, 88, 276, 10);
    b.d(smile(59, 318, 50, 20), undefined, 5);

    const at = (R: number, deg: number) => polar(S[0], S[1], R, deg);
    // Mercury, Venus, the Earth and its Moon, Mars.
    const [mx, my] = at(230, -30);
    b.r('mercury', circle(mx, my, 19), 'grey');
    face(b, mx, my, 19);
    const [vx, vy] = at(270, 30);
    b.r('venus', circle(vx, vy, 26), 'orange');
    face(b, vx, vy, 26);
    const [ex, ey] = at(315, -6);
    b.r('earth', circle(ex, ey, 34), 'blue');
    b.r('earth-land#', smooth([[ex - 25, ey - 12], [ex - 16, ey - 26], [ex - 1, ey - 25], [ex + 2, ey - 15], [ex - 13, ey - 10]]), 'green');
    b.r('earth-land#', smooth([[ex + 6, ey + 18], [ex + 21, ey + 6], [ex + 25, ey + 18], [ex + 12, ey + 27]]), 'green');
    face(b, ex, ey, 30);
    b.r('earth-moon', circle(ex + 48, ey - 34, 12), 'grey');
    const [rx, ry] = at(360, 22);
    b.r('mars', circle(rx, ry, 26), 'red');
    face(b, rx, ry, 26);
    // Jupiter and its stripes.
    const [jx, jy] = at(435, -25);
    b.r('jupiter', circle(jx, jy, 64), 'sand');
    b.r('jupiter-stripe#', circleBand(jx, jy, 64, jy - 52, jy - 32), 'caramel');
    b.r('jupiter-stripe#', circleBand(jx, jy, 64, jy + 34, jy + 52), 'caramel');
    b.r('jupiter-cheek-left', circle(jx - 36, jy + 14, 10), 'pink');
    b.r('jupiter-cheek-right', circle(jx + 36, jy + 14, 10), 'pink');
    face(b, jx, jy, 52);
    // Saturn and its ring.
    const [sx, sy] = at(500, 12);
    b.r('saturn-ring-back', ellipseBand(sx, sy, 92, 26, 64, 15, -12, false), 'orange');
    b.r('saturn', circle(sx, sy, 44), 'yellow');
    face(b, sx, sy - 9, 36);
    b.r('saturn-ring-front', ellipseBand(sx, sy, 92, 26, 64, 15, -12, true), 'orange');
    // Uranus and Neptune.
    const [ux, uy] = at(562, -8);
    b.r('uranus', circle(ux, uy, 34), 'turquoise');
    face(b, ux, uy, 34);
    const [nx, ny] = at(610, 20);
    b.r('neptune', circle(nx, ny, 34), 'sky');
    face(b, nx, ny, 34);
    // A comet.
    b.r('comet-tail', smooth([[190, 108], [256, 78], [246, 96], [268, 104], [196, 126]], true, 0.5), 'lavender');
    b.r('comet', circle(184, 118, 14), 'white');
  }
);

/** 3. A kind dragon blowing soap bubbles. */
export const bubbleDragon = definePage(
  { id: 'bubble-dragon', theme: 'fees', title: { fr: 'Le gentil dragon et ses bulles', en: 'The kind dragon and its bubbles' }, emoji: '🐉', level: 2 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('sun', circle(64, 64, 38), 'yellow');
    b.deco(rays(64, 64, 50, 66), undefined, 5);
    b.r('cloud#', cloud(214, 64, 140, 54), 'white');
    b.r('hill-back', hill(0, 446, [170, 380], 600, 430, 600), 'mint');
    b.r('ground', hill(0, 520, [300, 492], 600, 516, 600), 'lime');
    groundFlower(b, 420, 562, 20, 'pink', 5);
    groundFlower(b, 540, 546, 22, 'purple', 6);
    groundFlower(b, 60, 570, 16, 'red', 5);
    tufts(b, [[350, 540], [478, 586], [26, 528], [574, 500]], 8);

    // Tail with a heart tip, wings behind the body.
    b.r('tail', smooth([[150, 488], [100, 500], [62, 476], [50, 432], [72, 412], [86, 442], [112, 462], [148, 454]]), 'green');
    b.r('tail-tip', heart(60, 398, 38), 'orange');
    // Bat-like wings: a curved top edge and three soft scallops below.
    const wing = (m: (p: P) => P) => {
      const q = (c: P, e: P) => `Q${xy(m(c))} ${xy(m(e))}`;
      return `M${xy(m([300, 386]))}Q${xy(m([326, 290]))} ${xy(m([430, 246]))}${q([400, 282], [398, 314])}${q([374, 318], [364, 352])}${q([338, 358], [318, 396])}Z`;
    };
    const fingers = (m: (p: P) => P) => quad(m([306, 380]), m([346, 330]), m([398, 314])) + quad(m([310, 386]), m([336, 362]), m([364, 352]));
    const id = (p: P): P => p;
    const flip = (p: P): P => [460 - p[0], p[1]];
    b.r('wing-right', wing(id), 'pink');
    b.deco(fingers(id), undefined, 3);
    b.r('wing-left', wing(flip), 'pink');
    b.deco(fingers(flip), undefined, 3);

    // Round body, belly, arms and feet.
    b.r('body', ellipse(230, 432, 100, 100), 'green');
    b.r('belly', ellipse(230, 452, 62, 70), 'cream');
    b.deco(quad([176, 422], [230, 436], [284, 422]) + quad([170, 452], [230, 468], [290, 452]) + quad([178, 484], [230, 500], [282, 484]), undefined, 3);
    b.r('arm-left', ellipse(142, 420, 18, 34, 24), 'green');
    b.r('arm-right', ellipse(318, 420, 18, 34, -24), 'green');
    b.r('foot-left', ellipse(174, 524, 42, 22), 'green');
    b.deco('M156 516V530M174 514V532M192 516V530', undefined, 3);
    b.r('foot-right', ellipse(286, 524, 42, 22), 'green');
    b.deco('M268 516V530M286 514V532M304 516V530', undefined, 3);

    // Head: horns, spikes, snout, blowing mouth.
    b.r('horn-left', smooth([[176, 206], [150, 146], [206, 184]], true, 0.3), 'yellow');
    b.r('horn-right', smooth([[284, 206], [310, 146], [254, 184]], true, 0.3), 'yellow');
    b.r('spike#', poly([[204, 182], [218, 150], [232, 178]]), 'orange');
    b.r('spike#', poly([[228, 178], [244, 146], [258, 182]]), 'orange');
    b.r('head', circle(230, 264, 90), 'green');
    b.r('cheek-left', circle(162, 292, 14), 'pink');
    b.r('cheek-right', circle(298, 292, 14), 'pink');
    b.r('snout', ellipse(230, 304, 54, 34), 'cream');
    b.deco('M212 294h0.1M248 294h0.1', undefined, 8);
    b.r('mouth', circle(252, 324, 11), 'raspberry');
    inkEye(b, 196, 248, 13);
    inkEye(b, 264, 248, 13);
    b.d(quad([180, 222], [194, 212], [210, 220]) + quad([250, 220], [266, 212], [280, 222]), undefined, 4);

    // The bubbles, each with a little shine.
    const bubbles: [number, number, number, string][] = [
      [306, 336, 13, 'lavender'],
      [340, 290, 19, 'sky'],
      [374, 222, 26, 'pink'],
      [448, 168, 38, 'lavender'],
      [532, 96, 32, 'sky'],
      [418, 78, 20, 'pink'],
      [540, 226, 24, 'mint'],
      [492, 300, 17, 'lavender'],
      [348, 136, 15, 'mint'],
      [560, 372, 15, 'pink'],
    ];
    for (const [x, y, r, c] of bubbles) {
      b.r('bubble#', circle(x, y, r), c);
      b.deco(arc(x, y, r * 0.62, 196, 250), undefined, r1(Math.max(2.5, r * 0.12)));
    }
  }
);

/** 4. The little mermaid sitting on her rock. */
export const mermaid = definePage(
  { id: 'mermaid', theme: 'fees', title: { fr: 'La petite sirène et son rocher', en: 'The little mermaid and her rock' }, emoji: '🧜‍♀️', level: 2 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('sun', circle(522, 76, 40), 'yellow');
    b.deco(rays(522, 76, 52, 68), undefined, 5);
    b.r('cloud#', cloud(110, 80, 150, 58), 'white');
    b.r('cloud#', cloud(420, 176, 110, 44), 'white');
    b.d('M120 190q12 -12 24 0q12 -12 24 0M460 260q10 -10 20 0q10 -10 20 0', undefined, 3.5);
    b.r('sea', waveTop(0, 300, 600, 300, 7, 4), 'turquoise');
    b.deco('M40 340q20 -8 40 0M470 330q20 -8 40 0M520 400q20 -8 40 0M30 450q20 -8 40 0', undefined, 3);

    // A jumping fish and the seaweed behind the rock.
    fish(b, 76, 262, 32, 'orange', 'yellow', 1, -30);
    b.d('M40 318q-8 -10 0 -20M120 304q10 -8 18 0', undefined, 3);
    b.r('seaweed#', leaf([104, 490], [74, 330], 20), 'green');
    b.r('seaweed#', leaf([126, 470], [160, 340], 18), 'forest');

    // The rock.
    b.r('rock', blob([[150, 472, 80], [262, 424, 112], [384, 456, 90], [474, 514, 60]], 600), 'grey');
    b.deco('M200 520q14 -20 4 -40M330 520q-10 -26 8 -44M420 530q12 -16 4 -32', undefined, 3);
    b.r('starfish', softStar(142, 478, 26, 12), 'orange');
    b.deco(circle(142, 478, 3), 'ink');

    // Mermaid: hair, tail and fin, body, arms, face.
    b.r('hair-back', smooth([[270, 134], [330, 150], [350, 220], [352, 290], [376, 344], [328, 340], [300, 304], [240, 304], [212, 340], [164, 344], [188, 290], [190, 220], [210, 150]]), 'raspberry');
    b.r('tail', smooth([[234, 332], [306, 332], [334, 368], [376, 400], [420, 428], [436, 448], [420, 462], [362, 450], [304, 426], [250, 402], [226, 368]], true, 0.8), 'turquoise');
    b.deco('M260 360q12 10 24 0M290 380q12 10 24 0M320 398q12 10 24 0M352 414q12 10 24 0M384 428q12 10 24 0M254 386q10 8 20 2', undefined, 3);
    b.r('fin-top', petal(428, 448, 0, 74, -38, 24), 'purple');
    b.deco(quad([440, 440], [462, 420], [480, 404]), undefined, 3);
    b.r('fin-bottom', petal(428, 448, 0, 74, 28, 24), 'purple');
    b.deco(quad([442, 456], [466, 468], [488, 480]), undefined, 3);
    b.r('waist', smooth([[232, 324], [308, 324], [312, 344], [270, 352], [228, 344]], true, 0.6), 'mint');
    b.r('torso', smooth([[250, 256], [290, 256], [302, 292], [304, 330], [236, 330], [238, 292]], true, 0.8), 'peach');
    b.r('shell-left', ellipse(257, 292, 15, 12), 'purple');
    b.deco('M257 284V302M249 288L253 302M265 288L261 302', undefined, 2.5);
    b.r('shell-right', ellipse(285, 292, 15, 12), 'purple');
    b.deco('M285 284V302M277 288L281 302M293 288L289 302', undefined, 2.5);
    b.r('arm-left', capsule(246, 268, 210, 330, 18), 'peach');
    b.r('hand-left', circle(208, 334, 12), 'peach');
    b.r('arm-right', capsule(294, 268, 336, 224, 18), 'peach');
    b.r('hand-right', circle(340, 218, 12), 'peach');
    b.r('neck', rect(260, 232, 20, 32, 6), 'peach');
    b.r('face', circle(270, 196, 48), 'peach');
    b.r('fringe', 'M222 202C212 128 328 128 318 202Q306 170 290 176Q276 150 262 174Q246 164 234 180Q226 188 222 202Z', 'raspberry');
    b.r('hair-star', softStar(230, 160, 17, 8), 'yellow');
    b.r('cheek-left', circle(246, 214, 8.5), 'pink');
    b.r('cheek-right', circle(294, 214, 8.5), 'pink');
    inkEye(b, 255, 197, 6.5);
    inkEye(b, 285, 197, 6.5);
    b.d('M248 186L243 182M247 192L241 190M292 186L297 182M293 192L299 190', undefined, 2.5);
    b.d(smile(270, 216, 18, 8), undefined, 4);

    // Front waves, a shell and bubbles.
    b.r('wave', waveTop(0, 508, 600, 92, 9, 3, 1), 'blue');
    b.deco('M60 548q20 -8 40 0M300 560q20 -8 40 0M480 540q20 -8 40 0', undefined, 3);
    b.r('shell', 'M330 484L306 456A30 30 0 0 1 354 456Z', 'pink');
    b.deco('M330 484L318 446M330 484V442M330 484L342 446', undefined, 2.5);
    b.r('bubble#', circle(560, 440, 12), 'white');
    b.r('bubble#', circle(536, 402, 8), 'white');
    b.r('bubble#', circle(570, 560, 10), 'white');
  }
);

/** 5. A cheerful pirate ship sailing to the treasure island. */
export const pirateShip = definePage(
  { id: 'pirate-ship', theme: 'vehicules', title: { fr: "Le bateau pirate et l'île au trésor", en: 'The pirate ship and the treasure island' }, emoji: '⛵', level: 3 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('sun', circle(530, 70, 34), 'yellow');
    for (let i = 0; i < 8; i++) {
      const a = i * 45 + 22;
      b.r('sun-ray#', poly([polar(530, 70, 44, a - 9), polar(530, 70, 64, a), polar(530, 70, 44, a + 9)]), i % 2 ? 'orange' : 'yellow');
    }
    b.r('cloud#', cloud(376, 70, 130, 50), 'white');
    b.r('cloud#', cloud(84, 150, 120, 46), 'white');
    b.d('M330 170q10 -10 20 0q10 -10 20 0M420 210q8 -8 16 0q8 -8 16 0', undefined, 3);

    // Treasure island: palm tree and an open chest of coins.
    b.r('island', smooth([[420, 476], [450, 418], [510, 390], [580, 386], [640, 404], [640, 476]], true, 0.7), 'sand');
    b.r('palm-trunk', smooth([[562, 400], [582, 400], [574, 330], [556, 262], [540, 264], [558, 330]], true, 0.6), 'brown');
    b.deco('M558 366h20M552 334h18M546 302h16', undefined, 3);
    const top: P = [550, 258];
    const fronds: [P, string][] = [
      [[474, 264], 'green'],
      [[492, 208], 'forest'],
      [[552, 188], 'green'],
      [[604, 212], 'forest'],
      [[620, 266], 'green'],
    ];
    for (const [tip, c] of fronds) b.r('palm-leaf#', leaf(top, tip, 19), c);
    b.r('coconut#', circle(538, 272, 11), 'caramel');
    b.r('coconut#', circle(561, 274, 11), 'caramel');
    b.r('chest-lid', poly([[464, 386], [532, 386], [542, 352], [472, 346]]), 'caramel');
    for (const [x, y] of [[480, 380], [498, 374], [516, 376], [490, 388], [510, 388]] as P[]) b.r('coin#', circle(x, y, 10), 'gold');
    b.r('chest', rect(460, 386, 76, 44, 6), 'brown');
    b.r('chest-band', rect(460, 400, 76, 12), 'yellow');
    b.r('chest-lock', rect(490, 396, 16, 20, 4), 'orange');

    // The sea behind the ship.
    b.r('sea', waveTop(0, 446, 600, 154, 7, 5), 'blue');

    // Ship: jib and bowsprit, mast, flag, crow's nest with Ziggy, striped sails, hull.
    b.r('bowsprit', capsule(370, 398, 436, 356, 11), 'brown');
    b.r('jib', poly([[232, 104], [428, 356], [330, 368]]), 'white');
    b.r('mast', rect(208, 36, 16, 364, 4), 'brown');
    b.r('flag', smooth([[224, 30], [292, 40], [280, 54], [294, 70], [224, 76]], true, 0.3), 'purple');
    b.r('flag-heart', heart(250, 54, 26), 'red');
    b.r('ziggy-head', circle(216, 90, 21), 'green');
    b.deco('M204 74L194 60M228 74L238 60', undefined, 3.5);
    b.deco(circle(193, 58, 5) + circle(239, 58, 5), 'ink');
    inkEye(b, 208, 88, 3.6);
    inkEye(b, 224, 88, 3.6);
    b.d(smile(216, 97, 12, 4), undefined, 2.5);
    b.r('crows-nest', rect(186, 98, 60, 24, 6), 'caramel');
    b.deco('M200 98V122M216 98V122M232 98V122', undefined, 2.5);
    sail(b, 'top-sail', 162, 270, 132, 178, 14, ['white', 'red', 'white']);
    sail(b, 'main-sail', 124, 308, 194, 336, 22, ['red', 'white', 'red', 'white']);
    b.d('M224 40L50 372M224 40L392 370', undefined, 2.5);
    b.r('cabin', rect(56, 328, 96, 70, 8), 'caramel');
    b.r('cabin-window#', rect(70, 342, 26, 24, 5), 'yellow');
    b.r('cabin-window#', rect(110, 342, 26, 24, 5), 'yellow');
    b.r('hull', 'M44 372L128 396L364 396L400 366Q390 456 334 490L112 490Q60 462 44 372Z', 'brown');
    b.deco('M128 396L132 410L364 410L392 382', undefined, 3);
    b.r('hull-stripe', poly([[64, 428], [384, 428], [378, 446], [68, 446]]), 'yellow');
    for (const x of [140, 200, 260, 320]) b.r('porthole#', circle(x, 466, 11), 'sky');
    b.r('lifebuoy', circle(96, 418, 18), 'red');
    b.r('lifebuoy-hole', circle(96, 418, 8), 'white');

    // Waves in front, fish and a seagull.
    b.r('wave#', waveTop(0, 492, 600, 108, 9, 5), 'turquoise');
    b.deco('M30 520q16 -10 32 0M200 530q16 -10 32 0M420 520q16 -10 32 0', undefined, 3);
    b.r('wave#', waveTop(0, 556, 600, 44, 7, 4, 2), 'blue');
    fish(b, 518, 500, 24, 'orange', 'yellow', -1, 30);
    b.r('splash#', circle(552, 528, 7), 'white');
    b.r('splash#', circle(488, 532, 6), 'white');
    for (const [x, y] of [[90, 574], [300, 580], [440, 572]] as P[]) b.r('bubble#', circle(x, y, 8), 'white');
  }
);

/** 6. The fire truck, with Ziggy at the wheel. */
export const fireTruck = definePage(
  { id: 'fire-truck', theme: 'vehicules', title: { fr: 'Le camion de pompiers', en: 'The fire truck' }, emoji: '🚒', level: 1 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('sun', circle(76, 74, 40), 'yellow');
    b.deco(rays(76, 74, 52, 70), undefined, 5);
    b.r('cloud#', cloud(300, 78, 150, 58), 'white');
    b.r('cloud#', cloud(510, 112, 120, 48), 'white');
    b.r('hill', hill(0, 360, [300, 290], 600, 356, 600), 'green');
    b.r('road', rect(0, 470, 600, 130), 'grey');
    b.d(rect(20, 572, 80, 12, 6) + rect(200, 572, 80, 12, 6) + rect(380, 572, 80, 12, 6) + rect(560, 572, 80, 12, 6), undefined, 4);

    // Truck (shifted down onto the road).
    const Y = 36;
    b.r('ladder', rect(96, 166 + Y, 314, 38, 12), 'white');
    let rungs = '';
    for (let x = 124; x < 400; x += 30) rungs += `M${x} ${168 + Y}V${202 + Y}`;
    b.deco(rungs, undefined, 4);
    b.r('siren', rect(424, 200 + Y, 54, 34, 13), 'blue');
    b.r('body', rect(46, 204 + Y, 360, 216, 24), 'red');
    b.r('hose-reel', circle(144, 300 + Y, 56), 'yellow');
    b.deco(circle(144, 300 + Y, 38) + circle(144, 300 + Y, 20), undefined, 4);
    b.deco(circle(144, 300 + Y, 7), 'ink');
    b.r('locker', rect(232, 232 + Y, 140, 124, 16), 'orange');
    b.deco(`M302 ${238 + Y}V${350 + Y}M280 ${296 + Y}H292M312 ${296 + Y}H324`, undefined, 4);
    b.r('cab', `M400 ${230 + Y}H470Q498 ${230 + Y} 512 ${256 + Y}L552 ${330 + Y}Q566 ${350 + Y} 566 ${374 + Y}V${420 + Y}H400Z`, 'red');
    b.r('window', `M418 ${250 + Y}H466Q482 ${250 + Y} 490 ${266 + Y}L520 ${326 + Y}H418Z`, 'sky');
    b.r('ziggy', circle(462, 296 + Y, 27), 'green');
    b.deco(line([450, 272 + Y], [442, 256 + Y]) + line([474, 272 + Y], [482, 256 + Y]), undefined, 4);
    b.deco(circle(442, 254 + Y, 5) + circle(482, 254 + Y, 5), 'ink');
    inkEye(b, 453, 292 + Y, 4.5);
    inkEye(b, 471, 292 + Y, 4.5);
    b.d(smile(462, 304 + Y, 14, 6), undefined, 3);
    b.r('stripe', rect(46, 370 + Y, 520, 26), 'white');
    b.r('headlight', ellipse(546, 346 + Y, 15, 19), 'yellow');
    b.r('bumper', rect(516, 408 + Y, 72, 26, 13), 'grey');
    for (const x of [150, 466]) {
      b.r('wheel#', circle(x, 446 + Y, 56), 'black');
      b.r('rim#', circle(x, 446 + Y, 26), 'grey');
      b.deco(circle(x, 446 + Y, 7), 'ink');
    }
  }
);

/** 7. Ziggy's hot-air balloon above the hills. */
export const hotAirBalloon = definePage(
  { id: 'hot-air-balloon', theme: 'vehicules', title: { fr: 'La montgolfière au-dessus des collines', en: 'The hot-air balloon above the hills' }, emoji: '🎈', level: 1 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('sun', circle(522, 74, 40), 'yellow');
    b.deco(rays(522, 74, 52, 70), undefined, 5);
    b.r('cloud#', cloud(92, 96, 140, 56), 'white');
    b.r('cloud#', cloud(510, 236, 130, 50), 'white');
    b.r('cloud#', cloud(86, 330, 120, 46), 'white');
    b.d('M420 330q10 -10 20 0q10 -10 20 0M150 210q8 -8 16 0q8 -8 16 0', undefined, 3.5);
    b.r('hill-back-2', hill(150, 560, [470, 400], 600, 460, 600), 'mint');
    b.r('hill-back', hill(0, 480, [130, 420], 600, 590, 600), 'green');
    b.r('hill', hill(0, 560, [300, 520], 600, 556, 600), 'lime');
    for (const [x, y] of [[70, 452], [530, 444]] as P[]) {
      b.r('tree-trunk#', rect(x - 10, y + 10, 20, 62, 5), 'brown');
      b.r('tree#', ellipse(x, y, 34, 40), 'forest');
    }
    tufts(b, [[60, 590], [250, 580], [420, 594], [560, 584]], 9);

    // Envelope: five gores between curved seams.
    const cx = 300;
    const cy = 156;
    const R = 124;
    const bottom = 330;
    const hw = (y: number) => (y <= cy ? Math.sqrt(Math.max(0, R * R - (cy - y) ** 2)) : 44 + (R - 44) * Math.cos(((y - cy) / (bottom - cy)) * (Math.PI / 2)));
    const ys: number[] = [];
    for (let i = 0; i <= 16; i++) ys.push(cy - R * Math.cos(((i / 16) * Math.PI) / 2));
    for (let i = 1; i <= 14; i++) ys.push(cy + ((bottom - cy) * i) / 14);
    const seam = (u: number) => ys.map((y) => [cx + hw(y) * Math.sin((u * Math.PI) / 2), y] as P);
    const colors = ['red', 'yellow', 'red', 'yellow', 'red'];
    colors.forEach((c, i) => {
      const left = seam(-1 + (2 * i) / 5);
      const right = seam(-1 + (2 * (i + 1)) / 5).reverse();
      b.r('gore#', poly([...left, ...right]), c);
    });
    b.r('skirt', poly([[250, 326], [350, 326], [334, 356], [266, 356]]), 'purple');
    b.d('M268 356L242 420M332 356L358 420', undefined, 3.5);
    // Ziggy waves from the basket.
    b.r('ziggy', circle(300, 398, 30), 'green');
    b.deco('M288 372L280 362M312 372L320 362', undefined, 4);
    b.deco(circle(279, 360, 5.5) + circle(321, 360, 5.5), 'ink');
    inkEye(b, 290, 392, 5);
    inkEye(b, 310, 392, 5);
    b.d(smile(300, 404, 14, 5), undefined, 3);
    b.r('basket', rect(242, 424, 116, 62, 10), 'caramel');
    b.deco('M242 446H358M242 466H358M280 424V486M320 424V486', undefined, 3);
    b.r('basket-rim', rect(232, 414, 136, 20, 10), 'brown');
    // Another balloon, far away.
    b.r('far-balloon', smooth([[470, 330], [500, 344], [500, 380], [478, 404], [462, 404], [440, 380], [440, 344]], true, 0.9), 'purple');
    b.d('M462 404L464 420M478 404L476 420', undefined, 2.5);
    b.r('far-basket', rect(454, 418, 32, 22, 5), 'caramel');
  }
);

/** 8. The tractor at the farm, with Ziggy driving. */
export const tractor = definePage(
  { id: 'tractor', theme: 'vehicules', title: { fr: 'Le tracteur à la ferme', en: 'The tractor at the farm' }, emoji: '🚜', level: 1 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('sun', circle(76, 72, 38), 'yellow');
    b.deco(rays(76, 72, 50, 66), undefined, 5);
    b.r('cloud#', cloud(300, 70, 150, 56), 'white');
    b.r('hill', hill(0, 350, [220, 280], 600, 340, 600), 'green');
    // Barn.
    b.r('barn-roof', poly([[14, 244], [106, 160], [198, 244]]), 'brown');
    b.r('barn', rect(30, 236, 152, 150), 'red');
    b.r('barn-door', rect(72, 300, 68, 86, 4), 'white');
    b.deco('M72 300L140 386M140 300L72 386', undefined, 4);
    b.r('field', rect(0, 384, 600, 216), 'lime');
    b.deco('M0 420Q300 404 600 420M0 470Q300 452 600 470M0 530Q300 512 600 530', undefined, 3);
    // Tractor.
    b.r('smoke#', cloud(492, 82, 70, 34), 'white');
    b.r('smoke#', cloud(468, 130, 80, 40), 'white');
    b.r('exhaust', rect(454, 150, 20, 130, 7), 'grey');
    b.r('hood', rect(330, 270, 222, 122, 24), 'green');
    b.deco('M520 294V368M500 294V368', undefined, 4);
    b.r('headlight', circle(552, 318, 17), 'yellow');
    b.r('cab', rect(198, 160, 152, 232, 18), 'red');
    b.r('window', rect(220, 182, 108, 104, 14), 'sky');
    b.r('ziggy', circle(274, 250, 32), 'green');
    b.deco('M260 224L250 204M288 224L298 204', undefined, 4);
    b.deco(circle(249, 202, 5.5) + circle(299, 202, 5.5), 'ink');
    inkEye(b, 264, 246, 5);
    inkEye(b, 284, 246, 5);
    b.d(smile(274, 260, 16, 6), undefined, 3.5);
    const treads = (cx: number, cy: number, r: number, n: number) => {
      let d = '';
      for (let i = 0; i < n; i++) d += line(polar(cx, cy, r - 12, (i * 360) / n), polar(cx, cy, r, (i * 360) / n));
      return d;
    };
    b.r('wheel-big', circle(252, 444, 96), 'black');
    b.deco(treads(252, 444, 96, 20), undefined, 4);
    b.r('rim-big', circle(252, 444, 46), 'yellow');
    b.deco(circle(252, 444, 12), 'ink');
    b.r('mudguard', ringSegment(252, 444, 96, 118, 196, 344), 'green');
    b.r('wheel-small', circle(480, 470, 64), 'black');
    b.deco(treads(480, 470, 64, 14), undefined, 4);
    b.r('rim-small', circle(480, 470, 30), 'yellow');
    b.deco(circle(480, 470, 9), 'ink');
  }
);

/** 9. Ziggy the pastry chef and the big birthday cake. */
export const ziggyBaker = definePage(
  { id: 'ziggy-baker', theme: 'fees', title: { fr: "Ziggy pâtissier et le gâteau d'anniversaire", en: 'Ziggy the baker and the birthday cake' }, emoji: '🎂', level: 2 },
  (b) => {
    b.r('wall', rect(0, 0, 600, 600), 'lavender');
    // Bunting.
    b.d('M0 40Q300 180 600 40', undefined, 3);
    const flags = ['red', 'yellow', 'blue', 'green', 'pink', 'orange'];
    for (let i = 0; i < 10; i++) {
      const x = 30 + i * 60;
      const t = x / 600;
      const y = 40 + 140 * t * (1 - t);
      b.r('bunting#', poly([[x - 24, y], [x + 24, y], [x, y + 44]]), flags[i % flags.length]);
    }
    // Balloons.
    b.d('M64 242Q50 290 40 340M548 222Q560 260 572 300', undefined, 3);
    b.r('balloon#', ellipse(64, 200, 34, 42), 'red');
    b.deco(arc(64, 200, 24, 200, 250), undefined, 4);
    b.r('balloon#', ellipse(548, 182, 30, 38), 'blue');
    b.deco(arc(548, 182, 21, 200, 250), undefined, 4);
    b.r('floor', rect(0, 480, 600, 120), 'sand');
    b.deco('M0 520H300M0 562H300', undefined, 3);

    // Table and the three-tier cake.
    b.r('tablecloth', rect(276, 420, 340, 200, 10), 'sky');
    b.deco('M330 436V600M400 436V600M470 436V600M540 436V600', undefined, 3);
    b.r('plate', ellipse(430, 420, 150, 16), 'white');
    b.r('tier-1', rect(310, 320, 240, 96, 18), 'pink');
    b.r('frosting-1', frosting(310, 320, 240, 20, 6, 18), 'white');
    for (const x of [350, 430, 510]) b.r('cake-heart#', heart(x, 380, 30), 'red');
    b.r('tier-2', rect(340, 240, 180, 86, 16), 'cream');
    b.r('frosting-2', frosting(340, 240, 180, 18, 5, 16), 'raspberry');
    for (const x of [376, 430, 484]) b.r('cherry#', circle(x, 298, 12), 'red');
    b.r('tier-3', rect(370, 174, 120, 72, 14), 'pink');
    b.r('frosting-3', frosting(370, 174, 120, 16, 4, 14), 'white');
    const candles: [number, string][] = [
      [396, 'blue'],
      [430, 'yellow'],
      [464, 'green'],
    ];
    for (const [x, c] of candles) {
      b.r('candle#', rect(x - 9, 126, 18, 50, 5), c);
      b.deco(`M${x - 9} 146L${x + 9} 136M${x - 9} 164L${x + 9} 154`, undefined, 3);
      b.r('flame#', smooth([[x, 84], [x + 12, 106], [x + 8, 120], [x - 8, 120], [x - 12, 106]], true, 0.8), 'orange');
    }
    // Present on the floor.
    b.r('present', rect(14, 504, 86, 70, 6), 'blue');
    b.r('present-ribbon', rect(48, 504, 18, 70), 'yellow');
    b.r('present-bow#', ellipse(44, 496, 16, 10, -20), 'yellow');
    b.r('present-bow#', ellipse(70, 496, 16, 10, 20), 'yellow');

    // Ziggy the pastry chef with his wooden spoon.
    drawZiggy(
      b,
      { x: 166, y: 286, k: 0.6 },
      {
        chef: true,
        armLeft: [176, 432],
        armRight: [448, 262],
        hold: (bb, [hx, hy], deg) => {
          // A wooden spoon held up in the mitten (fingers direction = ux, uy).
          const ux = Math.sin((deg * Math.PI) / 180);
          const uy = -Math.cos((deg * Math.PI) / 180);
          bb.r('spoon-handle', capsule(hx, hy, hx + ux * 64, hy + uy * 64, 11), 'caramel');
          bb.r('spoon', ellipse(hx + ux * 82, hy + uy * 82, 15, 22, deg + 90), 'caramel');
        },
      }
    );
  }
);

/** 10. A star mandala for older children: many small zones. */
export const mandalaStar = definePage(
  { id: 'mandala-star', theme: 'zen', title: { fr: 'Le mandala étoile', en: 'The star mandala' }, emoji: '⭐', level: 3 },
  (b) => {
    const C = 300;
    const at = (r: number, deg: number) => polar(C, C, r, deg);
    b.r('background', rect(0, 0, 600, 600), 'cream');
    [
      [54, 54],
      [546, 54],
      [54, 546],
      [546, 546],
    ].forEach(([x, y], i) => {
      b.r('corner-star#', softStar(x, y, 40, 18, 5), ['pink', 'sky', 'mint', 'lavender'][i]);
      b.r('corner-dot#', circle(x, y, 9), 'yellow');
    });
    // Small star points between the big ones (behind), each in two halves.
    for (let i = 0; i < 8; i++) {
      const a = i * 45 - 90 + 22.5;
      b.r('mid-point#', poly([at(140, a), at(150, a - 13), at(232, a)]), 'turquoise');
      b.r('mid-point#', poly([at(140, a), at(232, a), at(150, a + 13)]), 'mint');
    }
    // Eight big star points, each in two halves (light and shade).
    for (let i = 0; i < 8; i++) {
      const a = i * 45 - 90;
      b.r('big-point#', poly([at(130, a), at(160, a - 17), at(288, a)]), 'purple');
      b.r('big-point#', poly([at(130, a), at(288, a), at(160, a + 17)]), 'lavender');
      b.r('point-dot#', circle(...at(196, a), 9), 'yellow');
    }
    for (let i = 0; i < 8; i++) b.r('outer-dot#', circle(...at(258, i * 45 - 90 + 22.5), 11), 'pink');
    // Ring of tiles.
    for (let i = 0; i < 16; i++) b.r('ring-tile#', ringSegment(C, C, 126, 150, i * 22.5 - 90, i * 22.5 - 67.5), i % 2 ? 'orange' : 'yellow');
    b.r('inner-disc', circle(C, C, 126), 'cream');
    // Eight-pointed inner star, each point in two halves, with dots in the gaps.
    for (let i = 0; i < 8; i++) {
      const a = i * 45 - 90;
      b.r('star-point#', poly([at(40, a), at(64, a - 22.5), at(120, a)]), 'red');
      b.r('star-point#', poly([at(40, a), at(120, a), at(64, a + 22.5)]), 'raspberry');
      b.r('gap-dot#', circle(...at(100, a + 22.5), 10), 'turquoise');
    }
    b.r('centre', circle(C, C, 52), 'pink');
    for (let i = 0; i < 5; i++) b.r('centre-petal#', petal(C, C, 14, 50, i * 72 - 90 + 36, 12), 'magenta');
    b.r('centre-star', softStar(C, C, 34, 16, 5), 'yellow');
    b.r('centre-dot', circle(C, C, 8), 'orange');
  }
);

export const MORE_ADVENTURES: ColoringPage[] = [ziggyAstronaut, solarSystem, bubbleDragon, mermaid, pirateShip, fireTruck, hotAirBalloon, tractor, ziggyBaker, mandalaStar];
