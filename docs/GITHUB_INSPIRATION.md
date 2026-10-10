# GitHub Inspiration — Ziggy World

> Survey of open-source projects that inspired the design of **Ziggy World**: a game universe for kids aged 5–12 with a world map, 20 mini-games built on reusable mechanics, adaptive learning, interactive stories, a child-safe AI that only returns validated JSON, a PWA, Phaser for the one runner game, and spaced repetition through `ts-fsrs`.
>
> **Research date:** 2026-10-10. **Rule:** we take ideas only, never code. Ziggy copies no source code from any project listed here.

---

## 1. Méthodologie

- **Licence check.** For each repository, we made a shallow clone (`git clone --depth 1 --filter=blob:none`) and read the `LICENSE*` / `README*` files at the root. For multi-licence projects (PurpleLlama, GCompris), we also read the licence table in the README or `REUSE.toml`. Calls to `gh api repos/...` returned 403 in this environment (session restriction), so we did not use them.
- **Star counts** come from the GitHub repository search API on 2026-10-10. They are indicative and will change.
- **"Verified licence"** means we read the licence text ourselves. If a repository has no licence file at its root, we say so. With no licence, default copyright applies (all rights reserved). We only describe such projects at the level of the general concept.
- Ziggy's own code is **proprietary**.

---

## 2. Projets vérifiés — licence permissive (MIT / Apache-2.0)

### 2.1 Phaser — `phaserjs/phaser`

| | |
|---|---|
| URL | https://github.com/phaserjs/phaser |
| Licence (SPDX) | **MIT** (`LICENSE.md`, "Copyright (c) 2026 Richard Davey, Phaser Studio Inc.") |
| Stars | ~40,400 |
| Used by Ziggy | Yes, as an **npm dependency** (`phaser@^3.90.0`). The package itself is unmodified. |

- **Idea kept:** Phaser's scene model (`init → preload → create → update`, then `shutdown/destroy`) for the one action game, the runner.
- **Why:** this game needs a real game loop, physics, a camera and sprites. Writing that in React/DOM would cost too much. The other 19 mini-games don't need Phaser.
- **How Ziggy adapts it:**
  - **Phaser scene lifecycle in React `useEffect`.** We create the `Phaser.Game` when the component mounts and call `game.destroy(true)` in the cleanup. This avoids duplicate canvases under React 19 StrictMode and on Next.js navigation.
  - Phaser is loaded with a client-only dynamic import (no SSR).
  - The scene gets its questions as typed data and sends back events (`answered`, `finished`) through a small event bus. The scene has no pedagogical logic of its own.
- **Code reused:** none (dependency only).

### 2.2 Phaser + Next.js template — `phaserjs/template-nextjs`

| | |
|---|---|
| URL | https://github.com/phaserjs/template-nextjs |
| Licence (SPDX) | **MIT** (`LICENSE`, "Copyright (c) 2025 Phaser") |
| Stars | ~150 |

- **Idea kept:** the official pattern for React ↔ Phaser communication, with an `EventBus` and a "bridge" component that exposes the current scene.
- **Why:** Ziggy runs on Next.js 15 / React 19. This is the officially documented way to embed Phaser in that stack.
- **How Ziggy adapts it:** Ziggy's runner has a React wrapper (dynamic import, `useEffect` mount/unmount) and a typed bus (`emit('runner:answer', {...})`). Rewards and progress stay on the React side.
- **Code reused:** none. We only read the README.

### 2.3 ink — `inkle/ink` (and runtime `inkle/inkjs`)

| | |
|---|---|
| URL | https://github.com/inkle/ink · https://github.com/inkle/inkjs |
| Licence (SPDX) | **MIT** (ink: `LICENSE.txt`, "Copyright (c) 2025 inkle Ltd."; inkjs: `LICENSE.md`, "Copyright (c) 2017 inkle Ltd., inkjs contributors") |
| Stars | ink ~4,960 |

- **Idea kept:** stories split into **knots/stitches** joined by **diverts**. The player gets a list of **choices**, and story state (variables, visit counts) decides which branches are available.
- **Why:** it's a proven model for branching stories. It is readable by non-developers, and the runtime can step through it deterministically.
- **How Ziggy adapts it:**
  - **ink-like knots/choices for Story / Chapter / Scene.** A `Story` contains `Chapter`s. A `Chapter` contains `Scene`s (≈ knots). Each `Scene` has text lines and `Choice`s, and each choice points to another scene (≈ divert).
  - Conditions on choices (e.g. "skill X mastered", "item collected") are pure, testable TypeScript functions.
  - Stories are JSON data checked with Zod. We don't embed the ink language or its compiler.
- **Code reused:** none. We don't add inkjs as a dependency for now. If we did one day, that would be fine (MIT).

### 2.4 Yarn Spinner — `YarnSpinnerTool/YarnSpinner`

| | |
|---|---|
| URL | https://github.com/YarnSpinnerTool/YarnSpinner |
| Licence (SPDX) | **MIT** (`LICENSE.md`, "Copyright (c) Yarn Spinner Pty. Ltd., Secret Lab Pty. Ltd., and Yarn Spinner contributors") |
| Stars | ~2,860 |

- **Idea kept:** the dialogue runtime sends the game three kinds of events: **lines** (text to show), **options** (choices) and **commands** (actions in the scene).
- **Why:** this keeps the narrative separate from the game engine.
- **How Ziggy adapts it:** a `Scene` emits typed `StoryEvent`s: `line` (Ziggy's text plus a TTS key), `options` and `command`. A `command` might be `startMiniGame`, `giveReward` or `unlockZone`. The story renderer (React) and the mini-games subscribe to those events and never read the story file themselves.
- **Code reused:** none.

### 2.5 ts-fsrs — `open-spaced-repetition/ts-fsrs`

| | |
|---|---|
| URL | https://github.com/open-spaced-repetition/ts-fsrs |
| Licence (SPDX) | **MIT** (`LICENSE`, "Copyright (c) 2026 Open Spaced Repetition") |
| Stars | ~810 |
| Used by Ziggy | Yes, as an **npm dependency** (`ts-fsrs@^5.4.2`). |

- **Idea kept:** FSRS scheduling (stability / difficulty / retrievability) to plan review sessions.
- **Why:** it's a modern, well-documented algorithm with a typed TypeScript implementation.
- **How Ziggy adapts it:**
  - A mini-game answer becomes an FSRS `Rating`: wrong → `Again`, correct but slow or after a hint → `Hard`, correct → `Good`, fast and correct → `Easy`.
  - The world map shows "things to review" when items are due.
  - FSRS handles **memory over time**. The mastery estimate (section 2.7) handles **current level**. They are two separate signals.
- **Code reused:** none (dependency only).

### 2.6 pyBKT — `CAHLR/pyBKT`

| | |
|---|---|
| URL | https://github.com/CAHLR/pyBKT |
| Licence (SPDX) | **MIT** (`LICENSE`, "Copyright (c) 2021 Computational Approaches to Human Learning (CAHL) Research") |
| Stars | ~280 |

- **Idea kept:** **Bayesian Knowledge Tracing**. For each skill, we keep a probability `P(known)` and update it after each answer using four parameters: prior, learn, guess and slip.
- **Why:** it's a classic, interpretable model of whether a child has learned a skill. We can explain it to parents.
- **How Ziggy adapts it:** an independent TypeScript implementation of the published BKT equation, with fixed global parameters per question type. The `guess` parameter is higher for multiple choice. We don't fit parameters per skill until we have enough data. pyBKT (Python/C++) is **not** a dependency.
- **Code reused:** none.

### 2.7 pyKT — `pykt-team/pykt-toolkit`

| | |
|---|---|
| URL | https://github.com/pykt-team/pykt-toolkit |
| Licence (SPDX) | **MIT** (`LICENSE`, "Copyright (c) 2022 pykt-team") |
| Stars | ~440 |

- **Idea kept:** a benchmark of knowledge-tracing models (DKT, etc.). It confirms that simple, explainable models are the right choice for an MVP.
- **How Ziggy adapts it:** this is a reference point only. We picked **BKT + Elo-style mastery estimate**: after each answer, the child's ability and the item's difficulty move along a logistic curve. The next exercise is chosen to aim for about 70–80% success, which keeps the child in "flow". We don't use deep learning on the child's device.
- **Code reused:** none.

### 2.8 NeMo Guardrails — `NVIDIA-NeMo/Guardrails` (formerly `NVIDIA/NeMo-Guardrails`)

| | |
|---|---|
| URL | https://github.com/NVIDIA-NeMo/Guardrails (the old URL `github.com/NVIDIA/NeMo-Guardrails` still clones) |
| Licence (SPDX) | **Apache-2.0** (`LICENSE.md`: `SPDX-License-Identifier: Apache-2.0`, plus `LICENSE-Apache-2.0.txt`; some third-party files are under MIT, see `LICENCES-3rd-party`) |
| Stars | ~7,270 |

- **Idea kept:** the rail types: **input rails** (filter the user's request), **dialog rails**, **retrieval rails**, **execution rails** (tool calls) and **output rails** (filter the model's answer).
- **Why:** it gives a clear map of where to check things around an LLM.
- **How Ziggy adapts it:** `ChildShield` (`src/lib/safety/child-shield.ts`) is organised as a pipeline:
  1. **Input rail:** normalise and filter the child's message, and mask any personal data (name, address, phone).
  2. **Dialog rail:** a fixed system prompt, a scope limited to Ziggy's topics, and canned answers for anything off-topic.
  3. **Output rail:** **the AI may only return JSON**. Zod parses it with a strict schema, a moderation pass reviews the text fields, and anything rejected gets a neutral pre-written answer.
  4. **Execution rail:** the AI never runs actions directly (see the quest engine, section 3).
- We don't use the Python library or Colang.
- **Code reused:** none.

### 2.9 EduMind Game Studio — `YassoBases/edumind-game-studio`

| | |
|---|---|
| URL | https://github.com/YassoBases/edumind-game-studio |
| Licence (SPDX) | **MIT** (`LICENSE`, "Copyright (c) 2026 EduMind Game Studio contributors") |
| Stars | 0 (recent project, May 2026) |

- **Idea kept** (from the README): *"The LLM never invents game mechanics"*. Pedagogical **templates** define the mechanics, and "archetypes" are only a theme or presentation layer on top. The LLM output goes through **Zod schemas, validators, then repair**. Moderation runs **before and after** generation. A shared runtime (`EduCore`) holds the HUD, i18n and adaptive engine.
- **Why:** this is very close to Ziggy's architecture, and it validates the approach.
- **How Ziggy adapts it:**
  - **Separate mechanics from content.** Ziggy's 20 mini-games are instances of a small set of reusable mechanics (sort, match, sequence, quick choice, runner…) fed with content packs (JSON).
  - A "theme" changes the look and never the rules.
  - **Difference:** Ziggy does **not** generate game code with an LLM. The AI can at most suggest content in JSON, which is validated and then accepted or refused by deterministic code.
- **Code reused:** none.

### 2.10 Quest AI — `DrewWasem/quest_ai`

| | |
|---|---|
| URL | https://github.com/DrewWasem/quest_ai |
| Licence (SPDX) | **MIT** (`LICENSE`, "Copyright (c) 2026 Drew Wasem") |
| Stars | 1 |

- **Idea kept** (from the README): a game for 7–11-year-olds where the LLM writes a **JSON scene script** (`spawn`, `move`, `animate`, `emote`, `react`) that the engine plays back. It uses three tiers: **pre-computed cache → live API with timeout → fallback**, so the child "never sees an error screen".
- **Why:** it's a good pattern for keeping the AI's output under control and staying robust offline.
- **How Ziggy adapts it:**
  - **Deterministic quest engine decides, AI only proposes JSON.** The AI returns a small set of typed actions (`say`, `hint`, `suggestQuest`). The engine checks each one against the current state (zone unlocked? skill appropriate?) before applying it.
  - Static fallback answers are always available, which also fits the PWA / offline mode.
- **Code reused:** none.

---

## 3. Synthèse des adaptations dans Ziggy

| Ziggy concept | Source of inspiration | Principle |
|---|---|---|
| 20 mini-games = N mechanics × content packs | EduMind Game Studio | Mechanics and content kept separate |
| Phaser runner | Phaser, template-nextjs | Phaser scene lifecycle in React `useEffect` + EventBus |
| Story / Chapter / Scene | ink, Yarn Spinner | Knots/choices/diverts; `line` / `options` / `command` events |
| Mastery estimate | pyBKT, pyKT | BKT `P(known)` + Elo-style mastery estimate, target ~75% success |
| Reviews | ts-fsrs | FSRS for memory over time (dependency) |
| ChildShield | NeMo Guardrails, Llama Guard (§4) | Input/dialog/output rails; Llama Guard categories mapped into ChildShield |
| AI → game | Quest AI, EduMind | Deterministic quest engine decides, AI only proposes JSON (Zod) + fallback |

---

## 4. Projets vérifiés — licence non standard ou copyleft (idées uniquement, aucune copie)

### 4.1 Purple Llama / Llama Guard — `meta-llama/PurpleLlama`

| | |
|---|---|
| URL | https://github.com/meta-llama/PurpleLlama |
| Licence | Mixed, according to the README table. The root `LICENSE` is the **Llama 3.2 Community License Agreement**, which applies to Llama Guard 3 and Prompt Guard. Evals/benchmarks and Code Shield are under **MIT**. This is **not** an OSI licence for the models. |
| Stars | ~4,420 |

- **Idea kept:** the hazard taxonomy from the Llama Guard 3 model card (`Llama-Guard3/8B/MODEL_CARD.md`), categories **S1–S14**: Violent Crimes, Non-Violent Crimes, Sex-Related Crimes, Child Sexual Exploitation, Defamation, Specialized Advice, Privacy, Intellectual Property, Indiscriminate Weapons, Hate, Suicide & Self-Harm, Sexual Content, Elections, Code Interpreter Abuse.
- **How Ziggy adapts it:** **Llama Guard categories mapped into ChildShield.** Each Llama Guard category maps to a ChildShield category. Ziggy adds child-specific categories: scary content for 5–8-year-olds, requests for personal data, attempts to arrange a meeting, purchases, and "medical/legal advice → ask an adult". Every block is logged without personal data, and the child sees a kind redirection.
- **Code reused:** none. We don't download or ship any model. If we used Llama Guard weights one day, the Llama Community License would need a separate review.

### 4.2 Twine — `klembot/twinejs`

| | |
|---|---|
| URL | https://github.com/klembot/twinejs |
| Licence (SPDX) | **GPL-3.0** (`LICENSE`, GNU GPL v3) |
| Stars | ~2,900 |

- **Idea kept:** the story is a **graph of passages** with links, edited visually.
- **How Ziggy adapts it:** an internal tool could one day show the Scenes graph of a Chapter, to spot dead ends and unreachable scenes. That would be our own implementation.
- **Code reused:** **none. GPL code must not be copied** into Ziggy.

### 4.3 GCompris — `KDE/gcompris` (GitHub mirror)

| | |
|---|---|
| URL | https://github.com/KDE/gcompris (development happens on invent.kde.org) |
| Licence | **AGPL-3.0** for the whole application according to the README ("All the internal code is under GPL V3+ … [one library] under AGPL 3.0 causing the whole software to be licenced under it"). Assets are under various licences (CC-BY-SA-4.0, CC0…, see `REUSE.toml` / `LICENSES/`). |
| Stars | ~60 (on the mirror) |

- **Idea kept:** a reference for kids' educational software (2–10 years): many short activities grouped by subject, with levels of difficulty.
- **Code reused:** **none.** No code or assets were copied. AGPL is incompatible with proprietary distribution.

### 4.4 EdGameClaw — `yh2072/edgameclaw`

| | |
|---|---|
| URL | https://github.com/yh2072/edgameclaw |
| Licence (SPDX) | **AGPL-3.0** (`LICENSE-AGPL-3.0`; a commercial licence is available on request according to `COMMERCIAL.md`) |
| Stars | ~70 |

- **Idea kept:** turning learning material into a game-based course with AI. This is only a general idea of "game-based learning".
- **Code reused:** **none** (AGPL).

---

## 5. Projets trouvés mais sans licence (concept général seulement)

These repositories match the names we searched for, but **we found no licence file at the repository root**. Without a licence, default copyright applies. We keep only general, non-original concepts from their READMEs, and we reused nothing.

| Searched name | Repository found | Content (from the README) | Idea we note |
|---|---|---|---|
| Math Mash | https://github.com/cmmusni/math-mash (0 ★) | Math game for kids, React (Vite) + Phaser 3 | Same split as Ziggy: `GameCanvas` wrapper on the React side, scenes on the Phaser side, HUD in React. |
| BrightBound Adventures | https://github.com/theantipopau/brightbound_adventures (0 ★) | Offline-first learning RPG for 4–12-year-olds (Flutter web), 8 learning zones | Loop: "world map → quest → practise → XP and stars → visible rewards → next quest"; parent dashboard; reduced-motion and high-contrast modes. |
| MochiGo | https://github.com/FunnyKoalaBear/MochiGo (3 ★) | Raspberry Pi robot for English pronunciation (Vosk, Ollama) | Not a web game. Tangential (voice feedback). |
| Math Rush Runner | No exact match. Closest: https://github.com/CahKangkung/MathRush (0 ★) | Educational endless runner in Unity about 2D/3D shapes | Runner + embedded math questions, which confirms the choice of a math runner. |
| Codemon | https://github.com/uniaodk/codemon (19 ★, archived) | Godot 2D RPG for learning programming basics, with a boss at the end | Challenges defined as data ("How to add new challenges") and a boss as the final assessment. |
| Quest AI (variant) | https://github.com/vamshi1512/adaptive-quest-ai (0 ★) | Adaptive learning game prototype (corporate training) | Dynamic difficulty to stay in "flow". |
| Elo + BKT (adaptive learning) | https://github.com/tombro27/mentis (0 ★) | LLM generates a skill graph, and a deterministic engine (BKT, Elo, forgetting curve) decides what comes next | Strong confirmation of "AI proposes, deterministic engine decides" and of the BKT + Elo combination. |
| PWA educational games | https://github.com/Elli2022/kids-learning-games-pwa (0 ★), https://github.com/linkzy/adfree-kids-games (0 ★) | Mini-game PWAs for young children, no ads | No ads or purchases; installable PWA with mobile-first UI. |

---

## 6. Non trouvé / non vérifié

- **Arcademia:** the only repositories found relate to the University of Lincoln's student arcade project (e.g. https://github.com/Malphatt/Arcademia-Dev-Guide, no licence). There is no link to educational games for children. **Not relevant / not used.**
- **"Math Rush Runner":** no repository with that exact name was found (see the closest match in section 5).
- **Elo in education:** a GitHub search for a well-known reference library (Elo applied to learning) returned **no established project**. The Elo-style approach in Ziggy comes from the general method (logistic update of ability and difficulty), not from a specific repository.
- **Stars and licences through the GitHub API (`gh api .../license`):** unavailable here (HTTP 403). Licences were checked by reading the files directly in shallow clones.
- **Llama Guard (models):** we checked the licence for the GitHub repository. We did **not** check the terms for distributing the weights (Hugging Face), because Ziggy does not use them.

---

## 7. Note de compatibilité des licences

- **Ziggy is proprietary software.** Its code is not published under an open-source licence.
- **MIT / Apache-2.0 / BSD:** fine as **dependencies** (Phaser, ts-fsrs, and inkjs if we ever add it). We must keep the copyright notices (and the Apache-2.0 `NOTICE` file, if there is one) in the third-party licence listing of the distributed bundle.
- **GPL-3.0 / AGPL-3.0** (Twine, GCompris, EdGameClaw): **no code copied, linked or bundled.** We only keep publicly described general concepts.
- **Repositories with no licence:** treated as "all rights reserved". Concepts only, no code, no assets.
- **Llama Community License:** not an open-source licence. It would need a dedicated legal review before any use of the models.
- **Summary: code reused from any of these projects = none.** Ziggy's only external code comes from the declared npm dependencies (`phaser`, `ts-fsrs`, …), used under their licences.
