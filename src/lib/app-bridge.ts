/**
 * The native Ziggy app (Tauri 2, apps/ziggy-app/) talks to the site through
 * a few commands and one event. Reached only by feature detection of the
 * globals Tauri injects (no @tauri-apps/* package in the site); in a normal
 * browser every call is a quiet no-op or a web fallback.
 *
 * Commands: app_info → { platform, tv, version }, exit_app,
 * haptic(kind: 'light' | 'medium' | 'success'), open_external(url).
 * Event: `ziggy://back` — the Android back button, at the WebView's history root.
 */

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
type Unlisten = () => void;

interface TauriInternals {
  invoke: Invoke;
  transformCallback?: (cb: (payload: unknown) => void, once?: boolean) => number;
}
interface TauriGlobal {
  core?: { invoke?: Invoke };
  event?: { listen?: (event: string, cb: (e: unknown) => void) => Promise<Unlisten> };
}
interface EventInternals {
  unregisterListener?: (event: string, id: number) => void;
}

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: TauriInternals;
  __TAURI__?: TauriGlobal;
  __TAURI_EVENT_PLUGIN_INTERNALS__?: EventInternals;
};

function win(): TauriWindow | null {
  return typeof window === 'undefined' ? null : (window as TauriWindow);
}

function invoker(): Invoke | null {
  const w = win();
  return w?.__TAURI__?.core?.invoke ?? w?.__TAURI_INTERNALS__?.invoke ?? null;
}

/** True inside the native app (the bridge is there). */
export function hasBridge(): boolean {
  return invoker() !== null;
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  const invoke = invoker();
  if (!invoke) return null;
  try {
    return (await invoke(cmd, args)) as T;
  } catch {
    return null;
  }
}

export interface AppInfo {
  platform: 'android' | 'ios' | string;
  tv: boolean;
  version: string;
}

export function appInfo(): Promise<AppInfo | null> {
  return call<AppInfo>('app_info');
}

/** Close the app. False when there is no app to close (a browser). */
export async function exitApp(): Promise<boolean> {
  if (!hasBridge()) return false;
  await call('exit_app');
  return true;
}

export type HapticKind = 'light' | 'medium' | 'success';

/** A small tap felt in the hand (phones only; nothing in a browser). */
export function haptic(kind: HapticKind = 'light'): void {
  void call('haptic', { kind });
}

/**
 * Open a link outside Ziggy (after the grown-up gate): the system browser,
 * mail or phone app in the native app; a new tab in a browser.
 */
export async function openExternal(url: string): Promise<void> {
  if (hasBridge()) {
    await call('open_external', { url });
    return;
  }
  if (/^(mailto|tel|sms):/i.test(url)) window.location.href = url;
  else window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Listen to the Android back button at the WebView's history root
 * (`ziggy://back`). Returns a function that stops listening.
 */
export function onAppBack(handler: () => void): Unlisten {
  const w = win();
  if (!w) return () => {};
  let unlisten: Unlisten | null = null;
  let stopped = false;
  const done = (u: Unlisten) => {
    if (stopped) u();
    else unlisten = u;
  };

  const listen = w.__TAURI__?.event?.listen;
  if (listen) {
    void listen('ziggy://back', () => handler())
      .then(done)
      .catch(() => {});
  } else {
    const internals = w.__TAURI_INTERNALS__;
    if (internals?.transformCallback) {
      // What @tauri-apps/api/event's listen() does, without the package.
      const id = internals.transformCallback(() => handler());
      const event = 'ziggy://back';
      void internals
        .invoke('plugin:event|listen', { event, target: { kind: 'Any' }, handler: id })
        .then((eventId) =>
          done(() => {
            w.__TAURI_EVENT_PLUGIN_INTERNALS__?.unregisterListener?.(event, eventId as number);
            void internals.invoke('plugin:event|unlisten', { event, eventId }).catch(() => {});
          })
        )
        .catch(() => {});
    }
  }
  return () => {
    stopped = true;
    unlisten?.();
  };
}
