import Link from "next/link";
import { MCPServer, categories } from "@/data/servers";
import { getStatus } from "@/lib/trust/status-store";
import { getStaticSignal } from "@/lib/trust/static-signals-store";
import {
  StatusPill,
  StatusLine,
  LocalSignalPill,
  LocalSignalLine,
} from "@/components/StatusBadge";

/** Local/stdio servers have no live verdict — show the static repo signal. */
function isLocal(status: { verdict: string } | null | undefined): boolean {
  return !status || status.verdict === "UNPROBEABLE";
}

interface ServerCardProps {
  server: MCPServer;
  showCategory?: boolean;
}

export function ServerCard({ server, showCategory = true }: ServerCardProps) {
  const category = categories.find(c => c.slug === server.categories[0]);
  const status = getStatus(server.slug);
  const local = isLocal(status);
  const signal = local ? getStaticSignal(server.slug) : undefined;

  return (
    <Link href={`/servers/${server.slug}`}>
      <div className="group bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-500/50 transition-all duration-200 h-full flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            {category && <span className="text-xl">{category.emoji}</span>}
            <div>
              <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors text-sm">
                {server.name}
              </h3>
              <p className="text-xs text-gray-500">by {server.author}</p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5">
            {local ? (
              <LocalSignalPill signal={signal} />
            ) : (
              <StatusPill status={status} showChecked={false} />
            )}
            {server.sponsored && (
              <span className="inline-flex items-center gap-1 leading-none px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-medium rounded-full">
                <span aria-hidden="true">💰</span>
                <span>Sponsored</span>
              </span>
            )}
            {server.featured && !server.sponsored && (
              <span className="inline-flex items-center gap-1 leading-none px-2 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium rounded-full">
                <span aria-hidden="true">⭐</span>
                <span>Featured</span>
              </span>
            )}
            {server.official && (
              <span className="inline-flex items-center gap-1 leading-none px-2 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium rounded-full">
                <span aria-hidden="true">✓</span>
                <span>Official</span>
              </span>
            )}
          </div>
        </div>
        
        <p className="text-sm text-gray-400 mb-4 line-clamp-2 flex-1">
          {server.description}
        </p>
        
        {showCategory && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {server.categories.slice(0, 3).map(cat => (
              <span
                key={cat}
                className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded"
              >
                {cat}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-1">
          {local ? (
            <LocalSignalLine signal={signal} />
          ) : (
            <StatusLine status={status} />
          )}
        </div>
      </div>
    </Link>
  );
}

export function ServerCardCompact({ server }: { server: MCPServer }) {
  const category = categories.find(c => c.slug === server.categories[0]);
  const status = getStatus(server.slug);
  const local = isLocal(status);
  const signal = local ? getStaticSignal(server.slug) : undefined;

  return (
    <Link href={`/servers/${server.slug}`}>
      <div className="group flex items-center space-x-3 p-3 bg-gray-900 border border-gray-800 rounded-lg hover:border-blue-500/50 hover:bg-gray-800/50 transition-all">
        {category && <span className="text-lg">{category.emoji}</span>}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white text-sm group-hover:text-blue-400 transition-colors truncate">
            {server.name}
          </h4>
          <p className="text-xs text-gray-500 truncate">{server.description}</p>
        </div>
        {local ? (
          <LocalSignalPill signal={signal} />
        ) : (
          <StatusPill status={status} showChecked={false} />
        )}
        {server.sponsored && (
          <span className="text-yellow-400 text-xs font-medium">💰</span>
        )}
        {server.official && (
          <span className="text-blue-400 text-xs font-medium">✓</span>
        )}
      </div>
    </Link>
  );
}
