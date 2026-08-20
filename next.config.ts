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
      /**
       * Snowflake was carried three times: `snowflake` (Snowflake's own managed
       * Cortex MCP server, deep entry), `snowflake-mcp` (isaacwasserman's
       * self-hosted server — already described inside the canonical entry) and
       * `snowflake-cortex-mcp` (an 8★ Bedrock demo repo). "snowflake mcp" mines
       * at 1,000 SV / SD 25 and three pages were splitting it. The two thin ones
       * are gone from servers.ts and 301 at the survivor.
       */
      { source: "/servers/snowflake-mcp", destination: "/servers/snowflake", permanent: true },
      { source: "/servers/snowflake-cortex-mcp", destination: "/servers/snowflake", permanent: true },
      /**
       * `dynatrace-mcp` had github_url: null / verification: 'unresolved' — no
       * repository was ever found for it — while `dynatrace` points at the real
       * dynatrace-oss/dynatrace-mcp. 320 SV / SD 37, one page, not two.
       */
      { source: "/servers/dynatrace-mcp", destination: "/servers/dynatrace", permanent: true },
      /**
       * `linkedin` had github_url: null and a false `official: true`; the
       * duplicate `linkedin-api-mcp` pointed at a 0★ marketing-API wrapper.
       * "linkedin mcp" mines at 480 SV / SD 29. The surviving `linkedin` entry
       * now carries stickerdaniel/linkedin-mcp-server (3,163★), which is what
       * the query actually means.
       */
      { source: "/servers/linkedin-api-mcp", destination: "/servers/linkedin", permanent: true },
    ];
  },
};

export default nextConfig;
