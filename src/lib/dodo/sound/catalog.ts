/**
 * Sleep sounds for Mode dodo — adapted from Hyper Engine's Frequencies
 * catalogue for children: soft noise beds first, tones always very quiet.
 *
 * Words matter: binaural beats have modest, mixed evidence for relaxation,
 * and 432 Hz is a tradition, not science. Nothing here claims to cure or treat.
 */
import type { L } from '@/lib/i18n-text';

export type Mode = 'binaural' | 'monaural' | 'isochronic' | 'pure';
export type Noise = 'none' | 'white' | 'pink' | 'brown' | 'ocean' | 'rain';

/** A stage of a program: the beat (and carrier) glide to these values over `minutes`. */
export type Stage = { minutes: number; beat: number; carrier?: number };

export type Settings = { mode: Mode; carrier: number; beat: number; noise: Noise; noiseLevel: number; toneLevel: number; minutes: number; stages?: Stage[] };

export interface SleepSound {
  id: string;
  emoji: string;
  name: L;
  about: L;
  /** null = no tone, noise only. */
  tone: Pick<Settings, 'mode' | 'carrier' | 'beat' | 'stages'> | null;
  noise: Noise;
  /** Soft pentatonic music box on top. */
  musicBox: boolean;
  /** Binaural needs headphones to work. */
  headphones?: boolean;
}

export const SLEEP_SOUNDS: SleepSound[] = [
  { id: 'rain', emoji: '🌧️', name: { fr: 'Pluie douce', en: 'Soft rain' }, about: { fr: 'Une pluie légère sur le toit.', en: 'Light rain on the roof.' }, tone: null, noise: 'rain', musicBox: false },
  { id: 'ocean', emoji: '🌊', name: { fr: 'Vagues', en: 'Waves' }, about: { fr: 'La mer qui respire lentement.', en: 'The sea breathing slowly.' }, tone: null, noise: 'ocean', musicBox: false },
  { id: 'musicbox', emoji: '🎶', name: { fr: 'Boîte à musique', en: 'Music box' }, about: { fr: 'Quelques notes douces, au hasard, très lentement.', en: 'A few soft notes, slowly, at random.' }, tone: null, noise: 'pink', musicBox: true },
  { id: 'cocoon', emoji: '🧸', name: { fr: 'Cocon', en: 'Cocoon' }, about: { fr: 'Un souffle grave et rond, comme dans un cocon.', en: 'A deep, round hush, like a cocoon.' }, tone: null, noise: 'brown', musicBox: false },
  {
    id: 'lullaby432',
    emoji: '🌙',
    name: { fr: 'Berceuse 432 Hz', en: '432 Hz lullaby' },
    about: { fr: 'Un ton très doux accordé à 432 Hz (une tradition musicale), avec la boîte à musique.', en: 'A very soft tone tuned to 432 Hz (a musical tradition), with the music box.' },
    tone: { mode: 'pure', carrier: 216, beat: 0 },
    noise: 'pink',
    musicBox: true,
  },
  {
    id: 'drift',
    emoji: '💫',
    name: { fr: 'Endormissement (Hyper Fréquences)', en: 'Drifting off (Hyper Frequencies)' },
    about: {
      fr: 'Le programme d’endormissement de Hyper Engine : un battement qui ralentit doucement, sous un souffle grave. Avec un casque, à volume bas.',
      en: 'Hyper Engine’s sleep program: a beat that slowly winds down under a deep hush. With headphones, at low volume.',
    },
    tone: {
      mode: 'binaural',
      carrier: 180,
      beat: 10,
      stages: [
        { minutes: 5, beat: 10, carrier: 180 },
        { minutes: 10, beat: 6, carrier: 150 },
        { minutes: 15, beat: 2, carrier: 110 },
      ],
    },
    noise: 'brown',
    musicBox: false,
    headphones: true,
  },
  { id: 'silence', emoji: '🤫', name: { fr: 'Silence', en: 'Silence' }, about: { fr: 'Juste la voix de Ziggy.', en: 'Just Ziggy’s voice.' }, tone: null, noise: 'none', musicBox: false },
];

export const LIMITS = { carrierMin: 40, carrierMax: 1200, beatMax: 45, minutesMax: 120 } as const;

/** Tones stay far under the noise and the voice for children. */
export const KID_TONE_LEVEL = 0.22;

export function clampSettings(s: Settings): Settings {
  const beat = s.mode === 'pure' ? 0 : Math.max(0.5, Math.min(LIMITS.beatMax, Number(s.beat) || 6));
  const floor = s.mode === 'binaural' || s.mode === 'monaural' ? Math.max(LIMITS.carrierMin, 20 + beat / 2) : LIMITS.carrierMin;
  const carrier = Math.max(floor, Math.min(LIMITS.carrierMax, Number(s.carrier) || 200));
  return {
    ...s,
    carrier,
    beat,
    noiseLevel: Math.max(0, Math.min(1, s.noiseLevel)),
    toneLevel: Math.max(0, Math.min(1, s.toneLevel)),
    minutes: Math.max(1, Math.min(LIMITS.minutesMax, Math.round(s.minutes))),
  };
}

/** Left / right frequencies of a binaural pair, centred on the carrier. */
export const binauralPair = (carrier: number, beat: number): [number, number] => [carrier - beat / 2, carrier + beat / 2];

/**
 * Beat and carrier as functions of time for a program: linear glides between
 * stage targets. Stages longer than the session are cut, shorter ones hold.
 */
export function timeline(s: Pick<Settings, 'beat' | 'carrier' | 'minutes' | 'stages'>): { t: number; beat: number; carrier: number }[] {
  const pts = [{ t: 0, beat: s.beat, carrier: s.carrier }];
  if (!s.stages?.length) return [...pts, { t: s.minutes * 60, beat: s.beat, carrier: s.carrier }];
  let t = 0;
  let carrier = s.carrier;
  for (const st of s.stages) {
    t = Math.min(s.minutes * 60, t + st.minutes * 60);
    carrier = st.carrier ?? carrier;
    pts.push({ t, beat: st.beat, carrier });
    if (t >= s.minutes * 60) break;
  }
  if (t < s.minutes * 60) pts.push({ t: s.minutes * 60, beat: pts[pts.length - 1].beat, carrier });
  return pts;
}

/** Settings for a sleep sound, a session length and a volume (0–1). */
export function settingsFor(sound: SleepSound, minutes: number, volume: number): Settings {
  const tone = sound.tone ?? { mode: 'pure' as const, carrier: 216, beat: 0 };
  return clampSettings({
    mode: tone.mode,
    carrier: tone.carrier,
    beat: tone.beat,
    stages: tone.stages,
    noise: sound.noise,
    noiseLevel: sound.noise === 'none' ? 0 : 0.55 * volume,
    toneLevel: sound.tone ? KID_TONE_LEVEL * volume : 0,
    minutes,
  });
}

/** C major pentatonic around A = 432 Hz: nothing can sound wrong. */
export const MUSIC_BOX_NOTES = [256.87, 288.33, 323.63, 384.87, 432, 513.74, 576.65, 647.27].map((f) => Math.round(f * 100) / 100);

/** A gentle melody: mostly steps, sometimes a small leap, slowing down over time. Deterministic per seed. */
export function musicBoxPhrase(seed: number, length: number): { note: number; at: number }[] {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out: { note: number; at: number }[] = [];
  let i = 4;
  let at = 0;
  for (let k = 0; k < length; k++) {
    const step = rnd() < 0.7 ? (rnd() < 0.5 ? -1 : 1) : rnd() < 0.5 ? -2 : 2;
    i = Math.max(0, Math.min(MUSIC_BOX_NOTES.length - 1, i + step));
    out.push({ note: MUSIC_BOX_NOTES[i], at });
    at += 1.1 + rnd() * 1.4 + k * 0.02;
  }
  return out;
}
