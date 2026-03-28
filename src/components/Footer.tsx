import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-gray-800 mt-20 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          <div>
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                MyMCP
              </span>
              <span className="text-gray-400 text-sm font-medium">Tools</span>
            </Link>
            <p className="mt-4 text-sm text-gray-400">
              The most comprehensive directory of MCP servers for AI assistants. Updated daily.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-3">Categories</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/category/database" className="hover:text-white transition">Database</Link></li>
              <li><Link href="/category/api" className="hover:text-white transition">API & Web</Link></li>
              <li><Link href="/category/coding" className="hover:text-white transition">Coding & Dev</Link></li>
              <li><Link href="/category/browser" className="hover:text-white transition">Browser</Link></li>
              <li><Link href="/category/ai" className="hover:text-white transition">AI & ML</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-3">Integrations</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/integration/claude-desktop" className="hover:text-white transition">Claude Desktop</Link></li>
              <li><Link href="/integration/cursor" className="hover:text-white transition">Cursor</Link></li>
              <li><Link href="/integration/vs-code" className="hover:text-white transition">VS Code</Link></li>
              <li><Link href="/integration/windsurf" className="hover:text-white transition">Windsurf</Link></li>
              <li><Link href="/integration/cline" className="hover:text-white transition">Cline</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-3">Resources</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/blog" className="hover:text-white transition">Blog</Link></li>
              <li><Link href="/submit" className="hover:text-white transition">Submit Server</Link></li>
              <li><Link href="/compare" className="hover:text-white transition">Compare Servers</Link></li>
              <li>
                <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
                  MCP Docs ↗
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-3">Newsletter</h3>
            <p className="text-gray-400 text-sm mb-3">
              Get the best new MCP servers in your inbox weekly.
            </p>
            <form className="flex gap-2 max-w-xs">
              <input
                type="email"
                placeholder="you@email.com"
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm min-w-0 flex-1 focus:outline-none focus:border-blue-500 text-gray-100 placeholder-gray-500"
              />
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition shrink-0">
                Join
              </button>
            </form>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-500 text-sm">
          © {new Date().getFullYear()} MyMCPTools. Built for the AI community.
        </div>
      </div>
    </footer>
  );
}
