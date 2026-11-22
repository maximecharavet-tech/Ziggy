'use client';

import { useEffect, type RefObject } from 'react';
import { trailAt } from './effects';
import { clearGroup, nextGroup } from './stage';
import { hasFinePointer, reducedMotionNow } from './env';

export interface MagicTrailProps {
  /** Off by default: a trail is a treat for a special screen, not for every page. */
  enabled?: boolean;
  /** Only inside this element (default: the whole window). */
  target?: RefObject<HTMLElement | null>;
  /** Sparkles per second at most. */
  rate?: number;
}

/** Minimum pointer travel between two sparkles, px (a still mouse leaves nothing behind). */
export const TRAIL_STEP_PX = 14;

/**
 * A sparkle trail behind the mouse. Desktop with a fine pointer only (a finger
 * hides what it would draw), opt-in, rate-limited, and nothing at all under
 * reduced motion. Renders nothing; sparkles go to the shared canvas stage.
 */
export function MagicTrail({ enabled = false, target, rate = 36 }: MagicTrailProps) {
  useEffect(() => {
    if (!enabled || !hasFinePointer() || reducedMotionNow()) return;
    const group = nextGroup();
    const node: HTMLElement | Window = target?.current ?? window;
    const gap = 1000 / Math.max(1, Math.min(60, rate));
    let lastT = 0;
    let lastX = -1e4;
    let lastY = -1e4;
    const onMove = (ev: Event) => {
      const e = ev as PointerEvent;
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      const t = e.timeStamp;
      if (t - lastT < gap || Math.hypot(e.clientX - lastX, e.clientY - lastY) < TRAIL_STEP_PX) return;
      lastT = t;
      lastX = e.clientX;
      lastY = e.clientY;
      trailAt({ x: e.clientX, y: e.clientY }, group);
    };
    node.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      node.removeEventListener('pointermove', onMove);
      clearGroup(group);
    };
  }, [enabled, target, rate]);

  return null;
}
