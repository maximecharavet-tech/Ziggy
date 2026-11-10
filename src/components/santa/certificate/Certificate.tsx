'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useSantaFamily, activeChild } from '@/lib/santa/store';
import { useSantaPass } from '@/lib/santa/pass-client';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { proudById } from '@/data/santa/proud';
import { certificateLayout } from '@/lib/santa/certificate';

function drawCertificate(canvas: HTMLCanvasElement, name: string, age: number | null, proud: string, date: string, hd: boolean) {
  const scale = hd ? 2 : 1, width = 1200 * scale, height = 900 * scale;
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  ctx.scale(scale, scale);
  const bg = ctx.createLinearGradient(0, 0, 1200, 900); bg.addColorStop(0, '#fff9e8'); bg.addColorStop(1, '#f5e8c8');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 1200, 900);
  ctx.fillStyle = '#a51f32'; ctx.fillRect(20, 20, 1160, 860); ctx.fillStyle = '#f7e8bd'; ctx.fillRect(32, 32, 1136, 836);
  ctx.strokeStyle = '#c59a3d'; ctx.lineWidth = 5; ctx.strokeRect(52, 52, 1096, 796); ctx.lineWidth = 1.5; ctx.strokeRect(66, 66, 1068, 768);
  ctx.fillStyle = '#b32b38'; ctx.font = '44px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText('✦  ❧  ✦', 600, 142);
  ctx.fillStyle = '#8c1e2d'; ctx.font = 'bold 48px Georgia, serif'; ctx.fillText('DIPLÔME DE GENTILLESSE', 600, 232, 1020);
  ctx.fillStyle = '#55402d'; ctx.font = '28px Georgia, serif'; ctx.fillText('décerné à', 600, 300);
  const layout = certificateLayout(name || '');
  ctx.fillStyle = '#1f3156'; ctx.font = `bold ${layout.nameFontSize}px Georgia, serif`; ctx.fillText(layout.name || 'Petit cœur', 600, 396, layout.maxNameWidth);
  ctx.strokeStyle = '#c59a3d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(180, 420); ctx.lineTo(1020, 420); ctx.stroke();
  ctx.fillStyle = '#55402d'; ctx.font = '28px Georgia, serif'; ctx.fillText(age ? `${age} ans` : 'Un enfant merveilleux', 600, 472);
  ctx.font = '25px Georgia, serif'; ctx.fillText('pour ce joli moment de fierté :', 600, 536);
  ctx.fillStyle = '#8c1e2d'; ctx.font = 'bold 34px Georgia, serif'; ctx.fillText(proud, 600, 594, 980);
  ctx.fillStyle = '#55402d'; ctx.font = '21px Georgia, serif'; ctx.fillText(date, 600, 656);
  ctx.textAlign = 'left'; ctx.fillStyle = '#264432'; ctx.font = 'bold 36px cursive'; ctx.fillText('Père Noël', 800, 747);
  ctx.font = '16px Georgia, serif'; ctx.fillStyle = '#665744'; ctx.fillText('Pôle Nord', 838, 775);
  // Wax seal.
  const seal = ctx.createRadialGradient(330, 720, 4, 330, 720, 66); seal.addColorStop(0, '#ed6a58'); seal.addColorStop(1, '#9f172b');
  ctx.fillStyle = seal; ctx.beginPath(); ctx.arc(330, 720, 64, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#d5ac55'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#ffe9b0'; ctx.textAlign = 'center'; ctx.font = '30px Georgia, serif'; ctx.fillText('✦', 330, 731);
  // Holly sprigs in the two upper corners.
  for (const x of [128, 1072]) { ctx.fillStyle = '#27613e'; for (const offset of [-1, 0, 1]) { ctx.beginPath(); ctx.ellipse(x + offset * 22, 112 + Math.abs(offset) * 8, 13, 29, offset * .55, 0, Math.PI * 2); ctx.fill(); } ctx.fillStyle = '#b52234'; ctx.beginPath(); ctx.arc(x, 125, 9, 0, Math.PI * 2); ctx.fill(); }
  if (!hd) { ctx.save(); ctx.globalAlpha = .12; ctx.fillStyle = '#2b2a3c'; ctx.font = 'bold 24px Arial'; ctx.textAlign = 'right'; ctx.fillText('Ziggy', 1115, 820); ctx.restore(); }
}

export function Certificate() {
  const locale = useLocale(), family = useSantaFamily(), child = activeChild(family), pass = useSantaPass(), reduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null), [stamp, setStamp] = useState(false);
  const moment = useMemo(() => proudById(child?.proud), [child?.proud]);
  const proud = moment ? (locale === 'fr' ? moment.fr : moment.en) : (locale === 'fr' ? 'Ta gentillesse et tes beaux efforts' : 'Your kindness and lovely efforts');
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'Europe/Paris' }).format(new Date());
  const name = child?.name ?? (locale === 'fr' ? 'Petit cœur' : 'Kind heart');
  useEffect(() => { if (canvasRef.current) drawCertificate(canvasRef.current, name, child?.age ?? null, proud, date, Boolean(pass.tier)); }, [name, child?.age, proud, date, pass.tier]);
  useEffect(() => { const timer = window.setTimeout(() => setStamp(true), 480); return () => window.clearTimeout(timer); }, []);
  const download = () => { if (!canvasRef.current) return; const link = document.createElement('a'); link.download = 'certificat-enfant-sage.png'; link.href = canvasRef.current.toDataURL('image/png'); link.click(); };
  return <main className="min-h-screen bg-[#111236] px-4 py-10 text-white sm:px-8"><div className="mx-auto max-w-5xl"><Link href="/pere-noel" className="text-sm text-white/70 hover:text-white">← {locale === 'fr' ? 'Retour au village' : 'Back to the village'}</Link><header className="mt-6 text-center"><p className="text-sm font-semibold text-amber-200">✦ {locale === 'fr' ? 'Un souvenir à garder' : 'A keepsake to treasure'}</p><h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">{locale === 'fr' ? 'Certificat Enfant sage' : 'Kind Heart Certificate'}</h1><p className="mt-3 text-white/70">{locale === 'fr' ? 'Un diplôme pour célébrer un joli moment de fierté.' : 'A certificate to celebrate a proud moment.'}</p></header>
    <div className="relative mx-auto mt-8 max-w-4xl [perspective:1200px]"><motion.div initial={reduced ? { opacity: 0 } : { opacity: 0, scaleY: .85 }} animate={reduced ? { opacity: 1 } : { opacity: 1, scaleY: 1 }} transition={{ duration: .7 }} className="origin-top overflow-hidden rounded-xl shadow-[0_25px_80px_rgba(0,0,0,.45)]"><canvas ref={canvasRef} className="block h-auto w-full" aria-label={locale === 'fr' ? `Certificat pour ${name}` : `Certificate for ${name}`} /></motion.div><motion.span aria-hidden className="absolute right-[13%] top-[65%] grid h-20 w-20 place-items-center rounded-full border-4 border-amber-300 bg-red-700 text-4xl text-amber-100 shadow-xl sm:h-28 sm:w-28" initial={reduced ? { opacity: 0 } : { opacity: 0, y: -110, scale: 1.2 }} animate={stamp ? (reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }) : undefined} transition={{ type: 'spring', stiffness: 300, damping: 16 }}>✦</motion.span></div>
    <div className="mt-6 flex flex-wrap justify-center gap-3 print:hidden"><button type="button" onClick={download} className="rounded-full bg-amber-300 px-6 py-3 font-bold text-[#241b3e]">{locale === 'fr' ? 'Télécharger PNG' : 'Download PNG'}</button><button type="button" onClick={() => window.print()} className="rounded-full border border-white/25 px-6 py-3 font-bold hover:bg-white/10">{locale === 'fr' ? 'Imprimer' : 'Print'}</button></div>
    {!pass.tier && <p className="mt-4 text-center text-sm text-white/55 print:hidden">{locale === 'fr' ? 'Version gratuite avec un discret filigrane Ziggy. Le pass permet le téléchargement HD sans filigrane.' : 'The free version has a subtle Ziggy watermark. A pass enables HD download without it.'}</p>}</div><style>{'@media print { body { background: white !important; } body * { visibility: hidden !important; } canvas, canvas * { visibility: visible !important; } canvas { position: fixed; inset: 0; width: 100vw !important; height: auto !important; } }'}</style></main>;
}
