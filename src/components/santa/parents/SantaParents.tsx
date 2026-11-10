'use client';

import { ScheduleCallCard } from '@/components/santa/schedule/ScheduleCallCard';
import { scheduleStore } from '@/lib/santa/schedule';
import { clearPrecache } from '@/lib/santa/precache';
import { useEffect, useState, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import { useAppShell } from '@/lib/use-app-shell';
import { cleanName, santaStore, useSantaFamily } from '@/lib/santa/store';
import { refreshSantaPass, useSantaPass } from '@/lib/santa/pass-client';
import { SANTA_AI_MINUTES, SANTA_FREE_FEATURES, SANTA_OFFERS, SANTA_TIERS, SANTA_VALID_UNTIL_TEXT, santaMaxChildren } from '@/lib/santa/offer';
import type { SantaChild, SantaTier } from '@/lib/santa/types';
import { SANTA_PROUD } from '@/data/santa/proud';
import { SantaGate, gateGraceValid } from './SantaGate';

/**
 * The parents' area of L'appli du Père Noël (/pere-noel/parents): behind a
 * real grown-up gate (web and app), the pass, the children, the offer, the
 * live-call consent and "erase everything". Parents read here: no read-aloud
 * except on the gate. No urgency, no invented social proof (red lines).
 */

const T = {
  eyebrow: { fr: 'L’appli du Père Noël', en: 'Santa’s app' },
  title: { fr: 'Espace parents', en: 'Parents’ area' },
  subtitle: {
    fr: 'Les prénoms, les moments de fierté et le pass de la famille. Tout ce qui concerne vos enfants reste sur cet appareil.',
    en: 'First names, proud moments and the family pass. Everything about your children stays on this device.',
  },
  // Pass
  passTitle: { fr: 'Votre pass', en: 'Your pass' },
  passFree: { fr: 'Version gratuite', en: 'Free version' },
  passFreeNote: { fr: 'La lettre, le message vocal, une photo et la première minute des appels guidés.', en: 'The letter, the voice message, one photo and the first minute of the guided calls.' },
  validUntil: { fr: 'Valable jusqu’au {d}', en: 'Valid until {d}' },
  aiLeft: { fr: 'Appel en direct : {m} min restantes', en: 'Live call: {m} min left' },
  restoreTitle: { fr: 'Retrouver un pass sur un autre appareil', en: 'Use your pass on another device' },
  restoreHelp: {
    fr: 'Gardez le lien reçu après le paiement (la page « C’est prêt ! »). Ouvrez-le sur l’autre appareil, ou collez-le ici.',
    en: 'Keep the link you got after paying (the “It’s ready!” page). Open it on the other device, or paste it here.',
  },
  restoreLabel: { fr: 'Lien ou code du paiement', en: 'Payment link or code' },
  restoreBtn: { fr: 'Retrouver mon pass', en: 'Restore my pass' },
  restoreOk: { fr: 'C’est fait : votre pass est actif sur cet appareil.', en: 'Done: your pass is active on this device.' },
  restorePending: { fr: 'Le paiement est encore en cours chez la banque. Réessayez un peu plus tard.', en: 'The payment is still being processed by the bank. Try again a little later.' },
  restoreUnknown: { fr: 'Ce lien n’est pas reconnu. Vérifiez qu’il est complet.', en: 'This link is not recognised. Check that it is complete.' },
  restoreOffline: { fr: 'Impossible de vérifier pour l’instant. Réessayez dans un instant.', en: 'Can’t check right now. Try again in a moment.' },
  // Children
  kidsTitle: { fr: 'Vos enfants', en: 'Your children' },
  kidsNote: { fr: 'Le prénom seul, et l’âge. Le Père Noël dit le prénom (un petit fichier audio du prénom, rien d’autre).', en: 'First name only, and age. Santa says the first name (a small audio clip of the name, nothing else).' },
  kidsMax: { fr: 'Votre formule : {n}.', en: 'Your plan: {n}.' },
  kidsOne: { fr: '1 enfant', en: '1 child' },
  kidsMany: { fr: 'jusqu’à {n} enfants', en: 'up to {n} children' },
  kidsFull: { fr: 'Le Pack Noël et le Pack magique permettent jusqu’à 3 enfants.', en: 'The Christmas Pack and the Magic Pack allow up to 3 children.' },
  kidsNone: { fr: 'Aucun enfant pour l’instant.', en: 'No child yet.' },
  name: { fr: 'Prénom', en: 'First name' },
  age: { fr: 'Âge', en: 'Age' },
  years: { fr: '{n} ans', en: '{n} years old' },
  add: { fr: 'Ajouter', en: 'Add' },
  edit: { fr: 'Modifier', en: 'Edit' },
  save: { fr: 'Enregistrer', en: 'Save' },
  cancel: { fr: 'Annuler', en: 'Cancel' },
  remove: { fr: 'Retirer', en: 'Remove' },
  removeConfirm: { fr: 'Retirer {name} et sa lettre ?', en: 'Remove {name} and their letter?' },
  yes: { fr: 'Oui, retirer', en: 'Yes, remove' },
  badName: { fr: 'Un prénom seulement : lettres, espaces, tirets (24 caractères au plus).', en: 'A first name only: letters, spaces, hyphens (24 characters at most).' },
  proud: { fr: 'Moment de fierté (le Père Noël en parlera)', en: 'Proud moment (Santa will mention it)' },
  proudNone: { fr: '— À choisir —', en: '— Choose —' },
  // Offer
  offerTitle: { fr: 'Les packs', en: 'The packs' },
  offerNote: {
    fr: 'Paiement unique, sans abonnement, valable jusqu’au 31 janvier 2027. Paiement sécurisé par Stripe : nous ne voyons jamais votre carte.',
    en: 'One-time payment, no subscription, valid until 31 January 2027. Secure payment by Stripe: we never see your card.',
  },
  free: { fr: 'Gratuit', en: 'Free' },
  freePrice: { fr: '0 €', en: '€0' },
  included: { fr: 'Inclus', en: 'Included' },
  mostMagic: { fr: 'Le plus magique', en: 'The most magical' },
  pay: { fr: 'Payer {p}', en: 'Pay {p}' },
  upgrade: { fr: 'Passer au Pack magique : {p}', en: 'Upgrade to the Magic Pack: {p}' },
  upgradeNote: { fr: 'Vous avez déjà le Pack Noël : vous ne payez que la différence.', en: 'You already have the Christmas Pack: you only pay the difference.' },
  owned: { fr: 'Votre pack', en: 'Your pack' },
  opening: { fr: 'Ouverture du paiement…', en: 'Opening the payment…' },
  payClosed: { fr: 'Le paiement n’est pas encore ouvert. Revenez bientôt !', en: 'Payment is not open yet. Come back soon!' },
  payFailed: { fr: 'Le paiement n’a pas pu s’ouvrir. Réessayez dans un instant.', en: 'The payment could not open. Try again in a moment.' },
  terms: { fr: 'Conditions de vente', en: 'Terms of sale' },
  privacy: { fr: 'Confidentialité', en: 'Privacy' },
  // AI consent
  aiTitle: { fr: 'L’appel en direct avec le Père Noël', en: 'The live call with Santa' },
  aiIntro: { fr: 'Avant de l’activer, voici exactement ce qui se passe :', en: 'Before switching it on, here is exactly what happens:' },
  aiPoints: [
    { fr: 'C’est une intelligence artificielle qui joue le rôle du Père Noël. Elle ne prétend jamais être une vraie personne.', en: 'It is an artificial intelligence playing Santa. It never claims to be a real person.' },
    { fr: 'La voix de votre enfant est transcrite en texte sur cet appareil. Elle ne quitte jamais l’appareil.', en: 'Your child’s voice is turned into text on this device. It never leaves the device.' },
    { fr: 'Seul le texte de chaque phrase est envoyé à notre serveur puis au fournisseur d’IA (Anthropic), pour produire la réponse du Père Noël. Rien n’est conservé.', en: 'Only the text of each sentence is sent to our server and then to the AI provider (Anthropic), to produce Santa’s answer. Nothing is kept.' },
    { fr: 'Chaque réponse est vérifiée par notre filtre de sécurité. Le Père Noël ne demande jamais d’information personnelle (adresse, école, téléphone…).', en: 'Every answer is checked by our safety filter. Santa never asks for personal information (address, school, phone…).' },
    { fr: `${SANTA_AI_MINUTES} minutes au total pour le pack, tous enfants confondus.`, en: `${SANTA_AI_MINUTES} minutes in total for the pack, all children together.` },
    { fr: 'Restez à proximité pendant l’appel.', en: 'Stay nearby during the call.' },
  ] satisfies L[],
  aiToggle: { fr: 'J’ai lu et j’autorise l’appel en direct sur cet appareil', en: 'I have read this and allow the live call on this device' },
  aiOnSince: { fr: 'Activé le {d}. Vous pouvez le désactiver à tout moment.', en: 'Switched on on {d}. You can switch it off at any time.' },
  aiOff: { fr: 'Désactivé : seuls les appels guidés (sans IA) sont proposés.', en: 'Off: only the guided calls (no AI) are offered.' },
  // Erase
  eraseTitle: { fr: 'Effacer toutes les données', en: 'Erase all data' },
  eraseNote: {
    fr: 'Efface de cet appareil les prénoms, âges, listes de cadeaux, moments de fierté, signatures et l’autorisation de l’appel en direct. Votre pass reste valable.',
    en: 'Erases from this device the first names, ages, wish lists, proud moments, signatures and the live-call permission. Your pass stays valid.',
  },
  erase: { fr: 'Effacer toutes les données', en: 'Erase all data' },
  eraseConfirm: { fr: 'Oui, tout effacer', en: 'Yes, erase everything' },
  erased: { fr: 'C’est effacé.', en: 'Erased.' },
  backVillage: { fr: 'Retour au village du Père Noël', en: 'Back to Santa’s village' },
} satisfies Record<string, L | L[]>;

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

export function SantaParents() {
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  // A grown-up who just answered (here or in the app) is not asked again for 5 minutes.
  useEffect(() => {
    if (gateGraceValid()) setOpen(true);
  }, []);

  return (
    <div className="relative min-h-screen overflow-clip px-4 pb-24 pt-28 sm:px-6">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full bg-[#D62839]/10 blur-3xl" />
        <div className="absolute top-60 -right-24 h-[24rem] w-[24rem] rounded-full bg-[#1F7A4D]/10 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-4xl">
        <header className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-bold text-amber-200 ring-1 ring-white/25">
            <span aria-hidden="true">🎅</span>
            {tr(T.eyebrow, locale)}
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold text-white text-balance drop-shadow-[0_3px_0_rgba(0,0,0,0.25)] sm:text-5xl">{tr(T.title, locale)}</h1>
          {open ? <p className="mx-auto mt-3 max-w-2xl text-base text-white/80 sm:text-lg">{tr(T.subtitle, locale)}</p> : null}
        </header>

        <div className="mt-10">{open ? <ParentsContent /> : <SantaGate onPass={() => setOpen(true)} backHref="/pere-noel" />}</div>
      </div>
    </div>
  );
}

function Card({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="rounded-[2rem] border border-border/60 bg-bg-card p-5 shadow-[0_24px_60px_-40px_rgba(26,26,46,0.35)] sm:p-7">
      <h2 id={id ? `${id}-title` : undefined} className="font-display text-2xl font-bold text-text-body">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ParentsContent() {
  const locale = useLocale();
  const shell = useAppShell();
  const pass = useSantaPass();

  return (
    <div className="grid gap-6">
      <PassCard tier={pass.tier} loading={pass.loading} aiSecondsLeft={pass.aiSecondsLeft} />
      <ChildrenCard tier={pass.tier} />
      <ScheduleCallCard />
      {/* No purchase inside the native app (store rules for kids' apps): the pass bought on the website works there. */}
      {!shell.app && pass.tier !== 'magique' && !pass.loading ? <OfferCard tier={pass.tier} /> : null}
      {pass.tier === 'magique' ? <AiConsentCard /> : null}
      <EraseCard />
      <p className="text-center text-sm text-white/75">
        <Link href="/pere-noel" className="font-semibold underline underline-offset-4">
          {tr(T.backVillage, locale)}
        </Link>
        <span aria-hidden="true"> · </span>
        <Link href="/terms#pere-noel" className="underline underline-offset-4">
          {tr(T.terms, locale)}
        </Link>
        <span aria-hidden="true"> · </span>
        <Link href="/privacy#pere-noel" className="underline underline-offset-4">
          {tr(T.privacy, locale)}
        </Link>
      </p>
    </div>
  );
}

/* ── (2) The pass ── */

function PassCard({ tier, loading, aiSecondsLeft }: { tier: SantaTier | null; loading: boolean; aiSecondsLeft: number }) {
  const locale = useLocale();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: L } | null>(null);

  const restore = async () => {
    const sid = code.match(/cs_(?:test|live)_[A-Za-z0-9]+/)?.[0];
    if (!sid) return setMsg({ ok: false, text: T.restoreUnknown });
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/santa/pass?session_id=${encodeURIComponent(sid)}`, { cache: 'no-store' });
      if (res.ok) {
        await refreshSantaPass();
        setCode('');
        setMsg({ ok: true, text: T.restoreOk });
      } else if (res.status === 402) {
        const data = (await res.json().catch(() => null)) as { pending?: boolean } | null;
        setMsg({ ok: false, text: data?.pending ? T.restorePending : T.restoreUnknown });
      } else {
        setMsg({ ok: false, text: res.status === 400 || res.status === 404 ? T.restoreUnknown : T.restoreOffline });
      }
    } catch {
      setMsg({ ok: false, text: T.restoreOffline });
    }
    setBusy(false);
  };

  return (
    <Card title={tr(T.passTitle, locale)} id="pass">
      {loading ? (
        <div className="h-16 animate-pulse rounded-2xl bg-border/40" aria-hidden="true" />
      ) : tier ? (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-r from-[#FFF4D6] to-[#FFE9EC] p-4 text-[#4A2A12] dark:from-[#3A2A10] dark:to-[#3A1520] dark:text-[#FFEFD6]">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/80 text-3xl shadow-sm dark:bg-white/10" aria-hidden="true">
            {tier === 'magique' ? '✨' : '🎄'}
          </span>
          <div className="min-w-0">
            <p className="font-display text-xl font-bold">{tr(SANTA_OFFERS[tier].name, locale)}</p>
            <p className="text-sm font-semibold opacity-80">{fill(tr(T.validUntil, locale), { d: tr(SANTA_VALID_UNTIL_TEXT, locale) })}</p>
            {tier === 'magique' ? <p className="text-sm font-semibold opacity-80">{fill(tr(T.aiLeft, locale), { m: Math.ceil(aiSecondsLeft / 60) })}</p> : null}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-border/25 p-4">
          <p className="font-display text-xl font-bold text-text-body">{tr(T.passFree, locale)}</p>
          <p className="text-sm text-text-muted">{tr(T.passFreeNote, locale)}</p>
        </div>
      )}

      <div className="mt-5">
        <h3 className="font-bold text-text-body">{tr(T.restoreTitle, locale)}</h3>
        <p className="mt-1 text-sm text-text-muted">{tr(T.restoreHelp, locale)}</p>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void restore();
          }}
        >
          <label className="sr-only" htmlFor="santa-restore">
            {tr(T.restoreLabel, locale)}
          </label>
          <input
            id="santa-restore"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={tr(T.restoreLabel, locale)}
            autoComplete="off"
            spellCheck={false}
            inputMode="url"
            className="min-h-12 min-w-0 flex-1 rounded-2xl border border-border bg-bg px-4 text-base text-text-body placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-[#1F7A4D]/50"
          />
          <button type="submit" disabled={busy || !code.trim()} className="min-h-12 rounded-2xl bg-[#1F7A4D] px-5 font-bold text-white transition active:scale-95 disabled:opacity-50">
            {tr(T.restoreBtn, locale)}
          </button>
        </form>
        <p className={`mt-2 min-h-5 text-sm font-semibold ${msg?.ok ? 'text-[#1F7A4D] dark:text-[#6EE7B7]' : 'text-[#B45309] dark:text-amber-200'}`} role="status">
          {msg ? tr(msg.text, locale) : ''}
        </p>
      </div>
    </Card>
  );
}

/* ── (3) The children ── */

const AGES = Array.from({ length: 11 }, (_, i) => i + 2);

function ChildrenCard({ tier }: { tier: SantaTier | null }) {
  const locale = useLocale();
  const family = useSantaFamily();
  const max = santaMaxChildren(tier);
  const [name, setName] = useState('');
  const [age, setAge] = useState(6);
  const [bad, setBad] = useState(false);
  const full = family.children.length >= max;

  const add = () => {
    if (!cleanName(name)) return setBad(true);
    santaStore.addChild(name, age);
    setName('');
    setBad(false);
  };

  return (
    <Card title={tr(T.kidsTitle, locale)} id="children">
      <p className="text-sm text-text-muted">
        {tr(T.kidsNote, locale)} {fill(tr(T.kidsMax, locale), { n: max === 1 ? tr(T.kidsOne, locale) : fill(tr(T.kidsMany, locale), { n: max }) })}
      </p>

      {family.children.length ? (
        <ul className="mt-4 grid gap-3">
          {family.children.map((c) => (
            <ChildRow key={c.id} child={c} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl bg-border/25 p-4 text-sm text-text-muted">{tr(T.kidsNone, locale)}</p>
      )}

      {full ? (
        tier ? null : <p className="mt-4 text-sm font-semibold text-text-muted">{tr(T.kidsFull, locale)}</p>
      ) : (
        <form
          className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label className="grid gap-1 text-sm font-semibold text-text-body">
            {tr(T.name, locale)}
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setBad(false);
              }}
              maxLength={24}
              autoComplete="off"
              aria-invalid={bad || undefined}
              aria-describedby={bad ? 'santa-name-error' : undefined}
              className="min-h-12 rounded-2xl border border-border bg-bg px-4 text-base font-normal text-text-body focus:outline-none focus:ring-2 focus:ring-[#1F7A4D]/50"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-text-body">
            {tr(T.age, locale)}
            <select value={age} onChange={(e) => setAge(Number(e.target.value))} className="min-h-12 rounded-2xl border border-border bg-bg px-3 text-base font-normal text-text-body">
              {AGES.map((a) => (
                <option key={a} value={a}>
                  {fill(tr(T.years, locale), { n: a })}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={!name.trim()} className="min-h-12 self-end rounded-2xl bg-[#D62839] px-6 font-bold text-white transition active:scale-95 disabled:opacity-50">
            {tr(T.add, locale)}
          </button>
          {bad ? (
            <p id="santa-name-error" className="text-sm font-semibold text-[#B45309] dark:text-amber-200 sm:col-span-3" role="alert">
              {tr(T.badName, locale)}
            </p>
          ) : null}
        </form>
      )}
    </Card>
  );
}

function ChildRow({ child }: { child: SantaChild }) {
  const locale = useLocale();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [name, setName] = useState(child.name);
  const [age, setAge] = useState(child.age);
  const [bad, setBad] = useState(false);
  const proudId = `proud-${child.id}`;

  const save = () => {
    if (!cleanName(name)) return setBad(true);
    santaStore.updateChild(child.id, { name, age });
    setEditing(false);
    setBad(false);
  };

  return (
    <li className="rounded-2xl border border-border/60 bg-bg p-4">
      {editing ? (
        <form
          className="grid gap-2 sm:grid-cols-[1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label className="grid gap-1 text-sm font-semibold text-text-body">
            {tr(T.name, locale)}
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="off" aria-invalid={bad || undefined} className="min-h-12 rounded-2xl border border-border bg-bg-card px-4 text-base font-normal text-text-body" />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-text-body">
            {tr(T.age, locale)}
            <select value={age} onChange={(e) => setAge(Number(e.target.value))} className="min-h-12 rounded-2xl border border-border bg-bg-card px-3 text-base font-normal text-text-body">
              {AGES.map((a) => (
                <option key={a} value={a}>
                  {fill(tr(T.years, locale), { n: a })}
                </option>
              ))}
            </select>
          </label>
          {bad ? (
            <p className="text-sm font-semibold text-[#B45309] dark:text-amber-200 sm:col-span-2" role="alert">
              {tr(T.badName, locale)}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" className="min-h-12 rounded-2xl bg-[#1F7A4D] px-5 font-bold text-white transition active:scale-95">
              {tr(T.save, locale)}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setName(child.name);
                setAge(child.age);
                setBad(false);
              }}
              className="min-h-12 rounded-2xl bg-border/40 px-5 font-bold text-text-body transition active:scale-95"
            >
              {tr(T.cancel, locale)}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#D62839]/10 font-display text-xl font-bold text-[#B91C2E] dark:text-[#FF8A95]" aria-hidden="true">
            {child.name.charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-bold text-text-body">{child.name}</p>
            <p className="text-sm text-text-muted">{fill(tr(T.years, locale), { n: child.age })}</p>
          </div>
          {confirm ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-text-body">{fill(tr(T.removeConfirm, locale), { name: child.name })}</span>
              <button type="button" onClick={() => santaStore.removeChild(child.id)} className="min-h-12 rounded-2xl bg-[#D62839] px-4 font-bold text-white transition active:scale-95">
                {tr(T.yes, locale)}
              </button>
              <button type="button" onClick={() => setConfirm(false)} className="min-h-12 rounded-2xl bg-border/40 px-4 font-bold text-text-body transition active:scale-95">
                {tr(T.cancel, locale)}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(true)} className="min-h-12 rounded-2xl bg-border/40 px-4 text-sm font-bold text-text-body transition active:scale-95">
                {tr(T.edit, locale)}
              </button>
              <button type="button" onClick={() => setConfirm(true)} className="min-h-12 rounded-2xl bg-border/40 px-4 text-sm font-bold text-text-body transition active:scale-95">
                {tr(T.remove, locale)}
              </button>
            </div>
          )}
        </div>
      )}

      <label htmlFor={proudId} className="mt-3 block text-sm font-semibold text-text-body">
        {tr(T.proud, locale)}
      </label>
      <select
        id={proudId}
        value={child.proud ?? ''}
        onChange={(e) => santaStore.updateChild(child.id, { proud: e.target.value || null })}
        className="mt-1 min-h-12 w-full rounded-2xl border border-border bg-bg-card px-3 text-base text-text-body"
      >
        <option value="">{tr(T.proudNone, locale)}</option>
        {SANTA_PROUD.map((p) => (
          <option key={p.id} value={p.id}>
            {locale === 'fr' ? p.fr : p.en}
          </option>
        ))}
      </select>
    </li>
  );
}

/* ── (4) The offer ── */

function OfferCard({ tier }: { tier: SantaTier | null }) {
  const locale = useLocale();
  const [busy, setBusy] = useState<SantaTier | null>(null);
  const [error, setError] = useState<L | null>(null);

  const pay = async (t: SantaTier) => {
    setBusy(t);
    setError(null);
    try {
      const res = await fetch('/api/santa/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tier: t, locale }) });
      const data = (await res.json().catch(() => null)) as { url?: string } | null;
      if (res.ok && data?.url && /^https:\/\//.test(data.url)) {
        window.location.href = data.url;
        return;
      }
      setError(res.status === 503 ? T.payClosed : T.payFailed);
    } catch {
      setError(T.payFailed);
    }
    setBusy(null);
  };

  const upgrade = tier === 'essentiel';

  return (
    <Card title={tr(T.offerTitle, locale)} id="offer">
      <p className="text-sm text-text-muted">{tr(T.offerNote, locale)}</p>
      <div className={`mt-5 grid gap-4 ${upgrade ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
        {upgrade ? null : (
          <div className="flex flex-col rounded-[1.5rem] border border-border/60 bg-bg p-5">
            <p className="font-display text-xl font-bold text-text-body">{tr(T.free, locale)}</p>
            <p className="mt-1 font-display text-3xl font-bold text-text-body">{tr(T.freePrice, locale)}</p>
            <FeatureList items={SANTA_FREE_FEATURES} />
            <p className="mt-auto pt-4 text-sm font-semibold text-text-muted">{tr(T.included, locale)}</p>
          </div>
        )}
        {SANTA_TIERS.map((t) => {
          const offer = SANTA_OFFERS[t];
          const magic = t === 'magique';
          const owned = tier === t;
          const price = upgrade && magic ? { fr: '5,00 €', en: '€5.00' } : offer.price;
          return (
            <div
              key={t}
              className={`relative flex flex-col rounded-[1.5rem] p-5 ${
                magic
                  ? 'bg-gradient-to-b from-[#FFF4D6] to-[#FFE3E6] text-[#4A2A12] ring-2 ring-[#F4B400]/70 dark:from-[#3A2A10] dark:to-[#3A1520] dark:text-[#FFEFD6]'
                  : 'border border-[#1F7A4D]/30 bg-[#1F7A4D]/[0.06] text-text-body'
              }`}
            >
              {magic ? (
                <span className="absolute -top-3 start-5 rounded-full bg-[#F4B400] px-3 py-1 text-xs font-bold text-[#4A2A12]">
                  <span aria-hidden="true">✨ </span>
                  {tr(T.mostMagic, locale)}
                </span>
              ) : null}
              <p className="font-display text-xl font-bold">{tr(offer.name, locale)}</p>
              <p className="mt-1 font-display text-3xl font-bold">{tr(offer.price, locale)}</p>
              <FeatureList items={offer.features} />
              <div className="mt-auto pt-4">
                {owned ? (
                  <p className="min-h-12 rounded-2xl bg-white/60 px-4 py-3 text-center font-bold dark:bg-white/10">{tr(T.owned, locale)}</p>
                ) : (
                  <>
                    {upgrade && magic ? <p className="mb-2 text-sm font-semibold opacity-80">{tr(T.upgradeNote, locale)}</p> : null}
                    <button
                      type="button"
                      onClick={() => void pay(t)}
                      disabled={busy !== null}
                      className={`min-h-14 w-full rounded-2xl px-5 font-display text-lg font-bold text-white transition active:scale-95 disabled:opacity-60 ${
                        magic ? 'bg-gradient-to-b from-[#E23A4B] to-[#B91C2E] shadow-[0_4px_0_#8E1422]' : 'bg-gradient-to-b from-[#2A9862] to-[#1F7A4D] shadow-[0_4px_0_#155737]'
                      }`}
                    >
                      {busy === t ? tr(T.opening, locale) : fill(tr(upgrade && magic ? T.upgrade : T.pay, locale), { p: tr(price, locale) })}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 min-h-5 text-sm font-semibold text-[#B45309] dark:text-amber-200" role="status">
        {error ? tr(error, locale) : ''}
      </p>
    </Card>
  );
}

function FeatureList({ items }: { items: L[] }) {
  const locale = useLocale();
  return (
    <ul className="mt-3 grid gap-1.5 text-sm">
      {items.map((f) => (
        <li key={f.en} className="flex gap-2">
          <span aria-hidden="true" className="font-bold text-[#1F7A4D] dark:text-[#6EE7B7]">
            ✓
          </span>
          <span>{tr(f, locale)}</span>
        </li>
      ))}
    </ul>
  );
}

/* ── (5) Live AI call consent ── */

function AiConsentCard() {
  const locale = useLocale();
  const { aiConsentAt } = useSantaFamily();
  const on = Boolean(aiConsentAt);
  const date = aiConsentAt ? new Date(aiConsentAt).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <Card title={tr(T.aiTitle, locale)} id="live-call">
      <p className="text-sm font-semibold text-text-body">{tr(T.aiIntro, locale)}</p>
      <ul className="mt-3 grid gap-2 text-sm text-text-muted">
        {T.aiPoints.map((p) => (
          <li key={p.en} className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>{tr(p, locale)}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => santaStore.setAiConsent(!on)}
        className="mt-5 flex min-h-14 w-full items-center gap-4 rounded-2xl border border-border/60 bg-bg p-3 text-start transition active:scale-[0.99]"
      >
        <span className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${on ? 'bg-[#1F7A4D]' : 'bg-border'}`} aria-hidden="true">
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-7 rtl:-translate-x-7' : 'translate-x-1 rtl:-translate-x-1'} start-0`} />
        </span>
        <span className="font-semibold text-text-body">{tr(T.aiToggle, locale)}</span>
      </button>
      <p className="mt-2 text-sm text-text-muted" role="status">
        {on ? fill(tr(T.aiOnSince, locale), { d: date }) : tr(T.aiOff, locale)}
      </p>
    </Card>
  );
}

/* ── (6) Erase ── */

function EraseCard() {
  const locale = useLocale();
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <Card title={tr(T.eraseTitle, locale)} id="erase">
      <p className="text-sm text-text-muted">{tr(T.eraseNote, locale)}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {confirm ? (
          <>
            <button
              type="button"
              onClick={() => {
                santaStore.clear();
                for (const c of scheduleStore.get()) scheduleStore.remove(c.id);
                void clearPrecache();
                setConfirm(false);
                setDone(true);
              }}
              className="min-h-12 rounded-2xl bg-[#D62839] px-5 font-bold text-white transition active:scale-95"
            >
              {tr(T.eraseConfirm, locale)}
            </button>
            <button type="button" onClick={() => setConfirm(false)} className="min-h-12 rounded-2xl bg-border/40 px-5 font-bold text-text-body transition active:scale-95">
              {tr(T.cancel, locale)}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setConfirm(true);
              setDone(false);
            }}
            className="min-h-12 rounded-2xl border-2 border-[#D62839]/40 px-5 font-bold text-[#B91C2E] transition active:scale-95 dark:text-[#FF8A95]"
          >
            {tr(T.erase, locale)}
          </button>
        )}
        <span className="text-sm font-semibold text-[#1F7A4D] dark:text-[#6EE7B7]" role="status">
          {done ? tr(T.erased, locale) : ''}
        </span>
      </div>
    </Card>
  );
}
