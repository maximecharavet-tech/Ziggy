import { describe, expect, it } from 'vitest';
import { arithmetic, verifyGameFactory, verifyStory } from './verify';
import type { GameFactoryOutput, StoryJson } from './schemas';

const game = (questions: GameFactoryOutput['questions'], extra: Partial<GameFactoryOutput> = {}): GameFactoryOutput => ({
  gameType: 'number_island',
  difficulty: 2,
  skill: 'addition',
  questions,
  story: 'Ziggy counts shells on the island.',
  reward: { xp: 10, stars: 1 },
  ...extra,
});
const want = { gameType: 'number_island', difficulty: 2, rounds: 3, mechanic: 'choice', ageGroup: '8-10' as const };

describe('Hyper Engine verify: arithmetic', () => {
  it('reads the usual ways to write a sum, a difference, a product, a division', () => {
    expect(arithmetic('7 + 5 = ?')).toBe(12);
    expect(arithmetic('Combien font 9 − 4 ?')).toBe(5);
    expect(arithmetic('3 × 4 = ?')).toBe(12);
    expect(arithmetic('12 ÷ 3 = ?')).toBe(4);
    expect(arithmetic('What colour is the sky?')).toBeNull();
  });
});

describe('Hyper Engine verify: game content', () => {
  const ok = [
    { prompt: '7 + 5 = ?', options: ['11', '12', '13'], answer: 1 },
    { prompt: '9 - 4 = ?', options: ['5', '6', '4'], answer: 0 },
    { prompt: 'Which animal says moo?', options: ['Cow', 'Cat', 'Duck'], answer: 0 },
  ];

  it('accepts true, well-formed content', () => {
    expect(verifyGameFactory(game(ok), want)).toEqual([]);
  });

  it('catches a wrong answer the schema cannot see', () => {
    const bad = [{ prompt: '7 + 5 = ?', options: ['11', '12', '13'], answer: 0 }, ok[1], ok[2]];
    expect(verifyGameFactory(game(bad), want).join()).toMatch(/correct result is 12/);
  });

  it('checks the requested shape: count, game, runner options, duplicates', () => {
    const issues = verifyGameFactory(game([ok[0], ok[0]], { gameType: 'math_runner' }), { ...want, mechanic: 'runner' }).join(' | ');
    expect(issues).toMatch(/gameType must be/);
    expect(issues).toMatch(/exactly 3 questions/);
    expect(issues).toMatch(/same question twice/);
  });

  it('applies the pre-reader rules for ages 5–7', () => {
    const little = [{ prompt: 'How many stars do you see in this very big night sky?', options: ['12', '🌟 two'], answer: 1 }];
    const issues = verifyGameFactory(game(little), { ...want, rounds: 1, ageGroup: '5-7' }).join(' | ');
    expect(issues).toMatch(/at most 10 words/);
    expect(issues).toMatch(/must start with one emoji/);
    expect(issues).toMatch(/at or below 10/);
  });
});

describe('Hyper Engine verify: stories', () => {
  const scene = (text: string) => ({ text, emoji: '⭐' });
  const story = (text: string): StoryJson => ({
    title: 'Ziggy and the star',
    chapters: [0, 1, 2].map((i) => ({ title: `Chapter ${i + 1}`, scenes: [scene(text), scene(text)] })),
    moral: 'Helping is a kind of magic.',
  });

  it('accepts a story of the right shape and length', () => {
    expect(verifyStory(story('Ziggy finds a star. He smiles.'), '5-7')).toEqual([]);
  });

  it('flags scenes too long for little ones and a wrong shape', () => {
    const long = 'Ziggy walks. He looks. He sees a star. He laughs.';
    expect(verifyStory(story(long), '5-7').join()).toMatch(/at most 2 sentences/);
    expect(verifyStory({ ...story('Hi.'), chapters: story('Hi.').chapters.slice(0, 2) }, '8-10').join()).toMatch(/exactly 3 chapters/);
  });
});
