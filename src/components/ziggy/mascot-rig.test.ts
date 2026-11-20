import { describe, expect, it } from 'vitest';
import { CUTOUTS } from '@/lib/mascot';
import { CUTOUT_RIGS, FACE_RIG, holesMask, lidBox, polygonCss } from './mascot-rig';
import { bobbleFrames, maySnore, MAX_SNORES, SLEEP_AFTER_MS, SNORE_GAP_MS } from './use-mascot-life';

type Pt = readonly [number, number];

/** Ray-casting point-in-polygon. */
function inside([x, y]: Pt, poly: readonly Pt[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

describe('mascot rig geometry', () => {
  for (const [pose, rig] of Object.entries(CUTOUT_RIGS)) {
    it(`${pose}: matches the picture it was measured on`, () => {
      const pic = CUTOUTS[pose as keyof typeof CUTOUTS];
      expect([rig.w, rig.h]).toEqual([pic.width, pic.height]);
    });

    it(`${pose}: eyes and antennas lie inside the picture`, () => {
      for (const e of rig.eyes) {
        expect(e.cx - e.rx).toBeGreaterThan(0);
        expect(e.cx + e.rx).toBeLessThan(rig.w);
        expect(e.cy - e.ry).toBeGreaterThan(0);
        expect(e.cy + e.ry).toBeLessThan(rig.h);
      }
      for (const a of rig.antennas) for (const [x, y] of [...a.hole, ...a.clip]) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(rig.w);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(rig.h / 3); // antennas are on top of the head
      }
    });

    it(`${pose}: each moving antenna covers its hole (no gap or seam at rest)`, () => {
      for (const a of rig.antennas) {
        // Every hole corner, pulled 1 px toward the hole's centre, is inside the clip.
        const cx = a.hole.reduce((s, p) => s + p[0], 0) / a.hole.length;
        const cy = a.hole.reduce((s, p) => s + p[1], 0) / a.hole.length;
        for (const [x, y] of a.hole) {
          const d = Math.hypot(cx - x, cy - y) || 1;
          expect(inside([x + (cx - x) / d, y + (cy - y) / d], a.clip)).toBe(true);
        }
        // The pivot sits at the bottom of the antenna, where it meets the head.
        const maxY = Math.max(...a.hole.map((p) => p[1]));
        expect(a.pivot[1]).toBeGreaterThan(maxY - 30);
      }
    });
  }

  it('face portrait eyes are inside the square', () => {
    for (const e of FACE_RIG.eyes) {
      expect(e.cx - e.rx).toBeGreaterThan(0);
      expect(e.cx + e.rx).toBeLessThan(FACE_RIG.w);
    }
  });

  it('builds CSS that follows any size (percentages, stretched mask)', () => {
    expect(polygonCss([[0, 0], [717, 964]], 717, 964)).toBe('polygon(0% 0%, 100% 100%)');
    const mask = decodeURIComponent(holesMask([[[1, 1], [2, 2], [1, 2]]], 10, 10));
    expect(mask).toContain("preserveAspectRatio='none'");
    expect(mask).toContain("fill-rule='evenodd'");
    const box = lidBox({ cx: 50, cy: 50, rx: 10, ry: 10, top: '#000', side: '#000' }, 100, 100, 1);
    expect(box).toEqual({ left: '40%', top: '40%', width: '20%', height: '20%' });
  });
});

describe('mascot life rules', () => {
  it('naps only after a long idle and snores rarely', () => {
    expect(SLEEP_AFTER_MS).toBeGreaterThanOrEqual(30_000);
    expect(maySnore(0, -Infinity, 0)).toBe(true);
    expect(maySnore(1, 0, SNORE_GAP_MS - 1)).toBe(false);
    expect(maySnore(1, 0, SNORE_GAP_MS)).toBe(true);
    expect(maySnore(MAX_SNORES, -Infinity, 1e9)).toBe(false);
  });

  it('the antenna bobble is damped and comes back to rest', () => {
    const f = bobbleFrames(10);
    const deg = f.map((s) => Number(/rotate\((-?[\d.]+)deg\)/.exec(s)![1]));
    expect(deg.at(-1)).toBe(0);
    const firstHalf = Math.max(...deg.slice(0, 15).map(Math.abs));
    const secondHalf = Math.max(...deg.slice(15).map(Math.abs));
    expect(secondHalf).toBeLessThan(firstHalf / 2);
    expect(firstHalf).toBeLessThanOrEqual(10);
  });
});
