---
name: ziggy-game-architect
description: Architecture of Ziggy's web games (three.js kit, shared engine in src/games3d/engine, game/React boundary, level data, saves, extension points). Use when creating a new game, adding a shared engine module, or deciding where code belongs.
---

# ziggy-game-architect

Project rules: `CLAUDE.md`. Designs: `docs/GAME_DESIGN_LUTINS.md`. Architecture: `docs/GAME_ARCHITECTURE.md`. Assets: `docs/ASSET_PIPELINE.md`. Technology decisions: `docs/TECHNOLOGY_REGISTRY.md`, `docs/LICENCE_AUDIT.md`.

## Decisions already made (don't re-litigate without new evidence)
- 3D / 2.5D games: **three.js + our kit** (`src/games3d/kit`), code-built assets, PS2 felt look. React DOM mechanics for quiz/drag games. **Phaser 4** only after a prototype passes the bar in `research/github/REPORT.md` §4 (lazy-loaded, ≤ 400 KB gzip route, 60 fps on a 4-core tablet, no hydration error).
- No physics engine by default: slapstick and chain reactions are scripted. Rapier (Apache-2.0, ~1.2 MB gzip wasm) only for a game that needs real rigid bodies, lazy-loaded.
- Own tiny component system (bitECS is MPL-2.0 → forbidden).
- Every tappable 3D object gets an invisible real DOM button over the canvas (TV remote, screen readers, switch access, ≥ 64 px targets) — see `docs/GAME_ARCHITECTURE.md`.

## Rules
1. Pure, unit-tested game logic (`*/logic.ts`) separated from the scene/renderer; the scene only draws state.
2. Engine code is client-only: mount through a lazy `import()` inside a `'use client'` player; never touch `window` at module top level.
3. Fixed-timestep loop for real-time games (60 Hz), discrete steps for simulations (Factory). Use `THREE.Timer`, never the deprecated `THREE.Clock`.
4. Levels are schema-validated JSON, one file per level, separate from code; the schema has **no timer, lives or fail field** (child-safety red line). Factory levels ship a reference solution proved by the simulator; Chaos clues must point to exactly one elf.
5. Typed messages between game and React (HUD, read-aloud, results); results go through the existing World Memory (`finishExtraGame`).
6. Saves on the device only, versioned, migration-safe.
7. One writer per artefact: an agent/module owns its files; others consume contracts (JSON schemas, TS types).
8. Zero network during play: assets code-built or pre-generated offline (`docs/ASSET_PIPELINE.md`).
9. Extension points: prank types, fix puzzles, machines, toys, seasonal packs — added as data + small plug-ins, never by editing the core loop.
