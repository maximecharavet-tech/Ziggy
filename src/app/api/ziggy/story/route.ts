import type { NextRequest } from 'next/server';
import { authenticate, fail, ok } from '@/lib/hyper-engine/route';

/** The family's story library, and deleting a story. */
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return fail(401, 'sign_in_required');
  const { data } = await auth.sb.from('ziggy_stories').select('id, choices, story, source, created_at').order('created_at', { ascending: false }).limit(50);
  return ok({ stories: (data ?? []).map((s) => ({ id: s.id, choices: s.choices, story: s.story, source: s.source, createdAt: s.created_at })) });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return fail(401, 'sign_in_required');
  const id = request.nextUrl.searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/.test(id)) return fail(400, 'invalid_request');
  const { error } = await auth.sb.from('ziggy_stories').delete().eq('id', id);
  return error ? fail(500, 'delete_failed') : ok({ deleted: id });
}
