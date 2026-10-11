'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DodoStory } from '@/data/dodo/types';
import { outroText } from '@/data/dodo';
import { speakSequence, stopSpeaking, unlockAudio } from '@/lib/voice';
import { sentences, type DodoManifest } from '@/lib/dodo/client';

export type NarratorStatus = 'idle' | 'speaking' | 'paused' | 'between' | 'done';

const PAUSE_BETWEEN_SCENES = 1600;

/**
 * Ziggy tells the story, scene after scene, then the moral.
 * - Pre-generated narration (stored once, the soft bedtime voice): an <audio>
 *   element, so pause/resume are exact; the highlighted sentence follows the
 *   playback position.
 * - Otherwise: Ziggy's live voice (Gemini, else the browser), sentence by sentence.
 * `scene` goes 0…n-1 for the story and n for the outro.
 */
export function useNarrator(story: DodoStory, locale: 'fr' | 'en', manifest: DodoManifest | null, onSpeaking?: (on: boolean) => void) {
  const [scene, setScene] = useState(0);
  const [sentence, setSentence] = useState(0);
  const [status, setStatus] = useState<NarratorStatus>('idle');
  const audio = useRef<HTMLAudioElement | null>(null);
  const token = useRef(0);
  const timer = useRef<number | null>(null);
  const speakingCb = useRef(onSpeaking);
  speakingCb.current = onSpeaking;
  const last = story.scenes.length; // index of the outro

  const textOf = useCallback((i: number) => (i >= last ? outroText(story, locale) : story.scenes[i].text[locale]), [story, locale, last]);
  const audioOf = useCallback((i: number) => manifest?.audio[story.id]?.[locale]?.[i >= last ? 7 : i + 1] ?? null, [manifest, story.id, locale, last]);

  const clear = () => {
    token.current++;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    audio.current?.pause();
    stopSpeaking();
  };

  const play = useCallback(
    (i: number, fromSentence = 0) => {
      clear();
      const mine = token.current;
      setScene(i);
      setSentence(fromSentence);
      setStatus('speaking');
      speakingCb.current?.(true);
      const finished = () => {
        if (mine !== token.current) return;
        speakingCb.current?.(false);
        if (i >= last) {
          setStatus('done');
          return;
        }
        setStatus('between');
        timer.current = window.setTimeout(() => play(i + 1), PAUSE_BETWEEN_SCENES);
      };
      const url = audioOf(i);
      const parts = sentences(textOf(i));
      if (url) {
        audio.current ??= new Audio();
        const a = audio.current;
        if (!a.src.endsWith(url)) a.src = url;
        // Estimate the sentence being read from the playback position.
        const lengths = parts.map((p) => p.length);
        const total = lengths.reduce((x, y) => x + y, 0) || 1;
        a.ontimeupdate = () => {
          if (!a.duration) return;
          const at = (a.currentTime / a.duration) * total;
          let sum = 0;
          let k = 0;
          while (k < lengths.length - 1 && sum + lengths[k] < at) sum += lengths[k++];
          setSentence(k);
        };
        a.onended = finished;
        a.play().catch(() => {
          // Autoplay blocked or file unreachable: fall back to the live voice.
          void speakSequence(`dodo-${story.id}-${i}`, parts, locale, setSentence, 'bedtime').then((ok) => ok && finished());
        });
      } else {
        void speakSequence(`dodo-${story.id}-${i}`, parts.slice(fromSentence), locale, (k) => setSentence(fromSentence + k), 'bedtime').then((ok) => ok && finished());
      }
    },
     
    [audioOf, textOf, last, locale, story.id]
  );

  const start = useCallback(() => {
    unlockAudio();
    play(0);
  }, [play]);

  const pause = useCallback(() => {
    if (status !== 'speaking' && status !== 'between') return;
    if (audioOf(scene) && audio.current && status === 'speaking') {
      audio.current.pause();
    } else {
      token.current++;
      if (timer.current) window.clearTimeout(timer.current);
      stopSpeaking();
    }
    speakingCb.current?.(false);
    setStatus('paused');
  }, [status, scene, audioOf]);

  const resume = useCallback(() => {
    if (status !== 'paused') return;
    if (audioOf(scene) && audio.current && audio.current.currentTime > 0 && !audio.current.ended) {
      const mine = token.current;
      setStatus('speaking');
      speakingCb.current?.(true);
      void audio.current.play().catch(() => mine === token.current && play(scene, sentence));
    } else play(scene, sentence);
  }, [status, scene, sentence, audioOf, play]);

  const go = useCallback((i: number) => play(Math.max(0, Math.min(last, i))), [play, last]);

  const stop = useCallback(() => {
    clear();
    speakingCb.current?.(false);
    setStatus('idle');
  }, []);

  useEffect(() => () => clear(), []);

  return { scene, sentence, status, start, pause, resume, go, stop, last, textOf };
}
