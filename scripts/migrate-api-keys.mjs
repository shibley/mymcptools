/**
 * Creates `analytics.mcpt_api_keys` — the durable store that turns a paid
 * $49/mo Trust Data API subscription into a key that actually opens the gate.
 *
 * WHY: the Stripe webhook's `trust-api` branch generated a key, emailed it to
 * the customer as "active within 24 hours", and emailed shibley@gmail.com a
 * JSON blob to paste into `src/data/api-keys.json` and redeploy. It never
 * activated anything: `addApiKey()` existed in `src/lib/api/key-store.ts` and
 * was called from nowhere, so the very first `curl` a paying subscriber ran
 * would have come back 401 "That API key is not active." The one priced
 * surface on this property was unfulfillable by construction — same failure
 * class as thread #218's listings, one SKU later.
 *
 * Why Postgres and not the Vercel Blob the old store used: the blob store was
 * never written to once (no key has ever been issued), so it is unproven, and
 * `put()` needs a provisioned store + BLOB_READ_WRITE_TOKEN that nothing here
 * has ever exercised. `ANALYTICS_DATABASE_URL` is the rail the MCP usage rows
 * and `analytics.mcpt_paid_listings` already run on in production.
 *
 * Run:  node scripts/migrate-api-keys.mjs
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

CREATE TABLE IF NOT EXISTS analytics.mcpt_api_keys (
  id                bigserial PRIMARY KEY,
  key               text NOT NULL UNIQUE,
  email             text NOT NULL DEFAULT '',
  plan              text NOT NULL DEFAULT 'pro',
  -- 'active'  -> opens the gated /api/v1 endpoints
  -- 'revoked' -> refunded or cancelled; auth treats it as an unknown key
  status            text NOT NULL DEFAULT 'active',
  stripe_session_id text UNIQUE,
  stripe_customer   text,
  amount_cents      integer,
  entry_kind        text,
  entry_endpoint    text,
  entry_via         text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  revoked_at        timestamptz,
  raw               jsonb
);

CREATE INDEX IF NOT EXISTS mcpt_api_keys_status_idx ON analytics.mcpt_api_keys (status);
`;

const client = await pool.connect();
try {
  await client.query(DDL);
  const { rows } = await client.query(
    "SELECT status, count(*)::int AS n FROM analytics.mcpt_api_keys GROUP BY status ORDER BY status"
  );
  console.log("analytics.mcpt_api_keys ready:", rows.length ? rows : "(empty)");
} finally {
  client.release();
  await pool.end();
}
