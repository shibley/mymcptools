import type { Metadata } from "next";
import Link from "next/link";
import { servers } from "@/data/servers";
import { allStatuses } from "@/lib/trust/status-store";

export const metadata: Metadata = {
  title: "MyMCPTools MCP Server — Query the Catalog Over MCP | MyMCPTools",
  description:
    "MyMCPTools is itself a Model Context Protocol server. Connect Claude Desktop, Claude Code, Cursor or any MCP client to https://mymcptools.com/api/mcp and search 2,700+ MCP servers with live uptime, incident and tool-schema drift data.",
  keywords:
    "MCP server for MCP servers, MCP directory MCP server, remote MCP server, streamable HTTP MCP, Claude Desktop MCP config, MCP registry API",
  openGraph: {
    title: "MyMCPTools MCP Server — Query the Catalog Over MCP",
    description:
      "A remote, no-auth MCP endpoint that lets any agent search the MCP catalog and check whether a server is actually up before recommending it.",
    type: "website",
    url: "https://mymcptools.com/mcp-server",
    siteName: "MyMCPTools",
  },
  twitter: {
    card: "summary_large_image",
    title: "MyMCPTools MCP Server — Query the Catalog Over MCP",
    description:
      "Connect any MCP client to https://mymcptools.com/api/mcp and search 2,700+ servers with live uptime data.",
  },
  alternates: { canonical: "https://mymcptools.com/mcp-server" },
};

const ENDPOINT = "https://mymcptools.com/api/mcp";

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

const tools = [
  {
    name: "search_mcp_servers",
    description:
      "Search the catalog by keyword, category, client integration or install type. Set only_verified to return just the servers that answered a live handshake.",
  },
  {
    name: "get_mcp_server",
    description:
      "Full entry for one server: install command, repo, supported clients, current verdict, repo-freshness signal and related servers.",
  },
  {
    name: "get_server_status",
    description:
      "Current probe verdict, tool count, handshake latency and negotiated protocol version. Omit the slug for the catalog-wide rollup.",
  },
  {
    name: "get_server_history",
    description:
      "Trailing probe history plus a daily uptime sparkline — the same series behind the uptime badges on this site.",
  },
  {
    name: "list_server_incidents",
    description:
      "Reconstructed outage windows with start, end, duration and failure reason. Filter to ongoing outages only.",
  },
  {
    name: "list_schema_drift",
    description:
      "Tool-schema and protocol-version changes detected between probes — the early warning that a dependency just broke.",
  },
  {
    name: "list_categories",
    description: "Every category and client integration with server counts, for driving the search filters.",
  },
  {
    name: "get_catalog_stats",
    description:
      "Aggregate health of the whole MCP population: verdict breakdown, serving share, transport mix, latency percentiles.",
  },
];

const claudeCodeCmd = `claude mcp add --transport http mymcptools ${ENDPOINT}`;

const clientConfig = `{
  "mcpServers": {
    "mymcptools": {
      "type": "http",
      "url": "${ENDPOINT}"
    }
  }
}`;

const curlExample = `curl -s -X POST ${ENDPOINT} \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "search_mcp_servers",
      "arguments": { "query": "postgres", "only_verified": true, "limit": 5 }
    }
  }'`;

const faqs = [
  {
    q: "What is an MCP server?",
    a: "An MCP server is a program that exposes tools, resources and prompts to an AI client over the Model Context Protocol. The client (Claude Desktop, Claude Code, Cursor, VS Code, Cline and others) discovers what the server offers with a tools/list call and then invokes those tools with tools/call. Servers run either locally over stdio, launched by the client as a subprocess, or remotely over Streamable HTTP at a URL like the one on this page.",
  },
  {
    q: "What is the MyMCPTools MCP server for?",
    a: "It turns this directory into something an agent can query mid-task. Instead of a human browsing the catalog, the model calls search_mcp_servers to find candidates, get_mcp_server for the install command and repo, and get_server_status to confirm the server actually answered a live handshake before it recommends installing it.",
  },
  {
    q: "Do I need an API key or account?",
    a: "No. The endpoint is open and read-only, with no authentication and no session state — every call is a plain HTTP POST. The keyed REST API on the developers page is a separate product for the same uptime, incident and drift data.",
  },
  {
    q: "How do I add it to Claude Code?",
    a: "Run claude mcp add --transport http mymcptools https://mymcptools.com/api/mcp. For config-file clients such as Claude Desktop, Cursor and Windsurf, add an entry under mcpServers with type set to http and url set to the same endpoint.",
  },
  {
    q: "Why does a GET request return 405?",
    a: "The server is stateless and POST-only. It opens no server-initiated SSE stream, so there is no long-lived channel for a GET to subscribe to. Send JSON-RPC over POST with an Accept header of application/json, text/event-stream.",
  },
  {
    q: "How is this different from a static MCP directory listing?",
    a: "Most listings are a snapshot of a README. This catalog is continuously probed, so the same tools that return an entry also return its current verdict, handshake latency, negotiated protocol version, reconstructed outage windows and any tool-schema drift detected between probes — the signals that tell you whether a server is still worth depending on.",
  },
];

export default function McpServerPage() {
  const probed = allStatuses().length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.q,
              acceptedAnswer: { "@type": "Answer", text: faq.a },
            })),
          }),
        }}
      />
      <div className="mb-12">
        <span className="inline-block rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-blue-300">
          Remote MCP endpoint
        </span>
        <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
          MyMCPTools is an MCP server
        </h1>
        <p className="mt-4 text-lg text-gray-400">
          The directory answers over the Model Context Protocol itself. Point any MCP client at
          the endpoint below and your agent can search {servers.length.toLocaleString()} MCP
          servers and check whether one is <em>actually reachable</em> — from {probed.toLocaleString()}{" "}
          live-probed status records — before it recommends an install.
        </p>
      </div>

      <div className="mb-12 rounded-xl border border-gray-800 bg-gray-900 p-6">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Endpoint</div>
        <div className="mt-2 break-all font-mono text-lg text-blue-300">{ENDPOINT}</div>
        <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-gray-500">Transport</dt>
            <dd className="text-gray-300">Streamable HTTP</dd>
          </div>
          <div>
            <dt className="text-gray-500">Authentication</dt>
            <dd className="text-gray-300">None — open and read-only</dd>
          </div>
          <div>
            <dt className="text-gray-500">Sessions</dt>
            <dd className="text-gray-300">Stateless (POST only)</dd>
          </div>
        </dl>
      </div>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-semibold text-white">Connect</h2>
        <p className="mb-4 text-gray-400">Claude Code — one command:</p>
        <CodeBlock label="terminal" code={claudeCodeCmd} />
        <p className="mb-4 mt-6 text-gray-400">
          Claude Desktop, Cursor, Windsurf and other config-file clients — add this to your MCP
          config:
        </p>
        <CodeBlock label="mcp config" code={clientConfig} />
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-semibold text-white">Tools</h2>
        <div className="space-y-3">
          {tools.map((tool) => (
            <div
              key={tool.name}
              className="rounded-xl border border-gray-800 bg-gray-900 p-5"
            >
              <div className="font-mono text-sm text-blue-300">{tool.name}</div>
              <p className="mt-2 text-sm text-gray-400">{tool.description}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-gray-500">
          Catalog entries are also exposed as MCP resources at{" "}
          <code className="rounded bg-gray-800/80 px-1.5 py-0.5 font-mono text-[0.85em] text-blue-300">
            mymcptools://server/&#123;slug&#125;
          </code>
          , alongside{" "}
          <code className="rounded bg-gray-800/80 px-1.5 py-0.5 font-mono text-[0.85em] text-blue-300">
            mymcptools://catalog/categories
          </code>{" "}
          and{" "}
          <code className="rounded bg-gray-800/80 px-1.5 py-0.5 font-mono text-[0.85em] text-blue-300">
            mymcptools://catalog/stats
          </code>
          .
        </p>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-semibold text-white">Call it directly</h2>
        <p className="mb-4 text-gray-400">
          The endpoint is plain JSON-RPC over HTTP POST, so you can drive it without an MCP client:
        </p>
        <CodeBlock label="curl" code={curlExample} />
        <p className="mt-4 text-sm text-gray-500">
          GET returns 405 by design — the endpoint is stateless and offers no server-initiated SSE
          stream, so there is nothing to subscribe to.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-semibold text-white">
          MCP server FAQ
        </h2>
        <div className="space-y-3">
          {faqs.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-xl border border-gray-800 bg-gray-900 p-5"
            >
              <summary className="cursor-pointer list-none font-medium text-white marker:hidden">
                {faq.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-gray-400">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-3 text-xl font-semibold text-white">Prefer REST?</h2>
        <p className="text-gray-400">
          The same uptime, incident and drift data is available as a keyed JSON/CSV API. See the{" "}
          <Link href="/developers" className="text-blue-400 transition hover:text-blue-300">
            Status API docs
          </Link>{" "}
          for endpoints and access, or the{" "}
          <Link href="/status" className="text-blue-400 transition hover:text-blue-300">
            live status page
          </Link>{" "}
          for the human view.
        </p>
      </section>
    </div>
  );
}
