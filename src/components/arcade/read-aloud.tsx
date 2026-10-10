'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { speakSequence, stopSpeaking, unlockAudio, voiceStore } from '@/lib/voice';
import { tr } from '@/lib/i18n-text';

/**
 * Read-aloud for children who cannot read yet: Ziggy says every instruction,
 * then every answer while it lights up, then the feedback. A 🔊 button next to
 * every instruction replays it, for everyone.
 */
type ReadAloud = { on: boolean; little: boolean; locale: string };
const Ctx = createContext<ReadAloud>({ on: false, little: false, locale: 'fr' });

export function ReadAloudProvider({ on, little, locale, children }: ReadAloud & { children: ReactNode }) {
  return <Ctx.Provider value={{ on, little, locale }}>{children}</Ctx.Provider>;
}

export const useReadAloud = () => useContext(Ctx);

const clean = (texts: (string | null | undefined | false)[]) => texts.filter((t): t is string => Boolean(t && t.trim()));

/** Say these lines (in order) whenever `key` changes, if read-aloud is on. */
export function useAutoSay(key: string, texts: (string | null | undefined | false)[], onIndex?: (i: number | null) => void) {
  const { on, locale } = useContext(Ctx);
  const latest = useRef({ texts, onIndex });
  latest.current = { texts, onIndex };
  useEffect(() => {
    if (!on) return;
    const lines = clean(latest.current.texts);
    if (!lines.length) return;
    let alive = true;
    void speakSequence(`say-${key}`, lines, locale, (i) => alive && latest.current.onIndex?.(i)).then(() => alive && latest.current.onIndex?.(null));
    return () => {
      alive = false;
    };
  }, [key, on, locale]);
}

/** Say something once, on demand (e.g. the item a child just picked), if read-aloud is on. */
export function useSay() {
  const { on, locale } = useContext(Ctx);
  return (id: string, ...texts: (string | null | undefined | false)[]) => {
    if (on) void speakSequence(id, clean(texts), locale);
  };
}

const LISTEN = { fr: 'Écouter', en: 'Listen' };

/** 🔊 button: replays the lines. Works with or without read-aloud mode. */
export function SayButton({ texts, locale, onIndex, size = 'md', className = '' }: { texts: (string | null | undefined | false)[]; locale: string; onIndex?: (i: number | null) => void; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const [speaking, setSpeaking] = useState(false);
  const id = useRef(`btn-${Math.random().toString(36).slice(2)}`);
  useEffect(() => {
    const off = voiceStore.subscribe(() => setSpeaking(voiceStore.get().speakingId === id.current));
    return () => {
      off();
    };
  }, []);
  const dim = size === 'lg' ? 'h-16 w-16 text-3xl' : size === 'sm' ? 'h-9 w-9 text-base' : 'h-12 w-12 text-2xl';
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9 }}
      onClick={(e) => {
        e.stopPropagation();
        unlockAudio();
        if (speaking) return stopSpeaking();
        void speakSequence(id.current, clean(texts), locale, onIndex).then(() => onIndex?.(null));
      }}
      aria-label={tr(LISTEN, locale)}
      title={tr(LISTEN, locale)}
      className={`inline-grid shrink-0 place-items-center rounded-full bg-sky/15 text-sky shadow-sm ring-1 ring-sky/30 transition hover:bg-sky/25 ${dim} ${className}`}
    >
      <motion.span animate={speaking ? { scale: [1, 1.2, 1] } : { scale: 1 }} transition={{ duration: 0.6, repeat: speaking ? Infinity : 0 }} aria-hidden="true">
        {speaking ? '🔉' : '🔊'}
      </motion.span>
    </motion.button>
  );
}

/** Small numbers also shown as dots to count, for children who don't know digits yet. */
export function CountDots({ text, color }: { text: string; color: string }) {
  const n = /^\d{1,2}$/.test(text.trim()) ? Number(text) : -1;
  if (n < 1 || n > 10) return null;
  return (
    <span className="mt-1 flex max-w-[7.5rem] flex-wrap justify-center gap-1" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      ))}
    </span>
  );
}
