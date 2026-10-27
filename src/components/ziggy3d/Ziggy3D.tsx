'use client';

import { useEffect, useRef, useState } from 'react';
import { MascotCutout } from '@/components/ziggy/Mascot';
import type { CutoutPose } from '@/lib/mascot';
import type { ZiggyAccessory, ZiggyCue, ZiggyFraming, ZiggyIdle, ZiggyMood } from '@/games3d/ziggy/types';

export type { ZiggyAccessory, ZiggyCue, ZiggyFraming, ZiggyIdle, ZiggyMood };

export interface Ziggy3DProps {
  /** The box Ziggy lives in; give it a size (the canvas fills it). */
  className?: string;
  /** What Ziggy does on his own between cues. */
  idle?: ZiggyIdle;
  mood?: ZiggyMood;
  /** One-shot animation: change `id` to play `kind` again. */
  cue?: { kind: ZiggyCue; id: number } | null;
  /** Mouth moves while true (while Ziggy's voice speaks). */
  talking?: boolean;
  /** Head and eyes follow the pointer. */
  followPointer?: boolean;
  framing?: ZiggyFraming;
  accessory?: ZiggyAccessory;
  /** Tapping Ziggy makes him giggle and hop; this is called too. */
  onTap?: () => void;
  /** Picture shown while the 3D loads, and instead of it without WebGL. */
  fallback?: CutoutPose;
  /** Accessible name; Ziggy is decorative when omitted. */
  label?: string;
}

type Stage = import('@/games3d/ziggy/stage').ZiggyStage;

/**
 * The real Ziggy in 3D — the green plush robot of the photos and the film —
 * alive in any box: breathes, blinks, follows the pointer, waves, cheers,
 * talks. three.js loads only when the box comes into view and the loop
 * pauses when it leaves it; without WebGL the official picture stays.
 * Keep at most two on a page (each one is a WebGL context).
 */
export function Ziggy3D({
  className = '',
  idle = 'calm',
  mood = 'happy',
  cue = null,
  talking = false,
  followPointer = true,
  framing = 'full',
  accessory = 'none',
  onTap,
  fallback = 'wave',
  label,
}: Ziggy3DProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const tapRef = useRef(onTap);
  tapRef.current = onTap;
  // Options read once at creation (camera framing and outfit change rarely: remount with a key).
  const initial = useRef({ framing, accessory, idle, mood, followPointer });

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;
    let alive = true;
    let stage: Stage | null = null;
    let visible = false;

    const resize = () => {
      const r = box.getBoundingClientRect();
      stage?.setSize(Math.max(1, r.width), Math.max(1, r.height));
    };
    const ro = new ResizeObserver(resize);
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible && !stage) void boot();
        if (stage) {
          if (visible && !document.hidden) stage.start();
          else stage.stop();
        }
      },
      { rootMargin: '200px' }
    );
    const onVis = () => {
      if (!stage) return;
      if (document.hidden || !visible) stage.stop();
      else stage.start();
    };

    async function boot() {
      try {
        const mod = await import('@/games3d/ziggy/stage');
        if (!alive) return;
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        const s = new mod.ZiggyStage(canvas!, { ...initial.current, reduceMotion: reduce });
        s.onTooSlow = () => {
          s.dispose();
          if (stageRef.current === s) stageRef.current = null;
          stage = null;
          if (alive) setFailed(true);
        };
        await s.prepare().catch(() => {});
        if (!alive) {
          s.dispose();
          return;
        }
        stage = s;
        stageRef.current = s;
        resize();
        if (visible && !document.hidden) s.start();
        setReady(true);
      } catch {
        if (alive) setFailed(true);
      }
    }

    ro.observe(box);
    io.observe(box);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      stage?.dispose();
      stageRef.current = null;
    };
  }, []);

  useEffect(() => stageRef.current?.setMood(mood), [mood, ready]);
  useEffect(() => stageRef.current?.setIdle(idle), [idle, ready]);
  useEffect(() => stageRef.current?.setTalking(talking), [talking, ready]);
  useEffect(() => {
    if (cue) stageRef.current?.cue(cue.kind);
  }, [cue, ready]);

  const local = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)] as const;
  };

  // Follow the pointer anywhere on the page, not only over the canvas.
  useEffect(() => {
    if (!ready || !followPointer) return;
    const move = (e: PointerEvent) => {
      const box = boxRef.current;
      if (!box) return;
      const r = box.getBoundingClientRect();
      stageRef.current?.pointer(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, [ready, followPointer]);

  return (
    <div
      ref={boxRef}
      className={`relative ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      onPointerDown={(e) => {
        const [x, y] = local(e);
        if (stageRef.current?.tap(x, y) ?? true) tapRef.current?.();
      }}
    >
      {!ready || failed ? (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center">
          <MascotCutout pose={fallback} width={320} glow className={`h-full w-auto max-w-full [&_img]:h-full [&_img]:w-auto ${failed ? '' : 'animate-float'}`} />
        </div>
      ) : null}
      <canvas ref={canvasRef} className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${ready && !failed ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  );
}
