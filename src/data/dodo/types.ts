/**
 * Mode dodo — bedtime stories told by Ziggy.
 *
 * Each story is hand-written (French + English), 6 scenes long, and carries
 * one universal value. Every scene has:
 *  - the text Ziggy reads (calm, short sentences, ~40–70 words);
 *  - `art`: an animated night scene drawn on the device (always available);
 *  - `prompt`: the English description used ONCE to pre-generate its
 *    illustration (stored, then shown to everyone instead of `art`).
 */
import type { L } from '@/lib/i18n-text';

export const DODO_VALUES = [
  'kindness',
  'sharing',
  'honesty',
  'courage',
  'patience',
  'friendship',
  'respect',
  'gratitude',
  'perseverance',
  'forgiveness',
  'empathy',
  'nature',
  'cooperation',
  'self_confidence',
  'difference',
  'responsibility',
  'generosity',
  'listening',
  'calm',
  'curiosity',
  'humility',
  'family',
  'helping',
  'trust',
] as const;
export type DodoValue = (typeof DODO_VALUES)[number];

/** Night palettes for the scene background. */
export const DODO_SKIES = ['indigo', 'violet', 'ocean', 'forest', 'dawn', 'snow', 'rose', 'gold'] as const;
export type DodoSky = (typeof DODO_SKIES)[number];

export interface DodoArt {
  sky: DodoSky;
  /** The main character of the scene, one emoji. */
  hero: string;
  /** 2–5 emojis around the hero (places, friends, objects). */
  props: string[];
  /** Moon, stars, fireflies… what floats in the sky. */
  ambience: 'stars' | 'moon' | 'fireflies' | 'snow' | 'bubbles' | 'petals' | 'sunrise';
}

export interface DodoScene {
  text: L;
  art: DodoArt;
  /** English illustration prompt (subject + setting + mood), ≤ 45 words, no text in image. */
  prompt: string;
}

export interface DodoStory {
  id: string;
  title: L;
  /** One-line teaser. */
  teaser: L;
  value: DodoValue;
  /** The lesson, said at the end, one sentence. */
  moral: L;
  /** Cover emoji. */
  emoji: string;
  /** Youngest age it suits. */
  age: 3 | 5 | 7;
  scenes: DodoScene[];
  /** Static cover shipped with the app (e.g. Princesse Lili). */
  cover?: string;
  /** Reference picture sent to the image provider so a character stays the same in every scene. */
  reference?: string;
  /**
   * Optional "Version musicale": the whole story sung over soft music (e.g. Suno
   * songs). Several versions may be offered (« Version 1 », « Version 2 »…), each
   * with its own audio file and timing file per text language (paths under
   * /public). When a story has one, the song is played by default and Ziggy's
   * reading voice stays available as a choice. Timing files come from
   * scripts/align-dodo.py (lyrics synchronised with the song, line by line and
   * word by word).
   */
  songs?: DodoSong[];
}

/** One sung version of a story. */
export interface DodoSong {
  /** Stable id, remembered on the device ("v1", "v2"…). */
  id: string;
  /** Shown in the version choice; default « Version n ». */
  label?: Partial<L>;
  /** The MP3 per text language. */
  audio: Partial<L>;
  /** The synchronised lyrics (…timing.json) per text language; without it the song plays with the story text. */
  timing?: Partial<L>;
}

export const VALUE_LABEL: Record<DodoValue, L> = {
  kindness: { fr: 'Gentillesse', en: 'Kindness' },
  sharing: { fr: 'Partage', en: 'Sharing' },
  honesty: { fr: 'Honnêteté', en: 'Honesty' },
  courage: { fr: 'Courage', en: 'Courage' },
  patience: { fr: 'Patience', en: 'Patience' },
  friendship: { fr: 'Amitié', en: 'Friendship' },
  respect: { fr: 'Respect', en: 'Respect' },
  gratitude: { fr: 'Gratitude', en: 'Gratitude' },
  perseverance: { fr: 'Persévérance', en: 'Perseverance' },
  forgiveness: { fr: 'Pardon', en: 'Forgiveness' },
  empathy: { fr: 'Empathie', en: 'Empathy' },
  nature: { fr: 'Respect de la nature', en: 'Caring for nature' },
  cooperation: { fr: 'Entraide', en: 'Teamwork' },
  self_confidence: { fr: 'Confiance en soi', en: 'Self-confidence' },
  difference: { fr: 'Différence', en: 'Being different' },
  responsibility: { fr: 'Responsabilité', en: 'Responsibility' },
  generosity: { fr: 'Générosité', en: 'Generosity' },
  listening: { fr: 'Écoute', en: 'Listening' },
  calm: { fr: 'Calme', en: 'Calm' },
  curiosity: { fr: 'Curiosité', en: 'Curiosity' },
  humility: { fr: 'Humilité', en: 'Humility' },
  family: { fr: 'Famille', en: 'Family' },
  helping: { fr: 'Aider les autres', en: 'Helping others' },
  trust: { fr: 'Confiance', en: 'Trust' },
};
