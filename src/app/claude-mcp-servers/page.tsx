import { Metadata } from "next";
import Link from "next/link";
import { ServerCard } from "@/components/ServerCard";
import { servers, getOfficialServers, getFeaturedServers, getCategoriesWithCounts } from "@/data/servers";

export const metadata: Metadata = {
  title: "Claude MCP Servers — Browse 2,750+ Model Context Protocol Servers | MyMCPTools",
  description:
    "Find the best Claude MCP servers. Browse 2,750+ Model Context Protocol servers compatible with Claude Desktop, Claude Code, and the Claude API. Free directory with install commands.",
  alternates: {
    canonical: "https://mymcptools.com/claude-mcp-servers",
  },
  openGraph: {
    title: "Claude MCP Servers | MyMCPTools",
    description:
      "Browse 2,750+ MCP servers compatible with Claude Desktop, Claude Code, and Claude API. The open directory for Claude MCP server integrations.",
    type: "website",
    url: "https://mymcptools.com/claude-mcp-servers",
  },
};

export default function ClaudeMCPServersPage() {
  const officialServers = getOfficialServers().slice(0, 8);
  const featuredServers = getFeaturedServers().slice(0, 12);
  const categories = getCategoriesWithCounts().slice(0, 8);

  const faqItems = [
    {
      question: "What is a Claude MCP server?",
      answer:
        "A Claude MCP server is a software component that implements the Model Context Protocol (MCP) — an open standard created by Anthropic that lets Claude connect to external tools, databases, APIs, and services. When you add an MCP server to your Claude setup, the AI gains new abilities: querying databases, reading files, searching the web, executing code, and more — all through natural conversation. Claude MCP servers run locally or remotely and communicate with Claude Desktop, Claude Code, or the Claude API using a standard JSON-RPC protocol.",
    },
    {
      question: "How do I install a Claude MCP server?",
      answer:
        "Most Claude MCP servers install via npm or pip in a single command (e.g. npx @modelcontextprotocol/server-sqlite). After installing, you add the server's config to your claude_desktop_config.json file (for Claude Desktop) or .claude/settings.json (for Claude Code). MyMCPTools shows the exact install command for each server on its detail page. Anthropic also maintains official reference implementations at github.com/modelcontextprotocol/servers.",
    },
    {
      question: "What is the Model Context Protocol (MCP)?",
      answer:
        "The Model Context Protocol (MCP) is an open standard published by Anthropic in November 2024 that defines how AI assistants like Claude connect to external data sources and tools. MCP uses a client-server architecture: your AI client (Claude Desktop, Cursor, VS Code) connects to MCP servers that expose specific capabilities as 'tools', 'resources', or 'prompts'. The protocol is language-agnostic and has been adopted by Cursor, VS Code Copilot, Windsurf, Cline, and dozens of other AI-first products.",
    },
    {
      question: "Are Claude MCP servers safe to use?",
      answer:
        "Claude MCP servers run with the permissions you grant them. Official servers from Anthropic and major vendors (GitHub, Stripe, Notion) are reviewed and widely used. Community servers should be reviewed before use — check the GitHub repo, star count, and recent activity. MyMCPTools flags official servers from verified publishers. For sensitive environments, prefer local MCP servers that don't send data to external services.",
    },
    {
      question: "What Claude MCP servers are available for Claude Desktop?",
      answer:
        "Thousands of Claude MCP servers are compatible with Claude Desktop, covering databases (SQLite, PostgreSQL, Redis), developer tools (GitHub, Linear, Jira), web tools (Firecrawl, Puppeteer, Browserbase), AI services (Perplexity, Exa, Brave Search), productivity apps (Notion, Obsidian, Asana), and infrastructure (Docker, Kubernetes, Terraform). Browse the full list at mymcptools.com/servers or filter by category.",
    },
    {
      question: "What is the difference between Claude MCP servers and plugins?",
      answer:
        "Claude MCP servers are the successor to earlier plugin concepts. Unlike browser-based plugins, MCP servers are standalone processes that run on your machine (or a remote server) and communicate with Claude via a standardized protocol. This means they can access local files, databases, and APIs that a browser plugin cannot. MCP is also cross-client — the same server works in Claude Desktop, Cursor, VS Code, and Windsurf without modification.",
    },
    {
      question: "How many Claude MCP servers exist?",
      answer:
        `The MCP ecosystem has grown rapidly since Anthropic launched the protocol in late 2024. MyMCPTools indexes ${servers.length}+ MCP servers across 19 categories. New servers are added daily by both official vendors and the open-source community. The fastest-growing categories are developer tools, database integrations, and AI/ML services.`,
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Claude MCP Servers",
    "description": `Browse ${servers.length}+ Claude MCP servers. The open directory for Model Context Protocol integrations compatible with Claude Desktop, Claude Code, and the Claude API.`,
    "url": "https://mymcptools.com/claude-mcp-servers",
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://mymcptools.com" },
        { "@type": "ListItem", "position": 2, "name": "Claude MCP Servers", "item": "https://mymcptools.com/claude-mcp-servers" },
      ],
    },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqItems.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer,
      },
    })),
  };

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
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-gray-500">
          <ol className="flex items-center space-x-2">
            <li><Link href="/" className="hover:text-gray-300 transition">Home</Link></li>
            <li>/</li>
            <li className="text-gray-300">Claude MCP Servers</li>
          </ol>
        </nav>

        {/* Hero */}
        <div className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Claude MCP Servers
          </h1>
          <p className="text-lg text-gray-400 max-w-3xl mb-4">
            Browse {servers.length}+ <strong className="text-gray-200">Claude MCP servers</strong> — the open directory for Model Context Protocol integrations
            compatible with Claude Desktop, Claude Code, and the Claude API. Find, compare, and install
            MCP servers for databases, developer tools, web automation, AI services, and more.
          </p>
          <p className="text-gray-500 max-w-3xl mb-6">
            The <strong className="text-gray-300">Model Context Protocol (MCP)</strong> is Anthropic's open standard that lets Claude connect
            to external tools and data sources. Every server listed here works with Claude via MCP — giving
            your AI assistant new capabilities through a single standardized interface.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/servers" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition text-sm">
              Browse All Servers →
            </Link>
            <Link href="/category" className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg font-medium transition text-sm">
              Browse by Category
            </Link>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12 p-6 bg-gray-900 border border-gray-800 rounded-xl">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{servers.length}+</div>
            <div className="text-xs text-gray-500 mt-1">Claude MCP Servers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">19</div>
            <div className="text-xs text-gray-500 mt-1">Categories</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">7</div>
            <div className="text-xs text-gray-500 mt-1">MCP Clients Supported</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">Free</div>
            <div className="text-xs text-gray-500 mt-1">Always Free Directory</div>
          </div>
        </div>

        {/* What are Claude MCP Servers */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">What are Claude MCP Servers?</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-gray-400 space-y-3">
            <p>
              A <strong className="text-gray-200">Claude MCP server</strong> is a software component that implements the{" "}
              <strong className="text-gray-200">Model Context Protocol</strong> — an open standard created by Anthropic that gives Claude
              the ability to connect to external tools, databases, APIs, and file systems. Instead of Claude being limited to its training
              data, MCP servers extend it with real-time, live capabilities.
            </p>
            <p>
              When you add a Claude MCP server to your setup, you unlock new skills: querying your PostgreSQL database,
              reading GitHub pull requests, searching the web with Brave or Perplexity, managing Notion pages, running
              Docker containers, browsing the web with Puppeteer — all through natural language in your existing Claude interface.
            </p>
            <p>
              Claude MCP servers work with <strong className="text-gray-200">Claude Desktop</strong>,{" "}
              <strong className="text-gray-200">Claude Code</strong>, and the{" "}
              <strong className="text-gray-200">Claude API</strong>, as well as third-party MCP-compatible clients like
              Cursor, Windsurf, VS Code, and Cline.
            </p>
          </div>
        </section>

        {/* Official Claude MCP Servers */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Official Claude MCP Servers</h2>
            <Link href="/category/coding" className="text-blue-400 hover:text-blue-300 text-sm transition">
              View more →
            </Link>
          </div>
          <p className="text-gray-400 mb-6">
            Anthropic maintains a set of official reference MCP servers at{" "}
            <code className="text-blue-400 bg-gray-800 px-1.5 py-0.5 rounded text-xs">github.com/modelcontextprotocol/servers</code>.
            These cover the most common use cases and are the safest starting point for Claude MCP integration.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {officialServers.map((server) => (
              <ServerCard key={server.slug} server={server} />
            ))}
          </div>
        </section>

        {/* Popular Claude MCP Servers */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Popular Claude MCP Servers</h2>
            <Link href="/servers" className="text-blue-400 hover:text-blue-300 text-sm transition">
              View all {servers.length}+ →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {featuredServers.map((server) => (
              <ServerCard key={server.slug} server={server} />
            ))}
          </div>
        </section>

        {/* Browse by Category */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Browse Claude MCP Servers by Category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-blue-500/50 transition"
              >
                <div className="text-2xl mb-1">{cat.emoji}</div>
                <div className="text-sm font-medium text-white">{cat.name}</div>
                <div className="text-xs text-gray-500">{cat.count} servers</div>
              </Link>
            ))}
            <Link
              href="/category"
              className="bg-gray-900 border border-gray-700 border-dashed rounded-lg p-4 hover:border-gray-600 transition flex items-center justify-center"
            >
              <div className="text-center">
                <div className="text-2xl mb-1">+</div>
                <div className="text-sm text-gray-400">All Categories</div>
              </div>
            </Link>
          </div>
        </section>

        {/* How to install */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">How to Install a Claude MCP Server</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">1. Find a server on MyMCPTools</h3>
              <p className="text-gray-400 text-sm">Browse the directory and click through to any Claude MCP server page for the exact install command, config snippet, and feature breakdown.</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">2. Run the install command</h3>
              <p className="text-gray-400 text-sm mb-2">Most Claude MCP servers install via npm or pip:</p>
              <code className="block bg-gray-800 text-green-400 px-4 py-2 rounded text-sm font-mono">npx @modelcontextprotocol/server-sqlite /path/to/db.sqlite</code>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">3. Add to your Claude config</h3>
              <p className="text-gray-400 text-sm mb-2">For Claude Desktop, add the server to <code className="text-blue-400 bg-gray-800 px-1 rounded text-xs">~/Library/Application Support/Claude/claude_desktop_config.json</code>:</p>
              <pre className="bg-gray-800 text-gray-300 px-4 py-3 rounded text-xs font-mono overflow-x-auto">{`{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-sqlite", "/path/to/db.sqlite"]
    }
  }
}`}</pre>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">4. Restart Claude and start using it</h3>
              <p className="text-gray-400 text-sm">Restart Claude Desktop and the MCP server tools will appear automatically. Ask Claude to use them by name or just describe what you want to do.</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions — Claude MCP Servers</h2>
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
          <h2 className="text-2xl font-bold text-white mb-3">Ready to extend Claude with MCP?</h2>
          <p className="text-gray-400 mb-6">Browse {servers.length}+ Claude MCP servers across 19 categories. Free, open directory — no signup required.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/servers" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition">
              Browse All Claude MCP Servers
            </Link>
            <Link href="/submit" className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition">
              Submit Your Server
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
