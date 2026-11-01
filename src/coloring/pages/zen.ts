import { arch, circle, cloud, flower, heart, hill, petal, poly, polar, rect, ringSegment, smooth, softStar, type P } from '../shapes';
import { definePage } from './build';
import { groundFlower, tufts } from './parts';

/** A house with its garden. */
export const house = definePage(
  { id: 'house', theme: 'zen', title: { fr: 'La maison et le jardin', en: 'The house and the garden' }, emoji: '🏡', level: 1 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('sun', circle(80, 80, 38), 'yellow');
    for (let i = 0; i < 8; i++) {
      const a = i * 45 + 22;
      b.r('sun-ray#', poly([polar(80, 80, 50, a - 8), polar(80, 80, 72, a), polar(80, 80, 50, a + 8)]), 'yellow');
    }
    b.r('cloud#', cloud(290, 70, 140, 56), 'white');
    b.r('cloud#', cloud(520, 100, 120, 50), 'white');
    b.r('hill', hill(0, 380, [300, 320], 600, 380, 600), 'green');
    b.r('lawn', rect(0, 440, 600, 160), 'lime');
    // Tree
    b.r('tree-trunk', rect(484, 300, 30, 150, 6), 'brown');
    b.r('tree', flower(500, 264, 70, 9), 'forest');
    for (const [x, y] of [[470, 236], [528, 252], [490, 296], [540, 300], [462, 280]] as P[]) b.r('apple#', circle(x, y, 9), 'red');
    // House
    b.r('chimney', rect(368, 150, 36, 80), 'brown');
    b.r('smoke', cloud(400, 120, 70, 34), 'grey');
    b.r('walls', rect(170, 262, 260, 190), 'cream');
    b.r('roof', poly([[146, 272], [300, 150], [454, 272]]), 'red');
    b.r('attic-window', circle(300, 222, 22), 'yellow');
    b.deco('M300 200V244M278 222H322', undefined, 3);
    b.r('door', arch(270, 352, 60, 100), 'brown');
    b.deco(circle(318, 404, 4), 'ink');
    for (const x of [192, 342]) {
      b.r('window#', rect(x, 296, 66, 58, 6), 'sky');
      b.deco(`M${x + 33} 296V354M${x} 325H${x + 66}`, undefined, 3);
      b.r('flower-box#', rect(x - 6, 354, 78, 18, 6), 'brown');
      for (let k = 0; k < 3; k++) b.r('box-flower#', flower(x + 10 + k * 23, 348, 9, 5), ['red', 'yellow', 'pink'][k]);
    }
    b.r('path', smooth([[270, 452], [330, 452], [350, 500], [330, 560], [360, 600], [240, 600], [262, 540], [252, 494]], true, 0.6), 'sand');
    // Fence
    for (const [x0, x1] of [[0, 230], [370, 470]] as P[]) {
      b.r('fence-rail#', rect(x0, 446, x1 - x0, 14), 'white');
      for (let x = x0 + 6; x + 22 <= x1; x += 34) b.r('picket#', poly([[x, 494], [x, 418], [x + 11, 404], [x + 22, 418], [x + 22, 494]]), 'white');
    }
    groundFlower(b, 60, 548, 22, 'pink', 5);
    groundFlower(b, 170, 568, 18, 'purple', 5);
    groundFlower(b, 450, 552, 20, 'red', 6);
    groundFlower(b, 550, 572, 16, 'orange', 5);
    b.r('heart', heart(220, 196, 26), 'pink');
    tufts(b, [[110, 590], [230, 520], [520, 510]], 8);
  }
);

/** A mandala for older children: many small zones. */
export const mandala = definePage(
  { id: 'mandala', theme: 'zen', title: { fr: 'Le grand mandala', en: 'The big mandala' }, emoji: '🌀', level: 3 },
  (b) => {
    const C = 300;
    b.r('background', rect(0, 0, 600, 600), 'cream');
    for (let i = 0; i < 4; i++) b.r('corner#', softStar([60, 540, 60, 540][i], [60, 60, 540, 540][i], 34, 16, 6), ['pink', 'sky', 'mint', 'lavender'][i]);
    for (let i = 0; i < 16; i++) b.r('outer-petal#', petal(C, C, 176, 286, i * 22.5, 34), i % 2 ? 'purple' : 'pink');
    for (let i = 0; i < 16; i++) b.r('outer-point#', petal(C, C, 182, 244, i * 22.5 + 11.25, 16), 'sky');
    b.r('ring-wide', circle(C, C, 204), 'lavender');
    for (let i = 0; i < 24; i++) b.r('ring-dot#', circle(...polar(C, C, 193, i * 15 + 7.5), 6.5), 'yellow');
    for (let i = 0; i < 24; i++) b.r('ring-tile#', ringSegment(C, C, 158, 182, i * 15, i * 15 + 15), i % 2 ? 'turquoise' : 'mint');
    b.r('inner-disc', circle(C, C, 158), 'cream');
    for (let i = 0; i < 12; i++) b.r('petal#', petal(C, C, 68, 158, i * 30, 32), i % 2 ? 'yellow' : 'orange');
    for (let i = 0; i < 12; i++) b.r('small-petal#', petal(C, C, 78, 134, i * 30 + 15, 14), 'red');
    b.r('heart-ring', circle(C, C, 78), 'pink');
    for (let i = 0; i < 8; i++) b.r('core-petal#', petal(C, C, 24, 78, i * 45, 18), i % 2 ? 'raspberry' : 'magenta');
    b.r('core', circle(C, C, 28), 'red');
    b.r('core-dot', circle(C, C, 12), 'yellow');
  }
);

/** A flower mandala with bigger zones (for younger children). */
export const mandalaFlower = definePage(
  { id: 'mandala-flower', theme: 'zen', title: { fr: 'Le mandala fleur', en: 'The flower mandala' }, emoji: '🌸', level: 2 },
  (b) => {
    const C = 300;
    b.r('background', rect(0, 0, 600, 600), 'sky');
    for (let i = 0; i < 8; i++) b.r('leaf#', petal(C, C, 150, 285, i * 45 + 22.5, 44), 'green');
    for (let i = 0; i < 8; i++) b.r('big-petal#', petal(C, C, 60, 262, i * 45, 70), i % 2 ? 'pink' : 'raspberry');
    b.r('ring', circle(C, C, 112), 'yellow');
    for (let i = 0; i < 8; i++) b.r('heart#', heart(...polar(C, C, 88, i * 45 + 22.5), 30), 'red');
    for (let i = 0; i < 6; i++) b.r('mid-petal#', petal(C, C, 20, 80, i * 60 - 90, 26), i % 2 ? 'purple' : 'lavender');
    b.r('centre', flower(C, C, 28, 6), 'orange');
    b.r('centre-dot', circle(C, C, 11), 'yellow');
    for (const [x, y] of [[54, 54], [546, 54], [54, 546], [546, 546]] as P[]) b.r('corner-star#', softStar(x, y, 30, 14), 'yellow');
  }
);
