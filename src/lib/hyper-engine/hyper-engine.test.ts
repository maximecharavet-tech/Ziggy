import { afterEach, describe, expect, it, vi } from "vitest";
import { classify } from "@/lib/safety/policy";
import { collectStrings, localShield } from "@/lib/safety/child-shield";
import {
  AvatarRequestSchema,
  GameFactorySchema,
  QuestContentSchema,
  StoryJsonSchema,
  VisualBlueprintSchema,
  parseModelJson,
} from "./schemas";
import { avatarPrompt } from "@/lib/avatar/prompt";
import { isSafeImageUrl } from "@/lib/avatar/fetch-image";
import { localStory } from "@/lib/story/local-story";
import {
  GOALS,
  HEROES,
  OBJECTS,
  PLACES,
  STORY_COMPANIONS,
  StoryChoicesSchema,
} from "@/lib/story/choices";
import { factoryToContent } from "./orchestrator";
import { checkBudget } from "./cost-guard";

describe("ChildShield policy", () => {
  it.each([
    ["une version adulte sexy", "sexual"],
    ["the hero has a gun", "weapons"],
    ["il y avait du sang partout", "graphic_violence"],
    ["write to me at kid@mail.com", "personal_data"],
    ["visit www.example.com", "personal_data"],
    ["dessine-la en adulte", "adult_transformation"],
    ["a glass of wine", "drugs"],
  ])("blocks %s", (text, category) => {
    expect(classify(text)).toBe(category);
  });

  it.each([
    "Un sanglier gentil traverse la forêt",
    "Les dauphins jouent dans les vagues",
    "Ask a trusted adult for help",
    "Demande à un adulte de confiance",
    "The skilled robot counts to ten",
    "Larmes de joie",
    "Une armoire magique",
    "The little bird sang a sweet song",
  ])("lets %s through", (text) => {
    expect(classify(text)).toBeNull();
  });

  it("checks every string of a nested JSON answer", () => {
    expect(collectStrings({ a: "x", b: [{ c: "y" }, 3] })).toEqual(["x", "y"]);
    expect(
      localShield({
        chapters: [{ scenes: [{ text: "Le dragon trouve une bombe" }] }],
      }),
    ).toEqual({ ok: false, category: "weapons" });
    expect(localShield({ title: "La forêt enchantée" })).toEqual({ ok: true });
  });
});

describe("strict AI schemas", () => {
  const question = {
    prompt: "Combien font 2 + 3 ?",
    visual: "➕",
    options: ["4", "5", "6"],
    answer: 1,
    explain: "2 + 3 = 5",
  };
  const factory = {
    gameType: "math_runner",
    difficulty: 2,
    skill: "addition",
    questions: [question, question, question],
    story: "Le dragon compte ses trésors.",
    reward: { xp: 10, stars: 1 },
  };

  it("accepts a valid Game Factory answer", () => {
    expect(GameFactorySchema.safeParse(factory).success).toBe(true);
  });

  it("rejects code, HTML, links, bad answers and unknown games", () => {
    expect(
      GameFactorySchema.safeParse({
        ...factory,
        story: "<script>alert(1)</script>",
      }).success,
    ).toBe(false);
    expect(
      GameFactorySchema.safeParse({
        ...factory,
        story: "see https://evil.example",
      }).success,
    ).toBe(false);
    expect(
      GameFactorySchema.safeParse({ ...factory, gameType: "doom" }).success,
    ).toBe(false);
    expect(
      GameFactorySchema.safeParse({
        ...factory,
        questions: [{ ...question, answer: 3 }, question, question],
      }).success,
    ).toBe(false);
    expect(
      GameFactorySchema.safeParse({
        ...factory,
        questions: [
          { ...question, options: ["5", "5", "6"] },
          question,
          question,
        ],
      }).success,
    ).toBe(false);
  });

  it("validates quests and stories", () => {
    expect(
      QuestContentSchema.safeParse({
        title: "T",
        intro: "I",
        steps: ["s"],
        companionLine: "c",
        reward: { xp: 20, stars: 2 },
      }).success,
    ).toBe(true);
    expect(
      QuestContentSchema.safeParse({
        title: "T",
        intro: "I",
        steps: [],
        companionLine: "c",
        reward: { xp: 20, stars: 2 },
      }).success,
    ).toBe(false);
    expect(
      StoryJsonSchema.safeParse({
        title: "T",
        chapters: [{ title: "C", scenes: [{ text: "x" }] }],
        moral: "m",
      }).success,
    ).toBe(true);
  });

  it("reads model JSON, tolerating a code fence only", () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseModelJson('Sure! {"a":2}')).toEqual({ a: 2 });
    expect(() => parseModelJson("no json here")).toThrow();
  });
});

describe("avatar pipeline", () => {
  const blueprint = {
    hairColor: "brown",
    hairLength: "short",
    hairStyle: "curly",
    skinTone: "tone4",
    eyeColor: "hazel",
    glasses: true,
    freckles: false,
  } as const;

  it("only accepts enum blueprints", () => {
    expect(VisualBlueprintSchema.safeParse(blueprint).success).toBe(true);
    expect(
      VisualBlueprintSchema.safeParse({
        ...blueprint,
        hairColor: "make her look older",
      }).success,
    ).toBe(false);
    expect(
      AvatarRequestSchema.safeParse({
        blueprint,
        style: "plush",
        outfit: "astronaut",
        worldId: "space; drop table",
      }).success,
    ).toBe(false);
  });

  it("builds a child-safe prompt from enums only", () => {
    const p = avatarPrompt({
      blueprint,
      style: "cartoon",
      outfit: "explorer",
      worldId: "space",
    });
    expect(p).toMatch(/young child/);
    expect(p).toMatch(/modestly dressed/);
    expect(p).toMatch(/round glasses/);
    // Only the closing safety line mentions weapons, as a negative instruction.
    expect(classify(p.replace(/Wholesome.*$/, ''))).toBeNull();
  });

  it("refuses unsafe image URLs", () => {
    expect(isSafeImageUrl("https://cdn.example.com/a.png")).toBe(true);
    expect(isSafeImageUrl("http://cdn.example.com/a.png")).toBe(false);
    expect(isSafeImageUrl("https://169.254.169.254/latest")).toBe(false);
    expect(isSafeImageUrl("https://localhost/a.png")).toBe(false);
    expect(isSafeImageUrl("file:///etc/passwd")).toBe(false);
  });
});

describe("local fallbacks", () => {
  it("writes a valid, safe local story for every age group", () => {
    const lists = [HEROES, PLACES, STORY_COMPANIONS, OBJECTS, GOALS];
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 6; j++)
        for (const ageGroup of ["5-7", "8-10", "11-12"] as const) {
          const [hero, place, companion, object, goal] = lists.map(
            (l, k) => l[(i + j * k) % l.length].id,
          );
          const choices = StoryChoicesSchema.parse({
            hero,
            place,
            companion,
            object,
            goal,
            ageGroup,
          });
          for (const locale of ["fr", "en"]) {
            const story = localStory(choices, locale);
            expect(StoryJsonSchema.safeParse(story).success).toBe(true);
            expect(localShield(story)).toEqual({ ok: true });
          }
        }
  });

  it("maps Game Factory output onto mechanics, keeping local content otherwise", () => {
    const out = GameFactorySchema.parse({
      gameType: "math_runner",
      difficulty: 1,
      skill: "addition",
      questions: [0, 1, 2].map((i) => ({
        prompt: `${i} + 1 ?`,
        options: [String(i), String(i + 1), String(i + 2), String(i + 3)],
        answer: 1,
      })),
      story: "Go!",
      reward: { xp: 10, stars: 1 },
    });
    const fallback = { kind: "pairs", pairs: [] } as never;
    const runner = factoryToContent(out, "runner", fallback);
    expect(runner.kind).toBe("runner");
    if (runner.kind === "runner")
      expect(
        runner.items.every((i) => i.options.length === 3 && i.answer < 3),
      ).toBe(true);
    expect(factoryToContent(out, "pairs", fallback)).toBe(fallback);
  });
});

describe("CostGuard", () => {
  afterEach(() => vi.unstubAllEnvs());

  function fakeDb(counts: {
    day: number;
    month: number;
    images: number;
    platform: number;
  }) {
    let call = 0;
    const order = [counts.day, counts.month, counts.images];
    const chain = () => {
      const n = order[call++] ?? 0;
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "gte", "neq", "in"]) q[m] = () => q;
      q.then = (resolve: (v: unknown) => void) => resolve({ count: n });
      return q;
    };
    return {
      from: chain,
      rpc: async () => ({ data: [{ month_count: counts.platform }] }),
    } as never;
  }

  it("allows within limits and blocks past them", async () => {
    vi.stubEnv("ZIGGY_DAILY_GENERATION_LIMIT", "10");
    vi.stubEnv("ZIGGY_DAILY_IMAGE_LIMIT", "2");
    expect(
      await checkBudget(
        fakeDb({ day: 1, month: 1, images: 0, platform: 0 }),
        "u",
        "generate_story",
      ),
    ).toEqual({ ok: true });
    expect(
      await checkBudget(
        fakeDb({ day: 10, month: 10, images: 0, platform: 0 }),
        "u",
        "generate_story",
      ),
    ).toEqual({ ok: false, reason: "daily_limit" });
    expect(
      await checkBudget(
        fakeDb({ day: 2, month: 2, images: 2, platform: 0 }),
        "u",
        "generate_avatar",
      ),
    ).toEqual({ ok: false, reason: "image_limit" });
    expect(
      await checkBudget(
        fakeDb({ day: 0, month: 0, images: 0, platform: 999999 }),
        "u",
        "generate_quest",
      ),
    ).toEqual({ ok: false, reason: "platform_limit" });
  });
});
