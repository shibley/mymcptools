/**
 * Self-check for the QUEUE-STATUS mail (src/lib/queue-status.ts): the one
 * follow-up to free submitters whose ack promised a 24-48h review and never
 * named the $9 Featured tier.
 *
 * THE DEFECT THIS GUARDS (2026-10-10): the ack-mail door went live 2026-10-09
 * and reached zero human makers (one headless submission since). Every maker
 * who submitted before that was told "we will review it within 24-48 hours" —
 * false for 39 of 40 since 2026-09-25 — and has no path to the only offer that
 * has ever sold on this property.
 *
 * Checks: the admin notification mail (the only store of submitted fields)
 * parses back into those fields; the selection never mails our own addresses,
 * a listed repo, a payer, a bounce, a maker who already had the door, or anyone
 * twice; the mail carries a prefilled `queue-status` door the checkout accepts;
 * the 24-48h correction appears only to makers who were actually told it.
 *
 * Run: npm run queue:selfcheck
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

const LIB = new URL('../src/lib/queue-status.ts', import.meta.url);
const ROUTE = 'src/app/api/submit/route.ts';
const door = await import('../src/lib/maker-door.ts');

// Same shape buildAdminEmailHtml emits (captured from a real 2026-10-05 send, fields replaced).
const row = (label: string, value: string) =>
  `<tr><td style="padding: 12px; border-bottom: 1px solid #1e293b; color: #94a3b8;">${label}</td><td style="padding: 12px; border-bottom: 1px solid #1e293b; color: #e2e8f0;">${value}</td></tr>`;
const ADMIN_HTML = `<div><h1>🟢 New MCP Server Submission</h1><table>
  ${row('Server Name', 'Acme &amp; Co MCP')}
  ${row('GitHub URL', '<a href="https://github.com/acme/acme-mcp" style="color: #60a5fa;">https://github.com/acme/acme-mcp</a>')}
  ${row('Repo', '✅ acme/acme-mcp — ★3, last push 2026-10-01')}
  ${row('Website', '<a href="https://acme.dev" style="color: #60a5fa;">https://acme.dev</a>')}
  ${row('Category', 'finance')}
  ${row('Install Type', 'npm')}
  ${row('Description', 'Read-only tools for Acme invoices.')}
  ${row('Submitter Email', '<a href="mailto:Dev@Acme.dev" style="color: #60a5fa;">Dev@Acme.dev</a>')}
</table></div>`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let q: any = null;
await check('queue-status module exists (src/lib/queue-status.ts)', async () => {
  ok(existsSync(LIB), 'missing — pre-door free submitters have no path to the $9 tier and a false 24-48h promise');
  q = await import(LIB.href);
});

await check('admin notification parses back into the submitted fields', () => {
  ok(q, 'no module');
  const route = readFileSync(ROUTE, 'utf8');
  for (const label of ['Server Name', 'GitHub URL', 'Website', 'Category', 'Install Type', 'Description', 'Submitter Email'])
    ok(route.includes(`>${label}</td>`), `admin template no longer has a "${label}" row — parser would go blind`);
  const s = q.parseAdminSubmission(ADMIN_HTML, '2026-10-01T10:00:00Z');
  ok(s, 'did not parse');
  ok(s.toolName === 'Acme & Co MCP', `toolName ${s.toolName}`);
  ok(s.email === 'dev@acme.dev', `email ${s.email}`);
  ok(s.github === 'https://github.com/acme/acme-mcp', `github ${s.github}`);
  ok(s.website === 'https://acme.dev' && s.category === 'finance' && s.installType === 'npm', 'website/category/install');
  ok(s.description === 'Read-only tools for Acme invoices.', 'description');
  ok(q.parseAdminSubmission('<p>nothing</p>', 'x') === null, 'parsed a mail with no table');
});

const base = { toolName: 'X', github: 'https://github.com/a/x', description: 'd', category: 'api', installType: 'npm', website: '' };
const sub = (o: Record<string, unknown>) => ({ ...base, email: 'maker@x.dev', submittedAt: '2026-10-01T00:00:00Z', ...o });

await check('selection: one mail per maker+repo, never internal/listed/paid/bounced/re-sent/already-doored', () => {
  ok(q, 'no module');
  const subs = [
    sub({ email: 'keep@a.dev', github: 'https://github.com/a/keep' }),
    sub({ email: 'keep@a.dev', github: 'https://github.com/a/keep/', submittedAt: '2026-09-20T00:00:00Z' }), // dup, older
    sub({ email: 'funnel-probe+maker@apistatuscheck.com', github: 'https://github.com/a/p' }),
    sub({ email: 'shibley@gmail.com', github: 'https://github.com/a/s' }),
    sub({ email: 'listed@a.dev', github: 'https://github.com/A/Listed.git' }),
    sub({ email: 'payer@a.dev', github: 'https://github.com/a/payer' }),
    sub({ email: 'bounce@a.dev', github: 'https://github.com/a/bounce' }),
    sub({ email: 'sent@a.dev', github: 'https://github.com/a/sent' }),
    sub({ email: 'late@a.dev', github: 'https://github.com/a/late', submittedAt: '2026-10-09T12:00:00Z' }),
    sub({ email: 'door@a.dev', github: 'https://github.com/a/door', ackHadDoor: true }),
    sub({ email: 'team@hosted.ai', github: 'https://github.com/hosted/docs-skill' }), // listed with github_url null
    sub({ email: 'me@gmail.com', github: 'https://github.com/a/site', website: 'https://www.hosted2.dev/mcp' }),
  ];
  const { send, skipped } = q.selectRecipients(subs, {
    listedRepos: new Set([door.normGithub('https://github.com/a/listed')]),
    listedHosts: new Set(['hosted.ai', 'hosted2.dev', 'gmail.com']),
    paidEmails: new Set(['payer@a.dev']),
    bounced: new Set(['bounce@a.dev']),
    alreadySent: new Set([q.ledgerKey({ email: 'sent@a.dev', github: 'https://github.com/a/sent' })]),
    doorLiveAt: '2026-10-09T09:00:00Z',
  });
  ok(send.length === 1 && send[0].email === 'keep@a.dev' && send[0].submittedAt === '2026-10-01T00:00:00Z', `send = ${send.map((s: { email: string }) => s.email)}`);
  const why = Object.fromEntries(skipped.map((s: { sub: { email: string; submittedAt: string }; reason: string }) => [`${s.sub.email}@${s.sub.submittedAt.slice(5, 10)}`, s.reason]));
  const want: Record<string, string> = {
    'keep@a.dev@09-20': 'duplicate', 'funnel-probe+maker@apistatuscheck.com@10-01': 'internal', 'shibley@gmail.com@10-01': 'internal',
    'listed@a.dev@10-01': 'listed', 'payer@a.dev@10-01': 'paid', 'bounce@a.dev@10-01': 'bounced', 'sent@a.dev@10-01': 'already-sent',
    'late@a.dev@10-09': 'has-door', 'door@a.dev@10-01': 'has-door',
    'team@hosted.ai@10-01': 'listed', 'me@gmail.com@10-01': 'listed',
  };
  for (const [k, v] of Object.entries(want)) ok(why[k] === v, `${k}: ${why[k]} (want ${v})`);
});

await check('mail carries a prefilled queue-status door the checkout whitelists', () => {
  ok(q, 'no module');
  ok(door.cleanDoorEntry('queue-status') === 'queue-status', 'checkout would drop entry queue-status from Stripe metadata');
  const s = sub({ toolName: 'Acme <b>MCP</b>', email: 'dev@acme.dev', website: 'https://acme.dev', promisedWindow: true });
  const u = new URL(q.queueStatusDoorHref(s), 'https://mymcptools.com');
  ok(u.pathname === '/submit' && u.hash === '#form', `path ${u.pathname}${u.hash}`);
  for (const [k, v] of [['tier', 'featured'], ['from', 'queue-status'], ['utm_source', 'maker-door'], ['utm_medium', 'queue-status'],
    ['email', 'dev@acme.dev'], ['github', s.github], ['name', s.toolName], ['category', 'api'], ['install', 'npm']])
    ok(u.searchParams.get(k) === v, `${k}=${u.searchParams.get(k)}`);
  ok(!u.searchParams.has('server'), 'an unlisted repo must not claim a catalog slug');
  const html: string = q.queueStatusEmailHtml(s, 'https://mymcptools.com');
  ok(/data-maker-door="queue-status"/.test(html) && /\$49 once/.test(html) && !/\$9 once/.test(html), 'no $49 door in the mail');
  ok(html.includes('https://mymcptools.com/submit?') && html.includes('from=queue-status'), 'door link not absolute');
  ok(!html.includes('<b>MCP</b>') && html.includes('Acme &lt;b&gt;MCP&lt;/b&gt;'), 'tool name not escaped');
  ok(/24-48 hours\. That was wrong/.test(html), 'promised maker gets no correction');
  ok(html.includes(door.FREE_QUEUE) && html.includes(door.FEATURED_LIVE), 'tier truth differs from the other surfaces');
  ok(/only follow-up/.test(html), 'mail does not say it is the only one');
  const plain: string = q.queueStatusEmailHtml({ ...s, promisedWindow: false }, 'https://mymcptools.com');
  ok(!/24-48/.test(plain), 'correction shown to a maker who was never promised 24-48h');
});

await check('sender script is dry-run by default and ledgers every send outside the repo', () => {
  const src = readFileSync('scripts/queue-status-mail.mts', 'utf8');
  ok(/const LIVE = argv\.includes\("--live"\)/.test(src) && /if \(!LIVE\)/.test(src), 'no dry-run default');
  ok(/clawd\/memory\/mymcptools-queue-status-ledger\.jsonl/.test(src), 'ledger not outside the repo');
  ok(/appendFileSync\(LEDGER/.test(src), 'sends are not ledgered');
  ok(!/bcc/i.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), 'bcc on outbound');
});

await check('cohort read attributes a payer by ledger email/repo even when Stripe dropped the entry tag', async () => {
  const q = await import(LIB.href);
  ok(typeof q.readQueueStatusCohort === 'function', 'no cohort read: the 72h checkpoint has no instrument');
  const sent = '2026-10-10T17:50:00Z';
  const t = (iso: string) => Math.floor(Date.parse(iso) / 1000);
  const ledger = [
    { email: 'Maker@Acme.dev', github: 'https://github.com/acme/mcp', sentAt: sent },
    { email: 'other@x.io', github: 'https://github.com/x/y', sentAt: sent },
    { email: 'funnel-probe+qs@apistatuscheck.com', github: 'https://github.com/p/p', sentAt: sent },
  ];
  const base = { status: 'complete', paymentStatus: 'paid', amountTotal: 900, entry: null as string | null, github: null as string | null };
  const r = q.readQueueStatusCohort(ledger, [
    { ...base, id: 'a', created: t('2026-10-11T01:00:00Z'), email: 'maker@acme.dev' },               // email, entry dropped pre-deploy
    { ...base, id: 'b', created: t('2026-10-11T02:00:00Z'), email: 'alt@else.com', github: 'https://github.com/X/y/' }, // repo match
    { ...base, id: 'c', created: t('2026-10-09T02:00:00Z'), email: 'other@x.io' },                     // paid BEFORE the mail
    { ...base, id: 'd', created: t('2026-10-11T03:00:00Z'), email: 'stranger@z.com', entry: 'queue-status', status: 'expired', paymentStatus: 'unpaid' },
    { ...base, id: 'e', created: t('2026-10-11T04:00:00Z'), email: 'funnel-probe+qs@apistatuscheck.com', entry: 'queue-status' },
    { ...base, id: 'f', created: t('2026-10-11T05:00:00Z'), email: 'nobody@n.com', entry: 'submit-ack' },
  ], new Date('2026-10-10T21:00:00Z'));
  ok(r.recipients === 2, `recipients ${r.recipients} (probe must not count)`);
  const ids = r.reachedStripe.map((h: { id: string; via: string }) => `${h.id}:${h.via}`).join(',');
  ok(ids === 'a:email,b:github,d:entry', `reached ${ids}`);
  ok(r.paid.length === 2 && r.cashCents === 1800 && r.payers === 2, `paid ${r.paid.length} cash ${r.cashCents}`);
  ok(r.checkpointAt === '2026-10-13T17:50:00.000Z' && r.hoursElapsed === 3 && r.due === false, `checkpoint ${r.checkpointAt} h${r.hoursElapsed} due ${r.due}`);
});

console.log(failures ? `\n${failures} check(s) failed` : '\nall queue-status checks passed');
process.exit(failures ? 1 : 0);
