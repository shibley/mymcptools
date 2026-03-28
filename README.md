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
