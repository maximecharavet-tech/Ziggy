'use client';

import { useSyncExternalStore } from 'react';
import { NO_APP, parseAppShell, type AppPlatform, type AppShell } from './app-shell';

let cached: AppShell | null = null;

/** Read once from <html> (set by SHELL_BOOT_SCRIPT before the first paint; it never changes after). */
function fromDocument(): AppShell {
  if (cached) return cached;
  const d = document.documentElement;
  if (!d.hasAttribute('data-app')) return (cached = NO_APP);
  const p = d.getAttribute('data-platform');
  const platform: AppPlatform | null = p === 'ios' || p === 'android' ? p : null;
  cached = { app: true, platform, tv: d.hasAttribute('data-tv'), version: parseAppShell(navigator.userAgent).version };
  return cached;
}

const subscribe = () => () => {};

/**
 * Where the page runs: the Ziggy app (phone, tablet, TV) or a browser.
 * The server and the hydration render see NO_APP (pages are static), then
 * the real shell right after; CSS reads `html[data-app]` / `html[data-tv]`
 * from the first frame, so nothing flashes.
 */
export function useAppShell(): AppShell {
  return useSyncExternalStore(subscribe, fromDocument, () => NO_APP);
}

/** Outside React (event handlers, effects). */
export function appShellNow(): AppShell {
  return typeof document === 'undefined' ? NO_APP : fromDocument();
}
