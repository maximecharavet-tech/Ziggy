'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { tr, type L } from '@/lib/i18n-text';
import { BodyPortal } from '@/components/lutins/BodyPortal';

/** localStorage key: the local calendar day (YYYY-MM-DD) the intro was last dismissed. */
export const LUTINS_INTRO_KEY = 'ziggy:lutins-intro';

const T = {
  label: { fr: 'Introduction des Lutins Farceurs', en: 'The Prankster Elves introduction' },
  skip: { fr: 'Passer', en: 'Skip' },
  soundOn: { fr: '🔊 Son', en: '🔊 Sound' },
  soundOff: { fr: '🔇 Silence', en: '🔇 Mute' },
} satisfies Record<string, L>;

/** Local calendar day as YYYY-MM-DD. */
export function introDayStamp(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Whether to play the video, show the poster for 1s, or skip. */
export function lutinsIntroMode(seenDay: string | null, today: string, reducedMotion: boolean): 'skip' | 'poster' | 'video' {
  if (seenDay === today) return 'skip';
  return reducedMotion ? 'poster' : 'video';
}

type Phase = 'off' | 'video' | 'poster' | 'leaving';

/**
 * A short fullscreen intro played the first time the Lutins Farceurs app is
 * opened each day. The page underneath still server-renders (this overlay
 * mounts only in the browser, via a body portal).
 */
export function LutinsIntro() {
  const locale = useLocale();
  const titleId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const kindRef = useRef<'video' | 'poster'>('video');
  const [phase, setPhase] = useState<Phase>('off');
  const [sound, setSound] = useState(false);

  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = window.localStorage.getItem(LUTINS_INTRO_KEY);
    } catch {
      /* storage blocked */
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mode = lutinsIntroMode(seen, introDayStamp(), reduced);
    if (mode === 'skip') return;
    kindRef.current = mode;
    setPhase(mode);
  }, []);

  const close = useCallback(() => {
    try {
      window.localStorage.setItem(LUTINS_INTRO_KEY, introDayStamp());
    } catch {
      /* storage blocked */
    }
    setPhase((p) => (p === 'off' ? 'off' : 'leaving'));
  }, []);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const t = window.setTimeout(() => setPhase('off'), 400);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'poster') return;
    const t = window.setTimeout(close, 1000);
    return () => window.clearTimeout(t);
  }, [phase, close]);

  useEffect(() => {
    if (phase !== 'video' && phase !== 'poster') return;
    skipRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, close]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || phase === 'poster') return;
    v.muted = !sound;
    if (sound) void v.play().catch(() => {});
  }, [sound, phase]);

  if (phase === 'off') return null;

  const leaving = phase === 'leaving';
  const showPoster = kindRef.current === 'poster';

  return (
    <BodyPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`fixed inset-0 z-[200] flex items-center justify-center bg-[#0f3d2a] transition-opacity duration-500 ${leaving ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      >
        <h2 id={titleId} className="sr-only">
          {tr(T.label, locale)}
        </h2>
        {showPoster ? (
          // eslint-disable-next-line @next/next/no-img-element -- pre-encoded WebP poster
          <img
            src="/lutins/intro/intro-lutins-poster.webp"
            alt=""
            className="h-full w-full object-cover md:h-full md:w-auto md:max-h-full md:object-contain"
          />
        ) : (
          <video
            ref={videoRef}
            className="h-full w-full object-cover md:h-full md:w-auto md:max-h-full md:object-contain"
            autoPlay
            muted={!sound}
            playsInline
            preload="metadata"
            poster="/lutins/intro/intro-lutins-poster.webp"
            onEnded={close}
          >
            <source src="/lutins/intro/intro-lutins.webm" type="video/webm" />
            <source src="/lutins/intro/intro-lutins.mp4" type="video/mp4" />
          </video>
        )}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] sm:p-8">
          {showPoster ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={() => setSound((s) => !s)}
              className="pointer-events-auto inline-flex min-h-14 min-w-14 items-center justify-center rounded-full bg-white/95 px-5 font-display text-lg font-bold text-[#16301f] shadow-[0_4px_0_rgba(0,0,0,0.25)] ring-2 ring-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
              aria-pressed={sound}
              aria-label={sound ? tr(T.soundOff, locale) : tr(T.soundOn, locale)}
            >
              {sound ? tr(T.soundOff, locale) : tr(T.soundOn, locale)}
            </button>
          )}
          <button
            ref={skipRef}
            type="button"
            onClick={close}
            className="pointer-events-auto inline-flex min-h-14 min-w-[8.5rem] items-center justify-center rounded-full bg-amber-300 px-7 font-display text-xl font-bold text-[#3b1f00] shadow-[0_4px_0_#b45309] ring-2 ring-amber-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white"
          >
            {tr(T.skip, locale)}
          </button>
        </div>
      </div>
    </BodyPortal>
  );
}
