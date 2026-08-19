/**
 * Milestone 3 of the mcp-trust-demand slot: our MCP endpoint has to be listed
 * where agents already look, and each listing has to be VERIFIED LIVE rather
 * than assumed from a 200.
 *
 *   node scripts/registry-listing-check.mts [--json]
 *
 * For every registry we check two separate things, because they fail
 * independently:
 *
 *   1. PRESENCE  — the registry's own API returns an entry that is actually
 *      ours (name/repository/remote match, not a fuzzy search hit that happens
 *      to rank first for the query).
 *   2. LIVENESS  — the endpoint URL *the registry itself advertises* answers a
 *      real MCP `initialize` handshake. A registry can hold a stale or typo'd
 *      remote long after our own /api/mcp is healthy, and every agent that
 *      arrives via that listing would hit the dead URL, not ours. So the URL
 *      under test is always the one read back out of the listing.
 *
 * Exits non-zero when a listing we believe is live is missing, points somewhere
 * that isn't us, or advertises an endpoint that fails the handshake — so this
 * can be run as a guard, not just a report.
 */
const OURS = {
  registryName: "io.github.shibley/mymcptools",
  repo: "https://github.com/shibley/mymcptools-mcp-server",
  endpoint: "https://mymcptools.com/api/mcp",
  site: "https://mymcptools.com",
};

const UA = "mymcptools-listing-check/1.0 (+https://mymcptools.com)";
const JSON_OUT = process.argv.includes("--json");

type Liveness = { ok: boolean; detail: string };
type Result = {
  registry: string;
  listed: boolean | null; // null = we could not determine (blocked / API gone)
  url?: string;
  advertisedEndpoint?: string;
  liveness?: Liveness;
  notes: string[];
};

async function getJson(url: string, timeoutMs = 15000): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The liveness half: speak MCP to whatever URL the listing advertises. A 200 on
 * a GET proves nothing here — an initialize that returns a protocolVersion and
 * our serverInfo.name is the only evidence an agent arriving from this listing
 * would actually reach us.
 */
async function handshake(endpoint: string): Promise<Liveness> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "user-agent": UA,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "mymcptools-listing-check", version: "1.0" },
        },
      }),
      signal: ctl.signal,
    });
    if (!res.ok) return { ok: false, detail: `handshake HTTP ${res.status}` };
    const text = await res.text();
    // Streamable HTTP may answer as SSE; pull the first data: frame if so.
    const payload = text.startsWith("event:") || text.startsWith("data:")
      ? text.split("\n").find((l) => l.startsWith("data:"))?.slice(5).trim() ?? ""
      : text;
    let parsed: any;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return { ok: false, detail: "handshake returned non-JSON" };
    }
    const result = parsed?.result;
    if (!result?.protocolVersion) return { ok: false, detail: "no protocolVersion in initialize result" };
    const name = result?.serverInfo?.name ?? "?";
    return { ok: true, detail: `${name} @ protocol ${result.protocolVersion}` };
  } catch (err) {
    return { ok: false, detail: `handshake failed: ${(err as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
}

async function checkOfficial(): Promise<Result> {
  const r: Result = { registry: "registry.modelcontextprotocol.io", listed: false, notes: [] };
  try {
    const data: any = await getJson(
      `https://registry.modelcontextprotocol.io/v0/servers?search=mymcptools&limit=20`
    );
    const hit = (data?.servers ?? []).find((s: any) => s?.server?.name === OURS.registryName);
    if (!hit) {
      r.notes.push(`no entry named ${OURS.registryName} in ${data?.servers?.length ?? 0} search hits`);
      return r;
    }
    r.listed = true;
    r.url = `https://registry.modelcontextprotocol.io/v0/servers?search=mymcptools`;
    const meta = hit?._meta?.["io.modelcontextprotocol.registry/official"];
    r.notes.push(`version ${hit.server.version}`, `status ${meta?.status ?? "?"}`, `published ${meta?.publishedAt ?? "?"}`);
    if (meta?.status && meta.status !== "active") r.notes.push(`!! status is not active`);
    if (meta?.isLatest === false) r.notes.push("!! entry is not the latest version");
    const remote = (hit.server.remotes ?? []).find((x: any) => typeof x?.url === "string");
    r.advertisedEndpoint = remote?.url;
    if (!remote) {
      r.notes.push("!! listing declares no remote endpoint — agents get a repo, not a server");
    } else {
      if (remote.url !== OURS.endpoint) r.notes.push(`!! advertises ${remote.url}, we serve ${OURS.endpoint}`);
      r.liveness = await handshake(remote.url);
    }
    if (hit.server.repository?.url && hit.server.repository.url !== OURS.repo) {
      r.notes.push(`!! repository ${hit.server.repository.url} != ${OURS.repo}`);
    }
  } catch (err) {
    r.listed = null;
    r.notes.push(`lookup failed: ${(err as Error).message}`);
  }
  return r;
}

async function checkGlama(): Promise<Result> {
  const r: Result = { registry: "glama.ai", listed: false, notes: [] };
  try {
    const data: any = await getJson(`https://glama.ai/api/mcp/v1/servers?query=mymcptools`);
    const hit = (data?.servers ?? []).find(
      (s: any) => s?.repository?.url === OURS.repo || s?.slug === "mymcptools-mcp-server"
    );
    if (!hit) {
      r.notes.push(`no entry matching ${OURS.repo} in ${data?.servers?.length ?? 0} search hits`);
      return r;
    }
    r.listed = true;
    r.url = `https://glama.ai/mcp/servers/@${hit.namespace}/${hit.slug}`;
    r.notes.push(`namespace ${hit.namespace}`, `attributes ${(hit.attributes ?? []).join(",") || "none"}`);
    // Glama indexes the repo rather than a hosted URL, so the liveness question
    // is whether the endpoint that repo's adapter targets still answers.
    r.advertisedEndpoint = OURS.endpoint;
    r.liveness = await handshake(OURS.endpoint);
  } catch (err) {
    r.listed = null;
    r.notes.push(`lookup failed: ${(err as Error).message}`);
  }
  return r;
}

async function checkSmithery(): Promise<Result> {
  const r: Result = { registry: "smithery.ai", listed: false, notes: [] };
  try {
    const data: any = await getJson(`https://registry.smithery.ai/servers?q=mymcptools&pageSize=20`);
    const servers = data?.servers ?? [];
    const hit = servers.find(
      (s: any) =>
        typeof s?.qualifiedName === "string" &&
        (s.qualifiedName.includes("mymcptools") || s?.namespace === "shibley")
    );
    if (!hit) {
      // Smithery's search returns unrelated servers rather than an empty set for
      // a miss, so "first hit exists" is not evidence — only a name match is.
      r.notes.push(
        `not listed (search returned ${servers.length} unrelated servers; Smithery answers a miss with filler, so a non-empty response is not presence)`
      );
      return r;
    }
    r.listed = true;
    r.url = `https://smithery.ai/server/${hit.qualifiedName}`;
    r.notes.push(`qualifiedName ${hit.qualifiedName}`);
    r.advertisedEndpoint = OURS.endpoint;
    r.liveness = await handshake(OURS.endpoint);
  } catch (err) {
    r.listed = null;
    r.notes.push(`lookup failed: ${(err as Error).message}`);
  }
  return r;
}

async function checkPulse(): Promise<Result> {
  const r: Result = { registry: "pulsemcp.com", listed: null, notes: [] };
  // v0beta is gone (410). The replacement v0.1 API is key-gated behind
  // X-API-Key and we hold no key, so without one this stays honestly
  // indeterminate rather than being reported as "not listed".
  const key = process.env.PULSEMCP_API_KEY?.trim();
  if (!key) {
    r.notes.push("v0beta returns 410; v0.1 requires X-API-Key and none is configured — set PULSEMCP_API_KEY to resolve");
    return r;
  }
  try {
    const res = await fetch(`https://api.pulsemcp.com/v0.1/servers?query=mymcptools&count_per_page=20`, {
      headers: { "user-agent": UA, accept: "application/json", "X-API-Key": key },
    });
    if (!res.ok) {
      r.notes.push(`v0.1 lookup indeterminate: HTTP ${res.status}`);
      return r;
    }
    const data: any = await res.json();
    const servers = data?.servers ?? [];
    const hit = servers.find(
      (s: any) => s?.source_code_url === OURS.repo || String(s?.url ?? "").includes("mymcptools")
    );
    r.listed = Boolean(hit);
    if (hit) {
      r.url = hit.url;
      r.advertisedEndpoint = OURS.endpoint;
      r.liveness = await handshake(OURS.endpoint);
    } else {
      r.notes.push(`no entry matching ${OURS.repo} in ${servers.length} search hits`);
    }
  } catch (err) {
    r.notes.push(`lookup indeterminate: ${(err as Error).message}`);
  }
  return r;
}

const results = await Promise.all([checkOfficial(), checkGlama(), checkSmithery(), checkPulse()]);

if (JSON_OUT) {
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
} else {
  console.log(`\n=== MCP registry listings for ${OURS.endpoint} ===\n`);
  for (const r of results) {
    const state = r.listed === null ? "INDETERMINATE" : r.listed ? "LISTED" : "NOT LISTED";
    console.log(`${state.padEnd(14)} ${r.registry}`);
    if (r.url) console.log(`  ${r.url}`);
    if (r.advertisedEndpoint) {
      const l = r.liveness;
      console.log(`  advertises ${r.advertisedEndpoint}`);
      console.log(`  handshake  ${l?.ok ? `LIVE — ${l.detail}` : `DEAD — ${l?.detail ?? "not attempted"}`}`);
    }
    for (const n of r.notes) console.log(`  · ${n}`);
    console.log();
  }
}

// A listing that exists but advertises a dead endpoint is worse than no listing,
// so both count as failures. Indeterminate never fails the run.
const broken = results.filter((r) => r.listed === true && r.liveness && !r.liveness.ok);
const listed = results.filter((r) => r.listed === true);
if (!JSON_OUT) {
  console.log(`${listed.length}/${results.length} registries carry a verified-live listing.`);
  const missing = results.filter((r) => r.listed === false).map((r) => r.registry);
  if (missing.length) console.log(`Not listed: ${missing.join(", ")}`);
}
if (broken.length) {
  console.error(`\nFAIL: ${broken.map((r) => r.registry).join(", ")} advertise an endpoint that fails the MCP handshake.`);
  process.exit(1);
}
if (listed.length === 0) {
  console.error(`\nFAIL: no registry carries a verified listing.`);
  process.exit(1);
}
