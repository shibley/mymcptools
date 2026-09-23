/**
 * Self-check for PAID Trust Data API fulfilment (thread #241).
 *
 * THE DEFECT THIS GUARDS. `/api/trust-api/checkout` sells a $49/mo key and is
 * the only priced surface on this property. The Stripe webhook generated the
 * key, emailed it to the buyer as "active within 24 hours", emailed
 * shibley@gmail.com a JSON record to paste into `src/data/api-keys.json` and
 * redeploy, and stamped the session fulfilled. It wrote the key to nothing
 * `authenticate()` reads — `addApiKey()` had existed since the tier shipped and
 * was called from nowhere — so a paying subscriber's first request was
 * guaranteed 401 "That API key is not active". The sale was unattended right up
 * to the point where a human had to edit a file, which is thread #218's
 * listings defect one SKU later.
 *
 * What is asserted, with no Stripe, Resend or warehouse:
 *   1. a completed purchase ACTIVATES the key (it is in the store afterwards);
 *   2. activation happens BEFORE either email is sent;
 *   3. the customer mail says the key works NOW — and only when it does;
 *   4. a failing store never tells the customer the key is live, and escalates;
 *   5. a purchase is never left unrecorded AND unreported;
 *   6. the webhook route is actually wired to this path, and no longer ships
 *      the hand-edit-and-redeploy copy.
 *
 * Run: npx tsx scripts/trust-api-fulfilment-selfcheck.mts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  fulfilTrustApiPurchase,
  generateApiKey,
  type TrustApiFulfilmentDeps,
} from '../src/lib/api/trust-api-fulfilment.ts';
import type { ApiKeyRecord } from '../src/lib/api/key-store.ts';

let failures = 0;
async function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ok    ${name}`);
  } catch (err) {
    failures += 1;
    console.log(`  FAIL  ${name}\n        ${(err as Error).message.split('\n')[0]}`);
  }
}

interface Sent {
  to: string;
  subject: string;
  html: string;
}

/** A fake store + mailer that records the ORDER the two were touched in. */
function harness(opts: { failStore?: boolean } = {}) {
  const store: ApiKeyRecord[] = [];
  const sent: Sent[] = [];
  const order: string[] = [];
  const deps: TrustApiFulfilmentDeps = {
    addKey: async (record) => {
      order.push('addKey');
      if (opts.failStore) throw new Error('warehouse unreachable');
      store.push(record);
    },
    sendEmail: async (to, subject, html) => {
      order.push(`email:${to}`);
      sent.push({ to, subject, html });
    },
    adminEmail: 'admin@example.com',
  };
  return { store, sent, order, deps };
}

const META = {
  product: 'trust-api',
  plan: 'pro',
  email: '',
  use_case: 'agent registry liveness',
  entry_kind: 'gate',
  entry_endpoint: '/api/v1/drift',
  entry_via: '',
};

const INPUT = {
  meta: META,
  sessionId: 'cs_test_241',
  customerEmail: 'buyer@example.com',
  amountTotal: 4900,
};

console.log('\n=== paid Trust API fulfilment ===');

// ---- 1. the key is actually activated -------------------------------------
await check('a completed purchase puts the key in the store', async () => {
  const h = harness();
  const r = await fulfilTrustApiPurchase(INPUT, h.deps);
  assert.equal(r.activated, true, 'fulfilment reported no activation');
  assert.equal(h.store.length, 1, 'no key was written to the store');
  assert.equal(h.store[0].key, r.record.key);
  assert.equal(h.store[0].status, 'active');
  assert.match(h.store[0].key, /^mcpt_live_[0-9a-f]{48}$/);
});

await check('the purchase carries its attribution into the store', async () => {
  const h = harness();
  await fulfilTrustApiPurchase(INPUT, h.deps);
  assert.equal(h.store[0].stripe_session_id, 'cs_test_241');
  assert.equal(h.store[0].entry_kind, 'gate');
  assert.equal(h.store[0].entry_endpoint, '/api/v1/drift');
  assert.equal(h.store[0].amount_cents, 4900);
});

await check("Stripe's own customer_details email is used when metadata has none", async () => {
  const h = harness();
  const r = await fulfilTrustApiPurchase(INPUT, h.deps);
  assert.equal(r.record.email, 'buyer@example.com');
  assert.ok(h.sent.some((m) => m.to === 'buyer@example.com'), 'buyer was never mailed');
});

// ---- 2. ordering: activate, then claim ------------------------------------
await check('activation happens before any email is sent', async () => {
  const h = harness();
  await fulfilTrustApiPurchase(INPUT, h.deps);
  assert.equal(h.order[0], 'addKey', `first action was ${h.order[0]}, not activation`);
  assert.ok(h.order.slice(1).every((s) => s.startsWith('email:')));
});

// ---- 3. the copy tells the truth ------------------------------------------
await check('the customer is told the key works NOW, not in 24 hours', async () => {
  const h = harness();
  await fulfilTrustApiPurchase(INPUT, h.deps);
  const mail = h.sent.find((m) => m.to === 'buyer@example.com');
  assert.ok(mail, 'no customer mail');
  assert.match(mail!.html, /active now/i);
  assert.doesNotMatch(
    mail!.html,
    /within 24 hours/i,
    'a live key was still sold with a 24-hour wait'
  );
  assert.ok(mail!.html.includes(h.store[0].key), 'the mailed key is not the stored key');
});

await check('the admin mail is a receipt, not a work order', async () => {
  const h = harness();
  await fulfilTrustApiPurchase(INPUT, h.deps);
  const mail = h.sent.find((m) => m.to === 'admin@example.com');
  assert.ok(mail, 'no admin mail');
  assert.doesNotMatch(
    mail!.html,
    /Append this record to/i,
    'a successful sale still asks a human to hand-edit a file'
  );
  assert.match(mail!.html, /Activated:<\/strong> yes/i);
});

// ---- 4. failure is honest --------------------------------------------------
await check('a failing store never tells the customer the key is live', async () => {
  const h = harness({ failStore: true });
  const r = await fulfilTrustApiPurchase(INPUT, h.deps);
  assert.equal(r.activated, false);
  assert.match(String(r.error), /warehouse unreachable/);
  const mail = h.sent.find((m) => m.to === 'buyer@example.com');
  assert.ok(mail, 'no customer mail');
  assert.doesNotMatch(mail!.html, /active now/i, 'a dead key was sold as live');
  assert.match(mail!.html, /within 24 hours/i);
});

await check('a failed activation escalates with a recovery record', async () => {
  const h = harness({ failStore: true });
  const r = await fulfilTrustApiPurchase(INPUT, h.deps);
  const mail = h.sent.find((m) => m.to === 'admin@example.com');
  assert.ok(mail, 'no admin mail');
  assert.match(mail!.subject, /NOT ACTIVE/i, 'admin subject reads like a normal sale');
  assert.match(mail!.html, /analytics\.mcpt_api_keys/, 'no recovery SQL');
  assert.ok(mail!.html.includes(r.record.key), 'the lost key is not in the recovery mail');
});

// ---- 5. never silently lost ------------------------------------------------
await check('fulfilment never throws — a webhook 500 would remint keys on retry', async () => {
  const h = harness({ failStore: true });
  await assert.doesNotReject(() => fulfilTrustApiPurchase(INPUT, h.deps));
});

await check('a buyer with no email at all still reaches admin', async () => {
  const h = harness();
  const r = await fulfilTrustApiPurchase(
    { ...INPUT, customerEmail: null },
    h.deps
  );
  assert.equal(r.customerNotified, false);
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].to, 'admin@example.com');
  assert.equal(r.activated, true, 'an emailless purchase must still be activated');
});

await check('every key is unique', () => {
  const keys = new Set(Array.from({ length: 200 }, () => generateApiKey()));
  assert.equal(keys.size, 200);
});

// ---- 6. the live route is wired to it --------------------------------------
console.log('\n=== the webhook is on this path ===');

await check('the webhook fulfils through the activating path', () => {
  const src = readFileSync('src/app/api/webhook/route.ts', 'utf8');
  assert.match(src, /fulfilTrustApiPurchase/, 'trust-api branch does not fulfil');
  assert.match(src, /addKey:\s*addApiKey/, 'fulfilment is not wired to the key store');
});

await check('the webhook no longer mints a key it never stores', () => {
  const src = readFileSync('src/app/api/webhook/route.ts', 'utf8');
  assert.doesNotMatch(
    src,
    /mcpt_live_\$\{randomBytes/,
    'route still generates keys inline — it did that for months without storing one'
  );
  assert.doesNotMatch(
    src,
    /Append this record to/i,
    'route still ships the hand-edit-and-redeploy fulfilment copy'
  );
});

await check('the key store persists to the proven warehouse rail', () => {
  const src = readFileSync('src/lib/api/key-store.ts', 'utf8');
  assert.match(src, /analytics\.mcpt_api_keys/, 'addApiKey writes nowhere durable');
  assert.doesNotMatch(
    src,
    /@vercel\/blob/,
    'still on the blob store that has never been written to once'
  );
  assert.match(src, /export async function addApiKey/);
});

await check('the gate reads the same store the purchase writes', () => {
  const auth = readFileSync('src/lib/api/auth.ts', 'utf8');
  assert.match(auth, /isActiveStoredKey/, 'auth does not consult the self-serve store');
  const store = readFileSync('src/lib/api/key-store.ts', 'utf8');
  assert.match(store, /export async function isActiveStoredKey/);
});

console.log(
  failures === 0
    ? '\nAll trust-API fulfilment checks passed.'
    : `\n${failures} check(s) FAILED.`
);
process.exit(failures === 0 ? 0 : 1);
