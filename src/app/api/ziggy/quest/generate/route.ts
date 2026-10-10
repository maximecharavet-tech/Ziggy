import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { AgeGroupSchema, authenticate, ctxFor, fail, limited, ok, readBody } from '@/lib/hyper-engine/route';
import { HyperEngineClient } from '@/lib/hyper-engine/client';
import { COMPANION_IDS } from '@/data/types';
import { COMPANIONS } from '@/data/companions';
import { tr } from '@/lib/i18n-text';

/**
 * The narration of a quest. The quest itself (game, skill, reward) comes from
 * the Adaptive Quest Engine; the AI may only re-tell it. Guests and missing
 * providers get the hand-written narration.
 */
export const runtime = 'nodejs';
export const maxDuration = 30;

const Body = z.object({
  worldId: z.string().regex(/^[a-z_]{2,20}$/),
  questId: z.string().regex(/^[a-z_0-9]{2,30}$/),
  companion: z.enum(COMPANION_IDS),
  ageGroup: AgeGroupSchema,
  locale: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  const rl = limited(request, auth, 'quest', 20, 60_000);
  if (rl) return rl;
  const body = await readBody(request, Body);
  if (!body.ok) return body.res;
  const { worldId, questId, companion, ageGroup, locale } = body.data;
  const ctx = ctxFor(auth, locale, ageGroup);
  const companionName = tr(COMPANIONS.find((c) => c.id === companion)!.name, ctx.locale);
  const out = await HyperEngineClient.generateQuest(ctx, worldId, questId, companionName);
  if (!out.ok) return fail(out.error === 'invalid' ? 404 : 502, out.error);
  return ok({ quest: out.data, source: out.source });
}
