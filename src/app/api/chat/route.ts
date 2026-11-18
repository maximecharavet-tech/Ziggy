import { NextRequest, NextResponse } from 'next/server';
import { chat, NoProviderError, BLOCKED, SYSTEM_PROMPT } from '@/lib/ai';
import { SPOKEN_STYLE } from '@/lib/speech-text';
import { screenChildInput, screenAiOutput, blockedReply } from '@/lib/child-safety';
import { rateLimit } from '@/lib/rate-limit';
import { getAgent, getAgentSystemPrompt } from '@/lib/agents';
import { PLACEHOLDER, redactPersonal } from '@/lib/privacy/personal';
import { localShield, shield } from '@/lib/safety/child-shield';
import { MORE, guidedQuestion, guidedSet } from '@/data/chat/guided';
import { tr } from '@/lib/i18n-text';

/**
 * Ziggy's chat (/demo) and the specialist friends (/agents/[agent]).
 *
 * Two modes:
 * - guided (the child's view, the default): the body names a fixed question by id
 *   (`guided: { id, more? }`); the server looks the text up in src/data/chat/guided.ts,
 *   so nothing a child types reaches the AI (CLAUDE.md: no free LLM chat for children).
 * - free (`messages`): typed text, only offered on the page behind the grown-up gate.
 * In both, every reply is cleaned (no links, emails, numbers) and goes through ChildShield.
 */

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

type Msg = { role: string; content: string };

/** A guided turn: the fixed question (and, for "tell me more", the previous one and its reply). */
function guidedMessages(guided: unknown, agentId: unknown, lang: string): Msg[] | null {
  if (!guided || typeof guided !== 'object') return null;
  const g = guided as { id?: unknown; more?: { id?: unknown; reply?: unknown } };
  const set = guidedSet(typeof agentId === 'string' ? agentId : null);
  const question = guidedQuestion(set, g.id);
  if (question) return [{ role: 'user', content: tr(question.text, lang) }];
  if (g.id !== 'more' || !g.more) return null;
  const before = guidedQuestion(set, g.more.id);
  if (!before) return null;
  const reply = screenAiOutput(stripHtml(String(g.more.reply ?? '').slice(0, 600)));
  // The previous reply comes back from the page: only kept if it still passes the local policy.
  const context: Msg[] = reply && localShield(reply).ok ? [{ role: 'user', content: tr(before.text, lang) }, { role: 'assistant', content: reply }] : [{ role: 'user', content: tr(before.text, lang) }];
  return [...context, { role: 'user', content: tr(MORE.ask, lang) }];
}


export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { success } = rateLimit(`chat:${ip}`, 10, 60_000);
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { messages, locale, agentId, mode, guided } = body;
    const lang = typeof locale === 'string' ? locale : 'en';
    const gap = PLACEHOLDER[lang === 'fr' ? 'fr' : 'en'];

    let sanitized: Msg[];
    if (guided !== undefined) {
      const fixed = guidedMessages(guided, agentId, lang);
      if (!fixed) return NextResponse.json({ error: 'Unknown question' }, { status: 400 });
      sanitized = fixed;
    } else {
      if (!messages || !Array.isArray(messages)) {
        return NextResponse.json({ error: 'Invalid messages' }, { status: 400 });
      }

      if (messages.length > 20) {
        return NextResponse.json({ error: 'Too many messages' }, { status: 400 });
      }

      const received = messages.map((m: Msg) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: stripHtml(String(m.content || '').slice(0, 2000).trim()),
      }));

      // The latest typed message is screened before any AI sees it.
      const lastUser = [...received].reverse().find((m) => m.role === 'user');
      if (lastUser) {
        const screen = screenChildInput(lastUser.content, lang);
        if (screen.verdict !== 'ok') {
          return NextResponse.json({ message: screen.reply, safety: screen.verdict });
        }
      }

      // Personal details never reach the AI provider: a first name said about oneself
      // ("je m'appelle Léa"), and contact data left in older turns (the page
      // already replaced the names it knows).
      sanitized = received.map((m: Msg) => (m.role === 'user' ? { ...m, content: redactPersonal(m.content, gap) } : m));
    }

    let systemPrompt: string | undefined;
    if (agentId && getAgent(agentId)) {
      systemPrompt = getAgentSystemPrompt(agentId, locale || 'en');
    }

    // In a voice call the answer is heard, not read: short, oral, no emoji.
    if (mode === 'voice') systemPrompt = `${systemPrompt ?? SYSTEM_PROMPT}\n\n${SPOKEN_STYLE}`;

    const raw = await chat(sanitized, lang, systemPrompt);
    if (raw === BLOCKED) return NextResponse.json({ message: blockedReply(lang), safety: 'unsafe' });
    const reply = screenAiOutput(raw);
    if (!reply) return NextResponse.json({ message: blockedReply(lang) });
    // ChildShield on every reply, guided or free (local policy, then the NVIDIA second opinion when set).
    const verdict = await shield(reply, guided !== undefined ? 'chat_guided' : 'chat_free');
    if (!verdict.ok) return NextResponse.json({ message: blockedReply(lang), safety: 'unsafe' });
    return NextResponse.json({ message: reply });
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
