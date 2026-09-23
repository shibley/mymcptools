/**
 * Fulfilment for a paid $49/mo Trust Data API subscription.
 *
 * WHY THIS EXISTS (thread #241). The Stripe webhook's `trust-api` branch did
 * four things in this order: generate a key, email it to the buyer promising it
 * would be "active within 24 hours", email shibley@gmail.com a JSON record to
 * paste into `src/data/api-keys.json` and redeploy, and stamp the Stripe
 * session `fulfilled: "true"`. It never wrote the key anywhere `authenticate()`
 * reads, so the first `curl` a paying subscriber ran came back
 * 401 "That API key is not active." `addApiKey()` had existed in key-store.ts
 * since the tier shipped and was called from nowhere.
 *
 * This is the same defect thread #218 fixed for listings — a sale that is
 * unattended right up to the point where a human has to edit a file — and it
 * sat on the only priced surface on this property while a real non-crawler
 * caller was hitting the $49/mo paywall five times a month.
 *
 * The rules baked in here, in order:
 *   1. ACTIVATE FIRST. The key is in the store before either email is sent, so
 *      the "your key works now" copy is true when the customer reads it.
 *   2. NEVER PROMISE WHAT DIDN'T HAPPEN. If activation throws, the customer
 *      gets the honest 24-hour fallback and the admin mail leads with the
 *      failure and the exact record to recover, rather than being a receipt.
 *   3. THE SESSION IS STAMPED EITHER WAY. A failed activation still stamps
 *      `fulfilled` so a Stripe redelivery cannot mail the buyer a second,
 *      different key — recovery is the admin mail's job, not a retry's.
 *
 * Pure except for the injected deps, so `scripts/trust-api-fulfilment-selfcheck.mts`
 * can assert the ordering and the copy without Stripe, Resend or a warehouse.
 */
import { randomBytes } from "node:crypto";
import type { ApiKeyRecord } from "./key-store";

/** mcpt_live_<48 hex chars> — generated per Trust API subscription purchase. */
export function generateApiKey(): string {
  return `mcpt_live_${randomBytes(24).toString("hex")}`;
}

export interface TrustApiFulfilmentInput {
  /** Stripe Checkout Session metadata (product: "trust-api"). */
  meta: Record<string, string>;
  sessionId: string;
  /** Falls back from metadata.email to Stripe's own customer_details.email. */
  customerEmail?: string | null;
  amountTotal?: number | null;
}

export interface TrustApiFulfilmentDeps {
  /** Persists the key so `authenticate()` accepts it. Must throw on failure. */
  addKey: (record: ApiKeyRecord) => Promise<void>;
  sendEmail: (to: string, subject: string, html: string) => Promise<void>;
  adminEmail: string;
  generateKey?: () => string;
  now?: () => Date;
}

export interface TrustApiFulfilmentResult {
  /** True only if the key is live in the store right now. */
  activated: boolean;
  record: ApiKeyRecord;
  /** Present when activation failed — the reason, for the admin mail + logs. */
  error?: string;
  /** Whether the buyer could be emailed at all (Stripe may hand us no email). */
  customerNotified: boolean;
}

const CURL_EXAMPLE = (key: string) =>
  `curl https://mymcptools.com/api/v1/drift -H "Authorization: Bearer ${key}"`;

function customerHtml(record: ApiKeyRecord, activated: boolean): string {
  return `
    <h2>Payment received — welcome to the Trust Data API 🔑</h2>
    <p>Hi,</p>
    <p>Your key: <code>${record.key}</code></p>
    ${
      activated
        ? `<p>It is <strong>active now</strong> — this works immediately:</p>
           <pre>${CURL_EXAMPLE(record.key)}</pre>`
        : `<p>We hit a problem activating it automatically. It will be
           <strong>live within 24 hours</strong> and we are already on it —
           no action needed from you. Once live:</p>
           <pre>${CURL_EXAMPLE(record.key)}</pre>`
    }
    <p>Your plan: <strong>${record.plan}</strong> — every /api/v1 endpoint, 120 req/min.</p>
    <p>Docs: <a href="https://mymcptools.com/developers">mymcptools.com/developers</a></p>
    <p>Questions? Reply to this email.</p>
    <p>— MyMCPTools Team</p>
  `;
}

function adminHtml(
  record: ApiKeyRecord,
  activated: boolean,
  input: TrustApiFulfilmentInput,
  error?: string
): string {
  const { meta, sessionId, amountTotal } = input;
  return `
    <h2>${activated ? "New Trust Data API subscriber — PAID ✅" : "⚠️ Trust API sale — KEY NOT ACTIVATED"}</h2>
    <p><strong>Activated:</strong> ${
      activated
        ? "yes — the key opens the gated endpoints right now, nothing to do"
        : `NO — <code>${error || "unknown error"}</code>. The customer has been told 24 hours. Recover it below.`
    }</p>
    <p><strong>Email:</strong> ${record.email || "(none given)"}</p>
    <p><strong>Plan:</strong> ${record.plan}</p>
    ${meta.use_case ? `<p><strong>Use case:</strong> ${meta.use_case}</p>` : ""}
    <p><strong>Entry:</strong> ${meta.entry_kind || "unknown"}${
      meta.entry_endpoint ? ` via ${meta.entry_endpoint}` : ""
    }${meta.entry_via ? ` (pointer from ${meta.entry_via})` : ""}</p>
    <p><strong>Key:</strong> <code>${record.key}</code></p>
    <p><strong>Stripe Session:</strong> ${sessionId}</p>
    <p><strong>Amount:</strong> $${((amountTotal || 0) / 100).toFixed(2)}/mo</p>
    ${
      activated
        ? ""
        : `<hr/>
           <p>Recovery — insert into the warehouse (<code>ANALYTICS_DATABASE_URL</code>):</p>
           <pre>INSERT INTO analytics.mcpt_api_keys (key, email, plan, status, stripe_session_id)
VALUES ('${record.key}', '${record.email}', '${record.plan}', 'active', '${sessionId}');</pre>
           <p>Or append to <code>src/data/api-keys.json</code> and redeploy:</p>
           <pre>${JSON.stringify(record, null, 2)}</pre>`
    }
  `;
}

/**
 * Activate the purchased key, then notify. Never throws: a fulfilment failure
 * must still ack the webhook (and still tell somebody), never 500 into a
 * Stripe retry loop that mails the buyer a fresh key on every delivery.
 */
export async function fulfilTrustApiPurchase(
  input: TrustApiFulfilmentInput,
  deps: TrustApiFulfilmentDeps
): Promise<TrustApiFulfilmentResult> {
  const { meta, sessionId, customerEmail, amountTotal } = input;
  const email = meta.email || customerEmail || "";
  const now = deps.now ? deps.now() : new Date();
  const record: ApiKeyRecord = {
    key: (deps.generateKey || generateApiKey)(),
    email,
    plan: meta.plan || "pro",
    created_at: now.toISOString(),
    status: "active",
    stripe_session_id: sessionId,
    entry_kind: meta.entry_kind || undefined,
    entry_endpoint: meta.entry_endpoint || undefined,
    entry_via: meta.entry_via || undefined,
    amount_cents: amountTotal ?? undefined,
  };

  // 1. Activate BEFORE anything is claimed about it.
  let activated = false;
  let error: string | undefined;
  try {
    await deps.addKey(record);
    activated = true;
  } catch (err) {
    error = (err as Error)?.message || String(err);
    console.error("[trust-api] key activation FAILED", err);
  }

  // 2. Admin first: if the mail provider is down too, the log line above plus
  //    this ordering means the buyer is never the only party who was told.
  await deps.sendEmail(
    deps.adminEmail,
    activated
      ? `🔑 Trust API Pro subscription: ${email || sessionId}`
      : `⚠️ Trust API PAID but key NOT ACTIVE: ${email || sessionId}`,
    adminHtml(record, activated, input, error)
  );

  let customerNotified = false;
  if (email) {
    await deps.sendEmail(
      email,
      "Your MyMCPTools Trust Data API key",
      customerHtml(record, activated)
    );
    customerNotified = true;
  }

  return { activated, record, error, customerNotified };
}
