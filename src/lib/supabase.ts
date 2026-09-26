import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** False on a deployment without the Supabase env vars — accounts then degrade gracefully. */
export const isSupabaseConfigured = Boolean(url && key);

let browserClient: SupabaseClient | null = null;

/**
 * The browser client, shared across the app so there is one session and one
 * auth listener. The publishable key is safe to ship: every table is guarded
 * by row level security, and that is where access is actually decided.
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured || typeof window === 'undefined') return null;
  browserClient ??= createClient(url!, key!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'ziggy-auth',
    },
  });
  return browserClient;
}

/**
 * A short-lived client for server components. It carries no session, so it can
 * only see what anonymous visitors may see — which is exactly what the public
 * pages need. A timeout keeps a slow or unreachable database from stalling a build.
 */
export function getServerSupabase(timeoutMs = 4000): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  return createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) }),
    },
  });
}
