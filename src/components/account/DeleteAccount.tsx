'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2, Loader2 } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { loadSupabase } from '@/lib/supabase';
import { signOut } from '@/lib/session';

/**
 * Right to erasure: removes the parent account, the child's profile and all
 * results (cascade). The deletion itself runs in the `delete-account` edge
 * function, which holds the admin key; the browser never does.
 */
export function DeleteAccount() {
  const t = useTranslations('account');
  const router = useRouter();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const armed = typed.trim().toUpperCase() === t('deleteWord').toUpperCase();

  async function remove() {
    if (!armed) return;
    setBusy(true);
    setError(false);
    const sb = await loadSupabase();
    const { data, error: fnError } = sb
      ? await sb.functions.invoke<{ deleted?: boolean }>('delete-account', { method: 'POST' })
      : { data: null, error: new Error('unavailable') };

    if (fnError || !data?.deleted) {
      setBusy(false);
      setError(true);
      return;
    }

    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('ziggy:progress')) localStorage.removeItem(key);
      }
    } catch {
      /* storage blocked — nothing to clean */
    }
    await signOut();
    router.replace('/');
  }

  return (
    <section className="rounded-2xl border border-coral/40 bg-coral/5 p-6">
      <div className="flex items-center gap-2.5 mb-2">
        <Trash2 size={18} className="text-coral" />
        <h2 className="font-extrabold text-text-body">{t('deleteTitle')}</h2>
      </div>
      <p className="text-sm text-text-muted leading-relaxed mb-4">{t('deleteText')}</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={t('deleteConfirm')}
          aria-label={t('deleteConfirm')}
          autoComplete="off"
          className="flex-1 min-h-[48px] px-4 rounded-xl bg-bg-card border border-border/60 text-sm font-semibold text-text-body outline-none focus:border-coral"
        />
        <button
          onClick={() => void remove()}
          disabled={!armed || busy}
          className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-xl bg-coral text-white text-sm font-bold disabled:opacity-40 transition-opacity"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          {busy ? t('deleting') : t('deleteButton')}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-coral">
          {t('deleteError')}
        </p>
      )}
    </section>
  );
}
