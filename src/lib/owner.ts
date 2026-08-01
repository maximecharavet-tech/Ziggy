/**
 * Owner mode.
 *
 * IMPORTANT, and deliberately written down where the next reader will see it:
 * this site is entirely client-side and its source is public, so this check is
 * a convenience gate, not a security boundary. Anyone who reads the bundle can
 * find these values. Never put real private data behind it — when this needs to
 * protect anything, it has to move to a server with real authentication.
 */

const OWNER_USER = process.env.NEXT_PUBLIC_OWNER_USER || 'mastermax07';
const OWNER_PASS = process.env.NEXT_PUBLIC_OWNER_PASS || 'mastermax07';

export const OWNER_KEY = 'ziggy:owner';
export const OWNER_EVENT = 'ziggy:owner';

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function checkOwnerCredentials(user: string, pass: string): boolean {
  return user.trim() === OWNER_USER && pass === OWNER_PASS;
}

/** Kept in sessionStorage so owner mode ends when the tab closes. */
export function startOwnerSession(): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(OWNER_KEY, '1');
    window.dispatchEvent(new CustomEvent(OWNER_EVENT, { detail: true }));
  } catch {
    /* ignore */
  }
}

export function endOwnerSession(): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(OWNER_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(OWNER_EVENT, { detail: false }));
}

export function isOwner(): boolean {
  if (!isBrowser()) return false;
  try {
    return window.sessionStorage.getItem(OWNER_KEY) === '1';
  } catch {
    return false;
  }
}
