import { describe, expect, it } from 'vitest';
import { Tweener, ease } from './tween';
import { CameraRig, fitOrthoHalfHeight, frameForAspect, smoothDamp, viewPosition } from './camera';

describe('Tweener', () => {
  it('tweens numeric props over game time with easing and calls onDone once', () => {
    const tw = new Tweener();
    const pos = { x: 0, y: 0, z: 0 };
    let done = 0;
    tw.vec(pos, { x: 10 }, { duration: 1, ease: ease.linear, onDone: () => done++ });
    tw.update(0.5);
    expect(pos.x).toBeCloseTo(5);
    tw.update(0.6);
    expect(pos.x).toBe(10);
    tw.update(1);
    expect(done).toBe(1);
    expect(tw.active).toBe(0);
  });

  it('reduced motion: moves jump to the end, fades are kept but short', () => {
    const tw = new Tweener();
    tw.reducedMotion = true;
    const pos = { x: 0, y: 0, z: 0 };
    tw.vec(pos, { y: 2 }, { duration: 1 });
    expect(pos.y).toBe(2);
    const m = { opacity: 0 };
    tw.fade(m, 1, { duration: 1, ease: ease.linear });
    tw.update(0.1);
    expect(m.opacity).toBeCloseTo(0.5);
    tw.update(0.1);
    expect(m.opacity).toBe(1);
  });

  it('delays, timers in due order, cancel, finish and killTweensOf', () => {
    const tw = new Tweener();
    const log: string[] = [];
    tw.after(0.3, () => log.push('b'));
    tw.after(0.1, () => log.push('a'));
    const c = tw.after(0.2, () => log.push('cancelled'));
    c.cancel();
    const o = { x: 0 };
    tw.to(o, { x: 1 }, { duration: 1, delay: 0.5, ease: ease.linear });
    tw.update(0.4);
    expect(log).toEqual(['a', 'b']);
    expect(o.x).toBe(0);
    tw.update(0.6);
    expect(o.x).toBeCloseTo(0.5);
    tw.killTweensOf(o);
    tw.update(1);
    expect(o.x).toBeCloseTo(0.5);
    const h = tw.to(o, { x: 9 }, { duration: 5 });
    h.finish();
    expect(o.x).toBe(9);
  });
});

describe('camera maths', () => {
  it('smoothDamp converges without overshoot', () => {
    let v = 0;
    let vel = 0;
    let max = 0;
    for (let i = 0; i < 300; i++) {
      [v, vel] = smoothDamp(v, 10, vel, 0.3, 1 / 60);
      max = Math.max(max, v);
    }
    expect(v).toBeCloseTo(10, 3);
    expect(max).toBeLessThanOrEqual(10);
  });

  it('portrait screens back the camera off; landscape keeps the authored distance', () => {
    const v = { c: [0, 1, 0] as [number, number, number], r: 7, pitch: 0.3, yaw: 0 };
    expect(frameForAspect(v, 1.6).r).toBe(7);
    expect(frameForAspect(v, 2.2).r).toBe(7);
    expect(frameForAspect(v, 390 / 844).r).toBeGreaterThan(14);
    expect(fitOrthoHalfHeight(6, 4, 390 / 844)).toBeGreaterThan(fitOrthoHalfHeight(6, 4, 1.6));
  });

  it('rig: cut with reduced motion, smooth otherwise, pan limits respected', () => {
    const rig = new CameraRig({ c: [0, 1, 0], r: 6, pitch: 0.3, yaw: 0 });
    rig.addView('side', { c: [2, 1, 0], r: 6, pitch: 0.3, yaw: Math.PI / 2 });
    rig.goTo('side');
    rig.update(1 / 60);
    expect(rig.settled).toBe(false);
    for (let i = 0; i < 600; i++) rig.update(1 / 60);
    expect(rig.settled).toBe(true);
    rig.reducedMotion = true;
    rig.goTo({ c: [0, 1, 0], r: 6, pitch: 0.3, yaw: 0 });
    expect(rig.current.c).toEqual([0, 1, 0]);
    rig.limits = { min: [-1, 0, -1], max: [1, 2, 1] };
    rig.pan(50);
    expect(rig.current.c[0]).toBeLessThanOrEqual(1);
    const p = viewPosition({ c: [0, 0, 0], r: 2, pitch: 0, yaw: 0 });
    expect(p[2]).toBeCloseTo(2);
  });
});
