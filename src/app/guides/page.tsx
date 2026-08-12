import { Metadata } from "next";
import Link from "next/link";
import { serverGuides } from "@/data/server-guides";
import { getServerBySlug } from "@/data/servers";

/**
 * Hub for the hand-written per-server setup guides.
 *
 * The guides render inside /servers/[slug], which means they sit behind a
 * 2,400-page index and get essentially no internal links — a page a crawler
 * reaches once every few weeks does not rank however good it is. This page is
 * the crawl signal: one short, linked list that says what each guide actually
 * answers rather than repeating the server's tagline.
 *
 * At twenty guides a single date-ordered list stopped working: somebody who
 * wants "which Postgres MCP server" has no reason to read past a Figma entry,
 * and the recency ordering scattered the three database guides across the page.
 * So they group. Each server is assigned to the first bucket that matches one
 * of its categories, walking CATEGORY_PRIORITY in order — the priority list is
 * what stops Linear (productivity, coding) from filing under code, and Datadog
 * (analytics, devops) from filing under analytics. Recency ordering is kept
 * inside each group, where it still means something.
 */

type BucketId = "data" | "infra" | "code" | "work" | "other";

/**
 * Display order. Databases first because those are the guides that answer a
 * genuinely ambiguous question ("which of these is the Postgres MCP server").
 */
const BUCKETS: { id: BucketId; title: string; blurb: string }[] = [
  {
    id: "data",
    title: "Databases and backends",
    blurb:
      "Where more than one server claims the name and the retired one still installs cleanly.",
  },
  {
    id: "infra",
    title: "Infrastructure, deploys and observability",
    blurb:
      "Hosted servers, mostly — the configuration that matters lives in the URL, not in a config file.",
  },
  {
    id: "code",
    title: "Code, design and browsers",
    blurb: "Repos, designs and the servers that drive an actual browser.",
  },
  {
    id: "work",
    title: "Docs, tickets and team tools",
    blurb:
      "The ones where the setup is short and the auth step is where the hour goes.",
  },
  { id: "other", title: "Everything else", blurb: "" },
];

/**
 * First match wins, so order is the whole design. Productivity outranks coding
 * because an issue tracker is not a coding tool; devops outranks analytics
 * because Datadog is read by the person on call.
 */
const CATEGORY_PRIORITY: [string, BucketId][] = [
  ["productivity", "work"],
  ["communication", "work"],
  ["memory", "work"],
  ["coding", "code"],
  ["browser", "code"],
  ["media", "code"],
  ["database", "data"],
  ["cloud", "infra"],
  ["devops", "infra"],
  ["analytics", "infra"],
  ["finance", "other"],
  ["api", "other"],
];

function bucketFor(categories: readonly string[]): BucketId {
  for (const [category, bucket] of CATEGORY_PRIORITY) {
    if (categories.includes(category)) return bucket;
  }
  return "other";
}

export const metadata: Metadata = {
  title: "MCP Server Setup Guides — Verified, Hand-Written | MyMCPTools",
  description:
    "Hand-written setup guides for the most-installed MCP servers: the exact commands, the auth that trips people up, and what breaks on first run. Every command read from the project's own docs, with the date it was checked.",
  alternates: { canonical: "https://mymcptools.com/guides" },
  openGraph: {
    title: "MCP Server Setup Guides | MyMCPTools",
    description:
      "Verified setup guides for the most-installed MCP servers — real commands, real gotchas, dated sources.",
    type: "website",
    url: "https://mymcptools.com/guides",
  },
};

export default function GuidesPage() {
  // Newest verification first: a setup guide's value decays, and the ordering
  // should make that visible rather than hide it behind alphabetical order.
  const entries = serverGuides
    .map((guide) => ({ guide, server: getServerBySlug(guide.slug) }))
    .filter((entry): entry is { guide: (typeof serverGuides)[number]; server: NonNullable<ReturnType<typeof getServerBySlug>> } => Boolean(entry.server))
    .sort((a, b) => b.guide.verifiedOn.localeCompare(a.guide.verifiedOn));

  // Recency ordering survives inside each group, so `entries` order carries.
  const grouped = BUCKETS.map((bucket) => ({
    bucket,
    items: entries.filter(
      (entry) => bucketFor(entry.server.categories ?? []) === bucket.id
    ),
  })).filter((group) => group.items.length > 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "MCP server setup guides",
    description:
      "Hand-written, source-verified setup guides for individual MCP servers.",
    url: "https://mymcptools.com/guides",
    numberOfItems: entries.length,
    itemListElement: entries.map((entry, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${entry.server.name} setup guide`,
      url: `https://mymcptools.com/servers/${entry.guide.slug}`,
    })),
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
        <nav className="mb-8 text-sm text-gray-500">
          <Link href="/" className="transition hover:text-gray-300">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-400">Guides</span>
        </nav>

        <h1 className="text-3xl font-bold text-white sm:text-4xl">
          MCP server setup guides
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-gray-400">
          A catalog entry tells you a server exists. It does not tell you which of the
          three servers with that name you want, what to paste where, or which step
          silently fails and leaves you with a tool that returns nothing. These guides
          do, one server at a time.
        </p>
        <p className="mt-4 leading-relaxed text-gray-500">
          Every command, environment variable, tool name and endpoint in them was read
          from the project&rsquo;s own README or documentation, and each guide carries the
          date that reading happened and links to the sources. There is no generator
          behind this page: a setup guide with invented steps is worse than no guide,
          because the reader finds out by pasting it into a terminal.
        </p>

        <nav className="mt-8 flex flex-wrap gap-2 text-sm">
          {grouped.map(({ bucket, items }) => (
            <a
              key={bucket.id}
              href={`#${bucket.id}`}
              className="rounded-full border border-gray-800 px-3 py-1.5 text-gray-400 transition hover:border-blue-500/40 hover:text-blue-300"
            >
              {bucket.title}
              <span className="ml-2 text-gray-600">{items.length}</span>
            </a>
          ))}
        </nav>

        {grouped.map(({ bucket, items }) => (
          <section key={bucket.id} id={bucket.id} className="mt-12 scroll-mt-8">
            <h2 className="text-xl font-semibold text-white">{bucket.title}</h2>
            {bucket.blurb && (
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                {bucket.blurb}
              </p>
            )}

            <div className="mt-5 space-y-4">
              {items.map(({ guide, server }) => {
                const questions = guide.gotchas?.slice(0, 2) ?? [];
                return (
                  <Link
                    key={guide.slug}
                    href={`/servers/${guide.slug}`}
                    className="block rounded-xl border border-gray-800 bg-gray-900/60 p-6 transition hover:border-blue-500/40 hover:bg-gray-900"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 className="text-lg font-semibold text-white">{server.name}</h3>
                      <span className="text-xs text-gray-500">
                        sources re-read {guide.verifiedOn}
                      </span>
                    </div>

                    {guide.intro && (
                      <p className="mt-3 leading-relaxed text-gray-400">{guide.intro}</p>
                    )}

                    {questions.length > 0 && (
                      <ul className="mt-4 space-y-1.5">
                        {questions.map((gotcha) => (
                          <li key={gotcha.question} className="text-sm text-gray-500">
                            <span className="mr-2 text-blue-400/70">&rarr;</span>
                            {gotcha.question}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">
                      {guide.setup && (
                        <span className="rounded-full border border-gray-800 px-2.5 py-1">
                          {guide.setup.steps.length}-step setup
                        </span>
                      )}
                      {guide.tools && (
                        <span className="rounded-full border border-gray-800 px-2.5 py-1">
                          {guide.tools.items.length} tools documented
                        </span>
                      )}
                      {guide.gotchas && (
                        <span className="rounded-full border border-gray-800 px-2.5 py-1">
                          {guide.gotchas.length} gotchas
                        </span>
                      )}
                      {guide.comparison && (
                        <span className="rounded-full border border-gray-800 px-2.5 py-1">
                          which one to pick
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        <p className="mt-12 text-sm leading-relaxed text-gray-500">
          Guides are written one at a time and only for servers where the choice is
          genuinely confusing or the setup genuinely bites. Every other server in the
          directory still has its catalog entry &mdash;{" "}
          <Link href="/search" className="text-blue-400 transition hover:text-blue-300">
            search all servers
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
