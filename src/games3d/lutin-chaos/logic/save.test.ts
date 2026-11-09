import { describe, expect, it } from 'vitest';
import { ROOM_IDS } from './rooms';
import { costumeFor, freshSave, openRooms, parseSave, recordRoomDone, saveLayout, saveProgress, SAVE_KEY, serializeSave } from './save';
import type { RoomResult } from './session';

const result = (roomId: string): RoomResult => ({ roomId, band: 'middle', skill: 'counting', skills: ['counting'], goals: ['counting'], pranksFixed: 4, tries: 5, hints: 1 });

describe('save model (device only, versioned)', () => {
  it('uses the architecture key format', () => {
    expect(SAVE_KEY).toBe('ziggy:game:lutin-chaos:v1');
  });

  it('round-trips', () => {
    let s = freshSave(123);
    s = saveProgress(s, { roomId: 'chaos.kitchen', band: 'big', seed: 9, night: 'chaussettes', fixed: ['socks-in-fridge'] });
    s = saveLayout(s, { roomId: 'chaos.hall', elves: { pepin: 'curtain' }, pranks: [] });
    expect(parseSave(serializeSave(s))).toEqual(s);
  });

  it('never throws on garbage: fresh save instead', () => {
    for (const raw of [null, undefined, '', 'nope', '[]', '42', '{"v":99}', '{"v":1,"rooms":"x","album":[1,2],"costumes":[3]}', '{']) {
      const s = parseSave(raw as string | null, 7);
      expect(s.v).toBe(1);
      expect(s.rooms).toEqual({});
      expect(s.album).toEqual([]);
    }
  });

  it('cleans bad fields but keeps good ones', () => {
    const s = parseSave(JSON.stringify({ v: 1, salt: 5, rooms: { 'chaos.hall': { done: true, plays: 2, bands: ['little', 'mega'] }, bad: 3 }, current: { roomId: 1 }, costumes: ['a', 'a', 2] }));
    expect(s.rooms).toEqual({ 'chaos.hall': { done: true, plays: 2, bands: ['little'] } });
    expect(s.current).toBeNull();
    expect(s.costumes).toEqual(['a']);
    expect(s.salt).toBe(5);
  });

  it('migrates the v0 prototype save', () => {
    const s = parseSave(JSON.stringify({ done: ['chaos.hall', 'chaos.kitchen'] }));
    expect(s.v).toBe(1);
    expect(s.rooms['chaos.kitchen']).toEqual({ done: true, plays: 1, bands: [] });
  });

  it('finishing a room: progress, album photo, costume piece (once)', () => {
    let s = recordRoomDone(freshSave(), result('chaos.kitchen'), 77);
    s = recordRoomDone(s, result('chaos.kitchen'), 78);
    expect(s.rooms['chaos.kitchen']).toEqual({ done: true, plays: 2, bands: ['middle'] });
    expect(s.album.map((a) => a.seed)).toEqual([77, 78]);
    expect(s.costumes).toEqual([costumeFor('chaos.kitchen')]);
    expect(s.current).toBeNull();
  });

  it('the house opens in small sets: always 2–3 new rooms, the finale after 8 rooms or on Christmas Eve', () => {
    let s = freshSave();
    const fresh = (x: typeof s) => openRooms(x, ROOM_IDS).filter((id) => !x.rooms[id]?.done);
    expect(openRooms(s, ROOM_IDS)).toEqual(ROOM_IDS.slice(0, 3));
    expect(openRooms(s, ROOM_IDS, { christmasEve: true })).toContain('chaos.christmas-eve');
    for (let i = 0; i < 14; i++) {
      const choices = fresh(s);
      expect(choices.length).toBeGreaterThanOrEqual(1);
      if (i < 12) expect(choices.length).toBeGreaterThanOrEqual(2);
      // the child may pick any open room, e.g. the last offered one
      const pickId = choices.filter((id) => id !== 'chaos.christmas-eve').at(-1) ?? choices[0];
      s = recordRoomDone(s, result(pickId), i);
      if (i + 1 >= 8) expect(openRooms(s, ROOM_IDS)).toContain('chaos.christmas-eve');
      else expect(openRooms(s, ROOM_IDS)).not.toContain('chaos.christmas-eve');
    }
  });
});
