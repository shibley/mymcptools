# MyMCPTools.com

The most comprehensive directory of MCP (Model Context Protocol) servers.

## 🚀 Features

- **270+ MCP Servers** - Real data from the MCP ecosystem
- **16 Categories** - Database, API, Coding, Browser, AI/ML, and more
- **7 Integrations** - Claude Desktop, Cursor, VS Code, Windsurf, Cline, Zed, Continue
- **Server Detail Pages** - Install commands, descriptions, related servers
- **Comparison Pages** - Side-by-side comparisons of popular servers
- **Search** - Find servers by name, description, or category
- **Full SEO** - Dynamic sitemap, robots.txt, JSON-LD schema

## 🔌 MyMCPTools is itself an MCP server

The directory is queryable over the Model Context Protocol, not just over HTTP. The endpoint is
remote, read-only and needs no authentication:

```
https://mymcptools.com/api/mcp
```

Transport is **streamable HTTP**, running **stateless** (no session IDs, POST only) so it works on
Vercel's serverless runtime. `GET` returns 405 by design — there is no server-initiated SSE stream
to subscribe to.

**Claude Code:**

```bash
claude mcp add --transport http mymcptools https://mymcptools.com/api/mcp
```

**Claude Desktop / Cursor / Windsurf** (`mcpServers` config block):

```json
{
  "mcpServers": {
    "mymcptools": {
      "type": "http",
      "url": "https://mymcptools.com/api/mcp"
    }
  }
}
```

### Tools

| Tool | What it answers |
| --- | --- |
| `search_mcp_servers` | Catalog search by query, category, integration, install type; `only_verified` restricts to servers that passed a live handshake |
| `get_mcp_server` | Full entry for one slug — install command, repo, clients, verdict, repo freshness, related servers |
| `get_server_status` | Current probe verdict, tool count, latency, protocol version (omit slug for the catalog rollup) |
| `get_server_history` | Trailing probe series plus a daily uptime sparkline |
| `list_server_incidents` | Reconstructed outage windows with duration and failure reason |
| `list_schema_drift` | Tool-schema / protocol-version changes between probes |
| `list_categories` | Categories and client integrations with counts |
| `get_catalog_stats` | Catalog-wide health aggregates |

### Resources

- `mymcptools://catalog/categories`
- `mymcptools://catalog/stats`
- `mymcptools://server/{slug}` — any catalog slug is readable; `resources/list` advertises the
  featured subset because the full catalog is too large to enumerate

Implementation: `src/app/api/mcp/route.ts` (transport) and `src/lib/mcp/server.ts` (tool +
resource definitions). Every handler reads the same modules the REST API uses — `src/data/servers.ts`
and `src/lib/trust/*` — so there is no second copy of the business logic. Docs page: `/mcp-server`.

## 🛠️ Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx              # Homepage
│   ├── servers/[slug]/       # Individual server pages
│   ├── category/[slug]/      # Category listing pages
│   ├── integration/[slug]/   # Integration pages
│   ├── compare/[slug]/       # Comparison pages
│   ├── search/               # Search results
│   ├── submit/               # Server submission form
│   ├── blog/                 # Blog placeholder
│   ├── sitemap.ts            # Dynamic sitemap
│   └── robots.ts             # Robots.txt
├── components/
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── ServerCard.tsx
│   └── CopyButton.tsx
└── data/
    └── servers.ts            # Server data & helper functions
```

## 🏃 Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 📊 Pages Generated

- **352 total pages** at build time
- **270 server detail pages**
- **16 category pages**
- **7 integration pages**
- **45 comparison pages**
- **Static pages**: Home, Search, Submit, Blog

## 🔗 Links

- **Live Site**: https://mymcptools.com
- **MCP Docs**: https://modelcontextprotocol.io

## 📝 License

MIT
