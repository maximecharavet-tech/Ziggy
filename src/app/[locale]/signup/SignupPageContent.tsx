'use client';

import { useState, FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Sparkles, Check } from 'lucide-react';
import { useRouter, Link } from '@/i18n/navigation';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { ParticleField } from '@/components/ui/ParticleField';
import { useProfile } from '@/components/account/ProfileProvider';
import { LocalOnlyNotice } from '@/components/account/LocalOnlyNotice';
import { AVATAR_CHOICES, createProfileId, type AgeGroup, type AvatarId } from '@/lib/account';

const AGE_GROUPS: AgeGroup[] = ['5-7', '8-10', '11-12'];

const inputClasses =
  'w-full min-h-[56px] px-5 rounded-2xl glass border border-border/60 text-lg font-semibold text-text-body placeholder:text-text-dim placeholder:font-normal outline-none transition-all focus:border-green focus:shadow-[0_0_0_4px_rgba(34,197,94,0.15)]';

export function SignupPageContent() {
  const t = useTranslations('account');
  const router = useRouter();
  const { saveProfile } = useProfile();

  const [name, setName] = useState('');
  const [ageGroup, setAgeGroup] = useState<AgeGroup | ''>('');
  const [avatar, setAvatar] = useState<AvatarId>(AVATAR_CHOICES[0].id);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('errorName'));
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('errorEmail'));
      return;
    }
    setError(null);
    saveProfile({
      id: createProfileId(),
      name: trimmed,
      avatar,
      email: email.trim() || undefined,
      ageGroup: ageGroup || undefined,
      createdAt: new Date().toISOString(),
    });
    router.push('/account');
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="relative overflow-hidden">
        <ParticleField count={24} />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-border/50 text-xs font-semibold text-green mb-6">
              <Sparkles size={14} />
              {t('badge')}
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-text-body mb-3">
              {t('signupTitle')}
            </h1>
            <p className="text-base sm:text-lg text-text-muted">{t('signupSubtitle')}</p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <LocalOnlyNotice text={t('localOnly')} />

        <form onSubmit={handleSubmit} className="mt-6 glass-strong rounded-3xl border border-border/50 p-6 sm:p-8 space-y-8">
          {/* Name */}
          <div>
            <label htmlFor="ziggy-name" className="block text-base font-bold text-text-body mb-3">
              {t('nameLabel')}
            </label>
            <input
              id="ziggy-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              autoComplete="given-name"
              className={inputClasses}
            />
          </div>

          {/* Age group */}
          <div>
            <span className="block text-base font-bold text-text-body mb-3">{t('ageLabel')}</span>
            <div className="grid grid-cols-3 gap-3">
              {AGE_GROUPS.map((g) => {
                const active = ageGroup === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setAgeGroup(active ? '' : g)}
                    aria-pressed={active}
                    className={`min-h-[56px] rounded-2xl font-extrabold text-lg transition-all active:scale-95 border ${
                      active
                        ? 'bg-green text-white border-green shadow-[0_6px_20px_rgba(34,197,94,0.3)]'
                        : 'glass border-border/60 text-text-muted hover:border-green/40'
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Avatar picker */}
          <div>
            <span className="block text-base font-bold text-text-body mb-3">{t('avatarLabel')}</span>
            <div className="flex flex-wrap gap-3">
              {AVATAR_CHOICES.map((choice) => {
                const active = avatar === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => setAvatar(choice.id)}
                    aria-pressed={active}
                    aria-label={choice.id}
                    className={`relative w-[72px] h-[72px] min-w-[48px] rounded-2xl flex items-center justify-center transition-all active:scale-95 border-2 ${
                      active ? 'scale-105' : 'border-transparent hover:scale-105'
                    }`}
                    style={{
                      backgroundColor: `${choice.color}14`,
                      borderColor: active ? choice.color : 'transparent',
                      boxShadow: active ? `0 8px 24px ${choice.color}40` : undefined,
                    }}
                  >
                    <AgentAvatar agentId={choice.id} color={choice.color} size={52} />
                    {active && (
                      <span
                        className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: choice.color }}
                      >
                        <Check size={14} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Parent email (optional) */}
          <div>
            <label htmlFor="ziggy-email" className="block text-base font-bold text-text-body mb-1">
              {t('emailLabel')}
            </label>
            <p className="text-sm text-text-dim mb-3">{t('emailHint')}</p>
            <input
              id="ziggy-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              autoComplete="email"
              className={inputClasses}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-semibold text-pink">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full min-h-[56px] rounded-2xl gradient-green-cta text-white text-lg font-extrabold transition-all active:scale-[0.98] shadow-[0_6px_20px_rgba(34,197,94,0.3)] hover:shadow-[0_10px_28px_rgba(34,197,94,0.4)]"
          >
            {t('createButton')}
          </button>

          <p className="text-center text-sm text-text-muted">
            {t('alreadyHave')}{' '}
            <Link href="/login" className="font-bold text-green hover:underline">
              {t('loginLink')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
