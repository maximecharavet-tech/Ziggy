'use client';

import { useEffect, useRef } from 'react';

/**
 * Runs `fire` each time `trigger` becomes a new truthy value (a counter, a
 * timestamp, `true` after `false`). With `onMount` (default) a truthy value on
 * the first render fires too. React's strict-mode double effects see the same
 * value twice and fire once.
 */
export function useTrigger(trigger: unknown, fire: () => void, { onMount = true }: { onMount?: boolean } = {}): void {
  const seen = useRef<unknown>(onMount ? undefined : trigger);
  const fn = useRef(fire);
  useEffect(() => {
    fn.current = fire;
  });
  useEffect(() => {
    if (Object.is(trigger, seen.current)) return;
    seen.current = trigger;
    if (trigger) fn.current();
  }, [trigger]);
}
