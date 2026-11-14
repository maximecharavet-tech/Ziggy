/** Room state helpers: apply / revert recorded changes, compare with the reference room. */
import type { Change, PropField, PropState, RoomState } from './types';

export function cloneRoom(s: RoomState): RoomState {
  const props: Record<string, PropState> = {};
  for (const [k, v] of Object.entries(s.props)) props[k] = { ...v };
  return { props };
}

function setField(p: PropState, field: PropField, value: string | number | boolean): PropState {
  return { ...p, [field]: value } as PropState;
}

/** Apply changes in order (each `to`). Throws if a change does not match the room (a logic bug). */
export function applyChanges(s: RoomState, changes: readonly Change[]): RoomState {
  const props = { ...s.props };
  for (const c of changes) {
    const p = props[c.prop];
    if (!p) throw new Error(`unknown prop "${c.prop}"`);
    if (p[c.field] !== c.from) throw new Error(`prop "${c.prop}" ${c.field} is ${String(p[c.field])}, expected ${String(c.from)}`);
    props[c.prop] = setField(p, c.field, c.to);
  }
  return { props };
}

/** Undo changes: reverse order, each back to `from`. */
export function revertChanges(s: RoomState, changes: readonly Change[]): RoomState {
  const props = { ...s.props };
  for (let i = changes.length - 1; i >= 0; i--) {
    const c = changes[i];
    const p = props[c.prop];
    if (!p) throw new Error(`unknown prop "${c.prop}"`);
    if (p[c.field] !== c.to) throw new Error(`prop "${c.prop}" ${c.field} is ${String(p[c.field])}, expected ${String(c.to)}`);
    props[c.prop] = setField(p, c.field, c.from);
  }
  return { props };
}

const FIELDS: PropField[] = ['slot', 'color', 'rot', 'count', 'hidden'];

/** What differs from the reference room (Ziggy's magnifier, tests). */
export function diffRoom(ref: RoomState, cur: RoomState): Change[] {
  const out: Change[] = [];
  for (const id of Object.keys(ref.props)) {
    const a = ref.props[id];
    const b = cur.props[id];
    if (!b) continue;
    for (const f of FIELDS) if (a[f] !== b[f]) out.push({ prop: id, field: f, from: a[f], to: b[f] });
  }
  return out;
}

export const sameRoom = (a: RoomState, b: RoomState) => diffRoom(a, b).length === 0 && Object.keys(a.props).length === Object.keys(b.props).length;

/** Props touched by a list of changes. */
export const touched = (changes: readonly Change[]) => [...new Set(changes.map((c) => c.prop))];
