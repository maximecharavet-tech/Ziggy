/**
 * The robot-path puzzle, the pure part: walking a program, and the shortest
 * path used for hints. Kept out of the component so it can be tested — and so
 * every level is proven solvable.
 */

export type Dir = 'up' | 'down' | 'left' | 'right';
export interface Cell {
  x: number;
  y: number;
}
export interface Level {
  start: Cell;
  goal: Cell;
  obstacles: Cell[];
}

export const GRID = 5;

export const DELTAS: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

const blocked = (level: Level, c: Cell) =>
  c.x < 0 || c.y < 0 || c.x >= GRID || c.y >= GRID || level.obstacles.some((o) => same(o, c));

/** What happens when the program runs: every cell visited, and how it ends. */
export type Run =
  | { outcome: 'goal'; path: Cell[]; steps: number }
  /** The instruction at `bugAt` walks into a wall or off the board. */
  | { outcome: 'bump'; path: Cell[]; bugAt: number }
  /** All instructions done, the star not reached. */
  | { outcome: 'short'; path: Cell[] };

export function runProgram(level: Level, program: Dir[]): Run {
  const path: Cell[] = [level.start];
  let pos = level.start;
  for (let i = 0; i < program.length; i++) {
    const d = DELTAS[program[i]];
    const next = { x: pos.x + d.x, y: pos.y + d.y };
    if (blocked(level, next)) return { outcome: 'bump', path, bugAt: i };
    pos = next;
    path.push(pos);
    if (same(pos, level.goal)) return { outcome: 'goal', path, steps: i + 1 };
  }
  return { outcome: 'short', path };
}

/** Shortest program from a cell to the star (breadth-first), or null if walled in. */
export function shortestPath(level: Level, from: Cell = level.start): Dir[] | null {
  const key = (c: Cell) => `${c.x},${c.y}`;
  const prev = new Map<string, { from: Cell; dir: Dir }>();
  const seen = new Set([key(from)]);
  const queue: Cell[] = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (same(cur, level.goal)) {
      const dirs: Dir[] = [];
      let c = cur;
      while (!same(c, from)) {
        const p = prev.get(key(c))!;
        dirs.unshift(p.dir);
        c = p.from;
      }
      return dirs;
    }
    for (const dir of ['right', 'down', 'left', 'up'] as Dir[]) {
      const d = DELTAS[dir];
      const next = { x: cur.x + d.x, y: cur.y + d.y };
      if (blocked(level, next) || seen.has(key(next))) continue;
      seen.add(key(next));
      prev.set(key(next), { from: cur, dir });
      queue.push(next);
    }
  }
  return null;
}

/** Stars for the whole run: the fewer bumps, the more stars — never zero. */
export function robotStars(bumps: number): number {
  return bumps <= 2 ? 3 : bumps <= 6 ? 2 : 1;
}
