#!/usr/bin/env bash
# Vercel ignore-build filter. Returns 0 to SKIP the build, 1 to BUILD.
# Standardized across our Vercel projects (chore(ci): smarter ignoreCommand).

set -uo pipefail

LAST=$(git log -1 --pretty=%B)

# (1) Skip cron/docs/meta commits regardless of file diff.
echo "$LAST" | grep -qE '(\[skip ci\]|chore\(monitor\)|chore\(rotation\)|chore\(strategy\)|chore\(sprint\)|auto-refresh|cycle [0-9]+ slot|aiso-taaft-gaps|new blog posts?|^content:|^docs:|^memory:|^security:)' && exit 0

# (2) Build only if relevant source/config paths changed.
git diff --name-only HEAD^ HEAD 2>/dev/null | grep -qE '^(src/|app/|components/|lib/|data/|public/|supabase/migrations/|package(-lock)?\.json|next\.config|tsconfig|tailwind|vercel\.json|eslint\.config|postcss\.config)' && exit 1

# (3) Otherwise, junk-only commit — skip.
exit 0
