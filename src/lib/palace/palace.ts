/**
 * The memory palace (method of loci): the trick memory champions use. You
 * walk through a place you know and leave each thing to remember in a room,
 * imagining it doing something funny there. To remember, you walk again.
 *
 * Here the place is Ziggy's house, always walked in the same order.
 */

export const ROOMS = [
  { id: 'door', emoji: '🚪' },
  { id: 'hall', emoji: '🧥' },
  { id: 'living', emoji: '🛋️' },
  { id: 'kitchen', emoji: '🍳' },
  { id: 'bath', emoji: '🛁' },
  { id: 'bedroom', emoji: '🛏️' },
  { id: 'attic', emoji: '🧸' },
  { id: 'garden', emoji: '🌳' },
] as const;

export type RoomId = (typeof ROOMS)[number]['id'];

export const OBJECTS = [
  '🐘', '🦒', '🐧', '🦁', '🐸', '🐙', '🦄', '🐢', '🦊', '🐝',
  '🍕', '🍩', '🍉', '🥕', '🍦', '🧁', '🍔', '🌽', '🍇', '🥨',
  '🎸', '⚽', '🚲', '🪁', '🎺', '🧲', '🔦', '🧦', '👑', '🕶️',
  '🚂', '⛵', '🚁', '🌋', '🌵', '🍄', '⏰', '💎', '🎁', '🪐',
] as const;

export const MAX_LEVEL = 6;
/** Level 1 = 3 things to remember; each level adds one, up to all 8 rooms. */
export const itemsFor = (level: number) => Math.min(ROOMS.length, 2 + Math.max(1, Math.min(level, MAX_LEVEL)));

/** Small seeded random generator (mulberry32), so a round can be replayed in tests. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: readonly T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface Stop {
  room: (typeof ROOMS)[number];
  item: string;
  /** Four choices for the walk back, the right one among them. */
  choices: string[];
}

/** One round: a walk through the first rooms, a different object in each. */
export function makeRound(level: number, seed: number): Stop[] {
  const rand = rng(seed);
  const count = itemsFor(level);
  const items = shuffle(OBJECTS, rand).slice(0, count);
  return ROOMS.slice(0, count).map((room, i) => {
    // Distractors: mostly other things from this walk (the real difficulty), plus one stranger.
    const others = shuffle(items.filter((x) => x !== items[i]), rand).slice(0, 2);
    const stranger = shuffle(OBJECTS.filter((o) => !items.includes(o)), rand)[0];
    return { room, item: items[i], choices: shuffle([items[i], ...others, stranger], rand) };
  });
}

/** Stars for a walk: never zero. */
export function palaceStars(found: number, total: number): number {
  const rate = total ? found / total : 0;
  return rate >= 0.99 ? 3 : rate >= 0.6 ? 2 : 1;
}
