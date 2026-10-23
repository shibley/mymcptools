import type { Metadata } from "next";
import Link from "next/link";
import { categories, getServerBySlug } from "@/data/servers";
import { FEATURED_PRICE } from "@/lib/featured-price";
import { mediaKitNumbers, type CategoryCount } from "@/lib/media-kit";

/**
 * One-page media kit (research-mcpso-vs-mymcptools-2026-10-22, gap #5).
 * Every number is read live from the first-party warehouse by
 * src/lib/media-kit.ts and re-measured at most once a day; the measurement
 * time is printed with them. Small numbers are printed as small numbers.
 */
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Media Kit — Audience Numbers for Featured Listings | MyMCPTools",
  description:
    "First-party audience numbers for mymcptools.com, bots removed: monthly visitors, category-page traffic, and what a Featured listing gets.",
  alternates: { canonical: "https://mymcptools.com/media-kit" },
};

const NAMES = new Map(categories.map((c) => [c.slug, c.name]));
const fmt = (n: number) => n.toLocaleString("en-US");

function CountList({ rows, empty }: { rows: CategoryCount[]; empty: string }) {
  if (!rows.length) return <p className="text-gray-500 text-sm">{empty}</p>;
  return (
    <ol className="space-y-1 text-sm">
      {rows.map((r) => (
        <li key={r.slug} className="flex justify-between gap-4 border-b border-gray-800 py-1.5">
          <Link href={`/category/${r.slug}`} className="text-blue-400 hover:text-blue-300">
            {NAMES.get(r.slug) ?? r.slug}
          </Link>
          <span className="text-gray-300 tabular-nums">{fmt(r.sessions)}</span>
        </li>
      ))}
    </ol>
  );
}

export default async function MediaKitPage() {
  const k = await mediaKitNumbers(
    (slug) => getServerBySlug(slug)?.categories[0],
    (slug) => NAMES.has(slug)
  );
  const measured = k
    ? new Date(k.measuredAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC"
    : null;
  const botShare = k && k.humanPageviews + k.botPageviews > 0
    ? Math.round((100 * k.botPageviews) / (k.humanPageviews + k.botPageviews))
    : null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Media kit</h1>
      <p className="text-gray-400 mb-8">
        What a listing on MyMCPTools is seen by, from our own cookieless analytics. We publish this so you can decide
        whether {FEATURED_PRICE} is worth it before you pay, not after.
      </p>

      {!k ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-gray-400">
          Our analytics store couldn&apos;t be read just now, so there are no numbers on this page rather than stale or
          guessed ones. Try again later, or email{" "}
          <a href="mailto:shibley@apistatuscheck.com" className="text-blue-400">shibley@apistatuscheck.com</a>.
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-4">
            Measured {measured} · last {k.days} days · bots removed
          </p>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="text-2xl sm:text-3xl font-bold text-white tabular-nums">{fmt(k.humanSessions)}</div>
              <div className="text-xs sm:text-sm text-gray-400 mt-1">visitors (browser-days)</div>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="text-2xl sm:text-3xl font-bold text-white tabular-nums">{fmt(k.humanPageviews)}</div>
              <div className="text-xs sm:text-sm text-gray-400 mt-1">page views</div>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="text-2xl sm:text-3xl font-bold text-white tabular-nums">{fmt(k.categoryPageSessions)}</div>
              <div className="text-xs sm:text-sm text-gray-400 mt-1">visitors to category pages, where Featured sits</div>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="text-2xl sm:text-3xl font-bold text-white tabular-nums">{fmt(k.submissions)}</div>
              <div className="text-xs sm:text-sm text-gray-400 mt-1">servers submitted by makers</div>
            </div>
          </div>

          <div className="rounded-xl border border-yellow-800/60 bg-yellow-950/20 p-5 mb-8 text-sm text-gray-300 space-y-2">
            <p className="font-semibold text-yellow-300">The plain version</p>
            <p>
              These are small numbers. Most visitors land on one listing page and never open a
              category page, so the top-of-category slot is seen by about {fmt(k.categoryPageSessions)} people a month
              across every category combined. Your own listing page is where most of the value is.
            </p>
            {botShare !== null && (
              <p>
                {botShare}% of page views in this window were automated and are excluded above. Our bot filter misses
                some, so treat every number here as an upper bound.
              </p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-6 mb-10">
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">Top category pages</h2>
              <p className="text-xs text-gray-500 mb-3">Visitors in {k.days} days</p>
              <CountList rows={k.topCategoryPages} empty="No category-page visitors in this window." />
            </section>
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">Most-read listing categories</h2>
              <p className="text-xs text-gray-500 mb-3">Visitors to listing pages, by the listing&apos;s category</p>
              <CountList rows={k.topListingCategories} empty="No listing-page visitors in this window." />
            </section>
          </div>
        </>
      )}

      <section className="rounded-xl border border-gray-800 bg-gray-900 p-6 mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">Featured — {FEATURED_PRICE} one-time</h2>
        <ul className="space-y-2 text-sm text-gray-300">
          <li>⭐ Featured badge on your listing page</li>
          <li>✓ Top of your category page(s). There is no cap on Featured slots; if several share a category, the newest order is first.</li>
          <li>✓ Live the moment payment clears; we email you the exact pages it shows on</li>
          <li>✓ After 30 days, an email with clicks on your links and views of your listing</li>
          <li className="text-gray-400">
            Links to your site carry <code>rel=&quot;sponsored nofollow&quot;</code>, as Google requires for paid placements.
            Featured is not shown on the homepage, and it doesn&apos;t change your trust grade.
          </li>
        </ul>
        <Link
          href="/submit"
          className="mt-5 inline-block bg-yellow-600 hover:bg-yellow-500 text-white font-medium px-5 py-2.5 rounded-lg transition"
        >
          Get Featured
        </Link>
      </section>

      <p className="text-xs text-gray-500">
        How we count: a visitor is one browser on one UTC day (no cookies). Page views come from our own beacon;
        MCP and API calls, server-side events and anything our classifier flags as automated are excluded.
      </p>
    </div>
  );
}
