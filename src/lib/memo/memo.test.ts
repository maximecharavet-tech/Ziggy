import { describe, expect, it } from 'vitest';
import { buildDeck, sameAnswer, wordLanguage, DECKS } from './decks';
import { pickSession, grade, againSoon, deckStats, nextDue, Rating, type DeckState } from './scheduler';

const now = new Date('2026-10-04T09:00:00Z');
const day = (n: number) => new Date(now.getTime() + n * 86_400_000);

describe('decks', () => {
  it('builds every deck with unique ids', () => {
    for (const d of DECKS) {
      const cards = buildDeck(d.id, 'fr');
      expect(cards.length).toBeGreaterThan(15);
      expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
    }
    expect(buildDeck('times', 'fr').find((c) => c.prompt === '7 × 8')?.answer).toBe('56');
    expect(buildDeck('bonds', 'fr').find((c) => c.prompt === '13 + ? = 20')?.answer).toBe('7');
  });

  it('teaches English, or French to English speakers', () => {
    expect(wordLanguage('fr')).toBe('en');
    expect(wordLanguage('en')).toBe('fr');
    expect(buildDeck('words', 'en')[0].answer).toBe('chat');
    expect(buildDeck('words', 'ja')[0].answer).toBe('cat');
  });

  it('accepts answers kindly', () => {
    expect(sameAnswer(' Étoile ', 'etoile')).toBe(true);
    expect(sameAnswer('arc en ciel', 'arc-en-ciel')).toBe(true);
    expect(sameAnswer('', '')).toBe(false);
    expect(sameAnswer('chien', 'chat')).toBe(false);
  });
});

describe('scheduler', () => {
  const cards = buildDeck('bonds', 'fr');

  it('starts with a few new cards, then brings back what is due first', () => {
    expect(pickSession(cards, {}, now)).toHaveLength(6);
    const state: DeckState = { [cards[10].id]: grade(undefined, Rating.Good, day(-10)) };
    const session = pickSession(cards, state, now);
    expect(session[0].id).toBe(cards[10].id);
    expect(session).toHaveLength(7);
  });

  it('spaces a remembered card further than a "not yet" one', () => {
    const notYet = grade(undefined, Rating.Again, now);
    const known = grade(undefined, Rating.Easy, now);
    expect(againSoon(notYet, now)).toBe(true);
    expect(new Date(known.due).getTime()).toBeGreaterThan(day(3).getTime());
  });

  it('grows the interval each time a card is remembered', () => {
    let s = grade(undefined, Rating.Good, now);
    let at = new Date(s.due);
    const gaps: number[] = [];
    for (let i = 0; i < 4; i++) {
      s = grade(s, Rating.Good, at);
      const next = new Date(s.due);
      gaps.push(next.getTime() - at.getTime());
      at = next;
    }
    expect(gaps.every((g, i) => i === 0 || g > gaps[i - 1])).toBe(true);
  });

  it('counts due, new and long-term cards', () => {
    let s = grade(undefined, Rating.Easy, day(-200));
    for (let i = 0; i < 5; i++) s = grade(s, Rating.Easy, new Date(s.due));
    const state: DeckState = { [cards[0].id]: s, [cards[1].id]: grade(undefined, Rating.Again, now) };
    const stats = deckStats(cards, state, day(1));
    expect(stats.fresh).toBe(cards.length - 2);
    expect(stats.longTerm).toBe(1);
    expect(stats.due).toBeGreaterThanOrEqual(1);
    expect(nextDue(state)).not.toBeNull();
  });
});
