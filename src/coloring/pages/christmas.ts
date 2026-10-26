import { asterisk, capsule, circle, ellipse, flower, heart, hill, poly, quad, rect, softStar, star, waveTop, type P } from '../shapes';
import { definePage } from './build';
import { inkEye, smile } from './parts';

/** A tier of fir branches with a scalloped bottom edge. */
function tier(cx: number, top: number, bottom: number, half: number, scallops: number): string {
  const step = (half * 2) / scallops;
  let d = `M${cx} ${top}L${cx + half} ${bottom}`;
  for (let i = 0; i < scallops; i++) {
    const x1 = cx + half - (i + 1) * step;
    d += `Q${cx + half - (i + 0.5) * step} ${bottom + 22} ${x1} ${bottom}`;
  }
  return `${d}Z`;
}

/** A Christmas tree with baubles and presents. */
export const christmasTree = definePage(
  { id: 'christmas-tree', theme: 'noel', title: { fr: 'Le sapin de Noël', en: 'The Christmas tree' }, emoji: '🎄', level: 2 },
  (b) => {
    b.r('wall', rect(0, 0, 600, 470), 'cream');
    b.r('floor', rect(0, 470, 600, 130), 'caramel');
    b.d('M0 520H600M0 566H600M120 470V520M330 520V566M480 470V520M210 566V600', undefined, 3);
    // Window with snowflakes
    b.r('window', rect(30, 60, 130, 150, 12), 'navy');
    b.deco('M95 60V210M30 135H160', undefined, 4);
    b.deco(asterisk(62, 96, 12) + asterisk(128, 176, 10) + asterisk(64, 170, 8) + asterisk(132, 100, 8), undefined, 2.5);
    b.r('window-sill', rect(20, 206, 150, 18, 6), 'brown');
    // Garland of little stars on the wall
    b.d(quad([180, 40], [400, 110], [600, 40]), undefined, 3);
    for (const [x, y] of [[230, 62], [300, 78], [370, 78], [440, 66], [520, 52]] as P[]) b.r('garland-star#', softStar(x, y + 12, 14, 6.5), 'yellow');

    b.r('trunk', rect(278, 420, 44, 50, 4), 'brown');
    b.r('tier-bottom', tier(300, 210, 420, 176, 7), 'forest');
    b.r('tier-middle', tier(300, 140, 316, 134, 6), 'green');
    b.r('tier-top', tier(300, 76, 210, 92, 4), 'forest');
    b.d(quad([200, 270], [300, 300], [404, 264]) + quad([150, 386], [300, 420], [448, 380]), undefined, 3);
    b.r('pot', poly([[244, 452], [356, 452], [342, 518], [258, 518]]), 'red');
    b.r('pot-rim', rect(234, 440, 132, 24, 8), 'red');
    b.r('star', softStar(300, 70, 46, 20), 'gold');
    const baubles: [number, number, string][] = [
      [262, 176, 'red'], [336, 190, 'blue'], [226, 268, 'yellow'], [306, 252, 'purple'], [384, 284, 'pink'],
      [182, 384, 'blue'], [262, 352, 'red'], [350, 368, 'yellow'], [430, 392, 'purple'], [300, 160, 'pink'],
    ];
    for (const [x, y, c] of baubles) {
      b.r('bauble#', circle(x, y, 15), c);
      b.deco(`M${x - 6} ${y - 4}Q${x - 6} ${y - 9} ${x - 1} ${y - 10}`, 'white', 1);
    }
    // Presents
    b.r('gift-1', rect(70, 452, 128, 98, 6), 'blue');
    b.r('gift-1-lid', rect(60, 432, 148, 28, 6), 'blue');
    b.r('gift-1-ribbon', rect(124, 432, 20, 118), 'yellow');
    b.r('gift-1-ribbon-h', rect(70, 492, 128, 18), 'yellow');
    b.r('gift-1-bow-left', ellipse(118, 418, 22, 13, -25), 'yellow');
    b.r('gift-1-bow-right', ellipse(152, 418, 22, 13, 25), 'yellow');
    b.r('gift-1-knot', circle(135, 428, 9), 'yellow');
    b.r('gift-2', rect(400, 470, 96, 84, 6), 'pink');
    b.r('gift-2-ribbon', rect(440, 470, 16, 84), 'purple');
    b.r('gift-2-bow', flower(448, 466, 18, 4, -45), 'purple');
    b.r('gift-3', rect(480, 512, 90, 64, 6), 'lime');
    b.d('M480 536H570M500 512V576M528 512V576M552 512V576', undefined, 3);
    b.r('gift-3-bow', heart(525, 506, 28), 'red');
    b.r('gift-4', rect(210, 528, 76, 56, 6), 'orange');
    b.r('gift-4-ribbon', rect(240, 528, 14, 56), 'red');
    b.r('gift-4-bow', circle(247, 526, 10), 'red');
  }
);

/** A snowman in the snow. */
export const snowman = definePage(
  { id: 'snowman', theme: 'noel', title: { fr: 'Le bonhomme de neige', en: 'The snowman' }, emoji: '⛄', level: 1 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('moon', circle(500, 86, 42), 'yellow');
    b.r('tree-left', poly([[30, 380], [90, 220], [150, 380]]), 'forest');
    b.r('tree-left-2', poly([[110, 360], [158, 238], [206, 360]]), 'green');
    b.r('tree-right', poly([[430, 370], [500, 196], [570, 370]]), 'forest');
    b.r('snow-back', hill(0, 380, [300, 320], 600, 372, 600), 'white');
    b.r('snow', waveTop(0, 470, 600, 130, 10, 2), 'white');
    // Stick arms
    b.r('arm-left', capsule(246, 300, 158, 240, 10), 'brown');
    b.r('finger-left', capsule(178, 254, 162, 222, 8), 'brown');
    b.r('arm-right', capsule(354, 300, 444, 246, 10), 'brown');
    b.r('finger-right', capsule(424, 258, 446, 228, 8), 'brown');
    b.r('ball-bottom', circle(300, 452, 100), 'white');
    b.r('ball-middle', circle(300, 318, 72), 'white');
    b.r('button#', circle(300, 290, 9), 'black');
    b.r('button#', circle(300, 322, 9), 'black');
    b.r('button#', circle(300, 354, 9), 'black');
    b.r('head', circle(300, 206, 56), 'white');
    b.r('scarf', 'M240 250Q300 280 360 250L364 272Q300 304 236 272Z', 'red');
    b.r('scarf-tail', poly([[318, 272], [352, 266], [366, 344], [334, 350]]), 'red');
    b.deco('M330 290L356 286M334 312L360 308M337 332L362 328', undefined, 4);
    b.r('hat-top', rect(256, 84, 88, 76, 8), 'black');
    b.r('hat-band', rect(256, 136, 88, 18), 'red');
    b.r('hat-brim', rect(232, 152, 136, 18, 9), 'black');
    b.r('holly-leaf-1', ellipse(270, 140, 12, 6, -30), 'green');
    b.r('holly-berry', circle(283, 140, 6), 'red');
    b.r('nose', poly([[300, 206], [358, 218], [300, 224]]), 'orange');
    b.deco('M318 210L322 222M334 213L337 220', undefined, 3);
    b.r('cheek-left', circle(266, 228, 10), 'pink');
    b.r('cheek-right', circle(336, 230, 9), 'pink');
    inkEye(b, 280, 192, 8);
    inkEye(b, 322, 192, 8);
    b.d(smile(301, 238, 34, 10), undefined, 4.5);
    let flakes = '';
    for (const [x, y, r] of [[60, 80, 12], [180, 50, 9], [400, 130, 10], [560, 210, 12], [40, 230, 8], [250, 30, 8], [420, 40, 7], [560, 440, 9], [40, 470, 10]] as [number, number, number][]) flakes += asterisk(x, y, r);
    b.d(flakes, undefined, 3);
    b.r('gift', rect(452, 470, 80, 66, 6), 'purple');
    b.r('gift-ribbon', rect(484, 470, 16, 66), 'yellow');
    b.r('gift-bow', flower(492, 466, 16, 4, -45), 'yellow');
    b.r('star', star(110, 150, 16, 6, 4), 'yellow');
  }
);
