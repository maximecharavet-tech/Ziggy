'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isMuted, MUTE_EVENT } from '@/lib/sound';

export type MusicStatus = 'idle' | 'playing' | 'paused' | 'done';

export interface MusicState {
  status: MusicStatus;
  /** Seconds played. */
  time: number;
  /** Track length in seconds (0 until known). */
  duration: number;
  /** The file could not be played (missing, offline, unsupported). */
  error: boolean;
  /** The browser refused to start on its own: one more tap on ▶ is needed. */
  blocked: boolean;
}

const IDLE: MusicState = { status: 'idle', time: 0, duration: 0, error: false, blocked: false };

/**
 * The "Version musicale": one <audio> for the whole sung story, with
 * play/pause, seek and progress. Plain element, no speed change (it is sung).
 * Respects the site's mute switch. A new url (or null) stops and resets it.
 */
export function useMusic(url: string | null) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<MusicState>(IDLE);
  const patch = useCallback((p: Partial<MusicState>) => setState((s) => ({ ...s, ...p })), []);

  useEffect(() => {
    setState(IDLE);
    if (!url || typeof window === 'undefined') return;
    const a = new Audio();
    a.preload = 'metadata';
    a.muted = isMuted();
    a.src = url;
    audio.current = a;
    const onTime = () => patch({ time: a.currentTime || 0 });
    const onMeta = () => patch({ duration: Number.isFinite(a.duration) ? a.duration : 0 });
    const onEnded = () => patch({ status: 'done', time: Number.isFinite(a.duration) ? a.duration : a.currentTime });
    const onError = () => {
      a.pause();
      setState((s) => ({ ...s, status: 'idle', error: true, blocked: false, time: 0 }));
    };
    const onMute = () => {
      a.muted = isMuted();
    };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('durationchange', onMeta);
    a.addEventListener('ended', onEnded);
    a.addEventListener('error', onError);
    window.addEventListener(MUTE_EVENT, onMute);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('durationchange', onMeta);
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('error', onError);
      window.removeEventListener(MUTE_EVENT, onMute);
      a.pause();
      a.removeAttribute('src');
      a.load();
      if (audio.current === a) audio.current = null;
    };
  }, [url, patch]);

  /** Play (call it inside a tap the first time). `from` = seconds to start at. */
  const play = useCallback(
    (from?: number) => {
      const a = audio.current;
      if (!a) return;
      if (from !== undefined) {
        try {
          a.currentTime = Math.max(0, from);
        } catch {
          /* not seekable yet */
        }
      }
      patch({ status: 'playing', blocked: false, error: false, time: a.currentTime || 0 });
      void a.play().catch((e: unknown) => {
        // Autoplay refused: wait for one more tap. A real load error arrives through the 'error' event.
        if ((e as { name?: string })?.name === 'NotAllowedError') patch({ status: 'paused', blocked: true });
      });
    },
    [patch]
  );

  const pause = useCallback(() => {
    audio.current?.pause();
    setState((s) => (s.status === 'playing' ? { ...s, status: 'paused' } : s));
  }, []);

  const toggle = useCallback(() => {
    if (state.status === 'playing') pause();
    else play(state.status === 'done' ? 0 : undefined);
  }, [state.status, pause, play]);

  const seek = useCallback(
    (t: number) => {
      const a = audio.current;
      if (!a) return;
      const d = Number.isFinite(a.duration) ? a.duration : Infinity;
      try {
        a.currentTime = Math.max(0, Math.min(d, t));
      } catch {
        return;
      }
      patch({ time: a.currentTime || 0, ...(state.status === 'done' ? { status: 'paused' as const } : {}) });
    },
    [patch, state.status]
  );

  /** Back to the cover (stops the track). */
  const stop = useCallback(() => {
    const a = audio.current;
    if (a) {
      a.pause();
      try {
        a.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    setState((s) => ({ ...IDLE, duration: s.duration, error: s.error }));
  }, []);

  return { ...state, play, pause, toggle, seek, stop };
}
