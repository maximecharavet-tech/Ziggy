'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Square, Mic, AudioLines, Loader2 } from 'lucide-react';
import { voiceStore, speak, stopSpeaking, setAutoRead, micSupported, listen } from '@/lib/voice';

export function useVoiceState() {
  return useSyncExternalStore(voiceStore.subscribe, voiceStore.get, voiceStore.server);
}

/** 🔊 on a bubble: Ziggy reads this line aloud. */
export function SpeakButton({ id, text, locale, color }: { id: string; text: string; locale: string; color?: string }) {
  const t = useTranslations('voice');
  const { speakingId, loadingId } = useVoiceState();
  const speaking = speakingId === id;
  const loading = loadingId === id;

  return (
    <button
      type="button"
      onClick={() => (speaking || loading ? stopSpeaking() : void speak(id, text, locale))}
      aria-label={speaking ? t('stop') : t('listen')}
      title={speaking ? t('stop') : t('listen')}
      className="press inline-flex items-center justify-center w-7 h-7 rounded-full text-text-dim hover:text-text-body hover:bg-border/40 transition-colors"
      style={speaking && color ? { color } : undefined}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : speaking ? (
        <Square size={12} className="fill-current" />
      ) : (
        <Volume2 size={15} />
      )}
    </button>
  );
}

/** Switch in the chat header: read every answer aloud, or only on request. */
export function AutoReadToggle({ color = '#22C55E' }: { color?: string }) {
  const t = useTranslations('voice');
  const { autoRead } = useVoiceState();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={autoRead}
      onClick={() => setAutoRead(!autoRead)}
      title={autoRead ? t('auto_on') : t('auto_off')}
      className="press inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-bold transition-colors"
      style={autoRead ? { color, borderColor: `${color}55`, backgroundColor: `${color}12` } : undefined}
    >
      <AudioLines size={13} />
      <span className="hidden sm:inline">{autoRead ? t('auto_on') : t('auto_off')}</span>
    </button>
  );
}

/** 🎤 The child speaks; the words fill the box, then send when they stop. */
export function MicButton({
  locale,
  onText,
  onFinal,
  disabled,
  color = '#22C55E',
}: {
  locale: string;
  onText: (t: string) => void;
  onFinal: (t: string) => void;
  disabled?: boolean;
  color?: string;
}) {
  const t = useTranslations('voice');
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => setSupported(micSupported()), []);
  useEffect(() => () => stop.current?.(), []);

  if (!supported) return null;

  const toggle = () => {
    if (on) {
      stop.current?.();
      return;
    }
    setOn(true);
    stop.current = listen(locale, onText, (final) => {
      setOn(false);
      stop.current = null;
      if (final) onFinal(final);
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-pressed={on}
      aria-label={on ? t('mic_stop') : t('mic_start')}
      title={on ? t('mic_stop') : t('mic_start')}
      className="press relative w-11 h-11 shrink-0 rounded-full flex items-center justify-center border border-border/60 bg-bg-card text-text-muted disabled:opacity-40"
      style={on ? { color: '#fff', backgroundColor: '#F2647B', borderColor: '#F2647B' } : undefined}
    >
      <AnimatePresence>
        {on && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ boxShadow: `0 0 0 0 ${color}` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.6, 0], scale: [1, 1.6] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
            aria-hidden="true"
          >
            <span className="absolute inset-0 rounded-full bg-[#F2647B]/50" />
          </motion.span>
        )}
      </AnimatePresence>
      <Mic size={18} className="relative" />
    </button>
  );
}

/** Wrap Ziggy's avatar: it bobs and glows while he talks. */
export function TalkingHalo({ children, color = '#7FC85C' }: { children: React.ReactNode; color?: string }) {
  const { speakingId } = useVoiceState();
  const talking = speakingId !== null;
  return (
    <span className="relative inline-flex">
      <AnimatePresence>
        {talking && (
          <motion.span
            className="absolute -inset-1 rounded-full"
            style={{ border: `2px solid ${color}` }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: [0.9, 0.2, 0.9], scale: [1, 1.12, 1] }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
      <motion.span
        className="inline-flex"
        animate={talking ? { y: [0, -2, 0, -1, 0], rotate: [0, -3, 2, -1, 0] } : { y: 0, rotate: 0 }}
        transition={talking ? { duration: 0.7, repeat: Infinity } : { duration: 0.2 }}
      >
        {children}
      </motion.span>
    </span>
  );
}
