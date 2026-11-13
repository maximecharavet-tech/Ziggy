'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'motion/react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { Link } from '@/i18n/navigation';
import { GameHost } from '@/components/games3d/engine/GameHost';
import type { GameHost as Host } from '@/games3d/engine/host';
import { createKeyMap } from '@/games3d/engine/input/keyboard';
import type { SayRequest } from '@/games3d/engine/events';
import type { FactoryCommands, FactoryEvents, FactoryHud, PieceInfo, SlotInfo } from '@/games3d/lutin-factory/FactoryGame';
import { LEVELS, COLOR_ICON, TOYS, getToy, identifyToy, texts, BAND_CAP, type Band, type Dial, type ProgramEntry } from '@/games3d/lutin-factory/logic';
import { HALLS } from '@/games3d/lutin-factory/controller';
import { MATERIAL_ICON, PATTERN_ICON, SHAPE_ICON, STICKER_ICON } from '@/games3d/lutin-factory/workshop/palette';
import { getMemory, useHydrated, useWorldMemory } from '@/lib/world/store';
import { readAloudOn } from '@/lib/world/memory';
import { finishExtraGame } from '@/lib/world/play';
import type { MagicMoment } from '@/lib/world/engine';
import { speakSequence, stopSpeaking, unlockAudio } from '@/lib/voice';
import { tr, type L } from '@/lib/i18n-text';
import { SayButton } from '@/components/arcade/read-aloud';
import { MagicMoments, MomentChips } from '@/components/world/MagicMoments';
import { MascotCutout, ZiggyAvatar } from '@/components/ziggy/Mascot';
import { useTvStepFocus } from '@/components/games3d/tv-step-focus';
import { BodyPortal } from '@/components/lutins/BodyPortal';

/**
 * « L'Atelier des Lutins » / Elf Workshop: the React side of Lutin Factory.
 * The 3D workshop runs in the engine (`FactoryGame`, lazy-loaded on Play);
 * everything a child presses is a real DOM button here (TV remote, keyboard,
 * screen readers, switch access), every line is FR + EN and read aloud.
 * Results go to World Memory (`finishExtraGame`); the device save lives in
 * the game.
 */

const T = {
  title: { fr: 'L’Atelier des Lutins', en: 'Elf Workshop' },
  teaser: {
    fr: 'Des lettres d’enfants arrivent à l’atelier ! Construis la chaîne de machines, appuie sur « C’est parti ! » et regarde Pépin, Grelotte et Noisette fabriquer le jouet… ou une surprise rigolote.',
    en: 'Letters from children arrive at the workshop! Build the line of machines, press GO and watch Pip, Jingle and Hazel make the toy… or a funny surprise.',
  },
  how: { fr: 'Choisis une machine, touche une case, puis « C’est parti ! ».', en: 'Pick a machine, tap a tile, then GO!' },
  play: { fr: 'Ouvrir l’atelier', en: 'Open the workshop' },
  loading: { fr: 'Les lutins allument les lampes…', en: 'The elves are switching on the lamps…' },
  back: { fr: 'Retour', en: 'Back' },
  map: { fr: 'Les salles de l’atelier', en: 'The workshop halls' },
  toMap: { fr: 'Les salles', en: 'The halls' },
  music: { fr: 'Musique', en: 'Music' },
  letter: { fr: 'La lettre', en: 'The letter' },
  tray: { fr: 'Les machines', en: 'The machines' },
  slotTitle: { fr: 'Quelle machine va dans la case qui brille ?', en: 'Which machine goes in the glowing tile?' },
  close: { fr: 'Fermer', en: 'Close' },
  stop: { fr: 'Pause', en: 'Pause' },
  showMe: { fr: 'Montre-moi', en: 'Show me' },
  done: { fr: 'La lettre est prête !', en: 'The letter is ready!' },
  next: { fr: 'Lettre suivante', en: 'Next letter' },
  stay: { fr: 'Je continue à jouer ici', en: 'Keep playing here' },
  thanks: { fr: '{name} te dit merci !', en: '{name} says thank you!' },
  sandboxCard: { fr: 'Invente tes jouets avec toutes les machines que tu connais.', en: 'Invent your own toys with every machine you know.' },
  closedHall: { fr: 'S’ouvre quand la salle d’avant est finie', en: 'Opens when the hall before is finished' },
  band: { fr: 'Âge', en: 'Age' },
  share: { fr: 'Partager mon atelier', en: 'Share my workshop' },
  shareHow: {
    fr: 'Ce code décrit ton atelier. Un parent peut le copier et le coller sur un autre appareil. Rien n’est envoyé sur Internet.',
    en: 'This code describes your workshop. A parent can copy it and paste it on another device. Nothing is sent over the Internet.',
  },
  copied: { fr: 'Copié !', en: 'Copied!' },
  load: { fr: 'Ouvrir ce code', en: 'Open this code' },
  pasteHere: { fr: 'Colle un code d’atelier ici', en: 'Paste a workshop code here' },
  catalogueEmpty: { fr: 'Le catalogue se remplit à chaque jouet fabriqué, même les surprises !', en: 'The catalogue fills up with every toy you make, even the surprises!' },
  wished: { fr: 'Pour une lettre', en: 'For a letter' },
  surprise: { fr: 'Surprise', en: 'Surprise' },
  shelf: { fr: 'jouets sur l’étagère surprise', en: 'toys on the surprise shelf' },
  noWebgl: { fr: 'Ce jeu en 3D a besoin de WebGL, qui n’est pas disponible sur cet appareil.', en: 'This 3D game needs WebGL, which this device does not support.' },
  pattern: { fr: 'Motif', en: 'Pattern' },
  add: { fr: 'Ajouter', en: 'Add' },
  less: { fr: 'Enlever le dernier', en: 'Remove the last one' },
  more: { fr: 'Plus', en: 'More' },
  fewer: { fr: 'Moins', en: 'Fewer' },
  none: { fr: 'Rien', en: 'None' },
  potA: { fr: 'Pot 1', en: 'Pot 1' },
  potB: { fr: 'Pot 2', en: 'Pot 2' },
  first: { fr: 'Les premiers tout droit', en: 'The first ones straight on' },
  every: { fr: 'Un sur…', en: 'One in every…' },
  locked: { fr: 'Collée par les lutins', en: 'Glued down by the elves' },
  program: { fr: 'Les cartes du bras', en: 'The arm’s cards' },
  inRepeat: { fr: 'dans la boucle', en: 'in the loop' },
  newRepeat: { fr: 'Nouvelle boucle', en: 'New loop' },
  test: { fr: 'SI ça ressemble à…', en: 'IF it looks like…' },
  xp: { fr: 'XP', en: 'XP' },
  catalogueHint: { fr: 'Chaque jouet fabriqué entre dans le Grand Catalogue.', en: 'Every toy you make goes into the Grand Catalogue.' },
} satisfies Record<string, L>;

const BAND_LABEL: Record<Band, L> = { little: { fr: '4–6 ans', en: '4–6' }, middle: { fr: '7–9 ans', en: '7–9' }, big: { fr: '10–12 ans', en: '10–12' } };
const HALL_EMOJI: Record<string, string> = { 'wood-shop': '🪵', 'paint-room': '🎨', 'assembly-line': '🔧', 'logic-room': '💡', dispatch: '🛷', 'christmas-eve': '🎄' };
const MACHINE_ICON: Record<string, string> = { belt: '⏩', chute: '🛝', shaper: '🔷', painter: '🖌️', mixer: '🎨', assembler: '🔧', counter: '🔢', sorter: '🔀', loop: '🔁', stamper: '⭐', wrapper: '🎁', arm: '🤖', sack: '🛷' };
const PAINTS = ['red', 'yellow', 'blue', 'green', 'purple', 'orange'] as const;
const SHAPES = ['cube', 'ball', 'cylinder', 'cone', 'star', 'wheel'] as const;
const MATERIALS = ['wood', 'felt', 'metal', 'yarn'] as const;
const STICKERS = ['star', 'heart', 'moon', 'snowflake'] as const;
const PATTERNS = ['stripes', 'dots', 'stars', 'snowflakes', 'hearts'] as const;
const WHO_EMOJI: Record<string, string> = { pepin: '🧝', grelotte: '🧝‍♀️', noisette: '🌰' };

function webglOk() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** One big toy-like button. */
function Btn({ children, onClick, active, disabled, label, className = '', tv, wide }: { children: ReactNode; onClick: () => void; active?: boolean; disabled?: boolean; label?: string; className?: string; tv?: boolean; wide?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => {
        unlockAudio();
        onClick();
      }}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      data-tv-autofocus={tv ? '' : undefined}
      className={`flex min-h-[56px] ${wide ? 'min-w-[72px]' : 'min-w-[56px]'} shrink-0 items-center justify-center gap-1 rounded-2xl px-2 text-sm font-bold shadow-sm ring-1 transition disabled:opacity-40 ${active ? 'bg-[#ffe7a8] text-[#5a3410] ring-4 ring-[#ffb35c]' : 'bg-[#fff8ee] text-[#5a3410] ring-[#f0d6b4] hover:bg-[#fff1df]'} ${className}`}
    >
      {children}
    </button>
  );
}

function Chip({ children, onClick, active, label }: { children: ReactNode; onClick: () => void; active?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`grid h-14 min-w-14 place-items-center rounded-2xl px-1.5 text-2xl leading-none ring-1 transition ${active ? 'bg-[#ffe7a8] ring-4 ring-[#ffb35c]' : 'bg-white ring-[#f0d6b4] hover:bg-[#fff6ea]'}`}
    >
      {children}
    </button>
  );
}

/** Colour, shape… names for buttons (aria labels and read-aloud). */
function valueName(kind: 'color' | 'shape' | 'material' | 'sticker' | 'pattern', v: string, locale: string): string {
  if (kind === 'color') return locale === 'fr' ? texts.COLOR_NAMES[v as keyof typeof texts.COLOR_NAMES].fr.m : texts.COLOR_NAMES[v as keyof typeof texts.COLOR_NAMES].en;
  if (kind === 'shape') return tr({ fr: texts.SHAPE_NAMES[v as keyof typeof texts.SHAPE_NAMES].fr, en: texts.SHAPE_NAMES[v as keyof typeof texts.SHAPE_NAMES].en }, locale);
  if (kind === 'material') return tr(texts.MATERIAL_NAMES[v as keyof typeof texts.MATERIAL_NAMES], locale);
  if (kind === 'sticker') return tr(texts.STICKER_NAMES[v as keyof typeof texts.STICKER_NAMES], locale);
  return tr(texts.PATTERN_NAMES[v as keyof typeof texts.PATTERN_NAMES].name, locale);
}

const ICON: Record<string, (v: string) => string> = {
  color: (v) => COLOR_ICON[v as keyof typeof COLOR_ICON],
  shape: (v) => SHAPE_ICON[v],
  material: (v) => MATERIAL_ICON[v as keyof typeof MATERIAL_ICON],
  sticker: (v) => STICKER_ICON[v],
  pattern: (v) => PATTERN_ICON[v as keyof typeof PATTERN_ICON],
};

/** A value or a repeating pattern of values (painter colours, shaper shapes, wrapper papers). */
function CycleEditor({ kind, values, cycle, allowPattern, locale, onChange }: { kind: 'color' | 'shape' | 'pattern'; values: readonly string[]; cycle: string[]; allowPattern: boolean; locale: string; onChange: (c: string[]) => void }) {
  const [sel, setSel] = useState(0);
  const i = Math.min(sel, cycle.length - 1);
  return (
    <div className="flex flex-col gap-1.5">
      {allowPattern ? (
        <div className="flex flex-wrap items-center gap-1.5" data-tv-row="">
          <span className="text-xs font-bold text-[#8a5a2a]">{tr(T.pattern, locale)}</span>
          {cycle.map((v, k) => (
            <Chip key={k} active={k === i && cycle.length > 1} onClick={() => setSel(k)} label={`${k + 1} : ${valueName(kind, v, locale)}`}>
              {ICON[kind](v)}
            </Chip>
          ))}
          <Btn label={tr(T.add, locale)} disabled={cycle.length >= 6} onClick={() => { onChange([...cycle, cycle[cycle.length - 1]]); setSel(cycle.length); }}>＋</Btn>
          <Btn label={tr(T.less, locale)} disabled={cycle.length <= 1} onClick={() => { onChange(cycle.slice(0, -1)); setSel(Math.max(0, cycle.length - 2)); }}>－</Btn>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1.5" data-tv-row="">
        {values.map((v) => (
          <Chip key={v} active={cycle[i] === v} onClick={() => onChange(cycle.map((c, k) => (k === i ? v : c)))} label={valueName(kind, v, locale)}>
            {ICON[kind](v)}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Stepper({ value, min, max, onChange, locale, unit }: { value: number; min: number; max: number; onChange: (n: number) => void; locale: string; unit?: string }) {
  return (
    <div className="flex items-center gap-2" data-tv-row="">
      <Btn label={tr(T.fewer, locale)} disabled={value <= min} onClick={() => onChange(value - 1)} wide>
        <span className="text-2xl">－</span>
      </Btn>
      <span className="min-w-[3.5rem] text-center font-display text-3xl font-bold text-[#4a2a12]" aria-live="polite">
        {unit}
        {value}
      </span>
      <Btn label={tr(T.more, locale)} disabled={value >= max} onClick={() => onChange(value + 1)} wide>
        <span className="text-2xl">＋</span>
      </Btn>
    </div>
  );
}

const MULTI_TOYS = TOYS.filter((t) => !(t.parts.length === 1 && t.parts[0].count === 1));

function cardLabel(card: string, locale: string): string {
  const [op, arg] = card.split(':');
  const base = tr(texts.CARD_TEXT[op] ?? { fr: op, en: op }, locale);
  if (!arg) return base;
  const kind = op === 'paint' ? 'color' : op === 'shape' ? 'shape' : 'sticker';
  return `${base} : ${valueName(kind, arg, locale)}`;
}

function cardIcon(card: string): string {
  const [op, arg] = card.split(':');
  if (op === 'pick') return '✋';
  if (op === 'stack') return '📚';
  if (op === 'ship') return '📤';
  if (op === 'shape') return `✂️${SHAPE_ICON[arg] ?? ''}`;
  if (op === 'paint') return `🖌️${COLOR_ICON[arg as keyof typeof COLOR_ICON] ?? ''}`;
  if (op === 'sticker') return `🏷️${STICKER_ICON[arg] ?? ''}`;
  return '❓';
}

/** The robot arm's cards: a tiny program (pick, shape, paint, sticker, stack, ship, repeat). */
function ProgramEditor({ program, locale, onChange }: { program: ProgramEntry[]; locale: string; onChange: (p: ProgramEntry[]) => void }) {
  const [target, setTarget] = useState<number | null>(null);
  const [sub, setSub] = useState<'shape' | 'paint' | 'sticker' | null>(null);
  const count = program.reduce((n, e) => n + (typeof e === 'string' ? 1 : 1 + e.do.length), 0);
  const add = (card: string) => {
    if (count >= 15) return;
    const g = target !== null ? program[target] : null;
    if (g && typeof g !== 'string') onChange(program.map((e, k) => (k === target ? { ...g, do: [...g.do, card] } : e)));
    else onChange([...program, card]);
    setSub(null);
  };
  const removeLast = () => {
    const g = target !== null ? program[target] : null;
    if (g && typeof g !== 'string') {
      if (g.do.length > 1) onChange(program.map((e, k) => (k === target ? { ...g, do: g.do.slice(0, -1) } : e)));
      else {
        onChange(program.filter((_, k) => k !== target));
        setTarget(null);
      }
    } else if (program.length > 1) onChange(program.slice(0, -1));
  };
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-bold text-[#8a5a2a]">{tr(T.program, locale)}</p>
      <ol className="flex flex-wrap items-center gap-1" aria-label={tr(T.program, locale)}>
        {program.map((e, k) =>
          typeof e === 'string' ? (
            <li key={k} className="grid h-12 min-w-12 place-items-center rounded-xl bg-white px-1 text-lg ring-1 ring-[#f0d6b4]" title={cardLabel(e, locale)} aria-label={cardLabel(e, locale)}>
              {cardIcon(e)}
            </li>
          ) : (
            <li key={k} className="flex items-center gap-1">
              <button type="button" onClick={() => setTarget(target === k ? null : k)} aria-pressed={target === k} className={`flex min-h-12 items-center gap-1 rounded-xl px-1.5 ring-2 ${target === k ? 'bg-[#ffe7a8] ring-[#ffb35c]' : 'bg-[#eef6ff] ring-[#9cc7f0]'}`} aria-label={`${tr(texts.CARD_TEXT.repeat, locale)} ×${e.repeat}`}>
                <span className="font-bold">🔁×{e.repeat}</span>
                {e.do.map((c, j) => (
                  <span key={j} className="grid h-10 min-w-10 place-items-center rounded-lg bg-white text-base" title={cardLabel(c, locale)}>
                    {cardIcon(c)}
                  </span>
                ))}
              </button>
              {target === k ? (
                <>
                  <Btn label={tr(T.fewer, locale)} disabled={e.repeat <= 2} onClick={() => onChange(program.map((x, j) => (j === k ? { ...e, repeat: e.repeat - 1 } : x)))}>－</Btn>
                  <Btn label={tr(T.more, locale)} disabled={e.repeat >= 12} onClick={() => onChange(program.map((x, j) => (j === k ? { ...e, repeat: e.repeat + 1 } : x)))}>＋</Btn>
                </>
              ) : null}
            </li>
          )
        )}
      </ol>
      <div className="flex flex-wrap gap-1.5" data-tv-row="">
        {['pick', 'stack', 'ship'].map((c) => (
          <Chip key={c} onClick={() => add(c)} label={`${tr(T.add, locale)} : ${cardLabel(c, locale)}${target !== null ? ` (${tr(T.inRepeat, locale)})` : ''}`}>
            {cardIcon(c)}
          </Chip>
        ))}
        <Chip active={sub === 'shape'} onClick={() => setSub(sub === 'shape' ? null : 'shape')} label={tr(texts.CARD_TEXT.shape, locale)}>✂️</Chip>
        <Chip active={sub === 'paint'} onClick={() => setSub(sub === 'paint' ? null : 'paint')} label={tr(texts.CARD_TEXT.paint, locale)}>🖌️</Chip>
        <Chip active={sub === 'sticker'} onClick={() => setSub(sub === 'sticker' ? null : 'sticker')} label={tr(texts.CARD_TEXT.sticker, locale)}>🏷️</Chip>
        <Btn label={tr(T.newRepeat, locale)} disabled={target !== null || count >= 14} onClick={() => { onChange([...program, { repeat: 2, do: ['pick'] }]); setTarget(program.length); }}>🔁＋</Btn>
        <Btn label={tr(T.less, locale)} onClick={removeLast}>⌫</Btn>
      </div>
      {sub ? (
        <div className="flex flex-wrap gap-1.5" data-tv-row="">
          {(sub === 'shape' ? SHAPES : sub === 'paint' ? PAINTS : STICKERS).map((v) => (
            <Chip key={v} onClick={() => add(`${sub}:${v}`)} label={cardLabel(`${sub}:${v}`, locale)}>
              {cardIcon(`${sub}:${v}`)}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** The dial of the selected machine (big buttons, icons, read aloud by the game). */
function DialEditor({ piece, hud, locale, send }: { piece: PieceInfo; hud: FactoryHud; locale: string; send: (dial: Dial) => void }) {
  const d = piece.dial as Record<string, unknown>;
  const pattern = hud.band !== 'little' || hud.mode === 'sandbox';
  const cap = hud.mode === 'sandbox' ? 30 : BAND_CAP[hud.band];
  switch (piece.machine) {
    case 'chute':
      return (
        <div className="flex flex-col gap-1.5">
          {d.items ? null : (
            <div className="flex flex-wrap gap-1.5" data-tv-row="">
              {MATERIALS.map((m) => (
                <Chip key={m} active={d.material === m} onClick={() => send({ ...d, material: m })} label={valueName('material', m, locale)}>
                  {MATERIAL_ICON[m]}
                </Chip>
              ))}
            </div>
          )}
          <Stepper value={Number(d.count ?? 1)} min={1} max={Math.max(Number(d.count ?? 1), Math.min(cap, 100))} onChange={(n) => send({ ...d, count: n })} locale={locale} unit="×" />
        </div>
      );
    case 'shaper': {
      const cyc = (d.shapes as string[] | undefined) ?? [String(d.shape ?? 'cube')];
      return <CycleEditor kind="shape" values={SHAPES} cycle={cyc} allowPattern={pattern} locale={locale} onChange={(c) => send(c.length > 1 ? { shapes: c } : { shape: c[0] })} />;
    }
    case 'painter': {
      const cyc = (d.colors as string[] | undefined) ?? [String(d.color ?? 'red')];
      return <CycleEditor kind="color" values={PAINTS} cycle={cyc} allowPattern={pattern} locale={locale} onChange={(c) => send(c.length > 1 ? { colors: c } : { color: c[0] })} />;
    }
    case 'wrapper': {
      const cyc = (d.patterns as string[] | undefined) ?? [String(d.pattern ?? 'stripes')];
      return <CycleEditor kind="pattern" values={PATTERNS} cycle={cyc} allowPattern={pattern} locale={locale} onChange={(c) => send(c.length > 1 ? { patterns: c } : { pattern: c[0] })} />;
    }
    case 'mixer':
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5" data-tv-row="">
            <span className="w-12 text-xs font-bold text-[#8a5a2a]">{tr(T.potA, locale)}</span>
            {hud.pots.map((c) => (
              <Chip key={c} active={d.a === c} onClick={() => send({ ...d, a: c })} label={`${tr(T.potA, locale)} : ${valueName('color', c, locale)}`}>
                {COLOR_ICON[c as keyof typeof COLOR_ICON]}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5" data-tv-row="">
            <span className="w-12 text-xs font-bold text-[#8a5a2a]">{tr(T.potB, locale)}</span>
            {hud.pots.map((c) => (
              <Chip key={c} active={d.b === c} onClick={() => send({ ...d, b: c })} label={`${tr(T.potB, locale)} : ${valueName('color', c, locale)}`}>
                {COLOR_ICON[c as keyof typeof COLOR_ICON]}
              </Chip>
            ))}
            <Chip active={d.b === undefined} onClick={() => send({ a: d.a })} label={`${tr(T.potB, locale)} : ${tr(T.none, locale)}`}>
              ∅
            </Chip>
          </div>
        </div>
      );
    case 'assembler': {
      const toy = getToy(String(d.toy));
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-1.5" data-tv-row="">
            {MULTI_TOYS.map((t) => (
              <Chip key={t.id} active={d.toy === t.id} onClick={() => send(t.n ? { toy: t.id, n: t.n.default } : { toy: t.id })} label={tr(t.name, locale)}>
                {t.emoji}
              </Chip>
            ))}
          </div>
          {toy?.n ? <Stepper value={Number(d.n ?? toy.n.default)} min={toy.n.min} max={toy.n.max} onChange={(n) => send({ toy: toy.id, n })} locale={locale} unit="×" /> : null}
        </div>
      );
    }
    case 'counter':
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-1.5" data-tv-row="">
            <Btn active={d.mode === 'first'} onClick={() => send({ ...d, mode: 'first' })}>
              ➡️ {tr(T.first, locale)}
            </Btn>
            <Btn active={d.mode !== 'first'} onClick={() => send({ ...d, mode: 'every' })}>
              ↪️ {tr(T.every, locale)}
            </Btn>
          </div>
          <Stepper value={Number(d.n ?? 3)} min={1} max={Math.min(50, cap)} onChange={(n) => send({ ...d, n })} locale={locale} />
        </div>
      );
    case 'loop':
      return <Stepper value={Number(d.times ?? 2)} min={2} max={Math.min(20, Math.max(2, cap))} onChange={(n) => send({ times: n })} locale={locale} unit="×" />;
    case 'stamper':
      return (
        <div className="flex flex-wrap gap-1.5" data-tv-row="">
          {STICKERS.map((s) => (
            <Chip key={s} active={d.sticker === s} onClick={() => send({ sticker: s })} label={valueName('sticker', s, locale)}>
              {STICKER_ICON[s]}
            </Chip>
          ))}
        </div>
      );
    case 'sorter': {
      const kinds = ['color', 'shape', 'toy', 'sticker', 'wrap', 'material'] as const;
      const cur = kinds.find((k) => d[k] !== undefined) ?? 'color';
      const values: Record<string, readonly string[]> = { color: PAINTS, shape: SHAPES, toy: TOYS.map((t) => t.id), sticker: STICKERS, wrap: PATTERNS, material: MATERIALS };
      const icon = (k: string, v: string) => (k === 'toy' ? (getToy(v)?.emoji ?? '🧸') : k === 'wrap' ? PATTERN_ICON[v as keyof typeof PATTERN_ICON] : ICON[k](v));
      const name = (k: string, v: string) => (k === 'toy' ? tr(getToy(v)?.name ?? { fr: v, en: v }, locale) : valueName(k === 'wrap' ? 'pattern' : (k as 'color'), v, locale));
      const kindIcon: Record<string, string> = { color: '🍓', shape: '🔷', toy: '🧸', sticker: '⭐', wrap: '🎁', material: '🪵' };
      return (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-bold text-[#8a5a2a]">{tr(T.test, locale)}</p>
          <div className="flex flex-wrap gap-1.5" data-tv-row="">
            {kinds.map((k) => (
              <Chip key={k} active={cur === k} onClick={() => send({ [k]: values[k][0] })} label={k}>
                {kindIcon[k]}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" data-tv-row="">
            {values[cur].map((v) => (
              <Chip key={v} active={d[cur] === v} onClick={() => send({ [cur]: v })} label={name(cur, v)}>
                {icon(cur, v)}
              </Chip>
            ))}
          </div>
        </div>
      );
    }
    case 'arm':
      return <ProgramEditor program={(d.program as ProgramEntry[]) ?? ['pick', 'ship']} locale={locale} onChange={(p) => send({ program: p })} />;
    default:
      return null;
  }
}

export function LutinFactoryPlayer() {
  const raw = useLocale();
  const locale = raw === 'fr' ? 'fr' : 'en';
  const hydrated = useHydrated();
  const memory = useWorldMemory();
  const reduce = useReducedMotion();
  const host = useRef<Host<FactoryEvents, FactoryCommands> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const letterRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'intro' | 'play'>('intro');
  const [supported, setSupported] = useState(true);
  const [hud, setHud] = useState<FactoryHud | null>(null);
  const [toast, setToast] = useState<{ lines: L[]; who: string; id: number } | null>(null);
  const [band, setBand] = useState<Band>('middle');
  const [music, setMusic] = useState(true);
  const [done, setDone] = useState<FactoryEvents['letterDone'] | null>(null);
  const [gain, setGain] = useState<{ xp: number; magic: MagicMoment[]; id: number } | null>(null);
  const [catalogue, setCatalogue] = useState(false);
  const [share, setShare] = useState<{ code: string; copied: boolean } | null>(null);
  const [paste, setPaste] = useState('');
  const [shareMsg, setShareMsg] = useState<L | null>(null);
  const [testHook, setTestHook] = useState(false);

  useEffect(() => {
    setSupported(webglOk());
    setTestHook(new URLSearchParams(window.location.search).has('zgtest'));
  }, []);
  useEffect(() => {
    if (hydrated && memory.age) setBand(memory.age as Band);
  }, [hydrated, memory.age]);

  const send = useCallback((c: Parameters<Host<FactoryEvents, FactoryCommands>['command']>[0]) => host.current?.command(c), []);

  const onEvent = useCallback(
    (name: keyof FactoryEvents, payload: FactoryEvents[keyof FactoryEvents]) => {
      if (name === 'hud') setHud(payload as FactoryHud);
      else if (name === 'say') {
        const s = payload as SayRequest;
        setToast({ lines: s.lines, who: s.who, id: Date.now() });
        if (s.force || readAloudOn(getMemory())) void speakSequence(s.id, s.lines.map((l) => tr(l, locale)), locale);
      } else if (name === 'result') {
        const r = payload as FactoryEvents['result'];
        const o = finishExtraGame(r.gameId, r.skill, r.stats, r.durationMs);
        setGain({ xp: o.xpGained, magic: o.magic, id: Date.now() });
      } else if (name === 'letterDone') setDone(payload as FactoryEvents['letterDone']);
      else if (name === 'share') setShare({ code: (payload as FactoryEvents['share']).code, copied: false });
      else if (name === 'shareResult') {
        const r = payload as FactoryEvents['shareResult'];
        setShareMsg(r.message);
        if (r.ok) setPaste('');
      }
    },
    [locale]
  );

  useEffect(() => () => stopSpeaking(), []);

  useEffect(() => {
    if (!toast) return;
    const len = toast.lines.reduce((n, l) => n + tr(l, locale).length, 0);
    const t = setTimeout(() => setToast(null), Math.min(11000, 2600 + len * 60));
    return () => clearTimeout(t);
  }, [toast, locale]);

  // Tell the scene how much of the screen the HUD covers, so the workbench stays in view.
  const mode = hud?.mode ?? 'idle';
  const panelKey = `${mode}:${hud?.selected?.machine ?? ''}:${hud?.slot ? 's' : ''}:${hud?.tool ?? ''}:${hud?.hint ? 'h' : ''}`;
  useEffect(() => {
    if (phase !== 'play') return;
    const measure = () => {
      let top = topRef.current?.getBoundingClientRect().bottom ?? 0;
      // Wide landscape screens: the letter is a card on the left, not a band on top.
      const lr = letterRef.current?.getBoundingClientRect();
      const side = lr && lr.width > 0 && lr.width < window.innerWidth * 0.45 && lr.left < 40;
      if (side) top = barRef.current?.getBoundingClientRect().bottom ?? top;
      const b = bottomRef.current?.getBoundingClientRect();
      const bottom = b && b.height > 0 ? window.innerHeight - b.top : 0;
      // The halls map sits on the left of wide screens: the workshop and its crew show on the right.
      const left = mode === 'idle' && window.innerWidth >= 1024 ? (mapRef.current?.getBoundingClientRect().right ?? 0) : side && lr ? lr.right : 0;
      host.current?.command({ type: 'insets', top: mode === 'idle' ? 0 : top, bottom: mode === 'idle' ? 0 : bottom, left });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (topRef.current) ro.observe(topRef.current);
    if (bottomRef.current) ro.observe(bottomRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [phase, panelKey, mode, hud?.ready]);
  useEffect(() => {
    // Wide screens: the halls map is a column; resend the insets once it is drawn.
    if (phase === 'play' && mode === 'idle') window.dispatchEvent(new Event('resize'));
  }, [phase, mode, hud?.ready]);

  useTvStepFocus(phase === 'play' ? `${mode}:${hud?.levelId ?? ''}:${done ? 'done' : ''}` : null, rootRef);

  const start = () => {
    unlockAudio();
    setPhase('play');
  };

  const openLevel = (id: string) => {
    setDone(null);
    setCatalogue(false);
    send({ type: 'openLevel', id, band });
  };

  const nextLevel = useMemo(() => {
    if (!hud?.levelId) return null;
    const i = LEVELS.findIndex((l) => l.id === hud.levelId);
    for (let k = 1; k <= LEVELS.length; k++) {
      const l = LEVELS[(i + k) % LEVELS.length];
      if (hud.hallsOpen[l.hall] && !(hud.done[l.id] ?? []).includes(band)) return l.id;
    }
    return null;
  }, [hud?.levelId, hud?.hallsOpen, hud?.done, band]);

  const keymap = useMemo(() => createKeyMap({ ' ': { type: 'go' }, enter: { type: 'select', target: null } }), []);
  const hostOptions = useMemo(
    () => ({ keymap, hotspotLabel: { fr: 'Les cases de l’atelier', en: 'The workshop tiles' }, ...(testHook ? { exposeAs: '__engine' } : {}) }),
    [keymap, testHook]
  );

  const little = band === 'little';

  /* ── HUD pieces ── */

  const letterCard = () => {
    if (!hud || hud.mode !== 'level') return null;
    const say = [...hud.letters.map((l) => tr(l.text, locale))];
    return (
      <div ref={letterRef} className="pointer-events-auto mx-auto flex w-full max-w-3xl items-start gap-2 rounded-[1.5rem] bg-[#fffaf1]/95 p-2 shadow-[0_8px_30px_rgba(60,30,10,.25)] ring-1 ring-white sm:gap-3 sm:p-3 lg:landscape:absolute lg:landscape:left-3 lg:landscape:top-[4.75rem] lg:landscape:mx-0 lg:landscape:w-[20rem]" data-testid="letter">
        <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#ffe9cc] text-3xl sm:h-14 sm:w-14 sm:text-4xl" aria-hidden="true">
          {hud.letters[0]?.emoji ?? '✉️'}
          <span className="absolute -bottom-1 -right-1 text-base">✉️</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold uppercase tracking-wide text-[#b0682a]">
            {tr(T.letter, locale)} · {tr(hud.letters[0]?.name ?? { fr: '', en: '' }, locale)}
          </p>
          {!little ? <p className="line-clamp-2 sm:line-clamp-3 lg:landscape:line-clamp-6 text-sm font-semibold leading-snug text-[#4a2a12] sm:text-base">{hud.letters.map((l) => tr(l.text, locale)).join(' ')}</p> : null}
          <div className="mt-1 flex flex-wrap items-center gap-1.5" aria-label={hud.orders.map((o) => `${tr(o.label, locale)} ${o.made}/${o.wanted}`).join(', ')}>
            {hud.orders.map((o, i) => (
              <span key={i} className={`flex items-center gap-1 rounded-xl px-1.5 py-0.5 font-display text-lg font-bold ${o.done ? 'bg-[#dff5d6] text-[#2f7d32]' : 'bg-[#fff1df] text-[#4a2a12]'}`}>
                {o.sequence ? o.sequence.slice(0, 4).map((s, k) => <span key={k} aria-hidden="true">{s.emoji}{s.icons}</span>) : <span aria-hidden="true">{o.emoji}{o.icons}</span>}
                {o.bay ? <span className="rounded-md bg-white px-1 text-xs">🛷{o.bay}</span> : null}
                <span className="text-sm">
                  {o.made}/{o.wanted}
                </span>
                {o.done ? <span aria-hidden="true">✓</span> : null}
              </span>
            ))}
          </div>
        </div>
        <SayButton texts={say} locale={locale} />
      </div>
    );
  };

  const topBar = () => (
    <div ref={barRef} className="pointer-events-auto mx-auto flex w-full max-w-3xl items-center gap-1.5 rounded-full bg-white/90 p-1.5 shadow-[0_6px_24px_rgba(60,30,10,.2)] ring-1 ring-white">
      {mode === 'idle' ? (
        <Link href="/lutins/jeux" aria-label={tr(T.back, locale)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fff1e0] text-lg font-bold text-[#8a4a1a]">
          ←
        </Link>
      ) : (
        <button type="button" onClick={() => { setDone(null); send({ type: 'openMap' }); }} aria-label={tr(T.toMap, locale)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fff1e0] text-lg font-bold text-[#8a4a1a]">
          ←
        </button>
      )}
      <p className="min-w-0 flex-1 truncate px-1 font-display text-base font-bold text-[#4a2a12] sm:text-lg">
        {mode === 'level' && hud?.title ? `${HALL_EMOJI[hud.hall] ?? ''} ${hud.number}. ${tr(hud.title, locale)}` : mode === 'sandbox' ? `🧰 ${tr(texts.UI.sandbox, locale)}` : `🏭 ${tr(T.title, locale)}`}
      </p>
      {mode === 'level' ? (
        <button type="button" onClick={() => send({ type: 'hint' })} aria-label={tr(texts.UI.hint, locale)} title={tr(texts.UI.hint, locale)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fff6c8] text-xl">
          💡
        </button>
      ) : null}
      <button type="button" onClick={() => setCatalogue(true)} aria-label={tr(texts.UI.catalogue, locale)} title={tr(texts.UI.catalogue, locale)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#eef6ff] text-xl">
        📖
      </button>
      <button
        type="button"
        onClick={() => {
          send({ type: 'music', on: !music });
          setMusic(!music);
        }}
        aria-pressed={music}
        aria-label={tr(T.music, locale)}
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg ${music ? 'bg-[#ffe08a]' : 'bg-[#f6efe6]'}`}
      >
        🎵
      </button>
    </div>
  );

  const slotPanel = (s: SlotInfo) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-sm font-bold text-[#6b4a2a]">✨ {tr(T.slotTitle, locale)}</p>
        <SayButton texts={[tr(T.slotTitle, locale), ...s.choices.map((c) => `${tr(texts.MACHINE_TEXT[c.machine].name, locale)} : ${tr(c.name, locale)}`)]} locale={locale} size="sm" />
      </div>
      <div className="grid grid-cols-3 gap-2" data-tv-row="" data-tv-wrap="false">
        {s.choices.map((c, i) => (
          <motion.button
            key={i}
            type="button"
            whileTap={reduce ? undefined : { scale: 0.92 }}
            onClick={() => {
              unlockAudio();
              send({ type: 'slot', index: i });
            }}
            data-tv-autofocus={i === 0 ? '' : undefined}
            aria-pressed={s.current === i}
            aria-label={`${tr(texts.MACHINE_TEXT[c.machine].name, locale)} : ${tr(c.name, locale)}`}
            data-testid={`slot-choice-${i}`}
            className={`flex min-h-[84px] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 shadow-sm transition ${s.current === i ? 'bg-[#ffe7a8] ring-4 ring-[#ffb35c]' : 'bg-white ring-1 ring-[#f0d6b4]'}`}
          >
            <span className="text-3xl leading-none" aria-hidden="true">
              {c.icon}
            </span>
            <span className="text-xs font-bold leading-tight text-[#6b4a2a]">{tr(c.name, locale)}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );

  const machinePanel = (p: PieceInfo) => (
    <div className="flex flex-col gap-2" data-testid="machine-panel">
      <div className="flex items-start gap-2">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#fff1df] text-3xl" aria-hidden="true">
          {MACHINE_ICON[p.machine] ?? '⚙️'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold leading-tight text-[#4a2a12]">
            {tr(p.name, locale)} <span className="text-sm font-semibold text-[#a0703a]">· {p.cell}</span>
          </p>
          <p className="line-clamp-2 text-xs font-semibold text-[#6b4a2a]">{p.locked ? `📌 ${tr(T.locked, locale)} · ` : ''}{tr(p.does, locale)}</p>
        </div>
        <SayButton texts={[tr(p.name, locale), tr(p.does, locale), tr(p.dialText, locale)]} locale={locale} size="sm" />
        <button type="button" onClick={() => send({ type: 'deselect' })} aria-label={tr(T.close, locale)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f6efe6] text-lg font-bold text-[#8a4a1a]">
          ✕
        </button>
      </div>
      {!p.dialLocked && hud ? <DialEditor piece={p} hud={hud} locale={locale} send={(dial) => send({ type: 'dial', dial })} /> : null}
      {!p.locked ? (
        <div className="flex gap-2" data-tv-row="">
          <Btn onClick={() => send({ type: 'rotate' })} label={tr(texts.UI.rotate, locale)} wide>
            <span className="text-xl">↻</span> {tr(texts.UI.rotate, locale)}
          </Btn>
          <Btn onClick={() => send({ type: 'remove' })} label={tr(texts.UI.remove, locale)} wide>
            <span className="text-xl">🧺</span> {tr(texts.UI.remove, locale)}
          </Btn>
        </div>
      ) : null}
    </div>
  );

  const trayPanel = () => {
    if (!hud || !hud.tray.length) return null;
    return (
      <div className="flex gap-1.5 overflow-x-auto pb-0.5" data-tv-row="" role="toolbar" aria-label={tr(T.tray, locale)}>
        {hud.tray.map((m, i) => (
          <motion.button
            key={m}
            type="button"
            whileTap={reduce ? undefined : { scale: 0.92 }}
            onClick={() => {
              unlockAudio();
              send({ type: 'tool', id: hud.tool === m ? null : m });
            }}
            aria-pressed={hud.tool === m}
            aria-label={tr(texts.MACHINE_TEXT[m]?.name ?? { fr: m, en: m }, locale)}
            data-testid={`tool-${m}`}
            data-tv-autofocus={i === 0 ? '' : undefined}
            className={`flex min-h-[64px] min-w-[64px] shrink-0 flex-col items-center justify-center rounded-2xl px-1.5 py-1 shadow-sm transition ${hud.tool === m ? 'bg-[#ffe7a8] ring-4 ring-[#ffb35c]' : 'bg-white ring-1 ring-[#f0d6b4]'}`}
          >
            <span className="text-2xl leading-none" aria-hidden="true">
              {MACHINE_ICON[m] ?? '⚙️'}
            </span>
            <span className="mt-0.5 max-w-[5.5rem] truncate text-[11px] font-bold leading-tight text-[#6b4a2a]">{tr(texts.MACHINE_TEXT[m]?.name ?? { fr: m, en: m }, locale)}</span>
          </motion.button>
        ))}
      </div>
    );
  };

  const controls = () => {
    if (!hud) return null;
    return (
      <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap" data-tv-row="">
        <Btn onClick={() => send({ type: 'undo' })} disabled={!hud.canUndo} label={tr(texts.UI.undo, locale)}>
          <span className="text-xl">↩</span>
        </Btn>
        <Btn onClick={() => send({ type: 'redo' })} disabled={!hud.canRedo} label={tr(texts.UI.redo, locale)}>
          <span className="text-xl">↪</span>
        </Btn>
        <motion.button
          type="button"
          whileTap={reduce ? undefined : { scale: 0.94 }}
          onClick={() => {
            unlockAudio();
            send({ type: 'go' });
          }}
          data-testid="go"
          aria-pressed={hud.running}
          className={`flex min-h-[60px] flex-1 items-center justify-center gap-2 rounded-2xl px-3 font-display text-xl max-sm:order-first max-sm:basis-full font-bold text-white shadow-[0_6px_20px_rgba(60,140,60,.35)] ${hud.running ? 'bg-gradient-to-r from-[#f0a24a] to-[#e2763c]' : 'bg-gradient-to-r from-[#56b45a] to-[#2f8f46]'}`}
        >
          {hud.running ? `⏸ ${tr(T.stop, locale)}` : `▶ ${tr(texts.UI.go, locale)}`}
        </motion.button>
        <Btn onClick={() => send({ type: 'step' })} label={tr(texts.UI.step, locale)} disabled={hud.running}>
          <span className="text-xl">⏭</span>
        </Btn>
        <Btn onClick={() => send({ type: 'speed', x: hud.speed === 1 ? 2 : 1 })} label={tr(hud.speed === 1 ? texts.UI.speed2 : texts.UI.speed1, locale)} active={hud.speed === 2}>
          <span className="font-display text-base">×{hud.speed === 1 ? 2 : 1}</span>
        </Btn>
        <Btn onClick={() => send({ type: 'reset' })} label={tr(texts.UI.reset, locale)}>
          <span className="text-xl">🔄</span>
        </Btn>
      </div>
    );
  };

  const hintBubble = () => {
    if (!hud?.hint) return null;
    return (
      <div className="pointer-events-auto flex w-full max-w-xl items-start gap-2 rounded-3xl bg-[#fffbe6] p-2.5 shadow-xl ring-2 ring-[#ffe08a]" role="status" data-testid="hint">
        <span className="text-2xl" aria-hidden="true">
          💡
        </span>
        <p className="flex-1 text-sm font-bold leading-snug text-[#4a2a12] sm:text-base">{tr(hud.hint.text, locale)}</p>
        <div className="flex shrink-0 flex-col gap-1">
          <SayButton texts={[tr(hud.hint.text, locale)]} locale={locale} size="sm" />
          {hud.hint.canShow ? (
            <button type="button" onClick={() => send({ type: 'showHint' })} className="min-h-[44px] rounded-xl bg-[#ffe08a] px-2 text-xs font-bold text-[#5a3410]">
              🪄 {tr(T.showMe, locale)}
            </button>
          ) : null}
          <button type="button" onClick={() => send({ type: 'dismissHint' })} aria-label={tr(T.close, locale)} className="min-h-[36px] rounded-xl bg-white/80 text-sm font-bold text-[#8a4a1a]">
            ✕
          </button>
        </div>
      </div>
    );
  };

  const sharePanel = () => (
    <div className="pointer-events-auto flex flex-wrap items-center gap-1.5" data-tv-row="">
      <Btn onClick={() => send({ type: 'shareCode' })} label={tr(T.share, locale)} wide>
        🔗 {tr(T.share, locale)}
      </Btn>
      <label className="sr-only" htmlFor="factory-paste">
        {tr(T.pasteHere, locale)}
      </label>
      <input
        id="factory-paste"
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
        placeholder={tr(T.pasteHere, locale)}
        className="min-h-[48px] min-w-0 flex-1 rounded-2xl bg-white px-3 text-sm ring-1 ring-[#f0d6b4]"
        autoComplete="off"
        spellCheck={false}
      />
      <Btn onClick={() => send({ type: 'loadCode', code: paste })} disabled={!paste.trim()} label={tr(T.load, locale)}>
        📥
      </Btn>
    </div>
  );

  const bottomPanel = () => {
    if (!hud || mode === 'idle') return null;
    const body = hud.slot ? slotPanel(hud.slot) : hud.selected ? machinePanel(hud.selected) : trayPanel();
    return (
      <div className="pointer-events-auto w-full max-w-3xl rounded-[1.75rem] bg-[#fffaf1]/95 p-2 shadow-[0_8px_30px_rgba(60,30,10,.28)] ring-1 ring-white sm:p-3" data-tv-stage="">
        {body ? <div className="mb-2 max-h-[34vh] overflow-y-auto">{body}</div> : null}
        {hud.ideas.length && !hud.selected && !hud.slot ? <p className="mb-1.5 px-1 text-xs font-semibold text-[#7d63b0]">💡 {hud.ideas.map((i) => tr(i, locale)).join(' · ')}</p> : null}
        {mode === 'sandbox' && !hud.selected ? <div className="mb-2">{sharePanel()}</div> : null}
        {controls()}
      </div>
    );
  };

  /* ── Level map ── */

  const levelMap = () => {
    if (!hud || mode !== 'idle') return null;
    return (
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 top-[4.25rem] overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 sm:top-[4.75rem] lg:right-auto lg:w-[30rem]" data-tv-stage="">
        <div ref={mapRef} className="mx-auto flex max-w-3xl flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-3xl bg-white/90 p-3 shadow-lg ring-1 ring-white">
            <h2 className="font-display text-xl font-bold text-[#4a2a12]">🏭 {tr(T.map, locale)}</h2>
            <div className="flex items-center gap-1.5" role="radiogroup" aria-label={tr(T.band, locale)}>
              {(['little', 'middle', 'big'] as const).map((b) => (
                <button key={b} type="button" role="radio" aria-checked={band === b} onClick={() => setBand(b)} className={`min-h-[44px] rounded-full px-3 text-sm font-bold ring-1 ${band === b ? 'bg-[#ffe08a] ring-[#ffb35c] text-[#5a3410]' : 'bg-[#fff8ee] ring-[#f0d6b4] text-[#6b4a2a]'}`}>
                  {tr(BAND_LABEL[b], locale)}
                </button>
              ))}
            </div>
          </div>
          {HALLS.map((h) => {
            const levels = LEVELS.filter((l) => l.hall === h);
            const open = hud.hallsOpen[h];
            return (
              <section key={h} className={`rounded-3xl p-3 shadow-lg ring-1 ${open ? 'bg-[#fffaf1]/95 ring-white' : 'bg-white/70 ring-white/60'}`} aria-label={tr(texts.HALL_NAMES[h], locale)}>
                <h3 className="mb-2 flex items-center gap-2 font-display text-lg font-bold text-[#4a2a12]">
                  <span aria-hidden="true">{HALL_EMOJI[h]}</span> {tr(texts.HALL_NAMES[h], locale)}
                  {!open ? <span className="text-xs font-semibold text-[#8a6a4a]">· {tr(T.closedHall, locale)}</span> : null}
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1" data-tv-row="">
                  {levels.map((l, i) => {
                    const bandDone = (hud.done[l.id] ?? []).includes(band);
                    const o = l.bands[band].orders[0];
                    const toy = o?.toy ?? o?.sequence?.[0]?.toy;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        disabled={!open}
                        onClick={() => openLevel(l.id)}
                        data-testid={`level-${l.number}`}
                        data-tv-autofocus={open && i === 0 && h === HALLS.find((x) => hud.hallsOpen[x]) ? '' : undefined}
                        className={`flex min-h-[64px] items-center gap-2 rounded-2xl px-3 py-2 text-left shadow-sm ring-1 transition ${bandDone ? 'bg-[#e9f8e4] ring-[#a8dc98]' : 'bg-white ring-[#f0d6b4] hover:bg-[#fff6ea]'} disabled:opacity-50`}
                      >
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#fff1df] text-2xl" aria-hidden="true">
                          {toy ? (getToy(toy)?.emoji ?? '🎁') : '🎁'}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-bold text-[#a0703a]">{l.number}</span>
                          <span className="block text-sm font-bold leading-tight text-[#4a2a12]">{tr(l.title, locale)}</span>
                        </span>
                        {bandDone ? <span aria-label="✓">✅</span> : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <button type="button" onClick={() => send({ type: 'openSandbox' })} data-testid="sandbox" className="flex min-h-[72px] items-center gap-3 rounded-3xl bg-gradient-to-r from-[#7fcfb5] to-[#8fc8ff] p-3 text-left shadow-lg">
            <span className="text-4xl" aria-hidden="true">
              🧰
            </span>
            <span>
              <span className="block font-display text-lg font-bold text-[#1f3a4a]">{tr(texts.UI.sandbox, locale)}</span>
              <span className="block text-sm font-semibold text-[#1f3a4a]">{tr(T.sandboxCard, locale)}</span>
            </span>
          </button>
          <p className="rounded-2xl bg-white/80 px-3 py-2 text-center text-sm font-semibold text-[#6b4a2a]">
            🎁 {hud.shelfCount} {tr(T.shelf, locale)} · 📖 {hud.catalogue.length}
          </p>
        </div>
      </div>
    );
  };

  /* ── Catalogue ── */

  const catalogueDialog = () => {
    if (!catalogue || !hud) return null;
    return (
      <div className="pointer-events-auto absolute inset-0 z-20 flex items-end justify-center bg-[#2b1a12]/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="factory-cat">
        <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-[2rem] bg-[#fffaf1] p-4 shadow-2xl">
          <div className="mb-2 flex items-center gap-2">
            <h2 id="factory-cat" className="flex-1 font-display text-2xl font-bold text-[#4a2a12]">
              📖 {tr(texts.UI.catalogue, locale)}
            </h2>
            <SayButton texts={[tr(texts.UI.catalogue, locale), tr(T.catalogueHint, locale), ...hud.catalogue.slice(-6).map((c) => tr(c.name, locale))]} locale={locale} size="sm" />
            <button type="button" onClick={() => setCatalogue(false)} data-tv-autofocus="" aria-label={tr(T.close, locale)} className="grid h-11 w-11 place-items-center rounded-full bg-[#f6efe6] font-bold text-[#8a4a1a]">
              ✕
            </button>
          </div>
          {hud.catalogue.length === 0 ? <p className="py-6 text-center font-semibold text-[#6b4a2a]">{tr(T.catalogueEmpty, locale)}</p> : null}
          <ul className="grid grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {[...hud.catalogue].reverse().map((c) => {
              const id = identifyToy({ id: 0, ...c.item });
              const toy = id ? getToy(id) : null;
              const emoji = c.item.wrap ? '🎁' : (toy?.emoji ?? (c.item.shape ? SHAPE_ICON[c.item.shape] : MATERIAL_ICON[c.item.material]));
              return (
                <li key={c.key} className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-[#f0d6b4]">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#fff1df] text-2xl" aria-hidden="true">
                    {emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold leading-tight text-[#4a2a12]">{tr(c.name, locale)}</span>
                    <span className="block text-xs font-semibold text-[#a0703a]">
                      {c.item.color ? COLOR_ICON[c.item.color] : ''}
                      {c.item.sticker ? STICKER_ICON[c.item.sticker] : ''} {c.wished ? `⭐ ${tr(T.wished, locale)}` : `✨ ${tr(T.surprise, locale)}`} · ×{c.count}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  };

  /* ── Letter done ── */

  const doneDialog = () => {
    if (!done) return null;
    const writer = hud?.letters[0];
    const toy = getToy(done.toy);
    return (
      <div className="pointer-events-auto absolute inset-0 z-20 flex items-end justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center" role="dialog" aria-modal="true" aria-labelledby="factory-done">
        <motion.div initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-[2rem] bg-white p-5 text-center shadow-2xl ring-1 ring-white">
          <div className="mx-auto mb-1 flex items-end justify-center gap-1 text-5xl" aria-hidden="true">
            <span>{writer?.emoji ?? '🐻'}</span>
            <span className="text-4xl">🤗</span>
            <span>{toy?.emoji ?? '🎁'}</span>
          </div>
          <h2 id="factory-done" className="font-display text-2xl font-bold text-[#4a2a12] sm:text-3xl">
            🎁 {tr(T.done, locale)}
          </h2>
          <p className="mt-1 font-semibold text-[#6b4a2a]">{tr(done.reason, locale)}</p>
          {writer ? <p className="mt-1 text-sm font-bold text-[#2f7d32]">{tr(texts.fillL(T.thanks, { fr: { name: writer.name.fr }, en: { name: writer.name.en } }), locale)}</p> : null}
          {gain ? (
            <div className="mt-2">
              <p className="text-lg font-bold text-[#d0662a]">
                +{gain.xp} {tr(T.xp, locale)} ⭐
              </p>
              <MomentChips moments={gain.magic} locale={locale} />
            </div>
          ) : null}
          <div className="mt-4 flex flex-col gap-2" data-tv-row="">
            {nextLevel ? (
              <button type="button" onClick={() => openLevel(nextLevel)} data-tv-autofocus="" data-testid="next-letter" className="min-h-[56px] rounded-full bg-gradient-to-r from-[#56b45a] to-[#2f8f46] px-6 text-lg font-bold text-white shadow-lg">
                ✉️ {tr(T.next, locale)}
              </button>
            ) : null}
            <button type="button" onClick={() => { setDone(null); send({ type: 'openMap' }); }} data-tv-autofocus={nextLevel ? undefined : ''} className="min-h-[56px] rounded-full bg-[#fff1e0] px-6 text-lg font-bold text-[#8a4a1a]">
              🏭 {tr(T.toMap, locale)}
            </button>
            <button type="button" onClick={() => setDone(null)} className="min-h-[48px] rounded-full px-6 text-sm font-bold text-[#8a4a1a] underline">
              {tr(T.stay, locale)}
            </button>
          </div>
          {gain ? <MagicMoments key={gain.id} moments={gain.magic} locale={locale} /> : null}
        </motion.div>
      </div>
    );
  };

  const shareDialog = () => {
    if (!share) return null;
    return (
      <div className="pointer-events-auto absolute inset-0 z-20 flex items-end justify-center bg-[#2b1a12]/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="factory-share">
        <div className="w-full max-w-lg rounded-[2rem] bg-[#fffaf1] p-4 shadow-2xl">
          <h2 id="factory-share" className="mb-1 font-display text-xl font-bold text-[#4a2a12]">
            🔗 {tr(T.share, locale)}
          </h2>
          <p className="mb-2 text-sm font-semibold text-[#6b4a2a]">{tr(T.shareHow, locale)}</p>
          <textarea readOnly value={share.code} rows={3} className="w-full break-all rounded-2xl bg-white p-2 font-mono text-xs ring-1 ring-[#f0d6b4]" aria-label={tr(T.share, locale)} onFocus={(e) => e.currentTarget.select()} data-testid="share-code" />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(share.code).then(
                  () => setShare({ ...share, copied: true }),
                  () => setShare({ ...share, copied: false })
                );
              }}
              data-tv-autofocus=""
              className="min-h-[52px] flex-1 rounded-full bg-[#ffe08a] px-4 font-bold text-[#5a3410]"
            >
              📋 {share.copied ? tr(T.copied, locale) : tr(texts.UI.shareCopy, locale)}
            </button>
            <button type="button" onClick={() => setShare(null)} className="min-h-[52px] rounded-full bg-[#f6efe6] px-4 font-bold text-[#8a4a1a]">
              {tr(T.close, locale)}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
    {/* Server-rendered title (search engines, no-JS); the game covers it once mounted, above the site header. */}
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="font-display text-4xl font-bold text-white">{tr(T.title, locale)}</h1>
      <p className="text-lg font-semibold text-[#fff3e0]">{tr(T.teaser, locale)}</p>
    </main>
    <BodyPortal>
    <div ref={rootRef} className="fixed inset-0 z-[60] overflow-hidden bg-[#2b1a12] font-sans text-[#33264a]" data-tv-scope="">
      {phase === 'play' ? (
        <GameHost<FactoryEvents, FactoryCommands>
          load={() => import('@/games3d/lutin-factory/FactoryGame').then((m) => m.factoryGame)}
          locale={locale}
          options={hostOptions}
          onReady={(h) => {
            host.current = h;
            h.command({ type: 'music', on: music });
          }}
          onEvent={onEvent}
          onError={() => {
            setSupported(false);
            setPhase('intro');
          }}
          style={{ position: 'absolute', inset: 0 }}
        />
      ) : null}

      {phase === 'play' ? (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(40,20,8,.38)_100%)]" aria-hidden="true" />
          <div ref={topRef} className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:p-3">
            {topBar()}
            {letterCard()}
          </div>
          {!hud?.ready ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <p className="rounded-full bg-white/90 px-5 py-3 font-bold text-[#6b4a2a] shadow-lg" role="status">
                {tr(T.loading, locale)}
              </p>
            </div>
          ) : null}
          {levelMap()}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-3">
            <AnimatePresence>
              {toast && mode !== 'idle' ? (
                <motion.div
                  key={toast.id}
                  initial={reduce ? false : { opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  role="status"
                  className="pointer-events-none flex max-w-xl items-start gap-2 rounded-3xl bg-white px-3 py-2 text-sm font-bold shadow-xl ring-2 ring-[#ffd6b0] sm:text-base"
                >
                  {toast.who === 'ziggy' ? (
                    <ZiggyAvatar size={30} ring={false} className="mt-0.5" />
                  ) : toast.who in WHO_EMOJI ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/lutins/refs/avatars/${toast.who}.png`} alt="" width={30} height={30} className="mt-0.5 h-[30px] w-[30px] rounded-full bg-[#fff1df] object-cover" />
                  ) : (
                    <span className="text-2xl leading-none" aria-hidden="true">
                      ✉️
                    </span>
                  )}
                  <span className="line-clamp-4">{toast.lines.map((l) => tr(l, locale)).join(' ')}</span>
                </motion.div>
              ) : null}
            </AnimatePresence>
            {hintBubble()}
            {shareMsg ? (
              <button type="button" onClick={() => setShareMsg(null)} className="pointer-events-auto rounded-full bg-white px-4 py-2 text-sm font-bold text-[#6b4a2a] shadow-lg" role="status">
                {tr(shareMsg, locale)} ✕
              </button>
            ) : null}
            <div ref={bottomRef} className="flex w-full flex-col items-center">
              {bottomPanel()}
            </div>
          </div>
          {catalogueDialog()}
          {doneDialog()}
          {shareDialog()}
        </>
      ) : null}

      {phase === 'intro' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-gradient-to-b from-[#3a2a5a] via-[#7a4a3a] to-[#e2a06a] p-6 text-center">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {['❄️', '⭐', '🎁', '🧸', '🚂', '🎨', '🔧', '❄️', '⭐', '🪀'].map((e, i) => (
              <motion.span
                key={i}
                className="absolute text-3xl opacity-60"
                style={{ left: `${(i * 23 + 7) % 95}%`, top: `${(i * 37 + 11) % 90}%` }}
                animate={reduce ? undefined : { y: [0, -12, 0], rotate: [0, 8, 0] }}
                transition={{ duration: 3 + (i % 4), repeat: Infinity, delay: (i % 5) * 0.4 }}
              >
                {e}
              </motion.span>
            ))}
          </div>
          <div className="relative flex items-end justify-center gap-1" aria-hidden="true">
            {(['pepin', 'grelotte'] as const).map((id) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={id} src={`/lutins/refs/avatars/${id}.png`} alt="" width={88} height={88} className="h-20 w-20 rounded-full bg-white/80 object-cover shadow-lg ring-4 ring-white/70 sm:h-24 sm:w-24" />
            ))}
            <div className="grid h-36 w-36 place-items-end justify-center overflow-hidden rounded-full bg-white/80 shadow-[0_20px_60px_rgba(255,180,90,.45)] ring-8 ring-white/70">
              <MascotCutout pose="wave" width={116} glow={false} className="translate-y-3" />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lutins/refs/avatars/noisette.png" alt="" width={72} height={72} className="h-16 w-16 rounded-full bg-white/80 object-cover shadow-lg ring-4 ring-white/70 sm:h-20 sm:w-20" />
          </div>
          <h1 className="relative font-display text-4xl font-bold text-white drop-shadow sm:text-6xl">{tr(T.title, locale)}</h1>
          <p className="relative max-w-lg text-lg font-semibold text-[#fff3e0]">{tr(T.teaser, locale)}</p>
          <p className="relative flex max-w-md items-center gap-2 text-sm font-semibold text-[#fff3e0]">
            {tr(T.how, locale)}
            <SayButton texts={[tr(T.teaser, locale), tr(T.how, locale)]} locale={locale} size="sm" />
          </p>
          {supported ? (
            <button
              type="button"
              disabled={!hydrated}
              onClick={start}
              data-tv-autofocus=""
              data-testid="play"
              className="relative mt-1 min-h-[64px] rounded-full bg-gradient-to-r from-[#56b45a] to-[#2f8f46] px-10 py-4 text-xl font-bold text-white shadow-[0_10px_40px_rgba(40,120,60,.45)] transition hover:scale-105 disabled:opacity-60"
            >
              🏭 {tr(T.play, locale)}
            </button>
          ) : (
            <p className="relative rounded-2xl bg-white/90 px-4 py-3 font-semibold">{tr(T.noWebgl, locale)}</p>
          )}
          <Link href="/lutins/jeux" className="relative text-sm font-semibold text-[#fff3e0] underline">
            ← {tr(T.back, locale)}
          </Link>
        </div>
      ) : null}
    </div>
    </BodyPortal>
    </>
  );
}
