'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { SayButton } from '@/components/arcade/read-aloud';
import { speak } from '@/lib/voice';
import { GIFT_CATEGORIES, SANTA_GIFTS, giftById, type GiftCategory } from '@/data/santa/gifts';
import { activeChild, santaStore, useSantaFamily } from '@/lib/santa/store';
import { ChildSetup } from '@/components/santa/ChildSetup';

const MAX_WISHES = 10;

const T = {
  title: { fr: 'Ma lettre au Père Noël', en: 'My letter to Santa' },
  pick: { fr: 'Touche les cadeaux que tu aimerais. Ils vont sur ta lettre !', en: 'Tap the gifts you would like. They go on your letter!' },
  dear: { fr: 'Cher Père Noël,', en: 'Dear Santa,' },
  body: { fr: 'Cette année, j’aimerais beaucoup :', en: 'This year, I would love:' },
  empty: { fr: 'Choisis tes cadeaux juste en dessous…', en: 'Pick your gifts just below…' },
  love: { fr: 'Plein de bisous,', en: 'Lots of love,' },
  sign: { fr: 'Signe avec ton doigt', en: 'Sign with your finger' },
  clear: { fr: 'Effacer', en: 'Clear' },
  send: { fr: 'Envoyer au Père Noël', en: 'Send to Santa' },
  full: { fr: 'Ta lettre est pleine ! Enlève un cadeau pour en mettre un autre.', en: 'Your letter is full! Remove a gift to add another one.' },
  flying: { fr: 'Ta lettre s’envole vers le Pôle Nord…', en: 'Your letter is flying to the North Pole…' },
  sent: { fr: 'Le Père Noël a reçu ta lettre !', en: 'Santa got your letter!' },
  sentText: { fr: 'Ziggy, son petit lutin, la lui a apportée. Écoute ce qu’il a à te dire !', en: 'Ziggy, his little elf, brought it to him. Listen to what he has to say!' },
  listen: { fr: 'Écouter le Père Noël', en: 'Listen to Santa' },
  call: { fr: 'Appeler le Père Noël', en: 'Call Santa' },
  edit: { fr: 'Modifier ma lettre', en: 'Edit my letter' },
  print: { fr: 'Imprimer la lettre', en: 'Print the letter' },
  remove: { fr: 'Enlever', en: 'Remove' },
  all: { fr: 'Tout', en: 'All' },
} satisfies Record<string, L>;

export function LetterBuilder() {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const family = useSantaFamily();
  const child = activeChild(family);
  const [cat, setCat] = useState<GiftCategory | 'all'>('all');
  const [stage, setStage] = useState<'write' | 'flying' | 'sent'>('write');
  const [full, setFull] = useState(false);
  const pad = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Restore the signature on the pad.
  useEffect(() => {
    const c = pad.current;
    if (!c || !child?.signature) return;
    const img = new Image();
    img.onload = () => c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
    img.src = child.signature;
  }, [child?.id, stage]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!child) return <ChildSetup purpose="letter" />;
  const wishes = child.wishes;

  const toggle = (id: string) => {
    const g = giftById(id);
    if (!g) return;
    if (wishes.includes(id)) {
      santaStore.updateChild(child.id, { wishes: wishes.filter((w) => w !== id) });
      setFull(false);
      return;
    }
    if (wishes.length >= MAX_WISHES) {
      setFull(true);
      return;
    }
    santaStore.updateChild(child.id, { wishes: [...wishes, id] });
    void speak(`gift-${id}`, tr(g.label, locale), locale);
  };

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * e.currentTarget.width, y: ((e.clientY - r.top) / r.height) * e.currentTarget.height };
  };
  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext('2d');
    const p = pos(e);
    if (!ctx || !last.current) return;
    ctx.strokeStyle = '#7a1f1f';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const endDraw = () => {
    drawing.current = false;
    last.current = null;
    const c = pad.current;
    if (c) santaStore.updateChild(child.id, { signature: c.toDataURL('image/png') });
  };
  const clearPad = () => {
    const c = pad.current;
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    santaStore.updateChild(child.id, { signature: null });
  };

  const send = () => {
    santaStore.updateChild(child.id, { letterSentAt: new Date().toISOString() });
    setStage('flying');
    setTimeout(() => setStage('sent'), reduced ? 300 : 2600);
  };

  const shown = cat === 'all' ? SANTA_GIFTS : SANTA_GIFTS.filter((g) => g.cat === cat);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-24 sm:px-6 sm:pt-28">
      <div className="flex items-center justify-center gap-3 text-center print:hidden">
        <h1 className="font-display text-4xl font-bold text-white text-balance drop-shadow-[0_3px_0_rgba(0,0,0,0.25)] sm:text-5xl">{tr(T.title, locale)}</h1>
        <SayButton texts={[tr(T.title, locale), tr(T.pick, locale)]} locale={locale} size="md" className="shrink-0" />
      </div>
      <p className="mt-3 text-center text-lg text-white/85 print:hidden">{tr(T.pick, locale)}</p>

      <AnimatePresence mode="wait">
        {stage === 'write' && (
          <motion.div key="write" exit={reduced ? undefined : { opacity: 0 }} className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
            {/* The letter (parchment) */}
            <div className="santa-letter relative mx-auto w-full max-w-lg rotate-[-1deg] rounded-[1.5rem] bg-[linear-gradient(180deg,#fffaf0,#fdf1d8)] p-6 text-[#4a2c12] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] ring-1 ring-[#e8d2a6] sm:p-8 lg:sticky lg:top-24">
              <div aria-hidden="true" className="pointer-events-none absolute inset-3 rounded-[1.1rem] border-2 border-dashed border-[#e4c48a]" />
              <span aria-hidden="true" className="absolute -right-3 -top-4 rotate-12 text-5xl drop-shadow">
                🎄
              </span>
              <p className="relative font-display text-2xl font-bold">{tr(T.dear, locale)}</p>
              <p className="relative mt-2 text-lg">{tr(T.body, locale)}</p>
              <ul className="relative mt-4 flex min-h-[7rem] flex-wrap gap-2">
                <AnimatePresence>
                  {wishes.length === 0 && (
                    <motion.li key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="self-center text-[#a07a4a]">
                      {tr(T.empty, locale)}
                    </motion.li>
                  )}
                  {wishes.map((id) => {
                    const g = giftById(id);
                    if (!g) return null;
                    return (
                      <motion.li key={id} layout initial={reduced ? false : { scale: 0.3, opacity: 0, rotate: -20 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.3, opacity: 0 }}>
                        <button
                          type="button"
                          onClick={() => toggle(id)}
                          className="group inline-flex min-h-12 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-base font-bold shadow-[0_3px_0_rgba(120,80,30,0.25)] ring-2 transition-transform active:scale-95"
                          style={{ ['--tw-ring-color' as string]: g.color }}
                          aria-label={`${tr(T.remove, locale)} : ${tr(g.label, locale)}`}
                        >
                          <span className="text-2xl" aria-hidden="true">
                            {g.emoji}
                          </span>
                          {tr(g.label, locale)}
                          <span aria-hidden="true" className="ms-1 text-sm text-[#b08050] group-hover:text-red-600">
                            ✕
                          </span>
                        </button>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
              <p className="relative mt-6 text-lg">{tr(T.love, locale)}</p>
              <p className="relative font-display text-3xl font-bold text-[#a8322d]">{child.name}</p>
              <div className="relative mt-3">
                <canvas
                  ref={pad}
                  width={600}
                  height={180}
                  className="h-28 w-full touch-none rounded-2xl bg-white/70 ring-2 ring-dashed ring-[#e4c48a] print:ring-0"
                  aria-label={tr(T.sign, locale)}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    drawing.current = true;
                    last.current = pos(e);
                  }}
                  onPointerMove={draw}
                  onPointerUp={endDraw}
                  onPointerCancel={endDraw}
                />
                <div className="mt-1.5 flex items-center justify-between text-sm text-[#a07a4a] print:hidden">
                  <span>✍️ {tr(T.sign, locale)}</span>
                  <button type="button" onClick={clearPad} className="min-h-10 rounded-full px-3 font-bold hover:bg-[#f3e2c0]">
                    {tr(T.clear, locale)}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={send}
                disabled={wishes.length === 0}
                className="relative mt-6 inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#c92a2a] to-[#f03e3e] px-6 font-display text-2xl font-bold text-white shadow-[0_8px_0_#8a1c1c] transition-transform active:translate-y-1 active:shadow-[0_3px_0_#8a1c1c] disabled:opacity-50 print:hidden"
              >
                ✉️ {tr(T.send, locale)}
              </button>
            </div>

            {/* Gift picker */}
            <div className="print:hidden">
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
                <button type="button" onClick={() => setCat('all')} aria-pressed={cat === 'all'} className={`min-h-12 shrink-0 rounded-full px-4 font-bold ${cat === 'all' ? 'bg-white text-[#1b2150]' : 'bg-white/15 text-white ring-1 ring-white/25'}`}>
                  ✨ {tr(T.all, locale)}
                </button>
                {GIFT_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCat(c.id)}
                    aria-pressed={cat === c.id}
                    className={`min-h-12 shrink-0 rounded-full px-4 font-bold ${cat === c.id ? 'bg-white text-[#1b2150]' : 'bg-white/15 text-white ring-1 ring-white/25'}`}
                  >
                    <span aria-hidden="true">{c.emoji}</span> {tr(c.label, locale)}
                  </button>
                ))}
              </div>
              {full && <p className="mt-3 rounded-2xl bg-amber-300/90 px-4 py-2 font-semibold text-[#3b1f00]">{tr(T.full, locale)}</p>}
              <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {shown.map((g) => {
                  const on = wishes.includes(g.id);
                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => toggle(g.id)}
                        aria-pressed={on}
                        className={`relative flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-3xl p-2 text-center text-white shadow-[0_6px_0_rgba(0,0,0,0.25)] transition-transform active:translate-y-1 active:shadow-none ${on ? 'ring-4 ring-amber-300' : 'ring-1 ring-white/20'}`}
                        style={{ background: `linear-gradient(160deg, ${g.color}, ${g.color}bb)` }}
                      >
                        <span className="text-4xl drop-shadow sm:text-5xl" aria-hidden="true">
                          {g.emoji}
                        </span>
                        <span className="text-xs font-bold leading-tight sm:text-sm">{tr(g.label, locale)}</span>
                        {on && (
                          <span className="absolute -right-1.5 -top-1.5 grid h-8 w-8 place-items-center rounded-full bg-amber-300 text-lg text-[#3b1f00] shadow" aria-hidden="true">
                            ✓
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        )}

        {stage === 'flying' && (
          <motion.div key="flying" className="relative mt-16 flex flex-col items-center text-center text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              className="text-[7rem] leading-none drop-shadow-[0_10px_20px_rgba(0,0,0,0.4)]"
              initial={{ y: 0, x: 0, rotate: 0, scale: 1 }}
              animate={reduced ? {} : { y: [-0, -40, -260], x: [0, 40, 220], rotate: [0, -10, 20], scale: [1, 1.1, 0.3] }}
              transition={{ duration: 2.4, ease: 'easeIn' }}
              aria-hidden="true"
            >
              💌
            </motion.div>
            <p className="mt-6 font-display text-2xl font-bold" aria-live="polite">
              {tr(T.flying, locale)}
            </p>
          </motion.div>
        )}

        {stage === 'sent' && (
          <motion.div key="sent" className="mx-auto mt-12 flex max-w-xl flex-col items-center text-center text-white" initial={reduced ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="text-[6rem] leading-none" aria-hidden="true">
              🎅📬
            </div>
            <div className="mt-4 flex items-center gap-3">
              <h2 className="font-display text-4xl font-bold text-balance">{tr(T.sent, locale)}</h2>
              <SayButton texts={[tr(T.sent, locale), tr(T.sentText, locale)]} locale={locale} size="md" className="shrink-0" />
            </div>
            <p className="mt-3 text-lg text-white/85">{tr(T.sentText, locale)}</p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
              <Link href="/pere-noel/appel?k=message" className="inline-flex min-h-16 items-center gap-2 rounded-full bg-[#2fb344] px-7 font-display text-xl font-bold shadow-lg">
                🎧 {tr(T.listen, locale)}
              </Link>
              <Link href="/pere-noel/appel" className="inline-flex min-h-16 items-center gap-2 rounded-full bg-gradient-to-r from-[#c92a2a] to-[#f03e3e] px-7 font-display text-xl font-bold shadow-lg">
                📞 {tr(T.call, locale)}
              </Link>
            </div>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setStage('write')} className="min-h-12 rounded-full bg-white/15 px-5 font-bold ring-1 ring-white/25">
                ✏️ {tr(T.edit, locale)}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStage('write');
                  setTimeout(() => window.print(), 400);
                }}
                className="min-h-12 rounded-full bg-white/15 px-5 font-bold ring-1 ring-white/25"
              >
                🖨️ {tr(T.print, locale)}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
