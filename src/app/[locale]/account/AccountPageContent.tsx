'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Star, Gamepad2, LogOut, Pencil, Check, ShieldCheck, Loader2, UserPlus } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { useProfile } from '@/components/account/ProfileProvider';
import { useProgressMap } from '@/components/account/useProgressMap';
import { ChangePasswordForm } from '@/components/account/ChangePasswordForm';
import { DeleteAccount } from '@/components/account/DeleteAccount';
import { AVATAR_CHOICES, avatarColor } from '@/lib/account';
import { totalStars, totalPlays, LOWER_IS_BETTER } from '@/lib/progress';
import { GAMES } from '@/lib/games';
import { playSound } from '@/lib/sound';

export function AccountPageContent() {
  const t = useTranslations('account');
  const tg = useTranslations('games');
  const router = useRouter();
  const { profile, user, ready, isOwner, updateProfile, signOut } = useProfile();
  const { progress, loading } = useProgressMap();

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [saving, setSaving] = useState(false);
  const [fromReset, setFromReset] = useState(false);

  useEffect(() => {
    setFromReset(new URLSearchParams(window.location.search).get('reset') === '1');
  }, []);

  if (!ready) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center" aria-busy="true">
        <Loader2 size={28} className="animate-spin text-green" />
      </div>
    );
  }

  const stars = totalStars(progress);
  const plays = totalPlays(progress);

  const commitName = async () => {
    const name = draftName.trim();
    if (name && name !== profile?.name) {
      setSaving(true);
      await updateProfile({ name });
      setSaving(false);
    }
    setEditing(false);
  };

  const trophies = (
    <>
      <h2 className="font-display text-xl font-bold text-text-body mt-10 mb-4">{t('progressTitle')}</h2>
      {!loading && plays === 0 ? (
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
                transition={{ delay: i * 0.04, duration: 0.3 }}
              >
                <Link href={`/games/${game.id}` as '/games/memory'}>
                  <div className="glass rounded-2xl border border-border/50 p-5 h-full transition-all hover:shadow-lg hover:-translate-y-0.5">
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
                        ? `${LOWER_IS_BETTER.has(game.id) ? t('bestMoves') : t('bestScore')}: ${entry.bestScore} · ${entry.plays} ${t('plays')}`
                        : t('notPlayed')}
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  );

  // Guest: they can play already; the account is what keeps the stars.
  if (!user) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="glass-strong rounded-3xl border border-border/50 p-7 sm:p-9 text-center">
            <div className="w-14 h-14 rounded-2xl bg-green/10 flex items-center justify-center mx-auto mb-4">
              <UserPlus size={26} className="text-green" />
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-text-body mb-2">{t('guestTitle')}</h1>
            <p className="text-text-muted max-w-md mx-auto mb-6">{t('guestText')}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button href="/signup" size="lg">{t('createButton')}</Button>
              <Button href="/login" variant="secondary" size="lg">{t('loginButton')}</Button>
            </div>
          </div>
          {trophies}
        </div>
      </div>
    );
  }

  const avatar = profile?.avatar ?? 'sales';
  const color = avatarColor(avatar);

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative glass-strong rounded-3xl border border-border/50 p-6 sm:p-8 overflow-hidden"
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
              <AgentAvatar agentId={avatar} color={color} size={76} />
            </div>

            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void commitName()}
                    maxLength={24}
                    className="glass rounded-xl px-3 py-2 text-lg font-extrabold text-text-body border border-border/50 outline-none focus:ring-2 focus:ring-green/30 min-w-0 w-44"
                    aria-label={t('nameLabel')}
                  />
                  <button
                    onClick={() => void commitName()}
                    className="w-11 h-11 rounded-xl gradient-green-cta text-white flex items-center justify-center active:scale-95 transition-transform"
                    aria-label={t('save')}
                  >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-text-body truncate">
                    {t('dashboardTitle')} {profile?.name ?? ''} !
                  </h1>
                  <button
                    onClick={() => {
                      setDraftName(profile?.name ?? '');
                      setEditing(true);
                    }}
                    className="w-9 h-9 rounded-lg text-text-dim hover:text-text-body hover:bg-border/30 flex items-center justify-center transition-colors shrink-0"
                    aria-label={t('editName')}
                  >
                    <Pencil size={15} />
                  </button>
                </div>
              )}
              <p className="text-sm text-text-muted mt-1">{t('dashboardSubtitle')}</p>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              {isOwner && (
                <Link
                  href="/owner"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold gradient-green-cta text-white"
                >
                  <ShieldCheck size={15} />
                  {t('ownerDashboard')}
                </Link>
              )}
              <button
                onClick={async () => {
                  await signOut();
                  router.push('/');
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-text-muted hover:text-text-body glass border border-border/50 transition-colors"
              >
                <LogOut size={15} className="rtl:rotate-180" />
                {t('signOut')}
              </button>
            </div>
          </div>

          {/* Avatar switcher */}
          <div className="relative mt-6 flex flex-wrap gap-2 justify-center sm:justify-start">
            {AVATAR_CHOICES.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  playSound('tap');
                  void updateProfile({ avatar: c.id });
                }}
                aria-pressed={avatar === c.id}
                aria-label={c.id}
                className="w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-transform hover:scale-105 active:scale-95"
                style={{ backgroundColor: `${c.color}14`, borderColor: avatar === c.id ? c.color : 'transparent' }}
              >
                <AgentAvatar agentId={c.id} color={c.color} size={34} />
              </button>
            ))}
          </div>

          <div className="relative mt-6 grid grid-cols-2 gap-3">
            {[
              { icon: Star, value: stars, label: t('starsEarned'), tone: '#F59E0B' },
              { icon: Gamepad2, value: plays, label: t('gamesPlayed'), tone: color },
            ].map(({ icon: Icon, value, label, tone }) => (
              <div key={label} className="glass rounded-2xl border border-border/50 p-4 text-center">
                <Icon size={20} style={{ color: tone }} className="mx-auto mb-1.5" />
                <div className="text-2xl font-extrabold text-text-body tabular-nums">{loading ? '–' : value}</div>
                <div className="text-xs text-text-dim font-medium">{label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {fromReset && (
          <div className="mt-8">
            <ChangePasswordForm
              highlight
              labels={{
                title: t('changePassword'),
                newPassword: t('newPassword'),
                confirmPassword: t('confirmPassword'),
                save: t('save'),
                saved: t('passwordSaved'),
                errorLength: t('errorPassword'),
                errorMismatch: t('errorMismatch'),
                errorGeneric: t('errorGeneric'),
              }}
            />
          </div>
        )}

        {trophies}

        {!fromReset && (
          <div className="mt-10">
            <ChangePasswordForm
              labels={{
                title: t('changePassword'),
                newPassword: t('newPassword'),
                confirmPassword: t('confirmPassword'),
                save: t('save'),
                saved: t('passwordSaved'),
                errorLength: t('errorPassword'),
                errorMismatch: t('errorMismatch'),
                errorGeneric: t('errorGeneric'),
              }}
            />
          </div>
        )}
        {!isOwner && (
          <div className="mt-6">
            <DeleteAccount />
          </div>
        )}
      </div>
    </div>
  );
}
