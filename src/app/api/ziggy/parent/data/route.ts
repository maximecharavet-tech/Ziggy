import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticate, fail, ok, readBody } from '@/lib/hyper-engine/route';
import { deleteAllWorldData, deleteAvatars } from '@/lib/world/privacy';

/**
 * Parent deletions: avatars, stories, adventure progress, AI history, or all
 * Ziggy World data. (Deleting the whole account is on the account page.)
 */
export const runtime = 'nodejs';

const Body = z.object({ scope: z.enum(['avatars', 'stories', 'progress', 'history', 'all']) });

export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return fail(401, 'sign_in_required');
  const body = await readBody(request, Body, 1_000);
  if (!body.ok) return body.res;
  const { sb, user } = auth;
  switch (body.data.scope) {
    case 'avatars':
      return ok({ scope: 'avatars', deleted: await deleteAvatars(sb, user.id) });
    case 'stories':
      await sb.from('ziggy_stories').delete().eq('user_id', user.id);
      return ok({ scope: 'stories' });
    case 'progress':
      await sb.from('ziggy_world_state').delete().eq('user_id', user.id);
      return ok({ scope: 'progress' });
    case 'history':
      await Promise.all([sb.from('ziggy_generations').delete().eq('user_id', user.id), sb.from('ziggy_safety_events').delete().eq('user_id', user.id)]);
      return ok({ scope: 'history' });
    case 'all':
      return ok({ scope: 'all', ...(await deleteAllWorldData(sb, user.id)) });
  }
}
