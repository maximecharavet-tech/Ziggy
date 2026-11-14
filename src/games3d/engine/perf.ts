/**
 * Performance helpers (pure): adaptive resolution like PizzaGame (a weak
 * device lowers its internal resolution step by step, never below 0.55) and
 * a renderer.info budget check for tests and the dev overlay.
 */

export class AdaptiveResolution {
  private frames = 0;
  private time = 0;

  constructor(
    public ratio: number,
    private opts: { minRatio?: number; stepDown?: number; minFps?: number; window?: number } = {}
  ) {}

  /** Feed a raw frame delta; returns the new pixel ratio when it should change, else null. */
  sample(rawDt: number): number | null {
    this.frames++;
    this.time += Math.min(Math.max(0, rawDt), 0.25);
    if (this.time < (this.opts.window ?? 2.5)) return null;
    const fps = this.frames / this.time;
    this.frames = 0;
    this.time = 0;
    const min = this.opts.minRatio ?? 0.55;
    if (fps < (this.opts.minFps ?? 24) && this.ratio > min + 0.01) {
      this.ratio = Math.max(min, this.ratio - (this.opts.stepDown ?? 0.15));
      return this.ratio;
    }
    return null;
  }

  /** Forget the current window (after a pause: hidden time is not slowness). */
  reset(): void {
    this.frames = 0;
    this.time = 0;
  }
}

export interface RenderBudget {
  drawCalls: number;
  triangles: number;
}

/** Low tier (≤ 4 cores) and high tier budgets from docs/GAME_ARCHITECTURE.md §4. */
export const BUDGETS: Record<'low' | 'high', RenderBudget> = {
  low: { drawCalls: 120, triangles: 150_000 },
  high: { drawCalls: 250, triangles: 400_000 },
};

/** Compare `renderer.info.render` with a budget. */
export function checkBudget(info: { calls: number; triangles: number }, tier: 'low' | 'high'): { ok: boolean; problems: string[] } {
  const b = BUDGETS[tier];
  const problems: string[] = [];
  if (info.calls > b.drawCalls) problems.push(`${info.calls} draw calls > ${b.drawCalls}`);
  if (info.triangles > b.triangles) problems.push(`${info.triangles} triangles > ${b.triangles}`);
  return { ok: problems.length === 0, problems };
}
