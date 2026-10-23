/**
 * Self-check for /api/mcp/claude, the URL listed in Claude's connector
 * directory (claude.ai/directory), and the acknowledgments its submission makes:
 *
 *  - "Tool descriptions contain no instructions about model behavior, other
 *    tools, or external instruction sources, and no hidden or encoded text":
 *    no tool description or input-schema text names another tool, and all of
 *    it is plain printable text.
 *  - Directory Policy 4.C (no paid placement or promotion in tool output): the
 *    `featured` placement flag is absent, maker URLs carry no ref/utm params,
 *    and resources/list does not advertise the featured subset.
 *  - Policy 5.E: every tool carries title, readOnlyHint and destructiveHint.
 *  - Error text names no other tool.
 *
 * Drives the real route handler with synthetic requests — no network, no
 * warehouse (ANALYTICS_DATABASE_URL unset, so the recorder no-ops).
 *
 * Run: npx tsx scripts/claude-directory-selfcheck.mts
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const ROUTE = join(ROOT, 'src/app/api/mcp/claude/route.ts');

let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failed++;
}

check('src/app/api/mcp/claude/route.ts exists', existsSync(ROUTE));
if (!existsSync(ROUTE)) {
  console.log(`\n${failed} FAILED`);
  process.exit(1);
}

delete process.env.ANALYTICS_DATABASE_URL;
const claude = await import('../src/app/api/mcp/claude/route.ts');
const base = await import('../src/app/api/mcp/route.ts');

let id = 0;
async function rpc(handler: { POST: (r: Request) => Promise<Response> }, method: string, params: unknown = {}) {
  const res = await handler.POST(
    new Request('https://mymcptools.com/api/mcp/claude', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'user-agent': 'selfcheck' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
    })
  );
  const body = await res.json();
  return body.result ?? { error: body.error };
}

await rpc(claude, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'selfcheck', version: '1' } });
const tools: Array<{ name: string; description: string; inputSchema: unknown; annotations?: Record<string, unknown> }> =
  (await rpc(claude, 'tools/list')).tools ?? [];
const names = tools.map((t) => t.name);
check('tools/list answers with tools', tools.length >= 1, names.join(','));

const TEXT_OK = /^[\x20-\x7E—–‘’“”…]*$/;
for (const t of tools) {
  const others = names.filter((n) => n !== t.name && t.description.includes(n));
  check(`${t.name}: description names no other tool`, others.length === 0, others.join(','));
  const schema = JSON.stringify(t.inputSchema);
  const inSchema = names.filter((n) => n !== t.name && schema.includes(n));
  check(`${t.name}: input schema names no other tool`, inSchema.length === 0, inSchema.join(','));
  check(`${t.name}: description is plain printable text`, TEXT_OK.test(t.description));
  const a = t.annotations ?? {};
  check(`${t.name}: title + readOnlyHint true + destructiveHint false`,
    typeof a.title === 'string' && a.readOnlyHint === true && a.destructiveHint === false, JSON.stringify(a));
}

const search = await rpc(claude, 'tools/call', { name: 'search_mcp_servers', arguments: { query: 'court', limit: 50 } });
const searchText: string = search.content?.[0]?.text ?? '';
const parsed = JSON.parse(searchText || '{}');
const rows: Array<Record<string, unknown>> = parsed.results ?? [];
check('search returns results', rows.length > 0, `${rows.length}`);
check('no result carries the featured placement flag', rows.every((r) => !('featured' in r)));
check('no maker URL carries a ref/utm/affiliate param',
  !/[?&](ref|via|aff|affiliate|fpr|partner|utm_[a-z]+)=/i.test(searchText),
  (searchText.match(/https?:\/\/[^"\s]*[?&](ref|utm_[a-z]+)=[^"\s]*/i) ?? [''])[0]);

const missing = await rpc(claude, 'tools/call', { name: 'get_mcp_server', arguments: { slug: 'zz-not-a-server' } });
const missText: string = missing.content?.[0]?.text ?? '';
check('unknown slug is a tool error naming no other tool', missing.isError === true && !names.some((n) => missText.includes(n)), missText);

const res: Array<{ uri: string }> = (await rpc(claude, 'resources/list')).resources ?? [];
const perServer = res.filter((r) => r.uri.startsWith('mymcptools://server/'));
check('resources/list does not advertise the featured subset', perServer.length === 0, `${perServer.length} of ${res.length}`);

const init = await rpc(claude, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'selfcheck', version: '1' } });
check('server instructions name no tool', !names.some((n) => String(init.instructions ?? '').includes(n)));

// The default surface keeps its fields (other consumers read `featured`).
const baseSearch = await rpc(base, 'tools/call', { name: 'search_mcp_servers', arguments: { query: 'github', limit: 3 } });
const baseRows = JSON.parse(baseSearch.content?.[0]?.text ?? '{}').results ?? [];
check('/api/mcp still returns the featured field', baseRows.length > 0 && 'featured' in baseRows[0]);

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
