// POST /api/mcp/claude — the URL listed in Claude's connector directory
// (claude.ai/directory). Same tools and data as /api/mcp, with two things pinned:
//
//  - Telemetry rows carry path '/api/mcp/claude:<method>[:<tool>]', so directory
//    use reads apart from the registry scanners and agents on /api/mcp.
//  - surface 'claude-directory': no `featured` placement flag, no referral or
//    tracking params on maker URLs, no featured-only resource list, and factual
//    server instructions (Directory Policy 4C; descriptions name no other tool).
//
// Docs: /mcp-server#claude. Self-check: scripts/claude-directory-selfcheck.mts.

import { makeMcpHandlers } from "@/lib/mcp/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const handlers = makeMcpHandlers({
  surface: "claude-directory",
  endpoint: "/api/mcp/claude",
  docsPath: "/mcp-server#claude",
});

export const POST = handlers.POST;
export const GET = handlers.GET;
export const DELETE = handlers.DELETE;
export const OPTIONS = handlers.OPTIONS;
