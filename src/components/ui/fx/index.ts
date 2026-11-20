/**
 * Ziggy's FX kit ("Ziggy juice"): one place for bursts, ripples, confetti and
 * the sounds that go with them. Everything is click-through, short, budgeted,
 * SSR-safe and still under reduced motion. See FxShowcase for a live tour.
 */
export { SparkleBurst, type SparkleBurstProps } from './SparkleBurst';
export { TapRipple, useTapRipple, type TapRippleOptions } from './TapRipple';
export { ConfettiCannon, type ConfettiCannonProps, type ConfettiCannonHandle } from './ConfettiCannon';
export { EmojiRain, type EmojiRainProps } from './EmojiRain';
export { MagicTrail, type MagicTrailProps } from './MagicTrail';
export { StickerPop, type StickerPopProps } from './StickerPop';
export { ShakeWiggle, type ShakeWiggleProps } from './ShakeWiggle';
export { useJuice } from './useJuice';
export { juice, createJuice, JUICE_MS, type Juice, type JuiceTarget } from './juice';
export { confettiAt, confettiParty, sparkleAt, heartsAt, emojiRain, type Point } from './effects';
export { fxSound, type FxSound } from './sfx';
export { useTrigger } from './use-trigger';
