/**
 * Ziggy accounts.
 *
 * A parent owns the account (email + password, handled by Supabase Auth); the
 * profile row describes their child. We only ever store the child's first
 * name, an avatar and an age range — nothing else about them.
 */

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

export const AGE_GROUPS: AgeGroup[] = ['5-7', '8-10', '11-12'];

export interface ZiggyProfile {
  id: string;
  /** The child's first name. */
  name: string;
  avatar: AvatarId;
  ageGroup: AgeGroup | null;
  createdAt: string;
}

/** Staff sign in with a short identifier; it maps onto an address on our own domain. */
export const STAFF_EMAIL_DOMAIN = 'ziggy-ai.fr';

export const MIN_PASSWORD_LENGTH = 8;

export function avatarColor(avatar: string): string {
  return AVATAR_CHOICES.find((a) => a.id === avatar)?.color ?? AVATAR_CHOICES[0].color;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** "mastermax07" → "mastermax07@ziggy-ai.fr"; a real address is left alone. */
export function toLoginEmail(identifier: string): string {
  const id = identifier.trim().toLowerCase();
  return id.includes('@') ? id : `${id}@${STAFF_EMAIL_DOMAIN}`;
}

/** Map a raw `profiles` row onto the shape the UI uses. */
export function toProfile(row: {
  id: string;
  child_name: string;
  avatar: string;
  age_group: string | null;
  created_at: string;
}): ZiggyProfile {
  return {
    id: row.id,
    name: row.child_name,
    avatar: (AVATAR_CHOICES.some((a) => a.id === row.avatar) ? row.avatar : 'sales') as AvatarId,
    ageGroup: (AGE_GROUPS as string[]).includes(row.age_group ?? '') ? (row.age_group as AgeGroup) : null,
    createdAt: row.created_at,
  };
}
