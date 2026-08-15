import { Metadata } from "next";
import Link from "next/link";
import { getServerGuide } from "@/data/server-guides";
import { getServerBySlug } from "@/data/servers";

/**
 * Landing page for "workspace MCP server" / "productivity MCP server" — the
 * docs, tickets and team-tools cluster.
 *
 * Fourth cluster page. The work bucket has been the largest bucket on /guides
 * without one for three fires running; at ten guides it is now the largest by
 * some distance, and ten cards under a heading answers "here are some guides"
 * rather than the question the head term asks.
 *
 * The axis has to be new again. Databases compare on the read-only switch,
 * DevOps on blast radius, code on what the server attaches to. None of those
 * separate these ten, because they are all remote services reached over OAuth
 * and none of them touches your machine.
 *
 * What they share instead is a failure mode. Every one of these connects
 * successfully and then returns nothing, and in every case the reason is that
 * the auth step is not the access step — a Notion token grants no pages, an
 * Atlassian consent grants no products, a Slack bot token cannot search, an
 * Asana authorisation grants everything and bounds nothing. So the two rows on
 * each card are what the auth step actually grants and why it comes back empty.
 *
 * Copy is written by hand from the per-server guides, which were read out of
 * each project's own docs. Only name, verification date and guide existence
 * come from data.
 */

/** Grouped loosely: knowledge bases, then trackers, then the rest. */
const CLUSTER: {
  slug: string;
  /** Why someone lands on this term and needs this row. */
  pitch: string;
  /** What authorising actually hands over — usually less, occasionally far more. */
  grants: string;
  /** The specific reason it connects and then returns nothing. */
  empty: string;
}[] = [
  {
    slug: "notion",
    pitch:
      "Two servers, both from Notion, and the older one is the one in most write-ups. Its own README now says Notion may sunset the repository.",
    grants:
      "With the hosted server at mcp.notion.com/mcp, whatever your Notion account can see, via OAuth from inside the client. With the local npm server, an integration token — which authenticates and grants nothing at all.",
    empty:
      "Because a fresh integration has been shared no content. The token is valid, the tools load, and search returns nothing until you add pages and databases on the integration's Access tab or connect them per page. Access is inherited, so sharing one parent usually covers a tree.",
  },
  {
    slug: "confluence",
    pitch:
      "There is no Confluence MCP server. Confluence is a surface on the same Atlassian Rovo server as Jira, so if you connected for Jira you already have it.",
    grants:
      "One OAuth consent covering every Atlassian product your account reaches. Read, write and search are separate permission groups an admin grants independently — which is how Jira can work perfectly while Confluence stays silent.",
    empty:
      "Usually because the model wrote bad CQL. searchConfluenceUsingCql takes CQL, not JQL and not English, and a wrong query looks exactly like an empty space. Ask it to print the query it ran; for vague questions the natural-language searchAtlassian tool is the better instrument.",
  },
  {
    slug: "obsidian",
    pitch:
      "The one server in this cluster that is not a remote service — and the one whose failures are the most consistent, because it needs an app running.",
    grants:
      "Access to the Obsidian Local REST API community plugin on 127.0.0.1:27124, and through it the whole vault, read and write. The tool list is fixed and includes append_content, patch_content and delete_file.",
    empty:
      "It does not come back empty, it comes back as a connection error, and the cause is almost always that Obsidian is closed or the plugin is off. There is no read-only mode: bound it at the plugin or vault level, or point it at a copy.",
  },
  {
    slug: "linear",
    pitch:
      "First-party, hosted, no repository and no package — and the cluster's best answer on scoping, which is why it is worth comparing the others against.",
    grants:
      "Exactly what you ask for. https://mcp.linear.app/mcp/readonly exposes read tools only, and requesting just the read OAuth scope against the standard endpoint produces a token that cannot reach write APIs either.",
    empty:
      "Rarely. The failure here is upstream: any install command claiming to be the Linear MCP package is not Linear's, because there is no package. Okta shops need enterprise-managed authentication configured against the identity provider first.",
  },
  {
    slug: "jira",
    pitch:
      "One hosted Atlassian server carrying Jira, Confluence, Jira Service Management, Bitbucket and Compass — and two endpoints, of which most copied config uses the older one.",
    grants:
      "What the first 3LO consent on your site approved, per product. Whoever consents first must have access to everything the MCP scopes ask for, which is why individual users hit \"your site admin must authorize this app\".",
    empty:
      "Expired tokens and missing scopes are the documented cause of partial results; total silence more often means the tools were never enabled for the session. Everything is filtered by your existing project permissions, so a smaller result set can be simply correct.",
  },
  {
    slug: "asana",
    pitch:
      "Official, hosted, and the outlier in this cluster: Asana states plainly that MCP apps do not use permission scopes at all.",
    grants:
      "Everything. Authorising requests the full tool set, deletes included, bounded only by what your own account can already see. There is no read-only endpoint and no scope to withhold — the community server's READ_ONLY_MODE is the only real switch.",
    empty:
      "Because search_tasks is Premium-only. On a non-Premium workspace it is unavailable and get_tasks is the documented substitute, so a free-text question looks like it found nothing when it actually hit a plan limit.",
  },
  {
    slug: "slack",
    pitch:
      "Built to run in a workspace where you cannot install a Slack app — which is both the reason to use it and the reason to think first.",
    grants:
      "Whatever the token class carries. Browser-session tokens (xoxc plus xoxd) reuse your full user session with no admin approval and no bot in the member list; a scoped xoxp user token or an xoxb bot token trades capability for restraint.",
    empty:
      "Search on a bot token returns nothing because Slack's search.messages API is closed to xoxb entirely. Posting is off unless SLACK_MCP_ADD_MESSAGE_TOOL is set, and channels resolve by name only once SLACK_MCP_CHANNELS_CACHE exists.",
  },
  {
    slug: "gmail",
    pitch:
      "Google publishes no Gmail MCP server. The community one to install covers twelve Workspace services; the one most guides name was archived in August 2025.",
    grants:
      "Whatever scopes your own Google Cloud OAuth client asks for — you bring the credentials, so you set the ceiling. --read-only, per-service --permissions and --disabled-tools narrow it further, and send_gmail_message is in the core tier by default.",
    empty:
      "More often it never connects: Error 400 redirect_uri_mismatch, which means a Desktop-type OAuth client where a Web Application one is required. Loading everything is the other trap — --tools gmail is the difference between a few tool schemas and 120+ per request.",
  },
  {
    slug: "hubspot",
    pitch:
      "Three different things are called the HubSpot MCP server, and the one nearly every write-up documents is the npm beta from May 2025.",
    grants:
      "The scopes on a user-level OAuth app at https://mcp.hubspot.com — and read scopes are what HubSpot's own setup guidance suggests by default. Custom Sensitive Data Properties and PHI are excluded no matter what you grant.",
    empty:
      "Or it reads but cannot write, which is the same cause: nothing in the client config grants write access, only the app's scopes do. A 404 rather than an auth challenge means the URL has a path on it — the host is the whole endpoint.",
  },
  {
    slug: "n8n",
    pitch:
      "Not a workflow execution engine, and expecting one is the biggest source of disappointment with it. A community project, not n8n's own.",
    grants:
      "Nothing on your instance until you supply N8N_API_URL and N8N_API_KEY. Without them it is a documentation, template and validation layer over 2,412 nodes; with them it gains 16 management tools that create and deploy real workflows.",
    empty:
      "Or it fails to reach a local instance, which is the SSRF gate: strict mode rejects loopback, so localhost needs WEBHOOK_SECURITY_MODE=moderate. JSON parse errors in Claude Desktop are a different fault — MCP_MODE is not set to stdio.",
  },
];

/** Rendered as visible copy and as FAQPage schema — same text, one source. */
const FAQS: { question: string; answer: string }[] = [
  {
    question: "What is a workspace MCP server?",
    answer:
      "A server that connects an AI client to the tools a team runs its work in — a knowledge base, an issue tracker, a CRM, a chat workspace, an inbox — through the Model Context Protocol. Most of them are hosted remote servers now rather than local processes, so setup is an OAuth flow rather than an install, and almost all the difficulty is in what that flow does and does not grant.",
  },
  {
    question: "Why does my MCP server connect but return nothing?",
    answer:
      "Because authorising is not the same as granting access, and every server in this cluster splits those two steps differently. A Notion integration token authenticates and reaches no pages until you share them. An Atlassian consent covers only the products the first consenting admin could see. A Slack bot token cannot call the search API at all. An Asana workspace without Premium has no search_tasks. A HubSpot app created with read scopes will never write. The connection succeeding tells you almost nothing about what the agent can see.",
  },
  {
    question: "Which workspace MCP servers have a read-only mode?",
    answer:
      "Linear is the clearest: a dedicated /mcp/readonly endpoint and a read-only OAuth scope. Gmail through Workspace MCP has a --read-only flag plus per-service permissions. HubSpot achieves it by creating the app with read scopes only. Asana's official server has none — you would use the community server's READ_ONLY_MODE=true instead. The Obsidian server has none either, and its tool list includes delete_file, so bound it outside the server.",
  },
  {
    question: "Do I need a separate MCP server for Jira and Confluence?",
    answer:
      "No. Both are product surfaces on the same hosted Atlassian Rovo MCP Server, so one connection and one consent covers them. The same consolidation applies to Google: one Workspace MCP connection covers Gmail, Drive, Calendar, Docs, Sheets, Slides, Forms, Tasks, Contacts and Chat, and installing separate servers per Google product means a second OAuth client and a second set of tool schemas on every request.",
  },
  {
    question: "Which workspace MCP server should I connect first?",
    answer:
      "The one holding the context you keep pasting in by hand. If you retype ticket descriptions, that is the tracker. If you paste the same spec into every session, that is the knowledge base. Connect one, use it for a week, and check what the auth step actually granted before adding a second — each connected server puts its tool schemas in front of the model on every request, which is why Workspace MCP ships tool tiers and n8n-MCP documents its per-call token cost.",
  },
];

export const metadata: Metadata = {
  title: "Workspace MCP Servers — What the Auth Step Actually Grants | MyMCPTools",
  description:
    "Notion, Confluence, Obsidian, Linear, Jira, Asana, Slack, Gmail, HubSpot and n8n MCP servers compared: what authorising really grants, and the specific reason each one connects and then returns nothing.",
  alternates: { canonical: "https://mymcptools.com/guides/workspace" },
  openGraph: {
    title: "Docs, tickets and team-tool MCP servers, compared | MyMCPTools",
    description:
      "Ten source-verified MCP server guides in one place — what each auth flow grants, and why the tools come back empty.",
    type: "website",
    url: "https://mymcptools.com/guides/workspace",
  },
};

export default function WorkspaceGuidesPage() {
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
      name: "Workspace, docs and ticketing MCP servers",
      description:
        "Source-verified setup guides for the MCP servers that connect an AI client to a knowledge base, an issue tracker, a CRM, a chat workspace or an inbox.",
      url: "https://mymcptools.com/guides/workspace",
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
          <span className="text-gray-400">Workspace and team tools</span>
        </nav>

        <h1 className="text-3xl font-bold text-white sm:text-4xl">
          Workspace MCP servers, compared
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-gray-400">
          These ten connect to the tools a team actually works in — a knowledge
          base, an issue tracker, a CRM, a chat workspace, an inbox. Almost all
          of them are hosted remote servers, so there is nothing to install and
          nothing on your machine to misconfigure. Setup is an OAuth flow that
          takes about a minute, and then a much longer stretch of wondering why
          the assistant cannot see anything.
        </p>
        <p className="mt-4 leading-relaxed text-gray-500">
          That is the pattern worth naming: the auth step is not the access
          step, and every one of these splits them differently. A Notion
          integration token authenticates perfectly and reaches zero pages until
          you share them. An Atlassian consent covers only the products the
          first consenting admin could see. A Slack bot token cannot call the
          search API at all. Asana grants the entire tool set, deletes included,
          and calls that the design. So each card below answers two questions —
          what authorising actually grants, and the specific reason it comes
          back empty — because between them they cover almost every failed first
          session.
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
                  <dt className="text-gray-500">What the auth step grants</dt>
                  <dd className="mt-1 leading-relaxed text-gray-400">
                    {row.grants}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Why it comes back empty</dt>
                  <dd className="mt-1 leading-relaxed text-gray-400">
                    {row.empty}
                  </dd>
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
            Mostly you do not, because these stack rather than compete — a
            tracker and a knowledge base answer different questions. The two
            real either-ors are inside vendors, not between them. Notion has two
            servers of its own and the hosted one is the answer, since Notion
            says it is only actively supporting that one and may sunset the
            local repository. Asana has an official hosted server and a
            community local one, and the community one is the answer whenever
            you want a read-only guarantee. Google has neither problem and the
            opposite one: no first-party server at all, a de facto community
            standard, and an archived npm package that still installs and still
            gets recommended.
          </p>
          <p className="mt-4 leading-relaxed text-gray-400">
            Where you do have to choose is how much you connect at once. Jira,
            Confluence, Bitbucket and Compass are one Atlassian connection.
            Gmail, Drive, Calendar, Docs, Sheets and six more are one Google
            connection. Adding a second server per product means a second
            consent flow and a second pile of tool schemas in front of the model
            on every single request — which is the cost Workspace MCP&rsquo;s
            tool tiers exist to manage, and the one n8n-MCP quantifies when it
            warns that a full node fetch runs 3,000 to 8,000 tokens.
          </p>
          <p className="mt-4 leading-relaxed text-gray-400">
            Then read the scoping row before you connect anything unattended.
            Linear is the high-water mark: a documented read-only endpoint and a
            read-only OAuth scope, so the token itself cannot write. Gmail
            through Workspace MCP has a flag. HubSpot achieves it by creating
            the app with read scopes only. Asana&rsquo;s official server has
            nothing of the kind and states so directly, and the Obsidian
            server&rsquo;s fixed tool list includes <code>delete_file</code>.
            Those last two are the ones to bound outside the server rather than
            inside it.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-semibold text-white">
            Workspace MCP servers: common questions
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
          Connecting something else?{" "}
          <Link
            href="/guides/databases"
            className="text-blue-400 hover:text-blue-300"
          >
            Database MCP servers, compared
          </Link>
          {" · "}
          <Link href="/guides/devops" className="text-blue-400 hover:text-blue-300">
            DevOps MCP servers, compared
          </Link>
          {" · "}
          <Link href="/guides/code" className="text-blue-400 hover:text-blue-300">
            Code and browser MCP servers, compared
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
