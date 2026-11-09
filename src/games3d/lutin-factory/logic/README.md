# Lutin Factory: pure logic (`src/games3d/lutin-factory/logic/`)

« L'Atelier des Lutins » / *Elf Workshop*, design: `docs/GAME_DESIGN_LUTINS.md` part B,
architecture: `docs/GAME_ARCHITECTURE.md` §3.12, §5–7. This folder is **build-order step 2**:
everything the game decides, with **no three.js, no DOM, no React**. The runtime (three.js
scenes, `FactoryGame.ts`) and the React HUD (`LutinFactoryPlayer.tsx`) come later and only
*show* this state and turn taps into the edit calls below.

Import from the barrel: `import { FactorySim, check, LEVELS, … } from '@/games3d/lutin-factory/logic'`.

## Data

| File | What |
|---|---|
| `src/data/games/lutin-factory/levels/l01.json … l15.json` | 15 levels × 3 bands (`little` 4–6, `middle` 7–9, `big` 10–12), each with a reference solution |
| `src/data/games/lutin-factory/toys.json` | toy recipes (parts by shape / material / count, variable `n` for wagons and tower blocks), FR/EN names with gender and plural, link to the Santa catalogue (`gift`) |
| `src/data/games/lutin-factory/lines.json` | Ziggy / elf voice lines per moment (happy emotions and rig cues only) + the village letter writers (fictional animal children) |

## Model (`types.ts`, `grid.ts`)

- Grid: `x` → east, `y` → south; `Dir = N|E|S|W`; `cellLabel([2,0]) = "C1"` (dispatch-bay coordinates).
- `Layout = { w, h, blocked?, pieces: Piece[] }`, `Piece = { machine, at, dir, dial?, locked?, dialLocked? }`.
  `dialLocked` defaults to `locked` (a locked machine with an open dial = "set the dial" puzzles).
- Pure, immutable edits, each returning `{ ok: true, layout } | { ok: false, why }`:
  `place`, `remove`, `rotate` (↻ clockwise), `setDir`, `setDial`. `why` maps to kind words in
  `texts.EDIT_REFUSAL` ("The elves glued this one down: it stays here!").
- `autoBeltDir(layout, at)`: belt auto-connect (continue a neighbour's flow).
- `history.ts`: `createHistory / push / undo / redo` (unlimited undo, design B5).

## Machines (`machines/`)

Plug-ins registered in `machines/registry.ts` (`defineMachine`, contract in `machines/types.ts`).
A new machine = one small module + one registry line + its texts in `texts.MACHINE_TEXT`
(a test fails if the texts are missing).

| id | crew | dial | does |
|---|---|---|---|
| `belt` | — | — | carries one tile per tick, in from back/sides |
| `chute` | Pépin | `{ material, count, items? }` | drops `count` raw items; `items` = cycle of ready-made gifts |
| `shaper` | Grelotte | `{ shape }` or `{ shapes: [...] }` | cube, ball, cylinder, cone, star, wheel (cycle = pattern) |
| `painter` | Pépin | `{ color }` or `{ colors: [...] }` | the 6 paints (icons in `COLOR_ICON`) |
| `mixer` (7+) | Grelotte | `{ a, b? }` | `a + b`, or `a` mixed into the current colour (chainable) |
| `assembler` | Grelotte | `{ toy, n? }` | builds a toy from a full set of parts; spare parts wait in its basket, non-parts ride through |
| `counter` (7+) | Noisette | `{ n, mode: 'first' \| 'every' }` | first `n` straight then right / every n-th to the right |
| `sorter` (7+) | Noisette | `{ color?, shape?, toy?, sticker?, wrap?, material? }` | IF match → **left**, ELSE → **right** |
| `loop` (7+) | — | `{ times }` | one item in, `times` identical copies out (repeat ×N) |
| `stamper` | Noisette | `{ sticker }` | star / heart / moon / snowflake sticker |
| `wrapper` | Noisette | `{ pattern }` or `{ patterns: [...] }` | wrapping paper |
| `arm` (10+) | Pépin | `{ program: Card[] }` | instruction cards, one per tick, looping: `pick`, `shape:<s>`, `paint:<c>`, `sticker:<s>`, `stack`, `ship`, `{ repeat: N, do: [...] }` |
| `sack` | Ziggy | `{ bay? }` | delivery / check gate |

`minBand` (in each plug-in) is the band from which a machine is offered in the *tray* for free
placement; younger bands still meet it through glowing slots or prebuilt machines.

## Simulator (`simulator.ts`)

```ts
const sim = new FactorySim(layout);
sim.step();                 // one tick → { tick, events, progressed }   ("step" button)
sim.run(n);                 // n ticks (stops early once settled)
sim.runUntilSettled();      // until nothing changes → { ticks, settled, finished }
sim.reset();                // tick 0, same layout
sim.items();                // [{ item, at, exit }] on the belts (for rendering)
sim.deliveries();           // what reached the sacks
sim.machineState(at);       // basket, arm hand/plate… (read-only copy)
sim.busyMachines();         // machines still holding work
sim.snapshot(); sim.hash(); // JSON state + FNV-1a hash (replays, determinism)
```

- One tick = one tile. Deterministic, no randomness. Speed is the runtime's clock:
  `TICK_SECONDS[1] = 0.5`, `TICK_SECONDS[2] = 0.25` (call `step()` on each tick).
- Collisions: one item per tile; an item enters through a machine's back or sides (sacks:
  any side); several items wanting one tile → back first, then left, then right; chains and
  full rings move together. An item that cannot move **waits** (nothing is ever lost).
- Events for the runtime's animations: `emit`, `move`, `wait`, `process`, `absorb`, `build`,
  `deliver`, `work` (arm card).
- `settled` = nothing can change any more; `finished` = settled with empty belts and idle machines.

## Check gate (`check.ts`)

`check(orders, deliveries, { ran? }) → CheckResult`:
`status: 'done' | 'in-progress' | 'not-started'` (there is **no failure state**), `complete`,
`matched[]`, `shelf[]` (every non-matching toy goes to the surprise shelf with a funny
generated name, `names.surpriseName`), `progress[]` per order, one friendly `reason` {fr,en}
pointing at the single step that differs, `focus` (`color`, `toy`, `n`, `sticker`, `wrap`,
`material`, `partColors`, `bay`, `order`) and `blame` (the elf on duty laughs it off).

Orders: `{ toy, props?, count, bay?, exact? }` or `{ sequence: [{ toy, props? }…], count }`
(patterns). `toy: 'surprise'` accepts anything. `props.sticker/wrap: 'none'` = without.
`exact: true` (counting letters): extra matching toys go to the shelf as bonus and keep the
letter open ("Bonus: 2 spinning tops! … The letter asks for 3.").

## Levels (`levels.ts`)

`LEVELS`, `getLevel(id)`, `hallLevels(hall)`, `startLayout(band)`, `referenceLayout(band)`,
`applyPlacements(band, pieces)`, `runAndCheck(band, layout)`, `validateLevel(raw, { assetExists })`,
`validateLevelSet(levels)`.

Band block: `{ difficulty, grid, tray, prebuilt, slots?, letters[], orders[], reference[], ideas? }`.
`slots` = little ones' glowing tile with 2–3 choices. `ideas` = optional big-kid challenge
(`max-machines`, `one-go`), never required.

The validator (run on every file by `levels.test.ts`) enforces: known keys only and **no
timer / lives / score / fail key anywhere** (`BANNED_KEY`); FR+EN texts; machines, dials,
toys and writers exist; band caps (≤ 5 / ≤ 20 / ≤ 100); sack bays named like coordinates
match their tile; the reference is placeable with the tray/slots and, simulated, **fulfils
the letter** with a clean finish; the starting layout does **not**; every *other* slot choice
makes something different; across levels, difficulty never decreases inside a band and every
machine is introduced before a band uses it.

| # | Hall | Letter | Introduces |
|---|---|---|---|
| 1 | wood-shop | A ball | chute, belt, shaper, sack |
| 2 | wood-shop | A red ball | painter |
| 3 | wood-shop | Three spinning tops | (chute count dial) |
| 4 | paint-room | An orange boat | mixer |
| 5 | paint-room | Balls in a pattern | (paint cycles) |
| 6 | paint-room | Sort the gifts by colour | sorter |
| 7 | assembly-line | A train with 3 wagons | assembler |
| 8 | assembly-line | A car: 4 wheels + 1 body | (merging belts) |
| 9 | assembly-line | Two cars and a train | (several products) |
| 10 | logic-room | Every 3rd ball gets a star | counter, stamper |
| 11 | logic-room | Ten rockets, please! | loop |
| 12 | logic-room | Robot arm, build a tower | arm |
| 13 | dispatch | Gifts to the right sleigh bay | (coordinates) |
| 14 | dispatch | Wrap them all in stripes then dots | wrapper |
| 15 | christmas-eve | The big night (3 letters) | — |

## Hints (`hints.ts`)

`suggestNextStep(band, layout, { hasRun? }) → Hint` (`kind`: `done`, `slot`, `stuck`, `turn`,
`basket`, `place`, `dial`, `remove`, `run`; `text` {fr,en}; `at` tile to glow; `machine`,
`dir`, `dial`, `focus`). Runs the line once, then: glowing slot → stuck item → waiting
assembler (+ its cause) → the check's focus → any other reference difference. Only shown when
the child asks (little ones: the glowing slot). `applyHint` / `followHints` = "show me" and
the test proving that every starting layout reaches its letter by hints alone.
`dialText(machine, dial)` describes a dial in words for read-aloud.

## Share codes (`share.ts`)

`encodeLayout(layout) → "LF1.<base64url>.<fnv1a>"`, `decodeLayout(code) → { ok, layout } | { ok: false, why: 'format' | 'version' | 'checksum' | 'content' }`.
Local copy/paste only (owner decision 2026-11-09). Decoding never throws, checks the
checksum, then validates every machine, tile and dial with the plug-ins' strict parsers.
Locks are not shared. `texts.UI.shareBad` is the kind message for a tangled code.

## Texts (`texts.ts`, `names.ts`, `lines.ts`)

All child-facing words FR + EN, templates filled by `fill` / `fillL`. `names.phrase(look, opts)`
builds grammatical toy phrases (French gender/number, English a/an). Tested: every text has
FR and EN, no placeholder is left in generated text, and a banned-word list (triste, nul,
raté, perdu, échec, mauvais, erreur… / sad, fail, wrong, lost, bad, mistake, game over…)
never appears — anywhere, including generated check reasons, hints and surprise names.

## Tests

`npx vitest run src/games3d/lutin-factory` — simulator determinism (every reference layout,
hash per tick, reset replays), each machine, colour table, sorter/counter routing, merge
priority, rings, all 15 levels × 3 bands solved by their reference, validator rejections,
share-code round trip + corrupted/forged codes, check never fails, hints reach every goal,
texts FR/EN + banned words.
