import type { ReactNode } from 'react';
import { SantaBackdrop } from '@/components/santa/SantaBackdrop';

/** Les Lutins Farceurs: the same magical night sky as Santa's village. */
export default function LutinsLayout({ children }: { children: ReactNode }) {
  return <SantaBackdrop>{children}</SantaBackdrop>;
}
