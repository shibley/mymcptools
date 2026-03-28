import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl">🔧</span>
              <span className="text-xl font-bold text-gray-900">MyMCPTools</span>
            </Link>
            <p className="mt-4 text-sm text-gray-500">
              The most comprehensive directory of MCP servers for AI assistants.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">Categories</h3>
            <ul className="mt-4 space-y-2">
              <li><Link href="/category/database" className="text-sm text-gray-500 hover:text-gray-900">Database</Link></li>
              <li><Link href="/category/api" className="text-sm text-gray-500 hover:text-gray-900">API & Web</Link></li>
              <li><Link href="/category/coding" className="text-sm text-gray-500 hover:text-gray-900">Coding & Dev</Link></li>
              <li><Link href="/category/browser" className="text-sm text-gray-500 hover:text-gray-900">Browser</Link></li>
              <li><Link href="/category/ai" className="text-sm text-gray-500 hover:text-gray-900">AI & ML</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">Integrations</h3>
            <ul className="mt-4 space-y-2">
              <li><Link href="/integration/claude-desktop" className="text-sm text-gray-500 hover:text-gray-900">Claude Desktop</Link></li>
              <li><Link href="/integration/cursor" className="text-sm text-gray-500 hover:text-gray-900">Cursor</Link></li>
              <li><Link href="/integration/vs-code" className="text-sm text-gray-500 hover:text-gray-900">VS Code</Link></li>
              <li><Link href="/integration/windsurf" className="text-sm text-gray-500 hover:text-gray-900">Windsurf</Link></li>
              <li><Link href="/integration/cline" className="text-sm text-gray-500 hover:text-gray-900">Cline</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">Resources</h3>
            <ul className="mt-4 space-y-2">
              <li><Link href="/blog" className="text-sm text-gray-500 hover:text-gray-900">Blog</Link></li>
              <li><Link href="/submit" className="text-sm text-gray-500 hover:text-gray-900">Submit Server</Link></li>
              <li><Link href="/compare" className="text-sm text-gray-500 hover:text-gray-900">Compare Servers</Link></li>
              <li>
                <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-gray-900">
                  MCP Docs ↗
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} MyMCPTools. Built for the AI community.
          </p>
        </div>
      </div>
    </footer>
  );
}
