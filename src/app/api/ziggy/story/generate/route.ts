import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticate, ctxFor, fail, limited, ok, readBody } from '@/lib/hyper-engine/route';
import { HyperEngineClient } from '@/lib/hyper-engine/client';
import { StoryChoicesSchema } from '@/lib/story/choices';

/**
 * Story Builder: the child picks a hero, a place, a friend, a magic object
 * and a goal (predefined ids only — no free text). Signed-in families get an
 * AI-written story (validated, shielded) saved to their library; everyone
 * else gets the hand-written story template.
 */
export const runtime = 'nodejs';
export const maxDuration = 45;

const Body = z.object({ choices: StoryChoicesSchema, locale: z.string().optional(), save: z.boolean().default(true) });

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  const rl = limited(request, auth, 'story', 6, 10 * 60_000);
  if (rl) return rl;
  const body = await readBody(request, Body);
  if (!body.ok) return body.res;
  const { choices, locale, save } = body.data;
  const out = await HyperEngineClient.generateStory(ctxFor(auth, locale, choices.ageGroup), choices);
  if (!out.ok) return fail(502, out.error);
  let id: string | null = null;
  if (auth && save) {
    const { data } = await auth.sb.from('ziggy_stories').insert({ choices, story: out.data, source: out.source }).select('id').single();
    id = (data?.id as string | undefined) ?? null;
  }
  return ok({ id, story: out.data, source: out.source });
}
