/**
 * Numbers for /media-kit (research-mcpso-vs-mymcptools-2026-10-22, gap #5).
 *
 * Every figure is read live from the first-party beacon warehouse
 * (`analytics.events`, site 'mymcptools') at render time; the page prints
 * the measurement time next to them. Nothing here is a hand-typed number,
 * and when the warehouse can't be read the page says so instead of guessing.
 *
 * Population: browser pageviews only — `/api/*` (MCP + REST callers) and
 * `/_e/*` (server-side events, outbound clicks) are excluded, as is every row
 * the beacon's bot classifier flagged (`is_bot`, analytics-classify.ts).
 * That classifier misses some automation, so these are ceilings, and the page
 * says so.
 */
import { Pool } from "pg";

export interface CategoryCount {
  slug: string;
  sessions: number;
}

export interface MediaKitNumbers {
  measuredAt: string;
  days: number;
  humanSessions: number;
  humanPageviews: number;
  botPageviews: number;
  /** Visitors to /category/<slug> — the pages Featured sits on top of. */
  categoryPageSessions: number;
  topCategoryPages: CategoryCount[];
  /** Visitors to listing pages, grouped by the listing's first category. */
  topListingCategories: CategoryCount[];
  submissions: number;
}

export const MEDIA_KIT_DAYS = 30;

const HUMAN = `site = 'mymcptools' and not is_bot and path not like '/api/%' and path not like '/\\_e/%'
  and ts > now() - ($1 || ' days')::interval`;

const TOTALS_SQL = `
select count(distinct session_hash) filter (where not is_bot)                              as human_sessions,
       count(*)                     filter (where not is_bot)                              as human_pageviews,
       count(*)                     filter (where is_bot)                                  as bot_pageviews,
       count(distinct session_hash) filter (where not is_bot and path like '/category/%') as category_sessions
  from analytics.events
 where site = 'mymcptools' and path not like '/api/%' and path not like '/\\_e/%'
   and ts > now() - ($1 || ' days')::interval`;

const SUBMISSIONS_SQL = `
select count(*) as submissions from analytics.events
 where site = 'mymcptools' and path = '/_e/submit/received' and bot_reason = 'server-submit'
   and ts > now() - ($1 || ' days')::interval`;

const CATEGORY_SQL = `
select split_part(path, '/', 3) as slug, count(distinct session_hash) as sessions
  from analytics.events where ${HUMAN} and path like '/category/%'
 group by 1 order by 2 desc limit 50`;

const LISTING_SQL = `
select split_part(path, '/', 3) as slug, count(distinct session_hash) as sessions
  from analytics.events where ${HUMAN} and path like '/servers/%'
 group by 1`;

/** Group listing-page visitors by each listing's first category, top `n`. */
export function rollUpListings(
  rows: { slug: string; sessions: number }[],
  categoryOf: (slug: string) => string | undefined,
  n = 5
): CategoryCount[] {
  const by = new Map<string, number>();
  for (const r of rows) {
    const c = categoryOf(r.slug);
    if (c) by.set(c, (by.get(c) ?? 0) + r.sessions);
  }
  return [...by].map(([slug, sessions]) => ({ slug, sessions })).sort((a, b) => b.sessions - a.sessions).slice(0, n);
}

let pool: Pool | null = null;

export async function mediaKitNumbers(
  categoryOf: (slug: string) => string | undefined,
  validCategory: (slug: string) => boolean
): Promise<MediaKitNumbers | null> {
  const cs = process.env.ANALYTICS_DATABASE_URL?.replace(/\\n/g, "").trim();
  if (!cs) return null;
  if (!pool) {
    pool = new Pool({ connectionString: cs, ssl: { rejectUnauthorized: false }, max: 1, statement_timeout: 20_000, connectionTimeoutMillis: 5_000 });
    pool.on("error", () => {});
  }
  try {
    const d = String(MEDIA_KIT_DAYS);
    // Sequential: the pool is one connection (pooler does the real pooling),
    // and a queued acquire would trip connectionTimeoutMillis.
    const t = await pool.query(TOTALS_SQL, [d]);
    const sub = await pool.query(SUBMISSIONS_SQL, [d]);
    const c = await pool.query(CATEGORY_SQL, [d]);
    const l = await pool.query(LISTING_SQL, [d]);
    const n = (v: unknown) => Number(v ?? 0) || 0;
    const r = t.rows[0] ?? {};
    return {
      measuredAt: new Date().toISOString(),
      days: MEDIA_KIT_DAYS,
      humanSessions: n(r.human_sessions),
      humanPageviews: n(r.human_pageviews),
      botPageviews: n(r.bot_pageviews),
      categoryPageSessions: n(r.category_sessions),
      topCategoryPages: c.rows
        .map((x) => ({ slug: String(x.slug), sessions: n(x.sessions) }))
        .filter((x) => validCategory(x.slug))
        .slice(0, 5),
      topListingCategories: rollUpListings(
        l.rows.map((x) => ({ slug: String(x.slug), sessions: n(x.sessions) })),
        categoryOf
      ),
      submissions: n(sub.rows[0]?.submissions),
    };
  } catch (err) {
    console.error("[media-kit] read failed", err);
    return null;
  }
}
