import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/claude';
import { rateLimit } from '@/lib/rate-limit';

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { success } = rateLimit(`chat:${ip}`, 10, 60_000);
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { messages, locale } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages' }, { status: 400 });
    }

    if (messages.length > 20) {
      return NextResponse.json({ error: 'Too many messages' }, { status: 400 });
    }

    const sanitized = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: stripHtml(String(m.content || '').slice(0, 2000).trim()),
    }));

    const message = await chat(sanitized, locale || 'en');
    return NextResponse.json({ message });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
