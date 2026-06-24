import { NextRequest, NextResponse } from "next/server";
import { authenticate, withRateLimitHeaders } from "@/lib/api/auth";
import { allStatuses, generatedAt, summary } from "@/lib/trust/status-store";
import type { CurrentStatus } from "@/lib/trust/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Flat columns for the CSV export — a stable scalar projection of CurrentStatus.
const CSV_COLUMNS: ReadonlyArray<keyof CurrentStatus> = [
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

/** RFC-4180 field escaping: quote when the value contains "," `"` or newline. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: readonly CurrentStatus[]): string {
  const header = CSV_COLUMNS.join(",");
  const lines = rows.map((row) =>
    CSV_COLUMNS.map((col) => csvCell(row[col])).join(",")
  );
  return [header, ...lines].join("\r\n");
}

// GET /api/v1/export?format=json|csv — full status dataset bulk export (PRD P0-7).
export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if (!auth.ok) return auth.response;

  const format = (req.nextUrl.searchParams.get("format") ?? "json").toLowerCase();
  const rows = allStatuses();
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
