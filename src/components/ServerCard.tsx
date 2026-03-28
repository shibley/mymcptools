import Link from "next/link";
import { MCPServer, categories } from "@/data/servers";

interface ServerCardProps {
  server: MCPServer;
  showCategory?: boolean;
}

export function ServerCard({ server, showCategory = true }: ServerCardProps) {
  const category = categories.find(c => c.slug === server.categories[0]);
  
  return (
    <Link href={`/servers/${server.slug}`}>
      <div className="group bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-300 hover:shadow-md transition-all duration-200 h-full flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            {category && <span className="text-xl">{category.emoji}</span>}
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-sm">
                {server.name}
              </h3>
              <p className="text-xs text-gray-400">by {server.author}</p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5">
            {server.featured && (
              <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium rounded-full">
                ⭐ Featured
              </span>
            )}
            {server.official && (
              <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium rounded-full">
                ✓ Official
              </span>
            )}
          </div>
        </div>
        
        <p className="text-sm text-gray-500 mb-4 line-clamp-2 flex-1">
          {server.description}
        </p>
        
        {showCategory && (
          <div className="flex flex-wrap gap-1.5">
            {server.categories.slice(0, 3).map(cat => (
              <span 
                key={cat}
                className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded"
              >
                {cat}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

export function ServerCardCompact({ server }: { server: MCPServer }) {
  const category = categories.find(c => c.slug === server.categories[0]);
  
  return (
    <Link href={`/servers/${server.slug}`}>
      <div className="group flex items-center space-x-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all">
        {category && <span className="text-lg">{category.emoji}</span>}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 text-sm group-hover:text-blue-600 transition-colors truncate">
            {server.name}
          </h4>
          <p className="text-xs text-gray-400 truncate">{server.description}</p>
        </div>
        {server.official && (
          <span className="text-blue-600 text-xs font-medium">✓</span>
        )}
      </div>
    </Link>
  );
}
