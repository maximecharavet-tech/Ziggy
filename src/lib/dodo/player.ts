/**
 * Mode dodo — the story player's pure logic (no DOM, unit-tested).
 *
 * A story is played as segments: the title, the scenes s1…s6, then the outro
 * (the moral and "good night"). Each segment carries the text shown on the
 * teleprompter and the start time of every word (`words[i]` for token i of
 * `tokenize(text)`): from Ziggy's recorded timing.json when it exists, else
 * from a calm reading pace computed here, so the prompter always advances
 * gently, with or without a voice.
 */
import type { DodoStory } from '@/data/dodo/types';
import { outroText } from '@/data/dodo';
import { tokenize, voiceBase, wordAt, type DodoSegmentId, type DodoVoiceSegment, type DodoVoiceTiming } from './voice';

export type TextLocale = 'fr' | 'en';

/** French is told in French; every other site language uses the English text and recording. */
export const textLocale = (locale: string): TextLocale => (locale === 'fr' ? 'fr' : 'en');

/* ── Segments ── */

export function segmentIds(sceneCount: number): DodoSegmentId[] {
  return ['title', ...Array.from({ length: sceneCount }, (_, i) => `s${i + 1}` as DodoSegmentId), 'outro'];
}

export function segmentText(story: DodoStory, id: DodoSegmentId, locale: string): string {
  const l = textLocale(locale);
  if (id === 'title') return story.title[l];
  if (id === 'outro') return outroText(story, l);
  return story.scenes[Number(id.slice(1)) - 1]?.text[l] ?? '';
}

/** Which scene's illustration goes with a segment (the title shows the first, the outro the last). */
export function sceneOfSegment(id: DodoSegmentId, sceneCount: number): number {
  if (id === 'title') return 0;
  if (id === 'outro') return Math.max(0, sceneCount - 1);
  return Math.min(sceneCount - 1, Math.max(0, Number(id.slice(1)) - 1));
}

export const clampSegment = (i: number, count: number) => Math.max(0, Math.min(count - 1, Math.round(i)));

/**
 * The quiet moment between two segments: `hold` keeps the last words on
 * screen, then the next picture fades in and Ziggy starts after `lead`.
 */
export function gapAfter(id: DodoSegmentId, next: DodoSegmentId | null): { hold: number; lead: number } {
  if (!next) return { hold: 1800, lead: 0 };
  if (id === 'title') return { hold: 700, lead: 900 };
  if (next === 'outro') return { hold: 1300, lead: 1900 };
  return { hold: 900, lead: 1500 };
}

/* ── Calm reading pace (silent reading mode, and approximate sync) ── */

export const PACE = {
  /** Before the first word. */
  lead: 0.2,
  /** Every word, plus a little per letter: long words take longer. */
  word: 0.3,
  letter: 0.042,
  /** A token that is only punctuation (French « ? », « ! », « : »). */
  mark: 0.06,
  comma: 0.32,
  stop: 0.78,
  ellipsis: 0.95,
  /** After the last word. */
  tail: 0.35,
};

const letters = (tok: string) => tok.replace(/[^\p{L}\p{N}]/gu, '').length;
const lastCore = (tok: string) => tok.replace(/[»”"’)\]]+$/u, '');

/** Start time of each token at a calm bedtime reading pace (~100 words a minute, pauses included). */
export function paceWords(text: string): { words: number[]; dur: number } {
  const tokens = tokenize(text);
  const words: number[] = [];
  let t = PACE.lead;
  for (const tok of tokens) {
    words.push(round(t));
    const n = letters(tok);
    let d = n ? PACE.word + PACE.letter * n : PACE.mark;
    const core = lastCore(tok);
    if (/…$|\.\.\.$/.test(core)) d += PACE.ellipsis;
    else if (/[.!?]$/.test(core)) d += PACE.stop;
    else if (/[,;:]$/.test(core)) d += PACE.comma;
    t += d;
  }
  return { words, dur: round(t + PACE.tail) };
}

/** Stretch start times measured over `from` seconds to last `to` seconds (an audio file without timing). */
export function scaleWords(words: number[], from: number, to: number): number[] {
  if (!(from > 0) || !(to > 0)) return words;
  const k = to / from;
  return words.map((w) => round(w * k));
}

const round = (x: number) => Math.round(x * 1000) / 1000;

/* ── Sentences (the current one is softly emphasised) ── */

/**
 * Sentence number of every token. Dialogue in « … » or “ … ” stays inside its
 * sentence; a sentence ends on . ! ? … outside quotes (the closing quote
 * belongs to the sentence it closes).
 */
export function sentenceOf(tokens: string[]): number[] {
  const out: number[] = [];
  let depth = 0;
  let s = 0;
  let terminal = false;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    out.push(s);
    let opens = (tok.match(/[«“]/gu) ?? []).length;
    let closes = (tok.match(/[»”]/gu) ?? []).length;
    if (tok.includes('"')) {
      if (tok === '"') {
        if (depth > 0) closes++;
        else opens++;
      } else {
        if (tok.startsWith('"')) opens++;
        if (/"[^\p{L}\p{N}]*$/u.test(tok.slice(1))) closes++;
      }
    }
    depth = Math.max(0, depth + opens - closes);
    const core = lastCore(tok);
    if (core) terminal = /[.!?…]$/.test(core);
    if (depth === 0 && terminal) {
      // « Allons-y ! » dit Lili. — a closing quote followed by a lowercase word goes on.
      const goesOn = closes > 0 && /^\p{Ll}/u.test(tokens[i + 1] ?? '');
      if (!goesOn) s++;
      terminal = false;
    }
  }
  return out;
}

/** Index of the first token of each sentence. */
export function sentenceStarts(of: number[]): number[] {
  const starts: number[] = [];
  of.forEach((s, i) => {
    if (starts[s] === undefined) starts[s] = i;
  });
  return starts.filter((x) => x !== undefined);
}

/** Where to restart a segment saved at time t: the start of the sentence being said, a breath earlier. */
export function sentenceStartTime(words: number[], of: number[], t: number): number {
  const w = wordAt(words, t);
  if (w <= 0) return 0;
  const first = of.indexOf(of[w]);
  return Math.max(0, round((words[first] ?? 0) - 0.25));
}

/* ── How each word looks on the prompter ── */

export type HighlightMode = 'word' | 'line';
/** past: already said (softer) · now: being said (warm glow) · next: rest of the current sentence · later: the rest. */
export type WordLook = 'past' | 'now' | 'next' | 'later';

export function wordLook(i: number, current: number, of: number[], mode: HighlightMode, lineOf?: number[]): WordLook {
  if (current < 0) return 'later';
  if (mode === 'line' && lineOf && lineOf.length > Math.max(i, current)) {
    if (lineOf[i] === lineOf[current]) return 'now';
    if (lineOf[i] < lineOf[current]) return 'past';
    return of[i] === of[current] ? 'next' : 'later';
  }
  if (i === current) return 'now';
  if (i < current) return 'past';
  return of[i] === of[current] ? 'next' : 'later';
}

/** Lines of text as laid out on screen: token tops (px) → line number of each token. */
export function linesFromTops(tops: number[], tolerance = 4): number[] {
  const out: number[] = [];
  let line = -1;
  let top = -Infinity;
  for (const y of tops) {
    if (y > top + tolerance) {
      line++;
      top = y;
    }
    out.push(Math.max(0, line));
  }
  return out;
}

/**
 * Teleprompter scroll: the offset (px) that keeps the current line at
 * `anchor` (0…1 of the viewport height), never scrolling past the text.
 */
export function prompterOffset(lineTop: number, lineHeight: number, viewHeight: number, contentHeight: number, anchor = 0.42): number {
  const max = Math.max(0, contentHeight - viewHeight);
  const want = lineTop + lineHeight / 2 - viewHeight * anchor;
  return Math.round(Math.max(0, Math.min(max, want)));
}

/** Number of tokens of the outro that are the moral (shown as Ziggy's little lesson). */
export function moralTokens(story: DodoStory, locale: string): number {
  return tokenize(story.moral[textLocale(locale)]).length;
}

/* ── Recorded timing (timing.json) ── */

/** A timing.json, checked: bad segments are dropped; words that do not match the text are re-paced over the audio. */
export function parseTiming(json: unknown, storyId?: string): DodoVoiceTiming | null {
  if (!json || typeof json !== 'object') return null;
  const j = json as Partial<DodoVoiceTiming>;
  if (j.v !== 1 || !j.segments || typeof j.segments !== 'object') return null;
  if (storyId && j.story && j.story !== storyId) return null;
  const segments: Record<string, DodoVoiceSegment> = {};
  for (const [id, raw] of Object.entries(j.segments)) {
    const s = raw as Partial<DodoVoiceSegment>;
    if (!s || typeof s.file !== 'string' || !s.file || typeof s.text !== 'string' || !s.text.trim()) continue;
    if (typeof s.dur !== 'number' || !(s.dur > 0)) continue;
    const n = tokenize(s.text).length;
    const ok = Array.isArray(s.words) && s.words.length === n && s.words.every((w, k, a) => typeof w === 'number' && w >= 0 && (k === 0 || w >= a[k - 1]));
    let words: number[];
    if (ok) words = s.words as number[];
    else {
      const pace = paceWords(s.text);
      words = scaleWords(pace.words, pace.dur, s.dur);
    }
    segments[id] = { file: s.file, dur: s.dur, text: s.text, words };
  }
  if (!Object.keys(segments).length) return null;
  return { v: 1, locale: j.locale === 'fr' ? 'fr' : 'en', story: j.story ?? storyId ?? '', segments };
}

/** The timing covers the whole story (every segment recorded). */
export function timingComplete(timing: DodoVoiceTiming | null, sceneCount: number): boolean {
  return Boolean(timing && segmentIds(sceneCount).every((id) => timing.segments[id]));
}

/* ── What plays for each segment ── */

export type SegmentPlan =
  /** Ziggy's recorded voice with exact word timings. */
  | { kind: 'voice'; id: DodoSegmentId; text: string; words: number[]; dur: number; url: string }
  /** A pre-generated narration without timings: words are re-paced once its length is known. */
  | { kind: 'clip'; id: DodoSegmentId; text: string; words: number[]; dur: number; url: string }
  /** The device's own voice (offline speech synthesis), opt-in. */
  | { kind: 'device'; id: DodoSegmentId; text: string; words: number[]; dur: number }
  /** Silent reading: the prompter advances at a calm pace (a grown-up can read along). */
  | { kind: 'read'; id: DodoSegmentId; text: string; words: number[]; dur: number };

export type FallbackVoice = 'read' | 'device';

export function planSegment(
  story: DodoStory,
  id: DodoSegmentId,
  locale: string,
  opts: { timing?: DodoVoiceTiming | null; clip?: string | null; fallback?: FallbackVoice } = {}
): SegmentPlan {
  const rec = opts.timing?.segments[id];
  if (rec) {
    return { kind: 'voice', id, text: rec.text, words: rec.words, dur: rec.dur, url: `${voiceBase(locale, story.id)}/${rec.file}` };
  }
  const text = segmentText(story, id, locale);
  const pace = paceWords(text);
  if (opts.clip) return { kind: 'clip', id, text, words: pace.words, dur: pace.dur, url: opts.clip };
  return { kind: opts.fallback === 'device' ? 'device' : 'read', id, text, ...pace };
}

export function planStory(
  story: DodoStory,
  locale: string,
  opts: { timing?: DodoVoiceTiming | null; clips?: Record<number, string> | null; fallback?: FallbackVoice } = {}
): SegmentPlan[] {
  const n = story.scenes.length;
  return segmentIds(n).map((id) => {
    // Pre-generated narrations are numbered like the illustrations, the outro being n + 1.
    const num = id === 'title' ? 0 : id === 'outro' ? n + 1 : Number(id.slice(1));
    return planSegment(story, id, locale, { timing: opts.timing, clip: num ? (opts.clips?.[num] ?? null) : null, fallback: opts.fallback });
  });
}

/* ── Durations ── */

/** Seconds the whole story lasts, gaps included. */
export function planSeconds(plans: Pick<SegmentPlan, 'id' | 'dur'>[]): number {
  let total = 0;
  plans.forEach((p, i) => {
    const g = gapAfter(p.id, plans[i + 1]?.id ?? null);
    total += p.dur + (plans[i + 1] ? (g.hold + g.lead) / 1000 : 0);
  });
  return Math.round(total);
}

export function storySeconds(story: DodoStory, locale: string, timing?: DodoVoiceTiming | null): number {
  return planSeconds(planStory(story, locale, { timing }));
}

export const minutesOf = (seconds: number) => Math.max(1, Math.round(seconds / 60));

export type DurationBucket = 'short' | 'medium' | 'long';
export function durationBucket(seconds: number): DurationBucket {
  if (seconds < 200) return 'short';
  if (seconds <= 270) return 'medium';
  return 'long';
}

/** What the home needs to know about a story's recording. */
export type VoiceSummary = Record<string, { seconds: number; title: string | null; complete: boolean }>;

export function voiceSummaryOf(story: DodoStory, locale: string, timing: DodoVoiceTiming): VoiceSummary[string] {
  return { seconds: storySeconds(story, locale, timing), title: timing.segments.title?.file ?? null, complete: timingComplete(timing, story.scenes.length) };
}

/* ── Where the child stopped, per story ── */

export interface DodoPosition {
  /** Segment index (0 = title). */
  seg: number;
  /** Seconds into the segment. */
  t: number;
  /** When it was saved (ms). */
  at: number;
}

const POSITION_TTL = 45 * 24 * 3600 * 1000;

export function readPositions(raw: string | null, now = Date.now()): Record<string, DodoPosition> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<DodoPosition>>;
    const out: Record<string, DodoPosition> = {};
    for (const [id, p] of Object.entries(parsed ?? {})) {
      if (!p || typeof p.seg !== 'number' || typeof p.t !== 'number' || typeof p.at !== 'number') continue;
      if (now - p.at > POSITION_TTL) continue;
      out[id] = { seg: Math.max(0, Math.floor(p.seg)), t: Math.max(0, p.t), at: p.at };
    }
    return out;
  } catch {
    return {};
  }
}

/** Remember a position (keeps the most recent `max` stories). */
export function rememberPosition(map: Record<string, DodoPosition>, storyId: string, pos: DodoPosition, max = 12): Record<string, DodoPosition> {
  const next = { ...map, [storyId]: pos };
  const ids = Object.keys(next).sort((a, b) => next[b].at - next[a].at);
  return Object.fromEntries(ids.slice(0, max).map((id) => [id, next[id]]));
}

export function forgetPosition(map: Record<string, DodoPosition>, storyId: string): Record<string, DodoPosition> {
  const next = { ...map };
  delete next[storyId];
  return next;
}

/** A saved position worth offering ("continue"): past the title and before the very end. */
export function resumable(pos: DodoPosition | undefined, segmentCount: number): pos is DodoPosition {
  if (!pos) return false;
  if (pos.seg >= segmentCount) return false;
  return pos.seg > 0 || pos.t > 1.5;
}
