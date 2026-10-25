/**
 * Self-check for STATIC-SIGNAL COVERAGE of the public status API (thread #236).
 *
 * THE DEFECT THIS GUARDS. The v1 API served `CurrentStatus` rows verbatim.
 * Measured 2026-09-22 on the committed store: 2,396 of 2,440 servers are
 * `UNPROBEABLE` — local/stdio packages with no remote endpoint — and each of
 * those rows is all-null. A caller pulling /api/v1/status therefore got a
 * usable signal on 44 rows, 1.8% of the catalog. Meanwhile the repo sweep
 * (PRD P1-3, `npm run static:signals`) already held a last-commit / last-release
 * date for 915 of those same servers, and it was rendered on the HTML listings
 * only. The dataset we sell the *drift* of looked, to a machine, almost empty.
 *
 * This walks the REAL route handlers and fails if:
 *   - the catalog-wide list stops carrying `static_signal`, or its coverage
 *     regresses below the floor measured when this guard was written;
 *   - the per-server endpoint drops the join;
 *   - the `signal=` filter stops selecting the bucket it names, or stops
 *     rejecting a value outside the closed set with a 400;
 *   - `signal_summary` disagrees with the rows actually served;
 *   - the paid CSV export loses its flattened static columns.
 *
 * No network and no warehouse (ANALYTICS_DATABASE_URL is unset here, so the
 * usage recorder no-ops).
 *
 * Run: npm run signals:api-selfcheck
 */
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as statusGET } from '../src/app/api/v1/status/route.ts';
import { GET as serverStatusGET } from '../src/app/api/v1/servers/[slug]/status/route.ts';
import { GET as exportGET } from '../src/app/api/v1/export/route.ts';
import { allStatuses } from '../src/lib/trust/status-store.ts';
import { getStaticSignal } from '../src/lib/trust/static-signals-store.ts';
import { FRESHNESS } from '../src/lib/api/status-view.ts';

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

const MAX = 200; // the endpoint's page cap
function get(qs: string): Promise<Response> {
  return statusGET(new NextRequest(`https://mymcptools.com/api/v1/status${qs}`));
}
async function body(res: Response): Promise<any> {
  return JSON.parse(await res.text());
}

/**
 * Floor, taken from the committed store on 2026-09-22 with a 5% tolerance so a
 * routine re-sweep that moves a handful of servers between buckets does not go
 * red, while losing the join does.
 */
const BASELINE_COVERED = 915;
const FLOOR = Math.floor(BASELINE_COVERED * 0.95);

// Ground truth computed straight off the two stores, independent of the routes.
const expectedCovered = allStatuses().filter((s) => {
  const sig = getStaticSignal(s.slug);
  return Boolean(sig && (sig.last_commit_at || sig.last_release_at));
}).length;

console.log(`static-signal coverage of the status API (catalog ${allStatuses().length})`);

await check('stores hold at least the 2026-09-22 baseline of dated signals', () => {
  assert.ok(
    expectedCovered >= FLOOR,
    `only ${expectedCovered} servers carry a dated static signal; floor is ${FLOOR}. Re-run \`npm run static:signals\`.`
  );
});

await check('/api/v1/status rows carry a static_signal field', async () => {
  const b = await body(await get('?limit=50'));
  assert.ok(Array.isArray(b.statuses) && b.statuses.length > 0, 'no rows returned');
  for (const row of b.statuses) {
    assert.ok(
      'static_signal' in row,
      `row ${row.slug} has no static_signal key — the P1-3 join is not wired into the API`
    );
  }
});

await check('the API reports catalog-wide static-signal coverage', async () => {
  const b = await body(await get('?limit=1'));
  assert.ok(b.signal_summary, 'response carries no signal_summary block');
  assert.equal(
    b.signal_summary.covered,
    expectedCovered,
    'signal_summary.covered disagrees with the stores'
  );
  assert.ok(
    b.signal_summary.covered >= FLOOR,
    `coverage ${b.signal_summary.covered} is below the ${FLOOR} floor`
  );
  assert.equal(
    b.signal_summary.covered + b.signal_summary.uncovered,
    allStatuses().length,
    'covered + uncovered does not add up to the catalog'
  );
});

await check('coverage is overwhelmingly on rows the prober cannot reach', async () => {
  const unprobeableCovered = allStatuses().filter((s) => {
    if (s.verdict !== 'UNPROBEABLE') return false;
    const sig = getStaticSignal(s.slug);
    return Boolean(sig && (sig.last_commit_at || sig.last_release_at));
  }).length;
  // The whole point: these rows were previously served entirely null.
  assert.ok(
    unprobeableCovered >= FLOOR,
    `only ${unprobeableCovered} UNPROBEABLE rows gained a date; floor ${FLOOR}`
  );
});

for (const bucket of FRESHNESS) {
  await check(`signal=${bucket} returns only ${bucket} rows`, async () => {
    const b = await body(await get(`?signal=${bucket}&limit=${MAX}`));
    assert.ok(Array.isArray(b.statuses), 'no rows array');
    for (const row of b.statuses) {
      assert.equal(
        row.static_signal?.freshness,
        bucket,
        `row ${row.slug} is ${row.static_signal?.freshness ?? 'unsignalled'}, not ${bucket}`
      );
    }
  });
}

await check('signal=any selects exactly the covered rows', async () => {
  const b = await body(await get('?signal=any&limit=1'));
  assert.equal(b.pagination.total, expectedCovered);
});

await check('signal=none selects exactly the uncovered rows', async () => {
  const b = await body(await get('?signal=none&limit=1'));
  assert.equal(b.pagination.total, allStatuses().length - expectedCovered);
});

await check('signal_summary is taken before the signal filter', async () => {
  const b = await body(await get('?signal=active&limit=1'));
  assert.equal(
    b.signal_summary.covered,
    expectedCovered,
    'summary collapsed onto the filtered page instead of describing the catalog'
  );
  assert.equal(b.pagination.total, b.signal_summary.active);
});

await check('an unknown signal value is a 400, not a silent full scan', async () => {
  const res = await get('?signal=fresh-ish');
  assert.equal(res.status, 400);
  const b = await body(res);
  assert.equal(b.error, 'bad_request');
});

await check('filter=healthy and signal= compose', async () => {
  const b = await body(await get('?filter=healthy&signal=any&limit=${MAX}'.replace('${MAX}', String(MAX))));
  for (const row of b.statuses) {
    assert.ok(['GOOD', 'WARN'].includes(row.verdict), `${row.slug} is ${row.verdict}`);
    assert.ok(row.static_signal, `${row.slug} slipped through signal=any with no signal`);
  }
});

await check('/api/v1/servers/{slug}/status carries the join', async () => {
  const covered = allStatuses().find((s) => {
    const sig = getStaticSignal(s.slug);
    return Boolean(sig && (sig.last_commit_at || sig.last_release_at));
  });
  assert.ok(covered, 'no covered server to sample');
  const res = await serverStatusGET(
    new NextRequest(`https://mymcptools.com/api/v1/servers/${covered.slug}/status`),
    { params: Promise.resolve({ slug: covered.slug }) }
  );
  const b = await body(res);
  assert.ok(b.status, 'no status body');
  assert.ok(
    b.status.static_signal,
    `${covered.slug} has a dated signal in the store but the endpoint served null`
  );
  assert.ok(
    b.status.static_signal.last_commit_at || b.status.static_signal.last_release_at,
    'served a static_signal with no date'
  );
});

await check('the CSV export flattens the static columns', async () => {
  const res = await exportGET(
    new NextRequest('https://mymcptools.com/api/v1/export?format=csv', {
      headers: { 'x-api-key': 'selfcheck-not-a-real-key' },
    })
  );
  // No key exists in the store, so this is expected to be a 401 — the header
  // shape is still assertable from the module's own column list.
  if (res.status === 200) {
    const header = (await res.text()).split('\r\n')[0];
    for (const col of ['static_freshness', 'static_last_commit_at', 'static_last_release_at']) {
      assert.ok(header.includes(col), `CSV header is missing ${col}`);
    }
  } else {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/app/api/v1/export/route.ts', 'utf8')
    );
    for (const col of ['static_freshness', 'static_last_commit_at', 'static_last_release_at']) {
      assert.ok(src.includes(col), `export route no longer emits ${col}`);
    }
  }
});

console.log(
  `\ncoverage: ${expectedCovered} / ${allStatuses().length} servers carry a dated static signal ` +
    `(was 44 rows with any live signal before the join)`
);
if (failures) {
  console.log(`${failures} CHECK(S) FAILED`);
  process.exit(1);
}
console.log('api signal-coverage selfcheck: the status API serves the repo sweep, not 98% nulls');
