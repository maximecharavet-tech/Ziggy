# Ziggy World — Game engine

## 20 games, 10 mechanics
`src/lib/arcade/registry.ts` defines each `GameDefinition` (name, mechanic, skills, rounds per
difficulty, whether AI content is useful). Mechanics live in `src/components/arcade/mechanics/`:
choice, runner (Phaser 3, lazy-loaded), pairs, order, sort, spell, mix, dig, melody, slide.

## Content
- Local: `generateContent(gameId, difficulty, locale, seed)` — deterministic (mulberry32), sized by
  difficulty, French or English. Always available, tested for every game × difficulty × locale.
- AI Game Factory: the model must return exactly
  `{gameType, difficulty, skill, questions[{prompt, visual, options, answer, explain}], story, reward}`.
  Validation: enum game/skill, 3–12 questions, 2–4 unique options, answer in range, plain text only.
  Invalid → one correction request → still invalid or unsafe → local content.

## Zero failure
Wrong answers give a gentle "Almost!" and the right answer; every finished game earns at least one
star. Mechanics report `{correct, mistakes, total}`; there is no "lost" state.

## Adaptive learning (`src/lib/learning/adaptive.ts`)
Per skill: `skillScore` (EMA of accuracy), `masteryEstimate` (Bayesian knowledge tracing, damped so
mastery is earned across sessions), `difficulty` 1–5 (up after ≥90 % or two great rounds, down after
<50 %), `streak` of great rounds. Stars: ≥90 % → 3, ≥60 % → 2, else 1.

## Adaptive Quest Engine (`src/lib/world/engine.ts`)
`nextAdventure(memory, worlds, today)` → world, quest, game, skill, difficulty, companion, reward,
chapter, daily flag and reason (`continue | new_world | practice | confidence | replay`).
After hard rounds it picks a confident skill; otherwise it practises the least-mastered one.
`applyRound()` updates the memory and returns Magic Moments: FIRST_QUEST, FIRST_PERFECT, NEW_ITEM,
CHAPTER_COMPLETE, WORLD_COMPLETE, NEW_WORLD, NEW_COMPANION, LEVEL_UP, NEW_BADGE, GREAT_STREAK, DAILY_DONE.
The same engine runs on the server (`/api/ziggy/game/result`) and offline on the device.

## Story
Each world = 3 chapters × 2 quests; completing a quest reveals a place, friend or treasure
(`buildStory`). Story Builder (`/monde/histoires`) composes stories from predefined choices only.
