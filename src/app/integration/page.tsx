import { Metadata } from "next";
import Link from "next/link";
import { getIntegrationsWithCounts } from "@/data/servers";

export const metadata: Metadata = {
  title: "MCP Server Integrations — Claude, Cursor, VS Code & More | MyMCPTools",
  description: "Find MCP servers that work with your favorite AI tools. Browse servers compatible with Claude Desktop, Cursor, VS Code, Windsurf, and Cline.",
};

export default function IntegrationsPage() {
  const integrations = getIntegrationsWithCounts();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-white mb-4">MCP Integrations</h1>
        <p className="text-gray-400 max-w-2xl">
          Find MCP servers that work with your favorite AI tools and IDEs.
          Most servers support multiple platforms through the standardized Model Context Protocol.
        </p>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map(integration => (
          <Link
            key={integration.slug}
            href={`/integration/${integration.slug}`}
            className="group bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-blue-500/50 transition"
          >
            <div className="flex items-center space-x-4 mb-4">
              <span className="text-5xl">{integration.icon}</span>
              <div>
                <h2 className="text-xl font-semibold text-white group-hover:text-blue-400 transition">
                  {integration.name}
                </h2>
                <p className="text-sm text-gray-500">{integration.count} servers</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm">{integration.description}</p>
          </Link>
        ))}
      </div>

      {/* Info Section */}
      <div className="mt-16 bg-gray-900 border border-gray-800 rounded-xl p-8">
        <h2 className="text-xl font-semibold text-white mb-4">What is MCP?</h2>
        <p className="text-gray-400 mb-4">
          The Model Context Protocol (MCP) is an open standard developed by Anthropic that enables
          AI assistants to securely connect to external data sources and tools. It provides a
          standardized way for AI applications to access context from various sources.
        </p>
        <a
          href="https://modelcontextprotocol.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 transition"
        >
          Learn more about MCP →
        </a>
      </div>

      {/* This directory is itself an MCP server — the most direct integration. */}
      <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-8">
        <h2 className="text-xl font-semibold text-white mb-4">Integrate this directory</h2>
        <p className="text-gray-400 mb-4">
          MyMCPTools speaks MCP too. Connect your client to{" "}
          <code className="rounded bg-gray-800/80 px-1.5 py-0.5 text-[0.85em] text-blue-300 font-mono">
            https://mymcptools.com/api/mcp
          </code>{" "}
          and your assistant can search every server listed here — and check whether it is actually
          up — without leaving the conversation.
        </p>
        <Link href="/mcp-server" className="text-blue-400 hover:text-blue-300 transition">
          Set up the MyMCPTools MCP server →
        </Link>
      </div>
    </div>
  );
}
