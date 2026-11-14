import { describe, expect, it } from 'vitest';
import { DiscreteTicker, FixedStepLoop, MAX_SUBSTEPS, STEP } from './loop';
import { rng } from '../kit/rng';

function recorder() {
  const log: string[] = [];
  let steps = 0;
  const loop = new FixedStepLoop({
    fixedUpdate: (_s, tick) => {
      log.push(`f${tick}`);
      steps++;
    },
    update: (dt, alpha) => log.push(`u${dt.toFixed(4)}:${alpha.toFixed(3)}`),
  });
  return { loop, log, steps: () => steps };
}

describe('FixedStepLoop', () => {
  it('runs exactly 60 steps for 60 frames of 1/60 s (no float drift)', () => {
    const { loop, steps } = recorder();
    for (let i = 0; i < 60; i++) loop.advance(1 / 60);
    expect(steps()).toBe(60);
    expect(loop.tick).toBe(60);
  });

  it('accumulates small frames and reports the interpolation alpha', () => {
    const { loop } = recorder();
    const a = loop.advance(STEP / 2);
    expect(a.steps).toBe(0);
    expect(a.alpha).toBeCloseTo(0.5, 6);
    const b = loop.advance(STEP * 0.75);
    expect(b.steps).toBe(1);
    expect(b.alpha).toBeCloseTo(0.25, 6);
  });

  it('is deterministic: the same frame deltas give the same step/update sequence', () => {
    const run = () => {
      const r = rng(42);
      const { loop, log } = recorder();
      for (let i = 0; i < 500; i++) loop.advance(0.004 + r() * 0.05);
      return log.join('|');
    };
    expect(run()).toBe(run());
  });

  it('total steps ≈ total time / STEP for any frame pattern under the clamp', () => {
    const r = rng(7);
    const { loop } = recorder();
    let total = 0;
    for (let i = 0; i < 1000; i++) {
      const dt = 0.005 + r() * 0.06;
      total += dt;
      loop.advance(dt);
    }
    expect(Math.abs(loop.tick - total / STEP)).toBeLessThanOrEqual(1);
  });

  it('clamps a huge frame (tab back from background) and caps substeps', () => {
    const { loop } = recorder();
    const r = loop.advance(5);
    expect(r.dt).toBeCloseTo(0.1, 9);
    expect(r.steps).toBe(MAX_SUBSTEPS);
    // The backlog is dropped, not replayed later.
    expect(loop.advance(0).steps).toBe(0);
  });

  it('ignores bad deltas and does nothing while paused', () => {
    const { loop, log } = recorder();
    loop.advance(NaN);
    loop.advance(-1);
    expect(loop.tick).toBe(0);
    loop.paused = true;
    loop.advance(1);
    expect(loop.tick).toBe(0);
    expect(log.filter((l) => l.startsWith('u')).length).toBe(2);
  });

  it('timeScale speeds the simulation up; stepOnce works while paused', () => {
    const { loop } = recorder();
    loop.timeScale = 2;
    loop.advance(STEP);
    expect(loop.tick).toBe(2);
    loop.paused = true;
    loop.stepOnce();
    expect(loop.tick).toBe(3);
  });
});

describe('DiscreteTicker', () => {
  it('fires one tick per tickSeconds, doubled at ×2, and only while running', () => {
    const ticks: number[] = [];
    const t = new DiscreteTicker((n) => ticks.push(n), 0.5);
    for (let i = 0; i < 60; i++) t.advance(STEP);
    expect(ticks).toEqual([]);
    t.running = true;
    for (let i = 0; i < 60; i++) t.advance(STEP); // 1 s
    expect(ticks).toEqual([0, 1]);
    t.speed = 2;
    for (let i = 0; i < 60; i++) t.advance(STEP);
    expect(ticks).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('progress grows within a tick; stepOnce fires now and restarts the timer', () => {
    const ticks: number[] = [];
    const t = new DiscreteTicker((n) => ticks.push(n), 0.5);
    t.running = true;
    t.advance(0.25);
    expect(t.progress).toBeCloseTo(0.5, 6);
    t.stepOnce();
    expect(ticks).toEqual([0]);
    expect(t.progress).toBe(0);
    t.reset();
    expect(t.ticks).toBe(0);
  });
});
