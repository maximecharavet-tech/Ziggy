import type { L } from '@/lib/i18n-text';

/** Stickers to stamp on a drawing (emoji, so they look right on every device). */
export const STICKERS: { e: string; name: L }[] = [
  { e: '⭐', name: { fr: 'Étoile', en: 'Star' } },
  { e: '❤️', name: { fr: 'Cœur', en: 'Heart' } },
  { e: '🌸', name: { fr: 'Fleur', en: 'Flower' } },
  { e: '🦋', name: { fr: 'Papillon', en: 'Butterfly' } },
  { e: '🎁', name: { fr: 'Cadeau', en: 'Present' } },
  { e: '❄️', name: { fr: 'Flocon', en: 'Snowflake' } },
  { e: '🌈', name: { fr: 'Arc-en-ciel', en: 'Rainbow' } },
  { e: '🦄', name: { fr: 'Licorne', en: 'Unicorn' } },
  { e: '🐞', name: { fr: 'Coccinelle', en: 'Ladybug' } },
  { e: '🎈', name: { fr: 'Ballon', en: 'Balloon' } },
  { e: '👑', name: { fr: 'Couronne', en: 'Crown' } },
  { e: '☀️', name: { fr: 'Soleil', en: 'Sun' } },
  { e: '🌙', name: { fr: 'Lune', en: 'Moon' } },
  { e: '🍭', name: { fr: 'Sucette', en: 'Lollipop' } },
  { e: '🐾', name: { fr: 'Pattes', en: 'Paw prints' } },
  { e: '✨', name: { fr: 'Paillettes', en: 'Sparkles' } },
  { e: '🎄', name: { fr: 'Sapin', en: 'Christmas tree' } },
  { e: '🐠', name: { fr: 'Poisson', en: 'Fish' } },
];

export const STICKER_MIN = 36;
export const STICKER_MAX = 180;
export const STICKER_DEFAULT = 72;

export const clampStickerSize = (s: number) => Math.max(STICKER_MIN, Math.min(STICKER_MAX, Math.round(s)));
