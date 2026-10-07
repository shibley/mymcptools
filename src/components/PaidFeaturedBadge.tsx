"use client";

import { useEffect, useState } from "react";

/**
 * Featured badge for a catalog listing a maker paid to feature through the
 * maker door after this page was prerendered. Renders nothing until the
 * warehouse says the order exists.
 */
export default function PaidFeaturedBadge({ slug }: { slug: string }) {
  const [featured, setFeatured] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(`/api/listing-status/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && j?.featured === true && setFeatured(true))
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
