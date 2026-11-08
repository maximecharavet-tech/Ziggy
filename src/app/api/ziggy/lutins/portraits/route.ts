import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticate, fail, ok, readBody } from '@/lib/hyper-engine/route';
import { agnesImage, agnesReady } from '@/lib/hyper-engine/providers/agnes';
import { canonicalPath, lutinsPublicUrl, LUTINS_BUCKET, portraitPrompt, PORTRAIT_TARGETS } from '@/lib/lutins/portraits';

/**
 * Owner only: make the elves' canonical pictures with Agnes (see src/lib/lutins/portraits.ts).
 *   GET                       → { targets: { sheet|pepin|grelotte|noisette: { approved, url, candidates[] } }, agnes }
 *   POST { generate: target } → a new candidate (portraits use the approved sheet as reference)
 *   POST { approve: { target, path } } → that candidate becomes lutins/<target>.png
 * Uses the owner's own session for storage (bucket policy: owner writes, everyone reads).
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

type Authed = NonNullable<Awaited<ReturnType<typeof authenticate>>>;

async function owner(request: NextRequest): Promise<Authed | null> {
  const auth = await authenticate(request);
  if (!auth) return null;
  const { data } = await auth.sb.rpc('is_owner');
  return data === true ? auth : null;
}

const Target = z.enum(PORTRAIT_TARGETS);
const Body = z.union([z.object({ generate: Target }), z.object({ approve: z.object({ target: Target, path: z.string().regex(/^lutins\/candidates\/[a-z]+-\d{10,15}\.(png|jpg|webp)$/) }) })]);

async function listing(auth: Authed) {
  const storage = auth.sb.storage.from(LUTINS_BUCKET);
  const [root, cands] = await Promise.all([storage.list('lutins', { limit: 100 }), storage.list('lutins/candidates', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } })]);
  const out: Record<string, { approved: boolean; url: string | null; candidates: { path: string; url: string | null }[] }> = {};
  for (const t of PORTRAIT_TARGETS) {
    const file = root.data?.find((f) => f.name === `${t}.png`);
    out[t] = {
      approved: Boolean(file),
      url: file ? lutinsPublicUrl(canonicalPath(t), file.updated_at ? Date.parse(file.updated_at) : undefined) : null,
      candidates: (cands.data ?? [])
        .filter((f) => f.name.startsWith(`${t}-`))
        .slice(0, 8)
        .map((f) => ({ path: `lutins/candidates/${f.name}`, url: lutinsPublicUrl(`lutins/candidates/${f.name}`) })),
    };
  }
  return out;
}

export async function GET(request: NextRequest) {
  const auth = await owner(request);
  if (!auth) return fail(403, 'owner_only');
  return ok({ targets: await listing(auth), agnes: agnesReady() });
}

export async function POST(request: NextRequest) {
  const auth = await owner(request);
  if (!auth) return fail(403, 'owner_only');
  const body = await readBody(request, Body, 2_000);
  if (!body.ok) return body.res;
  const storage = auth.sb.storage.from(LUTINS_BUCKET);

  if ('approve' in body.data) {
    const { target, path } = body.data.approve;
    if (!path.startsWith(`lutins/candidates/${target}-`)) return fail(400, 'wrong_target');
    const file = await storage.download(path);
    if (file.error || !file.data) return fail(404, 'not_found');
    const up = await storage.upload(canonicalPath(target), file.data, { contentType: file.data.type || 'image/png', upsert: true, cacheControl: '300' });
    if (up.error) return fail(500, 'storage_failed');
    return ok({ targets: await listing(auth) });
  }

  if (!agnesReady()) return fail(503, 'not_configured');
  const target = body.data.generate;
  let reference: string | undefined;
  if (target !== 'sheet') {
    const sheet = await storage.download(canonicalPath('sheet'));
    if (sheet.data) reference = `data:${sheet.data.type || 'image/png'};base64,${Buffer.from(await sheet.data.arrayBuffer()).toString('base64')}`;
  }
  const { prompt, size } = portraitPrompt(target, Boolean(reference));
  try {
    const { url } = await agnesImage(prompt, { size, reference, timeoutMs: 52_000 });
    let bytes: Buffer;
    let type = 'image/png';
    if (url.startsWith('data:')) {
      const m = /^data:(image\/[a-z]+);base64,(.*)$/.exec(url);
      if (!m) return fail(502, 'bad_image');
      type = m[1];
      bytes = Buffer.from(m[2], 'base64');
    } else {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) return fail(502, 'download_failed');
      type = res.headers.get('content-type')?.split(';')[0] || 'image/png';
      bytes = Buffer.from(await res.arrayBuffer());
    }
    const ext = type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : 'png';
    const path = `lutins/candidates/${target}-${Date.now()}.${ext}`;
    const up = await storage.upload(path, bytes, { contentType: type, upsert: false, cacheControl: '31536000' });
    if (up.error) return fail(500, 'storage_failed');
    return ok({ path, url: lutinsPublicUrl(path), usedSheet: Boolean(reference), targets: await listing(auth) });
  } catch {
    return fail(502, 'agnes_failed');
  }
}
