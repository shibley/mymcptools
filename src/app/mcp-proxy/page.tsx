import { Metadata } from "next";
import Link from "next/link";
import { getServerBySlug } from "@/data/servers";

export const metadata: Metadata = {
  title: "MCP Proxy — 7 Ways to Bridge stdio, SSE, HTTP and OpenAPI | MyMCPTools",
  description:
    "An MCP proxy bridges one MCP server between transports — stdio to SSE, SSE to stdio, MCP to OpenAPI. Compare mcp-remote, mcp-proxy (Python and TypeScript), Supergateway, MCP Proxy for AWS, mcpo and TBXark on transport support, auth and deployment.",
  alternates: {
    canonical: "https://mymcptools.com/mcp-proxy",
  },
  openGraph: {
    title: "MCP Proxy — Compare the 7 Transport Bridges | MyMCPTools",
    description:
      "stdio-only client and a remote server? Remote client and a stdio-only server? An OpenAPI consumer and an MCP tool? These are the proxies that close each gap.",
    type: "website",
    url: "https://mymcptools.com/mcp-proxy",
  },
};

type ProxyRow = {
  slug: string;
  label: string;
  vendor: string;
  direction: string;
  transports: string;
  auth: string;
  runtime: string;
};

const proxies: ProxyRow[] = [
  {
    slug: "mcp-remote",
    label: "mcp-remote",
    vendor: "Glen Maddern",
    direction: "Remote → stdio",
    transports: "SSE, Streamable HTTP → stdio",
    auth: "Full browser OAuth flow, tokens cached and refreshed; static headers optional",
    runtime: "Node (npx)",
  },
  {
    slug: "sparfenyuk-mcp-proxy",
    label: "MCP Proxy (Python)",
    vendor: "Sergey Parfenyuk",
    direction: "Both directions",
    transports: "stdio ↔ SSE, stdio ↔ Streamable HTTP",
    auth: "Static headers, API_ACCESS_TOKEN, or OAuth2 client-credentials exchange",
    runtime: "Python (uvx/pip), container",
  },
  {
    slug: "punkpeye-mcp-proxy",
    label: "MCP Proxy (TypeScript)",
    vendor: "punkpeye",
    direction: "stdio → remote",
    transports: "stdio → SSE and Streamable HTTP, served together",
    auth: "None built in — front it with your own layer",
    runtime: "Node (npx)",
  },
  {
    slug: "supergateway",
    label: "Supergateway",
    vendor: "Supercorp",
    direction: "Both directions",
    transports: "stdio ↔ SSE, Streamable HTTP, and WebSocket",
    auth: "--oauth2Bearer token and arbitrary repeated headers",
    runtime: "Node (npx)",
  },
  {
    slug: "mcp-proxy-for-aws",
    label: "MCP Proxy for AWS",
    vendor: "AWS",
    direction: "Remote → stdio",
    transports: "IAM-secured AWS endpoint → stdio, plus a Python library mode",
    auth: "AWS SigV4 signing from local credentials, profile or IAM role",
    runtime: "Python (uvx), container, importable library",
  },
  {
    slug: "tbxark-mcp-proxy",
    label: "MCP Proxy (TBXark)",
    vendor: "TBXark",
    direction: "Many → one endpoint",
    transports: "stdio, SSE and Streamable HTTP downstreams → one HTTP entrypoint",
    auth: "OAuth client — authorizes a downstream once, refreshes for every caller",
    runtime: "Go binary or container",
  },
  {
    slug: "mcpo",
    label: "mcpo",
    vendor: "Open WebUI",
    direction: "MCP → OpenAPI",
    transports: "stdio, SSE, Streamable HTTP → plain REST with generated OpenAPI docs",
    auth: "API key on the REST side; OAuth 2.1 dynamic client registration upstream",
    runtime: "Python (uvx/pip), container",
  },
];

const faqItems = [
  {
    question: "What is an MCP proxy?",
    answer:
      "An MCP proxy is a small program that sits between an MCP client and an MCP server and translates the transport between them. The Model Context Protocol defines the messages, but they can travel over stdio (the server is a local subprocess reading and writing pipes), Server-Sent Events, or Streamable HTTP. Clients and servers frequently support different subsets, so a proxy accepts the connection in whatever transport the client speaks and re-opens it in whatever the server speaks. Nothing about the tools, prompts or resources changes on the way through — only the pipe they travel down.",
  },
  {
    question: "What is the difference between an MCP proxy and an MCP gateway?",
    answer:
      "A proxy usually bridges one server between two transports. A gateway federates many servers behind one endpoint and adds the operational layer on top — authentication brokering, RBAC, rate limiting, audit logs, tool curation. The line is genuinely blurry, because most gateways contain a proxy and some proxies aggregate several backends, but the intent differs and so does the amount of infrastructure you have to run. If your problem is 'my client cannot speak to this server', you want a proxy. If it is 'ten people share thirty servers and someone has to prove who called what', you want a gateway.",
  },
  {
    question: "Why can't my MCP client connect to a remote MCP server?",
    answer:
      "Most likely your client only implements the stdio transport, and increasingly likely the remote server also requires OAuth, which stdio-only clients have no way to perform. That specific combination is what mcp-remote exists for: it runs the authorization flow in a browser once, stores the tokens under ~/.mcp-auth, refreshes them silently, and presents the remote server to your client as an ordinary local process. It is the reason so many vendor install docs — Linear, Cloudflare, Intercom, PostHog, Render, Tavily among them — include an npx mcp-remote line as the fallback config.",
  },
  {
    question: "How do I expose a local stdio MCP server over HTTP?",
    answer:
      "Run it behind a proxy that publishes an HTTP endpoint. In TypeScript, punkpeye/mcp-proxy wraps your command and serves it on /mcp for Streamable HTTP and /sse for SSE at the same time. In Python, sparfenyuk/mcp-proxy does the same with --sse-port plus your command after the -- separator, and its named-servers mode fronts several stdio commands on distinct paths from one process. Supergateway covers the same ground and adds a WebSocket output. Decide on session semantics before you deploy: a stateless mode that creates a fresh instance per request is what you want behind a load balancer, while stateful sessions are what you want for a single long-lived client.",
  },
  {
    question: "Is there an MCP proxy for AWS?",
    answer:
      "Yes, and it solves an authentication problem rather than a transport one. MCP servers hosted on AWS — Bedrock AgentCore endpoints in particular — can be secured with IAM rather than OAuth, which means every request has to carry a SigV4 signature that no standard MCP client knows how to produce. AWS publishes mcp-proxy-for-aws, which picks up your local credentials, profile or IAM role, signs each request, and presents the remote server to the client as a local stdio process. It doubles as an importable Python library so LangChain, LlamaIndex and Strands Agents applications can open an authenticated session directly.",
  },
  {
    question: "Can I call MCP tools from something that only speaks OpenAPI?",
    answer:
      "That is what mcpo does, and it runs the opposite direction to everything else on this page. Rather than making an MCP server reachable by an MCP client, it wraps the server and exposes each tool as a REST endpoint with a generated OpenAPI schema and interactive docs. Agent frameworks, SDK code generators and existing API gateways can then call MCP tools without implementing the protocol at all. One config file in Claude Desktop format serves many servers at once, each on its own route with its own docs page. The target search term for this — openapi mcp server — is a distinct intent from the rest of the proxy cluster.",
  },
  {
    question: "Does an MCP proxy add security risk?",
    answer:
      "It changes the shape of the risk rather than removing it. Putting a stdio server behind an HTTP endpoint means a process that previously could only be reached by a local subprocess call is now reachable by anything that can route to the port — so bind it deliberately, keep it off public interfaces unless you have added auth, and do not assume the wrapped server does any authorization of its own, because stdio servers generally assume the caller is already trusted. Proxies that store OAuth tokens write them to disk (mcp-remote uses ~/.mcp-auth), which is convenient and also a credential at rest. Where a proxy genuinely helps is the reverse case: holding a downstream credential centrally so it never has to be copied into per-developer config files.",
  },
  {
    question: "Which MCP proxy should I use?",
    answer:
      "Match the direction of the problem. Stdio-only client and a remote OAuth server: mcp-remote. Stdio-only client and an IAM-secured AWS server: MCP Proxy for AWS. Stdio server that needs to be reachable over the network: punkpeye/mcp-proxy in a Node stack, sparfenyuk/mcp-proxy in a Python one, Supergateway if you need WebSocket. Several servers that should arrive as one endpoint with downstream OAuth handled once: TBXark's MCP Proxy. A consumer that speaks OpenAPI rather than MCP: mcpo. If what you actually need is policy and audit across a team, none of these is the answer — that is a gateway.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "MCP Proxy",
  description:
    "What an MCP proxy is, how it differs from an MCP gateway, and how the main transport bridges compare on direction, transports, authentication and runtime.",
  url: "https://mymcptools.com/mcp-proxy",
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://mymcptools.com" },
      { "@type": "ListItem", position: 2, name: "MCP Proxy", item: "https://mymcptools.com/mcp-proxy" },
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

export default function MCPProxyPage() {
  const rows = proxies
    .map((p) => ({ ...p, server: getServerBySlug(p.slug) }))
    .filter((p) => p.server);

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
            <li className="text-gray-300">MCP Proxy</li>
          </ol>
        </nav>

        {/* Hero */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs px-2.5 py-1 rounded-full font-medium">
              Infrastructure
            </span>
            <span className="bg-gray-800 text-gray-400 text-xs px-2.5 py-1 rounded-full">{rows.length} proxies compared</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">MCP Proxy</h1>
          <p className="text-lg text-gray-400 max-w-3xl mb-4">
            An <strong className="text-gray-200">MCP proxy</strong> translates a Model Context Protocol connection from
            one transport to another — stdio to SSE, SSE to stdio, Streamable HTTP to either, and in one case MCP to a
            plain OpenAPI REST service. The messages are unchanged; only the pipe they travel down is.
          </p>
          <p className="text-gray-500 max-w-3xl mb-6">
            Almost every MCP setup problem that looks like &quot;my client cannot see this server&quot; is a transport
            mismatch, an auth scheme the client does not implement, or both. This page maps each mismatch to the proxy
            that closes it, and explains where the line sits between a proxy and a full{" "}
            <Link href="/mcp-gateway" className="text-blue-400 hover:text-blue-300">MCP gateway</Link>.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#compare" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition text-sm">
              Compare proxies →
            </a>
            <Link href="/mcp-gateway" className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg font-medium transition text-sm">
              MCP gateways
            </Link>
            <Link href="/servers" className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg font-medium transition text-sm">
              Browse all MCP servers
            </Link>
          </div>
        </div>

        {/* The four mismatches */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-3">Start with the mismatch, not the tool</h2>
          <p className="text-gray-400 mb-6 max-w-3xl text-sm">
            There are only four shapes of problem here. Identify which one you have and the choice narrows to one or two
            options immediately.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                t: "Your client is stdio-only, the server is remote",
                d: "The most common case by far. The server lives behind a URL and usually behind OAuth, and your client has no idea how to do either. A proxy runs on your machine as a normal local command, performs the browser auth once, and relays the session.",
                a: "mcp-remote — or MCP Proxy for AWS when the endpoint is IAM-secured rather than OAuth-secured.",
              },
              {
                t: "Your server is stdio-only, the client is remote",
                d: "You have a server that only runs as a local subprocess and you need it reachable from another machine, a container, or a hosted agent. A proxy spawns it and publishes an HTTP or WebSocket endpoint in front of it.",
                a: "MCP Proxy (TypeScript or Python), or Supergateway if you specifically need WebSocket output.",
              },
              {
                t: "Several servers should arrive as one endpoint",
                d: "Not yet a governance problem — you just want one URL in the client config instead of six, and you do not want to re-run an interactive OAuth flow for every user of a shared deployment.",
                a: "MCP Proxy (TBXark): one Go binary, one JSON file, downstream OAuth held and refreshed centrally.",
              },
              {
                t: "The consumer does not speak MCP at all",
                d: "An internal service, an SDK code generator or an existing API gateway needs to call your tools, and teaching it the protocol is not on the table. Expose the tools as REST with a generated schema instead.",
                a: "mcpo — the only entry here that is not an MCP endpoint on its output side.",
              },
            ].map((item) => (
              <div key={item.t} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="text-white font-semibold mb-1.5">{item.t}</div>
                <p className="text-gray-500 text-sm leading-relaxed mb-2">{item.d}</p>
                <p className="text-cyan-300/80 text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Proxy vs gateway */}
        <section className="mb-12 bg-gray-900 border border-gray-800 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-4">MCP proxy vs MCP gateway</h2>
          <div className="text-gray-400 space-y-3 max-w-3xl">
            <p>
              The two words get used interchangeably and they should not be. A{" "}
              <strong className="text-gray-200">proxy</strong> bridges a connection: it takes MCP messages in over one
              transport and sends them out over another, usually for a single server, and it holds no opinion about who
              is allowed to call what. A <strong className="text-gray-200">gateway</strong> federates many servers
              behind one endpoint and adds the layer a shared deployment needs — credential brokering, per-user or
              per-group access, rate limits, guardrails, and a log of every tool call.
            </p>
            <p>
              The practical test is what happens when a second person joins. A proxy that worked for you keeps working
              for them, unchanged, because it was never tracking who they were. A gateway is what you reach for the
              moment someone asks which agent called which tool, or a credential has to stop living in a developer&apos;s
              config file. Running a gateway means running infrastructure; running a proxy usually means one more line
              in a JSON file.
            </p>
            <p>
              The categories do overlap. TBXark&apos;s MCP Proxy aggregates several backends, which is gateway-shaped,
              but ships no RBAC, audit store or namespaces and is deliberately positioned as plumbing. If what you need
              is policy, start at the{" "}
              <Link href="/mcp-gateway" className="text-blue-400 hover:text-blue-300">gateway comparison</Link> instead.
            </p>
          </div>
        </section>

        {/* Comparison */}
        <section id="compare" className="mb-12 scroll-mt-8">
          <h2 className="text-2xl font-bold text-white mb-3">MCP proxy comparison</h2>
          <p className="text-gray-400 mb-6 max-w-3xl text-sm">
            Read the <strong className="text-gray-200">direction</strong> column first — it is what decides whether a
            given proxy can solve your problem at all. Authentication is the second filter: several of these do no auth
            whatsoever, which is fine for a bridge on your own laptop and not fine for anything shared.
          </p>
          <div className="overflow-x-auto border border-gray-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-gray-900">
                <tr className="text-left text-gray-400">
                  <th className="px-4 py-3 font-medium">Proxy</th>
                  <th className="px-4 py-3 font-medium">Direction</th>
                  <th className="px-4 py-3 font-medium">Transports</th>
                  <th className="px-4 py-3 font-medium">Authentication</th>
                  <th className="px-4 py-3 font-medium">Runtime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {rows.map((p) => (
                  <tr key={p.slug} className="hover:bg-gray-900/50 transition align-top">
                    <td className="px-4 py-4">
                      <Link href={`/servers/${p.slug}`} className="text-blue-400 hover:text-blue-300 font-medium">
                        {p.label}
                      </Link>
                      <div className="text-gray-600 text-xs mt-0.5">{p.vendor}</div>
                      {typeof p.server?.stars === "number" && (
                        <div className="text-gray-600 text-xs mt-0.5">★ {p.server.stars.toLocaleString()}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-300">{p.direction}</td>
                    <td className="px-4 py-4 text-gray-400">{p.transports}</td>
                    <td className="px-4 py-4 text-gray-400">{p.auth}</td>
                    <td className="px-4 py-4 text-gray-500">{p.runtime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-gray-600 text-xs mt-3">
            Repositories, star counts and published package versions verified against the GitHub, npm and PyPI APIs on
            3 August 2026. Each name links to its full listing with the install command.
          </p>
        </section>

        {/* Notes */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Notes on each option</h2>
          <div className="space-y-4">
            {[
              {
                slug: "mcp-remote",
                h: "mcp-remote — the one in everybody's install docs",
                d: "If you have ever pasted an MCP config from a vendor's documentation, you have probably run this. It exists for exactly one gap: stdio-only clients meeting remote servers that require OAuth. It opens a browser once, caches tokens under ~/.mcp-auth, refreshes them silently, and hands the client an ordinary local process. --header skips OAuth for servers that take a static bearer token, --resource keeps two tenants of the same vendor on separate OAuth sessions, --allow-http covers plaintext services inside a trusted network, and --debug writes a full auth trace when a flow fails. Read the README before filing a bug: Cursor and Claude Desktop on Windows mangle spaces inside args, and the workaround is to drop the space after the colon and move the value into an env var. The author calls it an explicitly temporary proof of concept meant to be deleted once clients support remote authorized servers natively, and npm has sat at 0.1.38 since February 2026 — widely relied upon and stable, not actively developed.",
              },
              {
                slug: "sparfenyuk-mcp-proxy",
                h: "MCP Proxy (Python) — the two-way one",
                d: "The most-starred bridge in the category and the one that runs in both directions from the same binary. Give it a URL and it acts as a local stdio command relaying to a remote server; give it --sse-port plus a command after the -- separator and it spawns a stdio server and publishes it on the network. The feature that sets it apart from the alternatives is real OAuth2 client-credentials support via --client-id, --client-secret and --token-url, rather than only static headers — that is the difference between a bridge that can run unattended against a properly secured upstream and one that needs a token pasted in. Named servers front several stdio commands on distinct paths from one process, so a single container can publish a whole toolset, and the README documents extending the published image with your own uvx and npx dependencies plus a Docker Compose setup. PyPI 0.12.0, Python 3.10+, MIT, actively maintained.",
              },
              {
                slug: "punkpeye-mcp-proxy",
                h: "MCP Proxy (TypeScript) — the deployment one",
                d: "Focused on the single direction that matters most when you are shipping something: taking a stdio-only server and publishing it over streamable HTTP and SSE at once, on /mcp and /sse. The flags that decide whether it fits are the session semantics and the timeouts. --stateless creates a fresh server instance per request rather than holding a session, which is what a load balancer or a serverless container needs; the default stateful mode keeps one session per client. --connectionTimeout defaults to 60 seconds for the initial handshake and --requestTimeout to five minutes per call, both worth raising for servers doing slow work. CORS is enabled by default with configurable origins, which removes the usual first-run failure with browser-based clients. Its wider significance is that FastMCP uses this as its streamable-HTTP and SSE layer, so plenty of TypeScript MCP servers already run this code without calling it a proxy. npm 6.5.7, MIT.",
              },
              {
                slug: "supergateway",
                h: "Supergateway — every transport pair, including WebSocket",
                d: "One command converts between any pair of transports people ask for: --stdio publishes a local server over SSE, --outputTransport streamableHttp or ws changes what it publishes, and --sse or --streamableHttp pointed at a remote URL runs it backwards for a stdio-only client. WebSocket output is the genuinely distinguishing capability — nothing else in this comparison offers it. The operational flags are why it shows up in so many container deployments: --cors as a bare flag, explicit origins or a regex; repeatable --healthEndpoint paths for an orchestrator's liveness probe; --oauth2Bearer for a one-argument Authorization header; --logLevel none to keep a chatty bridge out of the logs. Weigh one caveat before standardising on it: the repository was last pushed in October 2025 and npm has held at 3.4.3 since, so it will not track spec changes. Stable and still widely used, but for a deployment that needs ongoing maintenance the two mcp-proxy projects are the actively developed choices.",
              },
              {
                slug: "mcp-proxy-for-aws",
                h: "MCP Proxy for AWS — an auth bridge, not a transport bridge",
                d: "The odd one out in a useful way. MCP standardises on OAuth, but servers hosted on AWS — Bedrock AgentCore endpoints especially — can be secured with IAM, which means every request needs a SigV4 signature no standard client can produce. This picks up whatever credentials your environment already resolves (CLI profile, environment variables, attached IAM role), signs each request, and presents the remote server to the client as a local stdio process. AWS recommends pinning the version rather than tracking @latest because minor releases have changed behaviour. A container image is published to public.ecr.aws for deployments that need one. The second mode matters if you are not using a desktop client at all: the same package imports as a Python library, so LangChain, LlamaIndex and Strands Agents applications can open an authenticated session and manage its lifecycle in code with no proxy process and no hand-written signing. Python 3.10+, Apache-2.0, maintained by AWS.",
              },
              {
                slug: "tbxark-mcp-proxy",
                h: "MCP Proxy (TBXark) — aggregation without a control plane",
                d: "Sits on the boundary with the gateway category and stays deliberately on the proxy side of it. A single Go binary and one JSON config file merge tools, prompts and resources from stdio, SSE and streamable-HTTP downstreams onto one HTTP entrypoint, with no database, UI or control plane to operate. Its standout feature is OAuth client support: authorize once against a downstream that requires an interactive flow, and the proxy holds and refreshes that token for every caller, which is what removes the per-user browser step blocking headless and shared deployments. The container image bundles npx and uvx so it can launch Node and Python servers itself, and it accepts a remote config URL so a fleet of proxies reads one hosted file. It ships no RBAC, no audit store and no namespaces — if you need those, you are looking for a gateway.",
              },
              {
                slug: "mcpo",
                h: "mcpo — the one pointing the other way",
                d: "Included because it answers a question none of the others can: what if the thing consuming your tools speaks OpenAPI rather than MCP? mcpo wraps an MCP server and exposes its tools as REST endpoints with a generated OpenAPI schema and interactive docs, so agent frameworks, SDK codegen and existing API gateways can call MCP tools without implementing the protocol. A Claude-Desktop-format config file serves many servers at once, each on its own route with its own docs page, and --hot-reload picks up changes without downtime. It handles OAuth 2.1 upstreams through dynamic client registration and --root-path lets it sit behind a reverse proxy. Note the repository's last push was May 2026 — stable rather than actively evolving.",
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

        {/* Before you deploy */}
        <section className="mb-12 bg-gray-900 border border-gray-800 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-4">Before you put a proxy in production</h2>
          <ul className="text-gray-400 space-y-3 max-w-3xl text-sm list-disc list-inside">
            <li>
              <strong className="text-gray-200">A stdio server behind HTTP is newly reachable.</strong> It was written
              on the assumption that anything able to spawn it was already trusted, so it probably performs no
              authorization of its own. Bind the proxy to a loopback or private interface unless you have deliberately
              added an auth layer in front of it.
            </li>
            <li>
              <strong className="text-gray-200">Decide stateless versus stateful before, not after.</strong> Session-holding
              modes break the moment a second replica appears behind a load balancer. If the deployment will ever scale
              horizontally, run stateless from day one.
            </li>
            <li>
              <strong className="text-gray-200">Cached OAuth tokens are credentials at rest.</strong> mcp-remote writes
              them under ~/.mcp-auth. That is exactly what makes it convenient, and it belongs in your threat model on a
              shared or long-lived machine.
            </li>
            <li>
              <strong className="text-gray-200">Raise the timeouts for slow tools.</strong> Defaults are tuned for
              interactive calls. A tool that runs a long query or a build will hit a request timeout that looks like an
              unexplained disconnect.
            </li>
            <li>
              <strong className="text-gray-200">Check the maintenance date.</strong> Two of the seven here have not
              shipped a release in months. That is acceptable for a stable bridge and not acceptable for something you
              expect to track protocol changes.
            </li>
          </ul>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">MCP proxy FAQ</h2>
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
        <section className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-500/20 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Find the server you are trying to reach</h2>
          <p className="text-gray-400 mb-6">
            A proxy only helps once you know which server is on the other end. Browse the catalog with verified
            repositories and install commands.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/servers" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition">
              Browse MCP servers
            </Link>
            <Link href="/mcp-gateway" className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition">
              Compare MCP gateways
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
