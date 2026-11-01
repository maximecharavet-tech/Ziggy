'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { ArrowLeft, Download, Heart, Minus, MoreHorizontal, Plus, Printer, Redo2, Trash2, Undo2, Wand2 } from 'lucide-react';
import { SayButton, useAutoSay, useSay } from '@/components/arcade/read-aloud';
import { tr, type L } from '@/lib/i18n-text';
import { playSound } from '@/lib/sound';
import { artStore } from '@/coloring/art-db';
import { canRedo, canUndo, createHistory, push, redo, undo, type History } from '@/coloring/history';
import { cheerFor, filledRatio } from '@/coloring/milestones';
import { SURPRISE_PALETTES, colorName } from '@/coloring/palette';
import { downloadCanvas, fileName, renderArtwork, thumbnail } from '@/coloring/raster';
import { STICKERS, STICKER_DEFAULT, clampStickerSize } from '@/coloring/stickers';
import { hasContent, newId } from '@/coloring/storage';
import { T } from '@/coloring/text';
import { emptyDrawing, type ColoringPage, type Drawing, type Tool } from '@/coloring/types';
import { ComeAlive } from './ComeAlive';
import { PageArt } from './PageArt';
import { Palette } from './Palette';
import { PrintDialog } from './PrintDialog';
import { Stage, type CommitKind, type StageApi } from './Stage';
import { IconButton, ZiggyCheer } from './ui';
import { Ziggy3D } from '@/components/ziggy3d/Ziggy3D';
import { Burst } from '@/components/create/fx/Burst';
import { Glyph } from '@/components/create/fx/ZiggyMark';

const SIZES: { id: 'S' | 'M' | 'L'; px: number; label: L; dot: number }[] = [
  { id: 'S', px: 8, label: T.small, dot: 10 },
  { id: 'M', px: 16, label: T.medium, dot: 18 },
  { id: 'L', px: 30, label: T.large, dot: 28 },
];

const TOOLS: { id: Tool; emoji: string; label: L; say: L; short?: L }[] = [
  { id: 'fill', emoji: '🪣', label: T.fill, say: T.fillSay },
  { id: 'brush', emoji: '🖌️', label: T.brush, say: T.brushSay },
  { id: 'rainbow', emoji: '🌈', label: T.rainbow, say: T.rainbowSay, short: T.rainbowShort },
  { id: 'glitter', emoji: '✨', label: T.glitter, say: T.glitterSay },
  { id: 'eraser', emoji: '🧽', label: T.eraser, say: T.eraserSay },
  { id: 'sticker', emoji: '⭐', label: T.sticker, say: T.stickerSay },
];

export type StudioExit = { saved: boolean };

export function Studio({ page, locale, artId, initial, createdAt, onExit }: { page: ColoringPage; locale: string; artId?: string; initial?: Drawing; createdAt?: number; onExit: (r: StudioExit) => void }) {
  const reduce = useReducedMotion() ?? false;
  const say = useSay();
  const [hist, setHist] = useState<History<Drawing>>(() => createHistory(initial ?? emptyDrawing()));
  const [preview, setPreview] = useState<Drawing | null>(null);
  const [tool, setTool] = useState<Tool>('fill');
  const [color, setColor] = useState('red');
  const [sizeId, setSizeId] = useState<'S' | 'M' | 'L'>('M');
  const [sticker, setSticker] = useState(STICKERS[0].e);
  const [stickerSize, setStickerSize] = useState(STICKER_DEFAULT);
  const [selected, setSelected] = useState<string | null>(null);
  const [model, setModel] = useState(false);
  const [cheer, setCheer] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [aliveOpen, setAliveOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [stageSize, setStageSize] = useState(0);
  const [thumb, setThumb] = useState<string | undefined>();
  const [party, setParty] = useState(0);
  const [hooray, setHooray] = useState(false);
  const partyCue = useMemo(() => ({ kind: 'cheer' as const, id: party }), [party]);

  const area = useRef<HTMLDivElement>(null);
  const stageApi = useRef<StageApi>(null);
  const id = useRef(artId ?? newId('art'));
  const born = useRef(createdAt ?? Date.now());
  const savedDrawing = useRef<Drawing>(hist.present);
  const actions = useRef(0);
  const magicRuns = useRef(0);
  const histRef = useRef(hist);
  histRef.current = hist;

  const drawing = preview ?? hist.present;
  const regionIds = useMemo(() => page.regions.map((r) => r.id), [page]);
  const title = tr(page.title, locale);

  useAutoSay(`studio-${page.id}`, [title, tr(T.instruction, locale)]);

  // Immersive: no page scroll behind the studio.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev;
    };
  }, []);

  // The drawing is a square that fits the space left by the tools.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const fit = () => setStageSize(Math.max(160, Math.floor(Math.min(el.clientWidth, el.clientHeight)) - 18));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Ziggy pops in to cheer for a finished page, then goes back.
  useEffect(() => {
    if (!hooray) return;
    const t = window.setTimeout(() => setHooray(false), 5200);
    return () => window.clearTimeout(t);
  }, [hooray]);

  useEffect(() => {
    if (!confirmClear) return;
    const t = window.setTimeout(() => setConfirmClear(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirmClear]);

  const cheerUp = useCallback(
    (prev: Drawing, next: Drawing, count: number) => {
      const c = cheerFor({ actions: count - 1, ratio: filledRatio(regionIds, prev.fills) }, { actions: count, ratio: filledRatio(regionIds, next.fills) });
      if (!c) return;
      const text = tr(c.text, locale);
      setCheer(text);
      say('cheer', text);
      playSound(c.kind === 'done' ? 'win' : 'star');
      if (c.kind === 'done') {
        setParty((n) => n + 1);
        setHooray(true);
      }
    },
    [regionIds, locale, say]
  );

  const commit = useCallback(
    (next: Drawing, kind: CommitKind) => {
      const prev = histRef.current.present;
      setHist((h) => push(h, next));
      actions.current += 1;
      if (kind === 'fill') playSound('pop');
      else if (kind === 'sticker') playSound('tap');
      cheerUp(prev, next, actions.current);
    },
    [cheerUp]
  );

  const doUndo = useCallback(() => {
    if (preview) return;
    setHist((h) => undo(h));
    playSound('tap');
  }, [preview]);
  const doRedo = useCallback(() => {
    if (preview) return;
    setHist((h) => redo(h));
    playSound('tap');
  }, [preview]);

  const removeSelected = useCallback(() => {
    if (!selected) return;
    const d = histRef.current.present;
    commit({ ...d, stickers: d.stickers.filter((s) => s.id !== selected) }, 'erase');
    setSelected(null);
  }, [selected, commit]);

  const resizeSelected = (delta: number) => {
    const next = clampStickerSize(stickerSize + delta);
    setStickerSize(next);
    if (!selected) return;
    const d = histRef.current.present;
    commit({ ...d, stickers: d.stickers.map((s) => (s.id === selected ? { ...s, s: clampStickerSize(s.s + delta) } : s)) }, 'sticker');
  };

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (printOpen || aliveOpen) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        doRedo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected && tool === 'sticker') {
        e.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doUndo, doRedo, removeSelected, selected, tool, printOpen, aliveOpen]);

  const pickTool = (t: (typeof TOOLS)[number]) => {
    setTool(t.id);
    if (t.id !== 'sticker') setSelected(null);
    playSound('tap');
    say('tool', tr(t.label, locale), tr(t.say, locale));
  };

  const pickColor = (c: string) => {
    setColor(c);
    if (tool === 'eraser' || tool === 'sticker' || tool === 'rainbow') setTool(tool === 'sticker' ? 'fill' : tool === 'eraser' ? 'fill' : 'brush');
    if (model) setModel(false);
    playSound('tap');
    const name = colorName(c);
    if (name) say('color', `${tr(name, locale)} !`);
  };

  const toggleModel = () => {
    const on = !model;
    setModel(on);
    if (on) setTool('fill');
    playSound('tap');
    say('model', tr(on ? T.modelOn : T.modelOff, locale));
  };

  const magicFill = () => {
    if (preview) return;
    const run = magicRuns.current++;
    const palette = run === 0 ? null : SURPRISE_PALETTES[(run - 1) % SURPRISE_PALETTES.length];
    const base = histRef.current.present;
    const target: Record<string, string> = {};
    page.regions.forEach((r, i) => {
      target[r.id] = palette ? palette[(i * 3 + run) % palette.length] : r.c;
    });
    playSound('reward');
    say('magic', tr(T.magicSay, locale));
    const final: Drawing = { ...base, fills: { ...base.fills, ...target } };
    if (reduce) {
      commit(final, 'fill');
      return;
    }
    const order = page.regions.map((r) => r.id);
    const step = Math.max(14, Math.min(70, 1900 / order.length));
    let i = 0;
    const fills = { ...base.fills };
    setPreview({ ...base, fills });
    const tick = () => {
      const batch = Math.max(1, Math.round(16 / step));
      for (let k = 0; k < batch && i < order.length; k++, i++) {
        fills[order[i]] = target[order[i]];
        if (i % 3 === 0) stageApi.current?.burstRegion(order[i]);
      }
      setPreview({ ...base, fills: { ...fills } });
      if (i < order.length) window.setTimeout(tick, step);
      else {
        setPreview(null);
        commit(final, 'fill');
      }
    };
    window.setTimeout(tick, step);
  };

  const clearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      playSound('tap');
      say('clear', tr(T.clearSure, locale));
      return;
    }
    setConfirmClear(false);
    setMoreOpen(false);
    setSelected(null);
    setHist((h) => push(h, emptyDrawing()));
    playSound('pop');
  };

  const save = async (silent: boolean): Promise<boolean> => {
    const d = histRef.current.present;
    if (!hasContent(d)) return true;
    try {
      const canvas = await renderArtwork(page, d, 640);
      const th = thumbnail(canvas, 320);
      setThumb(th);
      const res = await artStore().put({ id: id.current, pageId: page.id, createdAt: born.current, updatedAt: Date.now(), drawing: d, thumb: th });
      if (res.ok) {
        savedDrawing.current = d;
        if (!silent) {
          setToast({ text: tr(T.saved, locale), ok: true });
          playSound('correct');
          say('saved', tr(T.saved, locale));
        }
        return true;
      }
      setToast({ text: tr(res.reason === 'quota' ? T.saveFull : T.saveFail, locale), ok: false });
      return false;
    } catch {
      setToast({ text: tr(T.saveFail, locale), ok: false });
      return false;
    }
  };

  const exit = async () => {
    const d = histRef.current.present;
    let saved = false;
    if (d !== savedDrawing.current && hasContent(d)) saved = await save(true);
    onExit({ saved });
  };

  const download = async () => {
    setMoreOpen(false);
    const canvas = await renderArtwork(page, histRef.current.present, 1600);
    await downloadCanvas(canvas, fileName(page.id));
    playSound('correct');
  };

  const openPrint = async () => {
    setMoreOpen(false);
    try {
      setThumb(thumbnail(await renderArtwork(page, histRef.current.present, 640), 320));
    } catch {
      /* the dialog shows the model instead */
    }
    setPrintOpen(true);
  };

  const brushy = tool === 'brush' || tool === 'rainbow' || tool === 'glitter' || tool === 'eraser';
  const toolSay = TOOLS.find((t) => t.id === tool)!;
  const sizePx = SIZES.find((s) => s.id === sizeId)!.px;

  const secondary = (
    <>
      <IconButton label={tr(T.print, locale)} onClick={() => void openPrint()}>
        <Printer size={24} aria-hidden="true" />
      </IconButton>
      <IconButton label={tr(T.download, locale)} onClick={() => void download()}>
        <Download size={24} aria-hidden="true" />
      </IconButton>
      <IconButton label={confirmClear ? tr(T.clearSure, locale) : tr(T.clear, locale)} onClick={clearAll} tone={confirmClear ? 'danger' : 'plain'} showLabel={confirmClear} className={confirmClear ? 'px-3' : ''}>
        <Trash2 size={24} aria-hidden="true" />
      </IconButton>
    </>
  );

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex flex-col bg-[radial-gradient(circle_at_15%_0%,#FFE9F4_0%,transparent_45%),radial-gradient(circle_at_100%_100%,#DDF3FF_0%,transparent_50%),linear-gradient(180deg,#FBF7FF,#F3EEFF)] text-[#1A1A2E] dark:bg-[radial-gradient(circle_at_15%_0%,#2a1840_0%,transparent_45%),radial-gradient(circle_at_100%_100%,#0f2a3d_0%,transparent_50%),linear-gradient(180deg,#120f26,#0d0b1e)] dark:text-white"
      initial={{ opacity: 0, scale: reduce ? 1 : 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
    >
      {/* Top bar */}
      <header className="flex items-center gap-1.5 px-2 pb-2 pt-[max(env(safe-area-inset-top),0.6rem)] sm:gap-2 sm:px-4">
        <IconButton label={tr(T.back, locale)} onClick={() => void exit()}>
          <ArrowLeft size={26} aria-hidden="true" />
        </IconButton>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h1 className="hidden min-w-0 truncate font-display text-xl font-bold text-[#3B2A7A] dark:text-white sm:block lg:text-2xl">
            <span aria-hidden="true">
              <Glyph e={page.emoji} size={30} />{' '}
            </span>
            {title}
          </h1>
          <h1 className="sr-only sm:hidden">{title}</h1>
        </div>
        <IconButton label={tr(T.undo, locale)} onClick={doUndo} disabled={!canUndo(hist) || !!preview}>
          <Undo2 size={26} aria-hidden="true" />
        </IconButton>
        <IconButton label={tr(T.redo, locale)} onClick={doRedo} disabled={!canRedo(hist) || !!preview}>
          <Redo2 size={26} aria-hidden="true" />
        </IconButton>
        <div className="hidden items-center gap-2 md:flex">{secondary}</div>
        <IconButton label={tr(T.save, locale)} onClick={() => void save(false)}>
          <Heart size={26} className="text-[#E83E8C]" fill="#FBA8D2" aria-hidden="true" />
        </IconButton>
        <IconButton label={tr(T.alive, locale)} onClick={() => setAliveOpen(true)} tone="accent" className="sm:px-4">
          <span className="flex items-center gap-1.5 text-base">
            <Wand2 size={24} aria-hidden="true" />
            <span className="hidden font-display text-base font-bold sm:inline">{tr(T.alive, locale)}</span>
          </span>
        </IconButton>
        <div className="relative md:hidden">
          <IconButton label={tr(T.more, locale)} onClick={() => setMoreOpen((o) => !o)} active={moreOpen} pressed={moreOpen}>
            <MoreHorizontal size={26} aria-hidden="true" />
          </IconButton>
          <AnimatePresence>
            {moreOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.95 }}
                transition={{ duration: 0.18 }}
                className="absolute end-0 top-16 z-30 flex gap-2 rounded-3xl bg-white/95 p-2 shadow-xl ring-1 ring-black/5 dark:bg-[#1b1640]"
              >
                {secondary}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:px-4 landscape:flex-row landscape:gap-3">
        {/* Tools */}
        <nav aria-label={tr(T.tools, locale)} className="order-3 flex shrink-0 gap-2 overflow-x-auto p-1 landscape:order-1 landscape:flex-col landscape:overflow-y-auto landscape:overflow-x-hidden">
          {TOOLS.map((t) => (
            <IconButton key={t.id} label={tr(t.label, locale)} onClick={() => pickTool(t)} active={tool === t.id && !(model && t.id === 'fill')} pressed={tool === t.id} showLabel short={t.short && tr(t.short, locale)} className="h-16 w-[4.4rem]">
              <span className="text-2xl" aria-hidden="true">
                {t.id === 'sticker' ? sticker : t.emoji}
              </span>
            </IconButton>
          ))}
          <span aria-hidden="true" className="mx-1 w-px shrink-0 self-stretch bg-black/10 landscape:mx-0 landscape:my-1 landscape:h-px landscape:w-auto dark:bg-white/10" />
          <IconButton label={tr(T.model, locale)} onClick={toggleModel} active={model} pressed={model} showLabel className="h-16 w-[4.4rem]">
            <span className="text-2xl" aria-hidden="true">
              🖼️
            </span>
          </IconButton>
          <IconButton label={tr(T.magic, locale)} onClick={magicFill} disabled={!!preview} showLabel className="h-16 w-[4.4rem]">
            <span className="text-2xl" aria-hidden="true">
              🪄
            </span>
          </IconButton>
        </nav>

        {/* The drawing */}
        <section ref={area} className="relative order-1 flex min-h-0 min-w-0 flex-1 items-center justify-center landscape:order-2">
          <div className="relative" style={{ width: stageSize, height: stageSize }}>
            {/* The drawing board under the paper */}
            <div aria-hidden="true" className="absolute -inset-[9px] rounded-[2.2rem] bg-[linear-gradient(160deg,#ffffff,#efe6ff)] shadow-[inset_0_2px_0_#fff,0_8px_0_#d9ccf5,0_30px_50px_-24px_rgba(76,52,160,0.55)] dark:bg-[linear-gradient(160deg,#2a2552,#1c1840)] dark:shadow-[0_8px_0_#0e0b22,0_30px_50px_-24px_rgba(0,0,0,0.7)]" />
            {stageSize > 0 && (
              <Stage
                page={page}
                drawing={drawing}
                commit={commit}
                tool={tool}
                color={color}
                brushSize={sizePx}
                sticker={sticker}
                stickerSize={stickerSize}
                modelMode={model}
                selectedSticker={selected}
                onSelectSticker={setSelected}
                label={`${title}. ${tr(T.stage, locale)}`}
                reduced={reduce}
                apiRef={stageApi}
              />
            )}
            {preview && <div className="absolute inset-0 z-10 cursor-wait" aria-hidden="true" />}
            <div className="absolute end-2 top-2 z-10">
              <SayButton texts={[tr(toolSay.label, locale), tr(model ? T.modelOn : toolSay.say, locale)]} locale={locale} size="md" className="bg-white/90 shadow-md" />
            </div>
            <AnimatePresence>
              {model && (
                <motion.button
                  type="button"
                  onClick={toggleModel}
                  aria-label={tr(T.model, locale)}
                  initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
                  animate={{ opacity: 1, scale: 1, rotate: -4 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ type: 'spring', duration: 0.45, bounce: 0.35 }}
                  className="absolute -start-1 -top-1 z-10 w-[26%] min-w-24 max-w-40 rounded-2xl bg-white p-1.5 shadow-xl ring-2 ring-[#B07CFF]"
                >
                  <PageArt page={page} model className="aspect-square overflow-hidden rounded-xl" />
                  <span className="mt-1 block text-center font-display text-xs font-bold text-[#5B3FA8]">🖼️ {tr(T.model, locale)}</span>
                </motion.button>
              )}
            </AnimatePresence>
            <ZiggyCheer text={cheer} onDone={() => setCheer(null)} />
            <Burst fire={party} kind="confetti" count={28} spread={2.2} />
            <AnimatePresence>
              {hooray && !aliveOpen ? (
                <motion.div
                  key={party}
                  initial={reduce ? { opacity: 0 } : { y: 120, opacity: 0, rotate: -8 }}
                  animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1, rotate: 0 }}
                  exit={reduce ? { opacity: 0 } : { y: 140, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 160, damping: 15 }}
                  className="pointer-events-none absolute -bottom-3 end-2 z-20 h-40 w-32 sm:h-52 sm:w-40"
                >
                  <Ziggy3D className="h-full w-full" idle="dance" cue={partyCue} framing="full" fallback="wave" followPointer={false} />
                </motion.div>
              ) : null}
            </AnimatePresence>
            <AnimatePresence>
              {toast && (
                <motion.div
                  role="status"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className={`absolute inset-x-4 bottom-4 z-20 mx-auto max-w-sm rounded-2xl px-4 py-3 text-center font-display text-base font-semibold shadow-xl ${toast.ok ? 'bg-[#ECFDF3] text-[#166534]' : 'bg-[#FFF1F2] text-[#9F1239]'}`}
                >
                  {toast.ok ? '💖 ' : '🙈 '}
                  {toast.text}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Options + colours */}
        <aside className="order-2 flex min-h-0 shrink-0 flex-col gap-2 landscape:order-3 landscape:w-[13.5rem]">
          <AnimatePresence initial={false} mode="popLayout">
            {brushy && (
              <motion.div key="sizes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="group" aria-label={tr(T.size, locale)} className="flex shrink-0 items-center justify-center gap-2 rounded-3xl bg-white/70 p-1.5 ring-1 ring-black/5 dark:bg-white/5">
                {SIZES.map((s) => (
                  <IconButton key={s.id} label={tr(s.label, locale)} onClick={() => setSizeId(s.id)} active={sizeId === s.id} pressed={sizeId === s.id}>
                    <span aria-hidden="true" className="rounded-full bg-[#3B2A7A] dark:bg-white" style={{ width: s.dot, height: s.dot }} />
                  </IconButton>
                ))}
              </motion.div>
            )}
            {tool === 'sticker' && (
              <motion.div key="stickers" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex min-h-0 shrink-0 flex-col gap-2 rounded-3xl bg-white/70 p-1.5 ring-1 ring-black/5 dark:bg-white/5 landscape:shrink">
                <div className="flex items-center justify-center gap-2">
                  <IconButton label={tr(T.smaller, locale)} onClick={() => resizeSelected(-14)}>
                    <Minus size={22} aria-hidden="true" />
                  </IconButton>
                  <IconButton label={tr(T.bigger, locale)} onClick={() => resizeSelected(14)}>
                    <Plus size={22} aria-hidden="true" />
                  </IconButton>
                  <IconButton label={tr(T.removeSticker, locale)} onClick={removeSelected} disabled={!selected}>
                    <Trash2 size={22} aria-hidden="true" />
                  </IconButton>
                </div>
                <div role="group" aria-label={tr(T.sticker, locale)} className="flex gap-1.5 overflow-x-auto landscape:grid landscape:grid-cols-3 landscape:overflow-y-auto landscape:overflow-x-hidden">
                  {STICKERS.map((s) => (
                    <IconButton
                      key={s.e}
                      label={tr(s.name, locale)}
                      onClick={() => {
                        setSticker(s.e);
                        playSound('tap');
                        say('sticker', tr(s.name, locale));
                      }}
                      active={sticker === s.e}
                      pressed={sticker === s.e}
                    >
                      <span className="text-[1.7rem] leading-none" aria-hidden="true">
                        {s.e}
                      </span>
                    </IconButton>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {tool !== 'sticker' && (
            <div className={`min-h-0 rounded-3xl bg-white/70 ring-1 ring-black/5 dark:bg-white/5 landscape:flex-1 landscape:overflow-hidden ${tool === 'rainbow' || tool === 'eraser' || model ? 'opacity-60' : ''}`}>
              <Palette value={color} onPick={pickColor} locale={locale} />
            </div>
          )}
        </aside>
      </main>

      <PrintDialog open={printOpen} onClose={() => setPrintOpen(false)} page={page} drawing={hist.present} thumb={thumb} locale={locale} />
      <ComeAlive open={aliveOpen} onClose={() => setAliveOpen(false)} page={page} drawing={hist.present} locale={locale} />
    </motion.div>
  );
}
