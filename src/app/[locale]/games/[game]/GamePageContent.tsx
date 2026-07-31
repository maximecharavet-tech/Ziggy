'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getGame } from '@/lib/games';
import { getGameIcon } from '@/components/games/GameCard';
import { MemoryGame } from '@/components/games/MemoryGame';
import { MathGame } from '@/components/games/MathGame';
import { LogicGame } from '@/components/games/LogicGame';
import { QuizGame } from '@/components/games/QuizGame';
import { ParticleField } from '@/components/ui/ParticleField';

export function GamePageContent({ gameId }: { gameId: string }) {
  const t = useTranslations('games');
  const game = getGame(gameId)!;
  const Icon = getGameIcon(game.icon);

  function renderGame() {
    switch (gameId) {
      case 'memory':
        return <MemoryGame color={game.color} />;
      case 'math':
        return <MathGame color={game.color} />;
      case 'logic':
        return <LogicGame color={game.color} />;
      case 'quiz':
        return <QuizGame color={game.color} />;
      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="relative overflow-hidden">
        <ParticleField count={18} color={game.color} />

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
          <Link
            href="/games"
            className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-body transition-colors mb-6 min-h-[48px]"
          >
            <ArrowLeft size={16} className="rtl:rotate-180" />
            {t('backToGames')}
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{
                backgroundColor: `${game.color}14`,
                boxShadow: `0 8px 32px ${game.color}22`,
              }}
            >
              <Icon size={30} style={{ color: game.color }} strokeWidth={2} />
            </div>
            <h1
              className="text-3xl sm:text-4xl font-extrabold mb-2"
              style={{ color: game.color }}
            >
              {t(`${gameId}.name`)}
            </h1>
            <p className="text-sm sm:text-base text-text-muted max-w-md mx-auto">
              {t(`${gameId}.description`)}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
          >
            {renderGame()}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
