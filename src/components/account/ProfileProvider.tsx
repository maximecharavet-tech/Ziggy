'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  startSession,
  subscribeSession,
  getSessionState,
  getServerSessionState,
  updateProfile,
  refreshProfile,
  signOut,
} from '@/lib/session';

/**
 * The signed-in parent, their child's profile, and whether they are the owner.
 * Every caller shares one session store; see `src/lib/session.ts`.
 */
export function useProfile() {
  const session = useSyncExternalStore(subscribeSession, getSessionState, getServerSessionState);

  useEffect(() => {
    startSession();
  }, []);

  return { ...session, updateProfile, refreshProfile, signOut };
}
