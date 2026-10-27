'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { WORLDS } from '@/data/worlds';
import { AVATAR_STYLES, EYE_COLORS, HAIR_COLORS, HAIR_LENGTHS, HAIR_STYLES, OUTFITS, SKIN_TONES, type AvatarRequest, type VisualBlueprint } from '@/lib/hyper-engine/schemas';
import { accessToken, api } from '@/lib/world/store';
import { tr, type L } from '@/lib/i18n-text';
import { playSound } from '@/lib/sound';
import { SayButton } from '@/components/arcade/read-aloud';
import { Burst, Twinkle } from '@/components/create/fx/Burst';
import { DepthProvider, Layer, usePointerDepth, useTilt } from '@/components/create/fx/Parallax';
import { StudioFrame } from '@/components/create/fx/StudioFrame';
import { fx, loop, shade, toy } from '@/components/create/fx/toy';
import { AvatarPreview, EYE_HEX, HAIR_HEX, OUTFIT_COLOR, SKIN_HEX } from './AvatarPreview';

const T = {
  eyebrow: { fr: 'Le studio d’avatar', en: 'The avatar studio' },
  title: { fr: 'Crée ton avatar d’aventurier', en: 'Create your explorer avatar' },
  subtitle: { fr: 'Choisis tes couleurs, ta tenue et ton style — Ziggy te dessine !', en: 'Choose your colours, outfit and style — Ziggy draws you!' },
  noPhoto: { fr: 'Sans photo', en: 'No photo' },
  fromPhoto: { fr: 'Depuis une photo (parent)', en: 'From a photo (parent)' },
  fromPhotoShort: { fr: 'Photo (parent)', en: 'Photo (parent)' },
  hairColor: { fr: 'Couleur des cheveux', en: 'Hair colour' },
  hairLength: { fr: 'Longueur', en: 'Length' },
  hairStyle: { fr: 'Coiffure', en: 'Hairstyle' },
  skin: { fr: 'Couleur de peau', en: 'Skin tone' },
  eyes: { fr: 'Yeux', en: 'Eyes' },
  extras: { fr: 'Détails', en: 'Details' },
  glasses: { fr: 'Lunettes', en: 'Glasses' },
  freckles: { fr: 'Taches de rousseur', en: 'Freckles' },
  style: { fr: 'Style du dessin', en: 'Drawing style' },
  outfit: { fr: 'Tenue', en: 'Outfit' },
  world: { fr: 'Décor', en: 'Background' },
  tabHair: { fr: 'Cheveux', en: 'Hair' },
  tabFace: { fr: 'Visage', en: 'Face' },
  tabOutfit: { fr: 'Tenue', en: 'Outfit' },
  tabStyle: { fr: 'Style', en: 'Style' },
  create: { fr: 'Créer mon avatar magique', en: 'Create my magic avatar' },
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
  tone1: { fr: 'Très claire', en: 'Very light' }, tone2: { fr: 'Claire', en: 'Light' }, tone3: { fr: 'Dorée', en: 'Golden' }, tone4: { fr: 'Mate', en: 'Tan' }, tone5: { fr: 'Brune', en: 'Brown' }, tone6: { fr: 'Foncée', en: 'Dark' },
  plush: { fr: 'Peluche', en: 'Plush' }, cartoon: { fr: 'Dessin animé', en: 'Cartoon' }, watercolor: { fr: 'Aquarelle', en: 'Watercolour' }, clay: { fr: 'Pâte à modeler', en: 'Clay' }, pixel: { fr: 'Pixel', en: 'Pixel' },
  explorer: { fr: 'Explorateur', en: 'Explorer' }, astronaut: { fr: 'Astronaute', en: 'Astronaut' }, wizard: { fr: 'Magicien', en: 'Wizard' }, chef: { fr: 'Chef', en: 'Chef' },
  artist: { fr: 'Artiste', en: 'Artist' }, pirate: { fr: 'Pirate', en: 'Pirate' }, princess: { fr: 'Princesse', en: 'Princess' }, hero: { fr: 'Super-héros', en: 'Superhero' },
  scientist: { fr: 'Scientifique', en: 'Scientist' }, sporty: { fr: 'Sportif', en: 'Sporty' },
};
const STYLE_EMOJI: Record<AvatarRequest['style'], string> = { plush: '🧸', cartoon: '🎬', watercolor: '🖌️', clay: '🟠', pixel: '👾' };
const name = (id: string, locale: string) => (NAMES[id] ? tr(NAMES[id], locale) : id);

type Avatar = { id: string; url: string | null; style: string; outfit: string; world: string; fromPhoto: boolean; createdAt: string };
const SELECTED_KEY = 'ziggy:avatar';

const DEFAULT: VisualBlueprint = { hairColor: 'brown', hairLength: 'short', hairStyle: 'wavy', skinTone: 'tone3', eyeColor: 'brown', glasses: false, freckles: false };
type Tab = 'hair' | 'face' | 'outfit' | 'style';
const ACCENT = '#A35BD6';

/** A group of options with its title and a 🔊 button that reads the choices. */
function Group({ label, names, locale, children }: { label: L; names: string[]; locale: string; children: ReactNode }) {
  return (
    <fieldset>
      <div className="flex items-center gap-2">
        <legend className="font-display text-lg font-bold text-text-body">{tr(label, locale)}</legend>
        <SayButton size="sm" texts={[tr(label, locale), ...names]} locale={locale} />
      </div>
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}

/** Glossy round colour buttons. */
function Swatches<V extends string>({ options, value, onChange, hex, locale }: { options: readonly V[]; value: V; onChange: (v: V) => void; hex: Record<V, string>; locale: string }) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((o) => {
        const on = value === o;
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            aria-label={name(o, locale)}
            title={name(o, locale)}
            onClick={() => onChange(o)}
            className={`${fx.toy} ${on ? fx.on : ''} grid h-14 w-14 place-items-center rounded-full`}
            style={toy(hex[o], { depth: 5, ring: ACCENT })}
          >
            <AnimatePresence>
              {on ? (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="text-lg font-black" aria-hidden="true">
                  ✓
                </motion.span>
              ) : null}
            </AnimatePresence>
          </button>
        );
      })}
    </div>
  );
}

/** Big tiles with a little picture (often a tiny avatar wearing the option). */
function Tiles<V extends string>({ options, value, onChange, locale, art, cols = 'grid-cols-3 sm:grid-cols-4' }: { options: readonly V[]; value: V; onChange: (v: V) => void; locale: string; art: (v: V) => ReactNode; cols?: string }) {
  return (
    <div className={`grid gap-3 ${cols}`}>
      {options.map((o) => {
        const on = value === o;
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o)}
            className={`${fx.toy} ${on ? fx.on : fx.light} flex min-h-[6.5rem] flex-col items-center justify-center gap-1 overflow-hidden rounded-[1.4rem] px-1.5 pb-2 pt-1.5 font-display text-[0.8rem] font-bold leading-tight sm:text-sm`}
            style={on ? toy(ACCENT, { depth: 6, ring: '#ffffff' }) : ({ '--depth': '6px' } as CSSProperties)}
          >
            <span className="grid h-16 w-full place-items-center rounded-2xl" style={{ background: on ? 'rgba(255,255,255,0.22)' : 'radial-gradient(70% 70% at 50% 35%, #fff, #f2e9ff)' }} aria-hidden="true">
              {art(o)}
            </span>
            <span className="line-clamp-2">{name(o, locale)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function AvatarStudio() {
  const locale = useLocale();
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<'choices' | 'photo'>('choices');
  const [tab, setTab] = useState<Tab>('hair');
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
  const [spark, setSpark] = useState(0);
  const p = usePointerDepth<HTMLDivElement>();
  const tilt = useTilt(p, 9);
  const first = useRef(true);

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

  // A little sparkle each time the look changes.
  const look = JSON.stringify(b) + outfit + worldId;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSpark((s) => s + 1);
  }, [look]);

  const set =
    <K extends keyof VisualBlueprint>(k: K) =>
    (v: VisualBlueprint[K]) => {
      setB((x) => ({ ...x, [k]: v }));
      playSound('tap');
    };

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

  const world = WORLDS.find((w) => w.id === worldId) ?? WORLDS[0];
  const bare = tab === 'hair';
  const mini = (patch: Partial<VisualBlueprint>, o: AvatarRequest['outfit'] = outfit) => <AvatarPreview b={{ ...b, ...patch }} outfit={o} size={50} still hat={!bare} label="" />;
  const tabs: { id: Tab; emoji: string; label: L }[] = [
    { id: 'hair', emoji: '💇', label: T.tabHair },
    { id: 'face', emoji: '🙂', label: T.tabFace },
    { id: 'outfit', emoji: '👕', label: T.tabOutfit },
    { id: 'style', emoji: '🎨', label: T.tabStyle },
  ];

  return (
    <StudioFrame eyebrow={tr(T.eyebrow, locale)} emoji="🧑‍🎨" title={tr(T.title, locale)} subtitle={tr(T.subtitle, locale)} color={ACCENT} locale={locale} props={['👑', '🎩', '🕶️', '🎀']} wide>
      <div className="mb-8 flex justify-center">
        <div role="tablist" className="flex gap-2 rounded-full bg-white/70 p-2 shadow-[inset_0_2px_6px_rgba(80,40,140,0.12)] ring-1 ring-black/5 dark:bg-white/5">
          {(['choices', 'photo'] as const).map((md) => {
            const on = mode === md;
            return (
              <button key={md} role="tab" aria-selected={on} type="button" onClick={() => setMode(md)} className={`${fx.toy} ${on ? '' : fx.light} inline-flex min-h-12 items-center gap-2 whitespace-nowrap rounded-full px-4 font-display text-sm font-bold sm:px-5 sm:text-base`} style={on ? toy(ACCENT, { depth: 4 }) : ({ '--depth': '4px' } as CSSProperties)}>
                <span aria-hidden="true">{md === 'choices' ? '🎨' : '📷'}</span>
                {md === 'choices' ? (
                  tr(T.noPhoto, locale)
                ) : (
                  <>
                    <span className="sm:hidden">{tr(T.fromPhotoShort, locale)}</span>
                    <span className="hidden sm:inline">{tr(T.fromPhoto, locale)}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
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

      <div className={`grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-start ${mode === 'photo' ? 'mt-8' : ''}`}>
        {/* ── The preview: a little stage that tilts ── */}
        <aside className="sticky top-[4.6rem] z-10 lg:order-2 lg:top-28">
          <div className="[perspective:1000px]">
            <motion.div ref={p.ref} {...p.handlers} style={reduce ? undefined : { rotateX: tilt.rotateX, rotateY: tilt.rotateY }} className="relative mx-auto max-w-sm">
              <DepthProvider x={p.x} y={p.y}>
                <div
                  className="relative h-[13.5rem] overflow-hidden rounded-[2rem] shadow-[0_8px_0_rgba(90,40,140,0.25),0_30px_50px_-24px_rgba(90,40,140,0.6)] ring-4 ring-white sm:h-[19rem] lg:h-[23rem]"
                  style={{ background: `radial-gradient(60% 50% at 50% 30%, #ffffffcc, transparent 70%), linear-gradient(160deg, ${world.colors.from}, ${world.colors.to})` }}
                >
                  <Layer depth={-8} className="inset-0">
                    {world.background.slice(0, 3).map((e, i) => (
                      <span key={i} className={`absolute text-3xl opacity-60 sm:text-4xl ${fx.float}`} style={{ left: `${[8, 78, 64][i]}%`, top: `${[12, 18, 56][i]}%`, ...loop({ dur: 5 + i, delay: i * 0.7 }) }}>
                        {e}
                      </span>
                    ))}
                  </Layer>
                  <Layer depth={-3} className="left-1/2 top-[44%] h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2">
                    <div className={`h-full w-full opacity-50 ${fx.spin}`} style={{ ...loop({ dur: 70 }), background: 'repeating-conic-gradient(rgba(255,255,255,0.7) 0deg 8deg, transparent 8deg 22deg)', maskImage: 'radial-gradient(circle, #000 10%, transparent 60%)', WebkitMaskImage: 'radial-gradient(circle, #000 10%, transparent 60%)' }} />
                  </Layer>
                  <Layer depth={6} className="bottom-[4%] left-1/2 h-[16%] w-[66%] -translate-x-1/2">
                    <div className="h-full w-full rounded-[50%] shadow-[0_10px_0_rgba(0,0,0,0.12)]" style={{ background: `radial-gradient(70% 80% at 50% 30%, #ffffff, ${shade(world.colors.accent, 0.4)})` }} />
                  </Layer>
                  <Layer depth={12} className="bottom-[9%] left-1/2 -translate-x-1/2">
                    <motion.div key={look + bare} initial={reduce ? false : { scale: 0.9, y: 6 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 14 }}>
                      <div className="sm:hidden">
                        <AvatarPreview b={b} outfit={outfit} outfitColor={OUTFIT_COLOR[outfit]} size={150} hat={!bare} label={tr(T.preview, locale)} />
                      </div>
                      <div className="hidden sm:block lg:hidden">
                        <AvatarPreview b={b} outfit={outfit} outfitColor={OUTFIT_COLOR[outfit]} size={220} hat={!bare} label={tr(T.preview, locale)} />
                      </div>
                      <div className="hidden lg:block">
                        <AvatarPreview b={b} outfit={outfit} outfitColor={OUTFIT_COLOR[outfit]} size={270} hat={!bare} label={tr(T.preview, locale)} />
                      </div>
                    </motion.div>
                  </Layer>
                  <Layer depth={20} className="left-[10%] top-[14%]">
                    <Twinkle size={18} color="#FFD447" className={fx.twinkle} style={loop({ dur: 2.4 })} />
                  </Layer>
                  <Layer depth={24} className="right-[12%] top-[34%]">
                    <Twinkle size={13} color="#ffffff" className={fx.twinkle} style={loop({ dur: 2.9, delay: 0.6 })} />
                  </Layer>
                  <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.35)_0%,transparent_30%)]" />
                  <div className="pointer-events-none absolute inset-x-0 top-1/2">
                    <Burst fire={spark} kind="stars" count={12} spread={0.9} colors={['#FFD447', '#FF7AB8', '#ffffff', world.colors.accent]} />
                  </div>
                  <span className="absolute start-3 top-3 rounded-full bg-white/85 px-3 py-1 font-display text-xs font-bold text-[#5b2a86] shadow-sm">
                    {world.icon} {tr(world.name, locale)}
                  </span>
                </div>
              </DepthProvider>
            </motion.div>
          </div>
          <div className="mx-auto mt-5 hidden max-w-sm lg:block">
            <CreateBox locale={locale} signedIn={signedIn} busy={busy} msg={msg} onCreate={() => void create()} />
          </div>
        </aside>

        {/* ── The wardrobe ── */}
        <div className="lg:order-1">
          <div role="tablist" aria-label={tr(T.title, locale)} className="grid grid-cols-4 gap-2 sm:gap-3">
            {tabs.map((t) => {
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => {
                    setTab(t.id);
                    playSound('tap');
                  }}
                  className={`${fx.toy} ${on ? fx.on : fx.light} flex min-h-[4.6rem] flex-col items-center justify-center gap-0.5 rounded-[1.4rem] font-display text-sm font-bold sm:min-h-20 sm:text-base`}
                  style={on ? toy(ACCENT, { depth: 6, ring: '#fff' }) : ({ '--depth': '6px' } as CSSProperties)}
                >
                  <span aria-hidden="true" className={`text-[1.7rem] leading-none sm:text-3xl ${on ? fx.bob : ''}`}>
                    {t.emoji}
                  </span>
                  {tr(t.label, locale)}
                </button>
              );
            })}
          </div>

          <div className="relative mt-6 rounded-[2rem] bg-bg-card p-5 shadow-[0_8px_0_rgba(140,90,200,0.14),0_24px_40px_-26px_rgba(90,40,140,0.5)] ring-1 ring-black/5 dark:ring-white/10 sm:p-6">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={tab} role="tabpanel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="grid gap-7">
                {tab === 'hair' ? (
                  <>
                    <Group label={T.hairColor} names={HAIR_COLORS.map((o) => name(o, locale))} locale={locale}>
                      <Swatches options={HAIR_COLORS} value={b.hairColor} onChange={set('hairColor')} hex={HAIR_HEX} locale={locale} />
                    </Group>
                    <Group label={T.hairStyle} names={HAIR_STYLES.map((o) => name(o, locale))} locale={locale}>
                      <Tiles options={HAIR_STYLES} value={b.hairStyle} onChange={set('hairStyle')} locale={locale} art={(o) => mini({ hairStyle: o })} />
                    </Group>
                    <Group label={T.hairLength} names={HAIR_LENGTHS.map((o) => name(o, locale))} locale={locale}>
                      <Tiles options={HAIR_LENGTHS} value={b.hairLength} onChange={set('hairLength')} locale={locale} art={(o) => mini({ hairLength: o, hairStyle: b.hairStyle === 'covered' ? 'straight' : b.hairStyle })} cols="grid-cols-4" />
                    </Group>
                  </>
                ) : null}
                {tab === 'face' ? (
                  <>
                    <Group label={T.skin} names={SKIN_TONES.map((o) => name(o, locale))} locale={locale}>
                      <Swatches options={SKIN_TONES} value={b.skinTone} onChange={set('skinTone')} hex={SKIN_HEX} locale={locale} />
                    </Group>
                    <Group label={T.eyes} names={EYE_COLORS.map((o) => name(o, locale))} locale={locale}>
                      <Swatches options={EYE_COLORS} value={b.eyeColor} onChange={set('eyeColor')} hex={EYE_HEX} locale={locale} />
                    </Group>
                    <Group label={T.extras} names={[tr(T.glasses, locale), tr(T.freckles, locale)]} locale={locale}>
                      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
                        {(['glasses', 'freckles'] as const).map((k) => {
                          const on = b[k];
                          return (
                            <button
                              key={k}
                              type="button"
                              aria-pressed={on}
                              onClick={() => {
                                setB((x) => ({ ...x, [k]: !x[k] }));
                                playSound('tap');
                              }}
                              className={`${fx.toy} ${on ? fx.on : fx.light} flex min-h-[6.5rem] flex-col items-center justify-center gap-1 rounded-[1.4rem] p-2 font-display text-sm font-bold`}
                              style={on ? toy(ACCENT, { depth: 6, ring: '#fff' }) : ({ '--depth': '6px' } as CSSProperties)}
                            >
                              <span className="grid h-16 w-full place-items-center rounded-2xl" style={{ background: on ? 'rgba(255,255,255,0.22)' : 'radial-gradient(70% 70% at 50% 35%, #fff, #f2e9ff)' }} aria-hidden="true">
                                {mini({ [k]: true })}
                              </span>
                              {tr(T[k], locale)}
                            </button>
                          );
                        })}
                      </div>
                    </Group>
                  </>
                ) : null}
                {tab === 'outfit' ? (
                  <Group label={T.outfit} names={OUTFITS.map((o) => name(o, locale))} locale={locale}>
                    <Tiles
                      options={OUTFITS}
                      value={outfit}
                      onChange={(o) => {
                        setOutfit(o);
                        playSound('tap');
                      }}
                      locale={locale}
                      art={(o) => mini({}, o)}
                      cols="grid-cols-3 sm:grid-cols-5"
                    />
                  </Group>
                ) : null}
                {tab === 'style' ? (
                  <>
                    <Group label={T.style} names={AVATAR_STYLES.map((o) => name(o, locale))} locale={locale}>
                      <Tiles
                        options={AVATAR_STYLES}
                        value={style}
                        onChange={(o) => {
                          setStyle(o);
                          playSound('tap');
                        }}
                        locale={locale}
                        art={(o) => <span className="text-[2.2rem] leading-none">{STYLE_EMOJI[o]}</span>}
                        cols="grid-cols-3 sm:grid-cols-5"
                      />
                    </Group>
                    <Group label={T.world} names={WORLDS.map((w) => tr(w.name, locale))} locale={locale}>
                      <div className="grid max-h-[22rem] grid-cols-3 gap-3 overflow-y-auto p-1 [scrollbar-width:thin] sm:grid-cols-4">
                        {WORLDS.map((w) => {
                          const on = w.id === worldId;
                          return (
                            <button
                              key={w.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() => {
                                setWorldId(w.id);
                                playSound('tap');
                              }}
                              className={`${fx.toy} ${on ? fx.on : ''} flex min-h-[5.5rem] flex-col items-center justify-center gap-1 rounded-[1.3rem] p-2 font-display text-xs font-bold leading-tight`}
                              style={{ ...toy(w.colors.to, { depth: 5, ring: ACCENT, ink: w.colors.ink }), background: `linear-gradient(160deg, ${w.colors.from}, ${w.colors.to})` }}
                            >
                              <span aria-hidden="true" className="text-[1.7rem] leading-none">
                                {w.icon}
                              </span>
                              <span className="line-clamp-2">{tr(w.name, locale)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </Group>
                  </>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="mx-auto mt-6 max-w-sm lg:hidden">
            <CreateBox locale={locale} signedIn={signedIn} busy={busy} msg={msg} onCreate={() => void create()} />
          </div>
        </div>
      </div>

      {avatars.length ? (
        <section className="mt-14" aria-labelledby="gallery">
          <h2 id="gallery" className="font-display text-2xl font-bold text-text-body">
            🖼️ {tr(T.gallery, locale)}
          </h2>
          <ul className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-4">
            {avatars.map((a) => (
              <li key={a.id} className={`overflow-hidden rounded-[1.6rem] bg-bg-card shadow-[0_6px_0_rgba(140,90,200,0.16),0_18px_30px_-20px_rgba(90,40,140,0.6)] ${selected === a.id ? 'ring-4 ring-[#A35BD6]' : 'ring-1 ring-black/5'}`}>
                {a.url ? (
                  // Signed, short-lived URL from private storage: a plain img is right here.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={tr(T.preview, locale)} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="grid aspect-square place-items-center text-5xl">🧑‍🎨</div>
                )}
                <div className="flex gap-2 p-3">
                  <button type="button" onClick={() => choose(a.id)} className={`${fx.toy} min-h-11 flex-1 rounded-full px-3 font-display text-xs font-bold`} style={toy(ACCENT, { depth: 4 })}>
                    {tr(selected === a.id ? T.inUse : T.use, locale)}
                  </button>
                  <button type="button" onClick={() => void remove(a.id)} className={`${fx.toy} ${fx.light} min-h-11 rounded-full px-3 font-display text-xs font-bold`} style={{ '--depth': '4px' } as CSSProperties}>
                    {tr(T.del, locale)}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </StudioFrame>
  );
}

function CreateBox({ locale, signedIn, busy, msg, onCreate }: { locale: string; signedIn: boolean | null; busy: boolean; msg: string | null; onCreate: () => void }) {
  return (
    <div className="grid gap-3">
      {signedIn === false ? (
        <div className="rounded-[1.6rem] bg-bg-card p-4 text-center text-sm text-text-muted shadow-[0_6px_0_rgba(140,90,200,0.14)] ring-1 ring-black/5 dark:ring-white/10">
          <p>{tr(T.signIn, locale)}</p>
          <Link href="/login" className={`${fx.toy} mt-3 inline-flex min-h-12 items-center justify-center rounded-full px-5 font-display text-base font-bold`} style={toy(ACCENT, { depth: 5 })}>
            🔒 {tr(T.signInBtn, locale)}
          </Link>
        </div>
      ) : (
        <button type="button" disabled={busy || !signedIn} onClick={onCreate} className={`${fx.toy} ${busy ? '' : fx.sheen} inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-full px-6 font-display text-lg font-bold`} style={toy(ACCENT, { depth: 7 })}>
          <span aria-hidden="true" className={busy ? fx.bob : ''}>
            ✨
          </span>
          {busy ? tr(T.creating, locale) : tr(T.create, locale)}
        </button>
      )}
      {msg ? (
        <p role="status" className="rounded-2xl bg-[#FFD447]/20 px-4 py-3 text-center text-sm font-semibold text-text-body">
          {msg}
        </p>
      ) : null}
    </div>
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
      <div className="mx-auto max-w-xl rounded-[2rem] bg-bg-card p-6 text-center shadow-[0_8px_0_rgba(140,90,200,0.14)] ring-1 ring-black/5 dark:ring-white/10">
        <p className="text-text-muted">{tr(T.signIn, locale)}</p>
        <Link href="/login" className={`${fx.toy} mt-4 inline-flex min-h-12 items-center rounded-full px-5 font-display font-bold`} style={toy(ACCENT, { depth: 5 })}>
          🔒 {tr(T.signInBtn, locale)}
        </Link>
      </div>
    );
  }
  return (
    <section className="mx-auto max-w-2xl rounded-[2rem] bg-bg-card p-6 shadow-[0_8px_0_rgba(140,90,200,0.14)] ring-2 ring-[#A35BD6]/30" aria-labelledby="photo-title">
      <h2 id="photo-title" className="font-display text-xl font-bold text-text-body">
        🔒 {tr(T.photoTitle, locale)}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-text-muted">{tr(T.photoInfo, locale)}</p>
      <label className="mt-4 flex items-start gap-3 text-sm font-semibold text-text-body">
        <input type="checkbox" checked={consent} onChange={(e) => void toggleConsent(e.target.checked)} className="mt-1 h-5 w-5 accent-[#A35BD6]" />
        {tr(T.consent, locale)}
      </label>
      <div className="mt-5 flex flex-wrap gap-3">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="avatar-photo" onChange={(e) => void onFile(e.target.files?.[0])} disabled={!consent || busy} />
        <label htmlFor="avatar-photo" className={`${fx.toy} inline-flex min-h-12 cursor-pointer items-center rounded-full px-5 font-display font-bold ${!consent || busy ? 'pointer-events-none opacity-50' : ''}`} style={toy(ACCENT, { depth: 5 })}>
          📷 {tr(T.pick, locale)}
        </label>
        <button type="button" onClick={() => void deletePhotoData()} className={`${fx.toy} ${fx.light} inline-flex min-h-12 items-center rounded-full px-5 font-display font-bold`} style={{ '--depth': '5px' } as CSSProperties}>
          🗑️ {tr(T.deletePhoto, locale)}
        </button>
      </div>
      {msg ? (
        <p role="status" className="mt-4 rounded-2xl bg-[#A35BD6]/10 px-4 py-3 text-sm font-semibold text-text-body">
          {msg}
        </p>
      ) : null}
    </section>
  );
}

