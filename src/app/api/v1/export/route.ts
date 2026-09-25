import { NextRequest, NextResponse } from "next/server";
import { withRateLimitHeaders } from "@/lib/api/auth";
import { authenticateGated } from "@/lib/analytics/trust-api-usage";
import { allStatuses, generatedAt, summary } from "@/lib/trust/status-store";
import { installSummary, signalSummary, withStaticSignals } from "@/lib/api/status-view";
import type { ApiStatusRow } from "@/lib/api/status-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Flat columns for the CSV export — a stable scalar projection of a joined row.
 * The four `static_*` columns are flattened out of `static_signal` so the CSV
 * carries a freshness date for the ~900 local/stdio servers whose live-probe
 * columns are necessarily empty (PRD P1-3).
 */
const CSV_COLUMNS: ReadonlyArray<keyof ApiStatusRow> = [
  "slug",
  "verdict",
  "tool_count",
  "latency_ms",
  "negotiated_protocol_version",
  "remote_endpoint",
  "transport",
  "last_seen_good_at",
  "checked_at",
  "status_changed_at",
  "schema_changed",
  "schema_changed_at",
  "failure_reason",
  "auth_server_url",
];

/**
 * The `static_signal` and `install_signal` fields flattened into CSV columns.
 * `install_*` is what a spreadsheet consumer needs for the 1,424 entries with
 * no repo URL — and `install_exists=false` is a fact in its own right, so the
 * column is populated even when there is no date to go with it.
 */
const CSV_SIGNAL_COLUMNS = [
  "static_freshness",
  "static_last_commit_at",
  "static_last_release_at",
  "static_repo_url",
  "install_registry",
  "install_package",
  "install_exists",
  "install_last_published_at",
] as const;

function signalCells(row: ApiStatusRow): ReadonlyArray<unknown> {
  const s = row.static_signal;
  const i = row.install_signal;
  return [
    s?.freshness ?? null,
    s?.last_commit_at ?? null,
    s?.last_release_at ?? null,
    s?.repo_url ?? null,
    i?.registry ?? null,
    i?.package ?? null,
    i ? String(i.exists) : null,
    i?.last_published_at ?? null,
  ];
}

/** RFC-4180 field escaping: quote when the value contains "," `"` or newline. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: readonly ApiStatusRow[]): string {
  const header = [...CSV_COLUMNS, ...CSV_SIGNAL_COLUMNS].join(",");
  const lines = rows.map((row) =>
    [
      ...CSV_COLUMNS.map((col) => csvCell(row[col])),
      ...signalCells(row).map(csvCell),
    ].join(",")
  );
  return [header, ...lines].join("\r\n");
}

// GET /api/v1/export?format=json|csv — full status dataset bulk export (PRD P0-7).
export async function GET(req: NextRequest) {
  const auth = await authenticateGated(req, "/api/v1/export");
  if (!auth.ok) return auth.response;

  const format = (req.nextUrl.searchParams.get("format") ?? "json").toLowerCase();
  const rows = withStaticSignals(allStatuses());
  const stamp = generatedAt().slice(0, 10);

  if (format === "csv") {
    const res = new NextResponse(toCsv(rows), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="mcptools-status-${stamp}.csv"`,
      },
    });
    return withRateLimitHeaders(res, auth.rate);
  }

  if (format !== "json") {
    const res = NextResponse.json(
      { error: "bad_request", message: "format must be 'json' or 'csv'." },
      { status: 400 }
    );
    return withRateLimitHeaders(res, auth.rate);
  }

  const res = NextResponse.json(
    {
      generated_at: generatedAt(),
      summary: summary(),
      signal_summary: signalSummary(rows),
      install_summary: installSummary(rows),
      count: rows.length,
      statuses: rows,
    },
    {
      headers: {
        "Content-Disposition": `attachment; filename="mcptools-status-${stamp}.json"`,
      },
    }
  );
  return withRateLimitHeaders(res, auth.rate);
}
