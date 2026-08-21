// Version detection (spec 025): the running version (this package) and the latest published
// release (GitHub), with a semver compare. The GitHub check is cached and never throws - the
// repo is private, so without a token `latest` is simply null (detection degrades, no error).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = "mchacher/passepartout";
const CACHE_MS = 60 * 60 * 1000; // 1 hour
let cache: { at: number; latest: string | null } | null = null;

export function readCurrentVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf-8")) as { version?: string };
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** Parse "v1.2.3" or "1.2.3" to [1,2,3], or null when it is not a plain semver. */
export function parseVersion(v: string): [number, number, number] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** True when `latest` is strictly newer than `current` (both plain semver). */
export function isNewer(current: string, latest: string): boolean {
  const c = parseVersion(current);
  const l = parseVersion(latest);
  if (!c || !l) return false;
  for (let i = 0; i < 3; i++) {
    if (l[i] > c[i]) return true;
    if (l[i] < c[i]) return false;
  }
  return false;
}

/**
 * The latest release tag (version, no leading v), or null. Cached ~1h; never throws.
 * Pass `{ force: true }` (a manual "check for updates") to skip the cache and re-fetch.
 */
export async function fetchLatest(token?: string, opts?: { force?: boolean }): Promise<string | null> {
  const now = Date.now();
  if (!opts?.force && cache && now - cache.at < CACHE_MS) return cache.latest;
  let latest: string | null = null;
  try {
    const headers: Record<string, string> = {
      accept: "application/vnd.github+json",
      "user-agent": "passepartout-server",
    };
    if (token) headers.authorization = `Bearer ${token}`;
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers });
    if (r.ok) {
      const body = (await r.json()) as { tag_name?: string };
      latest = body.tag_name ? body.tag_name.replace(/^v/, "") : null;
    }
  } catch {
    latest = null;
  }
  cache = { at: now, latest };
  return latest;
}

/** Reset the cache (tests). */
export function clearVersionCache(): void {
  cache = null;
}
