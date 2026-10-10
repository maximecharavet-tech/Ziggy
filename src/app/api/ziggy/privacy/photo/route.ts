import type { NextRequest } from 'next/server';
import { authenticate, fail, ok } from '@/lib/hyper-engine/route';
import { deleteAvatars } from '@/lib/world/privacy';

/**
 * "Delete my child's photo data". Photos are never stored (zero retention:
 * they only exist in memory while the vision model reads them), so this
 * deletes everything derived from a photo — avatars made from it and their
 * images — and revokes the photo consent.
 */
export const runtime = 'nodejs';

export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return fail(401, 'sign_in_required');
  const deletedAvatars = await deleteAvatars(auth.sb, auth.user.id, true);
  await auth.sb.from('ziggy_consents').update({ revoked_at: new Date().toISOString() }).eq('kind', 'photo_avatar').is('revoked_at', null);
  return ok({ photoStored: false, deletedAvatars, consentRevoked: true });
}
