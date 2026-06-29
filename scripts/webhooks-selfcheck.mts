/**
 * Self-check for status/drift webhooks (PRD P1-4 acceptance).
 *
 * Asserts, WITHOUT any real outbound network calls:
 *   (a) a webhook FIRES with the correct payload + a valid HMAC signature when a
 *       server's status flips and when a drift event is recorded;
 *   (b) NO webhook fires on steady state (verdict unchanged);
 *   (c) a failing / timeout target does NOT throw to the caller (graceful
 *       degradation — probing must survive any webhook failure);
 *   (d) subscription scope + event filters are honored;
 *   (e) signing matches verification, and an absent/invalid subscriptions file
 *       yields an empty list (opt-in).
 *
 * Network is exercised against a REAL local http.Server sink (loopback only)
 * for the happy-path HMAC assertion, and stubbed via an injected PostFn for the
 * failure/timeout cases. Exits non-zero on failure.
 *
 * Run: node scripts/webhooks-selfcheck.mts
 */
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHmac } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  dispatchNotices,
  loadSubscriptions,
  signBody,
  sanitizeSubscription,
  matchingSubscriptions,
  type PostFn,
  type StatusChangeNotice,
  type DriftNotice,
} from '../src/lib/trust/webhooks.ts';
import type {
  CurrentStatus,
  DriftEvent,
  WebhookSubscription,
} from '../src/lib/trust/types.ts';

function status(slug: string, verdict: CurrentStatus['verdict']): CurrentStatus {
  return {
    slug,
    verdict,
    tool_count: verdict === 'GOOD' ? 5 : null,
    latency_ms: 120,
    negotiated_protocol_version: '2025-06-18',
    last_seen_good_at: '2026-06-29T00:00:00.000Z',
    checked_at: '2026-06-29T12:00:00.000Z',
    status_changed_at: '2026-06-29T12:00:00.000Z',
  };
}

function driftEvent(slug: string): DriftEvent {
  return {
    type: 'drift',
    slug,
    changed_at: '2026-06-29T12:00:00.000Z',
    schema_changed: true,
    prev_schema_hash: 'aaa',
    schema_hash: 'bbb',
    tool_diff: { added: ['create'], removed: ['list'], changed: ['search'] },
    protocol_version_changed: false,
    prev_protocol_version: null,
    negotiated_protocol_version: '2025-06-18',
  };
}

const SECRET = 'top-secret-key';

// ---------------------------------------------------------------------------
// (a) + (b) Happy path against a REAL local sink: a flip and a drift fire with
//           valid HMAC; a steady-state notice fires nothing.
// ---------------------------------------------------------------------------
interface Received {
  url: string;
  body: string;
  signature: string | undefined;
  event: string | undefined;
}

async function runLocalSinkTest(): Promise<void> {
  const received: Received[] = [];
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => {
      received.push({
        url: req.url ?? '',
        body: Buffer.concat(chunks).toString('utf8'),
        signature: req.headers['x-signature'] as string | undefined,
        event: req.headers['x-webhook-event'] as string | undefined,
      });
      res.statusCode = 200;
      res.end('ok');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no sink address');
  const url = `http://127.0.0.1:${addr.port}/hook`;

  try {
    const subs: WebhookSubscription[] = [
      { id: 'sink', url, secret: SECRET, events: 'both', scope: 'all', enabled: true },
    ];

    // A real flip GOOD -> DOWN, and a drift event. Plus a steady-state notice
    // (DOWN -> DOWN) that must NOT fire.
    const statusChanges: StatusChangeNotice[] = [
      { status: status('flipper', 'DOWN'), old_verdict: 'GOOD', name: 'Flipper' },
      { status: status('steady', 'DOWN'), old_verdict: 'DOWN', name: 'Steady' }, // no-op
    ];
    const drifts: DriftNotice[] = [
      { drift: driftEvent('drifter'), current_status: status('drifter', 'GOOD'), name: 'Drifter' },
    ];

    const results = await dispatchNotices(subs, statusChanges, drifts);

    // Exactly 2 deliveries: the flip + the drift. Steady state fired nothing.
    assert.equal(results.length, 2, 'exactly two deliveries (flip + drift), none for steady state');
    assert.ok(results.every((r) => r.ok), 'both deliveries succeeded against local sink');
    assert.equal(received.length, 2, 'sink received exactly two POSTs');

    const bySlug = new Map(received.map((r) => [JSON.parse(r.body).slug as string, r]));
    assert.ok(bySlug.has('flipper'), 'flip delivered');
    assert.ok(bySlug.has('drifter'), 'drift delivered');
    assert.ok(!bySlug.has('steady'), 'steady-state server NOT delivered');

    // (a) payload correctness + valid HMAC for the status change.
    const flip = bySlug.get('flipper')!;
    const flipPayload = JSON.parse(flip.body);
    assert.equal(flipPayload.event, 'status_change');
    assert.equal(flip.event, 'status_change', 'X-Webhook-Event header set');
    assert.equal(flipPayload.old_verdict, 'GOOD');
    assert.equal(flipPayload.new_verdict, 'DOWN');
    assert.equal(flipPayload.name, 'Flipper');
    assert.ok(flipPayload.current_status, 'current_status snapshot included');
    assert.equal(flipPayload.current_status.slug, 'flipper');
    // Recompute the HMAC over the RAW body the sink received.
    const expectedSig = 'sha256=' + createHmac('sha256', SECRET).update(flip.body).digest('hex');
    assert.equal(flip.signature, expectedSig, 'valid HMAC-SHA256 signature on status change');
    assert.equal(signBody(flip.body, SECRET), expectedSig, 'signBody matches manual HMAC');

    // (a) payload correctness + valid HMAC for the drift.
    const drift = bySlug.get('drifter')!;
    const driftPayload = JSON.parse(drift.body);
    assert.equal(driftPayload.event, 'drift');
    assert.equal(driftPayload.schema_changed, true);
    assert.deepEqual(driftPayload.tool_diff, { added: ['create'], removed: ['list'], changed: ['search'] });
    const expectedDriftSig = 'sha256=' + createHmac('sha256', SECRET).update(drift.body).digest('hex');
    assert.equal(drift.signature, expectedDriftSig, 'valid HMAC-SHA256 signature on drift');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

// ---------------------------------------------------------------------------
// (b) Steady state in isolation: nothing fires.
// ---------------------------------------------------------------------------
async function runSteadyStateTest(): Promise<void> {
  let posted = 0;
  const post: PostFn = async () => {
    posted++;
    return { status: 200 };
  };
  const subs: WebhookSubscription[] = [
    { id: 's', url: 'http://127.0.0.1:1/hook', secret: SECRET, events: 'both', scope: 'all', enabled: true },
  ];
  const results = await dispatchNotices(
    subs,
    [{ status: status('x', 'GOOD'), old_verdict: 'GOOD' }], // unchanged
    [],
    { post },
  );
  assert.equal(results.length, 0, 'no deliveries on steady state');
  assert.equal(posted, 0, 'no POST attempted on steady state');
}

// ---------------------------------------------------------------------------
// (c) Failing + timeout targets must NOT throw to the caller.
// ---------------------------------------------------------------------------
async function runFailureIsolationTest(): Promise<void> {
  const subs: WebhookSubscription[] = [
    { id: 'boom', url: 'http://127.0.0.1:1/hook', secret: SECRET, events: 'both', scope: 'all', enabled: true },
  ];

  // (c1) Network error every attempt — must resolve with ok:false, not throw.
  let attempts = 0;
  const throwingPost: PostFn = async () => {
    attempts++;
    throw new Error('ECONNREFUSED');
  };
  let results = await dispatchNotices(
    subs,
    [{ status: status('dead', 'DOWN'), old_verdict: 'GOOD' }],
    [],
    { post: throwingPost, backoffMs: 1, maxRetries: 2 },
  );
  assert.equal(results.length, 1);
  assert.equal(results[0].ok, false, 'network failure reported as not-ok (did not throw)');
  assert.equal(results[0].attempts, 3, 'retried initial + 2 retries on network error');
  assert.equal(attempts, 3, 'post invoked for each attempt');

  // (c2) Timeout — simulated as a rejected promise; still no throw to caller.
  const timeoutPost: PostFn = async (_u, _b, _h, timeoutMs) => {
    throw new Error(`aborted after ${timeoutMs}ms`);
  };
  results = await dispatchNotices(
    subs,
    [{ status: status('slow', 'DOWN'), old_verdict: 'GOOD' }],
    [],
    { post: timeoutPost, backoffMs: 1 },
  );
  assert.equal(results[0].ok, false, 'timeout reported as not-ok');
  assert.ok((results[0].error ?? '').includes('aborted'), 'timeout error surfaced in result');

  // (c3) 5xx is retried; 4xx is not.
  let fiveHundredAttempts = 0;
  const fiveHundredPost: PostFn = async () => {
    fiveHundredAttempts++;
    return { status: 503 };
  };
  results = await dispatchNotices(
    subs,
    [{ status: status('err5', 'DOWN'), old_verdict: 'GOOD' }],
    [],
    { post: fiveHundredPost, backoffMs: 1, maxRetries: 2 },
  );
  assert.equal(results[0].ok, false);
  assert.equal(fiveHundredAttempts, 3, '5xx retried full budget');

  let fourHundredAttempts = 0;
  const fourHundredPost: PostFn = async () => {
    fourHundredAttempts++;
    return { status: 400 };
  };
  results = await dispatchNotices(
    subs,
    [{ status: status('err4', 'DOWN'), old_verdict: 'GOOD' }],
    [],
    { post: fourHundredPost, backoffMs: 1, maxRetries: 2 },
  );
  assert.equal(results[0].ok, false);
  assert.equal(fourHundredAttempts, 1, '4xx NOT retried (payload rejected)');

  // The whole pipeline must survive even when dispatch is handed garbage.
  const survived = await dispatchNotices(
    subs,
    [{ status: status('z', 'DOWN'), old_verdict: 'GOOD' }],
    [],
    {
      post: (() => {
        throw new Error('synchronous explosion');
      }) as unknown as PostFn,
      backoffMs: 1,
    },
  );
  assert.ok(Array.isArray(survived), 'dispatch returns an array even when post explodes');
  assert.equal(survived[0].ok, false, 'synchronous post failure isolated');
}

// ---------------------------------------------------------------------------
// (d) Scope + event-filter matching.
// ---------------------------------------------------------------------------
function runMatchingTest(): void {
  const subs: WebhookSubscription[] = [
    { id: 'all-both', url: 'http://x/1', events: 'both', scope: 'all' },
    { id: 'status-only', url: 'http://x/2', events: 'status_change', scope: 'all' },
    { id: 'drift-only', url: 'http://x/3', events: 'drift', scope: 'all' },
    { id: 'scoped', url: 'http://x/4', events: 'both', scope: ['alpha'] },
  ];

  const statusForAlpha = matchingSubscriptions(subs, 'status_change', 'alpha').map((s) => s.id);
  assert.deepEqual(statusForAlpha.sort(), ['all-both', 'scoped', 'status-only']);

  const driftForBeta = matchingSubscriptions(subs, 'drift', 'beta').map((s) => s.id);
  // 'scoped' excluded (beta not in scope); 'status-only' excluded (wrong event).
  assert.deepEqual(driftForBeta.sort(), ['all-both', 'drift-only']);

  const statusForBeta = matchingSubscriptions(subs, 'status_change', 'beta').map((s) => s.id);
  assert.deepEqual(statusForBeta.sort(), ['all-both', 'status-only']);
}

// ---------------------------------------------------------------------------
// (e) Subscription loading/sanitization + opt-in behavior.
// ---------------------------------------------------------------------------
function runLoadingTest(): void {
  // Absent file -> empty list, never throws.
  assert.deepEqual(loadSubscriptions('/no/such/file-xyz.json'), [], 'absent file => empty list');

  const dir = mkdtempSync(join(tmpdir(), 'webhooks-selfcheck-'));
  try {
    // Invalid JSON -> empty list.
    const badPath = join(dir, 'bad.json');
    writeFileSync(badPath, '{ not json');
    assert.deepEqual(loadSubscriptions(badPath), [], 'invalid JSON => empty list');

    // Non-array -> empty list.
    const objPath = join(dir, 'obj.json');
    writeFileSync(objPath, '{"id":"x"}');
    assert.deepEqual(loadSubscriptions(objPath), [], 'non-array => empty list');

    // Mixed valid/invalid entries -> only the valid, http(s), enabled ones.
    const mixedPath = join(dir, 'mixed.json');
    writeFileSync(
      mixedPath,
      JSON.stringify([
        { id: 'good', url: 'https://example.com/hook', secret: 's' },
        { id: 'disabled', url: 'https://example.com/hook', enabled: false },
        { id: 'bad-scheme', url: 'file:///etc/passwd' },
        { id: 'no-url' },
        { url: 'https://example.com/no-id' },
        'garbage',
      ]),
    );
    const loaded = loadSubscriptions(mixedPath);
    assert.equal(loaded.length, 1, 'only the single valid subscription is kept');
    assert.equal(loaded[0].id, 'good');
    assert.equal(loaded[0].events, 'both', 'default event filter is both');
    assert.equal(loaded[0].scope, 'all', 'default scope is all');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  // sanitizeSubscription unit checks.
  assert.equal(sanitizeSubscription(null), null);
  assert.equal(sanitizeSubscription({ id: 'x', url: 'ftp://x' }), null, 'non-http(s) rejected');
  assert.equal(sanitizeSubscription({ id: 'x', url: 'not a url' }), null, 'unparseable url rejected');
  const ok = sanitizeSubscription({ id: 'x', url: 'http://x/hook', events: 'drift' });
  assert.ok(ok && ok.events === 'drift');

  // Opt-in: no subscriptions => no-op, no throw.
  // (covered by dispatchNotices early-return; assert it returns [].)
}

async function main(): Promise<void> {
  await runLocalSinkTest();
  await runSteadyStateTest();
  await runFailureIsolationTest();
  runMatchingTest();
  runLoadingTest();

  // Opt-in no-op.
  const noop = await dispatchNotices(
    [],
    [{ status: status('x', 'DOWN'), old_verdict: 'GOOD' }],
    [{ drift: driftEvent('y') }],
  );
  assert.deepEqual(noop, [], 'no subscriptions => no dispatch (opt-in)');

  console.log('[webhooks-selfcheck] OK — all assertions passed');
}

main().catch((e) => {
  console.error('[webhooks-selfcheck] FAILED:', e);
  process.exit(1);
});
