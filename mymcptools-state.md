# MyMCPTools — Phase 0 Ground-Truth Inventory

Verified directly against the live repo + production site on 2026-07-01. Do not build Phase 1 until this is confirmed.

## 1. Monetization infra

- `/advertise` page exists (360 lines), but pricing/billing model **differs from AISOTools**: Basic $49 / Pro $99 / Premium $199, all **one-time** (not $19/$49/$99/mo recurring). The mission doc assumed AISO's pricing carries over — it doesn't, unless Shib wants to change it to match.
- **Two separate checkout routes**, both live now that `STRIPE_SECRET_KEY` was wired today:
  - `/api/checkout` — $9 one-time "featured listing" fee, tied to the `/submit` flow.
  - `/api/advertise/checkout` — the $49/$99/$199 tiers, tied to `/advertise`. Uses placeholder Stripe Price IDs that fall back to dynamic pricing, so it works without pre-created Stripe Products (real Products should still be created for clean reporting).
  - Both verified live via direct request — return proper validation errors, not "Stripe not configured."
- **No sponsor dashboard** — aisotools has one (click analytics, referrers, RLS-scoped); mymcptools has nothing equivalent.
- **Critical gap, blocks selling anything:** the `MCPServer` type has a `sponsored` boolean field, but it is **never referenced in any rendering component** — no badge, no homepage "sponsored strip," no top-of-category placement code exists anywhere in `src/app`. If someone paid today, there's no way to actually deliver what `/advertise` promises. This has to be built before Phase 2 outreach, per the mission's own rule ("do not sell placement the site cannot render").
- **Correction to the mission doc's premise:** it names Better Stack, 1Password, and ElevenLabs as "current placements, not payments." Checked all three in `servers.ts` — only **1Password** is `featured: true`. Better Stack is explicitly `featured: false`. ElevenLabs has no featured flag at all (default false). So today there isn't even one placement live, paid or not — one editorially-featured listing (1Password) and two plain entries.

## 2. Data layer

- **No database.** All 2,754 servers live in a single static file, `src/data/servers.ts` (37,651 lines) — edits require a code change + redeploy, not an admin panel.
- **No submissions table.** `/submit` → `/api/submit` only fires two transactional emails via Resend (admin notification to shibley@gmail.com + confirmation to the submitter) — nothing is persisted anywhere. Consequence: **there is no backfill queue to query** for past submitters like aisotools has. The only historical record is whatever's sitting in Shib's Gmail inbox under subject "🟢 New MCP Server Submission: ...".

## 3. Analytics

- `@vercel/analytics` is wired into `layout.tsx`, so real traffic data exists.
- Couldn't pull live numbers this pass — Chrome wasn't reachable for browser automation (remote debugging not enabled / not running). Flagging rather than guessing.
- The hardcoded `/advertise` stats (**5,000+ monthly visitors, 500+ ranked keywords, 2,200+ servers indexed**) are unverified, same trust risk as AISO's page. Live sitemap actually has **9,405 URLs** (servers + generated comparison/category pages), separate from the 2,754 raw server count.
- No per-listing or per-category traffic breakdown exists in code — would need to be built for the media-kit / stats-email pieces the mission describes.

## 4. Email

- Submissions and (presumably) any future sequence would send from `shibley@apistatuscheck.com` — an **already-warmed domain** reused from ASC, not a dedicated mymcptools address. This resolves the mission's open question in Phase 2 ("if no warmed domain, flag Shib") — no warm-up delay needed, just reuse this sender.

## 5. Contact data (for the vendor prospect list)

- 2,729 / 2,754 servers (99%) have a `github_url`. 1,483 (54%) have a `website_url`. Good raw material for public-contact sourcing.
- But: **961 unique non-"community" authors**, and a large share of those are big, non-buying orgs (Anthropic, AWS, Google, Microsoft, GitHub, Cloudflare, Stripe, MongoDB, Supabase — official/reference servers). 1,258 entries are just `author: 'community'/'Community'` with no company at all.
- Net: the real "funded indie vendor who might pay $49-199" pool is meaningfully smaller than "2,700+ servers = 2,700 leads." Same filter used for AISO outreach (exclude giants/unicorns, target indie makers) needs to apply here, probably more aggressively — the MCP ecosystem skews toward big-co official servers and unpaid community projects, with a thinner middle.

## 6. Traffic reality

- Sitemap: 9,405 URLs live.
- Real 90-day visitor/referrer numbers: not pulled this pass (see Analytics section) — needs either a manual Vercel Analytics check or a follow-up session with browser access.

## Bottom line / build list before Phase 1 can start for real

1. **Render the sponsored badge/placement** — currently sold but not built. This is the actual blocker, not outreach.
2. Decide: keep mymcptools' existing $49/$99/$199 one-time pricing, or switch to AISO's $19/$49/$99/mo recurring to make the two properties comparable for the Shared Scorecard. They currently don't match.
3. Reconcile which checkout route is canonical (`/api/checkout` $9 vs `/api/advertise/checkout` $49-199) — right now two different price points sell overlapping things, the same class of bug just fixed on aisotools' `/submit` vs `/advertise` mismatch.
4. No submissions DB — either add one (mirrors aisotools) or accept that Phase 3's "backfill queue" only has whatever's minable from Gmail.
5. Get a real traffic number before writing any stats-based copy or media kit.
