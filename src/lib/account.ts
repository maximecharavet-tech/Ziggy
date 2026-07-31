/**
 * Ziggy local profile.
 *
 * IMPORTANT — there is no server and no database behind this. The profile is
 * written to this browser's `localStorage` only. Nothing is ever sent anywhere,
 * no password is collected, and clearing the browser data deletes the profile.
 * The UI must say so plainly (see the `account.localOnly` translation).
 */

export const PROFILE_KEY = 'ziggy:profile';
export const PROFILE_EVENT = 'ziggy:profile';

/** The five avatar choices, mirroring the five agent colours. */
export const AVATAR_CHOICES = [
  { id: 'sales', color: '#3B82F6' },
  { id: 'marketing', color: '#8B5CF6' },
  { id: 'finance', color: '#10B981' },
  { id: 'accounting', color: '#F59E0B' },
  { id: 'advertising', color: '#EC4899' },
] as const;

export type AvatarId = (typeof AVATAR_CHOICES)[number]['id'];

export type AgeGroup = '5-7' | '8-10' | '11-12';

export interface ZiggyProfile {
  id: string;
  name: string;
  /** One of the five agent-colour avatars. */
  avatar: AvatarId;
  email?: string;
  ageGroup?: AgeGroup;
  createdAt: string;
}

export function avatarColor(avatar: string): string {
  return AVATAR_CHOICES.find((a) => a.id === avatar)?.color ?? AVATAR_CHOICES[0].color;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function emitChange(profile: ZiggyProfile | null) {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent<ZiggyProfile | null>(PROFILE_EVENT, { detail: profile }));
}

export function createProfileId(): string {
  return `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function getProfile(): ZiggyProfile | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ZiggyProfile>;
    if (!parsed || typeof parsed.name !== 'string' || !parsed.name) return null;
    return {
      id: typeof parsed.id === 'string' && parsed.id ? parsed.id : createProfileId(),
      name: parsed.name,
      avatar: (AVATAR_CHOICES.some((a) => a.id === parsed.avatar)
        ? parsed.avatar
        : AVATAR_CHOICES[0].id) as AvatarId,
      email: typeof parsed.email === 'string' && parsed.email ? parsed.email : undefined,
      ageGroup: parsed.ageGroup as AgeGroup | undefined,
      createdAt:
        typeof parsed.createdAt === 'string' && parsed.createdAt
          ? parsed.createdAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveProfile(profile: ZiggyProfile): ZiggyProfile | null {
  if (!isBrowser()) return null;
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    emitChange(profile);
    return profile;
  } catch {
    return null;
  }
}

export function signOut(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* ignore */
  }
  emitChange(null);
}

export function isSignedIn(): boolean {
  return getProfile() !== null;
}
