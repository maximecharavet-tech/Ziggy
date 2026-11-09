---
name: ziggy-level-design
description: Level design for Ziggy's games (Lutin Chaos rooms, Lutin Factory halls, sandbox): level data, pacing, reachability, procedural variation. Use when creating, editing or validating levels.
---

# ziggy-level-design

Project rules: `CLAUDE.md`. Designs: `docs/GAME_DESIGN_LUTINS.md`. Architecture: `docs/GAME_ARCHITECTURE.md`. Assets: `docs/ASSET_PIPELINE.md`. Technology decisions: `docs/TECHNOLOGY_REGISTRY.md`, `docs/LICENCE_AUDIT.md`.

## Rules
1. One JSON file per level, validated by the level schema test; no timer / lives / fail fields exist in the schema.
2. Each placed objective must be reachable — prove it automatically (Factory: the simulator runs the reference solution; Chaos: each clue identifies exactly one elf, each prank has a fix).
3. Build rooms/halls from reusable prefabs (furniture sets, machine kits), not hand-placed meshes; repeats via `InstancedMesh`, varied static props via `BatchedMesh`.
4. Deterministic seeds (`src/games3d/kit/rng.ts`) for replay variation, so tests replay identically.
5. Pacing per level: teach (1 new idea) → practise → twist → celebrate. 3 age-band variants in the same file.
6. A revise pass touches only the levels named in the issue list.
7. AI-drafted levels (small Qwen3 / MiniCPM offline only) are drafts: our solver + ChildShield + a human review before commit; never generated at runtime.
8. Budget per level: ≤ 120 draw calls, ≤ 150k triangles on the low-power path.
