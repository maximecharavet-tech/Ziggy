import type { SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** False on a deployment without the Supabase env vars — accounts then degrade gracefully. */
export const isSupabaseConfigured = Boolean(url && key);

let browserClient: Promise<SupabaseClient> | null = null;

/**
 * The browser client, shared across the app so there is one session and one
 * auth listener. The library is fetched on first use rather than shipped with
 * every page — the landing page shouldn't pay ~70 kB before anyone signs in.
 *
 * The publishable key is safe to expose: every table is guarded by row level
 * security, and that is where access is actually decided.
 */
export function loadSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured || typeof window === 'undefined') return Promise.resolve(null);
  browserClient ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'ziggy-auth',
      },
    }),
  );
  return browserClient;
}
