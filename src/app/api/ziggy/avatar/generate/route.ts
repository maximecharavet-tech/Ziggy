import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticate, fail, limited, ok, readBody, ctxFor } from '@/lib/hyper-engine/route';
import { HyperEngineClient } from '@/lib/hyper-engine/client';
import { AvatarRequestSchema } from '@/lib/hyper-engine/schemas';
import { fetchImage } from '@/lib/avatar/fetch-image';

/**
 * Blueprint + style + outfit + world → a cartoon avatar image.
 * Only the enum blueprint becomes a text prompt; no photo is ever sent to the
 * image provider. The image is kept in the parent's private storage folder.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

const Body = AvatarRequestSchema.extend({ fromPhoto: z.boolean().default(false), locale: z.string().optional() });

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return fail(401, 'sign_in_required');
  const rl = limited(request, auth, 'avatar-generate', 4, 10 * 60_000);
  if (rl) return rl;
  const body = await readBody(request, Body);
  if (!body.ok) return body.res;
  const { fromPhoto, locale, ...req } = body.data;

  const out = await HyperEngineClient.generateAvatar(ctxFor(auth, locale), req);
  if (!out.ok) {
    const status = out.error === 'not_configured' ? 503 : out.error === 'over_budget' ? 429 : out.error === 'invalid' ? 400 : 502;
    return fail(status, out.error, { reason: out.reason });
  }

  const image = await fetchImage(out.data.imageUrl);
  if (!image) return fail(502, 'provider_failed');
  const path = `${auth.user.id}/${crypto.randomUUID()}.${image.ext}`;
  const up = await auth.sb.storage.from('ziggy-avatars').upload(path, image.bytes, { contentType: image.type, upsert: false });
  if (up.error) return fail(500, 'storage_failed');
  const { data: row, error } = await auth.sb
    .from('ziggy_avatars')
    .insert({ blueprint: req.blueprint, style: req.style, outfit: req.outfit, world: req.worldId, image_path: path, from_photo: fromPhoto })
    .select('id, created_at')
    .single();
  if (error || !row) {
    await auth.sb.storage.from('ziggy-avatars').remove([path]);
    return fail(500, 'save_failed');
  }
  const signed = await auth.sb.storage.from('ziggy-avatars').createSignedUrl(path, 60 * 60);
  return ok({ avatar: { id: row.id, createdAt: row.created_at, url: signed.data?.signedUrl ?? null, style: req.style, outfit: req.outfit, world: req.worldId } });
}
