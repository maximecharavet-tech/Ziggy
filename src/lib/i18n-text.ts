/**
 * Bilingual content text for Ziggy World data (worlds, quests, games).
 * French and English are written by hand; the other site languages show
 * the English text until a translation is added.
 */
export type L = { fr: string; en: string };

export function tr(text: L, locale: string): string {
  return locale === 'fr' ? text.fr : text.en;
}
