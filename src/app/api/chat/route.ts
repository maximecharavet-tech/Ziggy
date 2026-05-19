import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/claude';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, locale } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages' }, { status: 400 });
    }

    if (messages.length > 20) {
      return NextResponse.json({ error: 'Too many messages' }, { status: 400 });
    }

    const message = await chat(messages, locale || 'en');
    return NextResponse.json({ message });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}
