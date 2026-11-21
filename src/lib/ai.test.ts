import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activeProvider, chat, configuredProviders, NoProviderError } from './ai';

const env = (keys: Record<string, string>) => keys as unknown as NodeJS.ProcessEnv;
const ALL = { MISTRAL_API_KEY: 'm', GEMINI_API_KEY: 'g', DEEPSEEK_API_KEY: 'd', NVIDIA_API_KEY: 'n', GROQ_API_KEY: 'q', ANTHROPIC_API_KEY: 'a' };
const KEYS = Object.keys(ALL);

/** An OpenAI-compatible answer (Mistral, DeepSeek, NVIDIA, Groq all speak it). */
const answer = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });
const hosts = () => vi.mocked(fetch).mock.calls.map((c) => new URL(String(c[0])).hostname);

describe('chat provider order (EU first)', () => {
  it('puts Mistral (France) first whenever its key is set, then the usual order', () => {
    expect(configuredProviders(env(ALL))).toEqual(['mistral', 'gemini', 'deepseek', 'nvidia', 'groq', 'anthropic']);
    expect(configuredProviders(env({ DEEPSEEK_API_KEY: 'd', MISTRAL_API_KEY: 'm' }))).toEqual(['mistral', 'deepseek']);
  });

  it('keeps the order it had before when there is no Mistral key (no new key needed)', () => {
    const withoutMistral = Object.fromEntries(Object.entries(ALL).filter(([k]) => k !== 'MISTRAL_API_KEY'));
    expect(configuredProviders(env(withoutMistral))).toEqual(['gemini', 'deepseek', 'nvidia', 'groq', 'anthropic']);
    expect(configuredProviders(env({}))).toEqual([]);
  });

  describe('chat()', () => {
    const saved = { ...process.env };
    beforeEach(() => {
      for (const k of KEYS) delete process.env[k];
    });
    afterEach(() => {
      process.env = { ...saved };
      vi.unstubAllGlobals();
    });

    it('asks Mistral first', async () => {
      process.env.MISTRAL_API_KEY = 'm';
      process.env.DEEPSEEK_API_KEY = 'd';
      vi.stubGlobal('fetch', vi.fn(async () => answer('Bonjour ! ⭐')));
      expect(activeProvider()).toBe('mistral');
      expect(await chat([{ role: 'user', content: 'Salut' }], 'fr')).toBe('Bonjour ! ⭐');
      expect(hosts()).toEqual(['api.mistral.ai']);
      const body = JSON.parse(String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body));
      expect(body.model).toBe('mistral-small-latest');
      expect(body.messages[0].role).toBe('system');
    });

    it('falls back to the next provider when Mistral fails', async () => {
      process.env.MISTRAL_API_KEY = 'm';
      process.env.DEEPSEEK_API_KEY = 'd';
      vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => (String(url).includes('mistral') ? new Response('busy', { status: 429 }) : answer('Coucou !'))));
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(await chat([{ role: 'user', content: 'Salut' }], 'fr')).toBe('Coucou !');
      expect(hosts()).toEqual(['api.mistral.ai', 'api.deepseek.com']);
    });

    it('without a Mistral key, never calls Mistral', async () => {
      process.env.DEEPSEEK_API_KEY = 'd';
      vi.stubGlobal('fetch', vi.fn(async () => answer('Coucou !')));
      await chat([{ role: 'user', content: 'Salut' }], 'fr');
      expect(hosts()).toEqual(['api.deepseek.com']);
    });

    it('with no key at all, says so (the route shows a friendly nap message)', async () => {
      await expect(chat([{ role: 'user', content: 'Salut' }], 'fr')).rejects.toBeInstanceOf(NoProviderError);
    });
  });
});
