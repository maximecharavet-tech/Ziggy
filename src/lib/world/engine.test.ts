import { describe, expect, it } from 'vitest';
import type { CompanionProfile, QuestDefinition, WorldDefinition } from '@/data/types';
import type { ArcadeGameId } from '@/lib/arcade/types';
import type { LearningSkill } from '@/lib/learning/skills';
import { accuracy, bktStep, masteryBand, roundStars, updateSkill, INITIAL_SKILL } from '@/lib/learning/adaptive';
import { applyRound, nextAdventure, unlockedChapter, unlockedCompanions } from './engine';
import { emptyMemory, mergeMemory, normalizeMemory, totalStars, WorldMemorySchema } from './memory';
import { levelFor } from './gamification';
import { companionStep, INITIAL_COMPANION } from './companion';
import { buildStory } from '@/lib/story/engine';

const L = (s: string) => ({ fr: s, en: s });

function quest(world: string, n: number, skill: LearningSkill, gameId: ArcadeGameId = 'math_runner'): QuestDefinition {
  return {
    id: `${world}_q${n}`,
    title: L(`Q${n}`),
    intro: L(`intro ${n}`),
    gameId,
    skill,
    chapter: Math.ceil(n / 2) as 1 | 2 | 3,
    outcome: { kind: n === 2 ? 'character' : 'item', id: `${world}_o${n}`, label: L(`found ${n}`), emoji: '✨' },
    reward: { xp: 20, stars: 3 },
  };
}

function world(id: string, unlockStars: number, skills: LearningSkill[] = ['addition', 'letters']): WorldDefinition {
  return {
    id,
    map: { x: 10, y: 10 },
    name: L(id),
    description: L(id),
    icon: '🏰',
    colors: { from: '#fff', to: '#eee', accent: '#f0f', ink: '#000' },
    background: ['⭐'],
    characters: [{ id: `${id}_o2`, name: L('Friend'), emoji: '🧚', role: L('guide') }],
    companions: ['dragon'],
    learningSkills: skills,
    availableGames: ['math_runner'],
    quests: [1, 2, 3, 4, 5, 6].map((n) => quest(id, n, skills[n % skills.length])),
    unlockStars,
  };
}

const W = [world('alpha', 0), world('beta', 6)];
const C = [
  { id: 'dragon', unlockStars: 0 },
  { id: 'fox', unlockStars: 5 },
] as unknown as CompanionProfile[];
const TODAY = '2026-10-10';
const perfect = { correct: 5, mistakes: 0, total: 5 };

describe('adaptive learning', () => {
  it('computes accuracy and never gives zero stars', () => {
    expect(accuracy({ correct: 3, mistakes: 1, total: 3 })).toBe(0.75);
    expect(roundStars({ correct: 0, mistakes: 5, total: 5 })).toBe(1);
    expect(roundStars(perfect)).toBe(3);
  });

  it('BKT moves mastery up on success and down on error, within bounds', () => {
    expect(bktStep(0.3, true)).toBeGreaterThan(0.3);
    expect(bktStep(0.6, false)).toBeLessThan(0.6);
    let p = 0.5;
    for (let i = 0; i < 100; i++) p = bktStep(p, true);
    expect(p).toBeLessThanOrEqual(0.99);
  });

  it('raises difficulty after a perfect round and lowers it gently after a hard one', () => {
    const up = updateSkill(INITIAL_SKILL, perfect);
    expect(up.change).toBe('up');
    expect(up.state.difficulty).toBe(2);
    const down = updateSkill(up.state, { correct: 1, mistakes: 4, total: 5 });
    expect(down.change).toBe('down');
    expect(down.state.difficulty).toBe(1);
    // Never below 1.
    expect(updateSkill(down.state, { correct: 0, mistakes: 5, total: 5 }).state.difficulty).toBe(1);
  });

  it('describes mastery with friendly bands', () => {
    expect(masteryBand(0.1)).toBe('discovering');
    expect(masteryBand(0.9)).toBe('expert');
  });
});

describe('quest engine', () => {
  it('starts with the first quest of the first open world', () => {
    const plan = nextAdventure(emptyMemory('alpha'), W, TODAY)!;
    expect(plan.worldId).toBe('alpha');
    expect(plan.chapter).toBe(1);
    expect(plan.isDaily).toBe(true);
    expect(plan.difficulty).toBe(1);
  });

  it('is deterministic', () => {
    const m = emptyMemory('alpha');
    expect(nextAdventure(m, W, TODAY)).toEqual(nextAdventure(m, W, TODAY));
  });

  it('opens chapters in order', () => {
    let m = emptyMemory('alpha');
    expect(unlockedChapter(W[0], m)).toBe(1);
    for (const n of [1, 2]) m = applyRound(m, { gameId: 'math_runner', skill: 'addition', stats: perfect, durationMs: 1000, worldId: 'alpha', questId: `alpha_q${n}` }, W, C, TODAY).memory;
    expect(unlockedChapter(W[0], m)).toBe(2);
  });

  it('ignores a quest that is not open yet', () => {
    const out = applyRound(emptyMemory('alpha'), { gameId: 'math_runner', skill: 'addition', stats: perfect, durationMs: 1000, worldId: 'alpha', questId: 'alpha_q5' }, W, C, TODAY);
    expect(out.memory.completedQuests.alpha_q5).toBeUndefined();
  });

  it('prefers a confident skill after hard rounds', () => {
    const m = emptyMemory('alpha');
    m.skills.addition = { ...INITIAL_SKILL, masteryEstimate: 0.9 };
    m.skills.letters = { ...INITIAL_SKILL, masteryEstimate: 0.1 };
    expect(nextAdventure(m, W, TODAY)!.skill).toBe('letters'); // practise the weak one
    m.recent = [0.2, 0.3, 0.1].map((a) => ({ gameId: 'math_runner', skill: 'letters' as const, accuracy: a, at: TODAY }));
    const plan = nextAdventure(m, W, TODAY)!;
    expect(plan.skill).toBe('addition');
    expect(plan.reason).toBe('confidence');
  });
});

describe('progression and magic moments', () => {
  it('completes a quest with rewards, collection, daily bonus and first-quest moment', () => {
    const out = applyRound(emptyMemory('alpha'), { gameId: 'math_runner', skill: 'addition', stats: perfect, durationMs: 60_000, worldId: 'alpha', questId: 'alpha_q1' }, W, C, TODAY);
    const kinds = out.magic.map((x) => x.kind);
    expect(out.memory.completedQuests.alpha_q1.stars).toBe(3);
    expect(out.memory.collection).toContain('alpha_o1');
    expect(out.memory.dailyDone).toBe(TODAY);
    expect(kinds).toEqual(expect.arrayContaining(['FIRST_QUEST', 'FIRST_PERFECT', 'NEW_ITEM', 'DAILY_DONE', 'NEW_BADGE']));
    expect(out.xpGained).toBeGreaterThan(20);
  });

  it('celebrates one-time moments only once and never lowers stars', () => {
    const input = { gameId: 'math_runner' as const, skill: 'addition' as const, durationMs: 1000, worldId: 'alpha', questId: 'alpha_q1' };
    const a = applyRound(emptyMemory('alpha'), { ...input, stats: perfect }, W, C, TODAY);
    const b = applyRound(a.memory, { ...input, stats: { correct: 1, mistakes: 4, total: 5 } }, W, C, TODAY);
    expect(b.magic.map((x) => x.kind)).not.toContain('FIRST_QUEST');
    expect(b.magic.map((x) => x.kind)).not.toContain('DAILY_DONE');
    expect(b.memory.completedQuests.alpha_q1.stars).toBe(3);
    expect(b.memory.completedQuests.alpha_q1.plays).toBe(2);
  });

  it('unlocks a new world and a new companion with stars', () => {
    let m = emptyMemory('alpha');
    const kinds: string[] = [];
    for (const n of [1, 2]) {
      const out = applyRound(m, { gameId: 'math_runner', skill: 'addition', stats: perfect, durationMs: 1000, worldId: 'alpha', questId: `alpha_q${n}` }, W, C, TODAY);
      kinds.push(...out.magic.map((x) => `${x.kind}:${x.ref ?? ''}`));
      m = out.memory;
    }
    expect(totalStars(m)).toBe(6);
    expect(kinds).toContain('NEW_WORLD:beta');
    expect(kinds).toContain('NEW_COMPANION:fox');
    expect(kinds).toContain('CHAPTER_COMPLETE:alpha:1');
    expect(unlockedCompanions(m, C)).toEqual(['dragon', 'fox']);
  });

  it('levels grow gently', () => {
    expect(levelFor(0).level).toBe(1);
    expect(levelFor(60).level).toBe(2);
    expect(levelFor(149).level).toBe(2);
    expect(levelFor(150).level).toBe(3);
  });
});

describe('world memory', () => {
  it('validates and repairs storage', () => {
    expect(WorldMemorySchema.safeParse(emptyMemory()).success).toBe(true);
    expect(normalizeMemory({ hacked: true }).xp).toBe(0);
    expect(normalizeMemory({ ...emptyMemory(), xp: -5 }).xp).toBe(0);
  });

  it('merges without losing progress', () => {
    const a = emptyMemory();
    a.xp = 100;
    a.completedQuests = { alpha_q1: { stars: 2, plays: 1, at: '2026-01-01' } };
    const b = emptyMemory();
    b.xp = 50;
    b.completedQuests = { alpha_q1: { stars: 3, plays: 2, at: '2026-01-02' }, alpha_q2: { stars: 1, plays: 1, at: '2026-01-02' } };
    b.collection = ['x'];
    const m = mergeMemory(a, b);
    expect(m.xp).toBe(100);
    expect(m.completedQuests.alpha_q1.stars).toBe(3);
    expect(Object.keys(m.completedQuests)).toHaveLength(2);
    expect(m.collection).toEqual(['x']);
  });
});

describe('companion state machine', () => {
  it('cheers, empathises, then thinks again', () => {
    let s = companionStep(INITIAL_COMPANION, 'start');
    expect(s.mood).toBe('THINKING');
    s = companionStep(s, 'correct');
    expect(s.mood).toBe('HAPPY');
    s = companionStep(companionStep(s, 'correct'), 'correct');
    expect(s.mood).toBe('EXCITED');
    s = companionStep(s, 'wrong');
    expect(s.mood).toBe('SAD');
    expect(companionStep(s, 'rest').mood).toBe('THINKING');
    expect(companionStep(s, 'questComplete').mood).toBe('CELEBRATE');
  });
});

describe('story engine', () => {
  it('derives chapters, scenes and the next scene from memory', () => {
    const m = applyRound(emptyMemory('alpha'), { gameId: 'math_runner', skill: 'addition', stats: perfect, durationMs: 1000, worldId: 'alpha', questId: 'alpha_q1' }, W, C, TODAY).memory;
    const story = buildStory(W[0], m, 'fr');
    expect(story.chapters).toHaveLength(3);
    expect(story.chapters[0].scenes[0].status).toBe('done');
    expect(story.chapters[0].scenes[1].status).toBe('open');
    expect(story.chapters[1].status).toBe('locked');
    expect(story.next?.questId).toBe('alpha_q2');
    expect(story.world.found[0].id).toBe('alpha_o1');
  });
});

describe('mastery pacing', () => {
  it('needs several good sessions to reach expert', () => {
    let s = updateSkill(undefined, perfect).state;
    expect(s.masteryEstimate).toBeLessThan(0.85);
    for (let i = 0; i < 4; i++) s = updateSkill(s, perfect).state;
    expect(s.masteryEstimate).toBeGreaterThanOrEqual(0.85);
  });
});

describe('pre-readers', () => {
  it('reads aloud automatically for children who cannot read fluently yet', async () => {
    const { readAloudOn, maxDifficulty, aiAgeGroup } = await import('./memory');
    const m = emptyMemory();
    expect(m.age).toBeNull();
    expect(readAloudOn({ ...m, age: 'little' })).toBe(true);
    expect(readAloudOn({ ...m, age: 'middle' })).toBe(true);
    expect(readAloudOn({ ...m, age: 'big' })).toBe(false);
    expect(readAloudOn({ ...m, age: 'big', readAloud: true })).toBe(true);
    expect(readAloudOn({ ...m, age: 'little', readAloud: false })).toBe(false);
    expect(maxDifficulty({ ...m, age: 'little' })).toBe(2);
    expect(aiAgeGroup({ ...m, age: 'little' })).toBe('5-7');
  });

  it('keeps the age through validation and merges', () => {
    const a = { ...emptyMemory(), age: 'little' as const, updatedAt: '2026-01-02' };
    expect(WorldMemorySchema.safeParse(a).success).toBe(true);
    expect(normalizeMemory(a).age).toBe('little');
    // Older memories without the field stay valid.
    const { age: _age, readAloud: _r, ...old } = emptyMemory();
    expect(WorldMemorySchema.safeParse(old).success).toBe(true);
    expect(mergeMemory(a, { ...emptyMemory(), updatedAt: '2026-01-03' }).age).toBe('little');
  });
});
