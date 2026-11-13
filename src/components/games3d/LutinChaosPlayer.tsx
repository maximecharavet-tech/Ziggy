'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { Link } from '@/i18n/navigation';
import { GameHost } from '@/components/games3d/engine/GameHost';
import type { GameHost as Host } from '@/games3d/engine/host';
import type { SayRequest } from '@/games3d/engine/events';
import type { ChaosCommands, ChaosEvents, ChaosHud, FinaleHud, PrankHud, SandboxHud, Who } from '@/games3d/lutin-chaos/ChaosGame';
import { ChaosAudio } from '@/games3d/lutin-chaos/sfx';
import {
  COLORS,
  ELF_IDS,
  GAME_TITLE,
  ROOMS,
  ROOM_IDS,
  SAVE_KEY,
  SHAPES,
  UI,
  elfName,
  openRooms,
  parseSave,
  playSeed,
  recordRoomDone,
  roomById,
  saveLayout,
  saveProgress,
  serializeSave,
  wordById,
  type Band,
  type ChaosAction,
  type ChaosSave,
  type ElfId,
  type Puzzle,
} from '@/games3d/lutin-chaos/logic';
import { getMemory, useHydrated } from '@/lib/world/store';
import { readAloudOn } from '@/lib/world/memory';
import { finishExtraGame } from '@/lib/world/play';
import type { MagicMoment } from '@/lib/world/engine';
import { speakSequence, stopSpeaking, unlockAudio } from '@/lib/voice';
import { isMuted } from '@/lib/sound';
import { lutinsStore, nightKey } from '@/lib/lutins/family';
import { tr, type L } from '@/lib/i18n-text';
import { SayButton } from '@/components/arcade/read-aloud';
import { MagicMoments, MomentChips } from '@/components/world/MagicMoments';
import { MascotCutout, ZiggyAvatar } from '@/components/ziggy/Mascot';
import { ElfAvatar } from '@/components/lutins/ElfAvatar';

/**
 * Lutin Chaos (« Le Grand Chahut des Lutins ») player: the DOM HUD over the
 * 3D game (`src/games3d/lutin-chaos/ChaosGame.ts`). Everything a child reads
 * is also spoken (speech queue + 🔊), every answer is a big button, and the
 * game state comes from the logic reducer through the game's `hud` events.
 * Saves stay on the device (localStorage). Results go to World Memory.
 */

type Fix<K extends Puzzle['fix']> = Extract<Puzzle, { fix: K }>;
type CountBackPuzzle = Fix<'count-back'>;
type SortPuzzle = Fix<'sort'>;
type PairPuzzle = Fix<'pair'>;
type OrderPuzzle = Fix<'order'>;
type PatternPuzzle = Fix<'pattern'>;
type PlacePuzzle = Fix<'place'>;
type PathPuzzle = Fix<'path'>;
type RotatePuzzle = Fix<'rotate'>;
type NameItPuzzle = Fix<'name-it'>;
type ClockPuzzle = Fix<'clock'>;

const T = {
  title: GAME_TITLE,
  teaser: {
    fr: 'Les lutins sont en visite chez Ziggy… et ils font des farces partout ! Trouve qui a fait le coup, attrape-les avec des chatouilles et répare tout en riant.',
    en: 'The elves are visiting Ziggy’s house… and pranking everywhere! Find who did it, catch them with a tickle and fix everything while laughing.',
  },
  how: { fr: 'Touche ce qui est rigolo, trouve le lutin, chatouille-le, puis répare avec Ziggy !', en: 'Tap what looks silly, find the elf, tickle them, then fix it with Ziggy!' },
  play: { fr: 'On joue !', en: 'Let’s play!' },
  loading: { fr: 'Les lutins se cachent…', en: 'The elves are hiding…' },
  back: { fr: 'Retour', en: 'Back' },
  music: { fr: 'Musique', en: 'Music' },
  house: { fr: 'La maison', en: 'The house' },
  age: { fr: 'Âge', en: 'Age' },
  ages: { little: { fr: '4–6 ans', en: '4–6' }, middle: { fr: '7–9 ans', en: '7–9' }, big: { fr: '10–12 ans', en: '10–12' } } as Record<Band, L>,
  pickRoom: { fr: 'Choisis une pièce de la maison !', en: 'Pick a room of the house!' },
  panLeft: { fr: 'Regarder à gauche', en: 'Look left' },
  panRight: { fr: 'Regarder à droite', en: 'Look right' },
  done: { fr: 'Fini', en: 'Done' },
  newRoom: { fr: 'Nouveau', en: 'New' },
  continue: { fr: 'On continue', en: 'Continue' },
  sandbox: UI.sandbox,
  album: UI.album,
  costumes: { fr: 'Les déguisements de Ziggy', en: 'Ziggy’s costumes' },
  noCostume: { fr: 'Sans déguisement', en: 'No costume' },
  photoMode: { fr: 'Mode photo', en: 'Photo mode' },
  snap: { fr: 'Clic ! La photo', en: 'Click! Take the photo' },
  photoBtn: { fr: 'Tout le monde sourit : la photo !', en: 'Everybody smile: photo!' },
  close: { fr: 'Fermer', en: 'Close' },
  emptyAlbum: { fr: 'Finis une pièce pour coller ta première photo !', en: 'Finish a room to stick in your first photo!' },
  whoDidIt: UI.whoDidIt,
  clues: { fr: 'Les indices', en: 'The clues' },
  notes: { fr: 'Mon carnet de détective', en: 'My detective notebook' },
  notesHelp: { fr: 'Touche une case pour barrer un lutin.', en: 'Tap a square to cross an elf out.' },
  tickle: { fr: 'Chatouille', en: 'Tickle' },
  whereHiding: { fr: 'Touche sa cachette… ou chatouille-le s’il dépasse !', en: 'Tap the hiding place… or tickle the elf if you can see them!' },
  findPranks: UI.findPranks,
  pranksLeft: { fr: 'farces', en: 'pranks' },
  magnifier: UI.magnifier,
  team: { fr: 'L’équipe des réparateurs', en: 'The fix-it team' },
  turn: { fr: 'Tourner', en: 'Turn' },
  ok: { fr: 'C’est bon !', en: 'Done!' },
  restart: { fr: 'Recommencer', en: 'Start again' },
  hour: { fr: 'Heures', en: 'Hours' },
  minute: { fr: 'Minutes', en: 'Minutes' },
  together: UI.showMe,
  finaleWatch: UI.finaleWatch,
  finaleRewind: UI.finaleRewind,
  finalePredict: UI.finalePredict,
  roomDone: UI.roomFixed,
  another: UI.anotherRoom,
  seeYou: UI.seeYou,
  sandboxPick: { fr: 'Choisis un lutin, puis touche une cachette dans la pièce.', en: 'Pick an elf, then tap a hiding place in the room.' },
  sandboxPranks: { fr: 'Prépare des farces', en: 'Set up pranks' },
  sandboxGo: UI.sandboxGo,
  sandboxLook: { fr: 'Cherche, Ziggy !', en: 'Look, Ziggy!' },
  warmer: UI.warmer,
  colder: UI.colder,
  again: { fr: 'On recommence !', en: 'Again!' },
  sandboxRooms: { fr: 'Dans quelle pièce veux-tu jouer aux farces ?', en: 'Which room do you want to prank?' },
  sandboxLocked: { fr: 'Finis une pièce pour ouvrir la Maison des Farces.', en: 'Finish a room to open the Prank House.' },
  placed: { fr: 'caché', en: 'hidden' },
  poses: { fr: 'Touche un personnage pour changer sa pose.', en: 'Tap a character to change their pose.' },
  noWebgl: { fr: 'Ce jeu en 3D a besoin de WebGL, qui n’est pas disponible sur cet appareil.', en: 'This 3D game needs WebGL, which this device does not support.' },
  oops: { fr: 'Oups, la maison des lutins fait la sieste. Réessaie !', en: 'Oops, the elves’ house is napping. Try again!' },
  tonight: { fr: 'Farce de cette nuit !', en: 'Last night’s prank!' },
  xp: { fr: 'XP', en: 'XP' },
} as const;

const ELF_BG: Record<ElfId, string> = { pepin: '#d8f5d0', grelotte: '#e6dcff', noisette: '#f6e3cc' };
const ACCESSORIES = ['scarf', 'beret', 'crown', 'nightcap', 'santa'] as const;
type Accessory = 'none' | (typeof ACCESSORIES)[number];
const ACC_ICON: Record<Accessory, string> = { none: '🙂', scarf: '🧣', beret: '🎨', crown: '👑', nightcap: '🌙', santa: '🎅' };
const ACC_LABEL: Record<Accessory, L> = {
  none: T.noCostume,
  scarf: { fr: 'L’écharpe', en: 'The scarf' },
  beret: { fr: 'Le béret', en: 'The beret' },
  crown: { fr: 'La couronne', en: 'The crown' },
  nightcap: { fr: 'Le bonnet de nuit', en: 'The nightcap' },
  santa: { fr: 'Le bonnet du Père Noël', en: 'Santa’s hat' },
};
const ROOM_ICON: Record<number, string> = { 1: '🥾', 2: '🍪', 3: '🎄', 4: '🦆', 5: '🧸', 6: '🧱', 7: '📚', 8: '🥁', 9: '⛄', 10: '🔨', 11: '🎂', 12: '🐴', 13: '📦', 14: '🛷', 15: '🎅' };

const THUMBS_KEY = 'ziggy:game:lutin-chaos:thumbs:v1';
const PREFS_KEY = 'ziggy:game:lutin-chaos:prefs:v1';
type Thumb = { id: string; roomId: string; src: string };

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota: keep going in memory */
  }
}
function loadSave(): ChaosSave {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    raw = null;
  }
  const s = parseSave(raw, (Math.random() * 2 ** 31) >>> 0);
  return s;
}
function storeSave(s: ChaosSave) {
  try {
    localStorage.setItem(SAVE_KEY, serializeSave(s));
  } catch {
    /* device storage unavailable: the game still plays */
  }
}

function webglOk() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const accessoryOfRoom = (roomId: string): Accessory => ACCESSORIES[((roomById(roomId)?.number ?? 1) - 1) % ACCESSORIES.length];

/** Colour-blind safe swatch: colour + pattern. */
function swatch(colorId: string): CSSProperties {
  const c = COLORS.find((x) => x.id === colorId);
  const hex = c?.hex ?? '#cccccc';
  const w = 'rgba(255,255,255,.75)';
  const bg: Record<string, string> = {
    dots: `radial-gradient(${w} 22%, transparent 24%) 0 0/14px 14px`,
    stripes: `repeating-linear-gradient(45deg, ${w} 0 4px, transparent 4px 10px)`,
    waves: `radial-gradient(circle at 50% 0, transparent 40%, ${w} 42% 52%, transparent 54%) 0 0/16px 10px`,
    zigzag: `linear-gradient(135deg, ${w} 25%, transparent 25%) -6px 0/12px 12px, linear-gradient(225deg, ${w} 25%, transparent 25%) -6px 0/12px 12px`,
    stars: `radial-gradient(${w} 18%, transparent 20%) 0 0/12px 12px, radial-gradient(${w} 12%, transparent 14%) 6px 6px/12px 12px`,
    checks: `conic-gradient(${w} 25%, transparent 0 50%, ${w} 0 75%, transparent 0) 0 0/14px 14px`,
    hearts: `radial-gradient(${w} 20%, transparent 22%) 0 0/16px 16px`,
    plain: 'none',
  };
  return { background: `${bg[c?.pattern ?? 'plain']}, ${hex}`, backgroundColor: hex };
}

// ---------------------------------------------------------------------------
// Small pieces

function Face({ who, size = 44, className = '' }: { who: string; size?: number; className?: string }) {
  if (who === 'ziggy' || !ELF_IDS.includes(who as ElfId)) return <ZiggyAvatar size={size} ring={false} className={className} />;
  return (
    <span className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full ring-2 ring-white ${className}`} style={{ width: size, height: size, background: ELF_BG[who as ElfId] }} aria-hidden="true">
      <ElfAvatar id={who} className="h-full w-full object-cover" />
    </span>
  );
}

function Btn({ children, onClick, className = '', disabled, tv, label, pressed, style, testid }: { children: ReactNode; onClick: () => void; className?: string; disabled?: boolean; tv?: boolean; label?: string; pressed?: boolean; style?: CSSProperties; testid?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      whileTap={reduce || disabled ? undefined : { scale: 0.92 }}
      onClick={() => {
        unlockAudio();
        onClick();
      }}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      data-tv-autofocus={tv ? '' : undefined}
      data-testid={testid}
      style={style}
      className={`min-h-[64px] min-w-[64px] rounded-2xl font-bold shadow-sm ring-1 transition disabled:opacity-40 ${className}`}
    >
      {children}
    </motion.button>
  );
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`pointer-events-auto w-full max-w-3xl rounded-[1.75rem] bg-white/94 p-2.5 shadow-[0_8px_30px_rgba(60,30,90,.25)] ring-1 ring-white sm:p-3 ${className}`} data-tv-stage="">
      {children}
    </div>
  );
}

function Prompt({ text, locale, sub }: { text: string; locale: string; sub?: ReactNode }) {
  return (
    <div className="mb-2 flex items-start gap-2">
      <p className="flex-1 text-base font-bold leading-snug text-[#3b2a52] sm:text-lg">{text}</p>
      {sub}
      <SayButton texts={[text]} locale={locale} size="sm" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Puzzles (the 10 fix mechanics)

type Answer = (a: unknown) => void;
type Reveal = { reveal?: unknown; focus: string[] } | null;

function wordPic(id: string | null | undefined) {
  return (id && wordById(id)?.emoji) || '⭐';
}
function wordName(id: string, locale: string) {
  const w = wordById(id);
  return w ? (locale === 'fr' ? w.fr : w.en) : id;
}

function CountPuzzle({ p, answer, reveal }: { p: CountBackPuzzle; answer: Answer; reveal: Reveal }) {
  const emoji = wordPic(p.item);
  const n = p.numbers;
  const show = (k: number, faded = false) => (
    <span className={`flex flex-wrap justify-center gap-0.5 ${faded ? 'opacity-35' : ''}`} aria-hidden="true">
      {Array.from({ length: Math.min(k, 30) }, (_, i) => (
        <span key={i} className="text-2xl leading-none sm:text-3xl">
          {emoji}
        </span>
      ))}
    </span>
  );
  let picture: ReactNode = null;
  if (p.mode === 'back' && n.total <= 10) picture = show(n.total);
  else if (p.mode === 'add') picture = <span className="font-display text-3xl font-bold text-[#4a2a62]">{n.a} + {n.b} = ?</span>;
  else if (p.mode === 'left') picture = <span className="font-display text-3xl font-bold text-[#4a2a62]">{n.total} − {n.done} = ?</span>;
  else if (p.mode === 'groups') picture = <span className="font-display text-3xl font-bold text-[#4a2a62]">{n.groups} × {n.size} = ?</span>;
  else if (p.mode === 'extra') picture = <span className="font-display text-3xl font-bold text-[#4a2a62]">{n.total} − {n.need} = ?</span>;
  else if (p.mode === 'half') picture = <span className="font-display text-3xl font-bold text-[#4a2a62]">½ × {n.total} = ?</span>;
  else if (p.mode === 'quarter') picture = <span className="font-display text-3xl font-bold text-[#4a2a62]">¼ × {n.total} = ?</span>;
  else if (p.mode === 'share-fair') picture = <span className="font-display text-3xl font-bold text-[#4a2a62]">{n.total} ÷ {n.plates} = ?</span>;
  return (
    <div>
      <div className="mb-2 flex min-h-[48px] items-center justify-center rounded-2xl bg-[#fff6e8] p-2">{picture}</div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-tv-row="">
        {p.choices.map((c, i) => (
          <Btn key={c} tv={i === 0} onClick={() => answer(c)} testid={`answer-${c}`} className={`bg-gradient-to-b from-[#fff3d6] to-[#ffe0a8] font-display text-4xl text-[#4a2a12] ring-[#f3c98a] ${reveal?.reveal === c ? 'ring-4 ring-[#3fae3f]' : ''}`}>
            <span data-reveal={reveal?.reveal === c ? '1' : undefined}>{c}</span>
          </Btn>
        ))}
      </div>
    </div>
  );
}

function ItemChip({ color, shape, word, size, side, shadow, pattern }: { color: string; shape?: string; word?: string | null; size?: 'small' | 'big'; side?: 'left' | 'right' | null; shadow?: boolean; pattern?: string }) {
  const icon = word ? wordPic(word) : (SHAPES.find((s) => s.id === shape)?.icon ?? '●');
  const st = shadow ? { background: '#4a4058' } : swatch(color);
  return (
    <span className="relative grid h-full w-full place-items-center rounded-xl" style={st}>
      <span className={`${size === 'small' ? 'text-xl' : 'text-3xl'} leading-none ${shadow ? 'opacity-0' : ''} ${word ? '' : 'text-white drop-shadow'}`} style={side === 'left' ? { transform: 'scaleX(-1)' } : undefined} aria-hidden="true">
        {icon}
      </span>
      {shadow && word ? (
        <span className="absolute text-3xl leading-none" style={{ filter: 'brightness(0)', opacity: 0.85 }} aria-hidden="true">
          {wordPic(word)}
        </span>
      ) : null}
      {side ? <span className="absolute bottom-0.5 rounded-full bg-white/90 px-1.5 text-[11px] font-black text-[#3b2a52]">{side === 'left' ? 'G·L' : 'D·R'}</span> : null}
      {pattern && pattern !== 'plain' ? <span className="sr-only">{pattern}</span> : null}
    </span>
  );
}

function SortPuzzleView({ p, answer, reveal, locale }: { p: SortPuzzle; answer: Answer; reveal: Reveal; locale: string }) {
  const [pick, setPick] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const sol = reveal?.reveal;
  if (p.mode === 'odd-one-out')
    return (
      <div className="grid grid-cols-5 gap-2" data-tv-row="">
        {p.items.map((it, i) => (
          <Btn key={it.id} tv={i === 0} onClick={() => answer(it.id)} testid={`item-${it.id}`} label={`${i + 1}`} className={`aspect-square bg-white p-1 ring-[#e5d7f5] ${sol === it.id || reveal?.focus.includes(it.id) ? 'ring-4 ring-[#3fae3f]' : ''}`}>
            <span data-reveal={sol === it.id ? '1' : undefined} className="block h-full w-full">
              <ItemChip color={it.color} shape={it.shape} word={it.word} size={it.size} />
            </span>
          </Btn>
        ))}
      </div>
    );
  const left = p.items.filter((it) => !placed[it.id]);
  const drop = (bin: string) => {
    if (!pick) return;
    const next = { ...placed, [pick]: bin };
    setPlaced(next);
    setPick(null);
    if (Object.keys(next).length === p.items.length) {
      answer(next);
      setPlaced({});
    }
  };
  const solMap = typeof sol === 'object' && sol ? (sol as Record<string, string>) : null;
  return (
    <div>
      <div className="mb-2 flex min-h-[72px] flex-wrap justify-center gap-2" data-tv-row="">
        {left.map((it, i) => (
          <Btn key={it.id} tv={i === 0} pressed={pick === it.id} onClick={() => setPick(it.id)} testid={`item-${it.id}`} className={`h-[68px] w-[68px] bg-white p-1 ${pick === it.id ? 'ring-4 ring-[#ffb35c]' : 'ring-[#e5d7f5]'} ${reveal?.focus.includes(it.id) ? 'ring-4 ring-[#3fae3f]' : ''}`}>
            <span className="block h-full w-full" data-solution={solMap ? solMap[it.id] : undefined}>
              <ItemChip color={it.color} shape={it.shape} word={it.word} size={it.size} />
            </span>
          </Btn>
        ))}
      </div>
      <div className={`grid gap-2 ${p.bins.length > 2 ? 'grid-cols-2' : 'grid-cols-2'}`} data-tv-row="">
        {p.bins.map((b) => (
          <Btn key={b.id} onClick={() => drop(b.id)} disabled={!pick} testid={`bin-${b.id}`} className="flex min-h-[80px] flex-col items-center justify-center gap-1 bg-[#fff6e8] px-2 ring-[#f3c98a]">
            <span className="text-2xl leading-none" aria-hidden="true">
              🧺 {b.icon}
            </span>
            <span className="text-xs font-bold text-[#6b4a2a]">{tr(b.label, locale)}</span>
            <span className="flex gap-0.5">
              {p.items
                .filter((it) => placed[it.id] === b.id)
                .map((it) => (
                  <span key={it.id} className="h-5 w-5 rounded" style={swatch(it.color)} />
                ))}
            </span>
          </Btn>
        ))}
      </div>
    </div>
  );
}

function PairPuzzleView({ p, answer, reveal }: { p: PairPuzzle; answer: Answer; reveal: Reveal }) {
  const [first, setFirst] = useState<string | null>(null);
  const [pairs, setPairs] = useState<[string, string][]>([]);
  const used = new Set(pairs.flat());
  const solPairs = Array.isArray(reveal?.reveal) ? (reveal!.reveal as [string, string][]) : null;
  const partnerOf = (id: string) => solPairs?.find((x) => x.includes(id))?.find((y) => y !== id);
  const tap = (id: string) => {
    if (used.has(id)) {
      setPairs(pairs.filter((x) => !x.includes(id)));
      return;
    }
    if (!first) return setFirst(id);
    if (first === id) return setFirst(null);
    const next = [...pairs, [first, id] as [string, string]];
    setPairs(next);
    setFirst(null);
    if (next.length * 2 === p.items.length) {
      answer(next);
      setPairs([]);
    }
  };
  const pairIndex = (id: string) => pairs.findIndex((x) => x.includes(id));
  const RING = ['#ff5c8a', '#3fae3f', '#3f7fe0', '#f08c00', '#7950f2'];
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" data-tv-row="">
      {p.items.map((it, i) => {
        const k = pairIndex(it.id);
        return (
          <Btn
            key={it.id}
            tv={i === 0}
            pressed={first === it.id || k >= 0}
            onClick={() => tap(it.id)}
            testid={`item-${it.id}`}
            style={k >= 0 ? { boxShadow: `0 0 0 4px ${RING[k % RING.length]}` } : undefined}
            className={`aspect-square bg-white p-1 ${first === it.id ? 'ring-4 ring-[#ffb35c]' : 'ring-[#e5d7f5]'} ${reveal?.focus.includes(it.id) ? 'outline outline-4 outline-[#3fae3f]' : ''}`}
          >
            <span className="block h-full w-full" data-partner={partnerOf(it.id)}>
              <ItemChip color={it.color} word={it.word} side={it.side} shadow={it.shadow} pattern={it.pattern} />
            </span>
          </Btn>
        );
      })}
    </div>
  );
}

function OrderPuzzleView({ p, answer, reveal, locale }: { p: OrderPuzzle; answer: Answer; reveal: Reveal; locale: string }) {
  const [seq, setSeq] = useState<string[]>([]);
  const sol = Array.isArray(reveal?.reveal) ? (reveal!.reveal as string[]) : null;
  const tap = (id: string) => {
    if (seq.includes(id)) return setSeq(seq.filter((x) => x !== id));
    const next = [...seq, id];
    setSeq(next);
    if (next.length === p.items.length) {
      answer(next);
      setSeq([]);
    }
  };
  const sizeEm = (v: number) => 1.1 + v * 0.38;
  return (
    <div>
      <div className="mb-2 flex min-h-[56px] items-end justify-center gap-1.5 rounded-2xl bg-[#fff6e8] p-2">
        {seq.map((id, i) => {
          const it = p.items.find((x) => x.id === id)!;
          return (
            <span key={id} className="grid min-w-10 place-items-center rounded-xl bg-white px-1.5 py-1 font-display text-lg font-bold text-[#4a2a62] shadow">
              <span className="text-[10px] text-[#9a7ab8]">{i + 1}</span>
              {p.by === 'size' ? <span style={{ fontSize: `${sizeEm(it.value) * 0.7}rem` }}>{wordPic(p.item)}</span> : tr(it.label, locale)}
            </span>
          );
        })}
      </div>
      <div className="flex flex-wrap justify-center gap-2" data-tv-row="">
        {p.items.map((it, i) => (
          <Btn key={it.id} tv={i === 0} pressed={seq.includes(it.id)} onClick={() => tap(it.id)} testid={`item-${it.id}`} label={tr(it.label, locale)} className={`flex min-w-[76px] flex-col items-center justify-end bg-white px-2 pb-1 ring-[#e5d7f5] ${seq.includes(it.id) ? 'opacity-40' : ''} ${reveal?.focus.includes(it.id) ? 'ring-4 ring-[#3fae3f]' : ''}`}>
            {p.by === 'size' ? (
              <span className="leading-none" style={{ fontSize: `${sizeEm(it.value)}rem` }} aria-hidden="true">
                {wordPic(p.item)}
              </span>
            ) : (
              <span className="font-display text-2xl text-[#4a2a62]">{tr(it.label, locale)}</span>
            )}
            {sol ? <span className="text-xs text-[#3fae3f]" data-reveal-index={sol.indexOf(it.id) + 1}>{sol.indexOf(it.id) + 1}</span> : null}
          </Btn>
        ))}
      </div>
    </div>
  );
}

const NOTE_ICON: Record<string, string> = { high: '🔔', mid: '🎵', low: '🥁' };
function Token({ t, theme }: { t: string; theme: PatternPuzzle['theme'] }) {
  if (theme === 'numbers') return <span className="font-display text-2xl font-bold text-[#4a2a62]">{t}</span>;
  if (theme === 'notes') return <span className="text-3xl leading-none">{NOTE_ICON[t] ?? '🎵'}</span>;
  if (theme === 'shapes') return <span className="text-3xl leading-none text-[#7950f2]">{SHAPES.find((s) => s.id === t)?.icon ?? '●'}</span>;
  return <span className="block h-9 w-9 rounded-full ring-2 ring-white" style={swatch(t)} />;
}

function PatternPuzzleView({ p, answer, reveal }: { p: PatternPuzzle; answer: Answer; reveal: Reveal }) {
  const [fill, setFill] = useState<string[]>([]);
  const sol = Array.isArray(reveal?.reveal) ? (reveal!.reveal as string[]) : null;
  const tap = (t: string) => {
    const next = [...fill, t];
    setFill(next);
    if (next.length === p.blanks.length) {
      answer(next);
      setFill([]);
    }
  };
  let b = 0;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-center gap-1 rounded-2xl bg-[#fff6e8] p-2">
        {p.sequence.map((t, i) => {
          if (t !== null)
            return (
              <span key={i} className="grid h-11 w-11 place-items-center">
                <Token t={t} theme={p.theme} />
              </span>
            );
          const v = fill[b++];
          return (
            <span key={i} className="grid h-11 w-11 place-items-center rounded-full border-2 border-dashed border-[#ffb35c] bg-white">
              {v ? <Token t={v} theme={p.theme} /> : <span className="font-bold text-[#ffb35c]">?</span>}
            </span>
          );
        })}
      </div>
      <div className="flex flex-wrap justify-center gap-2" data-tv-row="">
        {p.choices.map((c, i) => (
          <Btn key={c} tv={i === 0} onClick={() => tap(c)} testid={`choice-${c}`} label={c} className={`grid h-[68px] w-[68px] place-items-center bg-white ring-[#e5d7f5] ${sol?.[fill.length] === c ? 'ring-4 ring-[#3fae3f]' : ''}`}>
            <span data-reveal={sol?.[fill.length] === c ? '1' : undefined}>
              <Token t={c} theme={p.theme} />
            </span>
          </Btn>
        ))}
      </div>
    </div>
  );
}

const REL_ICON: Record<string, string> = { in: '📥', on: '⬆️', under: '⬇️', left: '⬅️', right: '➡️', behind: '🔙', front: '🔜' };
const REL_L: Record<string, L> = {
  in: { fr: 'dans', en: 'in' },
  on: { fr: 'sur', en: 'on' },
  under: { fr: 'sous', en: 'under' },
  left: { fr: 'à gauche', en: 'left' },
  right: { fr: 'à droite', en: 'right' },
  behind: { fr: 'derrière', en: 'behind' },
  front: { fr: 'devant', en: 'in front' },
};

function PlacePuzzleView({ p, answer, reveal, locale }: { p: PlacePuzzle; answer: Answer; reveal: Reveal; locale: string }) {
  const sol = reveal?.reveal;
  if (p.anchorCell) {
    const cells: string[] = [];
    for (let y = 2; y >= 0; y--) for (let x = 0; x < 3; x++) cells.push(`${x},${y}`);
    return (
      <div className="mx-auto grid max-w-xs grid-cols-3 gap-1.5 rounded-2xl bg-[#c9965e] p-2" data-tv-row="">
        {cells.map((c) => {
          const anchor = c === `${p.anchorCell![0]},${p.anchorCell![1]}`;
          return anchor ? (
            <span key={c} className="grid min-h-[64px] place-items-center rounded-xl bg-[#fff1df] text-3xl">
              {wordPic(p.anchor)}
            </span>
          ) : (
            <Btn key={c} onClick={() => answer(c)} testid={`cell-${c}`} className={`bg-[#fff8ee] text-2xl ring-[#f3dcc0] ${sol === c ? 'ring-4 ring-[#3fae3f]' : ''}`}>
              <span data-reveal={sol === c ? '1' : undefined} className="opacity-30">
                {wordPic(p.item)}
              </span>
            </Btn>
          );
        })}
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-center gap-3 text-4xl" aria-hidden="true">
        <span>{wordPic(p.item)}</span>
        <span className="text-2xl">→</span>
        <span>{wordPic(p.anchor)}</span>
      </div>
      <div className={`grid gap-2 ${p.options.length > 3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`} data-tv-row="">
        {p.options.map((o, i) => (
          <Btn key={o} tv={i === 0} onClick={() => answer(o)} testid={`rel-${o}`} className={`flex flex-col items-center justify-center bg-[#fff8ee] ring-[#f3dcc0] ${sol === o ? 'ring-4 ring-[#3fae3f]' : ''}`}>
            <span className="text-3xl" aria-hidden="true" data-reveal={sol === o ? '1' : undefined}>
              {REL_ICON[o] ?? '📍'}
            </span>
            <span className="text-sm text-[#6b4a2a]">{tr(REL_L[o] ?? { fr: o, en: o }, locale)}</span>
          </Btn>
        ))}
      </div>
    </div>
  );
}

const DIR_ICON: Record<string, string> = { up: '⬆️', down: '⬇️', left: '⬅️', right: '➡️' };
function PathPuzzleView({ p, answer, reveal }: { p: PathPuzzle; answer: Answer; reveal: Reveal }) {
  const sol = reveal?.reveal;
  const rows: number[] = [];
  for (let y = p.size - 1; y >= 0; y--) rows.push(y);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-[#fff6e8] p-2 text-2xl" aria-hidden="true">
        👣
        {p.steps.map((s, i) => (
          <span key={i} className="flex items-center gap-0.5 rounded-xl bg-white px-1.5 py-0.5 font-display text-lg font-bold text-[#4a2a62] shadow-sm">
            {s.n > 1 ? s.n : ''}
            {DIR_ICON[s.dir]}
          </span>
        ))}
      </div>
      <div className="mx-auto grid max-w-sm gap-1" style={{ gridTemplateColumns: `${p.coords ? '22px ' : ''}repeat(${p.size}, minmax(0,1fr))` }} data-tv-row="">
        {rows.map((y) => (
          <div key={y} className="contents">
            {p.coords ? <span className="grid place-items-center text-xs font-bold text-[#8a6aa8]">{y + 1}</span> : null}
            {Array.from({ length: p.size }, (_, x) => {
              const id = `${x},${y}`;
              const start = x === p.start[0] && y === p.start[1];
              return (
                <Btn key={id} onClick={() => answer(id)} testid={`cell-${id}`} className={`aspect-square min-h-[56px] min-w-[56px] text-2xl ring-[#d9e8c9] ${start ? 'bg-[#ffe9a8]' : 'bg-[#eef8e6]'} ${sol === id || reveal?.focus.includes(id) ? 'ring-4 ring-[#3fae3f]' : ''}`}>
                  <span data-reveal={sol === id ? '1' : undefined}>{start ? '👣' : ''}</span>
                </Btn>
              );
            })}
          </div>
        ))}
        {p.coords ? (
          <>
            <span />
            {Array.from({ length: p.size }, (_, x) => (
              <span key={x} className="text-center text-xs font-bold text-[#8a6aa8]">
                {'ABCDE'[x]}
              </span>
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}

function Cells({ cells, size = 70 }: { cells: [number, number][]; size?: number }) {
  const mx = Math.max(...cells.map((c) => c[0])) + 1;
  const my = Math.max(...cells.map((c) => c[1])) + 1;
  const k = size / Math.max(mx, my, 3);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {cells.map(([x, y], i) => (
        <rect key={i} x={x * k + (size - mx * k) / 2} y={(my - 1 - y) * k + (size - my * k) / 2} width={k - 2} height={k - 2} rx={3} fill="#7950f2" />
      ))}
    </svg>
  );
}

function RotatePuzzleView({ p, answer, reveal, locale }: { p: RotatePuzzle; answer: Answer; reveal: Reveal; locale: string }) {
  const [taps, setTaps] = useState(0);
  const reduce = useReducedMotion();
  if (p.mode === 'match' && p.shape)
    return (
      <div>
        <div className="mb-2 flex justify-center rounded-2xl bg-[#fff6e8] p-2">
          <Cells cells={p.shape} size={84} />
        </div>
        <div className="grid grid-cols-4 gap-2" data-tv-row="">
          {p.options.map((o, i) => (
            <Btn key={o.id} tv={i === 0} onClick={() => answer(o.id)} testid={`option-${o.id}`} className={`grid place-items-center bg-white p-1 ring-[#e5d7f5] ${reveal?.reveal === o.id ? 'ring-4 ring-[#3fae3f]' : ''}`}>
              <span data-reveal={reveal?.reveal === o.id ? '1' : undefined}>
                <Cells cells={o.cells} />
              </span>
            </Btn>
          ))}
        </div>
      </div>
    );
  const angle = ((p.startRot + taps) % 4) * 90;
  return (
    <div className="flex items-center justify-center gap-3">
      <motion.span className="grid h-24 w-24 place-items-center rounded-3xl bg-[#fff6e8] text-6xl" animate={{ rotate: angle }} transition={{ duration: reduce ? 0 : 0.3 }} aria-hidden="true">
        {wordPic(p.item)}
      </motion.span>
      <div className="flex flex-col gap-2">
        <Btn tv onClick={() => setTaps(taps + 1)} testid="rotate-turn" className="bg-[#e6dcff] px-4 text-xl text-[#4a2a62] ring-[#cbb8f5]">
          ↻ {tr(T.turn, locale)}
        </Btn>
        <Btn
          onClick={() => {
            answer(taps % 4);
            setTaps(0);
          }}
          testid="rotate-ok"
          className={`bg-gradient-to-r from-[#4cc9b7] to-[#2fa596] px-4 text-xl text-white ring-[#2fa596] ${typeof reveal?.reveal === 'number' ? 'ring-4 ring-[#3fae3f]' : ''}`}
        >
          ✓ {tr(T.ok, locale)}
          {typeof reveal?.reveal === 'number' ? <span className="ml-1 text-sm" data-reveal-taps={String(reveal.reveal)}>({String(reveal.reveal)}↻)</span> : null}
        </Btn>
      </div>
    </div>
  );
}

function NamePuzzleView({ p, answer, reveal, locale, band }: { p: NameItPuzzle; answer: Answer; reveal: Reveal; locale: string; band: Band }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-tv-row="">
      {p.choices.map((c, i) => (
        <Btn key={c} tv={i === 0} onClick={() => answer(c)} testid={`word-${c}`} label={wordName(c, locale)} className={`flex flex-col items-center justify-center bg-white py-1 ring-[#e5d7f5] ${reveal?.reveal === c ? 'ring-4 ring-[#3fae3f]' : ''}`}>
          <span className="text-4xl leading-none" aria-hidden="true" data-reveal={reveal?.reveal === c ? '1' : undefined}>
            {wordPic(c)}
          </span>
          {band !== 'little' && !p.secondLanguage ? <span className="text-xs text-[#6b4a2a]">{wordName(c, locale)}</span> : null}
        </Btn>
      ))}
    </div>
  );
}

function ClockFace({ time, size = 76 }: { time: string; size?: number }) {
  const [h, m] = time.split(':').map(Number);
  const r = size / 2;
  const ha = (((h % 12) + m / 60) / 12) * Math.PI * 2;
  const ma = (m / 60) * Math.PI * 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={r} cy={r} r={r - 3} fill="#fff8ee" stroke="#a0612b" strokeWidth={4} />
      {Array.from({ length: 12 }, (_, i) => (
        <circle key={i} cx={r + Math.sin((i / 12) * 6.283) * (r - 9)} cy={r - Math.cos((i / 12) * 6.283) * (r - 9)} r={i % 3 ? 1.6 : 2.8} fill="#6b4226" />
      ))}
      <line x1={r} y1={r} x2={r + Math.sin(ha) * r * 0.48} y2={r - Math.cos(ha) * r * 0.48} stroke="#3b2a22" strokeWidth={5} strokeLinecap="round" />
      <line x1={r} y1={r} x2={r + Math.sin(ma) * r * 0.75} y2={r - Math.cos(ma) * r * 0.75} stroke="#e2453c" strokeWidth={3} strokeLinecap="round" />
      <circle cx={r} cy={r} r={3.5} fill="#3b2a22" />
    </svg>
  );
}

function ClockPuzzleView({ p, answer, reveal, locale }: { p: ClockPuzzle; answer: Answer; reveal: Reveal; locale: string }) {
  const [start] = useState(() => p.shown.split(':').map(Number));
  const [h, setH] = useState(start[0]);
  const [m, setM] = useState(start[1]);
  if (p.options.length)
    return (
      <div className="grid grid-cols-3 gap-2" data-tv-row="">
        {p.options.map((o, i) => (
          <Btn key={o} tv={i === 0} onClick={() => answer(o)} testid={`clock-${o}`} label={o} className={`grid place-items-center bg-white p-1 ring-[#e5d7f5] ${reveal?.reveal === o ? 'ring-4 ring-[#3fae3f]' : ''}`}>
            <span data-reveal={reveal?.reveal === o ? '1' : undefined}>
              <ClockFace time={o} />
            </span>
          </Btn>
        ))}
      </div>
    );
  const step = p.band === 'middle' ? 15 : 5;
  const time = `${h}:${String(m).padStart(2, '0')}`;
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <ClockFace time={time} size={110} />
      <div className="grid grid-cols-2 gap-2">
        <span className="col-span-2 text-center font-display text-3xl font-bold text-[#4a2a62]">{time}</span>
        <Btn tv onClick={() => setH(((h % 12) + 1) as number)} testid="clock-h" className="bg-[#fff1df] px-3 ring-[#f3dcc0]">
          +1 {tr(T.hour, locale)}
        </Btn>
        <Btn onClick={() => setM((m + step) % 60)} testid="clock-m" className="bg-[#ffe3e3] px-3 ring-[#f5c2c2]">
          +{step} {tr(T.minute, locale)}
        </Btn>
        <Btn onClick={() => answer(time)} testid="clock-ok" className="col-span-2 bg-gradient-to-r from-[#4cc9b7] to-[#2fa596] text-xl text-white ring-[#2fa596]">
          ✓ {tr(T.ok, locale)}
          {typeof reveal?.reveal === 'string' ? <span className="ml-1 text-sm" data-reveal-time={reveal.reveal as string}>({reveal.reveal as string})</span> : null}
        </Btn>
      </div>
    </div>
  );
}

function PuzzleView({ p, answer, reveal, locale, band }: { p: Puzzle; answer: Answer; reveal: Reveal; locale: string; band: Band }) {
  switch (p.fix) {
    case 'count-back':
      return <CountPuzzle p={p} answer={answer} reveal={reveal} />;
    case 'sort':
      return <SortPuzzleView p={p} answer={answer} reveal={reveal} locale={locale} />;
    case 'pair':
      return <PairPuzzleView p={p} answer={answer} reveal={reveal} />;
    case 'order':
      return <OrderPuzzleView p={p} answer={answer} reveal={reveal} locale={locale} />;
    case 'pattern':
      return <PatternPuzzleView p={p} answer={answer} reveal={reveal} />;
    case 'place':
      return <PlacePuzzleView p={p} answer={answer} reveal={reveal} locale={locale} />;
    case 'path':
      return <PathPuzzleView p={p} answer={answer} reveal={reveal} />;
    case 'rotate':
      return <RotatePuzzleView p={p} answer={answer} reveal={reveal} locale={locale} />;
    case 'name-it':
      return <NamePuzzleView p={p} answer={answer} reveal={reveal} locale={locale} band={band} />;
    case 'clock':
      return <ClockPuzzleView p={p} answer={answer} reveal={reveal} locale={locale} />;
  }
}

// ---------------------------------------------------------------------------
// The player

type Bubble = { who: string; text: string; id: number };

export function LutinChaosPlayer() {
  const raw = useLocale();
  const locale = raw === 'fr' ? 'fr' : 'en';
  const hydrated = useHydrated();
  const reduce = useReducedMotion();
  const hostRef = useRef<Host<ChaosEvents, ChaosCommands> | null>(null);
  const [phase, setPhase] = useState<'intro' | 'play'>('intro');
  const [supported, setSupported] = useState(true);
  const [failed, setFailed] = useState(false);
  const [hud, setHud] = useState<ChaosHud | null>(null);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [music, setMusic] = useState(true);
  const [band, setBand] = useState<Band>('middle');
  const [save, setSave] = useState<ChaosSave | null>(null);
  const [costume, setCostume] = useState<Accessory>('none');
  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  const [overlay, setOverlay] = useState<null | 'album' | 'costumes' | 'sandbox-rooms'>(null);
  const [result, setResult] = useState<{ xp: number; magic: MagicMoment[]; roomId: string; photo: string | null } | null>(null);
  const [notes, setNotes] = useState<Record<string, boolean>>({});
  const [flash, setFlash] = useState(0);
  const saveRef = useRef<ChaosSave | null>(null);
  const startedAt = useRef(0);
  const audio = useMemo(() => (typeof window === 'undefined' ? undefined : new ChaosAudio()), []);

  const [portal, setPortal] = useState(false);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    setSupported(webglOk());
    setPortal(true);
    const fit = () => setNarrow(window.innerWidth < window.innerHeight);
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const s = loadSave();
    saveRef.current = s;
    setSave(s);
    storeSave(s);
    setThumbs(readJson<Thumb[]>(THUMBS_KEY, []));
    const prefs = readJson<{ costume?: Accessory }>(PREFS_KEY, {});
    if (prefs.costume && (prefs.costume === 'none' || ACCESSORIES.includes(prefs.costume as (typeof ACCESSORIES)[number]))) setCostume(prefs.costume);
    const age = getMemory().age;
    setBand(age === 'little' || age === 'big' || age === 'middle' ? age : 'middle');
  }, [hydrated]);

  const commit = useCallback((next: ChaosSave) => {
    saveRef.current = next;
    setSave(next);
    storeSave(next);
  }, []);

  const houseState = useCallback(() => {
    const s = saveRef.current ?? loadSave();
    const now = new Date();
    const christmasEve = now.getMonth() === 11 && now.getDate() >= 24;
    const open = openRooms(s, ROOM_IDS, { christmasEve });
    const done = ROOM_IDS.filter((id) => s.rooms[id]?.done);
    return { open, done };
  }, []);

  const cmd = useCallback((c: Parameters<Host<ChaosEvents, ChaosCommands>['command']>[0]) => hostRef.current?.command(c), []);

  // ---- speech queue (every line is shown, and spoken when read-aloud is on)
  const queue = useRef<{ who: string; text: string }[]>([]);
  const speaking = useRef(false);
  const flushTimer = useRef<number | null>(null);
  const gen = useRef(0);
  const pump = useCallback(() => {
    if (speaking.current || !queue.current.length) return;
    const batch = queue.current.splice(0, 6);
    const mine = gen.current;
    speaking.current = true;
    const show = (i: number) => {
      const item = batch[i];
      if (!item) return;
      setBubble({ who: item.who, text: item.text, id: Date.now() + i });
      cmd({ type: 'talking', who: item.who, seconds: Math.min(4, 0.6 + item.text.length * 0.05) });
    };
    const done = () => {
      if (mine !== gen.current) return;
      speaking.current = false;
      cmd({ type: 'talking', who: null, seconds: 0 });
      if (queue.current.length) window.setTimeout(pump, 120);
    };
    if (readAloudOn(getMemory()) && !isMuted()) {
      void speakSequence(
        `chaos-${Date.now()}`,
        batch.map((b) => b.text),
        locale,
        show
      ).then(done);
    } else {
      let i = 0;
      const step = () => {
        if (mine !== gen.current) return;
        if (i >= batch.length) return done();
        show(i);
        const ms = 1300 + batch[i].text.length * 38;
        i++;
        window.setTimeout(step, ms);
      };
      step();
    }
  }, [cmd, locale]);
  const enqueue = useCallback(
    (who: string, text: string) => {
      if (!text) return;
      const last = queue.current[queue.current.length - 1];
      if (last && last.text === text) return;
      queue.current.push({ who, text });
      if (queue.current.length > 10) queue.current.splice(0, queue.current.length - 10);
      if (flushTimer.current) window.clearTimeout(flushTimer.current);
      flushTimer.current = window.setTimeout(pump, 30);
    },
    [pump]
  );
  const hush = useCallback(() => {
    gen.current++;
    queue.current = [];
    speaking.current = false;
    stopSpeaking();
    setBubble(null);
  }, []);
  useEffect(() => {
    if (!bubble) return;
    const t = window.setTimeout(() => setBubble((b) => (b?.id === bubble.id ? null : b)), Math.min(9000, 3200 + bubble.text.length * 50));
    return () => window.clearTimeout(t);
  }, [bubble]);
  useEffect(
    () => () => {
      stopSpeaking();
    },
    []
  );

  // speak each new puzzle prompt and each new finale step
  const lastPuzzle = useRef<string | null>(null);
  useEffect(() => {
    const key = hud?.puzzle ? `${hud.puzzle.prank}` : null;
    if (key && key !== lastPuzzle.current && hud?.puzzle) enqueue('ziggy', tr(hud.puzzle.puzzle.prompt, locale));
    lastPuzzle.current = key;
    if (!hud?.puzzle) setNotes({});
  }, [hud?.puzzle, enqueue, locale]);

  // ---- game events
  // GameHost always calls the latest handler (no stale closure)
  const onEvent = (name: keyof ChaosEvents, payload: ChaosEvents[keyof ChaosEvents]) => {
      switch (name) {
        case 'hud':
          setHud(payload as ChaosHud);
          break;
        case 'say': {
          const r = payload as SayRequest;
          for (const l of r.lines) enqueue(r.who, tr(l, locale));
          break;
        }
        case 'pick': {
          const { roomId } = payload as ChaosEvents['pick'];
          openRoom(roomId);
          break;
        }
        case 'progress': {
          const s = saveRef.current;
          if (s) commit(saveProgress(s, payload as ChaosEvents['progress']));
          break;
        }
        case 'roomDone': {
          const { result: r, seed, photo } = payload as ChaosEvents['roomDone'];
          setFlash((n) => n + 1);
          const o = finishExtraGame('lutin-chaos', r.skill, { correct: r.pranksFixed, mistakes: r.hints, total: r.pranksFixed }, Math.max(1000, Date.now() - startedAt.current));
          const s = saveRef.current;
          if (s) commit(recordRoomDone(s, r, seed));
          if (photo) {
            const next = [{ id: `${r.roomId}:${seed}`, roomId: r.roomId, src: photo }, ...readJson<Thumb[]>(THUMBS_KEY, [])].slice(0, 24);
            writeJson(THUMBS_KEY, next);
            setThumbs(next);
          }
          setResult({ xp: o.xpGained, magic: o.magic, roomId: r.roomId, photo });
          break;
        }
        case 'layout': {
          const s = saveRef.current;
          if (s) commit(saveLayout(s, payload as ChaosEvents['layout']));
          break;
        }
        case 'snapshot': {
          const { roomId, photo } = payload as ChaosEvents['snapshot'];
          setFlash((n) => n + 1);
          const next = [{ id: `snap:${Date.now()}`, roomId, src: photo }, ...readJson<Thumb[]>(THUMBS_KEY, [])].slice(0, 24);
          writeJson(THUMBS_KEY, next);
          setThumbs(next);
          break;
        }
      }
  };

  // ---- navigation
  const openRoom = (roomId: string) => {
    const s = saveRef.current ?? loadSave();
    const plays = s.rooms[roomId]?.plays ?? 0;
    const resume = s.current && s.current.roomId === roomId && s.current.band === band ? s.current : null;
    let night: string | null = null;
    try {
      const plan = lutinsStore.get().plan;
      night = plan[nightKey(new Date(Date.now() - 86400000))] ?? null;
    } catch {
      night = null;
    }
    setResult(null);
    setOverlay(null);
    startedAt.current = Date.now();
    hush();
    cmd({ type: 'open', roomId, band, seed: resume?.seed ?? playSeed(roomId, plays, s.salt), night: resume?.night ?? night, resume, costume });
  };
  const goHouse = () => {
    setResult(null);
    setOverlay(null);
    hush();
    cmd({ type: 'house', ...houseState(), costume });
  };
  const openSandbox = (roomId: string) => {
    const s = saveRef.current;
    const layout = s?.sandbox.filter((l) => l.roomId === roomId).at(-1) ?? null;
    setOverlay(null);
    setResult(null);
    cmd({ type: 'sandbox', roomId, seed: (Math.random() * 1e9) >>> 0, layout, costume });
  };
  const openPhoto = (roomId: string) => {
    setOverlay(null);
    setResult(null);
    cmd({ type: 'photoMode', roomId, costume });
  };
  const pickCostume = (a: Accessory) => {
    setCostume(a);
    writeJson(PREFS_KEY, { costume: a });
    setOverlay(null);
  };

  const start = () => {
    unlockAudio();
    setFailed(false);
    setPhase('play');
  };

  const def = useMemo(() => {
    const hs = hydrated ? houseState() : { open: [], done: [] };
    return () => import('@/games3d/lutin-chaos/ChaosGame').then((m) => m.createChaosGame({ ...hs, costume }));
    // the game is created once per "play"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === 'play']);

  const act = (action: ChaosAction) => cmd({ type: 'act', action });

  // tell the scene how much the HUD covers, so the room and Ziggy stay in view
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasHud = Boolean(hud);
  useEffect(() => {
    if (phase !== 'play' || !hasHud) return;
    const measure = () => {
      const b = bottomRef.current?.getBoundingClientRect();
      cmd({ type: 'insets', top: 60, bottom: b && b.height > 0 ? window.innerHeight - b.top : 0 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (bottomRef.current) ro.observe(bottomRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [phase, hasHud, cmd]);

  // TV: land on the panel's first button when the panel changes
  const rootRef = useRef<HTMLDivElement>(null);
  const panelKey = `${hud?.view}-${hud?.phase}-${hud?.puzzle?.prank ?? ''}-${hud?.active ?? ''}-${hud?.finale?.phase ?? ''}-${overlay ?? ''}-${result ? 1 : 0}`;
  useEffect(() => {
    if (!document.documentElement.hasAttribute('data-tv')) return;
    const a = document.activeElement;
    if (a && a !== document.body && a.isConnected) return;
    rootRef.current?.querySelector<HTMLElement>('[data-tv-autofocus]:not(:disabled)')?.focus({ preventScroll: true });
  }, [panelKey]);

  // ---- derived
  const done = save ? ROOM_IDS.filter((id) => save.rooms[id]?.done) : [];
  const openList = hydrated && save ? houseState().open : [];
  const earned: Accessory[] = ['none', ...ACCESSORIES.filter((a) => done.some((id) => accessoryOfRoom(id) === a))];
  const active: PrankHud | null = hud?.pranks.find((p) => p.id === hud.active && (p.phase === 'spotted' || p.phase === 'found')) ?? hud?.pranks.find((p) => p.phase === 'spotted' || p.phase === 'found') ?? null;
  const fixedCount = hud?.pranks.filter((p) => p.phase === 'fixed').length ?? 0;

  // ---- render helpers
  const renderTop = () => (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:p-3">
      <div className="pointer-events-auto mx-auto flex w-full max-w-3xl items-center gap-1.5 rounded-full bg-white/90 p-1.5 shadow-[0_6px_24px_rgba(60,30,90,.18)] ring-1 ring-white" data-tv-row="">
        {hud?.view === 'house' || !hud ? (
          <Link href="/lutins/jeux" aria-label={tr(T.back, locale)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f3ecff] text-lg font-bold text-[#5b3f8f]">
            ←
          </Link>
        ) : (
          <button type="button" onClick={goHouse} aria-label={tr(T.house, locale)} data-testid="to-house" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f3ecff] text-xl">
            🏠
          </button>
        )}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
          {hud?.view === 'room' && hud.phase === 'pranks' ? (
            <span className="flex items-center gap-0.5" aria-label={`${fixedCount} / ${hud.pranks.length} ${tr(T.pranksLeft, locale)}`}>
              {hud.pranks.map((p) => (
                <span key={p.id} className={`grid h-8 w-8 place-items-center rounded-full text-base sm:h-9 sm:w-9 ${p.phase === 'fixed' ? 'bg-[#d8f5d0]' : p.id === active?.id ? 'bg-[#ffe08a]' : 'bg-[#f6efe6]'}`} aria-hidden="true">
                  {p.phase === 'fixed' ? '✅' : p.phase === 'hidden' ? '❓' : p.icon}
                </span>
              ))}
            </span>
          ) : (
            <span className="truncate px-1 font-display text-base font-bold text-[#4a2a62] sm:text-lg">{tr(hud?.view === 'house' || !hud ? T.title : hud.title, locale)}</span>
          )}
        </div>
        {hud?.team.length ? (
          <span className="hidden items-center -space-x-2 sm:flex" aria-label={tr(T.team, locale)}>
            {hud.team.map((e) => (
              <Face key={e} who={e} size={32} />
            ))}
          </span>
        ) : null}
        {hud?.view === 'room' && hud.phase === 'pranks' ? (
          <button type="button" onClick={() => act({ type: 'magnifier' })} aria-label={tr(T.magnifier, locale)} data-testid="magnifier" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fff3d6] text-xl">
            🔍
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            cmd({ type: 'music', on: !music });
            setMusic(!music);
          }}
          aria-pressed={music}
          aria-label={tr(T.music, locale)}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg ${music ? 'bg-[#ffe08a]' : 'bg-[#f6efe6]'}`}
        >
          🎵
        </button>
      </div>
    </div>
  );

  const renderHouse = () => (
    <Panel>
      <Prompt text={tr(T.pickRoom, locale)} locale={locale} />
      <div className="grid max-h-[34vh] grid-cols-3 gap-1.5 overflow-y-auto sm:grid-cols-5" data-tv-row="">
        {ROOMS.filter((r) => openList.includes(r.id)).map((r, i) => {
          const isDone = done.includes(r.id);
          const resumable = save?.current?.roomId === r.id;
          return (
            <Btn key={r.id} tv={i === 0} onClick={() => openRoom(r.id)} testid={`room-${r.id}`} label={tr(r.title, locale)} className={`relative flex flex-col items-center justify-center gap-0.5 px-1 py-1 ring-[#e5d7f5] ${isDone ? 'bg-[#eaf8e4]' : 'bg-[#fff8ee]'}`}>
              <span className="text-2xl leading-none" aria-hidden="true">
                {ROOM_ICON[r.number]}
              </span>
              <span className="line-clamp-2 text-[11px] leading-tight text-[#4a2a62] sm:text-xs">{tr(r.title, locale)}</span>
              <span className="absolute -right-1 -top-1 rounded-full bg-white px-1 text-[10px] shadow" aria-hidden="true">
                {isDone ? '🚩' : resumable ? '▶️' : '✨'}
              </span>
            </Btn>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5" data-tv-row="">
        <Btn onClick={() => setOverlay('sandbox-rooms')} testid="open-sandbox" className="flex items-center justify-center gap-1 bg-[#ffe9f2] px-2 text-sm text-[#8a2a5a] ring-[#f5c2d8]">
          🎭 <span className="line-clamp-2">{tr(T.sandbox, locale)}</span>
        </Btn>
        <Btn onClick={() => setOverlay('album')} testid="open-album" className="flex items-center justify-center gap-1 bg-[#e8f3ff] px-2 text-sm text-[#2a4a8a] ring-[#bcd6f5]">
          📷 <span className="line-clamp-2">{tr(T.album, locale)}</span>
        </Btn>
        <Btn onClick={() => setOverlay('costumes')} testid="open-costumes" className="flex items-center justify-center gap-1 bg-[#fff3d6] px-2 text-sm text-[#6b4a12] ring-[#f3c98a]">
          {ACC_ICON[costume]} <span className="line-clamp-2">{tr(T.costumes, locale)}</span>
        </Btn>
      </div>
    </Panel>
  );

  const renderNaming = (p: PrankHud) => {
    const out = new Set(p.eliminated.map((e) => e.elf));
    return (
      <Panel>
        <Prompt text={tr(T.whoDidIt, locale)} locale={locale} />
        <div className="mb-2 flex flex-wrap gap-1.5">
          {p.clues.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5 rounded-2xl bg-[#fff6e8] px-2 py-1 text-sm font-bold text-[#4a2a12] ring-1 ring-[#f3dcc0]">
              <span className="text-xl" aria-hidden="true">
                {c.icon}
              </span>
              {c.pattern ? <span className="h-4 w-4 rounded" style={{ background: c.pattern === 'stripes' ? 'repeating-linear-gradient(45deg,#e03131 0 3px,#fff 3px 6px)' : c.pattern === 'dots' ? 'radial-gradient(#fff 30%, #8e5527 32%) 0 0/6px 6px' : 'repeating-linear-gradient(135deg,#3a9d4f 0 3px,#e9ac2c 3px 6px)' }} aria-hidden="true" /> : null}
              <span>{tr(c.label, locale)}</span>
              <SayButton texts={[tr(c.label, locale)]} locale={locale} size="sm" />
            </span>
          ))}
        </div>
        {hud?.band === 'big' && p.clues.length > 1 ? (
          <div className="mb-2 overflow-x-auto rounded-2xl bg-[#f7f3ff] p-1.5">
            <p className="px-1 text-xs font-bold text-[#6b4a8a]">
              📓 {tr(T.notes, locale)} · <span className="font-semibold">{tr(T.notesHelp, locale)}</span>
            </p>
            <table className="w-full text-center text-sm">
              <thead>
                <tr>
                  <th />
                  {ELF_IDS.map((e) => (
                    <th key={e} className="px-1">
                      <Face who={e} size={28} className="mx-auto" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.clues.map((c) => (
                  <tr key={c.id}>
                    <td className="text-left text-lg" aria-label={tr(c.label, locale)}>
                      {c.icon}
                    </td>
                    {ELF_IDS.map((e) => {
                      const k = `${p.id}:${c.id}:${e}`;
                      return (
                        <td key={e} className="p-0.5">
                          <button type="button" onClick={() => setNotes((n) => ({ ...n, [k]: !n[k] }))} aria-pressed={Boolean(notes[k])} aria-label={`${tr(elfName(e), locale)} · ${tr(c.label, locale)}`} className="h-10 w-full min-w-[44px] rounded-lg bg-white text-xl font-black text-[#e2453c] ring-1 ring-[#e5d7f5]">
                            {notes[k] ? '✗' : ''}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <div className="grid grid-cols-3 gap-2" data-tv-row="">
          {ELF_IDS.map((e, i) => {
            const why = p.eliminated.find((x) => x.elf === e)?.reason;
            return (
              <Btn key={e} tv={i === 0} disabled={out.has(e)} onClick={() => act({ type: 'name-elf', prank: p.id, elf: e })} testid={`name-${e}`} label={tr(elfName(e), locale)} className="flex flex-col items-center justify-center gap-0.5 py-1.5 ring-[#e5d7f5]" style={{ background: ELF_BG[e] }}>
                <Face who={e} size={52} />
                <span className="text-sm text-[#3b2a52]">{tr(elfName(e), locale)}</span>
                {why ? <span className="line-clamp-2 px-1 text-[10px] font-semibold leading-tight text-[#6b4a8a]">{tr(why, locale)}</span> : null}
              </Btn>
            );
          })}
        </div>
      </Panel>
    );
  };

  const renderFound = (p: PrankHud) => (
    <Panel>
      <Prompt text={tr(T.whereHiding, locale)} locale={locale} />
      {p.culprit ? (
        <div className="grid grid-cols-1 gap-2">
          <Btn tv onClick={() => act({ type: 'tickle', prank: p.id })} testid="tickle" className="flex items-center justify-center gap-3 bg-gradient-to-r from-[#ff9fc4] to-[#ff7ab8] text-xl text-white ring-[#ff7ab8]" disabled={!p.peeking}>
            <Face who={p.culprit} size={50} />
            🤭 {tr(T.tickle, locale)} {tr(elfName(p.culprit), locale)} !
          </Btn>
        </div>
      ) : null}
    </Panel>
  );

  const renderPuzzle = () => {
    const pz = hud?.puzzle;
    if (!pz) return null;
    const reveal: Reveal = pz.hint ? { reveal: pz.hint.reveal, focus: pz.hint.focus } : null;
    return (
      <Panel className="max-h-[62vh] overflow-y-auto">
        <div className="mb-1 flex items-center gap-2">
          <Face who={pz.elf} size={40} />
          <Prompt text={tr(pz.puzzle.prompt, locale)} locale={locale} />
        </div>
        {pz.hint ? (
          <p className="mb-2 rounded-2xl bg-[#eaf8e4] px-3 py-1.5 text-sm font-bold text-[#2f6b2a]" role="status">
            💡 {tr(pz.hint.hint, locale)}
          </p>
        ) : null}
        <PuzzleView key={`${pz.prank}-${pz.tries}`} p={pz.puzzle} reveal={reveal} locale={locale} band={hud!.band} answer={(a) => act({ type: 'answer', prank: pz.prank, answer: a })} />
      </Panel>
    );
  };

  const renderFinale = (f: FinaleHud) => {
    if (f.phase === 'watch') return <Panel><Prompt text={tr(T.finaleWatch, locale)} locale={locale} /></Panel>;
    if (f.phase === 'predict')
      return (
        <Panel>
          <Prompt text={tr(T.finalePredict, locale)} locale={locale} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" data-tv-row="">
            {f.options.map((o, i) => (
              <Btn key={o} tv={i === 0} onClick={() => act({ type: 'finale-predict', step: o })} testid={`predict-${o}`} className="bg-[#fff8ee] px-2 text-base text-[#4a2a12] ring-[#f3dcc0]">
                {tr(f.steps.find((s) => s.id === o)?.label ?? { fr: o, en: o }, locale)}
              </Btn>
            ))}
          </div>
        </Panel>
      );
    if (f.phase === 'rewind')
      return (
        <Panel>
          <Prompt text={tr(T.finaleRewind, locale)} locale={locale} />
          <div className="flex flex-wrap justify-center gap-1.5" data-tv-row="">
            {f.steps.map((s, i) => {
              const undone = f.undone.includes(s.id);
              return (
                <Btn key={s.id} tv={i === f.steps.length - 1} disabled={undone} onClick={() => act({ type: 'finale-tap', step: s.id })} testid={`step-btn-${s.id}`} className={`flex min-w-[96px] max-w-[160px] flex-1 flex-col items-center px-2 py-1 text-xs ring-[#e5d7f5] ${f.glow === s.id ? 'bg-[#dfffe8] ring-4 ring-[#3fae3f]' : 'bg-white'}`}>
                  <span className="font-display text-lg text-[#9a7ab8]">{i + 1}</span>
                  <span className="text-[#3b2a52]">{tr(s.label, locale)}</span>
                  {undone ? <span aria-hidden="true">⏪✅</span> : null}
                </Btn>
              );
            })}
          </div>
        </Panel>
      );
    return null;
  };

  const renderSandbox = (sb: SandboxHud) => {
    if (sb.phase === 'setup')
      return (
        <Panel>
          <Prompt text={tr(T.sandboxPick, locale)} locale={locale} />
          <div className="grid grid-cols-3 gap-2" data-tv-row="">
            {ELF_IDS.map((e, i) => (
              <Btn key={e} tv={i === 0} pressed={sb.selected === e} onClick={() => cmd({ type: 'sandboxPick', elf: e })} testid={`sb-elf-${e}`} className={`flex flex-col items-center py-1 ${sb.selected === e ? 'ring-4 ring-[#ffb35c]' : 'ring-[#e5d7f5]'}`} style={{ background: ELF_BG[e] }}>
                <Face who={e} size={44} />
                <span className="text-xs text-[#3b2a52]">
                  {tr(elfName(e), locale)}
                  {sb.elves[e] ? ` · ${tr(T.placed, locale)} ✓` : ''}
                </span>
              </Btn>
            ))}
          </div>
          <p className="mt-2 px-1 text-xs font-bold text-[#6b4a8a]">🎈 {tr(T.sandboxPranks, locale)}</p>
          <div className="mt-1 flex gap-1.5 overflow-x-auto pb-1" data-tv-row="">
            {sb.pranks.map((p) => {
              const added = sb.added.find((a) => a.id === p.id);
              return (
                <Btn
                  key={p.id}
                  pressed={Boolean(added)}
                  onClick={() => {
                    const room = hud?.roomId ? roomById(hud.roomId) : undefined;
                    const rp = room?.pranks.find((x) => x.id === p.id);
                    if (!rp) return;
                    if (added) cmd({ type: 'sandboxAct', action: { type: 'remove-prank', id: added.sid } });
                    else cmd({ type: 'sandboxAct', action: { type: 'add-prank', prankType: rp.type, params: rp.params } });
                  }}
                  testid={`sb-prank-${p.id}`}
                  className={`flex min-w-[120px] max-w-[150px] shrink-0 items-center gap-1 px-2 text-left text-[11px] leading-tight ${added ? 'bg-[#ffe9f2] ring-4 ring-[#ff7ab8]' : 'bg-white ring-[#e5d7f5]'}`}
                >
                  <span className="text-xl" aria-hidden="true">
                    {p.icon}
                  </span>
                  <span className="line-clamp-3">{tr(p.label, locale)}</span>
                </Btn>
              );
            })}
          </div>
          <Btn onClick={() => cmd({ type: 'sandboxAct', action: { type: 'go' } })} disabled={!Object.keys(sb.elves).length} testid="sb-go" className="mt-2 w-full bg-gradient-to-r from-[#ff8a3d] to-[#ec4a3f] text-lg text-white ring-[#ec4a3f]">
            🔎 {tr(T.sandboxGo, locale)}
          </Btn>
        </Panel>
      );
    if (sb.phase === 'seeking')
      return (
        <Panel>
          <div className="grid grid-cols-3 gap-2" data-tv-row="">
            <Btn tv onClick={() => cmd({ type: 'sandboxAct', action: { type: 'hint', hint: 'warmer' } })} testid="sb-warmer" className="bg-[#ffe3d6] text-base text-[#8a3a1a] ring-[#f5c2a8]">
              🔥 {tr(T.warmer, locale)}
            </Btn>
            <Btn onClick={() => cmd({ type: 'sandboxAct', action: { type: 'ziggy-look' } })} testid="sb-look" className="bg-[#e8f3ff] text-base text-[#2a4a8a] ring-[#bcd6f5]">
              👀 {tr(T.sandboxLook, locale)}
            </Btn>
            <Btn onClick={() => cmd({ type: 'sandboxAct', action: { type: 'hint', hint: 'colder' } })} testid="sb-colder" className="bg-[#dff2ff] text-base text-[#1a5a8a] ring-[#a8d8f5]">
              ❄️ {tr(T.colder, locale)}
            </Btn>
          </div>
        </Panel>
      );
    return (
      <Panel>
        <Btn tv onClick={() => cmd({ type: 'sandboxAct', action: { type: 'again' } })} testid="sb-again" className="w-full bg-gradient-to-r from-[#ff8a3d] to-[#ec4a3f] text-lg text-white ring-[#ec4a3f]">
          🔁 {tr(T.again, locale)}
        </Btn>
      </Panel>
    );
  };

  const renderPhoto = () => (
    <Panel>
      <Prompt text={tr(T.poses, locale)} locale={locale} />
      <div className="grid grid-cols-4 gap-1.5" data-tv-row="">
        {(['ziggy', ...ELF_IDS] as Who[]).map((w, i) => (
          <Btn key={w} tv={i === 0} onClick={() => cmd({ type: 'photoPose', who: w })} testid={`pose-${w}`} label={w === 'ziggy' ? 'Ziggy' : tr(elfName(w as ElfId), locale)} className="grid place-items-center bg-white ring-[#e5d7f5]">
            <Face who={w} size={44} />
          </Btn>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5 overflow-x-auto" data-tv-row="">
        {earned.map((a) => (
          <Btn
            key={a}
            pressed={costume === a}
            onClick={() => {
              pickCostume(a);
              if (hud?.roomId) cmd({ type: 'photoMode', roomId: hud.roomId, costume: a });
            }}
            label={tr(ACC_LABEL[a], locale)}
            className={`shrink-0 px-3 text-2xl ${costume === a ? 'bg-[#fff1c2] ring-4 ring-[#ffb35c]' : 'bg-[#fff8ee] ring-[#f3dcc0]'}`}
          >
            {ACC_ICON[a]}
          </Btn>
        ))}
      </div>
      <Btn onClick={() => cmd({ type: 'snap' })} testid="snap" className="mt-2 w-full bg-gradient-to-r from-[#4cc9b7] to-[#2fa596] text-lg text-white ring-[#2fa596]">
        📸 {tr(T.snap, locale)}
      </Btn>
    </Panel>
  );

  const renderResult = () => {
    if (!result) return null;
    const room = roomById(result.roomId);
    return (
      <div className="absolute inset-0 z-10 flex items-end justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="pointer-events-auto w-full max-w-md rounded-[2rem] bg-white/95 p-4 text-center shadow-2xl ring-1 ring-white" role="dialog" aria-modal="true" aria-labelledby="chaos-done">
          {result.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={result.photo} alt="" className="mx-auto mb-2 w-full max-w-[300px] rotate-[-2deg] rounded-xl border-[6px] border-white shadow-lg" />
          ) : null}
          <h2 id="chaos-done" className="font-display text-2xl font-bold text-[#4a2a62]">
            {ROOM_ICON[room?.number ?? 1]} {tr(T.roomDone, locale)}
          </h2>
          <p className="mt-1 flex items-center justify-center gap-2 text-sm font-semibold text-[#6b4a8a]">
            {tr(UI.nap, locale)} <SayButton texts={[tr(T.roomDone, locale), tr(UI.nap, locale)]} locale={locale} size="sm" />
          </p>
          <p className="mt-1 text-lg font-bold text-[#d0662a]">+{result.xp} {tr(T.xp, locale)} ⭐</p>
          <div className="mt-2">
            <MomentChips moments={result.magic} locale={locale} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2" data-tv-row="">
            <Btn tv onClick={goHouse} testid="another-room" className="bg-gradient-to-r from-[#ff8a3d] to-[#ec4a3f] text-base text-white ring-[#ec4a3f]">
              🏠 {tr(T.another, locale)}
            </Btn>
            <Link href="/lutins/jeux" className="grid min-h-[64px] place-items-center rounded-2xl bg-[#f3ecff] text-base font-bold text-[#5b3f8f] ring-1 ring-[#e0d4ff]">
              👋 {tr(T.seeYou, locale)}
            </Link>
            <Btn onClick={() => openPhoto(result.roomId)} testid="photo-mode" className="bg-[#e8f3ff] text-sm text-[#2a4a8a] ring-[#bcd6f5]">
              📸 {tr(T.photoMode, locale)}
            </Btn>
            <Btn onClick={() => openSandbox(result.roomId)} testid="result-sandbox" className="bg-[#ffe9f2] text-sm text-[#8a2a5a] ring-[#f5c2d8]">
              🎭 {tr(T.sandbox, locale)}
            </Btn>
          </div>
          <MagicMoments key={result.roomId} moments={result.magic} locale={locale} />
        </motion.div>
      </div>
    );
  };

  const renderOverlay = () => {
    if (!overlay) return null;
    let body: ReactNode = null;
    let title: L = T.album;
    if (overlay === 'album') {
      title = T.album;
      body = thumbs.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {thumbs.map((t, i) => (
            <figure key={t.id} className={`rounded-xl bg-white p-1.5 shadow ${i % 2 ? 'rotate-1' : '-rotate-1'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.src} alt={tr(roomById(t.roomId)?.title ?? T.album, locale)} className="w-full rounded-lg" />
              <figcaption className="mt-1 text-center text-xs font-bold text-[#4a2a62]">
                {ROOM_ICON[roomById(t.roomId)?.number ?? 1]} {tr(roomById(t.roomId)?.title ?? T.album, locale)}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="text-center font-semibold text-[#6b4a8a]">{tr(T.emptyAlbum, locale)}</p>
      );
    } else if (overlay === 'costumes') {
      title = T.costumes;
      body = (
        <div className="grid grid-cols-3 gap-2" data-tv-row="">
          {(['none', ...ACCESSORIES] as Accessory[]).map((a, i) => {
            const ok = earned.includes(a);
            return (
              <Btn key={a} tv={i === 0} disabled={!ok} pressed={costume === a} onClick={() => pickCostume(a)} testid={`costume-${a}`} label={tr(ACC_LABEL[a], locale)} className={`flex flex-col items-center justify-center py-1 ${costume === a ? 'bg-[#fff1c2] ring-4 ring-[#ffb35c]' : 'bg-[#fff8ee] ring-[#f3dcc0]'}`}>
                <span className="text-3xl" aria-hidden="true">
                  {ok ? ACC_ICON[a] : '🎁'}
                </span>
                <span className="text-[11px] text-[#6b4a2a]">{tr(ACC_LABEL[a], locale)}</span>
              </Btn>
            );
          })}
        </div>
      );
    } else {
      title = T.sandbox;
      body = done.length ? (
        <div className="grid grid-cols-3 gap-2" data-tv-row="">
          {ROOMS.filter((r) => done.includes(r.id)).map((r, i) => (
            <Btn key={r.id} tv={i === 0} onClick={() => openSandbox(r.id)} testid={`sb-room-${r.id}`} className="flex flex-col items-center justify-center bg-[#ffe9f2] py-1 ring-[#f5c2d8]">
              <span className="text-2xl" aria-hidden="true">
                {ROOM_ICON[r.number]}
              </span>
              <span className="text-[11px] text-[#4a2a62]">{tr(r.title, locale)}</span>
            </Btn>
          ))}
        </div>
      ) : (
        <p className="text-center font-semibold text-[#6b4a8a]">{tr(T.sandboxLocked, locale)}</p>
      );
    }
    return (
      <div className="absolute inset-0 z-20 flex items-end justify-center bg-[#2b2140]/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={tr(title, locale)}>
        <div className="pointer-events-auto max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-[2rem] bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="flex-1 font-display text-xl font-bold text-[#4a2a62]">{tr(title, locale)}</h2>
            {overlay === 'sandbox-rooms' ? <SayButton texts={[tr(T.sandboxRooms, locale)]} locale={locale} size="sm" /> : null}
            <button type="button" onClick={() => setOverlay(null)} aria-label={tr(T.close, locale)} data-tv-autofocus="" className="grid h-12 w-12 place-items-center rounded-full bg-[#f3ecff] text-xl font-bold text-[#5b3f8f]">
              ✕
            </button>
          </div>
          {body}
        </div>
      </div>
    );
  };

  const renderBottom = () => {
    if (!hud) return null;
    let panel: ReactNode = null;
    if (result) panel = null;
    else if (hud.view === 'house') panel = renderHouse();
    else if (hud.view === 'sandbox' && hud.sandbox) panel = renderSandbox(hud.sandbox);
    else if (hud.view === 'photo') panel = renderPhoto();
    else if (hud.puzzle) panel = renderPuzzle();
    else if (hud.phase === 'finale' && hud.finale) panel = renderFinale(hud.finale);
    else if (hud.phase === 'photo')
      panel = (
        <Btn tv onClick={() => act({ type: 'photo' })} testid="take-photo" className="pointer-events-auto bg-gradient-to-r from-[#4cc9b7] to-[#2fa596] px-6 text-xl text-white shadow-lg ring-[#2fa596]">
          📸 {tr(T.photoBtn, locale)}
        </Btn>
      );
    else if (hud.phase === 'pranks' && active) {
      if (active.phase === 'spotted' && hud.band !== 'little') panel = renderNaming(active);
      else panel = renderFound(active);
    } else if (hud.phase === 'pranks')
      panel = (
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-[#4a2a62] shadow-lg">
          👆 {tr(T.findPranks, locale)}
          <SayButton texts={[tr(T.findPranks, locale)]} locale={locale} size="sm" />
        </div>
      );
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-3">
        <AnimatePresence>
          {bubble ? (
            <motion.div key={bubble.id} initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} role="status" className="pointer-events-auto flex max-w-xl items-center gap-2 rounded-3xl bg-white px-3 py-2 text-sm font-bold text-[#3b2a52] shadow-xl ring-2 ring-[#e9d7ff] sm:text-base">
              <Face who={bubble.who} size={36} />
              <span className="flex-1">{bubble.text}</span>
              <SayButton texts={[bubble.text]} locale={locale} size="sm" />
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div ref={bottomRef} className="flex w-full flex-col items-center">
          {panel}
        </div>
      </div>
    );
  };

  // ---- page
  // The lutins layout is an `isolate` stacking context: once mounted, the game
  // goes to <body> so it covers the site header like the other 3D games.
  const ui = (
    <div ref={rootRef} className="fixed inset-0 z-[60] overflow-hidden bg-[#2b2140] text-[#33264a]" data-tv-scope="">
      {phase === 'play' && supported ? (
        <GameHost<ChaosEvents, ChaosCommands>
          load={def}
          locale={locale}
          options={{ audio, hotspotLabel: { fr: 'Les objets de la pièce', en: 'Things in the room' } }}
          onReady={(h) => {
            hostRef.current = h;
            h.command({ type: 'music', on: music });
            h.command({ type: 'house', ...houseState(), costume });
          }}
          onError={() => setFailed(true)}
          onEvent={onEvent}
          style={{ position: 'absolute', inset: 0 }}
        />
      ) : null}

      {phase === 'play' ? (
        <>
          {renderTop()}
          {narrow && hud && hud.view !== 'house' && !hud.puzzle && !result && !overlay
            ? ([-1, 1] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => hostRef.current?.input.push({ type: 'pan', dx: -d * 150, dy: 0 }, 'ui')}
                  aria-label={tr(d < 0 ? T.panLeft : T.panRight, locale)}
                  data-testid={d < 0 ? 'pan-left' : 'pan-right'}
                  data-tv-secondary=""
                  className={`absolute top-[30%] z-[5] grid h-14 w-11 place-items-center rounded-2xl bg-white/80 text-2xl font-black text-[#5b3f8f] shadow-lg ${d < 0 ? 'left-1' : 'right-1'}`}
                >
                  {d < 0 ? '◀' : '▶'}
                </button>
              ))
            : null}
          {renderBottom()}
          {renderResult()}
          {renderOverlay()}
          {!hud && !failed ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <p className="rounded-full bg-white/90 px-5 py-3 font-display text-lg font-bold text-[#4a2a62] shadow-lg" role="status">
                🧝 {tr(T.loading, locale)}
              </p>
            </div>
          ) : null}
          {failed ? (
            <div className="absolute inset-0 grid place-items-center p-6">
              <div className="rounded-3xl bg-white p-5 text-center shadow-xl">
                <p className="font-bold text-[#4a2a62]">{tr(T.oops, locale)}</p>
                <button type="button" onClick={() => setPhase('intro')} className="mt-3 min-h-[56px] rounded-full bg-[#f3ecff] px-6 font-bold text-[#5b3f8f]">
                  {tr(T.back, locale)}
                </button>
              </div>
            </div>
          ) : null}
          <AnimatePresence>
            {flash ? <motion.div key={flash} initial={{ opacity: reduce ? 0.5 : 0.9 }} animate={{ opacity: 0 }} transition={{ duration: reduce ? 0.2 : 0.6 }} className="pointer-events-none absolute inset-0 bg-white" aria-hidden="true" /> : null}
          </AnimatePresence>
        </>
      ) : null}

      {phase === 'intro' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-gradient-to-b from-[#1d2a6b] via-[#5b3f8f] to-[#ff9fc4] p-6 text-center">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {['🧦', '🔔', '🎄', '🧸', '🍪', '⭐', '🎁', '🧣'].concat(['🧦', '🔔', '🎄', '🧸', '🍪', '⭐', '🎁', '🧣']).map((e, i) => (
              <motion.span key={i} className="absolute text-3xl opacity-70" style={{ left: `${(i * 23 + 7) % 95}%`, top: `${(i * 37 + 11) % 90}%` }} animate={reduce ? undefined : { y: [0, -14, 0], rotate: [0, 10, 0] }} transition={{ duration: 3 + (i % 4), repeat: Infinity, delay: (i % 5) * 0.4 }}>
                {e}
              </motion.span>
            ))}
          </div>
          <div className="relative flex items-end justify-center gap-1" aria-hidden="true">
            <Face who="pepin" size={72} className="-rotate-6" />
            <motion.div className="relative h-36 w-36" animate={reduce ? undefined : { y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }}>
              <div className="grid h-full w-full place-items-end justify-center overflow-hidden rounded-full bg-white/75 shadow-[0_20px_60px_rgba(255,140,200,.45)] ring-8 ring-white/70">
                <MascotCutout pose="wave" width={116} glow={false} className="translate-y-3" />
              </div>
            </motion.div>
            <Face who="grelotte" size={72} className="rotate-6" />
            <Face who="noisette" size={52} className="-ml-4 rotate-12" />
          </div>
          <h1 className="relative font-display text-4xl font-bold text-white drop-shadow sm:text-6xl">{tr(T.title, locale)}</h1>
          <p className="relative max-w-lg text-lg font-semibold text-white/95">{tr(T.teaser, locale)}</p>
          <p className="relative flex max-w-md items-center gap-2 text-sm font-semibold text-white/90">
            {tr(T.how, locale)}
            <SayButton texts={[tr(T.teaser, locale), tr(T.how, locale)]} locale={locale} size="sm" />
          </p>
          <div className="relative flex items-center gap-1.5 rounded-full bg-white/85 p-1.5 shadow" role="radiogroup" aria-label={tr(T.age, locale)}>
            {(['little', 'middle', 'big'] as Band[]).map((b) => (
              <button key={b} type="button" role="radio" aria-checked={band === b} onClick={() => setBand(b)} data-testid={`band-${b}`} className={`min-h-[48px] rounded-full px-4 text-sm font-bold ${band === b ? 'bg-[#7950f2] text-white' : 'text-[#5b3f8f]'}`}>
                {tr(T.ages[b], locale)}
              </button>
            ))}
          </div>
          {supported ? (
            <button type="button" disabled={!hydrated} onClick={start} data-tv-autofocus="" data-testid="chaos-play" className="relative min-h-[64px] rounded-full bg-gradient-to-r from-[#ff8a3d] to-[#ec4a3f] px-10 py-4 text-xl font-bold text-white shadow-[0_10px_40px_rgba(236,74,63,.45)] transition hover:scale-105 disabled:opacity-60">
              🧝 {tr(T.play, locale)}
            </button>
          ) : (
            <p className="relative rounded-2xl bg-white/90 px-4 py-3 font-semibold">{tr(T.noWebgl, locale)}</p>
          )}
          <Link href="/lutins/jeux" className="relative text-sm font-semibold text-white underline">
            ← {tr(T.back, locale)}
          </Link>
        </div>
      ) : null}
    </div>
  );
  return portal ? createPortal(ui, document.body) : ui;
}
