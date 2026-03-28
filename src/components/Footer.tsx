import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-gray-900 border-t border-gray-800 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl">🔧</span>
              <span className="text-xl font-bold text-white">MyMCPTools</span>
            </Link>
            <p className="mt-4 text-sm text-gray-400">
              The most comprehensive directory of MCP servers for AI assistants.
            </p>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Categories</h3>
            <ul className="mt-4 space-y-2">
              <li><Link href="/category/database" className="text-sm text-gray-400 hover:text-white">Database</Link></li>
              <li><Link href="/category/api" className="text-sm text-gray-400 hover:text-white">API & Web</Link></li>
              <li><Link href="/category/coding" className="text-sm text-gray-400 hover:text-white">Coding & Dev</Link></li>
              <li><Link href="/category/browser" className="text-sm text-gray-400 hover:text-white">Browser</Link></li>
              <li><Link href="/category/ai" className="text-sm text-gray-400 hover:text-white">AI & ML</Link></li>
            </ul>
          </div>

          {/* Integrations */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Integrations</h3>
            <ul className="mt-4 space-y-2">
              <li><Link href="/integration/claude-desktop" className="text-sm text-gray-400 hover:text-white">Claude Desktop</Link></li>
              <li><Link href="/integration/cursor" className="text-sm text-gray-400 hover:text-white">Cursor</Link></li>
              <li><Link href="/integration/vs-code" className="text-sm text-gray-400 hover:text-white">VS Code</Link></li>
              <li><Link href="/integration/windsurf" className="text-sm text-gray-400 hover:text-white">Windsurf</Link></li>
              <li><Link href="/integration/cline" className="text-sm text-gray-400 hover:text-white">Cline</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Resources</h3>
            <ul className="mt-4 space-y-2">
              <li><Link href="/blog" className="text-sm text-gray-400 hover:text-white">Blog</Link></li>
              <li><Link href="/submit" className="text-sm text-gray-400 hover:text-white">Submit Server</Link></li>
              <li><Link href="/compare" className="text-sm text-gray-400 hover:text-white">Compare Servers</Link></li>
              <li>
                <a 
                  href="https://modelcontextprotocol.io" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  MCP Docs ↗
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} MyMCPTools. Built with ❤️ for the AI community.
          </p>
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <span className="text-xs text-gray-500">
              Powered by{" "}
              <a 
                href="https://betterstack.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white"
              >
                Better Stack
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
