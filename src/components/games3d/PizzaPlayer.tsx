'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { Link } from '@/i18n/navigation';
import type { PizzaGame, PizzaView, SayKind, Speaker } from '@/games3d/pizza/PizzaGame';
import {
  COINS,
  CUSTOMER_INFO,
  TOPPING_INFO,
  askText,
  coinsTotal,
  customerName,
  euro,
  fracGlyph,
  guessSkill,
  have,
  instructionText,
  orderText,
  payText,
  planGame,
  type Band,
  type Round,
  type ToppingId,
} from '@/games3d/pizza/logic';
import { getMemory, useHydrated, useWorldMemory } from '@/lib/world/store';
import { maxDifficulty, readAloudOn } from '@/lib/world/memory';
import { finishExtraGame } from '@/lib/world/play';
import type { MagicMoment } from '@/lib/world/engine';
import { speakSequence, stopSpeaking, unlockAudio } from '@/lib/voice';
import { tr, type L } from '@/lib/i18n-text';
import { SayButton } from '@/components/arcade/read-aloud';
import { MagicMoments, MomentChips } from '@/components/world/MagicMoments';
import { MascotCutout, ZiggyAvatar } from '@/components/ziggy/Mascot';

const T = {
  title: { fr: 'La Pizzeria de Ziggy', en: 'Ziggy’s Pizzeria' },
  teaser: {
    fr: 'Ziggy a ouvert un camion-pizza sur la place du village ! Garnis les pizzas des animaux affamés, enfourne-les… et régale tout le monde.',
    en: 'Ziggy opened a pizza truck on the village square! Top the hungry animals’ pizzas, bake them… and make everyone happy.',
  },
  how: {
    fr: 'Écoute la commande, touche les garnitures (ou la pizza), puis au four !',
    en: 'Listen to the order, tap the toppings (or the pizza), then bake it!',
  },
  play: { fr: 'Ouvrir la pizzeria', en: 'Open the pizzeria' },
  loading: { fr: 'Ziggy allume le four…', en: 'Ziggy is lighting the oven…' },
  back: { fr: 'Retour', en: 'Back' },
  music: { fr: 'Musique', en: 'Music' },
  bake: { fr: 'Au four !', en: 'Bake it!' },
  undo: { fr: 'Enlever', en: 'Undo' },
  give: { fr: 'Rendre', en: 'Give' },
  youGive: { fr: 'Tu rends', en: 'You give' },
  price: { fr: 'Prix', en: 'Price' },
  paid: { fr: 'Donné', en: 'Paid' },
  slices: { fr: 'Les parts', en: 'The slices' },
  slice: { fr: 'Part', en: 'Slice' },
  hello: { fr: 'Coucou !', en: 'Hello!' },
  baking: { fr: 'Ça cuit…', en: 'Baking…' },
  served: { fr: 'clients régalés', en: 'happy customers' },
  done: { fr: 'Bravo, la pizzeria a régalé tout le village !', en: 'Well done, the pizzeria fed the whole village!' },
  again: { fr: 'Rejouer', en: 'Play again' },
  noWebgl: { fr: 'Ce jeu en 3D a besoin de WebGL, qui n’est pas disponible sur cet appareil.', en: 'This 3D game needs WebGL, which this device does not support.' },
  order: { fr: 'Commande', en: 'Order' },
  total: { fr: 'en tout', en: 'in all' },
} satisfies Record<string, L>;

const FLOATERS = ['🍕', '🍅', '🍄', '🧀', '🫒', '🍍', '🌿', '🫑'];

function webglOk() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** A little pie: the slices of the pizza, coloured by their topping. */
function Pie({ parts, fill, lit, size }: { parts: number; fill: (i: number) => string | null; lit?: number; size: number }) {
  const c = size / 2;
  const r = size / 2 - 3;
  const pt = (a: number) => `${c + r * Math.sin(a)} ${c - r * Math.cos(a)}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={c} cy={c} r={r + 1.5} fill="#e9a54f" />
      {Array.from({ length: parts }, (_, i) => {
        const a0 = (i / parts) * Math.PI * 2;
        const a1 = ((i + 1) / parts) * Math.PI * 2;
        const d = parts === 1 ? '' : `M ${c} ${c} L ${pt(a0)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(a1)} Z`;
        return <path key={i} d={d} fill={fill(i) ?? '#f7d28e'} stroke={i === lit ? '#ff5c8a' : '#b8662a'} strokeWidth={i === lit ? 4 : 1.5} />;
      })}
    </svg>
  );
}

export function PizzaPlayer() {
  const raw = useLocale();
  const locale = raw === 'fr' ? 'fr' : 'en';
  const hydrated = useHydrated();
  const memory = useWorldMemory();
  const reduce = useReducedMotion();
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<PizzaGame | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'intro' | 'loading' | 'play' | 'result'>('intro');
  const [supported, setSupported] = useState(true);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [view, setView] = useState<PizzaView | null>(null);
  const [toast, setToast] = useState<{ text: string; sub?: string; who: Speaker; id: number; long: boolean } | null>(null);
  const [pop, setPop] = useState<{ n: number; t: ToppingId; id: number } | null>(null);
  const [xp, setXp] = useState<{ n: number; id: number } | null>(null);
  const [react, setReact] = useState<{ kind: 'surprised' | 'happy'; id: number } | null>(null);
  const [music, setMusic] = useState(true);
  const [focusSlice, setFocusSlice] = useState(-1);
  const [summary, setSummary] = useState<{ xp: number; stars: number[]; magic: MagicMoment[] }>({ xp: 0, stars: [], magic: [] });
  const [run, setRun] = useState(0);
  const roundsRef = useRef<Round[]>([]);

  useEffect(() => setSupported(webglOk()), []);

  const band: Band = (memory.age ?? 'middle') as Band;

  const speak = useCallback(
    (lines: string[], id: string) => {
      if (!readAloudOn(getMemory())) return;
      void speakSequence(id, lines.filter(Boolean), locale);
    },
    [locale]
  );

  const onSay = (lines: string[], kind: SayKind, who: Speaker) => {
    const r = roundsRef.current;
    const text = lines[0] ?? '';
    setToast({ text, sub: lines[1], who, id: Date.now(), long: kind === 'hint' || kind === 'order' || kind === 'yum' || kind === 'ask' || kind === 'pay' });
    const spoken = [...lines];
    // The very first order (and every order for little ones) comes with the "how to".
    if (kind === 'order') {
      const g = game.current?.debug();
      const round = g ? r[g.index] : undefined;
      if (round && (round.index === 0 || getMemory().age === 'little')) spoken.push(instructionText(round, locale));
    }
    speak(spoken, `pizza-${kind}`);
  };

  const start = async () => {
    unlockAudio();
    setPhase('loading');
    game.current?.dispose();
    game.current = null;
    const m = getMemory();
    const b = (m.age ?? 'middle') as Band;
    const skill = guessSkill(b);
    const level = Math.min(m.skills[skill]?.difficulty ?? 1, maxDifficulty(m));
    const plan = planGame(Math.floor(Math.random() * 1e6), b, level);
    roundsRef.current = plan;
    setRounds(plan);
    setSummary({ xp: 0, stars: [], magic: [] });
    setView(null);
    setToast(null);
    try {
      const { PizzaGame } = await import('@/games3d/pizza/PizzaGame');
      game.current = new PizzaGame(canvas.current!, plan, { locale, band: b }, {
        onState: setView,
        onSay: (lines, kind, who) => onSay(lines, kind, who),
        onCount: (n, t) => {
          setPop({ n, t, id: Date.now() });
          if (getMemory().age === 'little') speak([String(n)], 'pizza-count');
        },
        onReact: (kind) => setReact({ kind, id: Date.now() }),
        onRoundDone: (round, stats, ms) => {
          const o = finishExtraGame('pizza', round.skill, stats, ms);
          setXp({ n: o.xpGained, id: Date.now() });
          setSummary((s) => ({ xp: s.xp + o.xpGained, stars: [...s.stars, o.stars], magic: [...s.magic, ...o.magic] }));
        },
        onFinish: () => setPhase('result'),
      });
    } catch {
      setSupported(false);
      setPhase('intro');
      return;
    }
    game.current.setMusic(music);
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __pizza?: PizzaGame }).__pizza = game.current;
    setPhase('play');
    setRun((n) => n + 1);
  };


  useEffect(
    () => () => {
      game.current?.dispose();
      game.current = null;
      stopSpeaking();
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    // Long enough to read (or to hear): longer sentences stay longer.
    const len = toast.text.length + (toast.sub?.length ?? 0);
    const t = setTimeout(() => setToast(null), Math.min(10000, (toast.long ? 3200 : 2400) + len * 55));
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!pop) return;
    const t = setTimeout(() => setPop(null), 900);
    return () => clearTimeout(t);
  }, [pop]);
  useEffect(() => {
    if (!xp) return;
    const t = setTimeout(() => setXp(null), 3000);
    return () => clearTimeout(t);
  }, [xp]);
  useEffect(() => {
    if (!react) return;
    const t = setTimeout(() => setReact(null), 1500);
    return () => clearTimeout(t);
  }, [react]);

  // Tell the scene how much of the screen the HUD covers, so the pizza stays in view.
  useEffect(() => {
    if (phase !== 'play') return;
    const measure = () => {
      const top = topRef.current?.getBoundingClientRect().bottom ?? 0;
      const b = bottomRef.current?.getBoundingClientRect();
      const bottom = b && b.height > 0 ? window.innerHeight - b.top : 0;
      game.current?.setInsets(top, bottom);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (topRef.current) ro.observe(topRef.current);
    if (bottomRef.current) ro.observe(bottomRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [phase, view?.step, view?.round]);

  useEffect(() => {
    game.current?.highlightSlice(focusSlice);
  }, [focusSlice]);

  const round = view && view.round >= 0 ? rounds[view.round] : null;
  const step = view?.step ?? 'arrive';
  const g = () => game.current;

  /* ── The order, in pictures ── */
  const orderLine = round ? orderText(round, locale) : '';
  const helpLine = round ? instructionText(round, locale) : '';

  const renderOrder = () => {
    if (!round || !view) return null;
    const info = CUSTOMER_INFO[round.customer];
    const o = round.order;
    const sayTexts = step === 'ask' ? [askText(round, locale)] : step === 'pay' ? [payText(round, locale)] : [orderLine, helpLine];
    return (
      <div className="pointer-events-auto mx-auto flex w-full max-w-3xl items-center gap-2 rounded-[1.5rem] bg-white/92 p-2 shadow-[0_8px_30px_rgba(90,40,10,.18)] ring-1 ring-white sm:gap-3 sm:p-3 landscape:absolute landscape:left-2 landscape:top-[4.25rem] landscape:mx-0 landscape:w-[min(25rem,40vw)] sm:landscape:left-3 sm:landscape:top-[4.75rem]">
        <motion.span
          key={react?.id ?? 'still'}
          animate={react && !reduce ? (react.kind === 'surprised' ? { rotate: [0, -12, 12, -6, 0], y: [0, -6, 0] } : { scale: [1, 1.2, 1] }) : undefined}
          transition={{ duration: 0.6 }}
          className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#fff1e0] text-4xl sm:h-16 sm:w-16 sm:text-5xl"
          aria-hidden="true"
        >
          {info.emoji}
          {react ? <span className="absolute -right-2 -top-2 text-xl">{react.kind === 'surprised' ? '❓' : '❤️'}</span> : null}
        </motion.span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold uppercase tracking-wide text-[#b0682a]">
            {tr(T.order, locale)} · {customerName(round.customer, locale)}
          </p>
          {o.kind === 'count' ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {o.items.map((it) => {
                const hidden = o.hidden === it.topping;
                const n = have(o, view.pizza, it.topping);
                const e = TOPPING_INFO[it.topping].emoji;
                if (band === 'little' && it.n <= 6)
                  return (
                    <span key={it.topping} className="flex items-center gap-0.5" aria-label={`${n} / ${it.n} ${e}`}>
                      {Array.from({ length: it.n }, (_, i) => (
                        <span key={i} className={`grid h-9 w-9 place-items-center rounded-full text-2xl sm:h-10 sm:w-10 sm:text-3xl ${i < n ? 'bg-[#ffe9c9]' : 'opacity-35 grayscale-[0.4]'}`}>
                          {e}
                        </span>
                      ))}
                    </span>
                  );
                return (
                  <span key={it.topping} className="flex items-center gap-1 font-display text-2xl font-bold text-[#4a2a12] sm:text-3xl">
                    <span className={hidden ? 'text-[#ff5c8a]' : ''}>{hidden ? '?' : it.n}</span>
                    <span aria-hidden="true">{e}</span>
                  </span>
                );
              })}
              {o.total !== null ? (
                <span className="font-display text-2xl font-bold text-[#2f7d32] sm:text-3xl">
                  = {o.total} <span className="text-sm font-semibold">{tr(T.total, locale)}</span>
                </span>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {o.items.map((it) => (
                <span key={it.topping} className="flex items-center gap-1 font-display text-2xl font-bold text-[#4a2a12] sm:text-3xl">
                  <span>{fracGlyph(it.num, it.den)}</span>
                  <span aria-hidden="true">{TOPPING_INFO[it.topping].emoji}</span>
                </span>
              ))}
              <Pie parts={o.parts} size={44} lit={focusSlice} fill={(i) => (view.pizza.parts[i] ? TOPPING_INFO[view.pizza.parts[i]!].hex : null)} />
            </div>
          )}
          {band !== 'little' && step === 'build' ? <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-snug text-[#6b4a2a] sm:text-sm">{orderLine}</p> : null}
        </div>
        <SayButton texts={sayTexts} locale={locale} />
      </div>
    );
  };

  /* ── Panels ── */

  const toppingButtons = (counting: boolean) =>
    round?.choices.map((t, i) => {
      const n = view ? have(round.order, view.pizza, t) : 0;
      const sel = view?.selected === t;
      return (
        <motion.button
          key={t}
          type="button"
          whileTap={reduce ? undefined : { scale: 0.9 }}
          onClick={() => {
            unlockAudio();
            g()?.chooseTopping(t);
          }}
          data-tv-autofocus={i === 0 ? '' : undefined}
          aria-pressed={sel}
          aria-label={`${tr(TOPPING_INFO[t].label, locale)}${counting ? ` (${n})` : ''}`}
          className={`relative flex min-h-[72px] min-w-[64px] flex-1 flex-col items-center justify-center rounded-2xl px-1 py-1.5 shadow-sm transition sm:min-h-[84px] ${sel ? 'bg-[#fff1c2] ring-4 ring-[#ffb35c]' : 'bg-[#fff8ee] ring-1 ring-[#f3dcc0] hover:bg-[#fff1df]'}`}
        >
          <span className="text-4xl leading-none sm:text-5xl" aria-hidden="true">
            {TOPPING_INFO[t].emoji}
          </span>
          <span className={`mt-0.5 text-[11px] font-bold leading-tight text-[#6b4a2a] sm:text-xs ${band === 'little' ? 'sr-only' : ''}`}>{tr(TOPPING_INFO[t].label, locale)}</span>
          {counting && n > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 grid h-7 min-w-7 place-items-center rounded-full bg-[#ff5c8a] px-1 text-sm font-bold text-white shadow" aria-hidden="true">
              {n}
            </span>
          ) : null}
        </motion.button>
      );
    });

  const renderBuild = () => {
    if (!round || !view) return null;
    const o = round.order;
    return (
      <div className="pointer-events-auto w-full max-w-3xl rounded-[1.75rem] bg-white/92 p-2 shadow-[0_8px_30px_rgba(90,40,10,.22)] ring-1 ring-white sm:p-3" data-tv-stage="">
        <div className="flex gap-1.5 sm:gap-2" data-tv-row="" data-tv-wrap="false">
          {toppingButtons(o.kind === 'count')}
        </div>
        {o.kind === 'parts' ? (
          <div className="mt-2">
            <p className="mb-1 px-1 text-xs font-bold text-[#8a5a2a]">
              🍕 {tr(T.slices, locale)}
              {view.selected ? ` · ${TOPPING_INFO[view.selected].emoji}` : ''}
            </p>
            <div className={`grid gap-1.5 ${o.parts > 4 ? 'grid-cols-4' : o.parts === 4 ? 'grid-cols-4' : 'grid-cols-2'}`} data-tv-row="" data-tv-wrap="false">
              {view.pizza.parts.map((p, i) => (
                <motion.button
                  key={i}
                  type="button"
                  whileTap={reduce ? undefined : { scale: 0.9 }}
                  onClick={() => g()?.toggleSlice(i)}
                  onFocus={() => setFocusSlice(i)}
                  onBlur={() => setFocusSlice(-1)}
                  onMouseEnter={() => setFocusSlice(i)}
                  onMouseLeave={() => setFocusSlice(-1)}
                  aria-pressed={Boolean(p)}
                  aria-label={`${tr(T.slice, locale)} ${i + 1}${p ? ` : ${tr(TOPPING_INFO[p].label, locale)}` : ''}`}
                  className={`relative flex min-h-[64px] items-center justify-center gap-1 rounded-2xl px-1 py-1 ring-1 transition ${p ? 'bg-[#fff1c2] ring-[#ffb35c]' : 'bg-[#fff8ee] ring-[#f3dcc0]'}`}
                >
                  <Pie parts={o.parts} size={44} lit={i} fill={(k) => (k === i ? (p ? TOPPING_INFO[p].hex : '#ffe08a') : view.pizza.parts[k] ? '#f1d9b5' : '#fbecd4')} />
                  <span className="flex flex-col items-center leading-none">
                    <span className="font-display text-lg font-bold text-[#4a2a12]">{i + 1}</span>
                    <span className="text-xl" aria-hidden="true">
                      {p ? TOPPING_INFO[p].emoji : '·'}
                    </span>
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => g()?.undo()}
            disabled={!view.canUndo}
            className="flex min-h-[64px] min-w-[84px] items-center justify-center gap-1 rounded-2xl bg-[#f3ecff] px-3 font-bold text-[#5b3f8f] transition disabled:opacity-40"
          >
            <span aria-hidden="true">↩</span> {tr(T.undo, locale)}
          </button>
          {!round.autoFinish ? (
            <motion.button
              type="button"
              whileTap={reduce ? undefined : { scale: 0.94 }}
              onClick={() => g()?.bake()}
              className="flex min-h-[64px] flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ff8a3d] to-[#ec4a3f] px-4 font-display text-xl font-bold text-white shadow-[0_6px_20px_rgba(236,74,63,.4)]"
            >
              🔥 {tr(T.bake, locale)}
            </motion.button>
          ) : (
            <p className="flex flex-1 items-center gap-2 rounded-2xl bg-[#fff8ee] px-3 text-sm font-semibold text-[#6b4a2a]">
              <span aria-hidden="true">👆</span>
              <span className="line-clamp-2">{helpLine}</span>
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderAsk = () => {
    if (!round?.ask) return null;
    return (
      <div className="pointer-events-auto w-full max-w-xl rounded-[1.75rem] bg-white/92 p-3 shadow-[0_8px_30px_rgba(90,40,10,.22)] ring-1 ring-white" data-tv-stage="">
        <div className="mb-2 flex items-start gap-2">
          <p className="flex-1 text-base font-bold leading-snug text-[#4a2a12] sm:text-lg">{askText(round, locale)}</p>
          <SayButton texts={[askText(round, locale)]} locale={locale} size="sm" />
        </div>
        <div className="grid grid-cols-3 gap-2" data-tv-row="" data-tv-wrap="false">
          {round.ask.options.map((n, i) => (
            <motion.button
              key={n}
              type="button"
              whileTap={reduce ? undefined : { scale: 0.9 }}
              onClick={() => g()?.answerSum(n)}
              data-tv-autofocus={i === 0 ? '' : undefined}
              className="min-h-[72px] rounded-2xl bg-gradient-to-b from-[#fff3d6] to-[#ffe0a8] font-display text-4xl font-bold text-[#4a2a12] shadow ring-1 ring-[#f3c98a]"
            >
              {n}
            </motion.button>
          ))}
        </div>
      </div>
    );
  };

  const renderPay = () => {
    if (!round?.pay || !view) return null;
    const p = round.pay;
    const given = coinsTotal(view.coins);
    return (
      <div className="pointer-events-auto w-full max-w-xl rounded-[1.75rem] bg-white/92 p-3 shadow-[0_8px_30px_rgba(90,40,10,.22)] ring-1 ring-white" data-tv-stage="">
        <div className="mb-2 flex items-center justify-between gap-2 font-display text-lg font-bold text-[#4a2a12] sm:text-xl">
          <span>
            🍕 {tr(T.price, locale)} : {euro(p.price, locale)}
          </span>
          <span>
            💶 {tr(T.paid, locale)} : {euro(p.paid, locale)}
          </span>
        </div>
        <p className="mb-2 rounded-2xl bg-[#fff8ee] px-3 py-2 text-center font-display text-xl font-bold text-[#2f7d32]">
          {tr(T.youGive, locale)} : {view.coins.length ? `${view.coins.join(' + ')} = ` : ''}
          {euro(given, locale)}
        </p>
        <div className="grid grid-cols-3 gap-2" data-tv-row="" data-tv-wrap="false">
          {COINS.map((c, i) => (
            <motion.button
              key={c}
              type="button"
              whileTap={reduce ? undefined : { scale: 0.9 }}
              onClick={() => g()?.addCoin(c)}
              data-tv-autofocus={i === 0 ? '' : undefined}
              aria-label={euro(c, locale)}
              className={`grid min-h-[72px] place-items-center rounded-2xl font-display text-2xl font-bold shadow ring-1 ${c === 5 ? 'bg-[#cdeebf] text-[#2b5a2a] ring-[#9fd18b]' : 'bg-gradient-to-b from-[#ffe48a] to-[#f0c24a] text-[#6b4a12] ring-[#e0a92a]'}`}
            >
              {c === 5 ? '💶' : '🪙'} {euro(c, locale)}
            </motion.button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => g()?.undo()} disabled={!view.canUndo} className="min-h-[64px] min-w-[84px] rounded-2xl bg-[#f3ecff] px-3 font-bold text-[#5b3f8f] disabled:opacity-40">
            ↩ {tr(T.undo, locale)}
          </button>
          <motion.button
            type="button"
            whileTap={reduce ? undefined : { scale: 0.94 }}
            onClick={() => g()?.giveChange()}
            disabled={!view.coins.length}
            className="flex min-h-[64px] flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#4cc9b7] to-[#2fa596] font-display text-xl font-bold text-white shadow disabled:opacity-50"
          >
            ✓ {tr(T.give, locale)} {euro(given, locale)}
          </motion.button>
        </div>
      </div>
    );
  };

  const interactive = step === 'build' || step === 'ask' || step === 'pay';

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-[#ffe9c9] text-[#33264a]" data-tv-scope="">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full touch-none" aria-label={tr(T.title, locale)} />

      {phase === 'play' || phase === 'result' ? (
        <>
          {/* Top: bar and order */}
          <div ref={topRef} className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:p-3">
            <div className="pointer-events-auto mx-auto flex w-full max-w-3xl items-center gap-2 rounded-full bg-white/88 p-1.5 shadow-[0_6px_24px_rgba(90,40,10,.16)] ring-1 ring-white">
              <Link href="/monde" aria-label={tr(T.back, locale)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fff1e0] text-lg font-bold text-[#8a4a1a]">
                ←
              </Link>
              <div className="flex min-w-0 flex-1 items-center justify-center gap-1 sm:gap-1.5" aria-label={`${view?.served ?? 0} / ${rounds.length}`}>
                {rounds.map((r, i) => {
                  const done = (view?.served ?? 0) > i;
                  const now = view?.round === i && !done;
                  return (
                    <span
                      key={i}
                      className={`relative grid h-9 w-9 place-items-center rounded-full text-xl transition sm:h-10 sm:w-10 ${now ? 'scale-110 bg-[#ffe08a] ring-2 ring-[#ffb35c]' : done ? 'bg-[#d8f5d0]' : 'bg-[#f6efe6] opacity-60'}`}
                      aria-hidden="true"
                    >
                      {CUSTOMER_INFO[r.customer].emoji}
                      {done ? <span className="absolute -bottom-1 -right-1 text-xs">✅</span> : null}
                    </span>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  game.current?.setMusic(!music);
                  setMusic(!music);
                }}
                aria-pressed={music}
                aria-label={tr(T.music, locale)}
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg ${music ? 'bg-[#ffe08a]' : 'bg-[#f6efe6]'}`}
              >
                🎵
              </button>
            </div>
            {interactive && phase === 'play' ? renderOrder() : null}
          </div>

          {/* XP gain */}
          <AnimatePresence>
            {xp ? (
              <motion.div
                key={xp.id}
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                className="pointer-events-none absolute right-3 top-20 rounded-full bg-gradient-to-r from-amber-300 to-pink-300 px-4 py-2 text-base font-bold text-[#4a2350] shadow-lg sm:right-6 sm:top-24 sm:text-lg"
                role="status"
              >
                +{xp.n} XP ⭐
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Counting pop */}
          <AnimatePresence>
            {pop ? (
              <motion.div
                key={pop.id}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.3 }}
                transition={{ duration: reduce ? 0 : 0.22 }}
                className="pointer-events-none absolute left-1/2 top-[38%] flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/92 px-5 py-1.5 font-display text-5xl font-bold text-[#ff5c8a] shadow-xl"
                aria-hidden="true"
              >
                {pop.n} <span className="text-4xl">{TOPPING_INFO[pop.t].emoji}</span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Bottom: speech and panel */}
          {phase === 'play' ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-3">
              <AnimatePresence>
                {toast ? (
                  <motion.div
                    key={toast.id}
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    role="status"
                    className="pointer-events-none relative flex max-w-xl items-start gap-2 rounded-3xl bg-white px-3 py-2 text-sm font-bold shadow-xl ring-2 ring-[#ffd6b0] sm:text-base"
                  >
                    {toast.who === 'ziggy' ? (
                      <ZiggyAvatar size={30} ring={false} className="mt-0.5" />
                    ) : (
                      <span className="text-2xl leading-none" aria-hidden="true">
                        {CUSTOMER_INFO[toast.who].emoji}
                      </span>
                    )}
                    <span>
                      {toast.text}
                      {toast.sub ? <span className="mt-0.5 block text-xs font-semibold text-[#2f7d32] sm:text-sm">🥗 {toast.sub}</span> : null}
                    </span>
                  </motion.div>
                ) : null}
              </AnimatePresence>
              <div ref={bottomRef} className="flex w-full flex-col items-center">
                {step === 'build' ? renderBuild() : null}
                {step === 'ask' ? renderAsk() : null}
                {step === 'pay' ? renderPay() : null}
                {!interactive ? (
                  <motion.button
                    type="button"
                    onClick={() => game.current?.hello()}
                    whileTap={reduce ? undefined : { scale: 0.9 }}
                    data-tv-autofocus=""
                    className="pointer-events-auto flex min-h-[64px] items-center gap-2 rounded-full bg-white/90 px-5 font-bold text-[#8a4a1a] shadow-lg ring-1 ring-white"
                  >
                    <span className="text-3xl" aria-hidden="true">
                      {step === 'bake' ? '⏲️' : '👋'}
                    </span>
                    {step === 'bake' ? tr(T.baking, locale) : tr(T.hello, locale)}
                  </motion.button>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {/* End of the game */}
      {phase === 'result' ? (
        <div className="absolute inset-0 flex items-end justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-auto w-full max-w-md rounded-[2rem] bg-white/94 p-5 text-center shadow-2xl ring-1 ring-white"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pizza-done"
          >
            <div className="mx-auto -mt-2 mb-1 flex justify-center gap-1 text-3xl" aria-hidden="true">
              {rounds.map((r, i) => (
                <span key={i}>{CUSTOMER_INFO[r.customer].emoji}</span>
              ))}
            </div>
            <h2 id="pizza-done" className="font-display text-2xl font-bold text-[#4a2a12] sm:text-3xl">
              🍕 {tr(T.done, locale)}
            </h2>
            <p className="mt-2 text-lg font-bold text-[#6b4a2a]">
              ❤️ {summary.stars.length} {tr(T.served, locale)} · <span className="text-[#d0662a]">+{summary.xp} XP</span>
            </p>
            <div className="mt-3">
              <MomentChips moments={summary.magic} locale={locale} />
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => void start()}
                data-tv-autofocus=""
                className="min-h-[56px] rounded-full bg-gradient-to-r from-[#ff8a3d] to-[#ec4a3f] px-6 py-3 text-lg font-bold text-white shadow-[0_6px_20px_rgba(236,74,63,.4)]"
              >
                ↻ {tr(T.again, locale)}
              </button>
              <Link href="/monde" className="grid min-h-[56px] place-items-center rounded-full bg-[#fff1e0] px-6 py-3 text-lg font-bold text-[#8a4a1a]">
                {tr(T.back, locale)}
              </Link>
            </div>
            <MagicMoments key={run} moments={summary.magic} locale={locale} />
          </motion.div>
        </div>
      ) : null}

      {/* Intro */}
      {phase === 'intro' || phase === 'loading' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-gradient-to-b from-[#7fd3ff] via-[#ffe6c2] to-[#ffb38a] p-6 text-center [&>*:not(:first-child)]:relative">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {FLOATERS.concat(FLOATERS).map((e, i) => (
              <motion.span
                key={i}
                className="absolute text-3xl opacity-70"
                style={{ left: `${(i * 23 + 7) % 95}%`, top: `${(i * 37 + 11) % 90}%` }}
                animate={reduce ? undefined : { y: [0, -14, 0], rotate: [0, 10, 0] }}
                transition={{ duration: 3 + (i % 4), repeat: Infinity, delay: (i % 5) * 0.4 }}
              >
                {e}
              </motion.span>
            ))}
          </div>
          <motion.div className="relative h-40 w-40" animate={reduce ? undefined : { y: [0, -10, 0], rotate: [0, -3, 3, 0] }} transition={{ duration: 3, repeat: Infinity }} aria-hidden="true">
            <div className="grid h-full w-full place-items-end justify-center overflow-hidden rounded-full bg-white/75 shadow-[0_20px_60px_rgba(255,140,80,.45)] ring-8 ring-white/70">
              <MascotCutout pose="wave" width={128} glow={false} className="translate-y-3" />
            </div>
            <span className="absolute -bottom-1 -right-2 text-5xl">🍕</span>
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-4xl">👨‍🍳</span>
          </motion.div>
          <h1 className="font-display text-4xl font-bold text-[#4a2a12] drop-shadow-sm sm:text-6xl">{tr(T.title, locale)}</h1>
          <p className="max-w-lg text-lg font-semibold text-[#6b4a2a]">{tr(T.teaser, locale)}</p>
          <div className="flex items-center gap-2 text-3xl" aria-hidden="true">
            {(['🦒', '🐻', '🐰', '🐘', '🐧'] as const).map((e) => (
              <span key={e} className="grid h-14 w-14 place-items-center rounded-2xl bg-white/90 shadow">
                {e}
              </span>
            ))}
          </div>
          <p className="flex max-w-md items-center gap-2 text-sm font-semibold text-[#6b4a2a]">
            {tr(T.how, locale)}
            <SayButton texts={[tr(T.teaser, locale), tr(T.how, locale)]} locale={locale} size="sm" />
          </p>
          {supported ? (
            <button
              type="button"
              disabled={!hydrated || phase === 'loading'}
              onClick={() => void start()}
              data-tv-autofocus=""
              className="mt-1 min-h-[64px] rounded-full bg-gradient-to-r from-[#ff8a3d] to-[#ec4a3f] px-10 py-4 text-xl font-bold text-white shadow-[0_10px_40px_rgba(236,74,63,.45)] transition hover:scale-105 disabled:opacity-60"
            >
              {phase === 'loading' ? tr(T.loading, locale) : `🍕 ${tr(T.play, locale)}`}
            </button>
          ) : (
            <p className="rounded-2xl bg-white/90 px-4 py-3 font-semibold">{tr(T.noWebgl, locale)}</p>
          )}
          <Link href="/monde" className="text-sm font-semibold text-[#6b4a2a] underline">
            ← {tr(T.back, locale)}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
