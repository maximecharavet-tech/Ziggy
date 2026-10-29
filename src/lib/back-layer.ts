'use client';

import { useEffect, useRef } from 'react';

/**
 * A modal or sheet that the Android back button closes: while `open`, one
 * history entry sits on top of the page, so the app's Back (which goes back
 * in the WebView history) pops it and closes the layer instead of leaving
 * the page. Closing the layer any other way removes that entry again.
 */
export function useBackLayer(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const id = `layer-${Math.random().toString(36).slice(2)}`;
    let popped = false;
    try {
      window.history.pushState({ ziggyLayer: id }, '');
    } catch {
      return;
    }
    const onPop = () => {
      if ((window.history.state as { ziggyLayer?: string } | null)?.ziggyLayer === id) return;
      popped = true;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (!popped && (window.history.state as { ziggyLayer?: string } | null)?.ziggyLayer === id) window.history.back();
    };
  }, [open]);
}

/** Resolves once the history has settled after a layer closed (before navigating elsewhere). */
export function historySettled(timeout = 400): Promise<void> {
  if (typeof window === 'undefined' || !(window.history.state as { ziggyLayer?: string } | null)?.ziggyLayer) return Promise.resolve();
  return new Promise((resolve) => {
    const t = window.setTimeout(done, timeout);
    function done() {
      window.clearTimeout(t);
      window.removeEventListener('popstate', done);
      resolve();
    }
    window.addEventListener('popstate', done);
  });
}

/**
 * A modal's focus: when it opens, remember what had the focus; as soon as it
 * starts closing (`present` false, during its fade-out), give it back — so the
 * TV remote and screen readers never stay on a dialog that is going away.
 */
export function useFocusReturn(present: boolean) {
  const prev = useRef<HTMLElement | null>(null);
  useEffect(() => {
    prev.current = document.activeElement as HTMLElement | null;
    return () => {
      const el = prev.current;
      if (el?.isConnected && document.activeElement !== el) el.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    if (present) return;
    const el = prev.current;
    if (el?.isConnected) el.focus({ preventScroll: true });
  }, [present]);
}
