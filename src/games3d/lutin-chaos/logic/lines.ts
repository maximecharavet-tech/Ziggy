/**
 * Character lines (Ziggy and the elves), authored FR + EN in
 * `src/data/games/lutin-chaos/lines.json`. Each id is also a baked voice id
 * (`/games/lutin-chaos/voice/<locale>/<id>.mp3`), else browser TTS.
 */
import data from '@/data/games/lutin-chaos/lines.json';
import { pick, type Rng } from './rand';
import { elfName, fill } from './texts';
import { FACES, ZIGGY_CUES, isElf, type ElfId, type Face, type L, type ZiggyCue } from './types';

export const MOMENTS = [
  'welcome',
  'spot',
  'normal',
  'clue',
  'accuse-ok',
  'not-me',
  'miss',
  'peek',
  'caught',
  'high-five',
  'fix-start',
  'fix-oops',
  'fix-done',
  'room-fixed',
  'finale-start',
  'finale-step',
  'finale-hint',
  'finale-predict',
  'finale-done',
  'photo',
  'goodbye',
  'tonight',
  'sandbox-start',
  'sandbox-search',
  'sandbox-found',
  'sandbox-warmer',
  'sandbox-colder',
  'sandbox-prank',
  'sandbox-done',
] as const;
export type Moment = (typeof MOMENTS)[number];
export type Speaker = 'ziggy' | ElfId;

export interface Line {
  id: string;
  who: Speaker;
  moment: Moment;
  cue?: ZiggyCue;
  face: Face;
  /** Catch animation (caught lines) or miss gag (miss lines). */
  anim?: string;
  gag?: string;
  text: L;
}

export const LINES: Line[] = data.lines as Line[];

/** Problems in a lines file (used by tests; same rules for future packs). */
export function validateLines(lines: readonly Line[]): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  for (const l of lines) {
    if (ids.has(l.id)) out.push(`duplicate line id ${l.id}`);
    ids.add(l.id);
    if (!/^chaos\.[a-z0-9-]+\.[a-z]+\.\d+$/.test(l.id)) out.push(`bad line id ${l.id}`);
    if (l.who !== 'ziggy' && !isElf(l.who)) out.push(`${l.id}: unknown speaker ${l.who}`);
    if (!(MOMENTS as readonly string[]).includes(l.moment)) out.push(`${l.id}: unknown moment ${l.moment}`);
    if (!(FACES as readonly string[]).includes(l.face)) out.push(`${l.id}: face ${l.face} is not a happy face`);
    if (l.cue && !(ZIGGY_CUES as readonly string[]).includes(l.cue)) out.push(`${l.id}: cue ${l.cue} is not allowed`);
    if (!l.text?.fr?.trim() || !l.text?.en?.trim()) out.push(`${l.id}: needs fr and en text`);
  }
  return out;
}

export const linesFor = (moment: Moment, who?: Speaker) => LINES.filter((l) => l.moment === moment && (!who || l.who === who));

/** A seeded line for a moment, with `{elf}` filled. Falls back to Ziggy's lines. */
export function pickLine(rng: Rng, moment: Moment, who: Speaker = 'ziggy', vars: { elf?: ElfId } = {}): Line {
  const pool = linesFor(moment, who);
  const l = pick(rng, pool.length ? pool : linesFor(moment, 'ziggy').length ? linesFor(moment, 'ziggy') : linesFor(moment));
  return vars.elf ? { ...l, text: fill(l.text, { elf: elfName(vars.elf) }) } : l;
}
