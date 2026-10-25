# Proposal: auto-publish free submissions that pass the checks

Status: PROPOSED 2026-10-10, not built. Needs Shib's go-ahead.

## Why

Until 2026-10-08 every free /submit confirmation said "we will review it within 24-48 hours".
That review never ran: of 59 free submissions from 2026-09-11 to 2026-10-10, one was listed.
d87476e changed the copy to "a hand-review queue with no set date; we'll email you if it's listed".
That is accurate about the date, but nothing runs the queue and nothing sends the "listed" email.
A queue with no reviewer is the same broken promise with softer wording.

On 2026-10-10 the whole queue was reviewed by hand against one bar
(`~/clawd/memory/mymcptools-free-queue-review-2026-10-10.jsonl`): 47 approved, 12 rejected.
Every rejection fell into a class a machine can detect:

| reason | n | machine-checkable? |
|---|---|---|
| duplicate resubmission (same repo, same maker) | 8 | yes: normGithub match against catalog + pending |
| endpoint dead (TLS mismatch, Cloudflare 530) | 2 (+2 dup) | yes: MCP `initialize` probe |
| self-labelled test ("Test probe") | 1 | partly: description length/keywords → hold for a human |
| fake-engagement seller (followers/likes) | 1 | no: needs a human or a denylist |

## Proposed flow (mirrors aisotools `approveSubmission`)

At submit time, `api/submit/route.ts` already calls the GitHub API. Extend that step:

1. **Real-server check.** Either the submitted MCP endpoint answers `initialize` (200 with
   `serverInfo`, or 401 with a `WWW-Authenticate` resource_metadata header), or the
   submitted npm or PyPI package resolves on its registry.
2. **Not a duplicate.** `normGithub(github)` and the website host are not already in
   `servers.ts` or in the overlay.
3. **Copy is usable.** The description is at least 80 chars and is not "test" or "probe".

If all three pass, write the row to `analytics.mcpt_paid_listings` with `sku = 'free'`,
`amount_cents = 0` and a synthetic `stripe_session_id` of `free:<uuid>`.
Then email the maker the live URL straight away.
If any check fails, the row goes to the hand queue and the ack says why.

Required code change: `loadOverlay()` in `src/lib/paid-listings.ts` currently hard-codes
`featured: true, paid_placement: true` for every overlay row. A `free` row must render
`featured: false, paid_placement: false`, with `verification: 'unresolved'` as today.
Without that change a free row would wear the paid badge, which is the one thing the
$9 tier sells. `scripts/paid-rel-census.mts` must keep free rows nofollow/ugc.

Once that ships, the ack copy can promise something true and specific:
"If your server answers MCP initialize, it is listed within a minute."
