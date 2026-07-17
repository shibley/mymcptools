// Embeddable SVG status badge generator (PRD P2-1 "verified live" badge
// foundation). Renders a shields.io-style flat badge for a server's live MCP
// verdict so authors can drop `![status](…/badge)` into a README and get a
// self-updating trust signal that links back to mymcptools. Pure/no-deps: the
// SVG is generated from the committed current_status, no runtime image service.

import type { Verdict } from "@/lib/trust/types";

export type BadgeState = Verdict | "UNKNOWN";

interface BadgeStyle {
  /** Right-side fill colour. */
  color: string;
  /** Default right-side text when no explicit message is given. */
  message: string;
}

// Palette mirrors the /status page verdict accents (GitHub-dark friendly).
const STATES: Record<BadgeState, BadgeStyle> = {
  GOOD: { color: "#3fb950", message: "live" },
  WARN: { color: "#d29922", message: "limited" },
  AUTH_REQUIRED: { color: "#3b82f6", message: "auth required" },
  DOWN: { color: "#f85149", message: "down" },
  UNKNOWN: { color: "#9f9f9f", message: "unknown" },
};

/** Map a raw verdict (or missing status) to a badge state. */
export function badgeStateFor(verdict: Verdict | null | undefined): BadgeState {
  if (verdict === "GOOD" || verdict === "WARN" || verdict === "DOWN") {
    return verdict;
  }
  if (verdict === "AUTH_REQUIRED") return "AUTH_REQUIRED";
  return "UNKNOWN";
}

// Per-character advance widths (Verdana 11px, in 1/10 px units) — the same
// approach shields.io uses so text is well-centred without a font engine.
// Covers printable ASCII; anything else falls back to the width of 'm'.
const CHAR_WIDTHS: Record<string, number> = {
  " ": 35.5, "!": 39.15, '"': 50.11, "#": 91.87, $: 70.35, "%": 116.6,
  "&": 84.86, "'": 27.44, "(": 46.86, ")": 46.86, "*": 58.62, "+": 91.87,
  ",": 35.5, "-": 41.9, ".": 35.5, "/": 45.28, "0": 70.35, "1": 70.35,
  "2": 70.35, "3": 70.35, "4": 70.35, "5": 70.35, "6": 70.35, "7": 70.35,
  "8": 70.35, "9": 70.35, ":": 45.28, ";": 45.28, "<": 91.87, "=": 91.87,
  ">": 91.87, "?": 58.62, "@": 116.79, A: 77.98, B: 78.02, C: 79.9,
  D: 87.71, E: 71.16, F: 65.03, G: 87.7, H: 85.86, I: 44.59, J: 44.59,
  K: 78.4, L: 65.94, M: 96.6, N: 85.86, O: 89.7, P: 71.94, Q: 89.7,
  R: 80.94, S: 76.83, T: 71.16, U: 84.14, V: 77.98, W: 110.48, X: 77.98,
  Y: 71.16, Z: 76.83, "[": 46.86, "\\": 45.28, "]": 46.86, "^": 91.87,
  _: 58.62, "`": 58.62, a: 68.78, b: 71.87, c: 61.53, d: 71.87, e: 68.34,
  f: 39.72, g: 71.87, h: 71.87, i: 30.83, j: 30.83, k: 65.32, l: 30.83,
  m: 109.86, n: 71.87, o: 70.55, p: 71.87, q: 71.87, r: 47.35, s: 58.06,
  t: 43.6, u: 71.87, v: 65.32, w: 94.8, x: 65.32, y: 65.32, z: 58.06,
  "{": 70.55, "|": 45.28, "}": 70.55, "~": 91.87,
};

const FALLBACK = CHAR_WIDTHS.m;

/** Estimated rendered width (px) of a string at 11px Verdana. */
function textWidth(text: string): number {
  let total = 0;
  for (const ch of text) total += (CHAR_WIDTHS[ch] ?? FALLBACK) / 10;
  return total;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface BadgeOptions {
  /** Left-side label. Defaults to "mcp". */
  label?: string;
  /** Right-side text. Defaults to the state's canonical message. */
  message?: string;
  /** Verdict state driving the right-side colour. */
  state: BadgeState;
}

const LABEL_BG = "#555";
const H = 20; // badge height
const PAD = 5; // horizontal padding each side of a text run
const FONT_Y = 15; // baseline for the visible text
const SHADOW_Y = 15; // baseline for the drop-shadow text

/**
 * Render a shields.io-style flat SVG badge. Deterministic and dependency-free,
 * so it can be served straight from an edge/serverless route as
 * `image/svg+xml`.
 */
export function renderBadge({ label = "mcp", message, state }: BadgeOptions): string {
  const style = STATES[state] ?? STATES.UNKNOWN;
  const msg = message ?? style.message;

  const labelText = label.slice(0, 40);
  const msgText = msg.slice(0, 40);

  const labelW = Math.round(textWidth(labelText) + PAD * 2);
  const msgW = Math.round(textWidth(msgText) + PAD * 2);
  const totalW = labelW + msgW;

  const labelX = labelW / 2;
  const msgX = labelW + msgW / 2;

  const title = `${labelText}: ${msgText}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalW}" height="${H}" role="img" aria-label="${escapeXml(title)}">
  <title>${escapeXml(title)}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${totalW}" height="${H}" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="${H}" fill="${LABEL_BG}"/>
    <rect x="${labelW}" width="${msgW}" height="${H}" fill="${style.color}"/>
    <rect width="${totalW}" height="${H}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelX}" y="${SHADOW_Y}" fill="#010101" fill-opacity=".3">${escapeXml(labelText)}</text>
    <text x="${labelX}" y="${FONT_Y}">${escapeXml(labelText)}</text>
    <text x="${msgX}" y="${SHADOW_Y}" fill="#010101" fill-opacity=".3">${escapeXml(msgText)}</text>
    <text x="${msgX}" y="${FONT_Y}">${escapeXml(msgText)}</text>
  </g>
</svg>`;
}
