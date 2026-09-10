"use client";

/**
 * First-party analytics beacon. One fire-and-forget POST per pageview,
 * including client-side route changes. Ported from aisotools by thread #220.
 *
 * The `site` is NOT sent from here — `/api/collect` fixes it server-side so an
 * open collector cannot be used to write rows under another property's name.
 *
 * Deliberately does NOT use useSearchParams() — that forces a CSR bailout and
 * breaks static generation unless every consumer wraps it in <Suspense>. We
 * read window.location.search inside the effect instead.
 *
 * Everything is wrapped in try/catch: this must never throw into the page.
 */
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export default function AnalyticsBeacon() {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;

      const key = window.location.pathname + window.location.search;
      if (lastSent.current === key) return; // guard double-fire in StrictMode
      lastSent.current = key;

      const qs = new URLSearchParams(window.location.search);
      const nav = window.navigator as Navigator & { webdriver?: boolean };

      const payload = {
        path: window.location.pathname,
        ref: document.referrer || null,
        utm_source: qs.get("utm_source"),
        utm_medium: qs.get("utm_medium"),
        utm_campaign: qs.get("utm_campaign"),
        sw: window.screen ? window.screen.width : null,
        wd: nav.webdriver === true,
        hc: typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null,
      };

      const body = JSON.stringify(payload);
      const url = "/api/collect";

      if (typeof nav.sendBeacon === "function") {
        nav.sendBeacon(url, new Blob([body], { type: "application/json" }));
      } else {
        void fetch(url, {
          method: "POST",
          body,
          keepalive: true,
          headers: { "content-type": "application/json" },
        }).catch(() => {});
      }
    } catch {
      /* never break the page */
    }
  }, [pathname]);

  return null;
}
