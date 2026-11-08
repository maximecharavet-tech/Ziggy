'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { tr, type L } from '@/lib/i18n-text';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { SayButton } from '@/components/arcade/read-aloud';
import bible from '@/data/lutins/bible.json';
import type { JournalEntry } from '@/lib/lutins/journal';
import { cctvCameraLabel, defaultCctvTime, formatCctvTime, hash32, type CctvView } from '@/lib/lutins/cctv';

/**
 * Plays an entry's "caught on camera" clip (`entry.cctv`, made by
 * `makeCctvClip`) inside a pretend security-camera app: dark UI, camera name,
 * a green "online" dot, the night's timestamp and a "motion detected" note
 * that can be read aloud. Without a clip (or on a browser that cannot record)
 * the same camera look is rendered live from the picture by the Rust engine.
 * Everything happens on the device.
 */

const T = {
  app: { fr: 'Surveillance des lutins', en: 'Elf patrol camera' },
  online: { fr: 'En ligne', en: 'Online' },
  last: { fr: 'Cette nuit', en: 'Last night' },
  motion: { fr: 'Mouvement détecté', en: 'Motion detected' },
  caught: { fr: 'La caméra a filmé', en: 'The camera caught' },
  replay: { fr: 'Revoir', en: 'Replay' },
  play: { fr: 'Lecture', en: 'Play' },
  pause: { fr: 'Pause', en: 'Pause' },
  loading: { fr: 'La caméra s’allume…', en: 'The camera is starting…' },
  and: { fr: 'et', en: 'and' },
} satisfies Record<string, L>;

const ELVES = bible.elves as { id: string; name: L }[];

/** "Pépin, Grelotte et Noisette". */
function names(ids: string[], locale: string): string {
  const n = ids.map((id) => ELVES.find((e) => e.id === id)).filter(Boolean).map((e) => tr(e!.name, locale));
  if (n.length <= 1) return n[0] ?? '';
  return `${n.slice(0, -1).join(', ')} ${tr(T.and, locale)} ${n[n.length - 1]}`;
}

function useObjectUrl(blob: Blob | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return setUrl(null);
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

const LIVE_SECONDS = 7;

/** Live camera look on a canvas (no clip yet). */
function LiveCamera({ entry, room, locale, playing, restart, onReady }: { entry: JournalEntry; room: string; locale: string; playing: boolean; restart: number; onReady: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<CctvView | null>(null);
  const playRef = useRef(playing);
  playRef.current = playing;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const t0 = useRef(0);
  const tPaused = useRef(0);

  useEffect(() => {
    let alive = true;
    let raf = 0;
    (async () => {
      const { prepareCctv } = await import('@/lib/lutins/cctv');
      const h = hash32(entry.id);
      const view = await prepareCctv(entry.image, {
        room,
        locale,
        time: defaultCctvTime(entry),
        camera: 1 + (h % 4),
        seed: h,
        spots: entry.spots,
        zoomSeconds: LIVE_SECONDS * 0.8,
      });
      if (!alive) return view.free();
      viewRef.current = view;
      view.canvas.className = 'block h-full w-full object-contain';
      boxRef.current?.replaceChildren(view.canvas);
      view.draw(0);
      readyRef.current();
      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        if (document.hidden) return;
        if (!playRef.current) {
          t0.current = now - tPaused.current * 1000;
          return;
        }
        if (!t0.current) t0.current = now;
        let t = (now - t0.current) / 1000;
        // Hold the last frame a moment, then loop.
        if (t > LIVE_SECONDS + 1.2) {
          t0.current = now;
          t = 0;
        }
        tPaused.current = t;
        view.draw(Math.min(t, LIVE_SECONDS));
      };
      raf = requestAnimationFrame(loop);
    })().catch(() => {
      /* no WebAssembly / canvas: the picture stays */
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      viewRef.current?.free();
      viewRef.current = null;
    };
  }, [entry, room, locale]);

  useEffect(() => {
    t0.current = 0;
    tPaused.current = 0;
    if (!playRef.current) viewRef.current?.draw(0);
  }, [restart]);

  return <div ref={boxRef} className="absolute inset-0" />;
}

export function CctvPlayer({ entry, room, locale, className = '' }: { entry: JournalEntry; room: string; locale: string; className?: string }) {
  const reduced = useReducedMotion();
  const clipUrl = useObjectUrl(entry.cctv);
  const posterUrl = useObjectUrl(entry.image);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Reduced motion: nothing starts by itself.
  const [playing, setPlaying] = useState(!reduced);
  const [restart, setRestart] = useState(0);
  const [liveReady, setLiveReady] = useState(false);
  useEffect(() => setPlaying(!reduced), [reduced]);

  const h = hash32(entry.id);
  const camera = cctvCameraLabel(1 + (h % 4), room);
  const when = useMemo(() => defaultCctvTime(entry), [entry]);
  const who = names(entry.elves, locale);
  const fr = locale === 'fr';
  const motion = who ? `${tr(T.motion, locale)}${fr ? '\u202f:' : ':'} ${who}` : tr(T.motion, locale);
  const sayText = who ? `${tr(T.caught, locale)} ${who}${fr ? '\u202f!' : '!'}` : tr(T.motion, locale);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) void v.play().catch(() => setPlaying(false));
    else v.pause();
  }, [playing, clipUrl]);

  const replay = () => {
    const v = videoRef.current;
    if (v) {
      v.currentTime = 0;
      void v.play().catch(() => undefined);
    }
    setRestart((r) => r + 1);
    setPlaying(true);
  };

  return (
    <section aria-label={`${tr(T.app, locale)} · ${camera}`} className={`w-full max-w-3xl shrink-0 overflow-hidden rounded-[1.75rem] bg-[#0c1014] text-[#d7e3da] shadow-2xl ring-1 ring-white/10 ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#1a2a20] text-[#5cf08a]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7h12l4-3v14l-4-3H3z" />
              <circle cx="9" cy="11" r="2.5" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-white/50">{tr(T.app, locale)}</p>
            <p className="truncate font-mono text-sm font-bold text-white">{camera}</p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2 rounded-full bg-[#11231a] px-3 py-1.5 text-xs font-bold text-[#5cf08a]">
          <span className="relative flex h-2.5 w-2.5">
            {!reduced && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5cf08a] opacity-60" />}
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#5cf08a]" />
          </span>
          {tr(T.online, locale)}
        </span>
      </header>

      <div className="relative aspect-[4/5] max-h-[60vh] w-full bg-black sm:aspect-[4/3]">
        {clipUrl ? (
          <video
            ref={videoRef}
            src={clipUrl}
            poster={posterUrl ?? undefined}
            muted
            loop
            playsInline
            autoPlay={!reduced}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            className="absolute inset-0 block h-full w-full object-contain"
            aria-label={motion}
          />
        ) : (
          <>
            {!liveReady && posterUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posterUrl} alt="" className="absolute inset-0 h-full w-full object-contain opacity-40 grayscale" />
            )}
            <LiveCamera entry={entry} room={room} locale={locale} playing={playing} restart={restart} onReady={() => setLiveReady(true)} />
            {!liveReady && <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-mono text-sm font-bold text-[#5cf08a]">{tr(T.loading, locale)}</p>}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 px-4 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <SayButton texts={[sayText]} locale={locale} size="md" className="shrink-0" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-bold text-[#ffd43b]">
              <span aria-hidden="true">●</span>
              <span className="truncate">{motion}</span>
            </p>
            <p className="font-mono text-xs text-white/55">
              {tr(T.last, locale)} · {formatCctvTime(when, locale)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={tr(playing ? T.pause : T.play, locale)}
            className="grid h-14 w-14 place-items-center rounded-full bg-white/10 text-2xl ring-1 ring-white/15 transition-transform active:scale-95"
          >
            <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
          </button>
          <button type="button" onClick={replay} className="min-h-14 rounded-full bg-[#5cf08a] px-5 font-display text-lg font-bold text-[#08210f] transition-transform active:scale-95">
            ↺ {tr(T.replay, locale)}
          </button>
        </div>
      </div>
    </section>
  );
}
