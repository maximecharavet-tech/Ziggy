'use client';

import { useRef, useEffect, useState, ReactNode } from 'react';

type Variant = 'fade-up' | 'fade-left' | 'fade-right' | 'zoom' | 'fade';

interface ScrollRevealProps {
  children: ReactNode;
  variant?: Variant;
  delay?: number;
  className?: string;
}

const variantStyles: Record<Variant, { hidden: string; visible: string }> = {
  'fade-up': {
    hidden: 'opacity-0 translate-y-8',
    visible: 'opacity-100 translate-y-0',
  },
  'fade-left': {
    hidden: 'opacity-0 -translate-x-8',
    visible: 'opacity-100 translate-x-0',
  },
  'fade-right': {
    hidden: 'opacity-0 translate-x-8',
    visible: 'opacity-100 translate-x-0',
  },
  zoom: {
    hidden: 'opacity-0 scale-90',
    visible: 'opacity-100 scale-100',
  },
  fade: {
    hidden: 'opacity-0',
    visible: 'opacity-100',
  },
};

export function ScrollReveal({ children, variant = 'fade-up', delay = 0, className = '' }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const styles = variantStyles[variant];

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? styles.visible : styles.hidden} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
