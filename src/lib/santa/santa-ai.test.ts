import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanChildText, cleanReply, santaProviders, santaReply, santaReplyStream, santaSystemPrompt, takeSentences } from './santa-ai';

describe('Santa live call', () => {
  it('the persona carries the safety rules', () => {
    const p = santaSystemPrompt({ locale: 'fr', name: 'Léa', age: 6, wishes: ['velo', 'nope'] });
    expect(p).toContain('Léa');
    expect(p).toContain('un vélo');
    expect(p).toMatch(/Never say you are a human/);
    expect(p).toMatch(/Never ask for or repeat personal information/);
    expect(p).toMatch(/never promise a specific gift/);
    expect(p).toMatch(/naughty list/);
    expect(santaSystemPrompt({ locale: 'en', name: '<x>', age: 99, wishes: [] })).toContain('a 12-year-old');
  });

  it('cleans what the child said and what Santa answers', () => {
    expect(cleanChildText('  bonjour <b>Père</b> {Noël}  ')).toBe('bonjour b Père /b Noël');
    expect(cleanChildText('a'.repeat(500))).toHaveLength(300);
    expect(cleanReply('*rit* Ho ho ho ! 🎅 **Bonjour** (sourit) toi !')).toBe('Ho ho ho ! Bonjour toi !');
    const long = 'Ho ho ho ! '.repeat(10) + 'Fin de phrase. ' + 'x'.repeat(300);
    expect(cleanReply(long).length).toBeLessThanOrEqual(260);
  });

  describe('replies', () => {
    const env = { ...process.env };
    beforeEach(() => {
      process.env.DEEPSEEK_API_KEY = 'test';
      delete process.env.NVIDIA_API_KEY;
      delete process.env.MISTRAL_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
    });
    afterEach(() => {
      process.env = { ...env };
      vi.unstubAllGlobals();
    });

    it('answers with the model text, cleaned', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Ho ho ho ! Mes rennes vont très bien. Et toi ?' } }] }))));
      const r = await santaReply({ locale: 'fr', name: 'Léa', age: 6, wishes: [], history: [{ role: 'santa', text: 'Bonjour !' }], text: 'Comment vont tes rennes ?' });
      expect(r).toEqual({ ok: true, text: 'Ho ho ho ! Mes rennes vont très bien. Et toi ?' });
      const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[1].role).toBe('user');
      expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('deepseek');
      expect(body.max_tokens).toBeLessThanOrEqual(200);
    });

    it('asks again on silence, and falls back to a fixed line when the model fails', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 500 })));
      expect(await santaReply({ locale: 'fr', name: 'Léa', age: 6, wishes: [], history: [], text: ' ' })).toEqual({ ok: false, line: 'ai.again' });
      expect(await santaReply({ locale: 'fr', name: 'Léa', age: 6, wishes: [], history: [], text: 'Salut' })).toEqual({ ok: false, line: 'ai.busy' });
    });
  });

  it('uses DeepSeek, then NVIDIA, then Mistral — never Anthropic', () => {
    const ids = santaProviders({ ANTHROPIC_API_KEY: 'a', MISTRAL_API_KEY: 'm', NVIDIA_API_KEY: 'n', DEEPSEEK_API_KEY: 'd' } as unknown as NodeJS.ProcessEnv).map((p) => p.id);
    expect(ids).toEqual(['deepseek', 'nvidia', 'mistral']);
    expect(santaProviders({ ANTHROPIC_API_KEY: 'a' } as unknown as NodeJS.ProcessEnv)).toEqual([]);
  });

  it('cuts sentences as they come', () => {
    expect(takeSentences('Ho ho ho ! Mes rennes vont bien. Et t')).toEqual({ sentences: ['Ho ho ho ! Mes rennes vont bien.'], rest: 'Et t' });
    expect(takeSentences('Oh ! ')).toEqual({ sentences: [], rest: 'Oh ! ' });
    expect(takeSentences('Bonjour mon grand ami ! Comment vas-tu ? ').sentences).toEqual(['Bonjour mon grand ami !', 'Comment vas-tu ?']);
  });

  it('streams the reply sentence by sentence', async () => {
    const env = { ...process.env };
    process.env.DEEPSEEK_API_KEY = 'test';
    delete process.env.NVIDIA_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    const sse = ['Ho ho ho ! Mes ', 'rennes vont très bien. ', 'Et toi, tu as ', 'vu la neige ?']
      .map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`)
      .join('') + 'data: [DONE]\n\n';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(sse, { headers: { 'content-type': 'text/event-stream' } })));
    const out = [];
    for await (const e of santaReplyStream({ locale: 'fr', name: 'Léa', age: 6, wishes: [], history: [], text: 'Comment vont tes rennes ?' })) out.push(e);
    expect(out).toEqual([
      { type: 'sentence', text: 'Ho ho ho ! Mes rennes vont très bien.' },
      { type: 'sentence', text: 'Et toi, tu as vu la neige ?' },
    ]);
    process.env = env;
    vi.unstubAllGlobals();
  });
});
