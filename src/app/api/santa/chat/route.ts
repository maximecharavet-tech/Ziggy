import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { synthesize } from '@/lib/tts-gemini';
import { passFromRequest, passSecret } from '@/lib/santa/pass';
import { spendAiSeconds } from '@/lib/santa/ai-usage';
import { santaAiReady, santaReply, type SantaTurn } from '@/lib/santa/santa-ai';
import { cleanName } from '@/lib/santa/name';

/**
 * The live AI call with Santa (Pack magique, switched on by a parent).
 * POST { locale, name, age, wishes[], history[{role, text}], text } →
 *   { text, audio (base64 WAV | null), left } or { line } (a fixed line to play instead).
 *
 * The child's sentence arrives as text (transcribed on the device). Nothing is
 * stored or logged. Each exchange costs 20 s of the pass's live minutes.
 */

export const runtime = 'nodejs';
export const maxDuration = 30;

const COST_PER_TURN = 20;

export async function POST(request: NextRequest) {
  const pass = passFromRequest(request);
  const secret = passSecret();
  if (!pass || !secret || pass.tier !== 'magique') return NextResponse.json({ error: 'pass' }, { status: 402 });
  if (!santaAiReady()) return NextResponse.json({ error: 'unavailable' }, { status: 503 });

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`santa-chat:${pass.sid}`, 30, 5 * 60_000).success || !rateLimit(`santa-chat-ip:${ip}`, 60, 5 * 60_000).success) {
    return NextResponse.json({ line: 'ai.busy' }, { status: 429 });
  }

  let body: { locale?: unknown; name?: unknown; age?: unknown; wishes?: unknown; history?: unknown; text?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }
  const locale = body.locale === 'en' ? 'en' : 'fr';
  const text = typeof body.text === 'string' ? body.text : '';
  const history: SantaTurn[] = Array.isArray(body.history)
    ? body.history
        .filter((t): t is SantaTurn => !!t && typeof t === 'object' && (t.role === 'child' || t.role === 'santa') && typeof t.text === 'string')
        .slice(-8)
        .map((t) => ({ role: t.role, text: t.text.slice(0, 400) }))
    : [];
  const wishes = Array.isArray(body.wishes) ? body.wishes.filter((w): w is string => typeof w === 'string').slice(0, 12) : [];

  const usage = await spendAiSeconds(pass, secret, 0);
  if (usage.left <= 0) return NextResponse.json({ line: 'ai.timeup', left: 0 });

  const result = await santaReply({ locale, name: cleanName(String(body.name ?? '')), age: Number(body.age) || 6, wishes, history, text });
  if (!result.ok) return NextResponse.json({ line: result.line, left: usage.left });

  const spent = await spendAiSeconds(pass, secret, COST_PER_TURN);
  let audio: string | null = null;
  const key = process.env.GEMINI_API_KEY;
  if (key) {
    try {
      const wav = await synthesize(key, result.text, 'santa');
      if (wav) audio = Buffer.from(wav).toString('base64');
    } catch {
      audio = null;
    }
  }
  return NextResponse.json({ text: result.text, audio, left: spent.left }, { headers: { 'cache-control': 'no-store' } });
}
