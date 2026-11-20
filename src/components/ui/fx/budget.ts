/**
 * Particle budgets: how many particles an effect may add.
 *
 * A celebration must stay at 60 fps on a 4-core tablet, so the stage holds a
 * global cap and every effect asks before it emits. Weak devices get roughly
 * half; reduced motion gets none (effects fall back to a still or a fade).
 */

export interface BudgetCaps {
  /** Particles alive on the stage at once, all effects together. */
  global: number;
  /** Particles a single effect may add. */
  perEffect: number;
}

export const CAPS: Readonly<Record<'normal' | 'low', BudgetCaps>> = {
  normal: { global: 260, perEffect: 150 },
  low: { global: 110, perEffect: 60 },
};

/** Share of the requested count a weak device keeps. */
export const LOW_POWER_SHARE = 0.5;

export interface BudgetContext {
  lowPower: boolean;
  reducedMotion: boolean;
  /** Particles already alive on the stage. */
  alive: number;
}

/** The number of particles an effect may actually emit (0 when it must not). */
export function allowedParticles(requested: number, ctx: BudgetContext): number {
  if (ctx.reducedMotion || !Number.isFinite(requested) || requested <= 0) return 0;
  const caps = ctx.lowPower ? CAPS.low : CAPS.normal;
  const wanted = Math.round(ctx.lowPower ? requested * LOW_POWER_SHARE : requested);
  const free = Math.max(0, caps.global - Math.max(0, ctx.alive));
  return Math.max(0, Math.min(wanted, caps.perEffect, free));
}

/** Highest canvas pixel ratio: sharp enough for confetti, cheap enough to clear 60 times a second. */
export function stagePixelRatio(devicePixelRatio: number, lowPower: boolean): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(dpr, lowPower ? 1 : 1.5);
}
