import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { fail, ok, readBody } from '@/lib/hyper-engine/route';
import { COMPANION_IDS } from '@/data/types';
import { COMPANIONS } from '@/data/companions';
import { companionLine, companionStep, reactionFor } from '@/lib/world/companion';
import { routing } from '@/i18n/routing';

/** Companion state machine step + the line the companion says (pre-written, never generated). */
export const runtime = 'nodejs';

const Body = z.object({
  companion: z.enum(COMPANION_IDS),
  event: z.enum(['start', 'correct', 'wrong', 'hint', 'levelUp', 'questComplete', 'rest']),
  state: z.object({ mood: z.enum(['IDLE', 'HAPPY', 'THINKING', 'EXCITED', 'SAD', 'CELEBRATE']), roll: z.number().int().min(0).max(1000) }).default({ mood: 'IDLE', roll: 0 }),
  seed: z.number().int().min(0).max(2 ** 31).default(0),
  locale: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const body = await readBody(request, Body, 4_000);
  if (!body.ok) return body.res;
  const { companion, event, state, seed } = body.data;
  const profile = COMPANIONS.find((c) => c.id === companion);
  if (!profile) return fail(404, 'not_found');
  const locale = (routing.locales as readonly string[]).includes(body.data.locale ?? '') ? body.data.locale! : 'fr';
  const next = companionStep(state, event);
  const reaction = reactionFor(event);
  return ok({ state: next, reaction, line: reaction ? companionLine(profile, reaction, seed, locale) : null });
}
