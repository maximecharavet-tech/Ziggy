import { describe, expect, it } from 'vitest';
import { PEEK_AFTER, tapSpot, tickle } from './catch';
import { makeRng } from './rand';
import { ROOMS } from './rooms';
import { reduce, startRoom } from './session';
import { BANDS, ELF_IDS, FACES } from './types';

const SPOTS = [
  { id: 'a', at: [0, 0, 0] as [number, number, number] },
  { id: 'b', at: [1, 0, 0] as [number, number, number] },
  { id: 'c', at: [5, 0, 0] as [number, number, number] },
];

describe('the catch', () => {
  it('a tickle always catches, with that elf’s funny reaction and a high five', () => {
    for (const elf of ELF_IDS)
      for (let seed = 0; seed < 500; seed++) {
        const r = tickle(elf, makeRng(seed));
        expect(r.caught).toBe(true);
        expect(r.reaction.who).toBe(elf);
        expect(r.reaction.moment).toBe('caught');
        expect(r.reaction.anim).toBeTruthy();
        expect(FACES).toContain(r.reaction.face);
        expect(r.ziggy.moment).toBe('high-five');
      }
  });

  it('reactions vary with the seed (funny reaction pick)', () => {
    const ids = new Set(Array.from({ length: 50 }, (_, s) => tickle('pepin', makeRng(s)).reaction.id));
    expect(ids.size).toBeGreaterThan(1);
  });

  it('the right hiding place is found; a wrong one gives a gag, warm/cold and a growing wiggle', () => {
    expect(tapSpot({ tapped: 'c', hideSpot: 'c', spots: SPOTS, misses: 0, band: 'big', rng: makeRng(1) }).found).toBe(true);
    const m1 = tapSpot({ tapped: 'a', hideSpot: 'c', spots: SPOTS, misses: 0, band: 'big', rng: makeRng(1) });
    const m2 = tapSpot({ tapped: 'b', hideSpot: 'c', spots: SPOTS, misses: 1, previous: 'a', band: 'big', rng: makeRng(2) });
    if (m1.found || m2.found) throw new Error('expected misses');
    expect(m1.gag.moment).toBe('miss');
    expect(m2.heat).toBe('warmer');
    expect(m2.wiggle.strength).toBeGreaterThan(m1.wiggle.strength);
    expect(m1.peek).toBe(false);
    expect(m2.peek).toBe(true); // the elf peeks out after two misses
  });

  it('little ones: the elf peeks out at once', () => {
    expect(PEEK_AFTER.little).toBe(0);
    const m = tapSpot({ tapped: 'a', hideSpot: 'c', spots: SPOTS, misses: 0, band: 'little', rng: makeRng(1) });
    expect(!m.found && m.peek).toBe(true);
  });

  it('in a room, tickling a spotted prank’s elf catches it in every band, whatever happened before', () => {
    for (const room of ROOMS)
      for (const band of BANDS) {
        let s = startRoom(room, band, 11);
        const p = s.pranks[0];
        s = reduce(s, { type: 'tap-prop', prop: p.hotspots[0] }, room).session;
        // a few wrong guesses first: never a failure
        s = reduce(s, { type: 'tap-spot', prank: p.id, spot: room.hidingSpots.find((h) => h.id !== p.hideSpot)!.id }, room).session;
        const r = reduce(s, { type: 'tickle', prank: p.id }, room);
        expect(r.session.pranks[0].phase, `${room.id} ${band}`).toBe('caught');
        expect(r.events.some((e) => e.type === 'caught')).toBe(true);
        expect(r.events.some((e) => e.type === 'puzzle')).toBe(true);
      }
  });
});
