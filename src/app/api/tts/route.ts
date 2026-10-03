import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Ziggy's voice: Gemini text-to-speech (the same engine as Hyper™ AI Engine's
 * console). Returns a WAV file, or 503 when no key is set, in which case the
 * browser falls back to its own speech synthesis.
 *
 * A small in-memory cache answers repeated sentences (game prompts, greetings)
 * without a new API call.
 */

export const runtime = 'nodejs';

const MODELS = ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'];
const VOICE = 'Puck'; // upbeat, friendly
const STYLE =
  'You are Ziggy, a cheerful little plush robot talking to a young child. Speak warmly and playfully, clearly, a little slower than usual, with a smile in your voice.';
const MAX_CHARS = 420;

const cache = new Map<string, Uint8Array>();
const CACHE_ITEMS = 60;

function remember(key: string, audio: Uint8Array) {
  if (audio.length > 1_500_000) return;
  cache.set(key, audio);
  if (cache.size > CACHE_ITEMS) cache.delete(cache.keys().next().value!);
}

/** Gemini returns raw 16-bit mono PCM; browsers want a WAV header around it. */
function pcmToWav(pcm: Uint8Array, rate: number): Uint8Array {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const write = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  write(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  write(36, 'data');
  v.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}

/** Emojis and markdown read aloud sound silly. */
function speakable(text: string): string {
  return text
    .replace(/[*_#`~>]/g, '')
    .replace(/\p{Extended_Pictographic}|️|‍/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, MAX_CHARS);
}

async function synthesize(key: string, text: string): Promise<Uint8Array | null> {
  for (const model of MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${STYLE}\nSay exactly this, in its own language, adding nothing:\n${text}` }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 404) continue;
    if (!res.ok) {
      console.warn(`[tts] ${model} ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
    };
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    if (!part?.data) return null;
    const pcm = Buffer.from(part.data, 'base64');
    const rate = Number(part.mimeType?.match(/rate=(\d+)/)?.[1] ?? 24000);
    return pcmToWav(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength), rate);
  }
  return null;
}

export async function POST(request: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: 'voice-unavailable' }, { status: 503 });

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`tts:${ip}`, 40, 5 * 60_000).success) {
    return NextResponse.json({ error: 'too-many' }, { status: 429 });
  }

  let text = '';
  try {
    const body = await request.json();
    text = speakable(String(body?.text ?? ''));
  } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: 'empty' }, { status: 400 });

  let audio = cache.get(text);
  if (!audio) {
    try {
      audio = (await synthesize(key, text)) ?? undefined;
    } catch {
      audio = undefined;
    }
    if (!audio) return NextResponse.json({ error: 'voice-failed' }, { status: 502 });
    remember(text, audio);
  }

  return new NextResponse(Buffer.from(audio), {
    headers: {
      'content-type': 'audio/wav',
      'cache-control': 'private, max-age=86400',
    },
  });
}
