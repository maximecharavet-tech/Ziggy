'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { SayButton } from '@/components/arcade/read-aloud';
import { MagicMoments } from '@/components/world/MagicMoments';
import { BRUSHES, CHALLENGES, DISCOVERIES, TOOLS, discoveryById, toolById, type BrushId, type ChallengeId, type ToolId } from '@/games2d/sandbox/content';
import type { SceneId } from '@/games2d/sandbox/scenes';
import { tr, type L } from '@/lib/i18n-text';
import { playSound } from '@/lib/sound';
import { speakSequence, stopSpeaking, unlockAudio } from '@/lib/voice';
import { readAloudOn } from '@/lib/world/memory';
import { finishExtraGame } from '@/lib/world/play';
import type { MagicMoment } from '@/lib/world/engine';
import { getMemory } from '@/lib/world/store';
import { SandCanvas, type ClientEvent, type SandApi } from './SandCanvas';
import { Celebration, type Celebrate } from './Celebration';
import { NOTEBOOK_TEXT, Notebook } from './Notebook';
import { Toolbar } from './Toolbar';
import { emptySave, loadSave, writeSave, type SandboxSave } from './storage';

const T = {
  title: { fr: 'Le Bac à sable magique', en: 'The Magic Sandbox' },
  back: { fr: 'Retour au monde', en: 'Back to the world' },
  intro: { fr: 'Choisis un élément, puis dessine dans le bac. Observe bien ce qui se passe : chaque découverte va dans ton carnet !', en: 'Pick an element, then draw in the sandbox. Watch what happens: every discovery goes into your notebook!' },
  hint: { fr: 'Choisis, puis dessine ici !', en: 'Pick one, then draw here!' },
  canvas: { fr: 'Le bac à sable', en: 'The sandbox' },
  help: {
    fr: 'Dessine avec le doigt ou la souris. Au clavier : les flèches déplacent le pinceau, Espace verse l’élément, les chiffres 1 à 9 choisissent un élément, P met en pause.',
    en: 'Draw with your finger or the mouse. With a keyboard: arrows move the brush, Space pours the element, digits 1 to 9 pick an element, P pauses.',
  },
  challengeDone: { fr: 'Défi réussi !', en: 'Challenge done!' },
  paused: { fr: 'En pause : dessine, puis appuie sur ▶', en: 'Paused: draw, then press ▶' },
} satisfies Record<string, L>;

export function SandboxGame() {
  const raw = useLocale();
  const locale = raw === 'fr' ? 'fr' : 'en';
  const reduceMotion = Boolean(useReducedMotion());
  const api = useRef<SandApi>(null);
  const notebookButton = useRef<HTMLButtonElement>(null);
  const notebookPanel = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<ToolId>('sand');
  const [brush, setBrush] = useState<BrushId>('M');
  const [paused, setPaused] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [painted, setPainted] = useState(false);
  const [save, setSave] = useState<SandboxSave>(emptySave);
  const saveRef = useRef(save);
  const [queue, setQueue] = useState<Celebrate[]>([]);
  const [toast, setToast] = useState<ChallengeId | null>(null);
  const [magic, setMagic] = useState<MagicMoment[]>([]);
  const lastWin = useRef(0);
  const dirty = useRef(false);

  // The notebook lives on this device.
  useEffect(() => {
    const s = loadSave();
    saveRef.current = s;
    setSave(s);
    lastWin.current = performance.now();
  }, []);

  // Totals change often (every flower, every raindrop): write them now and then, and when leaving.
  useEffect(() => {
    const flush = () => {
      if (!dirty.current) return;
      dirty.current = false;
      writeSave(saveRef.current);
    };
    const t = setInterval(flush, 4000);
    window.addEventListener('pagehide', flush);
    return () => {
      clearInterval(t);
      window.removeEventListener('pagehide', flush);
      flush();
      stopSpeaking();
    };
  }, []);

  const say = useCallback(
    (id: string, lines: string[]) => {
      if (readAloudOn(getMemory())) void speakSequence(id, lines, locale);
    },
    [locale]
  );

  const commit = (next: SandboxSave, now = false) => {
    saveRef.current = next;
    setSave(next);
    if (now) writeSave(next);
    else dirty.current = true;
  };

  const onEvents = useCallback(
    (events: ClientEvent[]) => {
      let next = saveRef.current;
      let changed = false;
      let important = false;
      const fresh: Celebrate[] = [];
      for (const e of events) {
        const totals = { ...next.totals, [e.kind]: Math.min(9999, (next.totals[e.kind] ?? 0) + 1) };
        next = { ...next, totals };
        changed = true;
        if (!next.discoveries[e.kind]) {
          next = { ...next, discoveries: { ...next.discoveries, [e.kind]: Date.now() } };
          important = true;
          fresh.push({ id: e.kind, from: { x: e.clientX, y: e.clientY } });
          api.current?.burst(e.x, e.y, discoveryById(e.kind)?.color ?? '#ffd447');
          const now = performance.now();
          const outcome = finishExtraGame('bac_a_sable', 'science', { correct: 1, mistakes: 0, total: 1 }, now - lastWin.current);
          lastWin.current = now;
          if (outcome.magic.length) setMagic((m) => [...m, ...outcome.magic]);
        }
        for (const c of CHALLENGES) {
          if (c.reaction !== e.kind || next.challenges[c.id] || (next.totals[c.reaction] ?? 0) < c.target) continue;
          next = { ...next, challenges: { ...next.challenges, [c.id]: Date.now() } };
          important = true;
          setToast(c.id);
          playSound('win');
          say(`sandbox-challenge-${c.id}`, [tr(T.challengeDone, locale), tr(c.title, locale)]);
        }
      }
      if (!changed) return;
      commit(next, important);
      if (fresh.length) {
        playSound('reward');
        setQueue((q) => [...q, ...fresh]);
      }
    },
    [locale, say]
  );

  // Read the discovery aloud when its card shows.
  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    const d = discoveryById(current.id);
    if (d) say(`sandbox-discovery-${d.id}`, [tr(d.title, locale), tr(d.science, locale)]);
  }, [current, locale, say]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const pickTool = useCallback(
    (id: ToolId) => {
      unlockAudio();
      setTool(id);
      playSound('tap');
      const t = toolById(id);
      say('sandbox-tool', [`${tr(t.name, locale).replace(/ [←→]$/, '')}. ${tr(t.say, locale)}`]);
    },
    [locale, say]
  );

  // Keyboard shortcuts (outside text fields): 1–9 pick an element, P pauses.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (/^[1-9]$/.test(e.key)) {
        const t = TOOLS[Number(e.key) - 1];
        if (t) pickTool(t.id);
      } else if (e.key === 'p' || e.key === 'P') setPaused((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickTool]);

  const notebookTarget = () => {
    const el = notebookPanel.current && notebookPanel.current.offsetParent ? notebookPanel.current : notebookButton.current;
    const r = el?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 40) } : null;
  };

  const found = Object.keys(save.discoveries).length;
  const radius = BRUSHES.find((b) => b.id === brush)?.radius ?? 3;
  const toast$ = toast ? CHALLENGES.find((c) => c.id === toast) : null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden text-white" style={{ background: 'radial-gradient(120% 80% at 15% 0%, #4b3f9e 0%, transparent 55%), radial-gradient(90% 70% at 100% 100%, #7a3f86 0%, transparent 60%), linear-gradient(165deg, #1f2160 0%, #2c2470 45%, #3b2766 100%)' }}>
      {/* Soft floating lights in the background. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#5fb6ea]/25 blur-3xl motion-safe:animate-[sandbox-float_14s_ease-in-out_infinite]" />
        <div className="absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-[#ff7eb6]/20 blur-3xl motion-safe:animate-[sandbox-float_18s_ease-in-out_infinite_reverse]" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-[#ffd447]/15 blur-3xl motion-safe:animate-[sandbox-float_16s_ease-in-out_infinite]" />
      </div>
      <style>{`
        @keyframes sandbox-float { 0%,100% { transform: translate3d(0,0,0) } 50% { transform: translate3d(24px,-18px,0) } }
        .sandbox-scroll { scrollbar-width: none; }
        .sandbox-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Top bar. */}
      <header className="relative z-10 flex items-center gap-2 px-3 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))] sm:gap-3 sm:px-5">
        <Link href="/monde" aria-label={tr(T.back, locale)} title={tr(T.back, locale)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-lg ring-1 ring-white/15 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          <span aria-hidden="true">←</span>
        </Link>
        <h1 className="line-clamp-2 min-w-0 font-display text-[17px] font-bold leading-[1.1] sm:text-2xl">
          <span aria-hidden="true" className="hidden sm:inline">
            🏖️{' '}
          </span>
          {tr(T.title, locale)}
        </h1>
        <SayButton size="sm" texts={[tr(T.title, locale), tr(T.intro, locale)]} locale={locale} className="!bg-white/10 !text-white !ring-white/20" />
        <div className="flex-1" />
        <motion.button
          ref={notebookButton}
          type="button"
          onClick={() => setDrawer(true)}
          aria-label={`${tr(NOTEBOOK_TEXT.title, locale)} : ${found}/${DISCOVERIES.length}`}
          className="relative flex h-11 shrink-0 items-center gap-2 rounded-full bg-white px-3.5 text-sm font-black text-[#2c2470] shadow-lg transition hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:hidden"
          animate={current ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={{ duration: 0.8, repeat: current ? Infinity : 0 }}
        >
          <span aria-hidden="true" className="text-lg">
            📒
          </span>
          <span className="hidden min-[400px]:inline">{tr(NOTEBOOK_TEXT.short, locale)}</span>
          <span className="tabular-nums">
            {found}/{DISCOVERIES.length}
          </span>
        </motion.button>
      </header>

      {/* The sandbox, with the notebook alongside on large screens. */}
      <div className="relative z-0 flex min-h-0 flex-1 gap-4 px-3 pb-1 pt-2 sm:px-5">
        <div className="relative min-h-0 min-w-0 flex-1">
          <SandCanvas
            tool={toolById(tool)}
            radius={radius}
            paused={paused}
            initialScene="jardin"
            label={tr(T.canvas, locale)}
            help={tr(T.help, locale)}
            reduceMotion={reduceMotion}
            onEvents={onEvents}
            onPaint={() => {
              unlockAudio();
              if (!painted) setPainted(true);
            }}
            apiRef={api}
          />
          <AnimatePresence>
            {!painted ? (
              <motion.div
                key="hint"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: 0.6 }}
                className="pointer-events-none absolute left-1/2 top-[18%] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white/95 px-4 py-2.5 text-sm font-bold text-[#2c2470] shadow-xl sm:text-base"
              >
                <motion.span aria-hidden="true" className="text-xl" animate={reduceMotion ? {} : { y: [0, 6, 0], rotate: [0, -8, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>
                  👆
                </motion.span>
                {tr(T.hint, locale)}
              </motion.div>
            ) : null}
            {paused ? (
              <motion.div key="paused" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-300 px-4 py-1.5 text-sm font-bold text-[#3b2a00] shadow-lg">
                {tr(T.paused, locale)}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        <aside aria-label={tr(NOTEBOOK_TEXT.title, locale)} className="hidden w-[320px] shrink-0 overflow-hidden rounded-[26px] bg-white/[0.08] ring-1 ring-white/15 backdrop-blur-md lg:flex">
          <Notebook ref={notebookPanel} save={save} locale={locale} className="w-full" />
        </aside>
      </div>

      {/* Tools. */}
      <footer className="relative z-10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 sm:px-5">
        <Toolbar
          locale={locale}
          tool={tool}
          onTool={pickTool}
          brush={brush}
          onBrush={(b) => {
            setBrush(b);
            playSound('tap');
          }}
          paused={paused}
          onPause={() => {
            setPaused((p) => !p);
            playSound('tap');
          }}
          onScene={(id: SceneId) => {
            api.current?.loadScene(id);
            playSound('pop');
          }}
          onClear={() => {
            api.current?.clear();
            playSound('pop');
          }}
        />
      </footer>

      {/* Notebook drawer on phones and tablets. */}
      <AnimatePresence>
        {drawer ? (
          <motion.div key="drawer" className="fixed inset-0 z-[65] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" aria-label={tr(NOTEBOOK_TEXT.close, locale)} className="absolute inset-0 bg-[#0d0b2a]/60 backdrop-blur-sm" onClick={() => setDrawer(false)} />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={tr(NOTEBOOK_TEXT.title, locale)}
              className="absolute inset-x-0 bottom-0 flex max-h-[86dvh] flex-col rounded-t-[30px] bg-[#2a2366] pb-[env(safe-area-inset-bottom)] shadow-2xl ring-1 ring-white/15"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              onKeyDown={(e) => e.key === 'Escape' && setDrawer(false)}
            >
              <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-white/30" aria-hidden="true" />
              <Notebook save={save} locale={locale} onClose={() => setDrawer(false)} className="min-h-0 flex-1" />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* A new discovery flies into the notebook. */}
      {current ? <Celebration key={current.id} item={current} locale={locale} target={notebookTarget} reduceMotion={reduceMotion} onDone={() => setQueue((q) => q.slice(1))} /> : null}

      {/* A challenge done. */}
      <AnimatePresence>
        {toast$ ? (
          <motion.div
            key={toast$.id}
            role="status"
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            className="pointer-events-none fixed left-1/2 top-16 z-[72] flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full bg-[#3ccf91] px-5 py-3 font-bold text-white shadow-[0_12px_40px_-8px_rgba(60,207,145,0.8)]"
          >
            <span className="text-2xl" aria-hidden="true">
              {toast$.emoji}
            </span>
            <span>
              {tr(T.challengeDone, locale)} <span className="font-semibold opacity-90">{tr(toast$.title, locale)}</span>
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-sm font-black text-[#3ccf91]" aria-hidden="true">
              ✓
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {magic.length ? <MagicMoments moments={magic} locale={locale} onDone={() => setMagic([])} /> : null}
    </div>
  );
}

