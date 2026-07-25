import { NextRequest, NextResponse } from "next/server";
import { ECOSYSTEMS, type Ecosystem } from "@/lib/firewall/types";
import { parsePackageInput, scanPackages } from "@/lib/firewall/scan";
import { corpusGeneratedAt, corpusSize } from "@/lib/firewall/corpus-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/firewall/scan — public, unauthenticated backend for the /firewall
// page. Takes pasted text (a package.json, a requirements.txt, or a bare list)
// rather than a parsed array, because that is what a visitor has to hand.
//
// The authenticated machine-facing equivalent is POST /api/v1/firewall/check,
// which takes an explicit array and carries the standard v1 key + rate-limit
// contract. This one is the demo surface: same engine, per-IP throttle, no key.

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 20;
const MAX_BODY_CHARS = 100_000;

const buckets = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function underLimit(ip: string): boolean {
  const now = Date.now();
  const entry = buckets.get(ip);
  if (!entry || now > entry.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  if (!underLimit(clientIp(req))) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message:
          "Too many scans from this address. The authenticated Trust Data API has a higher allowance — see /developers.",
      },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Request body must be JSON." },
      { status: 400 }
    );
  }

  const { ecosystem, input } = (body ?? {}) as {
    ecosystem?: unknown;
    input?: unknown;
  };

  if (typeof ecosystem !== "string" || !ECOSYSTEMS.includes(ecosystem as Ecosystem)) {
    return NextResponse.json(
      {
        error: "invalid_ecosystem",
        message: `"ecosystem" must be one of: ${ECOSYSTEMS.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  if (typeof input !== "string" || !input.trim()) {
    return NextResponse.json(
      { error: "invalid_input", message: '"input" must be a non-empty string.' },
      { status: 400 }
    );
  }

  const names = parsePackageInput(input.slice(0, MAX_BODY_CHARS), ecosystem as Ecosystem);
  if (names.length === 0) {
    return NextResponse.json(
      {
        error: "no_packages_found",
        message:
          "No package names could be read from that input. Paste a package.json, a requirements.txt, or one name per line.",
      },
      { status: 400 }
    );
  }

  const scan = await scanPackages(names, ecosystem as Ecosystem);

  return NextResponse.json({
    ...scan,
    corpus: { size: corpusSize(), generated_at: corpusGeneratedAt() },
  });
}
