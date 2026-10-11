'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import type { DodoStory } from '@/data/dodo/types';
import { VALUE_LABEL } from '@/data/dodo/types';
import { tr, type L } from '@/lib/i18n-text';
import { SLEEP_SOUNDS } from '@/lib/dodo/sound/catalog';
import { sentences, storyMinutes, updateDodo, useDodoSettings, useManifest } from '@/lib/dodo/client';
import { speakSequence } from '@/lib/voice';
import { NightScene } from './NightScene';
import { useNarrator } from './useNarrator';
import { useSleepSound } from './useSleepSound';

const T = {
  listen: { fr: 'Écouter l’histoire', en: 'Listen to the story' },
  minutes: { fr: 'min', en: 'min' },
  told: { fr: 'Racontée par Ziggy', en: 'Told by Ziggy' },
  sounds: { fr: 'Sons du sommeil', en: 'Sleep sounds' },
  timer: { fr: 'Après l’histoire', en: 'After the story' },
  timerOff: { fr: 'S’arrête avec l’histoire', en: 'Stops with the story' },
  text: { fr: 'Texte', en: 'Text' },
  pause: { fr: 'Pause', en: 'Pause' },
  play: { fr: 'Lecture', en: 'Play' },
  prev: { fr: 'Scène précédente', en: 'Previous scene' },
  next: { fr: 'Scène suivante', en: 'Next scene' },
  close: { fr: 'Retour aux histoires', en: 'Back to the stories' },
  breathe: { fr: 'On respire ensemble, comme un ballon…', en: 'Let’s breathe together, like a balloon…' },
  inhale: { fr: 'Inspire…', en: 'Breathe in…' },
  exhale: { fr: 'Souffle…', en: 'Breathe out…' },
  night: { fr: 'Bonne nuit', en: 'Good night' },
  again: { fr: 'Réécouter', en: 'Listen again' },
  headphones: { fr: 'avec un casque', en: 'with headphones' },
  volume: { fr: 'Volume', en: 'Volume' },
  moral: { fr: 'La petite leçon de Ziggy', en: 'Ziggy’s little lesson' },
} satisfies Record<string, L>;

type Phase = 'cover' | 'story' | 'breathe' | 'sleep';

export function DodoPlayer({ story }: { story: DodoStory }) {
  const raw = useLocale();
  const locale: 'fr' | 'en' = raw === 'fr' ? 'fr' : 'en';
  const settings = useDodoSettings();
  const manifest = useManifest();
  const bed = useSleepSound();
  const [phase, setPhase] = useState<Phase>('cover');
  const [showControls, setShowControls] = useState(true);
  const idle = useRef<number | null>(null);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);
  const narrator = useNarrator(story, locale, manifest, bed.duck);
  const minutes = storyMinutes(story, locale);

  const imageOf = (i: number) => manifest?.images[story.id]?.[i + 1] ?? null;

  // Controls fade away while listening; any touch brings them back.
  const poke = useCallback(() => {
    setShowControls(true);
    if (idle.current) window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => setShowControls(false), 4500);
  }, []);
  useEffect(() => () => void (idle.current && window.clearTimeout(idle.current)), []);

  const begin = async () => {
    bed.play(settings.sound, settings.volume, minutes + settings.timer + 3);
    try {
      wake.current = (await (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen')) ?? null;
    } catch {
      wake.current = null;
    }
    setPhase('story');
    narrator.start();
    poke();
    updateDodo({ heard: [...new Set([...settings.heard, story.id])] });
  };

  // Story over → breathing → sleep screen; the sleep sounds keep going for the timer.
  useEffect(() => {
    if (narrator.status !== 'done' || phase !== 'story') return;
    setPhase('breathe');
    void speakSequence('dodo-breathe', [tr(T.breathe, locale)], locale, undefined, 'bedtime');
    const t = window.setTimeout(() => {
      setPhase('sleep');
      bed.sleepIn(settings.timer);
      void wake.current?.release().catch(() => undefined);
      wake.current = null;
    }, 30_000);
    return () => window.clearTimeout(t);
  }, [narrator.status, phase, bed, settings.timer, locale]);

  useEffect(
    () => () => {
      void wake.current?.release().catch(() => undefined);
    },
    []
  );

  const sceneIndex = Math.min(narrator.scene, story.scenes.length - 1);
  const isOutro = narrator.scene >= story.scenes.length;
  const text = narrator.textOf(narrator.scene);
  const parts = sentences(text);
  // The screen dims slowly as the story goes on.
  const dim = phase === 'sleep' ? 0.92 : phase === 'breathe' ? 0.55 : phase === 'story' ? Math.min(0.4, (narrator.scene / story.scenes.length) * 0.4) : 0;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-[#070a1f] text-white" onPointerMove={phase === 'story' ? poke : undefined} onPointerDown={phase === 'story' ? poke : undefined}>
      {/* Picture: the pre-generated illustration with a slow Ken Burns drift, else the animated night scene */}
      <AnimatePresence mode="sync">
        <motion.div key={`${phase === 'cover' ? 'cover' : sceneIndex}`} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.8 }}>
          {phase === 'cover' && story.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={story.cover} alt="" className="h-full w-full object-cover" />
          ) : imageOf(phase === 'cover' ? 0 : sceneIndex) ? (
            <motion.img
              src={imageOf(phase === 'cover' ? 0 : sceneIndex)!}
              alt=""
              className="h-full w-full object-cover"
              initial={{ scale: 1.04, x: sceneIndex % 2 ? '1.5%' : '-1.5%' }}
              animate={{ scale: 1.14, x: sceneIndex % 2 ? '-1.5%' : '1.5%' }}
              transition={{ duration: 50, ease: 'linear' }}
            />
          ) : (
            <NightScene art={story.scenes[phase === 'cover' ? 0 : sceneIndex].art} seed={sceneIndex + story.id.length * 7} />
          )}
        </motion.div>
      </AnimatePresence>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/40" />
      <motion.div className="pointer-events-none absolute inset-0 bg-black" animate={{ opacity: dim }} transition={{ duration: 6 }} />

      {/* Cover */}
      <AnimatePresence>
        {phase === 'cover' ? (
          <motion.section key="cover" exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-end gap-5 p-6 pb-10 text-center sm:justify-center">
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold backdrop-blur">
              {story.emoji} {tr(VALUE_LABEL[story.value], locale)} · {minutes} {tr(T.minutes, locale)} · {tr(T.told, locale)}
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="max-w-3xl font-display text-4xl font-bold drop-shadow-[0_4px_24px_rgba(0,0,0,.6)] sm:text-6xl">
              {tr(story.title, locale)}
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="max-w-xl text-lg text-white/85">
              {tr(story.teaser, locale)}
            </motion.p>
            <SoundPicker locale={locale} value={settings.sound} onChange={(sound) => updateDodo({ sound })} />
            <TimerPicker locale={locale} value={settings.timer} onChange={(timer) => updateDodo({ timer })} />
            <motion.button
              type="button"
              onClick={() => void begin()}
              whileTap={{ scale: 0.96 }}
              animate={{ boxShadow: ['0 0 0 0 rgba(255,214,140,.45)', '0 0 0 18px rgba(255,214,140,0)'] }}
              transition={{ duration: 2.2, repeat: Infinity }}
              className="mt-2 flex items-center gap-3 rounded-full bg-gradient-to-r from-amber-300 to-pink-300 px-9 py-4 text-xl font-bold text-[#2a1650] focus-visible:outline focus-visible:outline-4 focus-visible:outline-white/70"
            >
              <span aria-hidden="true">🌙</span> {tr(T.listen, locale)}
            </motion.button>
            <Link href="/dodo" className="text-sm font-semibold text-white/70 underline">
              {tr(T.close, locale)}
            </Link>
          </motion.section>
        ) : null}
      </AnimatePresence>

      {/* Subtitles */}
      {phase === 'story' && settings.showText ? (
        <div className="absolute inset-x-0 bottom-28 flex justify-center px-4 sm:bottom-32">
          <AnimatePresence mode="wait">
            <motion.div
              key={narrator.scene}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-3xl rounded-3xl bg-black/35 px-5 py-4 text-lg leading-relaxed backdrop-blur-md sm:text-2xl"
              aria-live="polite"
            >
              {isOutro ? <p className="mb-1 text-sm font-bold uppercase tracking-widest text-amber-200/80">{tr(T.moral, locale)}</p> : null}
              {parts.map((p, i) => (
                <span key={i} className={`transition-colors duration-700 ${i === narrator.sentence ? 'text-white' : 'text-white/45'}`}>
                  {p}{' '}
                </span>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      ) : null}

      {/* Scene progress */}
      {phase === 'story' ? (
        <div className="absolute inset-x-0 top-5 flex justify-center gap-2" aria-hidden="true">
          {[...story.scenes, null].map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all duration-700 ${i === narrator.scene ? 'w-8 bg-amber-200' : i < narrator.scene ? 'w-3 bg-white/70' : 'w-3 bg-white/25'}`} />
          ))}
        </div>
      ) : null}

      {/* Controls */}
      <AnimatePresence>
        {phase === 'story' && showControls ? (
          <motion.nav
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="absolute inset-x-0 bottom-5 flex flex-wrap items-center justify-center gap-2 px-3"
            aria-label={tr(T.told, locale)}
          >
            <Ctl label={tr(T.close, locale)} onClick={() => (window.location.href = window.location.pathname.replace(/\/[^/]+$/, ''))}>
              ✕
            </Ctl>
            <Ctl label={tr(T.prev, locale)} onClick={() => narrator.go(narrator.scene - 1)}>
              ⏮
            </Ctl>
            <Ctl big label={narrator.status === 'paused' ? tr(T.play, locale) : tr(T.pause, locale)} onClick={() => (narrator.status === 'paused' ? narrator.resume() : narrator.pause())}>
              {narrator.status === 'paused' ? '▶' : '❚❚'}
            </Ctl>
            <Ctl label={tr(T.next, locale)} onClick={() => narrator.go(narrator.scene + 1)}>
              ⏭
            </Ctl>
            <Ctl label={tr(T.text, locale)} pressed={settings.showText} onClick={() => updateDodo({ showText: !settings.showText })}>
              Aa
            </Ctl>
            <label className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur">
              <span aria-hidden="true">🔉</span>
              <span className="sr-only">{tr(T.volume, locale)}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  updateDodo({ volume: v });
                  bed.setVolume(v);
                }}
                className="w-24 accent-amber-200"
              />
            </label>
          </motion.nav>
        ) : null}
      </AnimatePresence>

      {/* Breathing like a balloon */}
      <AnimatePresence>
        {phase === 'breathe' ? (
          <motion.section key="breathe" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 2 }} className="absolute inset-0 flex flex-col items-center justify-center gap-8 p-6 text-center">
            <p className="max-w-md text-xl text-white/85">{tr(T.breathe, locale)}</p>
            <Balloon locale={locale} />
          </motion.section>
        ) : null}
      </AnimatePresence>

      {/* Good night */}
      <AnimatePresence>
        {phase === 'sleep' ? (
          <motion.section key="sleep" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 4 }} className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-center">
            <motion.div className="text-7xl" animate={{ y: [0, -6, 0], opacity: [0.7, 1, 0.7] }} transition={{ duration: 6, repeat: Infinity }} aria-hidden="true">
              🌙
            </motion.div>
            <p className="font-display text-3xl text-white/70">{tr(T.night, locale)}</p>
            <p className="max-w-md px-6 text-white/45">{tr(story.moral, locale)}</p>
            <div className="mt-6 flex gap-3 opacity-60 transition hover:opacity-100">
              <button type="button" onClick={() => location.reload()} className="rounded-full bg-white/10 px-5 py-2 text-sm">
                ↻ {tr(T.again, locale)}
              </button>
              <Link href="/dodo" className="rounded-full bg-white/10 px-5 py-2 text-sm">
                📚 {tr(T.close, locale)}
              </Link>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Ctl({ children, label, onClick, big, pressed }: { children: React.ReactNode; label: string; onClick: () => void; big?: boolean; pressed?: boolean }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`grid place-items-center rounded-full font-bold backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${big ? 'h-16 w-16 bg-white/90 text-2xl text-[#1b1440]' : `h-12 w-12 text-lg ${pressed === false ? 'bg-white/5 text-white/50' : 'bg-white/15'}`}`}
    >
      {children}
    </motion.button>
  );
}

function SoundPicker({ locale, value, onChange }: { locale: string; value: string; onChange: (id: string) => void }) {
  return (
    <div className="w-full max-w-2xl">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/60">{tr(T.sounds, locale)}</p>
      <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label={tr(T.sounds, locale)}>
        {SLEEP_SOUNDS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={value === s.id}
            title={tr(s.about, locale)}
            onClick={() => onChange(s.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold backdrop-blur transition ${value === s.id ? 'bg-amber-200 text-[#2a1650]' : 'bg-white/10 text-white/85 hover:bg-white/20'}`}
          >
            {s.emoji} {tr(s.name, locale)}
            {s.headphones ? <span className="ms-1 text-xs opacity-70">🎧</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

const TIMERS = [0, 10, 20, 30, 45] as const;
function TimerPicker({ locale, value, onChange }: { locale: string; value: number; onChange: (v: (typeof TIMERS)[number]) => void }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/60">⏱ {tr(T.timer, locale)}</p>
      <div className="flex flex-wrap justify-center gap-2" role="radiogroup">
        {TIMERS.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={value === t}
            onClick={() => onChange(t)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold backdrop-blur ${value === t ? 'bg-white text-[#2a1650]' : 'bg-white/10 text-white/80'}`}
          >
            {t === 0 ? tr(T.timerOff, locale) : `+${t} min`}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A balloon that fills in 4 s and empties in 6 s, three times. */
function Balloon({ locale }: { locale: string }) {
  const [inhale, setInhale] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setInhale((x) => !x), inhale ? 4000 : 6000);
    return () => window.clearTimeout(t);
  }, [inhale]);
  return (
    <div className="flex flex-col items-center gap-6">
      <motion.div
        className="rounded-full bg-gradient-to-br from-pink-200/80 to-amber-200/70 shadow-[0_0_80px_rgba(255,200,170,.35)]"
        animate={{ width: inhale ? 220 : 90, height: inhale ? 220 : 90 }}
        transition={{ duration: inhale ? 4 : 6, ease: 'easeInOut' }}
      />
      <p className="text-2xl font-semibold text-white/80" aria-live="polite">
        {tr(inhale ? T.inhale : T.exhale, locale)}
      </p>
    </div>
  );
}
