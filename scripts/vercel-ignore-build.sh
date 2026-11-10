#!/usr/bin/env bash
# Skip Vercel build only when EVERY changed file is docs/meta (not app code, not public assets).
# Exit 0 → skip; exit 1 → build. Safe default: build.
set -euo pipefail

if [ "${VERCEL_ENV:-}" = "production" ] && [ -n "${VERCEL_GIT_COMMIT_REF:-}" ]; then
  # Never skip production deploys from main-ish branches on first push ambiguity
  :
fi

BASE="${VERCEL_GIT_PREVIOUS_SHA:-}"
HEAD="${VERCEL_GIT_COMMIT_SHA:-HEAD}"

if [ -z "$BASE" ] || [ "$BASE" = "null" ]; then
  if git rev-parse --verify HEAD^ >/dev/null 2>&1; then
    BASE="$(git rev-parse HEAD^)"
  else
    echo "vercel-ignore-build: no previous SHA — building"
    exit 1
  fi
fi

mapfile -t files < <(git diff --name-only "$BASE" "$HEAD" 2>/dev/null || true)
if [ "${#files[@]}" -eq 0 ]; then
  echo "vercel-ignore-build: empty diff — building (safe)"
  exit 1
fi

# Patterns that may be skipped alone (docs / license / github meta).
# Anything under public/, src/, app/, packages, lockfiles, configs → must build.
skip_re='^(\.github/|docs/|.*\.(md|mdx)$|LICENSE.*|THIRD_PARTY.*|CHANGELOG.*|\.gitignore$|\.editorconfig$)$'

for f in "${files[@]}"; do
  if ! echo "$f" | grep -Eq "$skip_re"; then
    echo "vercel-ignore-build: code/asset change ($f) — building"
    exit 1
  fi
done

echo "vercel-ignore-build: only docs/meta changed — skipping"
exit 0
