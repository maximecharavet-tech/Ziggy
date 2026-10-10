/**
 * Strict JSON schemas (Zod) for everything the AI may return. The AI never
 * returns code, HTML, SQL or URLs to fetch — only these structures, which
 * are validated server-side before anything else happens.
 */
import { z } from 'zod';
import { ARCADE_GAME_IDS } from '@/lib/arcade/types';
import { LEARNING_SKILLS } from '@/lib/learning/skills';

const text = (max: number) => z.string().trim().min(1).max(max);
/** No markup, no code, no links, in any string that reaches the screen. */
const plain = (max: number) =>
  text(max).refine((s) => !/[<>{}`]|https?:\/\/|www\.|javascript:|<script/i.test(s), 'plain text only');

/* ── Avatar ── */

export const HAIR_COLORS = ['black', 'dark_brown', 'brown', 'auburn', 'red', 'blond', 'light_blond', 'grey', 'blue', 'pink'] as const;
export const HAIR_LENGTHS = ['very_short', 'short', 'medium', 'long'] as const;
export const HAIR_STYLES = ['straight', 'wavy', 'curly', 'coily', 'braids', 'ponytail', 'buns', 'covered'] as const;
export const SKIN_TONES = ['tone1', 'tone2', 'tone3', 'tone4', 'tone5', 'tone6'] as const;
export const EYE_COLORS = ['brown', 'dark_brown', 'hazel', 'green', 'blue', 'grey'] as const;
export const AVATAR_STYLES = ['plush', 'cartoon', 'watercolor', 'clay', 'pixel'] as const;
export const OUTFITS = ['explorer', 'astronaut', 'wizard', 'chef', 'artist', 'pirate', 'princess', 'hero', 'scientist', 'sporty'] as const;

/**
 * VisualBlueprint: only what an illustrator needs to draw a cartoon of the
 * child — no identity, no estimate of real age, ethnicity, health or
 * anything personal. The child is always drawn as a child.
 */
export const VisualBlueprintSchema = z.object({
  hairColor: z.enum(HAIR_COLORS),
  hairLength: z.enum(HAIR_LENGTHS),
  hairStyle: z.enum(HAIR_STYLES),
  skinTone: z.enum(SKIN_TONES),
  eyeColor: z.enum(EYE_COLORS),
  glasses: z.boolean(),
  freckles: z.boolean(),
});
export type VisualBlueprint = z.infer<typeof VisualBlueprintSchema>;

export const AvatarRequestSchema = z.object({
  blueprint: VisualBlueprintSchema,
  style: z.enum(AVATAR_STYLES),
  outfit: z.enum(OUTFITS),
  worldId: z.string().regex(/^[a-z_]{2,20}$/),
});
export type AvatarRequest = z.infer<typeof AvatarRequestSchema>;

/* ── Quests ── */

export const QuestContentSchema = z.object({
  title: plain(60),
  intro: plain(260),
  steps: z.array(plain(140)).min(1).max(3),
  companionLine: plain(140),
  reward: z.object({ xp: z.number().int().min(5).max(50), stars: z.number().int().min(1).max(3) }),
});
export type QuestContent = z.infer<typeof QuestContentSchema>;

/* ── Stories ── */

export const StoryJsonSchema = z.object({
  title: plain(70),
  chapters: z
    .array(
      z.object({
        title: plain(60),
        scenes: z.array(z.object({ text: plain(420), emoji: z.string().max(8).optional() })).min(1).max(4),
      })
    )
    .min(1)
    .max(3),
  moral: plain(160),
});
export type StoryJson = z.infer<typeof StoryJsonSchema>;

/* ── Game factory: the exact JSON shape the AI must return ── */

export const GameQuestionSchema = z
  .object({
    prompt: plain(140),
    visual: z.string().max(8).optional(),
    options: z.array(plain(40)).min(2).max(4),
    answer: z.number().int().min(0).max(3),
    explain: plain(160).optional(),
  })
  .refine((q) => q.answer < q.options.length, 'answer out of range')
  .refine((q) => new Set(q.options.map((o) => o.toLowerCase())).size === q.options.length, 'duplicate options');

export const GameFactorySchema = z.object({
  gameType: z.enum(ARCADE_GAME_IDS),
  difficulty: z.number().int().min(1).max(5),
  skill: z.enum(LEARNING_SKILLS),
  questions: z.array(GameQuestionSchema).min(3).max(12),
  story: plain(260),
  reward: z.object({ xp: z.number().int().min(5).max(50), stars: z.number().int().min(1).max(3) }),
});
export type GameFactoryOutput = z.infer<typeof GameFactorySchema>;

/** Read a model answer as JSON: tolerate a ```json fence, nothing else. */
export function parseModelJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object');
  return JSON.parse(trimmed.slice(start, end + 1));
}
