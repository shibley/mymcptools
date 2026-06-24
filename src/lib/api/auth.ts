// Shared API-key auth + per-key rate limiting for the public v1 trust API
// (PRD P0-7). Read-only endpoints; keys come from the MCPTOOLS_API_KEYS env var
// (comma-separated). No Stripe/paywall here — that's P2.
//
// Rate limiting is a simple in-memory token bucket keyed by API key. This is
// per-server-instance only; on serverless it bounds burst per warm instance,
// which is sufficient for the v1 abuse-prevention goal. A shared store (Redis)
// can replace this without changing call sites.

import { NextRequest, NextResponse } from "next/server";

/** Requests allowed per window, per key. */
const RATE_LIMIT_MAX = 120;
/** Window length in milliseconds. */
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

export interface RateLimitState {
  /** Remaining requests in the current window (X-RateLimit-Remaining). */
  remaining: number;
  /** Max requests per window (X-RateLimit-Limit). */
  limit: number;
  /** Unix epoch seconds when the window resets (X-RateLimit-Reset). */
  resetAt: number;
  /** True once the key has exceeded its allowance this window. */
  exceeded: boolean;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Comma-separated allow-list from MCPTOOLS_API_KEYS, trimmed + de-empty'd. */
function allowedKeys(): Set<string> {
  return new Set(
    (process.env.MCPTOOLS_API_KEYS ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
  );
}

/** Extract the API key from `Authorization: Bearer` or `x-api-key`. */
function extractKey(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth) {
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (m) return m[1].trim();
  }
  const header = req.headers.get("x-api-key");
  if (header?.trim()) return header.trim();
  return null;
}

/** Record one request against a key's bucket and return the resulting state. */
function consume(key: string): RateLimitState {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  return {
    remaining: Math.max(0, RATE_LIMIT_MAX - bucket.count),
    limit: RATE_LIMIT_MAX,
    resetAt: Math.ceil(bucket.resetAt / 1000),
    exceeded: bucket.count > RATE_LIMIT_MAX,
  };
}

/** Apply X-RateLimit-* headers to a response. */
export function withRateLimitHeaders(
  res: NextResponse,
  state: RateLimitState
): NextResponse {
  res.headers.set("X-RateLimit-Limit", String(state.limit));
  res.headers.set("X-RateLimit-Remaining", String(state.remaining));
  res.headers.set("X-RateLimit-Reset", String(state.resetAt));
  return res;
}

export type AuthResult =
  | { ok: true; key: string; rate: RateLimitState }
  | { ok: false; response: NextResponse };

/**
 * Authenticate + rate-limit a v1 request. On success returns the key and the
 * post-consume rate state (caller must attach headers to its success response
 * via withRateLimitHeaders). On failure returns a ready-to-return JSON error
 * with the appropriate status + rate-limit headers.
 */
export function authenticate(req: NextRequest): AuthResult {
  const key = extractKey(req);

  if (!key || !allowedKeys().has(key)) {
    const res = NextResponse.json(
      {
        error: "unauthorized",
        message:
          "Missing or invalid API key. Pass it as 'Authorization: Bearer <key>' or 'x-api-key: <key>'.",
      },
      { status: 401 }
    );
    return { ok: false, response: res };
  }

  const rate = consume(key);
  if (rate.exceeded) {
    const res = NextResponse.json(
      { error: "rate_limited", message: "Rate limit exceeded. Retry later." },
      { status: 429 }
    );
    withRateLimitHeaders(res, rate);
    res.headers.set(
      "Retry-After",
      String(Math.max(1, rate.resetAt - Math.floor(Date.now() / 1000)))
    );
    return { ok: false, response: res };
  }

  return { ok: true, key, rate };
}
