import type { Metadata } from "next";
import Link from "next/link";
import { servers, registryLabel } from "@/data/servers";
import type { MCPServer } from "@/data/servers";

export const metadata: Metadata = {
  title: 'What Does "MCP Server" Mean? Definition, Meaning & Examples | MyMCPTools',
  description:
    'MCP server means a program that exposes tools, data and prompts to an AI assistant over the Model Context Protocol. Plain-English definition of what MCP stands for, why "server" is a misleading word, and what one actually does.',
  keywords:
    "mcp server means, what does mcp server mean, mcp server meaning, what is an mcp server, mcp meaning, model context protocol meaning, mcp stands for",
  openGraph: {
    title: 'What Does "MCP Server" Mean?',
    description:
      'MCP stands for Model Context Protocol. An MCP server is a small program that hands an AI assistant a set of callable tools. Here is what the term actually means — and why "server" confuses everyone.',
    type: "article",
    url: "https://mymcptools.com/what-is-an-mcp-server",
    siteName: "MyMCPTools",
  },
  twitter: {
    card: "summary_large_image",
    title: 'What Does "MCP Server" Mean?',
    description:
      'MCP = Model Context Protocol. An MCP server exposes tools to an AI client. Plain-English definition, with the "server" naming trap explained.',
  },
  alternates: { canonical: "https://mymcptools.com/what-is-an-mcp-server" },
};

/**
 * Head-term explainer for "mcp server means" / "what does mcp server mean"
 * (3,600 SV / SD 19 — the highest-volume, lowest-difficulty term this project
 * has mined). No per-server page can win an informational definition query, so
 * this is a dedicated definition page rather than another catalog surface.
 * It answers the question in the first paragraph, then earns the position with
 * the parts other definitions skip: the stdio-not-HTTP naming trap, the
 * host/client/server split, and install-shape counts taken from the live
 * catalog rather than asserted.
 */

const faqItems = [
  {
    question: 'What does "MCP server" mean?',
    answer:
      'MCP server means a program that exposes a set of capabilities — tools it can run, data it can read, and prompt templates it can offer — to an AI assistant over the Model Context Protocol. MCP stands for Model Context Protocol, an open standard published by Anthropic in November 2024. The "server" half of the name means it answers requests, not that it runs on the internet: the large majority of MCP servers run as a local subprocess on your own machine and talk over standard input and output.',
  },
  {
    question: "What does MCP stand for?",
    answer:
      'MCP stands for Model Context Protocol. "Model" is the language model, "context" is the outside information and actions the model needs in order to be useful, and "protocol" is the agreed message format that lets any client talk to any server. The point of the standard is that a server written once works in Claude Desktop, Claude Code, Cursor, VS Code and every other MCP-compatible client without being rewritten for each.',
  },
  {
    question: "Is an MCP server a website or a web server?",
    answer:
      "Usually not. This is the single most common misunderstanding of the term. Most MCP servers are command-line programs that your AI client launches itself, in the background, and communicates with over stdio — standard input and output — on your own computer. Nothing is hosted, nothing listens on a port, and no traffic leaves your machine except the API calls the server itself makes. A minority of servers are remote and are reached over HTTP at a URL; those behave more like what people normally mean by a server.",
  },
  {
    question: "What is the difference between an MCP client, host and server?",
    answer:
      "The host is the application you actually use — Claude Desktop, Cursor, VS Code. Inside it, an MCP client maintains one connection per server and handles the protocol handshake. The MCP server is the separate program on the other end of that connection, exposing the tools. One host can run many clients, and each client talks to exactly one server. When someone says they installed an MCP server, they mean they added an entry to their host's config file telling it to start one more of those programs.",
  },
  {
    question: "What does an MCP server actually give the AI?",
    answer:
      "Three things, in protocol terms. Tools are functions the model can decide to call, each with a name, a description and a JSON schema for its arguments — read_file, run_query, create_issue. Resources are readable pieces of context the client can attach, like a file or a database table. Prompts are reusable templates the server ships so a user can invoke a known-good workflow. In practice most servers ship tools and little else, which is why the words tool and MCP server are often used interchangeably.",
  },
  {
    question: 'Does "MCP" always mean Model Context Protocol?',
    answer:
      'No, and this trips up searches. In Minecraft, MCP was the Mod Coder Pack. In Tron, the MCP was the Master Control Program. In semiconductors, MCP means multi-chip package; in healthcare, managed care plan. If the sentence you read it in involves Claude, Cursor, an AI agent or a tool call, it means Model Context Protocol. This page only covers that sense.',
  },
  {
    question: "Do I need an MCP server?",
    answer:
      "Only if you want the assistant to touch something it cannot reach on its own. If you are asking a model to write or explain text, you need nothing. If you want it to read your actual Postgres schema, open your real Linear tickets, or edit files in a specific folder, that access has to come from somewhere — and an MCP server is the standard way to hand it over. Add one server, for the one system you keep pasting screenshots of, and stop there.",
  },
  {
    question: "How do you install an MCP server?",
    answer:
      "For a local server you add a small JSON block to your client's config naming the command to run — commonly npx for Node packages or uvx for Python ones — restart the client, and the tools appear. For a remote server you paste a URL and complete an OAuth sign-in. Both usually take under two minutes. Every server page on MyMCPTools shows the exact command and whether that package was confirmed to exist in its registry on a stated date.",
  },
];

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export default function WhatIsAnMCPServerPage() {
  const total = servers.length;

  const byInstallType = servers.reduce<Record<string, number>>((acc, s) => {
    acc[s.install_type] = (acc[s.install_type] ?? 0) + 1;
    return acc;
  }, {});
  const localCount =
    (byInstallType.npm ?? 0) +
    (byInstallType.pip ?? 0) +
    (byInstallType.source ?? 0) +
    (byInstallType.binary ?? 0) +
    (byInstallType.docker ?? 0);
  const remoteCount = byInstallType.remote ?? 0;
  const localPct = Math.round((localCount / total) * 100);

  const installShapes = (["npm", "pip", "binary", "source", "docker", "remote"] as const)
    .map((t) => ({
      type: t as MCPServer["install_type"],
      label: registryLabel(t as MCPServer["install_type"]),
      count: byInstallType[t] ?? 0,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);

  const installShapeCopy: Record<string, string> = {
    npm: "Node packages the client runs with npx. The most common shape by a wide margin.",
    pip: "Python packages, normally launched with uvx so nothing is installed permanently.",
    binary: "A compiled executable you download once and point the config at.",
    source: "No published package — you clone the repo and run it yourself.",
    docker: "Runs in a container, which is the usual answer when a server needs system access.",
    remote: "Not on your machine at all. You paste a URL and sign in; the vendor runs it.",
  };

  const definitionJsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: "Model Context Protocol terminology",
    url: "https://mymcptools.com/what-is-an-mcp-server",
    hasDefinedTerm: [
      {
        "@type": "DefinedTerm",
        name: "MCP server",
        description:
          "A program that exposes tools, resources and prompts to an AI assistant over the Model Context Protocol. Most MCP servers run as a local subprocess communicating over stdio rather than as a hosted web service.",
        inDefinedTermSet: "https://mymcptools.com/what-is-an-mcp-server",
        url: "https://mymcptools.com/what-is-an-mcp-server",
      },
      {
        "@type": "DefinedTerm",
        name: "MCP",
        description:
          "Abbreviation of Model Context Protocol, an open standard published by Anthropic in November 2024 that defines how AI assistants connect to external tools and data sources.",
        inDefinedTermSet: "https://mymcptools.com/what-is-an-mcp-server",
      },
      {
        "@type": "DefinedTerm",
        name: "MCP client",
        description:
          "The component inside an AI application that maintains a single connection to one MCP server and performs the protocol handshake.",
        inDefinedTermSet: "https://mymcptools.com/what-is-an-mcp-server",
      },
      {
        "@type": "DefinedTerm",
        name: "MCP host",
        description:
          "The AI application a person actually uses — Claude Desktop, Claude Code, Cursor or VS Code — which runs one MCP client per configured server.",
        inDefinedTermSet: "https://mymcptools.com/what-is-an-mcp-server",
      },
    ],
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://mymcptools.com" },
      {
        "@type": "ListItem",
        position: 2,
        name: "What Does MCP Server Mean?",
        item: "https://mymcptools.com/what-is-an-mcp-server",
      },
    ],
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(definitionJsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <nav className="mb-6 text-sm text-gray-500">
          <ol className="flex items-center space-x-2">
            <li>
              <Link href="/" className="hover:text-gray-300 transition">
                Home
              </Link>
            </li>
            <li>/</li>
            <li className="text-gray-300">What Does MCP Server Mean?</li>
          </ol>
        </nav>

        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-6">
          What Does &ldquo;MCP Server&rdquo; Mean?
        </h1>

        {/* Answer-first definition block */}
        <div className="mb-10 rounded-xl border border-blue-500/30 bg-blue-500/5 p-6">
          <div className="text-xs uppercase tracking-wide text-blue-300 mb-2 font-medium">Definition</div>
          <p className="text-lg text-gray-200 leading-relaxed">
            <strong className="text-white">MCP server</strong> means a program that exposes a set of capabilities
            — tools it can run, data it can read, prompt templates it can offer — to an AI assistant over the{" "}
            <strong className="text-white">Model Context Protocol</strong>, which is what the letters MCP stand
            for. It is the piece that lets Claude, Cursor or VS Code do something to a real system instead of only
            talking about it.
          </p>
          <p className="text-gray-400 mt-4 leading-relaxed">
            The word <em>server</em> is the part that misleads people. It does not mean a website, a hosted
            service or a machine you rent. {localPct}% of the {total.toLocaleString()} servers indexed here run as
            an ordinary program on your own laptop, started by your AI client in the background and spoken to over
            standard input and output. Nothing is deployed and nothing listens on a port.
          </p>
        </div>

        {/* Word by word */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">The name, one word at a time</h2>
          <div className="space-y-4">
            {[
              {
                word: "Model",
                body: "The language model — Claude, GPT, Gemini, whichever one your application is built on. The protocol is deliberately model-agnostic; nothing in it names a specific vendor's model.",
              },
              {
                word: "Context",
                body: "Everything the model needs but does not have: your files, your database rows, your ticket queue, your company's API. Handing the model context is the entire job. A model with no context can only reason about what is in the message you typed.",
              },
              {
                word: "Protocol",
                body: "An agreed message format, built on JSON-RPC 2.0. Because the format is fixed, a server written once works in every compatible client. That is the reason MCP spread — before it, every AI app needed its own bespoke plugin format.",
              },
              {
                word: "Server",
                body: "The role in the conversation, not the deployment. In client/server terms the server is whichever side answers requests. Here that is a small program which, when asked, replies with a list of tools and then runs them. It answers on a pipe on your own machine far more often than over a network.",
              },
            ].map((row) => (
              <div key={row.word} className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                <div className="text-white font-semibold mb-1">{row.word}</div>
                <p className="text-gray-400 text-sm leading-relaxed">{row.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Host / client / server */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-3">Host, client, server — who is who</h2>
          <p className="text-gray-400 mb-6 leading-relaxed">
            Three words get used loosely and mean three different things. Getting them straight makes every setup
            guide easier to read.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                role: "Host",
                who: "Claude Desktop, Claude Code, Cursor, VS Code",
                body: "The application a person opens. It owns the config file, the permission prompts and the conversation.",
              },
              {
                role: "Client",
                who: "Inside the host, one per server",
                body: "The connection manager. It performs the handshake, negotiates a protocol version and keeps exactly one server on the other end.",
              },
              {
                role: "Server",
                who: "A separate program you configure",
                body: "The thing this page is about. It declares what it can do and then does it when the model asks.",
              },
            ].map((c) => (
              <div key={c.role} className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                <div className="text-white font-semibold">{c.role}</div>
                <div className="text-blue-400 text-xs mt-1 mb-3">{c.who}</div>
                <p className="text-gray-400 text-sm leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
          <p className="text-gray-500 text-sm mt-4 leading-relaxed">
            So &ldquo;I installed an MCP server&rdquo; almost always means &ldquo;I added a few lines to my
            host&rsquo;s config file naming a command to run.&rdquo; No installation in the usual sense takes
            place at all — with <code className="text-blue-400 bg-gray-800 px-1 rounded text-xs">npx</code> and{" "}
            <code className="text-blue-400 bg-gray-800 px-1 rounded text-xs">uvx</code> the package is fetched on
            first launch and nothing is left behind.
          </p>
        </section>

        {/* What it exposes */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-3">What an MCP server hands over</h2>
          <p className="text-gray-400 mb-6 leading-relaxed">
            The protocol defines three kinds of thing a server can expose. Most servers ship only the first, which
            is why people use &ldquo;tool&rdquo; and &ldquo;MCP server&rdquo; as if they were synonyms.
          </p>
          <div className="space-y-4">
            {[
              {
                name: "Tools",
                body: "Functions the model may decide to call, each with a name, a plain-English description and a JSON schema for its arguments. The description is doing real work: it is what the model reads when choosing whether this is the right tool for what you asked.",
                example: "query · create_issue · read_file · send_email",
              },
              {
                name: "Resources",
                body: "Readable context the client can attach to a conversation — a file, a table, a document. Unlike a tool, a resource is not called; it is fetched and pasted in as context.",
                example: "file:///project/README.md · postgres://orders/schema",
              },
              {
                name: "Prompts",
                body: "Reusable templates the server ships so a user can trigger a known-good workflow by name rather than describing it from scratch each time. In VS Code these show up behind the slash command menu.",
                example: "/analyze-ticket · /document-model",
              },
            ].map((row) => (
              <div key={row.name} className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                <div className="text-white font-semibold mb-2">{row.name}</div>
                <p className="text-gray-400 text-sm leading-relaxed mb-3">{row.body}</p>
                <code className="text-blue-400 bg-gray-950 border border-gray-800 px-2 py-1 rounded text-xs">
                  {row.example}
                </code>
              </div>
            ))}
          </div>
        </section>

        {/* Local vs remote, grounded in catalog data */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-3">Local or remote — and how the split really looks</h2>
          <p className="text-gray-400 mb-6 leading-relaxed">
            If &ldquo;server&rdquo; still sounds like something hosted, the numbers settle it. Every entry in this
            catalog is recorded with the shape of its install, so the local/remote balance is countable rather
            than a matter of opinion.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 p-6 bg-gray-900 border border-gray-800 rounded-xl">
            <StatCard value={total.toLocaleString()} label="Servers indexed" />
            <StatCard value={localCount.toLocaleString()} label="Run on your machine" />
            <StatCard value={remoteCount.toLocaleString()} label="Remote / hosted" />
            <StatCard value={`${localPct}%`} label="Local, not hosted" />
          </div>
          <div className="space-y-3">
            {installShapes.map((row) => (
              <div
                key={row.type}
                className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 rounded-lg border border-gray-800 bg-gray-900 px-5 py-4"
              >
                <div className="sm:w-40 shrink-0">
                  <span className="text-white font-medium">{row.label}</span>
                  <span className="text-gray-600 text-xs ml-2">{row.count.toLocaleString()}</span>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">{installShapeCopy[row.type]}</p>
              </div>
            ))}
          </div>
          <p className="text-gray-500 text-sm mt-4 leading-relaxed">
            The transport follows from the shape. Local servers speak <strong className="text-gray-300">stdio</strong>{" "}
            — the client writes JSON-RPC to the process&rsquo;s standard input and reads replies from its standard
            output. Remote servers speak <strong className="text-gray-300">Streamable HTTP</strong>, which replaced
            the older HTTP+SSE transport in the March 2025 revision of the spec. If a setup guide tells you to
            configure an SSE endpoint, it is describing a deprecated path.
          </p>
        </section>

        {/* Worked example */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-3">What it looks like when it works</h2>
          <p className="text-gray-400 mb-4 leading-relaxed">
            Say you configure a Postgres MCP server. Nothing visible happens: the client starts the process,
            handshakes, and asks it what it can do. The server replies with a tool list —{" "}
            <code className="text-blue-400 bg-gray-800 px-1 rounded text-xs">query</code>,{" "}
            <code className="text-blue-400 bg-gray-800 px-1 rounded text-xs">list_schemas</code> — and their
            schemas.
          </p>
          <p className="text-gray-400 mb-4 leading-relaxed">
            Then you type <em>&ldquo;how many orders shipped late last month?&rdquo;</em>. The model reads the tool
            descriptions, decides <code className="text-blue-400 bg-gray-800 px-1 rounded text-xs">query</code> is
            the right one, writes the SQL itself, and asks the client to call it. Your host shows an approval
            prompt. The server runs the SQL against your database, returns rows, and the model answers using them.
          </p>
          <p className="text-gray-400 leading-relaxed">
            That is the whole mechanism. The model never gets your database password — the server holds the
            credentials, and the model only gets to ask the server to do things the server already knows how to do.
            That boundary is the reason the protocol is worth having, and the reason the tools a server exposes
            matter more than the fact it exists.
          </p>
        </section>

        {/* Disambiguation */}
        <section className="mb-12 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-xl font-bold text-white mb-3">Other things &ldquo;MCP&rdquo; means</h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-3">
            The abbreviation is heavily overloaded, and search results mix the senses freely. MCP is also the Mod
            Coder Pack in Minecraft modding, the Master Control Program in Tron, a multi-chip package in
            semiconductors, a managed care plan in US healthcare, and Microsoft Certified Professional in IT
            certification.
          </p>
          <p className="text-gray-400 text-sm leading-relaxed">
            The tell is the surrounding words. If the sentence mentions Claude, Cursor, an agent, a tool call or a
            config file, it is the Model Context Protocol — the sense this page and this whole directory cover.
          </p>
        </section>

        {/* Do you need one */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-3">Do you actually need one?</h2>
          <p className="text-gray-400 mb-4 leading-relaxed">
            Only if you want the assistant to reach something it cannot reach on its own. Writing, explaining and
            reasoning need no server at all. The moment you notice yourself pasting the same screenshot, exporting
            the same CSV or copying the same log for the third time, that is the system worth connecting.
          </p>
          <p className="text-gray-400 leading-relaxed">
            The usual mistake is the opposite one: installing a dozen servers at once. Every connected server adds
            its tool descriptions to the model&rsquo;s context on every single turn, which crowds out room for your
            actual work and makes the model slower to pick correctly. Start with one.
          </p>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">MCP server meaning — FAQ</h2>
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

        {/* Next steps */}
        <section className="rounded-xl border border-blue-500/20 bg-gradient-to-r from-blue-900/30 to-purple-900/30 p-8">
          <h2 className="text-2xl font-bold text-white mb-3">Now go find the one you need</h2>
          <p className="text-gray-400 mb-6">
            {total.toLocaleString()} MCP servers indexed, each with its install command and the date that package
            was last confirmed to exist in its registry.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/servers"
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition text-sm"
            >
              Browse all MCP servers →
            </Link>
            <Link
              href="/guides"
              className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg font-medium transition text-sm"
            >
              Setup guides
            </Link>
            <Link
              href="/claude-mcp-servers"
              className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg font-medium transition text-sm"
            >
              MCP servers for Claude
            </Link>
            <Link
              href="/mcp-marketplace"
              className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg font-medium transition text-sm"
            >
              MCP marketplace
            </Link>
            <Link
              href="/mcp-server"
              className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg font-medium transition text-sm"
            >
              Our own MCP server
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
