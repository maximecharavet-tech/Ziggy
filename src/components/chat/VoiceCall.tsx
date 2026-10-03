'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneOff, Mic, Hand } from 'lucide-react';
import { listenOnce, micSupported, speakSequence, stopSpeaking, unlockAudio } from '@/lib/voice';
import { splitSentences, isNoise } from '@/lib/speech-text';
import { isMuted } from '@/lib/sound';
import { EASE_OUT } from '@/lib/motion';

type Phase = 'ready' | 'listening' | 'thinking' | 'speaking' | 'paused' | 'unsupported';
type Turn = { role: 'user' | 'assistant'; content: string };

interface VoiceCallProps {
  open: boolean;
  onClose: (transcript: Turn[]) => void;
  name: string;
  color: string;
  portrait: ReactNode;
  agentId?: string;
}

const RING: Record<Phase, string> = {
  ready: '#7FC85C',
  listening: '#F2647B',
  thinking: '#FBBF24',
  speaking: '#22C55E',
  paused: '#9CA3AF',
  unsupported: '#9CA3AF',
};

/**
 * A hands-free call with Ziggy (or one of his friends): the child talks, he
 * listens, thinks and answers out loud, sentence by sentence, then listens
 * again. Tapping him while he talks interrupts him. Everything still goes
 * through the child-safety screen on the server.
 *
 * The same idea as Hyper™ AI Engine's voice chat, tuned for children: no
 * barge-in by voice (a child's speakers would trigger it), a big tap target
 * instead, and captions for every word.
 */
export function VoiceCall({ open, onClose, name, color, portrait, agentId }: VoiceCallProps) {
  const t = useTranslations('call');
  const locale = useLocale();
  const [phase, setPhase] = useState<Phase>('ready');
  const [heard, setHeard] = useState('');
  const [caption, setCaption] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [mounted, setMounted] = useState(false);
  const turns = useRef<Turn[]>([]);
  const alive = useRef(false);
  const stopListening = useRef<() => void>(() => {});

  useEffect(() => setMounted(true), []);

  // Call timer
  useEffect(() => {
    if (!open || phase === 'ready' || phase === 'unsupported') return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [open, phase]);

  const say = useCallback(
    async (text: string) => {
      const sentences = splitSentences(text);
      if (!sentences.length) return;
      setPhase('speaking');
      if (isMuted()) {
        // Site sound is off: show the words at reading speed instead.
        for (const s of sentences) {
          if (!alive.current) return;
          setCaption(s);
          await new Promise((r) => setTimeout(r, 900 + s.length * 45));
        }
        return;
      }
      await speakSequence(`call-${Date.now()}`, sentences, locale, (i) => setCaption(sentences[i]));
    },
    [locale]
  );

  const loop = useCallback(async () => {
    let misses = 0;
    while (alive.current) {
      setPhase('listening');
      setHeard('');
      const { result, stop } = listenOnce(locale, setHeard);
      stopListening.current = stop;
      const text = (await result).trim();
      if (!alive.current) return;

      if (isNoise(text)) {
        misses++;
        if (misses >= 2) {
          setPhase('paused');
          return;
        }
        continue;
      }
      misses = 0;
      turns.current = [...turns.current, { role: 'user' as const, content: text }].slice(-12);

      setPhase('thinking');
      setCaption('');
      let reply = t('trouble');
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: turns.current, locale, agentId, mode: 'voice' }),
        });
        if (res.ok) reply = ((await res.json()) as { message: string }).message || reply;
      } catch {}
      if (!alive.current) return;
      turns.current = [...turns.current, { role: 'assistant' as const, content: reply }].slice(-12);
      await say(reply);
    }
  }, [agentId, locale, say, t]);

  const start = () => {
    unlockAudio(); // inside the tap: lets the answers play on iOS
    if (!micSupported()) {
      setPhase('unsupported');
      return;
    }
    alive.current = true;
    void (async () => {
      await say(t('hello', { name }));
      if (alive.current) await loop();
    })();
  };

  const resume = () => {
    unlockAudio();
    alive.current = true;
    void loop();
  };

  /** Tap while he talks: he stops and listens. */
  const interrupt = () => {
    if (phase !== 'speaking') return;
    stopSpeaking();
  };

  const hangUp = useCallback(() => {
    alive.current = false;
    stopListening.current();
    stopSpeaking();
    setPhase('ready');
    setSeconds(0);
    setCaption('');
    setHeard('');
    onClose(turns.current);
    turns.current = [];
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hangUp();
    window.addEventListener('keydown', onKey);
    document.documentElement.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = '';
    };
  }, [open, hangUp]);

  // Leaving the page mid-call must not leave the microphone on.
  useEffect(() => () => {
    alive.current = false;
    stopListening.current();
    stopSpeaking();
  }, []);

  if (!mounted) return null;
  const ring = RING[phase];
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={t('title', { name })}
          className="fixed inset-0 z-[95] flex flex-col items-center justify-between px-6 py-10 sm:py-14 bg-[radial-gradient(circle_at_50%_35%,#FFF4E2_0%,#FFD9A0_45%,#FBC9C4_100%)] dark:bg-[radial-gradient(circle_at_50%_35%,#2b2016_0%,#17110c_55%,#0A0A1A_100%)]"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
        >
          {/* Top: who and how long */}
          <div className="text-center">
            <p className="font-display text-2xl font-bold text-[#3B2410] dark:text-[#FFE7C2]">{name}</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-[#8a5a2b] dark:text-[#F3D3A8]" aria-live="polite">
              {phase === 'ready' ? t('ready') : phase === 'unsupported' ? t('no_mic') : `${t(phase)} · ${clock}`}
            </p>
          </div>

          {/* Portrait with the state ring */}
          <button
            type="button"
            onClick={phase === 'speaking' ? interrupt : undefined}
            className="relative w-56 h-56 sm:w-72 sm:h-72 rounded-full focus-visible:outline-none"
            aria-label={phase === 'speaking' ? t('interrupt') : name}
            tabIndex={phase === 'speaking' ? 0 : -1}
          >
            {/* Expanding halos while listening or speaking */}
            {(phase === 'listening' || phase === 'speaking') &&
              [0, 0.6, 1.2].map((d) => (
                <motion.span
                  key={`${phase}-${d}`}
                  className="absolute inset-0 rounded-full"
                  style={{ border: `3px solid ${ring}` }}
                  initial={{ scale: 1, opacity: 0.55 }}
                  animate={{ scale: 1.45, opacity: 0 }}
                  transition={{ duration: 1.8, delay: d, repeat: Infinity, ease: 'easeOut' }}
                  aria-hidden="true"
                />
              ))}
            {/* Thinking: a comet circling */}
            {phase === 'thinking' && (
              <motion.span
                className="absolute -inset-2 rounded-full"
                style={{ background: `conic-gradient(from 0deg, transparent 0 70%, ${ring} 100%)` }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
                aria-hidden="true"
              />
            )}
            <motion.span
              className="absolute inset-0 rounded-full overflow-hidden bg-[#F4F2F1] shadow-[0_40px_80px_-30px_rgba(107,74,43,0.7)]"
              style={{ boxShadow: `0 0 0 6px ${ring}, 0 40px 80px -30px rgba(107,74,43,0.7)` }}
              animate={phase === 'speaking' ? { scale: [1, 1.025, 1] } : { scale: 1 }}
              transition={phase === 'speaking' ? { duration: 0.6, repeat: Infinity } : { duration: 0.2 }}
            >
              {portrait}
            </motion.span>
            {phase === 'speaking' && (
              <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-bg-card px-3 py-1 text-xs font-bold text-text-body shadow-lg">
                <Hand size={13} /> {t('interrupt')}
              </span>
            )}
          </button>

          {/* Captions */}
          <div className="w-full max-w-xl min-h-[7.5rem] text-center">
            <AnimatePresence mode="wait">
              {caption && (phase === 'speaking' || phase === 'thinking') && (
                <motion.p
                  key={caption}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25, ease: EASE_OUT }}
                  className="font-display text-xl sm:text-2xl font-semibold leading-snug text-[#3B2410] dark:text-[#FFE7C2] text-balance"
                >
                  {caption}
                </motion.p>
              )}
            </AnimatePresence>
            {phase === 'listening' && (
              <p className="text-lg text-[#6B4A2B] dark:text-[#F3D3A8] min-h-[1.75rem]">
                {heard ? `« ${heard} »` : t('speak_now')}
              </p>
            )}
            {phase === 'unsupported' && <p className="text-[#6B4A2B] dark:text-[#F3D3A8]">{t('no_mic_text')}</p>}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-5">
            {phase === 'ready' && (
              <button
                type="button"
                onClick={start}
                className="press inline-flex items-center gap-2 rounded-full gradient-green-cta px-8 py-4 text-lg font-bold text-white shadow-[0_18px_40px_-14px_rgba(34,197,94,0.9)]"
                autoFocus
              >
                <Mic size={20} /> {t('start')}
              </button>
            )}
            {phase === 'paused' && (
              <button
                type="button"
                onClick={resume}
                className="press inline-flex items-center gap-2 rounded-full px-7 py-4 text-lg font-bold text-white"
                style={{ background: color }}
              >
                <Mic size={20} /> {t('resume')}
              </button>
            )}
            <button
              type="button"
              onClick={hangUp}
              aria-label={t('hang_up')}
              className="press w-16 h-16 rounded-full bg-[#EF4444] text-white flex items-center justify-center shadow-[0_14px_30px_-10px_rgba(239,68,68,0.9)]"
            >
              <PhoneOff size={26} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
