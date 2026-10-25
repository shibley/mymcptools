/**
 * Self-check for the $49/mo PRO OFFER COPY — the last screen a buyer sees.
 *
 * THE DEFECT THIS GUARDS. Paid checkout on this property was reached 4 times in
 * the 30 days to 2026-09-27 and paid 0 times, from 6 non-crawler callers who hit
 * a 401 (3 of 6 went on to start checkout — the ROAD works). What they arrived
 * at was a Stripe order summary hard-coded in the checkout route promising
 * "live status, uptime, latency, and drift for every probed MCP server".
 *
 * Measured against the committed stores the same day, over 2,440 servers:
 * uptime 0 rows, live status 44, latency 44, drift 4 slugs — and the two facts
 * it never mentioned, install verification (1,233) and repo freshness (915),
 * are 28x and 21x wider. The free tier serves /api/v1/status to anyone, so 16
 * keyless callers had already SEEN those nulls before being quoted $49 for them.
 *
 * The three rules below are the fix, and they are structural rather than
 * editorial — copy is generated from row counts in src/lib/api/pro-offer.ts:
 *
 *   1. ZERO ROWS, ZERO MENTIONS. A capability no store populates may not appear
 *      in buyer-facing copy. This is exactly what "uptime" was.
 *   2. BREADTH IS A NUMBER. Every capability named carries its own row count,
 *      so a thin one cannot be read as catalog-wide.
 *   3. NO UNBOUNDED CLAIM. "every ... server" and friends are banned outright.
 *
 * Plus the wiring, which is the half that actually reaches a buyer: the Stripe
 * session, the 401/429 upgrade body and /developers must all read the generated
 * copy, and `?probe=1` must report the real order summary so the surface can be
 * read in production without minting a cart.
 *
 * No network: ?probe=1 touches neither Stripe nor the warehouse.
 *
 * Run: npm run offer:selfcheck
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import {
  MIN_HEADLINE_ROWS,
  proCapabilities,
  proCapability,
  proCoverageBlock,
  proPopulation,
  proProductDescription,
  proProductName,
  sellableCapabilities,
  suppressedCapabilities,
} from '../src/lib/api/pro-offer.ts';
import { GET as checkoutGET } from '../src/app/api/trust-api/checkout/route.ts';
import { GET as driftGET } from '../src/app/api/v1/drift/route.ts';

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

/** Words that read as a catalog-wide promise with no number behind them. */
const UNBOUNDED = [
  /every\s+(probed\s+)?(MCP\s+)?server/i,
  /all\s+(MCP\s+)?servers\b/i,
  /\bcomplete coverage\b/i,
  /\bfull coverage\b/i,
];

console.log('\n=== pro offer: measured coverage ===');
for (const c of proCapabilities()) {
  console.log(
    `  ${c.id.padEnd(15)} rows=${String(c.rows).padStart(5)} / ${c.population}` +
      `  mentionable=${c.mentionable} headline=${c.headline}`
  );
}
console.log(`\n  order summary now reads:\n    ${proProductDescription()}\n`);

console.log('=== 1. the copy is grounded in the stores ===');

await check('population is the deduped catalog, not zero', () => {
  assert.ok(proPopulation() > 2000, `population ${proPopulation()}`);
});

await check('every capability is classified against the row floor', () => {
  for (const c of proCapabilities()) {
    assert.equal(c.mentionable, c.rows > 0, `${c.id} mentionable`);
    assert.equal(c.headline, c.rows >= MIN_HEADLINE_ROWS, `${c.id} headline`);
  }
});

await check('uptime holds zero rows and is therefore unsellable', () => {
  const u = proCapability('uptime');
  assert.ok(u, 'uptime capability missing');
  assert.equal(u!.rows, 0, 'uptime rows');
  assert.equal(u!.mentionable, false, 'uptime must not be mentionable');
  assert.ok(
    suppressedCapabilities().some((c) => c.id === 'uptime'),
    'uptime must be listed as suppressed'
  );
});

await check('install verification is the widest thing we hold', () => {
  const widest = sellableCapabilities()[0];
  assert.equal(widest.id, 'install_signal', `widest was ${widest.id}`);
  assert.ok(widest.rows > 1000, `install rows ${widest.rows}`);
});

console.log('\n=== 2. rule 1 — zero rows, zero mentions ===');

await check('no suppressed capability is named in the order summary', () => {
  const desc = proProductDescription().toLowerCase();
  for (const c of suppressedCapabilities()) {
    assert.ok(
      !desc.includes(c.id.replace('_', ' ')) && !desc.includes(c.id),
      `order summary names suppressed capability ${c.id}`
    );
    // the human word, not just the id — "uptime" is what the buyer reads
    assert.ok(!desc.includes('uptime'), 'order summary still promises uptime');
  }
});

await check('no suppressed capability is named in the upgrade coverage block', () => {
  const block = JSON.stringify(proCoverageBlock());
  for (const c of suppressedCapabilities()) {
    assert.ok(
      !block.includes(`"signal":"${c.id}"`),
      `coverage block sells ${c.id}`
    );
    assert.ok(
      proCoverageBlock().not_available.includes(c.id),
      `${c.id} missing from not_available`
    );
  }
});

console.log('\n=== 3. rule 2 — breadth is a number ===');

await check('every named capability carries its own row count', () => {
  const desc = proProductDescription();
  for (const c of sellableCapabilities()) {
    assert.ok(
      desc.includes(c.rows.toLocaleString('en-US')),
      `row count for ${c.id} (${c.rows}) absent from the order summary`
    );
  }
});

await check('the population is quoted, so coverage is a fraction', () => {
  assert.ok(
    proProductDescription().includes(proPopulation().toLocaleString('en-US')),
    'population absent from the order summary'
  );
});

await check('the phantom count — the hard negative — is stated', () => {
  const phantom = /(\d[\d,]*) naming a package that does not exist/.exec(
    proCapability('install_signal')!.label
  );
  assert.ok(phantom, 'install label does not state the phantom count');
  assert.ok(
    proProductDescription().includes(phantom![1]),
    `phantom count ${phantom![1]} absent from the order summary`
  );
});

console.log('\n=== 4. rule 3 — no unbounded breadth claim ===');

await check('order summary makes no unbounded claim', () => {
  const desc = proProductDescription();
  for (const re of UNBOUNDED) {
    assert.ok(!re.test(desc), `order summary matches banned claim ${re}`);
  }
});

await check('the live/stdio caveat is stated rather than implied', () => {
  assert.match(proProductDescription(), /local\/stdio/i);
});

console.log('\n=== 5. wiring — what a buyer actually receives ===');

await check('checkout route imports the generated copy, not a literal', () => {
  const src = readFileSync('src/app/api/trust-api/checkout/route.ts', 'utf8');
  assert.match(src, /from "@\/lib\/api\/pro-offer"/, 'no pro-offer import');
  assert.ok(
    !/live status, uptime, latency, and drift/.test(src),
    'the old hard-coded order summary is still in the route'
  );
});

await check('?probe=1 reports the real order summary a buyer would see', async () => {
  const res = await checkoutGET(
    new NextRequest('https://mymcptools.com/api/trust-api/checkout?probe=1&endpoint=/api/v1/drift')
  );
  assert.equal(res.status, 200, `probe status ${res.status}`);
  const body = await res.json();
  assert.equal(body.probe, true);
  const os = body.would_create?.order_summary;
  assert.ok(os, 'probe dry run does not report the order summary');
  assert.equal(os.name, proProductName(), 'probe name mismatch');
  assert.equal(os.description, proProductDescription(), 'probe description mismatch');
  assert.ok(!/uptime/i.test(JSON.stringify(os)), 'probe order summary promises uptime');
});

await check('a 401 on a gated endpoint carries the coverage block', async () => {
  const res = await driftGET(new NextRequest('https://mymcptools.com/api/v1/drift'));
  assert.equal(res.status, 401, `expected 401, got ${res.status}`);
  const body = await res.json();
  const pro = body.plans?.find((p: { name: string }) => p.name === 'Pro');
  assert.ok(pro, 'no Pro plan in the 401 upgrade block');
  assert.ok(pro.coverage, 'Pro plan states no coverage — this is the 0/4 defect');
  assert.equal(pro.coverage.servers_catalogued, proPopulation());
  assert.ok(
    pro.coverage.coverage.some(
      (c: { signal: string }) => c.signal === 'install_signal'
    ),
    'coverage block omits install_signal'
  );
  assert.ok(
    !JSON.stringify(pro.coverage.coverage).includes('uptime'),
    '401 upgrade block sells uptime'
  );
});

await check('/developers states the same coverage, generated', () => {
  const src = readFileSync('src/app/developers/page.tsx', 'utf8');
  assert.match(src, /pro-offer/, '/developers does not read the generated offer');
});

console.log(
  failures === 0
    ? `\nAll checks passed. Order summary now names ${sellableCapabilities().length} capabilities, all with counts; ${suppressedCapabilities().length} suppressed for zero rows.\n`
    : `\n${failures} check(s) FAILED.\n`
);
process.exit(failures === 0 ? 0 : 1);
