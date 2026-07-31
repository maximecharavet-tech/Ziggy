'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ArrowRight, UserPlus } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { ParticleField } from '@/components/ui/ParticleField';
import { Button } from '@/components/ui/Button';
import { useProfile } from '@/components/account/ProfileProvider';
import { LocalOnlyNotice } from '@/components/account/LocalOnlyNotice';
import { avatarColor } from '@/lib/account';

export function LoginPageContent() {
  const t = useTranslations('account');
  const { profile, ready } = useProfile();

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
            <h1 className="text-3xl sm:text-4xl font-extrabold text-text-body mb-3">
              {t('loginTitle')}
            </h1>
            <p className="text-base sm:text-lg text-text-muted">{t('loginSubtitle')}</p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <LocalOnlyNotice text={t('localOnly')} />

        <div className="mt-6 glass-strong rounded-3xl border border-border/50 p-6 sm:p-8">
          {!ready && <div className="h-24 animate-pulse rounded-2xl bg-border/30" aria-hidden="true" />}

          {ready && profile && (
            <div className="space-y-6">
              <p className="text-sm font-semibold uppercase tracking-wider text-text-dim">
                {t('continueAs')}
              </p>
              <Link
                href="/account"
                className="flex items-center gap-4 rounded-2xl border border-border/60 p-4 min-h-[88px] transition-all hover:border-green/50 hover:shadow-lg active:scale-[0.99]"
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${avatarColor(profile.avatar)}14` }}
                >
                  <AgentAvatar agentId={profile.avatar} color={avatarColor(profile.avatar)} size={52} />
                </div>
                <div className="min-w-0 flex-1 text-start">
                  <p className="text-xl font-extrabold text-text-body truncate">{profile.name}</p>
                  {profile.ageGroup && (
                    <p className="text-sm text-text-muted">
                      {t('ageLabel')}: {profile.ageGroup}
                    </p>
                  )}
                </div>
                <ArrowRight size={22} className="text-green flex-shrink-0 rtl:rotate-180" />
              </Link>

              <div className="pt-2 text-center">
                <Link href="/signup" className="text-sm font-bold text-green hover:underline">
                  {t('createNew')}
                </Link>
              </div>
            </div>
          )}

          {ready && !profile && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-green/10 flex items-center justify-center mx-auto mb-5">
                <UserPlus size={28} className="text-green" />
              </div>
              <h2 className="text-xl font-extrabold text-text-body mb-2">{t('noProfileTitle')}</h2>
              <p className="text-sm text-text-muted mb-6 max-w-sm mx-auto leading-relaxed">
                {t('noProfileText')}
              </p>
              <Button href="/signup" size="lg" className="min-h-[56px] w-full sm:w-auto">
                {t('createButton')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
