# mymcptools Trust API v1

Public, **read-only** access to the live MCP-server verification dataset (PRD
P0-7). The data is produced by the trust-layer prober (PRD P0-2/P0-3/P0-4) and
exposed here as per-server status, a paginated list, and a daily bulk export.

Base path: `/api/v1`

## Authentication

Every v1 endpoint requires an API key. Configure the allow-list with the
`MCPTOOLS_API_KEYS` environment variable — a comma-separated list of accepted
keys:

```
MCPTOOLS_API_KEYS=key_live_abc123,key_live_def456
```

Send the key on each request, either way:

```
Authorization: Bearer <key>
# or
x-api-key: <key>
```

A missing or unrecognized key returns **401**:

```json
{ "error": "unauthorized", "message": "Missing or invalid API key. ..." }
```

## Rate limiting

Each key gets a token bucket of **120 requests per 60s** (per server instance).
Every response carries:

| Header                  | Meaning                               |
| ----------------------- | ------------------------------------- |
| `X-RateLimit-Limit`     | Requests allowed per window           |
| `X-RateLimit-Remaining` | Requests left in the current window   |
| `X-RateLimit-Reset`     | Unix epoch seconds when window resets |

Exceeding the limit returns **429** with a `Retry-After` header:

```json
{ "error": "rate_limited", "message": "Rate limit exceeded. Retry later." }
```

## Status object

Each server is represented by its derived `current_status` row. Fields mirror
`src/lib/trust/types.ts` (`CurrentStatus`); only fields present in the dataset
are returned.

| Field                          | Type                                                   | Notes                                            |
| ------------------------------ | ------------------------------------------------------ | ------------------------------------------------ |
| `slug`                         | string                                                 | Stable server id                                 |
| `verdict`                      | `GOOD` \| `WARN` \| `AUTH_REQUIRED` \| `DOWN` \| `UNPROBEABLE` | Effective (rolling-window) verdict        |
| `tool_count`                   | number \| null                                         | Tools exposed at last successful probe           |
| `latency_ms`                   | number \| null                                         | Handshake round-trip                             |
| `negotiated_protocol_version`  | string \| null                                         | MCP protocol version negotiated                  |
| `remote_endpoint`              | string?                                                | Probe URL (remote servers only)                  |
| `transport`                    | `streamable-http` \| `sse`?                            | Wire transport                                   |
| `last_seen_good_at`            | string \| null                                         | ISO-8601; last time observed `GOOD`              |
| `checked_at`                   | string                                                 | ISO-8601; latest probe                           |
| `failure_reason`               | string?                                                | Raw reason for WARN/DOWN/AUTH/UNPROBEABLE        |
| `auth_server_url`              | string?                                                | OAuth auth-server URL for `AUTH_REQUIRED`        |
| `raw_verdict`                  | Verdict?                                                | Latest probe verdict before smoothing            |
| `consecutive_failures`         | number?                                                | Consecutive DOWN probes (rolling window)         |
| `status_changed_at`            | string \| null?                                        | ISO-8601; when effective verdict last changed    |
| `schema_hash`                  | string \| null?                                        | Hash of latest tools/list schema                 |
| `schema_changed`               | boolean?                                                | Schema changed on latest probe                   |
| `schema_changed_at`            | string \| null?                                        | ISO-8601; when tool schema last changed          |
| `last_protocol_version`        | string \| null?                                        | Protocol version at last successful probe        |
| `protocol_version_changed`     | boolean?                                                | Protocol version changed on latest probe         |

## Endpoints

### `GET /api/v1/servers/{slug}/status`

Current status for one server.

```json
{
  "generated_at": "2026-06-22T10:43:50.424Z",
  "status": { "slug": "...", "verdict": "GOOD", "...": "..." }
}
```

- **404** `{ "error": "not_found" }` when the slug is unknown.

### `GET /api/v1/status`

Paginated list of current-status rows.

Query params:

| Param           | Default | Notes                                                       |
| --------------- | ------- | ----------------------------------------------------------- |
| `filter`        | —       | `healthy` keeps only `GOOD`/`WARN`                          |
| `updated_since` | —       | ISO-8601; keep rows with `checked_at >=` this               |
| `limit`         | 50      | Max **200**                                                 |
| `cursor`        | 0       | Opaque offset; use `next_cursor` from the previous response |
| `offset`        | 0       | Alias for `cursor`                                          |

```json
{
  "generated_at": "2026-06-22T10:43:50.424Z",
  "summary": { "GOOD": 1, "WARN": 0, "AUTH_REQUIRED": 13, "DOWN": 0, "UNPROBEABLE": 2710 },
  "pagination": { "total": 2724, "limit": 50, "offset": 0, "next_cursor": "50" },
  "statuses": [ { "slug": "...", "verdict": "...", "...": "..." } ]
}
```

`next_cursor` is `null` on the last page. Paginate by passing it back as
`cursor`.

- **400** `{ "error": "bad_request" }` when `updated_since` is not a valid date.

### `GET /api/v1/drift`

Paginated feed of tool-schema / protocol-version drift events (PRD P0-4),
newest-first. Use it to answer "did this server's contract change?" — the
signal an agent platform routes on before trusting a cached tool schema.

Query params:

| Param    | Default | Notes                                                       |
| -------- | ------- | ----------------------------------------------------------- |
| `since`  | —       | ISO-8601; keep events with `changed_at >=` this             |
| `slug`   | —       | Only events for one server                                  |
| `filter` | —       | `schema` (schema-changed only) or `protocol` (version only) |
| `limit`  | 50      | Max **200**                                                 |
| `cursor` | 0       | Opaque offset; use `next_cursor` from the previous response |
| `offset` | 0       | Alias for `cursor`                                          |

```json
{
  "generated_at": "2026-07-08T22:53:00.000Z",
  "latest_drift_at": "2026-07-08T15:00:00.000Z",
  "pagination": { "total": 12, "limit": 50, "offset": 0, "next_cursor": null },
  "drift_events": [
    {
      "type": "drift",
      "slug": "example-server",
      "changed_at": "2026-07-08T15:00:00.000Z",
      "schema_changed": true,
      "prev_schema_hash": "…",
      "schema_hash": "…",
      "tool_diff": { "added": ["new_tool"], "removed": [], "changed": [] },
      "protocol_version_changed": false,
      "prev_protocol_version": "2025-06-18",
      "negotiated_protocol_version": "2025-06-18"
    }
  ]
}
```

- **400** `{ "error": "bad_request" }` when `since` is not a valid date or
  `filter` is not `schema`/`protocol`.

### `GET /api/v1/export`

Full dataset bulk export (intended for a daily pull).

Query params:

| Param    | Default | Notes            |
| -------- | ------- | ---------------- |
| `format` | `json`  | `json` or `csv`  |

- `format=json` → full object with `generated_at`, `summary`, `count`,
  `statuses` (all rows). Sent as a downloadable attachment.
- `format=csv` → RFC-4180 CSV with a header row and a stable scalar column set
  (`slug,verdict,tool_count,latency_ms,negotiated_protocol_version,remote_endpoint,transport,last_seen_good_at,checked_at,status_changed_at,schema_changed,schema_changed_at,failure_reason,auth_server_url`).
  Values containing commas, quotes, or newlines are quoted and quotes doubled.
- **400** `{ "error": "bad_request" }` for any other `format`.

## Error codes

| Status | `error`        | When                                  |
| ------ | -------------- | ------------------------------------- |
| 400    | `bad_request`  | Invalid query param                   |
| 401    | `unauthorized` | Missing/invalid API key               |
| 404    | `not_found`    | Unknown slug                          |
| 429    | `rate_limited` | Per-key rate limit exceeded           |

## Notes

- All endpoints are strictly read-only. No write/mutation routes exist in v1.
- Billing/paywall (Stripe, paid DaaS tier) is **out of scope** for v1 (PRD P2).
- The dataset is regenerated by the prober and committed to
  `src/data/probe-status.json`; `generated_at` reflects that build.
