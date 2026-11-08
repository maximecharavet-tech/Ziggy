'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import type { BoothSceneId, SantaSceneHandle, SantaSceneMode } from '@/lib/santa/types';

export type { SantaSceneHandle };

export interface SantaSceneProps {
  mode: SantaSceneMode;
  /** Booth backdrop (booth mode); changing it switches the scene in place. */
  boothScene?: BoothSceneId;
  /** The box the scene fills; give it a size. */
  className?: string;
  /** Called once the 3D is up, with the handle (talk, expressions, booth slot…). */
  onReady?: (handle: SantaSceneHandle) => void;
  /** Called when WebGL is not available (the soft placeholder stays). */
  onError?: () => void;
  /** Accessible name; decorative when omitted. */
  label?: string;
}

const PLACEHOLDER: Record<SantaSceneMode, string> = {
  village: 'radial-gradient(ellipse at 50% 30%, #3b4a8f 0%, #1c2657 55%, #0b1238 100%)',
  call: 'radial-gradient(ellipse at 50% 40%, #a8433d 0%, #5a1d22 60%, #2a1416 100%)',
  booth: 'radial-gradient(ellipse at 50% 40%, #7a3b3b 0%, #3a1f2a 60%, #141c48 100%)',
};

/**
 * The 3D Santa scene (village hero, video call, photo booth) in any box.
 * three.js and the scene load on demand; a soft gradient shows until the
 * first frames are ready. Change `mode` by remounting (use a `key`).
 */
export function SantaScene({ mode, boothScene = 'cheminee', className = '', onReady, onError, label }: SantaSceneProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<SantaSceneHandle | null>(null);
  const [ready, setReady] = useState(false);
  const reduce = useReducedMotion();
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const sceneRef = useRef(boothScene);
  sceneRef.current = boothScene;
  /** The backdrop the live scene shows (to switch only on a real change). */
  const shownRef = useRef<BoothSceneId | null>(null);

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;
    let alive = true;
    let handle: SantaSceneHandle | null = null;
    const ro = new ResizeObserver(() => handle?.resize());

    (async () => {
      try {
        const { mountSantaScene } = await import('@/games3d/santa');
        if (!alive) return;
        handle = mountSantaScene(canvas, { mode, boothScene: sceneRef.current, reducedMotion: reduce });
        shownRef.current = sceneRef.current;
        handleRef.current = handle;
        ro.observe(box);
        // Let a couple of frames draw before fading the canvas in.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (!alive || !handle) return;
            setReady(true);
            readyRef.current?.(handle);
          })
        );
      } catch {
        if (alive) errorRef.current?.();
      }
    })();

    return () => {
      alive = false;
      ro.disconnect();
      handle?.dispose();
      handleRef.current = null;
      setReady(false);
    };
    // The scene is rebuilt when the mode or the motion preference changes.
  }, [mode, reduce]);

  useEffect(() => {
    if (!ready || mode !== 'booth' || shownRef.current === boothScene) return;
    shownRef.current = boothScene;
    handleRef.current?.setScene(boothScene);
  }, [boothScene, ready, mode]);

  return (
    <div
      ref={boxRef}
      className={`${/\b(absolute|fixed|sticky)\b/.test(className) ? '' : 'relative '}overflow-hidden ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ background: PLACEHOLDER[mode] }}
    >
      <canvas ref={canvasRef} className={`absolute inset-0 block h-full w-full transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  );
}
