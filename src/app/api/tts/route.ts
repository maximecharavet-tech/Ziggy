import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { speakable, synthesize, type TtsStyle } from '@/lib/tts-gemini';

/**
 * Ziggy's voice: Gemini text-to-speech (the same engine as Hyper™ AI Engine's
 * console). Returns a WAV file, or 503 when no key is set, in which case the
 * browser falls back to its own speech synthesis.
 *
 * A small in-memory cache answers repeated sentences (game prompts, greetings)
 * without a new API call.
 */

export const runtime = 'nodejs';

const cache = new Map<string, Uint8Array>();
const CACHE_ITEMS = 60;

function remember(key: string, audio: Uint8Array) {
  if (audio.length > 1_500_000) return;
  cache.set(key, audio);
  if (cache.size > CACHE_ITEMS) cache.delete(cache.keys().next().value!);
}

export async function POST(request: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: 'voice-unavailable' }, { status: 503 });

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`tts:${ip}`, 40, 5 * 60_000).success) {
    return NextResponse.json({ error: 'too-many' }, { status: 429 });
  }

  let text = '';
  let style: TtsStyle = 'ziggy';
  try {
    const body = await request.json();
    style = body?.style === 'bedtime' ? 'bedtime' : 'ziggy';
    text = speakable(String(body?.text ?? ''), style);
  } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: 'empty' }, { status: 400 });

  const cacheKey = `${style}:${text}`;
  let audio = cache.get(cacheKey);
  if (!audio) {
    try {
      audio = (await synthesize(key, text, style)) ?? undefined;
    } catch {
      audio = undefined;
    }
    if (!audio) return NextResponse.json({ error: 'voice-failed' }, { status: 502 });
    remember(cacheKey, audio);
  }

  return new NextResponse(Buffer.from(audio), {
    headers: {
      'content-type': 'audio/wav',
      'cache-control': 'private, max-age=86400',
    },
  });
}
