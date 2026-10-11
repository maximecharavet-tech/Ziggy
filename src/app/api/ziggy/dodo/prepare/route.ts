import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticate, fail, ok, readBody } from '@/lib/hyper-engine/route';
import { existingAssets, missing, plannedAssets, prepareSome, providersReady } from '@/lib/dodo/prepare';
import { DODO_STORIES } from '@/data/dodo';

/**
 * Owner only: generate the Mode dodo illustrations (NVIDIA FLUX or Agnes) and
 * Ziggy's narration (Gemini TTS) once, a few at a time; the console calls it
 * again until nothing is left.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

async function owner(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return null;
  const { data } = await auth.sb.rpc('is_owner');
  return data === true ? auth : null;
}

const Locales = z.array(z.enum(['fr', 'en'])).min(1).max(2).default(['fr']);
const Kinds = z.array(z.enum(['image', 'audio'])).min(1).max(2).default(['image', 'audio']);

export async function GET(request: NextRequest) {
  const auth = await owner(request);
  if (!auth) return fail(403, 'owner_only');
  const locales = Locales.parse((request.nextUrl.searchParams.get('locales') ?? 'fr').split(',').filter(Boolean));
  const rows = await existingAssets(auth.sb);
  const planned = plannedAssets(locales);
  const left = missing(planned, rows);
  return ok({
    stories: DODO_STORIES.length,
    planned: planned.length,
    ready: planned.length - left.length,
    missing: { image: left.filter((k) => k.kind === 'image').length, audio: left.filter((k) => k.kind === 'audio').length },
    providers: providersReady(),
  });
}

const Body = z.object({
  locales: Locales,
  kinds: Kinds,
  max: z.number().int().min(1).max(3).default(1),
  story: z.string().regex(/^[a-z0-9_]{1,20}$/).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await owner(request);
  if (!auth) return fail(403, 'owner_only');
  const body = await readBody(request, Body, 2_000);
  if (!body.ok) return body.res;
  const p = providersReady();
  const kinds = body.data.kinds.filter((k) => (k === 'image' ? p.image : p.voice));
  if (!kinds.length) return fail(503, 'not_configured', { providers: p });
  const result = await prepareSome(auth.sb, { ...body.data, kinds, origin: request.nextUrl.origin });
  return ok(result);
}
