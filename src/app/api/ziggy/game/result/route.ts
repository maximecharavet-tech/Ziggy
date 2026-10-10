import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticate, fail, limited, ok, readBody } from '@/lib/hyper-engine/route';
import { ARCADE_GAME_IDS } from '@/lib/arcade/types';
import { LEARNING_SKILLS } from '@/lib/learning/skills';
import { getGame } from '@/lib/arcade/registry';
import { WORLDS } from '@/data/worlds';
import { COMPANIONS } from '@/data/companions';
import { applyRound } from '@/lib/world/engine';
import { WorldMemorySchema, emptyMemory, type WorldMemory } from '@/lib/world/memory';
import { loadMemory, saveMemory } from '@/lib/world/server-state';
import { dayKey } from '@/lib/world/gamification';

/**
 * A finished game → adaptive update, rewards, story progression and Magic
 * Moments, computed on the server with the same engine as the client.
 * Signed in: the account's World Memory is the source of truth and is saved.
 * Guest: the device's memory is validated, updated and sent back.
 */
export const runtime = 'nodejs';

const Body = z.object({
  result: z
    .object({
      gameId: z.enum(ARCADE_GAME_IDS),
      skill: z.enum(LEARNING_SKILLS).optional(),
      worldId: z.string().regex(/^[a-z_]{2,20}$/).optional(),
      questId: z.string().regex(/^[a-z_0-9]{2,30}$/).optional(),
      correct: z.number().int().min(0).max(60),
      mistakes: z.number().int().min(0).max(200),
      total: z.number().int().min(1).max(60),
      durationMs: z.number().int().min(0).max(3 * 60 * 60 * 1000),
    })
    .refine((r) => r.correct <= r.total),
  memory: WorldMemorySchema.optional(),
  /** The client's local date, so the daily adventure follows the family's day. */
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  const rl = limited(request, auth, 'game-result', 40, 60_000);
  if (rl) return rl;
  const body = await readBody(request, Body, 200_000);
  if (!body.ok) return body.res;
  const { result, today } = body.data;

  const game = getGame(result.gameId);
  const world = result.worldId ? WORLDS.find((w) => w.id === result.worldId) : undefined;
  const quest = world?.quests.find((q) => q.id === result.questId);
  // The quest decides the skill; in free play the game's own skills are allowed.
  const skill = quest?.skill ?? (result.skill && game.skills.includes(result.skill) ? result.skill : game.skills[0]);

  let before: WorldMemory;
  try {
    before = auth ? ((await loadMemory(auth.sb)) ?? (body.data.memory as WorldMemory | undefined) ?? emptyMemory()) : ((body.data.memory as WorldMemory | undefined) ?? emptyMemory());
  } catch {
    return fail(503, 'storage_unavailable');
  }

  const outcome = applyRound(
    before,
    { gameId: result.gameId, skill, stats: result, durationMs: result.durationMs, worldId: quest ? world!.id : undefined, questId: quest?.id },
    WORLDS,
    COMPANIONS,
    today ?? dayKey()
  );

  if (auth) {
    try {
      await saveMemory(auth.sb, auth.user.id, outcome.memory);
    } catch {
      return fail(503, 'storage_unavailable');
    }
  }
  return ok({ ...outcome, saved: Boolean(auth) });
}
