'use client';

import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

/** Motion follows the visitor's "reduce motion" setting throughout the app. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
