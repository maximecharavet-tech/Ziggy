import { NextRequest, NextResponse } from 'next/server';
import { chat, NoProviderError } from '@/lib/ai';
import { rateLimit } from '@/lib/rate-limit';
import { getAgent, getAgentSystemPrompt } from '@/lib/agents';

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
    const { messages, locale, agentId } = body;

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

    let systemPrompt: string | undefined;
    if (agentId && getAgent(agentId)) {
      systemPrompt = getAgentSystemPrompt(agentId, locale || 'en');
    }

    const message = await chat(sanitized, locale || 'en', systemPrompt);
    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof NoProviderError) {
      return NextResponse.json(
        { error: 'Ziggy is not connected to an AI provider yet.' },
        { status: 503 }
      );
    }
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
