/**
 * Gate on the /submit conversion instrument (thread #223).
 *
 * WHAT IT PROTECTS. Until 2026-09-24 a completed submission wrote nothing to
 * `analytics.events`. The only evidence a maker had submitted was a Resend ack,
 * which does not join to a session, a landing path or a referrer — so the
 * property's one monetised population was the one population the beacon could
 * not see. Thread #223 measured the damage over the instrument's first 14 days
 * (2026-09-10 13:15 → 2026-09-24 11:40 UTC): 21 acks, only 12 with any
 * `/submit` pageview within ±30 minutes (a CEILING — a time match is not an
 * identity match), and 3 of those 12 written `is_bot = true`.
 *
 * Three classes of regression are checked:
 *   1. WIRING — the success path of /api/submit still calls
 *      recordSubmissionEvent(). Dropping it produces no error, just a silent
 *      return to blindness.
 *   2. WIRE SHAPE — the row still carries the canonical session_hash (the join
 *      key), the agreed path, a non-bot verdict, and no self-referrer. A drift
 *      here does not error either; it just stops joining.
 *   3. LIVE COVERAGE — once deployed, submissions actually produce rows, and
 *      how many of them join to a pageview session. Skipped without
 *      ANALYTICS_DATABASE_URL; only fatal after GRACE_UNTIL.
 *
 * Run: npm run submit:selfcheck
 */
import { readFileSync } from "node:fs";
import { sessionHash } from "../src/lib/session-identity.ts";
import {
  SUBMISSION_EVENT_PATH,
  SUBMISSION_EVENT_REASON,
  SUBMISSION_PROBE_REASON,
  SUBMISSION_SITE,
  isProbeSubmission,
  submissionEventParams,
} from "../src/lib/analytics/submission-event.ts";

const ROUTE = process.env.SUBMIT_ROUTE_PATH || "src/app/api/submit/route.ts";
/** The event ships in the 2026-09-24 batch; allow for the deploy-batch lag. */
const GRACE_UNTIL = "2026-09-28";

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`  ok    ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// ---- 1. wiring -------------------------------------------------------------
console.log(`\n[1] wiring — ${ROUTE}`);
const src = readFileSync(ROUTE, "utf8");
check("imports recordSubmissionEvent", /import\s*\{[^}]*recordSubmissionEvent[^}]*\}\s*from\s*["'][^"']*submission-event["']/.test(src));
check("calls recordSubmissionEvent(", src.includes("recordSubmissionEvent("));

// The call must sit on the success path: after the maker ack, before the 200.
const callAt = src.indexOf("recordSubmissionEvent(req.headers");
const ackAt = src.indexOf("buildConfirmationEmailHtml(toolName");
const okAt = src.indexOf('success: true,\n      message: "Submission received!');
check("call is on the success path (after ack, before the 200)",
  callAt > 0 && ackAt > 0 && okAt > 0 && callAt > ackAt && callAt < okAt,
  `ack@${ackAt} call@${callAt} 200@${okAt}`);
check("the call is awaited (a fire-and-forget promise can be frozen with the lambda)",
  /await\s+recordSubmissionEvent\(/.test(src));

// ---- 2. wire shape ---------------------------------------------------------
console.log("\n[2] wire shape");
const H = new Headers({
  "x-forwarded-for": "203.0.113.7, 10.0.0.1",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) HeadlessChrome/142.0.0.0",
  "x-vercel-ip-country": "SI",
  referer: "https://mymcptools.com/submit",
});
const real = submissionEventParams(H, {
  email: "maker@example.com", toolName: "Example MCP", category: "api", installType: "npx",
});
check("params are produced", Array.isArray(real), String(real?.length));
if (Array.isArray(real)) {
  check("site is fixed server-side", real[0] === SUBMISSION_SITE, String(real[0]));
  check("path is the agreed event path", real[1] === SUBMISSION_EVENT_PATH, String(real[1]));
  check("session_hash equals the canonical derivation (the join key)",
    real[4] === sessionHash(H), String(real[4]));
  check("a real submission is NOT flagged a bot, whatever its UA says",
    real[5] === false, `is_bot=${real[5]}`);
  check("bot_reason marks it a server event", real[6] === SUBMISSION_EVENT_REASON, String(real[6]));
  check("country is carried", real[8] === "SI", String(real[8]));
  check("no self-referrer is written (INSERT pins referrer_host/full to null)",
    !real.includes("https://mymcptools.com/submit") && !real.includes("mymcptools.com"));
}

const probe = submissionEventParams(H, {
  email: "funnel-probe+research@apistatuscheck.com", toolName: "Funnel Probe QA", category: "api", installType: "npx",
});
check("our own probe walk is flagged, so it can never read as demand",
  Array.isArray(probe) && probe[5] === true && probe[6] === SUBMISSION_PROBE_REASON,
  Array.isArray(probe) ? `is_bot=${probe[5]} reason=${probe[6]}` : "no params");
check("probe detection reads the email", isProbeSubmission("funnel-probe+x@apistatuscheck.com", "Real Tool"));
check("probe detection reads the name field", isProbeSubmission("someone@example.com", "Funnel Probe QA"));
check("a real maker is not mistaken for a probe", !isProbeSubmission("maker@example.com", "Example MCP"));

// ---- 3. live coverage ------------------------------------------------------
console.log("\n[3] live coverage");
const cs = process.env.ANALYTICS_DATABASE_URL?.replace(/\\n/g, "").trim();
if (!cs) {
  console.log("  skip  ANALYTICS_DATABASE_URL not set — offline run");
} else {
  const { default: pg } = await import("pg");
  const c = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const { rows } = await c.query(
    `select count(*)::int n,
            count(*) filter (where is_bot = false)::int human,
            max(ts) last_ts
       from analytics.events
      where site = $1 and path = $2`,
    [SUBMISSION_SITE, SUBMISSION_EVENT_PATH]
  );
  const { rows: joined } = await c.query(
    `with ev as (
       select session_hash, ts from analytics.events
        where site = $1 and path = $2 and is_bot = false
     )
     select count(*)::int n,
            count(*) filter (where exists (
              select 1 from analytics.events p
               where p.site = $1 and p.session_hash = ev.session_hash
                 and p.path not like '/_e/%' and p.path not like '/api/%'
            ))::int with_pageview
       from ev`,
    [SUBMISSION_SITE, SUBMISSION_EVENT_PATH]
  );
  await c.end();
  const n = rows[0].n as number;
  const past = new Date().toISOString().slice(0, 10) > GRACE_UNTIL;
  console.log(`  info  ${n} event rows (${rows[0].human} non-bot), last ${rows[0].last_ts ?? "never"}`);
  console.log(`  info  ${joined[0].with_pageview} of ${joined[0].n} non-bot submissions join to a pageview session`);
  check(`submissions are being recorded${past ? "" : ` (advisory until ${GRACE_UNTIL})`}`,
    n > 0 || !past,
    n === 0 ? "0 rows — not deployed yet?" : `${n} rows`);
}

console.log(failures === 0 ? "\nsubmit:selfcheck PASS\n" : `\nsubmit:selfcheck FAIL — ${failures} failing check(s)\n`);
process.exit(failures === 0 ? 0 : 1);
