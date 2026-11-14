# Bac à sable magique — rebuild status (2026-11-14)

Brief: `docs/SANDBOX_REBUILD.md` (with Addenda 2 "no GPU" and 3 "saucer + parcel"). Refresh this file after every stage.

## Done (stages 1–5, not committed by the agent)
- Engine `rust/sandbox-core` (Rust → wasm, no GPU anywhere): packed u32 cells, 4-phase scans, 32×32 dirty chunks,
  half-res temperature plane, per-world physics (Moon slow fall + bounce, undersea medium, radial gravity in space),
  liquids/gases v2, critters (never hurt, bubble shield), Ziggy's parcel (7 exposures + per-world signature),
  tractor beam, gifts, save/load bytes (PackBits + checksum, refuses foreign bytes).
- Data file `data/sandbox.json` → `src/gen.rs` + `src/games2d/sandbox/wasm/ids.ts` (`npm run sandbox:wasm -- --gen`).
  49 elements, 81 reaction ids (66 world reactions + 15 parcel surprises).
- Software renderer: 2× (low) / 3× (high) / 1× rescue, height field → slope light, soft shadows, burial shade,
  ground blotches/strata, grass blades, rounded liquids with surface line, glints, depth tint and refraction (high),
  glow buffer + blur, painted two-layer backdrops per world with Bayer dithering and parallax, faces on blobs,
  big flower heads, particles, critters with squash & stretch, parcel + parachute, beam. Reduced motion freezes it.
- Page: `content.ts`, `engine.ts`, `SandCanvas`, `Toolbar` (6 big tools + categorised drawer, wraps on phones),
  `Notebook` (per world + stickers), `WorldPicker`, `Saucer`, `AlbumPanel`/`album.ts` (IndexedDB), `sounds.ts`,
  `storage.ts` v2. Old TS sim deleted.
- Tests: 29 Rust (behaviour, every reaction, parcel, beam, fuzz, tiers, native hash 2500734713) and 13 Vitest
  (content FR+EN/banned words/ids, v1→v2 save migration fixture, wasm hash == native, save/load, render).
- Verified 2026-11-14: cargo test/clippy/fmt, `sandbox:wasm --check`, `npm run check`, production build
  (`.next-sandbox`, port 3510), Playwright desktop / phone / reduced motion / 8 cores: 8 worlds × 2 reactions in the
  notebook (desktop + 8 cores), album save+restore, photo, saucer → parcel → watered → opened, no page errors,
  no overflow. In-page frame time: low tier 3.0–5.9 ms, high tier 3.3–9.3 ms.

## Next / imperfect
- High tier exceeds 8 ms in busy scenes (volcano ≈ 9 ms in page); rescue tier only kicks in above 12 ms.
- wasm 271 kB raw / 96 kB gzip (target 150 kB soft; no wasm-opt here).
- Parcel: cold → snow-globe, buried → map, wind → kite are messages + stickers only (no dedicated mechanics yet);
  saucer does not dodge clouds / get misted. Age sliders (gravity/temperature) exist in the engine API but have no UI.
- Phone strokes in the Playwright script are approximate (mountain/mars reactions not reached there).
- TV: canvas + buttons are keyboard/D-pad reachable, no `src/lib/tv` integration.

## How to resume
`cd rust/sandbox-core && cargo test --release`; `npm run sandbox:wasm`; Node renders of every world:
`node <scratchpad>/sandbox/tools/shots.mjs`; browser check: `node <scratchpad>/sandbox/tools/pw.cjs desktop`.
