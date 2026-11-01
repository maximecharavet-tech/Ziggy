'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { speakSequence, stopSpeaking, unlockAudio, voiceStore } from '@/lib/voice';
import { isMuted } from '@/lib/sound';
import { tr } from '@/lib/i18n-text';

const LISTEN = { fr: 'Écouter', en: 'Listen' };

let clipAudio: HTMLAudioElement | null = null;
let clipOwner: string | null = null;
const clipListeners = new Set<() => void>();
const notify = () => clipListeners.forEach((l) => l());

function stopClip() {
  clipAudio?.pause();
  clipOwner = null;
  notify();
}

/**
 * 🔊 Read-aloud for little ones who cannot read yet, in the night style of
 * Mode dodo. With `clip` (Ziggy's recorded title), it plays the recording;
 * otherwise Ziggy's usual read-aloud voice says the lines.
 */
export function DodoSay({
  texts,
  locale,
  clip = null,
  size = 'md',
  className = '',
}: {
  texts: (string | null | undefined | false)[];
  locale: string;
  clip?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const id = useRef(`dodo-say-${Math.random().toString(36).slice(2)}`);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const me = id.current;
    const sync = () => setSpeaking(voiceStore.get().speakingId === me || clipOwner === me);
    const off = voiceStore.subscribe(sync);
    clipListeners.add(sync);
    return () => {
      off();
      clipListeners.delete(sync);
      if (clipOwner === me) stopClip();
    };
  }, []);

  const lines = texts.filter((t): t is string => Boolean(t && t.trim()));
  const dim = size === 'lg' ? 'h-14 w-14 text-2xl' : size === 'sm' ? 'h-10 w-10 text-base' : 'h-12 w-12 text-xl';

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9 }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        unlockAudio();
        if (speaking) {
          stopSpeaking();
          stopClip();
          return;
        }
        stopSpeaking();
        stopClip();
        if (clip && !isMuted()) {
          clipAudio ??= new Audio();
          const a = clipAudio;
          a.src = clip;
          a.onended = a.onerror = () => {
            if (clipOwner === id.current) stopClip();
          };
          clipOwner = id.current;
          notify();
          a.play().catch(() => {
            stopClip();
            void speakSequence(id.current, lines, locale, undefined, 'bedtime');
          });
          return;
        }
        void speakSequence(id.current, lines, locale, undefined, 'bedtime');
      }}
      aria-label={tr(LISTEN, locale)}
      title={tr(LISTEN, locale)}
      className={`inline-grid shrink-0 place-items-center rounded-full bg-white/10 text-amber-100 ring-1 ring-white/20 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 ${dim} ${className}`}
    >
      <motion.span animate={speaking ? { scale: [1, 1.18, 1] } : { scale: 1 }} transition={{ duration: 0.8, repeat: speaking ? Infinity : 0 }} aria-hidden="true">
        {speaking ? '🔉' : '🔊'}
      </motion.span>
    </motion.button>
  );
}
