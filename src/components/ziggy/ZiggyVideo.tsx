'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

interface ZiggyVideoProps {
  src: string;
  /** VP9 fallback for browsers without H.264. */
  webm?: string;
  poster: string;
  className?: string;
  /** Start rolling on its own when on screen. Off for a film the visitor chooses to watch. */
  autoPlay?: boolean;
  label?: string;
}

/**
 * A muted, looping clip of Ziggy that behaves: the poster shows at once, the
 * film rolls only while it is on screen, and it stays a still picture for
 * visitors who asked for less motion or to save data.
 */
export const ZiggyVideo = forwardRef<HTMLVideoElement, ZiggyVideoProps>(function ZiggyVideo(
  { src, webm, poster, className = '', autoPlay = true, label },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(false);
  useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (reduce || saveData) setStill(true);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || still || !autoPlay) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.15 }
    );
    io.observe(video);
    return () => io.disconnect();
  }, [still, autoPlay]);

  return (
    <video
      ref={videoRef}
      className={className}
      poster={poster}
      muted
      loop
      playsInline
      preload={autoPlay ? 'metadata' : 'none'}
      aria-label={label}
      disablePictureInPicture
    >
      {!still && <source src={src} type="video/mp4" />}
      {!still && webm && <source src={webm} type="video/webm" />}
    </video>
  );
});
