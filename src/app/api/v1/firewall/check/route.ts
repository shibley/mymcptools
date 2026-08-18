import { NextRequest, NextResponse } from "next/server";
import { authenticate, withRateLimitHeaders } from "@/lib/api/auth";
import { ECOSYSTEMS, type Ecosystem } from "@/lib/firewall/types";
import { MAX_PACKAGES_PER_REQUEST, scanPackages } from "@/lib/firewall/scan";
import { corpusGeneratedAt, corpusSize } from "@/lib/firewall/corpus-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/firewall/check — Agent Dependency Firewall verification.
//
// Body: { "ecosystem": "npm" | "pypi", "packages": string[] }
//
// Returns a verdict per name (EXISTS / NONEXISTENT / SLOPSQUAT_RISK / UNKNOWN)
// with the registry evidence behind it, so a CI job can fail a build on a
// dependency an agent invented. Answers come from the committed corpus when the
// row is fresh, and from a live registry request otherwise — `from_corpus` on
// each result says which, and every result carries the exact `registry_url`
// that produced it.
//
// This is the authenticated, machine-facing endpoint (same key + rate-limit
// contract as the rest of /api/v1). The public /firewall page uses the separate
// unauthenticated /api/firewall/scan endpoint with a tighter per-IP limit.
export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const res = NextResponse.json(
      { error: "invalid_json", message: "Request body must be JSON." },
      { status: 400 }
    );
    return withRateLimitHeaders(res, auth.rate);
  }

  const { ecosystem, packages } = (body ?? {}) as {
    ecosystem?: unknown;
    packages?: unknown;
  };

  if (typeof ecosystem !== "string" || !ECOSYSTEMS.includes(ecosystem as Ecosystem)) {
    const res = NextResponse.json(
      {
        error: "invalid_ecosystem",
        message: `"ecosystem" must be one of: ${ECOSYSTEMS.join(", ")}.`,
      },
      { status: 400 }
    );
    return withRateLimitHeaders(res, auth.rate);
  }

  if (!Array.isArray(packages) || packages.length === 0) {
    const res = NextResponse.json(
      {
        error: "invalid_packages",
        message: '"packages" must be a non-empty array of package names.',
      },
      { status: 400 }
    );
    return withRateLimitHeaders(res, auth.rate);
  }

  if (packages.length > MAX_PACKAGES_PER_REQUEST) {
    const res = NextResponse.json(
      {
        error: "too_many_packages",
        message: `At most ${MAX_PACKAGES_PER_REQUEST} package names per request.`,
      },
      { status: 400 }
    );
    return withRateLimitHeaders(res, auth.rate);
  }

  const names = packages
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => p.trim());

  if (names.length === 0) {
    const res = NextResponse.json(
      {
        error: "invalid_packages",
        message: '"packages" contained no usable strings.',
      },
      { status: 400 }
    );
    return withRateLimitHeaders(res, auth.rate);
  }

  const scan = await scanPackages(names, ecosystem as Ecosystem);

  const res = NextResponse.json({
    ...scan,
    corpus: {
      size: corpusSize(),
      generated_at: corpusGeneratedAt(),
    },
  });
  return withRateLimitHeaders(res, auth.rate);
}
