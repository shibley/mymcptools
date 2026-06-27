// Dependency-free inline-SVG uptime sparkline (PRD P1-2). Renders the trailing
// probe history as one small vertical bar per probe, colored by verdict using
// the same palette as StatusBadge. Pure/presentational: the server component
// loads history via getHistory(slug) and passes it in. Renders nothing when
// there is no usable (non-UNPROBEABLE) history, so listings stay clean.

import type { HistoryPoint } from "@/lib/trust/history-store";
import type { Verdict } from "@/lib/trust/types";

// Fill colors mirror StatusBadge's dot palette. UNPROBEABLE bars are dropped
// entirely (no signal to show), so it has no entry here.
const BAR_FILL: Record<Exclude<Verdict, "UNPROBEABLE">, string> = {
  GOOD: "#4ade80", // green-400
  WARN: "#fbbf24", // amber-400
  AUTH_REQUIRED: "#60a5fa", // blue-400
  DOWN: "#f87171", // red-400
};

export function UptimeSparkline({
  history,
  className,
}: {
  history: readonly HistoryPoint[];
  className?: string;
}) {
  const points = history.filter((p) => p.verdict !== "UNPROBEABLE");
  if (points.length === 0) return null;

  const healthy = points.filter((p) => p.verdict === "GOOD").length;
  const uptimePct = Math.round((healthy / points.length) * 100);

  const barW = 6;
  const gap = 2;
  const height = 28;
  const width = points.length * barW + (points.length - 1) * gap;

  const label = `Uptime ${uptimePct}% over the last ${points.length} check${
    points.length === 1 ? "" : "s"
  }`;

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      {points.map((p, i) => (
        <rect
          key={`${p.checked_at}-${i}`}
          x={i * (barW + gap)}
          y={0}
          width={barW}
          height={height}
          rx={1}
          fill={BAR_FILL[p.verdict as Exclude<Verdict, "UNPROBEABLE">]}
        />
      ))}
    </svg>
  );
}
