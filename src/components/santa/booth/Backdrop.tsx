'use client';

import { useEffect, useRef, useState } from 'react';
import type { BoothSceneId, SantaSceneHandle } from '@/lib/santa/types';
import { createFallbackBackdrop } from './fallback-backdrop';

/**
 * The booth backdrop: renders into a fixed-size box (BACKDROP_SIZE CSS px, so
 * the exported photo gets a sharp scene whatever the screen: 1080 × 1350 drawing
 * buffer at the 3D scene's 1.5 pixel ratio), which the booth scales down to fit
 * its stage. Hands the current SantaSceneHandle to `onReady`.
 *
 * The 3D scene (src/games3d/santa, loaded lazily) is the real backdrop; the 2D
 * painted stand-in shows while three.js loads and stays when WebGL is missing,
 * fails, or loses its context.
 */
export const BACKDROP_SIZE = { w: 720, h: 900 };

type Props = { scene: BoothSceneId; reduce: boolean; onReady: (h: SantaSceneHandle) => void };

export function FallbackBackdrop({ scene, onReady }: Omit<Props, 'reduce'>) {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<SantaSceneHandle | null>(null);
  const first = useRef(scene);
  const ready = useRef(onReady);
  ready.current = onReady;

  useEffect(() => {
    if (!host.current) return;
    const h = createFallbackBackdrop(host.current, first.current);
    h.setScene(first.current);
    handle.current = h;
    ready.current(h);
    return () => {
      h.dispose();
      handle.current = null;
    };
  }, []);

  useEffect(() => {
    handle.current?.setScene(scene);
  }, [scene]);

  return <div ref={host} className="absolute inset-0" />;
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function Booth3D({ scene, reduce, onReady, onFail }: Props & { onFail: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const handle = useRef<SantaSceneHandle | null>(null);
  const first = useRef({ scene, reduce });
  const cb = useRef({ onReady, onFail });
  cb.current = { onReady, onFail };
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    if (!webglAvailable()) {
      cb.current.onFail();
      return;
    }
    let alive = true;
    const lost = (e: Event) => {
      e.preventDefault();
      cb.current.onFail();
    };
    cv.addEventListener('webglcontextlost', lost);
    import('@/games3d/santa')
      .then(({ mountSantaScene }) => {
        if (!alive) return;
        const h = mountSantaScene(cv, { mode: 'booth', boothScene: first.current.scene, reducedMotion: first.current.reduce });
        handle.current = h;
        // Let it draw a frame before it replaces the painted stand-in.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (!alive) return;
            setShown(true);
            cb.current.onReady(h);
          }),
        );
      })
      .catch(() => alive && cb.current.onFail());
    return () => {
      alive = false;
      cv.removeEventListener('webglcontextlost', lost);
      handle.current?.dispose();
      handle.current = null;
    };
  }, []);

  useEffect(() => {
    handle.current?.setScene(scene);
  }, [scene]);

  return <canvas ref={canvas} className="absolute inset-0 block h-full w-full" style={{ opacity: shown ? 1 : 0 }} />;
}

export function BoothBackdrop({ scene, reduce, onReady }: Props) {
  const [failed, setFailed] = useState(false);
  const [ready3d, setReady3d] = useState(false);
  return (
    <div className="relative h-full w-full">
      {(!ready3d || failed) && <FallbackBackdrop scene={scene} onReady={onReady} />}
      {!failed && (
        <Booth3D
          scene={scene}
          reduce={reduce}
          onReady={(h) => {
            setReady3d(true);
            onReady(h);
          }}
          onFail={() => setFailed(true)}
        />
      )}
    </div>
  );
}
