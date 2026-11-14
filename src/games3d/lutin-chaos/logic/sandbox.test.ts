import { describe, expect, it } from 'vitest';
import { roomById } from './rooms';
import { loadLayout, reduceSandbox, sandboxLayout, startSandbox, type SandboxAction, type SandboxState } from './sandbox';

const room = roomById('chaos.living-room')!;
const run = (s: SandboxState, actions: SandboxAction[]) => {
  const events = [];
  for (const a of actions) {
    const r = reduceSandbox(s, a, room);
    s = r.state;
    events.push(...r.events);
  }
  return { s, events };
};

describe('sandbox « La Maison des Farces » (role flip)', () => {
  it('setup → seeking → celebrate → setup again, Ziggy finds every elf', () => {
    for (let seed = 0; seed < 30; seed++) {
      let { s } = run(startSandbox(room, seed), [
        { type: 'place-elf', elf: 'pepin', spot: 'tree-back' },
        { type: 'place-elf', elf: 'noisette', spot: 'stocking' },
        { type: 'place-elf', elf: 'grelotte', spot: 'stocking' },
        { type: 'add-prank', prankType: 'move-into', params: { props: ['sock-5'], to: 'tree' } },
        { type: 'go' },
      ]);
      expect(s.phase).toBe('seeking');
      let looks = 0;
      while (s.phase === 'seeking' && looks < 20) {
        s = run(s, [{ type: 'ziggy-look' }]).s;
        looks++;
      }
      expect(s.phase).toBe('celebrate');
      expect(looks).toBeLessThanOrEqual(room.hidingSpots.length);
      expect([...s.found].sort()).toEqual(['grelotte', 'noisette', 'pepin']);
      s = run(s, [{ type: 'again' }]).s;
      expect(s.phase).toBe('setup');
      expect(s.elves.pepin).toBe('tree-back'); // the layout is kept
    }
  });

  it('warmer / colder steer Ziggy; a tap on a spot sends him there', () => {
    let { s } = run(startSandbox(room, 1), [{ type: 'place-elf', elf: 'pepin', spot: 'gift-box' }, { type: 'go' }, { type: 'point', spot: 'tree-back' }]);
    expect(s.ziggyAt).toBe('tree-back');
    const at = (id: string) => room.hidingSpots.find((h) => h.id === id)!.at;
    const d = (a: string, b: string) => Math.hypot(at(a)[0] - at(b)[0], at(a)[1] - at(b)[1], at(a)[2] - at(b)[2]);
    const left = room.hidingSpots.map((h) => h.id).filter((id) => id !== 'tree-back');
    const nearest = [...left].sort((a, b) => d('tree-back', a) - d('tree-back', b))[0];
    const r = run(s, [{ type: 'hint', hint: 'warmer' }, { type: 'ziggy-look' }]);
    expect(r.s.ziggyAt).toBe(nearest);
    expect(r.events.some((e) => e.type === 'say' && e.line.moment === 'sandbox-warmer')).toBe(true);
    s = run(s, [{ type: 'hint', hint: 'colder' }, { type: 'ziggy-look' }]).s;
    const farthest = [...left].sort((a, b) => d('tree-back', b) - d('tree-back', a))[0];
    expect(s.ziggyAt).toBe(farthest);
  });

  it('pranks apply to the drawn room; invalid ones are gently refused; removing rebuilds the room', () => {
    let r = run(startSandbox(room, 2), [{ type: 'add-prank', prankType: 'flip', params: { props: ['star-1'], turns: 2 } }]);
    expect(r.s.state.props['star-1'].rot).toBe(2);
    expect(r.events).toContainEqual({ type: 'prank', id: r.s.pranks[0].id, ok: true });
    r = run(r.s, [{ type: 'add-prank', prankType: 'move-into', params: { props: ['nope'], to: 'tree' } }]);
    expect(r.events.some((e) => e.type === 'prank' && !e.ok)).toBe(true);
    expect(r.s.pranks.length).toBe(1);
    r = run(r.s, [{ type: 'remove-prank', id: r.s.pranks[0].id }]);
    expect(r.s.state.props['star-1'].rot).toBe(0);
  });

  it('cannot start searching with no elf hidden; actions out of phase are ignored', () => {
    let { s } = run(startSandbox(room, 3), [{ type: 'go' }, { type: 'ziggy-look' }, { type: 'hint', hint: 'warmer' }]);
    expect(s.phase).toBe('setup');
    s = run(s, [{ type: 'place-elf', elf: 'pepin', spot: 'not-a-spot' }]).s;
    expect(s.elves).toEqual({});
  });

  it('layouts save and load (unknown spots or pranks dropped)', () => {
    const { s } = run(startSandbox(room, 4), [
      { type: 'place-elf', elf: 'grelotte', spot: 'lampshade' },
      { type: 'add-prank', prankType: 'recolour', params: { props: ['bauble-1'], color: 'blue' } },
    ]);
    const layout = JSON.parse(JSON.stringify(sandboxLayout(s)));
    const back = loadLayout(room, layout, 9);
    expect(back.elves).toEqual({ grelotte: 'lampshade' });
    expect(back.state.props['bauble-1'].color).toBe('blue');
    const junk = loadLayout(room, { roomId: room.id, elves: { pepin: 'moon' }, pranks: [{ id: 'x', type: 'warp', params: {} }] }, 1);
    expect(junk.elves).toEqual({});
    expect(junk.pranks).toEqual([]);
  });
});
