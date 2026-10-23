"use client";

import { useEffect, useState } from "react";
import { listingOutboundRel } from "@/lib/outbound-rel";

/**
 * Featured badge for a catalog listing a maker paid to feature through the
 * maker door after this page was prerendered. Renders nothing until the
 * warehouse says the order exists.
 *
 * It also qualifies the page's own outbound links: the prerendered anchors
 * were built from the static row, which carries no paid flag, so without this
 * a maker-door Featured page would serve a followed paid link. Paid links are
 * rel="sponsored nofollow" (outbound-rel.ts).
 */
export default function PaidFeaturedBadge({ slug }: { slug: string }) {
  const [featured, setFeatured] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(`/api/listing-status/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!live || j?.featured !== true) return;
        setFeatured(true);
        document.querySelectorAll(`a[data-outbound-slug="${CSS.escape(slug)}"]`).forEach((a) => {
          a.setAttribute("rel", listingOutboundRel({ paid_placement: true }));
        });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [slug]);
  if (!featured) return null;
  return (
    <span className="px-2 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium rounded-full">
      ⭐ Featured
    </span>
  );
}
