import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blog — MCP News, Tutorials & Guides | MyMCPTools",
  description: "Stay up to date with the latest MCP news, tutorials, and guides. Learn how to build and use Model Context Protocol servers.",
};

export default function BlogPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-white mb-4">Blog</h1>
        <p className="text-gray-400">
          Tutorials, guides, and news about the Model Context Protocol ecosystem.
        </p>
      </div>

      {/* Coming Soon */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
        <span className="text-6xl mb-4 block">📝</span>
        <h2 className="text-xl font-semibold text-white mb-4">Coming Soon</h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          We&apos;re working on amazing content about MCP servers, tutorials, and best practices.
          Check back soon!
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
        >
          Browse MCP Servers
        </Link>
      </div>

      {/* Preview Articles */}
      <div className="mt-16">
        <h2 className="text-xl font-semibold text-white mb-6">Upcoming Articles</h2>
        <div className="space-y-4">
          {[
            "Getting Started with Model Context Protocol",
            "Top 10 MCP Servers for Developers in 2024",
            "Building Your First MCP Server: A Complete Guide",
            "MCP vs Traditional API Integrations",
            "How to Choose the Right MCP Server for Your Workflow",
          ].map((title, i) => (
            <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
              <span className="text-gray-400">{title}</span>
              <span className="text-xs text-gray-600">Coming soon</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
