import { NextRequest, NextResponse } from 'next/server';
import { chat, NoProviderError, BLOCKED, SYSTEM_PROMPT } from '@/lib/ai';
import { SPOKEN_STYLE } from '@/lib/speech-text';
import { screenChildInput, screenAiOutput, blockedReply } from '@/lib/child-safety';
import { rateLimit } from '@/lib/rate-limit';
import { getAgent, getAgentSystemPrompt } from '@/lib/agents';
import { PLACEHOLDER, redactPersonal } from '@/lib/privacy/personal';

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
    const { messages, locale, agentId, mode } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages' }, { status: 400 });
    }

    if (messages.length > 20) {
      return NextResponse.json({ error: 'Too many messages' }, { status: 400 });
    }

    const lang = typeof locale === 'string' ? locale : 'en';
    const gap = PLACEHOLDER[lang === 'fr' ? 'fr' : 'en'];

    const received = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: stripHtml(String(m.content || '').slice(0, 2000).trim()),
    }));

    // The child's latest message is screened before any AI sees it.
    const lastUser = [...received].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      const screen = screenChildInput(lastUser.content, lang);
      if (screen.verdict !== 'ok') {
        return NextResponse.json({ message: screen.reply, safety: screen.verdict });
      }
    }

    // Personal details never reach the AI provider: a first name the child says about
    // themselves ("je m'appelle Léa"), and contact data left in older turns (the page
    // already replaced the names it knows).
    const sanitized = received.map((m: { role: string; content: string }) => (m.role === 'user' ? { ...m, content: redactPersonal(m.content, gap) } : m));

    let systemPrompt: string | undefined;
    if (agentId && getAgent(agentId)) {
      systemPrompt = getAgentSystemPrompt(agentId, locale || 'en');
    }

    // In a voice call the answer is heard, not read: short, oral, no emoji.
    if (mode === 'voice') systemPrompt = `${systemPrompt ?? SYSTEM_PROMPT}\n\n${SPOKEN_STYLE}`;

    const raw = await chat(sanitized, lang, systemPrompt);
    if (raw === BLOCKED) return NextResponse.json({ message: blockedReply(lang), safety: 'unsafe' });
    return NextResponse.json({ message: screenAiOutput(raw) || blockedReply(lang) });
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
