'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { createRateLimit } from './fx/rate-limit';
import { fxSound } from './fx/sfx';
import { now } from './fx/env';

interface AnimatedCounterProps {
  value: string;
  className?: string;
  /** Soft ticks while the digits roll (default on; rate-limited, quiet, muted with the site). */
  tick?: boolean;
}

/** Ticks per second at most, and their volume (a whisper of the 'tap' sound). */
export const COUNTER_TICKS_PER_SECOND = 10;
export const COUNTER_TICK_VOLUME = 0.18;
const SPIN_MS = 1250;
const STAGGER_MS = 110;

/** Full turns a digit column makes: the last digit spins the most, like an odometer. */
export function turnsFor(index: number, digitCount: number): number {
  return index === digitCount - 1 ? 2 : 1;
}

/**
 * Offset of a column strip (% of its height) that shows `digit` in cycle
 * `cycle` of a strip holding `turns + 1` cycles of 0–9. The rest position is
 * the last cycle; a roll starts from the same digit in the first one.
 */
export function stripOffset(digit: number, turns: number, cycle = turns): number {
  return -((cycle * 10 + digit) / ((turns + 1) * 10)) * 100;
}

/**
 * A number that rolls into place like a slot machine when it scrolls into
 * view. The server and the first render already show the final value (no
 * fake "0", nothing for search engines or screen readers to misread), and
 * each column spins from that same digit back onto it, so the start and the
 * end frames match. Only transforms move. Reduced motion: no roll, no tick.
 */
export function AnimatedCounter({ value, className = '', tick = true }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const chars = Array.from(value);
  const digitIdx = chars.map((c, i) => (/\d/.test(c) ? i : -1)).filter((i) => i >= 0);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || digitIdx.length === 0) return;
    let timers: number[] = [];
    const strips = Array.from(el.querySelectorAll<HTMLElement>('[data-strip]'));
    const roll = () => {
      strips.forEach((strip, i) => {
        const digit = Number(strip.dataset.digit);
        const turns = turnsFor(i, strips.length);
        strip.animate(
          [{ transform: `translateY(${stripOffset(digit, turns, 0)}%)` }, { transform: `translateY(${stripOffset(digit, turns)}%)` }],
          { duration: SPIN_MS + i * STAGGER_MS, easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)' },
        );
      });
      if (!tick) return;
      // Ticks slow down with the digits: short gaps first, longer at the end.
      const limit = createRateLimit({ perSecond: COUNTER_TICKS_PER_SECOND, minGapMs: 1000 / COUNTER_TICKS_PER_SECOND });
      const total = SPIN_MS + (strips.length - 1) * STAGGER_MS;
      for (let t = 0, gap = 70; t < total - 120; gap *= 1.16, t += gap) {
        timers.push(window.setTimeout(() => limit.take(now()) && fxSound('tap', { volume: COUNTER_TICK_VOLUME }), t));
      }
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        roll();
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      timers = [];
    };
    // The digits are derived from `value`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced, tick]);

  let col = 0;
  return (
    <span ref={ref} className={`relative inline-flex tabular-nums ${className}`}>
      <span className="sr-only">{value}</span>
      <span className="inline-flex" aria-hidden="true">
        {chars.map((c, i) => {
          if (!/\d/.test(c)) return <span key={i}>{c}</span>;
          const index = col++;
          const turns = turnsFor(index, digitIdx.length);
          const digit = Number(c);
          return (
            <span key={i} className="relative inline-block h-[1.2em] overflow-hidden supports-[height:1lh]:h-[1lh]">
              <span
                data-strip=""
                data-digit={digit}
                className="flex flex-col"
                style={{ transform: `translateY(${stripOffset(digit, turns)}%)` }}
              >
                {Array.from({ length: (turns + 1) * 10 }, (_, k) => (
                  <span key={k} className="block h-[1.2em] text-center supports-[height:1lh]:h-[1lh]">
                    {k % 10}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
