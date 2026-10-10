import 'server-only';
import { z } from 'zod';
import * as embedded from './orchestrator';
import type { Ctx, Outcome } from './orchestrator';
import { AvatarRequestSchema, GameFactorySchema, QuestContentSchema, StoryJsonSchema, VisualBlueprintSchema, type AvatarRequest } from './schemas';
import { checkBudget, type Operation } from './cost-guard';
import { shield } from '@/lib/safety/child-shield';
import { logEvent, newRequestId } from '@/lib/analytics/log';
import type { StoryChoices } from '@/lib/story/choices';
import type { ArcadeGameId, Difficulty } from '@/lib/arcade/types';
import type { LearningSkill } from '@/lib/learning/skills';

/**
 * HyperEngineClient — the only door from Ziggy's routes to AI generation.
 *
 * Two modes, same contract:
 *  - remote:   HYPER_ENGINE_API_URL + HYPER_ENGINE_API_KEY set → calls the
 *              standalone Hyper Engine service (server to server only);
 *              its answers are re-validated (Zod) and re-shielded here.
 *  - embedded: otherwise, the orchestrator runs inside Ziggy's own server.
 * If the remote engine fails, the embedded one takes over transparently.
 */

function remote(): { url: string; key: string } | null {
  const url = process.env.HYPER_ENGINE_API_URL?.replace(/\/+$/, '');
  const key = process.env.HYPER_ENGINE_API_KEY;
  if (!url || !key || !/^https:\/\//.test(url)) return null;
  return { url, key };
}

export function engineMode(): 'remote' | 'embedded' {
  return remote() ? 'remote' : 'embedded';
}

async function callRemote<T>(ctx: Ctx, op: Operation, path: string, payload: unknown, schema: z.ZodType<T>, shieldIt: boolean): Promise<Outcome<T> | null> {
  const r = remote();
  if (!r || !ctx.sb || !ctx.userId) return null;
  const budget = await checkBudget(ctx.sb, ctx.userId, op);
  if (!budget.ok) return { ok: false, error: 'over_budget', reason: budget.reason };
  const requestId = newRequestId();
  const started = Date.now();
  try {
    const res = await fetch(`${r.url}/v1/ziggy/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${r.key}`, 'x-request-id': requestId },
      body: JSON.stringify({ ...((payload as object) ?? {}), locale: ctx.locale, ageGroup: ctx.ageGroup }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) throw new Error(`status_${res.status}`);
    const body = (await res.json()) as { data?: unknown };
    const parsed = schema.safeParse(body.data);
    if (!parsed.success) throw new Error('invalid');
    if (shieldIt) {
      const safe = await shield(parsed.data, op, ctx.sb);
      if (!safe.ok) return null; // fall back to the embedded/local path
    }
    logEvent({ kind: 'generation', operation: op, status: 'COMPLETED', requestId, latencyMs: Date.now() - started, provider: 'hyper-engine' });
    return { ok: true, data: parsed.data, source: 'ai' };
  } catch (e) {
    logEvent({ kind: 'generation', operation: op, status: 'FAILED', requestId, latencyMs: Date.now() - started, provider: 'hyper-engine', detail: e instanceof Error ? e.message.slice(0, 40) : 'error' });
    return null;
  }
}

const ImageResult = z.object({ imageUrl: z.string().url().max(4000) });

export const HyperEngineClient = {
  async analyzeImage(ctx: Ctx, photoDataUri: string) {
    // The photo never leaves for a third service in remote mode either: it goes to the same vision step.
    return (await callRemote(ctx, 'analyze_image', 'avatar/analyze', { photo: photoDataUri }, VisualBlueprintSchema, false)) ?? embedded.analyzeImage(ctx, photoDataUri);
  },
  async generateAvatar(ctx: Ctx, req: AvatarRequest) {
    const safeReq = AvatarRequestSchema.parse(req);
    return (await callRemote(ctx, 'generate_avatar', 'avatar/generate', safeReq, ImageResult, false)) ?? embedded.generateAvatar(ctx, safeReq);
  },
  async generateWorldScene(ctx: Ctx, worldId: string, scene: 'map' | 'chapter1' | 'chapter2' | 'chapter3') {
    return (await callRemote(ctx, 'generate_world_scene', 'world/scene', { worldId, scene }, ImageResult, false)) ?? embedded.generateWorldScene(ctx, worldId, scene);
  },
  async generateQuest(ctx: Ctx, worldId: string, questId: string, companion: string) {
    const local = embedded.localQuest(worldId, questId, ctx.locale);
    if (!local) return { ok: false, error: 'invalid' } as const;
    const r = await callRemote(ctx, 'generate_quest', 'quest/generate', { worldId, questId, companion }, QuestContentSchema, true);
    // The engine owns the reward, whatever the remote says.
    if (r?.ok) return { ...r, data: { ...r.data, reward: local.reward } };
    return embedded.generateQuest(ctx, worldId, questId, companion);
  },
  async generateStory(ctx: Ctx, choices: StoryChoices) {
    return (await callRemote(ctx, 'generate_story', 'story/generate', { choices }, StoryJsonSchema, true)) ?? embedded.generateStory(ctx, choices);
  },
  async generateGameContent(ctx: Ctx, gameId: ArcadeGameId, difficulty: Difficulty, skill: LearningSkill, seed: number) {
    return embedded.generateGameContent(ctx, gameId, difficulty, skill, seed, remote() ? (c) => callRemote(c, 'generate_game_content', 'game/content', { gameId, difficulty, skill }, GameFactorySchema, true) : undefined);
  },
};
