// The MyMCPTools catalog + trust layer, exposed over the Model Context Protocol
// itself (served at /api/mcp). Every tool here is a thin projection over the
// SAME modules the public REST API reads from — src/data/servers.ts for the
// catalog and src/lib/trust/* for probe status, history, drift and incidents.
// No business logic lives in this file; if a number looks wrong it is wrong in
// the store, not here.
//
// Why a factory rather than a module-level singleton: the HTTP route runs
// stateless (a fresh transport per request, see src/app/api/mcp/route.ts), and
// an McpServer instance owns exactly one transport. Building per request keeps
// concurrent serverless invocations from fighting over one connection.

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  categories,
  getCategoriesWithCounts,
  getIntegrationsWithCounts,
  getServerBySlug,
  getRelatedServers,
  searchServers,
  servers,
  type MCPServer,
} from "@/data/servers";
import { getAllEvents, latestEventAt } from "@/lib/trust/events-store";
import { getDrifts } from "@/lib/trust/drift-store";
import { getHistory } from "@/lib/trust/history-store";
import { computeIncidents } from "@/lib/trust/incidents";
import { computeUptimeSparkline } from "@/lib/trust/sparkline";
import { computeCatalogStatsFromStore } from "@/lib/trust/stats";
import { getStaticSignal } from "@/lib/trust/static-signals-store";
import { allStatuses, generatedAt, getStatus, summary } from "@/lib/trust/status-store";

/** Public site origin, used to build canonical listing URLs in tool output. */
const SITE = "https://mymcptools.com";

/** Verdicts that mean "this server answered an MCP handshake". */
const SERVING = new Set(["GOOD", "WARN"]);

const MAX_SEARCH_LIMIT = 50;

/** Wrap any JSON-serializable payload as an MCP text result. */
function json(payload: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

/** Wrap a human-readable failure as an MCP tool error (not a protocol error). */
function fail(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * Catalog entry projected for the wire: the editorial fields plus the live
 * verdict from the trust layer, so a single search result already answers
 * "does this thing actually work right now?".
 */
function projectServer(s: MCPServer) {
  const status = getStatus(s.slug);
  return {
    slug: s.slug,
    name: s.name,
    description: s.description,
    author: s.author,
    categories: s.categories,
    integrations: s.integrations,
    install_type: s.install_type,
    install_command: s.install_command ?? null,
    github_url: s.github_url,
    // Whether that github_url was confirmed live against the GitHub API. API
    // consumers (and the Trust Registry) must not treat a null/unverified
    // source as a scoreable repo.
    source_verified: s.source_verified ?? false,
    verification: s.verification ?? 'unresolved',
    website_url: s.website_url ?? null,
    official: s.official ?? false,
    featured: s.featured ?? false,
    listing_url: `${SITE}/servers/${s.slug}`,
    // Live trust signal — null when this server has never been probed.
    verdict: status?.verdict ?? null,
    tool_count: status?.tool_count ?? null,
    last_checked_at: status?.checked_at ?? null,
  };
}

/** Case-insensitive membership test used by the tag/integration filters. */
function includesCi(haystack: readonly string[], needle: string): boolean {
  const n = needle.toLowerCase();
  return haystack.some((h) => h.toLowerCase() === n);
}

export function createMcpToolsServer(): McpServer {
  const server = new McpServer(
    { name: "mymcptools", version: "1.0.0" },
    {
      instructions:
        "MyMCPTools is a live-verified directory of Model Context Protocol servers. " +
        "Use search_mcp_servers to discover servers by keyword, category or integration, " +
        "get_mcp_server for full install details on one server, and get_server_status / " +
        "get_server_history / list_server_incidents to check whether a server is actually " +
        "reachable before recommending it. Every uptime figure comes from real MCP " +
        "handshakes against the server's remote endpoint, not from self-reported metadata.",
    }
  );

  // ---------------------------------------------------------------- tools --

  server.registerTool(
    "search_mcp_servers",
    {
      title: "Search MCP servers",
      description:
        "Search the MyMCPTools catalog of Model Context Protocol servers. Filter by free-text " +
        "query, category slug, integration slug (claude-desktop, cursor, vs-code, ...), install " +
        "type, or official status. Set only_verified to restrict to servers that answered a live " +
        "MCP handshake on the most recent probe. Results carry the live verdict for each server.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Free-text query matched against name, description, author and category."),
        category: z
          .string()
          .optional()
          .describe("Category slug, e.g. 'database'. See list_categories."),
        integration: z
          .string()
          .optional()
          .describe("Integration slug, e.g. 'claude-desktop' or 'cursor'."),
        install_type: z
          .enum(["npm", "pip", "binary", "docker", "source", "remote"])
          .optional()
          .describe("Restrict to one install mechanism."),
        official: z.boolean().optional().describe("Only first-party/official servers."),
        only_verified: z
          .boolean()
          .optional()
          .describe("Only servers whose latest probe verdict is GOOD or WARN."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_SEARCH_LIMIT)
          .optional()
          .describe(`Max results (default 10, max ${MAX_SEARCH_LIMIT}).`),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      const limit = args.limit ?? 10;

      // Reuse the catalog's own search rather than reimplementing matching.
      let rows: MCPServer[] = args.query?.trim() ? searchServers(args.query.trim()) : [...servers];

      if (args.category) rows = rows.filter((s) => includesCi(s.categories, args.category!));
      if (args.integration) rows = rows.filter((s) => includesCi(s.integrations, args.integration!));
      if (args.install_type) rows = rows.filter((s) => s.install_type === args.install_type);
      if (args.official) rows = rows.filter((s) => s.official === true);
      if (args.only_verified) {
        rows = rows.filter((s) => {
          const v = getStatus(s.slug)?.verdict;
          return v !== undefined && SERVING.has(v);
        });
      }

      const total = rows.length;
      return json({
        generated_at: generatedAt(),
        total_matches: total,
        returned: Math.min(total, limit),
        results: rows.slice(0, limit).map(projectServer),
      });
    }
  );

  server.registerTool(
    "get_mcp_server",
    {
      title: "Get one MCP server",
      description:
        "Full catalog entry for one MCP server by slug: description, author, install command, " +
        "repo, supported clients, current probe verdict, static repo-freshness signal for local " +
        "servers, and related servers in the same categories.",
      inputSchema: {
        slug: z.string().describe("Catalog slug, e.g. 'filesystem' or 'github'."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ slug }) => {
      const entry = getServerBySlug(slug);
      if (!entry) return fail(`No server with slug '${slug}'. Try search_mcp_servers first.`);

      return json({
        generated_at: generatedAt(),
        server: {
          ...projectServer(entry),
          stars: entry.stars ?? null,
          // Local (stdio) servers cannot be handshake-probed; their health
          // signal is repo freshness instead of a live verdict (PRD P1-3).
          static_signal: getStaticSignal(slug) ?? null,
          status: getStatus(slug) ?? null,
        },
        related: getRelatedServers(entry, 5).map((s) => ({
          slug: s.slug,
          name: s.name,
          description: s.description,
        })),
      });
    }
  );

  server.registerTool(
    "get_server_status",
    {
      title: "Get live MCP server status",
      description:
        "Current live-probe status for one server: verdict (GOOD / WARN / AUTH_REQUIRED / DOWN / " +
        "UNPROBEABLE), exposed tool count, handshake latency, negotiated protocol version, remote " +
        "endpoint, and when it was last seen healthy. Omit the slug to get the catalog-wide " +
        "verdict summary instead.",
      inputSchema: {
        slug: z
          .string()
          .optional()
          .describe("Catalog slug. Omit for the catalog-wide verdict rollup."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ slug }) => {
      if (!slug) {
        return json({
          generated_at: generatedAt(),
          summary: summary(),
          total_tracked: allStatuses().length,
        });
      }
      const status = getStatus(slug);
      if (!status) return fail(`No probe status for slug '${slug}'.`);
      return json({ generated_at: generatedAt(), status });
    }
  );

  server.registerTool(
    "get_server_history",
    {
      title: "Get MCP server uptime history",
      description:
        "Trailing probe history for one server plus a daily uptime sparkline — the reliability " +
        "signal behind the badge on mymcptools.com. Returns per-day uptime buckets and the raw " +
        "probe points (timestamp, verdict, latency).",
      inputSchema: {
        slug: z.string().describe("Catalog slug."),
        days: z
          .number()
          .int()
          .min(1)
          .max(90)
          .optional()
          .describe("Uptime window width in days (default 14, max 90)."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe("Max raw probe points returned (default 30, max 200)."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ slug, days, limit }) => {
      // A known-but-never-probed server is a 200 with an empty series; only an
      // unknown slug is an error (matches GET /api/v1/servers/{slug}/history).
      if (!getStatus(slug) && !getServerBySlug(slug)) {
        return fail(`No server with slug '${slug}'.`);
      }
      const points = getHistory(slug, limit ?? 30);
      return json({
        generated_at: generatedAt(),
        slug,
        uptime: computeUptimeSparkline(points, days ?? 14, generatedAt()),
        history: points,
      });
    }
  );

  server.registerTool(
    "list_server_incidents",
    {
      title: "List MCP server outage incidents",
      description:
        "Reconstructed outage incidents (contiguous runs of failed probes) across the catalog, " +
        "newest first. Each incident has a start, an end (or ongoing), a duration and the failure " +
        "reason. Filter to one server with slug, or to open outages with status='ongoing'.",
      inputSchema: {
        slug: z.string().optional().describe("Restrict to one server."),
        status: z
          .enum(["ongoing", "resolved"])
          .optional()
          .describe("Restrict by resolution state."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Max incidents returned (default 20, max 100)."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ slug, status, limit }) => {
      const { incidents, summary: incidentSummary } = computeIncidents(getAllEvents(), {
        slug,
        sinceMs: null,
        status: status ?? null,
        minDurationSeconds: null,
      });
      const take = limit ?? 20;
      return json({
        generated_at: generatedAt(),
        latest_event_at: latestEventAt(),
        summary: incidentSummary,
        total_matches: incidents.length,
        incidents: incidents.slice(0, take),
      });
    }
  );

  server.registerTool(
    "list_schema_drift",
    {
      title: "List MCP tool-schema drift",
      description:
        "Tool-schema and protocol-version drift events detected between successive probes — which " +
        "servers added, removed or changed tools, and when. Use this to spot breaking changes in a " +
        "server you depend on. Newest first.",
      inputSchema: {
        slug: z.string().optional().describe("Restrict to one server."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Max drift events returned (default 20, max 100)."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ slug, limit }) => {
      const rows = getDrifts({ slug });
      return json({
        generated_at: generatedAt(),
        total_matches: rows.length,
        drift_events: rows.slice(0, limit ?? 20),
      });
    }
  );

  server.registerTool(
    "list_categories",
    {
      title: "List catalog categories",
      description:
        "Every category and client integration in the MyMCPTools catalog, with the number of " +
        "servers in each. The slugs returned here are the valid values for the category and " +
        "integration filters on search_mcp_servers.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () =>
      json({
        total_servers: servers.length,
        categories: getCategoriesWithCounts(),
        integrations: getIntegrationsWithCounts(),
      })
  );

  server.registerTool(
    "get_catalog_stats",
    {
      title: "Get catalog-wide health stats",
      description:
        "Aggregate health of the whole MCP population: verdict breakdown, share of probeable " +
        "servers actually serving, transport mix, handshake latency percentiles, tool counts and " +
        "probe freshness. This is the 'how healthy is MCP right now?' headline number.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => json(computeCatalogStatsFromStore())
  );

  // ------------------------------------------------------------ resources --

  server.registerResource(
    "categories",
    "mymcptools://catalog/categories",
    {
      title: "MCP catalog categories",
      description: "All catalog categories and client integrations with server counts.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            { categories: getCategoriesWithCounts(), integrations: getIntegrationsWithCounts() },
            null,
            2
          ),
        },
      ],
    })
  );

  server.registerResource(
    "catalog-stats",
    "mymcptools://catalog/stats",
    {
      title: "MCP catalog health stats",
      description: "Catalog-wide live-probe health aggregates, regenerated each probe run.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(computeCatalogStatsFromStore(), null, 2),
        },
      ],
    })
  );

  // Per-server entries as addressable resources. The catalog is far too large
  // to enumerate in a resources/list response, so the list callback advertises
  // the featured subset and the template makes every other slug readable.
  server.registerResource(
    "server",
    new ResourceTemplate("mymcptools://server/{slug}", {
      list: async () => ({
        resources: servers
          .filter((s) => s.featured)
          .map((s) => ({
            uri: `mymcptools://server/${s.slug}`,
            name: s.name,
            description: s.description,
            mimeType: "application/json",
          })),
      }),
      complete: {
        slug: (value) => {
          const q = value.toLowerCase();
          return servers
            .filter((s) => s.slug.startsWith(q))
            .slice(0, 100)
            .map((s) => s.slug);
        },
      },
    }),
    {
      title: "MCP server entry",
      description:
        "One catalog entry as JSON: install details plus the live probe verdict. Any catalog " +
        "slug is readable, not just the featured ones listed here.",
      mimeType: "application/json",
    },
    async (uri, extra) => {
      // The SDK hands template variables via `extra`; fall back to parsing the
      // URI so a hand-constructed read still resolves.
      const fromVars = (extra as { slug?: string | string[] } | undefined)?.slug;
      const slug =
        (Array.isArray(fromVars) ? fromVars[0] : fromVars) ??
        decodeURIComponent(uri.href.split("/").pop() ?? "");

      const entry = getServerBySlug(slug);
      if (!entry) throw new Error(`No server with slug '${slug}'.`);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              { ...projectServer(entry), status: getStatus(slug) ?? null },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}

/** Category slugs, exported for the docs page so the two cannot drift apart. */
export const CATEGORY_SLUGS = categories.map((c) => c.slug);
