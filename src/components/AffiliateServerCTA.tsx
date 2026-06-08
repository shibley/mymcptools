import { getAffiliateCTAs } from "@/data/affiliate-links";

interface Props {
  serverCategories: string[];
}

export function AffiliateServerCTA({ serverCategories }: Props) {
  const [cta] = getAffiliateCTAs(serverCategories, 1);
  if (!cta) return null;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Sponsored</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">{cta.name}</h3>
          {cta.badge && (
            <span className="text-xs bg-emerald-900/60 text-emerald-400 border border-emerald-700/50 px-2 py-0.5 rounded-full whitespace-nowrap">
              {cta.badge}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">{cta.description}</p>
        <a
          href={cta.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="mt-3 block w-full text-center text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2 transition-colors"
        >
          {cta.cta}
        </a>
      </div>
    </div>
  );
}
