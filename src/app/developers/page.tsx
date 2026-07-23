import type { Metadata } from "next";
import Link from "next/link";
import TrustApiCheckoutButton from "./TrustApiCheckoutButton";

export const metadata: Metadata = {
  title: "MCP Server Status API — Live Uptime & Drift Data | MyMCPTools",
  description:
    "The MCP server monitoring API: authoritative live health, uptime, latency and tool-schema drift data for Model Context Protocol servers. Query JSON/CSV endpoints, request an API key, or join the data-as-a-service waitlist.",
  keywords:
    "MCP server status API, MCP uptime data, MCP server monitoring API, MCP server health, Model Context Protocol API, MCP drift detection, MCP data feed",
  openGraph: {
    title: "MCP Server Status API — Live Uptime & Drift Data",
    description:
      "Authoritative live health, uptime and tool-schema drift data for Model Context Protocol servers. JSON + CSV endpoints, API keys, and a DaaS feed.",
    type: "website",
    url: "https://mymcptools.com/developers",
    siteName: "MyMCPTools",
  },
  twitter: {
    card: "summary_large_image",
    title: "MCP Server Status API — Live Uptime & Drift Data",
    description:
      "Authoritative live health, uptime and drift data for Model Context Protocol servers. JSON + CSV API endpoints.",
  },
  alternates: { canonical: "https://mymcptools.com/developers" },
};

const CONTACT_EMAIL = "shibley@mymcptools.com";

const accessMailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  "Trust Data API — request an API key"
)}&body=${encodeURIComponent(
  "Hi,\n\nI'd like an API key for the MyMCPTools Trust Data API.\n\nUse case: \nExpected volume (requests/day): \nCompany / project: \n\nThanks!"
)}`;

const waitlistMailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  "Trust Data feed (DaaS) — waitlist"
)}&body=${encodeURIComponent(
  "Hi,\n\nI'd like to join the waitlist for the MyMCPTools MCP health data feed (bulk export / DaaS).\n\nWhat I'm building: \nData I need (uptime / drift / latency / all): \nDelivery preference (API pull / CSV / webhook): \n\nThanks!"
)}`;

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-gray-800/80 px-1.5 py-0.5 text-[0.85em] text-blue-300 font-mono">
      {children}
    </code>
  );
}

function CodeBlock({ label, code }: { label?: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-950">
      {label && (
        <div className="border-b border-gray-800 bg-gray-900/60 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          {label}
        </div>
      )}
      <pre className="overflow-x-auto px-4 py-4 text-sm leading-relaxed text-gray-300">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

const valueProps = [
  {
    icon: "🛰️",
    title: "Live handshake verification",
    description:
      "Every remote server is probed with a real MCP initialize + tools/list handshake — not a ping. You get the negotiated protocol version, exposed tool count, and round-trip latency from an actual client session.",
  },
  {
    icon: "📉",
    title: "Drift detection no one else has",
    description:
      "We hash each server's tool-input schemas and diff them run-over-run. When a server adds, removes, or changes a tool — or bumps its protocol version — it's flagged with a timestamp. Catalogs like Smithery and Glama show a listing; we show whether it still works.",
  },
  {
    icon: "📊",
    title: "Rolling-window status, not a single ping",
    description:
      "Verdicts are smoothed over a failure window so a one-off blip doesn't read as an outage. Each row carries the raw verdict, consecutive-failure count, and when the effective status last changed.",
  },
  {
    icon: "🧾",
    title: "Bulk export, built for pipelines",
    description:
      "Pull the entire dataset as one JSON document or a flat RFC-4180 CSV. Drop it into a warehouse, a dashboard, or your own ranking model — the full inventory in a single authenticated request.",
  },
];

export default function DevelopersPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/15 to-emerald-500/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5">
              <span className="text-sm font-medium text-blue-400">⚡ Trust Data API · v1</span>
            </div>
            <h1 className="mb-6 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
              The{" "}
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
                MCP server status API
              </span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-xl leading-relaxed text-gray-400">
              Authoritative, live health data for Model Context Protocol servers —
              uptime, latency, negotiated protocol version, exposed tool count, and
              tool-schema drift. Queryable JSON endpoints and bulk CSV export, refreshed
              from real MCP handshakes.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <a
                href="#endpoints"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700"
              >
                View the endpoints
              </a>
              <a
                href="#access"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-800 px-8 py-4 font-semibold text-white transition hover:bg-gray-700"
              >
                Get API access →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Value prop */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
            Data the catalogs don&apos;t have
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-gray-400">
            Directories tell you a server exists. We tell you whether it&apos;s up right
            now, how fast it answers, and whether its tools changed underneath you.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {valueProps.map((p) => (
            <div
              key={p.title}
              className="rounded-xl border border-gray-800 bg-gray-900 p-6 transition hover:border-gray-700"
            >
              <div className="mb-3 text-3xl">{p.icon}</div>
              <h3 className="mb-2 text-lg font-semibold">{p.title}</h3>
              <p className="text-sm leading-relaxed text-gray-400">{p.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Authentication */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="mb-4 text-3xl font-bold">Authentication</h2>
        <p className="mb-4 max-w-3xl leading-relaxed text-gray-400">
          Every <Code>/api/v1</Code> endpoint requires an API key. Pass it on either an{" "}
          <Code>Authorization: Bearer &lt;key&gt;</Code> header or an{" "}
          <Code>x-api-key: &lt;key&gt;</Code> header. A missing or unknown key returns{" "}
          <Code>401</Code> with an <Code>unauthorized</Code> error body. The base URL is{" "}
          <Code>https://mymcptools.com</Code>.
        </p>
        <CodeBlock
          label="Authenticated request"
          code={`curl https://mymcptools.com/api/v1/status \\
  -H "Authorization: Bearer $MCPTOOLS_API_KEY"

# or, equivalently:
curl https://mymcptools.com/api/v1/status \\
  -H "x-api-key: $MCPTOOLS_API_KEY"`}
        />
      </section>

      {/* Rate limits */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="mb-4 text-3xl font-bold">Rate limits</h2>
        <p className="mb-4 max-w-3xl leading-relaxed text-gray-400">
          Requests are limited to <strong className="text-white">120 per minute, per key</strong>.
          Every response carries the current window state in standard headers. Exceeding
          the limit returns <Code>429</Code> with a <Code>Retry-After</Code> header.
        </p>
        <div className="overflow-hidden rounded-xl border border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-900/60 text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Header</th>
                <th className="px-4 py-3 font-medium">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-gray-300">
              <tr>
                <td className="px-4 py-3 font-mono text-blue-300">X-RateLimit-Limit</td>
                <td className="px-4 py-3">Max requests allowed per window (120).</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-blue-300">X-RateLimit-Remaining</td>
                <td className="px-4 py-3">Requests left in the current window.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-blue-300">X-RateLimit-Reset</td>
                <td className="px-4 py-3">Unix epoch (seconds) when the window resets.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-blue-300">Retry-After</td>
                <td className="px-4 py-3">
                  Seconds to wait before retrying — sent only on a <Code>429</Code>.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Endpoints */}
      <section id="endpoints" className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="mb-2 text-3xl font-bold">Endpoints</h2>
        <p className="mb-10 max-w-3xl leading-relaxed text-gray-400">
          Seven read-only endpoints. All responses are JSON unless you request CSV from
          the export endpoint or Markdown from the digest endpoint.
        </p>

        {/* GET /api/v1/status */}
        <div className="mb-12">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-400">
              GET
            </span>
            <code className="font-mono text-lg text-gray-100">/api/v1/status</code>
          </div>
          <p className="mb-4 max-w-3xl text-gray-400">
            Paginated list of every server&apos;s current status, plus a verdict summary.
          </p>

          <h4 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Query parameters
          </h4>
          <div className="mb-6 overflow-hidden rounded-xl border border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-900/60 text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Param</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-gray-300">
                <tr>
                  <td className="px-4 py-3 font-mono text-blue-300">filter</td>
                  <td className="px-4 py-3">
                    Set to <Code>healthy</Code> to return only servers currently serving
                    (verdict <Code>GOOD</Code> or <Code>WARN</Code>).
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-blue-300">updated_since</td>
                  <td className="px-4 py-3">
                    ISO-8601 timestamp. Returns only servers probed at or after this time.
                    A malformed value returns <Code>400</Code>.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-blue-300">limit</td>
                  <td className="px-4 py-3">
                    Page size. Defaults to <Code>50</Code>, capped at <Code>200</Code>.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-blue-300">cursor</td>
                  <td className="px-4 py-3">
                    Opaque offset for the next page — pass back the{" "}
                    <Code>next_cursor</Code> from the previous response.{" "}
                    <Code>offset</Code> is accepted as an alias.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CodeBlock
              label="Request"
              code={`curl "https://mymcptools.com/api/v1/status?filter=healthy&limit=2" \\
  -H "Authorization: Bearer $MCPTOOLS_API_KEY"`}
            />
            <CodeBlock
              label="200 Response (truncated)"
              code={`{
  "generated_at": "2026-06-30T11:00:00.000Z",
  "summary": {
    "GOOD": 142, "WARN": 11, "AUTH_REQUIRED": 7,
    "DOWN": 9, "UNPROBEABLE": 38
  },
  "pagination": {
    "total": 153,
    "limit": 2,
    "offset": 0,
    "next_cursor": "2"
  },
  "statuses": [
    {
      "slug": "supabase",
      "verdict": "GOOD",
      "tool_count": 23,
      "latency_ms": 412,
      "negotiated_protocol_version": "2025-06-18",
      "remote_endpoint": "https://mcp.supabase.com/mcp",
      "transport": "streamable-http",
      "last_seen_good_at": "2026-06-30T11:00:00.000Z",
      "checked_at": "2026-06-30T11:00:00.000Z",
      "status_changed_at": "2026-06-12T08:30:00.000Z",
      "schema_changed": false
    }
  ]
}`}
            />
          </div>
        </div>

        {/* GET /api/v1/servers/{slug}/status */}
        <div className="mb-12 border-t border-gray-800 pt-12">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-400">
              GET
            </span>
            <code className="font-mono text-lg text-gray-100">
              /api/v1/servers/{"{slug}"}/status
            </code>
          </div>
          <p className="mb-6 max-w-3xl text-gray-400">
            The current status for a single server by its directory slug. Returns{" "}
            <Code>404</Code> with a <Code>not_found</Code> body if the slug is unknown.
          </p>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CodeBlock
              label="Request"
              code={`curl https://mymcptools.com/api/v1/servers/supabase/status \\
  -H "x-api-key: $MCPTOOLS_API_KEY"`}
            />
            <CodeBlock
              label="200 Response (truncated)"
              code={`{
  "generated_at": "2026-06-30T11:00:00.000Z",
  "status": {
    "slug": "supabase",
    "verdict": "GOOD",
    "tool_count": 23,
    "latency_ms": 412,
    "negotiated_protocol_version": "2025-06-18",
    "transport": "streamable-http",
    "last_seen_good_at": "2026-06-30T11:00:00.000Z",
    "checked_at": "2026-06-30T11:00:00.000Z",
    "schema_changed": false,
    "schema_changed_at": null,
    "consecutive_failures": 0
  }
}`}
            />
          </div>
        </div>

        {/* GET /api/v1/servers/{slug}/history */}
        <div className="mb-12 border-t border-gray-800 pt-12">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-400">
              GET
            </span>
            <code className="font-mono text-lg text-gray-100">
              /api/v1/servers/{"{slug}"}/history
            </code>
          </div>
          <p className="mb-4 max-w-3xl text-gray-400">
            The trailing probe time-series for one server — the same data that powers the
            on-listing uptime sparkline — plus a derived uptime/latency summary. Use it to
            render your own trend view or compute a custom SLA window. A known server with
            no probes yet returns <Code>200</Code> with an empty <Code>history</Code> and{" "}
            <Code>summary.checks</Code> of <Code>0</Code>; an unknown slug returns{" "}
            <Code>404</Code>.
          </p>

          <h4 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Query parameters
          </h4>
          <div className="mb-6 overflow-hidden rounded-xl border border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-900/60 text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Param</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-gray-300">
                <tr>
                  <td className="px-4 py-3 font-mono text-blue-300">limit</td>
                  <td className="px-4 py-3">
                    Number of most-recent probe points to return, oldest&rarr;newest.
                    Defaults to <Code>30</Code>, capped at <Code>200</Code>. The summary is
                    computed over the returned window.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CodeBlock
              label="Request"
              code={`curl "https://mymcptools.com/api/v1/servers/supabase/history?limit=5" \\
  -H "x-api-key: $MCPTOOLS_API_KEY"`}
            />
            <CodeBlock
              label="200 Response (truncated)"
              code={`{
  "generated_at": "2026-06-30T11:00:00.000Z",
  "slug": "supabase",
  "summary": {
    "checks": 5,
    "uptime_pct": 80,
    "verdict_counts": { "GOOD": 4, "DOWN": 1 },
    "latency_p50_ms": 412,
    "latency_p95_ms": 611,
    "first_checked_at": "2026-06-26T11:00:00.000Z",
    "last_checked_at": "2026-06-30T11:00:00.000Z"
  },
  "history": [
    {
      "checked_at": "2026-06-30T11:00:00.000Z",
      "verdict": "GOOD",
      "latency_ms": 412
    }
  ]
}`}
            />
          </div>
        </div>

        {/* GET /api/v1/export */}
        <div className="border-t border-gray-800 pt-12">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-400">
              GET
            </span>
            <code className="font-mono text-lg text-gray-100">/api/v1/export</code>
          </div>
          <p className="mb-4 max-w-3xl text-gray-400">
            The full status dataset as a single download. Pass{" "}
            <Code>format=json</Code> (default) or <Code>format=csv</Code>; anything else
            returns <Code>400</Code>. The response carries a{" "}
            <Code>Content-Disposition</Code> attachment filename stamped with the date.
          </p>
          <p className="mb-6 max-w-3xl text-sm text-gray-500">
            CSV columns: <Code>slug</Code>, <Code>verdict</Code>, <Code>tool_count</Code>,{" "}
            <Code>latency_ms</Code>, <Code>negotiated_protocol_version</Code>,{" "}
            <Code>remote_endpoint</Code>, <Code>transport</Code>,{" "}
            <Code>last_seen_good_at</Code>, <Code>checked_at</Code>,{" "}
            <Code>status_changed_at</Code>, <Code>schema_changed</Code>,{" "}
            <Code>schema_changed_at</Code>, <Code>failure_reason</Code>,{" "}
            <Code>auth_server_url</Code>.
          </p>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CodeBlock
              label="Request (CSV)"
              code={`curl "https://mymcptools.com/api/v1/export?format=csv" \\
  -H "Authorization: Bearer $MCPTOOLS_API_KEY" \\
  -o mcptools-status.csv`}
            />
            <CodeBlock
              label="CSV Response (truncated)"
              code={`slug,verdict,tool_count,latency_ms,negotiated_protocol_version,...
supabase,GOOD,23,412,2025-06-18,...
vercel,WARN,0,883,2025-06-18,...
docker,DOWN,,,,...`}
            />
          </div>
        </div>

        {/* GET /api/v1/stats */}
        <div className="border-t border-gray-800 pt-12">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-400">
              GET
            </span>
            <code className="font-mono text-lg text-gray-100">/api/v1/stats</code>
          </div>
          <p className="mb-4 max-w-3xl text-gray-400">
            Catalog-wide health in a single object — the population headline without
            paginating every server. Verdict mix and percentages, the serving share of
            the probeable pool (the &ldquo;how many listed MCP servers actually work&rdquo;
            number), transport mix, drift counts, handshake latency{" "}
            <Code>p50</Code>/<Code>p95</Code>, tool totals, and probe freshness. No query
            parameters.
          </p>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CodeBlock
              label="Request"
              code={`curl https://mymcptools.com/api/v1/stats \\
  -H "Authorization: Bearer $MCPTOOLS_API_KEY"`}
            />
            <CodeBlock
              label="200 Response (truncated)"
              code={`{
  "generated_at": "2026-06-30T11:00:00.000Z",
  "total": 207,
  "verdicts": {
    "GOOD": 142, "WARN": 11, "AUTH_REQUIRED": 7,
    "DOWN": 9, "UNPROBEABLE": 38
  },
  "verdict_percent": { "GOOD": 68.6, "DOWN": 4.3, ... },
  "probeable": {
    "count": 169, "serving": 153, "serving_percent": 90.5
  },
  "transports": {
    "streamable-http": 148, "sse": 21, "none": 38
  },
  "drift": { "schema_changed": 2, "protocol_changed": 0 },
  "latency_ms": { "sampled": 153, "p50": 412, "p95": 1240 },
  "tools": { "total": 3184, "avg_per_serving": 20.8 },
  "freshness": {
    "probed_last_24h": 165,
    "oldest_checked_at": "2026-06-30T05:00:00.000Z",
    "newest_checked_at": "2026-06-30T11:00:00.000Z"
  }
}`}
            />
          </div>
        </div>

        {/* GET /api/v1/digest */}
        <div className="border-t border-gray-800 pt-12">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-400">
              GET
            </span>
            <code className="font-mono text-lg text-gray-100">/api/v1/digest</code>
          </div>
          <p className="mb-4 max-w-3xl text-gray-400">
            The &ldquo;what changed&rdquo; feed. Replays the probe-events history over a
            lookback window and returns three buckets &mdash; servers that{" "}
            <strong>newly went down</strong>, servers that <strong>drifted</strong>{" "}
            (tool-schema or protocol version), and servers that{" "}
            <strong>recovered</strong> &mdash; the change stream to alert on, distinct from{" "}
            <Code>/status</Code> (current snapshot) and <Code>/drift</Code> (drift rows
            only). Add <Code>format=md</Code> for a ready-to-publish Markdown summary.
          </p>

          <h4 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Query parameters
          </h4>
          <div className="mb-6 overflow-hidden rounded-xl border border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-900/60 text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Param</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-gray-300">
                <tr>
                  <td className="px-4 py-3 font-mono text-blue-300">window_hours</td>
                  <td className="px-4 py-3">
                    Lookback window in hours. Default <Code>24</Code>, max{" "}
                    <Code>720</Code> (30 days).
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-blue-300">as_of</td>
                  <td className="px-4 py-3">
                    ISO-8601 timestamp anchoring the window&apos;s end. Defaults to the
                    dataset&apos;s <Code>generated_at</Code>. A malformed value returns{" "}
                    <Code>400</Code>.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-blue-300">format</td>
                  <td className="px-4 py-3">
                    <Code>json</Code> (default) or <Code>md</Code> for a{" "}
                    <Code>text/markdown</Code> summary.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CodeBlock
              label="Request"
              code={`curl "https://mymcptools.com/api/v1/digest?window_hours=168" \\
  -H "Authorization: Bearer $MCPTOOLS_API_KEY"`}
            />
            <CodeBlock
              label="200 Response (truncated)"
              code={`{
  "dataset_generated_at": "2026-07-08T22:53:57.049Z",
  "latest_event_at": "2026-07-08T22:53:56.576Z",
  "window_hours": 168,
  "window_start": "2026-07-01T22:53:57.049Z",
  "window_end": "2026-07-08T22:53:57.049Z",
  "newly_dead": [
    {
      "slug": "example-server",
      "from_verdict": "GOOD", "to_verdict": "DOWN",
      "changed_at": "2026-07-08T05:12:00.000Z",
      "failure_reason": "connect ETIMEDOUT",
      "last_seen_good_at": "2026-07-07T05:00:00.000Z"
    }
  ],
  "drifted": [
    {
      "slug": "huggingface",
      "changed_at": "2026-07-08T22:52:34.058Z",
      "schema_changed": true,
      "protocol_version_changed": false,
      "tool_diff": { "added": [], "removed": ["hf_nav"], "changed": ["hf_fs"] }
    }
  ],
  "recovered": [],
  "counts": { "newly_dead": 1, "drifted": 1, "recovered": 0 }
}`}
            />
          </div>
        </div>

        {/* GET /api/v1/incidents */}
        <div className="border-t border-gray-800 pt-12">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-400">
              GET
            </span>
            <code className="font-mono text-lg text-gray-100">/api/v1/incidents</code>
          </div>
          <p className="mb-4 max-w-3xl text-gray-400">
            The status-page &ldquo;past incidents&rdquo; view. Replays the probe-events
            history and collapses each contiguous run of <Code>DOWN</Code> probes into a
            discrete <strong>outage incident</strong> with a{" "}
            <Code>started_at</Code>, an <Code>ended_at</Code> (or ongoing),{" "}
            <Code>duration_seconds</Code>, the verdict it recovered into, and the failure
            reason &mdash; plus a portfolio <Code>summary</Code> (total downtime, mean time
            to recovery). Distinct from <Code>/digest</Code> (last-N-hours transition
            buckets) and <Code>/servers/{"{slug}"}/history</Code> (raw probe points).
            Newest-first.
          </p>

          <h4 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Query parameters
          </h4>
          <div className="mb-6 overflow-hidden rounded-xl border border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-900/60 text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Param</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-gray-300">
                <tr>
                  <td className="px-4 py-3 font-mono text-blue-300">slug</td>
                  <td className="px-4 py-3">Only incidents for one server.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-blue-300">since</td>
                  <td className="px-4 py-3">
                    ISO-8601 &mdash; only incidents that <em>started</em> at/after this
                    time. A malformed value returns <Code>400</Code>.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-blue-300">status</td>
                  <td className="px-4 py-3">
                    <Code>ongoing</Code> or <Code>resolved</Code> &mdash; restrict by
                    resolution state.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-blue-300">
                    min_duration_seconds
                  </td>
                  <td className="px-4 py-3">
                    Drop resolved incidents shorter than this (noise floor). Ongoing
                    incidents are never filtered out.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-blue-300">limit</td>
                  <td className="px-4 py-3">
                    Page size. Default <Code>50</Code>, max <Code>200</Code>. Paginate with{" "}
                    <Code>cursor</Code> (or <Code>offset</Code>).
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CodeBlock
              label="Request"
              code={`curl "https://mymcptools.com/api/v1/incidents?status=resolved&limit=20" \\
  -H "Authorization: Bearer $MCPTOOLS_API_KEY"`}
            />
            <CodeBlock
              label="200 Response (truncated)"
              code={`{
  "generated_at": "2026-07-23T18:00:00.000Z",
  "latest_event_at": "2026-07-23T17:59:41.204Z",
  "summary": {
    "total": 12, "ongoing": 2, "resolved": 10,
    "total_downtime_seconds": 184920,
    "mean_time_to_recovery_seconds": 18492,
    "longest_downtime_seconds": 86400
  },
  "pagination": {
    "total": 12, "limit": 20, "offset": 0, "next_cursor": null
  },
  "incidents": [
    {
      "slug": "example-server",
      "started_at": "2026-07-22T05:12:00.000Z",
      "ended_at": "2026-07-22T08:39:00.000Z",
      "duration_seconds": 12420,
      "resolved": true,
      "recovery_verdict": "GOOD",
      "probe_count": 4,
      "first_failure_reason": "connect ETIMEDOUT",
      "last_failure_reason": "connect ETIMEDOUT",
      "last_seen_good_at": "2026-07-22T05:00:00.000Z"
    }
  ]
}`}
            />
          </div>
        </div>
      </section>

      {/* Status badges */}
      <section id="badges" className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="mb-2 text-3xl font-bold">Status badges</h2>
        <p className="mb-6 max-w-3xl text-gray-400">
          Embed a live health badge for your MCP server in a README or docs page. Unlike
          the JSON endpoints, the badge is <strong>public — no API key required</strong>,
          because it renders inside an <Code>&lt;img&gt;</Code> tag. It always returns a
          valid SVG (an unknown slug renders a gray <Code>unknown</Code> badge), so it
          never leaves a broken image, and it self-updates on the probe cadence.
        </p>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-400">
            GET
          </span>
          <code className="font-mono text-lg text-gray-100">
            /api/v1/servers/{"{slug}"}/badge
          </code>
        </div>

        <p className="mb-6 max-w-3xl text-sm text-gray-500">
          Optional query params: <Code>label</Code> overrides the left-hand text (default{" "}
          <Code>mcp</Code>) and <Code>message</Code> overrides the right-hand text. The
          badge colour tracks the verdict: green <Code>live</Code>, amber{" "}
          <Code>limited</Code>, blue <Code>auth required</Code>, red <Code>down</Code>.
        </p>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CodeBlock
            label="Markdown (README)"
            code={`[![MCP status](https://mymcptools.com/api/v1/servers/supabase/badge)](https://mymcptools.com/servers/supabase)`}
          />
          <CodeBlock
            label="HTML"
            code={`<a href="https://mymcptools.com/servers/supabase">
  <img src="https://mymcptools.com/api/v1/servers/supabase/badge"
       alt="MCP server status" />
</a>`}
          />
        </div>
      </section>

      {/* Verdicts reference */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="mb-4 text-3xl font-bold">Verdict values</h2>
        <div className="overflow-hidden rounded-xl border border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-900/60 text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Verdict</th>
                <th className="px-4 py-3 font-medium">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-gray-300">
              <tr>
                <td className="px-4 py-3 font-mono text-emerald-400">GOOD</td>
                <td className="px-4 py-3">Handshake succeeded and ≥1 tool is exposed.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-yellow-400">WARN</td>
                <td className="px-4 py-3">Speaks MCP but exposes zero / partial tools.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-blue-300">AUTH_REQUIRED</td>
                <td className="px-4 py-3">OAuth-gated — returned 401 with a Bearer challenge.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-red-400">DOWN</td>
                <td className="px-4 py-3">Handshake failed, connection error, or HTML proxy.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-gray-400">UNPROBEABLE</td>
                <td className="px-4 py-3">No remote endpoint (local stdio / npm / pip install).</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Access CTA */}
      <section id="access" className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-600/20 via-purple-600/15 to-emerald-500/10 p-12 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-600/10 via-transparent to-transparent" />
          <div className="relative">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Get API access</h2>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-400">
              Subscribe for instant self-serve access, or tell us what you&apos;re building
              and we&apos;ll get you a key by hand. Need the whole dataset on a schedule?
              Join the data-feed waitlist.
            </p>
            <div className="mx-auto mb-6 flex max-w-md justify-center">
              <TrustApiCheckoutButton />
            </div>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <a
                href={accessMailto}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-800 px-8 py-4 font-semibold text-white transition hover:bg-gray-700"
              >
                Request a free key instead
              </a>
              <a
                href={waitlistMailto}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-800 px-8 py-4 font-semibold text-white transition hover:bg-gray-700"
              >
                Join the data-feed waitlist →
              </a>
            </div>
            <p className="mt-6 text-sm text-gray-500">
              Questions?{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-400 hover:text-blue-300">
                {CONTACT_EMAIL}
              </a>{" "}
              · Browse the live{" "}
              <Link href="/servers" className="text-blue-400 hover:text-blue-300">
                server directory
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
