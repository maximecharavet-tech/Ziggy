'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { motion, useMotionValue, useScroll, useSpring, useTransform } from 'motion/react';
import { CUTOUTS, type CutoutPose } from '@/lib/mascot';
import { HeartGlow, Sparkle } from '@/components/ziggy/Mascot';
import { useReducedMotion } from '@/lib/use-reduced-motion';

const POSES: CutoutPose[] = ['wave', 'heart', 'stand'];

interface ZiggyStageProps {
  /** The pose on show; the other two wait, already loaded, for a seamless swap. */
  pose: CutoutPose;
  /** Accent colour of the halo and the orbit, changes with the active feature. */
  color: string;
  className?: string;
}

/**
 * Ziggy, alive on a small 3D stage: he floats and breathes, his heart beats,
 * an orbit ring turns around him in perspective, he leans toward the pointer
 * and turns a little as the page scrolls past. Every pose is a stacked
 * official cutout, so a pose change is a cross-fade with a spring turn,
 * never a fresh download. Only transform and opacity move (compositor only),
 * the box has a fixed aspect ratio (no layout shift), and everything stands
 * still for visitors who prefer reduced motion.
 */
export function ZiggyStage({ pose, color, className = '' }: ZiggyStageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const still = useReducedMotion();

  // Pointer lean, mouse and pen only.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const leanX = useSpring(useTransform(py, [-1, 1], [8, -8]), { stiffness: 140, damping: 18 });
  const leanY = useSpring(useTransform(px, [-1, 1], [-12, 12]), { stiffness: 140, damping: 18 });

  // Scroll turn: a slow quarter-breath of rotation while the stage crosses the screen.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const turn = useSpring(useTransform(scrollYProgress, [0, 1], [-10, 10]), { stiffness: 90, damping: 20 });
  const rise = useTransform(scrollYProgress, [0, 1], [24, -24]);
  const tiltZ = useTransform(turn, (v) => v * 0.25);

  return (
    <div
      ref={ref}
      className={`relative mx-auto aspect-square w-full max-w-[19rem] sm:max-w-[22rem] [perspective:900px] ${className}`}
      onPointerMove={(e) => {
        if (still || e.pointerType === 'touch') return;
        const r = ref.current!.getBoundingClientRect();
        px.set(((e.clientX - r.left) / r.width) * 2 - 1);
        py.set(((e.clientY - r.top) / r.height) * 2 - 1);
      }}
      onPointerLeave={() => {
        px.set(0);
        py.set(0);
      }}
      aria-hidden="true"
    >
      {/* Halo, tinted by the active feature */}
      <div
        className="absolute inset-[6%] rounded-full transition-[background] duration-700"
        style={{ background: `radial-gradient(circle at 50% 45%, color-mix(in srgb, ${color} 34%, transparent) 0%, color-mix(in srgb, ${color} 10%, transparent) 46%, transparent 70%)` }}
      />

      {/* Orbit ring in perspective, with a small moon riding it */}
      <div className="absolute inset-x-[4%] top-[52%] h-[38%] -translate-y-1/2 [transform-style:preserve-3d]">
        <div className="stage-orbit absolute inset-0 rounded-full border transition-[border-color] duration-700" style={{ borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}>
          <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full shadow-[0_0_14px_rgba(255,214,102,0.9)]" style={{ background: '#FFD166' }} />
        </div>
      </div>

      {/* Floor shadow, breathes with the float */}
      <div className="stage-shadow absolute bottom-[7%] left-1/2 h-[7%] w-[46%] -translate-x-1/2 rounded-[50%] bg-[rgba(47,107,28,0.22)] blur-md" />

      <motion.div
        className="absolute inset-0 [transform-style:preserve-3d]"
        style={still ? undefined : { rotateX: leanX, rotateY: leanY, y: rise }}
      >
        <motion.div className="absolute inset-0" style={still ? undefined : { rotateZ: tiltZ, rotateY: turn }}>
          <div className="stage-float absolute inset-x-[16%] top-[4%] bottom-[10%]">
            {POSES.map((p) => {
              const pic = CUTOUTS[p];
              const on = p === pose;
              return (
                <motion.div
                  key={p}
                  className="absolute inset-0 flex items-end justify-center"
                  initial={false}
                  animate={
                    on
                      ? { opacity: 1, scale: 1, rotateY: 0, y: 0 }
                      : { opacity: 0, scale: 0.9, rotateY: -28, y: 14 }
                  }
                  transition={{ type: 'spring', duration: 0.7, bounce: 0.32 }}
                >
                  <span className="stage-breathe relative block h-full" style={{ aspectRatio: `${pic.width} / ${pic.height}` }}>
                    <Image
                      src={pic.src}
                      width={pic.width}
                      height={pic.height}
                      sizes="(min-width: 640px) 300px, 240px"
                      alt=""
                      className="h-full w-full select-none object-contain drop-shadow-[0_26px_30px_rgba(47,107,28,0.3)]"
                      draggable={false}
                    />
                    {on && <HeartGlow spot={pic.heart} />}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>

      <Sparkle className="left-[10%] top-[18%] h-5 w-5" delay={0} />
      <Sparkle className="right-[12%] top-[30%] h-4 w-4" color="#7FC85C" delay={0.9} />
      <Sparkle className="right-[22%] bottom-[16%] h-3 w-3" color="#5FB6EA" delay={1.7} />
    </div>
  );
}
