import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { rng } from '../../kit/rng';
import { MIN_HOTSPOT_PX, checkLayout, layoutHotspots, multiplyMat4, overlaps, projectBox, projectPoint, type Rect } from './hotspot-rects';

function cameraMatrix(w: number, h: number, pos: [number, number, number] = [0, 2, 8], look: [number, number, number] = [0, 0.5, 0]) {
  const cam = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  cam.position.set(...pos);
  cam.lookAt(...look);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return { cam, m: multiplyMat4(cam.projectionMatrix.elements, cam.matrixWorldInverse.elements) };
}

describe('hotspot projection maths', () => {
  it('multiplyMat4 matches three.js', () => {
    const { cam, m } = cameraMatrix(1280, 800);
    const ref = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    for (let i = 0; i < 16; i++) expect(m[i]).toBeCloseTo(ref.elements[i], 9);
  });

  it('projectPoint agrees with Vector3.project (pixels, y down)', () => {
    const vp = { w: 1280, h: 800 };
    const { cam, m } = cameraMatrix(vp.w, vp.h);
    for (const p of [
      [0, 0.5, 0],
      [1.5, 0.2, -1],
      [-2, 1.4, 1],
    ] as const) {
      const ours = projectPoint(m, p[0], p[1], p[2], vp)!;
      const v = new THREE.Vector3(...p).project(cam);
      expect(ours.x).toBeCloseTo((v.x + 1) * 0.5 * vp.w, 6);
      expect(ours.y).toBeCloseTo((1 - v.y) * 0.5 * vp.h, 6);
      expect(ours.depth).toBeCloseTo(v.z, 6);
    }
    // The look-at point is at the screen centre.
    const c = projectPoint(m, 0, 0.5, 0, vp)!;
    expect(c.x).toBeCloseTo(640, 6);
    expect(c.y).toBeCloseTo(400, 6);
  });

  it('projectBox: centred around the projected centre, null behind or off screen', () => {
    const vp = { w: 390, h: 844 };
    const { m } = cameraMatrix(vp.w, vp.h);
    const r = projectBox(m, [0, 0.5, 0], [0.5, 0.5, 0.5], vp)!;
    expect(r.x + r.w / 2).toBeCloseTo(195, 0);
    expect(r.w).toBeGreaterThan(20);
    expect(projectBox(m, [0, 0.5, 20], [0.5, 0.5, 0.5], vp)).toBeNull(); // behind the camera
    expect(projectBox(m, [60, 0.5, 0], [0.5, 0.5, 0.5], vp)).toBeNull(); // far off to the side
  });

  it('a closer object projects bigger', () => {
    const vp = { w: 1280, h: 800 };
    const { m } = cameraMatrix(vp.w, vp.h);
    const far = projectBox(m, [0, 0.5, -4], [0.3, 0.3, 0.3], vp)!;
    const near = projectBox(m, [0, 0.5, 4], [0.3, 0.3, 0.3], vp)!;
    expect(near.w).toBeGreaterThan(far.w);
  });
});

describe('hotspot layout', () => {
  const vp = { w: 390, h: 844 };

  it('grows tiny targets to ≥ 64 px around their centre', () => {
    const [l] = layoutHotspots([{ id: 'sock', rect: { x: 100, y: 200, w: 10, h: 12 } }], vp);
    expect(l.rect.w).toBe(MIN_HOTSPOT_PX);
    expect(l.rect.h).toBe(MIN_HOTSPOT_PX);
    expect(l.rect.x + l.rect.w / 2).toBeCloseTo(105, 6);
    expect(l.rect.y + l.rect.h / 2).toBeCloseTo(206, 6);
  });

  it('caps huge targets (a near object must not cover the screen) and keeps them inside', () => {
    const [l] = layoutHotspots([{ id: 'wall', rect: { x: -500, y: -500, w: 2000, h: 2000 } }], vp);
    expect(l.rect.w).toBeLessThanOrEqual(390 * 0.45 + 1e-9);
    expect(l.rect.x).toBeGreaterThanOrEqual(0);
    expect(l.rect.y).toBeGreaterThanOrEqual(0);
    expect(l.rect.x + l.rect.w).toBeLessThanOrEqual(vp.w);
  });

  it('clamps targets at the edges into the viewport', () => {
    const [a, b] = layoutHotspots(
      [
        { id: 'a', rect: { x: -20, y: -20, w: 30, h: 30 } },
        { id: 'b', rect: { x: 380, y: 830, w: 30, h: 30 } },
      ],
      vp
    );
    expect(a.rect).toEqual({ x: 0, y: 0, w: 64, h: 64 });
    expect(b.rect.x + b.rect.w).toBeLessThanOrEqual(vp.w);
    expect(b.rect.y + b.rect.h).toBeLessThanOrEqual(vp.h);
  });

  it('separates two objects projected to the same point', () => {
    const laid = layoutHotspots(
      [
        { id: 'a', rect: { x: 190, y: 400, w: 4, h: 4 } },
        { id: 'b', rect: { x: 190, y: 400, w: 4, h: 4 } },
      ],
      vp
    );
    expect(checkLayout(laid).ok).toBe(true);
    expect(overlaps(laid[0].rect, laid[1].rect)).toBe(false);
  });

  it('no overlap and min size for a crowded but feasible room (seeded, many runs)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const r = rng(seed);
      const view = seed % 2 ? { w: 1280, h: 800 } : { w: 390, h: 844 };
      const items = Array.from({ length: 10 }, (_, i) => ({ id: `h${i}`, rect: { x: r() * view.w, y: r() * view.h, w: 5 + r() * 80, h: 5 + r() * 80 } as Rect }));
      const laid = layoutHotspots(items, view);
      const check = checkLayout(laid);
      expect(check.problems, `seed ${seed}`).toEqual([]);
      for (const l of laid) {
        expect(l.rect.x).toBeGreaterThanOrEqual(0);
        expect(l.rect.y).toBeGreaterThanOrEqual(0);
        expect(l.rect.x + l.rect.w).toBeLessThanOrEqual(view.w + 1e-6);
        expect(l.rect.y + l.rect.h).toBeLessThanOrEqual(view.h + 1e-6);
      }
    }
  });

  it('end to end: a real scene projected at both test sizes gives valid targets', () => {
    for (const view of [
      { w: 1280, h: 800 },
      { w: 390, h: 844 },
    ]) {
      const { m } = cameraMatrix(view.w, view.h);
      const objects: [number, number, number][] = [
        [-1.2, 0.5, 0],
        [1.4, 0.35, 0.4],
        [1.45, 0.3, 0.45], // nearly on top of the previous one
        [0, 0.1, 1.5],
      ];
      const laid = layoutHotspots(
        objects.map((o, i) => ({ id: `o${i}`, rect: projectBox(m, o, [0.2, 0.2, 0.2], view) })),
        view
      );
      expect(laid.every((l) => l.visible)).toBe(true);
      expect(checkLayout(laid).problems).toEqual([]);
    }
  });

  it('hidden items stay hidden and are ignored by the separation', () => {
    const laid = layoutHotspots(
      [
        { id: 'a', rect: null },
        { id: 'b', rect: { x: 10, y: 10, w: 10, h: 10 } },
      ],
      vp
    );
    expect(laid[0].visible).toBe(false);
    expect(laid[1].visible).toBe(true);
  });

  it('is deterministic', () => {
    const items = [
      { id: 'a', rect: { x: 100, y: 100, w: 20, h: 20 } },
      { id: 'b', rect: { x: 110, y: 105, w: 20, h: 20 } },
      { id: 'c', rect: { x: 105, y: 110, w: 20, h: 20 } },
    ];
    expect(layoutHotspots(items, vp)).toEqual(layoutHotspots(items, vp));
  });
});
