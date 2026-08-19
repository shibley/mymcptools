import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Type errors are caught locally (`npx tsc --noEmit`) before pushing;
    // skipping the check on Vercel saves build-time CPU (see aisotools
    // 2026-07-08 build-cost investigation, same fix applied here).
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      { source: "/sponsor", destination: "/advertise", permanent: false },
      /**
       * `hacker-news-mcp` and `hackernews` were two catalog entries for one
       * project — same repo (paabloLC/mcp-hacker-news), same published package,
       * two slugs competing for the same query with two different descriptions.
       * The stale-release sweep surfaced the pair by reporting both under one
       * repo. The thinner duplicate is gone from servers.ts; 301 it at the
       * surviving page so the inbound links and any indexed URL keep working.
       */
      { source: "/servers/hacker-news-mcp", destination: "/servers/hackernews", permanent: true },
      /**
       * `powerbi-mcp` and `power-bi-mcp` were two entries for the same query,
       * neither pointing at Microsoft's own server: one at AjvoGod/powerbi-mcp
       * (1★), one at SimonLexRS/Microsoft-MCP-PowerBI (1★). "power bi mcp
       * server" mines at 390 SV / SD 29, and two thin pages were splitting
       * whatever signal the term had. The surviving `power-bi-mcp` entry now
       * carries microsoft/powerbi-modeling-mcp (1,079★, official); the
       * duplicate is gone from servers.ts and 301s here.
       */
      { source: "/servers/powerbi-mcp", destination: "/servers/power-bi-mcp", permanent: true },
    ];
  },
};

export default nextConfig;
