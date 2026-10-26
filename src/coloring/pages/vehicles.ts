import { circle, cloud, ellipse, flower, hill, poly, rect, softStar } from '../shapes';
import { definePage } from './build';
import { inkEye, smile, tufts } from './parts';

/** A little steam train. */
export const train = definePage(
  { id: 'train', theme: 'vehicules', title: { fr: 'Le petit train', en: 'The little train' }, emoji: '🚂', level: 1 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('sun', circle(80, 78, 40), 'yellow');
    b.r('hill-back', hill(0, 330, [220, 250], 600, 320, 600), 'green');
    b.r('ground', rect(0, 440, 600, 160), 'lime');
    b.r('rail-bed', rect(0, 446, 600, 26), 'sand');
    for (let x = 14; x < 600; x += 52) b.r('sleeper#', rect(x, 460, 30, 16, 3), 'brown');
    b.d('M0 452H600', undefined, 5);
    // Smoke
    b.r('smoke#', cloud(330, 156, 70, 36), 'white');
    b.r('smoke#', cloud(390, 104, 100, 48), 'white');
    b.r('smoke#', cloud(480, 50, 120, 56), 'white');
    // Locomotive
    b.r('chimney-top', poly([[294, 168], [356, 168], [344, 196], [306, 196]]), 'black');
    b.r('chimney', rect(310, 192, 30, 90), 'black');
    b.r('dome', rect(238, 252, 44, 40, 18), 'yellow');
    b.r('boiler', rect(196, 278, 178, 112, 14), 'blue');
    b.deco('M246 278V390M300 278V390', undefined, 3);
    b.r('cab', rect(62, 214, 140, 176, 8), 'red');
    b.r('cab-roof', rect(46, 194, 172, 30, 10), 'black');
    b.r('cab-window', rect(92, 244, 80, 66, 12), 'sky');
    // Ziggy drives the train
    b.r('driver', circle(132, 290, 26), 'green');
    b.deco('M120 266L112 248M144 266L152 248', undefined, 3);
    inkEye(b, 124, 286, 4);
    inkEye(b, 140, 286, 4);
    b.d(smile(132, 296, 14, 5), undefined, 3);
    b.r('lamp', circle(374, 304, 15), 'yellow');
    b.r('front', poly([[374, 360], [414, 404], [374, 404]]), 'yellow');
    b.r('wheel#', circle(104, 410, 36), 'grey');
    b.r('hub#', circle(104, 410, 12), 'red');
    b.r('wheel#', circle(208, 416, 30), 'grey');
    b.r('hub#', circle(208, 416, 10), 'red');
    b.r('wheel#', circle(310, 416, 30), 'grey');
    b.r('hub#', circle(310, 416, 10), 'red');
    b.d('M104 410L310 416', undefined, 6);
    // Wagon with balls
    b.r('ball#', circle(456, 290, 28), 'red');
    b.r('ball#', circle(510, 284, 30), 'green');
    b.r('ball#', circle(560, 298, 22), 'purple');
    b.r('wagon', rect(420, 300, 166, 92, 10), 'yellow');
    b.r('wagon-band', rect(420, 340, 166, 16), 'orange');
    b.r('wheel#', circle(458, 414, 28), 'grey');
    b.r('hub#', circle(458, 414, 9), 'red');
    b.r('wheel#', circle(550, 414, 28), 'grey');
    b.r('hub#', circle(550, 414, 9), 'red');
    b.d('M414 372H420', undefined, 6);
    b.r('flower#', flower(60, 530, 22, 5), 'pink');
    b.r('flower-heart#', circle(60, 530, 8), 'yellow');
    b.r('flower#', flower(300, 540, 20, 6), 'purple');
    b.r('flower-heart#', circle(300, 540, 7.5), 'yellow');
    b.r('flower#', flower(520, 530, 24, 5), 'red');
    b.r('flower-heart#', circle(520, 530, 9), 'yellow');
    tufts(b, [[160, 520], [420, 560], [200, 584], [580, 590]], 9);
  }
);

/** A cute car on the road, with Ziggy at the wheel. */
export const car = definePage(
  { id: 'car', theme: 'vehicules', title: { fr: 'La voiture de Ziggy', en: "Ziggy's car" }, emoji: '🚗', level: 1 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('sun', circle(80, 76, 42), 'yellow');
    b.r('cloud#', cloud(300, 80, 150, 60), 'white');
    b.r('cloud#', cloud(510, 130, 120, 50), 'white');
    b.r('hill', hill(0, 380, [300, 300], 600, 370, 600), 'green');
    for (const x of [70, 520]) {
      b.r('tree-trunk#', rect(x - 10, 290, 20, 90, 4), 'brown');
      b.r('tree#', flower(x, 270, 50, 8), 'forest');
      b.r('apple#', circle(x - 18, 258, 8), 'red');
      b.r('apple#', circle(x + 20, 284, 8), 'red');
    }
    b.r('road', rect(0, 430, 600, 170), 'grey');
    for (let x = 20; x < 600; x += 130) b.r('road-line#', rect(x, 540, 70, 14, 7), 'white');
    // Car
    b.r('cabin', 'M168 304L214 214Q222 198 244 198L378 198Q398 198 410 214L462 304Z', 'red');
    b.r('window-back', poly([[196, 296], [232, 224], [294, 224], [294, 296]]), 'sky');
    b.r('window-front', poly([[316, 224], [378, 224], [424, 296], [316, 296]]), 'sky');
    b.r('ziggy', circle(360, 270, 24), 'green');
    b.deco('M350 248L342 230M370 248L378 230', undefined, 3);
    inkEye(b, 352, 266, 4);
    inkEye(b, 368, 266, 4);
    b.d(smile(360, 276, 12, 5), undefined, 3);
    b.r('body', rect(86, 290, 432, 126, 44), 'red');
    b.deco('M306 300V408M276 330h18', undefined, 4);
    b.r('stripe', rect(100, 352, 404, 18, 9), 'white');
    b.r('headlight', ellipse(500, 330, 14, 18), 'yellow');
    b.r('taillight', rect(88, 318, 16, 30, 6), 'orange');
    b.r('bumper-front', rect(470, 392, 64, 22, 11), 'grey');
    b.r('bumper-back', rect(70, 392, 60, 22, 11), 'grey');
    b.r('wheel#', circle(184, 418, 52), 'black');
    b.r('rim#', circle(184, 418, 26), 'grey');
    b.deco(circle(184, 418, 6), 'ink');
    b.r('wheel#', circle(416, 418, 52), 'black');
    b.r('rim#', circle(416, 418, 26), 'grey');
    b.deco(circle(416, 418, 6), 'ink');
    b.r('star', softStar(560, 250, 16, 7), 'yellow');
    tufts(b, [[150, 410], [470, 400], [580, 420]], 8);
  }
);
