# Architecture

```text
                         ┌──────────────────────────────┐
 Admin browser ─────────►│ apps/admin (Next.js, Vercel) │
 (session cookie)        │  • Auth.js + allowlist       │
                         │  • validation (@zidcms/core) │
                         │  • publish orchestrator      │
                         └──────┬───────────────┬───────┘
              signed RPC (HMAC) │               │ GitHub Git Data API
                                ▼               ▼
                 ┌─────────────────────┐   ┌─────────────────────────┐
                 │ services/apps-script│   │ GitHub repo             │
                 │  doPost dispatcher  │   │  apps/web/content/<env> │
                 │  LockService        │   │  (main: dev, release:   │
                 │                     │   │   prod) — ADR-0011      │
                 └──────┬───────┬──────┘   └───────────┬─────────────┘
                        ▼       ▼                      │ push → Vercel build
               Google Sheets  Google Drive             ▼
               (data, jobs,   (private media) ┌──────────────────────────┐
                audit)                        │ apps/web (static export) │
                                              └───────────┬──────────────┘
                                                          ▼
                                                   Readers (static only)
```

## Components

| Component      | Responsibility                                                                                                                                                                                                | Key files                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `@zidcms/core` | Types, sheet schema (`SHEET_COLUMNS`), cell codec (formula escape), validators, slugs, status transitions, RPC envelope/verification, snapshot builder + checksum, live-state, Markdown renderer, pure sha256 | `packages/core/src/*`                                                    |
| Apps Script    | The only component touching Sheets/Drive. Dispatcher verifies the RPC, runs an action (under the script lock for writes), writes revision + audit rows                                                        | `services/apps-script/src/dispatcher.ts`, `actions/*`, `gas/adapters.ts` |
| Admin          | Auth, HTTP API, server-rendered screens, publish orchestration                                                                                                                                                | `apps/admin/lib/*`, `apps/admin/app/*`                                   |
| Public site    | Static HTML generated from `content/<env>/snapshot.json`                                                                                                                                                      | `apps/web/*`                                                             |

## Request flows

**Edit:** editor → `PATCH /api/posts/:id` (session + Origin + validation) → `posts.update` RPC → GAS lock → version check → write row + Revisions + AuditLog → response. If the item is published, the admin immediately calls `publish.acquire` and returns the job.

**Publish:** `POST /api/publish` → `publish.acquire` (coalescing/idempotency) → the browser polls `GET /api/publish/:id` every 3 s; each poll claims and performs one step:

| State         | Work                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------- |
| queued        | → collecting                                                                                      |
| collecting    | `publish.readPublished` → `buildSnapshot()` → checksum; equal to live → `live` (no-op)            |
| committing    | rebuild snapshot, fetch new media bytes (`media.getBytes`), atomic Git commit, `snapshots.record` |
| deploying     | read commit status for the SHA; 15-min timeout                                                    |
| verifying     | fetch `/zidcms-version.json?ts=…`; match version + checksum; 3-min timeout                        |
| live / failed | terminal; snapshot `live` (previous `superseded`) or `failed`                                     |

**Read (public):** CDN → static files. No function, no Google request.

## Data model

See plan §9 and `packages/core/src/schema/sheets.ts` (columns are resolved by header name; additional `PublishJobs` columns are listed in ADR-0008). Rows are never deleted; soft delete uses `deleted_at`.

## Trust zones

| Zone                 | Holds                                                                 |
| -------------------- | --------------------------------------------------------------------- |
| Browser              | session cookie only                                                   |
| Admin server         | `AUTH_SECRET`, `GAS_HMAC_SECRET`, `GITHUB_TOKEN`, Google OAuth secret |
| Apps Script          | `HMAC_SECRET`, Drive folder id; runs as the owner                     |
| GitHub / public site | published snapshot + media only                                       |

## Local development topology

`pnpm dev:gas` (dispatcher over HTTP with in-memory sheets persisted to `.local/`), `pnpm dev:admin` with `PUBLISH_TARGET=local` (writes snapshot files into `apps/web`), `pnpm dev:web` (`next dev` serving the freshly written files). The protocol, validation, and orchestrator code paths are the production ones.
