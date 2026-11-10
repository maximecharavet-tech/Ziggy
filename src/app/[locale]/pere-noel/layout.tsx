import type { ReactNode } from 'react';
import { SantaBackdrop } from '@/components/santa/SantaBackdrop';
import { ScheduledCallWatcher } from '@/components/santa/schedule/ScheduledCallWatcher';

/** L'appli du Père Noël: one magical night sky behind every page. */
export default function SantaLayout({ children }: { children: ReactNode }) {
  return (
    <SantaBackdrop>
      <ScheduledCallWatcher />
      {children}
    </SantaBackdrop>
  );
}
