'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';

type Turn = { from: number; to: number; id: number };

/**
 * A book whose pages really turn: the page lifts on its spine, shows its
 * back as it goes over, and lands on the other side, with a soft shadow
 * sweeping across. Two pages side by side (`spread`) or one page (phones).
 * Controlled by `page`; with reduced motion the pages simply cross-fade.
 */
export function FlipBook({
  page,
  spread,
  left,
  right,
  single,
  paper = '#fffaf0',
}: {
  page: number;
  spread: boolean;
  left: (i: number) => ReactNode;
  right: (i: number) => ReactNode;
  single: (i: number) => ReactNode;
  paper?: string;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(page);
  const [turn, setTurn] = useState<Turn | null>(null);
  const rot = useMotionValue(0);
  const shadow = useTransform(rot, (v) => Math.abs(Math.sin((v * Math.PI) / 180)) * 0.32);
  const ids = useRef(0);
  const latest = useRef({ shown, turn });
  latest.current = { shown, turn };

  useEffect(() => {
    const { shown: s, turn: t } = latest.current;
    const from = t ? t.to : s;
    if (page === from && !t) return;
    if (reduce) {
      setTurn(null);
      setShown(page);
      return;
    }
    if (page === from) return;
    ids.current += 1;
    const next = { from, to: page, id: ids.current };
    setShown(from);
    setTurn(next);
    const fwd = next.to > next.from;
    rot.set(spread ? 0 : fwd ? 0 : -180);
    const controls = animate(rot, spread ? (fwd ? -180 : 180) : fwd ? -180 : 0, {
      duration: 0.85,
      ease: [0.6, 0.04, 0.3, 1],
      onComplete: () => {
        setShown(next.to);
        setTurn((cur) => (cur && cur.id === next.id ? null : cur));
      },
    });
    return () => {
      // Interrupted (another turn, a resize): land on the target page at once.
      controls.stop();
      setShown(next.to);
      setTurn((cur) => (cur && cur.id === next.id ? null : cur));
    };
  }, [page, reduce, spread, rot]);

  const fwd = turn ? turn.to > turn.from : true;
  const face = 'absolute inset-0 overflow-hidden [backface-visibility:hidden] [-webkit-backface-visibility:hidden]';
  const shade = <motion.span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(40,20,10,0.9),rgba(40,20,10,0.2))]" style={{ opacity: shadow }} />;

  if (reduce) {
    return (
      <motion.div key={shown} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="relative h-full">
        {spread ? (
          <div className="grid h-full grid-cols-2">
            <div className="relative overflow-hidden">{left(shown)}</div>
            <div className="relative overflow-hidden">{right(shown)}</div>
          </div>
        ) : (
          <div className="relative h-full overflow-hidden">{single(shown)}</div>
        )}
      </motion.div>
    );
  }

  if (spread) {
    const baseLeft = turn ? (fwd ? turn.from : turn.to) : shown;
    const baseRight = turn ? (fwd ? turn.to : turn.from) : shown;
    return (
      <div className="relative grid h-full grid-cols-2 [perspective:1500px]">
        <div className="relative overflow-hidden">{left(baseLeft)}</div>
        <div className="relative overflow-hidden">{right(baseRight)}</div>
        {turn ? (
          <motion.div
            key={turn.id}
            className="absolute inset-y-0 w-1/2 [transform-style:preserve-3d]"
            style={{ rotateY: rot, [fwd ? 'right' : 'left']: 0, transformOrigin: fwd ? 'left center' : 'right center' }}
          >
            <div className={face} style={{ background: paper }}>
              {fwd ? right(turn.from) : left(turn.from)}
              {shade}
            </div>
            <div className={face} style={{ background: paper, transform: 'rotateY(180deg)' }}>
              {fwd ? left(turn.to) : right(turn.to)}
              {shade}
            </div>
          </motion.div>
        ) : null}
      </div>
    );
  }

  // One page: the old page peels away to the left (or the previous one comes back).
  const base = turn ? (fwd ? turn.to : turn.from) : shown;
  return (
    <div className="relative h-full [perspective:1600px]">
      <div className="relative h-full overflow-hidden">{single(base)}</div>
      {turn ? (
        <motion.div key={turn.id} className="absolute inset-0 [transform-style:preserve-3d]" style={{ rotateY: rot, transformOrigin: 'left center' }}>
          <div className={face} style={{ background: paper }}>
            {single(fwd ? turn.from : turn.to)}
            {shade}
          </div>
          <div className={face} style={{ background: paper, transform: 'rotateY(180deg)' }}>
            {shade}
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
