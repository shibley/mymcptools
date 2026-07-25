// The "show your working" panel. A trust score nobody can audit is just an
// opinion with a number attached, so this renders every signal the model
// considered — including the ones it could not measure, which are the most
// important rows on the page. Nothing here is summarised away.

import type { SignalPolarity, TrustSignal } from "@/lib/trust/verdict";

const POLARITY_STYLES: Record<SignalPolarity, { dot: string; label: string }> = {
  positive: { dot: "bg-emerald-400", label: "text-emerald-300" },
  neutral: { dot: "bg-gray-500", label: "text-gray-300" },
  negative: { dot: "bg-red-400", label: "text-red-300" },
  unknown: { dot: "bg-gray-700 ring-1 ring-gray-600", label: "text-gray-500" },
};

function SignalRow({ signal }: { signal: TrustSignal }) {
  const style = POLARITY_STYLES[signal.polarity];
  const measured = signal.score !== null;

  return (
    <li className="flex gap-3 border-b border-gray-800 py-3 last:border-0">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className={`text-sm font-medium ${style.label}`}>{signal.label}</span>
          {measured ? (
            <span className="shrink-0 font-mono text-xs text-gray-500">
              {signal.score}/100 · weight {signal.weight}
            </span>
          ) : (
            <span className="shrink-0 text-xs uppercase tracking-wide text-gray-600">
              unknown
            </span>
          )}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-gray-400">{signal.detail}</p>
      </div>
    </li>
  );
}

/**
 * Full breakdown for one verdict. Measured signals first (they made the score),
 * unmeasured after (they explain the confidence).
 */
export function TrustSignalList({ signals }: { signals: readonly TrustSignal[] }) {
  const measured = signals.filter((s) => s.score !== null);
  const unmeasured = signals.filter((s) => s.score === null);

  return (
    <div>
      {measured.length > 0 && (
        <>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            What was measured
          </h4>
          <ul>
            {measured.map((s) => (
              <SignalRow key={s.id} signal={s} />
            ))}
          </ul>
        </>
      )}

      {unmeasured.length > 0 && (
        <>
          <h4 className="mb-1 mt-6 text-xs font-semibold uppercase tracking-wide text-gray-500">
            What could not be measured
          </h4>
          <p className="mb-1 text-xs text-gray-600">
            These contributed nothing to the score — not a penalty, not a zero. They are
            why the confidence reads the way it does.
          </p>
          <ul>
            {unmeasured.map((s) => (
              <SignalRow key={s.id} signal={s} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
