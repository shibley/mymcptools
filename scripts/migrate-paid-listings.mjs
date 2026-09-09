/**
 * Creates `analytics.mcpt_paid_listings` — the durable store that turns a paid
 * mymcptools listing into a delivered one without a human editing
 * `src/data/servers.ts`.
 *
 * WHY: thread #218. Every paid SKU on this property fulfilled by emailing a
 * human a request to hand-edit a TypeScript file and redeploy, while stamping
 * `metadata.fulfilled = "true"` on the Stripe session AT EMAIL-SEND TIME. The
 * measured result: `servers.ts` untouched 2026-08-24 -> 2026-09-09, 24
 * submissions in that window (23 free + 1 paid), 0 listed. The one paid order
 * ran 144h against a 24h promise.
 *
 * This table is written by `src/app/api/webhook/route.ts` at payment and read
 * at render time by `src/lib/paid-listings.ts`. No schema migration of any
 * existing table; nothing else in the warehouse is touched.
 *
 * Run:  node scripts/migrate-paid-listings.mjs
 * Needs ANALYTICS_DATABASE_URL (same warehouse the MCP usage rows go to).
 */
import { Pool } from "pg";

const cs = process.env.ANALYTICS_DATABASE_URL?.replace(/\\n/g, "").trim();
if (!cs) {
  console.error("ANALYTICS_DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: cs, ssl: { rejectUnauthorized: false }, max: 1 });

const DDL = `
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.mcpt_paid_listings (
  id                bigserial PRIMARY KEY,
  stripe_session_id text NOT NULL UNIQUE,
  sku               text NOT NULL,
  slug              text NOT NULL,
  name              text NOT NULL,
  description       text NOT NULL DEFAULT '',
  author            text NOT NULL DEFAULT '',
  github_url        text,
  website_url       text,
  category          text NOT NULL DEFAULT 'other',
  install_type      text NOT NULL DEFAULT 'remote',
  install_command   text,
  contact_email     text,
  amount_cents      integer,
  -- 'active'           -> render from this table
  -- 'fulfilled_static' -> already present in src/data/servers.ts, do not render twice
  -- 'refunded'         -> stop rendering
  status            text NOT NULL DEFAULT 'active',
  paid_at           timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  raw               jsonb
);

CREATE INDEX IF NOT EXISTS mcpt_paid_listings_status_idx ON analytics.mcpt_paid_listings (status);
CREATE INDEX IF NOT EXISTS mcpt_paid_listings_slug_idx   ON analytics.mcpt_paid_listings (slug);
`;

/**
 * The only real paid order this property has ever taken (thread #215):
 * cs_live_a1VouZA5aEV..., $9 Featured, info@coinrule.com, paid 2026-09-03.
 * It was hand-listed in `servers.ts` by commit 2ee7602 six days late, so it is
 * recorded here as `fulfilled_static` — bookkeeping, not a second render.
 */
const BACKFILL = `
INSERT INTO analytics.mcpt_paid_listings
  (stripe_session_id, sku, slug, name, description, author, github_url, website_url,
   category, install_type, contact_email, amount_cents, status, paid_at)
VALUES
  ('cs_live_a1VouZA5aEV', 'featured', 'coinrule', 'Coinrule',
   'automated crypto trading rules over a hosted MCP endpoint',
   'Coinrule', 'https://github.com/coinrule-com/coinrule-mcp-ai-trading',
   'https://coinrule.com', 'finance', 'remote', 'info@coinrule.com', 900,
   'fulfilled_static', '2026-09-03T10:22:28Z')
ON CONFLICT (stripe_session_id) DO NOTHING;
`;

const client = await pool.connect();
try {
  await client.query(DDL);
  await client.query(BACKFILL);
  const { rows } = await client.query(
    "SELECT status, count(*)::int AS n FROM analytics.mcpt_paid_listings GROUP BY status ORDER BY status"
  );
  console.log("analytics.mcpt_paid_listings ready:", rows.length ? rows : "(empty)");
} finally {
  client.release();
  await pool.end();
}
