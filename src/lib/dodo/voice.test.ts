import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DODO_STORIES, outroText } from '@/data/dodo';
import { DODO_VOICE_LOCALES, tokenize, voiceBase, wordAt, type DodoVoiceTiming } from './voice';

/** public/ — the voice files are served from there (voiceBase gives the URL path). */
const PUBLIC = fileURLToPath(new URL('../../../public', import.meta.url));
const file = (urlPath: string) => `${PUBLIC}${urlPath}`;

describe('wordAt', () => {
  const words = [0.1, 0.5, 0.5, 1.2];
  it('finds the word being said', () => {
    expect(wordAt(words, 0)).toBe(-1);
    expect(wordAt(words, 0.1)).toBe(0);
    expect(wordAt(words, 0.7)).toBe(2);
    expect(wordAt(words, 9)).toBe(3);
  });
});

describe('Ziggy recorded voice (public/dodo/voice)', () => {
  for (const locale of DODO_VOICE_LOCALES) {
    for (const story of DODO_STORIES) {
      it(`${locale}/${story.id} matches the story texts`, () => {
        const base = voiceBase(locale, story.id);
        const path = file(`${base}/timing.json`);
        expect(existsSync(path), `${path} is missing — run scripts/dodo-voice`).toBe(true);
        const timing = JSON.parse(readFileSync(path, 'utf8')) as DodoVoiceTiming;
        expect(timing.v).toBe(1);
        expect(timing.locale).toBe(locale);
        expect(timing.story).toBe(story.id);

        const expected: Record<string, string> = { title: story.title[locale] };
        story.scenes.forEach((scene, i) => {
          expected[`s${i + 1}`] = scene.text[locale];
        });
        expected.outro = outroText(story, locale);
        expect(Object.keys(timing.segments).sort()).toEqual(Object.keys(expected).sort());

        for (const [id, text] of Object.entries(expected)) {
          const seg = timing.segments[id];
          // Byte-identical to what the page shows: a story edit needs a new recording.
          expect(seg.text, `${locale}/${story.id}/${id} text changed — regenerate the voice`).toBe(text);
          expect(seg.file).toBe(`${id}.mp3`);
          const tokens = tokenize(text);
          expect(seg.words.length).toBe(tokens.length);
          expect(seg.dur).toBeGreaterThan(0.5);
          expect(seg.words[0]).toBeGreaterThanOrEqual(0);
          for (let i = 1; i < seg.words.length; i++) expect(seg.words[i]).toBeGreaterThanOrEqual(seg.words[i - 1]);
          expect(seg.words[seg.words.length - 1]).toBeLessThan(seg.dur);
          // A calm narration: between 0.8 and 4 words per second.
          const rate = tokens.length / seg.dur;
          expect(rate).toBeGreaterThan(0.8);
          expect(rate).toBeLessThan(4);

          const mp3 = file(`${base}/${seg.file}`);
          expect(existsSync(mp3), `${mp3} is missing`).toBe(true);
          // ~40 kbps mono: the file really is as long as `dur` says.
          const bytesPerSecond = statSync(mp3).size / seg.dur;
          expect(bytesPerSecond).toBeGreaterThan(3000);
          expect(bytesPerSecond).toBeLessThan(8000);
        }
      });
    }
  }
});
