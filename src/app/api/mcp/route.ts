// POST /api/mcp — MyMCPTools served over the Model Context Protocol itself,
// via the streamable-HTTP transport. The catalog and the live trust/uptime data
// that back mymcptools.com are exposed as MCP tools and resources, so an agent
// can ask "which MCP servers do X, and are they actually up?" without touching
// the REST API or an API key.
//
// Stateless by design: `sessionIdGenerator: undefined` disables session
// tracking, and a fresh McpServer + transport is built per request. Vercel
// serverless invocations are not sticky, so any in-memory session map would be
// a correctness bug the moment a second instance warmed up. `enableJsonResponse`
// makes each POST a plain JSON reply rather than an SSE stream, which is what
// a stateless request/response function can actually deliver.

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpToolsServer } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Ceiling for a tool call; every handler reads from in-process stores, so this
// is a guard against pathological input rather than an expected duration.
export const maxDuration = 30;

/** JSON-RPC error response for methods this endpoint does not implement. */
function methodNotAllowed(httpMethod: string, message: string): Response {
  // Worth counting too: a client trying GET/DELETE is a real client, and the
  // 405 rate is the signal for whether SSE-only clients are being turned away.
  logMcpRequest({ method: null, http: httpMethod, status: 405 });
  return Response.json(
    {
      jsonrpc: "2.0",
      error: { code: -32000, message },
      id: null,
    },
    { status: 405, headers: { Allow: "POST, OPTIONS" } }
  );
}

/**
 * One structured line per request, to Vercel's log drain via stdout.
 *
 * Nothing currently records whether any agent actually calls this endpoint, which
 * makes every usage-based question about it unanswerable. This is deliberately
 * observation-only: no storage, no cookies, no request body persisted. It reads
 * the JSON-RPC envelope (`method`, and the tool/resource name for calls) plus the
 * client's self-reported name from `initialize`, and nothing else — the arguments
 * an agent passes are none of our business and may be sensitive.
 */
function logMcpRequest(fields: Record<string, unknown>): void {
  try {
    console.log(JSON.stringify({ evt: "mcp_request", ...fields }));
  } catch {
    // Logging must never be able to fail a request.
  }
}

/**
 * Pull only the envelope fields worth logging off a cloned body. Returns nulls
 * rather than throwing on anything malformed — an unparseable body is the
 * transport's problem to report, not this function's.
 */
async function peekEnvelope(req: Request): Promise<{
  method: string | null;
  target: string | null;
  client: string | null;
  batch: number | null;
}> {
  const empty = { method: null, target: null, client: null, batch: null };
  try {
    const body: unknown = await req.clone().json();
    // A batch is legal JSON-RPC; log its size and the first method as a sample.
    const first = Array.isArray(body) ? body[0] : body;
    const batch = Array.isArray(body) ? body.length : null;
    if (!first || typeof first !== "object") return { ...empty, batch };
    const msg = first as Record<string, unknown>;
    const params = (msg.params ?? {}) as Record<string, unknown>;
    const clientInfo = (params.clientInfo ?? {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 120) : null);
    return {
      method: str(msg.method),
      // tools/call carries `name`; resources/read carries `uri`.
      target: str(params.name) ?? str(params.uri),
      client: str(clientInfo.name),
      batch,
    };
  } catch {
    return empty;
  }
}

export async function POST(req: Request): Promise<Response> {
  const startedAt = Date.now();
  const envelope = await peekEnvelope(req);
  const server = createMcpToolsServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — no session id issued or required
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    const res = await transport.handleRequest(req);
    logMcpRequest({ ...envelope, status: res.status, ms: Date.now() - startedAt });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    logMcpRequest({ ...envelope, status: 500, ms: Date.now() - startedAt, error: message });
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32603, message }, id: null },
      { status: 500 }
    );
  } finally {
    // Per-request instances must not outlive the request.
    await transport.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

// The spec lets a server that offers no server-initiated stream reject GET.
// Holding an SSE stream open is exactly what a stateless serverless function
// cannot do, so say so plainly instead of hanging the client until it times out.
export async function GET(): Promise<Response> {
  return methodNotAllowed(
    "GET",
    "This MCP endpoint is stateless and does not support server-initiated SSE streams. POST JSON-RPC requests to this URL instead."
  );
}

// No sessions exist, so there is nothing for a client to terminate.
export async function DELETE(): Promise<Response> {
  return methodNotAllowed("DELETE", "This MCP endpoint is stateless; there is no session to terminate.");
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-protocol-version, mcp-session-id, accept",
      "Access-Control-Max-Age": "86400",
    },
  });
}
