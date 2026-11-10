import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDodoStory } from './index';
import { MUSICAL_STORIES } from './assets';
import { parseSongTiming, pickVersion, songVersions, wordsReliable } from '@/lib/dodo/song';

describe('musical bedtime stories (d01–d30 catalogue)', () => {
  it.each(Object.entries(MUSICAL_STORIES))('%s ships two French songs and a cover (%s)', (id, slug) => {
    const story = getDodoStory(id)!;
    const versions = songVersions(story, 'fr');
    expect(versions.map((v) => v.id)).toEqual(['v1', 'v2']);
    expect(pickVersion(versions, undefined)?.id).toBe('v1');
    expect(pickVersion(versions, 'v2')?.id).toBe('v2');
    expect(songVersions(story, 'en')).toEqual([]);
    expect(story.scenes).toHaveLength(6);
    expect(story.cover).toBe(`/dodo/${slug}/cover.webp`);
    const cover = readFileSync(join('public', story.cover!));
    expect(cover.toString('ascii', 0, 4)).toBe('RIFF');
    expect(cover.toString('ascii', 8, 12)).toBe('WEBP');
    for (const v of versions) {
      expect(v.url).toBe(`/dodo/${slug}/${slug}-${v.id}.mp3`);
      expect(v.timing).toBe(`/dodo/${slug}/${slug}-${v.id}.timing.json`);
      expect(existsSync(join('public', v.url))).toBe(true);
      expect(statSync(join('public', v.url)).size).toBeLessThan(4_500_000);
      const raw = JSON.parse(readFileSync(join('public', v.timing!), 'utf8'));
      expect(raw.story).toBe(story.id);
      expect(String(raw.version)).toBe(v.id.slice(1));
      const timing = parseSongTiming(raw);
      expect(timing).not.toBeNull();
      expect(wordsReliable(timing)).toBe(true);
      expect(timing!.match).toBeGreaterThan(0.9);
      expect(timing!.lines.at(-1)!.e).toBeLessThanOrEqual(timing!.duration + 0.1);
    }
  });

  it('leaves non-musical catalogue stories and Lili unchanged', () => {
    for (let i = 1; i <= 30; i++) {
      const id = `d${String(i).padStart(2, '0')}`;
      if (MUSICAL_STORIES[id]) continue;
      const story = getDodoStory(id)!;
      expect(story.songs).toBeUndefined();
      expect(story.cover).toBeUndefined();
    }
    expect(getDodoStory('lili')!.cover).toBe('/dodo/lili/lili.webp');
    expect(songVersions(getDodoStory('lili')!, 'fr').map((v) => v.url)).toEqual(['/dodo/lili/lili-v1.mp3', '/dodo/lili/lili-v2.mp3']);
  });
});
