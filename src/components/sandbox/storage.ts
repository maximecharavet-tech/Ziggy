/**
 * The sandbox notebook, kept on this device (localStorage `ziggy:sandbox`):
 * which discoveries and challenges are done, how many times each reaction
 * happened (so "grow 3 flowers" can be finished over several visits), and a
 * few preferences. Version 2 reads version 1 saves as they are: a child never
 * loses a discovery. Created worlds (snapshots) live in IndexedDB (album.ts).
 */
import { CHALLENGES, REACTIONS, WORLDS, type ChallengeId, type Reaction, type WorldId } from '@/games2d/sandbox/content';

export const SANDBOX_KEY = 'ziggy:sandbox';

export interface SandboxSave {
  v: 2;
  /** Discovery → when it was first made (ms since epoch). */
  discoveries: Partial<Record<Reaction, number>>;
  /** Challenge → when it was done. */
  challenges: Partial<Record<ChallengeId, number>>;
  /** Reaction → how many times it happened (capped, it only feeds the challenges). */
  totals: Partial<Record<Reaction, number>>;
  /** The last world played. */
  world: WorldId;
  /** Worlds where Ziggy's saucer already came by (the tractor beam is then a tool there). */
  saucer: WorldId[];
  /** Discoveries already turned into a World Memory round (first per world + every 5th). */
  rounds: number;
}

export const emptySave = (): SandboxSave => ({ v: 2, discoveries: {}, challenges: {}, totals: {}, world: 'garden', saucer: [], rounds: 0 });

const isReaction = (k: string): k is Reaction => (REACTIONS as readonly string[]).includes(k);
const isChallenge = (k: string): k is ChallengeId => CHALLENGES.some((c) => c.id === k);
const isWorld = (k: unknown): k is WorldId => typeof k === 'string' && (WORLDS as readonly string[]).includes(k);

function pickNumbers<K extends string>(raw: unknown, keep: (k: string) => k is K): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (keep(k) && typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  return out;
}

/** Reads any saved notebook (version 1 or 2, or damaged) into a valid version 2. */
export function parseSave(raw: unknown): SandboxSave {
  if (!raw || typeof raw !== 'object') return emptySave();
  const data = raw as Record<string, unknown>;
  const discoveries = pickNumbers(data.discoveries, isReaction);
  return {
    v: 2,
    discoveries,
    challenges: pickNumbers(data.challenges, isChallenge),
    totals: pickNumbers(data.totals, isReaction),
    world: isWorld(data.world) ? data.world : 'garden',
    saucer: Array.isArray(data.saucer) ? [...new Set(data.saucer.filter(isWorld))] : [],
    // A version 1 notebook already earned one round per discovery: nothing more is owed.
    rounds: typeof data.rounds === 'number' && Number.isFinite(data.rounds) ? Math.max(0, Math.floor(data.rounds)) : Object.keys(discoveries).length,
  };
}

export function loadSave(): SandboxSave {
  try {
    const raw = window.localStorage.getItem(SANDBOX_KEY);
    return raw ? parseSave(JSON.parse(raw)) : emptySave();
  } catch {
    return emptySave();
  }
}

export function writeSave(save: SandboxSave): void {
  try {
    window.localStorage.setItem(SANDBOX_KEY, JSON.stringify(save));
  } catch {
    /* storage blocked or full: the notebook simply lives for this visit */
  }
}

/**
 * World Memory balance (brief, decision 5): a round for the first discovery in
 * each world, then one every 5th discovery, not one per discovery.
 */
export function earnsRound(save: SandboxSave, id: Reaction, world: WorldId, worldOf: (r: Reaction) => WorldId): boolean {
  const before = Object.keys(save.discoveries).filter((k) => k !== id) as Reaction[];
  const firstInWorld = !before.some((r) => worldOf(r) === world);
  const count = before.length + 1;
  return firstInWorld || count % 5 === 0;
}
