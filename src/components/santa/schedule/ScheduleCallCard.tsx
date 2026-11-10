'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale } from 'next-intl';
import { tr, type L } from '@/lib/i18n-text';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { useSantaFamily } from '@/lib/santa/store';
import { useSantaPass } from '@/lib/santa/pass-client';
import { buildCall, callClips, seedFromId, type CallKind } from '@/lib/santa/call-script';
import { precacheClips } from '@/lib/santa/precache';
import {
  CHRISTMAS_EVE_CALL_AT,
  msToParisLocal,
  parisLocalToMs,
  pendingCalls,
  ringPath,
  schedulableKinds,
  scheduleStore,
  toIcs,
  validateSchedule,
  type ScheduleError,
  type ScheduledCall,
} from '@/lib/santa/schedule';

const T = {
  title: { fr: 'Programmer l’appel du Père Noël', en: 'Schedule Santa’s call' },
  intro: {
    fr: 'Choisissez le jour et l’heure : le téléphone sonnera en plein écran, comme un vrai appel. L’appel est préparé à l’avance sur cet appareil, il marchera même si le réseau est chargé le soir du 24.',
    en: 'Pick the day and time: the phone rings full screen, like a real call. The call is prepared in advance on this device, so it works even if the network is busy on the 24th.',
  },
  child: { fr: 'Enfant', en: 'Child' },
  call: { fr: 'Appel', en: 'Call' },
  when: { fr: 'Jour et heure (heure de Paris)', en: 'Day and time (Paris time)' },
  eve: { fr: '24 décembre, 18 h 30', en: '24 December, 6:30 pm' },
  add: { fr: 'Programmer', en: 'Schedule' },
  pending: { fr: 'Appels programmés', en: 'Scheduled calls' },
  none: { fr: 'Aucun appel programmé.', en: 'No call scheduled.' },
  ready: { fr: 'Prêt (sur l’appareil)', en: 'Ready (on this device)' },
  preparing: { fr: 'Préparation…', en: 'Preparing…' },
  notReady: { fr: 'Sera préparé à l’ouverture', en: 'Will be prepared when opened' },
  calendar: { fr: 'Ajouter au calendrier', en: 'Add to calendar' },
  remove: { fr: 'Annuler', en: 'Cancel' },
  test: { fr: 'Faire sonner maintenant', en: 'Ring now' },
  notify: { fr: 'Autoriser la sonnerie quand l’appli est en arrière-plan', en: 'Allow the ring when the app is in the background' },
  notifyOn: { fr: 'Notifications autorisées ✓', en: 'Notifications allowed ✓' },
  keepOpen: {
    fr: 'Astuce : laissez une page de l’appli ouverte (ou ajoutez l’appli à l’écran d’accueil) et ajoutez le rappel au calendrier — le rappel ouvre directement l’appel.',
    en: 'Tip: keep a page of the app open (or add it to the home screen) and add the reminder to your calendar — the reminder opens the call directly.',
  },
  freeOnly: { fr: 'Sans pack, seul « Le message du Père Noël » peut être programmé. Le Pack Noël ouvre l’appel de la veille de Noël.', en: 'Without a pack, only “Santa’s message” can be scheduled. The Christmas Pack unlocks the Christmas Eve call.' },
  icsTitle: { fr: 'Le Père Noël appelle {name} 🎅', en: 'Santa is calling {name} 🎅' },
  icsDesc: { fr: 'Ouvrez l’appli du Père Noël de Ziggy : le téléphone va sonner.', en: 'Open Ziggy’s Santa app: the phone is about to ring.' },
} satisfies Record<string, L>;

const KIND_NAMES: Record<CallKind, L> = {
  veille: { fr: '🌙 L’appel de la veille de Noël', en: '🌙 The Christmas Eve call' },
  liste: { fr: '📜 L’appel de ma liste', en: '📜 My wish-list call' },
  nouvelles: { fr: '🦌 Les nouvelles du Pôle Nord', en: '🦌 News from the North Pole' },
  message: { fr: '🎧 Le message du Père Noël', en: '🎧 Santa’s message' },
};

const ERRORS: Record<ScheduleError, L> = {
  past: { fr: 'Choisissez une heure dans le futur.', en: 'Pick a time in the future.' },
  'too-late': { fr: 'Le pass est valable jusqu’au 31 janvier 2027.', en: 'The pass is valid until 31 January 2027.' },
  kind: { fr: 'Cet appel demande le Pack Noël.', en: 'This call needs the Christmas Pack.' },
  full: { fr: 'Six appels au maximum en attente.', en: 'Six calls at most waiting.' },
};

export function useScheduledCalls(): ScheduledCall[] {
  return useSyncExternalStore(scheduleStore.subscribe, scheduleStore.get, scheduleStore.serverSnapshot);
}

const inFlight = new Map<string, Promise<boolean>>();

/**
 * Stores the clips of a scheduled call on the device. One preparation per call
 * at a time: the parents' card and the page watcher used to fetch every clip
 * twice, doubling the load on the voice service.
 */
export function prepareScheduledCall(c: ScheduledCall, locale: 'fr' | 'en', onProgress?: (p: number) => void): Promise<boolean> {
  const running = inFlight.get(c.id);
  if (running) return running;
  const job = prepareOnce(c, locale, onProgress).finally(() => inFlight.delete(c.id));
  inFlight.set(c.id, job);
  return job;
}

async function prepareOnce(c: ScheduledCall, locale: 'fr' | 'en', onProgress?: (p: number) => void): Promise<boolean> {
  const child = (await import('@/lib/santa/store')).santaStore.get().children.find((ch) => ch.id === c.childId);
  if (!child) return false;
  const keys = callClips(buildCall(c.kind, child, { scheduled: true, seed: seedFromId(c.id) }));
  const ok = await precacheClips(keys, locale, onProgress);
  const ready = ok === keys.length;
  scheduleStore.update(c.id, { ready });
  return ready;
}

export function ScheduleCallCard() {
  const locale = useLocale() === 'fr' ? 'fr' : 'en';
  const reduced = useReducedMotion();
  const family = useSantaFamily();
  const pass = useSantaPass();
  const calls = useScheduledCalls();
  const kinds = schedulableKinds(pass.tier);
  const [childId, setChildId] = useState<string>('');
  const [kind, setKind] = useState<CallKind>(kinds[0]);
  const [when, setWhen] = useState(() => msToParisLocal(CHRISTMAS_EVE_CALL_AT));
  const [error, setError] = useState<ScheduleError | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    setPerm(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!kinds.includes(kind)) setKind(kinds[0]);
  }, [kinds, kind]);
  const child = family.children.find((c) => c.id === childId) ?? family.children[0] ?? null;
  const pending = pendingCalls(calls, now);

  const prepare = async (c: ScheduledCall) => {
    setProgress((p) => ({ ...p, [c.id]: 0.01 }));
    await prepareScheduledCall(c, locale, (v) => setProgress((p) => ({ ...p, [c.id]: v })));
    setProgress((p) => {
      const n = { ...p };
      delete n[c.id];
      return n;
    });
  };

  const add = async () => {
    if (!child) return;
    const at = parisLocalToMs(when);
    const err = validateSchedule({ kind, at }, { now: Date.now(), tier: pass.tier, pending: pending.length });
    setError(err);
    if (err) return;
    const c = scheduleStore.add({ childId: child.id, kind, at, ready: false });
    await prepare(c);
  };

  const ics = (c: ScheduledCall) => {
    const name = family.children.find((ch) => ch.id === c.childId)?.name ?? '';
    const url = `${window.location.origin}${locale === 'fr' ? '' : '/en'}${ringPath(c.id)}`;
    const text = toIcs(c, { title: tr(T.icsTitle, locale).replace('{name}', name), description: tr(T.icsDesc, locale), url });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }));
    a.download = 'appel-pere-noel.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  const fmt = (ms: number) => new Date(ms).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  if (!family.children.length) return null;

  return (
    <section id="schedule" aria-labelledby="schedule-title" className="rounded-[2rem] border border-border/60 bg-bg-card p-5 shadow-[0_24px_60px_-40px_rgba(26,26,46,0.35)] sm:p-7">
      <h2 id="schedule-title" className="font-display text-2xl font-bold text-text-body">
        📞 {tr(T.title, locale)}
      </h2>
      <p className="mt-2 text-sm text-text-muted">{tr(T.intro, locale)}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm font-semibold text-text-body">
          {tr(T.child, locale)}
          <select value={child?.id ?? ''} onChange={(e) => setChildId(e.target.value)} className="min-h-12 rounded-2xl border border-border bg-bg px-3">
            {family.children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-text-body">
          {tr(T.call, locale)}
          <select value={kind} onChange={(e) => setKind(e.target.value as CallKind)} className="min-h-12 rounded-2xl border border-border bg-bg px-3">
            {kinds.map((k) => (
              <option key={k} value={k}>
                {tr(KIND_NAMES[k], locale)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-text-body">
          {tr(T.when, locale)}
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="min-h-12 rounded-2xl border border-border bg-bg px-3" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setWhen(msToParisLocal(CHRISTMAS_EVE_CALL_AT))} className="min-h-11 rounded-full bg-[#5f3dc4]/10 px-4 text-sm font-bold text-[#5f3dc4] dark:text-[#b197fc]">
          🌙 {tr(T.eve, locale)}
        </button>
        <motion.button type="button" onClick={add} whileTap={reduced ? undefined : { scale: 0.95 }} className="min-h-12 rounded-2xl bg-gradient-to-r from-[#c92a2a] to-[#f03e3e] px-6 font-bold text-white shadow-[0_5px_0_#8a1c1c]">
          {tr(T.add, locale)}
        </motion.button>
        <span role="status" className="text-sm font-semibold text-[#B91C2E] dark:text-[#FF8A95]">
          {error ? tr(ERRORS[error], locale) : ''}
        </span>
      </div>
      {!pass.tier && !pass.loading ? <p className="mt-2 text-xs text-text-muted">{tr(T.freeOnly, locale)}</p> : null}

      <h3 className="mt-6 font-display text-lg font-bold text-text-body">{tr(T.pending, locale)}</h3>
      <ul className="mt-2 grid gap-2">
        <AnimatePresence initial={false}>
          {pending.length === 0 ? (
            <li className="text-sm text-text-muted">{tr(T.none, locale)}</li>
          ) : (
            pending.map((c) => {
              const name = family.children.find((ch) => ch.id === c.childId)?.name ?? '?';
              const p = progress[c.id];
              return (
                <motion.li
                  key={c.id}
                  layout={!reduced}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-bg px-4 py-3"
                >
                  <span className="flex-1 text-sm">
                    <b>{name}</b> · {tr(KIND_NAMES[c.kind], locale)}
                    <br />
                    <span className="text-text-muted">{fmt(c.at)}</span>
                    <br />
                    <span className={`text-xs font-semibold ${c.ready ? 'text-[#1F7A4D] dark:text-[#6EE7B7]' : 'text-text-muted'}`}>
                      {p !== undefined ? `${tr(T.preparing, locale)} ${Math.round(p * 100)} %` : c.ready ? `✓ ${tr(T.ready, locale)}` : tr(T.notReady, locale)}
                    </span>
                  </span>
                  <button type="button" onClick={() => ics(c)} className="min-h-10 rounded-full bg-border/40 px-3 text-xs font-bold">
                    📅 {tr(T.calendar, locale)}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // One navigation only: the page watcher (ScheduledCallWatcher) now
                      // sees the call as due and opens the ringing screen. A second, full
                      // reload here used to land after the call had rung, so nothing rang.
                      scheduleStore.update(c.id, { at: Date.now() });
                    }}
                    className="min-h-10 rounded-full bg-amber-300/40 px-3 text-xs font-bold"
                  >
                    🔔 {tr(T.test, locale)}
                  </button>
                  <button type="button" onClick={() => scheduleStore.remove(c.id)} className="min-h-10 rounded-full px-3 text-xs font-bold text-[#B91C2E] dark:text-[#FF8A95]">
                    {tr(T.remove, locale)}
                  </button>
                </motion.li>
              );
            })
          )}
        </AnimatePresence>
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {perm === 'default' ? (
          <button
            type="button"
            onClick={async () => setPerm(await Notification.requestPermission())}
            className="min-h-11 rounded-full border-2 border-border px-4 text-sm font-bold text-text-body"
          >
            🔔 {tr(T.notify, locale)}
          </button>
        ) : perm === 'granted' ? (
          <span className="text-sm font-semibold text-[#1F7A4D] dark:text-[#6EE7B7]">{tr(T.notifyOn, locale)}</span>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-text-muted">{tr(T.keepOpen, locale)}</p>
    </section>
  );
}
