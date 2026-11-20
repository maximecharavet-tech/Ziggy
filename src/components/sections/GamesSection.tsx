'use client';

import type { CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { Gamepad2 } from 'lucide-react';
import { GAMES } from '@/lib/games';
import { GameCard } from '@/components/games/GameCard';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { MagicBackdrop } from '@/components/sections/magic/MagicBackdrop';
import { Stagger } from '@/components/sections/magic/Stagger';

export function GamesSection() {
  const t = useTranslations('games');

  return (
    <section id="games" className="relative overflow-clip py-20 sm:py-28">
      <MagicBackdrop variant="candy" stars={8} seed={23} />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="mb-12 text-center">
            <span className="mg-icon mx-auto mb-5 h-16 w-16 rotate-[-6deg]" style={{ '--tint': '#8B5CF6' } as CSSProperties}>
              <Gamepad2 size={30} strokeWidth={2.4} aria-hidden="true" />
            </span>
            <h2 className="mb-3 font-display text-3xl font-bold text-text-body text-balance sm:text-5xl">{t('sectionTitle')}</h2>
            <p className="mx-auto max-w-2xl text-lg text-text-muted">{t('sectionSubtitle')}</p>
          </div>
        </ScrollReveal>

        <Stagger className="mt-12 grid grid-cols-1 gap-x-6 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
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
    </section>
  );
}
