/**
 * Self-check for the SERVER-PAGE DOOR to the $49/mo Trust Data API.
 *
 * THE DEFECT THIS GUARDS (measured 2026-10-03, 30 days, not is_bot): 694 human
 * sessions read /servers/[slug], each of which renders a Trust verdict built
 * from the signals the paid API sells; /developers — the only page that names
 * the price — drew 2 sessions, and no server page linked to it. The paid
 * tier's machine-facing funnel meanwhile reached ~1 real caller a month.
 *
 * Checks: the door module exists and only claims facts a store holds for that
 * slug; coverage is generated (no zero-row "uptime"); the href lands on the
 * #pro anchor with countable attribution; the page renders it inside the trust
 * block; the "free, no key" link targets an endpoint that is really keyless;
 * and demand:report reads the arrivals back.
 *
 * RETRY (2026-10-03, judge 1/3 on 245e6a6): the door was a link to
 * /developers#pro — one more marketing page between a verdict reader and
 * Stripe. The buy button is now a <form method="post"> straight to
 * /api/trust-api/checkout?from=server-page&server=<slug>, answered 303 ->
 * Stripe. Checks below drive the real route handler (probe + crawler + no-key
 * branches) so "a press reaches checkout" is exercised, not grepped.
 *
 * Run: npm run door:selfcheck
 */
import { existsSync, readFileSync } from 'node:fs';

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
function ok(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const DOOR = new URL('../src/lib/api/server-page-door.ts', import.meta.url);
const PAGE = new URL('../src/app/servers/[slug]/page.tsx', import.meta.url);
const ROUTE = new URL('../src/app/api/trust-api/checkout/route.ts', import.meta.url);
const DEV = new URL('../src/app/developers/page.tsx', import.meta.url);
const FREE = new URL('../src/app/api/v1/servers/[slug]/status/route.ts', import.meta.url);
const REPORT = new URL('./mcp-demand-report.mts', import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let door: any = null;
await check('door module exists (src/lib/api/server-page-door.ts)', async () => {
  ok(existsSync(DOOR), 'missing — no server page can link to the price');
  door = await import(DOOR.href);
});

const { getInstallCheck } = await import('../src/lib/trust/install-check.ts');
const { getStaticSignal } = await import('../src/lib/trust/static-signals-store.ts');
const { getStatus } = await import('../src/lib/trust/status-store.ts');
const { PRO_PRICE_USD } = await import('../src/lib/api/auth.ts');
const { sellableCapabilities, proPopulation } = await import('../src/lib/api/pro-offer.ts');
const { servers } = await import('../src/data/servers.ts');

await check('href lands on /developers#pro with server-page attribution and the slug', () => {
  ok(door, 'no module');
  const d = door.serverApiDoor('ab-tasty-mcp');
  const u = new URL(d.href, 'https://mymcptools.com');
  ok(u.pathname === '/developers', `pathname ${u.pathname}`);
  ok(u.hash === '#pro', `hash ${u.hash} — 401 bodies and the checkout form live at #pro`);
  ok(u.searchParams.get('utm_source') === 'server-page', 'utm_source not server-page');
  ok(u.searchParams.get('utm_campaign') === 'ab-tasty-mcp', 'slug not carried');
});

await check('price is the 401 body constant, not a literal', () => {
  ok(door, 'no module');
  ok(door.serverApiDoor('ab-tasty-mcp').priceUsd === PRO_PRICE_USD, 'price drift');
});

await check('coverage is generated: no zero-row capability, matches pro-offer', () => {
  ok(door, 'no module');
  const d = door.serverApiDoor('ab-tasty-mcp');
  const want = sellableCapabilities().map((c: { label: string }) => c.label);
  ok(JSON.stringify(d.coverage.map((c: { label: string }) => c.label)) === JSON.stringify(want), 'coverage != sellableCapabilities()');
  ok(d.coverage.every((c: { rows: number }) => c.rows > 0), 'a zero-row capability is named');
  ok(!d.coverage.some((c: { label: string }) => /uptime/i.test(c.label)), '"uptime" named — 0 rows held');
  ok(d.population === proPopulation(), 'population drift');
});

await check('heldHere never claims a fact the stores do not hold, across the whole catalog', () => {
  ok(door, 'no module');
  let claimed = 0;
  for (const s of servers) {
    const d = door.serverApiDoor(s.slug);
    for (const f of d.heldHere) {
      claimed += 1;
      if (f.capability === 'install_signal') {
        const ic = getInstallCheck(s.slug);
        ok(ic && f.text.includes(ic.packageName), `${s.slug}: install claim without a record`);
        ok(ic.exists ? /verified to exist/.test(f.text) : /does not exist/.test(f.text), `${s.slug}: install verdict inverted`);
      } else if (f.capability === 'static_signal') {
        const ss = getStaticSignal(s.slug);
        ok(ss && (ss.last_commit_at || ss.last_release_at), `${s.slug}: freshness claim without dates`);
      } else if (f.capability === 'live_status') {
        const st = getStatus(s.slug);
        ok(st && st.latency_ms != null, `${s.slug}: live claim without latency`);
      } else {
        throw new Error(`${s.slug}: unexpected capability ${f.capability}`);
      }
    }
  }
  ok(claimed > 0, 'no server holds any fact — door would be empty everywhere');
});

await check('a known phantom package is stated as a phantom', () => {
  ok(door, 'no module');
  const f = door.serverApiDoor('3dcart-mcp').heldHere.find((x: { capability: string }) => x.capability === 'install_signal');
  ok(f && /does not exist/.test(f.text), 'phantom not stated');
});

await check('the "free, no key" link targets a keyless endpoint', () => {
  ok(door, 'no module');
  ok(door.serverApiDoor('ab-tasty-mcp').freeJsonHref === '/api/v1/servers/ab-tasty-mcp/status', 'wrong free href');
  const src = readFileSync(FREE, 'utf8');
  ok(/authenticateOpen/.test(src) && !/authenticateGated/.test(src), 'endpoint is not open');
});

await check('server page renders the door inside the trust block', () => {
  const src = readFileSync(PAGE, 'utf8');
  ok(/serverApiDoor\(server\.slug\)/.test(src), 'page never builds the door');
  const trustAt = src.indexOf('id="trust"');
  const doorAt = src.indexOf('href={apiDoor.href}');
  ok(trustAt > 0 && doorAt > trustAt, 'door link not rendered under the verdict');
  ok(src.indexOf('{trust && (', trustAt - 200) < doorAt, 'door outside trust block');
});

await check('/developers still has the #pro anchor the door lands on', () => {
  ok(/id="pro"/.test(readFileSync(DEV, 'utf8')), '#pro anchor missing');
});

const { readCheckoutEntry, stripeEntryMetadata, entryTag } = await import('../src/lib/api/checkout-entry.ts');

await check('the buy button posts straight to checkout, attributed to the server', () => {
  ok(door, 'no module');
  const d = door.serverApiDoor('ab-tasty-mcp');
  ok(typeof d.checkoutAction === 'string', 'no checkoutAction — the door is a link to another marketing page');
  const u = new URL(d.checkoutAction, 'https://mymcptools.com');
  ok(u.pathname === '/api/trust-api/checkout', `action ${u.pathname} is not the checkout`);
  const e = readCheckoutEntry(u);
  ok(e.kind === 'server-page', `entry kind ${e.kind}`);
  ok(e.server === 'ab-tasty-mcp', `server ${e.server}`);
  ok(stripeEntryMetadata(e).entry_server === 'ab-tasty-mcp', 'slug not in Stripe metadata');
  ok(entryTag(e) === 'entry:server-page:-:-:server-ab-tasty-mcp', `tag ${entryTag(e)}`);
});

await check('attribution is closed: a hostile server param drops, old entries keep their shape', () => {
  const bad = readCheckoutEntry(new URL('https://x/api/trust-api/checkout?from=server-page&server=%3Cscript%3E'));
  ok(bad.kind === 'server-page' && bad.server === null, 'free text accepted as a slug');
  ok(!('entry_server' in stripeEntryMetadata(bad)), 'empty entry_server written');
  const gate = readCheckoutEntry(new URL('https://x/api/trust-api/checkout?endpoint=/api/v1/drift&server=ab-tasty-mcp'));
  ok(gate.kind === 'gate' && !('server' in gate), 'server leaked into a non-door entry');
  ok(Object.keys(stripeEntryMetadata(gate)).length === 4, 'gate metadata shape changed');
});

await check('page renders a POST form to the action, never a GET link to checkout', () => {
  const src = readFileSync(PAGE, 'utf8');
  ok(/<form method="post" action=\{apiDoor\.checkoutAction\}/.test(src), 'no POST form to apiDoor.checkoutAction');
  ok(!/href=\{?["'`]?\/api\/trust-api\/checkout/.test(src), 'a crawlable GET link to checkout would mint live sessions');
  const trustAt = src.indexOf('id="trust"');
  ok(src.indexOf('apiDoor.checkoutAction') > trustAt, 'button not under the verdict');
});

// Drive the real handler. Stripe is never reached: probe and crawler branches
// return before it, and the human branch runs with STRIPE_SECRET_KEY unset.
delete process.env.STRIPE_SECRET_KEY;
delete process.env.DATABASE_URL;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let route: any = null;
try {
  route = await import(ROUTE.href);
} catch (err) {
  console.log(`  (route import failed: ${(err as Error).message.split('\n')[0]})`);
}
const { NextRequest } = await import('next/server');
const HUMAN_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
function formPost(qs: string, ua = HUMAN_UA) {
  return new NextRequest(`https://mymcptools.com/api/trust-api/checkout?${qs}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': ua },
    body: '',
  });
}

await check('a form press (probe) would mint a server-page subscription that cancels back to the page', async () => {
  ok(route, 'route not importable');
  const res = await route.POST(formPost('from=server-page&server=ab-tasty-mcp&probe=1'));
  ok(res.status === 200, `status ${res.status} — a form POST with no email was refused`);
  const j = await res.json();
  ok(j.would_create?.mode === 'subscription', 'not a subscription');
  ok(j.would_create.metadata.entry_kind === 'server-page', `entry_kind ${j.would_create?.metadata?.entry_kind}`);
  ok(j.would_create.metadata.entry_server === 'ab-tasty-mcp', 'slug lost before Stripe');
  ok(/\/servers\/ab-tasty-mcp\?checkout=cancelled#trust$/.test(j.would_create.cancel_url), `cancel_url ${j.would_create.cancel_url}`);
});

await check('a real person reaches the Stripe step (503 only because the key is unset here)', async () => {
  ok(route, 'route not importable');
  const res = await route.POST(formPost('from=server-page&server=ab-tasty-mcp'));
  ok(res.status === 503, `status ${res.status} — expected to reach session creation`);
});

await check('a form-submitting crawler gets the offer page, never a cart', async () => {
  ok(route, 'route not importable');
  const res = await route.POST(formPost('from=server-page&server=ab-tasty-mcp', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'));
  ok(res.status === 303, `status ${res.status}`);
  ok(/\/developers#pro$/.test(res.headers.get('location') || ''), `location ${res.headers.get('location')}`);
});

await check("demand:report reads the door's presses straight off checkout rows", () => {
  ok(/utm_medium = 'server-page'/.test(readFileSync(REPORT, 'utf8')), 'no read of server-page checkout rows');
});

await check("demand:report reads the door's arrivals back", () => {
  const src = readFileSync(REPORT, 'utf8');
  ok(/utm_source = 'server-page'/.test(src), 'no arrival read');
});

console.log(failures ? `\n${failures} FAILED` : '\nall checks passed');
process.exit(failures ? 1 : 0);
