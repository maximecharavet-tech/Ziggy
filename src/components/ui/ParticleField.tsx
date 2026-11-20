'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { isLowPower } from './fx/env';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  pulse: number;
  pulseSpeed: number;
}

interface ParticleFieldProps {
  className?: string;
  color?: string;
  count?: number;
}

function rgbOf(color: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return [34, 197, 94];
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Soft drifting dots behind a hero. Runs only while on screen and while the
 * tab is visible; fewer dots and a lower resolution on phones and weak
 * devices; a single still frame under reduced motion. The glow pulses below
 * 0.3 Hz (never a flicker).
 */
export function ParticleField({ className = '', color = '#22C55E', count = 40 }: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const low = isLowPower();
    const [r, g, b] = rgbOf(color);
    let particles: Particle[] = [];
    let raf = 0;
    let onScreen = true;
    let w = 0;
    let h = 0;

    const seed = () => {
      const small = window.innerWidth < 768;
      const n = Math.max(4, Math.floor(count * (small ? 0.4 : 1) * (low ? 0.6 : 1)));
      particles = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        size: Math.random() * 3 + 1,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.5 + 0.1,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.02 + 0.005,
      }));
    };

    const draw = (move: boolean) => {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        if (move) {
          p.x += p.speedX;
          p.y += p.speedY;
          p.pulse += p.pulseSpeed;
          if (p.x < 0) p.x = w;
          if (p.x > w) p.x = 0;
          if (p.y < 0) p.y = h;
          if (p.y > h) p.y = 0;
        }
        const alpha = p.opacity * (0.6 + 0.4 * Math.sin(p.pulse));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fill();
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, low ? 1 : 2);
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      // setTransform, not scale: a resize must not multiply the previous scale.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      draw(false);
    };

    const loop = () => {
      raf = 0;
      draw(true);
      schedule();
    };
    const schedule = () => {
      if (!raf && !reduced && onScreen && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const pause = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    resize();
    schedule();
    window.addEventListener('resize', resize);
    const onVisibility = () => (document.hidden ? pause() : schedule());
    document.addEventListener('visibilitychange', onVisibility);
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) schedule();
      else pause();
    });
    io.observe(canvas);

    return () => {
      pause();
      io.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [color, count, reduced]);

  return <canvas ref={canvasRef} className={`pointer-events-none absolute inset-0 w-full h-full ${className}`} aria-hidden="true" />;
}
