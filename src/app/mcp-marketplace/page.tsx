import { Metadata } from "next";
import Link from "next/link";
import { ServerCard } from "@/components/ServerCard";
import { servers, getFeaturedServers, getCategoriesWithCounts, getOfficialServers } from "@/data/servers";

export const metadata: Metadata = {
  title: "MCP Marketplace — Browse 2,750+ MCP Servers & Tools | MyMCPTools",
  description:
    "The MCP marketplace for discovering, comparing, and installing Model Context Protocol servers. Browse 2,750+ MCP tools for Claude, Cursor, VS Code, and more. Free and open.",
  alternates: {
    canonical: "https://mymcptools.com/mcp-marketplace",
  },
  openGraph: {
    title: "MCP Marketplace | MyMCPTools",
    description:
      "Discover, compare, and install 2,750+ MCP servers. The open marketplace for Model Context Protocol tools — free directory, no signup.",
    type: "website",
    url: "https://mymcptools.com/mcp-marketplace",
  },
};

export default function MCPMarketplacePage() {
  const featuredServers = getFeaturedServers().slice(0, 12);
  const officialServers = getOfficialServers().slice(0, 6);
  const categories = getCategoriesWithCounts();

  const trendingCategories = [
    { name: "Database", slug: "database", emoji: "🗄️", why: "Query Postgres, SQLite, Redis, and more via AI" },
    { name: "Coding & Dev", slug: "coding", emoji: "💻", why: "GitHub, Linear, Jira, and IDE tools" },
    { name: "Browser", slug: "browser", emoji: "🌍", why: "Web scraping, Puppeteer, Playwright, Firecrawl" },
    { name: "AI & ML", slug: "ai", emoji: "🤖", why: "Perplexity, Exa, Brave Search, and vector tools" },
    { name: "Productivity", slug: "productivity", emoji: "📋", why: "Notion, Obsidian, Asana, task managers" },
    { name: "Cloud", slug: "cloud", emoji: "☁️", why: "AWS, Supabase, Vercel, Docker, Kubernetes" },
  ];

  const faqItems = [
    {
      question: "What is the MCP marketplace?",
      answer:
        "The MCP marketplace (or MCP market) is an open directory of Model Context Protocol (MCP) servers — software components that extend AI assistants like Claude, Cursor, and VS Code Copilot with real-world capabilities. MyMCPTools is the largest independent MCP marketplace, indexing 2,750+ servers across 19 categories. Unlike app stores, there are no gatekeepers or fees: any MCP server can be submitted and listed freely.",
    },
    {
      question: "What is the Model Context Protocol (MCP)?",
      answer:
        "The Model Context Protocol (MCP) is an open standard introduced by Anthropic in November 2024 that defines how AI assistants connect to external tools, databases, APIs, and file systems. It uses a client-server architecture: your AI client (Claude Desktop, Cursor, VS Code) connects to MCP servers that expose capabilities as 'tools'. MCP has been widely adopted — Cursor, VS Code Copilot, Windsurf, Cline, Zed, and Continue all support it natively.",
    },
    {
      question: "Is the MCP marketplace free?",
      answer:
        "Yes. MyMCPTools is a free, open directory. Browsing, searching, and filtering is always free. The underlying MCP servers are mostly open-source and free to install. Some servers connect to paid third-party services (Stripe, Datadog, HubSpot) that require their own subscriptions, but the MCP servers themselves are typically open-source with no license fee.",
    },
    {
      question: "How do I install an MCP server from the marketplace?",
      answer:
        "Each server page on MyMCPTools shows the exact install command (usually a single npx or uvx command) and the config JSON snippet you need to add to your Claude Desktop or VS Code settings. Most installs take under two minutes. For Claude Desktop: add the server config to ~/Library/Application Support/Claude/claude_desktop_config.json and restart Claude.",
    },
    {
      question: "Which MCP servers are most popular in the MCP marketplace?",
      answer:
        "The most popular MCP servers cover web tools (Firecrawl, Brave Search, Puppeteer), databases (PostgreSQL, SQLite, Supabase), developer workflow (GitHub, Linear, Jira), AI-native search (Perplexity, Exa), and productivity (Notion, Obsidian, Asana). Official Anthropic reference servers like Filesystem, Fetch, and Memory are also widely used as starting points.",
    },
    {
      question: "What is the difference between the MCP marketplace and the MCP market?",
      answer:
        'The terms "MCP marketplace" and "MCP market" are used interchangeably by the community. Both refer to directories or hubs where you can discover and compare Model Context Protocol servers. MyMCPTools is the largest open MCP marketplace / MCP market, with 2,750+ servers, category filters, install commands, and live uptime status.',
    },
    {
      question: "Can I submit my own MCP server to the marketplace?",
      answer:
        "Yes! MyMCPTools accepts community submissions. Go to mymcptools.com/submit to add your MCP server to the directory. You'll need a GitHub URL, a short description, and the install command. Most submissions are reviewed and published within 24 hours.",
    },
    {
      question: "Does the MCP marketplace work with tools other than Claude?",
      answer:
        "Yes. All servers in the MyMCPTools MCP marketplace work with any MCP-compatible client: Claude Desktop, Claude Code, Cursor, VS Code (via MCP extension), Windsurf, Cline, Zed, and Continue. The Model Context Protocol is client-agnostic — the same server works across all these tools.",
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "MCP Marketplace",
    "description": `Browse ${servers.length}+ MCP servers in the open MCP marketplace. Discover, compare, and install Model Context Protocol tools for Claude, Cursor, VS Code, and more.`,
    "url": "https://mymcptools.com/mcp-marketplace",
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://mymcptools.com" },
        { "@type": "ListItem", "position": 2, "name": "MCP Marketplace", "item": "https://mymcptools.com/mcp-marketplace" },
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
            <li className="text-gray-300">MCP Marketplace</li>
          </ol>
        </nav>

        {/* Hero */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs px-2.5 py-1 rounded-full font-medium">Open Directory</span>
            <span className="bg-gray-800 text-gray-400 text-xs px-2.5 py-1 rounded-full">{servers.length}+ servers</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            MCP Marketplace
          </h1>
          <p className="text-lg text-gray-400 max-w-3xl mb-4">
            The open <strong className="text-gray-200">MCP marketplace</strong> for discovering, comparing, and installing
            Model Context Protocol servers. Browse {servers.length}+ MCP tools for{" "}
            <strong className="text-gray-200">Claude</strong>, <strong className="text-gray-200">Cursor</strong>,{" "}
            <strong className="text-gray-200">VS Code</strong>, and every other MCP-compatible AI client — free, no signup required.
          </p>
          <p className="text-gray-500 max-w-3xl mb-6">
            MCP servers extend your AI assistant with real-world capabilities: querying databases, browsing the web,
            reading code repos, managing tasks, and calling APIs — all through natural conversation.
            MyMCPTools is the largest independent MCP market on the web.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/servers" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition text-sm">
              Browse All MCP Servers →
            </Link>
            <Link href="/submit" className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg font-medium transition text-sm">
              Submit a Server
            </Link>
            <Link href="/category" className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg font-medium transition text-sm">
              Browse by Category
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12 p-6 bg-gray-900 border border-gray-800 rounded-xl">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{servers.length}+</div>
            <div className="text-xs text-gray-500 mt-1">MCP Servers Listed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{categories.length}</div>
            <div className="text-xs text-gray-500 mt-1">Categories</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">7</div>
            <div className="text-xs text-gray-500 mt-1">AI Clients Supported</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">$0</div>
            <div className="text-xs text-gray-500 mt-1">Cost to Browse</div>
          </div>
        </div>

        {/* Trending Categories */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Trending in the MCP Marketplace</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {trendingCategories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-500/50 transition group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{cat.emoji}</span>
                  <div>
                    <div className="text-white font-semibold group-hover:text-blue-400 transition">{cat.name}</div>
                    <div className="text-gray-500 text-sm mt-1">{cat.why}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Featured Servers */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Featured MCP Servers</h2>
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

        {/* Official Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-3">Official MCP Servers from Anthropic</h2>
          <p className="text-gray-400 mb-6 text-sm">
            Anthropic publishes and maintains these reference MCP servers. They're the safest starting point in any MCP marketplace.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {officialServers.map((server) => (
              <ServerCard key={server.slug} server={server} />
            ))}
          </div>
        </section>

        {/* What is MCP section */}
        <section className="mb-12 bg-gray-900 border border-gray-800 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-4">What is the MCP Marketplace?</h2>
          <div className="text-gray-400 space-y-3 max-w-3xl">
            <p>
              The <strong className="text-gray-200">MCP marketplace</strong> (also called the <strong className="text-gray-200">MCP market</strong>)
              is a directory of Model Context Protocol servers — open-source or commercial software packages that add new capabilities
              to AI assistants. Think of it as an app store for AI tools, except everything runs on an open protocol
              and there are no platform fees.
            </p>
            <p>
              Each MCP server in the marketplace exposes a specific set of <em>tools</em> that your AI can call:
              a database MCP server might expose <code className="text-blue-400 bg-gray-800 px-1 rounded text-xs">query</code> and{" "}
              <code className="text-blue-400 bg-gray-800 px-1 rounded text-xs">describe_table</code>,
              while a GitHub MCP server might expose <code className="text-blue-400 bg-gray-800 px-1 rounded text-xs">create_pull_request</code> and{" "}
              <code className="text-blue-400 bg-gray-800 px-1 rounded text-xs">list_issues</code>.
              The AI decides when and how to call these tools based on what you ask for.
            </p>
            <p>
              MyMCPTools is the largest independent MCP marketplace, with {servers.length}+ servers across 19 categories,
              live uptime status, install commands, and a free submission process for new servers.
            </p>
          </div>
        </section>

        {/* Browse All Categories */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">All MCP Marketplace Categories</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="bg-gray-900 border border-gray-800 rounded-lg p-3 hover:border-blue-500/50 transition text-center"
              >
                <div className="text-xl mb-1">{cat.emoji}</div>
                <div className="text-xs font-medium text-white">{cat.name}</div>
                <div className="text-xs text-gray-600">{cat.count}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">MCP Marketplace FAQ</h2>
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
          <h2 className="text-2xl font-bold text-white mb-3">The open MCP market — no signup, no fees</h2>
          <p className="text-gray-400 mb-6">
            {servers.length}+ MCP servers indexed across 19 categories. Browse, compare, and install in minutes.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/servers" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition">
              Explore the MCP Marketplace
            </Link>
            <Link href="/submit" className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition">
              Add Your MCP Server
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
