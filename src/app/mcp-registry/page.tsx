import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "MCP Registry — The Official Registry, GitHub, Docker and Smithery Compared | MyMCPTools",
  description:
    "An MCP registry is a catalog that lets clients discover and install MCP servers. Compare the official Model Context Protocol registry, the GitHub MCP Registry, the Docker MCP Catalog and Smithery on what they curate, how servers are published and who runs them.",
  alternates: {
    canonical: "https://mymcptools.com/mcp-registry",
  },
  openGraph: {
    title: "MCP Registry — Compare the Official, GitHub, Docker and Smithery Registries | MyMCPTools",
    description:
      "One shared metadata layer, many front doors. How the official MCP registry, the GitHub MCP Registry, the Docker MCP Catalog and Smithery relate — and which one you publish to.",
    type: "website",
    url: "https://mymcptools.com/mcp-registry",
  },
};

type RegistryRow = {
  name: string;
  operator: string;
  kind: string;
  scale: string;
  publish: string;
  url: string;
};

const registries: RegistryRow[] = [
  {
    name: "Official MCP Registry",
    operator: "Model Context Protocol project",
    kind: "Metadata registry + REST API",
    scale: "Canonical namespace layer",
    publish: "mcp-publisher CLI + server.json, namespace ownership proven",
    url: "https://registry.modelcontextprotocol.io",
  },
  {
    name: "GitHub MCP Registry",
    operator: "GitHub",
    kind: "Curated directory, Copilot/VS Code install",
    scale: "Curated, ranked by stars + activity",
    publish: "Curated listing; enterprise allowlist registries configurable",
    url: "https://github.com/mcp",
  },
  {
    name: "Docker MCP Catalog",
    operator: "Docker",
    kind: "Containerized catalog + MCP Toolkit",
    scale: "200+ servers",
    publish: "PR to docker/mcp-registry; images signed with SBOM + provenance",
    url: "https://hub.docker.com/mcp",
  },
  {
    name: "Smithery",
    operator: "Smithery (independent)",
    kind: "Directory + hosted runtime",
    scale: "7,000+ servers",
    publish: "smithery.yaml in repo, indexed via CLI/deploy",
    url: "https://smithery.ai",
  },
];

const faqItems = [
  {
    question: "What is an MCP registry?",
    answer:
      "An MCP registry is a catalog of Model Context Protocol servers that a client, agent or developer can search to find and install tools. At minimum it stores, for each server, a name, a description, the repository or package it ships from, and the transport and install details a client needs to connect. The Model Context Protocol defines how a client talks to one server; a registry is the layer above that answers the earlier question — which server do I even want, and where does it come from. The word covers two different things in practice: the single official metadata registry run by the MCP project, and the many consumer-facing directories (GitHub, Docker, Smithery and others) that catalog servers for a particular audience or runtime.",
  },
  {
    question: "What is the official MCP registry?",
    answer:
      "The official MCP registry is a community-driven metadata service run by the Model Context Protocol project itself, live at registry.modelcontextprotocol.io with a documented REST API. It launched in preview in September 2025 and is maintained by a working group that includes people from PulseMCP, Stacklok, TeamSpark and Ravenmail alongside the core maintainers. Its job is deliberately narrow: be the single canonical source of truth for what MCP servers exist and who owns each name, so that every downstream directory can build on the same data instead of maintaining its own incompatible list. It is not itself a glossy storefront — it is the plumbing the storefronts read from.",
  },
  {
    question: "How do I publish an MCP server to the registry?",
    answer:
      "You publish to the official registry with the mcp-publisher CLI and a server.json file that describes your server. The registry enforces namespace ownership, which is the part that keeps it trustworthy: a GitHub-based name like io.github.username/server-name requires you to authenticate as that GitHub identity (via OAuth or GitHub OIDC in CI), and a domain-based name like yourcompany.com/server-name requires you to prove control of the domain by DNS or HTTP verification. That ownership check is why a registry entry is a stronger signal than a bare search result: nobody can publish under Stripe's or Notion's namespace without controlling Stripe's or Notion's identity. Once published, your server.json metadata is available through the REST API for any downstream directory to ingest.",
  },
  {
    question: "What is the difference between the GitHub MCP Registry and the official one?",
    answer:
      "They sit at different layers. The official MCP registry is the metadata backbone — an API and an ownership model, not a curated shortlist. The GitHub MCP Registry, at github.com/mcp, is a curated consumer directory: it launched in September 2025 with partners like Figma, Postman, HashiCorp and Dynatrace, sorts listings by GitHub stars and community activity to surface the active ones, and wires into VS Code and Copilot for one-click installation. GitHub can also let an organization or enterprise configure its own registry as an allowlist, so admins control which MCP servers their developers may install. Think of the official registry as the source of truth and GitHub's as one of the front doors — a curated, install-ready view aimed at Copilot users.",
  },
  {
    question: "What is the Docker MCP Catalog?",
    answer:
      "The Docker MCP Catalog is Docker's registry of containerized MCP servers, paired with the MCP Toolkit in Docker Desktop that runs them in isolated containers with per-server secrets and environment configuration. It carries 200+ servers, and its distinguishing feature is supply-chain provenance: Docker-built servers ship as signed images with SBOMs, build attestations and automatic security updates, so you get a cryptographically verifiable artifact rather than an arbitrary npx command pulling the latest tag. Publishing is a pull request to the docker/mcp-registry repository. If your concern is running untrusted MCP servers safely, the catalog plus Toolkit is the registry that addresses it directly — the container is the sandbox and the signature is the trust anchor.",
  },
  {
    question: "What about Smithery, Glama and the other directories?",
    answer:
      "Those are independent community directories, and they are where the raw breadth lives. Smithery indexes 7,000+ servers and adds a hosted runtime — you can run many servers on Smithery's infrastructure as remote endpoints instead of installing them locally, and servers opt in with a smithery.yaml in their repository. Glama, PulseMCP and mcp.so are other widely used catalogs with their own search and metadata. They predate and complement the official registry rather than competing with it: several of them are moving to ingest the official registry's API so their listings inherit the same namespace-ownership guarantees. Breadth is their strength and also their caveat — a directory that lists everything lists unverified and abandoned servers too, so read the repository and the last-pushed date before you install.",
  },
  {
    question: "Is there an AWS or enterprise MCP registry?",
    answer:
      "Yes, and the pattern is the same everywhere the word appears with a vendor in front of it. AWS, JFrog and other platform vendors have added MCP registry features so that an organization can host a private, governed catalog of the servers its teams are allowed to use, rather than pulling from the open internet. Enterprise registries are about control rather than discovery: an allowlist, a place to host internal-only servers, provenance requirements, and an audit trail of what was installed. GitHub's configurable organization registry is the same idea inside the GitHub ecosystem. If you searched for a vendor-named MCP registry, you are almost certainly looking at that governance layer, and it usually reads from or mirrors the official registry underneath.",
  },
  {
    question: "Registry, marketplace, directory, catalog — are these the same thing?",
    answer:
      "They overlap heavily and the industry uses them loosely, but there is a useful distinction. A registry emphasizes the authoritative metadata and ownership model — the official MCP registry is the clearest example. A catalog or directory emphasizes browsing and discovery for humans. A marketplace implies installation, and sometimes distribution or commerce, on top of discovery. In MCP today most of these are the same underlying idea viewed from a different angle, and the real question is not which noun a site uses but three practical things: does it verify server ownership, does it show you a maintenance signal, and can your client install straight from it. If you want the browse-and-install view, start at our MCP marketplace overview; if you want to understand the plumbing, this page is it.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "MCP Registry",
  description:
    "What an MCP registry is, what the official Model Context Protocol registry does, and how the GitHub MCP Registry, the Docker MCP Catalog and Smithery compare on curation, publishing and who operates them.",
  url: "https://mymcptools.com/mcp-registry",
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://mymcptools.com" },
      { "@type": "ListItem", position: 2, name: "MCP Registry", item: "https://mymcptools.com/mcp-registry" },
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

export default function MCPRegistryPage() {
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
            <li className="text-gray-300">MCP Registry</li>
          </ol>
        </nav>

        {/* Hero */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs px-2.5 py-1 rounded-full font-medium">
              Infrastructure
            </span>
            <span className="bg-gray-800 text-gray-400 text-xs px-2.5 py-1 rounded-full">{registries.length} registries compared</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">MCP Registry</h1>
          <p className="text-lg text-gray-400 max-w-3xl mb-4">
            An <strong className="text-gray-200">MCP registry</strong> is a catalog that lets a client, an agent or a
            developer discover a Model Context Protocol server and install it. The protocol says how a client talks to
            one server; a registry answers the question that comes first — which server, and where does it come from.
          </p>
          <p className="text-gray-500 max-w-3xl mb-6">
            The confusing part is that &quot;MCP registry&quot; means two things at once. There is a single{" "}
            <strong className="text-gray-200">official registry</strong> run by the MCP project — a metadata API with an
            ownership model — and there are several <strong className="text-gray-200">consumer directories</strong>{" "}
            (GitHub, Docker, Smithery) that read from it and add their own curation. This page separates the two and
            shows which one you actually want.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#compare" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition text-sm">
              Compare registries →
            </a>
            <Link href="/mcp-marketplace" className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg font-medium transition text-sm">
              MCP marketplace overview
            </Link>
            <Link href="/servers" className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg font-medium transition text-sm">
              Browse all MCP servers
            </Link>
          </div>
        </div>

        {/* One layer, many front doors */}
        <section className="mb-12 bg-gray-900 border border-gray-800 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-4">One metadata layer, many front doors</h2>
          <div className="text-gray-400 space-y-3 max-w-3xl">
            <p>
              The single most useful thing to understand is that these registries are not seven competing lists. At the
              bottom is the <strong className="text-gray-200">official MCP registry</strong> at
              registry.modelcontextprotocol.io: an open REST API and a strict namespace-ownership model whose only job is
              to be the canonical record of what servers exist and who owns each name.
            </p>
            <p>
              On top of that sit the <strong className="text-gray-200">subregistries and directories</strong> — the
              GitHub MCP Registry, the Docker MCP Catalog, Smithery, Glama, PulseMCP. Each ingests or mirrors the same
              underlying metadata and then adds something for its own audience: Copilot installation, signed containers,
              a hosted runtime, an enterprise allowlist. When you read that a company &quot;launched an MCP
              registry,&quot; it is almost always a front door of this kind, not a second source of truth.
            </p>
            <p>
              That layering is why the practical advice differs by role. If you are <em>publishing</em> a server, you
              publish once to the official registry and the front doors pick it up. If you are <em>installing</em> one,
              you choose the front door that matches your client and your trust requirements.
            </p>
          </div>
        </section>

        {/* Which one do you want */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-3">Which registry do you actually want?</h2>
          <p className="text-gray-400 mb-6 max-w-3xl text-sm">
            Four intents, four answers. Identify yours and the choice narrows immediately.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                t: "You are publishing a server",
                d: "You wrote an MCP server and want clients to find it under a name nobody else can claim. Publish once to the canonical metadata layer and let the directories ingest it.",
                a: "Official MCP registry — mcp-publisher CLI + server.json, namespace verified by GitHub or domain.",
              },
              {
                t: "You install from Copilot or VS Code",
                d: "You want a curated, install-ready shortlist rather than a raw dump of everything, surfaced where you already work and ranked so the active servers rise to the top.",
                a: "GitHub MCP Registry — one-click into VS Code, sorted by stars and activity.",
              },
              {
                t: "You care about running untrusted servers safely",
                d: "You do not want an arbitrary npx command pulling the latest tag into your shell. You want a verifiable artifact and a sandbox around it.",
                a: "Docker MCP Catalog + MCP Toolkit — signed images with SBOMs and provenance, run in isolated containers.",
              },
              {
                t: "You want maximum breadth or a hosted server",
                d: "You are looking for something niche that the curated lists have not picked up, or you would rather not host the server yourself at all.",
                a: "Smithery — 7,000+ servers plus a hosted runtime; Glama and PulseMCP for extra coverage.",
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

        {/* Comparison */}
        <section id="compare" className="mb-12 scroll-mt-8">
          <h2 className="text-2xl font-bold text-white mb-3">MCP registry comparison</h2>
          <p className="text-gray-400 mb-6 max-w-3xl text-sm">
            Read the <strong className="text-gray-200">kind</strong> column first — the official registry is a metadata
            API and the rest are consumer-facing directories that build on top of it. The second filter is publishing:
            each one accepts servers differently, and the ownership check is what separates a trustworthy entry from a
            search result.
          </p>
          <div className="overflow-x-auto border border-gray-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-gray-900">
                <tr className="text-left text-gray-400">
                  <th className="px-4 py-3 font-medium">Registry</th>
                  <th className="px-4 py-3 font-medium">Operator</th>
                  <th className="px-4 py-3 font-medium">Kind</th>
                  <th className="px-4 py-3 font-medium">Scale</th>
                  <th className="px-4 py-3 font-medium">Publishing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {registries.map((r) => (
                  <tr key={r.name} className="hover:bg-gray-900/50 transition align-top">
                    <td className="px-4 py-4">
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-medium">
                        {r.name}
                      </a>
                    </td>
                    <td className="px-4 py-4 text-gray-300">{r.operator}</td>
                    <td className="px-4 py-4 text-gray-400">{r.kind}</td>
                    <td className="px-4 py-4 text-gray-400">{r.scale}</td>
                    <td className="px-4 py-4 text-gray-500">{r.publish}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-gray-600 text-xs mt-3">
            Registry status, scale figures and publishing mechanisms verified against each project&apos;s documentation
            and GitHub repositories in August 2026. The official registry launched in preview in September 2025 and lists
            7,100+ stars on its GitHub repository at time of writing.
          </p>
        </section>

        {/* Notes on each */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Notes on each registry</h2>
          <div className="space-y-4">
            {[
              {
                h: "Official MCP Registry — the source of truth",
                d: "Run by the Model Context Protocol project at registry.modelcontextprotocol.io, this is a REST API rather than a storefront. It went to preview in September 2025 with an API freeze on v0.1, and a working group drawn from PulseMCP, Stacklok, TeamSpark and Ravenmail maintains it. The design decision that gives it its value is namespace ownership: a name like io.github.acme/db-tools requires you to authenticate as that GitHub identity, and a domain name like acme.com/db-tools requires DNS or HTTP proof of the domain. That is why an entry here is a stronger signal than a bare GitHub search — nobody publishes under Stripe's namespace without controlling Stripe's identity. You interact with it through the mcp-publisher CLI and a server.json file, and everything downstream reads the resulting metadata.",
                link: { href: "https://registry.modelcontextprotocol.io", label: "registry.modelcontextprotocol.io" },
              },
              {
                h: "GitHub MCP Registry — the curated front door for Copilot",
                d: "Launched September 2025 at github.com/mcp with partners including Figma, Postman, HashiCorp and Dynatrace, this is a curated directory rather than an exhaustive one. It sorts listings by GitHub stars and community activity so the maintained servers surface first, and it integrates with VS Code and Copilot for one-click installation. For organizations, GitHub also lets admins configure a registry as an allowlist, controlling exactly which MCP servers their developers can install — the same governance idea other vendors ship, kept inside the GitHub ecosystem. If your team lives in Copilot, this is the front door that will feel native.",
                link: { href: "https://github.com/mcp", label: "github.com/mcp" },
              },
              {
                h: "Docker MCP Catalog — provenance and a sandbox",
                d: "Docker's answer to the trust problem. The catalog carries 200+ containerized MCP servers, and the paired MCP Toolkit in Docker Desktop runs them in isolated containers with per-server secrets and configuration. The differentiator is supply-chain integrity: Docker-built servers ship as signed images with SBOMs, build attestations and automatic security updates, so you install a verifiable artifact instead of trusting a package registry's latest tag. Publishing is a pull request to the docker/mcp-registry repository. When the risk you are managing is 'this server runs code on my machine with my API keys,' the container-plus-signature model addresses it more directly than any curation policy can.",
                link: { href: "https://hub.docker.com/mcp", label: "hub.docker.com/mcp" },
              },
              {
                h: "Smithery, Glama, PulseMCP — breadth and hosting",
                d: "The independent directories are where the long tail lives. Smithery indexes 7,000+ servers and adds a hosted runtime, so many servers can run on its infrastructure as remote endpoints rather than local installs; servers opt in with a smithery.yaml in the repo. Glama, PulseMCP and mcp.so are other well-populated catalogs, and several are moving to ingest the official registry so their entries inherit its ownership guarantees. Their strength is coverage and their caveat is the flip side of it: a list of everything includes unverified and abandoned servers, so the last-pushed date and the repository itself are worth a look before you install.",
                link: { href: "https://smithery.ai", label: "smithery.ai" },
              },
              {
                h: "Enterprise and vendor registries — AWS, JFrog, org allowlists",
                d: "When a platform vendor announces an MCP registry, it is almost always a governance layer rather than a new discovery surface. AWS, JFrog and GitHub's organization registries all let a company host a private, curated catalog of approved servers, host internal-only ones, and keep an audit trail of what was installed — usually reading from or mirroring the official registry underneath. If you searched for a vendor-named MCP registry, this control-and-compliance angle is what you are looking at, not a competitor to the public catalogs.",
                link: null,
              },
            ].map((n) => (
              <div key={n.h} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-2">{n.h}</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-3">{n.d}</p>
                {n.link && (
                  <a href={n.link.href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm transition">
                    {n.link.label} →
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Before you publish or install */}
        <section className="mb-12 bg-gray-900 border border-gray-800 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-4">Before you publish to or install from a registry</h2>
          <ul className="text-gray-400 space-y-3 max-w-3xl text-sm list-disc list-inside">
            <li>
              <strong className="text-gray-200">Publish to the official registry first.</strong> A verified namespace
              entry is the thing every downstream directory can trust and ingest. Claim io.github.you/… or your domain
              before a squatter does.
            </li>
            <li>
              <strong className="text-gray-200">A registry listing is not a security review.</strong> Except for the
              signed Docker images, most entries are metadata about someone else&apos;s code. Read the repository, check
              the last-pushed date, and treat an install as running that code with your credentials.
            </li>
            <li>
              <strong className="text-gray-200">Match the front door to the client.</strong> Copilot and VS Code users
              get the smoothest path from GitHub&apos;s registry; a Python or container stack fits the Docker catalog;
              breadth-hunting fits Smithery.
            </li>
            <li>
              <strong className="text-gray-200">Enterprises want the allowlist, not the open list.</strong> If policy
              matters, the value is a governed private registry (GitHub org, AWS, JFrog) that restricts installs to
              vetted servers and records what was installed.
            </li>
            <li>
              <strong className="text-gray-200">Ownership beats popularity.</strong> Star counts get inflated and copied.
              A namespace-verified entry proves who shipped the server, which is the signal that actually protects you
              from an impostor package.
            </li>
          </ul>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">MCP registry FAQ</h2>
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
          <h2 className="text-2xl font-bold text-white mb-3">Skip the registry hop — browse verified servers</h2>
          <p className="text-gray-400 mb-6">
            Every MCP server in our catalog carries a verified repository, real star count and a working install command.
            Find the tool first, then install it from whichever registry you prefer.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/servers" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition">
              Browse MCP servers
            </Link>
            <Link href="/mcp-marketplace" className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition">
              MCP marketplace overview
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
