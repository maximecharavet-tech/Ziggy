'use client';

import { useRef, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { DepthProvider, useAwake, usePointerDepth, useTilt } from './Parallax';
import { fx, shade } from './toy';

/**
 * A thick toy card that tilts towards the pointer while the layers of its
 * little scene (a `window`) slide at their own depth: a pocket diorama.
 * The whole card is one link; it squashes down when pressed.
 */
export function DioramaCard({
  href,
  label,
  from,
  to,
  window: scene,
  children,
  className = '',
  windowClassName = 'h-44 sm:h-48',
  index = 0,
  corner,
}: {
  /** Shown on the card's top corner, outside the link (a 🔊 button). */
  corner?: ReactNode;
  href: string;
  label: string;
  from: string;
  to: string;
  /** The diorama: `Layer`s inside a box that clips them. */
  window: ReactNode;
  children: ReactNode;
  className?: string;
  /** Height of the little scene window. */
  windowClassName?: string;
  index?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const awake = useAwake(box);
  const p = usePointerDepth<HTMLDivElement>();
  const tilt = useTilt(p, 7);
  const edge = shade(to, -0.34);

  return (
    <motion.div
      ref={box}
      data-still={awake ? undefined : ''}
      className={`relative h-full [perspective:1100px] ${className}`}
      initial={{ opacity: 0, y: 46, rotateX: -28, scale: 0.94 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ type: 'spring', stiffness: 110, damping: 15, delay: 0.08 + (index % 3) * 0.09 }}
    >
      <motion.div
        ref={p.ref}
        {...p.handlers}
        style={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY, transformStyle: 'preserve-3d' }}
        className="group/card relative h-full rounded-[2.2rem]"
      >
        <Link
          href={href}
          aria-label={label}
          className={`${fx.card} relative flex h-full flex-col rounded-[2.2rem] p-3.5 text-white outline-none focus-visible:ring-4 focus-visible:ring-white/80 focus-visible:ring-offset-4 focus-visible:ring-offset-[#5FB6EA] sm:p-4`}
          style={
            {
              background: `radial-gradient(120% 70% at 20% 0%, rgba(255,255,255,0.35), transparent 55%), linear-gradient(150deg, ${from}, ${to})`,
              '--edge': edge,
              '--glow': `${shade(to, -0.55)}aa`,
            } as CSSProperties
          }
        >
          <DepthProvider x={p.x} y={p.y}>
            <div
              className={`relative overflow-hidden rounded-[1.6rem] ${windowClassName}`}
              style={{ boxShadow: 'inset 0 3px 10px rgba(30,10,60,0.28), inset 0 0 0 2px rgba(255,255,255,0.35)' }}
            >
              {scene}
              {/* glass reflection on the little window */}
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(115deg,rgba(255,255,255,0.32)_0%,rgba(255,255,255,0)_32%,rgba(255,255,255,0)_70%,rgba(255,255,255,0.12)_100%)]" />
            </div>
          </DepthProvider>
          {children}
        </Link>
        {corner ? <div className="absolute bottom-[1.55rem] end-5 z-10 [transform:translateZ(30px)] sm:bottom-[1.8rem] sm:end-6">{corner}</div> : null}
      </motion.div>
    </motion.div>
  );
}
