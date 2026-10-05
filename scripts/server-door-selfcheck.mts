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

// ---- $9 one-time 30-day key (retry of bf6b825, 2026-10-05) -----------------
// 0 of 33 exposed sessions pressed $49/mo; the only stranger who ever paid this
// property paid $9 once. The door now offers both. These drive the real route,
// the real session builder, the real key-liveness rule and the real receipt.

await check('the door offers a $9 one-time 30-day key beside $49/mo', () => {
  ok(door, 'no module');
  const d = door.serverApiDoor('ab-tasty-mcp');
  ok(typeof d.passAction === 'string', 'no passAction — the only price is a subscription');
  const u = new URL(d.passAction, 'https://mymcptools.com');
  ok(u.pathname === '/api/trust-api/checkout', `pass action ${u.pathname}`);
  ok(u.searchParams.get('plan') === 'pass', 'pass action does not select plan=pass');
  const e = readCheckoutEntry(u);
  ok(e.kind === 'server-page' && e.server === 'ab-tasty-mcp', 'pass press loses server-page attribution');
  ok(d.passPriceUsd === 9 && d.passDays === 30, `pass ${d.passPriceUsd}/${d.passDays}d`);
  ok(new URL(d.checkoutAction, 'https://x').searchParams.get('plan') === null, '$49 button changed plan');
});

await check('page renders the pass as its own POST form under the verdict', () => {
  const src = readFileSync(PAGE, 'utf8');
  ok(/<form method="post" action=\{apiDoor\.passAction\}/.test(src), 'no POST form to apiDoor.passAction');
  ok(/no subscription/.test(src), 'button does not say it is not a subscription');
  ok(src.indexOf('apiDoor.passAction') > src.indexOf('id="trust"'), 'pass button not under the verdict');
});

await check('a pass press (probe) would mint a one-time $9 payment, not a subscription', async () => {
  ok(route, 'route not importable');
  const res = await route.POST(formPost('from=server-page&server=ab-tasty-mcp&plan=pass&probe=1'));
  ok(res.status === 200, `status ${res.status}`);
  const j = await res.json();
  ok(j.would_create?.mode === 'payment', `mode ${j.would_create?.mode} — a pass must not recur`);
  ok(j.would_create.unit_amount === 900, `amount ${j.would_create.unit_amount}`);
  ok(j.would_create.metadata.plan === 'pass-30d', `plan ${j.would_create.metadata.plan}`);
  ok(j.would_create.metadata.entry_server === 'ab-tasty-mcp', 'slug lost');
  ok(/30-day key/.test(j.would_create.order_summary.name), 'order summary does not name the 30-day key');
  const pro = await (await route.POST(formPost('from=server-page&server=ab-tasty-mcp&probe=1'))).json();
  ok(pro.would_create.mode === 'subscription' && pro.would_create.unit_amount === 4900, '$49/mo default changed');
});

await check('a real person pressing the pass reaches the Stripe step (503: key unset here)', async () => {
  ok(route, 'route not importable');
  const res = await route.POST(formPost('from=server-page&server=ab-tasty-mcp&plan=pass'));
  ok(res.status === 503, `status ${res.status}`);
});

await check('Stripe params: pass has no recurring price; pro recurs monthly', async () => {
  const lib = new URL('../src/lib/api/trust-api-session.ts', import.meta.url);
  ok(existsSync(lib), 'no shared session builder');
  const { trustApiSessionParams } = await import(lib.href);
  const entry = readCheckoutEntry(new URL('https://x/api/trust-api/checkout?from=server-page&server=ab-tasty-mcp'));
  const pass = trustApiSessionParams({ plan: 'pass', entry });
  ok(pass.mode === 'payment', `pass mode ${pass.mode}`);
  ok(!('recurring' in pass.line_items[0].price_data), 'pass price carries recurring');
  const pro = trustApiSessionParams({ plan: 'pro', entry });
  ok(pro.mode === 'subscription' && pro.line_items[0].price_data.recurring?.interval === 'month', 'pro no longer monthly');
});

await check('a pass key opens the API for 30 days, then stops; pro keys do not expire', async () => {
  const lib = new URL('../src/lib/api/pass.ts', import.meta.url);
  ok(existsSync(lib), 'no pass module');
  const { keyIsLive, LIVE_KEY_SQL } = await import(lib.href);
  const now = new Date('2026-10-05T00:00:00Z');
  const ago = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
  ok(keyIsLive({ plan: 'pass-30d', status: 'active', created_at: ago(29) }, now), '29-day-old pass dead');
  ok(!keyIsLive({ plan: 'pass-30d', status: 'active', created_at: ago(31) }, now), '31-day-old pass still live');
  ok(keyIsLive({ plan: 'pro', status: 'active', created_at: ago(400) }, now), 'pro key expired');
  ok(!keyIsLive({ plan: 'pro', status: 'revoked', created_at: ago(1) }, now), 'revoked key live');
  const store = readFileSync(new URL('../src/lib/api/key-store.ts', import.meta.url), 'utf8');
  ok(/\$\{LIVE_KEY_SQL\}/.test(store), 'key-store lookup ignores pass expiry');
  ok(/interval '30 days'/.test(LIVE_KEY_SQL), `sql ${LIVE_KEY_SQL}`);
});

await check('the pass receipt states the expiry and never says /mo', async () => {
  const { fulfilTrustApiPurchase } = await import('../src/lib/api/trust-api-fulfilment.ts');
  const mails: { to: string; html: string }[] = [];
  const r = await fulfilTrustApiPurchase(
    { meta: { product: 'trust-api', plan: 'pass-30d' }, sessionId: 'cs_test', customerEmail: 'funnel-probe+trust-layer@apistatuscheck.com', amountTotal: 900 },
    { addKey: async () => {}, sendEmail: async (to, _s, html) => { mails.push({ to, html }); }, adminEmail: 'admin@x', generateKey: () => 'k', now: () => new Date('2026-10-05T00:00:00Z') }
  );
  ok(r.record.plan === 'pass-30d', `plan ${r.record.plan}`);
  const cust = mails.find((m) => m.to.startsWith('funnel-probe'));
  ok(cust && /2026-11-04/.test(cust.html) && /nothing renews/.test(cust.html), 'customer not told when it ends');
  const admin = mails.find((m) => m.to === 'admin@x');
  ok(admin && /one-time/.test(admin.html) && !/9\.00\/mo/.test(admin.html), 'admin mail books $9 as monthly');
});

await check('pass rows are tagged before the slug, so the slug tail still parses', () => {
  const e = readCheckoutEntry(new URL('https://x/api/trust-api/checkout?from=server-page&server=ab-tasty-mcp'));
  const t = entryTag(e, 'pass');
  ok(t === 'entry:server-page:-:-:plan-pass:server-ab-tasty-mcp', `tag ${t}`);
  // demand:report's slug read. `:server-(.*)$` matched the `entry:server-page`
  // prefix first and returned 'page:-:-:server-<slug>' for every row.
  ok(/:server-([^:]*)$/.exec(t)?.[1] === 'ab-tasty-mcp', 'slug tail broken');
  ok(/':server-\(\[\^:\]\*\)\$'/.test(readFileSync(REPORT, 'utf8')), 'demand:report slug regex still greedy');
  ok(/plan-pass/.test(readFileSync(REPORT, 'utf8')), 'demand:report never splits presses by plan');
});

console.log(failures ? `\n${failures} FAILED` : '\nall checks passed');
process.exit(failures ? 1 : 0);
