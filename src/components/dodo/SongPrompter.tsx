'use client';

import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { lineSeekTime, songCursor, type SongLine, type SongTiming } from '@/lib/dodo/song';
import type { HighlightMode } from '@/lib/dodo/player';
import css from './dodo.module.css';

type Cursor = { line: number; word: number };

/**
 * The sung story's teleprompter: the exact lyrics, the line being sung lit up
 * (and the word, when the timing is reliable), gliding to stay near the middle
 * as the song plays. Tapping a line jumps the song there.
 * Time is read every frame from the audio element (getTime), but the component
 * only re-renders when the line or the word changes.
 */
export function SongPrompter({
  timing,
  getTime,
  playing,
  tick,
  mode,
  words,
  onSeek,
  label,
  seekLabel,
}: {
  timing: SongTiming;
  getTime: () => number;
  playing: boolean;
  /** Changes when the time moves while paused (a seek), so the cursor follows. */
  tick: number;
  mode: HighlightMode;
  /** Word-by-word highlight allowed (timing reliable enough). */
  words: boolean;
  onSeek: (seconds: number) => void;
  label: string;
  /** "Chanter à partir d’ici" (accessible name prefix of each line). */
  seekLabel: string;
}) {
  const [cur, setCur] = useState<Cursor>(() => songCursor(timing, getTime()));
  const viewRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [y, setY] = useState(0);

  // Follow the song: every frame while it plays, once on each tick when paused.
  useEffect(() => {
    const update = () => {
      const c = songCursor(timing, getTime());
      setCur((p) => (p.line === c.line && p.word === c.word ? p : c));
    };
    update();
    if (!playing) return;
    let raf = 0;
    const loop = () => {
      update();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [timing, getTime, playing, tick]);

  // Keep the current line (or the word being sung, in a long line) a little above the middle.
  useLayoutEffect(() => {
    const view = viewRef.current;
    const track = trackRef.current;
    if (!view || !track) return;
    const place = () => {
      const viewH = view.clientHeight;
      const contentH = track.offsetHeight;
      if (contentH <= viewH) return setY(0);
      const lineEl = track.querySelector<HTMLElement>(`[data-l="${Math.max(0, cur.line)}"]`);
      if (!lineEl) return;
      let anchor = lineEl.offsetTop + lineEl.offsetHeight / 2;
      if (lineEl.offsetHeight > viewH * 0.45 && cur.word >= 0) {
        const w = lineEl.querySelector<HTMLElement>(`[data-w="${Math.min(cur.word, timing.lines[cur.line]?.words.length - 1)}"]`);
        if (w) anchor = lineEl.offsetTop + (w.getBoundingClientRect().top - lineEl.getBoundingClientRect().top) + w.offsetHeight / 2;
      }
      const target = anchor - viewH * 0.42;
      setY(-Math.round(Math.max(0, Math.min(contentH - viewH, target))));
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(view);
    ro.observe(track);
    return () => ro.disconnect();
  }, [cur.line, cur.word, timing]);

  return (
    <div ref={viewRef} className={`${css.viewport} ${mode === 'line' || !words ? css.line : ''}`} role="region" aria-label={label}>
      <div ref={trackRef} className={css.track} style={{ transform: `translate3d(0, ${y}px, 0)` }}>
        {timing.lines.map((l, i) => (
          <Line
            key={i}
            i={i}
            line={l}
            state={i < cur.line ? 'past' : i === cur.line ? 'now' : 'later'}
            word={i === cur.line ? cur.word : -1}
            wordMode={words && mode === 'word'}
            onSeek={onSeek}
            seekLabel={seekLabel}
          />
        ))}
      </div>
    </div>
  );
}

const Line = memo(function Line({
  i,
  line,
  state,
  word,
  wordMode,
  onSeek,
  seekLabel,
}: {
  i: number;
  line: SongLine;
  state: 'past' | 'now' | 'later';
  /** In the current line: index of the word being sung (words before it are "past"). */
  word: number;
  wordMode: boolean;
  onSeek: (seconds: number) => void;
  seekLabel: string;
}) {
  const text = line.words.map((w) => w.text).join(' ');
  return (
    <button
      type="button"
      data-l={i}
      data-state={state}
      data-chorus={line.kind === 'chorus' ? '' : undefined}
      aria-current={state === 'now' ? 'true' : undefined}
      aria-label={`${seekLabel} : ${text}`}
      onClick={(e) => {
        onSeek(lineSeekTime(line));
        // A tap must not leave the focus on the line (Space would jump back here instead of pausing).
        if (e.detail > 0) e.currentTarget.blur();
      }}
      className={`${css.text} ${css.songLine}`}
    >
      {line.kind === 'chorus' ? (
        <span aria-hidden="true" className={css.note}>
          ♪
        </span>
      ) : null}
      {line.words.map((w, k) => {
        const look = state === 'past' ? 'past' : state === 'later' ? 'later' : !wordMode ? 'now' : k < word ? 'sung' : k === word ? 'now' : 'next';
        return (
          <span key={k}>
            {k > 0 ? ' ' : null}
            <span data-w={k} className={`${css.w} ${css[look]}`}>
              {w.text}
            </span>
          </span>
        );
      })}
    </button>
  );
});
