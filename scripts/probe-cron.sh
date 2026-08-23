#!/usr/bin/env bash
# Scheduled MCP prober (PRD P0-3 scheduling).
#
# The probe stores under src/data/ are imported at build time, so fresh data
# only reaches production via a commit + push (which retriggers the Vercel
# build — src/ is a build-relevant path in vercel-ignore-build.sh).
#
# This matters more since /api/mcp shipped: agents query the catalog as an
# authoritative uptime source, so a stale generated_at is a credibility
# problem, not just a cosmetic one.
#
#   probe-cron.sh hot    every few hours — featured/sponsored + non-GOOD servers
#   probe-cron.sh full   nightly — the entire remote population
#
# Run from cron; logs to memory/probe-cron.log in the workspace.

set -uo pipefail

MODE="${1:-hot}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="${HOME}/clawd/memory/probe-cron.log"
export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH}"

log() { printf '%s [probe-cron:%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${MODE}" "$*" >> "${LOG}"; }

cd "${REPO}" || { log "FATAL: cannot cd ${REPO}"; exit 1; }

# Never fight a human/agent mid-edit: only run on a clean-enough tree.
if [ -n "$(git status --porcelain -- src/data/ 2>/dev/null)" ]; then
  log "SKIP: src/data/ already dirty, refusing to mix with in-flight work"
  exit 0
fi

log "start"
if ! npm run "probe:${MODE}" >> "${LOG}" 2>&1; then
  log "FAIL: probe exited non-zero"
  exit 1
fi

if [ -z "$(git status --porcelain -- src/data/ 2>/dev/null)" ]; then
  log "done: no data change, nothing to commit"
  exit 0
fi

git add src/data/probe-status.json src/data/probe-events.jsonl src/data/probe-inventory.json 2>/dev/null
git commit -q -m "chore(probe): scheduled ${MODE} probe refresh" || { log "FAIL: commit"; exit 1; }

# Push auth under cron (see 2026-08-23 monitoring run):
# `gh auth git-credential` alone is NOT sufficient. gh keeps its token in the
# macOS keyring, which a non-login cron session cannot unlock, so the push dies
# on "could not read Username: Device not configured". It failed every run for
# 2 days while appearing fixed, because the Aug 21 change was only ever tested
# from a logged-in shell that HAD keychain access — reproducing it requires an
# actual cron context, not `env -i`.
# Mitigation: hand gh a token from a plain file; GH_TOKEN bypasses the keyring
# entirely. The empty `-c credential.helper=` resets the system-wide osxkeychain
# helper so gh is the only one consulted (belt-and-braces; a failing first
# helper was tested and does NOT abort the chain, so that alone was not it).
# If a push still fails after this, the fallback is unchanged: the commit is
# held locally and ships with the next deploy-batch push.
[ -r "${HOME}/.gh-cron-token" ] && export GH_TOKEN="$(cat "${HOME}/.gh-cron-token")"
if git -c credential.helper= -c credential.helper='!/opt/homebrew/bin/gh auth git-credential' push -q origin HEAD 2>>"${LOG}"; then
  log "done: pushed $(git rev-parse --short HEAD)"
else
  log "WARN: committed $(git rev-parse --short HEAD) but push failed — will go out with the next push"
fi
