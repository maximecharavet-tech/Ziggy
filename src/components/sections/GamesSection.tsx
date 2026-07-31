'use client';

import { useTranslations } from 'next-intl';
import { Gamepad2 } from 'lucide-react';
import { GAMES } from '@/lib/games';
import { GameCard } from '@/components/games/GameCard';
import { ScrollReveal } from '@/components/ui/ScrollReveal';

export function GamesSection() {
  const t = useTranslations('games');

  return (
    <section id="games" className="py-20 sm:py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none" aria-hidden="true" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <ScrollReveal>
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green/10 mb-4">
              <Gamepad2 size={28} className="text-green" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-text-body mb-3">
              {t('sectionTitle')}
            </h2>
            <p className="text-base text-text-muted max-w-2xl mx-auto">{t('sectionSubtitle')}</p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
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
        </div>
      </div>
    </section>
  );
}
