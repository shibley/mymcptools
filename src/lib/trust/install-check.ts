/**
 * Read-side accessor for "does the package this install command names actually
 * exist in its registry, and WHEN did we last look?"
 *
 * WHY THIS EXISTS SEPARATELY FROM `install_verified` ON THE ROW
 *   `servers.ts` already carries `install_verified` + `install_checked`, and
 *   857 entries are marked `false`. The problem is not the field, it is that the
 *   field is a POINT-IN-TIME OBSERVATION frozen into a hand-maintained row.
 *   A registry 404 is only true as of the day it was checked, and a registry is
 *   a monotonically growing set: the negative rots, the positive does not.
 *
 *   The 2026-08-17 sweep measured the rot. Six entries checked on 2026-07-31 —
 *   freshservice-mcp, homey-mcp, housecall-pro-mcp, plane-mcp, zigbee2mqtt-mcp,
 *   markitdown-mcp — name packages that were published to npm/PyPI during the
 *   first half of August. All six pages still struck the command through, hid
 *   the copy button, and told the reader in amber that it would fail. That is
 *   the worse direction to be wrong in: a phantom command wastes a terminal
 *   round-trip, but a false negative withholds a working install and reads as
 *   authoritative while doing it.
 *
 *   So the fix is not 60 hand edits, it is a dated re-check the page prefers
 *   over the frozen row. `phantom-package-sweep.mts --emit` rewrites
 *   `install-registry-check.json` on every run; a re-run heals both directions
 *   at once, and the page states the date it is speaking as of.
 *
 * EXISTENCE IS NOT IDENTITY
 *   A 200 only proves *something* is published under that name. `slab-mcp` is
 *   published and is a trading-card grading server, while the catalog entry is
 *   Slab the team knowledge base. The sweep carries a `COLLISIONS` list for
 *   these and emits `exists: false` plus a `collision` reason, so the page can
 *   say the specific true thing rather than the convenient one.
 */

import rawCheck from "@/data/install-registry-check.json";

type CheckRecord = {
  registry: "npm" | "pip";
  package: string;
  exists: boolean;
  checkedAt: string;
  collision?: string;
};

type CheckFile = { generatedAt: string; entries: Record<string, CheckRecord> };

const CHECKS = (rawCheck as CheckFile).entries ?? {};

export type InstallCheck = {
  /** The package name the command actually resolves to — never guessed. */
  packageName: string;
  registry: "npm" | "pip";
  /** True only when the registry has it AND it is the right product. */
  exists: boolean;
  /** ISO date (YYYY-MM-DD) the lookup ran. */
  checkedAt: string;
  /** Set when the name is published but belongs to a different product. */
  collision?: string;
};

export function getInstallCheck(slug: string): InstallCheck | null {
  const rec = CHECKS[slug];
  if (!rec) return null;
  return {
    packageName: rec.package,
    registry: rec.registry,
    exists: rec.exists,
    checkedAt: rec.checkedAt,
    collision: rec.collision,
  };
}

/**
 * The single question the Installation block needs answered.
 *
 *   'ok'       — render the command with a copy button.
 *   'phantom'  — the named package is not in its registry; say so, name it, and
 *                date the claim.
 *   'unknown'  — the command names no registry package we can check (a git
 *                clone, a Docker one-liner, a remote `mcp add <url>`), so no
 *                registry claim is available either way.
 *
 * The row's `install_verified === false` is honoured ONLY when it agrees with a
 * check or when no check exists — and never as the basis for the sentence "X is
 * not published to <registry>", because for an unnamed command there is no X.
 * The page previously derived that X by taking the first bare token of the
 * command, which printed "This command will fail: `git` is not published to
 * npm" on 22 source-install entries and "`claude` is not published to npm" on a
 * remote one.
 */
export function installVerdict(server: {
  slug: string;
  install_command?: string | null;
  install_verified?: boolean;
  install_checked?: string;
}): { state: "ok" | "phantom" | "unknown"; check: InstallCheck | null } {
  if (!server.install_command?.trim()) return { state: "unknown", check: null };

  const check = getInstallCheck(server.slug);
  if (check) {
    return { state: check.exists ? "ok" : "phantom", check };
  }
  // No registry package to check. A stale `false` on such a row cannot support
  // a "not published" claim, so it degrades to "we cannot confirm this".
  return { state: server.install_verified === false ? "unknown" : "ok", check: null };
}

export function formatCheckDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}
