import { Metadata } from "next";
import Link from "next/link";
import { getServerGuide } from "@/data/server-guides";
import { getServerBySlug } from "@/data/servers";

/**
 * Landing page for the head term "database MCP server".
 *
 * The five database guides are the strongest cluster on the site, but they were
 * only reachable as five separate cards inside /guides, which answers "here are
 * some guides" and not the question the head term is actually asking: I have a
 * database and an agent, which server do I install and what will it let the
 * model do. That question is answered by comparing them, so it needs a page
 * that compares them.
 *
 * Everything here is written by hand from the per-server guides, which were
 * themselves read out of each project's own docs. The only data pulled from the
 * catalog is the name, star count and verification date, so nothing on this
 * page can drift away from the guide it summarises without the guide changing.
 */

/** Order is deliberate: the ambiguous ones first, since that is the question. */
const CLUSTER: {
  slug: string;
  /** The one-line reason someone lands on this term and needs this row. */
  pitch: string;
  /** What the server actually is, in the fewest honest words. */
  shape: string;
  /** The safety mechanism, because that is the real differentiator. */
  guard: string;
}[] = [
  {
    slug: "postgresql",
    pitch:
      "The name is contested: the server most tutorials still point at now lives in modelcontextprotocol/servers-archived, and its npm package carries a deprecation notice.",
    shape:
      "Local stdio server against any Postgres connection string. The maintained one, crystaldba/postgres-mcp, has nine tools including index tuning and health checks; the archived reference server had exactly one, query.",
    guard:
      "--access-mode=restricted rejects COMMIT and ROLLBACK at the parser, so a model cannot close the read-only transaction and open a writable one.",
  },
  {
    slug: "mongodb",
    pitch:
      "One official server, but two tool surfaces — a database client and an Atlas control plane — with different credentials.",
    shape:
      "npx or Docker, stdio by default. Around sixty tools: find, aggregate, explain and schema inspection on the data side; cluster, user and access-list management on the Atlas side.",
    guard:
      "--readOnly drops every create, update and delete tool. It is off by default, and confirmation prompts depend on client elicitation support, so the flag is the boundary.",
  },
  {
    slug: "supabase",
    pitch:
      "Not really a database server — a project server that happens to include SQL.",
    shape:
      "Hosted remote server at mcp.supabase.com/mcp with OAuth, covering tables, migrations, edge functions, logs and branches alongside queries.",
    guard:
      "Query parameters, not flags: read_only decides whether it can write, project_ref limits it to one project, features decides which tool groups exist. Supabase's own docs say not to point it at production.",
  },
  {
    slug: "neon",
    pitch:
      "Serverless Postgres where the interesting capability is branching a database, not querying one.",
    shape:
      "Hosted server at mcp.neon.tech. The configuration is the URL: readonly, category and projectId are query parameters, not env vars.",
    guard:
      "readonly in the URL, plus the fact that a scoped URL can be verified before use by calling the public list-tools endpoint.",
  },
  {
    slug: "redis",
    pitch:
      "Same ambiguity as Postgres and the same cause: the npm package everyone pastes is Anthropic's reference server, deprecated since April 2025, while the maintained one is a Python package no npx command can reach.",
    shape:
      "Local stdio server, stdio only — no hosted endpoint. Tools are grouped by Redis type: strings, hashes, lists, sets, sorted sets, JSON, Streams with consumer groups, stateful pub/sub subscriptions, and vector index management for use as an agent memory store.",
    guard:
      "None in the server. It is the one here with no read-only flag — the documented control is a Redis ACL user (ACL SETUSER readonlyuser on >pw ~* +@read -@write), enforced by the database rather than by which tools got registered.",
  },
  {
    slug: "clickhouse",
    pitch:
      "Columnar analytics, where the common failure is configuration rather than SQL.",
    shape:
      "Python server over the HTTP interface, plus chDB for querying files and URLs with no cluster at all.",
    guard:
      "Two tiers: writes need CLICKHOUSE_ALLOW_WRITE_ACCESS, and DROP or TRUNCATE needs CLICKHOUSE_ALLOW_DROP on top of it.",
  },
];

/** Rendered as visible copy and as FAQPage schema — same text, one source. */
const FAQS: { question: string; answer: string }[] = [
  {
    question: "What is a database MCP server?",
    answer:
      "A process that exposes your database to an AI client through the Model Context Protocol, so the model can list collections or tables, read schemas, run queries and — if you let it — write. It is not a driver replacement and not an ORM: the model calls named tools like find or query, and the server is what decides which of those tools exist at all.",
  },
  {
    question: "Which database MCP server should I install?",
    answer:
      "The one for the database you have — there is no cross-database server worth using, because the value is in the tools that understand that engine's plans, indexes and schema. The choice that actually matters is within an engine: for Postgres and Redis, whether you install the archived reference server or the maintained one; for MongoDB, whether you also hand it Atlas control-plane credentials.",
  },
  {
    question: "Is it safe to connect an MCP server to a production database?",
    answer:
      "Only with a read-only mode enabled at the server and a database user that cannot write, which is two independent guards for a reason. Every server in this cluster except Redis ships a read-only switch, and none of the ones that do is on by default; Redis has no such switch, so there the database-side user is the only guard there is. Treat a confirmation prompt as a convenience rather than a control: MongoDB's confirmations, for example, depend on the client supporting elicitation, and a client that does not simply runs the tool.",
  },
  {
    question: "Can an MCP server drop my tables?",
    answer:
      "If you leave write tools registered and connect with a privileged user, yes — drop-collection, drop-database and DROP statements are all real tools in these servers. The reliable prevention is a role that lacks the permission, because that holds regardless of which tool the model decides to call and regardless of how the client handles confirmations.",
  },
  {
    question: "Do database MCP servers work with Claude, Cursor and VS Code?",
    answer:
      "Yes — all six are ordinary MCP servers. The local ones (Postgres, MongoDB, Redis, ClickHouse) launch over stdio from a client config file; the hosted ones (Neon, Supabase) are added as a URL and authorised with OAuth. Redis is stdio-only, so a client that supports remote servers exclusively cannot connect to it at all. The most common client-side failure is PATH: a client launched from the desktop does not inherit a shell-managed Node or Python, so bare npx, uv or python3 can resolve differently than in your terminal.",
  },
];

export const metadata: Metadata = {
  title: "Database MCP Servers — Which One to Install | MyMCPTools",
  description:
    "Postgres, MongoDB, Redis, ClickHouse, Neon and Supabase MCP servers compared: what each one actually exposes, which read-only switch stops writes, and which server the name refers to when more than one claims it.",
  alternates: { canonical: "https://mymcptools.com/guides/databases" },
  openGraph: {
    title: "Database MCP servers, compared | MyMCPTools",
    description:
      "Six source-verified database MCP server guides in one place — tools, transports and the read-only switch for each.",
    type: "website",
    url: "https://mymcptools.com/guides/databases",
  },
};

export default function DatabaseGuidesPage() {
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
      name: "Database MCP servers",
      description:
        "Source-verified setup guides for the MCP servers that connect an AI client to a database.",
      url: "https://mymcptools.com/guides/databases",
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
          <span className="text-gray-400">Databases</span>
        </nav>

        <h1 className="text-3xl font-bold text-white sm:text-4xl">
          Database MCP servers, compared
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-gray-400">
          A database MCP server is the thing that decides what an AI client can do to
          your data: which tools exist, whether any of them writes, and what happens
          when the model guesses. Six of them have hand-written guides here, and the
          differences that matter are not the ones a feature table shows.
        </p>
        <p className="mt-4 leading-relaxed text-gray-500">
          Two patterns are worth knowing before you pick. First, the name is sometimes
          ambiguous: &ldquo;the Postgres MCP server&rdquo; and &ldquo;the Redis MCP
          server&rdquo; both most often refer to servers that have been archived and
          whose npm packages are marked deprecated, and installing either works fine
          right up until you want a second tool. Second, none of these ships read-only
          by default &mdash; and Redis does not ship one at all, which is why the rows
          below name the guard rather than tick a box. The rest have the switch; not
          one of them has it on, and the row says where in the configuration it lives.
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
                  <dt className="text-gray-500">How you stop it writing</dt>
                  <dd className="mt-1 leading-relaxed text-gray-400">{row.guard}</dd>
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
          <h2 className="text-xl font-semibold text-white">
            Choosing between them
          </h2>
          <p className="mt-3 leading-relaxed text-gray-400">
            Start with the engine, because the tools that make these servers worth
            installing are engine-specific: Postgres&rsquo; index tuning, Atlas&rsquo;
            performance advisor, ClickHouse&rsquo;s chDB, Redis&rsquo; vector index and
            Streams consumer groups. A generic
            &ldquo;SQL&rdquo; server would be a driver with extra steps.
          </p>
          <p className="mt-4 leading-relaxed text-gray-400">
            Then decide how much surface you are exposing, which is a separate
            decision from which database you use. Neon and Supabase reach past the
            data into project and branch management; MongoDB reaches into Atlas and
            can create billable clusters if you give it service account credentials.
            Those capabilities are the reason to install the server or the reason not
            to, depending on who is holding the client.
          </p>
          <p className="mt-4 leading-relaxed text-gray-400">
            Finally, set the read-only switch <em>and</em> connect as a user that
            cannot write. The switch is the server refusing to register the tool; the
            grant is the database refusing the statement. They fail independently,
            which is the point of having both.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-semibold text-white">
            Database MCP servers: common questions
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
          Looking for something other than a database?{" "}
          <Link href="/guides" className="text-blue-400 hover:text-blue-300">
            All setup guides
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
