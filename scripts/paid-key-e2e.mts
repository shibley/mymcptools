/**
 * PAID KEY, END TO END, AGAINST PRODUCTION.  `npm run key:e2e`
 *
 * 0 Trust API keys have ever been issued, so "a buyer who pays gets a key that
 * works" has never once been observed — fulfil:selfcheck proves the ordering
 * with stubbed deps, not that the real store and the deployed auth agree.
 *
 * This walks the post-payment half for real:
 *   1. fulfilTrustApiPurchase() with the REAL addApiKey -> analytics.mcpt_api_keys
 *      (mail stubbed: neither the buyer nor admin mail is sent for a probe)
 *   2. isActiveStoredKey() reads it back from the same warehouse
 *   3. the DEPLOYED site (BASE, default https://mymcptools.com) is called on a
 *      key-gated endpoint with that key and must answer 200 untruncated, while
 *      the same request without the key must not
 *   4. the key row is DELETED in `finally`, so a probe never counts as a sale
 *
 * The Stripe card step itself cannot be walked without paying; the webhook's
 * routing of a completed trust-api session into step 1 is webhooks:selfcheck.
 * Probe identity per globalGuardrails.probeIdentity; every request carries
 * X-Probe: 1 so the rows land as internal-probe.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
if (!process.env.ANALYTICS_DATABASE_URL) {
  for (const rel of ["../../.credentials.env", "../.credentials.env"]) {
    try {
      const m = readFileSync(join(here, rel), "utf8").match(/^ANALYTICS_DATABASE_URL=(.*)$/m);
      if (m) {
        process.env.ANALYTICS_DATABASE_URL = m[1].replace(/^"|"$/g, "").trim();
        break;
      }
    } catch {}
  }
}

const { fulfilTrustApiPurchase } = await import("../src/lib/api/trust-api-fulfilment.ts");
const { addApiKey, isActiveStoredKey } = await import("../src/lib/api/key-store.ts");
const { Pool } = (await import("pg")).default;

const BASE = (process.env.BASE || "https://mymcptools.com").replace(/\/$/, "");
const ENDPOINT = "/api/v1/drift";
const PROBE_EMAIL = "funnel-probe+mcptools-trust-layer@apistatuscheck.com";
const sessionId = `cs_probe_e2e_${Date.now()}`;

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failed++;
}

async function get(key: string | null) {
  const headers: Record<string, string> = { "x-probe": "1", "user-agent": "Funnel-Probe-QA/1.0 key-e2e" };
  if (key) headers["x-api-key"] = key;
  const res = await fetch(`${BASE}${ENDPOINT}?probe=1`, { headers });
  let body: any = null;
  try {
    body = await res.json();
  } catch {}
  return { status: res.status, tier: res.headers.get("x-ratelimit-tier"), body };
}

const mail: string[] = [];
let key = "";
const pool = new Pool({
  connectionString: process.env.ANALYTICS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});
try {
  const result = await fulfilTrustApiPurchase(
    {
      meta: { product: "trust-api", plan: "pro", email: PROBE_EMAIL, entry_kind: "gate", entry_endpoint: ENDPOINT, entry_trial: "sampled" },
      sessionId,
      customerEmail: PROBE_EMAIL,
      amountTotal: 4900,
    } as any,
    {
      addKey: addApiKey,
      sendEmail: async (to: string, subject: string) => {
        mail.push(`${to}: ${subject}`);
      },
      adminEmail: "funnel-probe+admin@apistatuscheck.com",
    } as any
  );
  key = (result as any).key ?? (result as any).record?.key ?? "";
  if (!key) {
    const { rows } = await pool.query(`select key from analytics.mcpt_api_keys where stripe_session_id = $1`, [sessionId]);
    key = rows[0]?.key ?? "";
  }
  check("fulfilment activated the key in the warehouse", !!key && (result as any).activated !== false, sessionId);
  check("buyer + admin were told it is active", mail.length >= 2 && !mail.some((m) => m.includes("NOT ACTIVE")), mail.join(" | "));
  check("isActiveStoredKey reads it back", await isActiveStoredKey(key));

  const { rows } = await pool.query(`select raw->>'entry_trial' as t from analytics.mcpt_api_keys where key = $1`, [key]);
  check("trial stage survives onto the paid key", rows[0]?.t === "sampled", `entry_trial=${rows[0]?.t}`);

  const paid = await get(key);
  const keyless = await get(null);
  const rowsOf = (b: any) => (Array.isArray(b?.events) ? b.events.length : Array.isArray(b?.data) ? b.data.length : null);
  check(
    `deployed ${ENDPOINT} accepts the key`,
    paid.status === 200 && paid.tier !== "trial" && !paid.body?.trial,
    `status=${paid.status} tier=${paid.tier} rows=${rowsOf(paid.body)} withheld=${paid.body?.trial?.rows_withheld ?? "-"}`
  );
  check(
    `same request without the key is NOT the paid answer`,
    keyless.status !== 200 || keyless.tier === "trial" || !!keyless.body?.trial,
    `status=${keyless.status} tier=${keyless.tier}`
  );
} finally {
  if (key || sessionId) {
    const del = await pool.query(`delete from analytics.mcpt_api_keys where stripe_session_id = $1`, [sessionId]);
    console.log(`cleanup: deleted ${del.rowCount} probe key row(s)`);
  }
  await pool.end();
}
console.log(failed ? `\n${failed} check(s) FAILED` : `\nALL PASS — a paid key issued by fulfilment opens the deployed paid tier`);
process.exit(failed ? 1 : 0);
