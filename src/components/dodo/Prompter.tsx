'use client';

import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { linesFromTops, prompterOffset, sentenceOf, wordLook, type HighlightMode, type WordLook } from '@/lib/dodo/player';
import { tokenize } from '@/lib/dodo/voice';
import css from './dodo.module.css';

/** French typography: « ? ! : ; » stay on the line of the word they follow (and « on the one it opens). */
const isMark = (tok: string) => !/[\p{L}\p{N}]/u.test(tok) && !/^[«“(]+$/u.test(tok);
const isOpening = (tok: string) => /^[«“]+$/u.test(tok);

type Layout = { lineOf: number[]; tops: number[]; lineH: number; contentH: number; viewH: number };

/**
 * The teleprompter: the scene's text, big and calm, each word lighting up as
 * Ziggy says it. The current line stays near the middle with a slow glide,
 * like a real prompter; what was said stays readable, only softer.
 */
export function Prompter({
  text,
  word,
  mode,
  variant = 'scene',
  moralCount = 0,
  label,
  className = '',
}: {
  text: string;
  word: number;
  mode: HighlightMode;
  variant?: 'title' | 'scene' | 'outro';
  /** Outro: how many first words are the moral. */
  moralCount?: number;
  label: string;
  className?: string;
}) {
  const tokens = useMemo(() => tokenize(text), [text]);
  const of = useMemo(() => sentenceOf(tokens), [tokens]);
  const viewRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);

  // Measure where each word sits: lines, their tops, the heights. Again when the size or the text changes.
  useLayoutEffect(() => {
    const view = viewRef.current;
    const track = trackRef.current;
    if (!view || !track) return;
    const measure = () => {
      const els = track.querySelectorAll<HTMLElement>('[data-w]');
      const tops = Array.from(els, (e) => e.offsetTop);
      const lineOf = linesFromTops(tops);
      const lineTops: number[] = [];
      lineOf.forEach((l, i) => {
        lineTops[l] = Math.min(lineTops[l] ?? Infinity, tops[i]);
      });
      setLayout({ lineOf, tops: lineTops, lineH: els[0]?.offsetHeight ?? 40, contentH: track.offsetHeight, viewH: view.clientHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(view);
    ro.observe(track);
    return () => ro.disconnect();
  }, [tokens]);

  const valid = layout && layout.lineOf.length === tokens.length ? layout : null;
  const current = Math.min(word, tokens.length - 1);
  const line = valid && current >= 0 ? valid.lineOf[current] : -1;
  let y = 0;
  if (valid) {
    if (valid.contentH <= valid.viewH) y = Math.round((valid.viewH - valid.contentH) / 2);
    else if (line >= 0) y = -prompterOffset(valid.tops[line], valid.lineH, valid.viewH, valid.contentH);
  }

  const looks: WordLook[] = tokens.map((_, i) => wordLook(i, current, of, mode, valid?.lineOf));
  const render = (from: number, to: number) =>
    tokens.slice(from, to).map((tok, k) => {
      const i = from + k;
      const glue = k > 0 && (isMark(tok) || isOpening(tokens[i - 1])) ? ' ' : k > 0 ? ' ' : null;
      return (
        <span key={i}>
          {glue}
          <Word i={i} text={tok} look={looks[i]} moral={variant === 'outro' && i < moralCount} />
        </span>
      );
    });

  return (
    <div ref={viewRef} className={`${css.viewport} ${mode === 'line' ? css.line : ''} ${className}`} role="region" aria-label={label}>
      <div ref={trackRef} className={css.track} style={{ transform: `translate3d(0, ${y}px, 0)` }}>
        {valid && line >= 0 ? (
          <span aria-hidden="true" className={css.band} style={{ height: valid.lineH, transform: `translate3d(0, ${valid.tops[line]}px, 0)` }} />
        ) : null}
        {variant === 'outro' && moralCount > 0 ? (
          <>
            <p className={`${css.text} text-center`}>{render(0, moralCount)}</p>
            <p className={`${css.text} mt-[0.5em] text-center`}>{render(moralCount, tokens.length)}</p>
          </>
        ) : (
          <p className={`${css.text} ${variant === 'title' ? `${css.title} text-center` : ''}`}>{render(0, tokens.length)}</p>
        )}
      </div>
    </div>
  );
}

const Word = memo(function Word({ i, text, look, moral }: { i: number; text: string; look: WordLook; moral: boolean }) {
  return (
    <span data-w={i} className={`${css.w} ${css[look]} ${moral ? css.moral : ''}`}>
      {text}
    </span>
  );
});
