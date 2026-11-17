import type { ArcadeGameId } from '@/lib/arcade/types';
import type { L } from '@/lib/i18n-text';

/**
 * Ziggy World games on the TV home: the ones that play best with a remote
 * (arrows + OK). Dig and melody arcade games were removed; remaining TV-friendly
 * mechanics: choice, sort, pairs.
 */
export const TV_GAMES: ArcadeGameId[] = [
  'alphabet_quest',
  'number_island',
  'memory_magic',
  'little_scientist',
  'geography_explorer',
  'eco_world',
  'dragon_academy',
];

/**
 * Other Ziggy games that play fully with a remote, shown after the arcade
 * games on the TV home. The Magic Sandbox: the arrows move the brush, OK
 * pours, the arrow at an edge leaves the sandbox for the tools. The elf
 * games: the arrows move between the tiles / objects, OK taps.
 */
export const TV_EXTRAS: { id: string; href: string; emoji: string; color: string; name: L }[] = [
  { id: 'bac_a_sable', href: '/monde/bac-a-sable', emoji: '🏖️', color: '#f2a93b', name: { fr: 'Le Bac à sable magique', en: 'The Magic Sandbox' } },
  // The two 3D elf games: every tile / object is a focusable hotspot button, the arrows move between them, OK taps.
  { id: 'lutins_atelier', href: '/lutins/jeux/atelier', emoji: '🏭', color: '#e0913c', name: { fr: 'L’Atelier des Lutins', en: 'Elf Workshop' } },
  { id: 'lutins_chahut', href: '/lutins/jeux/chahut', emoji: '🧦', color: '#7950f2', name: { fr: 'Le Grand Chahut des Lutins', en: 'Elf Chaos' } },
];
