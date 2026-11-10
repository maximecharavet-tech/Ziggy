'use client';

import { useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { dueCall, msUntilNext, pendingCalls, ringPath, scheduleStore } from '@/lib/santa/schedule';
import { santaStore } from '@/lib/santa/store';
import { prepareScheduledCall, useScheduledCalls } from './ScheduleCallCard';

/**
 * Mounted on every page of the Santa app: when a scheduled call is due, the
 * phone rings (the call page opens full screen). In the background, a
 * notification (if allowed) brings the family back to the call. Calls not yet
 * prepared on the device are prepared quietly.
 */
export function ScheduledCallWatcher() {
  const calls = useScheduledCalls();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale() === 'fr' ? 'fr' : 'en';
  const notified = useRef(new Set<string>());
  const preparing = useRef(new Set<string>());

  // Prepare the clips of calls still to come (once per visit).
  useEffect(() => {
    for (const c of pendingCalls(calls, Date.now())) {
      if (c.ready || preparing.current.has(c.id)) continue;
      preparing.current.add(c.id);
      void prepareScheduledCall(c, locale).catch(() => {});
    }
  }, [calls, locale]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = () => {
      const now = Date.now();
      const due = dueCall(scheduleStore.get(), now);
      if (due) {
        const onCallPage = pathname.startsWith('/pere-noel/appel') && typeof window !== 'undefined' && window.location.search.includes(`ring=${due.id}`);
        if (document.visibilityState === 'hidden' && !notified.current.has(due.id)) {
          notified.current.add(due.id);
          void notify(due.id, santaStore.get().children.find((c) => c.id === due.childId)?.name ?? '', locale);
        }
        if (!onCallPage) router.push(ringPath(due.id));
      }
      const wait = msUntilNext(scheduleStore.get(), Date.now());
      // Re-check every minute at most (timers sleep in background tabs; a visibility change re-checks too).
      timer = setTimeout(check, Math.max(1000, Math.min(wait ?? 60_000, 60_000)));
    };
    check();
    const onVis = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [calls, pathname, router, locale]);

  return null;
}

async function notify(id: string, name: string, locale: 'fr' | 'en') {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const title = locale === 'fr' ? `🎅 Le Père Noël appelle ${name} !` : `🎅 Santa is calling ${name}!`;
  const body = locale === 'fr' ? 'Appel vidéo entrant du Pôle Nord — touche pour décrocher.' : 'Incoming video call from the North Pole — tap to answer.';
  const url = `${locale === 'fr' ? '' : '/en'}${ringPath(id)}`;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const opts = { body, tag: `santa-${id}`, requireInteraction: true, data: { url }, icon: '/icons/icon-192.png' } as NotificationOptions;
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, opts);
  } catch {
    /* notifications refused or unsupported */
  }
}
