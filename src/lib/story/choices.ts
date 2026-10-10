/**
 * Story Builder choices. The child picks among these — never types — and
 * the server only accepts these ids (validated by schema).
 */
import { z } from 'zod';
import type { L } from '@/lib/i18n-text';

type Choice = { id: string; emoji: string; label: L };

export const HEROES: Choice[] = [
  { id: 'me', emoji: '🧒', label: { fr: 'Moi, le héros', en: 'Me, the hero' } },
  { id: 'ziggy', emoji: '🤖', label: { fr: 'Ziggy le robot', en: 'Ziggy the robot' } },
  { id: 'princess', emoji: '👸', label: { fr: 'Une princesse curieuse', en: 'A curious princess' } },
  { id: 'astronaut', emoji: '🧑‍🚀', label: { fr: 'Une astronaute', en: 'An astronaut' } },
  { id: 'wizard', emoji: '🧙', label: { fr: 'Un petit magicien', en: 'A little wizard' } },
  { id: 'pirate', emoji: '🏴‍☠️', label: { fr: 'Une pirate gentille', en: 'A kind pirate' } },
];

export const PLACES: Choice[] = [
  { id: 'castle', emoji: '🏰', label: { fr: 'un château dans les nuages', en: 'a castle in the clouds' } },
  { id: 'space', emoji: '🪐', label: { fr: 'une planète en sucre', en: 'a sugar planet' } },
  { id: 'ocean', emoji: '🌊', label: { fr: 'le fond de l’océan', en: 'the bottom of the ocean' } },
  { id: 'jungle', emoji: '🌴', label: { fr: 'une jungle qui chante', en: 'a singing jungle' } },
  { id: 'ice', emoji: '❄️', label: { fr: 'un royaume de glace', en: 'an ice kingdom' } },
  { id: 'city', emoji: '🏙️', label: { fr: 'la ville du futur', en: 'the city of the future' } },
];

export const STORY_COMPANIONS: Choice[] = [
  { id: 'dragon', emoji: '🐉', label: { fr: 'un petit dragon', en: 'a little dragon' } },
  { id: 'unicorn', emoji: '🦄', label: { fr: 'une licorne', en: 'a unicorn' } },
  { id: 'fox', emoji: '🦊', label: { fr: 'un renard malin', en: 'a clever fox' } },
  { id: 'panda', emoji: '🐼', label: { fr: 'un panda câlin', en: 'a cuddly panda' } },
  { id: 'owl', emoji: '🦉', label: { fr: 'une chouette savante', en: 'a wise owl' } },
  { id: 'dolphin', emoji: '🐬', label: { fr: 'un dauphin rieur', en: 'a giggly dolphin' } },
];

export const OBJECTS: Choice[] = [
  { id: 'map', emoji: '🗺️', label: { fr: 'une carte magique', en: 'a magic map' } },
  { id: 'key', emoji: '🗝️', label: { fr: 'une clé dorée', en: 'a golden key' } },
  { id: 'compass', emoji: '🧭', label: { fr: 'une boussole qui parle', en: 'a talking compass' } },
  { id: 'lamp', emoji: '🏮', label: { fr: 'une lanterne d’étoiles', en: 'a lantern of stars' } },
  { id: 'book', emoji: '📖', label: { fr: 'un livre qui rêve', en: 'a dreaming book' } },
  { id: 'seed', emoji: '🌱', label: { fr: 'une graine géante', en: 'a giant seed' } },
];

export const GOALS: Choice[] = [
  { id: 'friend', emoji: '🤝', label: { fr: 'aider un ami perdu', en: 'help a lost friend' } },
  { id: 'treasure', emoji: '💎', label: { fr: 'trouver un trésor caché', en: 'find a hidden treasure' } },
  { id: 'rainbow', emoji: '🌈', label: { fr: 'rendre ses couleurs à l’arc-en-ciel', en: 'bring the rainbow its colours back' } },
  { id: 'party', emoji: '🎉', label: { fr: 'préparer une grande fête', en: 'get a big party ready' } },
  { id: 'mystery', emoji: '🔍', label: { fr: 'résoudre un mystère', en: 'solve a mystery' } },
  { id: 'garden', emoji: '🌻', label: { fr: 'faire pousser un jardin', en: 'grow a garden' } },
];

const ids = (list: Choice[]) => list.map((c) => c.id) as [string, ...string[]];

export const StoryChoicesSchema = z.object({
  hero: z.enum(ids(HEROES)),
  place: z.enum(ids(PLACES)),
  companion: z.enum(ids(STORY_COMPANIONS)),
  object: z.enum(ids(OBJECTS)),
  goal: z.enum(ids(GOALS)),
  ageGroup: z.enum(['5-7', '8-10', '11-12']),
});
export type StoryChoices = z.infer<typeof StoryChoicesSchema>;

export const pick = (list: Choice[], id: string) => list.find((c) => c.id === id)!;
