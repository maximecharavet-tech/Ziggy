/**
 * Mode dodo — Ziggy's recorded voice (no AI, no API when a child listens).
 *
 * Every story is narrated ONCE, offline, by the generator in
 * `scripts/dodo-voice/` (a local neural voice turned into Ziggy's little
 * robot-child voice) and shipped as static files:
 *
 *   public/dodo/voice/{locale}/{storyId}/{segment}.mp3
 *   public/dodo/voice/{locale}/{storyId}/timing.json   (DodoVoiceTiming)
 *
 * Segments: `title` (the story title), `s1`…`s6` (the scenes, numbered like
 * the illustrations), `outro` (the moral then "good night", see outroText).
 *
 * `words[i]` is the start time, in seconds from the start of the segment's
 * audio, of token i of `text.trim().split(/\s+/)` — the exact text shown on
 * screen. The teleprompter lights each word as Ziggy says it.
 *
 * `visemes` (optional) is the mouth timeline Ziggy follows while he speaks:
 * `[time, shape]` pairs, sorted, from the phonemes the voice model actually
 * said (shapes are the mouths of the 3D plush, see VisemeShape).
 */

export type DodoVoiceLocale = 'fr' | 'en';
export const DODO_VOICE_LOCALES: DodoVoiceLocale[] = ['fr', 'en'];

export type DodoSegmentId = 'title' | `s${number}` | 'outro';

export interface DodoVoiceSegment {
  /** File name next to timing.json, e.g. "s1.mp3". */
  file: string;
  /** Audio length in seconds. */
  dur: number;
  /** The text that was read (identical to what the page shows). */
  text: string;
  /** Start time (s) of each whitespace-separated token of `text`. */
  words: number[];
  /** Mouth timeline for lip sync: [start time (s), shape], sorted by time. */
  visemes?: [number, VisemeShape][];
}

/**
 * Ziggy's mouths: `smile` = closed at rest or between words, `small` = lips
 * together (m, b, p, f, v), `open` = open vowels (a), `o` = rounded (o, ou, u,
 * w), `grin` = wide (i, é, è, s, z…).
 */
export type VisemeShape = 'smile' | 'small' | 'open' | 'o' | 'grin';

/** The mouth to show at time t (rest smile before the first cue). */
export function visemeAt(visemes: [number, VisemeShape][], t: number): VisemeShape {
  let lo = 0;
  let hi = visemes.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (visemes[mid][0] <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans < 0 ? 'smile' : visemes[ans][1];
}

export interface DodoVoiceTiming {
  /** 1 = first Python generator, 2 = Rust voice engine (adds visemes). */
  v: 1 | 2;
  /** Voice recipe id, e.g. "ziggy-v2" (for caches and the player's credits). */
  voice?: string;
  locale: DodoVoiceLocale;
  story: string;
  segments: Record<string, DodoVoiceSegment>;
}

export const voiceLocale = (locale: string): DodoVoiceLocale => (locale === 'fr' ? 'fr' : 'en');

export const voiceBase = (locale: string, storyId: string) => `/dodo/voice/${voiceLocale(locale)}/${storyId}`;

/** Tokens exactly as the timings count them. */
export const tokenize = (text: string) => text.trim().split(/\s+/);

/** Index of the word being said at time t (or -1 before the first). */
export function wordAt(words: number[], t: number): number {
  let lo = 0;
  let hi = words.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid] <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}
