import { useTranslations } from 'next-intl';
import { ZiggyAvatar, Sparkle } from '@/components/ziggy/Mascot';

/**
 * The official signature from the Ziggy film — "Learn · Understand · Create" —
 * running as a clay-coloured ribbon under the hero.
 */
export function TaglineRibbon() {
  const t = useTranslations('ribbon');
  const words = [
    { text: t('learn'), color: 'text-coral' },
    { text: t('understand'), color: 'text-leaf' },
    { text: t('create'), color: 'text-sky' },
  ];

  const run = (hidden: boolean) => (
    <div className="flex shrink-0 items-center gap-6 sm:gap-10 pe-6 sm:pe-10" aria-hidden={hidden || undefined}>
      {[0, 1].map((k) => (
        <div key={k} className="flex items-center gap-6 sm:gap-10">
          <ZiggyAvatar size={40} />
          {words.map((w) => (
            <span key={w.text} className="flex items-center gap-6 sm:gap-10">
              <span className={`font-display text-2xl sm:text-4xl font-bold uppercase tracking-wide ${w.color}`}>{w.text}</span>
              <svg viewBox="0 0 24 24" className="w-5 h-5 sm:w-6 sm:h-6 text-apricot" aria-hidden="true">
                <path d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z" fill="currentColor" />
              </svg>
            </span>
          ))}
          <span className="font-display text-lg sm:text-2xl font-semibold text-[#6B4A2B] dark:text-[#F3D3A8] whitespace-nowrap">
            {t('tagline')}
          </span>
          <svg viewBox="0 0 24 24" className="w-5 h-5 sm:w-6 sm:h-6 text-blush" aria-hidden="true">
            <path d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z" fill="currentColor" />
          </svg>
        </div>
      ))}
    </div>
  );

  return (
    <section className="relative py-8 sm:py-10 overflow-clip" aria-label={t('tagline')}>
      <div className="relative -rotate-[1.5deg] scale-[1.03] border-y-2 border-white/70 dark:border-white/10 bg-gradient-to-r from-[#FFE7C2] via-peach to-blush dark:from-[#3a2a17] dark:via-[#4a3218] dark:to-[#4a2626] py-4 sm:py-5 shadow-[0_18px_40px_-24px_rgba(107,74,43,0.6)]">
        <Sparkle className="w-5 top-2 start-[12%] z-10" color="#FFFFFF" delay={0.4} />
        <Sparkle className="w-4 bottom-2 end-[20%] z-10" color="#FFFFFF" delay={1.4} />
        <div className="group flex w-max animate-marquee hover:[animation-play-state:paused] rtl:[animation-direction:reverse]">
          {run(false)}
          {run(true)}
        </div>
      </div>
    </section>
  );
}
