# API reference

## Admin HTTP API

All routes are JSON, require an admin session (`401 UNAUTHENTICATED` otherwise) and, for mutations, `Origin` equal to `ADMIN_URL` (`403 FORBIDDEN`). Error body: `{ "error": { "code", "message", "details?", "requestId" } }`.

| Method       | Route                                  | Body / query                          | Success                                                      |
| ------------ | -------------------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| GET          | `/api/posts`                           | `status=all                           | draft                                                        | published | archived | trash`, `q`, `cursor`, `limit≤50` | `{ items, total, counts, nextCursor }` (no bodies) |
| POST         | `/api/posts`                           | post fields                           | 201 item (status `draft`)                                    |
| GET          | `/api/posts/:id`                       | —                                     | item                                                         |
| PATCH        | `/api/posts/:id`                       | `{ expected_version, patch }`         | `{ item, publishJob }` (job when the item is published)      |
| POST         | `/api/posts/:id/status`                | `{ expected_version, to }`            | `{ item, publishJob }`                                       |
| DELETE       | `/api/posts/:id`                       | `{ expected_version }`                | `{ item, publishJob }`                                       |
| POST         | `/api/posts/:id/restore`               | `{ expected_version }`                | `{ item, publishJob: null }`                                 |
| GET          | `/api/posts/:id/revisions`             | —                                     | revision summaries                                           |
| *            | `/api/pages[...]`                      | same as posts                         |                                                              |
| GET/POST     | `/api/categories`, `/api/tags`         | `{ name, slug?, description? }`       | list / 201 item                                              |
| PATCH/DELETE | `/api/categories/:id`, `/api/tags/:id` | `{ expected_version, patch? }`        | item                                                         |
| GET          | `/api/media`                           | —                                     | `{ items }`                                                  |
| POST         | `/api/media`                           | multipart `file`, `alt_text`          | 201 `{ item, deduplicated }`                                 |
| PATCH        | `/api/media/:id`                       | `{ expected_version, alt_text }`      | item                                                         |
| GET          | `/api/media/:id/preview`               | —                                     | image bytes (admin only)                                     |
| GET/PATCH    | `/api/settings`                        | `{ patch }`                           | `{ settings, updated_at }`                                   |
| GET          | `/api/publish`                         | —                                     | `{ jobs, snapshots }`                                        |
| POST         | `/api/publish`                         | `{ idempotency_key }`                 | 202 `{ job, coalesced, existing }`                           |
| GET          | `/api/publish/:jobId`                  | —                                     | `{ job, followUp, warnings }` — advances the job by one step |
| POST         | `/api/publish/rollback`                | `{ target_version, idempotency_key }` | 202 `{ job }`                                                |
| GET          | `/api/health`                          | —                                     | admin + GAS health                                           |

### Fields

Post: `title` (1–200), `slug` (`^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤100), `content_markdown` (≤40,000), `excerpt` (≤500), `author_name` (≤100), `category_id`, `tag_ids` (≤20), `cover_media_id`, `seo_title` (≤200), `seo_description` (≤500), `published_at`. Page: `title`, `slug` (not reserved), `content_markdown`, `nav_order` (0–9999 or null), SEO fields, `published_at`. Unknown keys → `VALIDATION_ERROR`.

### Error codes

| Code                                                                                          | HTTP            | Retryable |
| --------------------------------------------------------------------------------------------- | --------------- | --------- |
| `UNAUTHENTICATED`                                                                             | 401             | no        |
| `FORBIDDEN`                                                                                   | 403             | no        |
| `BAD_REQUEST`, `VALIDATION_ERROR`                                                             | 400             | no        |
| `NOT_FOUND`                                                                                   | 404             | no        |
| `SLUG_CONFLICT`, `VERSION_CONFLICT` (`details.current_version`), `INVALID_TRANSITION`         | 409             | no        |
| `PUBLISH_IN_PROGRESS`                                                                         | 202             | n/a       |
| `PAYLOAD_TOO_LARGE`                                                                           | 413             | no        |
| `UNSUPPORTED_MEDIA_TYPE`                                                                      | 415             | no        |
| `LOCK_TIMEOUT`                                                                                | 503             | yes       |
| `UPSTREAM_ERROR`, `GITHUB_ERROR`                                                              | 502             | yes       |
| `DEPLOY_FAILED` / `DEPLOY_TIMEOUT` / `VERIFY_TIMEOUT`                                         | job error codes | no        |
| `SIGNATURE_INVALID`, `REQUEST_EXPIRED`, `REPLAY_DETECTED`, `UNKNOWN_ACTION`, `INTERNAL_ERROR` | 500             | no        |

## Apps Script RPC

Transport: `POST <GAS_WEBAPP_URL>` with body `{ "e": "<envelope JSON>", "s": "<hex HMAC-SHA256(e)>" }`, envelope `{ v: 1, action, payload, ts, nonce, actor, requestId }`. Responses are always HTTP 200: `{ ok: true, data, requestId, ms }` or `{ ok: false, error: { code, message, details?, retryable }, requestId }`. Verification order: ADR-0001.

| Action                                                          | Lock                                | Payload → result                                                                                                                                                                                                     |
| --------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `system.health`                                                 | no                                  | → env, schema_version, row counts, invalid rows                                                                                                                                                                      |
| `system.setup`                                                  | yes                                 | → created sheets/columns; `FORBIDDEN` in prod after first run                                                                                                                                                        |
| `system.summary`                                                | no                                  | → counts, brief item list, active/last job, live snapshot, settings/taxonomy timestamps                                                                                                                              |
| `posts.*`, `pages.*`                                            | list/get/revisions: no; others: yes | `list {status,q,cursor,limit}` · `get {id}` · `create {fields}` · `update {id, expected_version, patch}` · `setStatus {id, expected_version, to}` · `softDelete`/`restore {id, expected_version}` · `revisions {id}` |
| `taxonomy.list/create/update/softDelete`                        | list: no                            | `{ kind: category                                                                                                                                                                                                    | tag, … }` |
| `media.upload`                                                  | yes                                 | `{ filename, mime, sha256, base64, alt_text }` → `{ item, deduplicated }`                                                                                                                                            |
| `media.list` / `media.update` / `media.getBytes`                | no / yes / no                       |                                                                                                                                                                                                                      |
| `settings.get` / `settings.update`                              | no / yes                            | `{ patch }`                                                                                                                                                                                                          |
| `publish.acquire`                                               | yes                                 | `{ type, idempotency_key, target_version? }` → `{ job, coalesced, existing }`                                                                                                                                        |
| `publish.claimStep`                                             | yes                                 | `{ id, state, lease_ms }` → `{ claimed, job }`                                                                                                                                                                       |
| `publish.updateJob`                                             | yes                                 | `{ id, from_state, to_state, fields }` → `{ updated, job, followUp }` (compare-and-set)                                                                                                                              |
| `publish.getJob` / `publish.listJobs` / `publish.readPublished` | no                                  |                                                                                                                                                                                                                      |
| `snapshots.record` / `snapshots.setStatus`                      | yes                                 |                                                                                                                                                                                                                      |
| `snapshots.list` / `snapshots.get` / `audit.list`               | no                                  |                                                                                                                                                                                                                      |

## Snapshot format

`apps/web/content/<env>/snapshot.json` (`zidcms.snapshot/1`) and `apps/web/content/<env>/zidcms-version.json` (served as `/zidcms-version.json`; ADR-0011) — see plan §14 and `packages/core/src/snapshot.ts`. `checksum = "sha256:" + sha256(canonical JSON without version/basedOnVersion/generatedAt/checksum)`.
