/**
 * Inventory builder (PRD P0-1).
 *
 * Reads the catalog (src/data/servers.ts) and the curated remote-endpoints
 * registry, classifies every server remote-vs-local, and emits the probe
 * inventory the prober consumes: src/data/probe-inventory.json.
 *
 * Honesty rule: a server is only marked `remote` (probeable) when it has a
 * documented endpoint in the registry. Everything else is `local` with a
 * recorded reason — we never fabricate an endpoint.
 *
 * Run: node scripts/build-inventory.mts
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { servers } from '../src/data/servers.ts';
import { remoteEndpointBySlug } from '../src/data/remote-endpoints.ts';
import type { InventoryEntry } from '../src/lib/trust/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'src', 'data', 'probe-inventory.json');

function reasonForLocal(installType: string): string {
  switch (installType) {
    case 'npm':
      return 'local stdio install (npm) — no published remote endpoint';
    case 'pip':
      return 'local stdio install (pip) — no published remote endpoint';
    case 'docker':
      return 'self-hosted container — no published remote endpoint';
    case 'binary':
      return 'local binary — no published remote endpoint';
    case 'source':
      return 'build-from-source — no published remote endpoint';
    default:
      return 'no published remote endpoint';
  }
}

const inventory: InventoryEntry[] = servers.map((s) => {
  // Popularity signals carried through so the hot-set probe (P0-3) can target
  // featured/sponsored servers without re-reading the catalog at probe time.
  const popularity = {
    ...(s.featured ? { featured: true } : {}),
    ...(s.sponsored ? { sponsored: true } : {}),
  };
  const remote = remoteEndpointBySlug.get(s.slug);
  if (remote) {
    return {
      slug: s.slug,
      name: s.name,
      delivery: 'remote',
      remote_endpoint: remote.url,
      transport: remote.transport,
      endpoint_source: remote.source,
      ...popularity,
    };
  }
  return {
    slug: s.slug,
    name: s.name,
    delivery: 'local',
    unprobeable_reason: reasonForLocal(s.install_type),
    ...popularity,
  };
});

const remoteCount = inventory.filter((e) => e.delivery === 'remote').length;
const localCount = inventory.length - remoteCount;

writeFileSync(OUT, JSON.stringify(inventory, null, 2) + '\n');

console.log(`[inventory] catalog servers: ${servers.length}`);
console.log(`[inventory] remote (probeable): ${remoteCount}`);
console.log(`[inventory] local (unprobeable): ${localCount}`);
console.log(`[inventory] wrote ${OUT}`);
