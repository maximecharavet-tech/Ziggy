import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clipId as rawClipId, type BankLang, type BankStyle } from './voice-key';

const clipId = (text: string, lang: BankLang, style?: BankStyle): string => rawClipId(text, lang, style)!;

/**
 * The voice bank in the browser: lookups stay on the device, personal lines
 * are never looked up nor played from the bank, and fixed sentences found in
 * it never reach /api/tts.
 */

const FIXED_FR = 'On joue ensemble ?';
const PERSONAL_FR = 'Bravo Léa, tu as gagné !';
const manifest = () => ({
  v: 1,
  ext: 'mp3',
  version: 'abc123',
  ziggy: { fr: [clipId(FIXED_FR, 'fr'), clipId(PERSONAL_FR, 'fr')], en: [clipId('Shall we play?', 'en')] },
  bedtime: { fr: [clipId('Bonne nuit !', 'fr', 'bedtime')], en: [] },
});

type Call = { url: string; body?: string };
let calls: Call[];
let spoken: string[];
let played: string[];

class FakeAudio {
  src = '';
  dataset: Record<string, string> = {};
  currentTime = 0;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play() {
    played.push(this.src);
    setTimeout(() => this.onended?.(), 0);
    return Promise.resolve();
  }
  pause() {}
}

function installBrowser() {
  calls = [];
  spoken = [];
  played = [];
  const store = new Map<string, string>();
  const win = {
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
    speechSynthesis: {
      getVoices: () => [],
      cancel: () => {},
      speak: (u: { text: string; onstart?: () => void; onend?: () => void }) => {
        spoken.push(u.text);
        u.onstart?.();
        setTimeout(() => u.onend?.(), 0);
      },
    },
  };
  vi.stubGlobal('window', win);
  vi.stubGlobal('localStorage', win.localStorage);
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      text: string;
      lang = '';
      voice = null;
      pitch = 1;
      rate = 1;
      onstart?: () => void;
      onend?: () => void;
      onerror?: () => void;
      constructor(t: string) {
        this.text = t;
      }
    }
  );
  let n = 0;
  vi.stubGlobal('URL', Object.assign(Object.create(URL), { createObjectURL: () => `blob:clip-${++n}`, revokeObjectURL: () => {} }));
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: { body?: string }) => {
      calls.push({ url, body: init?.body });
      if (url === '/voice/manifest.json') return new Response(JSON.stringify(manifest()), { status: 200 });
      if (url.startsWith('/voice/')) return new Response(new Blob(['mp3']), { status: 200 });
      if (url === '/api/tts') return new Response(new Blob(['wav']), { status: 200 });
      return new Response('', { status: 404 });
    })
  );
}

beforeEach(() => {
  vi.resetModules();
  installBrowser();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('voice bank lookup', () => {
  it('parses the manifest and builds clip URLs on the device', async () => {
    const { parseBank, clipUrlIn } = await import('./voice-bank');
    const bank = parseBank(manifest());
    expect(clipUrlIn(bank, FIXED_FR, 'fr')).toBe(`/voice/fr/${clipId(FIXED_FR, 'fr')}.mp3?v=abc123`);
    expect(clipUrlIn(bank, '« On joue ensemble ? » 🎲', 'fr')).toBe(clipUrlIn(bank, FIXED_FR, 'fr'));
    expect(clipUrlIn(bank, 'Une phrase inconnue.', 'fr')).toBeNull();
    expect(clipUrlIn(bank, FIXED_FR, 'es')).toBeNull(); // only fr and en are recorded
    expect(clipUrlIn(bank, 'Bonne nuit !', 'fr')).toBeNull(); // the bedtime voice is its own bank
    expect(clipUrlIn(bank, 'Bonne nuit !', 'fr', 'bedtime')).toMatch(/^\/voice\/fr\/[0-9a-f]{14}\.mp3/);
    expect(parseBank({ v: 2 } as never)).toBeNull();
    expect(clipUrlIn(null, FIXED_FR, 'fr')).toBeNull();
  });

  it('loads the manifest once, and never sends a sentence anywhere', async () => {
    const { bankClipUrl } = await import('./voice-bank');
    expect(await bankClipUrl(FIXED_FR, 'fr')).toMatch(/^\/voice\/fr\//);
    expect(await bankClipUrl('Shall we play?', 'en')).toMatch(/^\/voice\/en\//);
    expect(await bankClipUrl('Pas dans la banque.', 'fr')).toBeNull();
    expect(calls.map((c) => c.url)).toEqual(['/voice/manifest.json']);
    expect(calls.every((c) => c.body === undefined)).toBe(true);
  });

  it('never looks up a personal sentence, even one whose id is in the manifest', async () => {
    const { registerPersonal } = await import('./privacy/personal');
    const { bankClipUrl } = await import('./voice-bank');
    registerPersonal('Léa');
    expect(await bankClipUrl(PERSONAL_FR, 'fr')).toBeNull();
    expect(await bankClipUrl('Écris à papa@exemple.fr', 'fr')).toBeNull();
    expect(calls).toEqual([]); // not even the manifest was needed
  });
});

describe('speaking with the bank', () => {
  it('plays a fixed sentence from /voice/ and makes no /api/tts request', async () => {
    const { speakSequence } = await import('./voice');
    expect(await speakSequence('t1', [FIXED_FR], 'fr')).toBe(true);
    expect(calls.some((c) => c.url.startsWith(`/voice/fr/${clipId(FIXED_FR, 'fr')}.mp3`))).toBe(true);
    expect(calls.some((c) => c.url === '/api/tts')).toBe(false);
    expect(played).toHaveLength(1);
    expect(spoken).toEqual([]);
  });

  it('keeps the server voice for sentences that are not in the bank', async () => {
    const { speakSequence } = await import('./voice');
    await speakSequence('t2', [FIXED_FR, 'Ceci vient de l’IA.'], 'fr');
    const tts = calls.filter((c) => c.url === '/api/tts');
    expect(tts).toHaveLength(1);
    expect(JSON.parse(tts[0].body!).text).toBe('Ceci vient de l’IA.');
    expect(played).toHaveLength(2);
  });

  it('a personal sentence is neither played from the bank nor sent: the device voice says it', async () => {
    const { registerPersonal } = await import('./privacy/personal');
    const { speakSequence } = await import('./voice');
    registerPersonal('Léa');
    await speakSequence('t3', [PERSONAL_FR], 'fr');
    expect(calls.some((c) => c.url.startsWith('/voice/fr/'))).toBe(false);
    expect(calls.some((c) => c.url === '/api/tts')).toBe(false);
    expect(calls.some((c) => (c.body ?? '').includes('Léa') || c.url.includes('L%C3%A9a'))).toBe(false);
    expect(spoken).toEqual([PERSONAL_FR]);
  });

  it('uses the bedtime bank for the bedtime voice', async () => {
    const { speakSequence } = await import('./voice');
    await speakSequence('t4', ['Bonne nuit !'], 'fr', undefined, 'bedtime');
    expect(calls.some((c) => c.url.startsWith(`/voice/fr/${clipId('Bonne nuit !', 'fr', 'bedtime')}.mp3`))).toBe(true);
    expect(calls.some((c) => c.url === '/api/tts')).toBe(false);
  });

  it('falls back to the server voice when a clip cannot be fetched', async () => {
    const f = globalThis.fetch as ReturnType<typeof vi.fn>;
    const base = f.getMockImplementation()!;
    f.mockImplementation(async (url: string, init?: { body?: string }) => (url.startsWith('/voice/fr/') ? (calls.push({ url }), new Response('', { status: 404 })) : base(url, init)));
    const { speakSequence } = await import('./voice');
    await speakSequence('t5', [FIXED_FR], 'fr');
    expect(calls.filter((c) => c.url === '/api/tts')).toHaveLength(1);
  });
});
