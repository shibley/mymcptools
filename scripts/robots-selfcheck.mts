/**
 * Self-check for robots.ts: no named crawler group may re-open the action
 * endpoints the `*` group closes.
 *
 * THE DEFECT THIS GUARDS (measured 2026-10-05, analytics.events): every one of
 * the 33 checkout rows tagged entry=server-page since the door went live
 * (2026-10-03 23:06Z) was bingbot GETting the buy form's action URL. Robots
 * groups do not inherit: `User-Agent: *` disallows /api/, but the named
 * `Bingbot`, `Googlebot`, `GPTBot`… groups each said only `Allow: /`, so the
 * crawlers that matter most were told the whole of /api/ was open. Bing is the
 * #1 human referrer to /servers/* (251 of 728 sessions/30d), so its crawl of
 * 2,458 server pages was being spent on a POST-only checkout endpoint.
 *
 * Rule: every group disallows ACTION_PATHS. /api/v1 and /api/mcp stay open to
 * named crawlers on purpose (they are read endpoints; behaviour unchanged).
 *
 * Run: npm run robots:selfcheck
 */
import * as mod from '../src/app/robots.ts';

// tsx may hand the module back CJS-wrapped; unwrap either shape.
const m = (typeof mod.default === 'function' ? mod : (mod.default as unknown)) as typeof mod & {
  ACTION_PATHS?: string[];
};
const robots = m.default;
const ACTION_PATHS = m.ACTION_PATHS;

const EXPECTED = ['/api/trust-api/', '/api/checkout', '/admin/'];
let failures = 0;
const fail = (m: string) => {
  failures++;
  console.log(`  FAIL ${m}`);
};

const out = robots();
const rules = Array.isArray(out.rules) ? out.rules : [out.rules];
const asList = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

for (const p of EXPECTED) {
  if (!(ACTION_PATHS ?? []).includes(p)) fail(`ACTION_PATHS lacks ${p}`);
}

for (const r of rules) {
  const agents = asList(r.userAgent).join(',');
  const dis = asList(r.disallow);
  const blocked = (path: string) => dis.some((d) => path.startsWith(d));
  for (const p of ['/api/trust-api/checkout?from=server-page&server=x', '/api/checkout', '/admin/']) {
    if (!blocked(p)) fail(`group ${agents}: ${p} is crawlable`);
  }
  if (agents !== '*') {
    for (const p of ['/api/v1/servers/x/status', '/api/mcp', '/servers/x']) {
      if (blocked(p)) fail(`group ${agents}: ${p} newly blocked (named crawlers kept it before)`);
    }
  }
}

console.log(failures ? `robots:selfcheck ${failures} failure(s)` : `robots:selfcheck OK (${rules.length} groups)`);
process.exit(failures ? 1 : 0);
