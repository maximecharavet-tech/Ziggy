'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion as useFramerReducedMotion } from 'framer-motion';

/**
 * The user's "reduce motion" preference, safe for server rendering: false on
 * the server AND on the first render in the browser (the server can't know
 * the preference, so both must render the same page), then the real value
 * once mounted. Use it instead of framer-motion's useReducedMotion, which is
 * null on the server but true at once in the browser — a hydration mismatch
 * whenever it changes what is rendered.
 */
export function useReducedMotion(): boolean {
  const reduce = useFramerReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted && Boolean(reduce);
}
