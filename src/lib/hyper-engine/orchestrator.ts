import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  VisualBlueprintSchema,
  QuestContentSchema,
  StoryJsonSchema,
  GameFactorySchema,
  parseModelJson,
  type VisualBlueprint,
  type AvatarRequest,
  type QuestContent,
  type StoryJson,
  type GameFactoryOutput,
} from './schemas';
import { deepseekJson, deepseekReady } from './providers/deepseek';
import { nvidiaJson, nvidiaReady, nvidiaVision } from './providers/nvidia';
import { agnesImage, agnesReady } from './providers/agnes';
import { ProviderError } from './providers/http';
import { Capsule } from './capsule';
import { checkBudget, type Operation } from './cost-guard';
import { shield } from '@/lib/safety/child-shield';
import { localStory } from '@/lib/story/local-story';
import { HEROES, PLACES, STORY_COMPANIONS, OBJECTS, GOALS, pick, type StoryChoices } from '@/lib/story/choices';
import { avatarPrompt } from '@/lib/avatar/prompt';
import { WORLDS } from '@/data/worlds';
import { getGame } from '@/lib/arcade/registry';
import { generateContent } from '@/lib/arcade/generate';
import type { ArcadeGameId, Difficulty, GameContent } from '@/lib/arcade/types';
import type { LearningSkill } from '@/lib/learning/skills';
import { SKILL_NAMES } from '@/lib/learning/skills';
import { tr } from '@/lib/i18n-text';
import { newRequestId } from '@/lib/analytics/log';

/**
 * ZIGGY ORCHESTRATOR — the brain inside Hyper Engine for Ziggy.
 *
 *   request → CostGuard → provider (DeepSeek / NVIDIA / Agnes)
 *           → strict JSON parse → Zod schema (one controlled correction)
 *           → ChildShield → result
 *   any failure → the local, deterministic, human-written fallback.
 *
 * Providers only ever return JSON data or an image. Nothing they return is
 * executed, rendered as HTML, used as SQL or as a URL to call.
 */

export type Ctx = { sb: SupabaseClient | null; userId: string | null; locale: string; ageGroup: '5-7' | '8-10' | '11-12' };
export type Outcome<T> =
  | { ok: true; data: T; source: 'ai' | 'local'; generationId?: string }
  | { ok: false; error: 'not_configured' | 'over_budget' | 'unsafe' | 'provider_failed' | 'invalid'; reason?: string };

const LANG = (locale: string) => (locale === 'fr' ? 'French' : 'English');

const CHILD_RULES = (locale: string, ageGroup: string) =>
  `You write for children aged ${ageGroup} in ${LANG(locale)}. Warm, playful, simple words, short sentences. ` +
  `Never: violence, weapons, scary or sad themes, romance, adult themes, brands, real people, personal questions, links. ` +
  `Encourage effort and curiosity; mistakes are part of learning. Answer with ONE JSON object only — no markdown, no code, no HTML.` +
  (ageGroup === '5-7'
    ? ` Many of these children cannot read yet: everything is read aloud to them. Questions of at most 10 simple words; ` +
      `every answer option starts with ONE emoji that shows its meaning, then 1 to 3 words; numbers stay at or below 10; ` +
      `never ask to read a written word.`
    : '');

/** Ask the text brain for JSON matching `schema`: DeepSeek first, NVIDIA as fallback, one controlled correction. */
async function aiJson<T>(schema: z.ZodType<T>, system: string, user: string): Promise<{ data: T; provider: string } | null> {
  const providers: { name: string; call: (s: string, u: string) => Promise<{ text: string }> }[] = [];
  if (deepseekReady()) providers.push({ name: 'deepseek', call: (s, u) => deepseekJson(s, u) });
  if (nvidiaReady()) providers.push({ name: 'nvidia', call: (s, u) => nvidiaJson(s, u) });
  for (const p of providers) {
    try {
      let raw = (await p.call(system, user)).text;
      for (let attempt = 0; attempt < 2; attempt++) {
        let parsed: unknown;
        try {
          parsed = parseModelJson(raw);
        } catch {
          parsed = undefined;
        }
        const result = parsed === undefined ? null : schema.safeParse(parsed);
        if (result?.success) return { data: result.data, provider: p.name };
        if (attempt === 1) break;
        // Controlled correction: the same request, plus what was wrong — once.
        const issues = result ? result.error.issues.slice(0, 6).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : 'not valid JSON';
        raw = (await p.call(system, `${user}\n\nYour previous answer was invalid (${issues}). Return the corrected JSON object only.`)).text;
      }
    } catch (e) {
      if (!(e instanceof ProviderError)) throw e;
      // Try the next provider.
    }
  }
  return null;
}

async function guarded(ctx: Ctx, op: Operation): Promise<Outcome<never> | null> {
  if (!ctx.sb || !ctx.userId) return null; // guests: no AI, local content only (handled by callers)
  const budget = await checkBudget(ctx.sb, ctx.userId, op);
  return budget.ok ? null : { ok: false, error: 'over_budget', reason: budget.reason };
}

/* ── Avatar: photo → visual blueprint (NVIDIA vision). The photo is never stored. ── */

export async function analyzeImage(ctx: Ctx, photoDataUri: string): Promise<Outcome<VisualBlueprint>> {
  if (!nvidiaReady()) return { ok: false, error: 'not_configured', reason: 'vision' };
  const blocked = await guarded(ctx, 'analyze_image');
  if (blocked) return blocked;
  const requestId = newRequestId();
  const capsule = await Capsule.open(ctx.sb, 'analyze_image', { provider: 'nvidia', requestId });
  await capsule.status('PROCESSING');
  const instructions =
    'You help draw a friendly cartoon avatar of a child. Look ONLY at visible drawing features and fill this JSON, choosing exactly one allowed value per field: ' +
    `{"hairColor": one of ${JSON.stringify(VisualBlueprintSchema.shape.hairColor.options)}, ` +
    `"hairLength": one of ${JSON.stringify(VisualBlueprintSchema.shape.hairLength.options)}, ` +
    `"hairStyle": one of ${JSON.stringify(VisualBlueprintSchema.shape.hairStyle.options)}, ` +
    `"skinTone": one of ${JSON.stringify(VisualBlueprintSchema.shape.skinTone.options)} (tone1 lightest … tone6 deepest), ` +
    `"eyeColor": one of ${JSON.stringify(VisualBlueprintSchema.shape.eyeColor.options)}, "glasses": boolean, "freckles": boolean}. ` +
    'Do NOT describe or guess identity, name, age, gender, ethnicity, health, emotions or location. If no child face is visible, answer {"error":"no_face"}.';
  try {
    const { text } = await nvidiaVision(instructions, photoDataUri);
    await capsule.status('VALIDATING');
    const parsed = VisualBlueprintSchema.safeParse(parseModelJson(text));
    if (!parsed.success) {
      await capsule.status('FAILED', { error: 'invalid_blueprint' });
      return { ok: false, error: 'invalid' };
    }
    await capsule.status('COMPLETED', { safety: 'not_applicable' });
    return { ok: true, data: parsed.data, source: 'ai', generationId: capsule.id };
  } catch (e) {
    await capsule.status('FAILED', { error: e instanceof ProviderError ? e.code : 'error' });
    return { ok: false, error: 'provider_failed' };
  }
}

/* ── Avatar: blueprint + choices → image (Agnes). Only the text blueprint is sent, never the photo. ── */

export async function generateAvatar(ctx: Ctx, req: AvatarRequest): Promise<Outcome<{ imageUrl: string }>> {
  if (!agnesReady()) return { ok: false, error: 'not_configured', reason: 'image' };
  if (!WORLDS.some((w) => w.id === req.worldId)) return { ok: false, error: 'invalid' };
  const blocked = await guarded(ctx, 'generate_avatar');
  if (blocked) return blocked;
  const capsule = await Capsule.open(ctx.sb, 'generate_avatar', { provider: 'agnes', world: req.worldId, requestId: newRequestId() });
  await capsule.status('PROCESSING');
  try {
    const prompt = avatarPrompt(req);
    const { url } = await agnesImage(prompt, { size: '1024x1024' });
    await capsule.status('COMPLETED', { safety: 'passed' });
    return { ok: true, data: { imageUrl: url }, source: 'ai', generationId: capsule.id };
  } catch (e) {
    await capsule.status('FAILED', { error: e instanceof ProviderError ? e.code : 'error' });
    return { ok: false, error: 'provider_failed' };
  }
}

/* ── World scene illustration (Agnes), from fixed, safe prompts per world ── */

export async function generateWorldScene(ctx: Ctx, worldId: string, scene: 'map' | 'chapter1' | 'chapter2' | 'chapter3'): Promise<Outcome<{ imageUrl: string }>> {
  const world = WORLDS.find((w) => w.id === worldId);
  if (!world) return { ok: false, error: 'invalid' };
  if (!agnesReady()) return { ok: false, error: 'not_configured', reason: 'image' };
  const blocked = await guarded(ctx, 'generate_world_scene');
  if (blocked) return blocked;
  const capsule = await Capsule.open(ctx.sb, 'generate_world_scene', { provider: 'agnes', world: worldId, scene, requestId: newRequestId() });
  await capsule.status('PROCESSING');
  try {
    const prompt =
      `A cheerful children's picture-book illustration of "${world.name.en}": ${world.description.en} ` +
      `Scene: ${scene === 'map' ? 'a wide welcoming landscape' : `chapter ${scene.slice(-1)} of a gentle adventure`}. ` +
      `Soft rounded 3D clay style, pastel colours (${world.colors.from}, ${world.colors.to}), no text, no people's faces, safe and friendly for young children.`;
    const { url } = await agnesImage(prompt, { size: '1280x720' });
    await capsule.status('COMPLETED', { safety: 'passed' });
    return { ok: true, data: { imageUrl: url }, source: 'ai', generationId: capsule.id };
  } catch (e) {
    await capsule.status('FAILED', { error: e instanceof ProviderError ? e.code : 'error' });
    return { ok: false, error: 'provider_failed' };
  }
}

/* ── Quests ── */

export function localQuest(worldId: string, questId: string, locale: string): QuestContent | null {
  const world = WORLDS.find((w) => w.id === worldId);
  const q = world?.quests.find((x) => x.id === questId);
  if (!world || !q) return null;
  const game = getGame(q.gameId);
  return {
    title: tr(q.title, locale),
    intro: tr(q.intro, locale),
    steps: [tr(game.description, locale)],
    companionLine: locale === 'fr' ? 'Je suis avec toi, on y va ensemble !' : "I'm with you — let's go together!",
    reward: { xp: q.reward.xp, stars: q.reward.stars },
  };
}

/** Enrich a quest's narration; the quest itself (game, skill, reward) is decided by the engine. */
export async function generateQuest(ctx: Ctx, worldId: string, questId: string, companion: string): Promise<Outcome<QuestContent>> {
  const local = localQuest(worldId, questId, ctx.locale);
  if (!local) return { ok: false, error: 'invalid' };
  const world = WORLDS.find((w) => w.id === worldId)!;
  const quest = world.quests.find((q) => q.id === questId)!;
  if (!ctx.sb || !(deepseekReady() || nvidiaReady())) return { ok: true, data: local, source: 'local' };
  const blocked = await guarded(ctx, 'generate_quest');
  if (blocked) return { ok: true, data: local, source: 'local' };
  const capsule = await Capsule.open(ctx.sb, 'generate_quest', { provider: deepseekReady() ? 'deepseek' : 'nvidia', world: worldId, requestId: newRequestId() });
  await capsule.status('PROCESSING');
  const ai = await aiJson(
    QuestContentSchema,
    `${CHILD_RULES(ctx.locale, ctx.ageGroup)} You narrate quests in Ziggy World.`,
    JSON.stringify({
      task: 'Write the narration for this quest. Keep reward exactly as given.',
      world: tr(world.name, ctx.locale),
      worldDescription: tr(world.description, ctx.locale),
      quest: tr(quest.title, ctx.locale),
      idea: tr(quest.intro, ctx.locale),
      skill: tr(SKILL_NAMES[quest.skill], ctx.locale),
      companion,
      reward: quest.reward,
      format: { title: 'string ≤60', intro: 'string ≤260', steps: ['1 to 3 strings ≤140'], companionLine: 'string ≤140', reward: { xp: 'int', stars: 'int' } },
    })
  ).catch(() => null);
  if (!ai) {
    await capsule.status('FAILED', { error: 'no_valid_answer' });
    return { ok: true, data: local, source: 'local' };
  }
  await capsule.status('VALIDATING', { provider: ai.provider });
  const safe = await shield(ai.data, 'generate_quest', ctx.sb);
  if (!safe.ok) {
    await capsule.status('FAILED', { safety: 'blocked', error: 'unsafe' });
    return { ok: true, data: local, source: 'local' };
  }
  // The engine, not the model, owns the reward.
  const data = { ...ai.data, reward: { xp: quest.reward.xp, stars: quest.reward.stars } };
  await capsule.status('COMPLETED', { safety: 'passed' });
  return { ok: true, data, source: 'ai', generationId: capsule.id };
}

/* ── Stories ── */

export async function generateStory(ctx: Ctx, choices: StoryChoices): Promise<Outcome<StoryJson>> {
  const local = localStory(choices, ctx.locale);
  if (!ctx.sb || !(deepseekReady() || nvidiaReady())) return { ok: true, data: local, source: 'local' };
  const blocked = await guarded(ctx, 'generate_story');
  if (blocked) return { ok: true, data: local, source: 'local' };
  const capsule = await Capsule.open(ctx.sb, 'generate_story', { provider: deepseekReady() ? 'deepseek' : 'nvidia', requestId: newRequestId() });
  await capsule.status('PROCESSING');
  const L = ctx.locale;
  const ai = await aiJson(
    StoryJsonSchema,
    `${CHILD_RULES(L, choices.ageGroup)} You write short illustrated bedtime-style adventure stories for Ziggy.`,
    JSON.stringify({
      task: 'Write a story with these elements. 3 chapters, 2 scenes each, one emoji per scene. A gentle challenge solved by thinking and teamwork.',
      hero: tr(pick(HEROES, choices.hero).label, L),
      place: tr(pick(PLACES, choices.place).label, L),
      companion: tr(pick(STORY_COMPANIONS, choices.companion).label, L),
      magicObject: tr(pick(OBJECTS, choices.object).label, L),
      goal: tr(pick(GOALS, choices.goal).label, L),
      sceneLength: choices.ageGroup === '5-7' ? '1–2 short sentences' : '2–4 sentences',
      format: { title: 'string', chapters: [{ title: 'string', scenes: [{ text: 'string', emoji: 'one emoji' }] }], moral: 'string' },
    })
  ).catch(() => null);
  if (!ai) {
    await capsule.status('FAILED', { error: 'no_valid_answer' });
    return { ok: true, data: local, source: 'local' };
  }
  await capsule.status('VALIDATING', { provider: ai.provider });
  const safe = await shield(ai.data, 'generate_story', ctx.sb);
  if (!safe.ok) {
    await capsule.status('FAILED', { safety: 'blocked', error: 'unsafe' });
    return { ok: true, data: local, source: 'local' };
  }
  await capsule.status('COMPLETED', { safety: 'passed' });
  return { ok: true, data: ai.data, source: 'ai', generationId: capsule.id };
}

/* ── Game content (Game Factory) ── */

/** GameFactory JSON → the mechanic's content (choice-style mechanics only). */
export function factoryToContent(out: GameFactoryOutput, mechanic: string, fallback: GameContent): GameContent {
  const items = out.questions.map((q) => ({ prompt: q.prompt, visual: q.visual, options: q.options, answer: q.answer, explain: q.explain }));
  if (mechanic === 'choice') return { kind: 'choice', items };
  if (mechanic === 'runner') return { kind: 'runner', items: items.map((i) => ({ ...i, options: i.options.slice(0, 3), answer: Math.min(i.answer, 2) })).filter((i) => i.answer < i.options.length) };
  if (mechanic === 'dig' && fallback.kind === 'dig') return { kind: 'dig', items, find: fallback.find };
  return fallback;
}

export async function generateGameContent(
  ctx: Ctx,
  gameId: ArcadeGameId,
  difficulty: Difficulty,
  skill: LearningSkill,
  seed: number,
  remoteFactory?: (ctx: Ctx) => Promise<Outcome<GameFactoryOutput> | null>
): Promise<Outcome<{ content: GameContent; story: string | null }>> {
  const game = getGame(gameId);
  const local = generateContent(gameId, difficulty, ctx.locale, seed);
  // Local content is free and instant: use the AI only where it adds variety (knowledge games).
  if (!game.aiContent || !ctx.sb) return { ok: true, data: { content: local, story: null }, source: 'local' };
  if (remoteFactory) {
    const r = await remoteFactory(ctx);
    if (r?.ok && r.data.gameType === gameId) return { ok: true, data: { content: factoryToContent(r.data, game.mechanic, local), story: r.data.story }, source: 'ai' };
  }
  if (!(deepseekReady() || nvidiaReady())) return { ok: true, data: { content: local, story: null }, source: 'local' };
  const blocked = await guarded(ctx, 'generate_game_content');
  if (blocked) return { ok: true, data: { content: local, story: null }, source: 'local' };
  const capsule = await Capsule.open(ctx.sb, 'generate_game_content', { provider: deepseekReady() ? 'deepseek' : 'nvidia', requestId: newRequestId() });
  await capsule.status('PROCESSING');
  const rounds = game.rounds[difficulty - 1];
  const ai = await aiJson(
    GameFactorySchema,
    `${CHILD_RULES(ctx.locale, ctx.ageGroup)} You create quiz content for the Ziggy Arcade game "${game.name.en}". Facts must be true and checkable.`,
    JSON.stringify({
      task: `Create ${rounds} questions. Difficulty ${difficulty}/5. ${game.mechanic === 'runner' ? 'Exactly 3 short options each.' : '3 or 4 options each.'} Index "answer" is 0-based.`,
      gameType: gameId,
      difficulty,
      skill,
      format: { gameType: gameId, difficulty, skill, questions: [{ prompt: 'string', visual: 'one emoji', options: ['string'], answer: 0, explain: 'one kind sentence' }], story: 'one sentence linking the game to an adventure', reward: { xp: 10, stars: 1 } },
    })
  ).catch(() => null);
  if (!ai || ai.data.gameType !== gameId) {
    await capsule.status('FAILED', { error: 'no_valid_answer' });
    return { ok: true, data: { content: local, story: null }, source: 'local' };
  }
  await capsule.status('VALIDATING', { provider: ai.provider });
  const safe = await shield(ai.data, 'generate_game_content', ctx.sb);
  if (!safe.ok) {
    await capsule.status('FAILED', { safety: 'blocked', error: 'unsafe' });
    return { ok: true, data: { content: local, story: null }, source: 'local' };
  }
  await capsule.status('COMPLETED', { safety: 'passed' });
  return { ok: true, data: { content: factoryToContent(ai.data, game.mechanic, local), story: ai.data.story }, source: 'ai', generationId: capsule.id };
}
