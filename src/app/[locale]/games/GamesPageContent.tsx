'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Gamepad2 } from 'lucide-react';
import { GAMES } from '@/lib/games';
import { GameCard } from '@/components/games/GameCard';
import { ParticleField } from '@/components/ui/ParticleField';

export function GamesPageContent() {
  const t = useTranslations('games');

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="relative overflow-hidden">
        <ParticleField count={30} />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-border/50 text-xs font-semibold text-green mb-6">
              <Gamepad2 size={14} />
              {t('badge')}
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-text-body mb-4">
              {t('pageTitle')}
            </h1>
            <p className="text-lg text-text-muted max-w-2xl mx-auto">{t('pageSubtitle')}</p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
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
    </div>
  );
}
