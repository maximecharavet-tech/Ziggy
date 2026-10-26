'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { CHALLENGES, DRUMS, MELODY, SOUNDS, SOUND_NAME, TUNES, decode, emptySong, encode, noteCount, resize, surprise, toggle, tuneToSong, type Song } from '@/games2d/music/song';
import type { Band } from '@/games2d/music/synth';
import { tr, type L } from '@/lib/i18n-text';
import { AppPage } from '@/components/learn/AppPage';
import { SayButton } from '@/components/arcade/read-aloud';
import { getMemory, useWorldMemory } from '@/lib/world/store';
import { readAloudOn } from '@/lib/world/memory';
import { speakSequence } from '@/lib/voice';
import { finishExtraGame } from '@/lib/world/play';

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
} satisfies Record<string, L>;

const SAVE_KEY = 'ziggy:songs';
type Saved = { id: string; emoji: string; code: string; at: string };
const EMOJIS = ['🎵', '🌈', '🚀', '🌙', '🦄', '🐉', '🌻', '⭐'];

function loadSaved(): Saved[] {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) ?? '[]') as Saved[];
  } catch {
    return [];
  }
}

export function SongMaker() {
  const locale = useLocale();
  const memory = useWorldMemory();
  const big = memory.age === 'big';
  const [song, setSong] = useState<Song>(() => emptySong(8));
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [armed, setArmed] = useState(false);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [done, setDone] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
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
      band.current.onStep = setStep;
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
      finishExtraGame('fabrique_chansons', 'music', { correct: 1, mistakes: 0, total: 1 }, performance.now() - started.current);
      if (readAloudOn(getMemory())) void speakSequence('song-ch', [tr(T.done, locale)], locale);
      break;
    }
  }, [song, done, locale]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const tap = async (row: number, col: number) => {
    const next = toggle(song, row, col);
    setSong(next);
    if (next.grid[row][col]) (await getBand()).preview(row, song.sound);
  };

  const togglePlay = async () => {
    const b = await getBand();
    if (b.playing) {
      b.stop();
      setPlaying(false);
    } else {
      b.play(song);
      setPlaying(true);
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

  const rows = useMemo(() => [...MELODY.map((m, i) => ({ ...m, row: i, drum: false })), ...DRUMS.map((d, i) => ({ ...d, row: MELODY.length + i, drum: true }))], []);
  const active = (row: number) => step >= 0 && song.grid[row][step];

  return (
    <AppPage eyebrow={<>🎶 {tr(T.eyebrow, locale)}</>} title={tr(T.title, locale)} subtitle={tr(T.subtitle, locale)} color="#9B6BE8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-3 flex justify-center">
          <SayButton texts={[tr(T.subtitle, locale)]} locale={locale} />
        </div>

        {/* Stage: the animals dance when they play */}
        <div className="mb-4 flex items-end justify-center gap-2 sm:gap-4" aria-hidden="true">
          {rows.map((r) => (
            <motion.span
              key={r.id}
              className="text-3xl sm:text-5xl"
              animate={active(r.row) ? { y: [0, -18, 0], scale: [1, 1.25, 1], rotate: [0, -10, 0] } : { y: 0, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              {r.emoji}
            </motion.span>
          ))}
        </div>

        {/* Grid */}
        <div className="overflow-x-auto rounded-[2rem] border border-border/60 bg-bg-card p-3 shadow-sm sm:p-5">
          <div className="grid min-w-max gap-1.5" style={{ gridTemplateColumns: `auto repeat(${song.steps}, minmax(${song.steps === 16 ? 30 : 44}px, 1fr))` }} role="group" aria-label={tr(T.eyebrow, locale)}>
            {rows.map((r) => (
              <div key={r.id} className="contents">
                <div className={`flex items-center gap-1 pe-2 text-2xl ${r.drum && r.row === MELODY.length ? 'mt-3' : ''}`} title={tr(r.name, locale)}>
                  <span aria-hidden="true">{r.emoji}</span>
                  <span className="sr-only">{tr(r.name, locale)}</span>
                </div>
                {song.grid[r.row].map((on, c) => (
                  <motion.button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    aria-label={`${tr(r.name, locale)} ${c + 1}`}
                    onClick={() => void tap(r.row, c)}
                    whileTap={{ scale: 0.85 }}
                    animate={on && step === c ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className={`aspect-square rounded-xl border-2 transition-colors ${r.drum && r.row === MELODY.length ? 'mt-3' : ''} ${c % 4 === 0 ? 'ms-1' : ''}`}
                    style={{
                      backgroundColor: on ? r.color : step === c ? `${r.color}33` : c % 4 < 2 ? 'rgba(127,127,160,0.08)' : 'rgba(127,127,160,0.16)',
                      borderColor: on ? '#fff' : 'transparent',
                      boxShadow: on ? `0 4px 14px ${r.color}88` : 'none',
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          {big ? <p className="mt-3 text-center text-xs font-semibold text-text-muted">{tr(T.beats, locale)}</p> : null}
        </div>

        {/* Controls */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <motion.button type="button" whileTap={{ scale: 0.92 }} onClick={() => void togglePlay()} className={`min-h-[60px] rounded-full px-8 text-xl font-bold text-white shadow-lg ${playing ? 'bg-coral' : 'bg-green'}`}>
            {playing ? `⏹ ${tr(T.stop, locale)}` : `▶ ${tr(T.play, locale)}`}
          </motion.button>
          <button type="button" onClick={() => setSong(surprise(Math.floor(Math.random() * 1e6), song.steps, song.sound))} className="min-h-[52px] rounded-full bg-purple/15 px-5 font-bold text-purple">
            🎲 {tr(T.surprise, locale)}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!armed) return setArmed(true);
              setArmed(false);
              setSong(emptySong(song.steps, song.sound));
            }}
            onBlur={() => setArmed(false)}
            className={`min-h-[52px] rounded-full px-5 font-bold ${armed ? 'bg-coral text-white' : 'bg-border/50 text-text-body'}`}
          >
            🧽 {armed ? tr(T.sure, locale) : tr(T.clear, locale)}
          </button>
          <button type="button" onClick={() => setSong(resize(song, song.steps === 8 ? 16 : 8))} className="min-h-[52px] rounded-full bg-border/50 px-5 font-bold text-text-body">
            {song.steps === 8 ? tr(T.long, locale) : tr(T.short, locale)}
          </button>
          <label className="flex items-center gap-2 rounded-full bg-border/40 px-4 py-2 text-sm font-bold text-text-body">
            🐢
            <span className="sr-only">{tr(T.tempo, locale)}</span>
            <input type="range" min={70} max={160} value={song.tempo} onChange={(e) => setSong({ ...song, tempo: Number(e.target.value) })} className="w-28 accent-purple" />
            🐇
          </label>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2" role="radiogroup" aria-label={tr(T.sound, locale)}>
          {SOUNDS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={song.sound === s}
              onClick={async () => {
                setSong({ ...song, sound: s });
                (await getBand()).preview(2, s);
              }}
              className={`rounded-full px-4 py-2 text-sm font-bold ${song.sound === s ? 'bg-text-body text-bg' : 'border border-border bg-bg-card text-text-body'}`}
            >
              {SOUND_NAME[s].emoji} {tr(SOUND_NAME[s], locale)}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <section className="rounded-3xl bg-bg-card p-5 shadow-sm" aria-labelledby="tunes">
            <h2 id="tunes" className="font-display text-xl font-bold text-text-body">
              🎼 {tr(T.tunes, locale)}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {TUNES.map((t) => (
                <button key={t.id} type="button" onClick={() => setSong(tuneToSong(t, song.sound))} className="rounded-2xl border border-border bg-bg px-3 py-2 text-sm font-semibold text-text-body hover:border-purple">
                  {t.emoji} {tr(t.name, locale)}
                </button>
              ))}
            </div>
          </section>
          <section className="rounded-3xl bg-bg-card p-5 shadow-sm" aria-labelledby="challenges">
            <h2 id="challenges" className="font-display text-xl font-bold text-text-body">
              🏅 {tr(T.challenges, locale)}
            </h2>
            <ul className="mt-3 grid gap-2">
              {CHALLENGES.map((c) => (
                <li key={c.id} className={`flex items-center gap-2 text-sm ${done.includes(c.id) ? 'text-green' : 'text-text-body'}`}>
                  <span aria-hidden="true">{done.includes(c.id) ? '✅' : '⬜'}</span>
                  {tr(c.text, locale)}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="mt-6 rounded-3xl bg-bg-card p-5 shadow-sm" aria-labelledby="mine">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="mine" className="font-display text-xl font-bold text-text-body">
              💾 {tr(T.mine, locale)}
            </h2>
            <div className="flex gap-2">
              <button type="button" disabled={noteCount(song) === 0} onClick={save} className="rounded-full bg-purple px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
                {tr(T.save, locale)}
              </button>
              <button type="button" disabled={noteCount(song) === 0} onClick={() => void share()} className="rounded-full border border-border px-4 py-2 text-sm font-bold text-text-body disabled:opacity-40">
                🔗 {tr(T.share, locale)}
              </button>
            </div>
          </div>
          {saved.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {saved.map((s) => (
                <li key={s.id} className="flex items-center gap-1 rounded-full border border-border px-1 py-1">
                  <button type="button" onClick={() => setSong(decode(s.code) ?? song)} className="rounded-full px-3 py-1 text-xl" aria-label={new Date(s.at).toLocaleString(locale)}>
                    {s.emoji}
                  </button>
                  <button
                    type="button"
                    aria-label="✕"
                    onClick={() => {
                      const next = saved.filter((x) => x.id !== s.id);
                      setSaved(next);
                      try {
                        localStorage.setItem(SAVE_KEY, JSON.stringify(next));
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="grid h-7 w-7 place-items-center rounded-full text-xs text-text-muted hover:bg-border/50"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      <AnimatePresence>
        {toast ? (
          <motion.p key={toast} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-text-body px-5 py-3 text-sm font-bold text-bg shadow-xl">
            {toast}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </AppPage>
  );
}
