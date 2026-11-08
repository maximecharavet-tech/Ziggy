# Les Lutins Farceurs (`/lutins`)

Christmas 2026 product for parents: every night of December, the parent takes a
photo of a room and picks (or describes) a prank; the AI puts Ziggy's three felt
elves into the photo, playing that prank. In the morning the child discovers the
picture (and a short video) in "Le journal des lutins". Free.

## The three elves (always the same)
Source of truth: `src/data/lutins/bible.json` (read by the Rust prompt builder, the
3D models and the UI). Original characters (felt plush, Ziggy's look): **Pépin**
(green tunic, long striped red-white hat with a bell), **Grelotte** (lavender tunic,
mustard scarf and pompom hat, braids, round glasses), **Noisette** (tiny, hazelnut
hooded cape with an acorn-cap hat). Not a copy of any commercial elf doll.

## How the elves stay identical (the "consistency engine")
1. **Character sheet**: the elves are modelled in code (three.js, `src/games3d/lutins/`)
   and rendered once into reference sheets (`public/lutins/refs/*.png`), front / 3⁄4 /
   side. Every generation sends the sheet as a reference image next to the photo.
2. **Bible prompt**: an unchanging description of each elf + style + negatives, built by
   the Rust crate; the parent's words only fill the *action* slot.
3. **Scene analysis (on the device, Rust → WebAssembly)**: light direction and colour
   temperature, brightness, palette, and the free "stages" of the photo (empty,
   flat, well-lit areas: table tops, shelves, floor) found with an edge/saliency map.
   The prompt places the elves there and matches the light.
4. **Verification (server, same Rust crate)**: the generated image must still be the
   parent's room (structural similarity of the downscaled image outside the elf
   areas) and must contain the elves' signature colours (Lab colour histograms vs the
   sheet). If not, one automatic retry with a stricter prompt.

## Privacy and safety
- **No people in the photo**: on-device person detection (MediaPipe selfie segmenter,
  already self-hosted for the Santa booth) blocks a photo with a person before upload;
  the parent is asked for a photo of the room only. So no child image reaches anyone.
- The photo is re-encoded on the device (strips EXIF/GPS), downscaled (≤ 1536 px),
  sent to our server and Agnes only for that generation, never stored by us.
- The parent's description goes through ChildShield; the prompt is a fixed template.
- The child's journal (pictures, videos, notes) stays on the device (IndexedDB).
- Free, with fair-use limits per device and a global daily cap (env), so the free
  service can't be used as a general image generator.

## Architecture
- Rust crate `rust/lutins-core` → wasm (`src/lib/lutins/wasm/`, built by
  `npm run lutins:wasm`, committed): photo analysis, stage finder, palette, prompt
  builder, verifier, video-card frame renderer. Runs in the browser and in the
  Node API routes.
- `src/app/api/lutins/generate` (image), `src/app/api/lutins/video` (create + poll).
- UI: `src/app/[locale]/lutins/` (parent studio), `/lutins/journal` (child view).
