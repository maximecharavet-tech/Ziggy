import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * A short-lived client for server components. It carries no session, so it can
 * only see what anonymous visitors may see — exactly what public pages need.
 * A timeout keeps a slow or unreachable database from stalling a build.
 */
export function getServerSupabase(timeoutMs = 4000): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) }),
    },
  });
}
