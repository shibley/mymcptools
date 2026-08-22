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
# Fail OPEN: if Vercel does not hand us a usable previous SHA, BUILD rather
# than guess a lookback window. The old HEAD~9 fallback was narrower than the
# median push on some repos (apistatuscheck: median 10 commits, max 25, 56% of
# pushes wider than 9) — a guess that is too short silently skips real work.
# A wasted build costs cents; a silent skip cost us a whole research fire.
if [ -z "${VERCEL_GIT_PREVIOUS_SHA:-}" ] || ! git cat-file -e "${VERCEL_GIT_PREVIOUS_SHA}^{commit}" 2>/dev/null; then
  exit 1
fi
BASE="${VERCEL_GIT_PREVIOUS_SHA}"

# Build if any commit in that range touched relevant source/config paths.
# NOTE: do NOT pipe straight into `grep -q` here. `grep -q` exits on the first
# match, git gets SIGPIPE (141), and `set -o pipefail` propagates that as the
# pipeline's status — so a LARGE diff (git still writing when grep quits)
# silently took the skip branch while a small one built fine. That is what left
# aisotools' monitoring-upsell route 404 in production after a 1,712-file push.
# Materialise the file list first, then match it.
CHANGED="$(git diff --name-only "${BASE}" HEAD 2>/dev/null || true)"
if grep -qE '^(src/|app/|components/|lib/|data/|public/|supabase/migrations/|package(-lock)?\.json|next\.config|tsconfig|tailwind|vercel\.json|eslint\.config|postcss\.config)' <<<"${CHANGED}"; then
  exit 1
fi

# Otherwise, junk-only range — skip.
exit 0
