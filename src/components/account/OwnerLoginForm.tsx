'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, ChevronDown } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { checkOwnerCredentials, startOwnerSession } from '@/lib/owner';

/**
 * Collapsed owner entry at the bottom of the login page — present for the
 * owner, out of the way for a child.
 */
export function OwnerLoginForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkOwnerCredentials(user, pass)) {
      startOwnerSession();
      router.push('/owner');
      return;
    }
    setError(true);
  };

  return (
    <div className="mt-10 border-t border-border/50 pt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-center gap-2 text-xs font-bold text-text-dim hover:text-text-muted transition-colors py-2"
        aria-expanded={open}
      >
        <KeyRound size={13} />
        Owner access
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            onSubmit={submit}
            className="overflow-hidden"
          >
            <div className="pt-4 space-y-3">
              <input
                value={user}
                onChange={(e) => { setUser(e.target.value); setError(false); }}
                placeholder="Identifiant"
                autoComplete="username"
                className="w-full glass rounded-xl px-4 py-3 text-sm text-text-body border border-border/50 outline-none focus:ring-2 focus:ring-green/30"
                aria-label="Identifiant"
              />
              <input
                type="password"
                value={pass}
                onChange={(e) => { setPass(e.target.value); setError(false); }}
                placeholder="Mot de passe"
                autoComplete="current-password"
                className="w-full glass rounded-xl px-4 py-3 text-sm text-text-body border border-border/50 outline-none focus:ring-2 focus:ring-green/30"
                aria-label="Mot de passe"
              />

              {error && (
                <p className="text-xs text-pink font-semibold" role="alert">
                  Identifiant ou mot de passe incorrect.
                </p>
              )}

              <button
                type="submit"
                className="w-full gradient-green-cta text-white rounded-full py-3 text-sm font-bold active:scale-[0.98] transition-transform"
              >
                Accéder au tableau de bord
              </button>

              <p className="text-[11px] text-text-dim leading-relaxed">
                Ce site est entièrement côté navigateur et son code est public : cet accès est un
                garde-fou pratique, pas une sécurité. N&apos;y mettez pas de données privées.
              </p>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
