import { NextRequest, NextResponse } from 'next/server';
import { detectLanguage } from '@/lib/detect-language';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { success } = rateLimit(`detect:${ip}`, 30, 60_000);
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Invalid text' }, { status: 400 });
    }

    const language = detectLanguage(String(text).slice(0, 5000));
    return NextResponse.json({ language });
  } catch {
    return NextResponse.json({ error: 'Detection failed' }, { status: 500 });
  }
}
