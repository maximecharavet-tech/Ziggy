/**
 * Mode dodo — the sung versions of a story ("Version musicale"), pure logic.
 *
 * A story may ship N sung versions (Version 1, Version 2…), each with its own
 * audio file and its own timing file. The timing file is made offline by
 * scripts/align-dodo.py: the KNOWN lyrics aligned to the song (faster-whisper
 * word timestamps + sequence alignment), so the teleprompter shows the exact
 * lyrics and lights the line / word being sung.
 *
 * Timing file (v1, compact JSON):
 *   { v: 1, story, version, duration, match,
 *     lines: [{ s: start, e: end, k: 'verse' | 'chorus', w: [[start, end, "mot"], …] }] }
 */
import type { DodoSong, DodoStory } from '@/data/dodo/types';
import type { TextLocale } from './player';

export interface SongWord {
  s: number;
  e: number;
  text: string;
}
export interface SongLine {
  s: number;
  e: number;
  kind: 'verse' | 'chorus';
  words: SongWord[];
}
export interface SongTiming {
  duration: number;
  /** Share of lyric words matched to the recognised singing (0–1): how much to trust the word times. */
  match: number;
  lines: SongLine[];
}

/** One playable version of a story's song for a language. */
export interface SongVersion {
  id: string;
  label: string;
  url: string;
  timing: string | null;
}

/** The sung versions offered for this text language (in order), only those with an audio file. */
export function songVersions(story: Pick<DodoStory, 'songs'>, locale: TextLocale): SongVersion[] {
  const out: SongVersion[] = [];
  (story.songs ?? []).forEach((song: DodoSong, i) => {
    const url = song.audio[locale];
    if (typeof url !== 'string' || !url.trim()) return;
    const timing = song.timing?.[locale];
    out.push({
      id: song.id,
      label: song.label?.[locale] ?? (locale === 'fr' ? `Version ${i + 1}` : `Version ${i + 1}`),
      url,
      timing: typeof timing === 'string' && timing.trim() ? timing : null,
    });
  });
  return out;
}

/** The version to play: the one chosen before (if it still exists), else the first. */
export function pickVersion(versions: SongVersion[], chosen: string | undefined): SongVersion | null {
  if (!versions.length) return null;
  return versions.find((v) => v.id === chosen) ?? versions[0];
}

const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0;

/** Checks a timing file; null when it is unusable (the song then plays with the story text, unsynchronised). */
export function parseSongTiming(raw: unknown): SongTiming | null {
  const j = raw as { v?: unknown; duration?: unknown; match?: unknown; lines?: unknown } | null;
  if (!j || j.v !== 1 || !Array.isArray(j.lines) || !j.lines.length) return null;
  const lines: SongLine[] = [];
  let last = 0;
  for (const l of j.lines as { s?: unknown; e?: unknown; k?: unknown; w?: unknown }[]) {
    if (!l || !Array.isArray(l.w) || !l.w.length) return null;
    const words: SongWord[] = [];
    for (const w of l.w as unknown[]) {
      if (!Array.isArray(w) || !num(w[0]) || !num(w[1]) || typeof w[2] !== 'string' || !w[2]) return null;
      if (w[0] + 0.001 < last) return null; // must be in order
      last = w[0];
      words.push({ s: w[0], e: Math.max(w[0], w[1]), text: w[2] });
    }
    lines.push({ s: words[0].s, e: words[words.length - 1].e, kind: l.k === 'chorus' ? 'chorus' : 'verse', words });
  }
  const duration = num(j.duration) ? j.duration : lines[lines.length - 1].e;
  const match = num(j.match) ? Math.min(1, j.match) : 0;
  return { duration, match, lines };
}

/** Word highlighting is shown only when the alignment matched enough of the singing. */
export const wordsReliable = (t: SongTiming | null) => Boolean(t && t.match >= 0.6);

/** Last index i with starts[i] <= t (binary search), -1 before the first. */
function lastAtOrBefore(starts: number[], t: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** Shown a hair early, so the eye lands on the word as it is sung. */
export const SONG_LEAD = 0.12;

/**
 * Where the song is: the current line (-1 during the intro) and the word being
 * sung in it (-1 between lines; the line stays lit until the next one starts).
 */
/**
 * A line becomes the current one this long before its first word, a bit more than the pre-roll of
 * lineSeekTime: a tapped (or arrow-stepped) line is lit at once, and stepping again moves on.
 */
export const LINE_LEAD = 0.35;

export function songCursor(timing: SongTiming, time: number, lead = SONG_LEAD): { line: number; word: number } {
  const t = time + lead;
  const line = lastAtOrBefore(
    timing.lines.map((l) => l.s),
    time + Math.max(lead, LINE_LEAD)
  );
  if (line < 0) return { line: -1, word: -1 };
  const L = timing.lines[line];
  if (t > L.e + 0.6) return { line, word: L.words.length }; // whole line sung
  const word = lastAtOrBefore(
    L.words.map((w) => w.s),
    t
  );
  return { line, word };
}

/** Seconds to jump to when a line is tapped (a little before it, so its first word is heard). */
export const lineSeekTime = (line: SongLine) => Math.max(0, line.s - 0.3);

/** Which picture (segment) goes with this moment, following the lyrics' progress rather than raw time. */
export function songSegment(timing: SongTiming, time: number, count: number): number {
  if (count <= 1 || !timing.lines.length) return 0;
  const first = timing.lines[0].s;
  const end = timing.lines[timing.lines.length - 1].e;
  if (time < first) return 0; // the intro goes with the title picture
  const p = (time - first) / Math.max(1, end - first);
  return Math.max(1, Math.min(count - 1, 1 + Math.floor(p * (count - 1))));
}

/** Where a picture (segment) starts in the song: the inverse of songSegment, for the scene dots. */
export function songSegmentStart(timing: SongTiming, seg: number, count: number): number {
  if (seg <= 0 || count <= 1 || !timing.lines.length) return 0;
  const first = timing.lines[0].s;
  const end = timing.lines[timing.lines.length - 1].e;
  return first + ((Math.min(seg, count - 1) - 1) / (count - 1)) * (end - first) + 0.05;
}

/** The line before / after the current one, for ⏮ ⏭ and the arrow keys (-1 = the intro). */
export function neighbourLine(timing: SongTiming, time: number, dir: -1 | 1): number {
  const { line } = songCursor(timing, time, 0);
  if (dir > 0) return Math.min(timing.lines.length - 1, line + 1);
  // Back: to the start of this line if well into it, else the previous one.
  if (line >= 0 && time - timing.lines[line].s > 2) return line;
  return Math.max(0, line - 1);
}
