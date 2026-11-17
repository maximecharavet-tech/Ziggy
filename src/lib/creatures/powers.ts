import type { L } from '@/lib/i18n-text';
import type { PowerId } from './core';

/** What each power looks like in the HUD, and what Ziggy says about it (read aloud). */
export const POWER_INFO: Record<PowerId, { icon: string; label: L; say: L }> = {
  bounce: { icon: '🦘', label: { fr: 'Rebond', en: 'Bounce' }, say: { fr: 'Elle rebondit : boing, boing, boing !', en: 'It bounces: boing, boing, boing!' } },
  fly: { icon: '🕊️', label: { fr: 'Vol', en: 'Flying' }, say: { fr: 'Elle s’envole dans les airs !', en: 'It takes off into the air!' } },
  swim: { icon: '🐟', label: { fr: 'Nage', en: 'Swimming' }, say: { fr: 'Splish splash, elle nage !', en: 'Splish splash, it swims!' } },
  sparkle: { icon: '✨', label: { fr: 'Étincelles', en: 'Sparkles' }, say: { fr: 'Des étincelles magiques !', en: 'Magic sparkles!' } },
  dance: { icon: '💃', label: { fr: 'Danse', en: 'Dance' }, say: { fr: 'Elle danse trop bien !', en: 'It dances so well!' } },
  camo: { icon: '🍃', label: { fr: 'Camouflage', en: 'Camouflage' }, say: { fr: 'Chut… elle se cache ! Tu la vois encore ?', en: 'Shh… it is hiding! Can you still see it?' } },
  laugh: { icon: '😂', label: { fr: 'Fou rire', en: 'Giggles' }, say: { fr: 'Hi hi hi, elle a le fou rire !', en: 'Hee hee hee, it has the giggles!' } },
  rainbow: { icon: '🌈', label: { fr: 'Arc-en-ciel', en: 'Rainbow' }, say: { fr: 'Des confettis arc-en-ciel !', en: 'Rainbow confetti!' } },
  roll: { icon: '🛞', label: { fr: 'Roulade', en: 'Roll' }, say: { fr: 'Elle fait une roulade !', en: 'It does a somersault!' } },
  float: { icon: '🎈', label: { fr: 'Flotte', en: 'Float' }, say: { fr: 'Elle flotte comme un ballon !', en: 'It floats like a balloon!' } },
  zap: { icon: '⚡', label: { fr: 'Zip-zap', en: 'Zip-zap' }, say: { fr: 'Zip ! Zap ! Elle fait des étincelles !', en: 'Zip! Zap! It makes sparks!' } },
  hearts: { icon: '💖', label: { fr: 'Câlins', en: 'Hugs' }, say: { fr: 'Elle envoie des petits cœurs !', en: 'It sends little hearts!' } },
  music: { icon: '🎵', label: { fr: 'Musique', en: 'Music' }, say: { fr: 'Elle chante une chanson !', en: 'It sings a song!' } },
};
