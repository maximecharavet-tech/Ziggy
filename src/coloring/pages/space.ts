import { circle, ellipseBand, mirrorX, poly, quad, rect, smooth, softStar, type P } from '../shapes';
import { definePage } from './build';
import { inkEye, smile } from './parts';

type Cubic = [P, P, P, P];
const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** First part of a cubic Bézier, cut at t (de Casteljau). */
function cubicHead([p0, p1, p2, p3]: Cubic, t: number): Cubic {
  const a = lerp(p0, p1, t);
  const b = lerp(p1, p2, t);
  const c = lerp(p2, p3, t);
  const d = lerp(a, b, t);
  const e = lerp(b, c, t);
  return [p0, a, d, lerp(d, e, t)];
}
function cubicAt([p0, p1, p2, p3]: Cubic, t: number): P {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}
/** x of the curve at height y (sampled). */
function xAtY(c: Cubic, y: number): number {
  let best = c[0];
  for (let i = 0; i <= 200; i++) {
    const p = cubicAt(c, i / 200);
    if (Math.abs(p[1] - y) < Math.abs(best[1] - y)) best = p;
  }
  return best[0];
}
const n = (v: number) => Math.round(v * 10) / 10;
const cub = (c: Cubic) => `C${n(c[1][0])} ${n(c[1][1])} ${n(c[2][0])} ${n(c[2][1])} ${n(c[3][0])} ${n(c[3][1])}`;

/** A rocket among the planets — with Ziggy at the window. */
export const rocket = definePage(
  { id: 'rocket', theme: 'espace', title: { fr: 'La fusée dans les étoiles', en: 'Rocket among the stars' }, emoji: '🚀', level: 1 },
  (b) => {
    b.r('space', rect(0, 0, 600, 600), 'navy');
    b.r('moon', circle(92, 100, 44), 'grey');
    b.deco(circle(78, 88, 9) + circle(108, 118, 12) + circle(100, 76, 5), undefined, 3);
    // Ringed planet
    b.r('ring-back', ellipseBand(484, 146, 100, 28, 72, 17, -16, false), 'yellow');
    b.r('planet', circle(484, 146, 54), 'orange');
    b.deco(quad([436, 124], [484, 112], [532, 120]) + quad([432, 166], [484, 182], [536, 162]), undefined, 3);
    b.r('ring-front', ellipseBand(484, 146, 100, 28, 72, 17, -16, true), 'yellow');
    // Big planet at the bottom
    b.r('planet-big', circle(84, 540, 130), 'purple');
    b.r('crater#', circle(60, 462, 20), 'lavender');
    b.r('crater#', circle(140, 520, 26), 'lavender');
    b.r('crater#', circle(44, 560, 15), 'lavender');
    // Comet
    b.r('comet-tail', poly([[512, 386], [440, 330], [452, 352], [428, 360], [504, 410]]), 'sky');
    b.r('comet', circle(520, 400, 18), 'yellow');
    const stars: [number, number, number][] = [[210, 56, 17], [560, 300, 18], [400, 470, 11], [150, 250, 15], [530, 520, 22], [384, 560, 12], [40, 300, 11], [300, 30, 10], [250, 180, 9]];
    for (const [x, y, r] of stars) b.r('star#', softStar(x, y, r, r * 0.45), 'yellow');

    // Rocket
    const right: Cubic = [[300, 92], [362, 150], [366, 262], [352, 380]];
    const left: Cubic = right.map(([x, y]) => [600 - x, y]) as Cubic;
    const fin: P[] = [[254, 290], [210, 346], [192, 404], [210, 422], [256, 392]];
    b.r('fin-left', smooth(fin, true, 0.5), 'red');
    b.r('fin-right', smooth(mirrorX(fin, 300), true, 0.5), 'red');
    b.r('flame', smooth([[268, 404], [332, 404], [344, 446], [320, 484], [300, 548], [280, 484], [256, 446]]), 'orange');
    b.r('flame-in', smooth([[284, 408], [316, 408], [324, 444], [300, 504], [276, 444]]), 'yellow');
    b.r('nozzle', poly([[262, 376], [338, 376], [326, 412], [274, 412]]), 'grey');
    b.r('body', `M300 92${cub(right)}L248 380C234 262 238 150 300 92Z`, 'white');
    const head = cubicHead(right, 0.3);
    const headL = cubicHead(left, 0.3);
    const tip = head[3];
    const tipL = headL[3];
    b.r('nose', `M300 92${cub(head)}Q300 ${n(tip[1] + 16)} ${n(tipL[0])} ${n(tipL[1])}C${n(headL[2][0])} ${n(headL[2][1])} ${n(headL[1][0])} ${n(headL[1][1])} 300 92Z`, 'red');
    const y0 = 312;
    const y1 = 338;
    b.r('stripe', `M${n(600 - xAtY(right, y0))} ${y0}Q300 ${y0 + 12} ${n(xAtY(right, y0))} ${y0}L${n(xAtY(right, y1))} ${y1}Q300 ${y1 + 12} ${n(600 - xAtY(right, y1))} ${y1}Z`, 'blue');
    b.r('window-frame', circle(300, 226, 42), 'grey');
    b.r('window', circle(300, 226, 30), 'sky');
    // Ziggy waves from the window
    b.r('ziggy-head', circle(300, 236, 17), 'green');
    b.deco('M292 222L286 210M308 222L314 210', undefined, 3);
    inkEye(b, 294, 234, 3.2);
    inkEye(b, 306, 234, 3.2);
    b.d(smile(300, 242, 10, 4), undefined, 2.5);
    b.d('M281 206Q290 199 300 199', 'white', 0);
    b.r('fin-middle', smooth([[294, 330], [306, 330], [310, 400], [300, 412], [290, 400]], true, 0.6), 'red');
    b.d('M216 470V510M384 470V516M240 520V548M360 524V552', undefined, 4);
  }
);

/** Ziggy's flying saucer friend: a cheerful planet and UFO. */
export const ufo = definePage(
  { id: 'ufo', theme: 'espace', title: { fr: 'La soucoupe volante', en: 'The flying saucer' }, emoji: '🛸', level: 1 },
  (b) => {
    b.r('space', rect(0, 0, 600, 600), 'navy');
    b.r('planet', circle(300, 760, 330), 'turquoise');
    b.r('crater#', circle(150, 520, 30), 'mint');
    b.r('crater#', circle(420, 490, 22), 'mint');
    b.r('crater#', circle(300, 560, 40), 'mint');
    b.r('beam', poly([[250, 330], [350, 330], [430, 470], [170, 470]]), 'yellow');
    b.r('dome', 'M220 250A80 80 0 0 1 380 250Z', 'sky');
    b.deco('M246 222Q262 196 292 188', undefined, 4);
    b.r('alien', circle(300, 238, 26), 'lime');
    inkEye(b, 291, 234, 5);
    inkEye(b, 309, 234, 5);
    b.d(smile(300, 248, 14, 5), undefined, 3);
    b.r('saucer', 'M120 278Q300 200 480 278Q300 356 120 278Z', 'grey');
    b.r('saucer-base', 'M220 300Q300 352 380 300L350 334Q300 350 250 334Z', 'purple');
    for (const x of [170, 235, 300, 365, 430]) b.r('light#', circle(x, x === 300 ? 296 : x === 235 || x === 365 ? 290 : 280, 11), 'pink');
    const stars: [number, number, number][] = [[80, 80, 20], [520, 70, 16], [440, 170, 12], [120, 210, 14], [560, 300, 18], [40, 330, 12], [300, 60, 12]];
    for (const [x, y, r] of stars) b.r('star#', softStar(x, y, r, r * 0.45), 'yellow');
    b.r('mini-planet', circle(200, 110, 30), 'orange');
    b.deco(quad([172, 104], [200, 96], [228, 104]), undefined, 3);
  }
);
