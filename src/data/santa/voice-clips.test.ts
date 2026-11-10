import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { santaText } from './lines';
import { SANTA_VOICE, clipFile, staticClipKeys, staticClipUrl } from './voice-clips';

const hash = (t: string) => createHash('sha256').update(t).digest('hex').slice(0, 10);
const dir = join(process.cwd(), 'public/santa/voice');

describe("Santa's recorded voice", () => {
  const keys = staticClipKeys();

  it('covers the calls, the message, gifts, proud moments, ages and Advent', () => {
    for (const p of ['line:', 'gift:', 'proud:', 'age:', 'advent:']) expect(keys.some((k) => k.startsWith(p))).toBe(true);
    expect(keys.filter((k) => k.startsWith('advent:'))).toHaveLength(24);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(['fr', 'en'] as const)('every fixed clip is recorded with its current words (%s)', (locale) => {
    const stale = keys.filter((k) => SANTA_VOICE[locale][k] !== hash(santaText(k, locale) ?? ''));
    // A changed text: run `node voice-engine/dump-santa.mjs /tmp/c.json && ziggy-voice santa --clips /tmp/c.json`.
    expect(stale).toEqual([]);
    for (const k of keys) expect(existsSync(join(dir, locale, `${clipFile(k)}.mp3`)), k).toBe(true);
  });

  it('ships no file the site does not use', () => {
    for (const locale of ['fr', 'en'] as const) {
      const files = readdirSync(join(dir, locale)).sort();
      expect(files).toEqual(keys.map((k) => `${clipFile(k)}.mp3`).sort());
    }
  });

  it('points at the file with a cache-busting hash, and leaves first names to the live voice', () => {
    expect(staticClipUrl('line:open.hohoho', 'fr')).toMatch(/^\/santa\/voice\/fr\/line-open\.hohoho\.mp3\?h=[0-9a-f]{10}$/);
    expect(staticClipUrl('name:hello:Léa', 'fr')).toBeNull();
    expect(santaText('advent:4', 'fr')).toContain('flocon');
  });
});
