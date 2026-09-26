'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, MailCheck, Loader2, Eye, EyeOff } from 'lucide-react';
import { useRouter, Link } from '@/i18n/navigation';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { ParticleField } from '@/components/ui/ParticleField';
import { SecureNotice } from '@/components/account/SecureNotice';
import { authErrorKey } from '@/components/account/authErrors';
import { loadSupabase } from '@/lib/supabase';
import {
  AVATAR_CHOICES,
  AGE_GROUPS,
  MIN_PASSWORD_LENGTH,
  isValidEmail,
  type AgeGroup,
  type AvatarId,
} from '@/lib/account';
import { playSound } from '@/lib/sound';

const inputClasses =
  'w-full min-h-[56px] px-5 rounded-2xl glass border border-border/60 text-lg font-semibold text-text-body placeholder:text-text-dim placeholder:font-normal outline-none transition-all focus:border-green focus:shadow-[0_0_0_4px_rgba(34,197,94,0.15)]';

export function SignupPageContent() {
  const t = useTranslations('account');
  const locale = useLocale();
  const router = useRouter();

  const [name, setName] = useState('');
  const [ageGroup, setAgeGroup] = useState<AgeGroup | ''>('');
  const [avatar, setAvatar] = useState<AvatarId>(AVATAR_CHOICES[0].id);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const childName = name.trim();
    const mail = email.trim().toLowerCase();

    if (!childName) return setError(t('errorName'));
    if (!isValidEmail(mail)) return setError(t('errorEmail'));
    if (password.length < MIN_PASSWORD_LENGTH) return setError(t('errorPassword'));

    const sb = await loadSupabase();
    if (!sb) return setError(t('errorUnavailable'));

    setError(null);
    setBusy(true);
    const { data, error: signUpError } = await sb.auth.signUp({
      email: mail,
      password,
      options: {
        data: { child_name: childName, avatar, age_group: ageGroup || null },
        emailRedirectTo: `${window.location.origin}/${locale}/login?confirmed=1`,
      },
    });
    setBusy(false);

    if (signUpError) return setError(t(authErrorKey(signUpError)));

    playSound('star');
    // With email confirmation on there is no session yet: the parent confirms first.
    if (data.session) router.push('/account');
    else setSentTo(mail);
  }

  if (sentTo) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 pt-24 pb-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-strong rounded-3xl border border-border/50 p-8 sm:p-10 text-center max-w-md"
        >
          <div className="w-16 h-16 rounded-2xl bg-green/10 flex items-center justify-center mx-auto mb-5">
            <MailCheck size={30} className="text-green" />
          </div>
          <h1 className="text-2xl font-extrabold text-text-body mb-3">{t('checkEmailTitle')}</h1>
          <p className="text-text-muted leading-relaxed mb-7">{t('checkEmailText', { email: sentTo })}</p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center min-h-[52px] px-7 rounded-full gradient-green-cta text-white font-bold"
          >
            {t('backToLogin')}
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="relative overflow-hidden">
        <ParticleField count={24} />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-border/50 text-xs font-semibold text-green mb-6">
              <Sparkles size={14} />
              {t('badge')}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-text-body mb-3">{t('signupTitle')}</h1>
            <p className="text-base sm:text-lg text-text-muted">{t('signupSubtitle')}</p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <SecureNotice text={t('secureNotice')} />

        <form onSubmit={handleSubmit} noValidate className="mt-6 glass-strong rounded-3xl border border-border/50 p-6 sm:p-8 space-y-8">
          {/* ── For the child ── */}
          <p className="text-xs font-bold uppercase tracking-wider text-green">{t('childSection')}</p>

          <div>
            <label htmlFor="ziggy-name" className="block text-base font-bold text-text-body mb-3">
              {t('nameLabel')}
            </label>
            <input
              id="ziggy-name"
              type="text"
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              autoComplete="off"
              className={inputClasses}
            />
          </div>

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

          <div>
            <span className="block text-base font-bold text-text-body mb-3">{t('avatarLabel')}</span>
            <div className="flex flex-wrap gap-3">
              {AVATAR_CHOICES.map((choice) => {
                const active = avatar === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => {
                      setAvatar(choice.id);
                      playSound('tap');
                    }}
                    aria-pressed={active}
                    aria-label={choice.id}
                    className={`relative w-[72px] h-[72px] rounded-2xl flex items-center justify-center transition-all active:scale-95 border-2 ${
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
                        className="absolute -top-1.5 -end-1.5 w-6 h-6 rounded-full flex items-center justify-center text-white"
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

          {/* ── For the parent ── */}
          <div className="pt-2 border-t border-border/50 space-y-6">
            <p className="pt-6 text-xs font-bold uppercase tracking-wider text-green">{t('parentSection')}</p>

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
                inputMode="email"
                className={inputClasses}
              />
            </div>

            <div>
              <label htmlFor="ziggy-password" className="block text-base font-bold text-text-body mb-1">
                {t('passwordLabel')}
              </label>
              <p className="text-sm text-text-dim mb-3">{t('passwordHint')}</p>
              <div className="relative">
                <input
                  id="ziggy-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className={`${inputClasses} pe-14`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute end-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-xl flex items-center justify-center text-text-dim hover:text-text-body"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                role="alert"
                className="text-sm font-semibold text-pink"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={busy}
            className="w-full min-h-[56px] rounded-2xl gradient-green-cta text-white text-lg font-extrabold transition-all active:scale-[0.98] shadow-[0_6px_20px_rgba(34,197,94,0.3)] hover:shadow-[0_10px_28px_rgba(34,197,94,0.4)] disabled:opacity-70 inline-flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={20} className="animate-spin" />}
            {busy ? t('creating') : t('createButton')}
          </button>

          <p className="text-center text-sm text-text-muted">
            {t('alreadyHave')}{' '}
            <Link href="/login" className="font-bold text-green hover:underline">
              {t('loginButton')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
