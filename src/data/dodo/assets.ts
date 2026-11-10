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
};
