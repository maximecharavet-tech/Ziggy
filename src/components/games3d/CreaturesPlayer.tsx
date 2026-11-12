'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'motion/react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { Link } from '@/i18n/navigation';
import type { CreaturesGame, Mode, SayKind } from '@/games3d/creatures/CreaturesGame';
import {
  ALBUM_KEY,
  BAND_CATEGORIES,
  CATEGORIES,
  COLORS,
  DRAWER_SIZE,
  LINES,
  STARTER,
  addToAlbum,
  canDoText,
  categoryOf,
  changedKeys,
  checkChallenge,
  drawerFor,
  drawerPage,
  hintFor,
  line,
  makeName,
  nextChallenge,
  pageWith,
  parseAlbum,
  randomCreature,
  removeFromAlbum,
  renameInAlbum,
  reqCategory,
  reqChip,
  type Band,
  type CategoryId,
  type Challenge,
  type Creature,
  type PartOption,
  type Saved,
} from '@/games3d/creatures/logic';
import { coloringPage, framedPhoto, photoName, printImage, saveImage } from '@/games3d/creatures/photo';
import { getMemory, useHydrated, useWorldMemory } from '@/lib/world/store';
import { maxDifficulty, readAloudOn } from '@/lib/world/memory';
import { finishExtraGame } from '@/lib/world/play';
import { speakSequence, stopSpeaking, unlockAudio, voiceStore } from '@/lib/voice';
import { tr, type L } from '@/lib/i18n-text';
import { SayButton } from '@/components/arcade/read-aloud';
import { ZiggyAvatar } from '@/components/ziggy/Mascot';
import { useGrownUpGate } from '@/components/app/GrownUpGate';
import { isTv, useTvStepFocus } from '@/components/games3d/tv-step-focus';

const T = {
  title: { fr: 'L’Usine à Créatures de Ziggy', en: 'Ziggy’s Creature Factory' },
  loading: { fr: 'Ziggy allume la machine…', en: 'Ziggy is starting the machine…' },
  back: { fr: 'Retour', en: 'Back' },
  music: { fr: 'Musique', en: 'Music' },
  undo: { fr: 'Revenir en arrière', en: 'Undo' },
  parade: { fr: 'La Parade', en: 'The Parade' },
  surprise: { fr: 'Surprise !', en: 'Surprise!' },
  alive: { fr: 'Donne-lui vie !', en: 'Bring it to life!' },
  aliveShort: { fr: 'Vie !', en: 'Live!' },
  photo: { fr: 'Photo', en: 'Photo' },
  disguise: { fr: 'Ziggy, deviens-la !', en: 'Ziggy, become it!' },
  undress: { fr: 'Ziggy enlève son déguisement', en: 'Ziggy takes off the costume' },
  atelier: { fr: 'Retour à l’atelier', en: 'Back to the workshop' },
  newName: { fr: 'Un nouveau nom', en: 'A new name' },
  more: { fr: 'Encore d’autres', en: 'More' },
  less: { fr: 'Un de moins', en: 'One less' },
  plus: { fr: 'Un de plus', en: 'One more' },
  offer: { fr: 'Un défi rigolo ?', en: 'A fun challenge?' },
  show: { fr: 'Montre à Ziggy !', en: 'Show Ziggy!' },
  close: { fr: 'Fermer', en: 'Close' },
  joins: { fr: 'rejoint la Parade !', en: 'joins the Parade!' },
  save: { fr: 'Enregistrer la photo', en: 'Save the photo' },
  coloring: { fr: 'Coloriage à imprimer', en: 'Colouring page to print' },
  coloringTitle: { fr: 'Colorie ma créature !', en: 'Colour my creature!' },
  grownups: { fr: 'Pour les grands', en: 'For grown-ups' },
  ok: { fr: 'Super !', en: 'Great!' },
  madeWith: { fr: 'Fabriquée avec Ziggy', en: 'Made with Ziggy' },
  emptyParade: { fr: 'Prends une photo de ta créature : elle rejoindra la Parade !', en: 'Take a photo of your creature: it will join the Parade!' },
  welcome: { fr: 'Coucou ! On fait la parade ?', en: 'Hello! Shall we do the parade?' },
  touchHere: { fr: 'Touche ici pour la changer !', en: 'Tap here to change it!' },
  resume: { fr: 'La reprendre', en: 'Play with it' },
  rename: { fr: 'Nouveau nom', en: 'New name' },
  remove: { fr: 'Enlever de la Parade', en: 'Remove from the Parade' },
  sure: { fr: 'Sûr ? Touche encore', en: 'Sure? Tap again' },
  noWebgl: { fr: 'Ce jeu en 3D a besoin de WebGL, qui n’est pas disponible sur cet appareil.', en: 'This 3D game needs WebGL, which this device does not support.' },
  countTogether: { fr: 'Comptons ensemble !', en: 'Let’s count together!' },
  me: { fr: 'Je m’appelle', en: 'My name is' },
  dressed: { fr: 'Regarde, je suis déguisé comme', en: 'Look, I’m dressed up like' },
  options: { fr: 'Les pièces', en: 'The parts' },
  parts: { fr: 'Les familles de pièces', en: 'Kinds of parts' },
} satisfies Record<string, L>;

const SAY: Record<SayKind, L[]> = {
  surprise: LINES.surprise,
  alive: LINES.alive,
  walk: LINES.walk,
  pogo: LINES.pogo,
  bounce: LINES.bounce,
  fly: LINES.fly,
  flutter: LINES.flutter,
  swim: LINES.swim,
  sneeze: LINES.sneeze,
  dance: LINES.dance,
  tickle: LINES.tickle,
  parade: LINES.parade,
  disguise: [{ fr: 'Regarde, je suis déguisé !', en: 'Look, I’m dressed up!' }],
};

/** Suggested path for the little ones (a soft halo, never an order). */
const GUIDE: Record<Band, CategoryId[]> = {
  little: ['color', 'eyes', 'legs', 'wingtail', 'hat'],
  middle: ['color', 'eyes', 'legs', 'wings', 'hat'],
  big: ['color', 'eyes', 'legs', 'wings', 'hat'],
};

const SEEN_KEY = 'ziggy:creatures:seen';

function webglOk() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key: string, v: string) {
  try {
    window.localStorage.setItem(key, v);
  } catch {
    /* storage full or blocked: the album lives on for this visit */
  }
}

/* ───────────────────────── Little pictures for the tiles ───────────────────────── */

function BodyIcon({ shape, color }: { shape: string; color: string }) {
  const s = { fill: color, stroke: 'rgba(0,0,0,.18)', strokeWidth: 2 };
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden="true">
      {shape === 'blob' || shape === 'ball' ? <circle cx="24" cy="25" r="17" {...s} /> : null}
      {shape === 'egg' ? <path d="M24 6c9 0 15 13 15 22a15 15 0 0 1-30 0C9 19 15 6 24 6z" {...s} /> : null}
      {shape === 'bean' ? <rect x="4" y="13" width="40" height="24" rx="12" {...s} /> : null}
      {shape === 'box' ? <rect x="8" y="9" width="32" height="31" rx="9" {...s} /> : null}
      {shape === 'pear' ? <path d="M24 6c5 0 8 5 9 11 1 5 9 9 9 17 0 6-8 9-18 9S6 40 6 34c0-8 8-12 9-17 1-6 4-11 9-11z" {...s} /> : null}
      {shape === 'cloud' ? <path d="M13 35a8 8 0 0 1-1-16 9 9 0 0 1 15-4 9 9 0 0 1 11 9 7 7 0 0 1-2 11z" {...s} /> : null}
      {shape === 'tall' ? <rect x="14" y="4" width="20" height="40" rx="10" {...s} /> : null}
      {shape === 'barrel' ? <path d="M13 7h22c5 6 5 28 0 34H13C8 35 8 13 13 7z" {...s} /> : null}
      {shape === 'bell' ? <path d="M24 6c8 0 11 9 11 17 0 7 7 10 9 17H4c2-7 9-10 9-17 0-8 3-17 11-17z" {...s} /> : null}
      {shape === 'pillow' ? <path d="M9 10c10 3 20 3 30 0 3 9 3 19 0 28-10-3-20-3-30 0-3-9-3-19 0-28z" {...s} /> : null}
      {shape === 'wide' ? <ellipse cx="24" cy="25" rx="21" ry="13" {...s} /> : null}
      {shape === 'cone' ? <path d="M24 5c5 6 9 18 15 26 0 7-8 11-15 11S9 38 9 31C15 23 19 11 24 5z" {...s} /> : null}
      {shape === 'drop' ? <path d="M24 7c6 0 9 6 11 12 3 7 7 11 7 15 0 5-8 8-18 8S6 39 6 34c0-4 4-8 7-15 2-6 5-12 11-12z" {...s} /> : null}
      {shape === 'none' ? (
        <g>
          <circle cx="24" cy="24" r="16" fill="none" stroke="#c9b8e8" strokeWidth="3" strokeDasharray="5 4" />
          <circle cx="19" cy="22" r="3" fill="#2c2440" />
          <circle cx="29" cy="22" r="3" fill="#2c2440" />
        </g>
      ) : null}
    </svg>
  );
}

function PatternIcon({ kind, color, accent }: { kind: string; color: string; accent: string }) {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden="true">
      <defs>
        <clipPath id={`cp-${kind}`}>
          <circle cx="24" cy="24" r="18" />
        </clipPath>
      </defs>
      <circle cx="24" cy="24" r="18" fill={color} />
      <g clipPath={`url(#cp-${kind})`} fill={accent}>
        {kind === 'dots' ? [10, 24, 38].flatMap((x, i) => [14, 30].map((y) => <circle key={`${x}-${y}`} cx={x + (y > 20 ? 7 : 0) - (i === 2 ? 0 : 0)} cy={y} r="4.5" />)) : null}
        {kind === 'zigzag' ? [10, 22, 34].map((y) => <path key={y} d={`M0 ${y}l8 8 8-8 8 8 8-8 8 8 8-8`} fill="none" stroke={accent} strokeWidth="4" />) : null}
        {kind === 'hearts' ? [[15, 18], [32, 22], [21, 34]].map(([x, y]) => <path key={x} d={`M${x} ${y + 5}c-9-5-7-11-3-11 2 0 3 1 3 3 0-2 1-3 3-3 4 0 6 6-3 11z`} />) : null}
        {kind === 'checks' ? [0, 1, 2, 3].flatMap((i) => [0, 1, 2, 3].filter((j) => (i + j) % 2 === 0).map((j) => <rect key={`${i}${j}`} x={6 + i * 9} y={6 + j * 9} width="9" height="9" />)) : null}
        {kind === 'waves' ? [12, 24, 36].map((y) => <path key={y} d={`M0 ${y}q6-8 12 0t12 0 12 0 12 0`} fill="none" stroke={accent} strokeWidth="4" />) : null}
        {kind === 'stripes' ? [8, 20, 32].map((y) => <rect key={y} x="0" y={y} width="48" height="6" />) : null}
        {kind === 'stars' ? [[16, 17], [31, 22], [20, 33]].map(([x, y]) => <path key={x} d={`M${x} ${y - 6}l1.8 4 4.4.4-3.3 2.9 1 4.3-3.9-2.3-3.9 2.3 1-4.3-3.3-2.9 4.4-.4z`} />) : null}
      </g>
      <circle cx="24" cy="24" r="18" fill="none" stroke="rgba(0,0,0,.16)" strokeWidth="2" />
    </svg>
  );
}

/** Countable pictures: n eyes, n legs, n arms. */
function CountIcon({ kind, n }: { kind: string; n: number }) {
  if (kind === 'eyes')
    return (
      <span className="flex max-w-[3.6rem] flex-wrap justify-center gap-0.5" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className="grid h-3.5 w-3.5 place-items-center rounded-full bg-white ring-1 ring-[#2c2440]/40">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2c2440]" />
          </span>
        ))}
      </span>
    );
  return (
    <span className="flex h-4 items-end justify-center gap-[3px]" aria-hidden="true">
      {n === 0 ? <span className="text-xs font-black text-[#8a6ab8]">∅</span> : null}
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={`block rounded-full bg-[#8a63ff] ${kind === 'arms' ? 'h-1.5 w-2.5' : 'h-4 w-1.5'}`} />
      ))}
    </span>
  );
}

function OptionIcon({ o, cat, c }: { o: PartOption; cat: CategoryId; c: Creature }) {
  const [field, value] = o.key.split(':');
  if (cat === 'color' || cat === 'accent') {
    const hex = COLORS[value as keyof typeof COLORS].hex;
    return <span className={`block h-10 w-10 shadow-inner ring-2 ring-black/10 ${cat === 'accent' ? 'rotate-45 rounded-xl' : 'rounded-full'}`} style={{ background: hex }} aria-hidden="true" />;
  }
  if (cat === 'body') return <BodyIcon shape={value} color={COLORS[c.color].hex} />;
  if (cat === 'head') return <BodyIcon shape={value} color={COLORS[c.color].hex} />;
  if (cat === 'pattern') return <PatternIcon kind={value} color={COLORS[c.color].hex} accent={COLORS[c.accent].hex} />;
  if (cat === 'size')
    return (
      <span className="grid h-10 w-10 place-items-center" aria-hidden="true">
        <span className="block rounded-full" style={{ width: 12 + Number(value) * 9, height: 12 + Number(value) * 9, background: COLORS[c.color].hex }} />
      </span>
    );
  if (field === 'eyeSize')
    return (
      <span className="grid h-10 w-10 place-items-center" aria-hidden="true">
        <span className="grid place-items-center rounded-full bg-white ring-2 ring-[#2c2440]/40" style={{ width: value === 'big' ? 34 : 20, height: value === 'big' ? 34 : 20 }}>
          <span className="rounded-full bg-[#2c2440]" style={{ width: value === 'big' ? 15 : 9, height: value === 'big' ? 15 : 9 }} />
        </span>
      </span>
    );
  if (field === 'eyes' || field === 'legs' || field === 'arms')
    return (
      <span className="flex flex-col items-center leading-none">
        <span className="font-display text-3xl font-bold text-[#3b2a6b]">{value}</span>
        <CountIcon kind={field} n={Number(value)} />
      </span>
    );
  return (
    <span className={`leading-none ${o.icon === '✖' ? 'text-2xl font-black text-[#b9a2d8]' : 'text-4xl'}`} aria-hidden="true">
      {o.icon}
    </span>
  );
}

/** The Surprise lever (a lever with a red ball: never a slot machine). */
function LeverIcon() {
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden="true">
      <rect x="10" y="27" width="20" height="9" rx="4" fill="#2ec4b6" />
      <rect x="18.5" y="9" width="3" height="20" rx="1.5" fill="#e6e9f7" transform="rotate(-25 20 28)" />
      <circle cx="12" cy="9.5" r="6" fill="#ff4d6d" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

/* ───────────────────────── The player ───────────────────────── */

export function CreaturesPlayer() {
  const raw = useLocale();
  const locale = raw === 'fr' ? 'fr' : 'en';
  const hydrated = useHydrated();
  const memory = useWorldMemory();
  const reduce = useReducedMotion();
  const gate = useGrownUpGate();
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<CreaturesGame | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'loading' | 'play'>('loading');
  const [supported, setSupported] = useState(true);
  const [wide, setWide] = useState(false);
  const [creature, setCreature] = useState<Creature>(STARTER);
  const creatureRef = useRef<Creature>(STARTER);
  const [history, setHistory] = useState<Creature[]>([]);
  const [cat, setCat] = useState<CategoryId>('color');
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<Mode>('atelier');
  const [album, setAlbum] = useState<Saved[]>([]);
  const albumRef = useRef<Saved[]>([]);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const [count, setCount] = useState<{ i: number; n: number; kind: string; id: number } | null>(null);
  const [xp, setXp] = useState<{ n: number; id: number } | null>(null);
  const [music, setMusic] = useState(true);
  const [used, setUsed] = useState<CategoryId[]>([]);
  const [guideOn, setGuideOn] = useState(false);
  const [challenge, setChallenge] = useState<{ ch: Challenge; at: number; mistakes: number } | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [edits, setEdits] = useState(0);
  const [offerAt, setOfferAt] = useState(6);
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null);
  const [flash, setFlash] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [dressed, setDressed] = useState(false);
  const [busyPic, setBusyPic] = useState(false);
  const okRef = useRef<HTMLButtonElement>(null);
  const unlocked = useRef(false);
  const pendingName = useRef(false);

  const band: Band = (memory.age ?? 'middle') as Band;
  const cats = BAND_CATEGORIES[band];

  useEffect(() => {
    setSupported(webglOk());
    const a = parseAlbum(readStore(ALBUM_KEY));
    albumRef.current = a;
    setAlbum(a);
    const onResize = () => setWide(window.innerWidth > window.innerHeight * 1.15);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const speak = useCallback(
    (lines: string[], id: string) => {
      if (!readAloudOn(getMemory())) return;
      void speakSequence(`creatures-${id}`, lines.filter(Boolean), locale);
    },
    [locale]
  );

  const say = useCallback(
    (text: string, id = 'say', aloud = true) => {
      setToast({ text, id: Date.now() });
      if (aloud) speak([text], id);
    },
    [speak]
  );

  const saveAlbum = (a: Saved[]) => {
    albumRef.current = a;
    setAlbum(a);
    writeStore(ALBUM_KEY, JSON.stringify(a));
  };

  const commit = useCallback((next: Creature, keepHistory = true) => {
    const prev = creatureRef.current;
    if (keepHistory) setHistory((h) => [...h.slice(-29), prev]);
    creatureRef.current = next;
    setCreature(next);
  }, []);

  const nameLine = useCallback((c: Creature) => `${tr(T.me, locale)} ${c.name} !`, [locale]);

  /* ── Start: straight into the factory; Ziggy pulls the lever himself ── */
  useEffect(() => {
    if (!hydrated || !supported) return;
    let alive = true;
    void (async () => {
      try {
        const { CreaturesGame } = await import('@/games3d/creatures/CreaturesGame');
        if (!alive || !canvas.current) return;
        const g = new CreaturesGame(canvas.current, {
          onSay: (kind) => {
            const c = creatureRef.current;
            const list = SAY[kind];
            let text = tr(list[Math.floor(Math.random() * list.length)], locale);
            if (kind === 'alive') text = `${text} ${canDoText(c, locale)}`;
            if (kind === 'disguise') text = `${tr(T.dressed, locale)} ${c.name} !`;
            say(text, kind);
          },
          onLever: () => surpriseRef.current(),
          onCount: (i, n, kind) => {
            setCount({ i, n, kind, id: Date.now() });
            if (i > 0) speak([String(i)], `count-${i}`);
          },
          onMode: (m) => setMode(m),
          onArrive: () => {
            const c = creatureRef.current;
            setToast({ text: nameLine(c), id: Date.now() });
            if (unlocked.current) speak([nameLine(c)], 'name');
            else pendingName.current = true;
          },
          onZiggy: () => disguiseRef.current(),
        });
        game.current = g;
        if (process.env.NODE_ENV !== 'production') (window as unknown as { __creatures?: CreaturesGame }).__creatures = g;
        // Who comes out first: the last creature of the Parade, else the friendly starter (first visit) or a surprise.
        const last = albumRef.current[0];
        const seen = readStore(SEEN_KEY) === '1';
        writeStore(SEEN_KEY, '1');
        const first: Creature = last ? { ...last } : seen ? randomCreature(Math.floor(Math.random() * 1e9)) : STARTER;
        creatureRef.current = first;
        setCreature(first);
        g.intro(first);
        setPhase('play');
        window.setTimeout(() => {
          if (!alive) return;
          if (last) say(tr(T.welcome, locale), 'welcome', unlocked.current);
          setGuideOn(true);
        }, 2600);
        if (!seen)
          window.setTimeout(() => {
            if (alive && !unlocked.current) setToast({ text: tr(T.touchHere, locale), id: Date.now() });
          }, 4200);
      } catch {
        if (alive) setSupported(false);
      }
    })();
    return () => {
      alive = false;
      game.current?.dispose();
      game.current = null;
      stopSpeaking();
    };
    // Built once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, supported]);

  // First touch (or key): sound can start; read the name if it was waiting.
  useEffect(() => {
    const unlock = () => {
      if (unlocked.current) return;
      unlocked.current = true;
      unlockAudio();
      game.current?.setMusic(music);
      if (pendingName.current) {
        pendingName.current = false;
        speak([nameLine(creatureRef.current)], 'name');
      }
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
    };
  }, [music, nameLine, speak]);

  // The music steps aside while Ziggy speaks.
  useEffect(() => {
    const off = voiceStore.subscribe(() => game.current?.audio.setDuck(Boolean(voiceStore.get().speakingId)));
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), Math.min(7000, 2600 + toast.text.length * 45));
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!count) return;
    const t = setTimeout(() => setCount(null), 1100);
    return () => clearTimeout(t);
  }, [count]);
  useEffect(() => {
    if (!xp) return;
    const t = setTimeout(() => setXp(null), 3200);
    return () => clearTimeout(t);
  }, [xp]);
  // The photo opens: the focus goes to its big OK button (remote, keyboard), never left behind it.
  useEffect(() => {
    if (!photo) return;
    const t = setTimeout(() => okRef.current?.focus({ preventScroll: true }), 60);
    return () => clearTimeout(t);
  }, [photo]);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(0), 260);
    return () => clearTimeout(t);
  }, [flash]);

  // Tell the scene what the HUD covers, so the creature stays in the free part.
  useEffect(() => {
    if (phase !== 'play') return;
    const measure = () => {
      const top = topRef.current?.getBoundingClientRect().bottom ?? 0;
      const b = bottomRef.current?.getBoundingClientRect();
      const bottom = b && b.height > 0 ? window.innerHeight - b.top : 0;
      const l = leftRef.current?.getBoundingClientRect();
      const r = rightRef.current?.getBoundingClientRect();
      game.current?.setInsets({ top, bottom, left: l && l.width ? l.right : 0, right: r && r.width ? window.innerWidth - r.left : 0 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    for (const el of [topRef.current, bottomRef.current, leftRef.current, rightRef.current]) if (el) ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [phase, wide, mode, challenge, cat]);

  // TV: the remote always lands on a useful button when the scene changes.
  useTvStepFocus(phase === 'play' ? `${mode}-${photo ? 'photo' : ''}` : null, rootRef);

  /* ── Actions ── */

  const g = () => game.current;

  const chooseCat = (id: CategoryId) => {
    setCat(id);
    const d = drawerFor(id, band);
    setPage(pageWith(d.options, creatureRef.current, DRAWER_SIZE[band] - (d.stepper ? 2 : 0)));
    const info = CATEGORIES.find((c) => c.id === id);
    if (info) speak([tr(info.label, locale)], 'cat');
    if (mode !== 'atelier') g()?.backToAtelier(true);
  };

  const afterEdit = (id: CategoryId) => {
    setUsed((u) => (u.includes(id) ? u : [...u, id]));
    setEdits((n) => n + 1);
    setConfirmDel(false);
  };

  const apply = (o: PartOption) => {
    const cur = creatureRef.current;
    const next = o.apply(cur);
    const changed = changedKeys(cur, next);
    afterEdit(cat);
    if (!changed.length) {
      g()?.tickle();
      speak([tr(o.say, locale)], 'part');
      return;
    }
    commit(next);
    g()?.setPart(next, changed, cat);
    setToast({ text: tr(o.say, locale), id: Date.now() });
    speak([tr(o.say, locale)], 'part');
    if (dressed) setDressed(false);
  };

  const step = (field: 'legs' | 'eyes', delta: number, min: number, max: number) => {
    const cur = creatureRef.current;
    const v = Math.max(min, Math.min(max, cur[field] + delta));
    if (v === cur[field]) {
      g()?.tickle();
      return;
    }
    const next = { ...cur, [field]: v };
    commit(next);
    g()?.setPart(next, [field], field);
    afterEdit(field);
    const word = field === 'legs' ? (locale === 'fr' ? (v === 1 ? 'patte' : 'pattes') : v === 1 ? 'leg' : 'legs') : locale === 'fr' ? (v === 1 ? 'œil' : 'yeux') : v === 1 ? 'eye' : 'eyes';
    const text = `${v} ${word} !`;
    setToast({ text, id: Date.now() });
    speak([text], 'step');
  };

  const surprise = () => {
    const next = randomCreature(Math.floor(Math.random() * 1e9));
    commit(next);
    g()?.surprise(next);
    afterEdit('body');
    setDressed(false);
  };
  const surpriseRef = useRef(surprise);
  surpriseRef.current = surprise;

  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    const cur = creatureRef.current;
    const changed = changedKeys(cur, prev);
    creatureRef.current = prev;
    setCreature(prev);
    if (changed.length) g()?.setPart(prev, changed, categoryOf(changed[0]));
    else g()?.rename();
  };

  const reroll = () => {
    const cur = creatureRef.current;
    const next = { ...cur, name: makeName(Math.floor(Math.random() * 1e9)) };
    commit(next);
    g()?.rename();
    say(nameLine(next), 'name');
  };

  const alive = () => {
    afterEdit('body');
    g()?.alive();
  };

  const disguise = () => {
    g()?.disguise();
    setDressed(Boolean(g()?.disguised));
  };
  const disguiseRef = useRef(disguise);
  disguiseRef.current = disguise;

  const takePhoto = async () => {
    const game0 = g();
    if (!game0 || busyPic) return;
    setBusyPic(true);
    setFlash(Date.now());
    const c = creatureRef.current;
    const shot = game0.snapshot(1024, true);
    const thumb = game0.snapshot(168, false, 'image/jpeg', 0.72);
    const saved = addToAlbum(albumRef.current, c, Date.now(), thumb);
    saveAlbum(saved);
    const withId = { ...c, id: saved[0].id };
    creatureRef.current = withId;
    setCreature(withId);
    const date = new Date().toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB');
    const url = shot ? await framedPhoto(shot, c.name, tr(T.madeWith, locale), date) : '';
    setPhoto({ url, name: c.name });
    setBusyPic(false);
    say(`${c.name} ${tr(T.joins, locale)}`, 'joins');
  };

  const savePhoto = async () => {
    if (!photo?.url) return;
    if (!(await gate.ask('parents'))) return;
    await saveImage(photo.url, photoName(photo.name, 'photo'));
  };

  const printColoring = async () => {
    const game0 = g();
    if (!game0) return;
    if (!(await gate.ask('parents'))) return;
    const lines = game0.lineArt(900);
    const page = await coloringPage(lines, creatureRef.current.name, tr(T.coloringTitle, locale), 'ziggy-ai.fr');
    await printImage(page, creatureRef.current.name);
  };

  const openParade = () => {
    if (!albumRef.current.length) {
      say(tr(T.emptyParade, locale), 'empty');
      return;
    }
    setSelected(null);
    setConfirmDel(false);
    g()?.startParade(albumRef.current);
  };

  const resume = (s: Saved) => {
    const c: Creature = { ...s };
    commit(c);
    g()?.endParade();
    g()?.surprise(c);
    setSelected(null);
  };

  const renameSaved = (s: Saved) => {
    const name = makeName(Math.floor(Math.random() * 1e9));
    saveAlbum(renameInAlbum(albumRef.current, s.id, name));
    if (creatureRef.current.id === s.id) {
      const next = { ...creatureRef.current, name };
      creatureRef.current = next;
      setCreature(next);
    }
    g()?.paradeSelect(s.id);
    say(`${tr(T.me, locale)} ${name} !`, 'name');
  };

  const removeSaved = (s: Saved) => {
    if (!confirmDel) {
      setConfirmDel(true);
      return;
    }
    setConfirmDel(false);
    const next = removeFromAlbum(albumRef.current, s.id);
    saveAlbum(next);
    setSelected(null);
    if (creatureRef.current.id === s.id) {
      const c = { ...creatureRef.current, id: '' };
      creatureRef.current = c;
      setCreature(c);
    }
    if (next.length) g()?.startParade(next);
    else g()?.endParade();
  };

  /* ── Challenges (optional; Ziggy offers, never insists) ── */

  const offerVisible = !challenge && mode === 'atelier' && edits >= offerAt && phase === 'play';

  const startChallenge = () => {
    const m = getMemory();
    const level = Math.min(m.skills.counting?.difficulty ?? 1, maxDifficulty(m));
    const ch = nextChallenge(band, level, done, Math.floor(Math.random() * 1e6));
    setChallenge({ ch, at: Date.now(), mistakes: 0 });
    speak([tr(ch.text, locale)], 'challenge');
  };

  const closeChallenge = () => {
    setChallenge(null);
    setOfferAt(edits + 8);
  };

  const checkNow = () => {
    if (!challenge) return;
    const c = creatureRef.current;
    const res = checkChallenge(challenge.ch, c);
    if (res.ok) {
      const o = finishExtraGame('creatures', challenge.ch.skill, { correct: 1, mistakes: challenge.mistakes, total: 1 + challenge.mistakes }, Date.now() - challenge.at);
      setXp({ n: o.xpGained, id: Date.now() });
      setDone((d) => [...d, challenge.ch.id]);
      setChallenge(null);
      setOfferAt(edits + 5);
      g()?.audio.fanfare();
      g()?.tickle();
      say(tr(line('challengeWin', Math.floor(Math.random() * 2)), locale), 'win');
      return;
    }
    // Not yet: a kind hint, and for numbers Ziggy counts along with the child.
    setChallenge({ ...challenge, mistakes: challenge.mistakes + 1 });
    const i = res.met.indexOf(false);
    const r = challenge.ch.reqs[i];
    const hint = hintFor(challenge.ch, c, locale);
    const countKind = r.k === 'legs' || r.k === 'oddLegs' || r.k === 'limbs' || r.k === 'eyesEqLegs' ? 'legs' : r.k === 'eyes' || r.k === 'sumAll' ? 'eyes' : r.k === 'arms' ? 'arms' : null;
    if (countKind) {
      say(`${tr(T.countTogether, locale)} ${hint}`, 'hint');
      g()?.countAlong(countKind);
    } else say(hint, 'hint');
    let target = reqCategory(r);
    if (!cats.includes(target) && (target === 'wings' || target === 'tail')) target = 'wingtail';
    if (cats.includes(target)) chooseCat(target);
  };

  /* ── Rendering ── */

  const d = drawerFor(cat, band);
  const size = DRAWER_SIZE[band] - (d.stepper ? 2 : 0);
  const pg = drawerPage(d.options, page, size);
  const guideNext = guideOn && mode === 'atelier' && !challenge ? (GUIDE[band].find((x) => cats.includes(x) && !used.includes(x)) ?? (used.length >= 3 && edits < 12 ? 'alive' : null)) : null;
  const tileLook = (on: boolean) => (on ? 'bg-[#fff1c2] ring-4 ring-[#ffb35c] scale-[1.04]' : 'bg-white/95 ring-1 ring-[#e6dcff] hover:bg-[#fff7ea]');
  const focusLook = (e: React.FocusEvent<HTMLElement>) => {
    if (!isTv()) return;
    const r = e.currentTarget.getBoundingClientRect();
    g()?.lookAtScreen(r.left + r.width / 2, r.top + r.height / 2);
  };

  const tabs = (
    <div
      className={`flex gap-1.5 ${wide ? 'flex-col p-1.5' : 'overflow-x-auto overscroll-contain px-1 pb-1 pt-1'}`}
      data-tv-row=""
      data-tv-wrap="false"
      role="tablist"
      aria-label={tr(T.parts, locale)}
    >
      {cats.map((id) => {
        const info = CATEGORIES.find((c) => c.id === id)!;
        const on = cat === id;
        const halo = guideNext === id;
        return (
          <motion.button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            aria-label={tr(info.label, locale)}
            onClick={() => chooseCat(id)}
            onFocus={focusLook}
            whileTap={reduce ? undefined : { scale: 0.88 }}
            className={`relative grid h-16 w-14 shrink-0 place-items-center rounded-2xl text-3xl transition sm:w-16 ${on ? 'bg-gradient-to-b from-[#ffe08a] to-[#ffc24d] shadow-[0_4px_0_#e0a12a]' : 'bg-white/90 shadow-[0_3px_0_rgba(110,80,180,.18)]'}`}
          >
            <span aria-hidden="true">{info.icon}</span>
            {halo ? (
              <>
                <motion.span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-2xl ring-4 ring-[#ff5c8a]"
                  animate={reduce ? { opacity: 0.9 } : { opacity: [0.35, 1, 0.35], scale: [1, 1.08, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
                <motion.span aria-hidden="true" className="pointer-events-none absolute -top-5 right-0 text-2xl" animate={reduce ? undefined : { y: [0, -6, 0] }} transition={{ duration: 0.9, repeat: Infinity }}>
                  👆
                </motion.span>
              </>
            ) : null}
          </motion.button>
        );
      })}
    </div>
  );

  const tile = (key: string, on: boolean, label: string, onClick: () => void, icon: ReactNode, extra = '', hideLabel = false) => (
    <motion.button
      key={key}
      type="button"
      onClick={onClick}
      onFocus={focusLook}
      whileTap={reduce ? undefined : { scale: 0.86 }}
      aria-pressed={on}
      aria-label={label}
      className={`relative flex min-h-[72px] min-w-[68px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1 shadow-sm transition sm:min-h-[80px] sm:max-w-[104px] ${tileLook(on)} ${extra}`}
    >
      {icon}
      <span className={`max-w-full truncate px-0.5 text-[11px] font-bold leading-tight text-[#5b3f8f] ${band === 'little' || hideLabel ? 'sr-only' : ''}`}>{label}</span>
    </motion.button>
  );

  const drawer = (
    <div className={wide ? 'flex w-[6.4rem] flex-col items-stretch gap-1.5 p-1.5 [&>button]:!max-w-none [&>button]:!flex-none' : 'flex w-full items-stretch gap-1.5'} data-tv-row="" data-tv-wrap="false" data-tv-stage="">
      {d.stepper ? (
        <div className={wide ? 'flex flex-col-reverse items-stretch gap-1 [&>button]:!max-w-none [&>button]:!flex-none' : 'flex items-stretch gap-1'}>
          {tile('minus', false, tr(T.less, locale), () => step(d.stepper!.field, -1, d.stepper!.min, d.stepper!.max), <span className="font-display text-4xl font-bold text-[#8a63ff]">−</span>, '!max-w-[64px]', true)}
          <div className="flex min-h-[64px] min-w-[70px] flex-col items-center justify-center rounded-2xl bg-[#f3ecff] px-2" aria-live="polite">
            <span className="font-display text-4xl font-bold leading-none text-[#3b2a6b]">{creature[d.stepper.field]}</span>
            <CountIcon kind={d.stepper.field} n={creature[d.stepper.field]} />
          </div>
          {tile('plus', false, tr(T.plus, locale), () => step(d.stepper!.field, 1, d.stepper!.min, d.stepper!.max), <span className="font-display text-4xl font-bold text-[#8a63ff]">+</span>, '!max-w-[64px]', true)}
        </div>
      ) : null}
      {pg.items.map((o) => tile(o.key, o.selected(creature), tr(o.label, locale), () => apply(o), <OptionIcon o={o} cat={cat} c={creature} />))}
      {pg.more ? tile('more', false, tr(T.more, locale), () => setPage((p) => p + 1), <span className="text-3xl" aria-hidden="true">↻</span>, '!bg-[#f3ecff]') : null}
    </div>
  );

  const action = (key: string, label: string, short: string, icon: ReactNode, onClick: () => void, cls: string, auto = false, halo = false) => (
    <motion.button
      key={key}
      type="button"
      onClick={onClick}
      whileTap={reduce ? undefined : { scale: 0.88 }}
      data-tv-autofocus={auto ? '' : undefined}
      aria-label={label}
      className={`relative flex min-h-[64px] min-w-[64px] items-center justify-center gap-1.5 rounded-2xl px-2 font-display text-lg font-bold text-white shadow-[0_5px_0_rgba(0,0,0,.16)] ${cls}`}
    >
      {icon}
      {short ? <span className={`whitespace-nowrap ${wide ? 'text-base' : 'text-[15px]'}`}>{short}</span> : null}
      {halo ? (
        <motion.span aria-hidden="true" className="pointer-events-none absolute -inset-1 rounded-[1.2rem] ring-4 ring-[#ff5c8a]" animate={reduce ? { opacity: 0.9 } : { opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.4, repeat: Infinity }} />
      ) : null}
    </motion.button>
  );

  const actions = (
    <div className={`flex gap-2 ${wide ? 'flex-col' : 'w-full'}`} data-tv-row="" data-tv-wrap="false">
      {action('surprise', tr(T.surprise, locale), tr(T.surprise, locale), <LeverIcon />, surprise, `bg-gradient-to-b from-[#4fd1c5] to-[#22a99c] ${wide ? '' : 'flex-1'}`, true)}
      {action('alive', tr(T.alive, locale), tr(wide ? T.alive : T.aliveShort, locale), <span className="text-3xl" aria-hidden="true">✨</span>, alive, `bg-gradient-to-b from-[#ff8ab3] to-[#ff4f8b] ${wide ? '' : 'flex-1'}`, false, guideNext === 'alive')}
      {action('photo', tr(T.photo, locale), '', <span className="text-3xl" aria-hidden="true">📸</span>, () => void takePhoto(), 'bg-gradient-to-b from-[#ffc65c] to-[#ff9a2e]')}
      {action(
        'disguise',
        tr(dressed ? T.undress : T.disguise, locale),
        '',
        <span className="relative" aria-hidden="true">
          <ZiggyAvatar size={36} ring={false} />
          <span className="absolute -bottom-1 -right-2 text-lg">{dressed ? '👕' : '🎭'}</span>
        </span>,
        disguise,
        'bg-gradient-to-b from-[#a78bfa] to-[#7c5cff]'
      )}
    </div>
  );

  const challengeCard = challenge ? (
    <div className="pointer-events-auto mx-auto mt-2 w-full max-w-xl rounded-3xl bg-white/95 p-2 shadow-[0_8px_30px_rgba(90,40,140,.2)] ring-2 ring-[#ffd166]">
      <div className="flex items-center gap-2">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#fff1c2] text-2xl" aria-hidden="true">
          {challenge.ch.icon}
        </span>
        <p className={`min-w-0 flex-1 text-sm font-bold leading-snug text-[#3b2a6b] ${band === 'little' ? 'sr-only' : ''}`}>{tr(challenge.ch.text, locale)}</p>
        {band === 'little' ? <span className="flex-1" /> : null}
        <SayButton texts={[tr(challenge.ch.text, locale)]} locale={locale} size="sm" />
        <button type="button" onClick={closeChallenge} aria-label={tr(T.close, locale)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f3ecff] text-lg font-bold text-[#7c5cff]">
          ✕
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-2" data-tv-row="" data-tv-wrap="false">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1" aria-hidden="true">
          {challenge.ch.reqs.map((r, i) => {
            const chip = reqChip(r, creature);
            const ok = band !== 'big' && checkChallenge(challenge.ch, creature).met[i];
            return (
              <span key={i} className={`flex items-center gap-0.5 rounded-xl px-2 py-1 text-xl font-bold ${ok ? 'bg-[#dff5d6] text-[#2f7d32]' : 'bg-[#f3ecff] text-[#3b2a6b]'}`}>
                {chip.n ? <span className="font-display">{chip.n}</span> : null}
                {r.k === 'color' ? <span className="inline-block h-5 w-5 rounded-full ring-1 ring-black/10" style={{ background: COLORS[r.is].hex }} /> : <span>{chip.icon}</span>}
                {ok ? <span className="text-xs">✓</span> : null}
              </span>
            );
          })}
        </div>
        <motion.button type="button" onClick={checkNow} whileTap={reduce ? undefined : { scale: 0.9 }} className="flex min-h-[56px] shrink-0 items-center gap-1 rounded-2xl bg-gradient-to-b from-[#6bdc6b] to-[#3fae3f] px-3 font-display text-base font-bold text-white shadow" aria-label={tr(T.show, locale)}>
          <span aria-hidden="true" className="text-2xl">
            👀
          </span>
          <span className={band === 'little' ? 'sr-only' : ''}>{tr(T.show, locale)}</span>
        </motion.button>
      </div>
    </div>
  ) : null;

  const paradeStrip = (
    <div className="pointer-events-auto w-full rounded-[1.6rem] bg-white/92 p-2 shadow-[0_8px_30px_rgba(90,40,140,.2)] ring-1 ring-white">
      <div className="flex gap-1.5 overflow-x-auto overscroll-contain pb-1" data-tv-row="" data-tv-wrap="false" data-tv-stage="">
        {album.map((s, i) => (
          <motion.button
            key={s.id}
            type="button"
            onClick={() => {
              setSelected(s.id);
              setConfirmDel(false);
              g()?.paradeSelect(s.id);
              speak([s.name], 'parade-name');
            }}
            whileTap={reduce ? undefined : { scale: 0.9 }}
            data-tv-autofocus={i === 0 ? '' : undefined}
            aria-pressed={selected === s.id}
            aria-label={s.name}
            className={`relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl ${selected === s.id ? 'ring-4 ring-[#ffb35c]' : 'ring-1 ring-[#e6dcff]'}`}
            style={{ background: COLORS[s.color].hex }}
          >
            {s.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.thumb} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl" aria-hidden="true">
                👾
              </span>
            )}
          </motion.button>
        ))}
      </div>
      {selected
        ? (() => {
            const s = album.find((x) => x.id === selected);
            if (!s) return null;
            return (
              <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1.5" data-tv-row="" data-tv-wrap="false">
                <p className="w-full truncate px-1 font-display text-lg font-bold text-[#3b2a6b] sm:w-auto sm:min-w-0 sm:flex-1">{s.name}</p>
                <button type="button" onClick={() => resume(s)} aria-label={tr(T.resume, locale)} className="flex min-h-[64px] items-center gap-1 rounded-2xl bg-gradient-to-b from-[#6bdc6b] to-[#3fae3f] px-3 font-bold text-white">
                  <span aria-hidden="true" className="text-2xl">
                    ▶
                  </span>
                  <span className={band === 'little' ? 'sr-only' : 'text-sm'}>{tr(T.resume, locale)}</span>
                </button>
                <button type="button" onClick={() => renameSaved(s)} aria-label={tr(T.rename, locale)} className="grid min-h-[64px] min-w-[64px] place-items-center rounded-2xl bg-[#f3ecff] text-3xl">
                  🎲
                </button>
                <button type="button" onClick={() => removeSaved(s)} aria-label={tr(confirmDel ? T.sure : T.remove, locale)} className={`grid min-h-[64px] min-w-[64px] place-items-center rounded-2xl text-2xl ${confirmDel ? 'bg-[#ffd6de] ring-2 ring-[#ff5c7a]' : 'bg-[#f3ecff]'}`}>
                  {confirmDel ? '❓' : '🗑️'}
                </button>
              </div>
            );
          })()
        : null}
    </div>
  );

  const atelierBack = (
    <motion.button
      type="button"
      onClick={() => g()?.backToAtelier(false)}
      whileTap={reduce ? undefined : { scale: 0.9 }}
      data-tv-autofocus=""
      aria-label={tr(T.atelier, locale)}
      className="pointer-events-auto mx-auto flex min-h-[64px] items-center gap-2 rounded-full bg-white/95 px-5 font-display text-lg font-bold text-[#5b3f8f] shadow-lg ring-1 ring-white"
    >
      <span className="text-3xl" aria-hidden="true">
        🏭
      </span>
      {tr(T.atelier, locale)}
    </motion.button>
  );

  const paradeClose = (
    <button type="button" onClick={() => g()?.endParade()} aria-label={tr(T.close, locale)} className="pointer-events-auto grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/95 text-2xl font-bold text-[#7c5cff] shadow-lg">
      ✕
    </button>
  );

  return (
    <div ref={rootRef} className="fixed inset-0 z-[60] overflow-clip bg-[#cdeeff] text-[#33264a]" data-tv-scope="">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full touch-none" aria-label={tr(T.title, locale)} />

      {phase === 'play' ? (
        <>
          {/* Top: back, the name plate (tap = new name), undo, parade, music */}
          <div ref={topRef} className="pointer-events-none absolute inset-x-0 top-0 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:p-3">
            <div className="pointer-events-auto mx-auto flex w-full max-w-3xl items-center gap-1.5 rounded-full bg-white/88 p-1.5 shadow-[0_6px_24px_rgba(90,40,140,.16)] ring-1 ring-white" data-tv-row="" data-tv-wrap="false">
              <Link href="/creer" aria-label={tr(T.back, locale)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#f3ecff] text-lg font-bold text-[#5b3f8f]">
                ←
              </Link>
              <motion.button
                type="button"
                onClick={reroll}
                whileTap={reduce ? undefined : { scale: 0.94 }}
                aria-label={`${creature.name}. ${tr(T.newName, locale)}`}
                className="flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#fff4d6] to-[#ffe3f1] px-3"
              >
                <span className="line-clamp-2 break-words font-display text-[15px] font-bold leading-[1.05] text-[#6a3fd1] sm:text-xl">{creature.name}</span>
                <span className="text-xl" aria-hidden="true">
                  🎲
                </span>
              </motion.button>
              <SayButton texts={[nameLine(creature)]} locale={locale} size="md" />
              <button type="button" onClick={undo} disabled={!history.length} aria-label={tr(T.undo, locale)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#f3ecff] text-xl text-[#5b3f8f] disabled:opacity-35">
                ↩
              </button>
              <button type="button" onClick={openParade} aria-label={tr(T.parade, locale)} className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-full text-2xl ${mode === 'parade' ? 'bg-[#ffe08a]' : 'bg-[#f3ecff]'}`}>
                🎉
              </button>
              <button
                type="button"
                onClick={() => {
                  game.current?.setMusic(!music);
                  setMusic(!music);
                }}
                aria-pressed={music}
                aria-label={tr(T.music, locale)}
                className={`hidden h-12 w-12 shrink-0 place-items-center rounded-full text-lg sm:grid ${music ? 'bg-[#ffe08a]' : 'bg-[#f3ecff]'}`}
              >
                🎵
              </button>
            </div>
            {mode === 'atelier' ? challengeCard : null}
            <AnimatePresence>
              {offerVisible ? (
                <motion.button
                  key="offer"
                  type="button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={startChallenge}
                  aria-label={tr(T.offer, locale)}
                  className="pointer-events-auto ml-auto mt-2 flex min-h-[56px] items-center gap-2 rounded-full bg-white/95 py-1 pl-1 pr-4 font-bold text-[#5b3f8f] shadow-lg ring-2 ring-[#ffd166] sm:mr-[max(0px,calc((100%-48rem)/2))]"
                >
                  <ZiggyAvatar size={44} ring={false} />
                  <span className="text-2xl" aria-hidden="true">
                    💡
                  </span>
                  <span className={band === 'little' ? 'sr-only' : 'text-sm'}>{tr(T.offer, locale)}</span>
                </motion.button>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Landscape: kinds of parts on the left, actions on the right */}
          {wide && mode === 'atelier' ? (
            <div ref={leftRef} className="pointer-events-none absolute bottom-2 left-2 top-[4.75rem] flex items-center gap-2 sm:left-3">
              <div className="pointer-events-auto max-h-full overflow-y-auto overscroll-contain rounded-[1.6rem] bg-white/70 shadow-[0_8px_30px_rgba(90,40,140,.16)] ring-1 ring-white">{tabs}</div>
              <div className="pointer-events-auto max-h-full overflow-y-auto overscroll-contain rounded-[1.6rem] bg-white/85 shadow-[0_8px_30px_rgba(90,40,140,.18)] ring-1 ring-white" aria-label={tr(T.options, locale)}>
                {drawer}
              </div>
            </div>
          ) : null}
          {wide ? (
            <div ref={rightRef} className="pointer-events-auto absolute right-2 top-1/2 flex -translate-y-1/2 flex-col sm:right-3">
              {mode === 'parade' ? paradeClose : actions}
            </div>
          ) : null}

          {/* XP after a challenge */}
          <AnimatePresence>
            {xp ? (
              <motion.div
                key={xp.id}
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                className="pointer-events-none absolute right-3 top-24 rounded-full bg-gradient-to-r from-amber-300 to-pink-300 px-4 py-2 text-lg font-bold text-[#4a2350] shadow-lg sm:right-6"
                role="status"
              >
                +{xp.n} XP ⭐
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Counting along */}
          <AnimatePresence>
            {count && count.n > 0 ? (
              <motion.div
                key={count.id}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.3 }}
                transition={{ duration: reduce ? 0 : 0.2 }}
                className="pointer-events-none absolute left-1/2 top-[30%] flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/95 px-5 py-1 font-display text-5xl font-bold text-[#ff5c8a] shadow-xl"
                aria-hidden="true"
              >
                {count.i} <span className="text-4xl">{count.kind === 'legs' ? '🦵' : count.kind === 'eyes' ? '👁️' : '💪'}</span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Bottom: Ziggy's words, then the drawer (and the tabs and actions in portrait) */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-3" style={wide ? { paddingLeft: mode === 'atelier' ? '14rem' : undefined, paddingRight: '7.5rem' } : undefined}>
            <AnimatePresence>
              {toast ? (
                <motion.div
                  key={toast.id}
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  role="status"
                  className="pointer-events-none flex max-w-md items-center gap-2 rounded-3xl bg-white px-3 py-2 text-sm font-bold shadow-xl ring-2 ring-[#e6dcff] sm:text-base"
                >
                  <ZiggyAvatar size={32} ring={false} />
                  <span>{toast.text}</span>
                </motion.div>
              ) : null}
            </AnimatePresence>
            <div ref={bottomRef} className="pointer-events-auto flex w-full max-w-3xl flex-col items-center gap-2">
              {mode === 'alive' ? atelierBack : null}
              {mode === 'parade' ? (
                <div className="flex w-full items-end gap-2">
                  <div className="min-w-0 flex-1">{paradeStrip}</div>
                  {!wide ? paradeClose : null}
                </div>
              ) : null}
              {mode === 'atelier' ? (
                <>
                  {!wide ? actions : null}
                  {!wide ? (
                    <div className="w-full rounded-[1.6rem] bg-white/80 p-1.5 shadow-[0_8px_30px_rgba(90,40,140,.18)] ring-1 ring-white" aria-label={tr(T.options, locale)}>
                      {drawer}
                      <div className="mt-1.5 border-t border-[#efe7ff] pt-0.5">{tabs}</div>
                    </div>
                  ) : null}
                </>
              ) : null}
              {mode === 'alive' && !wide ? <div className="w-full">{actions}</div> : null}
            </div>
          </div>
        </>
      ) : null}

      {/* The photo, framed, with the colouring page for grown-ups */}
      <AnimatePresence>
        {photo ? (
          <motion.div key="photo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-10 flex items-center justify-center bg-[#3b2a6b]/45 p-3" role="dialog" aria-modal="true" aria-label={tr(T.photo, locale)}>
            <motion.div initial={reduce ? undefined : { scale: 0.85, rotate: -3 }} animate={{ scale: 1, rotate: 0 }} className="flex max-h-full w-full max-w-sm flex-col items-center gap-2 overflow-y-auto rounded-[2rem] bg-white p-3 shadow-2xl">
              {photo.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.url} alt={photo.name} className="max-h-[52vh] w-auto rounded-2xl object-contain shadow" />
              ) : null}
              <p className="text-center font-display text-lg font-bold text-[#6a3fd1]">
                🎉 {photo.name} {tr(T.joins, locale)}
              </p>
              <button ref={okRef} type="button" onClick={() => setPhoto(null)} data-tv-autofocus="" className="min-h-[64px] w-full rounded-full bg-gradient-to-r from-[#ff8ab3] to-[#ff4f8b] px-6 font-display text-xl font-bold text-white shadow-lg">
                ✓ {tr(T.ok, locale)}
              </button>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#8a6ab8]">{tr(T.grownups, locale)}</p>
              <div className="flex w-full gap-2">
                <button type="button" onClick={() => void savePhoto()} className="flex min-h-[56px] flex-1 items-center justify-center gap-1 rounded-2xl bg-[#f3ecff] px-2 text-sm font-bold text-[#5b3f8f]">
                  💾 {tr(T.save, locale)}
                </button>
                <button type="button" onClick={() => void printColoring()} className="flex min-h-[56px] flex-1 items-center justify-center gap-1 rounded-2xl bg-[#f3ecff] px-2 text-sm font-bold text-[#5b3f8f]">
                  🖍️ {tr(T.coloring, locale)}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {flash ? <div className="pointer-events-none absolute inset-0 z-20 bg-white/80" aria-hidden="true" /> : null}

      {/* Loading (no menu: straight into the factory) */}
      {phase === 'loading' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#9fdcff] via-[#ffe9f4] to-[#fff1c9] p-6 text-center">
          <motion.div animate={reduce ? undefined : { y: [0, -10, 0], rotate: [0, -4, 4, 0] }} transition={{ duration: 2.4, repeat: Infinity }} aria-hidden="true">
            <ZiggyAvatar size={112} />
          </motion.div>
          <h1 className="font-display text-3xl font-bold text-[#4a2a8a] sm:text-5xl">{tr(T.title, locale)}</h1>
          {supported ? (
            <p className="flex items-center gap-2 text-lg font-semibold text-[#6b4a9a]">
              <span className="inline-block animate-spin" aria-hidden="true">
                ⚙️
              </span>
              {tr(T.loading, locale)}
            </p>
          ) : (
            <p className="rounded-2xl bg-white/90 px-4 py-3 font-semibold">{tr(T.noWebgl, locale)}</p>
          )}
          <Link href="/creer" className="text-sm font-semibold text-[#6b4a9a] underline">
            ← {tr(T.back, locale)}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
