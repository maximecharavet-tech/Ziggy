import { NextResponse, type NextRequest } from 'next/server';
import { locales, defaultLocale } from '@/i18n/config';
import { rateLimit } from '@/lib/rate-limit';
import { tr } from '@/lib/i18n-text';
import { SANTA_CURRENCY, SANTA_OFFERS, isSantaTier } from '@/lib/santa/offer';
import { passFromRequest, passSecret } from '@/lib/santa/pass';
import { clientIp, returnOrigin, stripe, stripeKey } from '../_lib/stripe';

/**
 * POST /api/santa/checkout {tier: 'essentiel'|'magique', locale?: string}
 * → 200 {url, upgrade:boolean} (Stripe Checkout, one-time payment)
 * A family that already holds a Pack Noël pass (cookie) and asks for Pack
 * magique pays only the difference (5,00 €).
 * → 400 {error:'bad_request'} · 409 {error:'already_bought'} · 429 {error:'too_many'} · 503 {error:'payments_unavailable'} · 502 {error:'stripe_failed'}
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Site locale → Stripe Checkout locale (Stripe has no Arabic: 'auto'). */
const STRIPE_LOCALES = new Set(['fr', 'en', 'es', 'de', 'pt', 'it', 'nl', 'tr', 'ja', 'ko', 'zh']);

const TERMS_TEXT = {
  fr: (terms: string) =>
    `J’accepte les [conditions de vente](${terms}). Le contenu numérique est fourni immédiatement après le paiement : je demande qu’il le soit et je renonce expressément à mon droit de rétractation de 14 jours (article L221-28 13° du Code de la consommation).`,
  en: (terms: string) =>
    `I accept the [terms of sale](${terms}). The digital content is supplied immediately after payment: I ask for this and expressly waive my 14-day right of withdrawal (French Consumer Code, article L221-28 13°).`,
};

const SUBMIT_TEXT = {
  fr: 'Paiement unique, sans abonnement. Valable jusqu’au 31 janvier 2027. Aucune donnée de votre enfant n’est transmise.',
  en: 'One-time payment, no subscription. Valid until 31 January 2027. None of your child’s data is shared.',
};

export async function POST(request: NextRequest) {
  if (!stripeKey() || !passSecret()) return NextResponse.json({ error: 'payments_unavailable' }, { status: 503 });

  if (!rateLimit(`santa-checkout:${clientIp(request)}`, 10, 10 * 60_000).success) {
    return NextResponse.json({ error: 'too_many' }, { status: 429 });
  }

  let tier: unknown;
  let locale: string = defaultLocale;
  try {
    const body = (await request.json()) as Record<string, unknown> | null;
    tier = body?.tier;
    if (typeof body?.locale === 'string' && (locales as readonly string[]).includes(body.locale)) locale = body.locale;
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!isSantaTier(tier)) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const offer = SANTA_OFFERS[tier];
  const current = passFromRequest(request);
  if (current && (current.tier === tier || current.tier === 'magique')) return NextResponse.json({ error: 'already_bought' }, { status: 409 });
  const upgradeFrom = tier === 'magique' && current?.tier === 'essentiel' ? current.sid : null;
  const amount = upgradeFrom ? offer.amount - SANTA_OFFERS.essentiel.amount : offer.amount;
  const origin = returnOrigin(request);
  const prefix = locale === defaultLocale ? '' : `${locale}/`;
  const lang = locale === 'fr' ? 'fr' : 'en';

  const result = await stripe<{ id: string; url: string | null }>('POST', '/v1/checkout/sessions', {
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: SANTA_CURRENCY,
          unit_amount: amount,
          product_data: {
            name: `${tr({ fr: 'L’appli du Père Noël', en: 'Santa’s app' }, locale)} — ${tr(upgradeFrom ? { fr: 'Passage au Pack magique', en: 'Upgrade to the Magic Pack' } : offer.name, locale)}`,
            description: tr(offer.description, locale),
          },
        },
      },
    ],
    // The literal {CHECKOUT_SESSION_ID} is filled in by Stripe.
    success_url: `${origin}/${prefix}pere-noel/merci?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${prefix}pere-noel/parents`,
    metadata: { tier, product: 'santa-2026', ...(upgradeFrom ? { upgrade_from: upgradeFrom } : {}) },
    payment_intent_data: { metadata: { tier, product: 'santa-2026' } },
    locale: STRIPE_LOCALES.has(locale) ? locale : 'auto',
    allow_promotion_codes: true,
    automatic_tax: { enabled: false },
    customer_creation: 'if_required',
    consent_collection: { terms_of_service: 'required' },
    custom_text: {
      terms_of_service_acceptance: { message: TERMS_TEXT[lang](`${origin}/${prefix}terms#pere-noel`) },
      submit: { message: SUBMIT_TEXT[lang] },
    },
  });

  if (!result.ok || !result.data.url) {
    console.error('[santa/checkout] Stripe refused the session', result.ok ? 'no url' : result.status);
    return NextResponse.json({ error: 'stripe_failed' }, { status: 502 });
  }
  return NextResponse.json({ url: result.data.url, upgrade: Boolean(upgradeFrom) }, { headers: { 'cache-control': 'no-store' } });
}
