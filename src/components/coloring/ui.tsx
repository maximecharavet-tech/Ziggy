'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ZiggyAvatar } from '@/components/ziggy/Mascot';
import { fx, toy } from '@/components/create/fx/toy';
import { EASE_OUT } from '@/lib/motion';

/** Big toy-like icon button (≥ 56 px, with thickness; it squashes when pressed), always labelled for screen readers. */
export function IconButton({
  label,
  onClick,
  children,
  active = false,
  disabled = false,
  tone = 'plain',
  showLabel = false,
  className = '',
  pressed,
  short,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  tone?: 'plain' | 'accent' | 'danger';
  showLabel?: boolean;
  className?: string;
  pressed?: boolean;
  /** Visible label when shorter than the accessible one. */
  short?: string;
}) {
  const look =
    tone === 'accent'
      ? { cls: fx.toy, style: { ...toy('#B07CFF', { depth: 5 }), '--face': 'linear-gradient(120deg, #FF7AB8, #B07CFF 50%, #5FB6EA)' } as CSSProperties }
      : tone === 'danger'
        ? { cls: fx.toy, style: toy('#FFE4E6', { depth: 5, ink: '#BE123C' }) }
        : active
          ? { cls: `${fx.toy} ${fx.on}`, style: toy('#F1E9FF', { depth: 5, ink: '#3B2A7A', ring: '#B07CFF' }) }
          : { cls: `${fx.toy} ${fx.light}`, style: { '--depth': '5px' } as CSSProperties };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={`${look.cls} flex min-h-14 min-w-14 shrink-0 select-none flex-col items-center justify-center gap-0.5 rounded-2xl px-2 font-display text-[11px] font-semibold leading-none ${className}`}
      style={look.style}
    >
      {children}
      {showLabel && <span className={tone === 'danger' ? 'whitespace-nowrap text-xs' : 'max-w-[4.6rem] truncate'} aria-hidden="true">{short ?? label}</span>}
    </button>
  );
}

/** Centered dialog with a soft backdrop. Escape and backdrop close it. */
export function Modal({ open, onClose, label, children, wide = false }: { open: boolean; onClose: () => void; label: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const id = window.setTimeout(() => ref.current?.querySelector<HTMLElement>('button, [tabindex]')?.focus(), 60);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(id);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[#1b1340]/55 p-3 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            className={`relative w-full overflow-hidden rounded-[2rem] bg-white text-[#1A1A2E] shadow-2xl ${wide ? 'max-w-4xl' : 'max-w-lg'}`}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** Ziggy's encouragement bubble. */
export function ZiggyCheer({ text, onDone }: { text: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!text) return;
    const id = window.setTimeout(onDone, 4200);
    return () => window.clearTimeout(id);
  }, [text, onDone]);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3" aria-live="polite">
      <AnimatePresence>
        {text && (
          <motion.div
            key={text}
            initial={{ opacity: 0, y: -14, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.35 }}
            className="flex max-w-md items-center gap-3 rounded-full bg-white/95 py-2 pe-5 ps-2 shadow-[0_12px_30px_-12px_rgba(91,63,168,0.55)] ring-1 ring-[#B07CFF]/30"
          >
            <ZiggyAvatar size={44} />
            <span className="font-display text-base font-semibold text-[#3B2A7A] sm:text-lg">{text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
