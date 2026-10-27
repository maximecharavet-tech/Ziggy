'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import type { DodoStory } from '@/data/dodo/types';
import { VALUE_LABEL } from '@/data/dodo/types';
import { tr, type L } from '@/lib/i18n-text';
import { bcp47 } from '@/lib/voice';
import { SLEEP_SOUNDS } from '@/lib/dodo/sound/catalog';
import { tokenize, type DodoVoiceTiming } from '@/lib/dodo/voice';
import {
  minutesOf,
  moralTokens,
  planSeconds,
  planStory,
  resumable,
  sceneOfSegment,
  sentenceOf,
  sentenceStartTime,
  textLocale,
  timingComplete,
  type DodoPosition,
} from '@/lib/dodo/player';
import { clearPosition, savePosition, savedPosition, TEXT_SIZES, updateDodo, useDodoSettings, useManifest, useTiming } from '@/lib/dodo/client';
import { Ziggy3D } from '@/components/ziggy3d/Ziggy3D';
import { useConductor } from './conductor';
import { Prompter } from './Prompter';
import { PlayerOptions, SoundChips, TimerChips } from './PlayerOptions';
import { DodoSay } from './DodoSay';
import { Moon, NightSky, SceneArt, Sparkles } from './Scenery';
import { useSleepSound } from './useSleepSound';
import css from './dodo.module.css';

const T = {
  listen: { fr: 'Écouter l’histoire', en: 'Listen to the story' },
  resume: { fr: 'Reprendre', en: 'Continue' },
  fromStart: { fr: 'Depuis le début', en: 'From the beginning' },
  minutes: { fr: 'min', en: 'min' },
  told: { fr: 'Racontée par Ziggy', en: 'Told by Ziggy' },
  quiet: { fr: 'Lecture douce', en: 'Quiet reading' },
  noVoice: {
    fr: 'La voix de Ziggy n’est pas encore enregistrée pour cette histoire : le texte avance tout doucement, pour la lire ensemble.',
    en: 'Ziggy’s voice isn’t recorded for this story yet: the text moves along gently, so you can read it together.',
  },
  deviceVoice: { fr: 'Voix de l’appareil', en: 'Device voice' },
  sounds: { fr: 'Sons du sommeil', en: 'Sleep sounds' },
  timer: { fr: 'Après l’histoire', en: 'After the story' },
  pause: { fr: 'Pause', en: 'Pause' },
  play: { fr: 'Lecture', en: 'Play' },
  prev: { fr: 'Scène précédente', en: 'Previous scene' },
  next: { fr: 'Scène suivante', en: 'Next scene' },
  restart: { fr: 'Recommencer l’histoire', en: 'Start the story again' },
  options: { fr: 'Réglages', en: 'Settings' },
  smaller: { fr: 'Texte plus petit', en: 'Smaller text' },
  bigger: { fr: 'Texte plus grand', en: 'Bigger text' },
  close: { fr: 'Retour aux histoires', en: 'Back to the stories' },
  progress: { fr: 'Les scènes de l’histoire', en: 'The story’s scenes' },
  goTitle: { fr: 'Le titre', en: 'The title' },
  goScene: { fr: 'Scène {n}', en: 'Scene {n}' },
  goOutro: { fr: 'La petite leçon', en: 'The little lesson' },
  onceUpon: { fr: 'Il était une fois…', en: 'Once upon a time…' },
  sceneOf: { fr: 'Scène {n} sur {total}', en: 'Scene {n} of {total}' },
  moral: { fr: 'La petite leçon de Ziggy', en: 'Ziggy’s little lesson' },
  prompter: { fr: 'Le texte de l’histoire', en: 'The story text' },
  tapToGo: { fr: 'Touche ▶ pour que Ziggy continue', en: 'Tap ▶ so Ziggy can go on' },
  fin: { fr: 'Fin', en: 'The End' },
  night: { fr: 'Bonne nuit, petit cœur', en: 'Good night, little one' },
  breathe: { fr: 'On respire ensemble, comme un ballon…', en: 'Let’s breathe together, like a balloon…' },
  inhale: { fr: 'Inspire…', en: 'Breathe in…' },
  exhale: { fr: 'Souffle…', en: 'Breathe out…' },
  again: { fr: 'Réécouter', en: 'Listen again' },
  others: { fr: 'Autres histoires', en: 'Other stories' },
  soundsOn: { fr: '{sound} continue encore {n} min, tout doucement.', en: '{sound} goes on for {n} more min, very softly.' },
  soundsOff: { fr: 'Les sons s’éteignent doucement.', en: 'The sounds fade away softly.' },
} satisfies Record<string, L>;

type WakeLock = { release: () => Promise<void> };

/**
 * Mode dodo player: Ziggy reads the story aloud (his recorded voice), the
 * words light up on a teleprompter as he says them, the illustrations drift
 * slowly, then the moral, good night and a calm end screen.
 */
export function DodoPlayer({ story, timing: known }: { story: DodoStory; timing?: DodoVoiceTiming | null }) {
  const raw = useLocale();
  const locale = textLocale(raw);
  const settings = useDodoSettings();
  const manifest = useManifest();
  const reduce = useReducedMotion();
  const bed = useSleepSound();
  const { duck, play: playBed, sleepIn, setVolume } = bed;
  const { timing, ready: timingReady } = useTiming(raw, story.id, known);
  const clips = manifest?.audio[story.id]?.[locale] ?? null;
  const plans = useMemo(() => planStory(story, raw, { timing, clips: timing ? null : clips, fallback: settings.fallback }), [story, raw, timing, clips, settings.fallback]);
  const [c, snap] = useConductor(plans, bcp47(locale));
  const recorded = Boolean(timing);
  const complete = timingComplete(timing, story.scenes.length);
  const total = planSeconds(plans);
  const count = plans.length;

  const [saved, setSaved] = useState<DodoPosition | undefined>(undefined);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [uiShown, setUiShown] = useState(true);
  const [sleepy, setSleepy] = useState(false);
  const idle = useRef<number | null>(null);
  const wake = useRef<WakeLock | null>(null);

  const phase = snap.status === 'cover' ? 'cover' : snap.status === 'done' ? 'fin' : 'story';
  const plan = plans[snap.seg] ?? plans[0];
  const scene = sceneOfSegment(plan.id, story.scenes.length);
  const imageOf = useCallback((i: number) => manifest?.images[story.id]?.[i + 1] ?? null, [manifest, story.id]);
  const imageFor = (seg: number) => {
    const p = plans[seg];
    if (!p) return null;
    return p.id === 'title' ? (story.cover ?? imageOf(0)) : imageOf(sceneOfSegment(p.id, story.scenes.length));
  };
  // undefined while the list of illustrations is loading (the drawn scene must not flash first).
  const image = plan.id === 'title' && story.cover ? story.cover : manifest ? imageFor(snap.seg) : undefined;
  const sceneKey = plan.id === 'title' && story.cover ? 'cover' : `scene-${scene}`;

  useEffect(() => {
    setSaved(savedPosition(story.id));
  }, [story.id]);
  useEffect(() => {
    c.setRate(settings.speed);
  }, [c, settings.speed]);
  // The sleep sounds step back while Ziggy speaks.
  useEffect(() => {
    duck(snap.speaking);
  }, [duck, snap.speaking]);

  // Fetch what comes next: the first recordings while on the cover, the next picture while telling.
  useEffect(() => {
    if (phase === 'cover') {
      c.prefetch(resumable(saved, count) ? saved.seg : 0);
      if (!resumable(saved, count)) c.prefetch(1);
    }
  }, [phase, c, saved, count]);
  useEffect(() => {
    const next = imageFor(snap.seg + 1);
    if (!next) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.seg, manifest]);

  // Controls fade away while Ziggy tells the story; any touch brings them back.
  const poke = useCallback(() => {
    setUiShown(true);
    setSleepy(false);
    if (idle.current) window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => setUiShown(false), 5000);
  }, []);
  useEffect(() => () => void (idle.current && window.clearTimeout(idle.current)), []);
  const uiVisible = uiShown || optionsOpen || snap.status === 'paused' || phase !== 'story';

  const releaseWake = () => {
    void wake.current?.release().catch(() => undefined);
    wake.current = null;
  };
  useEffect(() => () => releaseWake(), []);

  const begin = (fromSaved: boolean) => {
    // Inside the tap: audio may start (and keep going) on every browser.
    const pos = fromSaved && resumable(saved, count) ? saved : null;
    const p = pos ? plans[pos.seg] : null;
    const t = pos && p ? sentenceStartTime(p.words, sentenceOf(tokenize(p.text)), pos.t) : 0;
    c.start(pos?.seg ?? 0, t);
    playBed(settings.sound, settings.volume, minutesOf(total) + settings.timer + 3);
    poke();
    void (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLock> } }).wakeLock
      ?.request('screen')
      .then((w) => (wake.current = w))
      .catch(() => undefined);
  };

  // Remember where we are (a calm bedtime is often interrupted).
  useEffect(() => {
    if (snap.status === 'cover' || snap.status === 'done') return;
    const save = () => {
      const s = c.get();
      if (s.status === 'gap') {
        const seg = s.word === -1 ? s.seg : s.seg + 1;
        if (seg >= count) clearPosition(story.id);
        else savePosition(story.id, seg, 0);
      } else savePosition(story.id, s.seg, c.time());
    };
    save();
    if (snap.status !== 'playing') return;
    const id = window.setInterval(save, 5000);
    return () => window.clearInterval(id);
  }, [snap.status, snap.seg, c, count, story.id]);

  // The end: the sleep sounds keep going for the timer, the screen goes to sleep.
  useEffect(() => {
    if (snap.status !== 'done') return;
    clearPosition(story.id);
    setSaved(undefined);
    sleepIn(settings.timer);
    releaseWake();
    if (!settings.heard.includes(story.id)) updateDodo({ heard: [...settings.heard, story.id] });
    const t = window.setTimeout(() => setSleepy(true), 25_000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.status]);

  // Keyboard: space = play/pause, arrows = scenes, Escape closes the settings.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, select, textarea, [contenteditable="true"]')) return;
      if (e.key === 'Escape' && optionsOpen) {
        setOptionsOpen(false);
        return;
      }
      if (optionsOpen) return;
      if (e.key === ' ' || e.code === 'Space') {
        if (el?.closest('button, a, [role="radio"]')) return;
        e.preventDefault();
        if (phase === 'cover') begin(true);
        else if (phase === 'story') c.toggle();
        poke();
      } else if (phase === 'story' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        c.go(c.get().seg + (e.key === 'ArrowRight' ? 1 : -1));
        poke();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const progress = count > 1 ? snap.seg / (count - 1) : 0;
  // The picture dims slowly as the story goes on; the end screen dims further after a while.
  const dim = phase === 'story' ? 0.06 + progress * 0.32 : 0;
  const k = TEXT_SIZES[settings.textSize] ?? 1;
  const variant = plan.id === 'title' ? 'title' : plan.id === 'outro' ? 'outro' : 'scene';
  const caption =
    plan.id === 'title'
      ? `✨ ${tr(T.onceUpon, locale)}`
      : plan.id === 'outro'
        ? `⭐ ${tr(T.moral, locale)}`
        : `🌙 ${tr(T.sceneOf, locale).replace('{n}', String(scene + 1)).replace('{total}', String(story.scenes.length))}`;
  const titleClip = plans[0].kind === 'voice' ? plans[0].url : null;
  const sound = SLEEP_SOUNDS.find((s) => s.id === settings.sound);
  const ziggyMode = phase === 'fin' ? 'fin' : phase === 'story' && !settings.showText ? 'solo' : 'panel';

  return (
    <div
      className={`${css.player} fixed inset-0 z-[60] overflow-hidden bg-[#060818] text-white`}
      onPointerDown={phase !== 'cover' ? poke : undefined}
      onPointerMove={phase === 'story' ? (e) => e.pointerType === 'mouse' && poke() : undefined}
      onFocusCapture={phase === 'story' ? poke : undefined}
    >
      {/* The picture */}
      <div className={css.stage} data-split={phase !== 'fin' && (phase === 'cover' || settings.showText) ? '1' : '0'}>
        <SceneArt id={sceneKey} src={image} art={story.scenes[scene].art} seed={scene + story.id.length} />
        <Sparkles seed={story.id.length * 31 + scene} count={reduce ? 6 : 14} />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,8,24,0.55)_0%,rgba(6,8,24,0)_22%,rgba(6,8,24,0)_55%,rgba(6,8,24,0.75)_100%)] portrait:bg-[linear-gradient(180deg,rgba(6,8,24,0.55)_0%,rgba(6,8,24,0)_25%,rgba(6,8,24,0)_70%,rgba(10,13,43,0.9)_100%)]" />
        <motion.div className="pointer-events-none absolute inset-0 bg-[#03040f]" initial={false} animate={{ opacity: dim }} transition={{ duration: 6 }} />
      </div>

      {/* Top bar: back, the scenes, settings */}
      <motion.header
        className="absolute inset-x-0 top-0 z-40 flex items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
        initial={false}
        animate={{ opacity: uiVisible ? 1 : 0 }}
        transition={{ duration: 0.6 }}
        style={{ pointerEvents: uiVisible ? 'auto' : 'none' }}
      >
        <Link
          href="/dodo"
          aria-label={tr(T.close, locale)}
          title={tr(T.close, locale)}
          className="grid h-12 w-12 place-items-center rounded-full bg-[#070a22]/60 text-lg ring-1 ring-white/15 transition hover:bg-[#070a22]/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200"
        >
          ✕
        </Link>
        {phase === 'story' ? (
          <nav aria-label={tr(T.progress, locale)} className="flex items-center rounded-full bg-[#070a22]/55 px-1.5 py-1 ring-1 ring-white/10">
            {plans.map((p, i) => {
              const label = p.id === 'title' ? tr(T.goTitle, locale) : p.id === 'outro' ? tr(T.goOutro, locale) : tr(T.goScene, locale).replace('{n}', p.id.slice(1));
              const here = i === snap.seg;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => c.go(i)}
                  aria-label={label}
                  aria-current={here ? 'step' : undefined}
                  title={label}
                  className="grid h-9 min-w-7 place-items-center rounded-full px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200"
                >
                  {p.id === 'outro' ? (
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-full text-sm transition duration-700 ${here ? 'bg-amber-200/25 opacity-100 shadow-[0_0_14px_rgba(253,230,138,.55)]' : i < snap.seg ? 'opacity-80' : 'opacity-40'}`}
                      aria-hidden="true"
                    >
                      🌙
                    </span>
                  ) : (
                    <span
                      aria-hidden="true"
                      className={`block h-2 rounded-full transition-all duration-700 ${here ? 'w-7 bg-amber-200 shadow-[0_0_10px_rgba(253,230,138,.7)]' : i < snap.seg ? 'w-2 bg-white/75' : 'w-2 bg-white/25'} ${p.id === 'title' && !here ? 'w-1.5' : ''}`}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => setOptionsOpen(true)}
          aria-label={tr(T.options, locale)}
          title={tr(T.options, locale)}
          aria-haspopup="dialog"
          className="grid h-12 w-12 place-items-center rounded-full bg-[#070a22]/60 text-lg ring-1 ring-white/15 transition hover:bg-[#070a22]/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200"
        >
          ⚙️
        </button>
      </motion.header>

      {/* Ziggy, the narrator */}
      <motion.div layout={!reduce} transition={{ duration: 1.2, ease: 'easeInOut' }} className={css.ziggy} data-mode={ziggyMode}>
        <Ziggy3D
          className="h-40 w-32 lg:landscape:h-52 lg:landscape:w-40 [@media(orientation:landscape)_and_(max-height:520px)]:h-28 [@media(orientation:landscape)_and_(max-height:520px)]:w-24"
          idle={phase === 'fin' ? 'sleep' : 'calm'}
          mood={phase === 'fin' ? 'sleepy' : 'calm'}
          accessory="nightcap"
          talking={snap.speaking}
          framing="bust"
          fallback="heart"
        />
      </motion.div>

      {/* Cover: title, sleep sounds, start */}
      <AnimatePresence>
        {phase === 'cover' ? (
          <motion.section key="cover" className={css.coverCard} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.6 }}>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <Pill>
                {story.emoji} {tr(VALUE_LABEL[story.value], locale)}
              </Pill>
              <Pill>
                ⏱ {minutesOf(total)} {tr(T.minutes, locale)}
              </Pill>
              {timingReady ? <Pill>{recorded ? `🎙️ ${tr(T.told, locale)}` : `📖 ${tr(T.quiet, locale)}`}</Pill> : null}
            </div>
            <div className="mt-3 flex items-start gap-3">
              <h1 className="font-display text-[clamp(1.75rem,1.2rem+2.4vw,3rem)] font-bold leading-tight text-[#fff8ea] [text-wrap:balance]">{tr(story.title, locale)}</h1>
              <DodoSay texts={[tr(story.title, locale), tr(story.teaser, locale)]} clip={titleClip} locale={raw} size="sm" className="mt-1" />
            </div>
            <p className="mt-2 max-w-xl text-base text-white/75 sm:text-lg">{tr(story.teaser, locale)}</p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {resumable(saved, count) ? (
                <>
                  <BigButton onClick={() => begin(true)}>
                    ▶ {tr(T.resume, locale)} ·{' '}
                    {plans[saved.seg]?.id === 'outro' ? tr(T.goOutro, locale) : plans[saved.seg]?.id === 'title' ? tr(T.goTitle, locale) : tr(T.goScene, locale).replace('{n}', String(saved.seg))}
                  </BigButton>
                  <button
                    type="button"
                    onClick={() => begin(false)}
                    className="min-h-12 rounded-full bg-white/10 px-5 py-3 font-bold ring-1 ring-white/15 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200"
                  >
                    ↺ {tr(T.fromStart, locale)}
                  </button>
                </>
              ) : (
                <BigButton onClick={() => begin(false)}>🌙 {tr(T.listen, locale)}</BigButton>
              )}
            </div>

            {timingReady && !recorded ? (
              <div className="mt-4 rounded-2xl bg-white/[0.06] p-3 text-sm text-white/75 ring-1 ring-white/10">
                <p>📖 {tr(T.noVoice, locale)}</p>
                <label className="mt-2 inline-flex min-h-10 cursor-pointer items-center gap-2 font-semibold text-white/90">
                  <input type="checkbox" className="h-5 w-5 accent-amber-200" checked={settings.fallback === 'device'} onChange={(e) => updateDodo({ fallback: e.target.checked ? 'device' : 'read' })} />
                  🗣️ {tr(T.deviceVoice, locale)}
                </label>
              </div>
            ) : null}

            <div className="mt-5 grid gap-4">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-white/55">{tr(T.sounds, locale)}</p>
                <SoundChips locale={locale} value={settings.sound} onChange={(sound) => updateDodo({ sound })} />
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-white/55">⏱ {tr(T.timer, locale)}</p>
                <TimerChips locale={locale} value={settings.timer} onChange={(timer) => updateDodo({ timer })} />
              </div>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      {/* The teleprompter */}
      <AnimatePresence>
        {phase === 'story' && settings.showText ? (
          <motion.section
            key="panel"
            className={css.panel}
            style={{ '--k': k } as CSSProperties}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            aria-label={tr(story.title, locale)}
          >
            <div className="flex min-h-9 items-center gap-2">
              <p className="truncate text-xs font-bold uppercase tracking-[0.16em] text-amber-100/70">{caption}</p>
              <motion.div className="ms-auto flex gap-1.5" initial={false} animate={{ opacity: uiVisible ? 1 : 0 }} style={{ pointerEvents: uiVisible ? 'auto' : 'none' }}>
                <SizeButton label={tr(T.smaller, locale)} disabled={settings.textSize <= 0} onClick={() => updateDodo({ textSize: settings.textSize - 1 })}>
                  A−
                </SizeButton>
                <SizeButton label={tr(T.bigger, locale)} disabled={settings.textSize >= TEXT_SIZES.length - 1} onClick={() => updateDodo({ textSize: settings.textSize + 1 })}>
                  A+
                </SizeButton>
              </motion.div>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={plan.id}
                className="flex min-h-0 flex-1 flex-col"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Prompter
                  text={plan.text}
                  word={snap.word}
                  mode={settings.highlight}
                  variant={variant}
                  moralCount={variant === 'outro' && plan.text.trim().startsWith(story.moral[locale].trim()) ? moralTokens(story, locale) : 0}
                  label={tr(T.prompter, locale)}
                />
              </motion.div>
            </AnimatePresence>
            {/* Screen readers: the sentence, only when no voice reads it already. */}
            {snap.kind === 'read' ? <LiveSentence text={plan.text} word={snap.word} /> : null}
          </motion.section>
        ) : null}
      </AnimatePresence>

      {/* Controls */}
      <AnimatePresence>
        {phase === 'story' ? (
          <motion.nav
            key="dock"
            className={`${css.dock} flex items-center justify-center gap-2 px-3 sm:gap-3`}
            aria-label={tr(T.told, locale)}
            initial={{ opacity: 0 }}
            animate={{ opacity: uiVisible ? 1 : 0.0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            style={{ pointerEvents: uiVisible ? 'auto' : 'none' }}
          >
            <Ctl label={tr(T.restart, locale)} onClick={() => c.go(0)}>
              ↺
            </Ctl>
            <Ctl label={tr(T.prev, locale)} onClick={() => c.go(snap.seg - 1)} disabled={snap.seg <= 0}>
              ⏮
            </Ctl>
            <Ctl big label={snap.status === 'paused' ? tr(T.play, locale) : tr(T.pause, locale)} onClick={() => c.toggle()}>
              {snap.status === 'paused' ? <span className="ms-1">▶</span> : '❚❚'}
            </Ctl>
            <Ctl label={tr(T.next, locale)} onClick={() => c.go(snap.seg + 1)} disabled={snap.seg >= count - 1}>
              ⏭
            </Ctl>
            <Ctl label={tr(T.options, locale)} onClick={() => setOptionsOpen(true)}>
              Aa
            </Ctl>
          </motion.nav>
        ) : null}
      </AnimatePresence>

      {/* Autoplay refused (rare): one tap and Ziggy goes on. */}
      <AnimatePresence>
        {phase === 'story' && snap.blocked ? (
          <motion.button
            key="blocked"
            type="button"
            onClick={() => c.resume()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute left-1/2 top-[18%] z-50 -translate-x-1/2 rounded-full bg-amber-200 px-6 py-3 font-bold text-[#24164a] shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            {tr(T.tapToGo, locale)}
          </motion.button>
        ) : null}
      </AnimatePresence>

      {/* The end: good night */}
      <AnimatePresence>
        {phase === 'fin' ? (
          <motion.section
            key="fin"
            className="absolute inset-0 z-30 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.5 }}
          >
            <NightSky seed={story.id.length * 11} moon={false} />
            <div className="relative flex min-h-full flex-col items-center justify-center gap-3 px-6 pb-8 pt-48 text-center sm:gap-4 landscape:pt-44 lg:landscape:pt-52 [@media(orientation:landscape)_and_(max-height:520px)]:pt-32">
              <Moon size="3.5rem" className="absolute left-[12%] top-[10%] opacity-90" />
              <h2 className="font-display text-6xl font-bold text-[#ffe6b0] drop-shadow-[0_0_24px_rgba(255,214,140,.35)] sm:text-7xl">{tr(T.fin, locale)}</h2>
              <p className="font-display text-2xl text-white/80">{tr(T.night, locale)} 🌙</p>
              <p className="max-w-md rounded-2xl bg-white/[0.06] px-5 py-3 text-white/70 ring-1 ring-amber-100/15">⭐ {tr(story.moral, locale)}</p>
              <Balloon locale={locale} />
              <p className="text-sm text-white/45">
                {settings.timer > 0 && sound && sound.id !== 'silence'
                  ? `${sound.emoji} ${tr(T.soundsOn, locale).replace('{sound}', tr(sound.name, locale)).replace('{n}', String(settings.timer))}`
                  : tr(T.soundsOff, locale)}
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-3 opacity-70 transition hover:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => {
                    setSleepy(false);
                    c.start(0);
                    playBed(settings.sound, settings.volume, minutesOf(total) + settings.timer + 3);
                  }}
                  className="min-h-11 rounded-full bg-white/10 px-5 py-2 text-sm font-semibold ring-1 ring-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200"
                >
                  ↺ {tr(T.again, locale)}
                </button>
                <Link href="/dodo" className="min-h-11 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold ring-1 ring-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200">
                  📚 {tr(T.others, locale)}
                </Link>
              </div>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      {/* Sleepy screen: almost black after a while; a touch wakes it up. */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-[45] bg-black"
        initial={false}
        animate={{ opacity: phase === 'fin' && sleepy ? 0.82 : 0 }}
        transition={{ duration: sleepy ? 12 : 0.8 }}
      />

      <AnimatePresence>
        {optionsOpen ? (
          <PlayerOptions
            key="options"
            locale={locale}
            settings={settings}
            recorded={complete || recorded}
            onClose={() => setOptionsOpen(false)}
            onSound={(sound) => {
              updateDodo({ sound });
              if (phase === 'story') playBed(sound, settings.volume, minutesOf(total * (1 - progress)) + settings.timer + 3);
            }}
            onVolume={(v) => {
              updateDodo({ volume: v });
              setVolume(v);
            }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-white/10 px-3 py-1.5 text-white/85 ring-1 ring-white/10">{children}</span>;
}

function BigButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      className="relative min-h-14 rounded-full bg-gradient-to-r from-amber-200 via-amber-100 to-pink-200 px-8 py-4 text-lg font-bold text-[#24164a] shadow-[0_10px_30px_rgba(255,200,140,.25)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white/70"
    >
      {children}
    </motion.button>
  );
}

function SizeButton({ children, label, onClick, disabled }: { children: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-10 min-w-10 place-items-center rounded-full bg-white/[0.08] px-2 font-display text-sm font-bold text-white/80 ring-1 ring-white/10 transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Ctl({ children, label, onClick, big, disabled }: { children: ReactNode; label: string; onClick: () => void; big?: boolean; disabled?: boolean }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid place-items-center rounded-full font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:opacity-30 ${
        big
          ? 'h-16 w-16 bg-[#fff4dc] text-2xl text-[#1b1440] shadow-[0_8px_30px_rgba(255,220,160,.25)]'
          : 'h-12 w-12 bg-[#0b0e2c]/70 text-lg text-white/90 ring-1 ring-white/15 hover:bg-[#151a45]/80'
      }`}
    >
      {children}
    </motion.button>
  );
}

/** The current sentence for screen readers, said once per sentence (silent reading only). */
function LiveSentence({ text, word }: { text: string; word: number }) {
  const tokens = useMemo(() => tokenize(text), [text]);
  const of = useMemo(() => sentenceOf(tokens), [tokens]);
  const s = word >= 0 ? of[Math.min(word, of.length - 1)] : -1;
  const sentence = s >= 0 ? tokens.filter((_, i) => of[i] === s).join(' ') : '';
  return (
    <p className="sr-only" aria-live="polite">
      {sentence}
    </p>
  );
}

/** A balloon that fills in 4 s and empties in 6 s, three times, then rests. */
function Balloon({ locale }: { locale: string }) {
  const [breath, setBreath] = useState(0);
  const inhale = breath % 2 === 0;
  useEffect(() => {
    if (breath >= 6) return;
    const t = window.setTimeout(() => setBreath((b) => b + 1), inhale ? 4000 : 6000);
    return () => window.clearTimeout(t);
  }, [breath, inhale]);
  if (breath >= 6) return <div className="h-8" aria-hidden="true" />;
  return (
    <div className="my-1 flex flex-col items-center gap-2">
      <p className="text-white/70">{tr(T.breathe, locale)}</p>
      <div className="grid h-28 w-28 place-items-center">
        <motion.div
          className="h-28 w-28 rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffe4f0_0%,#ffc3dc_45%,#f7b98a_100%)] shadow-[0_0_60px_rgba(255,190,170,.35)]"
          initial={{ scale: 0.45 }}
          animate={{ scale: inhale ? 1 : 0.45 }}
          transition={{ duration: inhale ? 4 : 6, ease: 'easeInOut' }}
        />
      </div>
      <p className="text-xl font-semibold text-white/80" aria-live="polite">
        {tr(inhale ? T.inhale : T.exhale, locale)}
      </p>
    </div>
  );
}
