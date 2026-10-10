'use client';

import { WORLDS } from '@/data/worlds';
import { COMPANIONS } from '@/data/companions';
import type { ArcadeGameId } from '@/lib/arcade/types';
import type { LearningSkill } from '@/lib/learning/skills';
import { logRound } from '@/lib/mission';
import { applyRound, type RoundOutcome } from './engine';
import { dayKey } from './gamification';
import { api, getMemory, setMemory } from './store';
import { normalizeMemory } from './memory';

export interface FinishInput {
  gameId: ArcadeGameId;
  skill: LearningSkill;
  worldId?: string;
  questId?: string;
  stats: { correct: number; mistakes: number; total: number };
  durationMs: number;
}

/**
 * A game is over: the server computes the outcome (and saves it for signed-in
 * families). Offline or on error, the very same engine runs on the device,
 * so the child never loses a round.
 */
export async function finishRound(input: FinishInput): Promise<RoundOutcome> {
  const today = dayKey();
  const memory = getMemory();
  const res = await api<RoundOutcome>('game/result', {
    body: {
      result: { gameId: input.gameId, skill: input.skill, worldId: input.worldId, questId: input.questId, ...input.stats, durationMs: Math.round(input.durationMs) },
      memory,
      today,
    },
  });
  const outcome = res.ok
    ? { ...res.data, memory: normalizeMemory(res.data.memory) }
    : applyRound(memory, { gameId: input.gameId, skill: input.skill, stats: input.stats, durationMs: input.durationMs, worldId: input.worldId, questId: input.questId }, WORLDS, COMPANIONS, today);
  setMemory(outcome.memory);
  // Counts for the day's streak too; Ziggy World celebrates with its own Magic Moments.
  logRound('world', outcome.stars);
  return outcome;
}
