'use client';

import { useEffect, useRef, useState } from 'react';
import { imageSources, videoSources, type SantaArtSlot } from '@/data/santa/art';
import { useReducedMotion } from '@/lib/use-reduced-motion';

const COVER = 'absolute inset-0 h-full w-full object-cover';

/** AVIF → WebP picture, lazy unless `priority` (the hero). */
function ArtPicture({ path, className, sizes, priority, onError }: { path: string; className: string; sizes: string; priority?: boolean; onError?: () => void }) {
  const s = imageSources(path);
  return <picture>
    <source type="image/avif" srcSet={s.avif} sizes={sizes} />
    <source type="image/webp" srcSet={s.webp} sizes={sizes} />
    { }
    <img src={s.src} alt="" className={className} loading={priority ? 'eager' : 'lazy'} decoding="async" fetchPriority={priority ? 'high' : 'auto'} onError={onError} draggable={false} />
  </picture>;
}

/**
 * A decorative Christmas visual. Videos only load and play once on screen and
 * never with "reduce motion" (the poster stays); images are lazy-loaded.
 * Missing assets fall back to a soft gradient.
 */
export function ArtSlot({ asset, className = COVER, fallback = 'from-[#24205e] via-[#563d8e] to-[#102a42]', sizes = '100vw', priority = false, posterOnSmall = false }: { asset: SantaArtSlot | undefined; className?: string; fallback?: string; sizes?: string; priority?: boolean; posterOnSmall?: boolean }) {
  const [failed, setFailed] = useState(false);
  const reducedMotion = useReducedMotion();
  // Phones (< 640 px) and "data saver" keep only the poster for a `posterOnSmall` video.
  const [lite, setLite] = useState(false);
  useEffect(() => {
    if (!posterOnSmall) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    setLite(window.matchMedia('(max-width: 639px)').matches || Boolean(conn?.saveData));
  }, [posterOnSmall]);
  const reduced = reducedMotion || lite;
  const box = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [seen, setSeen] = useState(false);
  useEffect(() => { if (inView) setSeen(true); }, [inView]);
  const isVideo = asset?.kind === 'video';
  useEffect(() => {
    if (!isVideo || !box.current) return;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => setInView(Boolean(e?.isIntersecting)), { rootMargin: '200px' });
    io.observe(box.current);
    return () => io.disconnect();
  }, [isVideo]);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = video.current; if (!v) return;
    if (inView) void v.play().catch(() => {}); else v.pause();
  }, [inView, seen]);

  if (!asset || !asset.available || failed) return <div aria-hidden="true" className={`absolute inset-0 bg-gradient-to-br ${fallback}`} />;
  if (!isVideo) return <ArtPicture path={asset.path} className={className} sizes={sizes} priority={priority} onError={() => setFailed(true)} />;
  return <div ref={box} aria-hidden="true" className="absolute inset-0">
    {/* eslint-disable-next-line @next/next/no-img-element -- pre-encoded WebP poster */}
    {asset.poster && <img src={asset.poster} alt="" className={className} loading={priority ? 'eager' : 'lazy'} decoding="async" draggable={false} />}
    {!reduced && seen && <video ref={video} className={className} muted autoPlay loop playsInline preload={priority ? 'metadata' : 'none'} disablePictureInPicture onError={() => setFailed(true)}>
      {videoSources(asset.path).map((s) => <source key={s.type} src={s.src} type={s.type} />)}
    </video>}
  </div>;
}
