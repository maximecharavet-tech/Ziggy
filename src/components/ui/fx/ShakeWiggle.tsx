'use client';

import { useRef, type ReactNode } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { playTransform, wiggleFrames, framesMs, JUICE_MS } from './juice';
import { fxSound, type FxSound } from './sfx';
import { useTrigger } from './use-trigger';

export interface ShakeWiggleProps {
  children: ReactNode;
  /** Wiggles each time this becomes a new truthy value. */
  trigger: unknown;
  /** 'tiny' (4°) for a nice choice, 'happy' (8° and a hop) for a win. */
  intensity?: 'tiny' | 'happy';
  /** Also wiggle once when mounted (default: only on a new trigger). */
  onMount?: boolean;
  /** Optional sound (default none). */
  sound?: FxSound | false;
  className?: string;
}

/**
 * A tiny celebratory wiggle: a few decreasing tilts, like a pleased toy. It
 * is never the side-to-side "no" shake (no shaming feedback at Ziggy's), it
 * adds to the child's own transform instead of replacing it, and it does
 * nothing under reduced motion.
 */
export function ShakeWiggle({ children, trigger, intensity = 'tiny', onMount = false, sound = false, className = '' }: ShakeWiggleProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  useTrigger(
    trigger,
    () => {
      fxSound(sound);
      if (reduced) return;
      const frames = wiggleFrames(intensity === 'happy' ? 8 : 4);
      const hop = intensity === 'happy' ? frames.map((f, i) => `translateY(${-10 * Math.sin((i / (frames.length - 1)) * Math.PI)}px) ${f}`) : frames;
      playTransform(ref.current, hop, framesMs(hop, JUICE_MS.wiggle));
    },
    { onMount },
  );

  return (
    <span ref={ref} className={`inline-block ${className}`}>
      {children}
    </span>
  );
}
