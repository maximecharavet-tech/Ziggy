'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { SantaGate, gateGraceValid } from '@/components/santa/parents/SantaGate';
import bible from '@/data/lutins/bible.json';
import { ElfAvatar } from '@/components/lutins/ElfAvatar';
import { PRANK_CATEGORIES, PRANKS, MAX_PARENT_TEXT, type PrankCategory } from '@/data/lutins/pranks';
import { findPeople, warmPeopleDetector } from '@/lib/lutins/people';
import { deviceId, journal, nextMorning } from '@/lib/lutins/journal';
import { loadEngine } from '@/lib/lutins/engine';
import { analyzePhoto, verifyResult, type Scene } from '@/lib/lutins/client-engine';
import { shareOrSave } from '@/components/santa/booth/share';

type ElfId = 'pepin' | 'grelotte' | 'noisette';
type Step = 'elves' | 'photo' | 'prank' | 'magic' | 'result';

const T = {
  title: { fr: 'L’atelier des lutins', en: 'The elves’ workshop' },
  lead: { fr: 'Ce soir, préparez la farce que votre enfant découvrira au réveil.', en: 'Tonight, prepare the prank your child will discover in the morning.' },
  who: { fr: 'Qui fait la farce ce soir ?', en: 'Who is pulling the prank tonight?' },
  next: { fr: 'Continuer', en: 'Continue' },
  back: { fr: 'Retour', en: 'Back' },
  photoTitle: { fr: 'La photo de la pièce', en: 'The photo of the room' },
  photoHelp: {
    fr: 'Photographiez l’endroit de la farce (cuisine, salon, sapin…), sans personne dessus : les lutins y apparaîtront.',
    en: 'Take a photo of the prank spot (kitchen, living room, tree…), with nobody in it: the elves will appear there.',
  },
  take: { fr: 'Prendre la photo', en: 'Take the photo' },
  gallery: { fr: 'Choisir une photo', en: 'Choose a photo' },
  checking: { fr: 'Vérification de la photo…', en: 'Checking the photo…' },
  people: {
    fr: 'On voit quelqu’un sur la photo. Pour protéger votre famille, les photos avec des personnes ne sont jamais envoyées : reprenez la pièce sans personne.',
    en: 'Someone is in the photo. To protect your family, photos with people are never sent: please take the room with nobody in it.',
  },
  checkFailed: { fr: 'Impossible de vérifier la photo sur cet appareil. Réessayez, ou essayez avec un autre navigateur.', en: 'This device could not check the photo. Try again, or try another browser.' },
  stage: { fr: 'Les lutins iront ici', en: 'The elves will go here' },
  retake: { fr: 'Changer de photo', en: 'Change photo' },
  prankTitle: { fr: 'Quelle farce ?', en: 'Which prank?' },
  own: { fr: 'Ma propre idée', en: 'My own idea' },
  ownHelp: { fr: 'Décrivez une farce douce en une phrase (ex. : « ils font la course en pantoufles sur le tapis avec des cuillères »). Pas de feu, de couteaux, d’escalade ni de choses cassées : rien qu’un enfant ne devrait imiter.', en: 'Describe a gentle prank in one sentence (e.g. “they race in slippers across the rug using spoons”). No fire, knives, climbing or broken things: nothing a child should copy.' },
  surprise: { fr: 'Surprends-moi', en: 'Surprise me' },
  go: { fr: 'Faire apparaître les lutins', en: 'Make the elves appear' },
  magic1: { fr: 'Pépin cherche la meilleure place…', en: 'Pip is looking for the best spot…' },
  magic2: { fr: 'Grelotte règle la lumière…', en: 'Jingle is adjusting the light…' },
  magic3: { fr: 'Noisette prend la pose…', en: 'Hazel is striking a pose…' },
  magic4: { fr: 'Les lutins sèment des paillettes…', en: 'The elves are sprinkling glitter…' },
  retry: { fr: 'Les lutins refont la photo, ils n’étaient pas bien placés…', en: 'The elves are retaking the photo, they weren’t quite right…' },
  resultTitle: { fr: 'Les lutins sont passés !', en: 'The elves were here!' },
  before: { fr: 'Avant', en: 'Before' },
  after: { fr: 'Après', en: 'After' },
  addMorning: { fr: 'Pour demain matin', en: 'For tomorrow morning' },
  addNow: { fr: 'À montrer tout de suite', en: 'Show right now' },
  added: { fr: 'C’est dans le journal des lutins !', en: 'It’s in the elves’ journal!' },
  openJournal: { fr: 'Ouvrir le journal', en: 'Open the journal' },
  save: { fr: 'Enregistrer', en: 'Save' },
  again: { fr: 'Une autre version', en: 'Another version' },
  newPrank: { fr: 'Nouvelle farce', en: 'New prank' },
  errText: { fr: 'Cette description ne convient pas pour une photo d’enfant. Essayez une autre idée.', en: 'This description isn’t suitable for a child’s picture. Try another idea.' },
  errLimit: { fr: 'Les lutins ont assez joué pour aujourd’hui sur cet appareil. Ils reviennent demain !', en: 'The elves have played enough on this device today. They’ll be back tomorrow!' },
  errResting: { fr: 'Les lutins font une petite sieste (beaucoup de farces en ce moment). Réessayez dans quelques minutes.', en: 'The elves are taking a little nap (lots of pranks right now). Try again in a few minutes.' },
  errFailed: { fr: 'La magie n’a pas marché cette fois. Réessayez.', en: 'The magic didn’t work this time. Try again.' },
  privacy: {
    fr: 'La photo est envoyée à notre service d’images (Agnes AI) uniquement pour cette farce, sans les données du téléphone (lieu, date), et n’est pas conservée.',
    en: 'The photo is sent to our image service (Agnes AI) only for this prank, without the phone’s data (location, date), and is not kept.',
  },
  left: { fr: 'farces gratuites restantes aujourd’hui', en: 'free pranks left today' },
} satisfies Record<string, L>;

const MAGIC = [T.magic1, T.magic2, T.magic3, T.magic4];
const ELVES = bible.elves as { id: ElfId; name: L; color: string; accent: string; trait: L }[];

/** Photo → canvas at most `max` px, EXIF dropped (orientation applied by the browser). */
async function toCanvas(file: Blob, max: number): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}

function scaled(src: HTMLCanvasElement, max: number) {
  const s = Math.min(1, max / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * s);
  c.height = Math.round(src.height * s);
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

const aspectOf = (c: HTMLCanvasElement) => (c.width > c.height * 1.15 ? 'landscape' : c.height > c.width * 1.15 ? 'portrait' : 'square');

export function LutinsStudio() {
  const locale = useLocale();
  const L2 = locale === 'fr' ? 'fr' : 'en';
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('elves');
  const [elves, setElves] = useState<ElfId[]>(['pepin', 'grelotte', 'noisette']);
  const [photo, setPhoto] = useState<HTMLCanvasElement | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [checking, setChecking] = useState(false);
  const [photoError, setPhotoError] = useState<L | null>(null);
  const [cat, setCat] = useState<PrankCategory>('partout');
  const [prankId, setPrankId] = useState<string | null>(null);
  const [own, setOwn] = useState('');
  const [ownMode, setOwnMode] = useState(false);
  const [magicIdx, setMagicIdx] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<L | null>(null);
  const [result, setResult] = useState<{ blob: Blob; url: string; caption: string; source: string; sig: string } | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [split, setSplit] = useState(55);
  const [added, setAdded] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (gateGraceValid()) setOpen(true);
  }, []);
  useEffect(() => {
    if (open) warmPeopleDetector();
  }, [open]);
  useEffect(() => {
    if (step !== 'magic') return;
    const t = setInterval(() => setMagicIdx((i) => (i + 1) % MAGIC.length), 3200);
    return () => clearInterval(t);
  }, [step]);
  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    if (result) URL.revokeObjectURL(result.url);
  }, [photoUrl, result]);

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setPhotoError(null);
    setChecking(true);
    setScene(null);
    try {
      const c = await toCanvas(file, 1536);
      const check = await findPeople(scaled(c, 640));
      if (check.people > 0) {
        setPhoto(null);
        setPhotoUrl(null);
        setPhotoError(T.people);
        return;
      }
      setPhoto(c);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.86));
      if (blob) setPhotoUrl(URL.createObjectURL(blob));
      setScene(await analyzePhoto(c).catch(() => null));
    } catch {
      setPhoto(null);
      setPhotoError(T.checkFailed);
    } finally {
      setChecking(false);
    }
  }, []);

  const generate = useCallback(
    async (strict = false, failed: string[] = []): Promise<void> => {
      if (!photo) return;
      setError(null);
      setStep('magic');
      setRetrying(strict);
      try {
        const res = await fetch('/api/lutins/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            locale: L2,
            device: deviceId(),
            elves,
            prankId: ownMode ? null : prankId,
            text: ownMode ? own : '',
            scene,
            photo: photo.toDataURL('image/jpeg', 0.86),
            aspect: aspectOf(photo),
            strict,
            failed,
          }),
        });
        if (!res.ok) {
          const e = (await res.json().catch(() => ({}))) as { error?: string };
          setError(e.error === 'text' ? T.errText : e.error === 'daily_limit' ? T.errLimit : e.error === 'resting' ? T.errResting : T.errFailed);
          setStep(e.error === 'text' ? 'prank' : 'prank');
          return;
        }
        const blob = await res.blob();
        const caption = decodeURIComponent(res.headers.get('x-lutins-caption') ?? '');
        const source = res.headers.get('x-lutins-source') ?? '';
        const sig = res.headers.get('x-lutins-sig') ?? '';
        const l = Number(res.headers.get('x-lutins-left'));
        if (Number.isFinite(l)) setLeft(l);
        // On-device check (Rust engine): still the same room, and the elves are really there.
        if (!strict) {
          const check = await verifyResult(blob, photo, elves).catch(() => null);
          if (check && !check.ok) return generate(true, check.reasons);
        }
        setResult({ blob, url: URL.createObjectURL(blob), caption, source, sig });
        setAdded(false);
        setSplit(55);
        setStep('result');
      } catch {
        setError(T.errFailed);
        setStep('prank');
      }
    },
    [photo, elves, prankId, own, ownMode, scene, L2]
  );

  const addToJournal = async (when: 'morning' | 'now') => {
    if (!result) return;
    await journal.put({
      id: Math.random().toString(36).slice(2, 12),
      createdAt: new Date().toISOString(),
      revealAt: (when === 'now' ? new Date() : nextMorning()).toISOString(),
      caption: result.caption,
      prankId: ownMode ? null : prankId,
      elves,
      image: result.blob,
      sourceUrl: result.source || null,
      sourceSig: result.sig || null,
    });
    setAdded(true);
  };

  if (!open) {
    return (
      <div className="mx-auto max-w-xl px-4 pb-24 pt-28">
        <h1 className="mb-6 text-center font-display text-4xl font-bold text-white">{tr(T.title, locale)}</h1>
        <SantaGate onPass={() => setOpen(true)} backHref="/lutins" />
      </div>
    );
  }

  /** The Rust engine suggests a prank that is not one of the last two weeks' (the journal never leaves the device). */
  const surpriseMe = async () => {
    const recent = (await journal.list()).slice(0, 14).map((e) => e.prankId).filter((x): x is string => !!x);
    const ids = PRANKS.filter((p) => cat === 'partout' || p.cat === cat).map((p) => p.id);
    try {
      const engine = await loadEngine();
      const id = engine.pickPrank(ids, recent, Math.floor(Math.random() * 2 ** 31));
      if (id) {
        setOwnMode(false);
        setPrankId(id);
      }
    } catch {
      setPrankId(ids[Math.floor(Math.random() * ids.length)] ?? null);
      setOwnMode(false);
    }
  };

  const canGo = ownMode ? own.trim().length >= 3 : !!prankId;
  const stageRect = scene?.stages?.[0];

  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 pt-24 text-white sm:px-6 sm:pt-28">
      <header className="text-center">
        <h1 className="font-display text-4xl font-bold text-balance drop-shadow-[0_3px_0_rgba(0,0,0,0.25)] sm:text-5xl">🧝 {tr(T.title, locale)}</h1>
        <p className="mx-auto mt-2 max-w-2xl text-lg text-white/85">{tr(T.lead, locale)}</p>
        {left !== null && (
          <p className="mt-2 text-sm text-white/70">
            {left} {tr(T.left, locale)}
          </p>
        )}
      </header>

      <AnimatePresence mode="wait">
        {step === 'elves' && (
          <motion.section key="elves" initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-10">
            <h2 className="text-center font-display text-2xl font-bold">{tr(T.who, locale)}</h2>
            <ul className="mx-auto mt-6 grid max-w-3xl grid-cols-3 gap-3 sm:gap-5">
              {ELVES.map((e) => {
                const on = elves.includes(e.id);
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setElves((cur) => (on ? (cur.length > 1 ? cur.filter((x) => x !== e.id) : cur) : [...cur, e.id]))}
                      className={`flex w-full flex-col items-center rounded-[1.75rem] p-3 text-center transition-transform active:scale-95 sm:p-4 ${on ? 'bg-white text-[#1b2150] shadow-[0_10px_0_rgba(0,0,0,0.2)]' : 'bg-white/10 text-white ring-1 ring-white/20'}`}
                    >
                      <span className="relative block aspect-square w-full overflow-hidden rounded-2xl" style={{ background: `radial-gradient(circle at 50% 35%, ${e.accent}55, ${e.color}33)` }}>
                        <ElfAvatar id={e.id} className="h-full w-full object-contain" />
                        {on && <span className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-[#2fb344] text-white">✓</span>}
                      </span>
                      <span className="mt-2 font-display text-xl font-bold">{tr(e.name, locale)}</span>
                      <span className={`text-xs leading-snug ${on ? 'text-[#4a4f7a]' : 'text-white/70'}`}>{tr(e.trait, locale)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-8 flex justify-center">
              <button type="button" onClick={() => setStep('photo')} className="min-h-14 rounded-full bg-[#2fb344] px-8 font-display text-xl font-bold shadow-lg">
                {tr(T.next, locale)} →
              </button>
            </div>
          </motion.section>
        )}

        {step === 'photo' && (
          <motion.section key="photo" initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto mt-10 max-w-2xl">
            <h2 className="text-center font-display text-2xl font-bold">📷 {tr(T.photoTitle, locale)}</h2>
            <p className="mt-2 text-center text-white/80">{tr(T.photoHelp, locale)}</p>
            <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <input ref={galleryInput} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            {photoUrl && photo ? (
              <div className="relative mt-6 overflow-hidden rounded-[1.5rem] shadow-2xl ring-1 ring-white/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="" className="block w-full" />
                {stageRect && (
                  <div
                    className="pointer-events-none absolute rounded-2xl border-[3px] border-dashed border-amber-300 bg-amber-200/10"
                    style={{ left: `${stageRect.x * 100}%`, top: `${stageRect.y * 100}%`, width: `${stageRect.w * 100}%`, height: `${stageRect.h * 100}%` }}
                  >
                    <span className="absolute -top-7 left-0 rounded-full bg-amber-300 px-2.5 py-0.5 text-xs font-black text-[#3b1f00]">✨ {tr(T.stage, locale)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-6 grid aspect-[4/3] place-items-center rounded-[1.5rem] border-2 border-dashed border-white/30 bg-white/5 text-6xl">{checking ? <span className="animate-pulse text-base font-bold">{tr(T.checking, locale)}</span> : '🏠'}</div>
            )}
            {photoError && <p className="mt-4 rounded-2xl bg-amber-300 px-4 py-3 font-semibold text-[#3b1f00]">{tr(photoError, locale)}</p>}
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button type="button" onClick={() => cameraInput.current?.click()} disabled={checking} className="min-h-14 rounded-full bg-white px-6 font-display text-lg font-bold text-[#1b2150] disabled:opacity-60">
                📷 {photo ? tr(T.retake, locale) : tr(T.take, locale)}
              </button>
              <button type="button" onClick={() => galleryInput.current?.click()} disabled={checking} className="min-h-14 rounded-full bg-white/15 px-6 font-display text-lg font-bold ring-1 ring-white/30 disabled:opacity-60">
                🖼️ {tr(T.gallery, locale)}
              </button>
            </div>
            <p className="mt-4 text-center text-xs text-white/60">🔒 {tr(T.privacy, locale)}</p>
            <div className="mt-8 flex justify-between">
              <button type="button" onClick={() => setStep('elves')} className="min-h-12 rounded-full px-5 font-bold text-white/80">
                ← {tr(T.back, locale)}
              </button>
              <button type="button" disabled={!photo || checking} onClick={() => setStep('prank')} className="min-h-14 rounded-full bg-[#2fb344] px-8 font-display text-xl font-bold shadow-lg disabled:opacity-50">
                {tr(T.next, locale)} →
              </button>
            </div>
          </motion.section>
        )}

        {step === 'prank' && (
          <motion.section key="prank" initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-10">
            <h2 className="text-center font-display text-2xl font-bold">🎭 {tr(T.prankTitle, locale)}</h2>
            {error && <p className="mx-auto mt-4 max-w-2xl rounded-2xl bg-amber-300 px-4 py-3 text-center font-semibold text-[#3b1f00]">{tr(error, locale)}</p>}
            <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0 [&::-webkit-scrollbar]:hidden">
              {PRANK_CATEGORIES.map((c) => (
                <button key={c.id} type="button" aria-pressed={!ownMode && cat === c.id} onClick={() => (setOwnMode(false), setCat(c.id))} className={`min-h-12 shrink-0 rounded-full px-4 font-bold ${!ownMode && cat === c.id ? 'bg-white text-[#1b2150]' : 'bg-white/15 ring-1 ring-white/25'}`}>
                  {c.emoji} {tr(c.label, locale)}
                </button>
              ))}
              <button type="button" onClick={() => void surpriseMe()} className="min-h-12 shrink-0 rounded-full bg-white/15 px-4 font-bold ring-1 ring-white/25">
                🎲 {tr(T.surprise, locale)}
              </button>
              <button type="button" aria-pressed={ownMode} onClick={() => setOwnMode(true)} className={`min-h-12 shrink-0 rounded-full px-4 font-bold ${ownMode ? 'bg-amber-300 text-[#3b1f00]' : 'bg-white/15 ring-1 ring-white/25'}`}>
                ✍️ {tr(T.own, locale)}
              </button>
            </div>
            {ownMode ? (
              <div className="mx-auto mt-6 max-w-2xl">
                <p className="text-white/80">{tr(T.ownHelp, locale)}</p>
                <textarea
                  value={own}
                  onChange={(e) => setOwn(e.target.value.slice(0, MAX_PARENT_TEXT))}
                  rows={3}
                  maxLength={MAX_PARENT_TEXT}
                  className="mt-3 w-full rounded-2xl bg-white p-4 text-lg text-[#1b2150] outline-none ring-4 ring-transparent focus:ring-amber-300"
                />
                <p className="text-right text-xs text-white/60">
                  {own.length}/{MAX_PARENT_TEXT}
                </p>
              </div>
            ) : (
              <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {PRANKS.filter((p) => cat === 'partout' || p.cat === cat).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      aria-pressed={prankId === p.id}
                      onClick={() => setPrankId(p.id)}
                      className={`flex h-full min-h-24 w-full items-center gap-3 rounded-2xl p-3 text-start font-bold transition-transform active:scale-95 ${prankId === p.id ? 'bg-amber-300 text-[#3b1f00] shadow-lg' : 'bg-white/10 ring-1 ring-white/20'}`}
                    >
                      <span className="text-3xl" aria-hidden="true">
                        {p.emoji}
                      </span>
                      <span className="leading-tight">{tr(p.title, locale)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-8 flex justify-between">
              <button type="button" onClick={() => setStep('photo')} className="min-h-12 rounded-full px-5 font-bold text-white/80">
                ← {tr(T.back, locale)}
              </button>
              <button type="button" disabled={!canGo} onClick={() => generate(false)} className="min-h-14 rounded-full bg-gradient-to-r from-[#c92a2a] to-[#f03e3e] px-7 font-display text-xl font-bold shadow-[0_8px_0_#8a1c1c] disabled:opacity-50">
                ✨ {tr(T.go, locale)}
              </button>
            </div>
          </motion.section>
        )}

        {step === 'magic' && (
          <motion.section key="magic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-16 flex flex-col items-center text-center" aria-live="polite">
            <div className="flex items-end gap-3">
              {elves.map((id, i) => (
                <motion.span key={id} animate={reduced ? {} : { y: [0, -18, 0] }} transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15 }} className="block h-24 w-24 overflow-hidden rounded-full bg-white/10 ring-2 ring-white/30">
                  <ElfAvatar id={id} alt="" className="h-full w-full object-contain" />
                </motion.span>
              ))}
            </div>
            <p className="mt-8 font-display text-2xl font-bold">{tr(retrying ? T.retry : MAGIC[magicIdx], locale)}</p>
            <div className="mt-6 h-2 w-64 overflow-hidden rounded-full bg-white/15">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-pink-400" initial={{ width: '5%' }} animate={{ width: '92%' }} transition={{ duration: 35, ease: 'easeOut' }} />
            </div>
          </motion.section>
        )}

        {step === 'result' && result && photoUrl && (
          <motion.section key="result" initial={reduced ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto mt-8 max-w-3xl">
            <h2 className="text-center font-display text-3xl font-bold">🎉 {tr(T.resultTitle, locale)}</h2>
            <div className="relative mt-5 select-none overflow-hidden rounded-[1.5rem] shadow-2xl ring-1 ring-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.url} alt={result.caption} className="block w-full" />
              <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="" className="block h-full w-full object-cover" />
              </div>
              <div className="pointer-events-none absolute inset-y-0 w-1 bg-white shadow-[0_0_12px_rgba(0,0,0,0.5)]" style={{ left: `${split}%` }} />
              <span className="absolute left-3 top-3 rounded-full bg-black/50 px-3 py-1 text-xs font-bold">{tr(T.before, locale)}</span>
              <span className="absolute right-3 top-3 rounded-full bg-black/50 px-3 py-1 text-xs font-bold">{tr(T.after, locale)}</span>
              <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} aria-label={`${tr(T.before, locale)} / ${tr(T.after, locale)}`} className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
            </div>
            {result.caption && <p className="mt-4 text-center font-display text-xl font-bold">« {result.caption} »</p>}
            {added ? (
              <div className="mt-6 flex flex-col items-center gap-3">
                <p className="rounded-full bg-[#2fb344] px-5 py-2 font-bold">✓ {tr(T.added, locale)}</p>
                <Link href="/lutins/journal" className="min-h-14 rounded-full bg-white px-6 py-4 font-display text-lg font-bold text-[#1b2150]">
                  📖 {tr(T.openJournal, locale)}
                </Link>
              </div>
            ) : (
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <button type="button" onClick={() => addToJournal('morning')} className="min-h-16 rounded-full bg-gradient-to-r from-[#c92a2a] to-[#f03e3e] px-6 font-display text-lg font-bold shadow-lg">
                  🌅 {tr(T.addMorning, locale)}
                </button>
                <button type="button" onClick={() => addToJournal('now')} className="min-h-16 rounded-full bg-white/15 px-6 font-display text-lg font-bold ring-1 ring-white/30">
                  👀 {tr(T.addNow, locale)}
                </button>
              </div>
            )}
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => shareOrSave(new File([result.blob], 'lutins-farceurs.jpg', { type: result.blob.type }), 'lutins-farceurs.jpg', tr(T.resultTitle, locale))} className="min-h-12 rounded-full bg-white/10 px-5 font-bold ring-1 ring-white/25">
                ⬇️ {tr(T.save, locale)}
              </button>
              <button type="button" onClick={() => generate(false)} className="min-h-12 rounded-full bg-white/10 px-5 font-bold ring-1 ring-white/25">
                🔁 {tr(T.again, locale)}
              </button>
              <button type="button" onClick={() => (setStep('photo'), setResult(null), setPrankId(null))} className="min-h-12 rounded-full bg-white/10 px-5 font-bold ring-1 ring-white/25">
                ✨ {tr(T.newPrank, locale)}
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
