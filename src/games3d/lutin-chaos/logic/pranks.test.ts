import { describe, expect, it } from 'vitest';
import { applyPrank, PRANK_TYPES, undoPrank, undoStep } from './pranks';
import { makeRng } from './rand';
import { referenceState } from './room-def';
import { diffRoom, revertChanges, sameRoom } from './room-state';
import type { RoomProp } from './room-def';

const prop = (id: string, kind: string, slot: string, color = 'red', extra: Partial<RoomProp> = {}): RoomProp => ({ id, kind, slot, color, rot: 0, count: 1, hidden: false, ...extra });
const ROOM = {
  props: [
    prop('sock-1', 'sock', 'drawer'),
    prop('sock-2', 'sock', 'drawer', 'blue'),
    prop('boot-l', 'boot', 'left'),
    prop('boot-r', 'boot', 'right'),
    prop('book', 'book', 'shelf', 'green'),
    prop('plate', 'plate', 'table', 'white', { count: 3 }),
    prop('whisk', 'whisk', 'counter', 'white'),
    prop('ball', 'ball', 'bench', 'orange'),
    prop('bell', 'bell', 'shelf', 'yellow'),
  ],
};
const SLOTS = ['drawer', 'fridge', 'left', 'right', 'shelf', 'table', 'counter', 'cupboard', 'bench', 'floor'];
const ref = referenceState(ROOM);
const ctx = { state: ref, slots: SLOTS };

const CASES: { type: string; params: Record<string, unknown>; expect: (s: ReturnType<typeof referenceState>) => void }[] = [
  { type: 'move-into', params: { props: ['sock-1', 'sock-2'], to: 'fridge' }, expect: (s) => expect([s.props['sock-1'].slot, s.props['sock-2'].slot]).toEqual(['fridge', 'fridge']) },
  { type: 'swap', params: { pairs: [['boot-l', 'boot-r']] }, expect: (s) => expect([s.props['boot-l'].slot, s.props['boot-r'].slot]).toEqual(['right', 'left']) },
  { type: 'recolour', params: { props: ['book'], color: 'purple' }, expect: (s) => expect(s.props.book.color).toBe('purple') },
  { type: 'flip', params: { props: ['book'], turns: 2 }, expect: (s) => expect(s.props.book.rot).toBe(2) },
  { type: 'multiply', params: { prop: 'plate', count: 5 }, expect: (s) => expect(s.props.plate.count).toBe(5) },
  { type: 'hide', params: { props: ['whisk'], in: 'cupboard' }, expect: (s) => expect(s.props.whisk).toMatchObject({ slot: 'cupboard', hidden: true }) },
  {
    type: 'chain-reaction',
    params: {
      steps: [
        { id: 'a', type: 'move-into', params: { props: ['ball'], to: 'floor' } },
        { id: 'b', type: 'flip', params: { props: ['bell'], turns: 1 } },
        { id: 'c', type: 'recolour', params: { props: ['book'], color: 'blue' } },
      ],
    },
    expect: (s) => expect([s.props.ball.slot, s.props.bell.rot, s.props.book.color]).toEqual(['floor', 1, 'blue']),
  },
];

describe('prank type plug-ins', () => {
  it('every registered type has a test case', () => {
    expect(Object.keys(PRANK_TYPES).sort()).toEqual(CASES.map((c) => c.type).sort());
  });

  for (const c of CASES) {
    it(`${c.type}: transforms the room, records changes, undoes exactly`, () => {
      expect(PRANK_TYPES[c.type].validate(c.params, ctx)).toEqual([]);
      const { state, record } = applyPrank(ref, { id: 'x', type: c.type, params: c.params, culprit: 'pepin' }, makeRng(3));
      c.expect(state);
      expect(record.culprit).toBe('pepin');
      expect(record.changes.length).toBeGreaterThan(0);
      expect(diffRoom(ref, state).length).toBeGreaterThan(0);
      expect(sameRoom(undoPrank(state, record), ref)).toBe(true);
      // the reference room is never mutated
      expect(ref.props.ball.slot).toBe('bench');
      // hotspots = the touched props
      for (const ch of record.changes) expect(PRANK_TYPES[c.type].props(c.params)).toContain(ch.prop);
    });
  }

  it('recolour without a colour picks a different bright colour (seeded)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const { state, record } = applyPrank(ref, { id: 'x', type: 'recolour', params: { props: ['book'] } }, makeRng(seed));
      expect(state.props.book.color).not.toBe('green');
      expect(sameRoom(undoPrank(state, record), ref)).toBe(true);
    }
  });

  it('chain reaction steps undo one by one in reverse order', () => {
    const c = CASES.find((x) => x.type === 'chain-reaction')!;
    const { state, record } = applyPrank(ref, { id: 'f', type: 'chain-reaction', params: c.params }, makeRng(1));
    expect(record.steps?.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    let s = undoStep(state, record, 'c');
    expect(s.props.book.color).toBe('green');
    s = undoStep(s, record, 'b');
    s = undoStep(s, record, 'a');
    expect(sameRoom(s, ref)).toBe(true);
  });

  it('undoing out of order is refused (the record protects the room)', () => {
    const { state, record } = applyPrank(ref, { id: 'x', type: 'move-into', params: { props: ['ball'], to: 'floor' } }, makeRng(1));
    expect(() => revertChanges(ref, record.changes)).toThrow();
    expect(sameRoom(undoPrank(state, record), ref)).toBe(true);
  });

  it('validation catches bad params', () => {
    const bad: [string, Record<string, unknown>][] = [
      ['move-into', { props: ['nope'], to: 'fridge' }],
      ['move-into', { props: ['sock-1'], to: 'drawer' }],
      ['move-into', { props: ['sock-1'], to: 'moon' }],
      ['swap', { pairs: [['sock-1', 'sock-2']] }],
      ['swap', { pairs: 'x' }],
      ['recolour', { props: ['book'], color: 'green' }],
      ['recolour', { props: ['book'], color: 'tartan' }],
      ['flip', { props: ['book'], turns: 4 }],
      ['multiply', { prop: 'plate', count: 2 }],
      ['multiply', { prop: 'plate', count: 50 }],
      ['hide', { props: ['whisk'], in: 'nowhere' }],
      ['chain-reaction', { steps: [{ id: 'a', type: 'chain-reaction', params: {} }, { id: 'b', type: 'flip', params: { props: ['book'] } }] }],
      ['chain-reaction', { steps: [{ id: 'a', type: 'flip', params: { props: ['book'] } }] }],
    ];
    for (const [type, params] of bad) expect(PRANK_TYPES[type].validate(params, ctx).length, `${type} ${JSON.stringify(params)}`).toBeGreaterThan(0);
  });
});
