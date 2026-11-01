'use client';

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { Ziggy3D, type ZiggyCue, type ZiggyIdle } from '@/components/ziggy3d/Ziggy3D';
import type { CutoutPose } from '@/lib/mascot';
import { MascotCutout } from '@/components/ziggy/Mascot';
import { voiceStore } from '@/lib/voice';
import { Burst } from './Burst';
import { rgba } from './color';
import css from './stage.module.css';

export type ZiggyReaction = { kind: 'right' | 'oops' | 'cheer' | 'wave' | 'love'; id: number };

/** True while Ziggy's voice is speaking (read-aloud), so his mouth can move. */
export function useZiggyTalking(): boolean {
  return useSyncExternalStore(
    voiceStore.subscribe,
    () => voiceStore.get().speakingId !== null,
    () => false,
  );
}

const CUES: Record<ZiggyReaction['kind'], [ZiggyCue, ZiggyCue]> = {
  right: ['cheer', 'jump'],
  oops: ['nod', 'oops'],
  cheer: ['cheer', 'cheer'],
  wave: ['wave', 'wave'],
  love: ['love', 'love'],
};

/**
 * Ziggy as the host of a game: the real 3D plush when it is ready (the
 * official picture until then), standing on a soft glowing spot, reacting
 * to each answer — a happy hop and sparkles when it's right, a kind nod
 * when it's not quite (never sad). Only one per page (one WebGL context).
 */
export function ZiggyHost({
  className = '',
  idle = 'calm',
  reaction = null,
  pose = 'wave',
  color = '#7FC85C',
  spot = true,
  label,
  onTap,
}: {
  className?: string;
  idle?: ZiggyIdle;
  reaction?: ZiggyReaction | null;
  /** Picture shown until (or instead of) the 3D. */
  pose?: CutoutPose;
  color?: string;
  spot?: boolean;
  label?: string;
  onTap?: () => void;
}) {
  const reduce = useReducedMotion();
  const talking = useZiggyTalking();
  const [cue, setCue] = useState<{ kind: ZiggyCue; id: number } | null>(null);
  const [heart, setHeart] = useState(false);
  const body = useAnimationControls();

  useEffect(() => {
    if (!reaction) return;
    setCue({ kind: CUES[reaction.kind][reaction.id % 2], id: reaction.id });
    const glad = reaction.kind === 'right' || reaction.kind === 'cheer' || reaction.kind === 'love';
    if (!reduce && reaction.id > 0) {
      // The 3D Ziggy plays the cue himself; the box only adds a little squash of joy
      // (and keeps the picture lively when there is no WebGL).
      void body.start(
        glad
          ? { scaleY: [1, 0.95, 1.04, 1], scaleX: [1, 1.04, 0.98, 1], transition: { duration: 0.5, ease: 'easeOut' } }
          : { rotate: [0, -2, 1.5, 0], transition: { duration: 0.5, ease: 'easeOut' } },
      );
    }
    if (reaction.kind === 'right' || reaction.kind === 'cheer' || reaction.kind === 'love') {
      setHeart(true);
      const t = window.setTimeout(() => setHeart(false), 1800);
      return () => window.clearTimeout(t);
    }
    setHeart(false);
  }, [reaction, reduce, body]);

  const happy = reaction && (reaction.kind === 'right' || reaction.kind === 'cheer' || reaction.kind === 'love');

  return (
    <div className={`relative ${className}`}>
      {spot ? (
        <span
          className={`pointer-events-none absolute inset-x-[6%] bottom-[-4%] h-[14%] rounded-[50%] ${css.breathe}`}
          style={{ background: `radial-gradient(closest-side, ${rgba(color, 0.55)}, ${rgba(color, 0.18)} 60%, transparent)` } as CSSProperties}
          aria-hidden="true"
        />
      ) : null}
      <motion.div className="absolute inset-0 origin-bottom" animate={body}>
        <Ziggy3D className="h-full w-full" idle={idle} cue={cue} talking={talking} fallback={heart ? 'heart' : pose} label={label} onTap={onTap} />
      </motion.div>
      {happy ? <Burst fire={reaction!.id} color={color} count={12} spread={90} className="!top-[38%]" /> : null}
      {/* Warm the cache for the "heart" picture used on happy answers, so it never flashes in. */}
      <span className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0" aria-hidden="true">
        <MascotCutout pose="heart" width={320} glow={false} />
      </span>
    </div>
  );
}
