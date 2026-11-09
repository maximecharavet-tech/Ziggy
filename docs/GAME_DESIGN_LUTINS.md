# Lutin Chaos & Lutin Factory: game design (proposal for the owner)

Status: **design proposal, no game code yet**. Written 2026-11-09 by the game R&D lab
(game architect, game designer and level designer). Read it with `docs/GAME_ARCHITECTURE.md`
(how we build it), `docs/ASSET_PIPELINE.md` (how assets are made and registered),
`docs/LUTINS.md` and `src/data/lutins/bible.json` (the three elves).

Both games star the **same three felt elves** as the parents' nightly prank photos (`/lutins`):
**Pépin** (green tunic, long striped hat with a bell; the show-off who presses every button),
**Grelotte** (lavender tunic, round glasses, braids; the clever inventor),
**Noisette** (tiny, hazelnut cape, acorn hat; the quiet sneaky one who hides anywhere), with
**Ziggy** (the real felt plush, `makeZiggy()`) as the child's partner and narrator.
This link between the morning photo and the game is our strongest asset: the child already
knows these elves from their own living room.

---

## 0. Rules both games follow (from CLAUDE.md, non-negotiable)

| Red line | What it means in these games |
|---|---|
| No failure screens | No lives, no game over, no timer that runs out, no score that goes down. A wrong try = a funny reaction + a hint, then try again. |
| No guilt, no manipulation | No streaks, no daily rewards, no "come back or…", no energy, no loot boxes, no random rewards, no currency, no countdowns, no FOMO events, no notifications. |
| Companions never sad | Ziggy and the elves are always happy, curious, surprised or laughing (the face module only has `neutral, smile, laugh, surprise, listen, wink`). The elves are never "naughty", punished, scolded or caught in a mean way: catching them is a game of tag they love. |
| Bible mischief only | Pranks are "nothing broken, dangerous, dirty, scary or messy beyond a giggle" (bible `style`). No food waste jokes, no animals hurt (pets in the house are plush toys), no bathroom humour beyond bubbles. |
| No ads, no tracking, no purchases | Free, no IAP, nothing leaves the device. |
| FR + EN, read-aloud | Every visible line is `{fr, en}` (`tr()`), every instruction is spoken (pre-baked elf/Ziggy voice lines, browser TTS as a fallback), with a 🔊 replay button. Little ones never need to read. |
| Big targets, reduced motion | Answer targets ≥ 64 px; with reduced motion, camera cuts instead of flights, gentler wobble, no screen shake (we never shake the screen anyway). |
| Zero running cost | Code-built 3D, synthesised sounds, offline pre-generated voices. No server at play time. |

---

# Part A. LUTIN CHAOS (working title, FR « Le Grand Chahut des Lutins »)

## A1. Pitch

> *The elves are visiting Ziggy's house, and they can't stop playing pranks! Socks in the
> fridge, a toilet roll garland on the tree, every book upside down… Find who did it,
> catch them with a tickle, and fix everything with Ziggy, while laughing your head off.*

A comic **hide-and-seek + fix-it** game in a cosy 3D dollhouse. Each room is a little
diorama full of silly pranks. The child **observes** (what's wrong here?), **deduces** (who
did it? Noisette's tiny footprints, Grelotte's glasses smudge, Pépin's jingle), **catches**
(tap the wiggling curtain: the elf tumbles out laughing) and **fixes** the prank with a short
learning puzzle (count, sort, match, order, follow directions, name things). When a room is
back in order, the elves set off one final **chain-reaction prank** that the child undoes
in reverse order, and the room ends on a funny group "photo" for the album.

## A2. Target ages and difficulty bands

The age band comes from World Memory (`little` / `middle` / `big`, see `docs/GAME_ENGINE.md`)
and the adaptive difficulty 1–5 per skill. Every room has **one layout and three band
variants**; the adaptive engine moves the child inside a band.

| | 4–6 (`little`) | 7–9 (`middle`) | 10–12 (`big`) |
|---|---|---|---|
| Finding pranks | 3 big, obvious pranks, glowing hint after 8 s of no tap | 4–5 pranks, some small | 5–6 pranks incl. subtle ones ("the clock shows the wrong time") |
| Who did it? | the elf peeks out by itself; just tap it | 1 clue → pick the elf (footprint size, colour thread, sound) | 2–3 clues, elimination grid (logic) |
| Fix puzzles | count ≤ 5, colours, big/small, in/on/under, pairs of 2 | count ≤ 20, add/subtract, ABAB → ABC patterns, left/right, sorting by 2 criteria | groups & multiplication, growing patterns, map grid coordinates, 3D rotation, odd-one-out with a rule, reading clue cards |
| Chain reaction | 2 steps to undo | 3–4 steps | 5–6 steps + "what happens if…" prediction |
| Text | none needed (icons + voice) | short words shown and read | clue cards to read (still read aloud on demand) |

## A3. Core loop

**30 seconds (one prank):**
look around the room (drag or arrows to pan the diorama) → spot something silly (tap it:
Ziggy reacts, "Ha! The socks are in the fridge!") → a clue appears → tap where the elf
hides (or pick the culprit from the three elf faces) → **catch**: tickle tap, the elf giggles,
high-fives Ziggy and joins the "fix team" → **fix puzzle** (10–20 s, one skill) → the room
visibly heals (the fridge closes, the socks fly back into pairs in the drawer) + a laugh.

**5 minutes (one room):** 3–6 pranks in any order (the child chooses, no forced path) →
all three elves caught → **chain-reaction finale** (the elves "accidentally" start a Rube-
Goldberg cascade: a ball rolls, a domino of books falls, a balloon pops into confetti; the
child taps the steps in reverse order to rewind time, a sequencing puzzle) → **album photo**
(a comic tableau of the room, generated from the 3D scene, stored on the device only) →
the room's lights soften: a natural pause.

**Session (10–20 min):** 1–3 rooms. The house map shows the rooms: done rooms glow warm
with the elves' little flag, new rooms are open to pick (2–3 choices at any time, never a
single locked path). Nothing is lost if the child stops mid-room: the game saves after
every prank.

## A4. Mechanics

1. **Observe (spot the difference with the "normal" room).** Each room has a reference
   state; pranks are differences (object moved, swapped, recoloured, upside down, multiplied,
   hidden). Ziggy's "magnifying glass" button (optional) briefly shows the room as it should
   be: a memory and comparison aid.
2. **Deduce (who did it?).** Clues come from the bible traits, so they are learnable and
   consistent: footprint size (Noisette tiny, Pépin round boots, Grelotte pointy), a coloured
   thread (green / lavender / hazelnut, **always with a pattern too**: stripes, dots, zigzag),
   a sound (bell jingle = Pépin, "hm-hm" hum = Grelotte, tiny squeak = Noisette; every sound
   clue is also shown as an icon for deaf and hard-of-hearing children), an object
   (glasses smudge, acorn cap). Big kids get a 3×3 elimination grid ("not Noisette: the
   footprints are big").
3. **Catch (tag game, never a chase that can fail).** Elves hide behind objects
   (curtain, laundry basket, lampshade, inside a boot). Tapping the right place makes them
   tumble out laughing. A wrong place gives a funny miss (a cuckoo pops out of the clock, a
   plush cat yawns) and the right spot wiggles more: a warm/cold hint by Ziggy. Little ones:
   the elf peeks out on its own after a few seconds.
4. **Fix (one learning puzzle per prank, from a library of fix mechanics).** Each prank type
   maps to a fix mechanic (data-driven, see the architecture doc): `count-back` (put N back),
   `sort` (by colour / size / shape / category), `pair` (socks, gloves, shoes left-right),
   `order` (books by size, numbers, alphabet, days), `pattern` (garland, tiles), `place`
   (in / on / under / behind / left of: spatial vocabulary), `path` (follow footprints
   with directions, grid coordinates for big kids), `rotate` (turn the picture/box the right
   way: mental rotation), `name-it` (vocabulary: "give me the whisk!", 3–4 picture choices,
   FR or EN, also a gentle second-language mode), `clock` (big kids: set the time back).
5. **Rewind (finale).** The chain reaction plays once, then the child taps its steps in
   reverse order (sequencing, cause and effect). Big kids first predict "what falls next?".
6. **Album & dress-up (creative reward).** Each finished room adds a comic photo; caught
   elves leave a costume piece; the child can dress the elves and Ziggy and pose them for
   new photos in any finished room (photo mode, sandbox-like).

## A5. Controls

| Input | How |
|---|---|
| Touch / mouse | Tap only. Drag (or the ◀ ▶ arrows on screen) pans the diorama. No hold, no multi-touch, no fast gestures required; every drag has a tap-tap alternative. |
| Keyboard | Arrows / WASD pan or move the focus between hotspots, Tab cycles hotspots, Enter / Space = tap, H = hint (magnifier), R = replay the line, Esc = pause menu. |
| TV remote | D-pad moves a focus ring between the room's **hotspots** (every tappable 3D object has a DOM proxy button, see architecture: works with `src/lib/tv/spatial-nav.ts`), OK = tap, Back = pause. The camera follows the focus. |
| Gamepad | Same as TV (Gamepad API). |
| One-handed | All HUD buttons in the bottom band, reachable by a thumb; nothing needs two hands. |
| Switch access | Optional auto-scan of hotspots (every 1.5 s, configurable), one switch = select. |
| Colour-blind safe | Elves are told apart by silhouette (hat shapes) before colour; every colour clue carries a pattern; sort puzzles use colour + shape; tested with deuteranopia/protanopia/tritanopia simulation filters in the Playwright renders. |
| Read-aloud | Every instruction, clue, answer option (as it lights up) and praise is spoken; 🔊 replays. Clue cards (big kids) are read on demand. |
| Reduced motion | Camera cuts, softer elf tumbles, chain reaction shown as a slower step-by-step sequence. |

## A6. Levels / worlds (the house)

15 rooms, each with 3 band variants and a seeded prank remix (same room, different pranks on
replay). The house is unlocked **in small open sets** (always 2–3 rooms to choose from).

| # | Room | Signature pranks (examples) | Main skills (fix puzzles) | Chain-reaction finale |
|---|---|---|---|---|
| 1 | Entrance hall | boots swapped left/right, scarves knotted together, coats on the wrong hooks | pairs, left/right, colours, count ≤ 5 | umbrella → ball → doorbell |
| 2 | Kitchen | socks in the fridge, cookies arranged as a face, spoons in the flower pot | count-back, sort by category, in/on/under | rolling pin → flour cloud (a soft puff, no mess left) → kettle whistle |
| 3 | Living room | tree garland made of socks, baubles in a wrong pattern, star upside down | patterns ABAB → ABC → growing, rotate | train set loop → bauble domino |
| 4 | Bathroom | toothbrushes in the wrong cups (by colour), rubber ducks in a tower, bubbles everywhere | sort colour+shape, order by size, count to 10/20 | soap slide → duck parade |
| 5 | Bedroom | sock pairs mixed, plushies in the wardrobe, pyjamas on the lamp | pairs, place (spatial vocabulary), name-it | pillow catapult → plush landing |
| 6 | Playroom | blocks towers swapped, puzzle pieces rotated, toy cars parked by the wrong colour | rotate, shapes 2D/3D, sort | marble run |
| 7 | Library | books upside down and out of order, letters hidden in the pages | order by size / number / alphabet, name-it | book domino |
| 8 | Music room | xylophone bars swapped, drum hidden in the piano | sound sequences (memory), high/low, rhythm patterns | music-box chain (note order) |
| 9 | Snowy garden | snowman built upside down, footprint trails everywhere | path (directions → grid coordinates), count | snowball roll |
| 10 | Workshop / garage | tools in the wrong outlines on the pegboard, bolts in a spiral | shape outlines, symmetry, count by 2/5/10 | wheel → seesaw → bell |
| 11 | Dining room | the table set crazily (forks in glasses, 5 plates for 3 guests) | one-to-one correspondence, more/less, halves & quarters (big) | napkin fan → candle (LED) glow |
| 12 | Attic | shadows that don't match their objects, boxes stacked oddly | shadow matching, 3D views (top/front/side), mental rotation | box tower topple (soft) |
| 13 | Cellar of boxes | labels swapped, the elves' secret map | grid coordinates, logic grid, odd-one-out with a rule | pulley lift |
| 14 | The roof & chimney | Santa's welcome sign scrambled, reindeer bells out of order | sequencing, ordinal numbers (1st, 2nd…), clock (big) | the big chimney cascade |
| 15 | Christmas Eve party (finale) | a remix of every room, all three elves at once | mixed review at the child's level | the grand cascade through the whole house, then a party with Santa |

**Sandbox: « La Maison des Farces » (role reversal).** The child becomes the prank director:
places the elves and prank props in any finished room (tap-tap from a prop tray), then
Ziggy has to find them (Ziggy "searches" comically, the child can give warmer/colder hints).
Pure creativity, no goal, no evaluation. Creations are saved on the device; an optional
"show a grown-up" screenshot is saved locally only.

## A7. Rewards without manipulation

- **Intrinsic first:** the joke itself, the room healing, the elves' laughter.
- **Album des farces:** one comic photo per room + a photo-mode album the child composes.
- **Costume pieces** (elf and Ziggy outfits) earned by finishing rooms and by **learning**
  (mastered skills in World Memory), never by time spent or by coming back on given days.
- **The house grows:** finished rooms get small permanent decorations chosen by the child.
- **World Memory:** `finishExtraGame('lutin-chaos', skill, stats, ms)` after each room, so XP,
  badges and Magic Moments follow the site's existing rules.
- **Never:** streaks, daily chests, currency, random drops, timed events, leaderboards,
  "almost there!" nags, red notification dots.

## A8. How Ziggy and the elves react (always positive)

| Moment | Ziggy | Elves |
|---|---|---|
| Child spots a prank | `cheer` / `giggle`, "Ha ha! Socks in the fridge?!" | the guilty elf hides a giggle (visible to observant kids) |
| Wrong spot tapped | `think`, "Hmm, not there… I heard a jingle near the curtain!" | a cheeky peek from the right spot |
| Elf caught | high five, `jump` | tumbles out laughing, "You found me! Again!" and joins the team |
| Wrong fix answer | `nod`, "Almost! Let's count together: one, two…" (counts with the child) | "Oops, my fault, I mixed them up!" (the elf takes the blame, never the child) |
| Room fixed | `cheer`, dance | group hug, bow, photo pose |
| Child stops / leaves | "See you soon, friend!" (no guilt) | wave, one yawns happily |

## A9. Learning goals mapped to rooms

| Skill (World Memory `LearningSkill` family) | Rooms (main) | 4–6 | 7–9 | 10–12 |
|---|---|---|---|---|
| Observation / visual discrimination | all (prank finding), 12 | big differences | small differences | subtle ones, magnifier memory |
| Counting & number sense | 2, 4, 9, 10, 11 | ≤ 5, 1:1 | ≤ 20, + / − | groups, ×, skip-counting |
| Patterns & sequences | 3, 8, 14, finales | ABAB | ABC, AABB | growing patterns, rule finding |
| Logic & deduction | culprit clues, 13 | 1 obvious clue | 1–2 clues | elimination grid, 3 clues |
| Spatial reasoning & vocabulary | 1, 5, 6, 9, 12 | in/on/under, big/small | left/right, behind/in front | grid coordinates, 3D views, rotation |
| Sorting & classifying | 2, 4, 6, 10 | 1 criterion | 2 criteria | rule discovery (odd-one-out) |
| Vocabulary (FR/EN) | 5, 7, name-it everywhere | house objects by picture | words shown | second-language mode |
| Time & sequencing | 14, finales | 2-step undo | 4-step undo | clock, prediction |
| Fractions & sharing | 11 | share fairly | halves | halves & quarters |

## A10. Session length and natural stopping points

- One prank ≈ 30–60 s, one room ≈ 5–8 min, a comfortable session = 1–3 rooms (10–20 min).
- **Stopping points:** after every room the elves pile up for a nap on the sofa and the
  lights soften; the HUD offers "Another room" and "See you soon" with equal weight.
  No cliffhanger, no "one more!" pressure.
- The parent console can set a gentle session length (the game proposes the nap ending
  after N rooms). Stopping at any moment loses nothing.

## A11. What makes it funny

- **Absurd juxtaposition** a 4-year-old gets instantly: socks in the fridge, a bauble on the
  cat-plush's head, toothbrushes as a bouquet.
- **Character comedy** from the bible: Pépin's showing off (he takes a bow after being caught),
  Grelotte's over-engineered pranks (a pulley to move one spoon), Noisette hiding in absurdly
  small places (a teacup, a boot) and her tiny squeak.
- **Timing and anticipation:** the wiggle before the reveal, the rule of three (two normal
  things, the third is silly), slow-burn chain reactions.
- **Soft slapstick:** tumbles, boings, hats flopping over eyes, the elf blaming itself.
- **Ziggy as straight man:** deadpan "…" then a giggle.
- **Sound design:** synthesised boings, jingles, kazoo stings, elves' babble (gibberish, so it
  works in every language).
- **Role reversal** in the sandbox: the child pranks Ziggy.

## A12. What makes it a hit vs competitors

| Comparable | What it does well | What we do better |
|---|---|---|
| *Untitled Goose Game* (House House) | prank comedy, emergent slapstick | for 4–12, zero frustration, the child **undoes** pranks with learning built in; no stealth failure |
| *Hidden Folks* / *Where's Wally?* | joyful observation | 3D dioramas, deduction with consistent character clues, read-aloud, adaptive bands |
| *Toca Life* / *Sago Mini* (Toca Boca, Spin Master) | playful sandboxes kids adore | the same charm plus gentle goals and real learning, no IAP packs, FR+EN voice |
| *Elf on the Shelf* apps & toys | the December elf ritual | our elves are already in the child's own living room photos every morning (`/lutins`): the game continues the story; free, no purchase, no "the elf reports to Santa" pressure |
| *Khan Academy Kids*, *Lingokids*, *PBS Kids Games* | strong learning content | a real comic game first (learning woven into play), 3D felt look, TV-remote play, works offline, no account |
| *Little Big Workshop* / escape-room games | deduction | built for non-readers first, then scales to 12-year-olds' logic grids |

The hit factors: **characters kids already love** (transmedia with the nightly photos and the
Santa features), **laughter in every 30 seconds**, **choice** (any prank, any room), **short
satisfying loops** that suit a 5-minute play and a 20-minute session, and **parents trust it**.

---

# Part B. LUTIN FACTORY (working title, FR « L'Atelier des Lutins »)

## B1. Pitch

> *Letters from children arrive at the elves' toy workshop: "I'd like a red train with three
> wagons!" Build the production line (conveyor belts, a painting machine, a shaping machine,
> an assembler, a wrapping machine), press GO, and watch the elves make the toy… or a
> hilarious surprise toy that goes to the "surprise shelf" (every toy finds a child!).*

A cosy **building and logic** game on a grid: the child plans a conveyor line from machines,
runs it, watches the elves operate it comically, and adjusts. It teaches **sequencing**
(order of operations), **counting**, **shapes and colours** (and colour mixing), then
**simple programming** (loops, conditions, counters, instruction cards) for older kids.
Gentle missions (letters) plus a full **sandbox** where the child invents toys.

## B2. Target ages and difficulty bands

| | 4–6 (`little`) | 7–9 (`middle`) | 10–12 (`big`) |
|---|---|---|---|
| Building | the line is pre-built; choose which machine goes in the glowing slot (2–3 choices) or set a machine's dial (colour, shape) | place 3–6 machines and belts yourself | free layouts, splitters, merges, loops |
| Recipe | 1 step: "a **red** ball" | 2–4 steps, order matters (shape → paint → assemble → wrap) | multi-part toys, several letters at once, parameters |
| Numbers | count to 5 | count to 20, + / − (2 wagons + 1) | ×, ÷ (3 trains × 4 wagons), counters |
| Logic | cause → effect | sorter by colour (if/else), colour mixing | loops, counter gates (every 3rd), instruction cards (a tiny program), optional "fewest machines" challenge |
| Text | none (icons + voice) | short words | letters to read (read aloud on demand) |

## B3. Core loop

**30 seconds:** listen to / read the letter (a short, voiced card with a drawing of the wished
toy: "a red train with 3 wagons") → place or adjust a machine → press **GO** → the toy rides
the belt; each machine plays a short comic elf animation (Pépin slams the paint button,
Noisette rides along on the toy) → the toy reaches the **check gate**: right = jingle and
into the gift box; different = it slides onto the **surprise shelf** with a laugh, and Ziggy
points at the one step that differs ("This train is blue: which machine paints?").

**5 minutes (one letter, 1–3 toys):** build → run → tweak (a few tries) → **wrap** → the toy
goes onto Santa's sleigh → a short thank-you scene: the letter's writer (a fictional animal
child from the village, never a real child) hugs the toy.

**Session (10–20 min):** a "workshop day" of 3–5 letters (any order from the letter board)
plus free building time in the sandbox. The day ends with the sleigh taking off: a natural
stop.

## B4. Mechanics

**Grid & belts.** A small grid (5×4 for little ones, up to 10×7). Belts are placed by tapping
tiles; they auto-connect to neighbours (fewer taps, no fiddly drawing). Items move one tile
per tick, so the simulation is deterministic and easy to follow; GO / pause / step / speed ×1
×2 buttons (step-by-step is a learning tool: "debugging" for kids).

**Machines (data-driven, each one a plug-in, see architecture `defineMachine`):**

| Machine | Elf on duty | Does | Teaches |
|---|---|---|---|
| Material chute | Pépin | drops raw material: wood, felt, tin-coloured metal, yarn | sources, counting outputs |
| Shaper | Grelotte | makes a cube, ball, cylinder, cone, star, wheel (dial) | 2D/3D shapes |
| Painter | Pépin | paints a colour (dial: 6 colours, each with an icon: 🍓 red, 🍋 yellow, 💧 blue, 🍃 green, 🍇 purple, 🍊 orange) | colours, colour-blind-safe icons |
| Mixer (7+) | Grelotte | two paint inputs → a mixed colour (red + yellow = orange) | colour mixing |
| Assembler | Grelotte | combines parts by recipe (engine + N wagons = train) | composition, counting, × |
| Counter gate (7+) | Noisette | lets N items through, then the rest go on (or every Nth goes right) | counting, modulo (big) |
| Sorter (7+) | Noisette | if colour/shape = X → left, else → straight | conditionals (if/else) |
| Loop belt (10+) | — | a circular belt with a "repeat ×N" sign | loops |
| Robot arm (10+) | Pépin + Grelotte's cards | runs a row of instruction cards: pick, turn, paint, put, repeat | a tiny programming language (LightBot-like) |
| Wrapper | Noisette | wraps a finished toy in paper (pattern chosen by the child) | completion, creativity |
| Check gate | Ziggy | compares with the letter | verification |

**Toys (recipes in data):** ball, spinning top, boat, train (+ wagons), car, rocket, doll house,
xylophone, kite, teddy (felt), robot (a mini-Ziggy!), snow globe, drum… Each has a recipe tree
(parts, shapes, colours) so new toys are only data.

**Surprise shelf (no failure).** A toy that doesn't match the letter is never thrown away: it
goes to the surprise shelf, gets a funny name generated from its parts ("the purple
wheel-cone"), and appears in the Catalogue. Some letters ask for "a surprise!", so the shelf
is useful, and wrong tries become discoveries.

**Optional challenge goals (big kids, never required, no score shown to little ones):**
"use 5 machines or fewer", "make all 4 toys with one GO". Shown as a Grelotte idea bulb, not
as stars that can be missed.

## B5. Controls

| Input | How |
|---|---|
| Touch / mouse | Tap a tile, then tap a machine in the tray (tap-tap); drag-and-drop works too but is never required. Tap a placed machine for its dial (big ± buttons) and rotate (↻ button). GO / pause / step / speed buttons in the bottom band. |
| Keyboard | Arrows move the tile cursor, 1–9 pick from the tray, Enter places/opens, R rotates, Delete removes, Space = GO/pause, S = step, Z = undo. |
| TV remote | The grid is a natural D-pad space: the cursor moves tile by tile; OK opens a radial menu of machines (each a DOM button); Back = undo / close. |
| Gamepad | Same as TV. |
| One-handed | Everything in the bottom band or on the grid; no simultaneous presses. |
| Colour-blind safe | Every colour has an icon and a pattern on the toy (stripes, dots, stars…); letters show the icon; the check gate names the colour aloud. |
| Read-aloud | Letters, machine names (when focused or tapped), Ziggy's hints, the check result. |
| Reduced motion | Items move tile-by-tile without bounce; machine animations shorter; no camera flights. |
| Undo | Unlimited undo / redo; a "clear" with confirmation; the last layout per level is always kept. |

## B6. Levels / worlds (the workshop halls)

15 levels in 5 halls, each level with 3 band variants (the same toy, different recipe depth),
plus "elf challenges" (bonus puzzles) and the sandbox. Halls open in order, levels inside a
hall in any order.

| # | Hall | Level (letter) | New idea | Skills |
|---|---|---|---|---|
| 1 | Wood shop | "A ball" | GO, one belt, one shaper | cause & effect, shapes |
| 2 | Wood shop | "A red ball" | painter after shaper | colours, 2-step sequence |
| 3 | Wood shop | "Three spinning tops" | the chute's counter dial | count to 3/10/20 |
| 4 | Paint room | "An orange boat" | mixer (little ones: a choice of ready paints) | colour mixing |
| 5 | Paint room | "Balls in a pattern: red, blue, red, blue…" | sequences of outputs | patterns |
| 6 | Paint room | "Sort the gifts by colour" | sorter (if/else) | classifying, conditionals |
| 7 | Assembly line | "A train with 3 wagons" | assembler recipes | composition, counting |
| 8 | Assembly line | "A car: 4 wheels + 1 body" | merging belts | 1:1 correspondence, addition |
| 9 | Assembly line | "Two cars and a train" | several products on one line | addition, multiplication (big) |
| 10 | Logic room | "Every 3rd ball gets a star" | counter gate | skip counting, modulo (big) |
| 11 | Logic room | "Ten rockets, please!" | loop belt (repeat ×N) | loops, multiplication |
| 12 | Logic room | "Robot arm, build a tower" | instruction cards | algorithms, debugging |
| 13 | Santa's dispatch | "Gifts to the right sleigh bay" | addresses on a grid | coordinates, sorting |
| 14 | Santa's dispatch | "Wrap them all in stripes then dots" | wrapper patterns + sorter | patterns + logic |
| 15 | Christmas Eve | "The big night": several letters, one line | everything (no timer: the music gets festive, that's all) | integration |

**Sandbox: « Atelier libre ».** All machines the child has met, unlimited grid, a "design a
toy" mode (choose parts, shapes, colours, pattern, the toy gets a generated name), a toy
turntable to admire it, and "gift it" to a village character (a short thank-you animation).
Creations live on the device; a layout can be shared as a short code the parent copies
(no server).

**Elf challenges:** hand-made puzzles per band (e.g. "make a green toy without a green
paint" → mixer), unlocked by finishing halls, never timed.

## B7. Rewards without manipulation

- **The Grand Catalogue:** every toy ever made (including surprise toys) on a 3D turntable,
  with its recipe: a collection that rewards curiosity, not grinding.
- **Thank-you scenes and drawings** from the letter writers (an album).
- **The workshop grows:** each hall finished adds decorations, lights and a new elf station;
  the child chooses wrapping paper patterns and belt colours: their factory is their creation.
- **New machines** are learning milestones ("You can mix colours now!").
- **World Memory:** `finishExtraGame('lutin-factory', skill, stats, ms)` per letter.
- **Never:** coins, energy, timers, ratings that go down, random rewards, streaks.

## B8. How Ziggy and the elves react

| Moment | Ziggy | Elves |
|---|---|---|
| Letter arrives | reads it, `curious` | gather round, excited |
| Machine placed | small nod | the elf on duty salutes and stands by its machine |
| GO | `cheer` | everyone works; Pépin over-enthusiastic, Noisette rides the belt |
| Right toy | `jump`, "Yes! That's the train from the letter!" | they dance; Pépin rings his bell |
| Different toy | `think`, "Ooh, a blue train! Fun! The letter says red: which machine paints?" | "Surprise shelf!", they laugh and admire it |
| Stuck (no progress for a while) | offers a hint (never automatic for big kids unless asked); little ones get the glowing slot | Grelotte's idea bulb |
| Day ends | "What a workshop day!" | the sleigh takes off, the elves wave |

## B9. Learning goals mapped to levels

| Skill | Levels | 4–6 | 7–9 | 10–12 |
|---|---|---|---|---|
| Sequencing (order of operations) | 2, 4, 7, 12, 14 | 2 steps | 3–4 steps | multi-branch lines |
| Counting & arithmetic | 3, 7, 8, 9, 11 | ≤ 5 | ≤ 20, + / − | ×, ÷, skip counting |
| Shapes (2D/3D) | 1, 7, 8, sandbox | name & pick | compose | parts of a solid |
| Colours & mixing | 2, 4, 5, 6 | name & pick | primary mixing | secondary mixing, patterns |
| Patterns | 5, 14 | ABAB | ABC, AABB | rule-defined outputs |
| Conditionals (if/else) | 6, 13, 14 | — (choice only) | one sorter | chained sorters |
| Loops / repetition | 10, 11, 12 | — | repeat ×N | loops + counters, modulo |
| Algorithms & debugging | 12, step mode everywhere | watch & fix one step | step mode | instruction cards, fewest machines |
| Spatial / coordinates | 13, layout building | follow the glow | place on a grid | coordinates, routing |
| Reading (letters) | all | — (voice) | short words | full letters |

## B10. Session length and natural stopping points

- One letter ≈ 2–5 min; a workshop day = 3–5 letters ≈ 10–20 min.
- **Stopping points:** after every letter (the gift is on the sleigh), and the day's end
  (sleigh takes off). The sandbox autosaves every change, so stopping mid-build loses nothing.
- Parent session length setting = the sleigh leaves after N letters.

## B11. What makes it funny

- **Watching your machine do something absurd:** a train with 7 wagons because you set the
  dial to 7, a striped cube-ball hybrid, a rocket painted in polka dots.
- **The elves at work:** Pépin slamming buttons too hard (his hat flops), Grelotte's goggles
  fogging with paint, Noisette riding the belt like a roller coaster and diving into the gift
  box.
- **Surprise-toy names** generated from parts ("the wobbly purple wheel-cone").
- **Chain gags** on GO: the first run of the day always starts with a "warming up" sputter.
- **Ziggy as the delighted customer** who loves every toy, especially the wrong ones.

## B12. What makes it a hit vs competitors

| Comparable | What it does well | What we do better |
|---|---|---|
| *Shapez*, *Factorio*, *Infinifactory*, *Opus Magnum* | deep factory/logic satisfaction | kid-sized: 5×4 grids, tile-by-tile simulation, voice, zero failure, toys instead of abstract shapes |
| *Lightbot*, *Cargo-Bot*, *Human Resource Machine* | programming puzzles | concrete goals (a toy for a child's letter), machines first, cards later; FR+EN voiced |
| *ScratchJr*, *Kodable*, *Osmo Coding* | early coding | no account, no hardware, free, 3D felt charm, a sandbox that makes real-looking toys |
| *Toca Lab*, *Toca Builders*, *LEGO Builder's Journey* | creative building | goals + building + learning progression across 3 age bands |
| *Overcooked* | frantic assembly-line fun | the same assembly-line comedy **without time pressure**: festive music, never a timer |

Hit factors: **"I made that!" pride** (the Catalogue, the turntable, the wrapped gift on the
sleigh), **visible cause-and-effect** that's funny when it goes "wrong", **open sandbox**
for long replay, and **the same elves** as the rest of the Lutins universe.

---

## C. Shared design for both games

- **Seasons beyond December (content packs, see architecture extension points):** the elves
  stay year-round: spring cleaning pranks, summer garden, autumn harvest workshop (toys for a
  village fair), a gentle Halloween costume party (nothing scary). Christmas stays the
  flagship season.
- **Link with `/lutins`:** when the parent's nightly prank planner has used a prank type
  (e.g. "socks in the fridge"), Lutin Chaos can feature that prank in the next room ("Hey,
  that's what they did in our kitchen!"). Only the prank *type id* is used, read from the
  device; no photo, no text, nothing sent.
- **Santa crossover:** the Factory's sleigh scene uses `makeSanta()`; Lutin Chaos room 15 ends
  with Santa's visit.
- **Voice:** every elf and Ziggy line is pre-generated offline (voice engine, see asset
  pipeline) in FR and EN; the other 10 locales fall back to EN text + browser TTS, like the
  rest of the site.
- **Parent view:** a small "what your child practised" card (skills, not time), consistent with
  the parent console. No per-minute tracking.
- **Vertical slice to validate first:** Lutin Chaos room 2 (Kitchen) in 3 bands + Lutin Factory
  levels 1–3 and the sandbox seed. Play-test with 3 children per band before writing the rest.

## D. Owner decisions (2026-11-09)

Approved: both games as designed; names as proposed; routes under `/lutins/jeux/…`; December 2026 with
Christmas content, seasons in 2027; the nightly prank type id from the parent planner may be used on the
device; share-a-layout codes in the Factory sandbox (local copy/paste only).

### Original questions

1. Final names (FR/EN): « Le Grand Chahut des Lutins » / *Elf Chaos*; « L'Atelier des
   Lutins » / *Elf Workshop*?
2. Route: under `/monde/3d/…` with the other 3D games, or under `/lutins/jeux/…` next to the
   journal (stronger transmedia link)?
3. OK to use the nightly prank *type id* from the parent planner on the device (§C)?
4. Year-round seasons (§C), or December-only for 2026 and seasons in 2027?
5. Share-a-layout codes in the Factory sandbox (local copy/paste only): yes/no?
