#!/usr/bin/env bash
# Vercel ignore-build filter. Returns 0 to SKIP the build, 1 to BUILD.
# Standardized across our Vercel projects (chore(ci): smarter ignoreCommand).

set -uo pipefail

# deploy-batch pushes several accumulated commits per build trigger. The old
# version only looked at HEAD's own message/diff, so a trailing
# chore(monitor)/chore(rotation)/auto-refresh commit at the tip silently
# skipped the build even when earlier commits in the same batch touched real
# source paths (confirmed: 3+ apistatuscheck content commits never went live
# because the last commit in their push was a monitor auto-refresh).
#
# Diff the whole batch instead of just the tip commit. Prefer the SHA of the
# last successful deploy when Vercel exposes it; fall back to a bounded
# lookback within the platform's shallow-clone depth (10) otherwise.
BASE="HEAD~9"
if [ -n "${VERCEL_GIT_PREVIOUS_SHA:-}" ] && git cat-file -e "${VERCEL_GIT_PREVIOUS_SHA}^{commit}" 2>/dev/null; then
  BASE="${VERCEL_GIT_PREVIOUS_SHA}"
fi

# Build if any commit in that range touched relevant source/config paths.
git diff --name-only "${BASE}" HEAD 2>/dev/null | grep -qE '^(src/|app/|components/|lib/|data/|public/|supabase/migrations/|package(-lock)?\.json|next\.config|tsconfig|tailwind|vercel\.json|eslint\.config|postcss\.config)' && exit 1

# Otherwise, junk-only range — skip.
exit 0
