/**
 * The sandbox notebook, kept on this device (localStorage `ziggy:sandbox`):
 * which discoveries and challenges are done, and how many times each reaction
 * happened (so "grow 3 flowers" can be finished over several visits).
 */
import { REACTIONS, type Reaction } from '@/games2d/sandbox/sim';
import { CHALLENGES, type ChallengeId } from '@/games2d/sandbox/content';

export const SANDBOX_KEY = 'ziggy:sandbox';

export interface SandboxSave {
  v: 1;
  /** Discovery → when it was first made (ms since epoch). */
  discoveries: Partial<Record<Reaction, number>>;
  /** Challenge → when it was done. */
  challenges: Partial<Record<ChallengeId, number>>;
  /** Reaction → how many times it happened (capped, it only feeds the challenges). */
  totals: Partial<Record<Reaction, number>>;
}

export const emptySave = (): SandboxSave => ({ v: 1, discoveries: {}, challenges: {}, totals: {} });

const isReaction = (k: string): k is Reaction => (REACTIONS as readonly string[]).includes(k);
const isChallenge = (k: string): k is ChallengeId => CHALLENGES.some((c) => c.id === k);

function pickNumbers<K extends string>(raw: unknown, keep: (k: string) => k is K): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (keep(k) && typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  return out;
}

export function loadSave(): SandboxSave {
  try {
    const raw = window.localStorage.getItem(SANDBOX_KEY);
    if (!raw) return emptySave();
    const data = JSON.parse(raw) as Partial<SandboxSave>;
    return {
      v: 1,
      discoveries: pickNumbers(data.discoveries, isReaction),
      challenges: pickNumbers(data.challenges, isChallenge),
      totals: pickNumbers(data.totals, isReaction),
    };
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
