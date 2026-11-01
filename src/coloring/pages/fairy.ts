import {
  arch,
  battlement,
  capsule,
  circle,
  cloud,
  ellipse,
  flower,
  heart,
  hill,
  mirrorX,
  poly,
  polyline,
  quad,
  rect,
  ringSegment,
  smooth,
  softStar,
  star,
  type P,
} from '../shapes';
import { definePage } from './build';
import { groundFlower, inkEye, smile, tufts } from './parts';

/** Princesse Lili and her baby dragon, under a rainbow. */
export const lili = definePage(
  { id: 'lili', theme: 'fees', title: { fr: 'Princesse Lili et son bébé dragon', en: 'Princess Lili and her baby dragon' }, emoji: '👑', level: 2 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    const bands = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
    bands.forEach((c, i) => b.r(`rainbow-${i + 1}`, ringSegment(300, 470, 270 - i * 22, 292 - i * 22, 180, 360), c));
    b.r('rainbow-inside', ringSegment(300, 470, 1, 160, 180, 360), 'sky');
    b.r('ground', hill(0, 468, [300, 440], 600, 468, 600), 'lime');
    b.r('cloud#', cloud(60, 452, 130, 56), 'white');
    b.r('cloud#', cloud(540, 452, 130, 56), 'white');
    groundFlower(b, 40, 560, 18, 'pink', 5);
    groundFlower(b, 312, 566, 20, 'red', 6);
    groundFlower(b, 566, 552, 18, 'purple', 5);

    // ── Lili ──
    b.r('hair-back', smooth([[200, 150], [262, 180], [272, 260], [258, 318], [200, 330], [142, 318], [128, 260], [138, 180]]), 'yellow');
    b.r('shoe-left', ellipse(176, 452, 20, 11), 'purple');
    b.r('shoe-right', ellipse(226, 452, 20, 11), 'purple');
    b.r('neck', rect(190, 258, 20, 34, 6), 'peach');
    b.r('skirt', 'M168 322L232 322Q262 382 292 442Q200 472 108 442Q138 382 168 322Z', 'pink');
    b.deco(quad([150, 430], [200, 446], [250, 430]), undefined, 3);
    b.r('skirt-frill#', ellipse(132, 446, 26, 14), 'raspberry');
    b.r('skirt-frill#', ellipse(178, 455, 26, 14), 'raspberry');
    b.r('skirt-frill#', ellipse(224, 455, 26, 14), 'raspberry');
    b.r('skirt-frill#', ellipse(268, 446, 26, 14), 'raspberry');
    b.r('bodice', 'M176 284L224 284Q236 300 234 330L166 330Q164 300 176 284Z', 'raspberry');
    b.r('belt', rect(160, 322, 80, 16, 8), 'purple');
    b.r('belt-heart', heart(200, 330, 18), 'yellow');
    b.r('wand', capsule(266, 352, 292, 286, 7), 'brown');
    b.r('wand-star', softStar(296, 274, 26, 12), 'yellow');
    b.r('arm-left', capsule(180, 296, 146, 362, 18), 'peach');
    b.r('arm-right', capsule(220, 296, 262, 350, 18), 'peach');
    b.r('hand-left', circle(144, 366, 12), 'peach');
    b.r('hand-right', circle(266, 354, 12), 'peach');
    b.r('sleeve-left', ellipse(176, 294, 18, 14, -30), 'pink');
    b.r('sleeve-right', ellipse(224, 294, 18, 14, 30), 'pink');
    b.r('face', circle(200, 218, 52), 'peach');
    b.r('fringe', 'M146 222C138 152 262 152 254 222Q240 192 222 198Q206 172 190 198Q172 186 160 202Q150 208 146 222Z', 'yellow');
    b.r('crown', poly([[168, 166], [170, 128], [186, 148], [200, 118], [214, 148], [230, 128], [232, 166]]), 'gold');
    b.r('crown-jewel', circle(200, 152, 7), 'red');
    b.r('cheek-left', circle(172, 240, 8.5), 'pink');
    b.r('cheek-right', circle(228, 240, 8.5), 'pink');
    inkEye(b, 183, 220, 6.5);
    inkEye(b, 217, 220, 6.5);
    b.d('M176 209L171 205M175 215L169 213M224 209L229 205M225 215L231 213', undefined, 2.5);
    b.d(smile(200, 240, 20, 9), undefined, 4);

    // ── Baby dragon ──
    const wing: P[] = [[468, 352], [520, 262], [528, 298], [552, 296], [538, 322], [556, 340], [516, 346], [496, 368]];
    b.r('dragon-wing-right', poly(wing), 'lavender');
    b.r('dragon-wing-left', poly(mirrorX(wing, 440)), 'lavender');
    b.r('dragon-tail', smooth([[466, 410], [508, 420], [540, 408], [556, 382], [568, 390], [552, 426], [510, 446], [468, 438]]), 'turquoise');
    b.r('dragon-tail-tip', poly([[548, 386], [578, 352], [574, 396]]), 'orange');
    b.r('dragon-body', ellipse(440, 404, 62, 70), 'turquoise');
    b.r('dragon-belly', ellipse(440, 418, 38, 48), 'cream');
    b.deco('M412 396Q440 404 468 396M406 416Q440 425 474 416M410 436Q440 445 470 436', undefined, 3);
    b.r('dragon-foot-left', ellipse(408, 468, 26, 15), 'turquoise');
    b.deco('M398 468V478M410 468V480', undefined, 3);
    b.r('dragon-foot-right', ellipse(472, 468, 26, 15), 'turquoise');
    b.deco('M470 468V480M482 468V478', undefined, 3);
    b.r('dragon-arm-left', ellipse(396, 404, 12, 22, 30), 'turquoise');
    b.r('dragon-arm-right', ellipse(484, 404, 12, 22, -30), 'turquoise');
    b.r('dragon-horn-left', poly([[414, 270], [398, 228], [430, 258]]), 'yellow');
    b.r('dragon-horn-right', poly([[466, 270], [482, 228], [450, 258]]), 'yellow');
    b.r('dragon-spike', poly([[428, 256], [440, 232], [452, 256]]), 'orange');
    b.r('dragon-head', circle(440, 300, 50), 'turquoise');
    b.r('dragon-snout', ellipse(440, 324, 30, 20), 'cream');
    b.deco('M430 318h0.1M450 318h0.1', undefined, 6);
    b.r('dragon-cheek-left', circle(404, 318, 8), 'pink');
    b.r('dragon-cheek-right', circle(476, 318, 8), 'pink');
    inkEye(b, 422, 292, 9);
    inkEye(b, 458, 292, 9);
    b.d(smile(440, 332, 22, 8), undefined, 4);

    b.r('heart', heart(330, 248, 40), 'red');
    b.r('heart-small', heart(352, 200, 22), 'pink');
    b.r('sparkle#', star(108, 120, 16, 6, 4), 'yellow');
    b.r('sparkle#', star(500, 140, 14, 5, 4), 'yellow');
    tufts(b, [[120, 500], [380, 520], [520, 500]], 8);
  }
);

/** A fairy-tale castle with flags. */
export const castle = definePage(
  { id: 'castle', theme: 'fees', title: { fr: 'Le château magique', en: 'The magic castle' }, emoji: '🏰', level: 2 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('sun', circle(520, 78, 40), 'yellow');
    b.r('cloud#', cloud(110, 90, 150, 62), 'white');
    b.r('cloud#', cloud(430, 160, 110, 46), 'white');
    b.r('hill-back', hill(0, 420, [150, 340], 330, 430, 600), 'green');
    b.r('hill-back-2', hill(260, 440, [460, 360], 600, 400, 600), 'green');
    // Centre tower (behind)
    b.r('tower-centre', rect(262, 140, 76, 110), 'lavender');
    b.r('roof-centre', poly([[248, 144], [300, 50], [352, 144]]), 'purple');
    b.d('M300 50V20', undefined, 4);
    b.r('flag-centre', poly([[300, 20], [336, 30], [300, 40]]), 'red');
    b.r('window-centre', arch(286, 170, 28, 44), 'yellow');
    // Side towers
    for (const [side, x] of [['left', 104], ['right', 416]] as const) {
      b.r(`tower-${side}`, rect(x, 236, 80, 240), 'lavender');
      b.r(`roof-${side}`, poly([[x - 16, 242], [x + 40, 130], [x + 96, 242]]), 'raspberry');
      b.d(`M${x + 40} 130V100`, undefined, 4);
      b.r(`flag-${side}`, poly([[x + 40, 100], [x + 74, 110], [x + 40, 120]]), 'yellow');
      b.r(`window-${side}`, arch(x + 24, 280, 32, 52), 'yellow');
      b.deco(`M${x + 40} 280V332M${x + 24} 306H${x + 56}`, undefined, 3);
      b.r(`window-${side}-low`, arch(x + 28, 380, 24, 36), 'yellow');
      b.d(`M${x + 8} 362h18M${x + 52} 440h20M${x + 10} 420h16`, undefined, 3);
    }
    // Keep
    b.r('keep', battlement(184, 214, 232, 262, 7, 22), 'pink');
    b.d('M200 276h22M372 262h24M206 360h20M380 340h20M196 420h22M388 420h18', undefined, 3);
    b.r('rose-window', flower(300, 282, 30, 8), 'sky');
    b.r('rose-window-heart', circle(300, 282, 12), 'red');
    b.r('door', arch(258, 382, 84, 94), 'brown');
    b.deco('M286 400V476M314 400V476', undefined, 3);
    b.d(circle(328, 432, 4.5), 'ink');
    b.r('path', poly([[258, 476], [342, 476], [400, 600], [200, 600]]), 'sand');
    b.r('ground-left', 'M0 600L0 466Q120 452 258 476L200 600Z', 'lime');
    b.r('ground-right', 'M600 600L600 466Q480 452 342 476L400 600Z', 'lime');
    b.r('bush#', flower(66, 470, 46, 7), 'forest');
    b.r('bush#', flower(538, 474, 44, 7), 'forest');
    groundFlower(b, 140, 548, 18, 'pink', 5);
    groundFlower(b, 470, 556, 18, 'red', 5);
    groundFlower(b, 70, 572, 14, 'purple', 5);
    b.r('heart', heart(220, 90, 34), 'pink');
    b.r('sparkle#', star(380, 70, 14, 5, 4), 'yellow');
    b.r('sparkle#', star(40, 220, 12, 4.5, 4), 'yellow');
    tufts(b, [[30, 520], [560, 590], [180, 500]], 8);
    b.d(polyline([[230, 520], [236, 512], [242, 520]]), undefined, 3);
  }
);

/** A unicorn under a rainbow. */
export const unicorn = definePage(
  { id: 'unicorn', theme: 'fees', title: { fr: 'La licorne', en: 'The unicorn' }, emoji: '🦄', level: 2 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'lavender');
    const bands = ['red', 'orange', 'yellow', 'green', 'blue'];
    bands.forEach((c, i) => b.r(`rainbow-${i + 1}`, ringSegment(390, 330, 200 - i * 22, 222 - i * 22, 180, 360), c));
    b.r('rainbow-inside', ringSegment(390, 330, 1, 112, 180, 360), 'lavender');
    b.r('cloud#', cloud(196, 318, 140, 64), 'white');
    b.r('cloud#', cloud(586, 318, 130, 60), 'white');
    b.r('ground', hill(0, 470, [300, 430], 600, 476, 600), 'mint');
    // Tail (behind the body)
    b.r('tail-1', smooth([[438, 352], [496, 340], [530, 380], [520, 440], [540, 486], [494, 470], [482, 420], [458, 384]]), 'pink');
    b.r('tail-2', smooth([[446, 370], [480, 384], [492, 430], [508, 472], [474, 470], [462, 424]]), 'purple');
    // Back legs (darker, behind)
    b.r('leg-back-1', rect(256, 400, 34, 96, 14), 'white');
    b.r('hoof-back-1', rect(254, 478, 38, 22, 8), 'lavender');
    b.r('leg-back-2', rect(400, 400, 34, 96, 14), 'white');
    b.r('hoof-back-2', rect(398, 478, 38, 22, 8), 'lavender');
    b.r('body', ellipse(340, 380, 118, 66), 'white');
    b.r('leg-front-1', rect(222, 404, 36, 104, 15), 'white');
    b.r('hoof-front-1', rect(220, 490, 40, 22, 8), 'lavender');
    b.r('leg-front-2', rect(366, 404, 36, 104, 15), 'white');
    b.r('hoof-front-2', rect(364, 490, 40, 22, 8), 'lavender');
    b.r('neck', smooth([[214, 380], [196, 300], [206, 234], [262, 232], [270, 300], [288, 352]]), 'white');
    b.r('mane', smooth([[232, 168], [276, 180], [304, 220], [322, 262], [320, 308], [302, 350], [282, 332], [284, 290], [270, 252], [252, 218], [230, 196]]), 'purple');
    b.r('mane-2', smooth([[258, 198], [292, 230], [304, 274], [296, 314], [282, 294], [278, 254], [258, 224]]), 'pink');
    b.r('ear', poly([[230, 176], [244, 132], [262, 182]]), 'white');
    b.r('ear-in', poly([[238, 172], [245, 148], [254, 176]]), 'pink');
    b.r('head', ellipse(196, 222, 62, 48, -18), 'white');
    b.r('muzzle', ellipse(150, 248, 36, 28, -18), 'pink');
    b.deco('M140 244h0.1', undefined, 7);
    b.r('fringe', smooth([[196, 172], [236, 172], [244, 200], [218, 214], [206, 196], [190, 200]]), 'pink');
    b.r('horn', poly([[176, 182], [150, 96], [206, 172]]), 'gold');
    b.deco('M164 150L184 142M170 168L194 156M158 128L176 124', undefined, 3);
    b.r('cheek', circle(228, 244, 11), 'pink');
    inkEye(b, 202, 214, 9);
    b.d('M193 202L187 196M200 199L198 191', undefined, 3);
    b.d(smile(166, 268, 22, 6), undefined, 4);
    b.r('star#', softStar(80, 90, 26, 12), 'yellow');
    b.r('star#', softStar(560, 90, 18, 8), 'yellow');
    b.r('star#', softStar(110, 400, 16, 7), 'yellow');
    b.r('heart', heart(300, 110, 30), 'pink');
    groundFlower(b, 90, 548, 20, 'pink', 5);
    groundFlower(b, 320, 560, 18, 'yellow', 6);
    groundFlower(b, 530, 540, 22, 'purple', 5);
    tufts(b, [[160, 560], [440, 556], [580, 500]], 8);
  }
);
