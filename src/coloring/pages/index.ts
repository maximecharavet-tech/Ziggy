import type { L } from '@/lib/i18n-text';
import type { ColoringPage, ThemeId } from '../types';
import { cat, butterfly, dinosaur, owl, underwater } from './animals';
import { christmasTree, snowman } from './christmas';
import { castle, lili, unicorn } from './fairy';
import { rocket, ufo } from './space';
import { car, train } from './vehicles';
import { house, mandala, mandalaFlower } from './zen';
import { ziggy } from './ziggy';

export const THEMES: { id: ThemeId; emoji: string; color: string; name: L }[] = [
  { id: 'noel', emoji: '🎄', color: '#E5484D', name: { fr: 'Noël', en: 'Christmas' } },
  { id: 'animaux', emoji: '🐾', color: '#F59E0B', name: { fr: 'Animaux', en: 'Animals' } },
  { id: 'espace', emoji: '🚀', color: '#6366F1', name: { fr: 'Espace', en: 'Space' } },
  { id: 'fees', emoji: '🧚', color: '#EC4899', name: { fr: 'Fées & princesses', en: 'Fairies & princesses' } },
  { id: 'vehicules', emoji: '🚗', color: '#0EA5E9', name: { fr: 'Véhicules', en: 'Vehicles' } },
  { id: 'zen', emoji: '🌀', color: '#14B8A6', name: { fr: 'Zen', en: 'Zen' } },
];

export const PAGES: ColoringPage[] = [
  ziggy,
  lili,
  castle,
  christmasTree,
  snowman,
  rocket,
  dinosaur,
  underwater,
  unicorn,
  cat,
  house,
  butterfly,
  train,
  mandala,
  car,
  owl,
  ufo,
  mandalaFlower,
];

export const pageById = (id: string): ColoringPage | undefined => PAGES.find((p) => p.id === id);
