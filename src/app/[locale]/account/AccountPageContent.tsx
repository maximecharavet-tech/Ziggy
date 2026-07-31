'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Star, Gamepad2, LogOut, Pencil, Check } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { useProfile } from '@/components/account/ProfileProvider';
import { avatarColor } from '@/lib/account';
import { useProgressMap } from '@/components/account/useProgressMap';
import { totalStars, totalPlays } from '@/lib/progress';
import { GAMES } from '@/lib/games';

export function AccountPageContent() {
  const t = useTranslations('account');
  const tg = useTranslations('games');
  const { profile, ready, saveProfile, signOut } = useProfile();
  const progress = useProgressMap();

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');

  if (!ready) {
    return <div className="min-h-[70vh]" aria-hidden="true" />;
  }

  // No profile yet — send them to sign-up rather than showing an empty shell.
  if (!profile) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 pt-24 pb-16">
        <div className="glass-strong rounded-2xl border border-border/50 p-8 text-center max-w-md">
          <h1 className="text-xl font-extrabold text-text-body mb-2">{t('noProfileTitle')}</h1>
          <p className="text-sm text-text-muted mb-6">{t('noProfileText')}</p>
          <Button href="/signup" size="lg">{t('createButton')}</Button>
        </div>
      </div>
    );
  }

  const color = avatarColor(profile.avatar);
  const stars = totalStars(progress);
  const plays = totalPlays(progress);

  const commitName = () => {
    const name = draftName.trim();
    if (name) saveProfile({ ...profile, name });
    setEditing(false);
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Profile card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative glass-strong rounded-2xl border border-border/50 p-6 sm:p-8 overflow-hidden"
        >
          <div
            className="absolute -top-20 -end-20 w-56 h-56 rounded-full blur-3xl opacity-40 pointer-events-none"
            style={{ background: `radial-gradient(circle, ${color}55, transparent 70%)` }}
            aria-hidden="true"
          />

          <div className="relative flex flex-col sm:flex-row items-center gap-5 text-center sm:text-start">
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${color}18` }}
            >
              <AgentAvatar agentId={profile.avatar} color={color} size={76} />
            </div>

            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && commitName()}
                    maxLength={24}
                    className="glass rounded-xl px-3 py-2 text-lg font-extrabold text-text-body border border-border/50 outline-none focus:ring-2 focus:ring-green/30 min-w-0 w-44"
                    aria-label={t('nameLabel')}
                  />
                  <button
                    onClick={commitName}
                    className="w-11 h-11 rounded-xl gradient-green-cta text-white flex items-center justify-center active:scale-95 transition-transform"
                    aria-label={t('save')}
                  >
                    <Check size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-text-body truncate">
                    {t('dashboardTitle')} {profile.name} !
                  </h1>
                  <button
                    onClick={() => { setDraftName(profile.name); setEditing(true); }}
                    className="w-9 h-9 rounded-lg text-text-dim hover:text-text-body hover:bg-border/30 flex items-center justify-center transition-colors shrink-0"
                    aria-label={t('editName')}
                  >
                    <Pencil size={15} />
                  </button>
                </div>
              )}
              <p className="text-sm text-text-muted mt-1">{t('dashboardSubtitle')}</p>
            </div>

            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-text-muted hover:text-text-body glass border border-border/50 transition-colors shrink-0"
            >
              <LogOut size={15} className="rtl:rotate-180" />
              {t('signOut')}
            </button>
          </div>

          {/* Totals */}
          <div className="relative mt-7 grid grid-cols-2 gap-3">
            {[
              { icon: Star, value: stars, label: t('starsEarned'), tone: '#F59E0B' },
              { icon: Gamepad2, value: plays, label: t('gamesPlayed'), tone: color },
            ].map(({ icon: Icon, value, label, tone }) => (
              <div key={label} className="glass rounded-2xl border border-border/50 p-4 text-center">
                <Icon size={20} style={{ color: tone }} className="mx-auto mb-1.5" />
                <div className="text-2xl font-extrabold text-text-body tabular-nums">{value}</div>
                <div className="text-xs text-text-dim font-medium">{label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Per-game progress */}
        <h2 className="text-lg font-extrabold text-text-body mt-10 mb-4">{t('progressTitle')}</h2>

        {plays === 0 ? (
          <div className="glass rounded-2xl border border-border/50 p-8 text-center">
            <p className="text-sm text-text-muted mb-5">{t('noProgress')}</p>
            <Button href="/games">{t('playGames')}</Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {GAMES.map((game, i) => {
              const entry = progress[game.id];
              return (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.35 }}
                >
                  <Link href={`/games/${game.id}` as '/games/memory'}>
                    <div className="glass rounded-2xl border border-border/50 p-5 h-full transition-shadow hover:shadow-lg">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="font-bold text-sm" style={{ color: game.color }}>
                          {tg(`${game.id}.name`)}
                        </span>
                        <span className="flex gap-0.5" aria-label={`${entry?.bestStars ?? 0}/3`}>
                          {[0, 1, 2].map((s) => (
                            <Star
                              key={s}
                              size={14}
                              className={s < (entry?.bestStars ?? 0) ? 'text-yellow fill-yellow' : 'text-border'}
                            />
                          ))}
                        </span>
                      </div>
                      <div className="text-xs text-text-dim">
                        {entry
                          ? `${t('bestScore')}: ${entry.bestScore} · ${entry.plays} ${t('plays')}`
                          : t('noProgress')}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
