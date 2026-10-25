import { NextRequest, NextResponse } from "next/server";
import { authenticateOpen } from "@/lib/api/auth";
import { finishFreeTier } from "@/lib/analytics/trust-api-usage";
import { allStatuses, generatedAt, summary } from "@/lib/trust/status-store";
import { proPointer } from "@/lib/api/pro-pointer";
import {
  INSTALLABLE_FILTERS,
  SIGNAL_FILTERS,
  installSummary,
  matchesInstallableFilter,
  matchesSignalFilter,
  parseInstallableFilter,
  parseSignalFilter,
  signalSummary,
  withStaticSignals,
} from "@/lib/api/status-view";
import type { ApiStatusRow } from "@/lib/api/status-view";
import type { CurrentStatus, Verdict } from "@/lib/trust/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** filter=healthy keeps only servers currently serving (GOOD or WARN). */
const HEALTHY: ReadonlySet<Verdict> = new Set<Verdict>(["GOOD", "WARN"]);

function parseLimit(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function parseOffset(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

// GET /api/v1/status — paginated current_status list (PRD P0-7).
// Query params: filter=healthy, signal=<freshness>, installable=yes|no|unknown,
// updated_since=<ISO>, limit (<=200), cursor|offset.
//
// Every row carries `static_signal` (PRD P1-3): for the 2,396 local/stdio
// servers the handshake prober records UNPROBEABLE, the repo sweep supplies a
// last-commit / last-release date and a freshness bucket. It also carries
// `install_signal`, the registry lookup for the package the install command
// names — which covers the 1,424 entries that have no repo URL at all, and
// reports the hard negative when the named package does not exist. See
// status-view.ts.
export async function GET(req: NextRequest) {
  const auth = await authenticateOpen(req);
  if (!auth.ok) return auth.response;

  const q = req.nextUrl.searchParams;
  const limit = parseLimit(q.get("limit"));
  // `cursor` is an opaque offset; accept either name for ergonomics.
  const offset = parseOffset(q.get("cursor") ?? q.get("offset"));

  const filterHealthy = q.get("filter") === "healthy";

  let updatedSince: number | null = null;
  const updatedSinceRaw = q.get("updated_since");
  if (updatedSinceRaw) {
    const t = Date.parse(updatedSinceRaw);
    if (Number.isNaN(t)) {
      const res = NextResponse.json(
        {
          error: "bad_request",
          message: "updated_since must be an ISO-8601 timestamp.",
        },
        { status: 400 }
      );
      return finishFreeTier(req, "/api/v1/status", auth, res);
    }
    updatedSince = t;
  }

  const signalFilter = parseSignalFilter(q.get("signal"));
  if (signalFilter === undefined) {
    const res = NextResponse.json(
      {
        error: "bad_request",
        message: `signal must be one of: ${SIGNAL_FILTERS.join(", ")}.`,
      },
      { status: 400 }
    );
    return finishFreeTier(req, "/api/v1/status", auth, res);
  }

  const installableFilter = parseInstallableFilter(q.get("installable"));
  if (installableFilter === undefined) {
    const res = NextResponse.json(
      {
        error: "bad_request",
        message: `installable must be one of: ${INSTALLABLE_FILTERS.join(", ")}.`,
      },
      { status: 400 }
    );
    return finishFreeTier(req, "/api/v1/status", auth, res);
  }

  let base: readonly CurrentStatus[] = allStatuses();
  if (filterHealthy) base = base.filter((s) => HEALTHY.has(s.verdict));
  if (updatedSince !== null) {
    base = base.filter((s) => {
      const checked = Date.parse(s.checked_at);
      return !Number.isNaN(checked) && checked >= updatedSince!;
    });
  }

  // `signal_summary` is taken BEFORE the signal filter, so it always describes
  // the freshness mix available under the other filters rather than tautologically
  // restating the one bucket the caller asked for.
  const joined: readonly ApiStatusRow[] = withStaticSignals(base);
  const signals = signalSummary(joined);
  const installs = installSummary(joined);
  let rows: readonly ApiStatusRow[] = joined;
  if (signalFilter !== null) {
    rows = rows.filter((r) => matchesSignalFilter(r, signalFilter));
  }
  if (installableFilter !== null) {
    rows = rows.filter((r) => matchesInstallableFilter(r, installableFilter));
  }

  const total = rows.length;
  const page = rows.slice(offset, offset + limit);
  const nextOffset = offset + limit;
  const nextCursor = nextOffset < total ? String(nextOffset) : null;

  const res = NextResponse.json({
    generated_at: generatedAt(),
    summary: summary(),
    signal_summary: signals,
    install_summary: installs,
    pagination: {
      total,
      limit,
      offset,
      next_cursor: nextCursor,
    },
    statuses: page,
    pro: proPointer("status"),
  });
  return finishFreeTier(req, "/api/v1/status", auth, res);
}
