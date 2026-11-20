import { describe, expect, it } from 'vitest';
import {
  alphaOf,
  isOffscreen,
  MAX_CELEBRATION_S,
  MAX_DT,
  MAX_TWINKLE_HZ,
  scaleOf,
  seededRng,
  spawnBurst,
  spawnCannon,
  spawnRain,
  springKeyframes,
  stepParticle,
  terminalVelocity,
  type Particle,
} from './physics';

function simulate(p: Particle, seconds: number, fps: number) {
  const dt = 1 / fps;
  let alive = true;
  for (let t = 0; t < seconds && alive; t += dt) alive = stepParticle(p, dt);
  return alive;
}

describe('particle physics', () => {
  it('is frame-rate independent: 30 fps and 120 fps land in nearly the same place', () => {
    const [a] = spawnCannon({ x: 0, y: 0, count: 1, speed: 900 }, seededRng(7));
    const b = { ...a };
    simulate(a, 0.8, 30);
    simulate(b, 0.8, 120);
    expect(Math.abs(a.x - b.x)).toBeLessThan(12);
    expect(Math.abs(a.y - b.y)).toBeLessThan(12);
  });

  it('falls with gravity and settles at the terminal speed given by drag', () => {
    const [p] = spawnCannon({ x: 0, y: 0, count: 1, angle: 90, spread: 0, speed: 0, kinds: ['star'] }, seededRng(1));
    p.life = 10;
    p.sway = 0;
    simulate(p, 4, 60);
    expect(p.vy).toBeGreaterThan(0);
    expect(p.vy).toBeCloseTo(terminalVelocity(p.gravity, p.drag), -1);
  });

  it('clamps a huge time step (hidden tab, long GC) instead of teleporting', () => {
    const [p] = spawnCannon({ x: 0, y: 0, count: 1, speed: 1000, angle: 0, spread: 0 }, seededRng(3));
    const before = p.x;
    stepParticle(p, 5);
    expect(p.age).toBeCloseTo(MAX_DT, 6);
    expect(p.x - before).toBeLessThan(1000 * 1.5 * MAX_DT + 1);
  });

  it('dies at the end of its life', () => {
    const [p] = spawnBurst({ x: 0, y: 0, count: 1 }, seededRng(2));
    expect(simulate(p, p.life + 0.2, 60)).toBe(false);
  });

  it('a rain drop waits unseen before its turn, then falls', () => {
    const drops = spawnRain({ width: 400, count: 12, emojis: ['⭐'] }, seededRng(5));
    const waiting = drops.find((d) => d.age < -0.05)!;
    expect(waiting).toBeDefined();
    const y0 = waiting.y;
    expect(alphaOf(waiting)).toBe(0);
    stepParticle(waiting, 0.02);
    expect(waiting.y).toBe(y0);
    simulate(waiting, 1, 60);
    expect(waiting.y).toBeGreaterThan(y0);
  });

  it('fades out at the end and pops in at the start', () => {
    const [p] = spawnBurst({ x: 0, y: 0, count: 1 }, seededRng(4));
    expect(scaleOf(p)).toBeLessThan(0.2);
    p.age = p.popIn + 0.01;
    expect(scaleOf(p)).toBe(1);
    p.age = p.life - 0.0001;
    expect(alphaOf(p)).toBeLessThan(0.01);
  });

  it('never twinkles faster than MAX_TWINKLE_HZ (photosensitivity)', () => {
    const [p] = spawnCannon({ x: 0, y: 0, count: 1, kinds: ['star'] }, seededRng(9));
    p.twinkle = 30; // a bad value must still be clamped
    p.fadeOut = 0;
    p.life = 10;
    // Count brightness peaks over 2 s at 240 samples/s.
    let peaks = 0;
    let prev = alphaOf(p);
    let rising = false;
    for (let i = 1; i <= 480; i++) {
      p.age = i / 240;
      const a = alphaOf(p);
      if (a > prev) rising = true;
      else if (a < prev && rising) {
        peaks++;
        rising = false;
      }
      prev = a;
    }
    expect(MAX_TWINKLE_HZ).toBeLessThanOrEqual(3);
    expect(peaks / 2).toBeLessThanOrEqual(MAX_TWINKLE_HZ + 0.5);
  });

  it('knows when a particle has fallen off the screen', () => {
    const [p] = spawnBurst({ x: 100, y: 100, count: 1 }, seededRng(1));
    expect(isOffscreen(p, 800, 600)).toBe(false);
    p.y = 2000;
    p.vy = 50;
    expect(isOffscreen(p, 800, 600)).toBe(true);
    p.vy = -50; // still rising from below (a corner cannon): keep it
    expect(isOffscreen(p, 800, 600)).toBe(false);
  });
});

describe('spawners', () => {
  it('a cannon emits the requested count, with every shape family and Ziggy-green balls', () => {
    const list = spawnCannon({ x: 0, y: 0, count: 200 }, seededRng(11));
    expect(list).toHaveLength(200);
    const kinds = new Set(list.map((p) => p.kind));
    for (const k of ['rect', 'ribbon', 'star', 'heart', 'ball']) expect(kinds.has(k as never)).toBe(true);
    expect(list.filter((p) => p.kind === 'ball').every((p) => p.color === '#7DBF5A')).toBe(true);
  });

  it('every celebration particle is gone within MAX_CELEBRATION_S', () => {
    const all = [
      ...spawnCannon({ x: 0, y: 0, count: 50, life: 9 }, seededRng(1)),
      ...spawnBurst({ x: 0, y: 0, count: 20, life: 9 }, seededRng(2)),
      ...spawnRain({ width: 800, count: 20, life: 9 }, seededRng(3)),
    ];
    // Wall time = wait (negative age) + life.
    for (const p of all) expect(p.life - Math.min(0, p.age)).toBeLessThanOrEqual(MAX_CELEBRATION_S + 1e-9);
    expect(MAX_CELEBRATION_S).toBeLessThanOrEqual(2);
  });

  it('a burst is a ring: pieces leave in all directions', () => {
    const list = spawnBurst({ x: 0, y: 0, count: 8 }, seededRng(6));
    const quadrants = new Set(list.map((p) => `${Math.sign(p.vx)}${Math.sign(p.vy)}`));
    expect(quadrants.size).toBeGreaterThanOrEqual(3);
  });

  it('is repeatable with a seed', () => {
    const a = spawnCannon({ x: 0, y: 0, count: 5 }, seededRng(42));
    const b = spawnCannon({ x: 0, y: 0, count: 5 }, seededRng(42));
    expect(a).toEqual(b);
  });
});

describe('springKeyframes', () => {
  it('ends exactly on the target and overshoots when bouncy', () => {
    const f = springKeyframes(0.9, 1, { stiffness: 520, damping: 12 });
    expect(f[0]).toBe(0.9);
    expect(f[f.length - 1]).toBe(1);
    expect(Math.max(...f)).toBeGreaterThan(1);
  });

  it('never runs longer than maxMs', () => {
    const f = springKeyframes(0, 100, { stiffness: 50, damping: 0.5 }, { fps: 60, maxMs: 500 });
    expect(f.length).toBeLessThanOrEqual(30);
    expect(f[f.length - 1]).toBe(100);
  });
});
