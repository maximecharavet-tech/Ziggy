import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as tts } from './tts/route';
import { GET as santaVoice } from './santa/voice/route';

/** Defence in depth: the voice routes refuse personal data before any call to the voice provider. */
const ip = () => `10.1.0.${Math.floor(Math.random() * 250)}`;
const post = (url: string, body: unknown) =>
  new NextRequest(`http://localhost${url}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'x-forwarded-for': ip() } });
const get = (url: string) => new NextRequest(`http://localhost${url}`, { headers: { 'x-forwarded-for': ip() } });

describe('voice routes keep personal data away from the voice provider', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
  });
  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  it.each([
    'Écris-moi à papa@exemple.fr !',
    'Mon numéro, c’est le 06 12 34 56 78.',
    'J’habite au 12 rue des Lilas.',
    "Je m'appelle Inès et j'ai six ans.",
    'My name is Leo!',
  ])('/api/tts refuses %j without calling the provider', async (text) => {
    const res = await tts(post('/api/tts', { text }));
    expect(res.status).toBe(422);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('/api/tts still voices an ordinary sentence', async () => {
    const res = await tts(post('/api/tts', { text: 'Bravo, tu as trouvé les trois étoiles !' }));
    expect(res.status).not.toBe(422);
    expect(fetch).toHaveBeenCalled();
    const sent = String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body);
    expect(sent).toContain('trois étoiles');
  });

  it('/api/santa/voice never voices a first name', async () => {
    const res = await santaVoice(get(`/api/santa/voice?k=${encodeURIComponent('name:hello:Léa')}&l=fr`));
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('/api/santa/voice voices the live call’s AI disclosure (fixed words)', async () => {
    await santaVoice(get(`/api/santa/voice?k=${encodeURIComponent('live:ai.disclose')}&l=fr`));
    expect(fetch).toHaveBeenCalled();
    expect(String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body)).toContain('intelligence artificielle');
  });
});
