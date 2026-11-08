import { describe, expect, it } from 'vitest';
import { fitOrtho, fitSphereDistance, heroView, orbit, packRow, sheetViews, stageCamera, YAW_BACK, YAW_THREE_QUARTER } from './framing';

describe('orbit', () => {
  const t = { x: 1, y: 0.5, z: -2 };
  it('azimuth 0 / elevation 0 is straight in front', () => {
    const p = orbit(t, 0, 0, 3);
    expect(p.x).toBeCloseTo(1);
    expect(p.y).toBeCloseTo(0.5);
    expect(p.z).toBeCloseTo(1);
  });

  it('keeps the distance, turns toward +x, rises with elevation', () => {
    const p = orbit(t, 90, 30, 2);
    expect(Math.hypot(p.x - t.x, p.y - t.y, p.z - t.z)).toBeCloseTo(2);
    expect(p.x).toBeGreaterThan(t.x);
    expect(p.y).toBeCloseTo(t.y + 1);
  });

  it('survives junk input', () => {
    const p = orbit(t, Number.NaN, 500, -1);
    for (const v of [p.x, p.y, p.z]) expect(Number.isFinite(v)).toBe(true);
    expect(p.y).toBeGreaterThan(t.y);
  });
});

describe('fitSphereDistance', () => {
  it('backs off further on a tall screen', () => {
    expect(fitSphereDistance(1, 30, 390 / 844)).toBeGreaterThan(fitSphereDistance(1, 30, 16 / 9));
  });
  it('fits the sphere exactly on a square screen', () => {
    expect(fitSphereDistance(1, 60, 1)).toBeCloseTo(2);
  });
});

describe('stageCamera', () => {
  it('fills defaults and clamps ranges', () => {
    expect(stageCamera()).toEqual({ azimuth: 0, elevation: 12, zoom: 1 });
    expect(stageCamera({ azimuth: 400, elevation: -40, zoom: 100 })).toEqual({ azimuth: 180, elevation: -5, zoom: 4 });
    expect(stageCamera({ zoom: Number.NaN }).zoom).toBe(1);
  });
});

describe('sheetViews', () => {
  it('lines the three elves up in the fixed order', () => {
    expect(sheetViews({ kind: 'lineup' }).map((v) => v.elf)).toEqual(['pepin', 'grelotte', 'noisette']);
    expect(sheetViews({ kind: 'lineup' }).every((v) => v.yaw === 0)).toBe(true);
    expect(sheetViews({ kind: 'lineup34' }).every((v) => v.yaw === YAW_THREE_QUARTER)).toBe(true);
  });
  it('turns one elf front, 3/4 and back', () => {
    const v = sheetViews({ kind: 'turnaround', elf: 'grelotte' });
    expect(v.map((x) => x.elf)).toEqual(['grelotte', 'grelotte', 'grelotte']);
    expect(v.map((x) => x.yaw)).toEqual([0, YAW_THREE_QUARTER, YAW_BACK]);
  });
});

describe('packRow', () => {
  it('places silhouettes side by side with the gap, centred', () => {
    const xs = packRow(
      [
        { min: -0.3, max: 0.5 },
        { min: -0.25, max: 0.25 },
        { min: -0.1, max: 0.1 },
      ],
      0.1
    );
    // Right edge of one + gap = left edge of the next.
    expect(xs[0] + 0.5 + 0.1).toBeCloseTo(xs[1] - 0.25);
    expect(xs[1] + 0.25 + 0.1).toBeCloseTo(xs[2] - 0.1);
    // Centred: leftmost edge and rightmost edge are symmetric.
    expect(xs[0] - 0.3).toBeCloseTo(-(xs[2] + 0.1));
  });
  it('handles an empty row', () => {
    expect(packRow([], 0.1)).toEqual([]);
  });
});

describe('fitOrtho', () => {
  it('keeps the image aspect and shows the whole box with its margin', () => {
    const box = { minX: -1, maxX: 1, minY: 0, maxY: 1 };
    const f = fitOrtho(box, 1.5, 0.05);
    expect((f.right - f.left) / (f.top - f.bottom)).toBeCloseTo(1.5);
    expect(f.left).toBeLessThanOrEqual(-1.1 + 1e-9);
    expect(f.right).toBeGreaterThanOrEqual(1.1 - 1e-9);
    expect(f.bottom).toBeLessThan(0);
    expect(f.top).toBeGreaterThan(1);
  });
  it('a tall box in a wide image grows the width', () => {
    const f = fitOrtho({ minX: 0, maxX: 0.5, minY: 0, maxY: 2 }, 1.5, 0);
    expect(f.top - f.bottom).toBeCloseTo(2);
    expect(f.right - f.left).toBeCloseTo(3);
  });
});

describe('heroView', () => {
  const focus = { x: 0.35, y: 0.62, z: 0.35 };
  it('sees the whole group on a phone and on a wide screen', () => {
    for (const aspect of [390 / 844, 390 / 557, 16 / 9]) {
      const v = heroView(aspect, focus, 3.5, 1.45);
      const d = v.pos.z - focus.z;
      const halfV = d * Math.tan((v.fov * Math.PI) / 360);
      // The group's half width fits the horizontal half view.
      expect(halfV * aspect).toBeGreaterThanOrEqual(1.75 * 0.999);
      expect(v.fov).toBeGreaterThan(20);
      expect(v.fov).toBeLessThan(60);
    }
  });
  it('phones look up more (tree and window above the elves)', () => {
    const phone = heroView(390 / 844, focus, 3.5, 1.45);
    const wide = heroView(16 / 9, focus, 3.5, 1.45);
    expect(phone.target.y - phone.pos.y).toBeGreaterThan(wide.target.y - wide.pos.y);
  });
});
