/**
 * The big kids' lab (10–12): gravity and temperature of the sandbox, in five
 * clear steps each, with the "what changed" science line of the notebook.
 * The engine already has both settings (set_gravity in percent of the
 * world's own gravity, set_temperature as an offset of its everyday warmth).
 */
import type { L } from '@/lib/i18n-text';

export interface Level {
  /** Engine value: gravity percent, or temperature offset. */
  value: number;
  emoji: string;
  name: L;
}

export const GRAVITY_LEVELS: Level[] = [
  { value: 25, emoji: '🪶', name: { fr: 'très faible', en: 'very weak' } },
  { value: 50, emoji: '🎈', name: { fr: 'faible', en: 'weak' } },
  { value: 100, emoji: '🍎', name: { fr: 'normale', en: 'normal' } },
  { value: 150, emoji: '🪨', name: { fr: 'forte', en: 'strong' } },
  { value: 200, emoji: '🏋️', name: { fr: 'très forte', en: 'very strong' } },
];

export const TEMPERATURE_LEVELS: Level[] = [
  { value: -60, emoji: '🥶', name: { fr: 'glaciale', en: 'freezing' } },
  { value: -30, emoji: '❄️', name: { fr: 'fraîche', en: 'cool' } },
  { value: 0, emoji: '🌡️', name: { fr: 'normale', en: 'normal' } },
  { value: 30, emoji: '☀️', name: { fr: 'chaude', en: 'warm' } },
  { value: 60, emoji: '🌞', name: { fr: 'très chaude', en: 'very warm' } },
];

/** The middle step: the world as it is. */
export const NORMAL = 2;

export const LAB_TEXT = {
  title: { fr: 'Le labo des grands', en: 'The big kids’ lab' },
  open: { fr: 'Labo', en: 'Lab' },
  close: { fr: 'Fermer le labo', en: 'Close the lab' },
  gravity: { fr: 'Gravité', en: 'Gravity' },
  temperature: { fr: 'Température', en: 'Temperature' },
  less: { fr: 'Moins', en: 'Less' },
  more: { fr: 'Plus', en: 'More' },
  changed: { fr: 'Ce qui a changé', en: 'What changed' },
  intro: { fr: 'Change une règle du monde, puis observe ce qui se passe.', en: 'Change one rule of the world, then watch what happens.' },
} satisfies Record<string, L>;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Gravité : faible" — the setting as read on its control. */
export function levelLabel(kind: 'gravity' | 'temperature', k: number): L {
  const lv = (kind === 'gravity' ? GRAVITY_LEVELS : TEMPERATURE_LEVELS)[k] ?? GRAVITY_LEVELS[NORMAL];
  const what = kind === 'gravity' ? LAB_TEXT.gravity : LAB_TEXT.temperature;
  return { fr: `${what.fr} : ${lv.name.fr}`, en: `${what.en}: ${lv.name.en}` };
}

/** The one-sentence science of a setting: what changes in the world, and why. */
export function scienceLine(kind: 'gravity' | 'temperature', k: number): L {
  const label = levelLabel(kind, k);
  if (kind === 'gravity') {
    if (k < NORMAL)
      return {
        fr: `${label.fr}. Tout tombe plus lentement et rebondit plus haut, comme sur la Lune : la gravité est la force qui tire les choses vers le sol.`,
        en: `${cap(label.en)}. Everything falls more slowly and bounces higher, as on the Moon: gravity is the force that pulls things to the ground.`,
      };
    if (k > NORMAL)
      return {
        fr: `${label.fr}. Tout tombe plus vite et les tas s’écrasent, comme sur une planète géante : plus la gravité est forte, plus elle tire.`,
        en: `${cap(label.en)}. Everything falls faster and piles squash down, as on a giant planet: the stronger gravity is, the harder it pulls.`,
      };
    return { fr: `${label.fr}. Le monde tire les choses vers le sol avec sa gravité habituelle.`, en: `${cap(label.en)}. The world pulls things to the ground with its usual gravity.` };
  }
  if (k < NORMAL)
    return {
      fr: `${label.fr}. Il fait plus froid : l’eau gèle plus vite, la neige et la glace restent. Le froid ralentit les petites particules de l’eau.`,
      en: `${cap(label.en)}. It is colder: water freezes sooner, snow and ice stay. Cold slows down the tiny particles of water.`,
    };
  if (k > NORMAL)
    return {
      fr: `${label.fr}. Il fait plus chaud : la glace et la neige fondent, l’eau s’évapore plus vite. La chaleur fait s’agiter les particules.`,
      en: `${cap(label.en)}. It is warmer: ice and snow melt, water evaporates faster. Warmth makes the particles jiggle.`,
    };
  return { fr: `${label.fr}. Le monde garde sa température de tous les jours.`, en: `${cap(label.en)}. The world keeps its everyday temperature.` };
}
