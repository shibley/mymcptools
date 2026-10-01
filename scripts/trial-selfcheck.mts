/**
 * Self-check for the KEYLESS GATED TRIAL — the sample a machine buyer can pull
 * before paying.
 *
 * THE DEFECT THIS GUARDS (npm run demand:report, 30d to 2026-09-28):
 *
 *     7 non-crawler callers denied at a key-gated paywall
 *     3 of 7 followed the buy link        (43% — the road works)
 *     4 checkout sessions reached Stripe
 *     0 paid                              <- 100% loss, every time
 *
 * `src/data/api-keys.json` has never held a key, so 100% of traffic to
 * /v1/drift, /v1/export, /v1/digest and /v1/incidents has been a 401 for the
 * entire life of those endpoints, and the free tier deliberately does not
 * overlap them. Every one of those 4 Stripe sessions belonged to someone who
 * had never seen a single row of what they were being asked to buy. Three
 * previous fires improved the ASK; this one makes the thing askable about.
 *
 * WHAT IS ASSERTED, and why each one is a way the feature could silently die:
 *   - the trial is actually SERVED (a keyless 200, real rows from real stores)
 *   - it is CAPPED, and `rows_withheld` agrees with the array serialised
 *   - it cannot be PAGED past the cap (else 3 calls/day walks the whole feed)
 *   - the caller cap and the global cap both bite
 *   - a crawler never gets one, and a bad key never gets one
 *   - the excluded endpoints stay gated
 *   - an unreadable warehouse FAILS CLOSED (no meter, no free bulk export)
 *   - the test seam is refused in production
 *   - the ask rides every trial response and every 401
 *
 * No network: the warehouse counter is replaced by a stub, so nothing here
 * touches Stripe, the DB, or a live MCP server.
 *
 * Run: npm run trial:selfcheck
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import {
  capRows,
  decideTrial,
  isTrialEndpoint,
  trialEndpointsAreGated,
  TRIAL_CALLS_PER_CALLER_PER_DAY,
  TRIAL_ENDPOINTS,
  TRIAL_EXCLUDED,
  TRIAL_GLOBAL_PER_DAY,
  TRIAL_ROW_CAP,
} from '../src/lib/api/trial.ts';
import { __setTrialUsageReaderForTests } from '../src/lib/analytics/trust-api-usage.ts';
import { GET as driftGET } from '../src/app/api/v1/drift/route.ts';
import { GET as exportGET } from '../src/app/api/v1/export/route.ts';
import { GET as digestGET } from '../src/app/api/v1/digest/route.ts';
import { GET as incidentsGET } from '../src/app/api/v1/incidents/route.ts';
import { POST as firewallPOST } from '../src/app/api/v1/firewall/check/route.ts';
import { proPointer } from '../src/lib/api/pro-pointer.ts';
import {
  entryTag,
  readCheckoutEntry,
  stripeEntryMetadata,
} from '../src/lib/api/checkout-entry.ts';
import { fulfilTrustApiPurchase } from '../src/lib/api/trust-api-fulfilment.ts';

let failures = 0;
async function check(name: string, fn: () => unknown | Promise<unknown>) {
  try {
    await fn();
    console.log(`  ok    ${name}`);
  } catch (err) {
    failures += 1;
    console.log(`  FAIL  ${name}\n        ${(err as Error).message.split('\n')[0]}`);
  }
}

const SITE = 'https://mymcptools.com';
const AGENT_UA = 'python-requests/2.32';

function req(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(new URL(path, SITE), {
    headers: { 'user-agent': AGENT_UA, ...headers },
  });
}

/** Pretend the warehouse says this caller has used `caller` trials today. */
function meter(caller: number, global = 0) {
  __setTrialUsageReaderForTests(async () => ({ caller, global }));
}
/** Pretend the warehouse is unreachable. */
function meterDown() {
  __setTrialUsageReaderForTests(async () => null);
}

// ---------------------------------------------------------------- policy ----
console.log('\n=== trial policy ===');
console.log(
  `  row cap ${TRIAL_ROW_CAP} | ${TRIAL_CALLS_PER_CALLER_PER_DAY} calls/caller/day | ` +
    `${TRIAL_GLOBAL_PER_DAY} global/day | endpoints ${TRIAL_ENDPOINTS.length}`
);
for (const e of TRIAL_EXCLUDED) console.log(`  excluded ${e.endpoint} — ${e.why}`);

await check('every trial endpoint is a real gated endpoint', () => {
  assert.equal(trialEndpointsAreGated(), true);
});

await check('the four endpoints on the measured loss path are trialable', () => {
  for (const e of ['/api/v1/drift', '/api/v1/export', '/api/v1/digest', '/api/v1/incidents'])
    assert.equal(isTrialEndpoint(e), true, `${e} is not trialable`);
});

await check('excluded endpoints are not trialable', () => {
  for (const e of TRIAL_EXCLUDED) assert.equal(isTrialEndpoint(e.endpoint), false);
});

await check('decideTrial grants a fresh caller and counts down', () => {
  const d = decideTrial('/api/v1/drift', { caller: 0, global: 0 });
  assert.equal(d.granted, true);
  assert.equal(d.granted && d.grant.rowCap, TRIAL_ROW_CAP);
  assert.equal(d.granted && d.grant.callsRemainingToday, TRIAL_CALLS_PER_CALLER_PER_DAY - 1);
});

await check('decideTrial refuses at the caller cap', () => {
  const d = decideTrial('/api/v1/drift', {
    caller: TRIAL_CALLS_PER_CALLER_PER_DAY,
    global: 0,
  });
  assert.equal(d.granted, false);
  assert.equal(!d.granted && d.reason, 'caller_cap');
});

await check('decideTrial refuses at the global cap', () => {
  const d = decideTrial('/api/v1/drift', { caller: 0, global: TRIAL_GLOBAL_PER_DAY });
  assert.equal(d.granted, false);
  assert.equal(!d.granted && d.reason, 'global_cap');
});

await check('capRows never reports a withheld count its array disagrees with', () => {
  const grant = { endpoint: '/api/v1/drift' as const, rowCap: 3, callsRemainingToday: 0 };
  const out = capRows([1, 2, 3, 4, 5, 6, 7], grant);
  assert.equal(out.rows.length, 3);
  assert.equal(out.withheld, 4);
  assert.equal(out.rows.length + out.withheld, 7);
  const short = capRows([1, 2], grant);
  assert.equal(short.withheld, 0);
  assert.equal(capRows([1, 2, 3], null).withheld, 0);
});

// ------------------------------------------------------------- the served ----
console.log('\n=== a keyless agent is actually served real rows ===');

await check('GET /api/v1/drift with no key returns 200, not 401', async () => {
  meter(0);
  const res = await driftGET(req('/api/v1/drift'));
  assert.equal(res.status, 200, `status ${res.status}`);
  const body = await res.json();
  assert.ok(Array.isArray(body.drift_events), 'no drift_events array');
  assert.equal(res.headers.get('X-RateLimit-Tier'), 'trial');
  assert.equal(res.headers.get('X-MCPTools-Trial'), '1');
});

await check('the drift trial is capped and states what it withheld', async () => {
  meter(0);
  const body = await (await driftGET(req('/api/v1/drift?limit=200'))).json();
  assert.ok(body.trial, 'no trial block');
  assert.ok(body.drift_events.length <= TRIAL_ROW_CAP, 'cap not applied');
  assert.equal(body.trial.rows_returned, body.drift_events.length);
  assert.equal(
    body.trial.rows_returned + body.trial.rows_withheld,
    body.pagination.total,
    'rows_returned + rows_withheld must equal the real total'
  );
});

await check('a trial cannot page past its cap', async () => {
  meter(0);
  const body = await (await driftGET(req('/api/v1/drift?offset=5&limit=200'))).json();
  assert.equal(body.pagination.offset, 0, 'trial honoured a caller offset');
  assert.equal(body.pagination.next_cursor, null, 'trial handed out a cursor');
});

await check('every trial response carries the one-GET buy path', async () => {
  meter(0);
  const res = await driftGET(req('/api/v1/drift'));
  const body = await res.json();
  assert.match(body.trial.full_access.checkout_url, /\/api\/trust-api\/checkout\?/);
  assert.equal(body.trial.full_access.price_usd_month, 49);
  assert.ok(body.trial.full_access.coverage, 'no count-backed coverage table');
  assert.match(res.headers.get('Link') ?? '', /rel="payment"/);
});

await check('/api/v1/incidents serves a capped trial and a full summary', async () => {
  meter(0);
  const res = await incidentsGET(req('/api/v1/incidents?limit=200'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.incidents.length <= TRIAL_ROW_CAP);
  assert.ok(body.summary, 'aggregate summary was truncated away');
  assert.equal(
    body.trial.rows_returned + body.trial.rows_withheld,
    body.pagination.total
  );
});

await check('/api/v1/export JSON caps statuses but keeps the coverage summaries', async () => {
  meter(0);
  const res = await exportGET(req('/api/v1/export?format=json'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.statuses.length <= TRIAL_ROW_CAP, 'bulk export was not capped');
  assert.equal(body.count, body.statuses.length);
  assert.ok(body.total_count > body.count, 'total_count must state the real breadth');
  assert.ok(body.install_summary, 'install_summary truncated — that IS the product');
  assert.equal(body.trial.rows_withheld, body.total_count - body.count);
});

await check('/api/v1/export CSV is capped and says so in headers', async () => {
  meter(0);
  const res = await exportGET(req('/api/v1/export?format=csv'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('X-MCPTools-Trial'), '1');
  assert.equal(res.headers.get('X-MCPTools-Trial-Row-Cap'), String(TRIAL_ROW_CAP));
  const lines = (await res.text()).trim().split('\r\n');
  assert.ok(lines.length - 1 <= TRIAL_ROW_CAP, `${lines.length - 1} CSV data rows`);
  assert.match(res.headers.get('Content-Disposition') ?? '', /-trial\.csv/);
});

await check('/api/v1/digest caps all three buckets, not just the first', async () => {
  meter(0);
  const res = await digestGET(req('/api/v1/digest?window_hours=720'));
  assert.equal(res.status, 200);
  const body = await res.json();
  for (const b of ['newly_dead', 'drifted', 'recovered'])
    assert.ok(body[b].length <= TRIAL_ROW_CAP, `${b} not capped`);
  assert.ok(body.counts, 'full-population counts were truncated away');
});

await check('/api/v1/digest?format=md still advertises the trial in headers', async () => {
  meter(0);
  const res = await digestGET(req('/api/v1/digest?format=md'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('X-MCPTools-Trial'), '1');
  assert.match(res.headers.get('X-MCPTools-Checkout') ?? '', /trust-api\/checkout/);
});

// ------------------------------------------------------------- the refused ----
console.log('\n=== who does NOT get one ===');

await check('a caller at the daily cap gets a trial_exhausted 401 that names the reset', async () => {
  meter(TRIAL_CALLS_PER_CALLER_PER_DAY);
  const res = await driftGET(req('/api/v1/drift'));
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('X-MCPTools-Trial'), 'exhausted');
  const body = await res.json();
  assert.equal(body.error, 'trial_exhausted');
  assert.equal(body.trial.exhausted, true);
  assert.match(body.trial.resets_at, /^\d{4}-\d{2}-\d{2}T00:00:00Z$/);
  assert.match(body.checkout_url, /trust-api\/checkout/);
});

await check('the global daily budget stops new callers', async () => {
  meter(0, TRIAL_GLOBAL_PER_DAY);
  const res = await driftGET(req('/api/v1/drift'));
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error, 'trial_exhausted');
});

await check('a crawler UA never consumes the trial budget', async () => {
  meter(0);
  const res = await driftGET(req('/api/v1/drift', { 'user-agent': 'Googlebot/2.1' }));
  assert.equal(res.status, 401, 'a crawler was served a trial');
  const body = await res.json();
  assert.equal(body.error, 'unauthorized');
});

await check('a bad key is still an error, never silently downgraded to a trial', async () => {
  meter(0);
  const res = await driftGET(req('/api/v1/drift', { authorization: 'Bearer nope' }));
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error, 'unauthorized');
});

await check('every 401 advertises that a keyless trial exists', async () => {
  meter(0);
  const body = await (
    await driftGET(req('/api/v1/drift', { authorization: 'Bearer nope' }))
  ).json();
  assert.equal(body.trial.keyless, true);
  assert.equal(body.trial.row_cap, TRIAL_ROW_CAP);
  assert.deepEqual([...body.trial.endpoints], [...TRIAL_ENDPOINTS]);
});

await check('an excluded endpoint stays fully gated', async () => {
  meter(0);
  const res = await firewallPOST(
    new NextRequest(new URL('/api/v1/firewall/check', SITE), {
      method: 'POST',
      headers: { 'user-agent': AGENT_UA, 'content-type': 'application/json' },
      body: JSON.stringify({ ecosystem: 'npm', packages: ['left-pad'] }),
    })
  );
  assert.equal(res.status, 401, 'firewall/check served a trial');
});

await check('an unreadable warehouse fails CLOSED — no meter, no free bulk export', async () => {
  meterDown();
  const res = await exportGET(req('/api/v1/export?format=json'));
  assert.equal(res.status, 401, 'served an uncapped-risk trial with no meter');
});

await check('a meter we could not read is NOT reported to the caller as exhausted', async () => {
  meterDown();
  const res = await driftGET(req('/api/v1/drift'));
  assert.equal(res.status, 401);
  assert.notEqual(
    res.headers.get('X-MCPTools-Trial'),
    'exhausted',
    'told a caller with an intact budget that they had spent it'
  );
  const body = await res.json();
  assert.equal(body.error, 'unauthorized');
  assert.equal(body.trial.keyless, true, 'the ordinary 401 must still advertise the trial');
});

await check('the test seam is refused in production', () => {
  const prev = process.env.NODE_ENV;
  try {
    (process.env as Record<string, string>).NODE_ENV = 'production';
    assert.throws(() => __setTrialUsageReaderForTests(async () => ({ caller: 0, global: 0 })));
  } finally {
    (process.env as Record<string, string>).NODE_ENV = prev ?? 'test';
  }
});

// ------------------------------------------------------------ discovery ----
console.log('\n=== the free tier tells callers the trial exists ===');

await check('proPointer carries a keyless-trial block', () => {
  const p = proPointer('status') as Record<string, any>;
  assert.equal(p.trial.keyless, true);
  assert.equal(p.trial.row_cap, TRIAL_ROW_CAP);
  assert.ok(Object.keys(p.trial.endpoints).length > 0, 'no trialable URLs pointed at');
  for (const url of Object.values<string>(p.trial.endpoints))
    assert.equal(isTrialEndpoint(new URL(url).pathname), true, `${url} is not trialable`);
});

await check('the per-slug pointer omits the non-trialable history endpoint', () => {
  const p = proPointer('server-status', 'supabase') as Record<string, any>;
  assert.ok(p.endpoints.history, 'history pointer disappeared');
  assert.ok(!('history' in p.trial.endpoints), 'history was advertised as trialable');
});

await check('no pointer note sells "uptime", of which we hold zero rows', () => {
  for (const p of [proPointer('status'), proPointer('server-status', 'supabase')])
    assert.doesNotMatch((p as Record<string, any>).note, /uptime/i);
});

// ------------------------------------------------- the trial's own sale ----
// The trial exists to answer "does seeing the rows sell them?". Until
// 2026-10-01 its buy link was byte-identical to a bare 401's, so a sale it made
// was indistinguishable — in the checkout row and in Stripe — from one it did
// not. These 8 checks were all RED against that build.
console.log('\n=== a trial-made sale is attributable to the trial ===');

const entryOf = (u: string) => readCheckoutEntry(new URL(u));

await check('the trial body\'s buy link says the caller SAW rows', async () => {
  meter(0);
  const body = await (await driftGET(req('/api/v1/drift'))).json();
  const e = entryOf(body.trial.full_access.checkout_url);
  assert.equal(e.trial, 'sampled', `trial=${e.trial}`);
  assert.equal(e.endpoint, '/api/v1/drift');
});

await check('the trial headers carry the same tagged buy link', async () => {
  meter(0);
  const res = await driftGET(req('/api/v1/drift'));
  assert.equal(entryOf(res.headers.get('X-MCPTools-Checkout') ?? '').trial, 'sampled');
  assert.match(res.headers.get('Link') ?? '', /trial=sampled/);
});

await check('the trial_exhausted 401 tags its buy link `exhausted`', async () => {
  meter(TRIAL_CALLS_PER_CALLER_PER_DAY);
  const res = await driftGET(req('/api/v1/drift'));
  const body = await res.json();
  assert.equal(entryOf(body.checkout_url).trial, 'exhausted');
  assert.equal(entryOf(res.headers.get('X-MCPTools-Checkout') ?? '').trial, 'exhausted');
});

await check('a bare 401 (never saw rows) is NOT tagged as a trial', async () => {
  meter(0);
  const body = await (
    await driftGET(req('/api/v1/drift', { authorization: 'Bearer nope' }))
  ).json();
  assert.equal(entryOf(body.checkout_url).trial, null);
  assert.doesNotMatch(body.checkout_url, /trial=/);
});

await check('an unknown ?trial= value is dropped, never stored', () => {
  assert.equal(entryOf('https://x/api/trust-api/checkout?trial=<script>').trial, null);
});

await check('Stripe metadata carries the trial stage to the paid event', () => {
  const e = entryOf('https://x/api/trust-api/checkout?endpoint=/api/v1/drift&trial=sampled');
  assert.equal(stripeEntryMetadata(e).entry_trial, 'sampled');
  assert.equal(e.kind, 'gate', 'trial must not change kind — existing gate meters key on it');
});

await check('entryTag appends the stage; an untagged row keeps the old 4-part shape', () => {
  const t = entryOf('https://x/api/trust-api/checkout?endpoint=/api/v1/drift&trial=exhausted');
  assert.equal(entryTag(t), 'entry:gate:/api/v1/drift:-:trial-exhausted');
  const b = entryOf('https://x/api/trust-api/checkout?endpoint=/api/v1/drift');
  assert.equal(entryTag(b), 'entry:gate:/api/v1/drift:-');
});

await check('a paid key records which trial stage sold it', async () => {
  let stored: Record<string, unknown> | null = null;
  await fulfilTrustApiPurchase(
    {
      meta: { product: 'trust-api', plan: 'pro', entry_kind: 'gate', entry_trial: 'sampled' },
      sessionId: 'cs_test_selfcheck',
      customerEmail: 'funnel-probe+trust-layer@apistatuscheck.com',
      amountTotal: 4900,
    },
    {
      addKey: async (r) => { stored = r as unknown as Record<string, unknown>; },
      sendEmail: async () => {},
      adminEmail: 'funnel-probe+trust-layer@apistatuscheck.com',
    }
  );
  assert.equal(stored?.['entry_trial'], 'sampled');
});

// ------------------------------------------------------------ the wiring ----
console.log('\n=== wiring (a route that forgets the helper serves an uncapped page) ===');

for (const route of ['drift', 'export', 'digest', 'incidents']) {
  await check(`src/app/api/v1/${route}/route.ts reads the trial grant`, () => {
    const src = readFileSync(`src/app/api/v1/${route}/route.ts`, 'utf8');
    assert.match(src, /trialGrant\(auth\)/, 'never calls trialGrant');
    assert.match(src, /withTrialHeaders\(/, 'never advertises the tier it served');
    assert.match(src, /trialPayload\(/, 'never carries the ask');
  });
}

__setTrialUsageReaderForTests(null);
console.log(
  failures === 0
    ? `\nAll checks passed.\n`
    : `\n${failures} check(s) FAILED.\n`
);
process.exit(failures === 0 ? 0 : 1);
