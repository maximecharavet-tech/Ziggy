---
name: ziggy-game-design
description: Game design for Ziggy (kids 4–12): mechanics contract, objectives, rewards without manipulation, difficulty by age, learning goals. Use when designing or changing a game's rules, levels or rewards.
---

# ziggy-game-design

Project rules: `CLAUDE.md`. Designs: `docs/GAME_DESIGN_LUTINS.md`. Architecture: `docs/GAME_ARCHITECTURE.md`. Assets: `docs/ASSET_PIPELINE.md`. Technology decisions: `docs/TECHNOLOGY_REGISTRY.md`, `docs/LICENCE_AUDIT.md`.

## Red lines (CLAUDE.md) — design must respect them
No failure screens, no lives, no timers that punish, no streaks/guilt, no loot boxes, no ads, no purchases by children, companions never sad, no free LLM chat; FR+EN with read-aloud; big tap targets.

## Method (adapted from Tencent Game-Creation-Agents, Apache-2.0)
1. Write a **mechanics contract** in the game's design doc: controls table (literal inputs per device incl. TV remote), objectives table with "reachable by" + observable success signal, core rules, win conditions, juice intent. Tag rows MUST / MUST_NOT / SHOULD with their source (owner brief > design doc > genre default). Record tempting wrong defaults as MUST_NOT (e.g. "MUST_NOT: a timer").
2. The starting state must be actionable: the first objective reachable within seconds.
3. A mistake = a playful hint; nothing is lost (Factory: wrong toy → surprise shelf; Chaos: the elf takes the blame).
4. Three age bands (4–6, 7–9, 10–12): same level, different puzzle depth; the engine picks and caps difficulty.
5. Rewards are intrinsic: collection album, costumes, a growing house/workshop, creativity tools. Natural stopping points every 5–10 min.
6. Every learning goal maps to named levels (`docs/GAME_DESIGN_LUTINS.md` B9 / A9).
7. Narrative lines are authored (ink/inkjs or hand-written JSON), reviewed, ChildShield-checked.
8. Humour: slapstick, surprise, elves' personalities — never mocking the child.
