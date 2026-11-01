'use client';

import { useEffect, type RefObject } from 'react';

/** Can the remote press it right now (in the page, enabled, with a size). */
function usable(el: HTMLElement): boolean {
  if (!el.isConnected || (el as HTMLButtonElement).disabled || el.closest('[inert], [aria-hidden="true"]')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2;
}

/** The step's main button: the first usable `data-tv-autofocus` inside `root`. */
export function tvStepTarget(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null;
  return [...root.querySelectorAll<HTMLElement>('[data-tv-autofocus]')].find(usable) ?? null;
}

/** TV mode (remote control): `html[data-tv]`. */
export function isTv(): boolean {
  return typeof document !== 'undefined' && document.documentElement.hasAttribute('data-tv');
}

/**
 * TV remote: each time a game moves to a new step (`step` changes), the focus goes
 * straight to that step's main button (`data-tv-autofocus` inside `root`), even when
 * the button only appears a moment later — never left on the page or on the 🔊 button
 * when the previous step's buttons disappear. A focus the child already put on another
 * button of the same step is kept, and nothing is stolen from an open dialog.
 */
export function useTvStepFocus(step: string | null, root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (step === null || !isTv()) return;
    let tries = 0;
    let timer = 0;
    const tick = () => {
      timer = 0;
      const box = root.current;
      // A dialog (a celebration) is open: it owns the focus; its own close hands it back.
      if (document.querySelector('[aria-modal="true"]')) return;
      const target = tvStepTarget(box);
      if (target) {
        const a = document.activeElement as HTMLElement | null;
        const kept = a && a !== document.body && box?.contains(a) && a.closest('[data-tv-stage]') && usable(a);
        if (!kept) target.focus({ preventScroll: true });
        return;
      }
      if (++tries < 60) timer = window.setTimeout(tick, 80);
    };
    timer = window.setTimeout(tick, 40);
    return () => window.clearTimeout(timer);
  }, [step, root]);
}
