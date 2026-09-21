/**
 * Self-check for the gated-endpoint BUY-INTENT path (thread #235).
 *
 * Two things this guards, both of which were broken before this script existed:
 *
 *  1. MEASUREMENT. The six key-gated /api/v1 endpoints recorded nothing. Since
 *     `src/data/api-keys.json` has never held a key, 100% of traffic to them was
 *     a 401 that no queryable store ever saw — so "does anyone want the $49/mo
 *     tier?" was structurally unanswerable, exactly the way the free half was
 *     before it went keyless. Every gated route must therefore go through
 *     `authenticateGated(req, "<endpoint>")`, never bare `authenticate(req)`.
 *
 *  2. THE BUY PATH. A 401 reading "Missing or invalid API key" is a dead end: it
 *     names no price, no URL and no free alternative, while the property's only
 *     priced surface (/api/trust-api/checkout) sat behind a marketing page an
 *     API caller never reaches. Auth failures must carry the upgrade path in
 *     both the body and the headers.
 *
 * Exercises the real `authenticate` / `authenticateOpen` against synthetic
 * requests — no network, no warehouse (ANALYTICS_DATABASE_URL is unset here, so
 * the recorder no-ops).
 *
 * Run: npx tsx scripts/trust-api-intent-selfcheck.mts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import {
  authenticate,
  authenticateOpen,
  UPGRADE_URL,
  PRO_PRICE_USD,
} from '../src/lib/api/auth.ts';
import { CHECKOUT_PATH } from '../src/lib/api/checkout-entry.ts';

let failures = 0;
function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  return (async () => {
    try {
      await fn();
      console.log(`  ok    ${name}`);
    } catch (err) {
      failures += 1;
      console.log(`  FAIL  ${name}\n        ${(err as Error).message.split('\n')[0]}`);
    }
  })();
}

function req(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('https://mymcptools.com/api/v1/drift', { headers });
}

// ---- 1. every gated route is wired into the meter -------------------------
const V1 = 'src/app/api/v1';
function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...routeFiles(p));
    else if (e === 'route.ts') out.push(p);
  }
  return out;
}

// Routes that deliberately serve everyone with no auth call at all (embeddable
// SVGs — an <img> cannot send a header, and they exist to drive backlinks).
// Listed explicitly so adding a new keyless route is a decision, not a drift.
const PUBLIC_ROUTES = new Set([
  'src/app/api/v1/servers/[slug]/badge/route.ts',
  'src/app/api/v1/servers/[slug]/sparkline/route.ts',
]);

console.log('\n-- gated routes are recorded --');
const files = routeFiles(V1);
assert.ok(files.length >= 9, `expected the v1 surface to have routes, found ${files.length}`);
let gatedSeen = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const open = /authenticateOpen\s*\(/.test(src);
  const gated = /authenticateGated\s*\(/.test(src);
  const bare = /(?<!open|Gated)\bauthenticate\s*\(\s*req\s*\)/.test(src);
  if (open) continue;
  if (!gated && !bare) {
    await check(`${f} is a known keyless route`, () => {
      assert.ok(
        PUBLIC_ROUTES.has(f.split('/').join('/')),
        `${f} calls no authenticate* helper — if that is intended, add it to PUBLIC_ROUTES`
      );
    });
    continue;
  }
  gatedSeen += 1;
  await check(`${f} uses authenticateGated`, () => {
    assert.ok(gated, `${f} key-gates but never calls authenticateGated — its 401s are invisible`);
    assert.ok(!bare, `${f} still calls bare authenticate(req); that call site records nothing`);
    assert.ok(
      /authenticateGated\(\s*req\s*,\s*"\/api\/v1\//.test(src),
      `${f} must pass a literal "/api/v1/..." endpoint so the rows are attributable`
    );
  });
}
await check('every key-gated v1 endpoint is accounted for', () => {
  assert.ok(gatedSeen >= 6, `expected >=6 key-gated routes, saw ${gatedSeen}`);
});

// ---- 2. an auth failure carries the buy path ------------------------------
console.log('\n-- 401 on a gated endpoint sells the key --');
const missing = await authenticate(req());
await check('keyless request to a gated endpoint is rejected', () => {
  assert.equal(missing.ok, false);
});
if (!missing.ok) {
  const res = missing.response;
  const body = await res.clone().json();
  await check('401 body names the upgrade URL', () => {
    assert.equal(res.status, 401);
    assert.equal(body.upgrade_url, UPGRADE_URL);
    // The message must name the URL that REACHES STRIPE, not the docs page:
    // the reader here is a script, and /developers#pro is a React form.
    assert.ok(String(body.message).includes(body.checkout_url), 'message must contain the buy URL');
    assert.ok(String(body.checkout_url).includes(CHECKOUT_PATH));
  });
  await check('401 body names the price and the free alternative', () => {
    const plans = body.plans as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(plans) && plans.length >= 2, 'need a free and a paid plan');
    const pro = plans.find((p) => p.name === 'Pro');
    const free = plans.find((p) => p.name === 'Free');
    assert.equal(pro?.price_usd_month, PRO_PRICE_USD);
    assert.equal(free?.key_required, false);
    assert.ok(
      Array.isArray(free?.endpoints) && (free!.endpoints as string[]).includes('/api/v1/status'),
      'the free plan must list the keyless endpoints so a 401 is not a dead end'
    );
  });
  await check('401 carries machine-readable upgrade headers', () => {
    assert.equal(res.headers.get('X-MCPTools-Upgrade'), UPGRADE_URL);
    assert.equal(res.headers.get('Link'), `<${body.checkout_url}>; rel="payment"`);
    assert.ok(
      res.headers.get('WWW-Authenticate')?.startsWith('Bearer '),
      'a 401 without WWW-Authenticate is not a well-formed challenge'
    );
  });
}

console.log('\n-- a bad key on the FREE tier also gets the buy path --');
const badKey = await authenticateOpen(req({ 'x-api-key': 'nope-not-a-key' }));
await check('invalid key is rejected rather than silently downgraded', () => {
  assert.equal(badKey.ok, false);
});
if (!badKey.ok) {
  const body = await badKey.response.clone().json();
  await check('free-tier 401 names the upgrade URL', () => {
    assert.equal(badKey.response.status, 401);
    assert.equal(body.upgrade_url, UPGRADE_URL);
    assert.equal(badKey.response.headers.get('X-MCPTools-Upgrade'), UPGRADE_URL);
  });
}

console.log('\n-- a keyless caller still gets the free tier --');
const anon = await authenticateOpen(req());
await check('no key = anonymous tier, not a rejection', () => {
  assert.equal(anon.ok, true);
  if (anon.ok) assert.equal(anon.tier, 'anonymous');
});

// ---- 3. a 429 points at the higher limit ---------------------------------
console.log('\n-- 429 points at the paid allowance --');
await check('anonymous rate-limit body sells the higher limit', async () => {
  const ip = { 'x-forwarded-for': '203.0.113.77', 'user-agent': 'selfcheck/1.0' };
  let limited: Awaited<ReturnType<typeof authenticateOpen>> | null = null;
  for (let i = 0; i < 40; i += 1) {
    const r = await authenticateOpen(req(ip));
    if (!r.ok) { limited = r; break; }
  }
  assert.ok(limited && !limited.ok, 'anonymous bucket never tripped in 40 requests');
  const res = (limited as { response: Response }).response;
  assert.equal(res.status, 429);
  const body = await res.clone().json();
  assert.equal(body.upgrade_url, UPGRADE_URL);
  assert.ok(String(body.message).includes(CHECKOUT_PATH), '429 must say where the higher limit is sold');
  assert.ok(res.headers.get('Retry-After'), '429 must keep Retry-After');
  assert.equal(res.headers.get('X-MCPTools-Upgrade'), UPGRADE_URL);
});

// ---- 4. the gated meter cannot contaminate the free-tier meter ------------
console.log('\n-- meters stay separate --');
await check('gated rows use a distinct utm_source', async () => {
  const m = await import('../src/lib/analytics/trust-api-usage.ts');
  assert.equal(m.TRUST_API_SOURCE, 'trustapi');
  assert.equal(m.TRUST_API_GATED_SOURCE, 'trustapi-gated');
  assert.notEqual(
    m.TRUST_API_SOURCE,
    m.TRUST_API_GATED_SOURCE,
    'a 401 must never count as a served free-tier call'
  );
});

// ---- 5. our own probes never read as buy intent ---------------------------
// 2026-09-18: a sprint fire's curl of /api/v1/digest landed in the warehouse as
// is_bot=false GET:401 — one "non-crawler caller who wanted the paid data".
// The watchdog alert on that number would have paged on our own check.
console.log('\n-- internal probes are excluded from demand --');
{
  const m = await import('../src/lib/analytics/trust-api-usage.ts');
  const UA = { 'user-agent': 'curl/8.7.1' };
  const u = (q = '') => new URL(`https://mymcptools.com/api/v1/digest${q}`);

  await check('?probe=1 classifies as internal-probe, not a consumer', () => {
    const c = m.classifyTrustApiCaller?.(new Headers(UA), u('?probe=1'));
    assert.deepEqual(c, { isCrawler: true, reason: 'internal-probe' });
  });
  await check('X-Probe: 1 header classifies as internal-probe', () => {
    const c = m.classifyTrustApiCaller?.(new Headers({ ...UA, 'x-probe': '1' }), u());
    assert.deepEqual(c, { isCrawler: true, reason: 'internal-probe' });
  });
  await check('an unmarked curl still counts as a consumer (no false exclusion)', () => {
    const c = m.classifyTrustApiCaller?.(new Headers(UA), u());
    assert.deepEqual(c, { isCrawler: false, reason: null });
  });
  await check('?probe=0 / other params do not exclude a real caller', () => {
    const c = m.classifyTrustApiCaller?.(new Headers(UA), u('?probe=0&window_hours=24'));
    assert.equal(c?.isCrawler, false);
  });
  await check('a known crawler UA is still flagged by the UA list', () => {
    const c = m.classifyTrustApiCaller?.(new Headers({ 'user-agent': 'Mozilla/5.0 (compatible; bingbot/2.0)' }), u());
    assert.equal(c?.isCrawler, true);
  });
  await check('both recorders pass the request URL through', () => {
    const src = readFileSync('src/lib/analytics/trust-api-usage.ts', 'utf8');
    const passes = src.match(/url: req\.nextUrl/g)?.length ?? 0;
    assert.equal(passes, 2, `expected finishFreeTier + authenticateGated to pass req.nextUrl, found ${passes}`);
    assert.ok(!/classifyCaller\(ua, "GET", null\)/.test(src), 'a recorder still classifies on the UA alone');
  });
}

// ---- 6. free responses lead to the paywall --------------------------------
// 2026-09-19: 10 non-crawler callers used the free tier in 30 days and 0 ever
// reached a gated endpoint — no free body named one. Every free response must
// carry followable, attributable URLs into the paid endpoints.
console.log('\n-- free-tier responses point at the paid endpoints --');
{
  const gatedPaths = new Map<string, string>(); // route pattern -> file
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const m = src.match(/authenticateGated\(\s*req\s*,\s*"([^"]+)"/);
    if (m) gatedPaths.set(m[1], f);
  }
  const toPattern = (u: URL) => u.pathname.replace(/^\/api\/v1\/servers\/[^/]+\//, '/api/v1/servers/:slug/');

  const free: Array<[string, string, () => Promise<Response>]> = [
    ['stats', '/api/v1/stats', async () => (await import('../src/app/api/v1/stats/route.ts')).GET(
      new NextRequest('https://mymcptools.com/api/v1/stats', { headers: { 'x-forwarded-for': '198.51.100.1' } }))],
    ['status', '/api/v1/status', async () => (await import('../src/app/api/v1/status/route.ts')).GET(
      new NextRequest('https://mymcptools.com/api/v1/status?limit=1', { headers: { 'x-forwarded-for': '198.51.100.2' } }))],
    ['server-status', '/api/v1/servers/:slug/status', async () => {
      const { allStatuses } = await import('../src/lib/trust/status-store.ts');
      const slug = allStatuses()[0].slug;
      return (await import('../src/app/api/v1/servers/[slug]/status/route.ts')).GET(
        new NextRequest(`https://mymcptools.com/api/v1/servers/${slug}/status`, { headers: { 'x-forwarded-for': '198.51.100.3' } }),
        { params: Promise.resolve({ slug }) });
    }],
  ];
  for (const [via, name, call] of free) {
    let body: Record<string, any> = {};
    await check(`${name} returns 200`, async () => {
      const res = await call();
      assert.equal(res.status, 200);
      body = await res.json();
    });
    await check(`${name} body carries a pro block with price + upgrade URL`, () => {
      assert.ok(body.pro, `${name} names no paid endpoint — a free caller has no road to the paywall`);
      assert.equal(body.pro.price_usd_month, PRO_PRICE_USD);
      assert.equal(body.pro.upgrade_url, UPGRADE_URL);
    });
    await check(`${name} pointers are real gated routes, tagged via=${via}`, () => {
      const eps = Object.values(body.pro?.endpoints ?? {}) as string[];
      assert.ok(eps.length >= 3, `expected >=3 paid pointers, got ${eps.length}`);
      for (const e of eps) {
        const u = new URL(e);
        assert.ok(gatedPaths.has(toPattern(u)), `${u.pathname} is not a key-gated route — the pointer leads nowhere billable`);
        assert.equal(u.searchParams.get('via'), via, `${e} is not attributable`);
      }
    });
  }

  const m = await import('../src/lib/analytics/trust-api-usage.ts');
  await check('a gated attempt that followed a pointer is tagged; a direct one is not', () => {
    assert.equal(m.gatedPointerTag?.(new URL('https://mymcptools.com/api/v1/drift?via=status')), 'pointer:status');
    assert.equal(m.gatedPointerTag?.(new URL('https://mymcptools.com/api/v1/drift')), null);
    assert.equal(m.gatedPointerTag?.(new URL('https://mymcptools.com/api/v1/drift?via=<script>')), null);
  });
  await check('demand report reads the pointer attribution', () => {
    const src = readFileSync('scripts/mcp-demand-report.mts', 'utf8');
    assert.ok(/referrer_full like 'pointer:%'/.test(src), 'demand:report never reads pointer-attributed gated attempts');
  });
}

// ---- 7. the buy link is followable by a program ---------------------------
// 2026-09-21: every URL the 401 handed back landed on /developers#pro — an HTML
// page whose buy button is a React form. The caller receiving a 401 is a
// script, and GET /api/trust-api/checkout was a 405, so the machine-facing
// funnel stopped one click short of Stripe and nothing recorded the step.
console.log('\n-- a gated rejection hands back a followable, attributed buy URL --');
{
  const ce = await import('../src/lib/api/checkout-entry.ts');
  const usage = await import('../src/lib/analytics/trust-api-usage.ts');
  const checkoutRoute = await import('../src/app/api/trust-api/checkout/route.ts');

  await check('GET /api/trust-api/checkout exists (a 405 is not a buy path)', () => {
    assert.equal(typeof (checkoutRoute as any).GET, 'function',
      'checkout is POST-only — a script that got a 401 cannot reach Stripe');
  });

  let body: Record<string, any> = {};
  let res: Response | undefined;
  await check('a gated 401 body carries checkout_url, not just a docs page', async () => {
    const r = await authenticate(
      new NextRequest('https://mymcptools.com/api/v1/drift', { headers: {} }),
      { endpoint: '/api/v1/drift' }
    );
    assert.equal(r.ok, false);
    res = (r as { ok: false; response: Response }).response;
    body = await res.clone().json();
    assert.ok(body.checkout_url, '401 names no checkout URL');
    const u = new URL(body.checkout_url);
    assert.equal(u.pathname, ce.CHECKOUT_PATH);
    assert.equal(u.searchParams.get('endpoint'), '/api/v1/drift',
      'the buy URL does not name the gate that produced it — a sale would be unattributable');
  });
  await check('the Pro plan block buys at the same URL', () => {
    const pro = (body.plans || []).find((p: any) => p.name === 'Pro');
    assert.equal(pro?.checkout_url, body.checkout_url);
  });
  await check('Link rel=payment + X-MCPTools-Checkout name the Stripe path', () => {
    assert.ok(res, 'no response captured');
    assert.equal(res!.headers.get('X-MCPTools-Checkout'), body.checkout_url);
    assert.ok(
      res!.headers.get('Link')?.includes(ce.CHECKOUT_PATH),
      'Link rel=payment still points at an HTML page'
    );
  });
  await check('a pointer-led caller keeps its via= all the way to checkout', async () => {
    const r = await authenticate(
      new NextRequest('https://mymcptools.com/api/v1/drift?via=status', { headers: {} }),
      { endpoint: '/api/v1/drift' }
    );
    const b = await (r as any).response.json();
    assert.equal(new URL(b.checkout_url).searchParams.get('via'), 'status');
  });
  await check('every gated route names a checkout endpoint the buy URL accepts', () => {
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      const m = src.match(/authenticateGated\(\s*req\s*,\s*"([^"]+)"/);
      if (!m) continue;
      assert.ok(
        (ce.GATED_ENDPOINTS as readonly string[]).includes(m[1]),
        `${m[1]} is gated but unknown to checkout-entry — its 401 would emit an untagged buy URL`
      );
    }
  });
  await check('entry kinds separate gate, pointer, page and direct', () => {
    const k = (q: string) => ce.readCheckoutEntry(new URL(`https://mymcptools.com${ce.CHECKOUT_PATH}${q}`)).kind;
    assert.equal(k('?endpoint=/api/v1/drift'), 'gate');
    assert.equal(k('?endpoint=/api/v1/drift&via=status'), 'pointer');
    assert.equal(k('?from=developers'), 'page');
    assert.equal(k(''), 'direct');
    assert.equal(k('?endpoint=/etc/passwd'), 'direct', 'an unknown endpoint must not travel into Stripe metadata');
  });
  await check('Stripe metadata carries the entry so a PAID sub is traceable', () => {
    const meta = ce.stripeEntryMetadata(
      ce.readCheckoutEntry(new URL(`https://mymcptools.com${ce.CHECKOUT_PATH}?endpoint=/api/v1/digest&via=stats`))
    );
    assert.deepEqual(meta, { entry_kind: 'pointer', entry_endpoint: '/api/v1/digest', entry_via: 'stats' });
    for (const v of Object.values(meta)) assert.equal(typeof v, 'string');
  });
  await check('the webhook can fulfil a session that carried no email', () => {
    const src = readFileSync('src/app/api/webhook/route.ts', 'utf8');
    assert.ok(
      /customer_details\?\.email/.test(src),
      'a GET checkout collects no email; without the Stripe fallback the key is mailed nowhere'
    );
  });
  await check('checkout starts are recorded under their own source', () => {
    assert.equal(usage.TRUST_API_CHECKOUT_SOURCE, 'trustapi-checkout');
    assert.equal(typeof usage.recordCheckoutStart, 'function');
    const src = readFileSync('src/app/api/trust-api/checkout/route.ts', 'utf8');
    assert.ok(/recordCheckoutStart/.test(src), 'checkout mints sessions nobody counts');
  });
  await check('?probe=1 is a dry run — no Stripe session, still recorded', async () => {
    const r = await (checkoutRoute as any).GET(
      new NextRequest(`https://mymcptools.com${ce.CHECKOUT_PATH}?endpoint=/api/v1/digest&probe=1`, {
        headers: { 'user-agent': 'curl/8.7.1' },
      })
    );
    assert.equal(r.status, 200);
    const b = await r.json();
    assert.equal(b.probe, true);
    assert.equal(b.entry.kind, 'gate');
    assert.equal(b.would_create.metadata.entry_endpoint, '/api/v1/digest');
  });
  await check('demand report reads the checkout-start meter', () => {
    const src = readFileSync('scripts/mcp-demand-report.mts', 'utf8');
    assert.ok(/trustapi-checkout/.test(src), 'demand:report never reads checkout starts');
    assert.ok(/gate -> checkout/.test(src), 'demand:report never states the gate->checkout rate');
  });
}

console.log(
  failures === 0
    ? '\nAll trust-API intent checks passed.'
    : `\n${failures} check(s) FAILED.`
);
process.exit(failures === 0 ? 0 : 1);
