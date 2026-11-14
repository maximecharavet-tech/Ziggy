---
name: ziggy-game-testing
description: Testing and QA of Ziggy's games: logic tests, level validation, deterministic replays, Playwright + SwiftShader renders, play checks, child-safety review. Use before calling any game change done.
---

# ziggy-game-testing

Project rules: `CLAUDE.md`. Designs: `docs/GAME_DESIGN_LUTINS.md`. Architecture: `docs/GAME_ARCHITECTURE.md`. Assets: `docs/ASSET_PIPELINE.md`. Technology decisions: `docs/TECHNOLOGY_REGISTRY.md`, `docs/LICENCE_AUDIT.md`.

## Mandatory loop (CLAUDE.md)
`npm run check` (tsc + eslint + vitest) → production build with your own `NEXT_DIST_DIR` and port → Playwright (Chromium `/opt/pw-browsers/chromium`, `--use-gl=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`) at 1280×800 and 390×844, also `reducedMotion: 'reduce'` and `hardwareConcurrency` forced to 8. No page errors, no hydration errors, no real horizontal overflow (check elements wider than the screen even inside clipping parents). After a build: `git checkout tsconfig.json` alone.

## Patterns (adapted from Tencent Game-Creation-Agents, Apache-2.0)
1. **State injection:** test builds expose the game on a test-only global; jump to a level/state and wait for an observable condition — never fixed sleeps.
2. Canvas interactions by fractions of the canvas box, or through the invisible DOM buttons (preferred: also tests accessibility).
3. Oracles: `frozen_state` (state signature unchanged over 6 samples) vs `inert_scene` (low visual change over 4 frames) — diagnose separately.
4. Objectives judged YES / NO / PARTIAL with evidence; each must be reachable.
5. Determinism: seed + recorded inputs → identical end state.
6. Blind critic: a reviewer that sees only screenshots/video + the design doc, default "not ready"; plus the `child-safety-reviewer` agent for anything children see.
7. Living failure catalogue: append signature → root cause → verified fix only after a verified re-run (CLAUDE.md "Lessons learned").
8. Console warnings are failures (e.g. three's deprecated `Clock`, removed `PCFSoftShadowMap`).
