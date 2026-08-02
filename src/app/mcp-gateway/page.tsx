import { Metadata } from "next";
import Link from "next/link";
import { getServerBySlug } from "@/data/servers";

export const metadata: Metadata = {
  title: "MCP Gateway — Compare the 6 Options for Proxying MCP Servers | MyMCPTools",
  description:
    "What an MCP gateway is, when you need one, and how ContextForge, Docker MCP Gateway, agentgateway, LiteLLM, Composio and Kong compare on federation, auth, guardrails and deployment.",
  alternates: {
    canonical: "https://mymcptools.com/mcp-gateway",
  },
  openGraph: {
    title: "MCP Gateway — Compare the 6 Options | MyMCPTools",
    description:
      "An MCP gateway federates many MCP servers behind one endpoint and adds auth, rate limiting and observability. Compare the real options side by side.",
    type: "website",
    url: "https://mymcptools.com/mcp-gateway",
  },
};

type GatewayRow = {
  slug: string;
  label: string;
  vendor: string;
  shape: string;
  strength: string;
  deploy: string;
  license: string;
};

const gateways: GatewayRow[] = [
  {
    slug: "mcp-context-forge",
    label: "ContextForge",
    vendor: "IBM",
    shape: "Registry + proxy",
    strength: "Wraps non-MCP REST/gRPC APIs as virtual MCP servers; multi-cluster federation",
    deploy: "PyPI or container, Kubernetes at scale",
    license: "Apache-2.0",
  },
  {
    slug: "agentgateway",
    label: "Agentgateway",
    vendor: "Community (Rust)",
    shape: "Data-plane proxy",
    strength: "Governs MCP, A2A and LLM traffic in one proxy; CEL-based RBAC and pluggable guardrails",
    deploy: "Standalone YAML or Kubernetes Gateway API",
    license: "Apache-2.0",
  },
  {
    slug: "docker-mcp-gateway",
    label: "Docker MCP Gateway",
    vendor: "Docker",
    shape: "Local runtime + proxy",
    strength: "Each server runs in its own container; secrets live in Docker Desktop, not env vars",
    deploy: "Docker Desktop 4.59+ CLI plugin",
    license: "MIT",
  },
  {
    slug: "litellm",
    label: "LiteLLM MCP Gateway",
    vendor: "BerriAI",
    shape: "Inside an LLM proxy",
    strength: "Per-server auth headers and alias-based tool renaming, alongside model routing",
    deploy: "pip install 'litellm[proxy]'",
    license: "MIT",
  },
  {
    slug: "composio",
    label: "Composio",
    vendor: "Composio",
    shape: "Hosted / managed",
    strength: "Managed auth per end user; generate a scoped server URL per user_id",
    deploy: "Hosted API, no self-install",
    license: "Commercial + OSS SDK",
  },
  {
    slug: "kong-mcp",
    label: "Kong Konnect",
    vendor: "Kong",
    shape: "API gateway adjacent",
    strength: "Fronts MCP traffic with an existing API gateway estate; agent-side Konnect analytics",
    deploy: "Hosted remote server",
    license: "Commercial",
  },
];

const faqItems = [
  {
    question: "What is an MCP gateway?",
    answer:
      "An MCP gateway is a proxy that sits between your AI client and many MCP servers, exposing all of them through a single endpoint. Instead of each client (Claude Desktop, Cursor, VS Code) holding its own list of servers and its own copy of every API key, the client connects once to the gateway and the gateway handles routing, authentication, rate limiting and logging for every downstream server. It is the same architectural move an API gateway makes in front of microservices, applied to Model Context Protocol tool calls.",
  },
  {
    question: "Do I actually need an MCP gateway?",
    answer:
      "For one person running three or four servers locally, no — a gateway adds a hop and a config file for no benefit. Gateways start paying for themselves at three thresholds: when more than one client has to stay in sync on the same tool set, when credentials must not live in plaintext JSON on developer laptops, and when someone needs an audit trail of which agent called which tool. A fourth arrives sooner than teams expect: client tool-count limits. Once you attach a dozen servers, the combined tool list can overflow what the model will reliably reason over, and a gateway lets you expose a curated subset.",
  },
  {
    question: "What is the difference between an MCP gateway and an MCP server?",
    answer:
      "An MCP server exposes a specific capability — querying Postgres, creating a GitHub pull request, searching the web. An MCP gateway exposes other MCP servers. Confusingly, most gateways are themselves fully compliant MCP servers, because that is how the client talks to them: your client sees one server offering a merged tool list, and the gateway fans each call out to the real backend. That is why you configure a gateway in exactly the same place in claude_desktop_config.json as any other server.",
  },
  {
    question: "What is the difference between an MCP gateway and an LLM gateway?",
    answer:
      "An LLM gateway (or AI gateway) proxies model traffic — routing prompts to OpenAI, Anthropic or Bedrock, tracking spend, failing over between providers. An MCP gateway proxies tool traffic. The categories are converging: LiteLLM added an MCP gateway inside what was an LLM proxy, and agentgateway covers agent-to-LLM, agent-to-tool and agent-to-agent in one data plane. If you already run an LLM gateway, check whether it now speaks MCP before adding a second proxy to the path.",
  },
  {
    question: "Can an MCP gateway put non-MCP APIs behind MCP?",
    answer:
      "Yes, and this is often the real reason to deploy one. IBM ContextForge virtualizes REST and gRPC services as MCP servers, registering their operations as tools without the upstream team writing any MCP code, and it can discover gRPC methods automatically via the server reflection protocol. Practically, that means internal services that will never ship an MCP server of their own can still be reachable by an agent through the gateway.",
  },
  {
    question: "How does authentication work through an MCP gateway?",
    answer:
      "It varies enough to be a selection criterion. ContextForge supports user-scoped OAuth tokens and passes an X-Upstream-Authorization header to backends. LiteLLM uses a per-server header convention (x-mcp-{alias}-{header}) so one client key can unlock differently-authenticated backends. Docker's gateway keeps credentials in Docker Desktop's secrets store and runs OAuth flows for servers that need them. Composio issues a distinct server URL per end user so the gateway holds each user's third-party connections. Ask which model matches your tenancy before you pick.",
  },
  {
    question: "Is there an official MCP gateway from Anthropic?",
    answer:
      "No. Anthropic publishes the Model Context Protocol specification and a set of reference servers, but not a gateway. Every option on this page is either vendor-built (IBM, Docker, Kong) or community-built (agentgateway). The related official piece of shared infrastructure is the MCP Registry at registry.modelcontextprotocol.io, which several gateways — Docker's among them — can pull server definitions from directly.",
  },
  {
    question: "What is an MCP gateway registry?",
    answer:
      "A registry is the catalog a gateway pulls server definitions from, as opposed to the proxy that runs them. Docker's gateway can reference four source types in one profile: its own catalog, an OCI image, an entry in the public MCP Registry, or a local YAML file. ContextForge bundles a registry with the proxy so registered tools, prompts and resources are discoverable centrally. In practice you want both: a registry answers 'what exists', the gateway answers 'who may call it'.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "MCP Gateway",
  description:
    "What an MCP gateway is, when you need one, and how the main options compare on federation, authentication, guardrails and deployment shape.",
  url: "https://mymcptools.com/mcp-gateway",
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://mymcptools.com" },
      { "@type": "ListItem", position: 2, name: "MCP Gateway", item: "https://mymcptools.com/mcp-gateway" },
    ],
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
};

export default function MCPGatewayPage() {
  const rows = gateways
    .map((g) => ({ ...g, server: getServerBySlug(g.slug) }))
    .filter((g) => g.server);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <nav className="mb-6 text-sm text-gray-500">
          <ol className="flex items-center space-x-2">
            <li><Link href="/" className="hover:text-gray-300 transition">Home</Link></li>
            <li>/</li>
            <li className="text-gray-300">MCP Gateway</li>
          </ol>
        </nav>

        {/* Hero */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs px-2.5 py-1 rounded-full font-medium">
              Infrastructure
            </span>
            <span className="bg-gray-800 text-gray-400 text-xs px-2.5 py-1 rounded-full">{rows.length} gateways compared</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">MCP Gateway</h1>
          <p className="text-lg text-gray-400 max-w-3xl mb-4">
            An <strong className="text-gray-200">MCP gateway</strong> is a proxy that federates many Model Context Protocol
            servers behind one endpoint and adds the things a raw stdio server cannot: centralized authentication,
            rate limiting, guardrails, and a log of every tool call.
          </p>
          <p className="text-gray-500 max-w-3xl mb-6">
            This page covers what a gateway actually does, the four thresholds at which one starts paying for itself,
            and how the real options differ — because they are not interchangeable. One virtualizes REST APIs as MCP
            servers, one containerizes every backend, one lives inside an LLM proxy, and one is hosted and issues a
            server URL per end user.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#compare" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition text-sm">
              Compare gateways →
            </a>
            <Link href="/servers" className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg font-medium transition text-sm">
              Browse all MCP servers
            </Link>
            <Link href="/mcp-marketplace" className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg font-medium transition text-sm">
              MCP marketplace
            </Link>
          </div>
        </div>

        {/* What it does */}
        <section className="mb-12 bg-gray-900 border border-gray-800 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-4">What an MCP gateway does</h2>
          <div className="text-gray-400 space-y-3 max-w-3xl">
            <p>
              Without a gateway, every AI client holds its own server list and its own copy of every credential.
              Three developers running the same eight servers means twenty-four processes and twenty-four sets of API
              keys sitting in plaintext JSON. Add a fourth client and the configurations drift.
            </p>
            <p>
              A gateway inverts that. Each client is configured once, pointing at the gateway, exactly where you would
              normally list a server in{" "}
              <code className="text-blue-400 bg-gray-800 px-1 rounded text-xs">claude_desktop_config.json</code>. The
              gateway holds the real server list, presents a merged tool surface, and fans each call out to the right
              backend — which is why a gateway is itself a compliant MCP server. From the model&apos;s side nothing looks
              unusual; from the operator&apos;s side there is now exactly one place to rotate a key, revoke a tool, or read
              an audit log.
            </p>
            <p>
              The four capabilities that separate gateways from a shell script that starts servers are{" "}
              <strong className="text-gray-200">federation</strong> (one endpoint, many backends, merged tool list),{" "}
              <strong className="text-gray-200">auth brokering</strong> (the gateway holds upstream credentials and OAuth
              flows, not the client), <strong className="text-gray-200">policy</strong> (rate limits, RBAC, content
              guardrails applied before a call reaches a tool), and{" "}
              <strong className="text-gray-200">observability</strong> (OpenTelemetry traces for tool calls, the same way
              you trace any other service).
            </p>
          </div>
        </section>

        {/* When you need one */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-3">When you need one — and when you don&apos;t</h2>
          <p className="text-gray-400 mb-6 max-w-3xl text-sm">
            For one person running three servers locally, a gateway is a hop and a config file for no benefit. It starts
            paying for itself at these four thresholds:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                t: "More than one client to keep in sync",
                d: "VS Code, Cursor and Claude Desktop drifting apart on which servers are attached is the most common first symptom. One gateway config fixes all three at once.",
              },
              {
                t: "Credentials must leave developer laptops",
                d: "Stdio servers take secrets as environment variables in a config file. A gateway holds them centrally — in a secrets store, or brokered per-user via OAuth — so revocation is one action rather than a message to the team.",
              },
              {
                t: "Someone will ask who called what",
                d: "Tool calls are actions taken against production systems. Gateways emit OpenTelemetry traces and call logs, which is the difference between an agent you can deploy and one you can only demo.",
              },
              {
                t: "Tool-count overflow",
                d: "Attach a dozen servers and the merged tool list gets long enough that model tool selection degrades and some clients hit hard limits. A gateway lets you expose a curated subset per profile instead of everything at once.",
              },
            ].map((item) => (
              <div key={item.t} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="text-white font-semibold mb-1.5">{item.t}</div>
                <p className="text-gray-500 text-sm leading-relaxed">{item.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Comparison */}
        <section id="compare" className="mb-12 scroll-mt-8">
          <h2 className="text-2xl font-bold text-white mb-3">MCP gateway comparison</h2>
          <p className="text-gray-400 mb-6 max-w-3xl text-sm">
            These are not six versions of the same product. The &quot;shape&quot; column is the one to read first — a local
            container runtime, a Kubernetes data plane, and a hosted multi-tenant service solve genuinely different
            problems.
          </p>
          <div className="overflow-x-auto border border-gray-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-gray-900">
                <tr className="text-left text-gray-400">
                  <th className="px-4 py-3 font-medium">Gateway</th>
                  <th className="px-4 py-3 font-medium">Shape</th>
                  <th className="px-4 py-3 font-medium">What it is best at</th>
                  <th className="px-4 py-3 font-medium">Deployment</th>
                  <th className="px-4 py-3 font-medium">License</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {rows.map((g) => (
                  <tr key={g.slug} className="hover:bg-gray-900/50 transition align-top">
                    <td className="px-4 py-4">
                      <Link href={`/servers/${g.slug}`} className="text-blue-400 hover:text-blue-300 font-medium">
                        {g.label}
                      </Link>
                      <div className="text-gray-600 text-xs mt-0.5">{g.vendor}</div>
                      {typeof g.server?.stars === "number" && (
                        <div className="text-gray-600 text-xs mt-0.5">★ {g.server.stars.toLocaleString()}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-300">{g.shape}</td>
                    <td className="px-4 py-4 text-gray-400">{g.strength}</td>
                    <td className="px-4 py-4 text-gray-400">{g.deploy}</td>
                    <td className="px-4 py-4 text-gray-500">{g.license}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-gray-600 text-xs mt-3">
            Star counts and repository status verified against the GitHub API on 2 August 2026. Each name links to its
            full listing with install commands and setup detail.
          </p>
        </section>

        {/* Vendor notes */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Notes on each option</h2>
          <div className="space-y-4">
            {[
              {
                slug: "mcp-context-forge",
                h: "IBM MCP gateway (ContextForge)",
                d: "The most complete open-source option, and the one to look at if your problem includes services that will never ship an MCP server. ContextForge virtualizes REST and gRPC APIs as MCP servers — registering their operations as tools, discovering gRPC methods through server reflection — alongside federating real MCP servers. Redis-backed caching and multi-cluster federation cover Kubernetes deployments; OpenTelemetry export covers Phoenix, Jaeger, Zipkin and any OTLP backend. Ships with an admin UI, including an airgapped mode.",
              },
              {
                slug: "docker-mcp-gateway",
                h: "Docker MCP gateway",
                d: "The isolation-first option, and the easiest to adopt if your team already runs Docker Desktop. Every catalog server runs in its own container rather than as a bare npx process, secrets live in Docker Desktop's secrets store instead of environment variables, and servers are grouped into profiles that can be exported to YAML or pushed to an OCI registry — so a tool set is versioned like an image. A profile can mix catalog references, OCI images, public MCP Registry URLs and local files in one config.",
              },
              {
                slug: "agentgateway",
                h: "Agentgateway — the Kubernetes-native data plane",
                d: "The pick if the gateway needs to be part of your service mesh rather than a developer tool. Rust proxy covering MCP, A2A and LLM traffic in one data plane, with CEL-driven RBAC, JWT/API-key/OAuth auth, and pluggable guardrails (regex, OpenAI moderation, Bedrock Guardrails, Google Model Armor, or your own webhook). Choose your deployment shape early: standalone flat-YAML and Kubernetes Gateway API modes are documented separately and are effectively different products.",
              },
              {
                slug: "litellm",
                h: "LiteLLM MCP gateway",
                d: "The right answer when you already run LiteLLM as an LLM proxy — adding a second proxy for tools would be the wrong trade. MCP servers are declared under mcp_servers: in config.yaml or added through the UI, with stdio, SSE and HTTP backends all supported. Its distinguishing features are the per-server auth header convention (x-mcp-{alias}-{header}), alias-based tool renaming for shortening long tool names, and a REST path for listing and calling tools with no LLM in the loop.",
              },
              {
                slug: "composio",
                h: "Composio — the hosted option",
                d: "The managed path, and the one that fits multi-tenant products rather than internal platforms. You create a server definition with the toolkits and allowed tools it may expose, then generate a per-user URL carrying that user's connected accounts — so end-user OAuth is Composio's problem rather than yours. Two prerequisites catch people out: the auth config must exist before you create the server, and the user must have connected the toolkit first.",
              },
              {
                slug: "kong-mcp",
                h: "Kong — API gateway adjacent",
                d: "Kong appears on both sides of this conversation. Kong Gateway is a general API gateway that can front MCP traffic as part of an existing estate, and Kong publishes AI-gateway guidance for that pattern. Separately, the Konnect MCP server lets an agent read Konnect analytics and configuration. Worth flagging because most directories get it wrong: the community Kong/mcp-konnect repository is deprecated and headed for archive — Kong's supported path is the hosted remote Konnect MCP server.",
              },
            ].map((n) => (
              <div key={n.slug} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-2">{n.h}</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-3">{n.d}</p>
                <Link href={`/servers/${n.slug}`} className="text-blue-400 hover:text-blue-300 text-sm transition">
                  Full listing and install detail →
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Choosing */}
        <section className="mb-12 bg-gray-900 border border-gray-800 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-4">Choosing one</h2>
          <ul className="text-gray-400 space-y-3 max-w-3xl text-sm list-disc list-inside">
            <li>
              <strong className="text-gray-200">You need internal REST/gRPC services reachable by agents</strong> —
              ContextForge, because virtualization is a first-class feature rather than something you build.
            </li>
            <li>
              <strong className="text-gray-200">You are worried about what a server does on a developer laptop</strong> —
              Docker MCP Gateway, for per-server container isolation and secrets kept out of config files.
            </li>
            <li>
              <strong className="text-gray-200">The gateway must live in Kubernetes next to your other proxies</strong> —
              agentgateway, for Gateway API integration, CEL policy and guardrails in the data path.
            </li>
            <li>
              <strong className="text-gray-200">You already proxy model traffic</strong> — LiteLLM, because one proxy
              beats two and its MCP gateway is in the product you are already running.
            </li>
            <li>
              <strong className="text-gray-200">Your end users each connect their own accounts</strong> — Composio, for
              per-user server URLs and managed third-party OAuth.
            </li>
          </ul>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">MCP gateway FAQ</h2>
          <div className="space-y-4">
            {faqItems.map((faq, i) => (
              <details key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 group open:border-blue-500/30">
                <summary className="text-white font-medium cursor-pointer list-none flex items-center justify-between">
                  {faq.question}
                  <span className="text-gray-500 group-open:rotate-180 transition-transform ml-4">▾</span>
                </summary>
                <p className="text-gray-400 mt-3 text-sm leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/20 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Decide what goes behind the gateway</h2>
          <p className="text-gray-400 mb-6">
            A gateway is only as good as the servers behind it. Browse the catalog with verified repositories and install
            commands before you wire anything up.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/servers" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition">
              Browse MCP servers
            </Link>
            <Link href="/trust" className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition">
              MCP Trust Registry
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
