import type { NextRequest } from 'next/server';
import { authenticate, fail, ok } from '@/lib/hyper-engine/route';

/** The parent's avatars (signed, short-lived URLs), and deleting one. */
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return fail(401, 'sign_in_required');
  const { data } = await auth.sb.from('ziggy_avatars').select('id, style, outfit, world, image_path, from_photo, created_at').order('created_at', { ascending: false }).limit(24);
  const rows = data ?? [];
  const paths = rows.map((r) => r.image_path).filter(Boolean) as string[];
  const signed = paths.length ? (await auth.sb.storage.from('ziggy-avatars').createSignedUrls(paths, 60 * 60)).data ?? [] : [];
  const urlOf = new Map(signed.map((s) => [s.path, s.signedUrl]));
  return ok({
    avatars: rows.map((r) => ({ id: r.id, style: r.style, outfit: r.outfit, world: r.world, fromPhoto: r.from_photo, createdAt: r.created_at, url: r.image_path ? (urlOf.get(r.image_path) ?? null) : null })),
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return fail(401, 'sign_in_required');
  const id = request.nextUrl.searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/.test(id)) return fail(400, 'invalid_request');
  const { data } = await auth.sb.from('ziggy_avatars').select('image_path').eq('id', id).maybeSingle();
  if (!data) return fail(404, 'not_found');
  if (data.image_path) await auth.sb.storage.from('ziggy-avatars').remove([data.image_path]);
  await auth.sb.from('ziggy_avatars').delete().eq('id', id);
  return ok({ deleted: id });
}
