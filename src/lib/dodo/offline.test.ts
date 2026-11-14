import { describe, expect, it } from 'vitest';
import { getDodoStory } from '@/data/dodo';
import { DODO_ASSETS_URL, isKeepable, keepMessage, storyOfflineUrls } from './offline';
import type { DodoVoiceTiming } from './voice';

const lili = getDodoStory('lili')!;
const timing: DodoVoiceTiming = {
  v: 2,
  locale: 'fr',
  story: 'lili',
  segments: {
    title: { file: 'title.mp3', dur: 2, text: 'Lili', words: [0] },
    s1: { file: 's1.mp3', dur: 5, text: 'Il était', words: [0, 1] },
    outro: { file: 'outro.mp3', dur: 3, text: 'Bonne nuit', words: [0, 1] },
  },
};

describe('storyOfflineUrls', () => {
  it('lists the songs, their timings, the cover, the pictures and the voice, once each', () => {
    const urls = storyOfflineUrls(lili, 'fr', { timing, images: ['/dodo/lili/1.jpg', '/dodo/lili/2.jpg', '/dodo/lili/1.jpg', '/dodo/lili/lili.webp'] });
    expect(urls).toEqual([
      '/dodo/voice/fr/lili/timing.json',
      '/dodo/voice/fr/lili/title.mp3',
      '/dodo/voice/fr/lili/s1.mp3',
      '/dodo/voice/fr/lili/outro.mp3',
      '/dodo/lili/lili-v1.mp3',
      '/dodo/lili/lili-v1.timing.json',
      '/dodo/lili/lili-v2.mp3',
      '/dodo/lili/lili-v2.timing.json',
      '/dodo/lili/lili.webp',
      '/dodo/lili/1.jpg',
      '/dodo/lili/2.jpg',
      DODO_ASSETS_URL,
    ]);
    expect(new Set(urls).size).toBe(urls.length);
  });
  it('skips the voice when the story is not recorded', () => {
    const urls = storyOfflineUrls(lili, 'fr', { timing: null });
    expect(urls.some((u) => u.includes('/voice/'))).toBe(false);
    expect(urls).toContain('/dodo/lili/lili-v1.mp3');
  });
  it('uses the English files for every other language, and no French song for English', () => {
    const urls = storyOfflineUrls(lili, 'de', { timing: { ...timing, locale: 'en' } });
    expect(urls[0]).toBe('/dodo/voice/en/lili/timing.json');
    expect(urls.some((u) => /-v[12]\.mp3$/.test(u))).toBe(false); // Lili's songs are French only
  });
  it('only keeps this site\'s story files (no third party, no path tricks)', () => {
    expect(isKeepable('/dodo/lili/lili-v1.mp3')).toBe(true);
    expect(isKeepable(DODO_ASSETS_URL)).toBe(true);
    for (const bad of ['https://evil.example/dodo/a.mp3', '//evil.example/dodo/a.mp3', '/dodo/../api/secret', '/api/other', '/dodo/a b.mp3', '/_next/static/x.js']) {
      expect(isKeepable(bad), bad).toBe(false);
    }
    const urls = storyOfflineUrls(lili, 'fr', { timing, images: ['https://cdn.example/x.jpg', '/dodo/../x'] });
    expect(urls.every(isKeepable)).toBe(true);
  });
  it('builds the message for the service worker', () => {
    expect(keepMessage('lili', ['/dodo/a.mp3'])).toEqual({ type: 'dodo-keep', story: 'lili', urls: ['/dodo/a.mp3'] });
  });
});
