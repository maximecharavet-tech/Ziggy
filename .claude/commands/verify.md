---
description: Full verification loop (types, lint, tests, production build)
allowed-tools: Bash(npm run check), Bash(npm run build), Bash(git checkout -- tsconfig.json), Bash(git status:*)
---
## Context
- Branch and changes: !`git status --short --branch | head -30`

## Task
Run, in order, and stop at the first failure to fix it:
1. `git checkout -- tsconfig.json` (next dev may have rewritten it)
2. `npm run check` (tsc + eslint + vitest). If only the sandbox speed test fails, rerun `npx vitest run src/games2d/sandbox` alone: it is timing-sensitive under load.
3. `npm run build`
Report a short summary: what passed, what you fixed.
