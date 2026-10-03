'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useProgressMap } from '@/components/account/useProgressMap';
import { useProfile } from '@/components/account/ProfileProvider';
import { MascotCutout } from '@/components/ziggy/Mascot';
import { computeRewards, BADGES, type BadgeId, type Rewards } from '@/lib/rewards';
import { playSound } from '@/lib/sound';
import { speak, stopSpeaking } from '@/lib/voice';
import { EASE_OUT } from '@/lib/motion';

type Moment = { kind: 'level'; level: number; levelId: string } | { kind: 'badge'; id: BadgeId };

const seenKey = (uid: string | undefined) => `ziggy:rewards-seen:${uid ?? 'guest'}`;
type Seen = { level: number; badges: BadgeId[] };

const snapshot = (r: Rewards): Seen => ({
  level: r.level,
  badges: BADGES.map((b) => b.id).filter((id) => r.badges[id]),
});

/**
 * Canvas burst behind the medallion: a shock ring, short rays and slow embers.
 * "A few embers look like a seal being struck; a shower of sparks looks like a
 * fairground" — so it stays sparse, and stops by itself.
 */
function Embers({ colors }: { colors: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = (canvas.width = canvas.offsetWidth * dpr);
    const h = (canvas.height = canvas.offsetHeight * dpr);
    const cx = w / 2;
    const cy = h * 0.42;
    const parts = Array.from({ length: 70 }, (_, i) => {
      const a = Math.random() * Math.PI * 2;
      const fast = i < 26;
      const v = (fast ? 6 + Math.random() * 7 : 1 + Math.random() * 2.2) * dpr;
      return {
        x: cx,
        y: cy,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - (fast ? 0 : 1.2 * dpr),
        r: (fast ? 2 + Math.random() * 2 : 1.5 + Math.random() * 2.5) * dpr,
        life: fast ? 0.9 : 2.6 + Math.random() * 1.2,
        age: 0,
        c: colors[i % colors.length],
        star: i % 5 === 0,
      };
    });
    const waves = [{ r: 60 * dpr, speed: 9 * dpr, alpha: 0.85, width: 3 * dpr }];
    setTimeout(() => waves.push({ r: 55 * dpr, speed: 6 * dpr, alpha: 0.35, width: 1.5 * dpr }), 150);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const wv of waves) {
        if (wv.alpha <= 0) continue;
        wv.r += wv.speed;
        wv.alpha -= 0.018;
        ctx.strokeStyle = `rgba(255, 214, 102, ${Math.max(0, wv.alpha)})`;
        ctx.lineWidth = wv.width;
        ctx.beginPath();
        ctx.arc(cx, cy, wv.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      let alive = 0;
      for (const p of parts) {
        p.age += dt;
        if (p.age > p.life) continue;
        alive++;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.94;
        p.vy = p.vy * 0.94 - 0.03 * dpr; // embers drift upward
        const k = 1 - p.age / p.life;
        ctx.globalAlpha = k;
        ctx.fillStyle = p.c;
        if (p.star) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.age * 3);
          ctx.beginPath();
          const s = p.r * 2.2;
          ctx.moveTo(0, -s);
          ctx.quadraticCurveTo(0, 0, s, 0);
          ctx.quadraticCurveTo(0, 0, 0, s);
          ctx.quadraticCurveTo(0, 0, -s, 0);
          ctx.quadraticCurveTo(0, 0, 0, -s);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (0.6 + 0.4 * k), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      if (alive || waves.some((wv) => wv.alpha > 0)) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [colors]);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />;
}

/**
 * The reward ceremony: when a round earns a badge or a new level, the screen
 * dims, a gold ring is struck around Ziggy or the medallion, embers fly, a
 * bell rings and Ziggy says well done. One moment at a time; any tap moves on.
 */
export function RewardCeremony() {
  const t = useTranslations('rewards');
  const locale = useLocale();
  const reduce = useReducedMotion();
  const { progress, loading } = useProgressMap();
  const { user, ready } = useProfile();
  const [queue, setQueue] = useState<Moment[]>([]);
  const [mounted, setMounted] = useState(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!ready || loading) return;
    const now = computeRewards(progress);
    const key = seenKey(user?.id);
    let seen: Seen | null = null;
    try {
      const raw = window.localStorage.getItem(key);
      seen = raw ? (JSON.parse(raw) as Seen) : null;
    } catch {}
    const save = () => {
      try {
        window.localStorage.setItem(key, JSON.stringify(snapshot(now)));
      } catch {}
    };
    // First visit on this device: what is already earned is not news.
    if (!seen) return save();

    const fresh: Moment[] = [];
    if (now.level > seen.level) fresh.push({ kind: 'level', level: now.level, levelId: now.levelId });
    for (const b of BADGES) if (now.badges[b.id] && !seen.badges.includes(b.id)) fresh.push({ kind: 'badge', id: b.id });
    save();
    if (!fresh.length) return;
    // Let the round's own result screen land first.
    // Let the round's own result screen land first. Already saved as seen, so
    // the timer is not cancelled by a later re-render — only by unmounting.
    pending.current = setTimeout(() => setQueue((q) => [...q, ...fresh]), 1400);
  }, [progress, loading, ready, user?.id]);

  useEffect(() => () => {
    if (pending.current) clearTimeout(pending.current);
  }, []);

  const current = queue[0];

  const title = current ? (current.kind === 'level' ? t('level_up', { level: current.level }) : t('new_badge')) : '';
  const name = current
    ? current.kind === 'level'
      ? t(`levels.${current.levelId}`)
      : t(`badges.${current.id}.name`)
    : '';
  const desc = current
    ? current.kind === 'level'
      ? t('level_desc')
      : t(`badges.${current.id}.desc`)
    : '';

  useEffect(() => {
    if (!current) return;
    playSound('reward');
    const line = `${title} ${name} !`;
    const timer = setTimeout(() => void speak(`reward-${Date.now()}`, line, locale), 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const next = useCallback(() => {
    stopSpeaking();
    setQueue((q) => q.slice(1));
  }, []);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && next();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, next]);

  if (!mounted) return null;

  const badge = current?.kind === 'badge' ? BADGES.find((b) => b.id === current.id) : null;
  const tint = badge?.color ?? '#7FC85C';

  return createPortal(
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.kind === 'level' ? `level-${current.level}` : current.id}
          role="dialog"
          aria-modal="true"
          aria-label={`${title} ${name}`}
          className="fixed inset-0 z-[90] flex items-center justify-center p-6 cursor-pointer"
          onClick={next}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
        >
          <div className="absolute inset-0 bg-[#120c06]/70 backdrop-blur-md" />
          <div
            className="absolute inset-0"
            style={{ background: `radial-gradient(circle at 50% 42%, ${tint}55 0%, transparent 55%)` }}
          />
          {!reduce && <Embers colors={['#FFD666', '#FFF3C4', tint, '#F2647B', '#5FB6EA']} />}

          <div className="relative flex flex-col items-center text-center max-w-sm">
            {/* Medallion with the struck ring */}
            <div className="relative w-56 h-56 sm:w-64 sm:h-64">
              <svg viewBox="0 0 240 240" className="absolute inset-0 w-full h-full -rotate-90" aria-hidden="true">
                <defs>
                  <linearGradient id="reward-gold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FFF3C4" />
                    <stop offset="45%" stopColor="#F3D27A" />
                    <stop offset="100%" stopColor="#C9902B" />
                  </linearGradient>
                </defs>
                <motion.circle
                  cx="120"
                  cy="120"
                  r="108"
                  fill="none"
                  stroke="url(#reward-gold)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0.3 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.1 }}
                />
                <motion.circle
                  cx="120"
                  cy="120"
                  r="96"
                  fill="none"
                  stroke="#FFF3C4"
                  strokeOpacity="0.35"
                  strokeWidth="1.5"
                  strokeDasharray="2 7"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, rotate: 360 }}
                  transition={{ opacity: { delay: 0.6 }, rotate: { duration: 30, repeat: Infinity, ease: 'linear' } }}
                  style={{ transformOrigin: '120px 120px' }}
                />
              </svg>
              {/* The iris: a ring that lands from wide, like a stamp */}
              <motion.span
                className="absolute inset-[4%] rounded-full border-[3px] border-[#F3D27A]"
                initial={{ scale: 1.45, opacity: 0 }}
                animate={{ scale: 1, opacity: [0, 0.9, 0] }}
                transition={{ duration: 0.75, ease: [0.32, 0, 0.24, 1], delay: 0.05 }}
                aria-hidden="true"
              />

              <motion.div
                className="absolute inset-[13%] rounded-full flex items-center justify-center overflow-visible"
                style={{
                  background: `radial-gradient(circle at 38% 30%, #FFFFFF 0%, color-mix(in srgb, ${tint} 35%, #FFF7E6) 45%, color-mix(in srgb, ${tint} 70%, #3a2a10) 100%)`,
                  boxShadow: `inset 0 4px 14px rgba(255,255,255,0.7), inset 0 -10px 24px rgba(0,0,0,0.18), 0 20px 50px -10px ${tint}`,
                }}
                initial={{ scale: 0.4, opacity: 0, rotate: -25 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: 'spring', duration: 0.7, bounce: 0.45, delay: 0.35 }}
              >
                {current.kind === 'level' ? (
                  <div className="relative w-[78%] -mt-3">
                    <MascotCutout pose="heart" width={180} />
                  </div>
                ) : (
                  <motion.span
                    className="text-7xl sm:text-8xl select-none"
                    animate={{ rotate: [0, -8, 8, -4, 0], scale: [1, 1.08, 1] }}
                    transition={{ delay: 1.05, duration: 0.8 }}
                  >
                    {badge?.emoji}
                  </motion.span>
                )}
              </motion.div>

              {current.kind === 'level' && (
                <motion.span
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 font-display text-lg font-bold text-[#F3D27A] gold-plate border border-[#E9C46A]/50"
                  initial={{ y: 12, opacity: 0, scale: 0.8 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', duration: 0.6, bounce: 0.4, delay: 0.85 }}
                >
                  {t('level_short', { level: current.level })}
                </motion.span>
              )}
            </div>

            <motion.p
              className="mt-7 text-xs font-bold uppercase tracking-[0.28em] text-[#F3D27A]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75, duration: 0.3, ease: EASE_OUT }}
            >
              {title}
            </motion.p>
            <motion.h2
              className="mt-2 font-display text-4xl sm:text-5xl font-bold text-white text-balance"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85, duration: 0.35, ease: EASE_OUT }}
            >
              {name}
            </motion.h2>
            <motion.p
              className="mt-3 text-white/75 leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.3 }}
            >
              {desc}
            </motion.p>

            <motion.button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="press mt-8 rounded-full gradient-green-cta px-8 py-3.5 text-lg font-bold text-white shadow-[0_14px_30px_-10px_rgba(34,197,94,0.8)]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.15, duration: 0.3, ease: EASE_OUT }}
              autoFocus
            >
              {queue.length > 1 ? t('next') : t('ok')}
            </motion.button>

            <motion.p
              className="mt-6 text-[11px] font-semibold tracking-wide text-[#E8D6A0]/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.6 }}
            >
              Powered by <span className="text-[#F3D27A]">Hyper™ AI Engine</span>
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
