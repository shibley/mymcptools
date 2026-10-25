/**
 * Server-side conversion event for a completed /submit submission (thread #223).
 *
 * WHY THIS EXISTS — the number that forced it. The pageview beacon went live
 * 2026-09-10 and thread #223's first read (14 days, 2026-09-10 13:15 →
 * 2026-09-24 11:40 UTC) asked the question it was built for: where do the
 * ~45.8/month inbound submitters come from? It could not answer, and the
 * arithmetic says why. 21 `We received your submission` acks were sent in the
 * window, but only 12 of them have ANY `/submit` pageview row within ±30
 * minutes — and a ±30-minute time match is not an identity match, so 12/21
 * (57.1%) is a CEILING on coverage and 9/21 (42.9%) is a FLOOR on the miss.
 * Worse, 3 of the 12 that were seen were written `is_bot = true`
 * (`ua:headless` ×2 — both matching the two `info@tomiseregi.si` acks minute
 * for minute from the same country — and `full-chrome-version` ×1), so the
 * standard `is_bot = false` read drops at least 14.3% of real submitters.
 *
 * A client-side beacon cannot fix this: it fires from the page, so it is lost
 * to a blocked script, a killed tab, or a UA heuristic, and every one of those
 * losses lands on the ONE population this property monetises. A submission,
 * by contrast, is a completed server round-trip we already know is real — we
 * mailed an ack for it. So we record it where it cannot be missed.
 *
 * THE JOIN. `session_hash` is derived from the request headers by the one
 * canonical `src/lib/session-identity.ts`, exactly as `/api/collect` does, so
 * this row joins byte-for-byte to the submitter's own pageview rows for the
 * same UTC day. That join — not this row's own fields — is what answers
 * "what path did the submitter arrive on, and from which referrer".
 *
 * `referrer_host` / `referrer_full` are deliberately NULL. The only referrer a
 * POST to /api/submit carries is the /submit page itself, and writing that
 * would put `mymcptools.com` into the referrer mix as if it were an acquisition
 * source. The real referrer lives on the joined pageview row.
 *
 * Marked `bot_reason = 'server-submit'` with `is_bot = false`: these rows are
 * verified-real conversions and must never be dropped by a bot filter. Our own
 * probe walks are the exception — a submission from the canonical probe
 * identity is flagged `internal-probe` so it can never read as demand
 * (globalGuardrails.probeIdentity / probeAnalyticsMarker).
 *
 * Fire-and-forget: every failure is swallowed. Recording a submission must
 * never be able to fail the submission.
 */
import { Pool } from "pg";
import { sessionHash as beaconSessionHash } from "@/lib/session-identity";

export const SUBMISSION_SITE = "mymcptools";

/**
 * The `/_e/<surface>/<action>` convention already used by the other properties'
 * event rows. A non-`/api/` path with a NULL `utm_source` means every existing
 * MCP-demand query (`utm_source = 'mcp'`) stays untouched; `bot_reason` is what
 * separates these from ordinary pageviews.
 */
export const SUBMISSION_EVENT_PATH = "/_e/submit/received";

export const SUBMISSION_EVENT_REASON = "server-submit";
export const SUBMISSION_PROBE_REASON = "internal-probe";

let pool: Pool | null = null;
function getPool(): Pool | null {
  // A trailing newline in a pasted secret is a real, previously-shipped
  // failure mode, so normalise before use.
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

function trunc(v: unknown, n: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, n) : null;
}

/**
 * Our own funnel walks, by the canonical probe identity:
 * `funnel-probe+<slot>@apistatuscheck.com`, or any address/name carrying the
 * word `probe`. A sprint walk is real Chrome with a real Accept-Language and no
 * webdriver flag, so no UA rule can catch it — only the marker we set.
 */
export function isProbeSubmission(email: string | null, toolName: string | null): boolean {
  const hay = `${email ?? ""} ${toolName ?? ""}`.toLowerCase();
  return hay.includes("probe");
}

const INSERT = `
insert into analytics.events
  (site, path, referrer_host, referrer_full, utm_source, utm_medium, utm_campaign,
   session_hash, is_bot, bot_reason, ua, country, screen_w)
values ($1, $2, null, null, null, $3, $4, $5, $6, $7, $8, $9, null)`;

export type SubmissionEventFields = {
  email: string | null;
  toolName: string | null;
  category: string | null;
  installType: string | null;
};

/** Params exactly as they go on the wire. Exported so a selfcheck can assert them. */
export function submissionEventParams(
  h: Headers,
  f: SubmissionEventFields
): unknown[] | null {
  const sessionHash = beaconSessionHash(h);
  if (!sessionHash) return null;
  const probe = isProbeSubmission(f.email, f.toolName);
  return [
    SUBMISSION_SITE,
    SUBMISSION_EVENT_PATH,
    trunc(f.installType, 128),
    trunc(f.category, 128),
    sessionHash,
    probe,
    probe ? SUBMISSION_PROBE_REASON : SUBMISSION_EVENT_REASON,
    trunc(h.get("user-agent"), 512),
    trunc(h.get("x-vercel-ip-country"), 8),
  ];
}

export async function recordSubmissionEvent(
  h: Headers,
  f: SubmissionEventFields
): Promise<void> {
  try {
    const p = getPool();
    if (!p) return;
    const params = submissionEventParams(h, f);
    if (!params) return;
    await p.query(INSERT, params);
  } catch {
    /* never fail a submission over analytics */
  }
}
