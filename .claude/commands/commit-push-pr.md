---
description: Commit the current work, push the branch, open a PR
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git checkout -- tsconfig.json)
---
## Context
- Status: !`git status --short --branch`
- Diff summary: !`git diff HEAD --stat | tail -40`
- Recent commits (match their style): !`git log --oneline -8`

## Task
1. `git checkout -- tsconfig.json`, then stage only the files that belong to this change (never `.next*`, never secrets).
2. Write a commit message like the recent ones: a short title, then bullet points saying what changed for children/parents. End with the session's Co-Authored-By / Claude-Session trailers. No model names.
3. Push the current branch with `git push -u origin <branch>` (never `main`, never force).
4. Open a pull request (GitHub MCP tools) only if the user asked for one.
