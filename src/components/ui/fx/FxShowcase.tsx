'use client';

import { useRef, useState, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { tr, type L } from '@/lib/i18n-text';
import { Button } from '../Button';
import { Card } from '../Card';
import { GlowCard } from '../GlowCard';
import { Confetti } from '../Confetti';
import { AnimatedCounter } from '../AnimatedCounter';
import { MascotCutout, ZiggyAvatar } from '@/components/ziggy/Mascot';
import { SparkleBurst } from './SparkleBurst';
import { TapRipple } from './TapRipple';
import { ConfettiCannon, type ConfettiCannonHandle } from './ConfettiCannon';
import { EmojiRain } from './EmojiRain';
import { MagicTrail } from './MagicTrail';
import { StickerPop } from './StickerPop';
import { ShakeWiggle } from './ShakeWiggle';
import { useJuice } from './useJuice';
import type { Juice } from './juice';

const T = {
  title: { fr: 'Ziggy juice : les effets', en: 'Ziggy juice: the effects' },
  intro: {
    fr: 'Démo pour l’équipe : chaque effet est court (≤ 2 s), ne bloque jamais un clic, respecte « réduire les animations » et le bouton son.',
    en: 'Team demo: every effect is short (≤ 2 s), never blocks a tap, respects “reduce motion” and the sound switch.',
  },
  gestures: { fr: 'Gestes (useJuice)', en: 'Gestures (useJuice)' },
  press: { fr: 'Appui', en: 'Press' },
  pop: { fr: 'Pop', en: 'Pop' },
  boing: { fr: 'Boing', en: 'Boing' },
  wiggle: { fr: 'Frétille', en: 'Wiggle' },
  sparkle: { fr: 'Étincelles', en: 'Sparkle' },
  success: { fr: 'Bonne réponse', en: 'Right answer' },
  encourage: { fr: 'Presque !', en: 'Nearly!' },
  hearts: { fr: 'Cœurs', en: 'Hearts' },
  celebrate: { fr: 'Fête !', en: 'Celebrate!' },
  confetti: { fr: 'Confettis', en: 'Confetti' },
  party: { fr: 'Canons de fête', en: 'Party cannons' },
  cannon: { fr: 'Canon depuis ici', en: 'Cannon from here' },
  rain: { fr: 'Pluie d’emojis', en: 'Emoji rain' },
  burst: { fr: 'Éclat', en: 'Burst' },
  stickers: { fr: 'Autocollants', en: 'Stickers' },
  again: { fr: 'Encore', en: 'Again' },
  trail: { fr: 'Traînée magique (souris)', en: 'Magic trail (mouse)' },
  on: { fr: 'Activée', en: 'On' },
  off: { fr: 'Désactivée', en: 'Off' },
  ripple: { fr: 'Touche-moi', en: 'Tap me' },
  cards: { fr: 'Cartes', en: 'Cards' },
  card: { fr: 'Carte qui rebondit', en: 'Springy card' },
  glow: { fr: 'Carte lumineuse', en: 'Glow card' },
  counter: { fr: 'Compteur', en: 'Counter' },
  mascot: { fr: 'Ziggy vivant', en: 'Ziggy alive' },
  mascotHint: {
    fr: 'Il cligne des yeux, ses antennes bougent, il salue la souris, saute quand on le touche et fait la sieste après 8 s sans bouger (45 s sur le site).',
    en: 'He blinks, his antennas bob, he waves at the mouse, hops when tapped and naps after 8 s of idle (45 s on the site).',
  },
  primary: { fr: 'Principal', en: 'Primary' },
  secondary: { fr: 'Secondaire', en: 'Secondary' },
  ghost: { fr: 'Discret', en: 'Ghost' },
} satisfies Record<string, L>;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-bg-card/70 p-5 sm:p-6">
      <h2 className="mb-4 font-display text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

const GESTURES: { key: keyof Juice & keyof typeof T; emoji: string }[] = [
  { key: 'press', emoji: '👆' },
  { key: 'pop', emoji: '🫧' },
  { key: 'boing', emoji: '🦘' },
  { key: 'wiggle', emoji: '🐛' },
  { key: 'sparkle', emoji: '✨' },
  { key: 'success', emoji: '⭐' },
  { key: 'encourage', emoji: '💪' },
  { key: 'hearts', emoji: '💚' },
  { key: 'celebrate', emoji: '🎉' },
];

/**
 * A live tour of the FX kit for the owner and the team. Not a page: mount it
 * wherever a demo is wanted (it owns no route).
 */
export function FxShowcase() {
  const locale = useLocale();
  const t = (k: keyof typeof T) => tr(T[k], locale);
  const juice = useJuice();
  const cannon = useRef<ConfettiCannonHandle>(null);
  const cannonFrom = useRef<HTMLButtonElement>(null);
  const [party, setParty] = useState(false);
  const [rain, setRain] = useState(0);
  const [burst, setBurst] = useState(0);
  const [stickers, setStickers] = useState(1);
  const [wiggle, setWiggle] = useState(0);
  const [trail, setTrail] = useState(false);

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10" data-fx-showcase="">
      <MagicTrail enabled={trail} />
      <Confetti trigger={party} count={50} />
      <ConfettiCannon ref={cannon} mode="cannon" from={cannonFrom} count={50} />
      <EmojiRain trigger={rain} sound="yay" />

      <header>
        <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
        <p className="mt-2 max-w-2xl text-text-muted">{t('intro')}</p>
      </header>

      <Section title={t('gestures')}>
        <div className="flex flex-wrap gap-3">
          {GESTURES.map((g) => (
            <button
              key={g.key}
              type="button"
              data-fx={g.key}
              onClick={(e) => (juice[g.key] as (t: React.MouseEvent) => number)(e)}
              className="inline-flex min-h-14 items-center gap-2 rounded-2xl bg-leaf/15 px-4 py-3 font-bold text-text-body ring-1 ring-leaf/30 transition-colors hover:bg-leaf/25"
            >
              <span aria-hidden="true">{g.emoji}</span>
              {t(g.key)}
            </button>
          ))}
        </div>
      </Section>

      <Section title={t('confetti')}>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setParty((p) => !p)} data-fx="party">
            🎊 {t('party')}
          </Button>
          <Button ref={cannonFrom} variant="secondary" onClick={() => cannon.current?.fire()} data-fx="cannon">
            🎯 {t('cannon')}
          </Button>
          <Button variant="ghost" onClick={() => setRain((n) => n + 1)} data-fx="rain">
            🌧️ {t('rain')}
          </Button>
          <span className="relative inline-flex">
            <Button variant="secondary" onClick={() => setBurst((n) => n + 1)} sound="sparkle" data-fx="burst">
              🌟 {t('burst')}
            </Button>
            <SparkleBurst trigger={burst} radius={70} count={12} />
          </span>
        </div>
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title={t('stickers')}>
          <div className="flex items-center gap-4 text-5xl" key={stickers}>
            <StickerPop delay={0}>🦄</StickerPop>
            <StickerPop delay={0.12} rotate={6} sound="pop">
              🌈
            </StickerPop>
            <StickerPop delay={0.24} rotate={-8} sound="bubble">
              🍩
            </StickerPop>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button size="sm" variant="secondary" onClick={() => setStickers((n) => n + 1)} data-fx="stickers">
              {t('again')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setWiggle((n) => n + 1)} data-fx="wiggle-star">
              {t('wiggle')}
            </Button>
            <ShakeWiggle trigger={wiggle} intensity="happy" sound="squeak" className="text-4xl">
              ⭐
            </ShakeWiggle>
          </div>
        </Section>

        <Section title={t('trail')}>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" variant={trail ? 'primary' : 'secondary'} onClick={() => setTrail((v) => !v)} aria-pressed={trail} data-fx="trail">
              ✨ {trail ? t('on') : t('off')}
            </Button>
            <TapRipple className="rounded-2xl bg-sky/15 px-6 py-4 font-bold text-sky ring-1 ring-sky/30" color="#5FB6EA" opacity={0.35}>
              <span data-fx="ripple">{t('ripple')}</span>
            </TapRipple>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button size="sm">{t('primary')}</Button>
            <Button size="sm" variant="secondary">
              {t('secondary')}
            </Button>
            <Button size="sm" variant="ghost">
              {t('ghost')}
            </Button>
          </div>
        </Section>
      </div>

      <Section title={t('cards')}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card hover>
            <p className="font-bold">🃏 {t('card')}</p>
          </Card>
          <GlowCard>
            <p className="font-bold">💡 {t('glow')}</p>
          </GlowCard>
          <Card className="text-center">
            <p className="text-sm text-text-muted">{t('counter')}</p>
            <AnimatedCounter value="128" className="font-display text-4xl font-bold text-leaf" />
          </Card>
        </div>
      </Section>

      <Section title={t('mascot')}>
        <p className="mb-4 max-w-2xl text-sm text-text-muted">{t('mascotHint')}</p>
        <div className="flex flex-wrap items-end gap-6" data-fx="mascots">
          <div className="w-40">
            <MascotCutout pose="wave" width={160} sleepAfterMs={8000} />
          </div>
          <div className="w-32">
            <MascotCutout pose="stand" width={128} sleepAfterMs={8000} />
          </div>
          <div className="w-44">
            <MascotCutout pose="heart" width={176} sleepAfterMs={8000} />
          </div>
          <ZiggyAvatar size={72} />
          <ZiggyAvatar size={44} />
        </div>
      </Section>
    </div>
  );
}
