import type { Metadata } from "next";
import Link from "next/link";
import { TrustRegistryTable, type TrustRow } from "@/components/TrustRegistryTable";
import { getServerBySlug } from "@/data/servers";
import { getStatus } from "@/lib/trust/status-store";
import { getStaticSignal } from "@/lib/trust/static-signals-store";
import { rankedTrustVerdicts, trustRegistryStats } from "@/lib/trust/verdict-store";
import { DRIFT_WINDOW_DAYS, TIER_DESCRIPTIONS, TIER_LABELS } from "@/lib/trust/verdict";
import type { TrustVerdict } from "@/lib/trust/verdict";

export const metadata: Metadata = {
  title: "MCP Trust Registry — MCP Servers Ranked by Measured Reliability | MyMCPTools",
  description:
    "The only MCP server directory ranked by measured reliability, not popularity. Every server graded A–E on live MCP handshakes, uptime, tool-schema stability and repository maintenance — with the reasons behind every grade shown in full.",
  keywords:
    "MCP server trust, MCP server reliability, are MCP servers safe, best MCP servers, MCP server ranking, MCP server verification, trusted MCP servers, MCP schema drift",
  openGraph: {
    title: "MCP Trust Registry — MCP Servers Ranked by Measured Reliability",
    description:
      "Every MCP server graded on evidence we actually collected: live handshakes, uptime, schema stability, repository maintenance. Servers we cannot verify are said to be unverifiable, not scored.",
    type: "website",
    url: "https://mymcptools.com/trust",
    siteName: "MyMCPTools",
  },
  twitter: {
    card: "summary_large_image",
    title: "MCP Trust Registry — MCP Servers Ranked by Measured Reliability",
    description:
      "MCP servers graded A–E on live handshakes, uptime, schema stability and repository maintenance. Every grade shows its reasons.",
  },
  alternates: { canonical: "https://mymcptools.com/trust" },
};

/** Headline facts for a row, built only from values that were actually measured. */
function factsFor(verdict: TrustVerdict): string[] {
  const facts: string[] = [];
  const status = getStatus(verdict.slug);

  if (status && status.verdict !== "UNPROBEABLE") {
    if (status.tool_count != null) facts.push(`${status.tool_count} tools`);
    if (status.latency_ms != null) facts.push(`${status.latency_ms} ms`);
  }

  const uptime = verdict.signals.find((s) => s.id === "uptime");
  if (uptime?.score != null) facts.push(`${uptime.score}% uptime`);

  const stability = verdict.signals.find((s) => s.id === "schema_stability");
  if (stability?.score != null) {
    facts.push(stability.score === 100 ? "no schema drift" : "schema drift recorded");
  }

  const signal = getStaticSignal(verdict.slug);
  if (signal?.last_commit_at) facts.push(`pushed ${signal.last_commit_at.slice(0, 10)}`);

  const server = getServerBySlug(verdict.slug);
  if (server?.verification === "archived") facts.push("repository archived");

  return facts;
}

const FAQ: { q: string; a: string }[] = [
  {
    q: "How is this different from every other MCP directory?",
    a: "Every other MCP directory ranks by popularity, recency or category. This one ranks by evidence we collected ourselves: a real Model Context Protocol handshake against the server's live endpoint, the share of checks it answered, whether its tool schema changed underneath its users, and whether anyone is still maintaining the repository. Stars and download counts do not enter the score at all, because neither has ever kept a server up.",
  },
  {
    q: "Why are most servers in the catalog not graded?",
    a: "Because grading them would mean making something up. A grade requires at least one thing we measured. Most MCP servers install and run locally over stdio, so there is no remote endpoint to handshake, and we have not yet collected a repository-freshness reading for all of them. Those are listed as not yet measured. Separately, a large share of catalog entries have no repository that resolves against the live GitHub API — those are marked unverifiable and are excluded from scoring entirely.",
  },
  {
    q: "What does an unverifiable server mean — is it dangerous?",
    a: "It means we could not confirm that the source repository exists, so we have nothing to inspect. That is a statement about our evidence, not an accusation about the server. It is deliberately left unscored rather than given a low grade, because a low grade would imply we looked and found problems. We looked and found nothing to look at.",
  },
  {
    q: "What is tool-schema drift and why does it affect the grade?",
    a: `Drift is a server's tool list or input schemas changing between two of our checks — a tool appearing, vanishing, or changing shape. It matters because agents bind to schemas: when a tool silently disappears, the agent does not error, it simply stops being able to do that thing and often reports success anyway. We count drift events over a trailing ${DRIFT_WINDOW_DAYS}-day window, and only for servers we have checked at least twice.`,
  },
  {
    q: "Can a maintainer improve their grade?",
    a: "Yes, and only in ways that are real. Keep the endpoint answering the MCP handshake, keep the tool schema stable, keep the repository pushed to, and make sure the catalog links to a repository that actually resolves. There is nothing to buy here — advertising placement on this site does not affect a grade, and grades are computed from the probe data before any listing status is considered.",
  },
  {
    q: "Can I get these verdicts programmatically?",
    a: "The underlying signals — live verdict, latency, uptime history and tool-schema drift — are already served by the Trust Data API as JSON and CSV, per server and fleet-wide. See the developers page for endpoints and keys.",
  },
];

export default function TrustRegistryPage() {
  const stats = trustRegistryStats();
  const ranked = rankedTrustVerdicts();

  const rows: TrustRow[] = ranked.map((v) => {
    const server = getServerBySlug(v.slug);
    return {
      slug: v.slug,
      name: server?.name ?? v.slug,
      author: server?.author ?? "unknown",
      tier: v.tier,
      score: v.score as number,
      confidence: v.confidence,
      evidenceCount: v.evidenceCount,
      liveMeasured: v.liveMeasured,
      facts: factsFor(v),
    };
  });

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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/15 via-blue-600/10 to-purple-600/10" />
        <div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
            <span className="text-sm font-medium text-emerald-400">
              Ranked by measured reliability, not popularity
            </span>
          </div>
          <h1 className="mb-5 text-4xl font-bold leading-tight sm:text-5xl">MCP Trust Registry</h1>
          <p className="max-w-2xl text-lg leading-relaxed text-gray-400">
            Every other MCP directory ranks servers by stars, downloads or how recently
            someone submitted them. None of those has ever kept a server up. This registry
            grades servers on evidence we collected: a real MCP handshake against the live
            endpoint, the share of checks it answered, whether its tool schema changed
            underneath its users, and whether anyone is still maintaining the source.
          </p>
          <p className="mt-4 max-w-2xl leading-relaxed text-gray-500">
            Where we have no evidence, we say so. Nothing here is scored on vibes, and
            nothing that could not be verified is given a number anyway.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 lg:px-8">
        {/* Population breakdown — the honest denominator, shown before the ranking */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
            <div className="text-3xl font-bold text-emerald-400">{stats.scored.toLocaleString()}</div>
            <div className="mt-1 text-sm text-gray-400">Graded on evidence</div>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
            <div className="text-3xl font-bold text-blue-400">{stats.liveMeasured.toLocaleString()}</div>
            <div className="mt-1 text-sm text-gray-400">Verified by live handshake</div>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
            <div className="text-3xl font-bold text-gray-400">{stats.unmeasured.toLocaleString()}</div>
            <div className="mt-1 text-sm text-gray-400">Not yet measured</div>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
            <div className="text-3xl font-bold text-gray-500">{stats.unverifiable.toLocaleString()}</div>
            <div className="mt-1 text-sm text-gray-400">Unverifiable, excluded</div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900/40 p-5 text-sm leading-relaxed text-gray-400">
          <p>
            Of {stats.total.toLocaleString()} catalog entries,{" "}
            <strong className="text-gray-200">{stats.verifiable.toLocaleString()}</strong> have a
            repository that resolves against the live GitHub API. The other{" "}
            <strong className="text-gray-200">{stats.unverifiable.toLocaleString()}</strong> do not,
            and are excluded from this registry rather than scored on catalog metadata alone —
            a directory that grades software it cannot find is worse than no directory.
          </p>
          <p className="mt-3">
            Of the verifiable ones,{" "}
            <strong className="text-gray-200">{stats.scored.toLocaleString()}</strong> have at least
            one measured signal and appear in the ranking below. The remaining{" "}
            <strong className="text-gray-200">{stats.unmeasured.toLocaleString()}</strong> are local
            stdio installs with no remote endpoint to probe and no repository-freshness reading
            collected yet. That is absence of evidence, not evidence of a problem, and they are
            labelled that way on their own pages.
          </p>
        </div>

        {/* The ranking */}
        <section className="mt-12" id="ranking">
          <h2 className="mb-1 text-2xl font-bold text-gray-100">
            Ranked by measured reliability
          </h2>
          <p className="mb-6 text-sm text-gray-500">
            Servers verified by a live MCP handshake rank above servers graded on repository
            evidence alone, because a working endpoint is stronger evidence than a recent
            commit. Within each group, higher score first. Filters are stored in the URL, so
            any view is a link you can share.
          </p>
          <TrustRegistryTable rows={rows} />
        </section>

        {/* How grades are computed */}
        <section className="mt-14" id="how-it-works">
          <h2 className="mb-1 text-2xl font-bold text-gray-100">What the grades mean</h2>
          <p className="mb-6 text-sm text-gray-500">
            A grade is a weighted mean over the signals we could measure — never over the ones
            we could not. Missing evidence lowers confidence; it never lowers the score.
          </p>
          <div className="space-y-3">
            {(["A", "B", "C", "D", "E", "UNMEASURED", "UNVERIFIABLE"] as const).map((tier) => (
              <div
                key={tier}
                className="flex flex-col gap-2 rounded-xl border border-gray-800 bg-gray-900/40 p-5 sm:flex-row sm:gap-5"
              >
                <div className="sm:w-44 sm:shrink-0">
                  <div className="font-semibold text-gray-100">{TIER_LABELS[tier]}</div>
                  <div className="text-xs text-gray-500">
                    {tier === "A" && "85–100"}
                    {tier === "B" && "70–84"}
                    {tier === "C" && "55–69"}
                    {tier === "D" && "40–54"}
                    {tier === "E" && "below 40"}
                    {(tier === "UNMEASURED" || tier === "UNVERIFIABLE") && "no score"}
                    {" · "}
                    {stats.tiers[tier].toLocaleString()} servers
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-gray-400">{TIER_DESCRIPTIONS[tier]}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Signals */}
        <section className="mt-14">
          <h2 className="mb-1 text-2xl font-bold text-gray-100">The signals behind a grade</h2>
          <p className="mb-6 text-sm text-gray-500">
            Weights are fixed and public. Behaviour we observed outweighs metadata anyone can
            assert. Popularity is not a signal — stars have never kept a server up.
          </p>
          <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800 bg-gray-900/40 px-5">
            {[
              ["Live MCP handshake", 30, "A real Model Context Protocol initialize + tools/list against the server's endpoint. Not an HTTP status ping — a proxy returning 200 while the handshake fails counts as down."],
              ["Source verification", 25, "The repository URL was confirmed to resolve against the live GitHub API, and is not archived."],
              ["Measured uptime", 20, "The share of recorded checks the server answered. Requires at least three checks before it means anything."],
              ["Repository maintenance", 20, "Last push and last release, read from the GitHub API. Archived repositories score zero here by definition."],
              ["Tool-schema stability", 15, `Tool-schema and protocol-version changes across a trailing ${DRIFT_WINDOW_DAYS}-day window. Requires at least two checks.`],
              ["Provenance", 10, "Whether the server is an official MCP reference implementation, vendor-maintained, or community-built. Community is neutral, not a penalty."],
              ["Listing ↔ repository match", 5, "Whether the linked repository plausibly corresponds to the listing. Monorepo subpaths are read as the server name, so official reference servers living inside a shared repository are never flagged as mismatches."],
            ].map(([label, weight, detail]) => (
              <li key={label as string} className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-5">
                <div className="sm:w-52 sm:shrink-0">
                  <div className="text-sm font-medium text-gray-200">{label}</div>
                  <div className="font-mono text-xs text-gray-600">weight {weight}</div>
                </div>
                <p className="text-sm leading-relaxed text-gray-400">{detail}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* API CTA */}
        <section className="mt-14 rounded-2xl border border-gray-800 bg-gradient-to-br from-blue-600/10 to-emerald-500/5 p-8">
          <h2 className="text-xl font-bold text-gray-100">Route your agents on this data</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
            The signals behind these grades — live verdict, latency, uptime history and
            tool-schema drift — are served by the Trust Data API as JSON and CSV, per server
            and fleet-wide, so a gateway or agent can route only to servers that are actually
            answering.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/developers"
              className="inline-flex items-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Explore the Trust Data API
            </Link>
            <Link
              href="/status"
              className="inline-flex items-center rounded-xl border border-gray-700 px-5 py-3 text-sm font-semibold text-gray-200 transition hover:bg-gray-800"
            >
              See live server status
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-14">
          <h2 className="mb-6 text-2xl font-bold text-gray-100">Trust Registry FAQ</h2>
          <div className="space-y-4">
            {FAQ.map((f) => (
              <div key={f.q} className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
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
