import { Metadata } from "next";
import Link from "next/link";
import { getServerGuide } from "@/data/server-guides";
import { getServerBySlug } from "@/data/servers";

/**
 * Landing page for "browser MCP server" / "coding MCP server".
 *
 * Third cluster page, same reason as the first two: seven hand-written guides now
 * sit in the code bucket, and seven cards inside /guides answers "here are some
 * guides" rather than the question the head term asks.
 *
 * The comparison axis has to be different again, or this is a copy of the other
 * two with different rows. For a database the differentiator is the read-only
 * switch; for infrastructure it is blast radius. Neither fits here, because
 * these servers do not share a resource — a browser, a repo API, a design file
 * and a documentation index have nothing in common as *things*.
 *
 * What they do share is an attachment question. Every one of them either drives
 * a process already running on your machine, or reaches a remote service as
 * you, or touches nothing of yours at all — and that single fact predicts the
 * failure modes better than the tool count does. So the two rows on each card
 * are what it attaches to and what it inherits by attaching.
 *
 * Copy is written by hand from the per-server guides, which were read out of
 * each project's own docs. Only name, verification date and guide existence
 * come from data.
 */

/** Local-process servers first, then remote-service, then the one that attaches to nothing. */
const CLUSTER: {
  slug: string;
  /** Why someone lands on this term and needs this row. */
  pitch: string;
  /** What it connects to — the thing on the other end of the socket. */
  attaches: string;
  /** What the connection inherits by attaching. The real differentiator. */
  inherits: string;
}[] = [
  {
    slug: "chrome-devtools",
    pitch:
      "Filed under browser automation everywhere, and automation is the least of it. Traces, Lighthouse, heap snapshots and source-mapped console output are the part nothing else on this list has.",
    attaches:
      "Its own Chrome by default, launched against a dedicated profile under $HOME/.cache/chrome-devtools-mcp. Optionally your running browser instead, via --autoConnect (Chrome 144+) or --browserUrl against an open debugging port.",
    inherits:
      "Nothing, until you attach it to your own browser — and then every open window in that profile, signed in as you. Opening the remote debugging port is the bigger step: it is unauthenticated, so any process on the machine can drive that browser while it is open.",
  },
  {
    slug: "microsoft-playwright-mcp",
    pitch:
      "The lean choice for driving a page. It works off the accessibility tree rather than screenshots, so no vision model and deterministic structured output.",
    attaches:
      "A Playwright-managed browser it starts itself — headed by default, --headless or PLAYWRIGHT_MCP_HEADLESS to change that. Every CLI flag has a matching PLAYWRIGHT_MCP_* variable, which is the cleaner way to configure it in a container.",
    inherits:
      "Deliberately little. File access is fenced to workspace roots and file:// navigation is blocked, until --allow-unrestricted-file-access removes both. Microsoft's own caveat is worth reading first: for a coding agent, the Playwright CLI with skills may beat MCP, because it keeps large tool schemas and accessibility trees out of the context window.",
  },
  {
    slug: "playwright",
    pitch:
      "The other server called Playwright MCP. It records a session into a runnable test file and emulates 143 named devices — and it has not been pushed since December 2025, which nothing at install time tells you.",
    attaches:
      "A Chromium, Firefox or WebKit browser it launches itself, downloading the binaries on first use. Headed by default: headless is false unless you set it. There is also a standalone HTTP mode on port 8931 for display-less machines, which needs \"type\": \"http\" in the client config or it fails with a 400.",
    inherits:
      "A visible local browser plus playwright_evaluate for arbitrary JavaScript — and, unusually, playwright_get/post/put/patch/delete, which fire HTTP requests with no browser involved. The HTTP server binds to localhost only by design; remote access is an SSH tunnel.",
  },
  {
    slug: "blender-mcp",
    pitch:
      "The clearest example in this cluster of a server that is useless without something already running — and the reason most \"it connects but nothing happens\" reports exist.",
    attaches:
      "A socket on port 9876 opened by an addon running inside Blender. Blender has to be open, the addon enabled, and \"Connect to Claude\" pressed in the sidebar before any tool call can do anything.",
    inherits:
      "Your live scene, and through execute_blender_code, arbitrary Python inside Blender. That is as powerful and as dangerous as it sounds — the project says to use it with caution outside experiments and to save your work first.",
  },
  {
    slug: "github",
    pitch:
      "The npm package everybody pastes does not exist. @github/mcp-server returns 404 on the registry, so most circulating instructions fail on the first run.",
    attaches:
      "A hosted remote server at api.githubcopilot.com with nothing to install, or a Docker image, or a Go binary you build. Take the remote one unless you are on GitHub Enterprise Server, which it does not cover.",
    inherits:
      "Exactly what your token or OAuth grant carries — this is the one server here where the read-only guard is a real, documented switch. Connect to /mcp/readonly on the remote server, pass --read-only to the binary, or set GITHUB_READ_ONLY=1 on Docker.",
  },
  {
    slug: "figma",
    pitch:
      "Most listings still hand you the desktop setup, and Figma's own docs no longer lead with it. About a third of the tools exist only on the remote server.",
    attaches:
      "The remote server at mcp.figma.com/mcp, which is now the recommended one, or the desktop server running inside the Figma app. The desktop server's one advantage is that it reads what you have selected in the running app.",
    inherits:
      "Your Figma seat, and with it a hard quota rather than a permission boundary. Starter View and Collab seats get six tool calls a month; Professional Dev and Full seats get 200 a day at 10 a minute, Organization 600 a day. Per-minute limits stall bursts even when the daily budget is intact.",
  },
  {
    slug: "context7",
    pitch:
      "The only server here that touches nothing of yours — and the one whose most-copied setup names a tool removed in December 2025.",
    attaches:
      "A hosted documentation index at mcp.context7.com/mcp. Or nothing at all: npx ctx7 setup can install it as a skill that shells out to ctx7 library and ctx7 docs, with no MCP server in the loop.",
    inherits:
      "No access to your code, your account or your machine — it is a read path into someone else's documentation. What it costs instead is context: the CLI-plus-skill mode exists precisely so tool schemas are not loaded into every request.",
  },
];

/** Rendered as visible copy and as FAQPage schema — same text, one source. */
const FAQS: { question: string; answer: string }[] = [
  {
    question: "What is a browser MCP server?",
    answer:
      "A server that gives an AI client control of a real browser through the Model Context Protocol — navigating, clicking, filling forms, reading the console and network, taking screenshots or snapshots of the page. Four are worth knowing and two of them share a name: Microsoft's Playwright MCP is the lean cross-browser default, ExecuteAutomation's Playwright MCP adds test-code generation and named device presets, Chrome DevTools MCP adds performance traces and heap analysis, and the Puppeteer server is archived and superseded by all of them.",
  },
  {
    question: "Chrome DevTools MCP or Playwright MCP — which should I use?",
    answer:
      "Playwright — Microsoft's — if you want a page driven cheaply and cross-browser: it reads the accessibility tree, has a smaller tool surface, and fences file access to your workspace by default. Chrome DevTools MCP if you want the panels — performance traces with the insights the Performance panel computes, Lighthouse audits, source-mapped console messages, and twelve heap-snapshot tools for confirming a memory leak rather than guessing at one. They are not really competitors; one automates a browser and the other instruments one.",
  },
  {
    question: "Can an MCP server use the browser I am already signed in to?",
    answer:
      "Chrome DevTools MCP can, two ways: --autoConnect on Chrome 144+ after enabling remote debugging at chrome://inspect/#remote-debugging, or --browserUrl against a Chrome you started with --remote-debugging-port. Both are how you test signed-in flows, and both hand the agent every open window in that profile. Chrome refuses to open the debugging port against your default profile directory for exactly this reason, so the documented commands all pass --user-data-dir.",
  },
  {
    question: "Which coding MCP server should I install first?",
    answer:
      "The one that removes the thing you keep doing by hand. If the model writes config for library versions you are not running, that is Context7. If you are copying issue and PR text between a browser and an editor, that is the GitHub server. If you are describing a design instead of pointing at it, that is Figma. These stack rather than compete — the browser servers are the ones where you genuinely pick a single winner.",
  },
  {
    question: "How much access does a coding MCP server have to my machine?",
    answer:
      "It varies more here than in any other cluster, so it is worth checking per server rather than assuming. Context7 touches nothing local. Playwright MCP restricts file access to workspace roots and blocks file:// navigation unless you disable that. The GitHub server has a documented read-only mode on all three of its distributions. Chrome DevTools MCP starts isolated but can be pointed at your live browser. BlenderMCP runs arbitrary Python inside your open Blender session. Read the row before you connect the server.",
  },
];

export const metadata: Metadata = {
  title: "Browser and Coding MCP Servers — What Each One Attaches To | MyMCPTools",
  description:
    "Chrome DevTools, both Playwright servers, GitHub, Figma, Blender and Context7 MCP servers compared: what each connects to, what the connection inherits, and which of the several servers sharing a name you actually want.",
  alternates: { canonical: "https://mymcptools.com/guides/code" },
  openGraph: {
    title: "Code, design and browser MCP servers, compared | MyMCPTools",
    description:
      "Seven source-verified MCP server guides in one place — what each server attaches to, and what it inherits by attaching.",
    type: "website",
    url: "https://mymcptools.com/guides/code",
  },
};

export default function CodeGuidesPage() {
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
      name: "Code, design and browser MCP servers",
      description:
        "Source-verified setup guides for the MCP servers that drive a browser, read a repository or design file, or feed documentation to a coding agent.",
      url: "https://mymcptools.com/guides/code",
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
          <span className="text-gray-400">Code and browsers</span>
        </nav>

        <h1 className="text-3xl font-bold text-white sm:text-4xl">
          Code, design and browser MCP servers, compared
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-gray-400">
          A browser, a repository, a design file and a documentation index have
          nothing in common as things, which is why comparing these seven on tool
          count tells you nothing useful. What they do have in common is an
          attachment question. Each one either drives a process already running on
          your machine, or reaches a remote service as you, or touches nothing of
          yours at all — and that single fact predicts how it fails better than
          anything in its feature list.
        </p>
        <p className="mt-4 leading-relaxed text-gray-500">
          It is also where the surprises are. Chrome DevTools MCP starts a browser
          that is signed in to nothing, and the two flags that make it useful for
          testing a logged-in flow are the two that hand an agent your live
          session. BlenderMCP does nothing at all until you press a button inside
          Blender. Figma&rsquo;s limit is a monthly quota on your seat, not a
          permission. And Context7, which touches none of your systems, is the one
          most likely to be misconfigured — because the tool name in every
          circulating snippet was removed from the product in December 2025.
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
                  <dt className="text-gray-500">What it attaches to</dt>
                  <dd className="mt-1 leading-relaxed text-gray-400">
                    {row.attaches}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">What it inherits by attaching</dt>
                  <dd className="mt-1 leading-relaxed text-gray-400">
                    {row.inherits}
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
            The only real either-or in this cluster is the browser one, and it is a
            three-way. Microsoft&rsquo;s Playwright server is the default: leanest,
            actively developed, fenced to your workspace. Chrome DevTools MCP is the
            only one that gets a performance trace, a Lighthouse audit or a heap
            snapshot out of an agent loop. ExecuteAutomation&rsquo;s Playwright
            server is the one to pick deliberately, for recording a session into a
            runnable test file or emulating a named device — and knowing that it has
            not been touched since December 2025. Running none of them is also fine:
            Microsoft says out loud that a coding agent may be better served by the
            Playwright CLI with skills than by MCP at all.
          </p>
          <p className="mt-4 leading-relaxed text-gray-400">
            Everything else here stacks. The GitHub server, the Figma server and
            Context7 answer different questions and none of them replaces another;
            the reason to be deliberate is context budget rather than conflict.
            Each connected server puts its tool schemas in front of the model on
            every request, which is exactly the cost Context7&rsquo;s
            CLI-plus-skill mode was built to avoid, and the same reasoning behind
            Chrome DevTools MCP&rsquo;s <code>--slim</code> mode and its
            off-by-default tool categories.
          </p>
          <p className="mt-4 leading-relaxed text-gray-400">
            Then check what the connection inherits, because it is not uniform
            here the way it is with a database or a deploy platform. GitHub is the
            only one with a documented read-only path, and it has three, one per
            distribution. Three attach to a live local process — two of them a
            browser, one your open Blender — and can do whatever you can do inside
            it. One is fenced to your workspace by default and has a flag that
            unfences it. Reading that row first is a shorter job
            than recovering from having skipped it.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-semibold text-white">
            Browser and coding MCP servers: common questions
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
          <Link href="/guides/devops" className="text-blue-400 hover:text-blue-300">
            DevOps MCP servers, compared
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
