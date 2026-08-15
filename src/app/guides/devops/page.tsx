import { Metadata } from "next";
import Link from "next/link";
import { getServerGuide } from "@/data/server-guides";
import { getServerBySlug } from "@/data/servers";

/**
 * Landing page for the head term "devops MCP server" / "deployment MCP server".
 *
 * Same reasoning as /guides/databases: five hand-written guides now sit in the
 * infrastructure bucket, and five cards inside /guides answers "here are some
 * guides" rather than the question the head term asks — I ship to somewhere and
 * something is broken, which server do I connect and how much can it reach.
 *
 * The comparison axis is different from the database cluster's, and that is the
 * whole reason this is a separate page rather than a copy. For a database the
 * differentiator is the read-only switch. Here almost nothing writes to your
 * data; what varies is blast radius — every one of these is a control plane
 * authorised as *you*, and the guard is credential scope, not a flag. So the
 * second row on each card is what the connection can reach if the model gets
 * something wrong.
 *
 * Copy is written by hand from the per-server guides, which were read out of
 * each vendor's own docs. Only name, verification date and guide existence come
 * from data, so a row cannot drift from its guide without the guide changing.
 */

/** Deploy targets first, then the two observability servers you point at them. */
const CLUSTER: {
  slug: string;
  /** The one-line reason someone lands on this term and needs this row. */
  pitch: string;
  /** What the server actually is, in the fewest honest words. */
  shape: string;
  /** Blast radius: what this connection can reach. The real differentiator. */
  reach: string;
}[] = [
  {
    slug: "railway",
    pitch:
      "Four things answer to the name. The archived repo and the deprecated npm package both still install cleanly, which is why people are months behind without knowing.",
    shape:
      "Bundled in the Railway CLI — `railway mcp` starts a local stdio server, `railway mcp install` writes the client config. There is also a hosted server at mcp.railway.com with a different, much smaller tool set.",
    reach:
      "Whatever your `railway login` session can reach. Local exposes ~50 tools including domains, volumes, TCP proxies and service deletion; Remote exposes 11 and refuses project tokens outright, because it wants a user identity for the audit trail.",
  },
  {
    slug: "vercel",
    pitch:
      "Remote and OAuth-only, and the client allowlist means \"it will not connect\" is frequently not a bug you can fix.",
    shape:
      "Hosted at mcp.vercel.com, in Beta, on all plans, nothing to install. Vercel only accepts connections from AI clients it has reviewed.",
    reach:
      "Vercel says it plainly: the same access as your own Vercel user account. Nearly every tool also requires a teamId, so an agent that has not called list_teams first fails in a way that reads as a permissions error and is not.",
  },
  {
    slug: "cloudflare",
    pitch:
      "Not one server. One API server with two tools that reach everything, plus sixteen product servers with curated tools that reach one thing each.",
    shape:
      "mcp.cloudflare.com/mcp fronts 2,500+ API endpoints behind `search` and `execute` (the Code Mode pattern). The sixteen product servers each live on their own *.mcp.cloudflare.com hostname — Observability, Workers Bindings, Radar, Browser Rendering, DNS Analytics, CASB.",
    reach:
      "The API server reaches the entire Cloudflare API, which is the argument for choosing a product server instead: a smaller, legible tool list whose names you can actually read in the client is also a smaller blast radius.",
  },
  {
    slug: "datadog",
    pitch:
      "Nothing to install, and the setting that decides whether it is usable is how many tools you turned on.",
    shape:
      "A hosted endpoint on your own Datadog site at mcp.<your-site>/api/unstable/mcp-server/mcp, authorised by OAuth from inside the client. Use Datadog's own plugin or connector rather than a hand-written entry.",
    reach:
      "Read-heavy by nature — this is the observability half of the cluster. The practical constraint is context, not permissions: `core` is deliberately small and `toolsets=all` runs to hundreds of tools across two dozen toolsets and will eat your window before the first question.",
  },
  {
    slug: "sentry",
    pitch:
      "Deliberately not a wrapper around the Sentry API — the tool selection is skewed to debugging, not administration.",
    shape:
      "Remote by default at mcp.sentry.dev/mcp, running on Cloudflare's remote-MCP infrastructure. The stdio transport exists mainly so self-hosted installs have a path, and its README calls it a work in progress.",
    reach:
      "Your Sentry org's issues and events. The gotcha is orthogonal to scope: the AI-powered search tools need their own LLM provider key, and without one they do not appear at all rather than failing loudly.",
  },
];

/** Rendered as visible copy and as FAQPage schema — same text, one source. */
const FAQS: { question: string; answer: string }[] = [
  {
    question: "What is a DevOps MCP server?",
    answer:
      "A server that exposes a deployment platform or observability tool to an AI client through the Model Context Protocol, so the model can create a service, read a build log, roll an environment variable or query error events by calling named tools. It is a control plane, not a data source: the interesting tools change infrastructure rather than return rows.",
  },
  {
    question: "Which MCP server should I connect for deployments?",
    answer:
      "The one for the platform you deploy to — Railway, Vercel and Cloudflare all publish first-party servers and none of them manages the others. Then pair it with the observability server you already pay for: Sentry for errors, Datadog for metrics and logs. The pairing is the point, because 'deploy failed, why' is a question that spans both.",
  },
  {
    question: "Is a remote MCP server better than a local one?",
    answer:
      "Not automatically, and Railway is the counterexample worth knowing. The usual assumption is that a hosted server is the fuller product; Railway's local server exposes roughly fifty tools while its remote one exposes eleven. Remote does get one tool local does not — railway-agent, which hands multi-step debugging to Railway's own agent. Check the tool list before choosing on transport convenience.",
  },
  {
    question: "How much access does an infrastructure MCP server have?",
    answer:
      "As much as the identity you authorised it with, which for OAuth-based servers is usually your own account. Vercel documents this explicitly. That makes credential scope the real guard here rather than any read-only flag: prefer a scoped token or a product-specific server over an account-wide one, keep the connection pointed at non-production where you can, and remember that OAuth tokens are short-lived and revocable from the vendor's own settings.",
  },
  {
    question: "Can an AI agent delete my production service?",
    answer:
      "If the tool is registered and the credential permits it, yes — remove_service, delete_domain and remove_volume are real tools in this cluster. Servers mark destructive tools with protocol-level hints and good clients prompt, but a hint is only honoured by clients that implement it. The durable prevention is the same as everywhere else: an identity that lacks the permission, and a server whose tool list is narrow because you chose the narrow one.",
  },
];

export const metadata: Metadata = {
  title: "DevOps MCP Servers — Deploy and Debug from Your Editor | MyMCPTools",
  description:
    "Railway, Vercel, Cloudflare, Datadog and Sentry MCP servers compared: what each one exposes, how much of your account it can reach, and which of the several servers the name refers to.",
  alternates: { canonical: "https://mymcptools.com/guides/devops" },
  openGraph: {
    title: "DevOps and deployment MCP servers, compared | MyMCPTools",
    description:
      "Five source-verified infrastructure MCP server guides in one place — tools, transports and how much of your account each connection can reach.",
    type: "website",
    url: "https://mymcptools.com/guides/devops",
  },
};

export default function DevOpsGuidesPage() {
  const rows = CLUSTER.map((entry) => ({
    ...entry,
    guide: getServerGuide(entry.slug),
    server: getServerBySlug(entry.slug),
  })).filter((row) => row.guide && row.server);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "DevOps and deployment MCP servers",
      description:
        "Source-verified setup guides for the MCP servers that connect an AI client to a deployment platform or observability tool.",
      url: "https://mymcptools.com/guides/devops",
      numberOfItems: rows.length,
      itemListElement: rows.map((row, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: `${row.server!.name} setup guide`,
        url: `https://mymcptools.com/servers/${row.slug}`,
      })),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
        <nav className="mb-8 text-sm text-gray-500">
          <Link href="/" className="transition hover:text-gray-300">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link href="/guides" className="transition hover:text-gray-300">
            Guides
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-400">DevOps</span>
        </nav>

        <h1 className="text-3xl font-bold text-white sm:text-4xl">
          DevOps and deployment MCP servers, compared
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-gray-400">
          A database MCP server reads your data. These read your infrastructure and
          then change it — create a service, issue a domain, roll a variable,
          redeploy. Five of them have hand-written guides here, and the question
          that separates them is not which has more tools. It is how much of your
          account the connection can reach when the model is wrong.
        </p>
        <p className="mt-4 leading-relaxed text-gray-500">
          Two patterns to know before you connect one. First, almost every server
          in this cluster authorises as <em>you</em> — Vercel documents that a
          connection grants the same access as your own user account, and the
          others differ mainly in whether a narrower option exists. There is no
          read-only flag to fall back on the way there is with a database, so
          credential scope is the guard. Second, remote is not automatically the
          fuller product: Railway&rsquo;s local server has roughly fifty tools and
          its hosted one has eleven. Read the tool list, not the transport.
        </p>

        <div className="mt-10 space-y-4">
          {rows.map((row) => (
            <div
              key={row.slug}
              className="rounded-xl border border-gray-800 bg-gray-900/60 p-6"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-lg font-semibold text-white">
                  <Link
                    href={`/servers/${row.slug}`}
                    className="transition hover:text-blue-300"
                  >
                    {row.server!.name}
                  </Link>
                </h2>
                <span className="text-xs text-gray-500">
                  sources re-read {row.guide!.verifiedOn}
                </span>
              </div>

              <p className="mt-3 leading-relaxed text-gray-400">{row.pitch}</p>

              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">What it is</dt>
                  <dd className="mt-1 leading-relaxed text-gray-400">{row.shape}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">What the connection can reach</dt>
                  <dd className="mt-1 leading-relaxed text-gray-400">{row.reach}</dd>
                </div>
              </dl>

              <Link
                href={`/servers/${row.slug}`}
                className="mt-5 inline-block text-sm text-blue-400 transition hover:text-blue-300"
              >
                Read the {row.server!.name} guide &rarr;
              </Link>
            </div>
          ))}
        </div>

        <section className="mt-14">
          <h2 className="text-xl font-semibold text-white">Choosing between them</h2>
          <p className="mt-3 leading-relaxed text-gray-400">
            These are not alternatives to each other, which is the first thing to
            get straight. You connect the one that hosts your app, and then you
            connect the one that tells you why it broke. The combination is what
            makes an agent useful for a deploy failure: the platform server has the
            build log and the observability server has the exception that followed
            it.
          </p>
          <p className="mt-4 leading-relaxed text-gray-400">
            Where there is a real choice, it is usually within a vendor rather than
            between them. Cloudflare&rsquo;s API server reaches 2,500+ endpoints
            behind two tools; its sixteen product servers each reach one product
            with named tools you can read. Railway&rsquo;s local and remote servers
            share a name and almost no tools. In both cases the narrower option is
            the better default, and the broader one is something you reach for
            deliberately.
          </p>
          <p className="mt-4 leading-relaxed text-gray-400">
            Then scope the credential, because that is the only guard that holds
            regardless of which tool the model picks. Prefer OAuth over a
            long-lived token where the vendor offers it — Railway&rsquo;s CLI proxy
            exists precisely so no durable credential sits in an editor config
            file. Point the connection at a staging workspace when the work does
            not need production. And know where to revoke: OAuth tokens are
            short-lived and revocable from the vendor&rsquo;s own account settings,
            which a pasted API key is not.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-semibold text-white">
            DevOps MCP servers: common questions
          </h2>
          <div className="mt-5 space-y-5">
            {FAQS.map((faq) => (
              <div
                key={faq.question}
                className="rounded-xl border border-gray-800 bg-gray-900/40 p-5"
              >
                <h3 className="font-semibold text-white">{faq.question}</h3>
                <p className="mt-2 leading-relaxed text-gray-400">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="mt-12 text-sm text-gray-500">
          Connecting a database instead?{" "}
          <Link
            href="/guides/databases"
            className="text-blue-400 hover:text-blue-300"
          >
            Database MCP servers, compared
          </Link>
          {" · "}
          <Link
            href="/guides/workspace"
            className="text-blue-400 hover:text-blue-300"
          >
            Workspace MCP servers, compared
          </Link>
          {" · "}
          <Link href="/guides" className="text-blue-400 hover:text-blue-300">
            All setup guides
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
