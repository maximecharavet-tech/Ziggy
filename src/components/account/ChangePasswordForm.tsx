'use client';

import { useState, type FormEvent } from 'react';
import { KeyRound, Loader2, Check } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import { MIN_PASSWORD_LENGTH } from '@/lib/account';

export interface ChangePasswordLabels {
  title: string;
  newPassword: string;
  confirmPassword: string;
  save: string;
  saved: string;
  errorLength: string;
  errorMismatch: string;
  errorGeneric: string;
}

/**
 * Sets a new password for whoever is signed in. After a password-reset email
 * the parent lands here already signed in, so the same form covers recovery.
 */
export function ChangePasswordForm({ labels, highlight = false }: { labels: ChangePasswordLabels; highlight?: boolean }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setDone(false);
    if (password.length < MIN_PASSWORD_LENGTH) return setError(labels.errorLength);
    if (password !== confirm) return setError(labels.errorMismatch);
    const sb = getSupabase();
    if (!sb) return setError(labels.errorGeneric);

    setError(null);
    setBusy(true);
    const { error: updateError } = await sb.auth.updateUser({ password });
    setBusy(false);
    if (updateError) return setError(updateError.code === 'weak_password' ? labels.errorLength : labels.errorGeneric);

    setPassword('');
    setConfirm('');
    setDone(true);
  }

  const field =
    'w-full min-h-[48px] px-4 rounded-xl glass border border-border/60 text-sm font-semibold text-text-body outline-none focus:border-green focus:shadow-[0_0_0_4px_rgba(34,197,94,0.15)]';

  return (
    <form
      onSubmit={submit}
      noValidate
      className={`glass-strong rounded-2xl border p-6 ${highlight ? 'border-green/50 shadow-[0_0_0_4px_rgba(34,197,94,0.12)]' : 'border-border/50'}`}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <KeyRound size={18} className="text-green" />
        <h2 className="font-extrabold text-text-body">{labels.title}</h2>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={labels.newPassword}
          aria-label={labels.newPassword}
          autoComplete="new-password"
          className={field}
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={labels.confirmPassword}
          aria-label={labels.confirmPassword}
          autoComplete="new-password"
          className={field}
        />
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-pink">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="mt-3 text-sm font-semibold text-green inline-flex items-center gap-1.5">
          <Check size={15} /> {labels.saved}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 inline-flex items-center gap-2 min-h-[44px] px-5 rounded-full gradient-green-cta text-white text-sm font-bold disabled:opacity-70"
      >
        {busy && <Loader2 size={15} className="animate-spin" />}
        {labels.save}
      </button>
    </form>
  );
}
