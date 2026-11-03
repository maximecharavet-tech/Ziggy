import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DODO_STORIES, getDodoStory } from '@/data/dodo';
import { lineSeekTime, neighbourLine, parseSongTiming, pickVersion, songCursor, songSegment, songSegmentStart, songVersions, wordsReliable, type SongTiming } from './song';

const lili = getDodoStory('lili')!;
const T: SongTiming = parseSongTiming({
  v: 1,
  duration: 30,
  match: 0.95,
  lines: [
    { s: 2, e: 4, k: 'verse', w: [[2, 2.5, 'Il'], [2.5, 3, 'était'], [3, 4, 'une']] },
    { s: 6, e: 8, k: 'chorus', w: [[6, 7, 'Une'], [7, 8, 'gentillesse']] },
    { s: 10, e: 12, k: 'verse', w: [[10, 11, 'Fin'], [11, 12, 'douce.']] },
  ],
})!;

describe('sung versions', () => {
  it('offers Lili’s song in French only, and nothing for stories without one', () => {
    const v = songVersions(lili, 'fr');
    expect(v.length).toBe(2);
    expect(v[0]).toMatchObject({ id: 'v1', label: 'Version 1', url: '/dodo/lili/lili-v1.mp3', timing: '/dodo/lili/lili-v1.timing.json' });
    expect(v[1]).toMatchObject({ id: 'v2', label: 'Version 2', url: '/dodo/lili/lili-v2.mp3', timing: '/dodo/lili/lili-v2.timing.json' });
    expect(songVersions(lili, 'en')).toEqual([]);
    for (const s of DODO_STORIES.filter((x) => !x.songs?.length)) expect(songVersions(s, 'fr'), s.id).toEqual([]);
    expect(songVersions({ songs: [{ id: 'a', audio: { fr: '  ' } }] }, 'fr')).toEqual([]);
  });

  it('numbers versions and remembers the chosen one', () => {
    const v = songVersions({ songs: [{ id: 'v1', audio: { fr: '/a.mp3' } }, { id: 'v2', audio: { fr: '/b.mp3' }, timing: { fr: '/b.timing.json' } }] }, 'fr');
    expect(v.map((x) => x.label)).toEqual(['Version 1', 'Version 2']);
    expect(v[0].timing).toBeNull();
    expect(pickVersion(v, 'v2')?.id).toBe('v2');
    expect(pickVersion(v, 'gone')?.id).toBe('v1');
    expect(pickVersion(v, undefined)?.id).toBe('v1');
    expect(pickVersion([], 'v1')).toBeNull();
  });
});

describe('synchronised lyrics', () => {
  it('rejects broken timing files', () => {
    expect(parseSongTiming(null)).toBeNull();
    expect(parseSongTiming({ v: 2, lines: [] })).toBeNull();
    expect(parseSongTiming({ v: 1, lines: [{ w: [[1, 2, '']] }] })).toBeNull();
    expect(parseSongTiming({ v: 1, lines: [{ w: [[5, 6, 'a'], [1, 2, 'b']] }] })).toBeNull(); // out of order
    expect(T.lines[1].kind).toBe('chorus');
    expect(wordsReliable(T)).toBe(true);
    expect(wordsReliable({ ...T, match: 0.3 })).toBe(false);
  });

  it('finds the line and the word being sung (a hair early)', () => {
    expect(songCursor(T, 0)).toEqual({ line: -1, word: -1 });
    expect(songCursor(T, 1.9)).toEqual({ line: 0, word: 0 });
    expect(songCursor(T, 2.6)).toEqual({ line: 0, word: 1 });
    expect(songCursor(T, 3.5)).toEqual({ line: 0, word: 2 });
    expect(songCursor(T, 5)).toEqual({ line: 0, word: 3 }); // line sung, waiting for the next
    expect(songCursor(T, 7.2)).toEqual({ line: 1, word: 1 });
    expect(songCursor(T, 99)).toEqual({ line: 2, word: 2 });
  });

  it('seeks a tapped line just before it, and steps between lines', () => {
    expect(lineSeekTime(T.lines[1])).toBeCloseTo(5.7);
    expect(lineSeekTime(T.lines[0])).toBeCloseTo(1.7);
    expect(neighbourLine(T, 6.5, 1)).toBe(2);
    expect(neighbourLine(T, 6.5, -1)).toBe(0);
    expect(neighbourLine(T, 9, -1)).toBe(1); // well into line 1: back to its start
    expect(neighbourLine(T, 11, 1)).toBe(2);
  });

  it('moves the pictures with the lyrics', () => {
    expect(songSegment(T, 0, 8)).toBe(0);
    expect(songSegment(T, 2, 8)).toBe(1);
    expect(songSegment(T, 12, 8)).toBe(7);
    for (let seg = 1; seg < 8; seg++) expect(songSegment(T, songSegmentStart(T, seg, 8), 8)).toBe(seg);
    expect(songSegmentStart(T, 0, 8)).toBe(0);
  });

  it('Lili’s version 1 is aligned and in order', () => {
    const t = parseSongTiming(JSON.parse(readFileSync(join(process.cwd(), 'public/dodo/lili/lili-v1.timing.json'), 'utf8')))!;
    expect(t).not.toBeNull();
    expect(t.match).toBeGreaterThan(0.9);
    expect(t.lines[0].words[0].text).toBe('Il');
    expect(t.lines.at(-1)!.kind).toBe('chorus');
    expect(t.duration).toBeGreaterThan(270);
  });
  it('lights a tapped line at once, and stepping again moves on', () => {
    const at = lineSeekTime(T.lines[1]);
    expect(songCursor(T, at).line).toBe(1);
    expect(songCursor(T, at).word).toBe(-1);
    expect(neighbourLine(T, at, 1)).toBe(2);
    expect(neighbourLine(T, lineSeekTime(T.lines[2]), 1)).toBe(2);
  });
});
