/**
 * Featured fulfilment selfcheck (research-mcpso-vs-mymcptools-2026-10-22, gaps #3/#5).
 *
 * Asserts, offline (no network, no database):
 *   1. The paid-at "live" mail names the exact pages a Featured row renders on
 *      (listing + each real category page), never the homepage, and escapes
 *      buyer-supplied names.
 *   2. Outbound clicks on listing links are recorded: the server page's own
 *      website/repo anchors carry `data-outbound-slug`, the beacon sends them,
 *      and /api/collect turns them into `/_e/out/<slug>` rows.
 *   3. The 30-day report: due-window SQL, claim-before-send, unclaim on a
 *      failed send, zeros reported as zeros, a report goes once.
 *   4. The cron is wired: vercel.json schedules the route and the route exists
 *      and checks CRON_SECRET.
 *   5. Paid links stay `sponsored nofollow`.
 *   6. /media-kit exists, reads live warehouse numbers (no hard-coded traffic
 *      figure) and prints a measurement date.
 *
 * Run: npm run featured:selfcheck
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  CLAIM_SQL,
  DUE_SQL,
  REPORT_SINCE,
  UNCLAIM_SQL,
  liveEmail,
  outboundClickFields,
  outboundEventPath,
  placementUrls,
  reportEmail,
  runDueReports,
  type Query,
} from "../src/lib/featured-report.ts";
import { listingOutboundRel } from "../src/lib/outbound-rel.ts";

let failures = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures++;
    console.log(`  FAIL ${name}\n       ${(err as Error).message.split("\n")[0]}`);
  }
}
const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const NAMES = new Map([["api", "API & Web"], ["coding", "Coding & Dev"]]);
const PAID = new Date("2026-10-23T18:00:00Z");

console.log("# 1. live mail");
await check("catalog order: listing + every real category page, unknown category dropped", () => {
  const u = placementUrls("supabase", "other", ["api", "coding", "nope"], NAMES);
  assert.equal(u.listing, "https://mymcptools.com/servers/supabase");
  assert.deepEqual(u.categories.map((c) => c.url), ["https://mymcptools.com/category/api", "https://mymcptools.com/category/coding"]);
});
await check("overlay order: the buyer's chosen category", () => {
  assert.deepEqual(placementUrls("acme-mcp", "api", undefined, NAMES).categories.map((c) => c.slug), ["api"]);
});
await check("mail names the URLs, the report date, nofollow, and denies the homepage", () => {
  const m = liveEmail({ name: "Acme <b>MCP</b>", urls: placementUrls("acme-mcp", "api", undefined, NAMES), paidAt: PAID });
  assert.match(m.html, /https:\/\/mymcptools\.com\/servers\/acme-mcp/);
  assert.match(m.html, /https:\/\/mymcptools\.com\/category\/api/);
  assert.match(m.html, /November 22, 2026/);
  assert.match(m.html, /sponsored nofollow/);
  assert.match(m.html, /not<\/strong> appear on the homepage/);
  assert.ok(!m.html.includes("<b>MCP</b>"), "buyer name not escaped");
});
const webhook = read("src/app/api/webhook/route.ts");
await check("webhook sends liveEmail to the Featured buyer", () => {
  assert.match(webhook, /liveEmail\(/);
  assert.match(webhook, /placementUrls\(/);
});

console.log("\n# 2. outbound clicks");
await check("collect body -> /_e/out/<slug>, host only; junk rejected", () => {
  assert.deepEqual(outboundClickFields({ kind: "out", slug: "acme-mcp", to: "https://Acme.dev/x?y=1" }), {
    path: "/_e/out/acme-mcp",
    utmSource: "outbound",
    utmCampaign: "acme.dev",
  });
  assert.equal(outboundClickFields({ kind: "out", slug: "../etc" }), null);
  assert.equal(outboundClickFields({ path: "/servers/x" }), null);
  assert.equal(outboundEventPath("a b"), null);
});
await check("/api/collect uses outboundClickFields", () => {
  assert.match(read("src/app/api/collect/route.ts"), /outboundClickFields\(/);
});
await check("beacon sends clicks on [data-outbound-slug]", () => {
  const b = read("src/app/_analytics/beacon.tsx");
  assert.match(b, /data-outbound-slug/);
  assert.match(b, /kind:\s*"out"/);
});
await check("every listing website/repo anchor on the server page carries data-outbound-slug", () => {
  const page = read("src/app/servers/[slug]/page.tsx");
  const anchors = [...page.matchAll(/<a\b[^>]*?href=\{\s*server\.(website_url|github_url)\s*\}[^>]*>/g)];
  assert.ok(anchors.length >= 2, `found ${anchors.length} anchors`);
  for (const a of anchors) assert.match(a[0], /data-outbound-slug=\{server\.slug\}/, a[1]);
});

console.log("\n# 3. 30-day report");
await check("due SQL: featured, not refunded, since ship day, 30 days, not yet sent", () => {
  assert.match(DUE_SQL, /sku = 'featured'/);
  assert.match(DUE_SQL, /status in \('active', 'fulfilled_static'\)/);
  assert.match(DUE_SQL, /interval '30 days'/);
  assert.match(DUE_SQL, /report_sent_at/);
  assert.equal(REPORT_SINCE, "2026-10-22T07:00:00Z");
  assert.match(CLAIM_SQL, /returning/);
  assert.match(UNCLAIM_SQL, /- 'report_sent_at'/);
});

function fakeDb(rows: Record<string, unknown>[], stats: Record<string, unknown>) {
  const claimed = new Set<string>();
  const calls: string[] = [];
  const query: Query = async (sql, params) => {
    if (sql === DUE_SQL) {
      calls.push("due");
      return { rows: rows.filter((r) => !claimed.has(String(r.stripe_session_id))) };
    }
    if (sql === CLAIM_SQL) {
      calls.push("claim");
      const id = String(params[0]);
      if (claimed.has(id)) return { rows: [] };
      claimed.add(id);
      return { rows: [{ stripe_session_id: id }] };
    }
    if (sql === UNCLAIM_SQL) {
      calls.push("unclaim");
      claimed.delete(String(params[0]));
      return { rows: [] };
    }
    calls.push("stats");
    assert.equal(params[1], "/_e/out/acme-mcp");
    assert.deepEqual(params[2], ["/category/api"]);
    return { rows: [stats] };
  };
  return { query, calls, claimed };
}
const ROW = { stripe_session_id: "cs_test_1", slug: "acme-mcp", name: "Acme", category: "api", contact_email: "funnel-probe+featured@apistatuscheck.com", paid_at: PAID };
const deps = (query: Query, send: (to: string, s: string, h: string) => Promise<boolean>) => ({
  query, send, now: new Date("2026-11-23T00:00:00Z"), catalogCategories: () => undefined, categoryNames: NAMES,
});

await check("sends once, with zeros printed as zeros", async () => {
  const db = fakeDb([ROW], { listing_sessions: 0, listing_views: 0, click_sessions: 0, clicks: 0, category_sessions: 3 });
  const sent: string[] = [];
  const send = async (to: string, _s: string, h: string) => { sent.push(h); assert.equal(to, ROW.contact_email); return true; };
  const r1 = await runDueReports(deps(db.query, send));
  const r2 = await runDueReports(deps(db.query, send));
  assert.deepEqual(r1.sent, ["cs_test_1"]);
  assert.equal(r2.due, 0);
  assert.equal(sent.length, 1);
  assert.match(sent[0], /0 clicks from 0 visitors/);
  assert.match(sent[0], /where you sat at the top: 3/);
});
await check("failed send releases the claim for tomorrow", async () => {
  const db = fakeDb([ROW], { clicks: 2, click_sessions: 1 });
  const r = await runDueReports(deps(db.query, async () => false));
  assert.deepEqual(r.failed, ["cs_test_1"]);
  assert.ok(!db.claimed.has("cs_test_1"));
  assert.ok(db.calls.includes("unclaim"));
});
await check("report mail pluralises and escapes", () => {
  const m = reportEmail({ name: "<x>", urls: placementUrls("acme-mcp", "api", undefined, NAMES), paidAt: PAID,
    stats: { listingSessions: 1, listingViews: 1, clickSessions: 1, clicks: 1, categorySessions: 0 } });
  assert.match(m.html, /1 click from 1 visitor/);
  assert.ok(!m.html.includes("<x>"));
});

console.log("\n# 4. cron wiring");
await check("vercel.json schedules /api/cron/featured-report daily", () => {
  const v = JSON.parse(read("vercel.json") || "{}");
  assert.ok((v.crons || []).some((c: { path: string }) => c.path === "/api/cron/featured-report"));
});
await check("cron route exists, checks CRON_SECRET, calls runDueReports", () => {
  const r = read("src/app/api/cron/featured-report/route.ts");
  assert.match(r, /CRON_SECRET/);
  assert.match(r, /runDueReports\(/);
});

console.log("\n# 5. rel");
await check("paid rel is sponsored nofollow; free rel is not", () => {
  const paid = listingOutboundRel({ paid_placement: true }).split(" ");
  assert.ok(paid.includes("sponsored") && paid.includes("nofollow"), paid.join(" "));
  assert.ok(!listingOutboundRel({}).includes("nofollow"));
});
await check("late maker-door Featured upgrades the prerendered anchors' rel", () => {
  assert.match(read("src/components/PaidFeaturedBadge.tsx"), /data-outbound-slug/);
});

console.log("\n# 6. media kit");
await check("/media-kit reads the warehouse, shows a measurement date, no hard-coded session count", () => {
  const page = read("src/app/media-kit/page.tsx");
  assert.ok(page, "src/app/media-kit/page.tsx missing");
  assert.match(page, /mediaKitNumbers\(/);
  assert.match(page, /Measured/);
  assert.ok(!/\b\d{1,3},\d{3}\b|\b\d{4,}\s+(?:human\s+)?sessions/i.test(page), "hard-coded traffic figure in page");
});
await check("/submit links the media kit", () => {
  assert.match(read("src/app/submit/page.tsx"), /\/media-kit/);
});

if (failures) {
  console.log(`\n${failures} CHECK(S) FAILED`);
  process.exit(1);
}
console.log("\nfeatured-report selfcheck: all assertions passed");
