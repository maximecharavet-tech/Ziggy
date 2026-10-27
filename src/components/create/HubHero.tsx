'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { SayButton } from '@/components/arcade/read-aloud';
import { SplitWords } from '@/components/ui/motion-primitives';
import { Ziggy3D, type ZiggyCue } from '@/components/ziggy3d/Ziggy3D';
import { playSound } from '@/lib/sound';
import { Burst, Twinkle } from './fx/Burst';
import { DepthProvider, Layer, useAwake, usePointerDepth } from './fx/Parallax';
import { fx, loop } from './fx/toy';

const BUBBLE = ['🖍️', '🎶', '🧪', '📚', '🧑‍🎨', '🏡'];
const FLAGS = ['#FF7AB8', '#FFD447', '#5FB6EA', '#7FC85C', '#B07CFF', '#FF9F43', '#FF7AB8', '#FFD447', '#5FB6EA', '#7FC85C', '#B07CFF', '#FF9F43', '#FF7AB8'];

/** The workshop: Ziggy the painter (beret on) among his easel, shelf and floating tools. */
export function HubHero({ eyebrow, title, subtitle, locale }: { eyebrow: string; title: string; subtitle: string; locale: string }) {
  const reduce = useReducedMotion();
  const p = usePointerDepth<HTMLElement>({ global: true });
  const awake = useAwake(p.ref);
  const [burst, setBurst] = useState(0);
  const [cue, setCue] = useState<{ kind: ZiggyCue; id: number } | null>(null);
  const [bubble, setBubble] = useState(0);
  const taps = useRef(0);

  useEffect(() => {
    if (reduce || !awake) return;
    const t = window.setInterval(() => setBubble((b) => (b + 1) % BUBBLE.length), 1900);
    return () => window.clearInterval(t);
  }, [reduce, awake]);

  const tapZiggy = () => {
    taps.current += 1;
    setBurst((b) => b + 1);
    setCue({ kind: taps.current % 2 ? 'cheer' : 'love', id: taps.current });
    playSound('pop');
  };

  return (
    <section
      ref={p.ref}
      data-still={awake ? undefined : ''}
      className="relative isolate overflow-hidden rounded-[2.5rem] shadow-[0_40px_80px_-40px_rgba(90,40,140,0.55),inset_0_2px_0_rgba(255,255,255,0.8)] ring-1 ring-white/60"
      style={{ background: 'radial-gradient(70% 90% at 72% 60%, #FFF7EC 0%, rgba(255,247,236,0) 60%), linear-gradient(140deg, #FFE9D6 0%, #FFD9E8 48%, #E6DCFF 100%)' }}
    >
      <DepthProvider x={p.x} y={p.y}>
        {/* Far: a slowly turning sunburst behind Ziggy, paint splats on the wall. */}
        <Layer depth={-10} className="left-1/2 top-[64%] h-[680px] w-[680px] -translate-x-1/2 -translate-y-1/2 lg:left-[72%] lg:top-[58%]">
          <div className={`h-full w-full rounded-full opacity-60 ${fx.spin}`} style={{ ...loop({ dur: 90 }), background: 'repeating-conic-gradient(from 0deg, rgba(255,255,255,0.75) 0deg 9deg, rgba(255,255,255,0) 9deg 22deg)', maskImage: 'radial-gradient(circle, #000 18%, transparent 68%)', WebkitMaskImage: 'radial-gradient(circle, #000 18%, transparent 68%)' }} />
        </Layer>
        <Layer depth={-6} className="inset-0">
          <svg viewBox="0 0 1000 460" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
            <path d="M900 300c30-12 70 4 72 34s-30 46-60 36-44-58-12-70z" fill="#7FC85C" opacity="0.22" />
            <path d="M560 360c30-30 86-20 96 12s-24 64-64 56-62-38-32-68z" fill="#5FB6EA" opacity="0.25" />
            <path d="M420 330c36-20 80 2 82 36s-40 52-70 40-46-58-12-76z" fill="#FFD447" opacity="0.28" />
          </svg>
        </Layer>
        {/* Bunting across the top. */}
        <Layer depth={3} className="inset-x-0 top-0 h-[84px]">
          <svg viewBox="0 0 1000 84" preserveAspectRatio="none" className="h-full w-full">
            <path d="M-10 4 Q500 64 1010 4" stroke="#8a5a3c" strokeWidth="3" fill="none" />
            {FLAGS.map((c, i) => {
              const x = 30 + i * 78;
              const t = (x + 10) / 1020;
              const y = 4 + 120 * t * (1 - t);
              return <path key={i} d={`M${x - 17} ${y} L${x + 17} ${y} L${x} ${y + 36} Z`} fill={c} stroke="rgba(0,0,0,0.08)" strokeWidth="1" strokeLinejoin="round" />;
            })}
          </svg>
        </Layer>

        <div className="relative z-10 flex flex-col lg:min-h-[470px] lg:flex-row lg:items-stretch">
          {/* Words */}
          <div className="flex flex-col items-center px-6 pb-2 pt-16 text-center sm:px-10 lg:w-[46%] lg:items-start lg:justify-center lg:py-16 lg:ps-14 lg:pe-0 lg:text-start">
            <motion.span
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 text-sm font-black uppercase tracking-[0.12em] text-[#E0457B] shadow-[0_6px_14px_-8px_rgba(224,69,123,0.6)] ring-1 ring-white"
            >
              <Twinkle size={14} color="#FFB13B" /> {eyebrow}
            </motion.span>
            <h1 className="mt-4 font-display text-[2.6rem] font-bold leading-[1.02] text-[#2a1650] text-balance sm:text-6xl">
              <SplitWords text={title} />
            </h1>
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-4 max-w-md text-lg leading-snug text-[#5b4a86] sm:text-xl">
              {subtitle}
            </motion.p>
            <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.45, type: 'spring', stiffness: 300, damping: 16 }} className="mt-5">
              <SayButton texts={[title, subtitle]} locale={locale} size="lg" className="!bg-white !text-[#5FB6EA] shadow-[0_6px_0_#cfe3f3,0_14px_22px_-10px_rgba(60,100,160,0.5)] !ring-white" />
            </motion.div>
          </div>

          {/* The workshop scene */}
          <div className="relative h-[330px] sm:h-[400px] lg:h-auto lg:flex-1">
            {/* Shelf with jars */}
            <Layer depth={8} className="right-[2%] top-[38%] hidden w-[24%] sm:block">
              <div className="flex items-end justify-around px-2 text-[2.2rem] leading-none">
                <span className={fx.bob} style={loop({ dur: 4, tilt: 3, amp: -2 })}>
                  🎨
                </span>
                <span className={fx.bob} style={loop({ dur: 5, delay: 0.5, tilt: -3, amp: -2 })}>
                  🧪
                </span>
                <span className={fx.bob} style={loop({ dur: 4.4, delay: 1, tilt: 2, amp: -2 })}>
                  📚
                </span>
              </div>
              <div className="h-3.5 rounded-full bg-[linear-gradient(180deg,#d9a06b,#a8683f)] shadow-[0_8px_10px_-4px_rgba(90,40,10,0.45),inset_0_2px_0_rgba(255,255,255,0.4)]" />
            </Layer>
            {/* Braided rug */}
            <Layer depth={10} className="bottom-[3%] left-1/2 h-[19%] w-[78%] -translate-x-1/2 sm:w-[64%]">
              <div className="h-full w-full rounded-[50%] shadow-[0_14px_20px_-12px_rgba(90,40,120,0.6)]" style={{ background: 'repeating-radial-gradient(ellipse at center, #ff9fbd 0 9px, #ffd27a 9px 18px, #9fd8ff 18px 27px, #c9a7ff 27px 36px)' }} />
            </Layer>
            {/* Easel with a rainbow painting */}
            <Layer depth={15} className="bottom-[9%] left-[1%] h-[58%] sm:left-[4%] sm:h-[66%]">
              <svg viewBox="0 0 140 210" className="h-full w-auto drop-shadow-[0_12px_10px_rgba(90,40,10,0.25)]">
                <path d="M70 6 L22 206 M70 6 L118 206 M70 30 L70 200" stroke="#a8683f" strokeWidth="8" strokeLinecap="round" />
                <rect x="14" y="128" width="112" height="10" rx="5" fill="#c98b56" />
                <rect x="18" y="24" width="104" height="104" rx="8" fill="#fffdf6" stroke="#e7d7bd" strokeWidth="3" transform="rotate(-3 70 76)" />
                <g transform="rotate(-3 70 76)">
                  <path d="M34 104 A36 36 0 0 1 106 104" stroke="#FF6B8B" strokeWidth="9" fill="none" />
                  <path d="M43 104 A27 27 0 0 1 97 104" stroke="#FFD447" strokeWidth="9" fill="none" />
                  <path d="M52 104 A18 18 0 0 1 88 104" stroke="#5FB6EA" strokeWidth="9" fill="none" />
                  <circle cx="96" cy="44" r="9" fill="#FFB13B" />
                  <path d="M30 116 h80" stroke="#7FC85C" strokeWidth="6" strokeLinecap="round" />
                </g>
              </svg>
            </Layer>

            {/* Ziggy the painter */}
            <Layer depth={12} interactive className="bottom-[7%] left-1/2 h-[82%] w-[62%] -translate-x-1/2 sm:w-[50%] lg:w-[46%]">
              <Ziggy3D className="h-full w-full cursor-pointer" idle="wave" accessory="beret" framing="full" fallback="wave" cue={cue} onTap={tapZiggy} label="Ziggy" />
              <Burst fire={burst} kind={burst % 2 ? 'hearts' : 'stars'} count={18} />
            </Layer>

            {/* Speech bubble: what shall we make today? */}
            <Layer depth={20} className="right-[4%] top-[4%] sm:right-[10%] lg:right-[9%] lg:top-[12%]">
              <div className={`relative grid h-16 w-16 place-items-center rounded-[1.4rem] bg-white text-[2.1rem] shadow-[0_6px_0_#eadcf7,0_16px_24px_-12px_rgba(90,40,140,0.5)] ${fx.float}`} style={loop({ dur: 3.4, amp: -6 })}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span key={bubble} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 16 }} className="leading-none">
                    {BUBBLE[bubble]}
                  </motion.span>
                </AnimatePresence>
                <span className="absolute -bottom-2 left-3 h-5 w-5 rotate-45 rounded-[4px] bg-white" />
              </div>
            </Layer>

            {/* Near: floating tools and sparkles */}
            <Layer depth={30} className="left-[30%] top-[6%] text-[2.4rem] sm:left-[30%]">
              <span className={`block ${fx.bob}`} style={loop({ dur: 3.6, tilt: 14, amp: -10 })}>
                🖌️
              </span>
            </Layer>
            <Layer depth={36} className="bottom-[20%] right-[3%] text-[2.2rem] sm:right-[5%]">
              <span className={`block ${fx.bob}`} style={loop({ dur: 4.2, delay: 0.6, tilt: -12, amp: -12 })}>
                🎵
              </span>
            </Layer>
            <Layer depth={26} className="bottom-[2%] right-[24%] hidden text-[2rem] sm:block">
              <span className={`block ${fx.bob}`} style={loop({ dur: 5, delay: 1.2, tilt: 8, amp: -6 })}>
                🧩
              </span>
            </Layer>
            <Layer depth={22} className="left-[24%] top-[44%]">
              <Twinkle size={22} color="#FFB13B" className={fx.twinkle} style={loop({ dur: 2.4 })} />
            </Layer>
            <Layer depth={28} className="right-[30%] top-[12%]">
              <Twinkle size={16} color="#FF7AB8" className={fx.twinkle} style={loop({ dur: 3, delay: 0.9 })} />
            </Layer>
            <Layer depth={18} className="bottom-[36%] right-[20%]">
              <Twinkle size={12} color="#5FB6EA" className={fx.twinkle} style={loop({ dur: 2.7, delay: 0.4 })} />
            </Layer>
          </div>
        </div>
      </DepthProvider>
    </section>
  );
}
