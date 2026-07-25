"use client";

// The paste-a-dependency-list scanner on /firewall.
//
// Posts to /api/firewall/scan (public, per-IP throttled) and renders one row per
// name with the evidence behind its verdict — including the exact registry URL,
// so a reader can curl it and check our work. That link is the whole point: a
// product about fabricated dependencies has to be falsifiable by its own users.

import { useState } from "react";
import type { CheckResult, Ecosystem, PackageVerdict } from "@/lib/firewall/types";

interface ScanSummary {
  total: number;
  exists: number;
  nonexistent: number;
  slopsquat_risk: number;
  unknown: number;
  blocked: boolean;
}

interface ScanResponse {
  ecosystem: Ecosystem;
  summary: ScanSummary;
  results: CheckResult[];
}

const VERDICT_STYLE: Record<PackageVerdict, { label: string; cls: string }> = {
  EXISTS: { label: "Exists", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  NONEXISTENT: { label: "Does not exist", cls: "border-red-500/30 bg-red-500/10 text-red-300" },
  SLOPSQUAT_RISK: { label: "Unestablished", cls: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  UNKNOWN: { label: "Unknown", cls: "border-gray-600/40 bg-gray-700/20 text-gray-400" },
};

const EXAMPLE_NPM = `{
  "dependencies": {
    "express": "^4.18.2",
    "react-codeshift": "^1.0.0",
    "activemq-mcp-server": "^1.0.0",
    "acumatica-mcp": "^0.1.0"
  }
}`;

const EXAMPLE_PYPI = `requests==2.31.0
ai21-mcp-server
mcp-server-fetch
langchain>=0.1.0`;

export function FirewallScanner() {
  const [ecosystem, setEcosystem] = useState<Ecosystem>("npm");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ScanResponse | null>(null);

  async function runScan() {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/firewall/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ecosystem, input }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.message ?? `Request failed (${res.status}).`);
        return;
      }
      setData(json as ScanResponse);
    } catch {
      setError("Could not reach the scanner. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
      <div className="flex flex-wrap items-center gap-2">
        {(["npm", "pypi"] as Ecosystem[]).map((eco) => (
          <button
            key={eco}
            type="button"
            onClick={() => setEcosystem(eco)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              ecosystem === eco
                ? "border-blue-500/40 bg-blue-500/15 text-blue-300"
                : "border-gray-700 text-gray-400 hover:bg-gray-800"
            }`}
          >
            {eco === "npm" ? "npm" : "PyPI"}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setInput(ecosystem === "npm" ? EXAMPLE_NPM : EXAMPLE_PYPI)}
          className="ml-auto text-sm text-gray-500 underline underline-offset-4 transition hover:text-gray-300"
        >
          Load an example
        </button>
      </div>

      <label htmlFor="firewall-input" className="sr-only">
        Dependency list
      </label>
      <textarea
        id="firewall-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={10}
        spellCheck={false}
        placeholder={
          ecosystem === "npm"
            ? "Paste a package.json, or one package name per line…"
            : "Paste a requirements.txt, or one package name per line…"
        }
        className="mt-4 w-full rounded-xl border border-gray-800 bg-gray-950/70 p-4 font-mono text-sm text-gray-200 outline-none transition focus:border-blue-500/50"
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={runScan}
          disabled={loading || !input.trim()}
          className="inline-flex items-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Checking registries…" : "Check these dependencies"}
        </button>
        <span className="text-xs text-gray-600">
          Up to 100 names per scan. Nothing is stored.
        </span>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </p>
      )}

      {data && (
        <div className="mt-6">
          <div
            className={`rounded-xl border p-4 text-sm ${
              data.summary.blocked
                ? "border-red-500/30 bg-red-500/10 text-red-200"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {data.summary.blocked ? (
              <>
                <strong>{data.summary.nonexistent + data.summary.slopsquat_risk}</strong> of{" "}
                {data.summary.total} names would not install as an established package —{" "}
                {data.summary.nonexistent} do not exist on the registry,{" "}
                {data.summary.slopsquat_risk} resolve to something unestablished. A CI gate on
                this list would fail.
              </>
            ) : (
              <>
                All {data.summary.total} names resolve to established packages on{" "}
                {data.ecosystem === "npm" ? "npm" : "PyPI"}.
              </>
            )}
          </div>

          <ul className="mt-4 divide-y divide-gray-800 rounded-xl border border-gray-800">
            {data.results.map((r) => {
              const style = VERDICT_STYLE[r.verdict];
              return (
                <li key={`${r.ecosystem}:${r.name}`} className="p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <code className="font-mono text-sm text-gray-100">{r.name}</code>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.cls}`}
                    >
                      {style.label}
                    </span>
                    {r.from_corpus && (
                      <span className="text-xs text-gray-600">from corpus</span>
                    )}
                  </div>

                  {r.markers.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {r.markers.map((m) => (
                        <li key={m.id} className="text-xs leading-relaxed text-gray-400">
                          · {m.detail}
                        </li>
                      ))}
                    </ul>
                  )}

                  {r.verdict === "NONEXISTENT" && (
                    <p className="mt-2 text-xs leading-relaxed text-gray-400">
                      The registry returned HTTP 404 for this exact name. Nothing occupies it
                      today, which also means anyone can register it tomorrow.
                    </p>
                  )}

                  {r.evidence.error && (
                    <p className="mt-2 text-xs text-gray-500">{r.evidence.error}</p>
                  )}

                  {r.evidence.registry_url && (
                    <a
                      href={r.evidence.registry_url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="mt-2 inline-block break-all font-mono text-xs text-gray-600 underline underline-offset-4 transition hover:text-gray-400"
                    >
                      {r.evidence.registry_url} → HTTP {r.evidence.http_status ?? "—"}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
