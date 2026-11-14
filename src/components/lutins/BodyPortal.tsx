'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders a full-screen overlay at the end of <body>, above the site header:
 * the /lutins pages sit inside the night-sky backdrop's own stacking context
 * (`isolate`), where no z-index can beat the fixed header.
 */
export function BodyPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}
