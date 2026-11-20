'use client';

import { MissionCard } from '@/components/rewards/MissionCard';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'motion/react';
import { Gamepad2 } from 'lucide-react';
import { GAMES } from '@/lib/games';
import { GameCard } from '@/components/games/GameCard';
import { ZiggyAvatar } from '@/components/ziggy/Mascot';
import { SayButton } from '@/components/arcade/read-aloud';
import { MagicBackdrop } from '@/components/sections/magic/MagicBackdrop';
import { Stagger } from '@/components/sections/magic/Stagger';

export function GamesPageContent() {
  const t = useTranslations('games');
  const locale = useLocale();

  return (
    <div className="relative min-h-screen overflow-clip pt-24 pb-20">
      <MagicBackdrop variant="candy" stars={12} clouds={2} seed={11} className="h-[44rem]" />
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-10 text-center sm:px-6 sm:py-12 lg:px-8">
        <motion.div initial={{ opacity: 1, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-bg-card py-1.5 ps-1.5 pe-4 text-sm font-bold text-grape-ink shadow-soft ring-1 ring-border/60 dark:text-purple">
            <ZiggyAvatar size={28} ring={false} />
            <Gamepad2 size={15} aria-hidden="true" />
            {t('badge')}
          </div>
          <h1 className="font-display text-4xl font-bold text-text-body text-balance sm:text-6xl">
            <span className="mg-squiggle" style={{ '--tint': '#FFD447' } as React.CSSProperties}>
              {t('pageTitle')}
            </span>
          </h1>
          <div className="mx-auto mt-5 flex max-w-2xl items-start justify-center gap-3">
            <p className="text-lg text-text-muted">{t('pageSubtitle')}</p>
            <SayButton texts={[t('pageTitle'), t('pageSubtitle')]} locale={locale} size="md" className="shrink-0" />
          </div>
        </motion.div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-10">
          <MissionCard />
        </div>
        <Stagger className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-4">
          {GAMES.map((game, i) => (
            <GameCard
              key={game.id}
              id={game.id}
              name={t(`${game.id}.name`)}
              description={t(`${game.id}.description`)}
              icon={game.icon}
              color={game.color}
              index={i}
              cta={t('start')}
            />
          ))}
        </Stagger>
      </div>
    </div>
  );
}
