'use client';

import { useEffect, useRef } from 'react';
import { FACE } from '@/lib/mascot';
import { ZiggyLogo } from './ZiggyLogo';

const KEY = 'ziggy:intro';
const DURATION = 2300;

/**
 * The once-per-session welcome: Ziggy's face pops in, a ring traces around
 * it, three ripples spread, the wordmark rises and the Hyper™ signature
 * follows; then the whole curtain lifts.
 *
 * It is server-rendered and driven by CSS, and only shown when an inline
 * script in the layout has set html[data-intro] (first view of the session,
 * no reduced-motion preference). Any click, key, scroll or touch skips it.
 */
export function ZiggyIntro() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.intro !== '1') return;
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {}

    let done = false;
    const leave = () => {
      if (done) return;
      done = true;
      ref.current?.classList.add('is-leaving');
      window.setTimeout(() => {
        delete root.dataset.intro;
      }, 520);
    };
    const timer = window.setTimeout(leave, DURATION);
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, leave, { once: true, passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, leave));
    };
  }, []);

  return (
    <div ref={ref} className="ziggy-intro" aria-hidden="true">
      <div className="ziggy-intro__stage">
        <span className="ziggy-intro__ripple" />
        <span className="ziggy-intro__ripple" style={{ animationDelay: '0.75s' }} />
        <span className="ziggy-intro__ripple" style={{ animationDelay: '1.1s' }} />
        <svg className="ziggy-intro__ring" viewBox="0 0 200 200">
          <defs>
            <linearGradient id="intro-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F2647B" />
              <stop offset="35%" stopColor="#FBBF24" />
              <stop offset="65%" stopColor="#7FC85C" />
              <stop offset="100%" stopColor="#5FB6EA" />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r="92" />
        </svg>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ziggy-intro__face" src={FACE} alt="" width={512} height={512} fetchPriority="high" />
      </div>
      <div className="ziggy-intro__word">
        <ZiggyLogo size={190} />
      </div>
      <p className="ziggy-intro__sig">
        Powered by <span>Hyper™ AI Engine</span>
      </p>
    </div>
  );
}
