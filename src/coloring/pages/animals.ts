import { capsule, circle, cloud, ellipse, flower, heart, hill, leaf, mirrorX, petal, poly, quad, rect, ringSegment, smooth, softStar, waveTop, type P } from '../shapes';
import { definePage } from './build';
import { groundFlower, inkEye, smile, tufts } from './parts';

/** A friendly long-neck dinosaur next to a volcano. */
export const dinosaur = definePage(
  { id: 'dinosaur', theme: 'animaux', title: { fr: 'Le gentil dinosaure', en: 'The friendly dinosaur' }, emoji: '🦕', level: 1 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('sun', circle(76, 76, 40), 'yellow');
    b.r('smoke#', cloud(512, 92, 112, 52), 'grey');
    b.r('smoke#', cloud(470, 148, 86, 40), 'grey');
    b.r('volcano', poly([[372, 350], [446, 186], [502, 186], [586, 350]]), 'brown');
    b.r('lava', smooth([[446, 186], [502, 186], [496, 222], [484, 210], [474, 236], [462, 208], [452, 220]], true, 0.4), 'orange');
    b.r('hill-back', hill(0, 360, [220, 290], 600, 344, 600), 'green');
    b.r('ground', hill(0, 482, [300, 452], 600, 482, 600), 'lime');
    // Palm tree
    b.r('palm-trunk', smooth([[30, 478], [26, 400], [44, 330], [58, 294], [70, 298], [58, 334], [46, 400], [56, 478]], true, 0.6), 'caramel');
    b.deco('M28 446h24M28 410h20M34 372h18M42 336h16', undefined, 3);
    for (const tip of [[-6, 318], [8, 244], [84, 226], [118, 284]] as P[]) b.r('palm-leaf#', leaf([64, 296], tip, 20), 'green');
    b.r('coconut#', circle(56, 310, 9), 'brown');
    b.r('coconut#', circle(73, 312, 9), 'brown');
    // Dinosaur
    b.r('tail', smooth([[440, 372], [512, 392], [580, 452], [520, 444], [440, 440]], true, 0.8), 'green');
    b.r('neck', smooth([[234, 386], [196, 320], [182, 250], [224, 236], [244, 300], [292, 350]]), 'green');
    const plates: P[][] = [
      [[250, 350], [270, 300], [296, 336]],
      [[296, 334], [322, 286], [350, 326]],
      [[350, 326], [380, 284], [404, 332]],
      [[404, 338], [430, 302], [446, 354]],
    ];
    for (const p of plates) b.r('plate#', smooth(p, true, 0.35), 'orange');
    b.r('leg-back-1', rect(272, 420, 40, 94, 16), 'green');
    b.r('leg-back-2', rect(402, 420, 40, 90, 16), 'green');
    b.r('body', ellipse(340, 402, 128, 78), 'green');
    b.r('belly', ellipse(320, 438, 84, 30), 'lime');
    b.r('leg-front-1', rect(236, 430, 44, 100, 18), 'green');
    b.deco('M244 530q6 -10 12 0M258 530q6 -10 12 0', undefined, 3);
    b.r('leg-front-2', rect(368, 430, 44, 100, 18), 'green');
    b.deco('M376 530q6 -10 12 0M390 530q6 -10 12 0', undefined, 3);
    b.r('spot#', circle(384, 370, 16), 'forest');
    b.r('spot#', circle(424, 400, 10), 'forest');
    b.r('spot#', circle(300, 366, 12), 'forest');
    b.r('spot#', circle(344, 348, 8), 'forest');
    b.r('head', ellipse(196, 226, 58, 40, -12), 'green');
    b.r('cheek', circle(222, 244, 10), 'pink');
    inkEye(b, 206, 212, 8.5);
    b.d('M150 214h0.1', undefined, 7);
    b.d(quad([150, 238], [172, 254], [196, 246]), undefined, 4.5);
    // Egg
    b.r('egg', ellipse(110, 528, 34, 44), 'cream');
    b.r('egg-spot#', circle(98, 512, 8), 'sky');
    b.r('egg-spot#', circle(124, 540, 7), 'sky');
    b.r('egg-spot#', circle(112, 494, 5), 'sky');
    b.d('M80 528l10 -8l8 10l10 -10l10 10l10 -8l10 8', undefined, 3.5);
    groundFlower(b, 520, 548, 20, 'pink', 5);
    groundFlower(b, 560, 500, 14, 'purple', 5);
    tufts(b, [[200, 560], [470, 590], [36, 590]], 8);
  }
);

/** Under the sea: a clownfish and its friends. */
export const underwater = definePage(
  { id: 'underwater', theme: 'animaux', title: { fr: 'Au fond de la mer', en: 'Under the sea' }, emoji: '🐠', level: 2 },
  (b) => {
    b.r('water', rect(0, 0, 600, 600), 'sky');
    b.r('sand', waveTop(0, 500, 600, 100, 9, 3), 'sand');
    b.r('seaweed#', smooth([[60, 512], [40, 430], [70, 360], [48, 290], [70, 240], [92, 296], [78, 360], [102, 430], [86, 512]]), 'green');
    b.r('seaweed#', smooth([[540, 512], [520, 440], [546, 380], [528, 320], [548, 290], [566, 330], [556, 390], [578, 450], [566, 512]]), 'forest');
    b.r('seaweed#', smooth([[130, 512], [118, 470], [138, 430], [126, 396], [144, 380], [154, 420], [146, 460], [158, 512]]), 'forest');
    b.r('coral', smooth([[420, 512], [412, 448], [390, 410], [406, 400], [426, 432], [432, 384], [452, 380], [450, 432], [472, 400], [490, 408], [466, 460], [472, 512]], true, 0.7), 'raspberry');
    b.r('rock', ellipse(300, 520, 64, 26), 'grey');
    b.r('starfish', smooth(Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 ? 18 : 42;
      const a = ((-90 + i * 36) * Math.PI) / 180;
      return [168 + Math.cos(a) * r, 548 + Math.sin(a) * r] as P;
    }), true, 0.45), 'orange');
    b.deco(circle(160, 540, 2.5) + circle(176, 540, 2.5), 'ink');
    b.r('shell', ringSegment(470, 566, 6, 40, 200, 340), 'pink');
    b.deco('M470 566L436 548M470 566L456 528M470 566L484 528M470 566L504 548', undefined, 3);
    // Jellyfish
    b.r('jelly', 'M50 170A60 60 0 0 1 170 170Q155 184 140 170Q125 184 110 170Q95 184 80 170Q65 184 50 170Z', 'pink');
    b.d('M70 182q-10 24 0 48q10 24 0 48M100 184q-10 24 0 48q10 24 0 40M130 184q-10 24 0 48q10 24 0 48M158 182q-10 24 0 44', undefined, 4);
    inkEye(b, 94, 140, 5);
    inkEye(b, 126, 140, 5);
    b.d(smile(110, 154, 14, 6), undefined, 3);
    // Clownfish
    b.r('fish-tail', 'M380 262L462 196Q440 262 462 328Z', 'orange');
    b.r('fish-fin-top', 'M232 200Q290 128 346 198Z', 'orange');
    b.r('fish-fin-bottom', 'M262 322Q300 374 336 318Z', 'orange');
    b.r('fish', ellipse(290, 262, 112, 76), 'orange');
    b.r('fish-stripe-1', ellipse(252, 262, 17, 64), 'white');
    b.r('fish-stripe-2', ellipse(338, 262, 16, 62), 'white');
    b.r('fish-fin', ellipse(296, 294, 26, 14, -30), 'orange');
    b.r('fish-eye', circle(208, 242, 19), 'white');
    inkEye(b, 211, 244, 10);
    b.d(quad([180, 282], [190, 294], [204, 286]), undefined, 4);
    // Little fish
    b.r('small-fish-1-tail', poly([[498, 118], [532, 96], [532, 142]]), 'yellow');
    b.r('small-fish-1', ellipse(468, 120, 36, 24), 'yellow');
    inkEye(b, 452, 114, 4.5);
    b.r('small-fish-2-tail', poly([[104, 340], [70, 318], [70, 362]]), 'purple');
    b.r('small-fish-2', ellipse(134, 340, 34, 22), 'purple');
    inkEye(b, 150, 334, 4.5);
    for (const [x, y, r] of [[196, 150, 15], [222, 106, 10], [212, 68, 7], [420, 214, 12], [404, 176, 8], [530, 230, 10]] as [number, number, number][]) {
      b.r('bubble#', circle(x, y, r), 'white');
      b.deco(`M${x - r * 0.5} ${y - r * 0.1}Q${x - r * 0.5} ${y - r * 0.5} ${x - r * 0.1} ${y - r * 0.55}`, undefined, 2);
    }
  }
);

/** A cat with a ball of wool. */
export const cat = definePage(
  { id: 'cat', theme: 'animaux', title: { fr: 'Le petit chat', en: 'The little cat' }, emoji: '🐱', level: 1 },
  (b) => {
    b.r('wall', rect(0, 0, 600, 470), 'lavender');
    b.r('floor', rect(0, 470, 600, 130), 'caramel');
    b.r('rug', ellipse(300, 540, 250, 50), 'pink');
    b.deco(ellipse(300, 540, 220, 36), undefined, 3);
    b.r('frame', rect(430, 70, 130, 100, 10), 'yellow');
    b.r('frame-picture', rect(446, 86, 98, 68, 4), 'sky');
    b.r('frame-fish-tail', poly([[516, 120], [534, 106], [534, 134]]), 'orange');
    b.r('frame-fish', ellipse(494, 120, 26, 16), 'orange');
    b.deco(circle(482, 116, 3), 'ink');
    b.r('tail', smooth([[372, 474], [440, 464], [474, 412], [458, 360], [480, 350], [500, 412], [464, 488], [384, 500]]), 'orange');
    b.r('body', smooth([[300, 262], [370, 300], [396, 400], [382, 490], [300, 508], [218, 490], [204, 400], [230, 300]]), 'orange');
    b.r('chest', ellipse(300, 404, 56, 78), 'cream');
    b.r('paw-left', ellipse(262, 494, 32, 19), 'cream');
    b.deco('M254 488V504M270 488V504', undefined, 3);
    b.r('paw-right', ellipse(338, 494, 32, 19), 'cream');
    b.deco('M330 488V504M346 488V504', undefined, 3);
    b.r('collar', 'M236 292Q300 322 364 292L362 310Q300 340 238 310Z', 'red');
    const ear: P[] = [[206, 176], [216, 84], [278, 140]];
    b.r('ear-left', smooth(ear, true, 0.25), 'orange');
    b.r('ear-left-in', smooth([[220, 162], [226, 110], [262, 144]], true, 0.25), 'pink');
    b.r('ear-right', smooth(mirrorX(ear, 300), true, 0.25), 'orange');
    b.r('ear-right-in', smooth(mirrorX([[220, 162], [226, 110], [262, 144]], 300), true, 0.25), 'pink');
    b.r('head', ellipse(300, 216, 108, 88), 'orange');
    b.deco('M300 130V156M280 134L284 158M320 134L316 158', undefined, 4);
    b.r('muzzle', ellipse(300, 254, 44, 30), 'cream');
    b.r('eye-left', ellipse(258, 210, 23, 27), 'lime');
    b.deco(ellipse(260, 212, 8, 17), 'ink');
    b.deco(circle(252, 200, 5), 'white', 1);
    b.r('eye-right', ellipse(342, 210, 23, 27), 'lime');
    b.deco(ellipse(340, 212, 8, 17), 'ink');
    b.deco(circle(334, 200, 5), 'white', 1);
    b.r('nose', heart(300, 244, 20), 'pink');
    b.r('cheek-left', circle(232, 254, 12), 'pink');
    b.r('cheek-right', circle(368, 254, 12), 'pink');
    b.d('M300 252V262M300 262Q290 274 280 264M300 262Q310 274 320 264', undefined, 4);
    b.d('M250 256L196 248M252 266L198 272M350 256L404 248M348 266L402 272', undefined, 3);
    b.r('bell', circle(300, 326, 12), 'yellow');
    b.deco('M292 330H308', undefined, 3);
    // Ball of wool
    b.r('wool', circle(118, 500, 50), 'blue');
    b.deco(quad([78, 478], [118, 520], [160, 476]) + quad([84, 520], [120, 470], [150, 528]) + quad([96, 458], [100, 500], [124, 548]), undefined, 3);
    b.d(quad([160, 512], [210, 560], [236, 506]), undefined, 4);
    b.r('heart', heart(120, 120, 46), 'raspberry');
    b.r('heart-small', heart(176, 70, 26), 'pink');
  }
);

/** A wise owl on a branch under the full moon. */
export const owl = definePage(
  { id: 'owl', theme: 'animaux', title: { fr: 'La chouette de la nuit', en: 'The night owl' }, emoji: '🦉', level: 1 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'navy');
    b.r('moon', circle(484, 110, 64), 'yellow');
    b.deco(circle(462, 94, 10) + circle(504, 132, 13) + circle(500, 84, 6), undefined, 3);
    for (const [x, y, r] of [[80, 80, 18], [200, 46, 12], [60, 260, 14], [560, 300, 15], [380, 40, 10], [120, 400, 11], [540, 420, 12]] as [number, number, number][]) b.r('star#', softStar(x, y, r, r * 0.45), 'yellow');
    b.r('cloud', cloud(140, 170, 150, 56), 'lavender');
    // Ear tufts and wings (behind the body)
    b.r('tuft-left', poly([[212, 196], [196, 120], [256, 172]]), 'brown');
    b.r('tuft-right', poly([[388, 196], [404, 120], [344, 172]]), 'brown');
    b.r('body', ellipse(300, 330, 130, 156), 'brown');
    b.r('belly', ellipse(300, 386, 86, 100), 'sand');
    b.deco('M246 352q9 10 18 0q9 10 18 0q9 10 18 0q9 10 18 0q9 10 18 0q9 10 18 0M240 392q9 10 18 0q9 10 18 0q9 10 18 0q9 10 18 0q9 10 18 0q9 10 18 0q9 10 18 0M252 432q9 10 18 0q9 10 18 0q9 10 18 0q9 10 18 0q9 10 18 0', undefined, 3);
    const wing: P[] = [[188, 270], [158, 340], [168, 420], [212, 456], [218, 360]];
    b.r('wing-left', smooth(wing), 'caramel');
    b.r('wing-right', smooth(mirrorX(wing, 300)), 'caramel');
    b.r('face-left', circle(250, 262, 54), 'cream');
    b.r('face-right', circle(350, 262, 54), 'cream');
    b.r('eye-left', circle(250, 264, 34), 'yellow');
    b.deco(circle(252, 266, 18), 'ink');
    b.deco(circle(244, 257, 6), 'white', 1);
    b.r('eye-right', circle(350, 264, 34), 'yellow');
    b.deco(circle(348, 266, 18), 'ink');
    b.deco(circle(342, 257, 6), 'white', 1);
    b.d('M206 214Q250 196 290 222M394 214Q350 196 310 222', undefined, 5);
    b.r('beak', poly([[300, 290], [318, 312], [300, 340], [282, 312]]), 'orange');
    // Branch and feet
    b.r('branch', smooth([[0, 486], [180, 474], [420, 478], [600, 470], [600, 504], [420, 512], [180, 510], [0, 520]], true, 0.4), 'brown');
    b.deco('M60 498h40M300 494h50M480 488h44', undefined, 3);
    b.r('leaf#', leaf([500, 480], [560, 430], 20), 'green');
    b.r('leaf#', leaf([110, 488], [50, 440], 20), 'green');
    b.r('leaf#', leaf([140, 500], [120, 560], 16), 'green');
    b.r('foot-left', flower(262, 484, 16, 3, 90), 'orange');
    b.r('foot-right', flower(338, 484, 16, 3, 90), 'orange');
    b.r('heart', heart(110, 330, 34), 'pink');
  }
);

/** A butterfly over a flower meadow. */
export const butterfly = definePage(
  { id: 'butterfly', theme: 'animaux', title: { fr: 'Le papillon et les fleurs', en: 'Butterfly and flowers' }, emoji: '🦋', level: 2 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('sun', circle(530, 70, 40), 'yellow');
    b.r('cloud', cloud(90, 80, 130, 54), 'white');
    b.r('meadow', hill(0, 470, [300, 430], 600, 470, 600), 'lime');
    // Butterfly
    const up: P[] = [[292, 236], [236, 130], [150, 96], [102, 150], [124, 230], [214, 264]];
    const low: P[] = [[292, 262], [210, 282], [168, 336], [204, 384], [266, 352]];
    b.r('wing-top-left', smooth(up), 'purple');
    b.r('wing-top-right', smooth(mirrorX(up, 300)), 'purple');
    b.r('wing-low-left', smooth(low), 'pink');
    b.r('wing-low-right', smooth(mirrorX(low, 300)), 'pink');
    for (const s of [1, -1]) {
      const x = (v: number) => 300 + (v - 300) * s;
      const tag = s > 0 ? 'left' : 'right';
      b.r(`spot-${tag}-1`, circle(x(178), 160, 26), 'yellow');
      b.r(`spot-${tag}-2`, circle(x(232), 212, 16), 'sky');
      b.r(`spot-${tag}-3`, circle(x(132), 186, 11), 'sky');
      b.r(`spot-${tag}-4`, circle(x(218), 330, 18), 'yellow');
    }
    b.r('body', capsule(300, 196, 300, 360, 26), 'brown');
    b.deco('M288 230h24M288 262h24M288 294h24M288 326h24', undefined, 3);
    b.r('head', circle(300, 178, 24), 'brown');
    b.d('M292 160Q280 120 252 108M308 160Q320 120 348 108', undefined, 4);
    b.d(circle(250, 106, 7) + circle(350, 106, 7), 'ink');
    inkEye(b, 291, 176, 4);
    inkEye(b, 309, 176, 4);
    b.d(smile(300, 186, 12, 5), undefined, 3);
    // Flowers
    const flowers: [number, number, number, string, string][] = [
      [110, 420, 46, 'red', 'yellow'],
      [300, 452, 40, 'yellow', 'orange'],
      [490, 412, 48, 'pink', 'yellow'],
    ];
    flowers.forEach(([x, y, r, c, heartC], i) => {
      b.r(`stem-${i + 1}`, capsule(x, y + r * 0.6, x + (i - 1) * 6, 600, 14), 'green');
      b.r(`leaf-${i + 1}`, leaf([x + 2, y + r + 70], [x + 56, y + r + 30], 18), 'green');
      for (let k = 0; k < 6; k++) b.r(`petal-${i + 1}-${k + 1}`, petal(x, y, r * 0.3, r, -90 + k * 60, r * 0.38), c);
      b.r(`flower-heart-${i + 1}`, circle(x, y, r * 0.34), heartC);
    });
    b.r('ladybug', ellipse(560, 540, 22, 18, -20), 'red');
    b.deco('M544 532L578 548', undefined, 3);
    b.deco(circle(556, 532, 3.5) + circle(566, 548, 3.5), 'ink');
    tufts(b, [[200, 560], [400, 572], [40, 560]], 9);
  }
);
