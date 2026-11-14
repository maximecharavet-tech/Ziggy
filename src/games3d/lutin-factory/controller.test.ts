import { describe, expect, it } from 'vitest';
import { FactoryController, hallOpen, lookKey, skillFor } from './controller';
import { LEVELS, getLevel, type Cell, type Piece } from './logic';
import { defaultSave } from './save';

const lv = (id: string) => {
  const l = getLevel(id);
  if (!l) throw new Error(id);
  return l;
};

function runToEnd(c: FactoryController) {
  const notes = [];
  for (let i = 0; i < 2000; i++) {
    const t = c.tick();
    notes.push(...t.deliveries);
    if (t.settled) break;
  }
  return { end: c.endRun(), notes };
}

/** Build the reference the way a child would: tool + tap, turn until it faces the right way, set the dial. */
function buildByTaps(c: FactoryController, ref: Piece[]) {
  for (const p of ref) {
    const at = p.at as Cell;
    const there = c.layout.pieces.find((q) => q.at[0] === at[0] && q.at[1] === at[1]);
    if (!there) {
      c.selectTool(p.machine);
      const r = c.tapCell(at, false);
      expect(r.kind).toBe('placed');
      if (p.machine === 'belt') c.tapCell(at, false);
    } else c.tapCell(at, false);
    let guard = 0;
    while (c.layout.pieces.find((q) => q.at[0] === at[0] && q.at[1] === at[1])?.dir !== p.dir && guard++ < 4) expect(c.rotateSelected()).toBeNull();
    if (p.dial) expect(c.setSelectedDial(p.dial)).toBeNull();
    c.selectTool(null);
  }
}

describe('FactoryController', () => {
  it('level 1 (little): the glowing slot, then GO, fulfils the letter', () => {
    const c = new FactoryController(defaultSave(), () => 0);
    c.openLevel(lv('factory.l01'), 'little');
    const slot = c.slots()[0];
    expect(c.tapCell(slot.at, false).kind).toBe('slot');
    expect(c.chooseSlot(0).kind).toBe('placed');
    const { end, notes } = runToEnd(c);
    expect(end?.complete).toBe(true);
    expect(end?.firstTime).toBe(true);
    expect(notes.some((n) => n.matched)).toBe(true);
    expect(c.save.done['factory.l01']).toEqual(['little']);
    expect(c.save.catalogue.length).toBe(1);
  });

  it('a different slot choice makes a surprise for the shelf, never a failure', () => {
    const c = new FactoryController(defaultSave(), () => 0);
    c.openLevel(lv('factory.l01'), 'little');
    c.tapCell(c.slots()[0].at, false);
    c.chooseSlot(1);
    const { end, notes } = runToEnd(c);
    expect(end?.complete).toBe(false);
    expect(end?.result.status).toBe('in-progress');
    expect(notes[0].matched).toBe(false);
    expect(c.save.shelf.length).toBe(1);
    expect(c.slotChoiceIndex(c.slots()[0])).toBe(1);
  });

  it('level 6 (middle): sorter and belts placed by taps reach both sacks', () => {
    const c = new FactoryController(defaultSave(), () => 0);
    const l = lv('factory.l06');
    c.openLevel(l, 'middle');
    buildByTaps(c, l.bands.middle.reference);
    const { end } = runToEnd(c);
    expect(end?.complete).toBe(true);
  });

  it('every level and band is solvable through the controller (reference by taps)', () => {
    for (const l of LEVELS)
      for (const band of ['little', 'middle', 'big'] as const) {
        const c = new FactoryController(defaultSave(), () => 0);
        c.openLevel(l, band);
        const b = l.bands[band];
        if (b.slots?.length) {
          for (const s of b.slots) {
            c.tapCell(s.at, false);
            const ref = b.reference.find((p) => p.at[0] === s.at[0] && p.at[1] === s.at[1]);
            const i = s.choices.findIndex((ch) => ref && ch.machine === ref.machine && JSON.stringify(ch.dial) === JSON.stringify(ref.dial));
            c.chooseSlot(Math.max(0, i));
          }
          buildByTaps(c, b.reference.filter((p) => !b.slots?.some((s) => s.at[0] === p.at[0] && s.at[1] === p.at[1])));
        } else buildByTaps(c, b.reference);
        expect(runToEnd(c).end?.complete, `${l.id} ${band}`).toBe(true);
      }
  });

  it('undo / redo, refusals and the locked pieces', () => {
    const c = new FactoryController(defaultSave(), () => 0);
    c.openLevel(lv('factory.l01'), 'middle');
    c.selectTool('belt');
    expect(c.tapCell([1, 1], false).kind).toBe('placed');
    expect(c.canUndo).toBe(true);
    c.undo();
    expect(c.layout.pieces.length).toBe(2);
    c.redo();
    expect(c.layout.pieces.length).toBe(3);
    c.selectTool(null);
    c.tapCell([0, 1], false);
    expect(c.removeSelected()).toBe('locked');
    c.selectTool('shaper');
    expect(c.tapCell([3, 1], true).kind).toBe('refused');
  });

  it('hints help and "show me" applies one step', () => {
    const c = new FactoryController(defaultSave(), () => 0);
    c.openLevel(lv('factory.l02'), 'little');
    const h = c.askHint();
    expect(h?.kind).toBe('slot');
    const c2 = new FactoryController(defaultSave(), () => 0);
    c2.openLevel(lv('factory.l01'), 'middle');
    for (let i = 0; i < 12 && c2.askHint()?.kind !== 'done'; i++) expect(c2.showHint()).toBe(true);
    expect(runToEnd(c2).end?.complete).toBe(true);
  });

  it('keeps the last layout per letter, and the sandbox', () => {
    const save = defaultSave();
    const c = new FactoryController(save, () => 0);
    c.openLevel(lv('factory.l01'), 'middle');
    c.selectTool('belt');
    c.tapCell([1, 1], false);
    const again = new FactoryController(save, () => 0);
    again.openLevel(lv('factory.l01'), 'middle');
    expect(again.layout.pieces.length).toBe(3);
    expect(again.layout.pieces.find((p) => p.machine === 'chute')?.locked).toBe(true);
    again.openSandbox();
    expect(again.tray()).toContain('belt');
    again.selectTool('shaper');
    again.tapCell([1, 2], false);
    expect(save.sandbox?.pieces.length).toBe(3);
  });

  it('halls open in order; skills map to World Memory skills', () => {
    const save = defaultSave();
    expect(hallOpen('wood-shop', save)).toBe(true);
    expect(hallOpen('paint-room', save)).toBe(false);
    for (const id of ['factory.l01', 'factory.l02', 'factory.l03']) save.done[id] = ['little'];
    expect(hallOpen('paint-room', save)).toBe(true);
    expect(skillFor(lv('factory.l11'), 'big')).toBe('multiplication');
    expect(skillFor(lv('factory.l01'), 'little')).toBe('shapes');
    expect(lookKey({ material: 'wood', shape: 'ball', color: 'red' })).toBe(lookKey({ id: 9, material: 'wood', shape: 'ball', color: 'red' }));
  });
});
