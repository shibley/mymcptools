/**
 * Real MCP-handshake prober (PRD P0-2).
 *
 * For each remote inventory entry it performs the actual client connect
 * sequence over Streamable HTTP using the official SDK:
 *   initialize (negotiate protocol version, capture serverInfo/capabilities/
 *   session id) -> notifications/initialized -> ping -> tools/list.
 * This is NOT a status-code ping.
 *
 * STRICTLY READ-ONLY: only initialize / ping / tools/list are issued. A target
 * server's own tools are NEVER called. Server metadata is untrusted and never
 * executed.
 *
 * Verdict mapping (PRD P0-2):
 *   - handshake ok + >=1 tool                  -> GOOD
 *   - handshake ok + 0 tools / partial list    -> WARN
 *   - 401 + WWW-Authenticate: Bearer           -> AUTH_REQUIRED (+ auth URL)
 *   - 200 with HTML body / handshake failure   -> DOWN
 *
 * Outputs:
 *   src/data/probe-status.json   (derived current_status store, overwritten)
 *   src/data/probe-events.jsonl  (append-only ProbeResult history)
 *
 * Run: node scripts/mcp-probe.mts [--limit N] [--slug s1,s2]
 */
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type {
  InventoryEntry,
  ProbeResult,
  CurrentStatus,
  StatusStore,
  Verdict,
  Transport,
  DriftEvent,
} from '../src/lib/trust/types.ts';
import {
  toolHashes,
  schemaSetHash,
  diffToolSets,
  isEmptyDiff,
} from '../src/lib/trust/drift.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'src', 'data');
const INVENTORY = join(DATA, 'probe-inventory.json');
const STATUS_OUT = join(DATA, 'probe-status.json');
const EVENTS_OUT = join(DATA, 'probe-events.jsonl');

const CONNECT_TIMEOUT_MS = 15_000;
const LIST_TIMEOUT_MS = 12_000;
const CONCURRENCY = 4;
const CLIENT_INFO = { name: 'mymcptools-prober', version: '0.1.0' };

// ---- CLI args -------------------------------------------------------------
const args = process.argv.slice(2);
function argVal(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}
const limit = argVal('--limit') ? Number(argVal('--limit')) : undefined;
const slugFilter = argVal('--slug')?.split(',').map((s) => s.trim());

// ---- helpers --------------------------------------------------------------
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

function makeTransport(url: string, transport: Transport) {
  const u = new URL(url);
  return transport === 'sse'
    ? new SSEClientTransport(u)
    : new StreamableHTTPClientTransport(u);
}

interface RawInspect {
  status: number;
  contentType: string;
  wwwAuthenticate: string;
  bodySnippet: string;
  error?: string;
}

/** Minimal raw initialize POST to inspect HTTP-level signals (auth / HTML). */
async function rawInspect(url: string): Promise<RawInspect> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), CONNECT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: CLIENT_INFO,
        },
      }),
      signal: ctrl.signal,
    });
    const body = await res.text().catch(() => '');
    return {
      status: res.status,
      contentType: res.headers.get('content-type') ?? '',
      wwwAuthenticate: res.headers.get('www-authenticate') ?? '',
      bodySnippet: body.slice(0, 400),
    };
  } catch (e) {
    return {
      status: 0,
      contentType: '',
      wwwAuthenticate: '',
      bodySnippet: '',
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(t);
  }
}

function looksLikeAuth(raw: RawInspect, connectErr?: string): boolean {
  if (raw.status === 401) return true;
  if (/bearer/i.test(raw.wwwAuthenticate)) return true;
  const hay = `${raw.bodySnippet} ${connectErr ?? ''}`.toLowerCase();
  return /invalid_token|authentication required|unauthorized|oauth|www-authenticate/.test(hay);
}

function looksLikeHtml(raw: RawInspect): boolean {
  if (/text\/html/i.test(raw.contentType)) return true;
  const b = raw.bodySnippet.trimStart().toLowerCase();
  return b.startsWith('<!doctype') || b.startsWith('<html');
}

/** Extract an authorization-server / resource-metadata URL when present. */
async function extractAuthUrl(url: string, raw: RawInspect): Promise<string | undefined> {
  const m = raw.wwwAuthenticate.match(/(?:resource_metadata|as_uri)="?([^",\s]+)"?/i);
  if (m) return m[1];
  // Fall back to the RFC 9728 well-known protected-resource document.
  try {
    const u = new URL(url);
    const wk = `${u.origin}/.well-known/oauth-protected-resource`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5_000);
    const res = await fetch(wk, { signal: ctrl.signal }).finally(() => clearTimeout(t));
    if (res.ok) {
      const j = await res.json().catch(() => null) as { authorization_servers?: string[] } | null;
      if (j?.authorization_servers?.length) return j.authorization_servers[0];
      return wk;
    }
  } catch { /* ignore */ }
  return undefined;
}

interface ProbeInput {
  slug: string;
  url: string;
  transport: Transport;
}

async function probeOne(entry: ProbeInput): Promise<ProbeResult> {
  const checked_at = new Date().toISOString();
  const base = {
    slug: entry.slug,
    remote_endpoint: entry.url,
    transport: entry.transport,
    checked_at,
  };
  const t0 = Date.now();
  const client = new Client(CLIENT_INFO, { capabilities: {} });
  const transport = makeTransport(entry.url, entry.transport);

  try {
    // initialize + notifications/initialized handled by connect().
    await withTimeout(client.connect(transport), CONNECT_TIMEOUT_MS, 'connect');
    const proto = client.getServerVersion();
    const negotiated =
      (transport as { protocolVersion?: string }).protocolVersion ?? null;

    // ping (read-only liveness) — tolerate servers that omit it.
    try { await withTimeout(client.ping(), LIST_TIMEOUT_MS, 'ping'); } catch { /* non-fatal */ }

    let tool_count: number | null = null;
    let listErr: string | undefined;
    let tool_hashes: Record<string, string> | undefined;
    let tool_schema_hash: string | null = null;
    try {
      const tl = await withTimeout(client.listTools(), LIST_TIMEOUT_MS, 'tools/list');
      tool_count = tl.tools.length;
      // Untrusted server metadata: only read name/inputSchema for hashing;
      // nothing from the tool list is ever executed.
      tool_hashes = toolHashes(
        tl.tools.map((t) => ({ name: t.name, inputSchema: t.inputSchema })),
      );
      tool_schema_hash = schemaSetHash(tool_hashes);
    } catch (e) {
      listErr = e instanceof Error ? e.message : String(e);
    }
    const latency_ms = Date.now() - t0;
    await client.close().catch(() => {});

    let verdict: Verdict;
    let failure_reason: string | undefined;
    if (tool_count === null) {
      verdict = 'WARN';
      failure_reason = `handshake ok but tools/list failed: ${listErr}`;
    } else if (tool_count === 0) {
      verdict = 'WARN';
      failure_reason = 'speaks MCP but exposes zero tools';
    } else {
      verdict = 'GOOD';
    }
    return {
      ...base,
      verdict,
      latency_ms,
      negotiated_protocol_version: negotiated,
      tool_count,
      server_name: proto?.name,
      server_version: proto?.version,
      failure_reason,
      tool_hashes,
      tool_schema_hash,
    };
  } catch (connectErr) {
    const errMsg = connectErr instanceof Error ? connectErr.message : String(connectErr);
    await client.close().catch(() => {});
    const raw = await rawInspect(entry.url);
    const latency_ms = Date.now() - t0;

    if (looksLikeAuth(raw, errMsg)) {
      const auth_server_url = await extractAuthUrl(entry.url, raw);
      return {
        ...base,
        verdict: 'AUTH_REQUIRED',
        latency_ms,
        negotiated_protocol_version: null,
        tool_count: null,
        auth_server_url,
        failure_reason: `OAuth-gated (HTTP ${raw.status || 'n/a'}): ${errMsg}`,
      };
    }
    if (looksLikeHtml(raw)) {
      return {
        ...base,
        verdict: 'DOWN',
        latency_ms,
        negotiated_protocol_version: null,
        tool_count: null,
        failure_reason: `200/${raw.status} returned HTML, not an MCP endpoint`,
      };
    }
    return {
      ...base,
      verdict: 'DOWN',
      latency_ms,
      negotiated_protocol_version: null,
      tool_count: null,
      failure_reason: `handshake failed: ${errMsg}`,
    };
  }
}

// ---- concurrency pool -----------------------------------------------------
async function runPool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return results;
}

// ---- main -----------------------------------------------------------------
/** Prior current_status, keyed by slug, for drift comparison. Empty on first run. */
function loadPrevStatus(): Map<string, CurrentStatus> {
  try {
    const prev: StatusStore = JSON.parse(readFileSync(STATUS_OUT, 'utf8'));
    return new Map(prev.statuses.map((s) => [s.slug, s]));
  } catch {
    return new Map();
  }
}

async function main() {
  const inventory: InventoryEntry[] = JSON.parse(readFileSync(INVENTORY, 'utf8'));
  const prevStatus = loadPrevStatus();

  let remote = inventory.filter(
    (e): e is InventoryEntry & { remote_endpoint: string; transport: Transport } =>
      e.delivery === 'remote' && !!e.remote_endpoint && !!e.transport,
  );
  if (slugFilter) remote = remote.filter((e) => slugFilter.includes(e.slug));
  if (limit) remote = remote.slice(0, limit);

  console.log(`[probe] probing ${remote.length} remote endpoints (concurrency ${CONCURRENCY})`);

  const probeInputs: ProbeInput[] = remote.map((e) => ({
    slug: e.slug,
    url: e.remote_endpoint,
    transport: e.transport,
  }));
  const probeResults = await runPool(probeInputs, CONCURRENCY, probeOne);

  // Append every probe result to history (PRD P0-5 probe_events).
  for (const r of probeResults) appendFileSync(EVENTS_OUT, JSON.stringify(r) + '\n');

  // Index probeable results by slug for the derived store.
  const bySlug = new Map<string, ProbeResult>(probeResults.map((r) => [r.slug, r]));

  const generated_at = new Date().toISOString();
  const summary: Record<Verdict, number> = {
    GOOD: 0, WARN: 0, AUTH_REQUIRED: 0, DOWN: 0, UNPROBEABLE: 0,
  };

  const driftEvents: DriftEvent[] = [];

  // Build current_status for ALL inventory entries: probed ones get their
  // verdict, local ones are recorded UNPROBEABLE so the store is complete.
  const statuses: CurrentStatus[] = inventory.map((e) => {
    const r = bySlug.get(e.slug);
    if (r) {
      summary[r.verdict]++;
      const prev = prevStatus.get(r.slug);

      // Drift only applies to probes that actually returned a tools/list.
      let schema_hash: string | null = null;
      let schema_changed = false;
      let schema_changed_at: string | null = prev?.schema_changed_at ?? null;
      const tool_hashes = r.tool_hashes;
      let protocol_version_changed = false;
      const last_protocol_version = r.negotiated_protocol_version;

      if (r.tool_hashes) {
        schema_hash = r.tool_schema_hash ?? null;
        const prevHash = prev?.schema_hash ?? null;
        const prevToolHashes = prev?.tool_hashes;
        // First baseline (no prior hash) records the hash WITHOUT flagging
        // drift, so initial population never emits spurious events.
        if (prevHash !== null && prevHash !== schema_hash) {
          const tool_diff = diffToolSets(prevToolHashes ?? {}, r.tool_hashes);
          if (!isEmptyDiff(tool_diff)) {
            schema_changed = true;
            schema_changed_at = r.checked_at;
            driftEvents.push({
              type: 'drift',
              slug: r.slug,
              changed_at: r.checked_at,
              schema_changed: true,
              prev_schema_hash: prevHash,
              schema_hash,
              tool_diff,
              protocol_version_changed: false,
              prev_protocol_version: prev?.last_protocol_version ?? null,
              negotiated_protocol_version: r.negotiated_protocol_version,
            });
          }
        }
      }

      // Protocol-version drift is tracked independently of tool-schema drift.
      const prevProto = prev?.last_protocol_version ?? null;
      if (
        prevProto !== null &&
        last_protocol_version !== null &&
        prevProto !== last_protocol_version
      ) {
        protocol_version_changed = true;
        driftEvents.push({
          type: 'drift',
          slug: r.slug,
          changed_at: r.checked_at,
          schema_changed: false,
          prev_schema_hash: prev?.schema_hash ?? null,
          schema_hash,
          tool_diff: null,
          protocol_version_changed: true,
          prev_protocol_version: prevProto,
          negotiated_protocol_version: last_protocol_version,
        });
      }

      return {
        slug: r.slug,
        verdict: r.verdict,
        tool_count: r.tool_count,
        latency_ms: r.latency_ms,
        negotiated_protocol_version: r.negotiated_protocol_version,
        remote_endpoint: r.remote_endpoint,
        transport: r.transport,
        last_seen_good_at: r.verdict === 'GOOD' ? r.checked_at : null,
        checked_at: r.checked_at,
        failure_reason: r.failure_reason,
        auth_server_url: r.auth_server_url,
        schema_hash,
        schema_changed,
        schema_changed_at,
        tool_hashes,
        last_protocol_version,
        protocol_version_changed,
      };
    }
    summary.UNPROBEABLE++;
    return {
      slug: e.slug,
      verdict: 'UNPROBEABLE',
      tool_count: null,
      latency_ms: null,
      negotiated_protocol_version: null,
      last_seen_good_at: null,
      checked_at: generated_at,
      failure_reason: e.unprobeable_reason,
    };
  });

  // Append drift events to the same append-only history (PRD P0-4 / P0-5).
  for (const d of driftEvents) appendFileSync(EVENTS_OUT, JSON.stringify(d) + '\n');

  const store: StatusStore = { generated_at, summary, statuses };
  writeFileSync(STATUS_OUT, JSON.stringify(store, null, 2) + '\n');

  console.log('[probe] verdict breakdown (probed):');
  for (const r of probeResults) {
    console.log(
      `  ${r.verdict.padEnd(13)} ${r.slug.padEnd(14)} ` +
      `tools=${r.tool_count ?? '-'} ${r.latency_ms ?? '-'}ms ` +
      `proto=${r.negotiated_protocol_version ?? '-'}` +
      (r.failure_reason ? `  (${r.failure_reason})` : ''),
    );
  }
  console.log('[probe] summary:', JSON.stringify(summary));
  if (driftEvents.length) {
    console.log(`[probe] ${driftEvents.length} drift event(s):`);
    for (const d of driftEvents) {
      if (d.protocol_version_changed) {
        console.log(
          `  DRIFT(proto) ${d.slug}: ${d.prev_protocol_version} -> ${d.negotiated_protocol_version}`,
        );
      } else if (d.tool_diff) {
        const { added, removed, changed } = d.tool_diff;
        console.log(
          `  DRIFT(tools) ${d.slug}: +[${added.join(',')}] -[${removed.join(',')}] ~[${changed.join(',')}]`,
        );
      }
    }
  } else {
    console.log('[probe] no drift detected');
  }
  console.log(`[probe] wrote ${STATUS_OUT}`);
  console.log(`[probe] appended ${probeResults.length} probe + ${driftEvents.length} drift events to ${EVENTS_OUT}`);
}

main().catch((e) => {
  console.error('[probe] fatal:', e);
  process.exit(1);
});
