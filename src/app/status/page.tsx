import type { Metadata } from "next";
import Link from "next/link";
import { StatusPill } from "@/components/StatusBadge";
import { allStatuses, summary, generatedAt } from "@/lib/trust/status-store";
import { getServerBySlug } from "@/data/servers";
import type { CurrentStatus, Verdict } from "@/lib/trust/types";

export const metadata: Metadata = {
  title: "MCP Server Status — Live Health of the MCP Ecosystem | MyMCPTools",
  description:
    "Live status for Model Context Protocol servers, verified with real MCP handshakes — which servers are up, which need auth, which are down, and which recently changed their tools. Refreshed continuously.",
  keywords:
    "MCP server status, are MCP servers down, MCP server uptime, MCP server health, is my MCP server down, Model Context Protocol status, MCP server monitoring",
  openGraph: {
    title: "MCP Server Status — Live Health of the MCP Ecosystem",
    description:
      "Real MCP-handshake verification across the MCP server ecosystem: live, auth-required, down, and recently-drifted servers at a glance.",
    type: "website",
    url: "https://mymcptools.com/status",
    siteName: "MyMCPTools",
  },
  twitter: {
    card: "summary_large_image",
    title: "MCP Server Status — Live Health of the MCP Ecosystem",
    description:
      "Real MCP-handshake verification: live, auth-required, down, and recently-drifted MCP servers.",
  },
  alternates: { canonical: "https://mymcptools.com/status" },
};

function nameFor(slug: string): string {
  return getServerBySlug(slug)?.name ?? slug;
}

/** Verbose-but-stable relative time, computed at build/render time. */
function relativeTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const min = Math.round((Date.now() - then) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

function ServerRow({ status }: { status: CurrentStatus }) {
  const server = getServerBySlug(status.slug);
  const drifted = relativeTime(status.schema_changed_at);
  return (
    <li className="flex items-center justify-between gap-3 border-b border-gray-800 py-3 last:border-0">
      <div className="min-w-0">
        <Link
          href={`/servers/${status.slug}`}
          className="font-medium text-gray-100 hover:text-white truncate block"
        >
          {nameFor(status.slug)}
        </Link>
        <p className="text-xs text-gray-500 truncate">
          {status.tool_count != null && <span>{status.tool_count} tools</span>}
          {status.latency_ms != null && <span> · {status.latency_ms} ms</span>}
          {status.negotiated_protocol_version && (
            <span> · protocol {status.negotiated_protocol_version}</span>
          )}
          {status.verdict !== "GOOD" && status.last_seen_good_at && (
            <span> · last healthy {relativeTime(status.last_seen_good_at)}</span>
          )}
          {server && <span> · {server.author}</span>}
        </p>
      </div>
      <div className="shrink-0">
        <StatusPill status={status} showChecked={!drifted} />
      </div>
    </li>
  );
}

const STAT_CARDS: { verdict: Verdict; label: string; accent: string }[] = [
  { verdict: "GOOD", label: "Verified live", accent: "text-green-400" },
  { verdict: "AUTH_REQUIRED", label: "Auth required", accent: "text-blue-400" },
  { verdict: "WARN", label: "Limited", accent: "text-amber-400" },
  { verdict: "DOWN", label: "Down", accent: "text-red-400" },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "How do you check whether an MCP server is down?",
    a: "We run a real Model Context Protocol handshake against each remote server — initialize, notifications/initialized, ping and tools/list over Streamable HTTP — not a plain HTTP status ping. A server that returns 200 from a misconfigured proxy but never completes the MCP handshake is reported as Down, not healthy. Probes are strictly read-only and never call a server's tools.",
  },
  {
    q: "What do the status labels mean?",
    a: "Live means the server completed a full MCP handshake and exposed tools. Limited means it speaks MCP but returned no or partial tools. Auth required means it responded with a 401 and an OAuth/Bearer challenge, so it is alive but gated. Down means it failed the handshake on several consecutive checks. Local install means it is a stdio/local server with no remote endpoint to verify.",
  },
  {
    q: "Why are so many servers marked \"Local install\"?",
    a: "Many MCP servers ship as npm or pip packages that run on your own machine over stdio. There is no remote endpoint to handshake, so they cannot be verified live — we surface source-repo recency instead on each server's page.",
  },
  {
    q: "How fresh is this data?",
    a: "The full population is re-probed on a nightly cadence, with a hot set of popular and recently-failing servers checked more often. Each server shows its own last-checked time.",
  },
  {
    q: "Can I get this data programmatically?",
    a: "Yes. The Trust Data API exposes live verdict, latency, uptime and tool-schema drift as JSON and CSV endpoints. See the developers page for endpoints and API keys.",
  },
];

export default function StatusPage() {
  const counts = summary();
  const statuses = allStatuses();
  const generated = generatedAt();

  const remoteVerified =
    counts.GOOD + counts.WARN + counts.AUTH_REQUIRED + counts.DOWN;

  const live = statuses
    .filter((s) => s.verdict === "GOOD")
    .sort((a, b) => (a.latency_ms ?? Infinity) - (b.latency_ms ?? Infinity));
  const authRequired = statuses.filter((s) => s.verdict === "AUTH_REQUIRED");
  const degraded = statuses.filter(
    (s) => s.verdict === "DOWN" || s.verdict === "WARN"
  );
  const recentlyDrifted = statuses
    .filter((s) => s.schema_changed_at)
    .sort(
      (a, b) =>
        new Date(b.schema_changed_at as string).getTime() -
        new Date(a.schema_changed_at as string).getTime()
    )
    .slice(0, 12);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/15 via-blue-600/10 to-purple-600/10" />
        <div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            <span className="text-sm font-medium text-emerald-400">
              Live MCP handshake verification
            </span>
          </div>
          <h1 className="mb-5 text-4xl font-bold leading-tight sm:text-5xl">
            MCP server status
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-gray-400">
            Is that MCP server actually up? We verify Model Context Protocol
            servers with a real handshake — not a status-code ping — so you can
            see which are live, which need auth, which are down, and which just
            changed their tools. {relativeTime(generated) && (
              <span className="text-gray-500">
                Last refreshed {relativeTime(generated)}.
              </span>
            )}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 lg:px-8">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STAT_CARDS.map((card) => (
            <div
              key={card.verdict}
              className="rounded-xl border border-gray-800 bg-gray-900/60 p-5"
            >
              <div className={`text-3xl font-bold ${card.accent}`}>
                {counts[card.verdict] ?? 0}
              </div>
              <div className="mt-1 text-sm text-gray-400">{card.label}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-gray-500">
          {remoteVerified.toLocaleString()} remotely-verifiable servers probed ·{" "}
          {(counts.UNPROBEABLE ?? 0).toLocaleString()} local/stdio installs
          (no remote endpoint to verify).
        </p>

        {/* Down / degraded — most important, shown first when present */}
        {degraded.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-1 text-2xl font-bold text-gray-100">
              Down or degraded
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              Servers that failed the MCP handshake on recent checks, or that
              speak MCP but returned no tools.
            </p>
            <ul className="rounded-xl border border-gray-800 bg-gray-900/40 px-5">
              {degraded.map((s) => (
                <ServerRow key={s.slug} status={s} />
              ))}
            </ul>
          </section>
        )}

        {/* Verified live */}
        <section className="mt-12">
          <h2 className="mb-1 text-2xl font-bold text-gray-100">
            Verified live servers
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            Completed a full MCP handshake and exposed tools on the last check,
            fastest handshake first.
          </p>
          {live.length > 0 ? (
            <ul className="rounded-xl border border-gray-800 bg-gray-900/40 px-5">
              {live.map((s) => (
                <ServerRow key={s.slug} status={s} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">
              No remotely-verified live servers in the current dataset.
            </p>
          )}
        </section>

        {/* Recently changed tools (drift) */}
        {recentlyDrifted.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-1 text-2xl font-bold text-gray-100">
              Recently changed tools
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              Servers whose tool schema changed since the previous probe — added,
              removed or renamed tools. Worth re-checking before you rely on them.
            </p>
            <ul className="rounded-xl border border-gray-800 bg-gray-900/40 px-5">
              {recentlyDrifted.map((s) => (
                <li
                  key={s.slug}
                  className="flex items-center justify-between gap-3 border-b border-gray-800 py-3 last:border-0"
                >
                  <Link
                    href={`/servers/${s.slug}`}
                    className="font-medium text-gray-100 hover:text-white truncate"
                  >
                    {nameFor(s.slug)}
                  </Link>
                  <span className="shrink-0 text-xs text-amber-300/90">
                    tools changed {relativeTime(s.schema_changed_at)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Auth required */}
        {authRequired.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-1 text-2xl font-bold text-gray-100">
              Auth required
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              Alive and speaking MCP, but gated behind OAuth/Bearer auth — you
              will need credentials to connect.
            </p>
            <ul className="rounded-xl border border-gray-800 bg-gray-900/40 px-5">
              {authRequired.map((s) => (
                <ServerRow key={s.slug} status={s} />
              ))}
            </ul>
          </section>
        )}

        {/* API CTA */}
        <section className="mt-14 rounded-2xl border border-gray-800 bg-gradient-to-br from-blue-600/10 to-emerald-500/5 p-8">
          <h2 className="text-xl font-bold text-gray-100">
            Need this data in your app?
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            The Trust Data API serves live verdict, latency, uptime and
            tool-schema drift for every server on this page as JSON and CSV —
            so your agent or gateway can route only to healthy MCP servers.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/developers"
              className="inline-flex items-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Explore the status API
            </Link>
            <Link
              href="/"
              className="inline-flex items-center rounded-xl border border-gray-700 px-5 py-3 text-sm font-semibold text-gray-200 transition hover:bg-gray-800"
            >
              Browse all MCP servers
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-14">
          <h2 className="mb-6 text-2xl font-bold text-gray-100">
            MCP server status FAQ
          </h2>
          <div className="space-y-4">
            {FAQ.map((f) => (
              <div
                key={f.q}
                className="rounded-xl border border-gray-800 bg-gray-900/40 p-5"
              >
                <h3 className="mb-2 font-semibold text-gray-100">{f.q}</h3>
                <p className="text-sm leading-relaxed text-gray-400">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
