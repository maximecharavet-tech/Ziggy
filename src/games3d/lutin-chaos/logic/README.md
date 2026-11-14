# Lutin Chaos: pure game logic

« Le Grand Chahut des Lutins » / *Elf Chaos*. Spec: `docs/GAME_DESIGN_LUTINS.md` part A;
architecture: `docs/GAME_ARCHITECTURE.md` §3.12, §5–7.

This folder is **pure TypeScript**: no three.js, no React, no storage, no network, no
`window`. The 3D runtime (`ChaosGame.ts`, room presets, actors) and the React HUD
(`LutinChaosPlayer.tsx`) only draw what it describes and send it the child's taps.
Import everything from `@/games3d/lutin-chaos/logic` (`index.ts`).

## The loop in one reducer

```ts
import { ROOMS, roomById, startRoom, reduce, playSeed, snapshot, parseSave, serializeSave, SAVE_KEY, recordRoomDone } from '@/games3d/lutin-chaos/logic';

const room = roomById('chaos.kitchen')!;
const save = parseSave(localStorage.getItem(SAVE_KEY));            // never throws
const plays = save.rooms[room.id]?.plays ?? 0;
let session = startRoom(room, band, playSeed(room.id, plays, save.salt), { nightPrankId });  // band from World Memory

// on every tap
const { session: next, events } = reduce(session, { type: 'tap-prop', prop: 'sock-1' }, room);
session = next;
for (const e of events) runtime.play(e);                           // lines, animations, puzzles…
localStorage.setItem(SAVE_KEY, serializeSave({ ...save, current: snapshot(session, nightPrankId) }));
```

`session.state` is the room to draw (`props[id] = { kind, slot, color, rot, count, hidden }`).
A session is plain JSON; randomness comes from `seed` + an action counter, so
`replay(room, band, seed, actions)` always ends identically (golden replays, bug reports).

### Actions (`ChaosAction`)

| Action | When | What happens |
|---|---|---|
| `tap-prop {prop}` | any time in the `pranks` phase | prop of an unspotted prank → `spotted` (+ clues for 7+; little ones: the elf peeks out at once). Any other prop → Ziggy: "that one's just right!" |
| `name-elf {prank, elf}` | 7+, after spotting | right → the elf peeks out. Wrong → that elf giggles "not me!", an `eliminate` event gives the clue's reason; after two names the culprit peeks anyway |
| `tap-spot {prank, spot}` | spotted / found | right hiding place → **caught**. Wrong → funny gag (`miss`), `heat` warmer/colder, the right spot wiggles more; peeks after 2 misses |
| `tickle {prank}` | spotted / found (offer it when the elf is visible) | **always** catches, with a seeded funny reaction (`caught` line + `anim`) |
| `answer {prank, answer}` | caught | solved → the prank is undone (`healed`), praise, `fixed` line. Otherwise a `hint` (levels 1→3, level 3 reveals the answer) and the elf takes the blame |
| `magnifier` | any time | `magnifier` event: props that differ from the tidy room |
| `finale-predict {step}` | big kids, finale | any answer moves on (right = cheer) |
| `finale-tap {step}` | finale | the expected step is the **last not yet undone**; a wrong tap only makes it glow |
| `photo` | after the finale | `room-done` event with a `RoomResult` |

All phases and taps are forgiving: there is no failure state, timer, life or score anywhere.

### Events (`ChaosEvent`)

`say` (a `Line`: `who`, `moment`, `cue`, `face`, `text {fr,en}`, voice id = `line.id`), `text`
(spot / fixed / praise lines to speak and show), `spotted`, `clues`, `eliminate`, `peek`,
`miss`, `caught`, `puzzle`, `hint`, `healed`, `magnifier`, `room-fixed`, `finale-start`,
`finale-predicted`, `finale-undone`, `finale-glow`, `photo`, `room-done`.

`room-done.result` → `finishExtraGame('lutin-chaos', result.skill, …)` then
`recordRoomDone(save, result, seed)` (album photo + costume piece, next play gets a new seed).

### Puzzles (`fixes/`)

`session.pranks[i].puzzle` is a discriminated union on `fix`: `count-back`, `sort`, `pair`,
`order`, `pattern`, `place`, `path`, `rotate`, `name-it`, `clock`. Each carries `prompt {fr,en}`
(spoken for everyone, shown for 7+), `seconds` (10–20), `goal`, `skill` and the data the HUD
draws (choices, items, bins, grid, clock…). Answer shapes:

| fix | answer |
|---|---|
| count-back | `number` (from `choices`) |
| sort | `{ [itemId]: binId }`, or the odd item id (big: odd-one-out) |
| pair | `[idA, idB][]` |
| order | item ids in order |
| pattern | one token per blank |
| place | a relation id (`in`, `left`…) or a cell `"x,y"` (big) |
| path | a cell `"x,y"` (x right, y up; big shows `A–E` × `1–5`) |
| rotate | taps of ↻ 90° (`number`), or an option id (big: mental rotation) |
| name-it | a word id |
| clock | `"h:mm"` (h 1–12) |

`checkAnswer(puzzle, answer, tries)` is also exported for HUD-side previews.

## Content

- `src/data/games/lutin-chaos/rooms/NN-slug.json`: rooms 1–15 (entrance hall → Christmas Eve).
  One layout (`slots`, `props`, `hidingSpots`), a prank pool, a finale chain, and three band
  blocks (`pickCount`, `pool`, `hidingSpots`, `finale` order). Every prank has a type plug-in,
  params, `culprit` (`random` or an elf), a fix mechanic + params, `spot`/`fixed` lines, and
  optional `themes` = prank ids of the `/lutins` planner (`src/data/lutins/pranks.ts`).
- `src/data/games/lutin-chaos/lines.json`: Ziggy and elf lines per moment (FR + EN, happy faces
  and cues only).
- `vocab.ts`: words (picture, FR with article and plural, EN), colours (icon + pattern), shapes.
- `texts.ts`: HUD words, prompt templates, hints, the elves' blame lines.

`rooms.test.ts` runs `validateRooms()`: schema without timer/lives/score/fail fields, valid
plug-ins and params, pool pranks on different props, each prank undone exactly, clues
pointing to exactly the culprit, every elf gets a prank, every puzzle solvable in 10–20 s
within the band caps, a perfect play ending tidy, finale lengths, A9 goals declared and
trained, and progression across the house. Run it after any content edit.

## Tonight's prank (`/lutins` link)

`startRoom(room, band, seed, { nightPrankId })`: only the planner's prank **type id** (read on
the device from the parents' planner, e.g. `chaussettes`) is used. A matching pool prank is
always drawn and flagged `fromTonight`; Ziggy then says "that's the prank they played in our
house!". `roomsForNightPrank(id)` suggests rooms on the house map.

## Sandbox « La Maison des Farces »

`startSandbox(room, seed)` → `reduceSandbox(state, action, room)`: `place-elf`, `add-prank`
(any single-step prank type, validated), `go`, then Ziggy searches with `ziggy-look`, steered
by `hint` (warmer / colder) or `point {spot}`; he never searches a spot twice, so he always
finds everyone (`celebrate`), then `again`. No goal, no evaluation. `sandboxLayout` /
`loadLayout` for the device save.

## Save

`SAVE_KEY = 'ziggy:game:lutin-chaos:v1'`. `parseSave(raw)` never throws (garbage → fresh
save, v0 prototype → v1 migration). The runtime writes after every prank (`saveProgress` with
`snapshot`) and `resumeRoom(room, save.current)` rebuilds the same room with the fixed pranks
tidied. `openRooms(save, ROOM_IDS, { christmasEve })`: finished rooms + the next 2–3 (never a
single locked path); the party opens after 8 rooms or on Christmas Eve.

## Extending

- New prank type: `pranks/<id>.ts` with `definePrank({ id, label, icon, validate, changes, props, fixes })`,
  register it in `pranks/basic.ts`, add a case to `pranks.test.ts`.
- New fix mechanic: `fixes/<id>.ts` with `defineFix({ id, params, goal, make, solve, isAnswer, check, wrong })`,
  add it to `fixes/index.ts` (`Puzzle` union + `FIXES`) and a variant to `fixes.test.ts`.
- New room: a JSON file + an import line in `rooms.ts`; the validator does the rest.
