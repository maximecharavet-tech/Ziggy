'use client';

import { createElement, useRef, type ReactNode } from 'react';
import { useInView } from 'motion/react';

/**
 * Children marked `mg-rise` (style `rise(i)` from ./rise) come in one after the other
 * when the group scrolls into view: ≤ 300 ms each, CSS only. Without JS or
 * with reduced motion they are simply there (see magic.css).
 */
export function Stagger({
  as = 'div',
  className,
  children,
  id,
  'aria-labelledby': labelledBy,
}: {
  as?: 'div' | 'ul' | 'ol' | 'section' | 'header';
  className?: string;
  children: ReactNode;
  id?: string;
  'aria-labelledby'?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -8% 0px' });
  return createElement(as, { ref, id, className, 'aria-labelledby': labelledBy, 'data-stagger': '', 'data-in': inView ? '' : undefined }, children);
}
