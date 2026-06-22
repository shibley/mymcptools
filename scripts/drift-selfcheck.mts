/**
 * Self-check for tool-schema drift detection (PRD P0-4 acceptance:
 * "tool-set change -> drift event with names + timestamp").
 *
 * Asserts: identical tool-sets in a different order => NO drift; a tool
 * added / removed / schema-changed => the correct names in the diff.
 *
 * Run: node scripts/drift-selfcheck.mts
 */
import assert from 'node:assert/strict';
import {
  toolHashes,
  schemaSetHash,
  diffToolSets,
  isEmptyDiff,
  type ToolDescriptor,
} from '../src/lib/trust/drift.ts';

function setHash(tools: ToolDescriptor[]): string {
  return schemaSetHash(toolHashes(tools));
}

const baseline: ToolDescriptor[] = [
  { name: 'search', inputSchema: { type: 'object', properties: { q: { type: 'string' } } } },
  { name: 'fetch', inputSchema: { type: 'object', properties: { url: { type: 'string' } } } },
  { name: 'list', inputSchema: { type: 'object' } },
];

// 1. Reordered tools + reordered schema keys => identical hash, no drift.
const reordered: ToolDescriptor[] = [
  { name: 'list', inputSchema: { type: 'object' } },
  { name: 'fetch', inputSchema: { properties: { url: { type: 'string' } }, type: 'object' } },
  { name: 'search', inputSchema: { properties: { q: { type: 'string' } }, type: 'object' } },
];
assert.equal(setHash(baseline), setHash(reordered), 'reordering must not change the hash');
assert.ok(
  isEmptyDiff(diffToolSets(toolHashes(baseline), toolHashes(reordered))),
  'reordering must produce an empty diff',
);

// 2. Tool added.
const added = [...baseline, { name: 'delete', inputSchema: { type: 'object' } }];
let diff = diffToolSets(toolHashes(baseline), toolHashes(added));
assert.notEqual(setHash(baseline), setHash(added));
assert.deepEqual(diff, { added: ['delete'], removed: [], changed: [] });

// 3. Tool removed.
const removed = baseline.slice(0, 2);
diff = diffToolSets(toolHashes(baseline), toolHashes(removed));
assert.deepEqual(diff, { added: [], removed: ['list'], changed: [] });

// 4. Tool input-schema changed (same name).
const changed: ToolDescriptor[] = [
  { name: 'search', inputSchema: { type: 'object', properties: { q: { type: 'string' }, limit: { type: 'number' } } } },
  ...baseline.slice(1),
];
diff = diffToolSets(toolHashes(baseline), toolHashes(changed));
assert.deepEqual(diff, { added: [], removed: [], changed: ['search'] });

// 5. Combined add + remove + change in one diff.
const combined: ToolDescriptor[] = [
  { name: 'search', inputSchema: { type: 'object', properties: { q: { type: 'number' } } } }, // changed
  { name: 'fetch', inputSchema: { type: 'object', properties: { url: { type: 'string' } } } }, // same
  { name: 'create', inputSchema: { type: 'object' } }, // added (list removed)
];
diff = diffToolSets(toolHashes(baseline), toolHashes(combined));
assert.deepEqual(diff, { added: ['create'], removed: ['list'], changed: ['search'] });

console.log('[drift-selfcheck] OK — all 5 assertions passed');
