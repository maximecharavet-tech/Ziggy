'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAppShell } from '@/lib/use-app-shell';
import { GrownUpGateProvider } from './GrownUpGate';
import { AppBack } from './AppBack';
import { SpatialNavigation } from '@/components/tv/SpatialNavigation';

/**
 * Everything the Ziggy app adds to the site: the grown-up gate, Back (with
 * "Leave Ziggy?" at home) and, on TV, the remote-control navigation. In a
 * browser it only provides the (pass-through) gate.
 */
export function AppShellProvider({ children }: { children: ReactNode }) {
  const shell = useAppShell();
  return (
    <GrownUpGateProvider>
      {children}
      {shell.app ? <AppBack /> : null}
      {shell.app ? <RouteFade /> : null}
      {shell.tv ? <SpatialNavigation /> : null}
    </GrownUpGateProvider>
  );
}

/** In the app, each new screen fades in gently (opacity only: fixed layers inside must not move). */
function RouteFade() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    document.getElementById('main-content')?.animate?.([{ opacity: 0.001 }, { opacity: 1 }], { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
  }, [pathname]);
  return null;
}
