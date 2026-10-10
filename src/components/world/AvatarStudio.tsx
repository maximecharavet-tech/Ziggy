'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { WORLDS } from '@/data/worlds';
import { AVATAR_STYLES, EYE_COLORS, HAIR_COLORS, HAIR_LENGTHS, HAIR_STYLES, OUTFITS, SKIN_TONES, type AvatarRequest, type VisualBlueprint } from '@/lib/hyper-engine/schemas';
import { accessToken, api } from '@/lib/world/store';
import { tr, type L } from '@/lib/i18n-text';
import { AppPage } from '@/components/learn/AppPage';
import { AvatarPreview, EYE_HEX, HAIR_HEX, SKIN_HEX } from './AvatarPreview';

const T = {
  noPhoto: { fr: '🎨 Sans photo', en: '🎨 No photo' },
  fromPhoto: { fr: '📷 Depuis une photo (parent)', en: '📷 From a photo (parent)' },
  hairColor: { fr: 'Couleur des cheveux', en: 'Hair colour' },
  hairLength: { fr: 'Longueur', en: 'Length' },
  hairStyle: { fr: 'Coiffure', en: 'Hairstyle' },
  skin: { fr: 'Couleur de peau', en: 'Skin tone' },
  eyes: { fr: 'Yeux', en: 'Eyes' },
  extras: { fr: 'Détails', en: 'Details' },
  glasses: { fr: '👓 Lunettes', en: '👓 Glasses' },
  freckles: { fr: '✨ Taches de rousseur', en: '✨ Freckles' },
  style: { fr: 'Style', en: 'Style' },
  outfit: { fr: 'Tenue', en: 'Outfit' },
  world: { fr: 'Décor', en: 'Background' },
  create: { fr: '✨ Créer mon avatar magique', en: '✨ Create my magic avatar' },
  creating: { fr: 'Hyper Engine dessine ton avatar…', en: 'Hyper Engine is drawing your avatar…' },
  preview: { fr: 'Aperçu', en: 'Preview' },
  signIn: { fr: 'Pour créer l’image magique, un parent doit se connecter. L’aperçu, lui, marche pour tout le monde !', en: 'To create the magic image, a parent needs to sign in. The preview works for everyone!' },
  signInBtn: { fr: 'Espace parent', en: 'Parent sign-in' },
  notConfigured: { fr: 'La génération d’images sera disponible dès que la clé image de Hyper Engine sera configurée.', en: 'Image generation will be available as soon as the Hyper Engine image key is configured.' },
  overBudget: { fr: 'Assez de magie pour aujourd’hui — reviens demain !', en: 'Enough magic for today — come back tomorrow!' },
  error: { fr: 'Le pinceau magique a glissé. On réessaie dans un instant ?', en: 'The magic brush slipped. Try again in a moment?' },
  gallery: { fr: 'Mes avatars', en: 'My avatars' },
  use: { fr: 'Utiliser', en: 'Use' },
  inUse: { fr: '✓ Mon avatar', en: '✓ My avatar' },
  del: { fr: 'Supprimer', en: 'Delete' },
  photoTitle: { fr: 'Avatar depuis une photo — réservé au parent', en: 'Avatar from a photo — parents only' },
  photoInfo: {
    fr: 'La photo est lue en mémoire par le modèle de vision NVIDIA uniquement pour repérer des couleurs (cheveux, peau, yeux, lunettes). Elle n’est jamais enregistrée, ni sur nos serveurs, ni dans la base, ni dans les journaux, et elle n’est jamais envoyée au générateur d’images : seuls ces choix en texte le sont. Vous pouvez ajuster chaque choix avant de créer l’avatar.',
    en: 'The photo is read in memory by the NVIDIA vision model only to pick colours (hair, skin, eyes, glasses). It is never stored — not on our servers, in the database or in logs — and never sent to the image generator: only these text choices are. You can adjust every choice before creating the avatar.',
  },
  consent: { fr: 'Je suis le parent ou le responsable légal et j’accepte ce traitement de la photo.', en: 'I am the parent or legal guardian and I agree to this processing of the photo.' },
  pick: { fr: 'Choisir une photo', en: 'Choose a photo' },
  analyzing: { fr: 'Lecture des couleurs…', en: 'Reading the colours…' },
  analyzed: { fr: 'Choix pré-remplis depuis la photo. La photo a été effacée.', en: 'Choices pre-filled from the photo. The photo has been discarded.' },
  noFace: { fr: 'Aucun visage d’enfant trouvé. Essayez une photo de face, bien éclairée.', en: 'No child’s face found. Try a well-lit, front-facing photo.' },
  needConsent: { fr: 'Cochez le consentement pour continuer.', en: 'Tick the consent box to continue.' },
  deletePhoto: { fr: 'Supprimer les données photo', en: 'Delete photo data' },
  deleted: { fr: 'Aucune photo n’est conservée. Avatars issus d’une photo supprimés : {n}. Consentement retiré.', en: 'No photo is ever kept. Avatars made from a photo deleted: {n}. Consent withdrawn.' },
} satisfies Record<string, L>;

const NAMES: Record<string, L> = {
  black: { fr: 'Noirs', en: 'Black' }, dark_brown: { fr: 'Brun foncé', en: 'Dark brown' }, brown: { fr: 'Châtains', en: 'Brown' }, auburn: { fr: 'Auburn', en: 'Auburn' }, red: { fr: 'Roux', en: 'Red' },
  blond: { fr: 'Blonds', en: 'Blond' }, light_blond: { fr: 'Blond clair', en: 'Light blond' }, grey: { fr: 'Gris', en: 'Grey' }, blue: { fr: 'Bleus', en: 'Blue' }, pink: { fr: 'Roses', en: 'Pink' },
  very_short: { fr: 'Très courts', en: 'Very short' }, short: { fr: 'Courts', en: 'Short' }, medium: { fr: 'Mi-longs', en: 'Medium' }, long: { fr: 'Longs', en: 'Long' },
  straight: { fr: 'Raides', en: 'Straight' }, wavy: { fr: 'Ondulés', en: 'Wavy' }, curly: { fr: 'Bouclés', en: 'Curly' }, coily: { fr: 'Frisés', en: 'Coily' }, braids: { fr: 'Tresses', en: 'Braids' },
  ponytail: { fr: 'Queue de cheval', en: 'Ponytail' }, buns: { fr: 'Macarons', en: 'Buns' }, covered: { fr: 'Foulard', en: 'Headscarf' },
  hazel: { fr: 'Noisette', en: 'Hazel' }, green: { fr: 'Verts', en: 'Green' },
  plush: { fr: '🧸 Peluche', en: '🧸 Plush' }, cartoon: { fr: '🎬 Dessin animé', en: '🎬 Cartoon' }, watercolor: { fr: '🖌️ Aquarelle', en: '🖌️ Watercolour' }, clay: { fr: '🟠 Pâte à modeler', en: '🟠 Clay' }, pixel: { fr: '👾 Pixel', en: '👾 Pixel' },
  explorer: { fr: '🧭 Explorateur', en: '🧭 Explorer' }, astronaut: { fr: '🧑‍🚀 Astronaute', en: '🧑‍🚀 Astronaut' }, wizard: { fr: '🧙 Magicien', en: '🧙 Wizard' }, chef: { fr: '🧑‍🍳 Chef', en: '🧑‍🍳 Chef' },
  artist: { fr: '🎨 Artiste', en: '🎨 Artist' }, pirate: { fr: '🏴‍☠️ Pirate', en: '🏴‍☠️ Pirate' }, princess: { fr: '👑 Princesse', en: '👑 Princess' }, hero: { fr: '🦸 Super-héros', en: '🦸 Superhero' },
  scientist: { fr: '🔬 Scientifique', en: '🔬 Scientist' }, sporty: { fr: '⚽ Sportif', en: '⚽ Sporty' },
};
const OUTFIT_COLOR: Record<string, string> = { explorer: '#7FC85C', astronaut: '#F59E0B', wizard: '#8B5CF6', chef: '#E5E7EB', artist: '#F472B6', pirate: '#EF4444', princess: '#EC4899', hero: '#3B82F6', scientist: '#F8FAFC', sporty: '#22C55E' };

type Avatar = { id: string; url: string | null; style: string; outfit: string; world: string; fromPhoto: boolean; createdAt: string };
const SELECTED_KEY = 'ziggy:avatar';

const DEFAULT: VisualBlueprint = { hairColor: 'brown', hairLength: 'short', hairStyle: 'wavy', skinTone: 'tone3', eyeColor: 'brown', glasses: false, freckles: false };

function Chips<T extends string>({ label, options, value, onChange, locale, swatch }: { label: L; options: readonly T[]; value: T; onChange: (v: T) => void; locale: string; swatch?: Record<string, string> }) {
  return (
    <fieldset>
      <legend className="text-sm font-bold text-text-body">{tr(label, locale)}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
            className={`flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-4 focus-visible:outline-purple/40 ${value === o ? 'border-purple bg-purple/10 text-text-body' : 'border-border/60 text-text-muted hover:border-purple/50'}`}
          >
            {swatch ? <span className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: swatch[o] }} aria-hidden="true" /> : null}
            {NAMES[o] ? tr(NAMES[o], locale) : o.replace('tone', '')}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function AvatarStudio() {
  const locale = useLocale();
  const [mode, setMode] = useState<'choices' | 'photo'>('choices');
  const [b, setB] = useState<VisualBlueprint>(DEFAULT);
  const [style, setStyle] = useState<AvatarRequest['style']>('plush');
  const [outfit, setOutfit] = useState<AvatarRequest['outfit']>('explorer');
  const [worldId, setWorldId] = useState(WORLDS[0].id);
  const [fromPhoto, setFromPhoto] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    const ok = Boolean(await accessToken());
    setSignedIn(ok);
    if (!ok) return;
    const res = await api<{ avatars: Avatar[] }>('avatar');
    if (res.ok) setAvatars(res.data.avatars);
  }, []);

  useEffect(() => {
    void load();
    try {
      setSelected((JSON.parse(localStorage.getItem(SELECTED_KEY) ?? 'null') as { id?: string } | null)?.id ?? null);
    } catch {
      /* ignore */
    }
  }, [load]);

  const set = <K extends keyof VisualBlueprint>(k: K) => (v: VisualBlueprint[K]) => setB((x) => ({ ...x, [k]: v }));

  async function create() {
    setBusy(true);
    setMsg(null);
    const res = await api<{ avatar: Avatar }>('avatar/generate', { body: { blueprint: b, style, outfit, worldId, fromPhoto, locale } });
    setBusy(false);
    if (res.ok) {
      setAvatars((a) => [{ ...res.data.avatar, fromPhoto }, ...a]);
      choose(res.data.avatar.id);
      return;
    }
    setMsg(tr(res.status === 503 ? T.notConfigured : res.status === 429 ? T.overBudget : T.error, locale));
  }

  function choose(id: string) {
    setSelected(id);
    try {
      localStorage.setItem(SELECTED_KEY, JSON.stringify({ id }));
    } catch {
      /* ignore */
    }
  }

  async function remove(id: string) {
    const res = await api('avatar?id=' + id, { method: 'DELETE' });
    if (res.ok) setAvatars((a) => a.filter((x) => x.id !== id));
  }

  return (
    <AppPage
      eyebrow={<>🧑‍🎨 Avatar Studio</>}
      title={locale === 'fr' ? 'Crée ton avatar d’aventurier' : 'Create your explorer avatar'}
      subtitle={locale === 'fr' ? 'Choisis tes couleurs, ta tenue et ton style — Ziggy te dessine !' : 'Choose your colours, outfit and style — Ziggy draws you!'}
      color="#BA68C8"
    >
      <div className="mb-6 flex justify-center gap-2" role="tablist">
        {(['choices', 'photo'] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} type="button" onClick={() => setMode(m)} className={`rounded-full px-5 py-2.5 text-sm font-bold ${mode === m ? 'bg-purple text-white' : 'border border-border bg-bg-card text-text-body'}`}>
            {tr(m === 'choices' ? T.noPhoto : T.fromPhoto, locale)}
          </button>
        ))}
      </div>

      {mode === 'photo' ? (
        <PhotoPanel
          locale={locale}
          signedIn={signedIn}
          onBlueprint={(bp) => {
            setB(bp);
            setFromPhoto(true);
            setMode('choices');
          }}
          onDeleted={() => void load()}
        />
      ) : null}

      <div className={`grid gap-8 lg:grid-cols-[1fr_20rem] ${mode === 'photo' ? 'mt-8' : ''}`}>
        <div className="grid gap-5 rounded-[2rem] bg-bg-card p-6 shadow-sm">
          <Chips label={T.hairColor} options={HAIR_COLORS} value={b.hairColor} onChange={set('hairColor')} locale={locale} swatch={HAIR_HEX} />
          <Chips label={T.hairLength} options={HAIR_LENGTHS} value={b.hairLength} onChange={set('hairLength')} locale={locale} />
          <Chips label={T.hairStyle} options={HAIR_STYLES} value={b.hairStyle} onChange={set('hairStyle')} locale={locale} />
          <Chips label={T.skin} options={SKIN_TONES} value={b.skinTone} onChange={set('skinTone')} locale={locale} swatch={SKIN_HEX} />
          <Chips label={T.eyes} options={EYE_COLORS} value={b.eyeColor} onChange={set('eyeColor')} locale={locale} swatch={EYE_HEX} />
          <fieldset>
            <legend className="text-sm font-bold text-text-body">{tr(T.extras, locale)}</legend>
            <div className="mt-2 flex gap-2">
              {(['glasses', 'freckles'] as const).map((k) => (
                <button key={k} type="button" aria-pressed={b[k]} onClick={() => setB((x) => ({ ...x, [k]: !x[k] }))} className={`rounded-full border-2 px-3 py-1.5 text-sm font-semibold ${b[k] ? 'border-purple bg-purple/10 text-text-body' : 'border-border/60 text-text-muted'}`}>
                  {tr(T[k], locale)}
                </button>
              ))}
            </div>
          </fieldset>
          <Chips label={T.style} options={AVATAR_STYLES} value={style} onChange={setStyle} locale={locale} />
          <Chips label={T.outfit} options={OUTFITS} value={outfit} onChange={setOutfit} locale={locale} />
          <label className="text-sm font-bold text-text-body">
            {tr(T.world, locale)}
            <select value={worldId} onChange={(e) => setWorldId(e.target.value)} className="mt-2 block w-full rounded-2xl border border-border bg-bg px-3 py-2 font-semibold">
              {WORLDS.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.icon} {tr(w.name, locale)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <aside className="flex flex-col items-center gap-4 lg:sticky lg:top-28 lg:self-start">
          <motion.div key={JSON.stringify(b) + outfit} initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="rounded-[2rem] p-4 shadow-lg" style={{ background: `linear-gradient(135deg, ${WORLDS.find((w) => w.id === worldId)!.colors.from}, ${WORLDS.find((w) => w.id === worldId)!.colors.to})` }}>
            <AvatarPreview b={b} outfitColor={OUTFIT_COLOR[outfit]} label={tr(T.preview, locale)} />
          </motion.div>
          {signedIn === false ? (
            <div className="rounded-3xl bg-bg-card p-4 text-center text-sm text-text-muted shadow-sm">
              {tr(T.signIn, locale)}
              <Link href="/login" className="mt-3 block rounded-full bg-purple px-4 py-2 font-bold text-white">
                {tr(T.signInBtn, locale)}
              </Link>
            </div>
          ) : (
            <button type="button" disabled={busy || !signedIn} onClick={() => void create()} className="w-full rounded-full bg-purple px-6 py-4 text-lg font-bold text-white shadow-lg transition hover:scale-[1.02] disabled:opacity-60">
              {busy ? tr(T.creating, locale) : tr(T.create, locale)}
            </button>
          )}
          {msg ? (
            <p role="status" className="rounded-2xl bg-yellow/15 px-4 py-3 text-center text-sm font-semibold text-text-body">
              {msg}
            </p>
          ) : null}
        </aside>
      </div>

      {avatars.length ? (
        <section className="mt-12" aria-labelledby="gallery">
          <h2 id="gallery" className="font-display text-2xl font-bold text-text-body">
            {tr(T.gallery, locale)}
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {avatars.map((a) => (
              <li key={a.id} className={`overflow-hidden rounded-3xl bg-bg-card shadow-sm ${selected === a.id ? 'ring-4 ring-purple' : ''}`}>
                {a.url ? (
                  // Signed, short-lived URL from private storage: a plain img is right here.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={tr(T.preview, locale)} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="grid aspect-square place-items-center text-5xl">🧑‍🎨</div>
                )}
                <div className="flex gap-2 p-3">
                  <button type="button" onClick={() => choose(a.id)} className="flex-1 rounded-full bg-purple px-3 py-1.5 text-xs font-bold text-white">
                    {tr(selected === a.id ? T.inUse : T.use, locale)}
                  </button>
                  <button type="button" onClick={() => void remove(a.id)} className="rounded-full border border-border px-3 py-1.5 text-xs font-bold text-text-muted">
                    {tr(T.del, locale)}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppPage>
  );
}

/** Downscale to ≤1024px JPEG in the browser, so only a small image travels. */
async function downscale(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}

function PhotoPanel({ locale, signedIn, onBlueprint, onDeleted }: { locale: string; signedIn: boolean | null; onBlueprint: (b: VisualBlueprint) => void; onDeleted: () => void }) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!signedIn) return;
    void api<{ photo_avatar: string | null }>('parent/consent').then((r) => r.ok && setConsent(Boolean(r.data.photo_avatar)));
  }, [signedIn]);

  async function toggleConsent(granted: boolean) {
    const r = await api('parent/consent', { body: { kind: 'photo_avatar', granted } });
    if (r.ok) setConsent(granted);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!consent) return setMsg(tr(T.needConsent, locale));
    setBusy(true);
    setMsg(tr(T.analyzing, locale));
    let photo: string | null = await downscale(file).catch(() => null);
    if (input.current) input.current.value = '';
    if (!photo) {
      setBusy(false);
      return setMsg(tr(T.error, locale));
    }
    const res = await api<{ blueprint: VisualBlueprint }>('avatar/analyze', { body: { photo, locale } });
    photo = null; // nothing of the photo is kept in the page either
    setBusy(false);
    if (res.ok) {
      setMsg(tr(T.analyzed, locale));
      onBlueprint(res.data.blueprint);
    } else setMsg(tr(res.status === 422 ? T.noFace : res.status === 503 ? T.notConfigured : res.status === 429 ? T.overBudget : T.error, locale));
  }

  async function deletePhotoData() {
    const r = await api<{ deletedAvatars: number }>('privacy/photo', { method: 'DELETE' });
    if (r.ok) {
      setConsent(false);
      setMsg(tr(T.deleted, locale).replace('{n}', String(r.data.deletedAvatars)));
      onDeleted();
    }
  }

  if (signedIn === false) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl bg-bg-card p-6 text-center shadow-sm">
        <p className="text-text-muted">{tr(T.signIn, locale)}</p>
        <Link href="/login" className="mt-4 inline-block rounded-full bg-purple px-5 py-2.5 font-bold text-white">
          {tr(T.signInBtn, locale)}
        </Link>
      </div>
    );
  }
  return (
    <section className="mx-auto max-w-2xl rounded-[2rem] border-2 border-purple/30 bg-bg-card p-6 shadow-sm" aria-labelledby="photo-title">
      <h2 id="photo-title" className="font-display text-xl font-bold text-text-body">
        🔒 {tr(T.photoTitle, locale)}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-text-muted">{tr(T.photoInfo, locale)}</p>
      <label className="mt-4 flex items-start gap-3 text-sm font-semibold text-text-body">
        <input type="checkbox" checked={consent} onChange={(e) => void toggleConsent(e.target.checked)} className="mt-1 h-5 w-5 accent-purple" />
        {tr(T.consent, locale)}
      </label>
      <div className="mt-4 flex flex-wrap gap-3">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="avatar-photo" onChange={(e) => void onFile(e.target.files?.[0])} disabled={!consent || busy} />
        <label htmlFor="avatar-photo" className={`cursor-pointer rounded-full bg-purple px-5 py-2.5 font-bold text-white ${!consent || busy ? 'pointer-events-none opacity-50' : ''}`}>
          📷 {tr(T.pick, locale)}
        </label>
        <button type="button" onClick={() => void deletePhotoData()} className="rounded-full border border-border px-5 py-2.5 font-bold text-text-muted">
          🗑️ {tr(T.deletePhoto, locale)}
        </button>
      </div>
      {msg ? (
        <p role="status" className="mt-4 rounded-2xl bg-purple/10 px-4 py-3 text-sm font-semibold text-text-body">
          {msg}
        </p>
      ) : null}
    </section>
  );
}
