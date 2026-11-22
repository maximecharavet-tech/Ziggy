'use client';

import { useLocale } from 'next-intl';
import { tr, type L } from '@/lib/i18n-text';

/**
 * A small, gentle "made with AI" tag, shown next to content an AI generated
 * (stories, avatars, illustrations, voices, Santa's live answers): EU AI Act
 * art. 50 transparency. Factual wording, never scary. French for `fr`, English
 * for every other locale (like `tr()`).
 */
export const AI_MADE: L = { fr: 'Créé avec l’aide de l’IA', en: 'Made with the help of AI' };

export function AiLabel({ text = AI_MADE, tone = 'light', className = '' }: { text?: L; tone?: 'light' | 'dark'; className?: string }) {
  const locale = useLocale();
  const label = tr(text, locale);
  const look = tone === 'dark' ? 'bg-black/45 text-white ring-white/30' : 'bg-white/90 text-[#4b3a7a] ring-[#d9ccff]';
  return (
    <span data-ai-label="" className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold leading-tight ring-1 backdrop-blur ${look} ${className}`}>
      <span aria-hidden="true">✨</span>
      <span>{label}</span>
    </span>
  );
}
