'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'motion/react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { Link } from '@/i18n/navigation';
import { SayButton } from '@/components/arcade/read-aloud';
import { MagicMoments } from '@/components/world/MagicMoments';
import {
  BRUSHES,
  CHALLENGES,
  DISCOVERIES,
  OPENINGS,
  SIGNATURE_GIFT,
  WORLDS,
  WORLD_INFO,
  discoveryById,
  invitation,
  toolById,
  worldIndex,
  type BrushId,
  type ChallengeId,
  type Reaction,
  type ToolId,
  type WorldId,
} from '@/games2d/sandbox/content';
import { tr, type L } from '@/lib/i18n-text';
import { playSound } from '@/lib/sound';
import { speakSequence, stopSpeaking, unlockAudio } from '@/lib/voice';
import { readAloudOn } from '@/lib/world/memory';
import { finishExtraGame } from '@/lib/world/play';
import type { MagicMoment } from '@/lib/world/engine';
import { getMemory } from '@/lib/world/store';
import { SandCanvas, type EventBatch, type SandApi, type Speed } from './SandCanvas';
import { Celebration, type Celebrate } from './Celebration';
import { NOTEBOOK_TEXT, Notebook } from './Notebook';
import { Toolbar } from './Toolbar';
import { WorldPicker } from './WorldPicker';
import { Saucer, SAUCER_TEXT } from './Saucer';
import { AlbumPanel } from './AlbumPanel';
import { saveSnapshot, type Snapshot } from './album';
import { discoveryMotif, saucerHum } from './sounds';
import { earnsRound, emptySave, loadSave, writeSave, type SandboxSave } from './storage';
import { fx, toy } from '@/components/create/fx/toy';

const T = {
  title: { fr: 'Le Bac à sable magique', en: 'The Magic Sandbox' },
  back: { fr: 'Retour au monde', en: 'Back to the world' },
  intro: { fr: 'Choisis un élément, puis dessine dans le bac. Observe bien ce qui se passe : chaque découverte va dans ton carnet !', en: 'Pick an element, then draw in the sandbox. Watch what happens: every discovery goes into your notebook!' },
  hint: { fr: 'Choisis, puis dessine ici !', en: 'Pick one, then draw here!' },
  canvas: { fr: 'Le bac à sable', en: 'The sandbox' },
  loading: { fr: 'Le bac à sable se prépare…', en: 'The sandbox is getting ready…' },
  failed: { fr: 'Le bac à sable n’a pas pu s’ouvrir. Réessaie plus tard !', en: 'The sandbox could not open. Try again later!' },
  help: {
    fr: 'Dessine avec le doigt ou la souris, avec plusieurs doigts si tu veux. Au clavier : les flèches déplacent le pinceau, Espace verse l’élément, les chiffres 1 à 6 choisissent un élément, P met en pause.',
    en: 'Draw with your finger or the mouse, with several fingers if you like. With a keyboard: arrows move the brush, Space pours the element, digits 1 to 6 pick an element, P pauses.',
  },
  challengeDone: { fr: 'Défi réussi !', en: 'Challenge done!' },
  paused: { fr: 'En pause : dessine, puis appuie sur ▶', en: 'Paused: draw, then press ▶' },
  whatIf: { fr: 'Et si… ?', en: 'What if…?' },
  kept: { fr: 'Ton monde est gardé dans l’album !', en: 'Your world is kept in the album!' },
  notKept: { fr: 'L’album n’est pas disponible sur cet appareil.', en: 'The album is not available on this device.' },
  photoName: { fr: 'mon-bac-a-sable.png', en: 'my-sandbox.png' },
  visit: { fr: 'Visiter', en: 'Visit' },
  parcelWait: { fr: 'Un colis ! Il ne s’ouvre pas avec le doigt… que va-t-il aimer ?', en: 'A parcel! It does not open with a tap… what will it like?' },
} satisfies Record<string, L>;

/** What each way of opening the parcel gives, as a message. */
const GIFT_LINES: Partial<Record<Reaction, L>> = {
  gift_cold: { fr: 'Écoute : maintenant, tout ce qui tombe fait de la musique !', en: 'Listen: now everything that falls makes music!' },
  gift_buried: { fr: 'Une carte au trésor ! Cherche le X brillant et creuse avec la gomme.', en: 'A treasure map! Find the shiny X and dig with the eraser.' },
  gift_wind: { fr: 'Un cerf-volant ! Souffle avec le vent pour le faire danser.', en: 'A kite! Blow with the wind to make it dance.' },
};

type Toast = { kind: 'challenge'; id: ChallengeId } | { kind: 'line'; text: L; emoji: string; visit?: WorldId };

export function SandboxGame() {
  const raw = useLocale();
  const locale = raw === 'fr' ? 'fr' : 'en';
  const reduceMotion = Boolean(useReducedMotion());
  const api = useRef<SandApi>(null);
  const notebookButton = useRef<HTMLButtonElement>(null);
  const notebookPanel = useRef<HTMLDivElement>(null);

  const [world, setWorld] = useState<WorldId>('garden');
  const [tool, setTool] = useState<ToolId>('water');
  const [brush, setBrush] = useState<BrushId>('M');
  const [speed, setSpeed] = useState<Speed>('normal');
  const [night, setNight] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [picker, setPicker] = useState(false);
  const [album, setAlbum] = useState(false);
  const [albumVersion, setAlbumVersion] = useState(0);
  const [painted, setPainted] = useState(false);
  const [save, setSave] = useState<SandboxSave>(emptySave);
  const saveRef = useRef(save);
  const [queue, setQueue] = useState<Celebrate[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [magic, setMagic] = useState<MagicMoment[]>([]);
  const [saucer, setSaucer] = useState(0);
  const [idea, setIdea] = useState(false);
  const [little, setLittle] = useState(false);
  const lastWin = useRef(0);
  const dirty = useRef(false);
  const lastTotals = useRef(0);
  const pendingRestore = useRef<Snapshot | null>(null);

  // The notebook lives on this device.
  useEffect(() => {
    const s = loadSave();
    saveRef.current = s;
    setSave(s);
    setWorld(s.world);
    setTool(WORLD_INFO[s.world].big[0]);
    setLittle(getMemory().age === 'little');
    lastWin.current = performance.now();
  }, []);

  // Totals change often (every raindrop): write them now and then, and when leaving.
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
    [locale],
  );

  const commit = (next: SandboxSave, now = false) => {
    saveRef.current = next;
    setSave(next);
    if (now) writeSave(next);
    else dirty.current = true;
  };

  const discover = (next: SandboxSave, id: Reaction, from: { x: number; y: number }, cell: { x: number; y: number } | null, fresh: Celebrate[]): SandboxSave => {
    if (next.discoveries[id]) return next;
    const d = discoveryById(id);
    const round = earnsRound(next, id, world, (r) => discoveryById(r)?.world ?? 'garden');
    next = { ...next, discoveries: { ...next.discoveries, [id]: Date.now() } };
    fresh.push({ id, from });
    if (cell) api.current?.burst(cell.x, cell.y, d?.color ?? '#ffd447');
    if (round) {
      // World Memory: the first discovery of each world, then every 5th (decision 5 of the brief).
      const now = performance.now();
      const outcome = finishExtraGame('bac_a_sable', 'science', { correct: 1, mistakes: 0, total: 1 }, now - lastWin.current);
      lastWin.current = now;
      next = { ...next, rounds: next.rounds + 1 };
      if (outcome.magic.length) setMagic((m) => [...m, ...outcome.magic]);
    }
    return next;
  };

  const openParcel = (next: SandboxSave, kind: Reaction, cell: { x: number; y: number }, from: { x: number; y: number }, fresh: Celebrate[]): SandboxSave => {
    const a = api.current;
    // What came out depends on how it was opened.
    if (kind === 'gift_water') a?.placeGift(9, cell.x, cell.y);
    else if (kind === 'gift_warm') a?.hatchBaby(cell.x, cell.y - 2);
    else if (kind === 'gift_lowg') a?.placeGift(8, cell.x, cell.y - 6);
    else if (kind === 'gift_bubble') {
      const other = WORLDS[(worldIndex(world) + 3) % WORLDS.length];
      setToast({ kind: 'line', emoji: '🍾', text: { fr: `Une carte postale : « Bonjour de ${WORLD_INFO[other].name.fr} ! »`, en: `A postcard: “Hello from ${WORLD_INFO[other].name.en}!”` }, visit: other });
    } else if (GIFT_LINES[kind]) setToast({ kind: 'line', emoji: discoveryById(kind)?.output ?? '🎁', text: GIFT_LINES[kind]! });
    next = discover(next, kind, from, cell, fresh);
    // The first parcel opened in a world also gives that world's signature toy.
    const sig = SIGNATURE_GIFT[world];
    if (!next.discoveries[sig]) {
      a?.placeGift(worldIndex(world), cell.x + 14, cell.y);
      next = discover(next, sig, from, null, fresh);
    }
    return next;
  };

  const onEvents = useCallback(
    ({ events, deltas }: EventBatch) => {
      let next = saveRef.current;
      let important = false;
      const fresh: Celebrate[] = [];
      const kinds = Object.keys(deltas) as Reaction[];
      if (kinds.length) {
        const totals = { ...next.totals };
        for (const k of kinds) totals[k] = Math.min(9999, (totals[k] ?? 0) + (deltas[k] ?? 0));
        next = { ...next, totals };
      }
      for (const e of events) {
        const from = { x: e.clientX, y: e.clientY };
        if (OPENINGS.includes(e.kind)) next = openParcel(next, e.kind, { x: e.x, y: e.y }, from, fresh);
        else next = discover(next, e.kind, from, { x: e.x, y: e.y }, fresh);
      }
      if (fresh.length) important = true;
      for (const c of CHALLENGES) {
        if (next.challenges[c.id] || (next.totals[c.reaction] ?? 0) < c.target) continue;
        next = { ...next, challenges: { ...next.challenges, [c.id]: Date.now() } };
        important = true;
        setToast({ kind: 'challenge', id: c.id });
        playSound('win');
        say(`sandbox-challenge-${c.id}`, [tr(T.challengeDone, locale), tr(c.title, locale)]);
      }
      if (next === saveRef.current) return;
      // Counters alone re-render the page at most every 2 seconds.
      const now = performance.now();
      if (!important && now - lastTotals.current < 2000) {
        saveRef.current = next;
        dirty.current = true;
        return;
      }
      lastTotals.current = now;
      commit(next, important);
      if (fresh.length) {
        playSound('reward');
        discoveryMotif(fresh.length + Object.keys(next.discoveries).length);
        setQueue((q) => [...q, ...fresh]);
      }
    },
    // The handlers read the latest world through this render's closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, say, world],
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
    const t = setTimeout(() => setToast(null), toast.kind === 'line' && toast.visit ? 7000 : 4200);
    return () => clearTimeout(t);
  }, [toast]);

  // Ziggy's saucer comes by after a calm moment of play; if missed, it simply comes back later.
  const busy = picker || album || drawer || Boolean(current);
  useEffect(() => {
    if (!painted || saucer || busy) return;
    const t = setTimeout(() => setSaucer((n) => n + 1), save.saucer.includes(world) ? 45000 : 15000);
    return () => clearTimeout(t);
  }, [painted, saucer, busy, world, save.saucer]);

  useEffect(() => {
    if (!saucer) return;
    saucerHum();
    if (!saveRef.current.saucer.includes(world)) commit({ ...saveRef.current, saucer: [...saveRef.current.saucer, world] }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saucer]);

  const pickTool = useCallback(
    (id: ToolId) => {
      unlockAudio();
      setTool(id);
      playSound('tap');
      const t = toolById(id);
      say('sandbox-tool', [`${tr(t.name, locale).replace(/ [←→]$/, '')}. ${tr(t.say, locale)}`]);
    },
    [locale, say],
  );

  const goWorld = useCallback(
    (w: WorldId) => {
      setPicker(false);
      setWorld(w);
      setTool(WORLD_INFO[w].big[0]);
      setNight(false);
      setSaucer(0);
      commit({ ...saveRef.current, world: w }, true);
      playSound('pop');
      say(`sandbox-world-${w}`, [tr(WORLD_INFO[w].name, locale), tr(WORLD_INFO[w].hello, locale)]);
    },
    [locale, say],
  );

  // Keyboard shortcuts (outside text fields): 1–6 pick a big tool, P pauses.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (/^[1-6]$/.test(e.key)) pickTool(WORLD_INFO[world].big[Number(e.key) - 1]);
      else if (e.key === 'p' || e.key === 'P') setSpeed((s) => (s === 'pause' ? 'normal' : 'pause'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickTool, world]);

  const notebookTarget = () => {
    const el = notebookPanel.current && notebookPanel.current.offsetParent ? notebookPanel.current : notebookButton.current;
    const r = el?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 40) } : null;
  };

  const unlocked = useMemo(() => {
    const u = new Set<ToolId>();
    if (save.saucer.includes(world)) u.add('beam');
    if (save.discoveries.gift_water) u.add('rainbowSeed');
    if (save.discoveries.gift_warm) u.add('baby');
    if (save.discoveries.gift_lowg) u.add('pocketStar');
    if (save.discoveries[SIGNATURE_GIFT[world]]) u.add('toy');
    return u;
  }, [save, world]);

  const foundPerWorld = useMemo(() => Object.fromEntries(WORLDS.map((w) => [w, DISCOVERIES.filter((d) => d.world === w && save.discoveries[d.id]).length])) as Record<WorldId, number>, [save]);
  const found = DISCOVERIES.filter((d) => save.discoveries[d.id]).length;
  const radius = BRUSHES.find((b) => b.id === brush)?.radius ?? 3;
  const idea$ = invitation(world, save.discoveries);
  const challenge$ = toast?.kind === 'challenge' ? CHALLENGES.find((c) => c.id === toast.id) : null;
  const info = WORLD_INFO[world];

  const keepWorld = async () => {
    const snap = api.current?.snapshot();
    const ok = snap ? await saveSnapshot({ ...snap, world }) : null;
    setAlbumVersion((v) => v + 1);
    setToast({ kind: 'line', emoji: ok ? '💾' : '🙈', text: ok ? T.kept : T.notKept });
    playSound(ok ? 'star' : 'tap');
  };

  const openSnapshot = (s: Snapshot) => {
    setAlbum(false);
    if (s.world === world && api.current?.restore(s.bytes, s.w, s.h)) {
      playSound('pop');
      return;
    }
    pendingRestore.current = s;
    if (s.world !== world) goWorld(s.world);
  };

  const photo = () => {
    const url = api.current?.photo();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = tr(T.photoName, locale);
    a.click();
    playSound('star');
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden text-white" style={{ background: 'radial-gradient(120% 80% at 15% 0%, #4b3f9e 0%, transparent 55%), radial-gradient(90% 70% at 100% 100%, #7a3f86 0%, transparent 60%), linear-gradient(165deg, #1f2160 0%, #2c2470 45%, #3b2766 100%)' }}>
      {/* Top bar. */}
      <header className="relative z-10 flex items-center gap-2 px-3 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))] sm:gap-3 sm:px-5">
        <Link href="/monde" aria-label={tr(T.back, locale)} title={tr(T.back, locale)} className={`${fx.toy} grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-black`} style={toy('#4b3fa6', { depth: 4 })}>
          <span aria-hidden="true" className="rtl:-scale-x-100">
            ←
          </span>
        </Link>
        <h1 className="line-clamp-2 min-w-0 font-display text-[17px] font-bold leading-[1.1] sm:text-2xl">
          <span aria-hidden="true">{info.emoji} </span>
          {tr(T.title, locale)}
        </h1>
        <SayButton size="sm" texts={[tr(T.title, locale), tr(info.hello, locale), tr(T.intro, locale)]} locale={locale} className="!bg-white/10 !text-white !ring-white/20" />
        <div className="flex-1" />
        <button
          ref={notebookButton}
          type="button"
          onClick={() => setDrawer(true)}
          aria-label={`${tr(NOTEBOOK_TEXT.title, locale)} : ${found}`}
          className={`${fx.toy} ${fx.light} flex h-12 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-black lg:hidden`}
          style={{ '--depth': '4px', '--ink': '#2c2470' } as React.CSSProperties}
          data-notebook-button=""
        >
          <span aria-hidden="true" className="text-lg">
            📒
          </span>
          <span className="hidden min-[400px]:inline">{tr(NOTEBOOK_TEXT.short, locale)}</span>
          <span className="tabular-nums">{found}</span>
        </button>
      </header>

      {/* The sandbox, with the notebook alongside on large screens. */}
      <div className="relative z-0 flex min-h-0 flex-1 gap-4 px-3 pb-1 pt-2 sm:px-5">
        <div className="relative min-h-0 min-w-0 flex-1">
          <SandCanvas
            world={world}
            tool={toolById(tool)}
            radius={little ? 3.5 : radius}
            speed={speed}
            night={night}
            label={`${tr(T.canvas, locale)} : ${tr(info.name, locale)}`}
            help={tr(T.help, locale)}
            loadingLabel={tr(T.loading, locale)}
            failLabel={tr(T.failed, locale)}
            reduceMotion={reduceMotion}
            onEvents={onEvents}
            onPaint={() => {
              unlockAudio();
              if (!painted) setPainted(true);
            }}
            onReady={() => {
              const s = pendingRestore.current;
              if (!s) return;
              pendingRestore.current = null;
              // A world kept in the other orientation opens fresh rather than squeezed.
              window.setTimeout(() => api.current?.restore(s.bytes, s.w, s.h), 0);
            }}
            apiRef={api}
          />
          {saucer ? (
            <Saucer
              key={saucer}
              world={world}
              locale={locale}
              reduceMotion={reduceMotion}
              canDrop={(api.current?.parcel()?.state ?? 0) === 0 || (api.current?.parcel()?.state ?? 0) === 3}
              onDrop={(x, y) => {
                if (api.current?.dropParcel(x, y)) {
                  playSound('pop');
                  say('sandbox-parcel', [tr(SAUCER_TEXT.oops, locale), tr(T.parcelWait, locale)]);
                }
              }}
              onHold={() => {
                setTool('beam');
                say('sandbox-beam', [tr(SAUCER_TEXT.beam, locale)]);
              }}
              onDone={() => setSaucer(0)}
            />
          ) : null}
          {idea$ && painted ? (
            <div className="absolute left-3 top-3 z-10 flex max-w-[70%] items-start gap-2">
              <button type="button" onClick={() => setIdea((v) => !v)} aria-expanded={idea} className="flex h-12 items-center gap-1.5 rounded-full bg-white/90 px-3 text-sm font-black text-[#2c2470] shadow-lg focus-visible:outline focus-visible:outline-4 focus-visible:outline-white" data-idea="">
                <span aria-hidden="true">{info.critterEmoji}</span> {tr(T.whatIf, locale)}
              </button>
              {idea ? (
                <motion.div initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-bold text-[#2c2470] shadow-lg">
                  <span>{tr(idea$.hint, locale)}</span>
                  <SayButton size="sm" texts={[tr(T.whatIf, locale), tr(idea$.hint, locale)]} locale={locale} />
                </motion.div>
              ) : null}
            </div>
          ) : null}
          <AnimatePresence>
            {!painted ? (
              <motion.div key="hint" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: 0.6 }} className="pointer-events-none absolute left-1/2 top-[18%] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white/95 px-4 py-2.5 text-sm font-bold text-[#2c2470] shadow-xl sm:text-base">
                <motion.span aria-hidden="true" className="text-xl" animate={reduceMotion ? {} : { y: [0, 6, 0], rotate: [0, -8, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>
                  👆
                </motion.span>
                {tr(T.hint, locale)}
              </motion.div>
            ) : null}
            {speed === 'pause' ? (
              <motion.div key="paused" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-300 px-4 py-1.5 text-sm font-bold text-[#3b2a00] shadow-lg">
                {tr(T.paused, locale)}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        <aside aria-label={tr(NOTEBOOK_TEXT.title, locale)} className="hidden w-[320px] shrink-0 overflow-hidden rounded-[26px] bg-[#2a2470]/85 shadow-[inset_0_2px_0_rgba(255,255,255,0.12),0_8px_0_#1a1550,0_30px_50px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/15 lg:flex">
          <Notebook key={world} ref={notebookPanel} save={save} world={world} locale={locale} className="w-full" />
        </aside>
      </div>

      {/* Tools. */}
      <footer className="relative z-10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 sm:px-5">
        <Toolbar
          locale={locale}
          world={world}
          tool={tool}
          onTool={pickTool}
          unlocked={unlocked}
          brush={brush}
          onBrush={(b) => {
            setBrush(b);
            playSound('tap');
          }}
          speed={speed}
          onSpeed={(s) => {
            setSpeed(s);
            playSound('tap');
          }}
          night={night}
          onNight={() => {
            setNight((n) => !n);
            playSound('tap');
          }}
          onClear={() => {
            api.current?.loadScene();
            playSound('pop');
          }}
          onWorlds={() => setPicker(true)}
          onAlbum={() => setAlbum(true)}
          onPhoto={photo}
        />
      </footer>

      {/* Notebook drawer on phones and tablets. */}
      <AnimatePresence>
        {drawer ? (
          <motion.div key="drawer" className="fixed inset-0 z-[65] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" aria-label={tr(NOTEBOOK_TEXT.close, locale)} className="absolute inset-0 bg-[#0d0b2a]/70" onClick={() => setDrawer(false)} />
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
              <Notebook save={save} world={world} locale={locale} onClose={() => setDrawer(false)} className="min-h-0 flex-1" />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>{picker ? <WorldPicker key="picker" locale={locale} current={world} found={foundPerWorld} reduceMotion={reduceMotion} onPick={goWorld} onClose={() => setPicker(false)} /> : null}</AnimatePresence>
      <AnimatePresence>{album ? <AlbumPanel key="album" locale={locale} version={albumVersion} onSave={() => void keepWorld()} onOpen={openSnapshot} onClose={() => setAlbum(false)} /> : null}</AnimatePresence>

      {/* A new discovery flies into the notebook. */}
      {current ? <Celebration key={current.id} item={current} locale={locale} target={notebookTarget} reduceMotion={reduceMotion} onDone={() => setQueue((q) => q.slice(1))} /> : null}

      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.kind === 'challenge' ? toast.id : tr(toast.text, 'en')}
            role="status"
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed left-1/2 top-16 z-[72] flex w-max max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-full bg-[#3ccf91] px-5 py-3 font-bold text-white shadow-[0_12px_40px_-8px_rgba(60,207,145,0.8)]"
          >
            <span className="text-2xl" aria-hidden="true">
              {challenge$ ? challenge$.emoji : toast.kind === 'line' ? toast.emoji : ''}
            </span>
            <span className="min-w-0">{challenge$ ? `${tr(T.challengeDone, locale)} ${tr(challenge$.title, locale)}` : toast.kind === 'line' ? tr(toast.text, locale) : ''}</span>
            {toast.kind === 'line' && toast.visit ? (
              <button type="button" onClick={() => goWorld(toast.visit!)} className="h-11 shrink-0 rounded-full bg-white px-4 text-sm font-black text-[#24935f]">
                {tr(T.visit, locale)} {WORLD_INFO[toast.visit].emoji}
              </button>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {magic.length ? <MagicMoments moments={magic} locale={locale} onDone={() => setMagic([])} /> : null}
    </div>
  );
}
