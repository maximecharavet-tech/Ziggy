/**
 * STORY ENGINE — each world tells a story in 3 chapters; every quest is a
 * scene. Playing a quest moves the story: a place opens, a friend appears,
 * a treasure is found. The state is derived from the World Memory, so
 * "Continuer mon aventure" always resumes exactly where the child stopped.
 */
import type { CharacterDefinition, QuestDefinition, WorldDefinition } from '@/data/types';
import { tr } from '@/lib/i18n-text';
import type { WorldMemory } from '@/lib/world/memory';
import { isWorldUnlocked } from '@/lib/world/gamification';
import { unlockedChapter } from '@/lib/world/engine';

export type SceneStatus = 'done' | 'open' | 'locked';

export interface Scene {
  questId: string;
  title: string;
  text: string;
  emoji: string;
  status: SceneStatus;
  stars: number;
}

export interface Chapter {
  number: 1 | 2 | 3;
  title: string;
  scenes: Scene[];
  status: SceneStatus;
}

export interface CharacterState {
  id: string;
  name: string;
  emoji: string;
  role: string;
  /** Met once a quest outcome introduced them (or from the start for the first one). */
  met: boolean;
}

export interface QuestState {
  questId: string;
  status: SceneStatus;
  stars: number;
}

export interface WorldState {
  worldId: string;
  unlocked: boolean;
  chapter: 1 | 2 | 3;
  complete: boolean;
  /** Outcomes found in this world (places, friends, treasures). */
  found: { id: string; label: string; emoji: string; kind: 'place' | 'character' | 'item' }[];
}

export interface Story {
  world: WorldState;
  chapters: Chapter[];
  characters: CharacterState[];
  quests: QuestState[];
  /** The next scene to play, or null when the story is finished. */
  next: QuestState | null;
}

const CHAPTER_TITLES: Record<1 | 2 | 3, { fr: string; en: string }> = {
  1: { fr: 'Chapitre 1 · L’arrivée', en: 'Chapter 1 · The arrival' },
  2: { fr: 'Chapitre 2 · Le grand défi', en: 'Chapter 2 · The big challenge' },
  3: { fr: 'Chapitre 3 · La fête', en: 'Chapter 3 · The celebration' },
};

function questStatus(w: WorldDefinition, q: QuestDefinition, m: WorldMemory): SceneStatus {
  if (m.completedQuests[q.id]) return 'done';
  if (!isWorldUnlocked(w, m)) return 'locked';
  return q.chapter <= unlockedChapter(w, m) ? 'open' : 'locked';
}

export function buildStory(w: WorldDefinition, m: WorldMemory, locale: string): Story {
  const quests: QuestState[] = w.quests.map((q) => ({ questId: q.id, status: questStatus(w, q, m), stars: m.completedQuests[q.id]?.stars ?? 0 }));
  const chapters: Chapter[] = ([1, 2, 3] as const).map((n) => {
    const scenes: Scene[] = w.quests
      .filter((q) => q.chapter === n)
      .map((q) => {
        const st = quests.find((x) => x.questId === q.id)!;
        return {
          questId: q.id,
          title: tr(q.title, locale),
          // Once done, the scene tells what happened; before, it tells what is asked.
          text: st.status === 'done' ? `${q.outcome.emoji} ${tr(q.outcome.label, locale)}` : tr(q.intro, locale),
          emoji: q.outcome.emoji,
          status: st.status,
          stars: st.stars,
        };
      });
    const status: SceneStatus = scenes.every((s) => s.status === 'done') ? 'done' : scenes.some((s) => s.status !== 'locked') ? 'open' : 'locked';
    return { number: n, title: tr(CHAPTER_TITLES[n], locale), scenes, status };
  });

  const metIds = new Set(w.quests.filter((q) => m.completedQuests[q.id] && q.outcome.kind === 'character').map((q) => q.outcome.id));
  const characters: CharacterState[] = w.characters.map((c: CharacterDefinition, i) => ({
    id: c.id,
    name: tr(c.name, locale),
    emoji: c.emoji,
    role: tr(c.role, locale),
    met: i === 0 || metIds.has(c.id) || chapters[Math.min(i, 2)].status !== 'locked',
  }));

  const found = w.quests
    .filter((q) => m.completedQuests[q.id])
    .map((q) => ({ id: q.outcome.id, label: tr(q.outcome.label, locale), emoji: q.outcome.emoji, kind: q.outcome.kind }));

  const complete = quests.every((q) => q.status === 'done');
  return {
    world: { worldId: w.id, unlocked: isWorldUnlocked(w, m), chapter: unlockedChapter(w, m), complete, found },
    chapters,
    characters,
    quests,
    next: quests.find((q) => q.status === 'open') ?? null,
  };
}
