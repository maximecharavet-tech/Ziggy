/**
 * Ziggy's and the elves' voice lines (src/data/games/lutin-factory/lines.json)
 * and the village letter writers. Every line is positive: emotions come from
 * the face module's happy set, cues/poses from the rigs' existing lists.
 */
import linesJson from '@/data/games/lutin-factory/lines.json';
import type { L } from './types';

export const HAPPY_EMOTIONS = ['neutral', 'smile', 'laugh', 'surprise', 'listen', 'wink'] as const;
export const ZIGGY_CUES = ['wave', 'cheer', 'jump', 'nod', 'oops', 'think', 'love', 'giggle'] as const;
export const ELF_POSES = ['stand', 'sit', 'wave', 'laugh', 'peek', 'tiptoe', 'point'] as const;
export const MOMENTS = [
  'letter-arrives',
  'machine-placed',
  'go',
  'go-first-of-day',
  'right-toy',
  'surprise-toy',
  'hint-offer',
  'letter-done',
  'day-ends',
  'new-machine',
  'child-leaves',
] as const;
export type Moment = (typeof MOMENTS)[number];

export interface Line {
  id: string;
  moment: Moment;
  speaker: 'ziggy' | 'pepin' | 'grelotte' | 'noisette';
  cue?: (typeof ZIGGY_CUES)[number];
  pose?: (typeof ELF_POSES)[number];
  emotion: (typeof HAPPY_EMOTIONS)[number];
  fr: string;
  en: string;
}

export interface Writer {
  id: string;
  emoji: string;
  name: L;
}

const data = linesJson as unknown as { schema: string; writers: Writer[]; lines: Line[] };

export const LINES: readonly Line[] = data.lines;
export const WRITERS: readonly Writer[] = data.writers;

export const linesFor = (moment: Moment): Line[] => LINES.filter((l) => l.moment === moment);
export const getWriter = (id: string): Writer | undefined => WRITERS.find((w) => w.id === id);

/** Pick a line for a moment, deterministically (the runtime passes a seeded counter). */
export function pickLine(moment: Moment, n: number): Line | undefined {
  const ls = linesFor(moment);
  return ls.length ? ls[((n % ls.length) + ls.length) % ls.length] : undefined;
}

/** Schema check of lines.json (empty = valid). */
export function validateLines(raw: unknown = linesJson): string[] {
  const out: string[] = [];
  const d = raw as typeof data;
  if (d?.schema !== 'ziggy.factory-lines/1') out.push('lines.json: bad schema');
  const ids = new Set<string>();
  for (const l of d?.lines ?? []) {
    if (ids.has(l.id)) out.push(`line ${l.id}: duplicate id`);
    ids.add(l.id);
    if (!/^factory\.[a-z0-9.-]+$/.test(l.id)) out.push(`line ${l.id}: bad id`);
    if (!(MOMENTS as readonly string[]).includes(l.moment)) out.push(`line ${l.id}: unknown moment`);
    if (!['ziggy', 'pepin', 'grelotte', 'noisette'].includes(l.speaker)) out.push(`line ${l.id}: unknown speaker`);
    if (!(HAPPY_EMOTIONS as readonly string[]).includes(l.emotion)) out.push(`line ${l.id}: emotion must be a happy one`);
    if (l.speaker === 'ziggy' ? !(ZIGGY_CUES as readonly string[]).includes(l.cue ?? '') : !(ELF_POSES as readonly string[]).includes(l.pose ?? ''))
      out.push(`line ${l.id}: Ziggy needs a rig cue, elves a pose`);
    if (!l.fr?.trim() || !l.en?.trim()) out.push(`line ${l.id}: needs fr and en`);
  }
  for (const m of MOMENTS) if (!(d?.lines ?? []).some((l) => l.moment === m)) out.push(`moment ${m}: no line`);
  const wids = new Set<string>();
  for (const w of d?.writers ?? []) {
    if (wids.has(w.id)) out.push(`writer ${w.id}: duplicate`);
    wids.add(w.id);
    if (!/^village\.[a-z-]+$/.test(w.id) || !w.emoji || !w.name?.fr || !w.name?.en) out.push(`writer ${w.id}: incomplete`);
  }
  return out;
}
