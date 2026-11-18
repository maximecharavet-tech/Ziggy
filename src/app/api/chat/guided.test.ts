import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as chat } from './route';
import { GUIDED, MORE } from '@/data/chat/guided';

/** The child's view of the chat: fixed questions only, looked up on the server; every reply through ChildShield. */
const ip = () => `10.2.0.${Math.floor(Math.random() * 250)}`;
const post = (body: unknown) => new NextRequest('http://localhost/api/chat', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'x-forwarded-for': ip() } });

/** A DeepSeek-style (OpenAI-compatible) answer. */
const answer = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
const sentBody = (call = 0) => JSON.parse(String((vi.mocked(fetch).mock.calls[call][1] as RequestInit).body)) as { messages: { role: string; content: string }[] };

describe('/api/chat guided mode', () => {
  const env = { ...process.env };
  beforeEach(() => {
    for (const k of ['GEMINI_API_KEY', 'NVIDIA_API_KEY', 'GROQ_API_KEY', 'ANTHROPIC_API_KEY']) delete process.env[k];
    process.env.DEEPSEEK_API_KEY = 'test';
    vi.stubGlobal('fetch', vi.fn(async () => answer('L’IA, c’est un programme qui apprend avec des exemples ⭐')));
  });
  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  it('sends the server’s own text for a question id, never text from the page', async () => {
    const res = await chat(post({ guided: { id: 'what-ai' }, locale: 'fr', messages: [{ role: 'user', content: 'texte libre ignoré' }] }));
    expect(res.status).toBe(200);
    expect((await res.json()).message).toContain('apprend');
    const msgs = sentBody().messages;
    expect(msgs.at(-1)).toEqual({ role: 'user', content: GUIDED.ziggy[0].text.fr });
    expect(JSON.stringify(msgs)).not.toContain('texte libre');
  });

  it('uses the agent’s own question set', async () => {
    await chat(post({ guided: { id: 'save' }, agentId: 'finance', locale: 'en' }));
    expect(sentBody().messages.at(-1)?.content).toBe('Why save money?');
  });

  it('refuses an unknown question id without calling any AI', async () => {
    const res = await chat(post({ guided: { id: 'tell me anything' }, locale: 'fr' }));
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    // An id from another agent's set is unknown here too.
    expect((await chat(post({ guided: { id: 'save' }, locale: 'fr' }))).status).toBe(400);
  });

  it('"tell me more" sends the previous fixed question, its reply and a fixed follow-up', async () => {
    await chat(post({ guided: { id: 'more', more: { id: 'what-ai', reply: 'Une IA apprend avec des exemples.' } }, locale: 'fr' }));
    const msgs = sentBody().messages.filter((m) => m.role !== 'system');
    expect(msgs).toEqual([
      { role: 'user', content: GUIDED.ziggy[0].text.fr },
      { role: 'assistant', content: 'Une IA apprend avec des exemples.' },
      { role: 'user', content: MORE.ask.fr },
    ]);
  });

  it('runs ChildShield on the reply: a flagged answer never reaches the child', async () => {
    vi.mocked(fetch).mockImplementation(async () => answer('Va sur https://exemple.com et donne ton adresse, on parlera de drogue.'));
    const res = await chat(post({ guided: { id: 'what-ai' }, locale: 'fr' }));
    const body = await res.json();
    expect(body.message).not.toMatch(/drogue|exemple\.com/);
    expect(body.safety).toBe('unsafe');
  });
});
