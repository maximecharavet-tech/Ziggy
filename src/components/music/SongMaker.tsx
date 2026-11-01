'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { CHALLENGES, DRUMS, MELODY, SOUNDS, SOUND_NAME, TUNES, decode, emptySong, encode, noteCount, resize, surprise, toggle, tuneToSong, type Song } from '@/games2d/music/song';
import type { Band } from '@/games2d/music/synth';
import { tr, type L } from '@/lib/i18n-text';
import { SayButton } from '@/components/arcade/read-aloud';
import { Ziggy3D, type ZiggyCue } from '@/components/ziggy3d/Ziggy3D';
import { Burst } from '@/components/create/fx/Burst';
import { StudioFrame } from '@/components/create/fx/StudioFrame';
import { fx, shade, toy } from '@/components/create/fx/toy';
import { Glyph } from '@/components/create/fx/ZiggyMark';
import { getMemory, useWorldMemory } from '@/lib/world/store';
import { readAloudOn } from '@/lib/world/memory';
import { speakSequence } from '@/lib/voice';
import { finishExtraGame } from '@/lib/world/play';
import m from './music.module.css';

const T = {
  eyebrow: { fr: 'La Fabrique à chansons', en: 'The Song Factory' },
  title: { fr: 'Compose ta chanson avec les animaux', en: 'Compose your song with the animals' },
  subtitle: { fr: 'Touche les cases pour poser des notes. Ici, aucune note ne sonne faux !', en: 'Tap the squares to place notes. Here, no note can sound wrong!' },
  play: { fr: 'Jouer', en: 'Play' },
  stop: { fr: 'Stop', en: 'Stop' },
  clear: { fr: 'Effacer', en: 'Clear' },
  sure: { fr: 'Sûr ?', en: 'Sure?' },
  surprise: { fr: 'Surprise', en: 'Surprise' },
  tunes: { fr: 'Comptines', en: 'Nursery tunes' },
  sound: { fr: 'Instrument', en: 'Instrument' },
  tempo: { fr: 'Vitesse', en: 'Speed' },
  long: { fr: '16 temps', en: '16 beats' },
  short: { fr: '8 temps', en: '8 beats' },
  challenges: { fr: 'Petits défis', en: 'Little challenges' },
  save: { fr: 'Garder ma chanson', en: 'Keep my song' },
  mine: { fr: 'Mes chansons', en: 'My songs' },
  share: { fr: 'Copier le lien', en: 'Copy the link' },
  copied: { fr: 'Lien copié !', en: 'Link copied!' },
  done: { fr: 'Défi réussi !', en: 'Challenge done!' },
  beats: { fr: 'Chaque case = un demi-temps (une croche). 2 cases = 1 temps.', en: 'Each square = half a beat (an eighth note). 2 squares = 1 beat.' },
  band: { fr: 'L’orchestre des animaux : touche un animal pour l’écouter', en: 'The animal band: tap an animal to hear it' },
  board: { fr: 'La grille des notes', en: 'The note board' },
  noSongs: { fr: 'Garde ta chanson : elle apparaîtra ici.', en: 'Keep your song: it will show up here.' },
  remove: { fr: 'Retirer', en: 'Remove' },
} satisfies Record<string, L>;

const SAVE_KEY = 'ziggy:songs';
type Saved = { id: string; emoji: string; code: string; at: string };
const EMOJIS = ['🎵', '🌈', '🚀', '🌙', '🦄', '🐉', '🌻', '⭐'];
const CASSETTE = ['#FF7AB8', '#FFB13B', '#7FC85C', '#5FB6EA', '#B07CFF', '#FF6B6B', '#2DD4BF', '#FFD447'];

function loadSaved(): Saved[] {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) ?? '[]') as Saved[];
  } catch {
    return [];
  }
}

export function SongMaker() {
  const locale = useLocale();
  const reduce = useReducedMotion();
  const memory = useWorldMemory();
  const big = memory.age === 'big';
  const [song, setSong] = useState<Song>(() => emptySong(8));
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [armed, setArmed] = useState(false);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [done, setDone] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [cue, setCue] = useState<{ kind: ZiggyCue; id: number } | null>(null);
  const [party, setParty] = useState(0);
  const [tick, setTick] = useState(0);
  const band = useRef<Band | null>(null);
  const started = useRef(performance.now());

  useEffect(() => {
    setSaved(loadSaved());
    const code = new URLSearchParams(window.location.search).get('chanson');
    const s = code ? decode(code) : null;
    if (s) setSong(s);
    else if (getMemory().age === 'big') setSong(emptySong(16));
  }, []);

  const getBand = async () => {
    if (!band.current) {
      const { Band } = await import('@/games2d/music/synth');
      band.current = new Band();
      band.current.onStep = (s) => {
        setStep(s);
        setTick((t) => t + 1);
      };
    }
    return band.current;
  };

  useEffect(() => {
    if (band.current) band.current.song = song;
  }, [song]);
  useEffect(() => () => band.current?.dispose(), []);

  // Gentle challenges: celebrate (and count) each one once.
  useEffect(() => {
    for (const c of CHALLENGES) {
      if (done.includes(c.id) || !c.check(song)) continue;
      setDone((d) => [...d, c.id]);
      setToast(`🏅 ${tr(T.done, locale)} ${tr(c.text, locale)}`);
      setCue({ kind: 'cheer', id: Date.now() });
      setParty((p) => p + 1);
      finishExtraGame('fabrique_chansons', 'music', { correct: 1, mistakes: 0, total: 1 }, performance.now() - started.current);
      if (readAloudOn(getMemory())) void speakSequence('song-ch', [tr(T.done, locale)], locale);
      break;
    }
  }, [song, done, locale]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const tap = async (row: number, col: number) => {
    const next = toggle(song, row, col);
    setSong(next);
    if (next.grid[row][col]) (await getBand()).preview(row, song.sound);
  };

  const hear = async (row: number) => (await getBand()).preview(row, song.sound);

  const togglePlay = async () => {
    const b = await getBand();
    if (b.playing) {
      b.stop();
      setPlaying(false);
    } else {
      b.play(song);
      setPlaying(b.playing);
    }
  };

  const save = () => {
    const item: Saved = { id: Math.random().toString(36).slice(2), emoji: EMOJIS[saved.length % EMOJIS.length], code: encode(song), at: new Date().toISOString() };
    const next = [item, ...saved].slice(0, 24);
    setSaved(next);
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(next));
    } catch {
      /* storage full or blocked */
    }
    setToast('💾 ✓');
    setParty((p) => p + 1);
  };

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}?chanson=${encode(song)}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast(tr(T.copied, locale));
    } catch {
      window.history.replaceState(null, '', `?chanson=${encode(song)}`);
    }
  };

  const rows = useMemo(() => [...MELODY.map((r, i) => ({ ...r, row: i, drum: false })), ...DRUMS.map((d, i) => ({ ...d, row: MELODY.length + i, drum: true }))], []);
  const hit = (row: number) => playing && step >= 0 && song.grid[row][step];
  const count = noteCount(song);

  return (
    <StudioFrame eyebrow={tr(T.eyebrow, locale)} emoji="🎶" title={tr(T.title, locale)} subtitle={tr(T.subtitle, locale)} color="#8B5CF6" locale={locale} props={['🎹', '🥁', '🎺', '🎸']}>
      {/* ── The stage: Ziggy dances with the animal band ── */}
      <div className={`${m.stage} relative overflow-hidden rounded-[2.4rem] shadow-[0_10px_0_#24125c,0_40px_60px_-30px_rgba(40,10,120,0.8)]`}>
        <div className={`${m.curtain} absolute inset-x-0 top-0 z-[1]`} aria-hidden="true" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {[16, 50, 84].map((x, i) => (
            <div
              key={x}
              className={`${m.beam} absolute -top-4 h-[115%] w-28 -translate-x-1/2 ${fx.sway}`}
              style={{ left: `${x}%`, opacity: playing ? 0.95 : 0.4, '--tilt': `${i === 1 ? 4 : i ? -10 : 10}deg`, '--dur': `${5 + i}s` } as CSSProperties}
            />
          ))}
        </div>

        <div className="relative z-[2] flex flex-col items-center px-3 pb-6 pt-8 sm:flex-row sm:items-end sm:gap-2 sm:px-6 sm:pt-10">
          {/* Ziggy, the conductor */}
          <div className="relative h-36 w-28 shrink-0 sm:h-60 sm:w-44">
            <Ziggy3D className="h-full w-full" idle={playing ? 'dance' : 'calm'} cue={cue} framing="full" fallback="wave" label="Ziggy" />
            <div className="pointer-events-none absolute -bottom-1 left-1/2 h-4 w-3/4 -translate-x-1/2 rounded-[50%] bg-black/30 blur-[2px]" aria-hidden="true" />
            <Burst fire={party} kind="notes" count={16} colors={['#FFD447', '#FF7AB8', '#7FE3FF', '#B6FF8F']} />
          </div>

          {/* The band */}
          <div className="relative w-full flex-1" role="group" aria-label={tr(T.band, locale)}>
            <div className={`${m.floor} absolute inset-x-0 bottom-0 h-10 rounded-[50%] sm:h-12`} aria-hidden="true" />
            <div className="relative flex items-end justify-between gap-0.5 px-1 pb-4 sm:gap-1.5 sm:px-4 sm:pb-5">
              {rows.map((r) => {
                const on = hit(r.row);
                const edge = shade(r.color, -0.35);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => void hear(r.row)}
                    aria-label={tr(r.name, locale)}
                    title={tr(r.name, locale)}
                    className="group relative flex min-w-0 flex-1 flex-col items-center rounded-2xl pt-6 focus-visible:outline focus-visible:outline-4 focus-visible:outline-white/80"
                  >
                    {on ? (
                      <span key={`n${tick}`} aria-hidden="true" className={`${m.note} absolute left-1/2 top-0 text-lg font-black sm:text-2xl`} style={{ color: r.color, '--dx': `${(r.row % 3) * 8 - 8}px`, '--r': `${(r.row % 2 ? -1 : 1) * 14}deg` } as CSSProperties}>
                        {r.row % 2 ? '♫' : '♪'}
                      </span>
                    ) : null}
                    <span key={on ? `h${tick}` : 'idle'} className={`relative block text-[1.7rem] leading-none drop-shadow-[0_6px_4px_rgba(0,0,0,0.3)] transition-transform group-active:scale-90 sm:text-[2.6rem] lg:text-[3.1rem] ${on ? m.hop : ''} ${!on && playing && !reduce ? m.dance : ''}`} aria-hidden="true">
                      {r.emoji}
                    </span>
                    <span data-hit={on ? '' : undefined} className={`${m.pedestal} mt-1 block h-3 w-[86%] max-w-14 rounded-[50%] sm:h-4`} style={{ '--c': r.color, '--edge': edge } as CSSProperties} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Marquee lamps: the beat */}
        <div className="relative z-[2] flex justify-center gap-1.5 pb-4 sm:gap-2.5" aria-hidden="true">
          {Array.from({ length: song.steps }, (_, i) => (
            <span key={i} data-on={playing && step === i ? '' : undefined} className={`${m.lamp} block h-2.5 w-2.5 rounded-full sm:h-3 sm:w-3 ${i % 2 ? 'opacity-25' : ''}`} />
          ))}
        </div>
      </div>

      {/* ── The note board ── */}
      <div className={`${m.board} relative -mx-3 mt-8 rounded-[1.6rem] p-2 sm:rounded-[2rem] sm:p-5 ${song.steps === 8 ? 'sm:mx-auto sm:w-fit' : 'sm:mx-0'}`}>
        <div className="overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
          <div
            className={`grid gap-[3px] sm:gap-1.5 ${song.steps === 16 ? 'w-full min-w-max' : 'w-full justify-center sm:w-[42rem]'}`}
            style={{ gridTemplateColumns: song.steps === 16 ? `auto repeat(16, minmax(40px, 1fr))` : `auto repeat(8, minmax(0, 72px))` }}
            role="group"
            aria-label={tr(T.board, locale)}
          >
            {rows.map((r) => {
              const edge = shade(r.color, -0.35);
              const gap = r.drum && r.row === MELODY.length ? 'mt-3 sm:mt-4' : '';
              return (
                <div key={r.id} className="contents">
                  <div className={`sticky start-0 z-[1] flex items-center rounded-e-2xl bg-[#f5f1ff] pe-0.5 dark:bg-[#1e1840] sm:pe-2 ${gap}`}>
                    <button
                      type="button"
                      onClick={() => void hear(r.row)}
                      aria-label={tr(r.name, locale)}
                      title={tr(r.name, locale)}
                      className={`${m.badge} grid h-8 w-8 place-items-center rounded-xl text-[1.15rem] sm:h-12 sm:w-12 sm:rounded-2xl sm:text-[1.7rem]`}
                      style={{ '--c': r.color, '--edge': edge } as CSSProperties}
                    >
                      <span aria-hidden="true">{r.emoji}</span>
                    </button>
                  </div>
                  {song.grid[r.row].map((on, c) => {
                    const now = playing && step === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={on}
                        aria-label={`${tr(r.name, locale)} ${c + 1}`}
                        onClick={() => void tap(r.row, c)}
                        data-now={now ? '' : undefined}
                        data-alt={Math.floor(c / 4) % 2 ? '' : undefined}
                        className={`${m.cell} aspect-square w-full ${gap}`}
                        style={{ '--c': r.color, '--edge': edge } as CSSProperties}
                      >
                        <AnimatePresence initial={false}>
                          {on ? (
                            <motion.span
                              key="pad"
                              initial={{ scale: 0.2, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.3, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 520, damping: 18 }}
                              className="absolute inset-0"
                            >
                              <span key={now ? `b${tick}` : 'still'} data-now={now ? '' : undefined} className={`${m.pad} ${now ? m.beat : ''}`} />
                            </motion.span>
                          ) : null}
                        </AnimatePresence>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        {big ? <p className="mt-3 text-center text-xs font-semibold text-text-muted">{tr(T.beats, locale)}</p> : null}
      </div>

      {/* ── The deck ── */}
      <div className="mt-9 flex flex-wrap items-center justify-center gap-x-3 gap-y-5">
        <button
          type="button"
          onClick={() => void togglePlay()}
          aria-pressed={playing}
          className={`${fx.toy} ${playing ? '' : fx.sheen} inline-flex min-h-[72px] items-center gap-3 rounded-full px-8 font-display text-2xl font-bold`}
          style={toy(playing ? '#F2647B' : '#22C55E', { depth: 8 })}
        >
          <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-white/25 text-xl">
            {playing ? '■' : '▶'}
          </span>
          {playing ? tr(T.stop, locale) : tr(T.play, locale)}
        </button>
        <button type="button" onClick={() => setSong(surprise(Math.floor(Math.random() * 1e6), song.steps, song.sound))} className={`${fx.toy} inline-flex min-h-14 items-center gap-2 rounded-full px-5 font-display text-lg font-bold`} style={toy('#B07CFF')}>
          <span aria-hidden="true" className={`inline-block ${fx.wiggle}`}>
            🎲
          </span>
          {tr(T.surprise, locale)}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!armed) return setArmed(true);
            setArmed(false);
            setSong(emptySong(song.steps, song.sound));
          }}
          onBlur={() => setArmed(false)}
          className={`${fx.toy} ${armed ? '' : fx.light} inline-flex min-h-14 items-center gap-2 rounded-full px-5 font-display text-lg font-bold`}
          style={armed ? toy('#F2647B') : undefined}
        >
          <span aria-hidden="true">🧽</span> {armed ? tr(T.sure, locale) : tr(T.clear, locale)}
        </button>
        <button type="button" onClick={() => setSong(resize(song, song.steps === 8 ? 16 : 8))} className={`${fx.toy} ${fx.light} inline-flex min-h-14 items-center gap-2 rounded-full px-5 font-display text-lg font-bold`}>
          <span aria-hidden="true" className="flex gap-0.5">
            {Array.from({ length: song.steps === 8 ? 4 : 2 }, (_, i) => (
              <span key={i} className="h-3 w-1.5 rounded-full bg-[#B07CFF]" />
            ))}
          </span>
          {song.steps === 8 ? tr(T.long, locale) : tr(T.short, locale)}
        </button>
        <label className={`${fx.toy} ${fx.light} flex min-h-14 items-center gap-3 rounded-full px-5`}>
          <span aria-hidden="true" className="text-2xl">
            🐢
          </span>
          <span className="sr-only">{tr(T.tempo, locale)}</span>
          <input type="range" min={70} max={160} value={song.tempo} onChange={(e) => setSong({ ...song, tempo: Number(e.target.value) })} className={`${m.slider} w-28 sm:w-36`} />
          <span aria-hidden="true" className="text-2xl">
            🐇
          </span>
        </label>
      </div>

      {/* Instruments */}
      <div className="mt-7 grid grid-cols-2 gap-3 sm:mx-auto sm:max-w-3xl sm:grid-cols-4" role="radiogroup" aria-label={tr(T.sound, locale)}>
        {SOUNDS.map((s, i) => {
          const on = song.sound === s;
          const c = ['#FFB13B', '#5FB6EA', '#FF7AB8', '#7FC85C'][i];
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={async () => {
                setSong({ ...song, sound: s });
                (await getBand()).preview(2, s);
              }}
              className={`${fx.toy} ${on ? fx.on : fx.light} flex min-h-[84px] flex-col items-center justify-center gap-1 rounded-[1.6rem] px-3 py-2 font-display text-base font-bold`}
              style={on ? toy(c, { ring: '#ffffff' }) : undefined}
            >
              <span aria-hidden="true" className={`text-[2rem] leading-none ${on ? fx.bob : ''}`}>
                <Glyph e={SOUND_NAME[s].emoji} size={34} />
              </span>
              {tr(SOUND_NAME[s], locale)}
            </button>
          );
        })}
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {/* Nursery tunes: records */}
        <section className="rounded-[2rem] bg-bg-card p-5 shadow-[0_8px_0_rgba(120,90,200,0.12),0_20px_40px_-24px_rgba(70,30,160,0.4)] ring-1 ring-black/5 dark:ring-white/10" aria-labelledby="tunes">
          <div className="flex items-center gap-3">
            <h2 id="tunes" className="flex-1 font-display text-xl font-bold text-text-body">
              🎼 {tr(T.tunes, locale)}
            </h2>
            <SayButton texts={[tr(T.tunes, locale), ...TUNES.map((t) => tr(t.name, locale))]} locale={locale} size="sm" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {TUNES.map((t, i) => (
              <button key={t.id} type="button" onClick={() => setSong(tuneToSong(t, song.sound))} className="group flex flex-col items-center gap-2 rounded-2xl p-1 text-center focus-visible:outline focus-visible:outline-4 focus-visible:outline-sky/50">
                <span className={`${m.record} relative grid aspect-square w-full max-w-24 place-items-center rounded-full transition-transform group-active:scale-95`} style={{ '--c': ['#FFD447', '#FF7AB8', '#5FB6EA'][i % 3] } as CSSProperties}>
                  <span aria-hidden="true" className="relative z-[1] text-2xl sm:text-3xl">
                    {t.emoji}
                  </span>
                </span>
                <span className="text-xs font-bold leading-tight text-text-body sm:text-sm">{tr(t.name, locale)}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Challenges: medals */}
        <section className="rounded-[2rem] bg-bg-card p-5 shadow-[0_8px_0_rgba(120,90,200,0.12),0_20px_40px_-24px_rgba(70,30,160,0.4)] ring-1 ring-black/5 dark:ring-white/10" aria-labelledby="challenges">
          <div className="flex items-center gap-3">
            <h2 id="challenges" className="flex-1 font-display text-xl font-bold text-text-body">
              🏅 {tr(T.challenges, locale)}
            </h2>
            <span className="rounded-full bg-[#FFD447]/25 px-3 py-1 text-sm font-black tabular-nums text-[#a86a00]">
              {done.length}/{CHALLENGES.length}
            </span>
            <SayButton texts={[tr(T.challenges, locale), ...CHALLENGES.map((c) => tr(c.text, locale))]} locale={locale} size="sm" />
          </div>
          <ul className="mt-3 grid gap-2">
            {CHALLENGES.map((c) => {
              const ok = done.includes(c.id);
              return (
                <li key={c.id} className={`flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold ${ok ? 'bg-[#22C55E]/12 text-[#15803d] dark:text-[#86efac]' : 'text-text-body'}`}>
                  <motion.span
                    initial={false}
                    animate={ok && !reduce ? { rotateY: [0, 360], scale: [1, 1.25, 1] } : {}}
                    transition={{ duration: 0.7 }}
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg ${ok ? 'bg-[radial-gradient(circle_at_35%_30%,#fff7c2,#ffd447_55%,#e3a008)] shadow-[0_3px_0_#b77f00]' : `${fx.slot}`}`}
                    aria-hidden="true"
                  >
                    {ok ? '★' : ''}
                  </motion.span>
                  {tr(c.text, locale)}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* My songs: cassettes */}
      <section className="mt-6 rounded-[2rem] bg-bg-card p-5 shadow-[0_8px_0_rgba(120,90,200,0.12),0_20px_40px_-24px_rgba(70,30,160,0.4)] ring-1 ring-black/5 dark:ring-white/10" aria-labelledby="mine">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="mine" className="font-display text-xl font-bold text-text-body">
            💾 {tr(T.mine, locale)}
          </h2>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={count === 0} onClick={save} className={`${fx.toy} inline-flex min-h-14 items-center gap-2 rounded-full px-5 font-display text-base font-bold`} style={toy('#8B5CF6')}>
              <span aria-hidden="true">💾</span> {tr(T.save, locale)}
            </button>
            <button type="button" disabled={count === 0} onClick={() => void share()} className={`${fx.toy} ${fx.light} inline-flex min-h-14 items-center gap-2 rounded-full px-5 font-display text-base font-bold`}>
              <span aria-hidden="true">🔗</span> {tr(T.share, locale)}
            </button>
          </div>
        </div>
        {saved.length ? (
          <ul className="mt-4 flex flex-wrap gap-3">
            {saved.map((s, i) => {
              const c = CASSETTE[i % CASSETTE.length];
              return (
                <li key={s.id} className="relative">
                  <button type="button" onClick={() => setSong(decode(s.code) ?? song)} className={`${fx.toy} flex h-16 w-24 flex-col items-center justify-center rounded-2xl`} style={toy(c)} aria-label={`${s.emoji} ${new Date(s.at).toLocaleString(locale)}`}>
                    <span aria-hidden="true" className="text-xl leading-none">
                      {s.emoji}
                    </span>
                    <span aria-hidden="true" className="mt-1 flex gap-3 rounded-full bg-black/20 px-2 py-0.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-white/90" />
                      <span className="h-2.5 w-2.5 rounded-full bg-white/90" />
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={tr(T.remove, locale)}
                    title={tr(T.remove, locale)}
                    onClick={() => {
                      const next = saved.filter((x) => x.id !== s.id);
                      setSaved(next);
                      try {
                        localStorage.setItem(SAVE_KEY, JSON.stringify(next));
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="absolute -end-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-white text-xs font-black text-text-muted shadow-md ring-1 ring-black/10 hover:text-coral dark:bg-[#2a2552]"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-text-muted">{tr(T.noSongs, locale)}</p>
        )}
      </section>

      <AnimatePresence>
        {toast ? (
          <motion.p
            key={toast}
            initial={{ opacity: 0, y: 30, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20 }}
            role="status"
            className="fixed bottom-6 left-1/2 z-50 w-max max-w-[92vw] -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,#8B5CF6,#6d3fd6)] px-6 py-3.5 text-center font-display text-base font-bold text-white shadow-[0_6px_0_#4c26a8,0_20px_40px_-12px_rgba(70,30,160,0.7)]"
          >
            {toast}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </StudioFrame>
  );
}
