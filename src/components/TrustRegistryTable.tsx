"use client";

// The ranked registry table. Filters live in the URL hash (e.g.
// /trust#grade=A&evidence=live&q=github) so any view a reader lands on is a
// link they can send to someone else — the page is statically generated, so the
// hash is the only place filter state can live without making it dynamic.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TrustGradePill } from "@/components/TrustGrade";
import type { TrustTier } from "@/lib/trust/verdict";

/** One row, pre-flattened by the page so nothing server-only crosses over. */
export interface TrustRow {
  slug: string;
  name: string;
  author: string;
  tier: TrustTier;
  score: number;
  confidence: string;
  evidenceCount: number;
  liveMeasured: boolean;
  /** Headline measured facts, already formatted. Empty when none apply. */
  facts: string[];
}

type EvidenceFilter = "all" | "live" | "repo";

const GRADE_OPTIONS: (TrustTier | "all")[] = ["all", "A", "B", "C", "D", "E"];

const EVIDENCE_OPTIONS: { value: EvidenceFilter; label: string; hint: string }[] = [
  { value: "all", label: "All evidence", hint: "Every scored server" },
  { value: "live", label: "Live-probed", hint: "Graded partly on a real MCP handshake" },
  { value: "repo", label: "Repository only", hint: "Graded on repository evidence alone" },
];

function readHash(): { grade: string; evidence: EvidenceFilter; q: string } {
  if (typeof window === "undefined") return { grade: "all", evidence: "all", q: "" };
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const grade = params.get("grade") ?? "all";
  const evidence = params.get("evidence");
  return {
    grade: GRADE_OPTIONS.includes(grade as TrustTier) ? grade : "all",
    evidence: evidence === "live" || evidence === "repo" ? evidence : "all",
    q: params.get("q") ?? "",
  };
}

export function TrustRegistryTable({ rows }: { rows: TrustRow[] }) {
  const [grade, setGrade] = useState<string>("all");
  const [evidence, setEvidence] = useState<EvidenceFilter>("all");
  const [q, setQ] = useState("");

  // Hydrate from the hash on mount, and follow back/forward navigation.
  useEffect(() => {
    const apply = () => {
      const next = readHash();
      setGrade(next.grade);
      setEvidence(next.evidence);
      setQ(next.q);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  const sync = useCallback((next: { grade: string; evidence: EvidenceFilter; q: string }) => {
    const params = new URLSearchParams();
    if (next.grade !== "all") params.set("grade", next.grade);
    if (next.evidence !== "all") params.set("evidence", next.evidence);
    if (next.q) params.set("q", next.q);
    const hash = params.toString();
    // replaceState, not a hash assignment: typing in the search box should not
    // stack a history entry per keystroke.
    window.history.replaceState(null, "", hash ? `#${hash}` : window.location.pathname);
  }, []);

  const update = useCallback(
    (patch: Partial<{ grade: string; evidence: EvidenceFilter; q: string }>) => {
      const next = { grade, evidence, q, ...patch };
      setGrade(next.grade);
      setEvidence(next.evidence);
      setQ(next.q);
      sync(next);
    },
    [grade, evidence, q, sync]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (grade !== "all" && r.tier !== grade) return false;
      if (evidence === "live" && !r.liveMeasured) return false;
      if (evidence === "repo" && r.liveMeasured) return false;
      if (needle && !`${r.name} ${r.author} ${r.slug}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, grade, evidence, q]);

  const gradeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: rows.length };
    for (const r of rows) counts[r.tier] = (counts[r.tier] ?? 0) + 1;
    return counts;
  }, [rows]);

  return (
    <div>
      {/* Filters */}
      <div className="mb-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs uppercase tracking-wide text-gray-500">Grade</span>
          {GRADE_OPTIONS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => update({ grade: g })}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                grade === g
                  ? "border-blue-500/50 bg-blue-500/10 text-blue-300"
                  : "border-gray-800 bg-gray-900/60 text-gray-400 hover:border-gray-700 hover:text-gray-200"
              }`}
            >
              {g === "all" ? "All" : g}
              <span className="ml-1.5 text-xs opacity-60">{gradeCounts[g] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs uppercase tracking-wide text-gray-500">Evidence</span>
          {EVIDENCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              title={opt.hint}
              onClick={() => update({ evidence: opt.value })}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                evidence === opt.value
                  ? "border-blue-500/50 bg-blue-500/10 text-blue-300"
                  : "border-gray-800 bg-gray-900/60 text-gray-400 hover:border-gray-700 hover:text-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={q}
          onChange={(e) => update({ q: e.target.value })}
          placeholder="Filter by server or author…"
          className="w-full rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 outline-none transition focus:border-blue-500/50"
        />
      </div>

      <p className="mb-3 text-sm text-gray-500">
        Showing {filtered.length.toLocaleString()} of {rows.length.toLocaleString()} scored
        servers, best measured reliability first.
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-gray-800 bg-gray-900/40 p-8 text-center text-sm text-gray-500">
          No scored server matches those filters.
        </p>
      ) : (
        <ol className="rounded-xl border border-gray-800 bg-gray-900/40 px-4 sm:px-5">
          {filtered.map((r, i) => (
            <li
              key={r.slug}
              className="flex items-start gap-4 border-b border-gray-800 py-4 last:border-0"
            >
              <span className="w-6 shrink-0 pt-1 text-right font-mono text-xs text-gray-600">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link
                    href={`/servers/${r.slug}`}
                    className="font-medium text-gray-100 transition hover:text-white"
                  >
                    {r.name}
                  </Link>
                  <TrustGradePill tier={r.tier} score={r.score} />
                  {r.liveMeasured && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400/90">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                      live-probed
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {r.author}
                  {r.facts.length > 0 && <span> · {r.facts.join(" · ")}</span>}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
