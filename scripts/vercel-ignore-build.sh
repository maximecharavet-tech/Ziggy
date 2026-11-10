#!/usr/bin/env bash
# Exit 0 = skip build; exit 1 = run build. Default: build.
set -eu

BASE="${VERCEL_GIT_PREVIOUS_SHA:-}"
HEAD="${VERCEL_GIT_COMMIT_SHA:-HEAD}"

if [ -z "${BASE}" ] || [ "${BASE}" = "null" ] || [ "${BASE}" = "${HEAD}" ]; then
  if git rev-parse --verify HEAD^ >/dev/null 2>&1; then
    BASE="$(git rev-parse HEAD^)"
  else
    echo "vercel-ignore-build: no usable base — building"
    exit 1
  fi
fi

files="$(git diff --name-only "${BASE}" "${HEAD}" 2>/dev/null || true)"
if [ -z "${files}" ]; then
  echo "vercel-ignore-build: empty/unavailable diff — building"
  exit 1
fi

# Only skip when EVERY changed file is docs/meta. public/, src/, package*, configs → build.
while IFS= read -r f; do
  [ -z "${f}" ] && continue
  case "${f}" in
    .github/*|docs/*|*.md|*.mdx|LICENSE|LICENSE.*|THIRD_PARTY*|CHANGELOG*|CHANGELOG.*|.gitignore|.editorconfig)
      ;;
    *)
      echo "vercel-ignore-build: code/asset change (${f}) — building"
      exit 1
      ;;
  esac
done <<LIST
${files}
LIST

echo "vercel-ignore-build: only docs/meta changed — skipping"
exit 0
