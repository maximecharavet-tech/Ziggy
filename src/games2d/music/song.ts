/**
 * La Fabrique à chansons — the song model (pure, testable).
 *
 * A song is a grid: melody rows (one pitch each, pentatonic so nothing can
 * sound wrong) and drum rows, over 8 or 16 steps. It can be saved, shared as
 * a short code, and checked by gentle, optional challenges.
 */
import type { L } from '@/lib/i18n-text';

export const MELODY = [
  { id: 'do2', emoji: '🐦', name: { fr: 'Oiseau', en: 'Bird' }, freq: 1046.5, color: '#ff7ab8' },
  { id: 'la', emoji: '🐱', name: { fr: 'Chat', en: 'Cat' }, freq: 880, color: '#ff9f43' },
  { id: 'sol', emoji: '🦊', name: { fr: 'Renard', en: 'Fox' }, freq: 784, color: '#ffcc33' },
  { id: 'mi', emoji: '🐸', name: { fr: 'Grenouille', en: 'Frog' }, freq: 659.25, color: '#3fbf6a' },
  { id: 're', emoji: '🐬', name: { fr: 'Dauphin', en: 'Dolphin' }, freq: 587.33, color: '#3fb6e0' },
  { id: 'do', emoji: '🐻', name: { fr: 'Ours', en: 'Bear' }, freq: 523.25, color: '#9b6be8' },
] as const;

export const DRUMS = [
  { id: 'clap', emoji: '🐒', name: { fr: 'Singe (clap)', en: 'Monkey (clap)' }, color: '#e2b04a' },
  { id: 'shaker', emoji: '🐍', name: { fr: 'Serpent (maracas)', en: 'Snake (shaker)' }, color: '#7fc85c' },
  { id: 'kick', emoji: '🐘', name: { fr: 'Éléphant (tambour)', en: 'Elephant (drum)' }, color: '#8a8fa8' },
] as const;

export const SOUNDS = ['xylo', 'flute', 'piano', 'robot'] as const;
export type SoundKind = (typeof SOUNDS)[number];
export const SOUND_NAME: Record<SoundKind, L & { emoji: string }> = {
  xylo: { fr: 'Xylophone', en: 'Xylophone', emoji: '🎼' },
  flute: { fr: 'Flûte', en: 'Flute', emoji: '🪈' },
  piano: { fr: 'Piano', en: 'Piano', emoji: '🎹' },
  robot: { fr: 'Robot Ziggy', en: 'Ziggy robot', emoji: '🤖' },
};

export const ROWS = MELODY.length + DRUMS.length;

export interface Song {
  steps: 8 | 16;
  tempo: number;
  sound: SoundKind;
  /** grid[row][step] — rows 0..5 melody (high → low), 6..8 drums. */
  grid: boolean[][];
}

export function emptySong(steps: 8 | 16 = 8, sound: SoundKind = 'xylo'): Song {
  return { steps, tempo: steps === 8 ? 100 : 112, sound, grid: Array.from({ length: ROWS }, () => Array(steps).fill(false)) };
}

export function toggle(song: Song, row: number, step: number): Song {
  const grid = song.grid.map((r, i) => (i === row ? r.map((v, j) => (j === step ? !v : v)) : r));
  return { ...song, grid };
}

/** Change the length, keeping the notes that fit (and repeating 8 → 16). */
export function resize(song: Song, steps: 8 | 16): Song {
  if (steps === song.steps) return song;
  const grid = song.grid.map((r) => (steps === 16 ? [...r, ...r] : r.slice(0, 8)));
  return { ...song, steps, grid };
}

export function noteCount(song: Song): number {
  return song.grid.reduce((n, r) => n + r.filter(Boolean).length, 0);
}

/* ── Short share code: base36 bitfield per row ── */

export function encode(song: Song): string {
  const rows = song.grid.map((r) => parseInt(r.map((v) => (v ? '1' : '0')).join(''), 2).toString(36));
  return [song.steps, song.tempo, SOUNDS.indexOf(song.sound), ...rows].join('.');
}

export function decode(code: string): Song | null {
  const parts = code.split('.');
  if (parts.length !== 3 + ROWS) return null;
  const steps = Number(parts[0]);
  const tempo = Number(parts[1]);
  const sound = SOUNDS[Number(parts[2])];
  if ((steps !== 8 && steps !== 16) || !sound || !(tempo >= 60 && tempo <= 180)) return null;
  const grid: boolean[][] = [];
  for (const p of parts.slice(3)) {
    if (!/^[0-9a-z]{1,4}$/.test(p)) return null;
    const n = parseInt(p, 36);
    if (!(n >= 0 && n < 2 ** steps)) return null;
    grid.push(n.toString(2).padStart(steps, '0').split('').map((c) => c === '1'));
  }
  return { steps, tempo, sound, grid };
}

/* ── Public-domain nursery tunes (traditional) ── */

type Tune = { id: string; emoji: string; name: L; steps: 16; tempo: number; notes: (string | null)[]; drums: { kick?: number[]; shaker?: number[]; clap?: number[] } };

export const TUNES: Tune[] = [
  {
    id: 'lune',
    emoji: '🌙',
    name: { fr: 'Au clair de la lune', en: 'Au clair de la lune' },
    steps: 16,
    tempo: 96,
    // do do do re mi – re – do mi re re do –
    notes: ['do', 'do', 'do', 're', 'mi', null, 're', null, 'do', 'mi', 're', 're', 'do', null, null, null],
    drums: { kick: [0, 4, 8, 12], shaker: [2, 6, 10, 14] },
  },
  {
    id: 'jacques',
    emoji: '🔔',
    name: { fr: 'Frère Jacques', en: 'Frère Jacques' },
    steps: 16,
    tempo: 110,
    notes: ['do', 're', 'mi', 'do', 'do', 're', 'mi', 'do', 'mi', null, 'sol', null, 'mi', null, 'sol', null],
    drums: { kick: [0, 4, 8, 12], clap: [4, 12] },
  },
  {
    id: 'etoile',
    emoji: '⭐',
    name: { fr: 'Ah ! vous dirai-je, maman', en: 'Twinkle, twinkle (tune)' },
    steps: 16,
    tempo: 100,
    notes: ['do', 'do', 'sol', 'sol', 'la', 'la', 'sol', null, 'mi', 'mi', 'mi', 're', 're', 're', 'do', null],
    drums: { kick: [0, 8], shaker: [4, 12] },
  },
];

export function tuneToSong(t: Tune, sound: SoundKind = 'xylo'): Song {
  const s = emptySong(16, sound);
  s.tempo = t.tempo;
  t.notes.forEach((n, step) => {
    if (!n) return;
    const row = MELODY.findIndex((m) => m.id === n);
    if (row >= 0) s.grid[row][step] = true;
  });
  for (const [id, steps] of Object.entries(t.drums)) {
    const row = MELODY.length + DRUMS.findIndex((d) => d.id === id);
    for (const step of steps ?? []) s.grid[row][step] = true;
  }
  return s;
}

/** A pleasant random song: stepwise melody on the beat, steady drums. Seeded. */
export function surprise(seed: number, steps: 8 | 16, sound: SoundKind): Song {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const s = emptySong(steps, sound);
  let row = 3;
  for (let i = 0; i < steps; i++) {
    if (i % 2 === 0 || r() < 0.35) {
      row = Math.max(0, Math.min(MELODY.length - 1, row + Math.round((r() - 0.5) * 3)));
      s.grid[row][i] = true;
    }
    if (i % 4 === 0) s.grid[MELODY.length + 2][i] = true;
    if (i % 4 === 2) s.grid[MELODY.length + 1][i] = true;
    if (steps === 16 && i % 8 === 4) s.grid[MELODY.length][i] = true;
  }
  return s;
}

/* ── Gentle challenges (optional) ── */

export interface Challenge {
  id: string;
  text: L;
  check: (s: Song) => boolean;
}

const drumRow = (s: Song, id: (typeof DRUMS)[number]['id']) => s.grid[MELODY.length + DRUMS.findIndex((d) => d.id === id)];

export const CHALLENGES: Challenge[] = [
  { id: 'four_drums', text: { fr: 'Mets 4 coups de tambour 🐘', en: 'Put 4 elephant drum beats 🐘' }, check: (s) => drumRow(s, 'kick').filter(Boolean).length === 4 },
  { id: 'all_animals', text: { fr: 'Fais chanter tous les animaux de la mélodie', en: 'Make every melody animal sing' }, check: (s) => s.grid.slice(0, MELODY.length).every((r) => r.some(Boolean)) },
  { id: 'stairs', text: { fr: 'Fais un escalier qui monte (5 notes qui montent)', en: 'Build a rising staircase (5 notes going up)' }, check: (s) => hasStairs(s) },
  {
    id: 'repeat',
    text: { fr: 'Fais un motif qui se répète deux fois', en: 'Make a pattern that repeats twice' },
    check: (s) => {
      const half = s.steps / 2;
      return noteCount(s) >= 4 && s.grid.every((r) => r.slice(0, half).every((v, i) => v === r[i + half]));
    },
  },
  { id: 'every_beat', text: { fr: 'Une note sur chaque temps fort (1, 3, 5…)', en: 'A note on every strong beat (1, 3, 5…)' }, check: (s) => Array.from({ length: s.steps / 2 }, (_, i) => i * 2).every((step) => s.grid.slice(0, MELODY.length).some((r) => r[step])) },
];

/** 5 consecutive steps whose melody note goes up each time (rows go down = higher pitch). */
export function hasStairs(s: Song): boolean {
  const top = (step: number) => {
    for (let r = 0; r < MELODY.length; r++) if (s.grid[r][step]) return r;
    return -1;
  };
  for (let start = 0; start + 5 <= s.steps; start++) {
    let ok = true;
    for (let k = 0; k < 4; k++) {
      const a = top(start + k);
      const b = top(start + k + 1);
      if (a < 0 || b < 0 || b >= a) ok = false;
    }
    if (ok) return true;
  }
  return false;
}
