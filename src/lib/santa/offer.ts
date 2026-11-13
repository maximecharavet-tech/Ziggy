/**
 * L'appli du Père Noël — what is sold (docs/PERE_NOEL.md, "Offer").
 * Shared by the server (Stripe Checkout line items, pass) and the parents'
 * page. One-time payment, no subscription, valid until 31 January 2027.
 * Keep it word for word in step with the offer table in docs/PERE_NOEL.md.
 */
import type { L } from '@/lib/i18n-text';
import type { SantaTier } from './types';

export const SANTA_TIERS = ['essentiel', 'magique'] as const satisfies readonly SantaTier[];

export function isSantaTier(v: unknown): v is SantaTier {
  return typeof v === 'string' && (SANTA_TIERS as readonly string[]).includes(v);
}

/** End of validity of every pass sold this season (Paris time). */
export const SANTA_VALID_UNTIL = '2027-01-31T23:59:59+01:00';
export const SANTA_VALID_UNTIL_MS = Date.parse(SANTA_VALID_UNTIL);
export const SANTA_VALID_UNTIL_TEXT: L = { fr: '31 janvier 2027', en: '31 January 2027' };

/** Live AI call time included in Pack magique, for the whole pass (all children together). */
export const SANTA_AI_MINUTES = 20;
export const SANTA_AI_SECONDS = SANTA_AI_MINUTES * 60;

export const SANTA_CURRENCY = 'eur';

/** Proposed prices are display-only until the owner enables the flag. */
export const SANTA_NEW_PRICING = false;
export const SANTA_PROPOSED_OFFERS = [
  { id: 'pack-noel', amount: 599, price: { fr: '5,99 €', en: '€5.99' }, name: { fr: 'Pack Noël', en: 'Christmas Pack' }, details: { fr: 'Appels guidés, photos HD et 3 enfants', en: 'Guided calls, HD photos and 3 children' } },
  { id: 'pack-magique', amount: 1299, price: { fr: '12,99 €', en: '€12.99' }, name: { fr: 'Pack Magique', en: 'Magic Pack' }, details: { fr: 'Tout le Pack Noël et 30 min d’appel en direct', en: 'Everything in the Christmas Pack and 30 minutes live' } },
  { id: 'famille-ultime', amount: 1999, price: { fr: '19,99 €', en: '€19.99' }, name: { fr: 'Famille Ultime', en: 'Ultimate Family' }, details: { fr: 'Jusqu’à 5 enfants et 60 min en direct', en: 'Up to 5 children and 60 minutes live' } },
  { id: 'recharge-15', amount: 399, price: { fr: '3,99 €', en: '€3.99' }, name: { fr: 'Recharge 15 min', en: '15-minute top-up' }, details: { fr: '15 minutes d’appel en direct', en: '15 minutes of live calls' } },
  { id: 'recharge-30', amount: 699, price: { fr: '6,99 €', en: '€6.99' }, name: { fr: 'Recharge 30 min', en: '30-minute top-up' }, details: { fr: '30 minutes d’appel en direct', en: '30 minutes of live calls' } },
  { id: 'appel-24', amount: 299, price: { fr: '2,99 €', en: '€2.99' }, name: { fr: 'Appel du 24', en: 'Christmas Eve call' }, details: { fr: 'Un appel programmé le 24 décembre', en: 'One scheduled call on December 24' } },
  { id: 'carte-cadeau-10', amount: 999, price: { fr: '9,99 €', en: '€9.99' }, name: { fr: 'Carte cadeau', en: 'Gift card' }, details: { fr: 'Une surprise à offrir', en: 'A surprise to give' } },
  { id: 'carte-cadeau-15', amount: 1499, price: { fr: '14,99 €', en: '€14.99' }, name: { fr: 'Carte cadeau', en: 'Gift card' }, details: { fr: 'Une grande surprise à offrir', en: 'A bigger surprise to give' } },
] as const;

/** How many children a family can add. */
export function santaMaxChildren(tier: SantaTier | null): number {
  return tier ? 3 : 1;
}

export type SantaOffer = {
  tier: SantaTier;
  /** Price in cents. */
  amount: number;
  /** "4,99 €" / "€4.99". */
  price: L;
  name: L;
  /** One line for the Stripe product description. */
  description: L;
  features: L[];
};

const LETTER: L = { fr: 'Lettre au Père Noël + lettre à imprimer', en: 'Letter to Santa + printable letter' };
const VOICE: L = { fr: 'Court message vocal du Père Noël (avec le prénom)', en: 'Short voice message from Santa (with the first name)' };
const PHOTO_PAID: L = { fr: 'Photos avec le Père Noël illimitées, en HD, et vidéo', en: 'Unlimited photos with Santa, in HD, and video' };
const CALLS_PAID: L = { fr: 'Appels guidés (3 histoires) illimités', en: 'Unlimited guided calls (3 stories)' };
const CHILDREN_PAID: L = { fr: 'Jusqu’à 3 enfants', en: 'Up to 3 children' };
const AI_CALL: L = { fr: `Appel en direct avec le Père Noël (IA) : ${SANTA_AI_MINUTES} min au total`, en: `Live AI call with Santa: ${SANTA_AI_MINUTES} min in total` };

/** What every family gets without paying. */
export const SANTA_FREE_FEATURES: L[] = [
  LETTER,
  VOICE,
  { fr: 'Photos avec le Père Noël (avec filigrane)', en: 'Photos with Santa (watermarked)' },
  { fr: 'Appels guidés : la première minute', en: 'Guided calls: the first minute' },
  { fr: '1 enfant', en: '1 child' },
];

export const SANTA_OFFERS: Record<SantaTier, SantaOffer> = {
  essentiel: {
    tier: 'essentiel',
    amount: 499,
    price: { fr: '4,99 €', en: '€4.99' },
    name: { fr: 'Pack Noël', en: 'Christmas Pack' },
    description: {
      fr: 'L’appli du Père Noël : photos HD et vidéo, appels guidés illimités, 3 enfants. Paiement unique, valable jusqu’au 31 janvier 2027.',
      en: 'Santa’s app: HD photos and video, unlimited guided calls, 3 children. One-time payment, valid until 31 January 2027.',
    },
    features: [LETTER, VOICE, PHOTO_PAID, CALLS_PAID, CHILDREN_PAID],
  },
  magique: {
    tier: 'magique',
    amount: 999,
    price: { fr: '9,99 €', en: '€9.99' },
    name: { fr: 'Pack magique', en: 'Magic Pack' },
    description: {
      fr: `L’appli du Père Noël : tout le Pack Noël + ${SANTA_AI_MINUTES} min d’appel en direct avec le Père Noël (IA). Paiement unique, valable jusqu’au 31 janvier 2027.`,
      en: `Santa’s app: everything in the Christmas Pack + ${SANTA_AI_MINUTES} min of live AI call with Santa. One-time payment, valid until 31 January 2027.`,
    },
    features: [LETTER, VOICE, PHOTO_PAID, CALLS_PAID, AI_CALL, CHILDREN_PAID],
  },
};
