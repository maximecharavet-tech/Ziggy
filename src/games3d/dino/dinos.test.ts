import { describe, expect, it } from 'vitest';
import { DINOS, DINO_INFO } from './logic';
import { buildPieces } from './dinos';

/**
 * The bones the child compares ("the biggest / the smallest") are drawn to
 * scale from these models: the sizes written in the logic must match them.
 */
describe('Ziggy the Dino Digger — skeleton models', () => {
  it('builds every piece of every dinosaur, centred on itself', () => {
    for (const d of DINOS) {
      const pieces = buildPieces(d);
      expect(pieces.map((p) => p.id).sort()).toEqual([...DINO_INFO[d].pieces].sort());
      for (const p of pieces) {
        expect(p.geometry.attributes.position.count).toBeGreaterThan(30);
        expect(p.geometry.attributes.color).toBeTruthy();
        const c = p.geometry.boundingBox!.getCenter(p.slot.clone());
        expect(c.length()).toBeLessThan(1e-3);
        // Feet stay above the ground.
        expect(p.slot.y - p.h / 2).toBeGreaterThan(-0.05);
      }
    }
  });

  it('matches the sizes used for the questions', () => {
    for (const d of DINOS) {
      const pieces = buildPieces(d);
      for (const p of pieces) {
        const want = DINO_INFO[d].sizes[p.id]!;
        expect(Math.abs(p.size - want) / want, `${d} ${p.id}: model ${p.size.toFixed(2)} vs logic ${want}`).toBeLessThan(0.12);
      }
    }
  });
});
