import { capsule, circle, cloud, ellipse, heart, hill, quad, rect, ringsAlong, softStar } from '../shapes';
import { definePage } from './build';
import { groundFlower, smile, tufts } from './parts';

/** Ziggy the round green plush robot, waving, with his glowing heart. */
export const ziggy = definePage(
  { id: 'ziggy', theme: 'espace', title: { fr: 'Ziggy le robot', en: 'Ziggy the robot' }, emoji: '🤖', level: 1 },
  (b) => {
    b.r('sky', rect(0, 0, 600, 600), 'sky');
    b.r('sun', circle(84, 84, 44), 'yellow');
    let rays = '';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + 0.2;
      rays += `M${(84 + Math.cos(a) * 58).toFixed(1)} ${(84 + Math.sin(a) * 58).toFixed(1)}L${(84 + Math.cos(a) * 76).toFixed(1)} ${(84 + Math.sin(a) * 76).toFixed(1)}`;
    }
    b.deco(rays, undefined, 5);
    b.r('cloud#', cloud(470, 104, 176, 74), 'white');
    b.r('cloud#', cloud(84, 300, 124, 52), 'white');
    b.r('star#', softStar(300, 44, 20, 9), 'yellow');
    b.r('star#', softStar(548, 236, 16, 7), 'yellow');
    b.r('star#', softStar(196, 30, 12, 5.5), 'yellow');
    b.r('hill-back', hill(0, 452, [430, 360], 600, 446, 600), 'green');
    b.r('hill', hill(0, 506, [300, 430], 600, 500, 600), 'lime');
    groundFlower(b, 70, 548, 22, 'pink', 5);
    groundFlower(b, 528, 540, 24, 'red', 6);
    groundFlower(b, 450, 572, 15, 'purple', 5);

    // Antennas
    b.r('antenna-left', capsule(262, 132, 226, 74, 11), 'green');
    b.r('antenna-right', capsule(338, 132, 374, 74, 11), 'green');
    b.r('antenna-ball-left', circle(222, 66, 19), 'green');
    b.r('antenna-ball-right', circle(378, 66, 19), 'green');
    // Ears
    b.r('ear-left', ellipse(168, 214, 26, 42), 'green');
    b.r('ear-left-in', ellipse(162, 214, 11, 26), 'lime');
    b.r('ear-right', ellipse(432, 214, 26, 42), 'green');
    b.r('ear-right-in', ellipse(438, 214, 11, 26), 'lime');
    // Arms (springs) and mittens
    b.r('arm-left', capsule(240, 360, 160, 430, 28), 'grey');
    b.deco(ringsAlong(240, 360, 160, 430, 28, 4), undefined, 3.5);
    b.r('arm-right', capsule(360, 344, 474, 268, 28), 'grey');
    b.deco(ringsAlong(360, 344, 474, 268, 28, 4), undefined, 3.5);
    b.r('hand-left', circle(150, 440, 29), 'green');
    b.r('hand-right', circle(484, 256, 31), 'green');
    // Legs and feet
    b.r('leg-left', capsule(268, 440, 262, 500, 30), 'grey');
    b.deco(ringsAlong(268, 440, 262, 500, 30, 3), undefined, 3.5);
    b.r('leg-right', capsule(332, 440, 338, 500, 30), 'grey');
    b.deco(ringsAlong(332, 440, 338, 500, 30, 3), undefined, 3.5);
    b.r('foot-left', ellipse(252, 516, 46, 26), 'green');
    b.r('foot-right', ellipse(348, 516, 46, 26), 'green');
    // Body and glowing heart
    b.r('body', ellipse(300, 390, 98, 88), 'green');
    b.deco(quad([214, 432], [300, 470], [386, 432]), undefined, 3);
    b.r('heart-glow', heart(300, 390, 100), 'cream');
    b.r('heart', heart(300, 390, 70), 'yellow');
    // Head
    b.r('head', ellipse(300, 205, 128, 104), 'green');
    b.deco(quad([214, 134], [300, 104], [386, 134]), undefined, 3);
    b.r('eye-left', ellipse(250, 202, 34, 38), 'white');
    b.r('iris-left', circle(255, 210, 22), 'forest');
    b.deco(circle(257, 212, 11), 'ink');
    b.deco(circle(249, 203, 5.5), 'white', 1);
    b.deco(circle(263, 220, 2.6), 'white', 1);
    b.r('eye-right', ellipse(350, 202, 34, 38), 'white');
    b.r('iris-right', circle(345, 210, 22), 'forest');
    b.deco(circle(343, 212, 11), 'ink');
    b.deco(circle(337, 203, 5.5), 'white', 1);
    b.deco(circle(351, 220, 2.6), 'white', 1);
    b.r('cheek-left', circle(210, 254, 14), 'pink');
    b.r('cheek-right', circle(390, 254, 14), 'pink');

    b.d(quad([222, 150], [248, 136], [274, 148]), undefined, 5);
    b.d(quad([326, 148], [352, 136], [378, 150]), undefined, 5);
    b.d('M217 188L203 181M216 199L201 197M383 188L397 181M384 199L399 197', undefined, 4);
    b.d(smile(300, 258, 58, 26), undefined, 5.5);
    tufts(b, [[150, 520], [400, 506], [580, 560], [30, 500]], 9);
  }
);
