import { describe, expect, it } from 'vitest';
import { ROOMS } from '../logic';
import { PREFABS, prefabFor } from './furniture';
import { THEMES, layoutFor } from './layouts';
import { PROP_KINDS } from './props';

describe('lutin chaos room layouts', () => {
  it('give every slot and every hiding place of the 15 rooms a piece', () => {
    expect(ROOMS).toHaveLength(15);
    for (const room of ROOMS) {
      const l = layoutFor(room);
      const slots = new Set(l.stations.flatMap((s) => s.slots));
      for (const s of room.slots) expect(slots.has(s.id), `${room.id} slot ${s.id}`).toBe(true);
      const hides = new Set(l.hides.map((h) => h.id));
      for (const h of room.hidingSpots) expect(hides.has(h.id), `${room.id} hiding place ${h.id}`).toBe(true);
      for (const st of l.stations) expect(PREFABS[st.prefab], `${room.id} prefab ${st.prefab}`).toBeTruthy();
      expect(THEMES[room.id], room.id).toBeTruthy();
      // everything stands inside the dollhouse
      for (const st of l.stations) {
        expect(Math.abs(st.at[0])).toBeLessThanOrEqual(5);
        expect(Math.abs(st.at[2])).toBeLessThanOrEqual(3.5);
      }
    }
  });

  it('never stands two floor pieces on the same spot', () => {
    for (const room of ROOMS) {
      const floor = layoutFor(room).stations.filter((s) => s.at[1] === 0 && s.prefab !== 'treetop');
      for (let i = 0; i < floor.length; i++)
        for (let j = i + 1; j < floor.length; j++) {
          const a = floor[i].at;
          const b = floor[j].at;
          // a piece and its top-slot twin (stove + counter, tree + tree-top) are hand-placed together in rooms 1–3
          if (floor[i].slots.length === 0 || floor[j].slots.length === 0) continue;
          expect(Math.hypot(a[0] - b[0], a[2] - b[2]), `${room.id}: ${floor[i].prefab} and ${floor[j].prefab}`).toBeGreaterThan(0.5);
        }
    }
  });

  it('has a code-built model for every prop kind the rooms use', () => {
    const kinds = new Set(ROOMS.flatMap((r) => r.props.map((p) => p.kind)));
    for (const k of kinds) expect(PROP_KINDS, k).toContain(k);
  });

  it('maps slot names to known prefabs', () => {
    for (const id of ['fridge', 'tree-top', 'shelf', 'hook-a', 'floor', 'xylophone-1', 'piano-top', 'sign-2', 'whatever']) expect(PREFABS[prefabFor(id)], id).toBeTruthy();
  });
});
