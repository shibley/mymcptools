"use client";

// Drop-in for `next/link`: app code imports Link from "@/lib/intent-link".
// (Turbopack ignores a resolveAlias on next/link, so the imports were rewritten.)
//
// Why: the stock <Link> prefetches every link that scrolls within 200px of the
// viewport. A page load fired 38-68 RSC prefetch requests (Playwright,
// 2026-11-05; 17-51% of logged production requests). Each
// one is a billed Vercel CDN request (and a function invocation on dynamic
// routes), whether or not anyone clicks. This keeps prefetching, but only on
// intent: mouse hover or touch start, which still lands before the click.
//
// An explicit `prefetch={true}` / `prefetch={false}` on a Link is honoured as
// written; only the default (unset / null / "auto") is switched to intent.
import NextLink, { useLinkStatus } from "next/link";
// Read the router context directly rather than via useRouter(), which throws
// when a Link renders outside the app router (renderToString in tests, email
// templates). With no router the Link simply renders without intent prefetch.
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useContext, type ComponentProps } from "react";

export { useLinkStatus };

type LinkProps = ComponentProps<typeof NextLink>;

function internalHref(href: LinkProps["href"]): string | null {
  let s: string | null = null;
  if (typeof href === "string") {
    s = href;
  } else if (href && typeof href === "object") {
    const pathname = href.pathname ?? "";
    let search = href.search ?? "";
    if (!search && href.query && typeof href.query === "object") {
      const qs = new URLSearchParams(
        Object.entries(href.query).flatMap(([k, v]) =>
          v == null ? [] : Array.isArray(v) ? v.map((x) => [k, String(x)]) : [[k, String(v)]],
        ),
      ).toString();
      search = qs ? `?${qs}` : "";
    }
    s = pathname ? `${pathname}${search}` : null;
  }
  if (!s || !s.startsWith("/") || s.startsWith("//")) return null;
  return s;
}

export default function Link(props: LinkProps) {
  const router = useContext(AppRouterContext);
  const { prefetch, onMouseEnter, onTouchStart, legacyBehavior, ...rest } = props;
  if (legacyBehavior || (prefetch !== undefined && prefetch !== null && prefetch !== "auto")) {
    return <NextLink {...props} />;
  }
  const target = internalHref(props.href);
  const warm = () => {
    if (target && router) router.prefetch(target);
  };
  return (
    <NextLink
      {...rest}
      prefetch={false}
      onMouseEnter={(e) => {
        onMouseEnter?.(e);
        warm();
      }}
      onTouchStart={(e) => {
        onTouchStart?.(e);
        warm();
      }}
    />
  );
}
