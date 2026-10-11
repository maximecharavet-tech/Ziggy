import { LILI_STORY } from './lili';
import { STORIES_1 } from './stories-1';
import { STORIES_2 } from './stories-2';
import { STORIES_3 } from './stories-3';
import type { DodoStory } from './types';

/** Princesse Lili first, then the 30 bedtime stories. */
export const DODO_STORIES: DodoStory[] = [LILI_STORY, ...STORIES_1, ...STORIES_2, ...STORIES_3];

export const getDodoStory = (id: string) => DODO_STORIES.find((s) => s.id === id);

/** What Ziggy says after the last scene: the moral, then good night. */
export function outroText(story: DodoStory, locale: string): string {
  return locale === 'fr'
    ? `${story.moral.fr} Bonne nuit, mon petit cœur. Fais de beaux rêves.`
    : `${story.moral.en} Good night, little one. Sweet dreams.`;
}

/** Audio scene number of the outro (scenes 1–6 are the story). */
export const OUTRO_SCENE = 7;
