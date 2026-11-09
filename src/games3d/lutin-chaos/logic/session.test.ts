import { describe, expect, it } from 'vitest';
import { FIXES } from './fixes';
import { makeRng, pick } from './rand';
import { perfectRun, playSeed, replay, sessionHash } from './replay';
import { referenceState } from './room-def';
import { ROOMS, roomById } from './rooms';
import { sameRoom } from './room-state';
import { reduce, resumeRoom, snapshot, startRoom, type ChaosAction, type RoomSession } from './session';
import { BANDS, ELF_IDS } from './types';

const kitchen = roomById('chaos.kitchen')!;

describe('room session', () => {
  it('same seed → same pranks, culprits, clues, hiding places and puzzles (determinism)', () => {
    for (const room of ROOMS)
      for (const band of BANDS) {
        const seed = playSeed(room.id, 0);
        expect(sessionHash(startRoom(room, band, seed))).toBe(sessionHash(startRoom(room, band, seed)));
        const acts = perfectRun(room, band, seed);
        const a = replay(room, band, seed, acts);
        const b = replay(room, band, seed, acts);
        expect(sessionHash(a.session)).toBe(sessionHash(b.session));
        expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
        expect(a.session.phase).toBe('done');
        expect(sameRoom(a.session.state, referenceState(room))).toBe(true);
      }
  });

  it('replays reshuffle the pranks (different seed per play)', () => {
    for (const room of ROOMS)
      for (const band of BANDS) {
        const picks = new Set(Array.from({ length: 12 }, (_, plays) => startRoom(room, band, playSeed(room.id, plays)).pranks.map((p) => `${p.id}:${p.culprit}`).sort().join()));
        expect(picks.size, `${room.id} ${band}`).toBeGreaterThan(1);
      }
    expect(playSeed('chaos.kitchen', 0)).not.toBe(playSeed('chaos.kitchen', 1));
    expect(playSeed('chaos.kitchen', 0, 1)).not.toBe(playSeed('chaos.kitchen', 0, 2));
  });

  it('pick counts follow the band and every elf gets a prank', () => {
    for (const room of ROOMS)
      for (const band of BANDS)
        for (let seed = 0; seed < 10; seed++) {
          const s = startRoom(room, band, seed);
          expect(s.pranks.length).toBe(room.bands[band].pickCount);
          for (const e of ELF_IDS) expect(s.pranks.some((p) => p.culprit === e)).toBe(true);
        }
  });

  it('tonight’s prank from the parents’ planner is featured and Ziggy says so', () => {
    for (let seed = 0; seed < 20; seed++) {
      const s = startRoom(kitchen, 'little', seed, { nightPrankId: 'chaussettes' });
      const p = s.pranks.find((x) => x.id === 'socks-in-fridge');
      expect(p?.fromTonight).toBe(true);
      const r = reduce(s, { type: 'tap-prop', prop: p!.hotspots[0] }, kitchen);
      expect(r.events.some((e) => e.type === 'say' && e.line.moment === 'tonight')).toBe(true);
    }
    // an unknown id changes nothing
    expect(startRoom(kitchen, 'little', 3, { nightPrankId: 'zzz' }).pranks.every((p) => !p.fromTonight)).toBe(true);
  });

  it('little ones: the elf peeks out as soon as the prank is spotted', () => {
    const s = startRoom(kitchen, 'little', 1);
    const p = s.pranks[0];
    const r = reduce(s, { type: 'tap-prop', prop: p.hotspots[0] }, kitchen);
    expect(r.events.some((e) => e.type === 'peek')).toBe(true);
    expect(r.events.some((e) => e.type === 'clues')).toBe(false);
    expect(r.session.pranks[0]).toMatchObject({ phase: 'found', peeking: true });
  });

  it('naming the wrong elf: that elf giggles "not me", a clue explains why; after two names the culprit peeks', () => {
    let s = startRoom(kitchen, 'middle', 2);
    const p = s.pranks[0];
    s = reduce(s, { type: 'tap-prop', prop: p.hotspots[0] }, kitchen).session;
    const others = ELF_IDS.filter((e) => e !== p.culprit);
    let r = reduce(s, { type: 'name-elf', prank: p.id, elf: others[0] }, kitchen);
    expect(r.events.some((e) => e.type === 'say' && e.line.moment === 'not-me' && e.line.who === others[0])).toBe(true);
    expect(r.events.find((e) => e.type === 'eliminate')).toMatchObject({ elf: others[0] });
    expect(r.session.pranks[0].phase).toBe('spotted');
    r = reduce(r.session, { type: 'name-elf', prank: p.id, elf: others[1] }, kitchen);
    expect(r.session.pranks[0]).toMatchObject({ phase: 'found', peeking: true });
  });

  it('wrong fix answers give hints with the elf’s blame; the answer then fixes the room', () => {
    let s = startRoom(kitchen, 'big', 5);
    const p = s.pranks[0];
    s = reduce(s, { type: 'tap-prop', prop: p.hotspots[0] }, kitchen).session;
    s = reduce(s, { type: 'tickle', prank: p.id }, kitchen).session;
    const wrong = FIXES[p.puzzle.fix].wrong(p.puzzle, makeRng(1));
    for (let i = 0; i < 4; i++) {
      const r = reduce(s, { type: 'answer', prank: p.id, answer: wrong }, kitchen);
      expect(r.events.some((e) => e.type === 'hint')).toBe(true);
      expect(r.events.some((e) => e.type === 'say' && e.line.moment === 'fix-oops' && e.line.who === p.culprit)).toBe(true);
      s = r.session;
    }
    const r = reduce(s, { type: 'answer', prank: p.id, answer: FIXES[p.puzzle.fix].solve(p.puzzle) }, kitchen);
    expect(r.session.pranks[0].phase).toBe('fixed');
    expect(r.events.some((e) => e.type === 'healed')).toBe(true);
    for (const c of p.record.changes) expect(r.session.state.props[c.prop][c.field]).toBe(c.from);
  });

  it('a random, clumsy child never breaks anything and can always finish (no failure state)', () => {
    for (const room of ROOMS)
      for (const band of BANDS) {
        const rng = makeRng(room.number * 7 + band.length);
        let s: RoomSession = startRoom(room, band, 99);
        const doIt = (a: ChaosAction) => (s = reduce(s, a, room).session);
        for (const p of s.pranks) {
          doIt({ type: 'tap-prop', prop: pick(rng, room.props).id });
          doIt({ type: 'answer', prank: p.id, answer: 'too-early' });
          doIt({ type: 'tap-prop', prop: p.hotspots[0] });
          doIt({ type: 'tap-prop', prop: p.hotspots[0] });
          doIt({ type: 'name-elf', prank: p.id, elf: pick(rng, ELF_IDS) });
          doIt({ type: 'tap-spot', prank: p.id, spot: pick(rng, room.hidingSpots).id });
          doIt({ type: 'magnifier' });
          doIt({ type: 'tickle', prank: p.id });
          doIt({ type: 'answer', prank: p.id, answer: FIXES[p.puzzle.fix].wrong(p.puzzle, rng) });
          doIt({ type: 'answer', prank: p.id, answer: null });
          doIt({ type: 'answer', prank: p.id, answer: FIXES[p.puzzle.fix].solve(p.puzzle) });
        }
        expect(s.phase, `${room.id} ${band}`).toBe('finale');
        doIt({ type: 'photo' }); // too early: ignored
        if (s.finale!.predictAt !== null) doIt({ type: 'finale-predict', step: pick(rng, s.finale!.predictOptions) });
        for (const st of s.finale!.steps) doIt({ type: 'finale-tap', step: st.id }); // play order = wrong order, gently glows
        for (const st of [...s.finale!.steps].reverse()) doIt({ type: 'finale-tap', step: st.id });
        expect(s.phase).toBe('photo');
        const end = reduce(s, { type: 'photo' }, room);
        expect(end.session.phase).toBe('done');
        const done = end.events.find((e) => e.type === 'room-done');
        expect(done && done.type === 'room-done' && done.result.pranksFixed).toBe(room.bands[band].pickCount);
        expect(sameRoom(end.session.state, referenceState(room))).toBe(true);
      }
  });

  it('save after every prank and resume: same pranks, fixed ones stay tidy', () => {
    const room = kitchen;
    let s = startRoom(room, 'middle', 42, { nightPrankId: 'chaussettes' });
    const p = s.pranks[1];
    for (const a of [
      { type: 'tap-prop', prop: p.hotspots[0] },
      { type: 'tickle', prank: p.id },
      { type: 'answer', prank: p.id, answer: FIXES[p.puzzle.fix].solve(p.puzzle) },
    ] as ChaosAction[])
      s = reduce(s, a, room).session;
    const snap = JSON.parse(JSON.stringify(snapshot(s, 'chaussettes')));
    const back = resumeRoom(room, snap);
    expect(back.pranks.map((x) => x.id)).toEqual(s.pranks.map((x) => x.id));
    expect(back.pranks[1].phase).toBe('fixed');
    expect(back.state).toEqual(s.state);
  });

  it('sessions are plain JSON', () => {
    const s = startRoom(kitchen, 'big', 1);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
