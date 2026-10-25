/**
 * Self-check for the crawler-cost config (2026-10-09 cost cut).
 *
 * Vercel billed this project ~$22/30d against ~$9/mo revenue, and almost all
 * of its traffic is scanners. Three things keep that traffic cheap; this check
 * fails if any of them is undone:
 *
 * 1. Fully-prerendered [slug] routes set `dynamicParams = false`, so an
 *    invented slug is a CDN-served 404 rather than a function render.
 *    servers/[slug] and category/[slug] must NOT — they render paid listings
 *    on demand (thread #218), and that is a paying customer's path.
 * 2. mymcptools.vercel.app pages 308 to mymcptools.com; /api/* is never
 *    redirected (webhooks/MCP POSTs don't follow redirects).
 * 3. alternatives/[slug] only links /compare pairs that exist, and the public
 *    keyless GET endpoints keep a CDN `s-maxage` header.
 *
 * Run: npm run cache:selfcheck
 */
import { readFileSync } from 'node:fs';
import * as hostMod from '../src/lib/canonical-host.ts';

const h = ((hostMod as { canonicalRedirectFor?: unknown }).canonicalRedirectFor
  ? hostMod
  : (hostMod as unknown as { default: typeof hostMod }).default) as typeof hostMod;

let failures = 0;
const fail = (m: string) => {
  failures++;
  console.log(`  FAIL ${m}`);
};
const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// 1. dynamicParams
const STATIC_ONLY = ['compare', 'alternatives', 'pricing', 'blog', 'integration'];
for (const r of STATIC_ONLY) {
  const s = src(`src/app/${r}/[slug]/page.tsx`);
  if (!/export const dynamicParams = false;/.test(s)) fail(`${r}/[slug] lacks dynamicParams = false`);
  if (!/export async function generateStaticParams/.test(s)) fail(`${r}/[slug] lacks generateStaticParams`);
  if (/getPaid/.test(s)) fail(`${r}/[slug] reads paid listings but is static-only — paid slugs would 404`);
}
for (const r of ['servers', 'category']) {
  const s = src(`src/app/${r}/[slug]/page.tsx`);
  if (/dynamicParams\s*=\s*false/.test(s)) fail(`${r}/[slug] must keep on-demand params (paid listings render there)`);
}

// 2. canonical host redirect
const cases: Array<[string | null, string, string, string | null]> = [
  ['mymcptools.vercel.app', '/servers/github', '', 'https://mymcptools.com/servers/github'],
  ['MyMCPTools.vercel.app', '/', '?ref=x', 'https://mymcptools.com/?ref=x'],
  ['mymcptools.vercel.app:443', '/pricing', '', 'https://mymcptools.com/pricing'],
  ['mymcptools.vercel.app', '/api/webhook', '', null],
  ['mymcptools.vercel.app', '/api/mcp', '', null],
  ['mymcptools.vercel.app', '/api', '', null],
  ['mymcptools.com', '/servers/github', '', null],
  ['www.mymcptools.com', '/', '', null],
  ['mymcptools-git-main-shib.vercel.app', '/', '', null],
  [null, '/', '', null],
];
for (const [host, path, search, want] of cases) {
  const got = h.canonicalRedirectFor(host, path, search);
  if (got !== want) fail(`canonicalRedirectFor(${host}, ${path}${search}) = ${got}, want ${want}`);
}
const mw = src('src/middleware.ts');
if (!/canonicalRedirectFor\(/.test(mw) || !/redirect\(target, 308\)/.test(mw)) fail('middleware does not apply the 308');

// 3. compare links + CDN headers
const alt = src('src/app/alternatives/[slug]/page.tsx');
if (!/comparisonSlugs\.has\(compareSlug\)/.test(alt)) fail('alternatives/[slug] links /compare pairs without checking they exist');
const CDN_CACHED = [
  'src/app/api/v1/servers/[slug]/badge/route.ts',
  'src/app/api/v1/servers/[slug]/sparkline/route.ts',
  'src/app/api/listing-status/[slug]/route.ts',
];
for (const p of CDN_CACHED) {
  if (!/s-maxage=\d+/.test(src(p))) fail(`${p} lost its s-maxage Cache-Control`);
}

if (failures) {
  console.log(`cache-config-selfcheck: ${failures} failure(s)`);
  process.exit(1);
}
console.log(`cache-config-selfcheck: OK (${STATIC_ONLY.length} static routes, ${cases.length} host cases, ${CDN_CACHED.length} cached endpoints)`);
