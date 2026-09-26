'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, Loader2, Eye, EyeOff, CheckCircle2, KeyRound } from 'lucide-react';
import { useRouter, Link } from '@/i18n/navigation';
import { ParticleField } from '@/components/ui/ParticleField';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { SecureNotice } from '@/components/account/SecureNotice';
import { useProfile } from '@/components/account/ProfileProvider';
import { authErrorKey } from '@/components/account/authErrors';
import { loadSupabase } from '@/lib/supabase';
import { avatarColor, isValidEmail, toLoginEmail } from '@/lib/account';

const inputClasses =
  'w-full min-h-[56px] px-5 rounded-2xl glass border border-border/60 text-lg font-semibold text-text-body placeholder:text-text-dim placeholder:font-normal outline-none transition-all focus:border-green focus:shadow-[0_0_0_4px_rgba(34,197,94,0.15)]';

export function LoginPageContent() {
  const t = useTranslations('account');
  const locale = useLocale();
  const router = useRouter();
  const { ready, user, profile, isOwner } = useProfile();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    setConfirmed(new URLSearchParams(window.location.search).get('confirmed') === '1');
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !password) return setError(t('errorCredentials'));

    const sb = await loadSupabase();
    if (!sb) return setError(t('errorUnavailable'));

    setError(null);
    setBusy(true);
    const { data, error: signInError } = await sb.auth.signInWithPassword({
      email: toLoginEmail(identifier),
      password,
    });
    setBusy(false);

    if (signInError) return setError(t(authErrorKey(signInError)));
    router.push(data.user?.app_metadata?.role === 'owner' ? '/owner' : '/account');
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    const mail = resetEmail.trim().toLowerCase();
    if (!isValidEmail(mail)) return setError(t('errorEmail'));
    const sb = await loadSupabase();
    if (!sb) return setError(t('errorUnavailable'));

    setError(null);
    setBusy(true);
    const { error: resetError } = await sb.auth.resetPasswordForEmail(mail, {
      redirectTo: `${window.location.origin}/${locale}/account?reset=1`,
    });
    setBusy(false);
    // Say "sent" either way, so the form can't be used to probe which emails exist.
    if (resetError?.code === 'over_email_send_rate_limit') return setError(t('errorRateLimit'));
    setResetSent(true);
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="relative overflow-hidden">
        <ParticleField count={24} />
        <div className="max-w-md mx-auto px-4 py-10 text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-text-body mb-3">{t('loginTitle')}</h1>
            <p className="text-base sm:text-lg text-text-muted">{t('loginSubtitle')}</p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4">
        {confirmed && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-green/30 bg-green/10 px-4 py-3 text-sm font-semibold text-text-body">
            <CheckCircle2 size={18} className="text-green shrink-0" />
            {t('confirmedNote')}
          </div>
        )}

        {/* Already signed in: offer to continue rather than a second login. */}
        {ready && user ? (
          <div className="glass-strong rounded-3xl border border-border/50 p-6 sm:p-8 text-center">
            {profile && (
              <div
                className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-4"
                style={{ backgroundColor: `${avatarColor(profile.avatar)}18` }}
              >
                <AgentAvatar agentId={profile.avatar} color={avatarColor(profile.avatar)} size={64} />
              </div>
            )}
            <p className="font-bold text-text-body mb-5">{profile?.name ?? user.email}</p>
            <Link
              href={isOwner ? '/owner' : '/account'}
              className="inline-flex items-center justify-center min-h-[52px] w-full rounded-2xl gradient-green-cta text-white font-extrabold"
            >
              {t('continueAs')}
            </Link>
          </div>
        ) : (
          <>
            <SecureNotice text={t('secureNotice')} />

            <AnimatePresence mode="wait" initial={false}>
              {!resetOpen ? (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  onSubmit={handleSubmit}
                  noValidate
                  className="mt-6 glass-strong rounded-3xl border border-border/50 p-6 sm:p-8 space-y-5"
                >
                  <div>
                    <label htmlFor="login-id" className="block text-base font-bold text-text-body mb-3">
                      {t('identifierLabel')}
                    </label>
                    <input
                      id="login-id"
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder={t('identifierPlaceholder')}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      className={inputClasses}
                    />
                  </div>

                  <div>
                    <label htmlFor="login-password" className="block text-base font-bold text-text-body mb-3">
                      {t('passwordLabel')}
                    </label>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
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

                  {error && (
                    <p role="alert" className="text-sm font-semibold text-pink">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full min-h-[56px] rounded-2xl gradient-green-cta text-white text-lg font-extrabold transition-all active:scale-[0.98] shadow-[0_6px_20px_rgba(34,197,94,0.3)] disabled:opacity-70 inline-flex items-center justify-center gap-2"
                  >
                    {busy ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} className="rtl:rotate-180" />}
                    {busy ? t('signingIn') : t('loginButton')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setResetOpen(true);
                      setError(null);
                      if (isValidEmail(identifier)) setResetEmail(identifier.trim());
                    }}
                    className="block mx-auto text-sm font-semibold text-text-muted hover:text-green"
                  >
                    {t('forgotLink')}
                  </button>
                </motion.form>
              ) : (
                <motion.form
                  key="reset"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  onSubmit={handleReset}
                  noValidate
                  className="mt-6 glass-strong rounded-3xl border border-border/50 p-6 sm:p-8 space-y-5"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-green/10 flex items-center justify-center">
                      <KeyRound size={18} className="text-green" />
                    </span>
                    <h2 className="font-extrabold text-text-body">{t('resetTitle')}</h2>
                  </div>

                  {resetSent ? (
                    <p className="text-sm text-text-muted leading-relaxed">{t('resetSent')}</p>
                  ) : (
                    <>
                      <p className="text-sm text-text-muted leading-relaxed">{t('resetText')}</p>
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder={t('emailPlaceholder')}
                        autoComplete="email"
                        inputMode="email"
                        aria-label={t('emailLabel')}
                        className={inputClasses}
                      />
                      {error && (
                        <p role="alert" className="text-sm font-semibold text-pink">
                          {error}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full min-h-[52px] rounded-2xl gradient-green-cta text-white font-extrabold disabled:opacity-70 inline-flex items-center justify-center gap-2"
                      >
                        {busy && <Loader2 size={18} className="animate-spin" />}
                        {t('resetButton')}
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setResetOpen(false);
                      setResetSent(false);
                      setError(null);
                    }}
                    className="block mx-auto text-sm font-semibold text-text-muted hover:text-green"
                  >
                    {t('backToLogin')}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            <p className="mt-6 text-center text-sm text-text-muted">
              {t('noAccount')}{' '}
              <Link href="/signup" className="font-bold text-green hover:underline">
                {t('createButton')}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
