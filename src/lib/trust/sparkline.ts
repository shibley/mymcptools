// Historical uptime sparkline (PRD P1-2 "Historical uptime sparkline per listing").
//
// Turns a server's trailing probe history into a small, embeddable SVG that
// shows day-by-day uptime as a row of colored bars plus an overall uptime %.
// The companion to the single-verdict /badge endpoint: the badge answers "is it
// up right NOW?", the sparkline answers "how reliable has it BEEN?".
//
// Design constraints (matching the rest of the trust layer):
//   - Pure + dependency-free: deterministic SVG string from history points, no
//     I/O, no wall-clock (the caller passes the anchor date), no npm deps.
//   - STRICTLY READ-ONLY: consumes already-recorded probe history only.
//   - Graceful degradation: an unknown/never-probed slug still renders a valid,
//     correctly-sized SVG (all-gray "no data" bars) so an <img> never breaks.
//   - Uptime convention matches rolling-window.ts: a probe is "up" iff its
//     verdict is anything other than DOWN (GOOD / WARN / AUTH_REQUIRED all mean
//     the server answered the MCP handshake). DOWN is the only failure.

import type { Verdict } from "./types.ts";

/** One point of trailing probe history (mirrors history-store's HistoryPoint). */
export interface UptimeHistoryPoint {
  checked_at: string;
  verdict: Verdict;
}

/** Aggregated uptime for a single UTC calendar day. */
export interface UptimeDay {
  /** UTC date, YYYY-MM-DD. */
  date: string;
  /** Total probes recorded that day. */
  total: number;
  /** Probes that answered (verdict !== DOWN). */
  up: number;
  /** up/total as a 0..1 fraction, or null when no probes landed that day. */
  uptime: number | null;
}

export interface UptimeSparkline {
  /** Oldest→newest, exactly `days` entries (empty days included as no-data). */
  days: UptimeDay[];
  /** Overall up/total across the window as 0..1, or null when zero probes. */
  overall: number | null;
  /** Total probes in the window. */
  totalProbes: number;
  /** Number of days in the window that actually have probe data. */
  daysWithData: number;
}

/** A probe counts as "up" for uptime purposes unless it hard-failed (DOWN). */
function isUp(verdict: Verdict): boolean {
  return verdict !== "DOWN";
}

/** UTC calendar date (YYYY-MM-DD) of an ISO timestamp, or null if unparseable. */
function utcDate(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

/** Step a YYYY-MM-DD date string back by one UTC day. */
function prevDay(date: string): string {
  const t = Date.parse(`${date}T00:00:00Z`);
  return new Date(t - 86_400_000).toISOString().slice(0, 10);
}

/**
 * Aggregate probe history into a fixed-width daily uptime window.
 *
 * @param points  Probe history (any order; only checked_at + verdict are read).
 * @param days    Window width in days (clamped 1..90).
 * @param asOf    Anchor ISO timestamp — the window ends on this UTC date. Passed
 *                in (not read from the clock) so output is deterministic per
 *                dataset, consistent with the other trust endpoints anchoring to
 *                the dataset's generated_at.
 */
export function computeUptimeSparkline(
  points: readonly UptimeHistoryPoint[],
  days = 14,
  asOf?: string
): UptimeSparkline {
  const window = Math.max(1, Math.min(90, Math.floor(days) || 14));

  // Tally probes per UTC day.
  const tally = new Map<string, { total: number; up: number }>();
  let latestDate: string | null = null;
  for (const p of points) {
    if (!p || typeof p.checked_at !== "string" || typeof p.verdict !== "string") continue;
    const date = utcDate(p.checked_at);
    if (!date) continue;
    const bucket = tally.get(date) ?? { total: 0, up: 0 };
    bucket.total += 1;
    if (isUp(p.verdict)) bucket.up += 1;
    tally.set(date, bucket);
    if (latestDate === null || date > latestDate) latestDate = date;
  }

  // Anchor the window on the asOf date if given (and parseable), else on the
  // newest probe, else render an empty (all no-data) window.
  const anchor = (asOf ? utcDate(asOf) : null) ?? latestDate;

  const out: UptimeDay[] = [];
  let totalProbes = 0;
  let totalUp = 0;
  let daysWithData = 0;

  if (anchor === null) {
    // No probes and no anchor: a fixed-width run of no-data days (unknown dates).
    for (let i = 0; i < window; i++) {
      out.push({ date: "", total: 0, up: 0, uptime: null });
    }
    return { days: out, overall: null, totalProbes: 0, daysWithData: 0 };
  }

  // Walk newest→oldest from the anchor, then reverse to oldest→newest.
  let cursor = anchor;
  for (let i = 0; i < window; i++) {
    const bucket = tally.get(cursor);
    if (bucket && bucket.total > 0) {
      totalProbes += bucket.total;
      totalUp += bucket.up;
      daysWithData += 1;
      out.push({
        date: cursor,
        total: bucket.total,
        up: bucket.up,
        uptime: bucket.up / bucket.total,
      });
    } else {
      out.push({ date: cursor, total: 0, up: 0, uptime: null });
    }
    cursor = prevDay(cursor);
  }
  out.reverse();

  return {
    days: out,
    overall: totalProbes > 0 ? totalUp / totalProbes : null,
    totalProbes,
    daysWithData,
  };
}

// ---- SVG rendering --------------------------------------------------------

const BAR_UP = "#3fb950"; // green — >= 99% uptime that day
const BAR_WARN = "#d29922"; // amber — 90–99%
const BAR_DOWN = "#f85149"; // red — < 90%
const BAR_NODATA = "#30363d"; // faint gray — no probes that day
const TRACK = "#0d1117"; // dark card background
const TEXT = "#c9d1d9"; // light label text
const LABEL_BG = "#161b22"; // left label chip background

const BAR_W = 6;
const BAR_GAP = 2;
const BAR_MAX_H = 20;
const BAR_MIN_H = 2; // a probed day never renders as an invisible sliver
const CHART_PAD = 5;
const H = 30;
const FONT = "Verdana,Geneva,DejaVu Sans,sans-serif";

/** Bucket color by that day's uptime fraction (null → no-data gray). */
function barColor(uptime: number | null): string {
  if (uptime === null) return BAR_NODATA;
  if (uptime >= 0.99) return BAR_UP;
  if (uptime >= 0.9) return BAR_WARN;
  return BAR_DOWN;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Round to at most one decimal, dropping a trailing ".0". */
function pct(fraction: number): string {
  const v = Math.round(fraction * 1000) / 10;
  return Number.isInteger(v) ? `${v}` : v.toFixed(1);
}

export interface SparklineRenderOptions {
  sparkline: UptimeSparkline;
  /** Left-hand label chip text (default "uptime"). */
  label?: string;
}

/**
 * Render an embeddable uptime sparkline as an SVG string. Layout: a left label
 * chip ("uptime NN%"), then one bar per day (oldest→newest) colored by that
 * day's uptime, no-data days shown as faint gray full-height ticks.
 */
export function renderUptimeSparkline({
  sparkline,
  label = "uptime",
}: SparklineRenderOptions): string {
  const { days, overall } = sparkline;

  const labelText = String(label).slice(0, 24);
  const pctText = overall === null ? "n/a" : `${pct(overall)}%`;
  const chipText = `${labelText} ${pctText}`;

  // Monospace-ish estimate is fine for a chip; Verdana ~6.2px/char at 11px.
  const chipW = Math.round(chipText.length * 6.2 + CHART_PAD * 2);

  const chartX = chipW;
  const chartW = days.length * (BAR_W + BAR_GAP) - BAR_GAP + CHART_PAD * 2;
  const totalW = chartX + chartW;

  const baseline = H - CHART_PAD; // bars grow upward from here

  const bars = days
    .map((d, i) => {
      const x = chartX + CHART_PAD + i * (BAR_W + BAR_GAP);
      // No-data days render a faint full-height tick; probed days scale by uptime.
      const h =
        d.uptime === null
          ? BAR_MAX_H
          : Math.max(BAR_MIN_H, Math.round(d.uptime * BAR_MAX_H));
      const y = baseline - h;
      const color = barColor(d.uptime);
      const titleDate = d.date || "no data";
      const titleVal = d.uptime === null ? "no probes" : `${pct(d.uptime)}% (${d.up}/${d.total})`;
      return `<rect x="${x}" y="${y}" width="${BAR_W}" height="${h}" rx="1" fill="${color}"><title>${escapeXml(
        `${titleDate}: ${titleVal}`
      )}</title></rect>`;
    })
    .join("");

  const ariaLabel = `${labelText}: ${pctText} over ${days.length} days`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${H}" role="img" aria-label="${escapeXml(
    ariaLabel
  )}">
  <title>${escapeXml(ariaLabel)}</title>
  <rect width="${totalW}" height="${H}" rx="3" fill="${TRACK}"/>
  <rect width="${chipW}" height="${H}" rx="3" fill="${LABEL_BG}"/>
  <rect x="${chipW - 3}" width="3" height="${H}" fill="${LABEL_BG}"/>
  <text x="${CHART_PAD}" y="${H / 2 + 4}" font-family="${FONT}" font-size="11" fill="${TEXT}">${escapeXml(
    chipText
  )}</text>
  <g>${bars}</g>
</svg>`;
}
