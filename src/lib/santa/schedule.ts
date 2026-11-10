/**
 * Scheduled calls: "Santa will call you at 6 pm" (L'appli du Père Noël).
 *
 * A parent picks a child, a call and a time. Everything stays on the device
 * (localStorage). When the time comes and a page of the app is open, the phone
 * rings full screen; a notification (if the parent allowed them) and a calendar
 * reminder (.ics) bring the family back otherwise. The clips of a scheduled call
 * are fetched and kept in advance (see precache.ts), so the Christmas Eve call
 * plays even when the network is busy on the 24th.
 *
 * Pure functions here (tested); the tiny store is at the bottom.
 */
import type { CallKind } from './call-script';
import type { SantaTier } from './types';
import { SANTA_VALID_UNTIL_MS } from './offer';

export type ScheduledCall = {
  id: string;
  childId: string;
  kind: CallKind;
  /** When the phone rings (ms since epoch). */
  at: number;
  createdAt: number;
  /** Set when the call was answered or dismissed. */
  doneAt?: number | null;
  /** Clips stored on the device in advance. */
  ready?: boolean;
};

/** How long after its time a call still rings when the app is opened. */
export const RING_WINDOW_MS = 2 * 60 * 60 * 1000;
/** At most this many calls waiting at once. */
export const MAX_SCHEDULED = 6;

/** 24 December 2026, 6:30 pm in Paris: the default Christmas Eve call. */
export const CHRISTMAS_EVE_CALL_AT = Date.parse('2026-12-24T18:30:00+01:00');

/** Which calls a family may schedule: free → the voice message only; any pack → every call. */
export function schedulableKinds(tier: SantaTier | null): CallKind[] {
  return tier ? ['veille', 'liste', 'nouvelles', 'message'] : ['message'];
}

export type ScheduleError = 'past' | 'too-late' | 'kind' | 'full';

export function validateSchedule(input: { kind: CallKind; at: number }, ctx: { now: number; tier: SantaTier | null; pending: number }): ScheduleError | null {
  if (!schedulableKinds(ctx.tier).includes(input.kind)) return 'kind';
  // The time input has minute precision: the current minute is still fine (it rings at once).
  if (!Number.isFinite(input.at) || input.at < Math.floor(ctx.now / 60_000) * 60_000) return 'past';
  if (input.at > SANTA_VALID_UNTIL_MS) return 'too-late';
  if (ctx.pending >= MAX_SCHEDULED) return 'full';
  return null;
}

export function pendingCalls(list: ScheduledCall[], now: number): ScheduledCall[] {
  return list.filter((c) => !c.doneAt && c.at + RING_WINDOW_MS > now).sort((a, b) => a.at - b.at);
}

/** The call that should ring right now (the oldest one due), if any. */
export function dueCall(list: ScheduledCall[], now: number): ScheduledCall | null {
  return pendingCalls(list, now).find((c) => c.at <= now) ?? null;
}

/** The next call still to come. */
export function nextCall(list: ScheduledCall[], now: number): ScheduledCall | null {
  return pendingCalls(list, now).find((c) => c.at > now) ?? null;
}

/** ms until the next call rings (capped so a setTimeout never overflows), or null. */
export function msUntilNext(list: ScheduledCall[], now: number): number | null {
  const n = nextCall(list, now);
  return n ? Math.min(n.at - now, 2 ** 31 - 1) : null;
}

/** Date + time in Paris for a datetime-local input value ("2026-12-24T18:30"). */
export function parisLocalToMs(value: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return NaN;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Paris offset at that moment (handles summer/winter time).
  const offset = parisOffsetMinutes(guess);
  return guess - offset * 60_000;
}

export function parisOffsetMinutes(ms: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return Math.round((asUtc - Math.floor(ms / 60_000) * 60_000) / 60_000);
}

export function msToParisLocal(ms: number): string {
  const d = new Date(ms + parisOffsetMinutes(ms) * 60_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

const icsDate = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

/** A calendar reminder with an alarm, opening the call page (no personal data beyond the first name). */
export function toIcs(call: ScheduledCall, opts: { title: string; description: string; url: string; now?: number }): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ziggy//Pere Noel//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:santa-${call.id}@ziggy-ai.fr`,
    `DTSTAMP:${icsDate(opts.now ?? Date.now())}`,
    `DTSTART:${icsDate(call.at)}`,
    `DTEND:${icsDate(call.at + 15 * 60_000)}`,
    `SUMMARY:${icsText(opts.title)}`,
    `DESCRIPTION:${icsText(`${opts.description}\n${opts.url}`)}`,
    `URL:${opts.url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(opts.title)}`,
    'TRIGGER:-PT2M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

/** The page that rings for a scheduled call. */
export const ringPath = (id: string) => `/pere-noel/appel?ring=${encodeURIComponent(id)}`;

/* ------------------------------------------------------------------ store */

const KEY = 'ziggy:santa:schedule:v1';
let cache: ScheduledCall[] | null = null;
const listeners = new Set<() => void>();
const EMPTY: ScheduledCall[] = [];

const KINDS: CallKind[] = ['liste', 'nouvelles', 'veille', 'message'];

export function parseSchedule(raw: unknown): ScheduledCall[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (c): c is ScheduledCall =>
        !!c && typeof c === 'object' && typeof c.id === 'string' && typeof c.childId === 'string' && KINDS.includes(c.kind) && Number.isFinite(c.at) && Number.isFinite(c.createdAt),
    )
    .slice(-20);
}

function read(): ScheduledCall[] {
  if (cache) return cache;
  try {
    cache = parseSchedule(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: ScheduledCall[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode: memory only */
  }
  listeners.forEach((l) => l());
}

export const scheduleStore = {
  get: () => (typeof window === 'undefined' ? EMPTY : read()),
  subscribe(l: () => void) {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        cache = null;
        l();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener('storage', onStorage);
    };
  },
  serverSnapshot: () => EMPTY,
  add(call: Omit<ScheduledCall, 'id' | 'createdAt'>): ScheduledCall {
    const c: ScheduledCall = { ...call, id: Math.random().toString(36).slice(2, 10), createdAt: Date.now() };
    write([...read(), c]);
    return c;
  },
  update(id: string, patch: Partial<ScheduledCall>) {
    write(read().map((c) => (c.id === id ? { ...c, ...patch } : c)));
  },
  remove(id: string) {
    write(read().filter((c) => c.id !== id));
  },
  find(id: string): ScheduledCall | null {
    return read().find((c) => c.id === id) ?? null;
  },
};
