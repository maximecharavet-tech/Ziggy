import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { AgeGroupSchema, authenticate, ctxFor, fail, limited, ok, readBody } from '@/lib/hyper-engine/route';
import { HyperEngineClient } from '@/lib/hyper-engine/client';
import { ARCADE_GAME_IDS } from '@/lib/arcade/types';
import { LEARNING_SKILLS } from '@/lib/learning/skills';
import { getGame } from '@/lib/arcade/registry';

/**
 * AI Game Factory: content for one game session. The model returns strict
 * JSON (validated, corrected once, shielded); otherwise local generators.
 */
export const runtime = 'nodejs';
export const maxDuration = 30;

const Body = z.object({
  gameId: z.enum(ARCADE_GAME_IDS),
  difficulty: z.number().int().min(1).max(5),
  skill: z.enum(LEARNING_SKILLS).optional(),
  seed: z.number().int().min(0).max(2 ** 31),
  ageGroup: AgeGroupSchema,
  locale: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  const rl = limited(request, auth, 'game-content', 30, 60_000);
  if (rl) return rl;
  const body = await readBody(request, Body);
  if (!body.ok) return body.res;
  const { gameId, difficulty, seed, ageGroup, locale } = body.data;
  const game = getGame(gameId);
  const skill = body.data.skill && game.skills.includes(body.data.skill) ? body.data.skill : game.skills[0];
  const out = await HyperEngineClient.generateGameContent(ctxFor(auth, locale, ageGroup), gameId, difficulty as 1 | 2 | 3 | 4 | 5, skill, seed);
  if (!out.ok) return fail(502, out.error);
  return ok({ gameId, difficulty, skill, content: out.data.content, story: out.data.story, source: out.source });
}
