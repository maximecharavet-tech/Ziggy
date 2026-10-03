'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

type Variant = 'fade-up' | 'fade-left' | 'fade-right' | 'zoom' | 'fade';

interface ScrollRevealProps {
  children: ReactNode;
  variant?: Variant;
  /** Delay in milliseconds. */
  delay?: number;
  className?: string;
}

/*
 * One IntersectionObserver for the whole page and a CSS transition per block,
 * instead of a React state and an observer per block: same look, a fraction of
 * the main-thread work on a long page. A block reveals once it is 10 % in.
 */
let observer: IntersectionObserver | null = null;

function shared(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null;
  if (observer) return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        el.classList.add('is-in');
        observer?.unobserve(el);
        // Hand the layer back to the compositor once the move is done.
        window.setTimeout(() => el.classList.add('is-settled'), 900);
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.01 }
  );
  return observer;
}

export function ScrollReveal({ children, variant = 'fade-up', delay = 0, className = '' }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = shared();
    if (!io) {
      el.classList.add('is-in', 'is-settled');
      return;
    }
    io.observe(el);
    return () => io.unobserve(el);
  }, []);

  return (
    <div
      ref={ref}
      data-reveal={variant}
      className={`reveal ${className}`}
      style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
