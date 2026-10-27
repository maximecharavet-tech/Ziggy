---
description: Browser smoke test of the key pages on a production build
---
## Task
1. `npm run build`, then `npx next start -p 3200` in the background.
2. With Playwright (Chromium at `/opt/pw-browsers/chromium`, args `--use-gl=swiftshader --enable-unsafe-swiftshader`), before each page set `sessionStorage['ziggy:intro']='1'` and `localStorage['cookie-consent']='seen'`, then open at 1280×800 (no reduced motion) and 390×844 (`reducedMotion: 'reduce'`):
   `/`, `/monde`, `/monde/arcade`, `/monde/arcade/memory_magic`, `/monde/arcade/math_runner`, `/creer`, `/monde/musique`, `/monde/histoires`, `/monde/avatar`, `/coloriage`, `/monde/bac-a-sable`, `/monde/nid`, `/dodo`, `/dodo/lili`, `/monde/3d/noel`, `/en/dodo/lili`, `/ar/creer`, `/n-existe-pas` (must be 404).
3. Report per page: HTTP status, page errors (React #418 = hydration mismatch), horizontal overflow. Save screenshots to the scratchpad and look at a few.
4. Stop the server.
