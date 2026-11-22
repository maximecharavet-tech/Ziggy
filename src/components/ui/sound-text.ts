import type { L } from '@/lib/i18n-text';

/** Words of the sound controls (SoundToggle, SoftSoundsSwitch), FR + EN. */
export const SOUND_TEXT = {
  muted: { fr: 'Son coupé', en: 'Sound off' },
  unmuted: { fr: 'Son remis', en: 'Sound on' },
  normal: { fr: 'Sons normaux', en: 'Normal sounds' },
  soft: { fr: 'Sons doux', en: 'Soft sounds' },
  softHint: { fr: 'Plus calmes et plus ronds', en: 'Quieter and rounder' },
  longToSoft: { fr: 'Appui long : sons doux', en: 'Long press: soft sounds' },
  longToNormal: { fr: 'Appui long : sons normaux', en: 'Long press: normal sounds' },
  mutedNote: { fr: 'Le son est coupé', en: 'Sound is off' },
} satisfies Record<string, L>;
