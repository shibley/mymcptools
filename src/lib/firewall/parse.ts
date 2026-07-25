// Dependency-list parsing for the firewall.
//
// Kept in its own module with relative imports only (no "@/" aliases) so the
// selfcheck script can import and assert on it directly under plain node — the
// parser is the one place where a bug would silently invent a package name, so
// it must be testable outside the Next.js resolver.

import { normalizeName } from './registry.ts';
import type { Ecosystem } from './types.ts';

/** Hard ceiling on names per request — bounds both latency and outbound load. */
export const MAX_PACKAGES_PER_REQUEST = 100;

/**
 * Extract package names from pasted text. Accepts a package.json, a
 * requirements.txt, or a bare newline/comma-separated list — the three things a
 * person actually has in their clipboard.
 *
 * Deliberately conservative: anything it cannot confidently read is dropped
 * rather than guessed at, because a name invented by the parser would be a
 * fabricated verdict with extra steps.
 */
export function parsePackageInput(input: string, ecosystem: Ecosystem): string[] {
  const text = input.trim();
  if (!text) return [];

  const names: string[] = [];

  // package.json — read the dependency maps, ignore everything else.
  if (text.startsWith('{')) {
    try {
      const doc = JSON.parse(text) as Record<string, unknown>;
      for (const field of [
        'dependencies',
        'devDependencies',
        'peerDependencies',
        'optionalDependencies',
      ]) {
        const map = doc[field];
        if (map && typeof map === 'object' && !Array.isArray(map)) {
          names.push(...Object.keys(map as Record<string, unknown>));
        }
      }
      if (names.length) return dedupe(names, ecosystem);
    } catch {
      // Not valid JSON — fall through to the line parser.
    }
  }

  for (const rawLine of text.split(/[\n,]/)) {
    let line = rawLine.trim();
    if (!line) continue;
    // requirements.txt comments, pip options, editable/URL installs.
    if (line.startsWith('#') || line.startsWith('-') || /^https?:/i.test(line)) continue;
    line = line.split('#')[0].trim();
    // Strip a version specifier: name==1.0, name>=1, name@^1.2.3, name~=1.
    // The scoped-npm case (@scope/name) must survive, so only split on an "@"
    // that is not the leading character.
    line = line.replace(/\s*(?:[=<>!~]=?|===).*$/, '').trim();
    const at = line.lastIndexOf('@');
    if (at > 0) line = line.slice(0, at);
    line = line.replace(/\[.*\]$/, '').trim(); // pip extras: name[extra]
    if (line) names.push(line);
  }

  return dedupe(names, ecosystem);
}

function dedupe(names: string[], ecosystem: Ecosystem): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const norm = normalizeName(n, ecosystem);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out.slice(0, MAX_PACKAGES_PER_REQUEST);
}
