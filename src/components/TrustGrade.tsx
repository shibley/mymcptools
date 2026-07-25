// Presentational trust-grade chips. No hooks, no data access — safe to render
// from a server component or pull into the client bundle from the registry
// table. Every visual difference here maps to a real distinction in the model:
// a grade is a measured thing, and the two non-grades look deliberately unlike
// a grade so they can never be read as "bad" or "good".

import type { TrustConfidence, TrustTier } from "@/lib/trust/verdict";
import { TIER_LABELS } from "@/lib/trust/verdict";

const TIER_STYLES: Record<TrustTier, string> = {
  A: "bg-emerald-500/10 border-emerald-500/40 text-emerald-300",
  B: "bg-teal-500/10 border-teal-500/40 text-teal-300",
  C: "bg-amber-500/10 border-amber-500/40 text-amber-300",
  D: "bg-orange-500/10 border-orange-500/40 text-orange-300",
  E: "bg-red-500/10 border-red-500/40 text-red-300",
  UNMEASURED: "bg-gray-800/60 border-gray-700 border-dashed text-gray-400",
  UNVERIFIABLE: "bg-gray-900 border-gray-800 border-dashed text-gray-500",
};

export const TIER_ORDER: TrustTier[] = ["A", "B", "C", "D", "E", "UNMEASURED", "UNVERIFIABLE"];

const CONFIDENCE_LABELS: Record<TrustConfidence, string> = {
  high: "high confidence",
  medium: "medium confidence",
  low: "low confidence",
  none: "no measurements",
};

/** The letter itself. Non-grades render a dash rather than a fake letter. */
export function TrustGradeChip({
  tier,
  score,
  size = "md",
}: {
  tier: TrustTier;
  score: number | null;
  size?: "sm" | "md" | "lg";
}) {
  const isGrade = tier !== "UNMEASURED" && tier !== "UNVERIFIABLE";
  const dims =
    size === "lg"
      ? "h-16 w-16 text-3xl"
      : size === "sm"
        ? "h-8 w-8 text-sm"
        : "h-11 w-11 text-xl";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl border font-bold ${dims} ${TIER_STYLES[tier]}`}
      title={isGrade && score !== null ? `Grade ${tier} — ${score}/100` : TIER_LABELS[tier]}
      aria-label={isGrade && score !== null ? `Trust grade ${tier}, ${score} out of 100` : TIER_LABELS[tier]}
    >
      {isGrade ? tier : "–"}
    </span>
  );
}

/** Grade + score + confidence, as one inline block. */
export function TrustGradeSummary({
  tier,
  score,
  confidence,
  evidenceCount,
  size = "md",
}: {
  tier: TrustTier;
  score: number | null;
  confidence: TrustConfidence;
  evidenceCount: number;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className="flex items-center gap-3">
      <TrustGradeChip tier={tier} score={score} size={size} />
      <div className="min-w-0">
        <div className="font-semibold text-gray-100">
          {TIER_LABELS[tier]}
          {score !== null && <span className="ml-2 font-normal text-gray-400">{score}/100</span>}
        </div>
        <div className="text-xs text-gray-500">
          {score !== null
            ? `${CONFIDENCE_LABELS[confidence]} · ${evidenceCount} measured ${evidenceCount === 1 ? "signal" : "signals"}`
            : "not scored"}
        </div>
      </div>
    </div>
  );
}

/** Compact pill for dense lists. */
export function TrustGradePill({ tier, score }: { tier: TrustTier; score: number | null }) {
  const isGrade = tier !== "UNMEASURED" && tier !== "UNVERIFIABLE";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${TIER_STYLES[tier]}`}
    >
      {isGrade ? (
        <>
          <span className="font-bold">{tier}</span>
          <span className="opacity-80">{score}</span>
        </>
      ) : (
        TIER_LABELS[tier]
      )}
    </span>
  );
}
