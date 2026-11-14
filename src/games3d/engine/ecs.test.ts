import { describe, expect, it } from 'vitest';
import { SoAStore, World, defineComponent, defineTag } from './ecs';

const Pos = defineComponent<{ x: number; y: number }>('Pos');
const Vel = defineComponent<{ x: number; y: number }>('Vel');
const Machine = defineComponent<{ kind: string }>('Machine');
const Locked = defineTag('Locked');

describe('ECS-lite World', () => {
  it('queries entities having all components, in creation order', () => {
    const w = new World();
    const a = w.spawn([Pos, { x: 0, y: 0 }], [Vel, { x: 1, y: 0 }]);
    const b = w.spawn([Pos, { x: 5, y: 5 }]);
    const c = w.spawn([Vel, { x: 0, y: 1 }], [Pos, { x: 1, y: 1 }]);
    expect(w.query(Pos)).toEqual([a, b, c]);
    expect(w.query(Pos, Vel)).toEqual([a, c]);
    expect(w.query(Vel, Pos)).toEqual([a, c]);
    expect(w.query(Machine)).toEqual([]);
  });

  it('caches query results until a structural change', () => {
    const w = new World();
    const a = w.spawn([Pos, { x: 0, y: 0 }]);
    const q1 = w.query(Pos);
    expect(w.query(Pos)).toBe(q1);
    w.set(a, Pos, { x: 3, y: 3 }); // value change only
    expect(w.query(Pos)).toBe(q1);
    const b = w.spawn([Pos, { x: 1, y: 1 }]);
    expect(w.query(Pos)).toEqual([a, b]);
    w.remove(a, Pos);
    expect(w.query(Pos)).toEqual([b]);
    w.destroy(b);
    expect(w.query(Pos)).toEqual([]);
    expect(w.isAlive(b)).toBe(false);
  });

  it('typed get / req / has, tags, and errors on dead entities', () => {
    const w = new World();
    const m = w.spawn([Machine, { kind: 'painter' }], [Locked, true]);
    expect(w.get(m, Machine)?.kind).toBe('painter');
    expect(w.has(m, Locked)).toBe(true);
    expect(() => w.req(m, Pos)).toThrow(/no Pos/);
    w.destroy(m);
    expect(() => w.add(m, Pos, { x: 0, y: 0 })).toThrow(/not alive/);
    // Ids are never reused (stable replays).
    expect(w.create()).toBe(m + 1);
  });

  it('runs systems by phase and order, then registration order', () => {
    const w = new World();
    const log: string[] = [];
    w.addSystem({ name: 'b', phase: 'fixed', order: 1, run: () => log.push('b') });
    w.addSystem({ name: 'a', phase: 'fixed', order: 0, run: () => log.push('a') });
    w.addSystem({ name: 'a2', phase: 'fixed', order: 0, run: () => log.push('a2') });
    const off = w.addSystem({ name: 'v', phase: 'update', run: (_w, dt, alpha) => log.push(`v${dt}:${alpha}`) });
    w.runFixed(1 / 60);
    w.runUpdate(0.5, 0.25);
    off();
    w.runUpdate(0.5, 0.25);
    expect(log).toEqual(['a', 'a2', 'b', 'v0.5:0.25']);
  });

  it('a movement system over Pos+Vel is deterministic', () => {
    const run = () => {
      const w = new World();
      for (let i = 0; i < 50; i++) w.spawn([Pos, { x: i, y: 0 }], [Vel, { x: (i % 3) - 1, y: 1 }]);
      w.addSystem({
        name: 'move',
        phase: 'fixed',
        run: (world, dt) => {
          for (const e of world.query(Pos, Vel)) {
            const p = world.req(e, Pos);
            const v = world.req(e, Vel);
            p.x += v.x * dt;
            p.y += v.y * dt;
          }
        },
      });
      for (let t = 0; t < 120; t++) w.runFixed(1 / 60);
      return w.query(Pos).map((e) => w.req(e, Pos));
    };
    expect(run()).toEqual(run());
  });
});

describe('SoAStore', () => {
  it('stores columns per field and grows by doubling', () => {
    const s = new SoAStore(['x', 'y'] as const, 4);
    s.set(2, 'x', 1.5);
    s.set(10, 'y', 7);
    expect(s.capacity).toBe(16);
    expect(s.get(2, 'x')).toBeCloseTo(1.5);
    expect(s.get(10, 'y')).toBe(7);
    expect(s.get(99, 'x')).toBe(0);
    s.clearRow(10);
    expect(s.col('y')[10]).toBe(0);
  });
});
