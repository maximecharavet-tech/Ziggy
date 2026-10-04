/**
 * Spaced repetition for the memory boxes, on FSRS (ts-fsrs, from the
 * open-spaced-repetition project on GitHub — the scheduler that outperforms
 * Anki's). Each card is shown again just before it would be forgotten.
 *
 * The child never "fails" a card: "not yet" simply means "see you soon".
 */
import { fsrs, generatorParameters, createEmptyCard, Rating, State, type Card, type Grade } from 'ts-fsrs';
import type { MemoCard } from './decks';

export { Rating };
export type { Grade };

const scheduler = fsrs(generatorParameters({ enable_fuzz: false, request_retention: 0.9 }));

/** A card's memory, as stored. Dates are ISO strings. */
export type StoredCard = Omit<Card, 'due' | 'last_review'> & { due: string; last_review?: string };
export type DeckState = Record<string, StoredCard>;

export const toStored = (c: Card): StoredCard => ({
  ...c,
  due: c.due.toISOString(),
  last_review: c.last_review ? c.last_review.toISOString() : undefined,
});

export const fromStored = (s: StoredCard): Card => ({
  ...s,
  due: new Date(s.due),
  last_review: s.last_review ? new Date(s.last_review) : undefined,
});

/** New cards a child meets per session: a few at a time is how memory works. */
export const NEW_PER_SESSION = 6;
export const MAX_SESSION = 15;

/**
 * Today's session: every card due now (oldest first), then a few new ones.
 * Reviews come before new cards: remembering beats meeting.
 */
export function pickSession(cards: MemoCard[], state: DeckState, now: Date, newLimit = NEW_PER_SESSION): MemoCard[] {
  const due = cards
    .filter((c) => state[c.id] && new Date(state[c.id].due) <= now)
    .sort((a, b) => +new Date(state[a.id].due) - +new Date(state[b.id].due));
  const fresh = cards.filter((c) => !state[c.id]).slice(0, newLimit);
  return [...due, ...fresh].slice(0, MAX_SESSION);
}

/** Record an answer; returns the card's new memory. */
export function grade(state: StoredCard | undefined, rating: Grade, now: Date): StoredCard {
  const card = state ? fromStored(state) : createEmptyCard(now);
  return toStored(scheduler.next(card, now, rating).card);
}

/** Back again within this session? (FSRS learning steps are minutes long.) */
export function againSoon(state: StoredCard, now: Date): boolean {
  return new Date(state.due).getTime() - now.getTime() < 20 * 60_000;
}

/** Counts for the deck card: due now, new left, and safely in long-term memory. */
export function deckStats(cards: MemoCard[], state: DeckState, now: Date) {
  let due = 0,
    fresh = 0,
    longTerm = 0;
  for (const c of cards) {
    const s = state[c.id];
    if (!s) fresh++;
    else {
      if (new Date(s.due) <= now) due++;
      if (s.state === State.Review && s.stability >= 21) longTerm++;
    }
  }
  return { due, fresh, longTerm, total: cards.length };
}

/** Next time something is due, for "come back on…". */
export function nextDue(state: DeckState): Date | null {
  const dates = Object.values(state).map((s) => new Date(s.due).getTime());
  return dates.length ? new Date(Math.min(...dates)) : null;
}

/* ── Device storage ── */

const key = (deck: string) => `ziggy:memo:${deck}`;

export function loadDeck(deck: string): DeckState {
  try {
    return JSON.parse(window.localStorage.getItem(key(deck)) ?? '{}') as DeckState;
  } catch {
    return {};
  }
}

export function saveDeck(deck: string, state: DeckState): void {
  try {
    window.localStorage.setItem(key(deck), JSON.stringify(state));
  } catch {}
}
