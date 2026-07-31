'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  PROFILE_EVENT,
  PROFILE_KEY,
  getProfile,
  saveProfile as persistProfile,
  signOut as clearProfile,
  type ZiggyProfile,
} from '@/lib/account';

interface UseProfileResult {
  profile: ZiggyProfile | null;
  /** False until the first client-side read finished (avoids hydration flashes). */
  ready: boolean;
  saveProfile: (profile: ZiggyProfile) => void;
  signOut: () => void;
}

/**
 * Reactive access to the locally-stored Ziggy profile.
 * Updates live via the `ziggy:profile` CustomEvent and cross-tab `storage` events.
 */
export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<ZiggyProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setProfile(getProfile());
    setReady(true);

    const onProfile = (e: Event) => {
      const detail = (e as CustomEvent<ZiggyProfile | null>).detail;
      setProfile(detail ?? getProfile());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === PROFILE_KEY) setProfile(getProfile());
    };

    window.addEventListener(PROFILE_EVENT, onProfile);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(PROFILE_EVENT, onProfile);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const saveProfile = useCallback((next: ZiggyProfile) => {
    persistProfile(next);
    setProfile(next);
  }, []);

  const signOut = useCallback(() => {
    clearProfile();
    setProfile(null);
  }, []);

  return { profile, ready, saveProfile, signOut };
}
