import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { agnesImage, agnesReady } from '@/lib/hyper-engine/providers/agnes';
import { ProviderError } from '@/lib/hyper-engine/providers/http';
import { shield } from '@/lib/safety/child-shield';
import { prankById } from '@/data/lutins/pranks';
import { cleanParentText } from '@/lib/lutins/text';
import { clientIp, DEVICE_RE, refundUse, takeUse } from '@/lib/lutins/limits';
import { signSource } from '@/lib/lutins/sign';
import { serverBuildPrompt } from '@/lib/lutins/server-engine';

/**
 * Les Lutins Farceurs — put Ziggy's three felt elves into a parent's room photo.
 *
 * POST JSON { locale, device, elves[], prankId?, text?, scene?, photo (data URI, the
 * room only: people were ruled out on the device), aspect, strict? }
 * → 200 image bytes, with headers X-Lutins-Caption (URI-encoded), X-Lutins-Source,
 *   X-Lutins-Sig (to animate it), X-Lutins-Left (uses left today).
 *   Errors: JSON { error } — text (description refused), daily_limit, resting, failed.
 *
 * The prompt is built by the Rust engine (rust/lutins-core) from the elves' bible;
 * the parent's words only fill the action. The photo is forwarded to Agnes for
 * this one generation and never stored. Free, with fair use per device.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_PHOTO_CHARS = 3_400_000; // ≈ 2.5 MB of JPEG as a data URI
const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const ELVES = new Set(['pepin', 'grelotte', 'noisette']);
const SIZES = { portrait: '1024x1536', landscape: '1536x1024', square: '1024x1024' } as const;

let sheet: Promise<string> | null = null;
/** The elves' reference sheet, sent with every photo so the AI copies their exact design. */
function sheetDataUri(): Promise<string> {
  sheet ??= readFile(join(process.cwd(), 'public/lutins/refs/sheet.png')).then((b) => `data:image/png;base64,${b.toString('base64')}`);
  sheet.catch(() => {
    sheet = null;
  });
  return sheet;
}

export async function POST(request: NextRequest) {
  if (!agnesReady()) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const device = typeof body.device === 'string' && DEVICE_RE.test(body.device) ? body.device : null;
  const photo = typeof body.photo === 'string' && body.photo.length <= MAX_PHOTO_CHARS && PHOTO_RE.test(body.photo) ? body.photo : null;
  const elves = Array.isArray(body.elves) ? [...new Set(body.elves.filter((e): e is string => typeof e === 'string' && ELVES.has(e)))].slice(0, 3) : [];
  const prank = prankById(typeof body.prankId === 'string' ? body.prankId : null);
  const text = cleanParentText(body.text);
  const locale = body.locale === 'en' ? 'en' : 'fr';
  const aspect = body.aspect === 'landscape' || body.aspect === 'square' ? body.aspect : 'portrait';
  if (!device || !photo || !elves.length || (!prank && text.length < 3)) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  // The parent's own words: ChildShield before anything else (the picture is for a child).
  if (text) {
    const verdict = await shield(text, 'lutins_text');
    if (!verdict.ok) return NextResponse.json({ error: 'text' }, { status: 422 });
  }

  const ip = clientIp(request.headers);
  const use = takeUse('image', device, ip);
  if (!use.ok) return NextResponse.json({ error: use.reason === 'device' ? 'daily_limit' : 'resting' }, { status: 429 });

  try {
    const built = await serverBuildPrompt({ locale, elves, prank: prank ? { id: prank.id, action: prank.action } : null, parentText: text, scene: body.scene, strict: body.strict === true });
    const { url } = await agnesImage(built.prompt, { references: [photo, await sheetDataUri()], size: SIZES[aspect], timeoutMs: 52_000 });
    const res = url.startsWith('data:') ? null : await fetch(url, { signal: AbortSignal.timeout(20_000) });
    let bytes: Buffer;
    let type = 'image/png';
    if (res) {
      if (!res.ok) throw new Error('download');
      bytes = Buffer.from(await res.arrayBuffer());
      type = res.headers.get('content-type')?.startsWith('image/') ? res.headers.get('content-type')! : 'image/png';
    } else {
      const m = /^data:(image\/[a-z]+);base64,(.*)$/.exec(url);
      if (!m) throw new Error('data');
      type = m[1];
      bytes = Buffer.from(m[2], 'base64');
    }
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'content-type': type,
        'cache-control': 'private, no-store',
        'x-lutins-caption': encodeURIComponent(built.caption),
        'x-lutins-source': res ? url : '',
        'x-lutins-sig': res ? (signSource(url) ?? '') : '',
        'x-lutins-left': String(use.left),
      },
    });
  } catch (e) {
    refundUse('image', device, ip);
    const rate = e instanceof ProviderError && e.code === 'rate_limited';
    return NextResponse.json({ error: rate ? 'resting' : 'failed' }, { status: rate ? 429 : 502 });
  }
}
