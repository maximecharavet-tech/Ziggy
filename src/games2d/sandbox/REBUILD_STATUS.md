# Bac à sable magique — rebuild status

Brief: `docs/SANDBOX_REBUILD.md` (with Addenda 2 "no GPU" and 3 "saucer + parcel"). Refresh this file after every stage.

## Done
- Stages 1–4 (engine side): `rust/sandbox-core` compiles, clippy/fmt clean, **28 Rust tests green**
  (`tests/behaviour.rs`: ported behaviour tests, calm scenes ×8 worlds ×2 orientations, determinism, save/load,
  fuzz, renderer tiers, reduced motion, ids; `tests/reactions.rs`: one scenario per reaction (66), Mars dome,
  parcel opening by each of the 7 exposures, parcel never lost, tractor beam).
- Data file `data/sandbox.json`: 49 elements, 81 reaction ids (66 world reactions + 15 parcel surprises).
- Software renderer (no GPU): 2×/3× tiers, burial shade + ground blotches, slope light, soft shadows, grass,
  rounded liquids with surface line/glints/refraction, glow buffer, painted backdrops per world, faces on blobs,
  big flower heads, particles, critters with squash & stretch.
- `npm run sandbox:wasm` builds `src/games2d/sandbox/wasm/` (~265 kB raw, ~94 kB gzip, no wasm-opt here).
- Loader `src/games2d/sandbox/engine.ts`; benchmark `scripts/sandbox-bench.mjs` (low tier worst case ≈ 5.3 ms).

## In progress
- Stage 5: React side on the new engine.

## Next
1. React: `content.ts` (worlds, tools, discoveries FR+EN), `SandCanvas` (wasm canvas, per-pointer strokes),
   `Toolbar` (6 big tools + drawer), `Notebook` grouped by world, storage v2 + migration test, album (IndexedDB),
   sounds, saucer + parcel UI. Imports from `motion/react`.
2. Delete the old TS sim (`sim.ts`, `render.ts`, `scenes.ts`, `sim.test.ts`, `components/sandbox/shading.ts`).
3. Verify: `sandbox:wasm --check`, `npm run check`, build on 3510, Playwright all worlds.

## How to resume
`cd rust/sandbox-core && cargo test --release` (all green), then continue the React step above.
Node renders of every world: `node <scratchpad>/sandbox/tools/shots.mjs` (writes PNGs).
