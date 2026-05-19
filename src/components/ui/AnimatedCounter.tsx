'use client';

import { useRef, useEffect, useState } from 'react';

interface AnimatedCounterProps {
  value: string;
  className?: string;
}

export function AnimatedCounter({ value, className = '' }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState('0');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;

    const match = value.match(/^([\d.]+)/);
    if (!match) {
      setDisplay(value);
      return;
    }

    const numPart = parseFloat(match[1]);
    const suffix = value.slice(match[1].length);
    const duration = 1500;
    const steps = 40;
    const interval = duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = numPart * eased;

      if (numPart >= 100) {
        setDisplay(Math.round(current) + suffix);
      } else if (numPart >= 1) {
        setDisplay(current.toFixed(1) + suffix);
      } else {
        setDisplay(current.toFixed(2) + suffix);
      }

      if (step >= steps) {
        clearInterval(timer);
        setDisplay(value);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [started, value]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
