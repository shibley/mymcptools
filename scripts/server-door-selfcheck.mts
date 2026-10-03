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

await check("demand:report reads the door's arrivals back", () => {
  const src = readFileSync(REPORT, 'utf8');
  ok(/utm_source = 'server-page'/.test(src), 'no arrival read');
});

console.log(failures ? `\n${failures} FAILED` : '\nall checks passed');
process.exit(failures ? 1 : 0);
