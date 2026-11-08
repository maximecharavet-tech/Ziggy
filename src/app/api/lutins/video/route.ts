import { NextRequest, NextResponse } from 'next/server';
import { agnesReady } from '@/lib/hyper-engine/providers/agnes';
import { agnesVideoCreate, agnesVideoPoll } from '@/lib/hyper-engine/providers/agnes-video';
import { ProviderError } from '@/lib/hyper-engine/providers/http';
import { prankById } from '@/data/lutins/pranks';
import { clientIp, DEVICE_RE, refundUse, takeUse } from '@/lib/lutins/limits';
import { checkSource } from '@/lib/lutins/sign';

/**
 * Les Lutins Farceurs — animate a prank picture (Agnes image-to-video).
 *   POST { device, sourceUrl, sig, prankId?, portrait? } → { id }
 *     (sig: from the generate route, so only our own pictures can be animated)
 *   GET  ?id=…            → { state: pending|done|failed }
 *   GET  ?id=…&file=1     → the MP4 itself (fetched from the provider by id, so
 *                           this route never fetches an address a client chose).
 * Free, with a daily fair-use count per device.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const ID_RE = /^[A-Za-z0-9_-]{4,128}$/;

/** The picture to animate must be the AI's own result (https, public host). */
function safeSourceUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return null;
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[)/.test(u.hostname) || u.hostname.endsWith('.internal')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function motionPrompt(prankId: string | null): string {
  const prank = prankById(prankId);
  const motion = prank?.motion ?? 'the felt elves move playfully and giggle, small natural movements';
  // Video lessons (docs/lutins-research.md §10): fixed camera first, one small action, the room stays still.
  return [
    'Fixed camera, static shot.',
    `The small felt plush elf dolls come to life like stop-motion puppets: ${motion}.`,
    'Each elf keeps exactly its design, colours and size. The room, the furniture and the light stay perfectly still; no camera movement, no new objects, no people, no text.',
  ].join(' ');
}

export async function POST(request: NextRequest) {
  if (!agnesReady()) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  let body: { device?: unknown; sourceUrl?: unknown; sig?: unknown; prankId?: unknown; portrait?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const device = typeof body.device === 'string' && DEVICE_RE.test(body.device) ? body.device : null;
  const source = safeSourceUrl(body.sourceUrl);
  if (!device || !source) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  if (!checkSource(source, body.sig)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const ip = clientIp(request.headers);
  const use = takeUse('video', device, ip);
  if (!use.ok) return NextResponse.json({ error: use.reason === 'device' ? 'daily_limit' : 'resting' }, { status: 429 });
  const portrait = body.portrait !== false;
  try {
    const id = await agnesVideoCreate(motionPrompt(typeof body.prankId === 'string' ? body.prankId : null), source, { ...(portrait ? { width: 768, height: 1152 } : { width: 1152, height: 768 }), seconds: 5 });
    return NextResponse.json({ id, left: use.left });
  } catch (e) {
    refundUse('video', device, ip);
    const status = e instanceof ProviderError && e.code === 'rate_limited' ? 429 : 502;
    return NextResponse.json({ error: status === 429 ? 'resting' : 'failed' }, { status });
  }
}

export async function GET(request: NextRequest) {
  if (!agnesReady()) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  const id = request.nextUrl.searchParams.get('id') ?? '';
  if (!ID_RE.test(id)) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  try {
    const status = await agnesVideoPoll(id);
    if (request.nextUrl.searchParams.get('file') === '1') {
      if (status.state !== 'done' || !status.url) return NextResponse.json({ error: 'not_ready' }, { status: 409 });
      const res = await fetch(status.url, { signal: AbortSignal.timeout(45_000) });
      if (!res.ok || !res.body) return NextResponse.json({ error: 'failed' }, { status: 502 });
      return new NextResponse(res.body, {
        headers: { 'content-type': res.headers.get('content-type')?.startsWith('video/') ? res.headers.get('content-type')! : 'video/mp4', 'cache-control': 'private, no-store' },
      });
    }
    return NextResponse.json({ state: status.state }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return NextResponse.json({ state: 'pending' }, { headers: { 'cache-control': 'no-store' } });
  }
}
