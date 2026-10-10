import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticate, clientIp, type AuthedRequest } from './auth';
import { rateLimit } from '@/lib/rate-limit';
import type { Ctx } from './orchestrator';
import { routing } from '@/i18n/routing';

/** Small shared helpers for the /api/ziggy routes. */

export const AgeGroupSchema = z.enum(['5-7', '8-10', '11-12']).default('5-7');
const LocaleSchema = z.string().refine((l) => (routing.locales as readonly string[]).includes(l)).catch('fr');

export function fail(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status, headers: { 'cache-control': 'no-store' } });
}

export function ok(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

/** Parse a JSON body with a size cap and a schema. */
export async function readBody<S extends z.ZodTypeAny>(request: NextRequest, schema: S, maxBytes = 64_000): Promise<{ ok: true; data: z.output<S> } | { ok: false; res: NextResponse }> {
  const len = Number(request.headers.get('content-length') ?? 0);
  if (len > maxBytes) return { ok: false, res: fail(413, 'too_large') };
  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > maxBytes) return { ok: false, res: fail(413, 'too_large') };
    raw = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, res: fail(400, 'invalid_json') };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, res: fail(400, 'invalid_request', { issues: parsed.error.issues.slice(0, 5).map((i) => i.path.join('.')) }) };
  return { ok: true, data: parsed.data };
}

/** Rate limit per account when signed in, per IP otherwise. */
export function limited(request: Request, auth: AuthedRequest | null, bucket: string, max: number, windowMs: number): NextResponse | null {
  const key = `${bucket}:${auth ? `u:${auth.user.id}` : `ip:${clientIp(request)}`}`;
  return rateLimit(key, max, windowMs).success ? null : fail(429, 'rate_limited');
}

export function ctxFor(auth: AuthedRequest | null, locale: unknown, ageGroup: Ctx['ageGroup'] = '5-7'): Ctx {
  return { sb: auth?.sb ?? null, userId: auth?.user.id ?? null, locale: LocaleSchema.parse(locale), ageGroup };
}

/** Whether the parent has an active (not revoked) consent of this kind. */
export async function hasConsent(auth: AuthedRequest, kind: 'photo_avatar' | 'ai_content'): Promise<boolean> {
  const { data } = await auth.sb.from('ziggy_consents').select('id').eq('kind', kind).is('revoked_at', null).limit(1);
  return Boolean(data?.length);
}

export { authenticate };
