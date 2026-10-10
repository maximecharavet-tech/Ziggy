import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticate, fail, ok, readBody } from '@/lib/hyper-engine/route';

/** Parental consents: photo → avatar, and AI-generated content. Grant or revoke at any time. */
export const runtime = 'nodejs';

const Body = z.object({ kind: z.enum(['photo_avatar', 'ai_content']), granted: z.boolean() });

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return fail(401, 'sign_in_required');
  const { data } = await auth.sb.from('ziggy_consents').select('kind, granted_at').is('revoked_at', null);
  const active = new Map((data ?? []).map((c) => [c.kind as string, c.granted_at as string]));
  return ok({ photo_avatar: active.get('photo_avatar') ?? null, ai_content: active.get('ai_content') ?? null });
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return fail(401, 'sign_in_required');
  const body = await readBody(request, Body, 2_000);
  if (!body.ok) return body.res;
  const { kind, granted } = body.data;
  // Always close the current consent first, so there is at most one active row.
  await auth.sb.from('ziggy_consents').update({ revoked_at: new Date().toISOString() }).eq('kind', kind).is('revoked_at', null);
  if (granted) {
    const { error } = await auth.sb.from('ziggy_consents').insert({ kind });
    if (error) return fail(500, 'save_failed');
  }
  return ok({ kind, granted });
}
