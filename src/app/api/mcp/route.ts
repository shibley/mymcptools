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
function methodNotAllowed(message: string): Response {
  return Response.json(
    {
      jsonrpc: "2.0",
      error: { code: -32000, message },
      id: null,
    },
    { status: 405, headers: { Allow: "POST, OPTIONS" } }
  );
}

export async function POST(req: Request): Promise<Response> {
  const server = createMcpToolsServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — no session id issued or required
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    return await transport.handleRequest(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
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
    "This MCP endpoint is stateless and does not support server-initiated SSE streams. POST JSON-RPC requests to this URL instead."
  );
}

// No sessions exist, so there is nothing for a client to terminate.
export async function DELETE(): Promise<Response> {
  return methodNotAllowed("This MCP endpoint is stateless; there is no session to terminate.");
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
