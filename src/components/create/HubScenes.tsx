'use client';

import type { CSSProperties, ReactNode } from 'react';
import { flatSvg } from '@/coloring/svg';
import { ziggy } from '@/coloring/pages/ziggy';
import { AvatarPreview } from '@/components/world/AvatarPreview';
import { Twinkle } from './fx/Burst';
import { Layer } from './fx/Parallax';
import { fx, loop } from './fx/toy';

/*
 * The six pocket dioramas of the Makers' Workshop cards: each is a few
 * layers (far wall, middle props, near props) that slide at their own depth
 * when the card tilts, and float gently on their own.
 */

const Bg = ({ style }: { style: CSSProperties }) => <div aria-hidden="true" className="absolute inset-0" style={style} />;

function Prop({ children, cls = fx.bob, style, className = '' }: { children: ReactNode; cls?: string; style?: CSSProperties; className?: string }) {
  return (
    <span className={`block leading-none drop-shadow-[0_6px_5px_rgba(40,10,60,0.22)] ${cls} ${className}`} style={style}>
      {children}
    </span>
  );
}

/* Ziggy's colouring page, half coloured: the sheet on the easel. */
const HALF: Record<string, string> = {
  sky: 'sky',
  sun: 'yellow',
  head: 'green',
  body: 'green',
  'heart-rim': 'orange',
  heart: 'yellow',
  'shoulder-left': 'green',
  'shoulder-right': 'green',
  'antenna-ball-left': 'pink',
  'antenna-ball-right': 'pink',
  'iris-left': 'lime',
  'iris-right': 'lime',
  'eye-left': 'white',
  'eye-right': 'white',
  'hill-back': 'mint',
  'twinkle-1': 'yellow',
  'twinkle-2': 'pink',
  'flower-1': 'pink',
  'flower-heart-1': 'yellow',
};
let sheet: string | null = null;
const sheetSvg = () => (sheet ??= flatSvg(ziggy, HALF));

export function ColorScene() {
  return (
    <>
      <Bg style={{ background: 'radial-gradient(90% 80% at 80% 10%, #FFF4F8 0%, transparent 60%), linear-gradient(160deg, #FFE1EA 0%, #FFC2D3 55%, #FF9EB4 100%)' }} />
      <Layer depth={-5} className="inset-0">
        <svg viewBox="0 0 320 190" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
          <path d="M-10 150c30-22 64-8 80 8s-6 40-36 40-68-32-44-48z" fill="#FFD447" opacity="0.8" />
          <path d="M262 18c26-8 52 8 54 28s-22 34-44 26-36-46-10-54z" fill="#7FC85C" opacity="0.7" />
          <path d="M250 140c20-14 50-4 56 14s-14 34-36 30-38-30-20-44z" fill="#5FB6EA" opacity="0.65" />
          <circle cx="40" cy="34" r="16" fill="#B07CFF" opacity="0.55" />
        </svg>
      </Layer>
      <Layer depth={9} className="left-1/2 top-[9%] h-[84%] -translate-x-1/2">
        <div className={`h-full ${fx.sway}`} style={loop({ dur: 7, tilt: 1.5, origin: '50% 100%' })}>
          <div className="aspect-square h-full -rotate-[5deg] rounded-xl bg-white p-1.5 shadow-[0_14px_22px_-10px_rgba(120,20,60,0.55)] ring-1 ring-black/5">
            <div className="h-full w-full overflow-hidden rounded-lg [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: sheetSvg() }} />
          </div>
        </div>
      </Layer>
      <Layer depth={18} className="bottom-[4%] left-[5%] text-5xl">
        <Prop style={loop({ dur: 3.4, tilt: 8 })}>🖍️</Prop>
      </Layer>
      <Layer depth={24} className="bottom-[6%] right-[5%] text-5xl">
        <Prop style={loop({ dur: 4.2, delay: 0.6, tilt: -6 })}>🎨</Prop>
      </Layer>
      <Layer depth={14} className="right-[13%] top-[8%]">
        <Twinkle size={22} color="#FFD447" className={fx.twinkle} style={loop({ dur: 2.4 })} />
      </Layer>
      <Layer depth={12} className="left-[14%] top-[14%]">
        <Twinkle size={14} color="#ffffff" className={fx.twinkle} style={loop({ dur: 3, delay: 0.8 })} />
      </Layer>
    </>
  );
}

const BAND = [
  { e: '🐻', c: '#9b6be8', x: '16%', d: 0 },
  { e: '🐸', c: '#3fbf6a', x: '50%', d: 0.25 },
  { e: '🐦', c: '#ff7ab8', x: '84%', d: 0.5 },
];

export function MusicScene() {
  return (
    <>
      <Bg style={{ background: 'radial-gradient(70% 60% at 50% 0%, #a98bff 0%, transparent 70%), linear-gradient(180deg, #3a1f86 0%, #5a35c8 60%, #7b5cf0 100%)' }} />
      <Layer depth={-4} className="inset-x-0 top-0 h-full">
        <div className={`absolute -top-6 left-[18%] h-[130%] w-16 origin-top bg-gradient-to-b from-[#fff6c8]/70 to-transparent blur-[2px] [clip-path:polygon(40%_0,60%_0,100%_100%,0_100%)] ${fx.sway}`} style={loop({ dur: 6, tilt: 9 })} />
        <div className={`absolute -top-6 right-[18%] h-[130%] w-16 origin-top bg-gradient-to-b from-[#ffd1ec]/60 to-transparent blur-[2px] [clip-path:polygon(40%_0,60%_0,100%_100%,0_100%)] ${fx.sway}`} style={loop({ dur: 7, delay: 1, tilt: -9 })} />
      </Layer>
      <Layer depth={6} className="inset-x-[-6%] bottom-[-34%] h-[62%]">
        <div className="h-full w-full rounded-[50%] bg-[radial-gradient(60%_60%_at_50%_30%,#ffcf7a,#e79b3c)] shadow-[inset_0_6px_0_rgba(255,255,255,0.4)]" />
      </Layer>
      {BAND.map((b) => (
        <Layer key={b.e} depth={13} className="bottom-[16%] w-16 -translate-x-1/2" style={{ left: b.x }}>
          <div className="relative flex flex-col items-center">
            <Prop cls={fx.bob} className="text-[2.6rem]" style={loop({ dur: 0.9, delay: b.d, amp: -10, tilt: 7 })}>
              {b.e}
            </Prop>
            <span className="-mt-1 block h-4 w-14 rounded-[50%]" style={{ background: `radial-gradient(70% 90% at 50% 20%, #ffffffaa, ${b.c})`, boxShadow: `0 4px 0 ${b.c}99` }} />
          </div>
        </Layer>
      ))}
      {['♪', '♫', '♪', '♬'].map((n, i) => (
        <Layer key={i} depth={20} className="bottom-[46%] text-2xl font-black" style={{ left: `${14 + i * 22}%`, color: ['#FFD447', '#FF7AB8', '#7FE3FF', '#B6FF8F'][i] }}>
          <span className={`block ${fx.rise}`} style={loop({ dur: 2.8, delay: i * 0.7, amp: -70, dx: i % 2 ? -10 : 10 })}>
            {n}
          </span>
        </Layer>
      ))}
    </>
  );
}

export function SandScene() {
  return (
    <>
      <Bg style={{ background: 'linear-gradient(180deg, #9fd6ff 0%, #cfeaff 45%, #ffe6c4 100%)' }} />
      <Layer depth={-5} className="right-[8%] top-[8%]">
        <div className={`h-14 w-14 rounded-full bg-[radial-gradient(circle,#fff7d1_0%,#ffd447_45%,rgba(255,212,71,0)_72%)] ${fx.pulse}`} style={loop({ dur: 3.2, grow: 1.12 })} />
      </Layer>
      <Layer depth={5} className="inset-x-[-4%] bottom-0 h-[58%]">
        <svg viewBox="0 0 320 110" className="h-full w-full" preserveAspectRatio="none">
          <defs>
            <pattern id="grains" width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="3" height="3" fill="#e9b45f" opacity="0.55" />
              <rect x="3" y="3" width="3" height="3" fill="#fbe0a6" opacity="0.6" />
            </pattern>
          </defs>
          <path d="M0 46 Q60 18 120 40 T230 34 T320 30 V110 H0Z" fill="#efbd6c" />
          <path d="M0 46 Q60 18 120 40 T230 34 T320 30 V110 H0Z" fill="url(#grains)" />
          <path d="M150 62 Q190 46 236 60 Q232 84 192 86 Q156 84 150 62Z" fill="#4aa7f5" />
          <path d="M160 62 Q190 52 226 61" stroke="#bfe6ff" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M0 78 Q80 60 160 82 T320 74 V110 H0Z" fill="#f5d18c" />
          <path d="M0 78 Q80 60 160 82 T320 74 V110 H0Z" fill="url(#grains)" opacity="0.7" />
        </svg>
      </Layer>
      <Layer depth={12} className="bottom-[34%] left-[22%] text-[2.4rem]">
        <Prop cls={fx.sway} style={loop({ dur: 4, tilt: 7, origin: '50% 100%' })}>
          🌱
        </Prop>
      </Layer>
      <Layer depth={14} className="bottom-[38%] left-[40%] text-[2rem]">
        <Prop cls={fx.sway} style={loop({ dur: 5, delay: 0.5, tilt: -6, origin: '50% 100%' })}>
          🌸
        </Prop>
      </Layer>
      <Layer depth={20} className="left-[8%] top-[6%] text-[2.6rem]">
        <Prop style={loop({ dur: 3.6, tilt: -10 })}>🪣</Prop>
      </Layer>
      {[0, 1, 2].map((i) => (
        <Layer key={i} depth={20} className="left-[17%] top-[30%]">
          <span className={`block h-2 w-2 rounded-[2px] bg-[#e9b45f] ${fx.rise}`} style={loop({ dur: 1.2, delay: i * 0.4, amp: 46, dx: i - 1 })} />
        </Layer>
      ))}
      <Layer depth={24} className="bottom-[8%] right-[8%] text-[2.6rem]">
        <Prop style={loop({ dur: 3, delay: 0.3, tilt: 6 })}>🧪</Prop>
      </Layer>
      <Layer depth={18} className="right-[30%] top-[16%] text-[1.8rem]">
        <Prop cls={fx.float} style={loop({ dur: 2.6, amp: -8 })}>
          💧
        </Prop>
      </Layer>
    </>
  );
}

export function NestScene() {
  return (
    <>
      <Bg style={{ background: 'linear-gradient(180deg, #3c3f9c 0%, #8a74d1 48%, #ffb79e 100%)' }} />
      {[
        [12, 14, 12, 0],
        [30, 8, 9, 0.6],
        [70, 12, 11, 1.2],
        [88, 26, 8, 0.3],
        [52, 6, 7, 0.9],
      ].map(([x, y, s, d], i) => (
        <Layer key={i} depth={-3} style={{ left: `${x}%`, top: `${y}%` }}>
          <Twinkle size={s} color="#fff6c8" className={fx.twinkle} style={loop({ dur: 2.2 + i * 0.3, delay: d })} />
        </Layer>
      ))}
      <Layer depth={-2} className="right-[10%] top-[8%] text-3xl">
        <Prop cls={fx.float} style={loop({ dur: 6 })}>
          🌙
        </Prop>
      </Layer>
      <Layer depth={6} className="inset-x-[-10%] bottom-[-30%] h-[70%]">
        <div className="h-full w-full rounded-[50%] bg-[radial-gradient(70%_60%_at_50%_20%,#9be58a,#4fae4a)] shadow-[inset_0_6px_0_rgba(255,255,255,0.35)]" />
      </Layer>
      <Layer depth={10} className="bottom-[26%] left-[52%] text-[3.4rem]">
        <Prop cls="">🏡</Prop>
      </Layer>
      <Layer depth={10} className="bottom-[22%] left-[14%] text-[2.2rem]">
        <Prop cls={fx.sway} style={loop({ dur: 5, tilt: 5, origin: '50% 100%' })}>
          🌳
        </Prop>
      </Layer>
      <Layer depth={20} className="bottom-[8%] left-[34%] text-[2.8rem]">
        <Prop style={loop({ dur: 1.8, amp: -8, tilt: 5 })}>🐣</Prop>
      </Layer>
      {[0, 1].map((i) => (
        <Layer key={i} depth={22} className="bottom-[40%] text-xl text-[#ff7ab8]" style={{ left: `${36 + i * 8}%` }}>
          <span className={`block ${fx.rise}`} style={loop({ dur: 3, delay: i * 1.4, amp: -50, dx: i ? 8 : -6 })}>
            ♥
          </span>
        </Layer>
      ))}
    </>
  );
}

export function StoryScene() {
  return (
    <>
      <Bg style={{ background: 'radial-gradient(80% 70% at 50% 100%, #fff7d6 0%, transparent 60%), linear-gradient(180deg, #8fd3ff 0%, #c9ecff 60%, #e9f7ff 100%)' }} />
      <Layer depth={-5} className="left-[6%] top-[10%]">
        <div className={`h-6 w-16 rounded-full bg-white/90 shadow-[14px_-8px_0_-2px_rgba(255,255,255,0.9)] ${fx.drift}`} style={loop({ dur: 12, dx: 16, dy: 0 })} />
      </Layer>
      <Layer depth={-3} className="right-[10%] top-[24%]">
        <div className={`h-5 w-12 rounded-full bg-white/80 shadow-[10px_-6px_0_-2px_rgba(255,255,255,0.8)] ${fx.drift}`} style={loop({ dur: 14, delay: 2, dx: -14, dy: 0 })} />
      </Layer>
      <Layer depth={7} className="bottom-[-6%] left-1/2 w-[86%] -translate-x-1/2">
        <svg viewBox="0 0 280 90" className="w-full">
          <path d="M140 22 Q80 4 14 16 L10 80 Q78 70 140 86Z" fill="#fffaf0" stroke="#d9c7a3" strokeWidth="2" />
          <path d="M140 22 Q200 4 266 16 L270 80 Q202 70 140 86Z" fill="#fff6e2" stroke="#d9c7a3" strokeWidth="2" />
          <path d="M140 22 V86" stroke="#c9b48c" strokeWidth="3" />
          {[34, 46, 58].map((y) => (
            <path key={y} d={`M${158} ${y} Q206 ${y - 8} 250 ${y - 4}`} stroke="#e4d4b4" strokeWidth="3" fill="none" strokeLinecap="round" />
          ))}
          <path d="M8 82 Q78 72 140 90 Q202 72 272 82 L272 88 Q202 80 140 94 Q78 80 8 88Z" fill="#8a5a3c" />
        </svg>
      </Layer>
      <Layer depth={14} className="bottom-[34%] left-[22%] text-[3.2rem]">
        <Prop cls={fx.float} style={loop({ dur: 4, amp: -6 })}>
          🏰
        </Prop>
      </Layer>
      <Layer depth={24} className="right-[12%] top-[10%] text-[2.6rem]">
        <Prop cls={fx.drift} style={loop({ dur: 7, dx: -18, dy: 8 })}>
          🐉
        </Prop>
      </Layer>
      <Layer depth={18} className="bottom-[36%] right-[24%]">
        <Twinkle size={20} color="#FFD447" className={fx.twinkle} style={loop({ dur: 2.2 })} />
      </Layer>
      <Layer depth={16} className="left-[48%] top-[16%]">
        <Twinkle size={13} color="#ffffff" className={fx.twinkle} style={loop({ dur: 2.8, delay: 0.7 })} />
      </Layer>
    </>
  );
}

const DEMO = { hairColor: 'auburn', hairLength: 'medium', hairStyle: 'curly', skinTone: 'tone2', eyeColor: 'green', glasses: false, freckles: true } as const;

export function AvatarScene({ label }: { label: string }) {
  return (
    <>
      <Bg style={{ background: 'radial-gradient(60% 70% at 50% 40%, #fff0fb 0%, transparent 70%), linear-gradient(160deg, #ffd3ef 0%, #e3c8ff 60%, #c7a5ff 100%)' }} />
      {[
        ['8%', '62%', 40, '#ffffff66'],
        ['80%', '10%', 54, '#ffffff55'],
        ['66%', '70%', 26, '#ffffff77'],
      ].map(([x, y, s, c], i) => (
        <Layer key={i} depth={-6} style={{ left: x as string, top: y as string }}>
          <span className="block rounded-full" style={{ width: s as number, height: s as number, background: c as string }} />
        </Layer>
      ))}
      <Layer depth={8} className="bottom-[-4%] left-1/2 h-[96%] -translate-x-1/2">
        <div className="relative h-full rounded-t-[999px] bg-[linear-gradient(160deg,#ffe29a,#f2b53a)] p-1.5 shadow-[0_10px_24px_-10px_rgba(90,30,120,0.6)]">
          <div className="h-full overflow-hidden rounded-t-[999px] bg-[radial-gradient(80%_70%_at_50%_30%,#fff,#dff4ff)]">
            <div className="flex h-full items-end justify-center">
              <AvatarPreview b={DEMO} outfitColor="#F472B6" outfit="artist" size={112} label={label} />
            </div>
          </div>
        </div>
      </Layer>
      <Layer depth={20} className="left-[8%] top-[12%] text-[2.2rem]">
        <Prop style={loop({ dur: 3.2, tilt: -10 })}>👑</Prop>
      </Layer>
      <Layer depth={24} className="bottom-[10%] left-[10%] text-[2rem]">
        <Prop style={loop({ dur: 3.8, delay: 0.4, tilt: 8 })}>🎀</Prop>
      </Layer>
      <Layer depth={22} className="right-[8%] top-[16%] text-[2.2rem]">
        <Prop style={loop({ dur: 3.4, delay: 0.8, tilt: 9 })}>🕶️</Prop>
      </Layer>
      <Layer depth={18} className="bottom-[12%] right-[10%] text-[2rem]">
        <Prop style={loop({ dur: 4, delay: 0.2, tilt: -7 })}>🧢</Prop>
      </Layer>
    </>
  );
}
