import { describe, expect, it } from 'vitest';
import { makeTurnDetector } from './listen';

const run = (levels: number[]) => {
  const d = makeTurnDetector({ stepMs: 50, noise: 0.01 });
  return levels.map((l) => d(l));
};

describe('turn detector', () => {
  it('waits in silence', () => {
    expect(run(Array(40).fill(0.005)).every((s) => s === 'wait')).toBe(true);
  });
  it('ignores a short click', () => {
    expect(run([0.3, 0.3, ...Array(30).fill(0.005)]).includes('speaking')).toBe(false);
  });
  it('hears an answer and ends after a second of silence', () => {
    const out = run([...Array(20).fill(0.2), ...Array(25).fill(0.005)]);
    expect(out).toContain('speaking');
    expect(out.at(-1)).toBe('done');
    expect(out.indexOf('done')).toBe(20 + 19);
  });
  it('counts real time, not timer ticks (slowed timers)', () => {
    const d = makeTurnDetector({ stepMs: 50, noise: 0.01 });
    expect(d(0.2, 300)).toBe('speaking');
    expect(d(0.005, 600)).toBe('speaking');
    expect(d(0.005, 600)).toBe('done');
  });
  it('a short pause mid-sentence does not end the turn', () => {
    const out = run([...Array(10).fill(0.2), ...Array(10).fill(0.005), ...Array(10).fill(0.2)]);
    expect(out).not.toContain('done');
  });
});
