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
      /**
       * Observability duplicate pairs, found by grepping servers.ts for the
       * terms mined on 2026-08-20. Both `grafana-mcp` and `prometheus-mcp`
       * were github_url: null / verification: 'unresolved' community stubs
       * splitting the query with a real, verified entry — grafana/mcp-grafana
       * (3,377\u2605) and prometheus/prometheus-mcp (86\u2605, the adopted
       * tjhop/prometheus-mcp-server). "grafana mcp" mines at 1,600 SV / SD 25,
       * "prometheus mcp" at 170 SV / SD 29. One page each, not two.
       */
      { source: "/servers/grafana-mcp", destination: "/servers/grafana", permanent: true },
      { source: "/servers/prometheus-mcp", destination: "/servers/prometheus", permanent: true },
      /**
       * CI/CD duplicate pairs, found by the sibling-pair sweep on 2026-08-21.
       * `gitlab-issues-mcp` was github_url: null / verification: 'unresolved'
       * — no repository was ever found for it — and its blurb described
       * capabilities the real `gitlab` entry already documents. "gitlab mcp
       * server" mines at 880 SV / SD 34; one page, not two.
       *
       * `argocd-mcp` and `argo-cd` were the more unusual shape: both pointed at
       * the SAME repository (argoproj-labs/mcp-for-argocd, 557★) with the same
       * star count, so the pair was two renderings of one project rather than a
       * stub beside a real entry. The survivor keeps the `argo-cd` slug and
       * absorbs the duplicate's verified npx install command. "argocd mcp
       * server" mines at 110 SV / SD 20.
       */
      { source: "/servers/gitlab-issues-mcp", destination: "/servers/gitlab", permanent: true },
      { source: "/servers/argocd-mcp", destination: "/servers/argo-cd", permanent: true },
    ];
  },
};

export default nextConfig;
