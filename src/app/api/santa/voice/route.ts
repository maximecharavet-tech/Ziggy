import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { synthesize } from '@/lib/tts-gemini';
import { santaText } from '@/data/santa/lines';

/**
 * Santa's voice (L'appli du Père Noël). GET ?k=<clip key>&l=fr|en[&v=<version>]
 *
 * Speaks only the fixed texts of src/data/santa/lines.ts (plus a validated first
 * name), so every clip is the same for everyone and is cached by the CDN for a
 * year: each one is generated once, then costs nothing. The version parameter
 * changes when the texts change.
 *
 * 503 when no voice key is set: the call player then uses the device's voice.
 */

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: 'voice-unavailable' }, { status: 503 });

  const params = request.nextUrl.searchParams;
  const locale = params.get('l') === 'en' ? 'en' : 'fr';
  const clip = (params.get('k') ?? '').normalize('NFC').slice(0, 80);
  const text = santaText(clip, locale);
  if (!text) return NextResponse.json({ error: 'unknown-clip' }, { status: 400 });

  // Only uncached clips reach this function: a generous limit per address.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`santa-voice:${ip}`, 80, 5 * 60_000).success) return NextResponse.json({ error: 'too-many' }, { status: 429 });

  let audio: Uint8Array | null = null;
  try {
    audio = await synthesize(key, text, 'santa');
  } catch {
    audio = null;
  }
  if (!audio) return NextResponse.json({ error: 'voice-failed' }, { status: 502 });

  return new NextResponse(Buffer.from(audio), {
    headers: {
      'content-type': 'audio/wav',
      'cache-control': 'public, max-age=31536000, immutable',
      'cdn-cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
