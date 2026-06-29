// Webhook dispatch on status change / drift (PRD P1-4).
//
// When a server's effective verdict flips (GOOD↔DOWN, →AUTH_REQUIRED, →WARN,
// recovered) or a drift event is recorded (tool-schema or protocol-version
// change), we POST a signed JSON payload to every interested subscriber.
//
// Design constraints (matching the rest of the trust layer):
//   - STRICTLY READ-ONLY toward MCP servers: this module never touches a target
//     server; it only talks to operator-configured webhook URLs.
//   - Fully opt-in + side-effect-free with no subscriptions: an absent or empty
//     src/data/webhook-subscriptions.json means "do nothing".
//   - Graceful degradation: a failing/timeout/throwing webhook must NEVER
//     propagate to the caller (probing/drift must not break). Every delivery is
//     wrapped; the module only ever resolves, never rejects, to the caller.
//   - Reliability: bounded concurrency, per-request timeout, a couple of
//     retries with backoff on 5xx / network errors, and logged outcomes.
//   - Security: each request is signed with HMAC-SHA256 over the raw body using
//     the subscription secret, sent as `X-Signature: sha256=<hex>`.
//
// Subscriptions are untrusted config: every field is validated/sanitized before
// a request is made (URL scheme, http(s) only, scope membership, enabled flag).

import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type {
  CurrentStatus,
  DriftEvent,
  DriftWebhookPayload,
  StatusChangeWebhookPayload,
  Verdict,
  WebhookDeliveryResult,
  WebhookEventType,
  WebhookPayload,
  WebhookSubscription,
} from './types.ts';

// ---- tunables -------------------------------------------------------------
/** Per-request timeout for a single delivery attempt. */
export const WEBHOOK_TIMEOUT_MS = 8_000;
/** Total attempts per subscription = 1 initial + this many retries. */
export const WEBHOOK_MAX_RETRIES = 2;
/** Base backoff between retries (doubled each attempt). */
export const WEBHOOK_BACKOFF_MS = 250;
/** Max concurrent in-flight deliveries across all subscriptions. */
export const WEBHOOK_CONCURRENCY = 4;

// ---- subscription loading + validation ------------------------------------
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Validate + sanitize one raw subscription entry. Returns a normalized
 * subscription or null when malformed / disabled / not an http(s) target.
 */
export function sanitizeSubscription(raw: unknown): WebhookSubscription | null {
  if (!isObject(raw)) return null;
  if (typeof raw.id !== 'string' || raw.id.length === 0) return null;
  if (typeof raw.url !== 'string' || raw.url.length === 0) return null;
  // Only http(s) targets — never a file:/data: or other scheme.
  let parsed: URL;
  try {
    parsed = new URL(raw.url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  if (raw.enabled === false) return null;

  const events =
    raw.events === 'status_change' || raw.events === 'drift' || raw.events === 'both'
      ? raw.events
      : 'both';

  let scope: 'all' | string[] = 'all';
  if (Array.isArray(raw.scope)) {
    scope = raw.scope.filter((s): s is string => typeof s === 'string');
  } else if (raw.scope === 'all' || raw.scope === undefined) {
    scope = 'all';
  } else {
    // An unrecognized scope shape is treated as "all" rather than dropped.
    scope = 'all';
  }

  const secret = typeof raw.secret === 'string' && raw.secret.length > 0 ? raw.secret : undefined;

  return { id: raw.id, url: parsed.toString(), secret, events, scope, enabled: true };
}

/**
 * Load subscriptions from a JSON file. A missing/unreadable/invalid file yields
 * an empty list — the feature is opt-in and must never throw to the caller.
 */
export function loadSubscriptions(path: string): WebhookSubscription[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: WebhookSubscription[] = [];
  for (const raw of parsed) {
    const sub = sanitizeSubscription(raw);
    if (sub) out.push(sub);
  }
  return out;
}

// ---- matching -------------------------------------------------------------
function eventAllowed(sub: WebhookSubscription, event: WebhookEventType): boolean {
  const filter = sub.events ?? 'both';
  if (filter === 'both') return true;
  return filter === event;
}

function scopeAllowed(sub: WebhookSubscription, slug: string): boolean {
  const scope = sub.scope ?? 'all';
  if (scope === 'all') return true;
  return Array.isArray(scope) && scope.includes(slug);
}

/** Subscriptions interested in this (event, slug) pair. */
export function matchingSubscriptions(
  subs: WebhookSubscription[],
  event: WebhookEventType,
  slug: string,
): WebhookSubscription[] {
  return subs.filter((s) => eventAllowed(s, event) && scopeAllowed(s, slug));
}

// ---- signing --------------------------------------------------------------
/** HMAC-SHA256 of the raw body, formatted as the `X-Signature` value. */
export function signBody(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

// ---- delivery -------------------------------------------------------------
/**
 * Injectable POST function so the self-check can stub network I/O. Resolves to
 * { status } on an HTTP response; rejects on a network/timeout error.
 */
export type PostFn = (
  url: string,
  body: string,
  headers: Record<string, string>,
  timeoutMs: number,
) => Promise<{ status: number }>;

/** Default POST using global fetch with an AbortController timeout. */
export const defaultPost: PostFn = async (url, body, headers, timeoutMs) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'POST', headers, body, signal: ctrl.signal });
    return { status: res.status };
  } finally {
    clearTimeout(t);
  }
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface DispatchOptions {
  /** Override the POST implementation (tests inject a local sink/stub). */
  post?: PostFn;
  /** Per-request timeout. */
  timeoutMs?: number;
  /** Retries on top of the initial attempt. */
  maxRetries?: number;
  /** Base backoff (doubled each retry). */
  backoffMs?: number;
  /** Max concurrent deliveries. */
  concurrency?: number;
  /** Sink for delivery-outcome log lines (defaults to console.log). */
  log?: (line: string) => void;
}

/** A retryable failure = network/timeout error, or a 5xx response. */
function isRetryable(status: number | null): boolean {
  return status === null || status >= 500;
}

/**
 * Deliver one payload to one subscription with retry/backoff. Never throws —
 * always resolves to a WebhookDeliveryResult describing the outcome.
 */
async function deliverOne(
  sub: WebhookSubscription,
  payload: WebhookPayload,
  opts: Required<Omit<DispatchOptions, 'log'>> & { log: (l: string) => void },
): Promise<WebhookDeliveryResult> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'mymcptools-webhooks/1.0',
    'x-webhook-event': payload.event,
  };
  if (sub.secret) headers['x-signature'] = signBody(body, sub.secret);

  let attempts = 0;
  let lastStatus: number | null = null;
  let lastError: string | undefined;

  for (let i = 0; i <= opts.maxRetries; i++) {
    attempts++;
    try {
      const { status } = await opts.post(sub.url, body, headers, opts.timeoutMs);
      lastStatus = status;
      if (status >= 200 && status < 300) {
        return { subscription_id: sub.id, url: sub.url, event: payload.event, slug: payload.slug, ok: true, status, attempts };
      }
      lastError = `HTTP ${status}`;
      if (!isRetryable(status)) break; // 4xx: don't retry a rejected payload.
    } catch (e) {
      lastStatus = null;
      lastError = e instanceof Error ? e.message : String(e);
    }
    if (i < opts.maxRetries) await sleep(opts.backoffMs * 2 ** i);
  }

  return {
    subscription_id: sub.id,
    url: sub.url,
    event: payload.event,
    slug: payload.slug,
    ok: false,
    status: lastStatus,
    attempts,
    error: lastError,
  };
}

/**
 * Dispatch a batch of (subscription, payload) pairs with bounded concurrency.
 * Wrapped so a single misbehaving delivery can never reject the batch.
 */
async function dispatchBatch(
  jobs: { sub: WebhookSubscription; payload: WebhookPayload }[],
  options: DispatchOptions,
): Promise<WebhookDeliveryResult[]> {
  const opts = {
    post: options.post ?? defaultPost,
    timeoutMs: options.timeoutMs ?? WEBHOOK_TIMEOUT_MS,
    maxRetries: options.maxRetries ?? WEBHOOK_MAX_RETRIES,
    backoffMs: options.backoffMs ?? WEBHOOK_BACKOFF_MS,
    concurrency: options.concurrency ?? WEBHOOK_CONCURRENCY,
    log: options.log ?? ((l: string) => console.log(l)),
  };

  const results: WebhookDeliveryResult[] = new Array(jobs.length);
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const i = next++;
      const { sub, payload } = jobs[i];
      try {
        results[i] = await deliverOne(sub, payload, opts);
      } catch (e) {
        // Belt-and-suspenders: deliverOne never throws, but if it somehow did
        // we still must not break the caller.
        results[i] = {
          subscription_id: sub.id,
          url: sub.url,
          event: payload.event,
          slug: payload.slug,
          ok: false,
          status: null,
          attempts: 0,
          error: e instanceof Error ? e.message : String(e),
        };
      }
      const r = results[i];
      opts.log(
        `[webhooks] ${r.ok ? 'OK' : 'FAIL'} ${r.event} ${r.slug} -> ${r.subscription_id} ` +
          `(${r.attempts} attempt${r.attempts === 1 ? '' : 's'}` +
          (r.status !== null ? `, HTTP ${r.status}` : '') +
          (r.error ? `, ${r.error}` : '') +
          ')',
      );
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(opts.concurrency, jobs.length) }, worker),
  );
  return results;
}

// ---- payload builders -----------------------------------------------------
/** Build a status-change payload from a current_status snapshot (PRD P1-4). */
export function buildStatusChangePayload(
  status: CurrentStatus,
  oldVerdict: Verdict | null,
  name?: string,
): StatusChangeWebhookPayload {
  return {
    event: 'status_change',
    slug: status.slug,
    name,
    old_verdict: oldVerdict,
    new_verdict: status.verdict,
    status_changed_at: status.status_changed_at ?? status.checked_at,
    checked_at: status.checked_at,
    current_status: status,
  };
}

/** Build a drift payload from a DriftEvent (PRD P1-4). */
export function buildDriftPayload(
  drift: DriftEvent,
  currentStatus?: CurrentStatus,
  name?: string,
): DriftWebhookPayload {
  return {
    event: 'drift',
    slug: drift.slug,
    name,
    changed_at: drift.changed_at,
    schema_changed: drift.schema_changed,
    protocol_version_changed: drift.protocol_version_changed,
    tool_diff: drift.tool_diff,
    prev_schema_hash: drift.prev_schema_hash,
    schema_hash: drift.schema_hash,
    prev_protocol_version: drift.prev_protocol_version,
    negotiated_protocol_version: drift.negotiated_protocol_version,
    current_status: currentStatus,
  };
}

// ---- top-level dispatch (the wiring entrypoint) ---------------------------
/** A status change to (potentially) dispatch — only fired on an ACTUAL flip. */
export interface StatusChangeNotice {
  status: CurrentStatus;
  old_verdict: Verdict | null;
  name?: string;
}

/** A drift to (potentially) dispatch. */
export interface DriftNotice {
  drift: DriftEvent;
  current_status?: CurrentStatus;
  name?: string;
}

/**
 * Dispatch all status-change + drift notices to matching subscriptions.
 *
 * This is the single entrypoint the prober calls. It:
 *   - short-circuits to a no-op when there are no subscriptions (opt-in),
 *   - only sends a status_change when old_verdict !== new_verdict (no
 *     steady-state spam — the prober already gates on `flipped`, this is a
 *     second guard),
 *   - never throws to the caller (probing must survive any webhook failure).
 *
 * Returns the per-delivery results (useful for logging/tests); callers can
 * ignore the result entirely.
 */
export async function dispatchNotices(
  subs: WebhookSubscription[],
  statusChanges: StatusChangeNotice[],
  drifts: DriftNotice[],
  options: DispatchOptions = {},
): Promise<WebhookDeliveryResult[]> {
  try {
    if (subs.length === 0) return [];

    const jobs: { sub: WebhookSubscription; payload: WebhookPayload }[] = [];

    for (const sc of statusChanges) {
      // Steady-state guard: never fire when the verdict did not actually change.
      if (sc.old_verdict === sc.status.verdict) continue;
      const matched = matchingSubscriptions(subs, 'status_change', sc.status.slug);
      if (matched.length === 0) continue;
      const payload = buildStatusChangePayload(sc.status, sc.old_verdict, sc.name);
      for (const sub of matched) jobs.push({ sub, payload });
    }

    for (const d of drifts) {
      const matched = matchingSubscriptions(subs, 'drift', d.drift.slug);
      if (matched.length === 0) continue;
      const payload = buildDriftPayload(d.drift, d.current_status, d.name);
      for (const sub of matched) jobs.push({ sub, payload });
    }

    if (jobs.length === 0) return [];
    return await dispatchBatch(jobs, options);
  } catch (e) {
    // Absolute last line of defense: webhook dispatch is best-effort and must
    // never break the probe/drift pipeline.
    (options.log ?? ((l: string) => console.log(l)))(
      `[webhooks] dispatch error (suppressed): ${e instanceof Error ? e.message : String(e)}`,
    );
    return [];
  }
}
