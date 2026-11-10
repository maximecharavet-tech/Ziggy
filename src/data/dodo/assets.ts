import type { DodoStory } from './types';

/** Offline-prepared releases. Adding a story only needs its id and asset folder. */
export const MUSICAL_STORIES: Readonly<Record<string, string>> = {
  d01: 'nuage',
  d02: 'ecureuil',
  d03: 'lapin-vase',
  d04: 'luciole',
  d05: 'graine-noe',
  d06: 'ours-oiseau',
  d07: 'vieux-chene',
  d08: 'herisson',
  d09: 'tortue',
  d10: 'pingouins',
  d11: 'baleine',
  d12: 'abeilles',
  d13: 'fourmis',
  d14: 'hibou',
  d15: 'zebre',
  d16: 'phare',
  d17: 'renard',
};

/** Use the same two-version contract as Lili; no player-specific branching. */
export function withMusicalAssets(story: DodoStory): DodoStory {
  const slug = MUSICAL_STORIES[story.id];
  if (!slug) return story;
  const base = `/dodo/${slug}`;
  return {
    ...story,
    cover: `${base}/cover.webp`,
    songs: ['v1', 'v2'].map((id) => ({
      id,
      audio: { fr: `${base}/${slug}-${id}.mp3` },
      timing: { fr: `${base}/${slug}-${id}.timing.json` },
    })),
  };
}

/** Scenes absent from the public bucket at release time. Remote assets may supersede them. */
export const BUNDLED_DODO_IMAGES: Readonly<Record<string, Readonly<Record<number, string>>>> = {
  d10: {
    4: '/dodo/pingouins/4.jpg',
    5: '/dodo/pingouins/5.jpg',
    6: '/dodo/pingouins/6.jpg',
  },
  d11: {
    1: '/dodo/baleine/1.jpg',
    2: '/dodo/baleine/2.jpg',
    3: '/dodo/baleine/3.jpg',
    4: '/dodo/baleine/4.jpg',
    5: '/dodo/baleine/5.jpg',
    6: '/dodo/baleine/6.jpg',
  },
  d12: {
    1: '/dodo/abeilles/1.jpg',
    2: '/dodo/abeilles/2.jpg',
    3: '/dodo/abeilles/3.jpg',
    4: '/dodo/abeilles/4.jpg',
    5: '/dodo/abeilles/5.jpg',
    6: '/dodo/abeilles/6.jpg',
  },
  d13: {
    1: '/dodo/fourmis/1.jpg',
    2: '/dodo/fourmis/2.jpg',
    3: '/dodo/fourmis/3.jpg',
    4: '/dodo/fourmis/4.jpg',
    5: '/dodo/fourmis/5.jpg',
    6: '/dodo/fourmis/6.jpg',
  },
  d14: {
    1: '/dodo/hibou/1.jpg',
    2: '/dodo/hibou/2.jpg',
    3: '/dodo/hibou/3.jpg',
    4: '/dodo/hibou/4.jpg',
    5: '/dodo/hibou/5.jpg',
    6: '/dodo/hibou/6.jpg',
  },
  d15: {
    1: '/dodo/zebre/1.jpg',
    2: '/dodo/zebre/2.jpg',
    3: '/dodo/zebre/3.jpg',
    4: '/dodo/zebre/4.jpg',
    5: '/dodo/zebre/5.jpg',
    6: '/dodo/zebre/6.jpg',
  },
  d16: {
    1: '/dodo/phare/1.jpg',
    2: '/dodo/phare/2.jpg',
    3: '/dodo/phare/3.jpg',
    4: '/dodo/phare/4.jpg',
    5: '/dodo/phare/5.jpg',
    6: '/dodo/phare/6.jpg',
  },
  d17: {
    1: '/dodo/renard/1.jpg',
    2: '/dodo/renard/2.jpg',
    3: '/dodo/renard/3.jpg',
    4: '/dodo/renard/4.jpg',
    5: '/dodo/renard/5.jpg',
    6: '/dodo/renard/6.jpg',
  },
};
