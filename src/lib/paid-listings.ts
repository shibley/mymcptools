/**
 * Paid listings that are delivered by the machine instead of by a human.
 *
 * WHY THIS EXISTS (thread #218). Every paid SKU on this property used to
 * fulfil by emailing shibley@gmail.com a request to hand-edit
 * `src/data/servers.ts` and redeploy — and `api/webhook/route.ts` stamped
 * `metadata.fulfilled = "true"` on the Stripe session *at email-send time*, so
 * Stripe reported the order fulfilled whether or not anything shipped. Measured
 * on 2026-09-09: `servers.ts` untouched since 2026-08-24, 24 submissions in that
 * window (23 free + 1 paid), 0 listed; the single paid order in the property's
 * lifetime ran 144 hours against a 24-hour promise. The sale was unattended and
 * the delivery was a git commit.
 *
 * The fix is an overlay, not a migration of the catalog: the webhook writes the
 * paid row to `analytics.mcpt_paid_listings` in the shared warehouse (the same
 * Postgres `ANALYTICS_DATABASE_URL` the MCP usage rows already go to), and the
 * render path reads it. `/servers/[slug]` is not prerendered for a slug the
 * static catalog has never seen, so Next renders it on demand; `/category/[slug]`
 * takes `searchParams` and is therefore request-rendered already. Delivery is
 * immediate and needs no deploy.
 *
 * HONESTY RULES BAKED IN, and they are not optional:
 *  - An overlay row is self-reported by the buyer. Nothing here is presented as
 *    verified: `source_verified` and `install_verified` are never set, and
 *    `verification` is always 'unresolved', so the server page's existing
 *    "what we could verify" copy renders instead of the confident one. See
 *    [[project_mymcptools_catalog_urls_fabricated]] — 72% of a batch taken on
 *    trust was fabricated, and a paying customer is not an exception to that.
 *  - A slug already present in `src/data/servers.ts` is dropped from the overlay,
 *    so once a row is promoted into the static catalog it stops rendering twice.
 *  - Every failure is swallowed and returns an empty overlay. A warehouse
 *    outage must degrade to "the catalog as of the last deploy", never to a 500
 *    on 2,457 static pages.
 */
import { Pool } from "pg";
import { servers, type MCPServer } from "@/data/servers";

/** How long a resolved overlay is reused inside one warm lambda. */
const CACHE_MS = 60_000;

let pool: Pool | null = null;
function getPool(): Pool | null {
  // A trailing newline in a pasted secret is a real, previously-shipped failure
  // mode here — see [[project_aisotools_service_role_key_invalid]].
  const cs = process.env.ANALYTICS_DATABASE_URL?.replace(/\\n/g, "").trim();
  if (!cs) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: cs,
      ssl: { rejectUnauthorized: false },
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 5_000,
    });
    pool.on("error", () => {});
  }
  return pool;
}

export interface PaidListingInput {
  stripeSessionId: string;
  /** 'featured' ($9 one-time) or 'sponsored' ($49/$99). */
  sku: "featured" | "sponsored";
  name: string;
  description?: string;
  author?: string;
  githubUrl?: string;
  websiteUrl?: string;
  category?: string;
  installType?: string;
  contactEmail?: string;
  amountCents?: number;
}

const INSTALL_TYPES = new Set<MCPServer["install_type"]>([
  "npm",
  "pip",
  "binary",
  "docker",
  "source",
  "remote",
]);

/**
 * Slug for a buyer-supplied name. Deliberately identical in shape to the slugs
 * already in the catalog (lowercase, hyphenated, ASCII) so a later promotion
 * into `servers.ts` keeps the same URL and no redirect is owed.
 */
export function slugifyListing(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Buyer-supplied URLs are only ever rendered as links if they are http(s). */
function safeUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Records a paid listing. Called from the Stripe webhook *before* it stamps
 * `fulfilled`, so the stamp finally means the thing it claims.
 * Returns the slug on success, null on any failure (the caller still emails).
 */
export async function recordPaidListing(input: PaidListingInput): Promise<string | null> {
  const p = getPool();
  if (!p) return null;
  const slug = slugifyListing(input.name);
  if (!slug) return null;
  try {
    await p.query(
      `INSERT INTO analytics.mcpt_paid_listings
         (stripe_session_id, sku, slug, name, description, author, github_url,
          website_url, category, install_type, contact_email, amount_cents, raw)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (stripe_session_id) DO NOTHING`,
      [
        input.stripeSessionId,
        input.sku,
        slug,
        input.name.slice(0, 200),
        (input.description || "").slice(0, 1000),
        (input.author || input.name).slice(0, 200),
        safeUrl(input.githubUrl) || null,
        safeUrl(input.websiteUrl) || null,
        (input.category || "other").slice(0, 100),
        INSTALL_TYPES.has(input.installType as MCPServer["install_type"])
          ? input.installType
          : "remote",
        input.contactEmail || null,
        input.amountCents ?? null,
        JSON.stringify(input),
      ]
    );
    return slug;
  } catch (err) {
    console.error("[paid-listings] insert failed", err);
    return null;
  }
}

interface Cached {
  at: number;
  rows: MCPServer[];
}
let cache: Cached | null = null;

const STATIC_SLUGS = new Set(servers.map((s) => s.slug));

/**
 * Paid listings not yet promoted into `src/data/servers.ts`, newest first.
 * Never throws; an unreachable warehouse yields `[]`.
 */
export async function getPaidListings(): Promise<MCPServer[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const p = getPool();
  if (!p) return [];
  try {
    const { rows } = await p.query(
      `SELECT slug, name, description, author, github_url, website_url,
              category, install_type, sku
         FROM analytics.mcpt_paid_listings
        WHERE status = 'active'
        ORDER BY paid_at DESC
        LIMIT 200`
    );
    const mapped: MCPServer[] = rows
      .filter((r) => r.slug && !STATIC_SLUGS.has(r.slug))
      .map((r) => ({
        slug: r.slug as string,
        name: r.name as string,
        description: (r.description as string) || "",
        author: (r.author as string) || (r.name as string),
        github_url: (r.github_url as string) || null,
        // Nothing on an overlay row has been checked against GitHub, npm or a
        // live endpoint, and the page must say so rather than imply otherwise.
        verification: "unresolved",
        website_url: (r.website_url as string) || undefined,
        categories: [(r.category as string) || "other"],
        integrations: [],
        install_type: (r.install_type as MCPServer["install_type"]) || "remote",
        featured: true,
        sponsored: r.sku === "sponsored",
      }));
    cache = { at: Date.now(), rows: mapped };
    return mapped;
  } catch (err) {
    console.error("[paid-listings] read failed", err);
    return [];
  }
}

/** One paid listing by slug, or undefined. */
export async function getPaidListingBySlug(slug: string): Promise<MCPServer | undefined> {
  const rows = await getPaidListings();
  return rows.find((r) => r.slug === slug);
}

/** Paid listings in a category, for merging above the static list. */
export async function getPaidListingsByCategory(categorySlug: string): Promise<MCPServer[]> {
  const rows = await getPaidListings();
  return rows.filter((r) => r.categories.includes(categorySlug));
}
