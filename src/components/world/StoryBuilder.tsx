'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { GOALS, HEROES, OBJECTS, PLACES, STORY_COMPANIONS, pick, type StoryChoices } from '@/lib/story/choices';
import type { StoryJson } from '@/lib/hyper-engine/schemas';
import { localStory } from '@/lib/story/local-story';
import { accessToken, api } from '@/lib/world/store';
import { speak, stopSpeaking } from '@/lib/voice';
import { tr, type L } from '@/lib/i18n-text';
import { playSound } from '@/lib/sound';
import { SayButton } from '@/components/arcade/read-aloud';
import { getMemory } from '@/lib/world/store';
import { readAloudOn } from '@/lib/world/memory';
import { speakSequence } from '@/lib/voice';
import { Ziggy3D, type ZiggyCue } from '@/components/ziggy3d/Ziggy3D';
import { Burst, Twinkle } from '@/components/create/fx/Burst';
import { FlipBook } from '@/components/create/fx/FlipBook';
import { StudioFrame } from '@/components/create/fx/StudioFrame';
import { alpha, fx, loop, shade, toy } from '@/components/create/fx/toy';

type Key = 'hero' | 'place' | 'companion' | 'object' | 'goal';
type Choice = { id: string; emoji: string; label: L };
const STEPS: { key: Key; title: L; slot: L; color: string; list: Choice[] }[] = [
  { key: 'hero', title: { fr: 'Qui est le héros ?', en: 'Who is the hero?' }, slot: { fr: 'Héros', en: 'Hero' }, color: '#FF7AB8', list: HEROES },
  { key: 'place', title: { fr: 'Où se passe l’aventure ?', en: 'Where does it happen?' }, slot: { fr: 'Lieu', en: 'Place' }, color: '#3FA7F0', list: PLACES },
  { key: 'companion', title: { fr: 'Avec quel ami ?', en: 'With which friend?' }, slot: { fr: 'Ami', en: 'Friend' }, color: '#FF9F43', list: STORY_COMPANIONS },
  { key: 'object', title: { fr: 'Quel objet magique ?', en: 'Which magic object?' }, slot: { fr: 'Objet', en: 'Object' }, color: '#9B6BE8', list: OBJECTS },
  { key: 'goal', title: { fr: 'Quelle est la mission ?', en: 'What is the mission?' }, slot: { fr: 'Mission', en: 'Mission' }, color: '#3FBF6A', list: GOALS },
];
const AGES = ['5-7', '8-10', '11-12'] as const;
const T = {
  eyebrow: { fr: 'L’atelier des histoires', en: 'The story workshop' },
  title: { fr: 'Invente ton histoire magique', en: 'Invent your magic story' },
  subtitle: { fr: 'Choisis un héros, un lieu, un ami, un objet et une mission : Ziggy raconte !', en: 'Pick a hero, a place, a friend, an object and a mission: Ziggy tells the tale!' },
  tell: { fr: 'Raconte-moi l’histoire !', en: 'Tell me the story!' },
  writing: { fr: 'Ziggy écrit ton histoire…', en: 'Ziggy is writing your story…' },
  age: { fr: 'Âge', en: 'Age' },
  read: { fr: 'Lire à voix haute', en: 'Read aloud' },
  stop: { fr: 'Stop', en: 'Stop' },
  prev: { fr: 'Page d’avant', en: 'Previous page' },
  nextP: { fr: 'Page suivante', en: 'Next page' },
  newStory: { fr: 'Nouvelle histoire', en: 'New story' },
  library: { fr: 'Ma bibliothèque', en: 'My library' },
  open: { fr: 'Lire', en: 'Read' },
  del: { fr: 'Supprimer', en: 'Delete' },
  ai: { fr: '✨ Créée par Hyper Engine, vérifiée par ChildShield', en: '✨ Made by Hyper Engine, checked by ChildShield' },
  local: { fr: '📖 Histoire Ziggy', en: '📖 Ziggy story' },
  end: { fr: 'Fin', en: 'The end' },
  saved: { fr: 'Gardée dans ta bibliothèque', en: 'Saved in your library' },
  myBook: { fr: 'Mon livre', en: 'My book' },
  ready: { fr: 'Ton livre est prêt !', en: 'Your book is ready!' },
  steps: { fr: 'Les étapes', en: 'The steps' },
  page: { fr: 'Page', en: 'Page' },
} satisfies Record<string, L>;

type Saved = { id: string; story: StoryJson; source: 'ai' | 'local'; createdAt: string };
type Open = { story: StoryJson; source: 'ai' | 'local'; saved: boolean; cast: string[] };

export function StoryBuilder() {
  const locale = useLocale();
  const reduce = useReducedMotion();
  const [choices, setChoices] = useState<Partial<StoryChoices>>({ ageGroup: '5-7' });
  const [story, setStory] = useState<Open | null>(null);
  const [busy, setBusy] = useState(false);
  const [library, setLibrary] = useState<Saved[] | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [pop, setPop] = useState<{ key: Key; n: number } | null>(null);
  const [cue, setCue] = useState<{ kind: ZiggyCue; id: number } | null>(null);
  const advance = useRef<number | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const loadLibrary = useCallback(async () => {
    if (!(await accessToken())) return setLibrary(null);
    const res = await api<{ stories: Saved[] }>('story');
    if (res.ok) setLibrary(res.data.stories);
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);
  useEffect(() => () => (advance.current ? window.clearTimeout(advance.current) : undefined), []);

  const ready = STEPS.every((s) => choices[s.key]);
  const step = STEPS[stepIdx];

  const choose = (k: Key, o: Choice) => {
    setChoices((c) => ({ ...c, [k]: o.id }));
    playSound('tap');
    setPop((p) => ({ key: k, n: (p?.n ?? 0) + 1 }));
    setCue({ kind: 'nod', id: Date.now() });
    if (readAloudOn(getMemory())) void speakSequence('story-pick', [tr(o.label, locale)], locale);
    if (advance.current) window.clearTimeout(advance.current);
    const next = STEPS.findIndex((s, i) => i > stepIdx && !choices[s.key]);
    const any = next >= 0 ? next : STEPS.findIndex((s) => s.key !== k && !choices[s.key]);
    if (any >= 0) advance.current = window.setTimeout(() => setStepIdx(any), reduce ? 200 : 750);
    else setCue({ kind: 'cheer', id: Date.now() + 1 });
  };

  async function tell() {
    if (!ready) return;
    setBusy(true);
    setCue({ kind: 'think', id: Date.now() });
    const full = choices as StoryChoices;
    const res = await api<{ id: string | null; story: StoryJson; source: 'ai' | 'local' }>('story/generate', { body: { choices: full, locale } });
    const cast = [pick(HEROES, full.hero).emoji, pick(STORY_COMPANIONS, full.companion).emoji];
    setStory(res.ok ? { story: res.data.story, source: res.data.source, saved: Boolean(res.data.id), cast } : { story: localStory(full, locale), source: 'local', saved: false, cast });
    setBusy(false);
    playSound('reward');
    if (res.ok && res.data.id) void loadLibrary();
  }

  // Open the book at the top of the screen.
  useEffect(() => {
    if (story) top.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, [story, reduce]);

  async function remove(id: string) {
    const res = await api('story?id=' + id, { method: 'DELETE' });
    if (res.ok) setLibrary((l) => l?.filter((s) => s.id !== id) ?? null);
  }

  return (
    <StudioFrame eyebrow={tr(T.eyebrow, locale)} emoji="📚" title={tr(T.title, locale)} subtitle={tr(T.subtitle, locale)} color="#3F8FE0" locale={locale} props={['📖', '🐉', '🏰', '🪄']} wide>
      <div ref={top} className="scroll-mt-28" />
      {story ? (
        <StoryBook story={story.story} source={story.source} saved={story.saved} cast={story.cast} locale={locale} onClose={() => setStory(null)} />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_23rem] lg:items-start">
          {/* ── Choosing ── */}
          <div className="order-2 lg:order-1">
            {/* Step tabs */}
            <nav aria-label={tr(T.steps, locale)} className="relative mx-auto flex max-w-xl items-center justify-between px-1">
              <span aria-hidden="true" className="absolute inset-x-6 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[repeating-linear-gradient(90deg,#cfe3f7_0_10px,transparent_10px_18px)] dark:bg-[repeating-linear-gradient(90deg,#2b3a63_0_10px,transparent_10px_18px)]" />
              {STEPS.map((s, i) => {
                const chosen = choices[s.key] ? pick(s.list, choices[s.key]!) : null;
                const on = i === stepIdx;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      if (advance.current) window.clearTimeout(advance.current);
                      setStepIdx(i);
                      playSound('tap');
                    }}
                    aria-current={on ? 'step' : undefined}
                    aria-label={`${i + 1}. ${tr(s.title, locale)}${chosen ? ` — ${tr(chosen.label, locale)}` : ''}`}
                    className={`${fx.toy} ${on ? fx.on : chosen ? '' : fx.light} grid h-14 w-14 place-items-center rounded-full font-display text-xl font-bold sm:h-16 sm:w-16`}
                    style={on || chosen ? toy(s.color, { ring: '#ffffff' }) : undefined}
                  >
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span key={chosen?.id ?? 'n'} initial={{ rotateY: 90, scale: 0.5 }} animate={{ rotateY: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 18 }} className="text-2xl leading-none sm:text-[1.8rem]" aria-hidden="true">
                        {chosen ? chosen.emoji : i + 1}
                      </motion.span>
                    </AnimatePresence>
                  </button>
                );
              })}
            </nav>

            <AnimatePresence mode="wait" initial={false}>
              <motion.section key={step.key} aria-labelledby={`step-${step.key}`} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }} className="mt-7">
                <div className="flex items-center justify-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-lg font-bold text-white shadow-[0_3px_0_rgba(0,0,0,0.15)]" style={{ background: step.color }} aria-hidden="true">
                    {stepIdx + 1}
                  </span>
                  <h2 id={`step-${step.key}`} className="font-display text-2xl font-bold text-text-body sm:text-3xl">
                    {tr(step.title, locale)}
                  </h2>
                  <SayButton texts={[tr(step.title, locale), ...step.list.map((o) => tr(o.label, locale))]} locale={locale} />
                </div>
                <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 [perspective:1200px] sm:grid-cols-3" role="radiogroup" aria-labelledby={`step-${step.key}`}>
                  {step.list.map((o, i) => (
                    <ChoiceCard key={o.id} o={o} i={i} color={step.color} on={choices[step.key] === o.id} locale={locale} onPick={() => choose(step.key, o)} />
                  ))}
                </div>
              </motion.section>
            </AnimatePresence>
          </div>

          {/* ── The book that fills up ── */}
          <aside className="order-1 lg:sticky lg:top-28 lg:order-2">
            <div className="relative mx-auto max-w-md">
              <div className="pointer-events-none absolute -top-16 end-2 z-10 h-28 w-28 sm:-top-20 sm:h-32 sm:w-32">
                <Ziggy3D className="pointer-events-auto h-full w-full" idle="wave" framing="bust" fallback="heart" cue={cue} label="Ziggy" />
              </div>
              <div className="relative rounded-[2rem] bg-[linear-gradient(160deg,#4d8fe8,#2f5fc0)] p-2.5 shadow-[0_8px_0_#24478f,0_30px_50px_-24px_rgba(30,60,140,0.7)]">
                <div className="relative overflow-hidden rounded-[1.5rem] bg-[#fffaf0] px-3 pb-4 pt-4 shadow-[inset_0_0_0_1px_rgba(120,90,40,0.12)]">
                  <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-10 -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(120,90,40,0.16),transparent)]" />
                  <p className="relative text-center font-display text-lg font-bold text-[#7a5a2e]">
                    📖 {tr(ready ? T.ready : T.myBook, locale)}
                  </p>
                  <ul className="relative mt-3 grid grid-cols-5 gap-2 lg:grid-cols-6 lg:gap-3">
                    {STEPS.map((s, i) => {
                      const chosen = choices[s.key] ? pick(s.list, choices[s.key]!) : null;
                      return (
                        <li key={s.key} className={`lg:col-span-2 ${i === 3 ? 'lg:col-start-2' : ''}`}>
                          <button
                            type="button"
                            onClick={() => setStepIdx(i)}
                            aria-label={`${tr(s.slot, locale)}${chosen ? ` : ${tr(chosen.label, locale)}` : ''}`}
                            className={`relative grid aspect-square w-full place-items-center rounded-2xl ${chosen ? '' : `${fx.slot} border-2 border-dashed`} focus-visible:outline focus-visible:outline-4 focus-visible:outline-sky/50`}
                            style={chosen ? { background: `radial-gradient(70% 70% at 35% 25%, #fff, ${alpha(s.color, 0.35)})`, boxShadow: `0 4px 0 ${alpha(shade(s.color, -0.3), 0.6)}, inset 0 0 0 2px ${alpha(s.color, 0.5)}` } : { borderColor: alpha(s.color, 0.45) }}
                          >
                            <AnimatePresence mode="popLayout">
                              {chosen ? (
                                <motion.span
                                  key={chosen.id}
                                  initial={reduce ? { opacity: 0 } : { rotateY: 180, scale: 0.2, y: -30 }}
                                  animate={reduce ? { opacity: 1 } : { rotateY: 0, scale: 1, y: 0 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  transition={{ type: 'spring', stiffness: 260, damping: 15 }}
                                  className="text-[1.7rem] leading-none sm:text-4xl"
                                  aria-hidden="true"
                                >
                                  {chosen.emoji}
                                </motion.span>
                              ) : (
                                <span key="empty" className="font-display text-sm font-bold opacity-60" style={{ color: shade(s.color, -0.3) }} aria-hidden="true">
                                  {i + 1}
                                </span>
                              )}
                            </AnimatePresence>
                            {pop?.key === s.key ? <Burst fire={pop.n} kind="stars" count={10} spread={0.5} /> : null}
                          </button>
                          <span className="mt-1 block truncate text-center text-[10px] font-black uppercase tracking-wider sm:text-[11px]" style={{ color: shade(s.color, -0.3) }}>
                            {tr(s.slot, locale)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="relative mt-4 flex items-center justify-center gap-2" role="radiogroup" aria-label={tr(T.age, locale)}>
                    <span className="me-1 text-sm font-bold text-[#7a5a2e]">{tr(T.age, locale)}</span>
                    {AGES.map((a) => {
                      const on = choices.ageGroup === a;
                      return (
                        <button key={a} type="button" role="radio" aria-checked={on} onClick={() => setChoices((c) => ({ ...c, ageGroup: a }))} className={`${fx.toy} ${on ? fx.on : fx.light} min-h-12 min-w-14 rounded-full px-3 font-display text-base font-bold`} style={on ? toy('#3F8FE0', { depth: 5, ring: '#fff' }) : ({ '--depth': '5px' } as CSSProperties)}>
                          {a}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  disabled={!ready}
                  aria-busy={busy}
                  onClick={() => (busy ? undefined : void tell())}
                  className={`${fx.toy} ${ready && !busy ? fx.sheen : ''} inline-flex min-h-[68px] w-full max-w-sm items-center justify-center gap-3 rounded-full px-6 font-display text-xl font-bold`}
                  style={toy('#FF7AB8', { depth: 8 })}
                >
                  {busy ? (
                    <>
                      <span aria-hidden="true" className={`inline-block text-2xl ${fx.bob}`} style={loop({ dur: 0.8, tilt: 12, amp: -4 })}>
                        ✍️
                      </span>
                      {tr(T.writing, locale)}
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true" className={`inline-block text-2xl ${ready ? fx.wiggle : ''}`}>
                        ✨
                      </span>
                      {tr(T.tell, locale)}
                    </>
                  )}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {library && library.length ? (
        <section aria-labelledby="library" className="mt-16">
          <h2 id="library" className="flex items-center gap-2 font-display text-2xl font-bold text-text-body">
            <span aria-hidden="true">📚</span> {tr(T.library, locale)}
          </h2>
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {library.map((s, i) => {
              const c = STEPS[i % STEPS.length].color;
              return (
                <li key={s.id} className="flex gap-4 rounded-[1.6rem] bg-bg-card p-3 shadow-[0_6px_0_rgba(60,90,160,0.12),0_16px_30px_-18px_rgba(30,60,140,0.5)] ring-1 ring-black/5 dark:ring-white/10">
                  <span aria-hidden="true" className="grid h-24 w-[4.4rem] shrink-0 place-items-center rounded-e-xl rounded-s-md text-3xl shadow-[inset_6px_0_0_rgba(0,0,0,0.15),0_4px_0_rgba(0,0,0,0.12)]" style={{ background: `linear-gradient(160deg, ${shade(c, 0.2)}, ${c})` }}>
                    {s.story.chapters[0]?.scenes[0]?.emoji ?? '📖'}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="line-clamp-2 font-display text-lg font-bold leading-tight text-text-body">{s.story.title}</span>
                    <span className="mt-0.5 text-xs text-text-muted">{new Date(s.createdAt).toLocaleDateString(locale)}</span>
                    <span className="mt-auto flex gap-2 pt-2">
                      <button type="button" onClick={() => setStory({ story: s.story, source: s.source, saved: true, cast: [] })} className={`${fx.toy} min-h-11 rounded-full px-4 font-display text-sm font-bold`} style={toy('#3F8FE0', { depth: 4 })}>
                        {tr(T.open, locale)}
                      </button>
                      <button type="button" onClick={() => void remove(s.id)} className={`${fx.toy} ${fx.light} min-h-11 rounded-full px-4 font-display text-sm font-bold`} style={{ '--depth': '4px' } as CSSProperties}>
                        {tr(T.del, locale)}
                      </button>
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </StudioFrame>
  );
}

/** A choice: a thick 3D card that flips in, lifts and glows when picked. */
function ChoiceCard({ o, i, color, on, locale, onPick }: { o: Choice; i: number; color: string; on: boolean; locale: string; onPick: () => void }) {
  const [n, setN] = useState(0);
  return (
    <motion.div initial={{ rotateY: -95, opacity: 0, y: 20 }} animate={{ rotateY: 0, opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 170, damping: 16, delay: i * 0.06 }} className="relative">
      <button
        type="button"
        role="radio"
        aria-checked={on}
        onClick={() => {
          setN((x) => x + 1);
          onPick();
        }}
        className={`${fx.toy} ${on ? fx.on : fx.light} flex w-full flex-col items-center gap-1 overflow-hidden rounded-[1.7rem] px-2 pb-3 pt-2 text-center`}
        style={on ? toy(color, { depth: 8, ring: '#ffffff' }) : ({ '--depth': '8px', '--edge': alpha(shade(color, -0.1), 0.55) } as CSSProperties)}
      >
        <span className="relative grid h-24 w-full place-items-center rounded-[1.3rem] sm:h-28" style={{ background: on ? 'radial-gradient(70% 70% at 50% 40%, rgba(255,255,255,0.55), rgba(255,255,255,0.08))' : `radial-gradient(70% 70% at 50% 35%, #ffffff, ${alpha(color, 0.22)})` }}>
          <span aria-hidden="true" className={`block text-[3.4rem] leading-none drop-shadow-[0_8px_6px_rgba(40,20,80,0.25)] sm:text-[4rem] ${on ? fx.bob : fx.float}`} style={loop({ dur: on ? 1.8 : 3.6 + (i % 3) * 0.4, delay: i * 0.3, amp: on ? -8 : -5, tilt: 6 })}>
            {o.emoji}
          </span>
          {on ? (
            <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 14 }} className="absolute end-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-white text-sm font-black shadow-[0_3px_0_rgba(0,0,0,0.15)]" style={{ color }} aria-hidden="true">
              ✓
            </motion.span>
          ) : null}
        </span>
        <span className="min-h-[2.6em] font-display text-[0.95rem] font-bold leading-tight sm:text-base">{tr(o.label, locale)}</span>
      </button>
      <Burst fire={n} kind="stars" count={12} spread={0.7} colors={[color, '#FFD447', '#ffffff']} />
    </motion.div>
  );
}

const PAGE_TINTS = ['#FFE3EF', '#DDF0FF', '#FFF0D6', '#ECE3FF', '#DEF7E4', '#FFE6DA'];

function StoryBook({ story, source, saved, cast, locale, onClose }: { story: StoryJson; source: 'ai' | 'local'; saved: boolean; cast: string[]; locale: string; onClose: () => void }) {
  const reduce = useReducedMotion();
  const pages = story.chapters.flatMap((c, ci) => c.scenes.map((s, si) => ({ chapter: c.title, first: si === 0, ci, ...s })));
  const [i, setI] = useState(0);
  const [reading, setReading] = useState(false);
  const [spread, setSpread] = useState(false);
  const [cue, setCue] = useState<{ kind: ZiggyCue; id: number } | null>(null);
  const [party, setParty] = useState(0);
  const total = pages.length + 1;
  const last = i === pages.length;

  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const on = () => setSpread(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  useEffect(() => {
    if (!last) return;
    setCue({ kind: 'cheer', id: Date.now() });
    setParty((p) => p + 1);
    playSound('win');
  }, [last]);

  const go = (n: number) => {
    if (n < 0 || n >= total) return;
    stopSpeaking();
    setReading(false);
    setI(n);
    playSound('tap');
  };

  async function readAloud() {
    setReading(true);
    const text = last ? story.moral : `${pages[i].first ? pages[i].chapter + '. ' : ''}${pages[i].text}`;
    await speak(`story-${i}`, text, locale).catch(() => undefined);
    setReading(false);
  }

  const tint = (n: number) => PAGE_TINTS[n % PAGE_TINTS.length];

  /** The picture of a page. */
  const art = (n: number, compact = false) => {
    if (n >= pages.length) {
      return (
        <div className="relative grid h-full place-items-center overflow-hidden" style={{ background: 'radial-gradient(70% 60% at 50% 45%, #fff7c2, #ffd9a8 70%, #ffc1d6)' }}>
          <div className={`absolute h-[160%] w-[160%] opacity-60 ${fx.spin}`} style={{ ...loop({ dur: 40 }), background: 'repeating-conic-gradient(rgba(255,255,255,0.7) 0deg 10deg, transparent 10deg 24deg)' }} aria-hidden="true" />
          <span aria-hidden="true" className={`relative block leading-none drop-shadow-[0_12px_10px_rgba(160,80,20,0.3)] ${compact ? 'text-7xl' : 'text-[7rem]'} ${fx.float}`}>
            🌟
          </span>
        </div>
      );
    }
    const pg = pages[n];
    return (
      <div className="relative h-full overflow-hidden" style={{ background: `radial-gradient(80% 70% at 50% 35%, #ffffff, ${tint(n)})` }}>
        <div aria-hidden="true" className="absolute inset-x-[-10%] bottom-[-18%] h-[42%] rounded-[50%]" style={{ background: `radial-gradient(70% 70% at 50% 25%, ${shade(tint(n), -0.06)}, ${shade(tint(n), -0.18)})` }} />
        {[
          [14, 16, 16, 0],
          [82, 22, 12, 0.6],
          [70, 8, 9, 1.1],
        ].map(([x, y, s, d], k) => (
          <span key={k} aria-hidden="true" className="absolute" style={{ left: `${x}%`, top: `${y}%` }}>
            <Twinkle size={s} color={k % 2 ? '#FF7AB8' : '#FFB13B'} className={fx.twinkle} style={loop({ dur: 2.6, delay: d })} />
          </span>
        ))}
        <div className="absolute inset-0 grid place-items-center">
          <span aria-hidden="true" className={`block leading-none drop-shadow-[0_14px_12px_rgba(60,30,90,0.25)] ${compact ? 'text-[5.5rem]' : 'text-[8rem]'} ${fx.float}`} style={loop({ dur: 4, amp: -12 })}>
            {pg.emoji ?? '✨'}
          </span>
        </div>
        {cast[0] ? (
          <span aria-hidden="true" className={`absolute bottom-[8%] left-[10%] block leading-none drop-shadow-[0_8px_6px_rgba(60,30,90,0.25)] ${compact ? 'text-4xl' : 'text-5xl'} ${fx.bob}`} style={loop({ dur: 2.4, tilt: 6 })}>
            {cast[0]}
          </span>
        ) : null}
        {cast[1] ? (
          <span aria-hidden="true" className={`absolute bottom-[8%] right-[10%] block leading-none drop-shadow-[0_8px_6px_rgba(60,30,90,0.25)] ${compact ? 'text-4xl' : 'text-5xl'} ${fx.bob}`} style={loop({ dur: 2.8, delay: 0.5, tilt: -6 })}>
            {cast[1]}
          </span>
        ) : null}
      </div>
    );
  };

  /** The words of a page. */
  const words = (n: number) => {
    const end = n >= pages.length;
    const pg = pages[n];
    return (
      <div className="flex h-full flex-col px-6 pb-5 pt-6 text-[#3b2a1a] sm:px-8">
        {end ? (
          <>
            <p className="font-display text-4xl font-bold text-[#c2410c]">{tr(T.end, locale)}</p>
            <p className="mt-4 text-lg leading-relaxed sm:text-xl">{story.moral}</p>
          </>
        ) : (
          <>
            {pg.first ? <p className="font-display text-sm font-bold uppercase tracking-[0.14em] text-[#2f6fc4]">{pg.chapter}</p> : <p className="text-sm font-bold text-[#b08a5a]">· · ·</p>}
            <p className="mt-3 min-h-0 overflow-y-auto text-lg leading-relaxed sm:text-xl [&::first-letter]:float-left [&::first-letter]:me-1 [&::first-letter]:font-display [&::first-letter]:text-5xl [&::first-letter]:font-bold [&::first-letter]:leading-[0.9] [&::first-letter]:text-[#e0457b]">{pg.text}</p>
          </>
        )}
        <p className="mt-auto pt-3 text-end text-xs font-bold text-[#b08a5a]">
          {n + 1} / {total}
        </p>
      </div>
    );
  };

  const single = (n: number) => (
    <div className="flex h-full flex-col">
      <div className="h-[42%] shrink-0">{art(n, true)}</div>
      <div className="min-h-0 flex-1">{words(n)}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-center text-xs font-bold text-text-muted">
        {tr(source === 'ai' ? T.ai : T.local, locale)}
        {saved ? ` · ${tr(T.saved, locale)}` : ''}
      </p>
      <motion.h2 initial={reduce ? false : { opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="mt-2 text-center font-display text-3xl font-bold text-text-body text-balance sm:text-4xl">
        {story.title}
      </motion.h2>

      <div className="relative mt-16 flex flex-col items-center gap-4 md:mt-6 md:flex-row md:items-end md:gap-2">
        {/* Ziggy, the storyteller (peeking over the book on phones) */}
        <div className="absolute -top-[5.5rem] end-2 z-20 h-28 w-28 md:relative md:end-auto md:top-auto md:z-auto md:h-56 md:w-44 md:shrink-0">
          <Ziggy3D key={spread ? 'full' : 'bust'} className="h-full w-full" idle="calm" framing={spread ? 'full' : 'bust'} fallback="stand" talking={reading} cue={cue} label="Ziggy" />
          <Burst fire={party} kind="confetti" count={26} spread={1.4} />
        </div>

        {/* The book */}
        <motion.div
          initial={reduce ? false : { rotateX: 60, y: 40, opacity: 0 }}
          animate={{ rotateX: 0, y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 90, damping: 14 }}
          className="relative w-full flex-1 [perspective:1600px]"
          aria-live="polite"
        >
          <div className="rounded-[1.8rem] bg-[linear-gradient(160deg,#4d8fe8,#2f5fc0)] p-2.5 shadow-[0_10px_0_#24478f,0_40px_60px_-30px_rgba(30,60,140,0.8)] sm:p-3">
            <div className="relative h-[29rem] overflow-hidden rounded-[1.3rem] bg-[#fffaf0] shadow-[inset_0_0_0_1px_rgba(120,90,40,0.15)] md:h-[25rem]">
              <FlipBook page={i} spread={spread} left={(n) => art(n)} right={words} single={single} />
              {spread ? <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-14 -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(90,60,20,0.18)_45%,rgba(90,60,20,0.28)_50%,rgba(90,60,20,0.18)_55%,transparent)]" /> : null}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5 sm:gap-4">
        <button type="button" disabled={i === 0} onClick={() => go(i - 1)} aria-label={tr(T.prev, locale)} title={tr(T.prev, locale)} className={`${fx.toy} ${fx.light} grid h-16 w-16 place-items-center rounded-full text-2xl font-black`}>
          <span aria-hidden="true" className="rtl:-scale-x-100">
            ◀
          </span>
        </button>
        <button type="button" onClick={() => (reading ? (stopSpeaking(), setReading(false)) : void readAloud())} aria-pressed={reading} className={`${fx.toy} inline-flex min-h-16 items-center gap-2 rounded-full px-4 font-display text-base font-bold sm:px-6 sm:text-lg`} style={toy('#8B5CF6', { depth: 7 })}>
          <span aria-hidden="true" className={reading ? fx.pulse : ''}>
            {reading ? '⏹' : '🔊'}
          </span>
          {tr(reading ? T.stop : T.read, locale)}
        </button>
        {last ? (
          <button type="button" onClick={onClose} className={`${fx.toy} ${fx.sheen} inline-flex min-h-16 items-center gap-2 rounded-full px-5 font-display text-base font-bold sm:px-6 sm:text-lg`} style={toy('#FF7AB8', { depth: 7 })}>
            <span aria-hidden="true">✨</span> {tr(T.newStory, locale)}
          </button>
        ) : (
          <button type="button" onClick={() => go(i + 1)} aria-label={tr(T.nextP, locale)} title={tr(T.nextP, locale)} className={`${fx.toy} ${fx.sheen} grid h-16 w-16 place-items-center rounded-full text-2xl font-black`} style={toy('#3F8FE0', { depth: 7 })}>
            <span aria-hidden="true" className="rtl:-scale-x-100">
              ▶
            </span>
          </button>
        )}
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-1.5" aria-label={`${tr(T.page, locale)} ${i + 1} / ${total}`} role="img">
        {Array.from({ length: total }, (_, n) => (
          <span key={n} className={`h-2.5 rounded-full transition-all duration-300 ${n === i ? 'w-7 bg-[#3F8FE0]' : 'w-2.5 bg-[#3F8FE0]/25'}`} />
        ))}
      </div>
    </div>
  );
}
