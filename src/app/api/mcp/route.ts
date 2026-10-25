// POST /api/mcp — MyMCPTools over the Model Context Protocol (streamable HTTP,
// stateless, JSON responses). The handlers live in @/lib/mcp/http, shared with
// /api/mcp/claude; see the notes there.

import { makeMcpHandlers } from "@/lib/mcp/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Ceiling for a tool call; every handler reads from in-process stores, so this
// is a guard against pathological input rather than an expected duration.
export const maxDuration = 30;

const handlers = makeMcpHandlers({ surface: "default", endpoint: "/api/mcp", docsPath: "/mcp-server" });

export const POST = handlers.POST;
export const GET = handlers.GET;
export const DELETE = handlers.DELETE;
export const OPTIONS = handlers.OPTIONS;
