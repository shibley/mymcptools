// Presentational trust-status surfaces (PRD P0-6). Pure components: the parent
// server component fetches CurrentStatus via getStatus(slug) and passes it in.
// They render only fields CurrentStatus actually carries — no invented uptime.

import type { CurrentStatus, Verdict } from "@/lib/trust/types";

interface VerdictMeta {
  label: string;
  dot: string;
  pill: string;
  icon: string;
}

const VERDICT_META: Record<Verdict, VerdictMeta> = {
  GOOD: {
    label: "Live",
    dot: "bg-green-400",
    pill: "bg-green-500/10 border-green-500/30 text-green-300",
    icon: "",
  },
  WARN: {
    label: "Limited",
    dot: "bg-amber-400",
    pill: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    icon: "",
  },
  AUTH_REQUIRED: {
    label: "Auth required",
    dot: "bg-blue-400",
    pill: "bg-blue-500/10 border-blue-500/30 text-blue-300",
    icon: "🔒",
  },
  DOWN: {
    label: "Down",
    dot: "bg-red-400",
    pill: "bg-red-500/10 border-red-500/30 text-red-300",
    icon: "",
  },
  UNPROBEABLE: {
    label: "Local install",
    dot: "bg-gray-500",
    pill: "bg-gray-800/60 border-gray-700 text-gray-400",
    icon: "",
  },
};

/** Verbose-but-stable relative time. Computed at render (build) time. */
function relativeTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const min = Math.round((Date.now() - then) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

/**
 * Small inline pill for list/search/related cards. Renders nothing when there
 * is no status row yet (unknown slug). Shows verdict + last-checked.
 */
export function StatusPill({
  status,
  showChecked = true,
}: {
  status: CurrentStatus | null | undefined;
  showChecked?: boolean;
}) {
  if (!status) return null;
  const meta = VERDICT_META[status.verdict];
  const checked = relativeTime(status.checked_at);

  return (
    <span
      className={`inline-flex items-center gap-1.5 leading-none px-2 py-1 border text-xs font-medium rounded-full ${meta.pill}`}
      title={`${meta.label} · checked ${checked ?? "recently"}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
      <span>{meta.label}</span>
      {showChecked && checked && (
        <span className="text-current/70 font-normal">· {checked}</span>
      )}
    </span>
  );
}

/**
 * One-line status footer for list/search cards. Shows last-checked, plus the
 * last-seen-healthy time for non-healthy verdicts — so a DOWN/AUTH server
 * surfaces its dead status and last-good time without any click-through.
 */
export function StatusLine({ status }: { status: CurrentStatus | null | undefined }) {
  if (!status || status.verdict === "UNPROBEABLE") return null;
  const checked = relativeTime(status.checked_at);
  const lastGood = relativeTime(status.last_seen_good_at);
  const unhealthy = status.verdict !== "GOOD";

  return (
    <p className="text-xs text-gray-500">
      {checked && <span>Checked {checked}</span>}
      {unhealthy && lastGood && (
        <span className="text-gray-600"> · last healthy {lastGood}</span>
      )}
    </p>
  );
}

/**
 * Full status panel for the server detail page. Surfaces every real signal:
 * verdict, last-checked, tool count, latency, last-good time (key for DOWN/AUTH
 * per the P0-6 acceptance criterion), protocol version and drift ("tools
 * changed X ago"). Renders a subtle not-yet-verified note when no data exists.
 */
export function StatusBadge({ status }: { status: CurrentStatus | null | undefined }) {
  if (!status) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p className="text-sm text-gray-500">
          Live status not yet verified for this server.
        </p>
      </div>
    );
  }

  const meta = VERDICT_META[status.verdict];
  const checked = relativeTime(status.checked_at);
  const lastGood = relativeTime(status.last_seen_good_at);
  const toolsChanged = relativeTime(status.schema_changed_at);
  const isHealthy = status.verdict === "GOOD";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <span
          className={`inline-flex items-center gap-2 leading-none px-3 py-1.5 border text-sm font-semibold rounded-full ${meta.pill}`}
        >
          {meta.icon ? (
            <span aria-hidden="true">{meta.icon}</span>
          ) : (
            <span className={`w-2 h-2 rounded-full ${meta.dot}`} aria-hidden="true" />
          )}
          <span>{meta.label}</span>
        </span>
        {checked && (
          <span className="text-xs text-gray-500">Checked {checked}</span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        {status.tool_count != null && (
          <div>
            <dt className="text-xs text-gray-500">Tools</dt>
            <dd className="text-gray-200">{status.tool_count}</dd>
          </div>
        )}
        {status.latency_ms != null && (
          <div>
            <dt className="text-xs text-gray-500">Latency</dt>
            <dd className="text-gray-200">{status.latency_ms} ms</dd>
          </div>
        )}
        {!isHealthy && lastGood && (
          <div>
            <dt className="text-xs text-gray-500">Last seen healthy</dt>
            <dd className="text-gray-200">{lastGood}</dd>
          </div>
        )}
        {status.negotiated_protocol_version && (
          <div>
            <dt className="text-xs text-gray-500">Protocol</dt>
            <dd className="text-gray-200">{status.negotiated_protocol_version}</dd>
          </div>
        )}
        {toolsChanged && (
          <div>
            <dt className="text-xs text-gray-500">Tools changed</dt>
            <dd className="text-gray-200">{toolsChanged}</dd>
          </div>
        )}
      </dl>

      {!isHealthy && status.failure_reason && (
        <p className="mt-4 text-xs text-gray-500 line-clamp-2">
          {status.failure_reason}
        </p>
      )}
    </div>
  );
}
