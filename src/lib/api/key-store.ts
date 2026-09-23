// Self-serve API key store (PRD P2-1 — Paid DaaS tier).
//
// Keys bought through /api/trust-api/checkout ($49/mo) are generated AND
// activated by the Stripe webhook, backed by `analytics.mcpt_api_keys` in the
// shared warehouse (ANALYTICS_DATABASE_URL — the same rail the MCP usage rows
// and `analytics.mcpt_paid_listings` already run on). No human edits a file,
// no redeploy activates a customer.
//
// WHAT WAS BROKEN (thread #241). `addApiKey()` has existed since 85c4622 and
// was called from nowhere: the webhook minted a key, emailed it to the buyer
// as "active within 24 hours", and asked shibley@gmail.com to paste a JSON
// record into `src/data/api-keys.json` and redeploy. So the property's only
// priced surface sold a credential that was guaranteed 401 on first use. The
// previous backing store was a Vercel Blob that had never been written once,
// which is why this is Postgres now: `put()` needs a provisioned store and a
// BLOB_READ_WRITE_TOKEN nothing in this repo has ever exercised, and a paid
// fulfilment is the wrong place to first find out.
//
// `src/data/api-keys.json` remains as the pre-warehouse seed (hand-issued keys
// committed before any store existed); it is merged in as a fallback so
// nothing already granted stops working, and so an unreachable warehouse
// degrades to "the keys as of the last deploy" rather than locking every
// subscriber out.

import { Pool } from "pg";
import seedKeys from "@/data/api-keys.json";

export interface ApiKeyRecord {
  key: string;
  email: string;
  plan: string;
  created_at: string;
  status: "active" | "revoked";
  /** Stripe Checkout Session that bought it, when it came from a purchase. */
  stripe_session_id?: string;
  /** Which gate/pointer produced the sale (see checkout-entry.ts). */
  entry_kind?: string;
  entry_endpoint?: string;
  entry_via?: string;
  amount_cents?: number;
}

interface KeyStore {
  keys: ApiKeyRecord[];
}

const seed = seedKeys as KeyStore;

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

/**
 * Append a newly-purchased key and persist it immediately (no redeploy needed).
 *
 * THROWS on failure, deliberately: every other warehouse call in this codebase
 * swallows its errors because the fallback (an un-augmented catalog) is
 * harmless, but silently failing here hands a paying customer a dead key and
 * tells them it works. The caller must be able to see that and say so.
 */
export async function addApiKey(record: ApiKeyRecord): Promise<void> {
  const p = getPool();
  if (!p) throw new Error("key-store: ANALYTICS_DATABASE_URL is not configured");
  await p.query(
    `INSERT INTO analytics.mcpt_api_keys
       (key, email, plan, status, stripe_session_id, amount_cents,
        entry_kind, entry_endpoint, entry_via, created_at, raw)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (key) DO NOTHING`,
    [
      record.key,
      record.email || "",
      record.plan || "pro",
      record.status || "active",
      record.stripe_session_id || null,
      record.amount_cents ?? null,
      record.entry_kind || null,
      record.entry_endpoint || null,
      record.entry_via || null,
      record.created_at || new Date().toISOString(),
      JSON.stringify(record),
    ]
  );
}

/** True if `key` is a live, active self-serve key. */
export async function isActiveStoredKey(key: string): Promise<boolean> {
  if (!key) return false;
  if (seed.keys.some((k) => k.key === key && k.status === "active")) return true;
  const p = getPool();
  if (!p) return false;
  try {
    const { rows } = await p.query(
      `SELECT 1 FROM analytics.mcpt_api_keys
        WHERE key = $1 AND status = 'active' LIMIT 1`,
      [key]
    );
    return rows.length > 0;
  } catch (err) {
    console.error("key-store: lookup failed, falling back to seed file:", err);
    return false;
  }
}

/** All key records currently in the store (do not mutate). */
export async function allStoredKeys(): Promise<readonly ApiKeyRecord[]> {
  const p = getPool();
  if (!p) return seed.keys;
  try {
    const { rows } = await p.query(
      `SELECT key, email, plan, status, stripe_session_id, amount_cents,
              entry_kind, entry_endpoint, entry_via, created_at
         FROM analytics.mcpt_api_keys
        ORDER BY created_at DESC
        LIMIT 500`
    );
    const live: ApiKeyRecord[] = rows.map((r) => ({
      key: r.key as string,
      email: (r.email as string) || "",
      plan: (r.plan as string) || "pro",
      status: (r.status as ApiKeyRecord["status"]) || "active",
      stripe_session_id: (r.stripe_session_id as string) || undefined,
      entry_kind: (r.entry_kind as string) || undefined,
      entry_endpoint: (r.entry_endpoint as string) || undefined,
      entry_via: (r.entry_via as string) || undefined,
      amount_cents: (r.amount_cents as number) ?? undefined,
      created_at:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : String(r.created_at),
    }));
    const known = new Set(live.map((k) => k.key));
    return [...live, ...seed.keys.filter((k) => !known.has(k.key))];
  } catch (err) {
    console.error("key-store: list failed, falling back to seed file:", err);
    return seed.keys;
  }
}
