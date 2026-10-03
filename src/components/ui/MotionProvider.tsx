'use client';

import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';

/** Framer Motion follows the visitor's "reduce motion" setting everywhere. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
