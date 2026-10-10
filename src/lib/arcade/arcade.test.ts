import { describe, expect, it } from 'vitest';
import { WORLDS } from '@/data/worlds';
import { COMPANIONS } from '@/data/companions';
import { COMPANION_IDS } from '@/data/types';
import { LEARNING_SKILLS } from '@/lib/learning/skills';
import { ARCADE_GAMES, getGame } from './registry';
import { generateContent } from './generate';
import { ARCADE_GAME_IDS, MECHANICS, type ChoiceItem, type Difficulty, type GameContent } from './types';

const WORLD_IDS = [
  'princess',
  'space',
  'flower_fairy',
  'pirate',
  'dino',
  'unicorn',
  'heroes',
  'wizards',
  'underwater',
  'jungle',
  'robots',
  'artists',
  'chef',
  'stars',
  'ice',
  'fairytale',
  'safari',
  'reef',
  'future_city',
  'village',
];

const DIFFICULTIES: Difficulty[] = [1, 2, 3, 4, 5];
const LOCALES = ['fr', 'en'];
const SEEDS = [1, 42, 20260];
const LETTERS_ONLY = new RegExp('^\\p{L}+$', 'u');

describe('worlds', () => {
  it('has the 20 worlds in the right order', () => {
    expect(WORLDS.map((w) => w.id)).toEqual(WORLD_IDS);
  });

  it('places every world at a distinct spot on the map', () => {
    const spots = new Set(WORLDS.map((w) => `${w.map.x},${w.map.y}`));
    expect(spots.size).toBe(WORLDS.length);
    for (const w of WORLDS) {
      expect(w.map.x).toBeGreaterThanOrEqual(0);
      expect(w.map.x).toBeLessThanOrEqual(100);
      expect(w.map.y).toBeGreaterThanOrEqual(0);
      expect(w.map.y).toBeLessThanOrEqual(100);
    }
  });

  it('opens the first 4 worlds and unlocks the rest gently', () => {
    WORLDS.slice(0, 4).forEach((w) => expect(w.unlockStars).toBe(0));
    for (let i = 4; i < WORLDS.length; i++) {
      expect(WORLDS[i].unlockStars).toBeGreaterThan(WORLDS[i - 1].unlockStars);
    }
  });

  it.each(WORLDS.map((w) => [w.id, w] as const))('%s is complete and coherent', (_id, w) => {
    expect(w.name.fr && w.name.en).toBeTruthy();
    expect(w.description.fr && w.description.en).toBeTruthy();
    expect(w.background.length).toBeGreaterThanOrEqual(6);
    expect(w.background.length).toBeLessThanOrEqual(8);
    expect(w.characters).toHaveLength(3);
    expect(w.companions.length).toBeGreaterThanOrEqual(2);
    expect(w.companions.length).toBeLessThanOrEqual(3);
    w.companions.forEach((c) => expect(COMPANION_IDS).toContain(c));
    expect(w.learningSkills.length).toBeGreaterThanOrEqual(3);
    expect(w.learningSkills.length).toBeLessThanOrEqual(5);
    w.learningSkills.forEach((s) => expect(LEARNING_SKILLS).toContain(s));
    expect(w.availableGames.length).toBeGreaterThanOrEqual(3);
    expect(w.availableGames.length).toBeLessThanOrEqual(5);
    w.availableGames.forEach((g) => expect(ARCADE_GAME_IDS).toContain(g));

    expect(w.quests).toHaveLength(6);
    for (const chapter of [1, 2, 3]) {
      expect(w.quests.filter((q) => q.chapter === chapter)).toHaveLength(2);
    }
    w.quests.forEach((q, i) => {
      expect(q.id).toBe(`${w.id}_q${i + 1}`);
      expect(w.availableGames).toContain(q.gameId);
      expect(getGame(q.gameId).skills).toContain(q.skill);
      expect(w.learningSkills).toContain(q.skill);
      expect(q.reward.stars).toBe(1);
      expect(q.reward.xp).toBeGreaterThanOrEqual(10);
      expect(q.reward.xp).toBeLessThanOrEqual(30);
      expect(q.title.fr && q.title.en && q.intro.fr && q.intro.en).toBeTruthy();
      expect(q.outcome.label.fr && q.outcome.label.en && q.outcome.emoji).toBeTruthy();
    });
  });

  it('has globally unique quest ids', () => {
    const ids = WORLDS.flatMap((w) => w.quests.map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(120);
  });
});

describe('companions', () => {
  it('has the 8 companions', () => {
    expect(COMPANIONS.map((c) => c.id).sort()).toEqual([...COMPANION_IDS].sort());
  });

  it('starts with dragon, fox and owl unlocked', () => {
    for (const c of COMPANIONS) {
      if (['dragon', 'fox', 'owl'].includes(c.id)) expect(c.unlockStars).toBe(0);
      else {
        expect(c.unlockStars).toBeGreaterThanOrEqual(3);
        expect(c.unlockStars).toBeLessThanOrEqual(20);
      }
    }
  });

  it('has 3 lines per reaction in both languages', () => {
    for (const c of COMPANIONS) {
      for (const lines of Object.values(c.reactions)) {
        expect(lines).toHaveLength(3);
        lines.forEach((l) => expect(l.fr.length > 0 && l.en.length > 0).toBe(true));
      }
      expect(Object.keys(c.reactions).sort()).toEqual(['failure', 'hint', 'levelUp', 'questComplete', 'success']);
    }
  });
});

describe('arcade registry', () => {
  it('defines every game', () => {
    expect(Object.keys(ARCADE_GAMES).sort()).toEqual([...ARCADE_GAME_IDS].sort());
    for (const id of ARCADE_GAME_IDS) {
      const g = getGame(id);
      expect(g.id).toBe(id);
      expect(MECHANICS).toContain(g.mechanic);
      expect(g.skills.length).toBeGreaterThan(0);
      g.skills.forEach((s) => expect(LEARNING_SKILLS).toContain(s));
      expect(g.rounds).toHaveLength(5);
      expect(g.name.fr && g.name.en && g.description.fr && g.description.en).toBeTruthy();
    }
  });
});

function checkChoice(items: ChoiceItem[], maxOptions: number) {
  const keys = new Set<string>();
  for (const item of items) {
    expect(item.prompt.length).toBeGreaterThan(0);
    expect(item.options.length).toBeGreaterThanOrEqual(2);
    expect(item.options.length).toBeLessThanOrEqual(maxOptions);
    expect(new Set(item.options).size).toBe(item.options.length);
    expect(Number.isInteger(item.answer)).toBe(true);
    expect(item.answer).toBeGreaterThanOrEqual(0);
    expect(item.answer).toBeLessThan(item.options.length);
    keys.add(`${item.prompt}|${item.visual ?? ''}|${item.options[item.answer]}`);
  }
  expect(keys.size).toBe(items.length);
}

function roundsOf(content: GameContent): number {
  switch (content.kind) {
    case 'choice':
    case 'runner':
    case 'dig':
      return content.items.length;
    case 'pairs':
      return content.pairs.length;
    case 'order':
      return content.sets.length;
    case 'sort':
      return content.items.length;
    case 'spell':
      return content.words.length;
    case 'mix':
      return content.targets.length;
    case 'melody':
      return content.sequences.length;
    case 'slide':
      return 1;
  }
}

function checkContent(content: GameContent) {
  switch (content.kind) {
    case 'choice':
    case 'dig':
      checkChoice(content.items, 4);
      if (content.kind === 'dig') expect(content.find.emoji && content.find.name).toBeTruthy();
      break;
    case 'runner':
      checkChoice(content.items, 3);
      break;
    case 'pairs': {
      const cards = content.pairs.flatMap(([a, b]) => (a === b ? [a] : [a, b]));
      expect(new Set(cards).size).toBe(cards.length);
      break;
    }
    case 'order': {
      expect(new Set(content.sets.map((s) => s.prompt)).size).toBe(content.sets.length);
      for (const set of content.sets) {
        expect(set.steps.length).toBeGreaterThanOrEqual(3);
        expect(new Set(set.steps).size).toBe(set.steps.length);
      }
      break;
    }
    case 'sort': {
      const binIds = content.bins.map((b) => b.id);
      expect(new Set(binIds).size).toBe(binIds.length);
      expect(new Set(content.items.map((i) => i.label)).size).toBe(content.items.length);
      content.items.forEach((i) => expect(binIds).toContain(i.bin));
      binIds.forEach((id) => expect(content.items.some((i) => i.bin === id)).toBe(true));
      break;
    }
    case 'spell': {
      expect(new Set(content.words.map((w) => w.word)).size).toBe(content.words.length);
      content.words.forEach((w) => {
        expect(w.word).toMatch(LETTERS_ONLY);
        expect(w.hint.length).toBeGreaterThan(0);
      });
      break;
    }
    case 'mix': {
      const ids = content.palette.map((p) => p.id);
      expect(new Set(content.targets.map((t) => t.name)).size).toBe(content.targets.length);
      for (const t of content.targets) {
        expect(t.recipe.length).toBeGreaterThanOrEqual(2);
        t.recipe.forEach((c) => expect(ids).toContain(c));
      }
      break;
    }
    case 'melody': {
      expect(new Set(content.sequences.map((s) => s.join(','))).size).toBe(content.sequences.length);
      content.sequences.flat().forEach((n) => {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(4);
      });
      break;
    }
    case 'slide':
      expect([3, 4]).toContain(content.size);
      expect(content.picture.length).toBeGreaterThan(0);
      break;
  }
}

describe('generateContent', () => {
  for (const id of ARCADE_GAME_IDS) {
    it(`${id}: valid, sized and deterministic content`, () => {
      const game = getGame(id);
      for (const d of DIFFICULTIES) {
        for (const locale of LOCALES) {
          for (const seed of SEEDS) {
            const content = generateContent(id, d, locale, seed);
            expect(content.kind).toBe(game.mechanic);
            expect(roundsOf(content)).toBe(game.rounds[d - 1]);
            checkContent(content);
            expect(generateContent(id, d, locale, seed)).toEqual(content);
          }
        }
      }
    });
  }

  it('makes the sliding puzzle bigger at high difficulty', () => {
    const small = generateContent('puzzle_castle', 1, 'en', 1);
    const big = generateContent('puzzle_castle', 5, 'en', 1);
    expect(small.kind === 'slide' && small.size).toBe(3);
    expect(big.kind === 'slide' && big.size).toBe(4);
  });

  it('writes in French or English depending on the locale', () => {
    const fr = generateContent('little_scientist', 1, 'fr', 7);
    const en = generateContent('little_scientist', 1, 'en', 7);
    expect(fr).not.toEqual(en);
  });

  it('gives different content for different seeds', () => {
    expect(generateContent('math_runner', 3, 'en', 1)).not.toEqual(generateContent('math_runner', 3, 'en', 2));
  });
});
