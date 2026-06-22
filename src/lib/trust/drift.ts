// Tool-schema drift detection (PRD P0-4).
//
// Hashes are computed order-independently: tools/list ordering is not
// contractually stable, so a server reordering its tools (or re-serializing an
// input schema with keys in a different order) must NOT register as drift. We
// canonicalize by recursively sorting object keys before hashing, and by
// hashing the tool-set as a sorted set of `name:schemaHash` pairs.

import { createHash } from 'node:crypto';
import type { ToolSetDiff } from './types.ts';

export interface ToolDescriptor {
  name: string;
  inputSchema?: unknown;
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** Deterministic JSON with recursively sorted object keys. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** sha256 of a single tool's input schema, key-order independent. */
export function hashToolSchema(inputSchema: unknown): string {
  return sha256(stableStringify(inputSchema ?? null));
}

/** Map of tool name -> input-schema hash. */
export function toolHashes(tools: ToolDescriptor[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of tools) out[t.name] = hashToolSchema(t.inputSchema);
  return out;
}

/** Order-independent hash of an entire tool-set from its per-tool hashes. */
export function schemaSetHash(hashes: Record<string, string>): string {
  const canonical = Object.keys(hashes)
    .sort()
    .map((name) => `${name}:${hashes[name]}`)
    .join('\n');
  return sha256(canonical);
}

/** Diff a previous tool-set against the current one (PRD P0-4). */
export function diffToolSets(
  prev: Record<string, string>,
  curr: Record<string, string>,
): ToolSetDiff {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const name of Object.keys(curr)) {
    if (!(name in prev)) added.push(name);
    else if (prev[name] !== curr[name]) changed.push(name);
  }
  for (const name of Object.keys(prev)) {
    if (!(name in curr)) removed.push(name);
  }
  return { added: added.sort(), removed: removed.sort(), changed: changed.sort() };
}

export function isEmptyDiff(d: ToolSetDiff): boolean {
  return d.added.length === 0 && d.removed.length === 0 && d.changed.length === 0;
}
