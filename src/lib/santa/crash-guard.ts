/**
 * Crash-loop guard for heavy pages (the Santa call). An error boundary catches
 * JavaScript errors, but not the browser killing the tab ("Aw, Snap" /
 * "Zut ! Un problème est survenu…", e.g. out of memory on a small phone).
 * So the page notes in the tab's sessionStorage that it is starting, and that
 * it started fine a few seconds later; if the note still says "starting" on
 * the next load, the last visit crashed and the page runs in safe mode.
 */

export const CALL_PAGE = 'santa-call';
/** How long a page must stay up to count as started. */
export const BOOT_OK_MS = 8000;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

const key = (page: string) => `ziggy:boot:${page}`;

function storage(): Store | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

/** True when the last load of `page` in this tab never finished starting. */
export function lastBootCrashed(page: string, store: Store | null = storage()): boolean {
  try {
    return store?.getItem(key(page)) === 'starting';
  } catch {
    return false;
  }
}

/** Marks `page` as starting, then as started after `okMs` (or when it is left normally). Returns the cleanup. */
export function markBooted(page: string, store: Store | null = storage(), okMs = BOOT_OK_MS): () => void {
  const set = (v: string) => {
    try {
      store?.setItem(key(page), v);
    } catch {
      /* private mode */
    }
  };
  set('starting');
  const ok = () => set('ok');
  const timer = setTimeout(ok, okMs);
  return () => {
    clearTimeout(timer);
    ok();
  };
}
