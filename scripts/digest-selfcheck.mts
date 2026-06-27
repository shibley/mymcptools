/**
 * Self-check for the daily digest (PRD P1-1 acceptance: "newly dead / drifted /
 * recovered → content engine").
 *
 * Builds a synthetic probe-events history covering each bucket — a dead
 * transition (GOOD→DOWN), a drift event, a recovery (DOWN→GOOD), and a
 * no-change control — and asserts computeDigest buckets them correctly and the
 * Markdown renderer mentions each affected server. Pure functions only, no
 * network. Exits non-zero on failure.
 *
 * Run: node scripts/digest-selfcheck.mts
 */
import assert from 'node:assert/strict';
import {
  computeDigest,
  renderDigestMarkdown,
  type ProbeEventRow,
} from '../src/lib/trust/digest.ts';
import type { ProbeResult, DriftEvent } from '../src/lib/trust/types.ts';

// Anchor "now" so window math is deterministic. Window = last 24h.
const NOW = Date.parse('2026-06-22T12:00:00.000Z');
const WINDOW_HOURS = 24;

/** Hours-before-NOW → ISO timestamp. */
function hoursAgo(h: number): string {
  return new Date(NOW - h * 3_600_000).toISOString();
}

function probe(slug: string, verdict: ProbeResult['verdict'], h: number, extra: Partial<ProbeResult> = {}): ProbeResult {
  return {
    slug,
    verdict,
    latency_ms: 100,
    negotiated_protocol_version: '2025-06-18',
    tool_count: verdict === 'GOOD' ? 5 : null,
    checked_at: hoursAgo(h),
    ...extra,
  };
}

function drift(slug: string, h: number, extra: Partial<DriftEvent> = {}): DriftEvent {
  return {
    type: 'drift',
    slug,
    changed_at: hoursAgo(h),
    schema_changed: true,
    prev_schema_hash: 'aaa',
    schema_hash: 'bbb',
    tool_diff: { added: ['create'], removed: ['list'], changed: ['search'] },
    protocol_version_changed: false,
    prev_protocol_version: null,
    negotiated_protocol_version: null,
    ...extra,
  };
}

const events: ProbeEventRow[] = [
  // deadguy: GOOD (older) → DOWN inside window. NEWLY DEAD.
  probe('deadguy', 'GOOD', 30),
  probe('deadguy', 'GOOD', 20),
  probe('deadguy', 'DOWN', 6, { failure_reason: 'handshake failed: ECONNREFUSED' }),
  probe('deadguy', 'DOWN', 2),

  // driftguy: stable GOOD, but emits a drift event inside window. DRIFTED.
  probe('driftguy', 'GOOD', 20),
  probe('driftguy', 'GOOD', 4),
  drift('driftguy', 4),

  // recovguy: DOWN → GOOD inside window. RECOVERED.
  probe('recovguy', 'DOWN', 28),
  probe('recovguy', 'DOWN', 10),
  probe('recovguy', 'GOOD', 3),

  // steadyguy: GOOD throughout. NO-CHANGE CONTROL — must appear nowhere.
  probe('steadyguy', 'GOOD', 22),
  probe('steadyguy', 'GOOD', 5),

  // oldguy: GOOD → DOWN but the transition is OUTSIDE the window (30h ago).
  // Must NOT be reported as newly dead.
  probe('oldguy', 'GOOD', 40),
  probe('oldguy', 'DOWN', 30),
  probe('oldguy', 'DOWN', 28),

  // A malformed row (untrusted input) must be tolerated and ignored.
  { slug: 'garbage', verdict: 'NONSENSE' } as unknown as ProbeEventRow,
];

const digest = computeDigest(events, { windowHours: WINDOW_HOURS, nowMs: NOW });

// 1. newly_dead = exactly deadguy.
assert.equal(digest.newly_dead.length, 1, 'exactly one newly-dead server');
assert.equal(digest.newly_dead[0].slug, 'deadguy');
assert.equal(digest.newly_dead[0].from_verdict, 'GOOD');
assert.equal(digest.newly_dead[0].to_verdict, 'DOWN');
assert.equal(
  digest.newly_dead[0].failure_reason,
  'handshake failed: ECONNREFUSED',
  'failure reason carried through',
);

// 2. drifted = exactly driftguy, with the tool_diff summary preserved.
assert.equal(digest.drifted.length, 1, 'exactly one drifted server');
assert.equal(digest.drifted[0].slug, 'driftguy');
assert.equal(digest.drifted[0].schema_changed, true);
assert.deepEqual(digest.drifted[0].tool_diff, {
  added: ['create'],
  removed: ['list'],
  changed: ['search'],
});

// 3. recovered = exactly recovguy.
assert.equal(digest.recovered.length, 1, 'exactly one recovered server');
assert.equal(digest.recovered[0].slug, 'recovguy');
assert.equal(digest.recovered[0].from_verdict, 'DOWN');
assert.equal(digest.recovered[0].to_verdict, 'GOOD');

// 4. Control servers never appear in any bucket.
const allSlugs = new Set<string>([
  ...digest.newly_dead.map((e) => e.slug),
  ...digest.drifted.map((e) => e.slug),
  ...digest.recovered.map((e) => e.slug),
]);
assert.ok(!allSlugs.has('steadyguy'), 'steady server must appear nowhere');
assert.ok(!allSlugs.has('oldguy'), 'out-of-window transition must appear nowhere');
assert.ok(!allSlugs.has('garbage'), 'malformed rows must be ignored');

// 5. counts mirror the buckets.
assert.deepEqual(digest.counts, { newly_dead: 1, drifted: 1, recovered: 1 });

// 6. window metadata is sane.
assert.equal(digest.window_hours, WINDOW_HOURS);
assert.equal(digest.window_end, new Date(NOW).toISOString());
assert.equal(
  digest.window_start,
  new Date(NOW - WINDOW_HOURS * 3_600_000).toISOString(),
);

// 7. Markdown renderer mentions each affected server and is non-empty.
const md = renderDigestMarkdown(digest);
assert.ok(md.includes('deadguy'), 'markdown mentions newly-dead server');
assert.ok(md.includes('driftguy'), 'markdown mentions drifted server');
assert.ok(md.includes('recovguy'), 'markdown mentions recovered server');
assert.ok(!md.includes('steadyguy'), 'markdown omits the steady control');

// 8. A protocol-only drift (no tool_diff) is bucketed and rendered.
const protoOnly = computeDigest(
  [
    drift('protoguy', 5, {
      schema_changed: false,
      tool_diff: null,
      protocol_version_changed: true,
      prev_protocol_version: '2025-03-26',
      negotiated_protocol_version: '2025-06-18',
    }),
  ],
  { windowHours: WINDOW_HOURS, nowMs: NOW },
);
assert.equal(protoOnly.drifted.length, 1);
assert.equal(protoOnly.drifted[0].protocol_version_changed, true);
assert.equal(protoOnly.drifted[0].tool_diff, null);
assert.ok(renderDigestMarkdown(protoOnly).includes('2025-03-26'));

console.log('[digest-selfcheck] OK — all 8 assertion groups passed');
