import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticate, fail, hasConsent, limited, ok, readBody, ctxFor } from '@/lib/hyper-engine/route';
import { HyperEngineClient } from '@/lib/hyper-engine/client';

/**
 * Photo → visual blueprint (hair, skin tone, eyes, glasses…), for a cartoon
 * avatar. Requires a signed-in parent with an active photo consent.
 *
 * Zero retention: the photo lives only in this request's memory while the
 * vision model reads it. It is never written to disk, database, storage or
 * logs, and the response contains only the enum blueprint.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const Body = z.object({
  photo: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)
    .refine((s) => (s.length * 3) / 4 <= MAX_PHOTO_BYTES * 1.02),
  locale: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return fail(401, 'sign_in_required');
  const rl = limited(request, auth, 'avatar-analyze', 6, 10 * 60_000);
  if (rl) return rl;
  if (!(await hasConsent(auth, 'photo_avatar'))) return fail(403, 'consent_required');
  const body = await readBody(request, Body, Math.ceil(MAX_PHOTO_BYTES * 1.4) + 1000);
  if (!body.ok) return body.res;

  const out = await HyperEngineClient.analyzeImage(ctxFor(auth, body.data.locale), body.data.photo);
  if (!out.ok) {
    const status = out.error === 'not_configured' ? 503 : out.error === 'over_budget' ? 429 : out.error === 'invalid' ? 422 : 502;
    return fail(status, out.error, { reason: out.reason });
  }
  return ok({ blueprint: out.data, photoStored: false });
}
