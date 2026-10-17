/**
 * Self-check for the AI-VISIBILITY DOOR (src/lib/ai-visibility-door.ts): a maker
 * who just submitted an MCP server is handed a prefilled aisotools free scan
 * that leads to the $19/mo weekly tracking plan.
 *
 * Guards: the href fills all three /audit fields (tool, category, website) so
 * the maker types nothing; it carries the dist ref in utm_* (the beacon keeps
 * utm only); it falls back to the repo when no website was given and is absent
 * when neither is a URL; and both maker moments (success screen, ack mail)
 * render it WITHOUT displacing the $9 Featured door.
 *
 * Run: npm run visibility:selfcheck
 */
import { readFileSync } from 'node:fs';
import {
  AI_VISIBILITY_CAMPAIGN,
  aiVisibilityDoorHref,
  aiVisibilityCategory,
} from '../src/lib/ai-visibility-door.ts';

let failures = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok    ${name}`);
  } catch (err) {
    failures += 1;
    console.log(`  FAIL  ${name}: ${(err as Error).message}`);
  }
}
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log('ai-visibility door selfcheck');

check('href fills all three /audit fields and the dist ref', () => {
  const href = aiVisibilityDoorHref(
    { toolName: 'Acme DB MCP', category: 'database', website: 'https://acme.dev', github: 'https://github.com/acme/db-mcp' },
    'submit-success',
  );
  assert(href, 'no href');
  const u = new URL(href!);
  assert(u.origin + u.pathname === 'https://aisotools.com/audit', `wrong target ${u.origin}${u.pathname}`);
  assert(u.searchParams.get('tool') === 'Acme DB MCP', 'tool');
  assert(u.searchParams.get('category') === 'MCP servers for databases', `category ${u.searchParams.get('category')}`);
  assert(u.searchParams.get('website') === 'https://acme.dev', 'website prefers own site');
  assert(u.searchParams.get('utm_source') === 'mymcptools', 'utm_source');
  assert(u.searchParams.get('utm_medium') === 'submit-success', 'utm_medium');
  assert(u.searchParams.get('utm_campaign') === AI_VISIBILITY_CAMPAIGN, 'utm_campaign');
});

check('falls back to the repo; absent when neither is a URL', () => {
  const href = aiVisibilityDoorHref({ toolName: 'x', github: 'https://github.com/a/b' }, 'submit-ack');
  assert(new URL(href!).searchParams.get('website') === 'https://github.com/a/b', 'repo fallback');
  assert(aiVisibilityDoorHref({ toolName: 'x', website: 'not a url' }, 'submit-ack') === null, 'junk url must give null');
  assert(aiVisibilityDoorHref({ toolName: '  ', website: 'https://a.dev' }, 'submit-ack') === null, 'blank name must give null');
});

check('unknown category still asks a real buyer question', () => {
  assert(aiVisibilityCategory('nope') === 'MCP servers', 'fallback phrase');
});

check('success screen renders the door below the $9 Featured door', () => {
  const src = readFileSync(new URL('../src/app/submit/page.tsx', import.meta.url), 'utf8');
  const featured = src.indexOf('data-maker-door="submit-success"');
  const door = src.indexOf('data-ai-visibility-door="submit-success"');
  assert(featured > -1, 'Featured door missing from success screen');
  assert(door > -1, 'AI-visibility door missing from success screen');
  assert(door > featured, 'AI-visibility door must sit below the Featured door');
  assert(/aiVisibilityDoorHref\(sent\.fields, "submit-success"\)/.test(src), 'success door not built from the submitted fields');
});

check('ack mail carries the door', () => {
  const src = readFileSync(new URL('../src/app/api/submit/route.ts', import.meta.url), 'utf8');
  assert(/aiVisibilityEmailBlock\(fields\)/.test(src), "ack mail does not build the door");
  assert(src.indexOf('ackDoorEmailBlock(') < src.indexOf('aiVisibilityEmailBlock('), 'ack-mail door must follow the Featured block');
});

if (failures) {
  console.log(`\n${failures} FAIL`);
  process.exit(1);
}
console.log('\nall ok');
