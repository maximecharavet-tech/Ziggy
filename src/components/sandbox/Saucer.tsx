'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { MascotCutout } from '@/components/ziggy/Mascot';
import type { WorldId } from '@/games2d/sandbox/content';
import { tr, type L } from '@/lib/i18n-text';

export const SAUCER_TEXT = {
  label: { fr: 'La soucoupe de Ziggy : touche-la !', en: 'Ziggy’s saucer: tap it!' },
  oops: { fr: 'Oups, mon colis !', en: 'Oops, my parcel!' },
  hello: { fr: 'Coucou !', en: 'Hello!' },
  beam: { fr: 'Le rayon de ma soucoupe : glisse ton doigt pour soulever !', en: 'My saucer’s beam: slide your finger to lift things!' },
  misted: { fr: 'Pfiou, tout mouillé ! Je m’ébroue.', en: 'Phew, all wet! Shake, shake.' },
} satisfies Record<string, L>;

/**
 * Ziggy crossing the sky in his wobbly saucer (the real felt-plush Ziggy in a
 * code-drawn saucer), as a DOM layer over the sandbox. Tap: he drops a parcel.
 * Press and hold: his tractor beam. It reacts to the world: a helmet on the
 * Moon, a periscope under the sea, floating sideways in space.
 */
export function Saucer({
  world,
  locale,
  reduceMotion,
  canDrop,
  probeSky,
  onDrop,
  onHold,
  onDone,
}: {
  world: WorldId;
  locale: string;
  reduceMotion: boolean;
  canDrop: boolean;
  /** What is in the sky behind a screen box: bit 0 a cloud, bit 1 a geyser's mist. */
  probeSky?: (box: { left: number; top: number; right: number; bottom: number }) => number;
  onDrop: (clientX: number, clientY: number) => void;
  onHold: () => void;
  onDone: () => void;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const hold = useRef<number | null>(null);
  const [bubble, setBubble] = useState<L | null>(null);
  const [hic, setHic] = useState(0);
  // A loop-the-loop now and then, never under reduced motion; deterministic per pass.
  const [loop] = useState(() => !reduceMotion && Date.now() % 3 === 0);
  const duration = reduceMotion ? 14 : 12;
  const space = world === 'space';
  const sea = world === 'undersea';
  // It looks where it flies: ducks under a cloud ahead, gets misted by a geyser's steam and shakes dry.
  const [dodge, setDodge] = useState(0);
  const [misted, setMisted] = useState(0);
  const probe = useRef(probeSky);
  probe.current = probeSky;
  const lastMist = useRef(0);
  const clear = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      const r = btn.current?.getBoundingClientRect();
      const look = probe.current;
      if (!r || !look) return;
      const ahead = look({ left: r.right - 10, top: r.top - 6, right: r.right + r.width, bottom: r.bottom + 6 });
      const here = look({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
      const below = look({ left: r.left - 10, top: r.bottom, right: r.right + 10, bottom: r.bottom + 120 });
      if ((ahead | here) & 1) {
        clear.current = 0;
        // Under the cloud if there is room, else over it.
        setDodge((d) => (d !== 0 ? d : below & 1 ? -26 : 40));
      } else if (++clear.current > 3) setDodge(0);
      const now = performance.now();
      if ((here | below) & 2 && now - lastMist.current > 3500) {
        lastMist.current = now;
        setMisted((n) => n + 1);
        setBubble(SAUCER_TEXT.misted);
      }
    }, 160);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(onDone, duration * 1000 + 300);
    return () => window.clearTimeout(t);
  }, [duration, onDone]);

  useEffect(() => {
    if (!bubble) return;
    const t = window.setTimeout(() => setBubble(null), 2200);
    return () => window.clearTimeout(t);
  }, [bubble]);

  const tap = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    setHic((n) => n + 1);
    if (canDrop) {
      setBubble(SAUCER_TEXT.oops);
      onDrop(r.left + r.width / 2, r.bottom + 6);
    } else setBubble(SAUCER_TEXT.hello);
  };

  const xs = ['-18%', '20%', '48%', '78%', '118%'];
  const ys = reduceMotion ? [0, 0, 0, 0, 0] : sea ? [0, 10, 0, 10, 0] : [0, -14, 6, -10, 0];
  return (
    <motion.div
      className="pointer-events-none absolute left-0 top-[4%] z-20 w-full"
      initial={{ x: xs[0] }}
      animate={{ x: xs, y: ys }}
      transition={{ duration, ease: 'linear', times: [0, 0.25, 0.5, 0.75, 1] }}
      data-saucer=""
    >
      <motion.div
        className="relative inline-block"
        animate={loop ? { rotate: [0, 0, 360, 360] } : reduceMotion ? {} : { rotate: space ? [-24, -16, -24] : [-5, 5, -5] }}
        transition={loop ? { duration: 2.2, delay: duration * 0.45, times: [0, 0.2, 0.8, 1] } : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div animate={{ y: dodge }} transition={reduceMotion ? { duration: 0.8, ease: 'easeInOut' } : { type: 'spring', stiffness: 160, damping: 11 }} data-saucer-dodge={dodge}>
          {/* The shake starts the other way each time, so it plays again without remounting the button. */}
          <motion.div
            animate={misted && !reduceMotion ? { x: [0, -7, 7, -6, 6, -4, 4, 0].map((v) => (misted % 2 ? v : -v)), rotate: [0, -6, 6, -5, 5, -2, 2, 0].map((v) => (misted % 2 ? v : -v)) } : {}}
            transition={{ duration: 0.9, delay: 0.5 }}
            data-saucer-misted={misted}
          >
            <motion.button
              key={hic}
              ref={btn}
              type="button"
              aria-label={tr(SAUCER_TEXT.label, locale)}
              className="pointer-events-auto relative block h-[78px] w-[110px] touch-none select-none rounded-full focus-visible:outline focus-visible:outline-4 focus-visible:outline-white"
              initial={hic && !reduceMotion ? { scale: 1.25, y: -6 } : false}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 12 }}
              onClick={tap}
              onPointerDown={() => {
                hold.current = window.setTimeout(() => {
                  hold.current = null;
                  setBubble(SAUCER_TEXT.beam);
                  onHold();
                }, 550);
              }}
              onPointerUp={() => hold.current && window.clearTimeout(hold.current)}
              onPointerLeave={() => hold.current && window.clearTimeout(hold.current)}
            >
              {/* Ziggy, sitting in the glass bubble. */}
              <span className="absolute left-1/2 top-0 h-[54px] w-[54px] -translate-x-1/2 overflow-hidden rounded-t-full">
                <span className="absolute left-1/2 top-[3px] w-[40px] -translate-x-1/2">
                  <MascotCutout pose="wave" width={40} glow={false} />
                </span>
                <span className="absolute inset-0 rounded-t-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.7),rgba(190,240,255,0.25)_45%,rgba(160,220,255,0.15))] ring-2 ring-white/70" />
                {world === 'moon' ? <span className="absolute left-1/2 top-[8px] h-[30px] w-[30px] -translate-x-1/2 rounded-full ring-2 ring-white/90" /> : null}
              </span>
              {sea ? <span className="absolute left-[64%] top-[-14px] h-[22px] w-[4px] rounded bg-[#9aa3c0] after:absolute after:-left-[2px] after:-top-[4px] after:h-[6px] after:w-[10px] after:rounded after:bg-[#9aa3c0]" /> : null}
              {/* The saucer itself. */}
              <span className="absolute inset-x-0 top-[40px] h-[26px] rounded-[50%] bg-[linear-gradient(180deg,#e9edf8,#9aa0c8)] shadow-[0_6px_10px_rgba(20,10,60,0.35)]" />
              <span className="absolute inset-x-[18px] top-[58px] h-[12px] rounded-[50%] bg-[#6f6aa8]" />
              {[0, 1, 2, 3].map((k) => (
                <span key={k} className={`absolute top-[50px] h-[8px] w-[8px] rounded-full ${reduceMotion ? '' : 'motion-safe:animate-pulse'}`} style={{ left: 18 + k * 22, background: ['#ffe45a', '#ff7a8a', '#7affc8', '#8ab4ff'][k], animationDelay: `${k * 0.25}s` }} />
              ))}
            </motion.button>
            {misted ? (
              <span key={`drops-${misted}`} aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[60px] -translate-x-1/2">
                {[-26, 0, 24].map((dx, k) => (
                  <motion.span
                    key={k}
                    className="absolute h-[9px] w-[7px] rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-[#8fd8ff] shadow-[0_0_6px_rgba(143,216,255,0.9)]"
                    style={{ left: dx }}
                    initial={{ opacity: 0.95, y: 0 }}
                    animate={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 34, x: dx * 0.4 }}
                    transition={{ duration: reduceMotion ? 2.4 : 1.1, delay: 0.5 + k * 0.08, ease: 'easeIn' }}
                  />
                ))}
              </span>
            ) : null}
          </motion.div>
        </motion.div>
        {bubble ? (
          <motion.span
            role="status"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.4, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 16 }}
            className="absolute left-[96px] top-[-8px] w-max max-w-[60vw] rounded-2xl bg-white px-3 py-1.5 text-sm font-black text-[#2c2470] shadow-lg"
          >
            {tr(bubble, locale)}
          </motion.span>
        ) : null}
      </motion.div>
    </motion.div>
  );
}
