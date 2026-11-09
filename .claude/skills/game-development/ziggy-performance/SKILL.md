---
name: ziggy-performance
description: Performance of Ziggy's web games on mid phones, tablets and TVs: budgets, draw calls, shadows, lazy loading, low-power path. Use when a scene grows, a game feels slow, or before shipping a game.
---

# ziggy-performance

Project rules: `CLAUDE.md`. Designs: `docs/GAME_DESIGN_LUTINS.md`. Architecture: `docs/GAME_ARCHITECTURE.md`. Assets: `docs/ASSET_PIPELINE.md`. Technology decisions: `docs/TECHNOLOGY_REGISTRY.md`, `docs/LICENCE_AUDIT.md`.

## Budgets (4-core phone, low-power path)
≤ 120 draw calls · ≤ 150k triangles · ≤ 48 MB textures · ≥ 30 fps (60 on capable devices) · no bloom on felt.

## Rules
1. `prefersLowPower()` (≤ 4 cores): lower pixel ratio, no post/bloom, fewer particles — and always test the capable path too (CLAUDE.md lesson: white veil, crash at start).
2. Repeats → `InstancedMesh`; varied static props → `BatchedMesh`; merge static geometry; share materials.
3. Shadows: `PCFSoftShadowMap` was removed in three r186 — use `PCFShadowMap` (or VSM), small maps, few casters; contact shadows as cheap blobs.
4. Picking on dense meshes: three-mesh-bvh (MIT, test).
5. Lazy-load engines and wasm per game route (Phaser ≈ 352 KB gzip, Rapier ≈ 1.2 MB gzip); cache static game files with `public/sw.js` and bump its `VERSION` when regenerated.
6. No allocations in the frame loop; pool objects; pause rendering when the tab is hidden.
7. Rust → wasm for heavy pixel/math work (see `rust/lutins-core`: < 8 ms/frame budgets, measured in a Node benchmark).
8. One explicit FPS target per game, measured on the low-power path — no invented global thresholds.
