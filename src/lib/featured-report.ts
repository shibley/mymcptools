/**
 * Featured fulfilment, the buyer's side: what a $49 Featured buyer is told
 * at payment, and the 30-day click report they get afterwards.
 *
 * WHY THIS EXISTS (research-mcpso-vs-mymcptools-2026-10-22.md, gap #3). The
 * Featured confirmation mail linked the listing page only and said "at the top
 * of its category" without naming the category page, so a buyer could not
 * check the placement they paid for. Nothing measured what the placement did
 * either: outbound clicks on listing pages were not recorded at all.
 *
 * WHERE A PAID ROW RENDERS — verified in code, 2026-10-22, and nowhere else:
 *  - `/servers/<slug>`: the listing page, with a Featured badge (overlay rows
 *    render it server-side; catalog rows via `PaidFeaturedBadge`).
 *  - `/category/<cat>`: lifted to the top of each of its categories
 *    (`src/app/category/[slug]/page.tsx`, paid rows prepended).
 *  The homepage "Sponsored" strip reads `servers.ts` `sponsored` rows only —
 *  a Featured order never appears there, so the mail never claims it does.
 *
 * Import-free (the catalog lookup is injected) so the selfcheck runs it
 * without the 41k-line catalog or a database.
 */

export const SITE_URL = "https://mymcptools.com";
export const REPORT_DAYS = 30;
/**
 * Only orders paid on/after the $49 ship day get the 30-day report. The one
 * older order (Coinrule, $9, 2026-09-03) was never promised a report, and a
 * cron must not surprise a customer with mail nobody told them about.
 */
export const REPORT_SINCE = "2026-10-22T07:00:00Z";

/** `/_e/<surface>/<action>` event convention (see submission-event.ts). */
export const OUTBOUND_EVENT_PREFIX = "/_e/out/";
export const OUTBOUND_UTM_SOURCE = "outbound";
const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,79}$/;

/** Warehouse path an outbound click on a listing's own links is recorded under. */
export function outboundEventPath(slug: unknown): string | null {
  return typeof slug === "string" && SLUG_RE.test(slug) ? `${OUTBOUND_EVENT_PREFIX}${slug}` : null;
}

/**
 * `/api/collect` body → outbound-click row fields, or null for a pageview.
 * Body: `{ kind: "out", slug, to }` where `to` is the clicked href; only its
 * host is kept (utm_campaign), so a buyer can be told which link was clicked.
 */
export function outboundClickFields(b: Record<string, unknown>): { path: string; utmSource: string; utmCampaign: string | null } | null {
  if (b.kind !== "out") return null;
  const path = outboundEventPath(b.slug);
  if (!path) return null;
  let host: string | null = null;
  try {
    host = typeof b.to === "string" ? new URL(b.to).hostname.toLowerCase().slice(0, 128) || null : null;
  } catch {
    host = null;
  }
  return { path, utmSource: OUTBOUND_UTM_SOURCE, utmCampaign: host };
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export interface PlacementUrls {
  listing: string;
  categories: { slug: string; name: string; url: string }[];
}

/**
 * The exact URLs a Featured row shows on. `catalogCategories` is the catalog's
 * categories for a slug `servers.ts` holds (maker-door order), else undefined;
 * an overlay row shows under the one category the buyer picked. Category slugs
 * the site has no page for are dropped — never mail a buyer a 404.
 */
export function placementUrls(
  slug: string,
  formCategory: string | null | undefined,
  catalogCategories: string[] | undefined,
  categoryNames: ReadonlyMap<string, string>
): PlacementUrls {
  const cats = catalogCategories ?? (formCategory ? [formCategory] : []);
  return {
    listing: `${SITE_URL}/servers/${slug}`,
    categories: [...new Set(cats)]
      .filter((c) => categoryNames.has(c))
      .map((c) => ({ slug: c, name: categoryNames.get(c)!, url: `${SITE_URL}/category/${c}` })),
  };
}

function reportDate(paidAt: Date): string {
  const d = new Date(paidAt.getTime() + REPORT_DAYS * 86_400_000);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function placesHtml(urls: PlacementUrls): string {
  const cats = urls.categories
    .map((c) => `<li>Top of the <strong>${escapeHtml(c.name)}</strong> category: <a href="${c.url}">${c.url}</a></li>`)
    .join("");
  return `<ul><li>Your listing page, with the Featured badge: <a href="${urls.listing}">${urls.listing}</a></li>${cats}</ul>`;
}

/** The "your placement is live" mail, sent by the Stripe webhook at payment. */
export function liveEmail(input: { name: string; urls: PlacementUrls; paidAt: Date }) {
  const name = escapeHtml(input.name);
  return {
    subject: `Your Featured listing is live — ${input.name}`,
    html: `
      <h2>Payment received — ${name} is Featured ⭐</h2>
      <p>Your placement went live the moment payment cleared. It shows here:</p>
      ${placesHtml(input.urls)}
      <p>It does <strong>not</strong> appear on the homepage; those are the only places Featured shows.</p>
      <p>Links from your listing to your site and repo carry <code>rel="sponsored nofollow"</code>, as Google requires for paid placements. We count clicks on them.</p>
      <p>On <strong>${reportDate(input.paidAt)}</strong> we'll email you a 30-day report: views of your listing, clicks on your links, and visits to the category pages above. Our traffic is small and the numbers will say so; the current figures are at <a href="${SITE_URL}/media-kit">${SITE_URL}/media-kit</a>.</p>
      <p>Questions? Reply to this email.</p>
      <p>— MyMCPTools</p>
    `,
  };
}

export interface ListingStats {
  listingSessions: number;
  listingViews: number;
  clickSessions: number;
  clicks: number;
  categorySessions: number;
}

/** The 30-day click report. Zeros are reported as zeros, not hidden. */
export function reportEmail(input: { name: string; urls: PlacementUrls; paidAt: Date; stats: ListingStats }) {
  const { stats: s } = input;
  const name = escapeHtml(input.name);
  const from = input.paidAt.toISOString().slice(0, 10);
  const to = new Date(input.paidAt.getTime() + REPORT_DAYS * 86_400_000).toISOString().slice(0, 10);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return {
    subject: `${input.name} on MyMCPTools: your 30-day Featured report`,
    html: `
      <h2>${name} — 30 days of Featured (${from} → ${to} UTC)</h2>
      <ul>
        <li><strong>Clicks on your links</strong> (site + repo, from your listing page): ${plural(s.clicks, "click", "clicks")} from ${plural(s.clickSessions, "visitor", "visitors")}</li>
        <li><strong>Listing page views:</strong> ${plural(s.listingViews, "view", "views")} from ${plural(s.listingSessions, "visitor", "visitors")}</li>
        <li><strong>Visitors to your category page${input.urls.categories.length === 1 ? "" : "s"}</strong>, where you sat at the top: ${s.categorySessions}</li>
      </ul>
      <p>Counted by our own cookieless analytics with known bots removed. A "visitor" is one browser on one day. Clicks are recorded when the page's script is running, so a visitor with scripts blocked is not counted.</p>
      <p>Where it showed:</p>
      ${placesHtml(input.urls)}
      <p>Your placement stays live; this is the only report we send. Questions? Reply to this email.</p>
      <p>— MyMCPTools</p>
    `,
  };
}

// ---- warehouse ---------------------------------------------------------------

export type Query = (sql: string, params: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
export type Send = (to: string, subject: string, html: string) => Promise<boolean>;

export const DUE_SQL = `
select stripe_session_id, slug, name, category, contact_email, paid_at
  from analytics.mcpt_paid_listings
 where sku = 'featured'
   and status in ('active', 'fulfilled_static')
   and contact_email is not null
   and paid_at >= $1::timestamptz
   and paid_at <= $2::timestamptz - interval '${REPORT_DAYS} days'
   and not coalesce(raw ? 'report_sent_at', false)
 order by paid_at
 limit 20`;

/** Claim before sending, so two overlapping runs can never mail twice. */
export const CLAIM_SQL = `
update analytics.mcpt_paid_listings
   set raw = coalesce(raw, '{}'::jsonb) || jsonb_build_object('report_sent_at', $2::text)
 where stripe_session_id = $1
   and not coalesce(raw ? 'report_sent_at', false)
returning stripe_session_id`;

/** Release a claim whose send failed; tomorrow's run retries it. */
export const UNCLAIM_SQL = `
update analytics.mcpt_paid_listings set raw = raw - 'report_sent_at' where stripe_session_id = $1`;

export const STATS_SQL = `
select count(distinct session_hash) filter (where path = $1)          as listing_sessions,
       count(*)                     filter (where path = $1)          as listing_views,
       count(distinct session_hash) filter (where path = $2)          as click_sessions,
       count(*)                     filter (where path = $2)          as clicks,
       count(distinct session_hash) filter (where path = any($3::text[])) as category_sessions
  from analytics.events
 where site = 'mymcptools'
   and not is_bot
   and ts >= $4::timestamptz and ts < $5::timestamptz
   and (path = $1 or path = $2 or path = any($3::text[]))`;

export async function listingStats(query: Query, slug: string, categorySlugs: string[], from: Date, to: Date): Promise<ListingStats> {
  const { rows } = await query(STATS_SQL, [
    `/servers/${slug}`,
    outboundEventPath(slug),
    categorySlugs.map((c) => `/category/${c}`),
    from.toISOString(),
    to.toISOString(),
  ]);
  const r = rows[0] ?? {};
  const n = (k: string) => Number(r[k] ?? 0) || 0;
  return {
    listingSessions: n("listing_sessions"),
    listingViews: n("listing_views"),
    clickSessions: n("click_sessions"),
    clicks: n("clicks"),
    categorySessions: n("category_sessions"),
  };
}

export interface ReportRun {
  due: number;
  sent: string[];
  failed: string[];
}

/** One cron pass: find due orders, claim, measure, mail. Never throws per-row. */
export async function runDueReports(deps: {
  query: Query;
  send: Send;
  now: Date;
  catalogCategories: (slug: string) => string[] | undefined;
  categoryNames: ReadonlyMap<string, string>;
}): Promise<ReportRun> {
  const { rows } = await deps.query(DUE_SQL, [REPORT_SINCE, deps.now.toISOString()]);
  const run: ReportRun = { due: rows.length, sent: [], failed: [] };
  for (const row of rows) {
    const id = String(row.stripe_session_id);
    const claimed = await deps.query(CLAIM_SQL, [id, deps.now.toISOString()]);
    if (!claimed.rows.length) continue;
    try {
      const slug = String(row.slug);
      const paidAt = new Date(row.paid_at as string | Date);
      const urls = placementUrls(slug, row.category as string, deps.catalogCategories(slug), deps.categoryNames);
      const stats = await listingStats(
        deps.query,
        slug,
        urls.categories.map((c) => c.slug),
        paidAt,
        new Date(paidAt.getTime() + REPORT_DAYS * 86_400_000)
      );
      const mail = reportEmail({ name: String(row.name), urls, paidAt, stats });
      if (!(await deps.send(String(row.contact_email), mail.subject, mail.html))) throw new Error("send rejected");
      run.sent.push(id);
    } catch (err) {
      console.error("[featured-report] failed", id, err);
      await deps.query(UNCLAIM_SQL, [id]).catch(() => {});
      run.failed.push(id);
    }
  }
  return run;
}
