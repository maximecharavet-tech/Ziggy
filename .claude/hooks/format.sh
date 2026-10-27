#!/usr/bin/env bash
# PostToolUse hook: tidy the file Claude just edited (ESLint --fix), never blocking.
file=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)
case "$file" in
  *.ts|*.tsx|*.js|*.mjs) [ -f "$file" ] && npx --no-install eslint --fix --quiet "$file" >/dev/null 2>&1 ;;
esac
exit 0
