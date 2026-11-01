/**
 * Undo / redo, as a pure immutable value. Every action of the child pushes a
 * new present; undo walks back, redo walks forward, and a new action after an
 * undo forgets the redo branch. The past is capped so memory stays small.
 */
export type History<T> = { past: T[]; present: T; future: T[]; limit: number };

export const HISTORY_LIMIT = 60;

export function createHistory<T>(present: T, limit = HISTORY_LIMIT): History<T> {
  return { past: [], present, future: [], limit: Math.max(1, Math.floor(limit)) };
}

export function push<T>(h: History<T>, next: T): History<T> {
  if (Object.is(next, h.present)) return h;
  const past = [...h.past, h.present];
  if (past.length > h.limit) past.splice(0, past.length - h.limit);
  return { past, present: next, future: [], limit: h.limit };
}

export const canUndo = <T>(h: History<T>): boolean => h.past.length > 0;
export const canRedo = <T>(h: History<T>): boolean => h.future.length > 0;

export function undo<T>(h: History<T>): History<T> {
  if (!canUndo(h)) return h;
  const past = h.past.slice(0, -1);
  return { past, present: h.past[h.past.length - 1], future: [h.present, ...h.future], limit: h.limit };
}

export function redo<T>(h: History<T>): History<T> {
  if (!canRedo(h)) return h;
  const [present, ...future] = h.future;
  return { past: [...h.past, h.present], present, future, limit: h.limit };
}

/** Replace the present without an undo step (e.g. reopening a saved drawing). */
export function reset<T>(h: History<T>, present: T): History<T> {
  return { past: [], present, future: [], limit: h.limit };
}
