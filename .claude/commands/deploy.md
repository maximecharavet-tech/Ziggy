---
description: Deploy to production (fast-forward main) after full verification
---
Only run when the user explicitly asks to deploy.
1. Run `/verify` then `/smoke`; everything must be green.
2. Commit with `/commit-push-pr` (no PR).
3. `git fetch origin main` and check `git merge-base --is-ancestor origin/main HEAD`; if not a fast-forward, stop and ask.
4. `git push origin HEAD:main`.
5. Confirm: Vercel production deployment READY for that commit (Vercel MCP `list_deployments`, target production) and the GitHub CI run green. Report in French to the owner.
