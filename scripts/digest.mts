/**
 * Daily digest generator (PRD P1-1: "Daily digest (newly dead/drifted/
 * recovered) → content engine").
 *
 * Reads the append-only probe history + derived status store, computes the
 * digest for a lookback window (default 24h), and writes:
 *   src/data/digest-latest.json   (overwritten — latest digest)
 *   src/data/digest-latest.md     (overwritten — Markdown for content engine)
 *   src/data/digest-history.jsonl (append-only — one digest per run)
 * and emits the Markdown summary to stdout.
 *
 * All probe data is treated as untrusted input: malformed JSONL lines are
 * skipped, never executed. This script is pure IO — the bucketing logic lives
 * in src/lib/trust/digest.ts.
 *
 * Run: node scripts/digest.mts [--window-hours N]
 */
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { StatusStore } from '../src/lib/trust/types.ts';
import {
  computeDigest,
  renderDigestMarkdown,
  type ProbeEventRow,
} from '../src/lib/trust/digest.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'src', 'data');
const STATUS_IN = join(DATA, 'probe-status.json');
const EVENTS_IN = join(DATA, 'probe-events.jsonl');
const DIGEST_JSON_OUT = join(DATA, 'digest-latest.json');
const DIGEST_MD_OUT = join(DATA, 'digest-latest.md');
const DIGEST_HISTORY_OUT = join(DATA, 'digest-history.jsonl');

// ---- CLI args -------------------------------------------------------------
const args = process.argv.slice(2);
function argVal(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}
const windowHours = argVal('--window-hours')
  ? Number(argVal('--window-hours'))
  : 24;
if (!Number.isFinite(windowHours) || windowHours <= 0) {
  console.error(
    `[digest] invalid --window-hours "${argVal('--window-hours')}" (expected positive number)`,
  );
  process.exit(1);
}

// ---- read inputs ----------------------------------------------------------
/** Parse the JSONL history, skipping malformed lines (untrusted input). */
function loadEvents(): ProbeEventRow[] {
  let raw: string;
  try {
    raw = readFileSync(EVENTS_IN, 'utf8');
  } catch {
    console.warn(`[digest] no events file at ${EVENTS_IN} — empty history`);
    return [];
  }
  const rows: ProbeEventRow[] = [];
  let skipped = 0;
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      rows.push(JSON.parse(trimmed) as ProbeEventRow);
    } catch {
      skipped++;
    }
  }
  if (skipped) console.warn(`[digest] skipped ${skipped} malformed JSONL line(s)`);
  return rows;
}

function loadStatus(): StatusStore | null {
  try {
    return JSON.parse(readFileSync(STATUS_IN, 'utf8')) as StatusStore;
  } catch {
    return null;
  }
}

// ---- main -----------------------------------------------------------------
function main() {
  const events = loadEvents();
  const status = loadStatus();

  const digest = computeDigest(events, { windowHours, status });
  const markdown = renderDigestMarkdown(digest);

  writeFileSync(DIGEST_JSON_OUT, JSON.stringify(digest, null, 2) + '\n');
  writeFileSync(DIGEST_MD_OUT, markdown + '\n');
  appendFileSync(DIGEST_HISTORY_OUT, JSON.stringify(digest) + '\n');

  // Human-readable summary to stdout for the content engine / logs.
  console.log(markdown);
  console.log('');
  console.log(
    `[digest] window=${windowHours}h ` +
      `newly_dead=${digest.counts.newly_dead} ` +
      `drifted=${digest.counts.drifted} ` +
      `recovered=${digest.counts.recovered}`,
  );
  console.log(`[digest] wrote ${DIGEST_JSON_OUT}`);
  console.log(`[digest] wrote ${DIGEST_MD_OUT}`);
  console.log(`[digest] appended digest to ${DIGEST_HISTORY_OUT}`);
}

main();
