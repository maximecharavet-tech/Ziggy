import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { anonNameKey, nameClipUrl, nameSlug, resetNameIndex } from './names';
import { clipSources } from './audio';
import { SANTA_VOICE, staticClipUrl } from '@/data/santa/voice-clips';
import { santaText } from '@/data/santa/lines';

const fakeIndex = (fr: string[], en: string[] = []) =>
  (async () => new Response(JSON.stringify({ voice: SANTA_VOICE.voice, fr, en }))) as unknown as typeof fetch;

afterEach(() => resetNameIndex());

describe('first names in Santa’s own voice', () => {
  it('slugs like voice-engine/santa_names.py', () => {
    expect(nameSlug('Léa')).toBe('lea');
    expect(nameSlug('Marie-Lou')).toBe('marie-lou');
    expect(nameSlug('Anne Sophie')).toBe('anne-sophie');
    expect(nameSlug("N'Golo")).toBe('n-golo');
    expect(nameSlug('ÉLOÏSE')).toBe('eloise');
  });

  it('plays the recorded greeting for a known name, whatever the accents or case', async () => {
    const f = fakeIndex(['lea']);
    expect(await nameClipUrl('hello', 'LEA', 'fr', f)).toBe(`/santa/names/fr/hello/lea.mp3?v=${SANTA_VOICE.voice}`);
  });

  it('never calls another voice: an unknown name gets the same-voice greeting without the name', async () => {
    await nameClipUrl('hello', 'x', 'fr', fakeIndex(['lea'])); // loads the index once
    const urls = await clipSources('name:hello:Zébulonne', 'fr');
    expect(urls).toEqual([staticClipUrl(anonNameKey('hello'), 'fr')]);
    expect(urls.join()).not.toContain('/api/');
    expect(santaText('line:name.hello', 'fr')).toBe('Bonjour à toi !');
  });

  it('no clip source ever points at the live voice route', async () => {
    for (const k of ['line:open.hohoho', 'gift:velo', 'name:bye:Léa', 'line:nope']) {
      expect((await clipSources(k, 'fr')).some((u) => u.includes('/api/'))).toBe(false);
    }
  });

  it('ships both greetings for every name in the index', () => {
    const dir = join(process.cwd(), 'public/santa/names');
    const idx = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as { voice: string; fr: string[]; en: string[] };
    expect(idx.voice).toBe(SANTA_VOICE.voice);
    expect(idx.fr.length).toBeGreaterThan(1500);
    expect(idx.en.length).toBeGreaterThan(500);
    for (const loc of ['fr', 'en'] as const)
      for (const s of idx[loc]) {
        expect(s).toBe(nameSlug(s));
        for (const v of ['hello', 'bye']) expect(existsSync(join(dir, loc, v, `${s}.mp3`))).toBe(true);
      }
  });
});
