# Bac à sable magique — rebuild status (2026-11-17)

Brief: `docs/SANDBOX_REBUILD.md` (with Addenda 2 "no GPU" and 3 "saucer + parcel"). Refresh this file after every stage.

## Done (stages 1–5, 2026-11-14)
- Engine `rust/sandbox-core` (Rust → wasm, no GPU anywhere): packed u32 cells, 4-phase scans, 32×32 dirty chunks,
  half-res temperature plane, per-world physics (Moon slow fall + bounce, undersea medium, radial gravity in space),
  liquids/gases v2, critters (never hurt, bubble shield), Ziggy's parcel (7 exposures + per-world signature),
  tractor beam, gifts, save/load bytes (PackBits + checksum, refuses foreign bytes).
- Data file `data/sandbox.json` → `src/gen.rs` + `src/games2d/sandbox/wasm/ids.ts` (`npm run sandbox:wasm -- --gen`).
  49 elements, 82 reaction ids (66 world reactions + 16 parcel surprises; `gift_treasure` appended 2026-11-17).
- Software renderer: 2× (low) / 3× (high) / 1× rescue, height field → slope light, soft shadows, burial shade,
  glow buffer + blur, painted two-layer backdrops with parallax, faces, particles, critters, parcel + parachute, beam.
- Page: `content.ts`, `engine.ts`, `SandCanvas`, `Toolbar`, `Notebook`, `WorldPicker`, `Saucer`, `AlbumPanel`,
  `sounds.ts`, `storage.ts` v2.

## Done (finishing pass, 2026-11-17, not committed by the agent)
- **Parcel surprises with real in-world effects** (`src/toys.rs` engine, `src/render_toys.rs` drawing):
  - frozen → **music snow-globe**: a glass globe with a snowy pine on a wooden base, sits on the ground (falls
    gently, climbs out when buried); everything that falls within 26 cells plays the dominant element's note on a
    6-tick beat, pentatonic degree by position (left low, right high) → `notes_ptr/len` → `globeNote()` (WebAudio).
  - buried → **treasure map**: the engine hides a fossil / shell / meteorite (by world) under loose ground, ≥ 1/5 of
    the world away from the parcel; a pulsing golden X sits on the ground above it; digging (eraser touching it, or
    the spot laid open by anything) reveals it rising and glowing, emits `gift_treasure` once, leaves a keepsake
    (crystal / shell / meteorite cells, only in empty cells). The map is kept on the device (`save.maps[world]`,
    across-fraction) and re-buried on the next visit (column mode, works in the other orientation).
  - left in the wind → **aurora kite**: string tied where the parcel opened, steered by the finger (kite tool:
    tap launches one, drag steers) or pushed by the wind tool, stays in the sky, paints a 96-point aurora ribbon
    (blended by day, additive at night / in space).
  - Toys survive "start again" and are saved (save format version 2 adds a toy byte; version 1 saves still load).
    `globe` and `kite` become tools once discovered. FR + EN line for each surprise in the toast (🔊) and read
    after the discovery card; the treasure toast has a parchment mini-map; the notebook shows open maps.
- **Saucer juice**: looks ahead each 160 ms (`probe_sky`): ducks under (or hops over) a cloud, gets misted by
  geyser steam (shake + droplets + "Pfiou, tout mouillé !"). Reduced motion: slow straight glide, tween dodge, no
  shake. Fix: the site `MotionConfig reducedMotion="user"` dropped the glide (saucer parked off screen): the saucer
  now handles reduced motion by hand. Fix: the canvas stage is `overflow: clip` (focusing the saucer as it flew out
  scrolled the stage sideways on phones).
- **Big kids' lab (age band `big` = 10–12)**: 🔬 Labo button → gravity and temperature in 5 steps each, − / +
  buttons 64 px, setting in words, read aloud; on phones it lies over the tool balls (never over the sandbox).
  The notebook shows "Ce qui a changé / What changed" with one science line per setting (`science.ts`).
- **Adaptive tier** (`tier.ts`): median of the last 45 frame costs, checked every 15 frames; 3 checks above 8 ms →
  one tier down; 12 checks under 4.4 ms → one tier up (never above the device's start tier); each undone climb
  doubles the next wait. Paused frames are ignored. Tier kept across world rebuilds. `data-tier-changes` lists them.
- **TV**: the sandbox is on the TV home games row (`TV_EXTRAS`); the canvas is the landing spot; arrows move a
  visible brush ring, OK pours (a short press still pours), OK with a one-tap tool places it; an arrow at an edge
  leaves the canvas (down → the tool under the brush), worlds picker and lab reachable with the remote.
- **Phone**: the portrait mountain's frozen lake was roofed over by the second peak (heat never reached the ice):
  the scene now opens the lake to the sky. Mars dust devil was a script issue (strokes deep in the ground).

## Verified 2026-11-17
- `cargo test --release` (23 behaviour + 6 reactions + 8 toys), `cargo clippy --release --all-targets -D warnings`,
  `cargo fmt --check`; `npm run sandbox:wasm -- --check`; `npm run check` (tsc + eslint + vitest, incl. tier,
  science, storage maps, wasm toys).
- Production build `.next-sandbox` on :3510, Playwright (`<scratchpad>/sandbox2/tools/pw2.cjs`): desktop 1280×800,
  8 cores, phone 390×844 reduced motion with real touch strokes, TV (`?tv=1`, keyboard only): 8 worlds × 2
  reactions, the three surprises reached the child's way (saucer → parcel → wind / snow / sand → kite steered,
  globe singing, X dug up), lab, no page errors, no horizontal overflow.
- In-page frame cost (brush + step + render + blit), 4-core sandbox, low tier: 2.5–5.4 ms per world (phone
  2.8–6.7 ms); lava flood in the volcano pushed the low tier's median past 8 ms → rescue, back to low once calm.
  `hardwareConcurrency` 8 (high tier): medians 3.2–6.7 ms per world; volcano lava flood 7.8 → 8.9 ms → low
  (5.4–5.7 ms), back to high when calm; 6 tier changes over a 25-minute session (no flicker).

## Next / imperfect
- wasm 297 kB raw / 104 kB gzip (target 150 kB soft; no wasm-opt here).
- Portrait space: the Playwright water stroke misses the gravity ball (script), not re-checked in portrait.
- The discovery card shows 🦴 for every treasure (the toast names the right one: fossil, shell, meteorite).
- The aurora ribbon is faint against bright day skies.
- A discovery card waiting to be read keeps the saucer away until it is put in the notebook (by design: calm).

## How to resume
`cd rust/sandbox-core && cargo test --release`; `npm run sandbox:wasm`; Node renders: `node <scratchpad>/sandbox2/tools/toys.mjs <world>`;
browser: `node <scratchpad>/sandbox2/tools/pw2.cjs desktop|cores8|phone|tv [worlds|tier|surprises|lab]`.
