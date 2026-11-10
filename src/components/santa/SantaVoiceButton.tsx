'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { SayButton } from '@/components/arcade/read-aloud';
import { staticClipUrl } from '@/data/santa/voice-clips';
import { useReducedMotion } from '@/lib/use-reduced-motion';

/**
 * Plays one of Santa's recorded clips (public/santa/voice). Where there is no
 * recording (other languages, or the file is missing), the usual read-aloud
 * button reads `texts` with Ziggy's voice instead.
 */
export function SantaVoiceButton({ clip, texts, locale }: { clip: string; texts: (string | null | undefined | false)[]; locale: string }) {
  const url = locale === 'fr' || locale === 'en' ? staticClipUrl(clip, locale) : null;
  const [playing, setPlaying] = useState(false);
  const [broken, setBroken] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const reduced = useReducedMotion();
  useEffect(
    () => () => {
      audio.current?.pause();
      audio.current = null;
    },
    [clip],
  );
  if (!url || broken) return <SayButton texts={texts} locale={locale} />;
  const label = locale === 'fr' ? 'Écouter le Père Noël' : 'Hear Santa';
  return (
    <motion.button
      type="button"
      whileTap={reduced ? undefined : { scale: 0.9 }}
      onClick={(e) => {
        e.stopPropagation();
        if (playing) {
          audio.current?.pause();
          setPlaying(false);
          return;
        }
        const a = audio.current ?? new Audio(url);
        audio.current = a;
        a.currentTime = 0;
        a.onended = () => setPlaying(false);
        a.onerror = () => {
          setPlaying(false);
          setBroken(true);
        };
        setPlaying(true);
        a.play().catch(() => {
          setPlaying(false);
          setBroken(true);
        });
      }}
      aria-label={label}
      title={label}
      aria-pressed={playing}
      className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-[#9d3640] px-5 font-semibold text-white shadow-sm transition hover:bg-[#b23f4a]"
    >
      <motion.span animate={reduced ? { opacity: 1 } : playing ? { scale: [1, 1.2, 1] } : { scale: 1 }} transition={{ duration: 0.6, repeat: playing ? Infinity : 0 }} aria-hidden="true">
        🎅
      </motion.span>
      {playing ? 'Pause' : label}
    </motion.button>
  );
}
