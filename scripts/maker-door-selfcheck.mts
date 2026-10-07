/**
 * Self-check for the MAKER DOOR: server page -> prefilled $9 Featured on /submit.
 *
 * THE DEFECT THIS GUARDS (demand:report, 2026-10-07, 30d): 798 human sessions
 * read /servers/[slug]; of the 95 exposed to the Trust API buttons ($49/mo and
 * $9 30-day key) 0 pressed. The property's only sale ever was a maker buying
 * $9 Featured on /submit (~59 human sessions/mo), and no server page linked
 * there. Worse, the delivery path could not serve a maker whose server is
 * ALREADY listed: the webhook filed the order under slugify(toolName) and the
 * overlay drops any slug the catalog holds, so a paid order for an existing
 * page either duplicated it or rendered nowhere.
 *
 * Checks the whole chain: every catalog page carries a door whose href opens
 * /submit on Featured with the listing's own fields; /submit reads them and
 * forwards `server`; the checkout route whitelists it into Stripe metadata;
 * the webhook files the order under the catalog slug (and ONLY a real one);
 * the category page lifts it; the server page has a badge path that works
 * without a deploy.
 *
 * Run: npm run maker:selfcheck
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
const read = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

const DOOR = new URL('../src/lib/maker-door.ts', import.meta.url);
const PAGE = 'src/app/servers/[slug]/page.tsx';
const SUBMIT = 'src/app/submit/page.tsx';
const CHECKOUT = 'src/app/api/checkout/route.ts';
const WEBHOOK = 'src/app/api/webhook/route.ts';
const CATEGORY = 'src/app/category/[slug]/page.tsx';
const STATUS_ROUTE = 'src/app/api/listing-status/[slug]/route.ts';

const { servers } = await import('../src/data/servers.ts');
const paid = await import('../src/lib/paid-listings.ts');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let door: any = null;
await check('maker-door module exists (src/lib/maker-door.ts)', async () => {
  ok(existsSync(DOOR), 'missing — no server page links a maker to the only offer that has ever sold');
  door = await import(DOOR.href);
});

await check('every unfeatured catalog page gets a door href that round-trips to its own slug on Featured', () => {
  ok(door, 'no door module');
  const eligible = servers.filter((s) => !s.featured && !s.paid_placement);
  ok(eligible.length > 2000, `only ${eligible.length} eligible pages`);
  let bad = 0;
  let longest = 0;
  for (const s of eligible) {
    const href: string = door.makerDoorHref(s);
    longest = Math.max(longest, href.length);
    const u = new URL(href, 'https://mymcptools.com');
    if (
      u.pathname !== '/submit' ||
      u.searchParams.get('tier') !== 'featured' ||
      u.searchParams.get('server') !== s.slug ||
      u.searchParams.get('name') !== s.name ||
      (s.github_url && u.searchParams.get('github') !== s.github_url) ||
      !door.cleanServerSlug(s.slug)
    ) bad += 1;
  }
  ok(bad === 0, `${bad} of ${eligible.length} hrefs do not round-trip`);
  ok(longest < 2000, `longest href ${longest} chars`);
});

await check('door category/install prefill only ever names an option the /submit form offers', () => {
  const form = read(SUBMIT);
  for (const s of servers.slice(0, 3000)) {
    const u = new URL(door.makerDoorHref(s), 'https://x');
    for (const k of ['category', 'install']) {
      const v = u.searchParams.get(k);
      if (v) ok(form.includes(`value="${v}"`), `${s.slug}: ${k}=${v} is not an option on /submit`);
    }
  }
});

await check('cleanServerSlug rejects forged values', () => {
  for (const bad of ['../etc', '-lead', '', 'x'.repeat(90), 'a b', '<script>', 42, null]) {
    ok(door.cleanServerSlug(bad) === undefined, `accepted ${JSON.stringify(bad)}`);
  }
});

await check('server page renders the door, nofollow, only where no Featured badge already shows', () => {
  const src = read(PAGE);
  ok(src.includes('makerDoorHref(server)'), 'page does not call makerDoorHref');
  ok(/data-maker-door/.test(src), 'no data-maker-door card');
  ok(/!server\.featured && !server\.paid_placement/.test(src), 'door not gated on featured/paid');
  ok(/rel="nofollow"[\s\S]{0,200}Feature it — \$9/.test(src) || /Feature it — \$9/.test(src), 'no $9 call to action');
});

await check('/submit reads the door params and forwards `server` to checkout', () => {
  const src = read(SUBMIT);
  ok(/sp\.get\("server"\)/.test(src), '/submit ignores ?server=');
  ok(/sp\.get\("tier"\)/.test(src), '/submit ignores ?tier=');
  ok(/server: doorServer/.test(src), 'checkout body does not carry server');
  ok(/defaultValue=\{prefill\.name\}/.test(src) && /defaultValue=\{prefill\.github\}/.test(src), 'form not prefilled');
});

await check('checkout route whitelists server into Stripe metadata and returns a backed-out maker to their page', () => {
  const src = read(CHECKOUT);
  ok(/cleanServerSlug\(body\.server\)/.test(src), 'server not whitelisted');
  ok(/server, entry: MAKER_DOOR_FROM/.test(src), 'server not in metadata');
  ok(/cancel_url: server \?/.test(src), 'cancel_url ignores server');
});

await check('webhook files the order under the catalog slug the buyer came from', () => {
  ok(/catalogSlug: meta\.server/.test(read(WEBHOOK)), 'webhook ignores metadata.server');
  ok(typeof paid.resolveListingSlug === 'function', 'no resolveListingSlug');
  const real = servers.find((s) => s.slug !== paid.slugifyListing(s.name))!;
  ok(
    paid.resolveListingSlug({ name: real.name, catalogSlug: real.slug }) === real.slug,
    `order for ${real.slug} filed as ${paid.resolveListingSlug({ name: real.name, catalogSlug: real.slug })}`,
  );
  ok(
    paid.resolveListingSlug({ name: 'Brand New Server', catalogSlug: 'not-a-real-catalog-slug-zzz' }) === 'brand-new-server',
    'a forged catalogSlug was honoured',
  );
  ok(paid.resolveListingSlug({ name: 'Brand New Server' }) === 'brand-new-server', 'plain /submit orders changed slug');
});

await check('category page lifts paid catalog listings; server page has a no-deploy badge path', () => {
  ok(/getPaidCatalogSlugs\(\)/.test(read(CATEGORY)), 'category page never lifts a maker-door order');
  ok(typeof paid.getPaidCatalogSlugs === 'function', 'no getPaidCatalogSlugs');
  ok(existsSync(STATUS_ROUTE), 'no /api/listing-status route');
  ok(/<PaidFeaturedBadge slug=\{server\.slug\}/.test(read(PAGE)), 'server page has no badge island');
});

await check('getPaidCatalogSlugs degrades to an empty set without a warehouse', async () => {
  const prev = process.env.ANALYTICS_DATABASE_URL;
  delete process.env.ANALYTICS_DATABASE_URL;
  const set = await paid.getPaidCatalogSlugs();
  if (prev !== undefined) process.env.ANALYTICS_DATABASE_URL = prev;
  ok(set instanceof Set && set.size === 0, 'did not degrade to empty');
});

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed');
process.exit(failures ? 1 : 0);
