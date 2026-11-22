'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { createJuice, type Juice } from './juice';

/**
 * Fx + sound for a target element, from a component:
 *
 *   const juice = useJuice();
 *   <button onClick={(e) => juice.celebrate(e)}>…</button>
 *
 * The object is stable for the component's life (safe in effect deps). It
 * reads reduced motion through the SSR-safe hook, and every call is a no-op
 * on the server.
 */
export function useJuice(options: { silent?: boolean } = {}): Juice {
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);
  const silent = Boolean(options.silent);
  return useMemo(() => createJuice({ isReduced: () => reducedRef.current, silent }), [silent]);
}
