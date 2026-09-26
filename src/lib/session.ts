/**
 * One shared view of who is signed in.
 *
 * Several components (navbar, account page, games) need the session. Rather
 * than each opening its own auth listener and re-fetching the profile, they
 * all read this store through `useProfile()`.
 */
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { toProfile, type ZiggyProfile } from './account';
import { syncGuestProgress } from './progress';

export interface SessionState {
  /** False until the first session check finished — avoids a signed-out flash. */
  ready: boolean;
  user: User | null;
  profile: ZiggyProfile | null;
  isOwner: boolean;
}

const INITIAL: SessionState = { ready: false, user: null, profile: null, isOwner: false };

let state: SessionState = INITIAL;
let started = false;
const listeners = new Set<() => void>();

function setState(patch: Partial<SessionState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function getSessionState(): SessionState {
  return state;
}

export function getServerSessionState(): SessionState {
  return INITIAL;
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function loadProfile(userId: string): Promise<ZiggyProfile | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('id, child_name, avatar, age_group, created_at')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return toProfile(data);
}

async function applySession(session: Session | null) {
  const user = session?.user ?? null;
  if (!user) {
    setState({ ready: true, user: null, profile: null, isOwner: false });
    return;
  }
  const isOwner = user.app_metadata?.role === 'owner';
  const profile = await loadProfile(user.id);
  setState({ ready: true, user, profile, isOwner });
  // Trophies won as a guest follow the child into their new account.
  void syncGuestProgress(user.id);
}

/** Starts listening once, however many components ask. */
export function startSession() {
  if (started) return;
  started = true;

  const sb = getSupabase();
  if (!sb) {
    setState({ ready: true });
    return;
  }

  void sb.auth.getSession().then(({ data }) => applySession(data.session));

  // supabase-js warns against awaiting its own calls inside this callback, so
  // defer the profile fetch to the next tick.
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION') return; // handled by getSession above
    setTimeout(() => void applySession(session), 0);
  });
}

export async function refreshProfile() {
  if (!state.user) return;
  const profile = await loadProfile(state.user.id);
  setState({ profile });
}

export async function updateProfile(patch: { name?: string; avatar?: string; ageGroup?: string | null }) {
  const sb = getSupabase();
  if (!sb || !state.user) return { error: 'not-signed-in' as const };

  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.child_name = patch.name.trim().slice(0, 24);
  if (patch.avatar !== undefined) row.avatar = patch.avatar;
  if (patch.ageGroup !== undefined) row.age_group = patch.ageGroup;

  const { data, error } = await sb
    .from('profiles')
    .update(row)
    .eq('id', state.user.id)
    .select('id, child_name, avatar, age_group, created_at')
    .single();

  if (error || !data) return { error: 'update-failed' as const };
  setState({ profile: toProfile(data) });
  return { error: null };
}

export async function signOut() {
  const sb = getSupabase();
  await sb?.auth.signOut();
  setState({ ready: true, user: null, profile: null, isOwner: false });
}
