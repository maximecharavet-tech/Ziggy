---
name: ziggy-ai-characters
description: Intelligent behaviour for Ziggy, the elves and other companions: NPC behaviour, dialogue, AI-generated content within the child-safety rules. Use when making characters react, talk or decide, or when any AI model touches a game.
---

# ziggy-ai-characters

Project rules: `CLAUDE.md`. Designs: `docs/GAME_DESIGN_LUTINS.md`. Architecture: `docs/GAME_ARCHITECTURE.md`. Assets: `docs/ASSET_PIPELINE.md`. Technology decisions: `docs/TECHNOLOGY_REGISTRY.md`, `docs/LICENCE_AUDIT.md`.

## Hard rules (CLAUDE.md)
- Every AI text goes through ChildShield; the AI never claims to be human; **no free LLM chat for children** (only exception: the owner-approved live Père Noël call, `docs/PERE_NOEL.md`).
- No child voice, image or data to third parties; no emotion recognition on children (red line + EU AI Act).
- Zero running cost: prefer authored or offline-generated content.

## How
1. Behaviour = small state machines + steering (seek, arrive, wander, flee-playfully) in the kit — patterns from yuka/recast, ported, not added as dependencies. Navmesh (recast-navigation-js, MIT) only if worlds get complex.
2. Dialogue = authored lines (FR+EN), optionally branching with ink/inkjs (MIT), read aloud; voices baked offline (Kokoro, or Qwen3-TTS VoiceDesign for invented elf voices — never cloned real voices).
3. Reactions are context-driven from game state (what the child just did), always positive.
4. Offline LLM drafting (Qwen3 small, MiniCPM4, GLM-4.5-Air — Apache/MIT) is allowed for content catalogues; output passes `src/lib/hyper-engine/verify.ts`-style checks + ChildShield + human review, then ships as static JSON.
5. Check `docs/LICENCE_AUDIT.md` §5 before any model: Hunyuan (EU-excluded), FLUX dev (NC), MusicGen (NC) and others are forbidden.
