'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Eye, Delete, Check, Sparkles, Brain } from 'lucide-react';
import { buildDeck, sameAnswer, wordLanguage, DECKS, type DeckId, type MemoCard } from '@/lib/memo/decks';
import { pickSession, grade, againSoon, deckStats, nextDue, loadDeck, saveDeck, Rating, type DeckState, type Grade } from '@/lib/memo/scheduler';
import { recordGameResult } from '@/lib/progress';
import { playSound } from '@/lib/sound';
import { speak } from '@/lib/voice';
import { SpeakButton } from '@/components/ziggy/VoiceControls';
import { ZiggyAvatar } from '@/components/ziggy/Mascot';
import { EASE_OUT } from '@/lib/motion';

type Phase = 'decks' | 'review' | 'done';
type Reveal = { right: boolean | null } | null;

/**
 * The memory boxes: spaced repetition (FSRS) with active recall. The child
 * first tries to remember — typing the number, or saying the word in their
 * head — then sees the answer and says how it went. Every answer is a step:
 * "not yet" cards simply come back sooner.
 */
export function MemoApp() {
  const t = useTranslations('memo');
  const locale = useLocale();
  const [phase, setPhase] = useState<Phase>('decks');
  const [deckId, setDeckId] = useState<DeckId>('times');
  const [state, setState] = useState<DeckState>({});
  const [queue, setQueue] = useState<MemoCard[]>([]);
  const [typed, setTyped] = useState('');
  const [reveal, setReveal] = useState<Reveal>(null);
  const [tally, setTally] = useState({ seen: 0, recalled: 0 });
  const [stamp, setStamp] = useState(0); // re-read stats when coming back to the decks
  const [mounted, setMounted] = useState(false); // decks read this device's memory
  useEffect(() => setMounted(true), []);

  const card = queue[0];
  const color = DECKS.find((d) => d.id === deckId)?.color ?? '#22C55E';

  const begin = (id: DeckId) => {
    const deck = buildDeck(id, locale);
    const s = loadDeck(id);
    const session = pickSession(deck, s, new Date());
    playSound('tap');
    setDeckId(id);
    setState(s);
    setQueue(session);
    setTally({ seen: 0, recalled: 0 });
    setTyped('');
    setReveal(null);
    setPhase(session.length ? 'review' : 'done');
  };

  const answerWith = useCallback(
    (rating: Grade) => {
      if (!card) return;
      const now = new Date();
      const next = grade(state[card.id], rating, now);
      const nextState = { ...state, [card.id]: next };
      setState(nextState);
      saveDeck(deckId, nextState);
      setTally((x) => ({ seen: x.seen + 1, recalled: x.recalled + (rating === Rating.Again ? 0 : 1) }));
      // "Not yet" cards come back a little later in this same session.
      const rest = queue.slice(1);
      const again = againSoon(next, now) ? [...rest.slice(0, 3), card, ...rest.slice(3)] : rest;
      setQueue(again);
      setTyped('');
      setReveal(null);
      if (!again.length) {
        const accuracy = tally.seen + 1 ? (tally.recalled + (rating === Rating.Again ? 0 : 1)) / (tally.seen + 1) : 0;
        recordGameResult('memo', tally.seen + 1, accuracy >= 0.85 ? 3 : accuracy >= 0.6 ? 2 : 1);
        playSound('win');
        setPhase('done');
      }
    },
    [card, deckId, queue, state, tally]
  );

  const check = () => {
    if (!card) return;
    const right = sameAnswer(typed, card.answer);
    playSound(right ? 'correct' : 'wrong');
    setReveal({ right });
  };

  const showWord = () => {
    if (!card) return;
    setReveal({ right: null });
    void speak(`memo-${card.id}`, card.answer, wordLanguage(locale));
  };

  // Keyboard: digits, backspace and enter for number cards.
  useEffect(() => {
    if (phase !== 'review' || !card?.numeric || reveal) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setTyped((v) => (v.length < 3 ? v + e.key : v));
      if (e.key === 'Backspace') setTyped((v) => v.slice(0, -1));
      if (e.key === 'Enter' && typed) check();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, card, reveal, typed]);

  /* ── Deck chooser ── */
  if (phase === 'decks') {
    if (!mounted) return <div className="h-64" aria-busy="true" />;
    return (
      <div key={stamp} className="grid gap-4 md:grid-cols-3">
        {DECKS.map((d, i) => {
          const deck = buildDeck(d.id, locale);
          const s = loadDeck(d.id);
          const st = deckStats(deck, s, new Date());
          return (
            <motion.button
              key={d.id}
              type="button"
              onClick={() => begin(d.id)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3, ease: EASE_OUT }}
              className="press lift group relative overflow-hidden rounded-3xl border p-6 text-start"
              style={{ borderColor: `${d.color}40`, background: `linear-gradient(160deg, color-mix(in srgb, ${d.color} 12%, var(--color-bg-card)), var(--color-bg-card))` }}
            >
              <span className="text-5xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 inline-block">{d.emoji}</span>
              <p className="mt-3 font-display text-xl font-bold text-text-body">{t(`decks.${d.id}`)}</p>
              <p className="mt-1 text-sm text-text-muted">{t(`decks_desc.${d.id}`)}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-full px-2.5 py-1 text-white" style={{ backgroundColor: d.color }}>
                  {t('due', { count: st.due })}
                </span>
                <span className="rounded-full bg-border/40 px-2.5 py-1 text-text-muted">{t('fresh', { count: st.fresh })}</span>
                <span className="rounded-full bg-green/10 px-2.5 py-1 text-green">🧠 {t('long_term', { count: st.longTerm })}</span>
              </div>
              {/* Long-term memory gauge */}
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border/40">
                <div className="h-full rounded-full bg-green" style={{ width: `${(st.longTerm / st.total) * 100}%` }} />
              </div>
            </motion.button>
          );
        })}
      </div>
    );
  }

  /* ── Session done ── */
  if (phase === 'done' || !card) {
    const next = nextDue(state);
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto max-w-lg rounded-3xl border border-border/50 glass-strong p-8 text-center"
      >
        <ZiggyAvatar size={72} className="mx-auto" />
        <h2 className="mt-4 font-display text-3xl font-bold text-text-body">{tally.seen ? t('done_title') : t('nothing_due')}</h2>
        {tally.seen > 0 && <p className="mt-2 text-lg font-bold text-green">{t('done_score', { recalled: tally.recalled, seen: tally.seen })}</p>}
        <p className="mt-3 text-text-muted">
          {next ? t('come_back', { date: next.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }) }) : ''}
        </p>
        <p className="mt-4 rounded-2xl bg-apricot/15 px-4 py-3 text-sm font-semibold text-[#8a5a2b] dark:text-[#F3D3A8]">💡 {t('why')}</p>
        <button
          type="button"
          onClick={() => {
            setPhase('decks');
            setStamp((x) => x + 1);
          }}
          className="press mt-6 inline-flex items-center gap-2 rounded-full gradient-green-cta px-6 py-3 font-bold text-white"
        >
          <ArrowLeft size={16} className="rtl:rotate-180" /> {t('back')}
        </button>
      </motion.div>
    );
  }

  /* ── Review ── */
  const done = tally.seen;
  const total = done + queue.length;
  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setPhase('decks');
            setStamp((x) => x + 1);
          }}
          className="press rounded-full p-2 text-text-dim hover:text-text-body"
          aria-label={t('back')}
        >
          <ArrowLeft size={18} className="rtl:rotate-180" />
        </button>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-border/40">
          <motion.div className="h-full rounded-full" style={{ backgroundColor: color }} animate={{ width: `${(done / total) * 100}%` }} />
        </div>
        <span className="text-sm font-bold tabular-nums text-text-muted">
          {done}/{total}
        </span>
      </div>

      {/* The card flips to show the answer */}
      <div className="[perspective:1200px]">
        <motion.div
          key={card.id + done}
          initial={{ opacity: 0, y: 20, rotateX: -12 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ type: 'spring', duration: 0.5, bounce: 0.25 }}
          className="relative rounded-[2rem] border p-8 text-center shadow-[0_30px_60px_-30px_rgba(0,0,0,0.35)]"
          style={{ borderColor: `${color}55`, background: `linear-gradient(160deg, color-mix(in srgb, ${color} 10%, var(--color-bg-card)), var(--color-bg-card))` }}
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color }}>
            {card.numeric ? t('think_number') : t('think_word', { language: t(`languages.${wordLanguage(locale)}`) })}
          </p>
          <p className={`mt-4 font-display font-bold text-text-body ${card.numeric ? 'text-6xl sm:text-7xl tabular-nums' : 'text-8xl'}`} dir="ltr">
            {card.prompt}
          </p>

          {card.numeric && !reveal && (
            <p className="mt-5 h-14 font-display text-5xl font-bold tabular-nums" style={{ color }} aria-live="polite">
              {typed || <span className="text-border">?</span>}
            </p>
          )}

          <AnimatePresence>
            {reveal && (
              <motion.div
                initial={{ opacity: 0, rotateX: 90 }}
                animate={{ opacity: 1, rotateX: 0 }}
                transition={{ duration: 0.35, ease: EASE_OUT }}
                className="mt-5"
              >
                <p className="font-display text-5xl font-bold" style={{ color }} dir="ltr">
                  {card.answer}
                  {!card.numeric && (
                    <span className="ms-2 inline-flex align-middle">
                      <SpeakButton id={`memo-${card.id}`} text={card.answer} locale={wordLanguage(locale)} color={color} />
                    </span>
                  )}
                </p>
                {reveal.right !== null && (
                  <p className={`mt-2 font-bold ${reveal.right ? 'text-green' : 'text-[#B45309]'}`}>
                    {reveal.right ? `✨ ${t('right')}` : `🌱 ${t('not_yet_typed', { answer: card.answer })}`}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Controls */}
      <div className="mt-6">
        {!reveal && card.numeric && (
          <div className="mx-auto grid max-w-xs grid-cols-3 gap-2" dir="ltr">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setTyped((v) => (v.length < 3 ? v + d : v))}
                className="press h-14 rounded-2xl border border-border/60 bg-bg-card font-display text-2xl font-bold text-text-body"
              >
                {d}
              </button>
            ))}
            <button type="button" onClick={() => setTyped((v) => v.slice(0, -1))} className="press flex h-14 items-center justify-center rounded-2xl border border-border/60 bg-bg-card text-text-muted" aria-label="⌫">
              <Delete size={20} />
            </button>
            <button type="button" onClick={() => setTyped((v) => (v.length < 3 ? v + '0' : v))} className="press h-14 rounded-2xl border border-border/60 bg-bg-card font-display text-2xl font-bold text-text-body">
              0
            </button>
            <button
              type="button"
              onClick={check}
              disabled={!typed}
              className="press flex h-14 items-center justify-center rounded-2xl text-white disabled:opacity-40"
              style={{ backgroundColor: color }}
              aria-label={t('check')}
            >
              <Check size={22} strokeWidth={3} />
            </button>
          </div>
        )}

        {!reveal && !card.numeric && (
          <button
            type="button"
            onClick={showWord}
            className="press mx-auto flex items-center gap-2 rounded-full px-7 py-4 text-lg font-bold text-white"
            style={{ backgroundColor: color }}
          >
            <Eye size={20} /> {t('show')}
          </button>
        )}

        {reveal && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(reveal.right === false
              ? [{ r: Rating.Again, k: 'again', e: '🌱' }]
              : reveal.right === true
                ? [
                    { r: Rating.Hard, k: 'hard', e: '🤔' },
                    { r: Rating.Good, k: 'good', e: '😀' },
                    { r: Rating.Easy, k: 'easy', e: '🚀' },
                  ]
                : [
                    { r: Rating.Again, k: 'again', e: '🌱' },
                    { r: Rating.Hard, k: 'hard', e: '🤔' },
                    { r: Rating.Good, k: 'good', e: '😀' },
                    { r: Rating.Easy, k: 'easy', e: '🚀' },
                  ]
            ).map((b, i, arr) => (
              <motion.button
                key={b.k}
                type="button"
                onClick={() => answerWith(b.r as Grade)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`press rounded-2xl border border-border/60 bg-bg-card px-3 py-3 text-sm font-bold text-text-body ${arr.length === 1 ? 'col-span-2 sm:col-span-4' : ''}`}
              >
                <span className="block text-2xl">{b.e}</span>
                {t(`rate.${b.k}`)}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <p className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-text-dim">
        <Brain size={14} /> {t('fsrs')} <Sparkles size={12} />
      </p>
    </div>
  );
}
